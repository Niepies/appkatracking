// Typy globalne dla aplikacji SubsControl

export type PaymentCycle = "monthly" | "yearly";

export type SubscriptionCategory =
  | "entertainment"
  | "utilities"
  | "technology"
  | "health"
  | "food"
  | "other";

/** Status pojedynczego cyklu rozliczeniowego */
export type BillingCycleStatus = "pending" | "paid" | "failed" | "cancelled";

/**
 * Pojedynczy cykl rozliczeniowy – reprezentuje jeden okres płatności.
 * Każda subskrypcja posiada listę takich cykli zamiast jednego pola next_payment_date.
 */
export interface BillingCycle {
  id: string;
  subscription_id: string;

  /** Dzień, od którego obowiązuje dostęp w tym cyklu */
  period_start: string;           // ISO date "YYYY-MM-DD"
  /** Dzień, do którego obowiązuje dostęp w tym cyklu */
  period_end: string;             // ISO date "YYYY-MM-DD"
  /** Zaplanowana data pobrania pieniędzy */
  scheduled_payment_date: string; // ISO date "YYYY-MM-DD"

  status: BillingCycleStatus;
  /** Data faktycznej płatności (wypełniana gdy status = 'paid') */
  paid_at?: string;               // ISO timestamp

  amount_charged: number;

  /** Czy to cykl próbny (trial) – użytkownik nie płaci, ale mamy info kiedy skończy się trial */
  is_trial: boolean;
  /** Czy to ostatni cykl po anulowaniu (dostęp trwa, ale nowy cykl nie powstanie) */
  is_final_after_cancel: boolean;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number; // kwota w PLN – bazowa cena cyklu
  payment_cycle: PaymentCycle;
  category: SubscriptionCategory;
  is_active: boolean;

  /** Historia i przyszłe cykle rozliczeniowe */
  billing_cycles: BillingCycle[];

  created_at: string; // ISO timestamp
  logo_url?: string;
  description?: string;
  color?: string;

  /**
   * @deprecated Zachowane dla kompatybilności wstecznej z localStorage.
   * Używaj get_next_payment_date(sub) z lib/utils zamiast tego pola.
   */
  next_payment_date?: string;
}

/** Pojedynczy wpis historii płatności (używany w statystykach) */
export interface PaymentHistoryEntry {
  id: string;
  subscription_id: string;
  subscription_name: string;
  amount: number;
  payment_cycle: PaymentCycle;
  paid_at: string; // ISO timestamp
}

export interface SubscriptionFormData {
  name: string;
  amount: string; // string bo input
  payment_cycle: PaymentCycle;
  next_payment_date: string;
  category: SubscriptionCategory;
  description?: string;
  has_trial?: boolean;
}

// Kategorie z etykietami po polsku
export const CATEGORY_LABELS: Record<SubscriptionCategory, string> = {
  entertainment: "Rozrywka",
  utilities: "Media / Dom",
  technology: "Technologia",
  health: "Zdrowie",
  food: "Jedzenie",
  other: "Inne",
};

// Cykl rozliczeniowy z etykietami po polsku
export const CYCLE_LABELS: Record<PaymentCycle, string> = {
  monthly: "Miesięczny",
  yearly: "Roczny",
};

// Popularne serwisy z predefiniowanymi kolorami
export const POPULAR_SERVICES: {
  name: string;
  color: string;
  category: SubscriptionCategory;
}[] = [
  { name: "Netflix", color: "#E50914", category: "entertainment" },
  { name: "Spotify", color: "#1DB954", category: "entertainment" },
  { name: "HBO Max", color: "#6900E8", category: "entertainment" },
  { name: "Disney+", color: "#113CCF", category: "entertainment" },
  { name: "Amazon Prime", color: "#00A8E1", category: "entertainment" },
  { name: "Apple TV+", color: "#555555", category: "entertainment" },
  { name: "YouTube Premium", color: "#FF0000", category: "entertainment" },
  { name: "Apple Music", color: "#FC3C44", category: "entertainment" },
  { name: "Tidal", color: "#000000", category: "entertainment" },
  { name: "Canal+", color: "#000000", category: "entertainment" },
  { name: "Play", color: "#E20074", category: "utilities" },
  { name: "T-Mobile", color: "#E20074", category: "utilities" },
  { name: "Orange", color: "#FF6600", category: "utilities" },
  { name: "Polsat Box", color: "#E30613", category: "entertainment" },
  { name: "ChatGPT Plus", color: "#10A37F", category: "technology" },
  { name: "GitHub Copilot", color: "#24292E", category: "technology" },
  { name: "Adobe CC", color: "#FF0000", category: "technology" },
  { name: "Microsoft 365", color: "#D83B01", category: "technology" },
  { name: "iCloud", color: "#3B82F6", category: "technology" },
  { name: "Google One", color: "#4285F4", category: "technology" },
  { name: "Prąd", color: "#FBBF24", category: "utilities" },
  { name: "Internet", color: "#6366F1", category: "utilities" },
  { name: "Gaz", color: "#F97316", category: "utilities" },
];
