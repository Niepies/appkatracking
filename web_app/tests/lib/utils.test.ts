/**
 * Testy jednostkowe lib/utils.ts
 *
 * Testujemy wszystkie pure-funkcje pomocnicze:
 * - format_currency, format_date
 * - days_until_payment, is_payment_upcoming/soon/overdue
 * - add_billing_period, calculate_next_payment_date
 * - to_monthly_amount, to_yearly_amount
 * - calculate_total_monthly, calculate_total_yearly
 * - get_initials, get_payment_urgency_label
 * - get_next_billing_cycle, get_next_payment_date
 * - sort_subscriptions_by_date
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { format } from "date-fns";
import {
  format_currency,
  format_date,
  days_until_payment,
  is_payment_upcoming,
  is_payment_soon,
  is_payment_overdue,
  add_billing_period,
  calculate_next_payment_date,
  to_monthly_amount,
  to_yearly_amount,
  calculate_total_monthly,
  calculate_total_yearly,
  get_initials,
  get_payment_urgency_label,
  get_next_billing_cycle,
  get_next_payment_date,
  sort_subscriptions_by_date,
  generate_id,
  normalize_service_key,
} from "@/lib/utils";
import type { Subscription, BillingCycle } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function make_date(offset_days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset_days);
  return format(d, "yyyy-MM-dd");
}

function make_cycle(overrides: Partial<BillingCycle> = {}): BillingCycle {
  return {
    id: "c1",
    subscription_id: "s1",
    period_start: make_date(-30),
    period_end: make_date(0),
    scheduled_payment_date: make_date(5),
    status: "pending",
    amount_charged: 50,
    is_trial: false,
    is_final_after_cancel: false,
    ...overrides,
  };
}

function make_sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "s1",
    name: "Netflix",
    amount: 49,
    payment_cycle: "monthly",
    category: "entertainment",
    is_active: true,
    billing_cycles: [make_cycle()],
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ─── format_currency ──────────────────────────────────────────────────────────

describe("format_currency", () => {
  it("formatuje kwotę z symbolem PLN", () => {
    const result = format_currency(49.99);
    expect(result).toContain("49");
    expect(result).toContain("zł");
  });

  it("formatuje zero", () => {
    const result = format_currency(0);
    expect(result).toContain("0");
  });

  it("formatuje duże kwoty", () => {
    const result = format_currency(1200.0);
    expect(result).toContain("1");
    expect(result).toContain("200");
  });
});

// ─── format_date ──────────────────────────────────────────────────────────────

describe("format_date", () => {
  it("formatuje datę ISO na czytelny format", () => {
    const result = format_date("2026-01-15");
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2026/);
  });

  it("zwraca oryginał przy błędnej dacie", () => {
    expect(format_date("not-a-date")).toBe("not-a-date");
  });
});

// ─── days_until_payment ───────────────────────────────────────────────────────

describe("days_until_payment", () => {
  it("zwraca 0 dla dzisiejszej daty", () => {
    expect(days_until_payment(make_date(0))).toBe(0);
  });

  it("zwraca dodatnią wartość dla przyszłej daty", () => {
    expect(days_until_payment(make_date(7))).toBe(7);
  });

  it("zwraca ujemną wartość dla poprzedniej daty", () => {
    expect(days_until_payment(make_date(-3))).toBe(-3);
  });

  it("zwraca 999 dla nieprawidłowej daty", () => {
    expect(days_until_payment("invalid")).toBe(999);
  });
});

// ─── is_payment_upcoming / soon / overdue ─────────────────────────────────────

describe("is_payment_upcoming", () => {
  it("true jeśli za 7 dni", () => expect(is_payment_upcoming(make_date(7))).toBe(true));
  it("true jeśli za 0 dni (dzisiaj)", () => expect(is_payment_upcoming(make_date(0))).toBe(true));
  it("false jeśli za 8 dni", () => expect(is_payment_upcoming(make_date(8))).toBe(false));
  it("false jeśli po terminie", () => expect(is_payment_upcoming(make_date(-1))).toBe(false));
});

describe("is_payment_soon", () => {
  it("true jeśli za 3 dni", () => expect(is_payment_soon(make_date(3))).toBe(true));
  it("false jeśli za 4 dni", () => expect(is_payment_soon(make_date(4))).toBe(false));
});

describe("is_payment_overdue", () => {
  it("true jeśli -1 dzień", () => expect(is_payment_overdue(make_date(-1))).toBe(true));
  it("false jeśli 0 dni (dzisiaj)", () => expect(is_payment_overdue(make_date(0))).toBe(false));
});

// ─── add_billing_period ───────────────────────────────────────────────────────

describe("add_billing_period", () => {
  it("dodaje miesiąc", () => {
    const base = new Date("2026-01-15");
    const result = add_billing_period(base, "monthly");
    expect(format(result, "yyyy-MM-dd")).toBe("2026-02-15");
  });

  it("dodaje rok", () => {
    const base = new Date("2026-01-15");
    const result = add_billing_period(base, "yearly");
    expect(format(result, "yyyy-MM-dd")).toBe("2027-01-15");
  });

  it("obsługuje overflow miesięcy (31 sty → koniec lutego)", () => {
    const base = new Date("2026-01-31");
    const result = add_billing_period(base, "monthly");
    // Luty 2026 ma 28 dni – wynik powinien być 28 lut lub na koniec miesiąca
    expect(result.getMonth()).toBe(1); // Luty = 1
    expect(result.getFullYear()).toBe(2026);
  });
});

// ─── calculate_next_payment_date ─────────────────────────────────────────────

describe("calculate_next_payment_date", () => {
  it("oblicza następny miesiąc", () => {
    expect(calculate_next_payment_date("2026-03-01", "monthly")).toBe("2026-04-01");
  });

  it("oblicza następny rok", () => {
    expect(calculate_next_payment_date("2026-03-01", "yearly")).toBe("2027-03-01");
  });

  it("zwraca oryginał dla nieprawidłowej daty", () => {
    expect(calculate_next_payment_date("not-a-date", "monthly")).toBe("not-a-date");
  });
});

// ─── to_monthly_amount / to_yearly_amount ─────────────────────────────────────

describe("to_monthly_amount", () => {
  it("miesięczna zwraca tę samą kwotę", () => {
    expect(to_monthly_amount(100, "monthly")).toBe(100);
  });
  it("roczna dzieli przez 12", () => {
    expect(to_monthly_amount(120, "yearly")).toBeCloseTo(10);
  });
});

describe("to_yearly_amount", () => {
  it("roczna zwraca tę samą kwotę", () => {
    expect(to_yearly_amount(1200, "yearly")).toBe(1200);
  });
  it("miesięczna mnoży przez 12", () => {
    expect(to_yearly_amount(100, "monthly")).toBe(1200);
  });
});

// ─── calculate_total_monthly / yearly ─────────────────────────────────────────

describe("calculate_total_monthly", () => {
  it("sumuje aktywne subskrypcje", () => {
    const subs = [
      make_sub({ id: "s1", amount: 50, payment_cycle: "monthly", is_active: true }),
      make_sub({ id: "s2", amount: 120, payment_cycle: "yearly", is_active: true }),
      make_sub({ id: "s3", amount: 30, payment_cycle: "monthly", is_active: false }),
    ];
    // 50 + 120/12 = 50 + 10 = 60
    expect(calculate_total_monthly(subs)).toBeCloseTo(60);
  });

  it("zwraca 0 dla pustej listy", () => {
    expect(calculate_total_monthly([])).toBe(0);
  });

  it("ignoruje nieaktywne", () => {
    const subs = [make_sub({ amount: 100, is_active: false })];
    expect(calculate_total_monthly(subs)).toBe(0);
  });
});

describe("calculate_total_yearly", () => {
  it("sumuje roczne koszty", () => {
    const subs = [
      make_sub({ id: "s1", amount: 50, payment_cycle: "monthly", is_active: true }),
      make_sub({ id: "s2", amount: 120, payment_cycle: "yearly", is_active: true }),
    ];
    // 50*12 + 120 = 720
    expect(calculate_total_yearly(subs)).toBeCloseTo(720);
  });
});

// ─── get_initials ─────────────────────────────────────────────────────────────

describe("get_initials", () => {
  it("zwraca 1 literę dla jednego słowa", () => {
    expect(get_initials("Netflix")).toBe("N");
  });
  it("zwraca 2 litery dla dwóch słów", () => {
    expect(get_initials("Amazon Prime")).toBe("AP");
  });
  it("zwraca max 2 litery dla wielu słów", () => {
    expect(get_initials("YouTube Premium Plus")).toBe("YP");
  });
  it("wielkie litery", () => {
    expect(get_initials("spotify")).toBe("S");
  });
});

// ─── get_payment_urgency_label ────────────────────────────────────────────────

describe("get_payment_urgency_label", () => {
  it("po terminie – czerwony", () => {
    const { label, color } = get_payment_urgency_label(make_date(-2));
    expect(label).toContain("Po terminie");
    expect(color).toContain("red");
  });
  it("dziś – czerwony", () => {
    const { label, color } = get_payment_urgency_label(make_date(0));
    expect(label).toMatch(/Dziś/);
    expect(color).toContain("red");
  });
  it("jutro – pomarańczowy", () => {
    const { label, color } = get_payment_urgency_label(make_date(1));
    expect(label).toMatch(/Jutro/);
    expect(color).toContain("orange");
  });
  it("za 7 dni – żółty", () => {
    const { color } = get_payment_urgency_label(make_date(7));
    expect(color).toContain("yellow");
  });
  it("za 30 dni – szary", () => {
    const { color } = get_payment_urgency_label(make_date(30));
    expect(color).toContain("gray");
  });
});

// ─── get_next_billing_cycle ───────────────────────────────────────────────────

describe("get_next_billing_cycle", () => {
  it("zwraca pending cykl", () => {
    const sub = make_sub();
    const cycle = get_next_billing_cycle(sub);
    expect(cycle).not.toBeNull();
    expect(cycle?.status).toBe("pending");
  });

  it("ignoruje is_final_after_cancel", () => {
    const sub = make_sub({
      billing_cycles: [make_cycle({ is_final_after_cancel: true })],
    });
    expect(get_next_billing_cycle(sub)).toBeNull();
  });

  it("ignoruje paid cykl", () => {
    const sub = make_sub({
      billing_cycles: [make_cycle({ status: "paid" })],
    });
    expect(get_next_billing_cycle(sub)).toBeNull();
  });

  it("zwraca najwcześniejszy z wielu cykli", () => {
    const sub = make_sub({
      billing_cycles: [
        make_cycle({ id: "c2", scheduled_payment_date: make_date(10) }),
        make_cycle({ id: "c1", scheduled_payment_date: make_date(5) }),
      ],
    });
    const cycle = get_next_billing_cycle(sub);
    expect(cycle?.id).toBe("c1");
  });
});

// ─── get_next_payment_date ────────────────────────────────────────────────────

describe("get_next_payment_date", () => {
  it("zwraca datę z cyklu pending", () => {
    const date = make_date(5);
    const sub = make_sub({
      billing_cycles: [make_cycle({ scheduled_payment_date: date })],
    });
    expect(get_next_payment_date(sub)).toBe(date);
  });

  it("fallback do legacy next_payment_date", () => {
    const sub = make_sub({
      billing_cycles: [],
      next_payment_date: "2026-12-01",
    });
    expect(get_next_payment_date(sub)).toBe("2026-12-01");
  });

  it("zwraca null jeśli brak cykli i brak legacy pola", () => {
    const sub = make_sub({ billing_cycles: [] });
    expect(get_next_payment_date(sub)).toBeNull();
  });
});

// ─── sort_subscriptions_by_date ───────────────────────────────────────────────

describe("sort_subscriptions_by_date", () => {
  it("sortuje rosnąco po dacie płatności", () => {
    const subs = [
      make_sub({
        id: "late",
        billing_cycles: [make_cycle({ scheduled_payment_date: make_date(20) })],
      }),
      make_sub({
        id: "early",
        billing_cycles: [make_cycle({ scheduled_payment_date: make_date(2) })],
      }),
    ];
    const sorted = sort_subscriptions_by_date(subs);
    expect(sorted[0].id).toBe("early");
    expect(sorted[1].id).toBe("late");
  });

  it("nie mutuje oryginału", () => {
    const subs = [make_sub({ id: "a" }), make_sub({ id: "b" })];
    const original_ids = subs.map((s) => s.id);
    sort_subscriptions_by_date(subs);
    expect(subs.map((s) => s.id)).toEqual(original_ids);
  });
});

// ─── generate_id ──────────────────────────────────────────────────────────────

describe("generate_id", () => {
  it("zwraca niepusty string", () => {
    const id = generate_id();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("każde wywołanie zwraca unikalny ID", () => {
    const ids = Array.from({ length: 50 }, () => generate_id());
    const unique = new Set(ids);
    expect(unique.size).toBe(50);
  });
});

describe("normalize_service_key", () => {
  it("rozpoznaje znane serwisy bez zmian", () => {
    expect(normalize_service_key("netflix")).toBe("netflix");
    expect(normalize_service_key("spotify")).toBe("spotify");
    expect(normalize_service_key("disney+")).toBe("disney+");
  });

  it("jest case-insensitive i trim-uje białe znaki", () => {
    expect(normalize_service_key("Netflix")).toBe("netflix");
    expect(normalize_service_key("  Spotify  ")).toBe("spotify");
    expect(normalize_service_key("DISNEY+")).toBe("disney+");
  });

  it("obsługuje aliasy serwisów", () => {
    expect(normalize_service_key("disneyplus")).toBe("disney+");
    expect(normalize_service_key("disney plus")).toBe("disney+");
    expect(normalize_service_key("amazon prime")).toBe("amazon_prime");
    expect(normalize_service_key("prime video")).toBe("prime_video");
    expect(normalize_service_key("hbo max")).toBe("hbomax");
    expect(normalize_service_key("youtube premium")).toBe("youtube_premium");
    expect(normalize_service_key("apple tv+")).toBe("apple_tv_plus");
    expect(normalize_service_key("apple music")).toBe("apple_music");
    expect(normalize_service_key("microsoft 365")).toBe("microsoft365");
    expect(normalize_service_key("google one")).toBe("google_one");
  });

  it("dla nieznanych serwisów generuje klucz z liter i cyfr", () => {
    expect(normalize_service_key("My Custom Service")).toBe("my_custom_service");
    expect(normalize_service_key("Service 2.0")).toBe("service_2_0");
  });

  it("usuwa podkreślenia na początku i końcu", () => {
    expect(normalize_service_key("  _test_ ")).toBe("test");
  });
});
