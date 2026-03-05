/**
 * Testy komponentowe SubscriptionDetailModal – guard logowania
 *
 * Testujemy:
 *   - banner ostrzegawczy gdy brak danych logowania
 *   - handle_pay: redirect / check-payment API / fallback
 *   - handle_toggle: redirect / toggle_active
 *   - zamknięcie modalu po udanej akcji
 *   - renderowanie null gdy subscription = null
 *
 * Dialog (Radix UI) jest mockowany, żeby uniknąć problemów z portalem jsdom.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// ── Moduły do mockowania ─────────────────────────────────────────────────────
vi.mock("@/hooks/use-credential-check");
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    <h2 data-testid="dialog-title">{children}</h2>,
}));
vi.mock("@/components/automation/automation-button", () => ({
  AutomationButton: () => <div data-testid="automation-button" />,
}));
vi.mock("@/components/subscription/subscription-form", () => ({
  SubscriptionForm: () => <div data-testid="subscription-form" />,
}));
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
    cancel_url: "https://netflix.com/cancel",
    display: "Netflix",
    is_direct: true,
  }),
}));

// ── Importy po mockach ───────────────────────────────────────────────────────
import { use_credential_check } from "@/hooks/use-credential-check";
import { use_subscription_store } from "@/store/subscription-store";
import { toast } from "sonner";
import { SubscriptionDetailModal } from "@/components/subscription/subscription-detail-modal";
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

// ── Fixture subskrypcji ──────────────────────────────────────────────────────
const MOCK_SUB: Subscription = {
  id: "modal-sub-1",
  name: "Netflix",
  amount: 49,
  payment_cycle: "monthly",
  category: "entertainment",
  is_active: true,
  billing_cycles: [
    {
      id: "cycle-1",
      subscription_id: "modal-sub-1",
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

// ── Helper: ustawia has_credentials ─────────────────────────────────────────
function set_creds(val: boolean | null) {
  vi.mocked(use_credential_check).mockReturnValue({
    has_credentials: val,
    is_checking_creds: false,
    service_key: "netflix",
    invalidate: vi.fn(),
  });
}

// ── Helper: renderuje modal z on_close mockiem ───────────────────────────────
function render_modal(on_close = vi.fn()) {
  return {
    on_close,
    ...render(
      <SubscriptionDetailModal
        subscription={MOCK_SUB}
        is_open={true}
        on_close={on_close}
      />
    ),
  };
}

// ════════════════════════════════════════════════════════════════════════════
describe("SubscriptionDetailModal – credential guard", () => {
  beforeEach(() => {
    ls_mock.clear();
    use_subscription_store.setState({
      subscriptions: [{ ...MOCK_SUB, billing_cycles: [{ ...MOCK_SUB.billing_cycles[0] }] }],
      payment_history: [],
      monthly_budget: 0,
    });
    vi.clearAllMocks();
    set_creds(null); // domyślnie
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers(); // zawsze przywracaj timery, nawet po timeout testu
  });

  // ── Renderowanie ──────────────────────────────────────────────────────────

  it("renderuje null gdy subscription === null", () => {
    set_creds(null);
    const { container } = render(
      <SubscriptionDetailModal subscription={null} is_open={true} on_close={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("nie renderuje treści gdy is_open === false", () => {
    set_creds(null);
    render(
      <SubscriptionDetailModal subscription={MOCK_SUB} is_open={false} on_close={vi.fn()} />
    );
    expect(screen.queryByTestId("dialog-content")).not.toBeInTheDocument();
  });

  it("renderuje treść modalu gdy is_open === true", () => {
    set_creds(null);
    render_modal();
    expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
  });

  // ── Banner ostrzegawczy ───────────────────────────────────────────────────

  it("wyświetla banner ostrzegawczy gdy has_credentials === false", () => {
    set_creds(false);
    render_modal();
    expect(
      screen.getByText(/brak zapisanych danych logowania/i)
    ).toBeInTheDocument();
  });

  it("NIE wyświetla bannera gdy has_credentials === true", () => {
    set_creds(true);
    render_modal();
    expect(
      screen.queryByText(/brak zapisanych danych logowania/i)
    ).not.toBeInTheDocument();
  });

  it("NIE wyświetla bannera gdy has_credentials === null", () => {
    set_creds(null);
    render_modal();
    expect(
      screen.queryByText(/brak zapisanych danych logowania/i)
    ).not.toBeInTheDocument();
  });

  // ── handle_pay: has_credentials === false ────────────────────────────────

  it("kliknięcie 'Opłać teraz' (false) → otwiera URL serwisu", async () => {
    set_creds(false);
    render_modal();
    await userEvent.click(screen.getByRole("button", { name: /opłać teraz/i }));
    expect(window.open).toHaveBeenCalledWith(
      "https://netflix.com/account", "_blank", "noopener,noreferrer"
    );
  });

  it("kliknięcie 'Opłać teraz' (false) → toast.warning", async () => {
    set_creds(false);
    render_modal();
    await userEvent.click(screen.getByRole("button", { name: /opłać teraz/i }));
    expect(toast.warning).toHaveBeenCalled();
  });

  it("kliknięcie 'Opłać teraz' (false) → subskrypcja NIE zmienia statusu", async () => {
    set_creds(false);
    render_modal();
    await userEvent.click(screen.getByRole("button", { name: /opłać teraz/i }));
    const state = use_subscription_store.getState();
    expect(state.subscriptions[0].billing_cycles[0].status).toBe("pending");
  });

  // ── handle_pay: has_credentials === true ─────────────────────────────────

  it("kliknięcie 'Opłać teraz' (true) → wywołuje POST check-payment", async () => {
    set_creds(true);
    const fetch_mock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          subscription_id: "modal-sub-1",
          payment_found: false,
          message: "Brak płatności",
        }),
    });
    vi.stubGlobal("fetch", fetch_mock);
    render_modal();
    await userEvent.click(screen.getByRole("button", { name: /opłać teraz/i }));
    await waitFor(() =>
      expect(fetch_mock).toHaveBeenCalledWith(
        "/api/automation/check-payment",
        expect.objectContaining({ method: "POST" })
      )
    );
  });

  it("check-payment payment_found=true → mark_as_paid + on_close", async () => {
    set_creds(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          subscription_id: "modal-sub-1",
          payment_found: true,
          message: "Subskrypcja aktywna",
        }),
    }));
    const { on_close } = render_modal();
    await userEvent.click(screen.getByRole("button", { name: /opłać teraz/i }));
    await waitFor(() => {
      const state = use_subscription_store.getState();
      expect(state.subscriptions[0].billing_cycles[0].status).toBe("paid");
    });
    expect(on_close).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it("check-payment payment_found=false → toast.warning, modal NIE zamknięty", async () => {
    set_creds(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          subscription_id: "modal-sub-1",
          payment_found: false,
          message: "Nie wykryto płatności",
        }),
    }));
    const { on_close } = render_modal();
    await userEvent.click(screen.getByRole("button", { name: /opłać teraz/i }));
    await waitFor(() => expect(toast.warning).toHaveBeenCalled());
    expect(on_close).not.toHaveBeenCalled();
    const state = use_subscription_store.getState();
    expect(state.subscriptions[0].billing_cycles[0].status).toBe("pending");
  });

  it("check-payment API błąd HTTP → lokalny fallback mark_as_paid", async () => {
    set_creds(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    render_modal();
    await userEvent.click(screen.getByRole("button", { name: /opłać teraz/i }));
    await waitFor(() => {
      const state = use_subscription_store.getState();
      expect(state.subscriptions[0].billing_cycles[0].status).toBe("paid");
    });
  });

  // ── handle_pay: has_credentials === null (lokalny fallback setTimeout) ────

  it("kliknięcie 'Opłać teraz' (null) → mark_as_paid przez timeout", async () => {
    set_creds(null);
    vi.useFakeTimers();
    render_modal();
    // fireEvent zamiast userEvent – userEvent używa timerów wewnętrznie
    fireEvent.click(screen.getByRole("button", { name: /opłać teraz/i }));
    await act(async () => { vi.advanceTimersByTime(800); });
    const state = use_subscription_store.getState();
    expect(state.subscriptions[0].billing_cycles[0].status).toBe("paid");
    vi.useRealTimers();
  });

  // ── handle_toggle: has_credentials === false ─────────────────────────────

  it("kliknięcie 'Wyłącz' (false) → otwiera URL serwisu", async () => {
    set_creds(false);
    render_modal();
    await userEvent.click(screen.getByRole("button", { name: /wyłącz/i }));
    expect(window.open).toHaveBeenCalledWith(
      "https://netflix.com/account", "_blank", "noopener,noreferrer"
    );
  });

  it("kliknięcie 'Wyłącz' (false) → toast.warning", async () => {
    set_creds(false);
    render_modal();
    await userEvent.click(screen.getByRole("button", { name: /wyłącz/i }));
    expect(toast.warning).toHaveBeenCalled();
  });

  it("kliknięcie 'Wyłącz' (false) → subskrypcja remain aktywna", async () => {
    set_creds(false);
    render_modal();
    await userEvent.click(screen.getByRole("button", { name: /wyłącz/i }));
    const state = use_subscription_store.getState();
    expect(state.subscriptions[0].is_active).toBe(true);
  });

  // ── handle_toggle: has_credentials !== false ─────────────────────────────

  it("kliknięcie 'Wyłącz' (null) → deaktywuje subskrypcję", async () => {
    set_creds(null);
    const { on_close } = render_modal();
    await userEvent.click(screen.getByRole("button", { name: /wyłącz/i }));
    await waitFor(() => {
      const state = use_subscription_store.getState();
      expect(state.subscriptions[0].is_active).toBe(false);
    });
    expect(on_close).toHaveBeenCalled();
  });

  it("kliknięcie 'Wyłącz' (true) → deaktywuje subskrypcję", async () => {
    set_creds(true);
    const { on_close } = render_modal();
    await userEvent.click(screen.getByRole("button", { name: /wyłącz/i }));
    await waitFor(() => {
      const state = use_subscription_store.getState();
      expect(state.subscriptions[0].is_active).toBe(false);
    });
    expect(on_close).toHaveBeenCalled();
  });

  // ── Dane w ciele żądania check-payment ───────────────────────────────────

  it("ciało żądania check-payment zawiera subscription_id, service_key i amount", async () => {
    set_creds(true);
    const fetch_mock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          subscription_id: "modal-sub-1",
          payment_found: true,
          message: "OK",
        }),
    });
    vi.stubGlobal("fetch", fetch_mock);
    render_modal();
    await userEvent.click(screen.getByRole("button", { name: /opłać teraz/i }));
    await waitFor(() => expect(fetch_mock).toHaveBeenCalled());

    const body = JSON.parse(fetch_mock.mock.calls[0][1].body as string);
    expect(body.subscription_id).toBe("modal-sub-1");
    expect(body.service_key).toBe("netflix");
    expect(body.expected_amount).toBe(49);
    expect(body.expected_date).toBe("2026-03-15");
  });
});
