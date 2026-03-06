// Funkcje pomocnicze dla SubsControl

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { differenceInDays, format, addMonths, addYears, parseISO } from "date-fns";
import { pl } from "date-fns/locale";
import type { PaymentCycle, Subscription, SubscriptionCategory, PaymentHistoryEntry, BillingCycle } from "@/types";
import { CATEGORY_LABELS } from "@/types";

/**
 * Łączy klasy Tailwind (clsx + twMerge), standard dla shadcn/ui
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalizuje nazwę usługi do klucza używanego przez mikroserwis automatyzacji.
 * Kluczem musi pasować do `service_key` w skryptach Python.
 */
const _SERVICE_KEY_MAP: Record<string, string> = {
  netflix:           "netflix",
  spotify:           "spotify",
  "disney+":         "disney+",
  disneyplus:        "disney+",
  "disney plus":     "disney+",
  amazonprime:       "amazon_prime",
  "amazon prime":    "amazon_prime",
  primevideo:        "prime_video",
  "prime video":     "prime_video",
  hbomax:            "hbomax",
  "hbo max":         "hbomax",
  max:               "max",
  youtubepremium:    "youtube_premium",
  "youtube premium": "youtube_premium",
  "appletv+":        "apple_tv_plus",
  "apple tv+":       "apple_tv_plus",
  applemusic:        "apple_music",
  "apple music":     "apple_music",
  chatgpt:           "chatgpt",
  "chatgpt plus":    "chatgpt_plus",
  githubcopilot:     "github_copilot",
  "github copilot":  "github_copilot",
  microsoft365:      "microsoft365",
  "microsoft 365":   "microsoft365",
  adobecc:           "adobe_cc",
  "adobe cc":        "adobe_cc",
  "adobe creative cloud": "adobe_cc",
  nordvpn:           "nordvpn",
  dropbox:           "dropbox",
  tidal:             "tidal",
  notion:            "notion",
  googleone:         "google_one",
  "google one":      "google_one",
};

export function normalize_service_key(name: string): string {
  const normalized = name.toLowerCase().trim();
  if (_SERVICE_KEY_MAP[normalized]) return _SERVICE_KEY_MAP[normalized];
  // Fallback: lowercase + podkreślniki
  return normalized.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/**
 * Formatuje kwotę w podanej walucie
 */
export function format_currency(amount: number, currency: string = "PLN"): string {
  const locale = currency === "PLN" ? "pl-PL" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Oblicza łączne wydatki miesięczne/roczne pogrupowane po walucie.
 * Zwraca obiekt { waluta: { monthly, yearly } } tylko dla aktywnych subskrypcji.
 */
export function calculate_totals_by_currency(
  subscriptions: Subscription[]
): Record<string, { monthly: number; yearly: number }> {
  const result: Record<string, { monthly: number; yearly: number }> = {};
  subscriptions
    .filter((s) => s.is_active)
    .forEach((s) => {
      const cur = s.currency ?? "PLN";
      if (!result[cur]) result[cur] = { monthly: 0, yearly: 0 };
      result[cur].monthly += to_monthly_amount(s.amount, s.payment_cycle);
      result[cur].yearly  += to_yearly_amount(s.amount, s.payment_cycle);
    });
  return result;
}

/**
 * Formatuje datę do czytelnego formatu polskiego
 */
export function format_date(date_string: string): string {
  try {
    return format(parseISO(date_string), "d MMMM yyyy", { locale: pl });
  } catch {
    return date_string;
  }
}

/**
 * Zwraca liczbę dni do następnej płatności
 * Wartość ujemna = po terminie
 */
export function days_until_payment(next_payment_date: string): number {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const payment_date = parseISO(next_payment_date);
    if (isNaN(payment_date.getTime())) return 999;
    return differenceInDays(payment_date, today);
  } catch {
    return 999;
  }
}

/**
 * Sprawdza, czy płatność zbliża się (za <= 7 dni) – żółte ostrzeżenie
 */
export function is_payment_upcoming(next_payment_date: string): boolean {
  const days = days_until_payment(next_payment_date);
  return days >= 0 && days <= 7;
}

/**
 * Sprawdza, czy płatność jest pilna (za <= 3 dni) – pomarańczowe ostrzeżenie
 */
export function is_payment_soon(next_payment_date: string): boolean {
  const days = days_until_payment(next_payment_date);
  return days >= 0 && days <= 3;
}

/**
 * Sprawdza, czy trial kończy się wkrótce (za <= 2 dni)
 */
export function is_trial_ending_soon(trial_end_date: string): boolean {
  const days = days_until_payment(trial_end_date);
  return days >= 0 && days <= 2;
}

/**
 * Zwraca subskrypcje nieaktywne od ≥30 dni (ostatnia płatność > 30 dni temu LUB brak historii).
 * Tylko dla aktywnych subskrypcji – sygnał, że może warto wyłączyć.
 */
export function get_inactive_subscriptions(
  subscriptions: Subscription[]
): Subscription[] {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 30);

  return subscriptions.filter((sub) => {
    if (!sub.is_active) return false;
    // Szukamy ostatniego zapłaconego cyklu
    const paid_cycles = sub.billing_cycles.filter((c) => c.status === "paid" && c.paid_at);
    if (paid_cycles.length === 0) {
      // Subskrypcja bez historii płatności i starsza niż 30 dni
      const created = new Date(sub.created_at);
      return created < cutoff;
    }
    const last_paid = paid_cycles
      .map((c) => new Date(c.paid_at!))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    return last_paid < cutoff;
  });
}

/**
 * Sprawdza, czy płatność jest po terminie
 */
export function is_payment_overdue(next_payment_date: string): boolean {
  return days_until_payment(next_payment_date) < 0;
}

/**
 * Dodaje jeden okres rozliczeniowy do daty z obsługą końca miesiąca.
 * np. 31 sty + 1 mies. = 28/29 lut (nie 3 marca)
 */
export function add_billing_period(date: Date, cycle: PaymentCycle): Date {
  if (cycle === "yearly") return addYears(date, 1);
  // addMonths from date-fns already clamps to the last day of the target month,
  // e.g. Jan 31 + 1 month = Feb 28/29 (not March 3)
  return addMonths(date, 1);
}

/**
 * Oblicza nową datę następnej płatności po opłaceniu (legacy helper).
 */
export function calculate_next_payment_date(
  current_date: string,
  cycle: PaymentCycle
): string {
  try {
    const next = add_billing_period(parseISO(current_date), cycle);
    return format(next, "yyyy-MM-dd");
  } catch {
    return current_date;
  }
}

/**
 * Zwraca następny oczekujący cykl rozliczeniowy dla subskrypcji.
 * Ignoruje cykle anulowane (is_final_after_cancel) jeśli szukamy przyszłego.
 */
export function get_next_billing_cycle(sub: Subscription): BillingCycle | null {
  const pending = sub.billing_cycles
    .filter((c) => c.status === "pending" && !c.is_final_after_cancel)
    .sort((a, b) => a.scheduled_payment_date.localeCompare(b.scheduled_payment_date));
  return pending[0] ?? null;
}

/**
 * Zwraca aktualnie trwający cykl (period_start <= dziś <= period_end).
 */
export function get_active_cycle(sub: Subscription): BillingCycle | null {
  const today = format(new Date(), "yyyy-MM-dd");
  return (
    sub.billing_cycles.find(
      (c) => c.period_start <= today && c.period_end >= today
    ) ?? null
  );
}

/**
 * Zwraca datę następnej płatności (ISO string) na podstawie cykli rozliczeniowych.
 * Fallback do legacy pola next_payment_date jeśli brak cykli.
 */
export function get_next_payment_date(sub: Subscription): string | null {
  const cycle = get_next_billing_cycle(sub);
  if (cycle) return cycle.scheduled_payment_date;
  // Fallback: legacy field
  return sub.next_payment_date ?? null;
}

/**
 * Przelicza kwotę na miesięczną (roczna / 12)
 */
export function to_monthly_amount(amount: number, cycle: PaymentCycle): number {
  if (cycle === "monthly") return amount;
  return amount / 12;
}

/**
 * Przelicza kwotę na roczną (miesięczna * 12)
 */
export function to_yearly_amount(amount: number, cycle: PaymentCycle): number {
  if (cycle === "yearly") return amount;
  return amount * 12;
}

/**
 * Oblicza łączne wydatki miesięczne ze wszystkich aktywnych subskrypcji
 */
export function calculate_total_monthly(subscriptions: Subscription[]): number {
  return subscriptions
    .filter((s) => s.is_active)
    .reduce((sum, s) => sum + to_monthly_amount(s.amount, s.payment_cycle), 0);
}

/**
 * Oblicza łączne wydatki roczne ze wszystkich aktywnych subskrypcji
 */
export function calculate_total_yearly(subscriptions: Subscription[]): number {
  return subscriptions
    .filter((s) => s.is_active)
    .reduce((sum, s) => sum + to_yearly_amount(s.amount, s.payment_cycle), 0);
}

/**
 * Generuje unikalny ID (UUID v4 uproszczony)
 */
export function generate_id(): string {
  return crypto.randomUUID();
}

/**
 * Sortuje subskrypcje według daty następnej płatności (najbliższe pierwsze).
 * Subskrypcje bez następnej płatności trafiają na koniec.
 */
export function sort_subscriptions_by_date(subscriptions: Subscription[]): Subscription[] {
  return [...subscriptions].sort((a, b) => {
    const date_a = get_next_payment_date(a) ?? "9999-12-31";
    const date_b = get_next_payment_date(b) ?? "9999-12-31";
    return date_a.localeCompare(date_b);
  });
}

/**
 * Zwraca czytelny opis zbliżającej się płatności
 */
export function get_payment_urgency_label(next_payment_date: string): {
  label: string;
  color: string;
} {
  const days = days_until_payment(next_payment_date);
  if (days < 0) return { label: "Po terminie!", color: "text-red-600" };
  if (days === 0) return { label: "Dziś!", color: "text-red-500" };
  if (days === 1) return { label: "Jutro!", color: "text-orange-500" };
  if (days <= 3) return { label: `Za ${days} dni`, color: "text-orange-400" };
  if (days <= 7) return { label: `Za ${days} dni`, color: "text-yellow-500" };
  return { label: `Za ${days} dni`, color: "text-gray-500" };
}

/**
 * Zwraca inicjały nazwy serwisu (do avatara gdy brak logo)
 */
export function get_initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/**
 * Eksportuje listę subskrypcji do pliku CSV i pobiera go.
 */
export function export_to_csv(subscriptions: import("@/types").Subscription[]): void {
  if (typeof window === "undefined") return;

  const headers = [
    "Nazwa",
    "Kwota (PLN)",
    "Cykl",
    "Następna płatność",
    "Kategoria",
    "Status",
    "Opis",
    "Data dodania",
  ];

  const rows = subscriptions.map((s) => [
    s.name,
    s.amount.toFixed(2),
    s.payment_cycle === "monthly" ? "Miesięczny" : "Roczny",
    get_next_payment_date(s) ?? "",
    s.category,
    s.is_active ? "Aktywna" : "Nieaktywna",
    s.description ?? "",
    s.created_at.split("T")[0],
  ]);

  const csv_content =
    "\uFEFF" + // BOM – poprawne kodowanie w Excelu
    [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(";")
      )
      .join("\r\n");

  const blob = new Blob([csv_content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `subscontrol-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Zwraca trend miesiecznych wydatkow z historii platnosci (ostatnie N miesiecy).
 * Kazdy wpis to { label, total } gdzie total = suma kwot w danym miesiacu.
 */
export function get_monthly_trend(
  history: PaymentHistoryEntry[],
  months: number = 6
): { label: string; total: number }[] {
  const result: { label: string; total: number }[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const label = format(d, "MMM yy", { locale: pl });

    const total = history
      .filter((e) => {
        const paid = new Date(e.paid_at);
        return paid.getFullYear() === year && paid.getMonth() === month;
      })
      .reduce((sum, e) => {
        const monthly = e.payment_cycle === "yearly" ? e.amount / 12 : e.amount;
        return sum + monthly;
      }, 0);

    result.push({ label, total: Math.round(total * 100) / 100 });
  }

  return result;
}

/** Kolory kategorii na wykresy */
export const CATEGORY_CHART_COLORS: Record<SubscriptionCategory, string> = {
  entertainment: "#3b82f6",
  utilities:     "#10b981",
  technology:    "#8b5cf6",
  health:        "#f59e0b",
  food:          "#ef4444",
  other:         "#6b7280",
};

/**
 * Zwraca zestawienie wydatkow miesięcznych wg kategorii (tylko aktywne subskrypcje).
 */
export function get_category_breakdown(
  subscriptions: Subscription[]
): { category: SubscriptionCategory; label: string; monthly: number; count: number; color: string }[] {
  const active = subscriptions.filter((s) => s.is_active);

  const groups: Record<SubscriptionCategory, { monthly: number; count: number }> = {
    entertainment: { monthly: 0, count: 0 },
    utilities:     { monthly: 0, count: 0 },
    technology:    { monthly: 0, count: 0 },
    health:        { monthly: 0, count: 0 },
    food:          { monthly: 0, count: 0 },
    other:         { monthly: 0, count: 0 },
  };

  for (const sub of active) {
    groups[sub.category].monthly += to_monthly_amount(sub.amount, sub.payment_cycle);
    groups[sub.category].count++;
  }

  return (Object.entries(groups) as [SubscriptionCategory, { monthly: number; count: number }][])
    .filter(([, { count }]) => count > 0)
    .map(([category, { monthly, count }]) => ({
      category,
      label: CATEGORY_LABELS[category],
      monthly: Math.round(monthly * 100) / 100,
      count,
      color: CATEGORY_CHART_COLORS[category],
    }))
    .sort((a, b) => b.monthly - a.monthly);
}
