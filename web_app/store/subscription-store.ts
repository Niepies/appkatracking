// Store Zustand do zarządzania subskrypcjami z persystencją w localStorage
// Celowo NIE używamy middleware `persist` – jego wewnętrzne hooki zmieniają
// swoją liczbę przy rehydratacji i powodują naruszenie Rules of Hooks w React.
// Persystencja jest obsługiwana ręcznie przez StoreHydration.

import { create } from "zustand";
import { format, parseISO } from "date-fns";
import {
  generate_id,
  add_billing_period,
  get_next_billing_cycle,
  get_next_payment_date,
} from "@/lib/utils";
import type { Subscription, BillingCycle, PaymentHistoryEntry } from "@/types";

const STORAGE_KEY  = "subscontrol-subscriptions";
const HISTORY_KEY  = "subscontrol-payment-history";
const BUDGET_KEY   = "subscontrol-budget";

// ---------------------------------------------------------------------------
// Helpers persystencji
// ---------------------------------------------------------------------------

export function save_budget(amount: number) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(BUDGET_KEY, String(amount)); } catch {}
}

export function load_budget(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(BUDGET_KEY);
    return raw ? Number(raw) : 0;
  } catch { return 0; }
}

export function save_subscriptions(subscriptions: Subscription[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
  } catch {}
}

/**
 * Migruje stare subskrypcje (bez billing_cycles) do nowego formatu.
 * Tworzy jeden cykl „pending" na podstawie legacy pola next_payment_date.
 */
function migrate_subscription(raw: Record<string, unknown>): Subscription {
  const sub = raw as unknown as Subscription;
  if (sub.billing_cycles && sub.billing_cycles.length > 0) return sub;

  // Stare pole next_payment_date jako baza
  const next_date = (raw.next_payment_date as string) ?? format(new Date(), "yyyy-MM-dd");
  const period_end_date  = parseISO(next_date);
  const period_start_date = add_billing_period(
    period_end_date,
    sub.payment_cycle === "yearly" ? "yearly" : "monthly"
  );
  // Cofamy się o cykl (period_start = next_date - 1 cykl)
  // add_billing_period idzie do przodu, więc cofamy inaczej:
  const period_start = format(
    new Date(period_end_date.getTime() - (period_end_date.getTime() - period_start_date.getTime())),
    "yyyy-MM-dd"
  );

  // Prostsze: cofamy o jeden miesiąc / rok ręcznie
  const ps = new Date(period_end_date);
  if (sub.payment_cycle === "yearly") {
    ps.setFullYear(ps.getFullYear() - 1);
  } else {
    ps.setMonth(ps.getMonth() - 1);
  }

  const initial_cycle: BillingCycle = {
    id: generate_id(),
    subscription_id: sub.id,
    period_start: format(ps, "yyyy-MM-dd"),
    period_end: next_date,
    scheduled_payment_date: next_date,
    status: "pending",
    amount_charged: sub.amount,
    is_trial: false,
    is_final_after_cancel: !sub.is_active,
  };

  return { ...sub, billing_cycles: [initial_cycle] };
}

export function load_subscriptions(): Subscription[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, unknown>[];
    return parsed.map(migrate_subscription);
  } catch {
    return [];
  }
}

export function save_history(history: PaymentHistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = history.slice(-200);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {}
}

export function load_history(): PaymentHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as PaymentHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Typy store
// ---------------------------------------------------------------------------

interface SubscriptionStore {
  subscriptions: Subscription[];
  payment_history: PaymentHistoryEntry[];

  /** Dodaje nową subskrypcję z pierwszym cyklem rozliczeniowym */
  add_subscription: (
    data: Omit<Subscription, "id" | "created_at" | "is_active" | "billing_cycles"> & {
      next_payment_date: string;
      has_trial?: boolean;
      trial_end_date?: string;
    }
  ) => void;

  /** Aktualizuje statyczne dane subskrypcji */
  update_subscription: (
    id: string,
    data: Partial<Omit<Subscription, "id" | "created_at" | "billing_cycles">>
  ) => void;

  /** Usuwa subskrypcję (wraz z cyklami) */
  delete_subscription: (id: string) => void;

  /**
   * Oznacza aktywny oczekujący cykl jako opłacony i automatycznie
   * tworzy nowy cykl na kolejny okres.
   */
  mark_as_paid: (id: string) => void;

  /**
   * Anuluje subskrypcję: ustawia is_final_after_cancel na aktywnym cyklu,
   * wyłącza subskrypcję. Dostęp trwa do końca bieżącego okresu.
   */
  cancel_subscription: (id: string) => void;

  /** Włącza lub wyłącza subskrypcję (pauza) */
  toggle_active: (id: string) => void;

  /** Ręcznie dodaje kolejny cykl rozliczeniowy (np. po anulowaniu wznowienia) */
  add_next_cycle_manually: (id: string) => void;

  /** Oznacza wybrany cykl jako nieudaną płatność */
  mark_cycle_failed: (subscription_id: string, cycle_id: string) => void;

  /** Zwraca subskrypcję po ID */
  get_subscription_by_id: (id: string) => Subscription | undefined;

  /** Zwraca historię opłaconych cykli dla danej subskrypcji */
  get_history_for: (subscription_id: string) => PaymentHistoryEntry[];

  monthly_budget: number;
  set_budget: (amount: number) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const use_subscription_store = create<SubscriptionStore>()((set, get) => ({
  subscriptions:   [],
  payment_history: [],
  monthly_budget:  0,

  add_subscription: (data) => {
    const sub_id   = generate_id();
    const next_date      = data.next_payment_date;
    const amount         = data.amount;
    const payment_cycle  = data.payment_cycle;
    const has_trial      = data.has_trial ?? false;
    const trial_end_date = data.trial_end_date;

    const cycles: BillingCycle[] = [];

    if (has_trial && trial_end_date) {
      // Cykl próbny: od next_payment_date (data startu) do trial_end_date
      // W tym czasie użytkownik nie płaci
      const trial_cycle: BillingCycle = {
        id: generate_id(),
        subscription_id: sub_id,
        period_start: next_date,
        period_end: trial_end_date,
        scheduled_payment_date: trial_end_date,
        status: "pending",
        amount_charged: 0,
        is_trial: true,
        is_final_after_cancel: false,
      };
      cycles.push(trial_cycle);
    } else {
      // Regularny cykl: cofamy o jeden okres, płatność = next_date
      const period_end_d   = parseISO(next_date);
      const period_start_d = new Date(period_end_d);
      if (payment_cycle === "yearly") {
        period_start_d.setFullYear(period_start_d.getFullYear() - 1);
      } else {
        period_start_d.setMonth(period_start_d.getMonth() - 1);
      }

      const initial_cycle: BillingCycle = {
        id: generate_id(),
        subscription_id: sub_id,
        period_start: format(period_start_d, "yyyy-MM-dd"),
        period_end: next_date,
        scheduled_payment_date: next_date,
        status: "pending",
        amount_charged: amount,
        is_trial: false,
        is_final_after_cancel: false,
      };
      cycles.push(initial_cycle);
    }

    const new_sub: Subscription = {
      name:           data.name,
      category:       data.category,
      color:          data.color,
      description:    data.description,
      logo_url:       data.logo_url,
      amount,
      payment_cycle,
      id:             sub_id,
      is_active:      true,
      billing_cycles: cycles,
      created_at:     new Date().toISOString(),
      // Legacy – przechowujemy dla ewentualnej kompatybilności
      next_payment_date: next_date,
    };

    const next = [...get().subscriptions, new_sub];
    set({ subscriptions: next });
    save_subscriptions(next);
  },

  update_subscription: (id, data) => {
    const next = get().subscriptions.map((sub) =>
      sub.id === id ? { ...sub, ...data } : sub
    );
    set({ subscriptions: next });
    save_subscriptions(next);
  },

  delete_subscription: (id) => {
    const next = get().subscriptions.filter((sub) => sub.id !== id);
    set({ subscriptions: next });
    save_subscriptions(next);
  },

  mark_as_paid: (id) => {
    const sub = get().subscriptions.find((s) => s.id === id);
    if (!sub) return;

    // Szukamy najwcześniejszego oczekującego cyklu
    const pending_cycle = get_next_billing_cycle(sub);
    if (!pending_cycle) return;

    const now = new Date().toISOString();

    // Oznaczamy cykl jako opłacony
    const paid_cycle: BillingCycle = {
      ...pending_cycle,
      status: "paid",
      paid_at: now,
    };

    // Tworzymy nowy cykl rozliczeniowy (chyba że był to cykl z flagą is_final_after_cancel)
    const new_period_start_d = parseISO(pending_cycle.period_end);
    const new_period_end_d   = add_billing_period(new_period_start_d, sub.payment_cycle);
    const new_period_start   = format(new_period_start_d, "yyyy-MM-dd");
    const new_period_end     = format(new_period_end_d,   "yyyy-MM-dd");

    const next_cycle: BillingCycle = {
      id: generate_id(),
      subscription_id: sub.id,
      period_start: new_period_start,
      period_end: new_period_end,
      scheduled_payment_date: new_period_start,
      status: "pending",
      amount_charged: sub.amount,
      is_trial: false,
      is_final_after_cancel: false,
    };

    const updated_cycles = sub.billing_cycles.map((c) =>
      c.id === pending_cycle.id ? paid_cycle : c
    );
    updated_cycles.push(next_cycle);

    const updated_sub: Subscription = {
      ...sub,
      billing_cycles: updated_cycles,
      next_payment_date: new_period_start,
    };

    const next_subs = get().subscriptions.map((s) =>
      s.id === id ? updated_sub : s
    );

    // Wpis historii płatności
    const history_entry: PaymentHistoryEntry = {
      id: generate_id(),
      subscription_id: sub.id,
      subscription_name: sub.name,
      amount: pending_cycle.amount_charged,
      payment_cycle: sub.payment_cycle,
      paid_at: now,
    };
    const next_history = [...get().payment_history, history_entry];

    set({ subscriptions: next_subs, payment_history: next_history });
    save_subscriptions(next_subs);
    save_history(next_history);
  },

  cancel_subscription: (id) => {
    const sub = get().subscriptions.find((s) => s.id === id);
    if (!sub) return;

    const pending = get_next_billing_cycle(sub);

    const updated_cycles = sub.billing_cycles.map((c) => {
      if (pending && c.id === pending.id) {
        return { ...c, is_final_after_cancel: true };
      }
      return c;
    });

    const updated_sub: Subscription = {
      ...sub,
      billing_cycles: updated_cycles,
      is_active: false,
    };

    const next = get().subscriptions.map((s) =>
      s.id === id ? updated_sub : s
    );
    set({ subscriptions: next });
    save_subscriptions(next);
  },

  toggle_active: (id) => {
    const next = get().subscriptions.map((sub) =>
      sub.id === id ? { ...sub, is_active: !sub.is_active } : sub
    );
    set({ subscriptions: next });
    save_subscriptions(next);
  },

  add_next_cycle_manually: (id) => {
    const sub = get().subscriptions.find((s) => s.id === id);
    if (!sub) return;

    // Znajdź ostatni cykl (najpóźniejszy period_end)
    const sorted = [...sub.billing_cycles].sort((a, b) =>
      b.period_end.localeCompare(a.period_end)
    );
    const last = sorted[0];
    if (!last) return;

    const new_start_d = parseISO(last.period_end);
    const new_end_d   = add_billing_period(new_start_d, sub.payment_cycle);

    const new_cycle: BillingCycle = {
      id: generate_id(),
      subscription_id: sub.id,
      period_start: format(new_start_d, "yyyy-MM-dd"),
      period_end: format(new_end_d, "yyyy-MM-dd"),
      scheduled_payment_date: format(new_start_d, "yyyy-MM-dd"),
      status: "pending",
      amount_charged: sub.amount,
      is_trial: false,
      is_final_after_cancel: false,
    };

    const updated_sub: Subscription = {
      ...sub,
      billing_cycles: [...sub.billing_cycles, new_cycle],
      is_active: true,
      next_payment_date: new_cycle.scheduled_payment_date,
    };

    const next = get().subscriptions.map((s) =>
      s.id === id ? updated_sub : s
    );
    set({ subscriptions: next });
    save_subscriptions(next);
  },

  mark_cycle_failed: (subscription_id, cycle_id) => {
    const next = get().subscriptions.map((sub) => {
      if (sub.id !== subscription_id) return sub;
      return {
        ...sub,
        billing_cycles: sub.billing_cycles.map((c) =>
          c.id === cycle_id ? { ...c, status: "failed" as const } : c
        ),
      };
    });
    set({ subscriptions: next });
    save_subscriptions(next);
  },

  get_subscription_by_id: (id) => {
    return get().subscriptions.find((sub) => sub.id === id);
  },

  get_history_for: (subscription_id) => {
    const sub = get().subscriptions.find((s) => s.id === subscription_id);
    if (!sub) return [];

    // Generujemy PaymentHistoryEntry z opłaconych cykli
    return sub.billing_cycles
      .filter((c) => c.status === "paid" && c.paid_at)
      .sort((a, b) => (b.paid_at ?? "").localeCompare(a.paid_at ?? ""))
      .map((c) => ({
        id: c.id,
        subscription_id: sub.id,
        subscription_name: sub.name,
        amount: c.amount_charged,
        payment_cycle: sub.payment_cycle,
        paid_at: c.paid_at!,
      }));
  },

  set_budget: (amount) => {
    set({ monthly_budget: amount });
    save_budget(amount);
  },
}));

