/**
 * Testy komponentowe SubscriptionCard – guard logowania (credential guard)
 *
 * Testujemy trzy stany has_credentials:
 *   false → badge + redirect na stronę serwisu zamiast akcji
 *   true  → normalne przyciski + wywołanie check-payment API
 *   null  → normalne przyciski + lokalny fallback
 *
 * Mocki:
 *   - use_credential_check  – kontrolowany stan has_credentials
 *   - sonner toast          – weryfikacja wywołań
 *   - get_service_urls      – stałe URL-e
 *   - fetch (global)        – odpowiedzi check-payment API
 *   - window.open           – spy
 *   - use_subscription_store – PRAWDZIWY store (weryfikujemy stan po akcji)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// ── Moduły do mockowania (zanim zostaną zaimportowane) ───────────────────────
vi.mock("@/hooks/use-credential-check");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  }),
}));
vi.mock("@/lib/service-urls", () => ({
  get_service_urls: () => ({
    manage_url: "https://netflix.com/account",
    cancel_url: null,
    display: "Netflix",
    is_direct: true,
  }),
}));

// ── Importy po mockach ───────────────────────────────────────────────────────
import { use_credential_check } from "@/hooks/use-credential-check";
import { use_subscription_store } from "@/store/subscription-store";
import { toast } from "sonner";
import { SubscriptionCard } from "@/components/subscription/subscription-card";
import type { Subscription } from "@/types";

// ── localStorage mock ────────────────────────────────────────────────────────
const ls_mock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(global, "localStorage", { value: ls_mock });
Object.defineProperty(global, "crypto", {
  value: { randomUUID: () => Math.random().toString(36).slice(2) },
});

// ── Fixture subskrypcji (przyszła płatność za 10 dni) ────────────────────────
const MOCK_SUB: Subscription = {
  id: "card-sub-1",
  name: "Netflix",
  amount: 49,
  payment_cycle: "monthly",
  category: "entertainment",
  is_active: true,
  billing_cycles: [
    {
      id: "cycle-1",
      subscription_id: "card-sub-1",
      period_start: "2026-02-05",
      period_end: "2026-03-04",
      scheduled_payment_date: "2026-03-15",
      status: "pending",
      amount_charged: 49,
      is_trial: false,
      is_final_after_cancel: false,
    },
  ],
  created_at: "2026-01-01T00:00:00.000Z",
};

// ── Helper: ustawia has_credentials w mocku hooka ────────────────────────────
function set_creds(val: boolean | null) {
  vi.mocked(use_credential_check).mockReturnValue({
    has_credentials: val,
    is_checking_creds: false,
    service_key: "netflix",
    invalidate: vi.fn(),
  });
}

// ── Helpers nawigacyjne ──────────────────────────────────────────────────────
const get_pay_btn = () => screen.getByRole("button", { name: /opłać|zaloguj się/i });
const get_toggle_btns = () => screen.getAllByRole("button").filter(
  (b) => b.textContent?.match(/Wyłącz|Włącz/)
);

// ════════════════════════════════════════════════════════════════════════════
describe("SubscriptionCard – credential guard", () => {
  beforeEach(() => {
    ls_mock.clear();
    use_subscription_store.setState({
      subscriptions: [{ ...MOCK_SUB, billing_cycles: [{ ...MOCK_SUB.billing_cycles[0] }] }],
      payment_history: [],
      monthly_budget: 0,
    });
    vi.clearAllMocks();
    set_creds(null); // domyślnie: API niedostępne
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers(); // zawsze przywracaj timery, nawet po timeout testu
  });

  // ── Wizualny stan – badge ─────────────────────────────────────────────────

  it("wyświetla badge 'Niezalogowany' gdy has_credentials === false", () => {
    set_creds(false);
    render(<SubscriptionCard subscription={MOCK_SUB} />);
    expect(screen.getByText("Niezalogowany")).toBeInTheDocument();
  });

  it("NIE wyświetla badge gdy has_credentials === null", () => {
    set_creds(null);
    render(<SubscriptionCard subscription={MOCK_SUB} />);
    expect(screen.queryByText("Niezalogowany")).not.toBeInTheDocument();
  });

  it("NIE wyświetla badge gdy has_credentials === true", () => {
    set_creds(true);
    render(<SubscriptionCard subscription={MOCK_SUB} />);
    expect(screen.queryByText("Niezalogowany")).not.toBeInTheDocument();
  });

  // ── Tekst przycisku płatności ─────────────────────────────────────────────

  it("przycisk płatności pokazuje 'Zaloguj się' gdy has_credentials === false", () => {
    set_creds(false);
    render(<SubscriptionCard subscription={MOCK_SUB} />);
    expect(screen.getByRole("button", { name: /zaloguj się/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^opłać$/i })).not.toBeInTheDocument();
  });

  it("przycisk płatności pokazuje 'Opłać' gdy has_credentials === null", () => {
    set_creds(null);
    render(<SubscriptionCard subscription={MOCK_SUB} />);
    expect(screen.getByRole("button", { name: /opłać/i })).toBeInTheDocument();
  });

  it("przycisk płatności pokazuje 'Opłać' gdy has_credentials === true", () => {
    set_creds(true);
    render(<SubscriptionCard subscription={MOCK_SUB} />);
    expect(screen.getByRole("button", { name: /opłać/i })).toBeInTheDocument();
  });

  // ── Nieaktywna subskrypcja ────────────────────────────────────────────────

  it("NIE wyświetla przycisku 'Opłać' gdy subskrypcja nieaktywna", () => {
    set_creds(null);
    const inactive = { ...MOCK_SUB, is_active: false };
    render(<SubscriptionCard subscription={inactive} />);
    expect(screen.queryByRole("button", { name: /opłać|zaloguj się/i })).not.toBeInTheDocument();
  });

  // ── handle_pay: has_credentials === false ────────────────────────────────

  it("kliknięcie 'Zaloguj się' (false) → otwiera URL serwisu", async () => {
    set_creds(false);
    vi.spyOn(window, "open").mockImplementation(() => null);
    render(<SubscriptionCard subscription={MOCK_SUB} />);
    await userEvent.click(screen.getByRole("button", { name: /zaloguj się/i }));
    expect(window.open).toHaveBeenCalledWith(
      "https://netflix.com/account", "_blank", "noopener,noreferrer"
    );
  });

  it("kliknięcie 'Zaloguj się' (false) → subskrypcja NIE zmienia statusu", async () => {
    set_creds(false);
    vi.spyOn(window, "open").mockImplementation(() => null);
    render(<SubscriptionCard subscription={MOCK_SUB} />);
    await userEvent.click(screen.getByRole("button", { name: /zaloguj się/i }));
    const state = use_subscription_store.getState();
    expect(state.subscriptions[0].billing_cycles[0].status).toBe("pending");
  });

  // ── handle_pay: has_credentials === true ─────────────────────────────────

  it("kliknięcie 'Opłać' (true) → wywołuje POST /api/automation/check-payment", async () => {
    set_creds(true);
    const fetch_mock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        subscription_id: "card-sub-1",
        payment_found: false,
        message: "Brak płatności",
      }),
    });
    vi.stubGlobal("fetch", fetch_mock);
    render(<SubscriptionCard subscription={MOCK_SUB} />);
    await userEvent.click(get_pay_btn());
    await waitFor(() =>
      expect(fetch_mock).toHaveBeenCalledWith(
        "/api/automation/check-payment",
        expect.objectContaining({ method: "POST" })
      )
    );
  });

  it("check-payment zwraca payment_found=true → mark_as_paid", async () => {
    set_creds(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        subscription_id: "card-sub-1",
        payment_found: true,
        message: "Subskrypcja aktywna",
      }),
    }));
    render(<SubscriptionCard subscription={MOCK_SUB} />);
    await userEvent.click(get_pay_btn());
    await waitFor(() => {
      const state = use_subscription_store.getState();
      expect(state.subscriptions[0].billing_cycles[0].status).toBe("paid");
    });
  });

  it("check-payment zwraca payment_found=true → toast.success", async () => {
    set_creds(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        subscription_id: "card-sub-1",
        payment_found: true,
        message: "OK",
      }),
    }));
    render(<SubscriptionCard subscription={MOCK_SUB} />);
    await userEvent.click(get_pay_btn());
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("check-payment zwraca payment_found=false → toast.warning", async () => {
    set_creds(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        subscription_id: "card-sub-1",
        payment_found: false,
        message: "Nie wykryto płatności",
      }),
    }));
    render(<SubscriptionCard subscription={MOCK_SUB} />);
    await userEvent.click(get_pay_btn());
    await waitFor(() => expect(toast.warning).toHaveBeenCalled());
    // Subskrypcja NIE oznaczona jako opłacona
    const state = use_subscription_store.getState();
    expect(state.subscriptions[0].billing_cycles[0].status).toBe("pending");
  });

  it("check-payment API zwraca błąd HTTP → lokalny fallback mark_as_paid", async () => {
    set_creds(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    render(<SubscriptionCard subscription={MOCK_SUB} />);
    await userEvent.click(get_pay_btn());
    await waitFor(() => {
      const state = use_subscription_store.getState();
      expect(state.subscriptions[0].billing_cycles[0].status).toBe("paid");
    });
  });

  it("check-payment sieć niedostępna (fetch throws) → lokalny fallback mark_as_paid", async () => {
    set_creds(true);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    render(<SubscriptionCard subscription={MOCK_SUB} />);
    await userEvent.click(get_pay_btn());
    await waitFor(() => {
      const state = use_subscription_store.getState();
      expect(state.subscriptions[0].billing_cycles[0].status).toBe("paid");
    });
  });

  // ── handle_pay: has_credentials === null (lokalny fallback z setTimeout) ──

  it("kliknięcie 'Opłać' (null) → mark_as_paid przez localny timeout", async () => {
    set_creds(null);
    vi.useFakeTimers();
    render(<SubscriptionCard subscription={MOCK_SUB} />);
    // fireEvent zamiast userEvent – userEvent używa timerów wewnętrznie
    fireEvent.click(screen.getByRole("button", { name: /opłać/i }));
    await act(async () => { vi.advanceTimersByTime(700); });
    const state = use_subscription_store.getState();
    expect(state.subscriptions[0].billing_cycles[0].status).toBe("paid");
    vi.useRealTimers();
  });

  // ── handle_toggle: has_credentials === false ─────────────────────────────

  it("kliknięcie 'Wyłącz' (false) → otwiera URL serwisu", async () => {
    set_creds(false);
    vi.spyOn(window, "open").mockImplementation(() => null);
    render(<SubscriptionCard subscription={MOCK_SUB} />);
    const btn = get_toggle_btns()[0];
    await userEvent.click(btn!);
    expect(window.open).toHaveBeenCalledWith(
      "https://netflix.com/account", "_blank", "noopener,noreferrer"
    );
  });

  it("kliknięcie 'Wyłącz' (false) → subskrypcja pozostaje aktywna", async () => {
    set_creds(false);
    vi.spyOn(window, "open").mockImplementation(() => null);
    render(<SubscriptionCard subscription={MOCK_SUB} />);
    const btn = get_toggle_btns()[0];
    await userEvent.click(btn!);
    const state = use_subscription_store.getState();
    expect(state.subscriptions[0].is_active).toBe(true);
  });

  // ── handle_toggle: has_credentials !== false ─────────────────────────────

  it("kliknięcie 'Wyłącz' (null) → deaktywuje subskrypcję w store", async () => {
    set_creds(null);
    render(<SubscriptionCard subscription={MOCK_SUB} />);
    const btn = get_toggle_btns()[0];
    await userEvent.click(btn!);
    await waitFor(() => {
      const state = use_subscription_store.getState();
      expect(state.subscriptions[0].is_active).toBe(false);
    });
  });

  it("kliknięcie 'Wyłącz' (true) → deaktywuje subskrypcję w store", async () => {
    set_creds(true);
    render(<SubscriptionCard subscription={MOCK_SUB} />);
    const btn = get_toggle_btns()[0];
    await userEvent.click(btn!);
    await waitFor(() => {
      const state = use_subscription_store.getState();
      expect(state.subscriptions[0].is_active).toBe(false);
    });
  });
});
