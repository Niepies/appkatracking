/**
 * Testy integracyjne Zustand store – store/subscription-store.ts
 *
 * Testujemy:
 * - add_subscription – tworzenie z cyklem
 * - update_subscription, delete_subscription
 * - mark_as_paid – status cyklu + nowy cykl
 * - cancel_subscription – flaga is_final_after_cancel
 * - toggle_active
 * - set_budget / monthly_budget
 * - get_subscription_by_id
 * - get_history_for
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { use_subscription_store } from "@/store/subscription-store";

// Mockujemy localStorage żeby testy były izolowane
const local_storage_mock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(global, "localStorage", { value: local_storage_mock });
Object.defineProperty(global, "crypto", {
  value: { randomUUID: () => Math.random().toString(36).slice(2) },
});

// Reset stanu store przed każdym testem
beforeEach(() => {
  local_storage_mock.clear();
  use_subscription_store.setState({
    subscriptions: [],
    payment_history: [],
    monthly_budget: 0,
  });
});

// ─── Helper – dodaj subskrypcję ───────────────────────────────────────────────

function add_netflix() {
  use_subscription_store.getState().add_subscription({
    name: "Netflix",
    amount: 49,
    currency: "PLN",
    payment_cycle: "monthly",
    category: "entertainment",
    next_payment_date: "2026-06-15",
  });
}

// ─── add_subscription ─────────────────────────────────────────────────────────

describe("add_subscription", () => {
  it("dodaje subskrypcję do stanu", () => {
    add_netflix();
    const { subscriptions } = use_subscription_store.getState();
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0].name).toBe("Netflix");
  });

  it("subskrypcja jest domyślnie aktywna", () => {
    add_netflix();
    const sub = use_subscription_store.getState().subscriptions[0];
    expect(sub.is_active).toBe(true);
  });

  it("tworzy jeden cykl rozliczeniowy", () => {
    add_netflix();
    const sub = use_subscription_store.getState().subscriptions[0];
    expect(sub.billing_cycles).toHaveLength(1);
    expect(sub.billing_cycles[0].status).toBe("pending");
  });

  it("cykl ma poprawną datę płatności", () => {
    add_netflix();
    const sub = use_subscription_store.getState().subscriptions[0];
    expect(sub.billing_cycles[0].scheduled_payment_date).toBe("2026-06-15");
  });

  it("tworzy cykl trial gdy has_trial=true", () => {
    use_subscription_store.getState().add_subscription({
      name: "Spotify",
      amount: 20,
      currency: "PLN",
      payment_cycle: "monthly",
      category: "entertainment",
      next_payment_date: "2026-06-01",
      has_trial: true,
      trial_end_date: "2026-07-01",
    });
    const sub = use_subscription_store.getState().subscriptions[0];
    expect(sub.billing_cycles[0].is_trial).toBe(true);
    expect(sub.billing_cycles[0].amount_charged).toBe(0);
  });

  it("zapisuje do localStorage", () => {
    add_netflix();
    const stored = local_storage_mock.getItem("subscontrol-subscriptions");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed[0].name).toBe("Netflix");
  });
});

// ─── update_subscription ──────────────────────────────────────────────────────

describe("update_subscription", () => {
  it("aktualizuje nazwę i kwotę", () => {
    add_netflix();
    const id = use_subscription_store.getState().subscriptions[0].id;
    use_subscription_store.getState().update_subscription(id, {
      name: "Netflix Premium",
      amount: 59,
    });
    const sub = use_subscription_store.getState().subscriptions[0];
    expect(sub.name).toBe("Netflix Premium");
    expect(sub.amount).toBe(59);
  });

  it("ignoruje nieistniejący ID (bez błędu)", () => {
    add_netflix();
    expect(() =>
      use_subscription_store.getState().update_subscription("nonexistent", { name: "X" })
    ).not.toThrow();
  });
});

// ─── delete_subscription ──────────────────────────────────────────────────────

describe("delete_subscription", () => {
  it("usuwa subskrypcję", () => {
    add_netflix();
    const id = use_subscription_store.getState().subscriptions[0].id;
    use_subscription_store.getState().delete_subscription(id);
    expect(use_subscription_store.getState().subscriptions).toHaveLength(0);
  });

  it("nie usuwa innych subskrypcji", () => {
    add_netflix();
    use_subscription_store.getState().add_subscription({
      name: "Spotify",
      amount: 20,
      currency: "PLN",
      payment_cycle: "monthly",
      category: "entertainment",
      next_payment_date: "2026-07-01",
    });
    const id = use_subscription_store.getState().subscriptions[0].id;
    use_subscription_store.getState().delete_subscription(id);
    expect(use_subscription_store.getState().subscriptions).toHaveLength(1);
    expect(use_subscription_store.getState().subscriptions[0].name).toBe("Spotify");
  });
});

// ─── mark_as_paid ─────────────────────────────────────────────────────────────

describe("mark_as_paid", () => {
  it("oznacza cykl jako paid", () => {
    add_netflix();
    const id = use_subscription_store.getState().subscriptions[0].id;
    use_subscription_store.getState().mark_as_paid(id);

    const sub = use_subscription_store.getState().subscriptions[0];
    const paid = sub.billing_cycles.find((c) => c.status === "paid");
    expect(paid).toBeDefined();
    expect(paid?.paid_at).toBeTruthy();
  });

  it("tworzy nowy cykl pending po opłaceniu", () => {
    add_netflix();
    const id = use_subscription_store.getState().subscriptions[0].id;
    const initial_count = use_subscription_store
      .getState()
      .subscriptions[0].billing_cycles.length;

    use_subscription_store.getState().mark_as_paid(id);

    const sub = use_subscription_store.getState().subscriptions[0];
    expect(sub.billing_cycles.length).toBe(initial_count + 1);

    const pending = sub.billing_cycles.filter((c) => c.status === "pending");
    expect(pending).toHaveLength(1);
  });

  it("nowy cykl zaczyna się po zakończeniu poprzedniego", () => {
    add_netflix();
    const id = use_subscription_store.getState().subscriptions[0].id;
    use_subscription_store.getState().mark_as_paid(id);

    const sub = use_subscription_store.getState().subscriptions[0];
    const paid = sub.billing_cycles.find((c) => c.status === "paid")!;
    const pending = sub.billing_cycles.find((c) => c.status === "pending")!;

    expect(pending.period_start).toBe(paid.period_end);
  });

  it("dodaje wpis do historii płatności", () => {
    add_netflix();
    const id = use_subscription_store.getState().subscriptions[0].id;
    use_subscription_store.getState().mark_as_paid(id);

    const { payment_history } = use_subscription_store.getState();
    expect(payment_history).toHaveLength(1);
    expect(payment_history[0].subscription_name).toBe("Netflix");
    expect(payment_history[0].amount).toBe(49);
  });
});

// ─── cancel_subscription ──────────────────────────────────────────────────────

describe("cancel_subscription", () => {
  it("ustawia is_active=false", () => {
    add_netflix();
    const id = use_subscription_store.getState().subscriptions[0].id;
    use_subscription_store.getState().cancel_subscription(id);

    const sub = use_subscription_store.getState().subscriptions[0];
    expect(sub.is_active).toBe(false);
  });

  it("ustawia is_final_after_cancel=true na aktywnym cyklu", () => {
    add_netflix();
    const id = use_subscription_store.getState().subscriptions[0].id;
    use_subscription_store.getState().cancel_subscription(id);

    const sub = use_subscription_store.getState().subscriptions[0];
    const final = sub.billing_cycles.find((c) => c.is_final_after_cancel);
    expect(final).toBeDefined();
  });
});

// ─── toggle_active ────────────────────────────────────────────────────────────

describe("toggle_active", () => {
  it("wyłącza aktywną subskrypcję", () => {
    add_netflix();
    const id = use_subscription_store.getState().subscriptions[0].id;
    use_subscription_store.getState().toggle_active(id);
    expect(use_subscription_store.getState().subscriptions[0].is_active).toBe(false);
  });

  it("włącza nieaktywną subskrypcję", () => {
    add_netflix();
    const id = use_subscription_store.getState().subscriptions[0].id;
    use_subscription_store.getState().toggle_active(id); // wyłącz
    use_subscription_store.getState().toggle_active(id); // włącz
    expect(use_subscription_store.getState().subscriptions[0].is_active).toBe(true);
  });
});

// ─── set_budget ───────────────────────────────────────────────────────────────

describe("set_budget", () => {
  it("ustawia budżet miesięczny", () => {
    use_subscription_store.getState().set_budget(500);
    expect(use_subscription_store.getState().monthly_budget).toBe(500);
  });

  it("zapisuje budżet do localStorage", () => {
    use_subscription_store.getState().set_budget(300);
    expect(local_storage_mock.getItem("subscontrol-budget")).toBe("300");
  });
});

// ─── get_subscription_by_id ───────────────────────────────────────────────────

describe("get_subscription_by_id", () => {
  it("zwraca subskrypcję po ID", () => {
    add_netflix();
    const id = use_subscription_store.getState().subscriptions[0].id;
    const sub = use_subscription_store.getState().get_subscription_by_id(id);
    expect(sub?.name).toBe("Netflix");
  });

  it("zwraca undefined dla nieistniejącego ID", () => {
    add_netflix();
    expect(
      use_subscription_store.getState().get_subscription_by_id("nonexistent")
    ).toBeUndefined();
  });
});

// ─── get_history_for ──────────────────────────────────────────────────────────

describe("get_history_for", () => {
  it("zwraca opłacone cykle jako historię", () => {
    add_netflix();
    const id = use_subscription_store.getState().subscriptions[0].id;
    use_subscription_store.getState().mark_as_paid(id);

    const history = use_subscription_store.getState().get_history_for(id);
    expect(history).toHaveLength(1);
    expect(history[0].subscription_name).toBe("Netflix");
  });

  it("zwraca pustą tablicę dla subskrypcji bez płatności", () => {
    add_netflix();
    const id = use_subscription_store.getState().subscriptions[0].id;
    expect(use_subscription_store.getState().get_history_for(id)).toHaveLength(0);
  });
});

// ─── Wielokrotne operacje ─────────────────────────────────────────────────────

describe("sekwencja operacji", () => {
  it("dodaj -> opłać -> anuluj -> lista nie pusta", () => {
    add_netflix();
    const id = use_subscription_store.getState().subscriptions[0].id;
    use_subscription_store.getState().mark_as_paid(id);
    use_subscription_store.getState().cancel_subscription(id);

    const sub = use_subscription_store.getState().subscriptions[0];
    expect(sub.is_active).toBe(false);
    expect(sub.billing_cycles.some((c) => c.status === "paid")).toBe(true);
  });

  it("add_next_cycle_manually dodaje cykl", () => {
    add_netflix();
    const id = use_subscription_store.getState().subscriptions[0].id;
    const before = use_subscription_store.getState().subscriptions[0].billing_cycles.length;

    use_subscription_store.getState().add_next_cycle_manually(id);

    const after = use_subscription_store.getState().subscriptions[0].billing_cycles.length;
    expect(after).toBe(before + 1);
  });
});
