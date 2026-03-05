"use client";

/**
 * Hook do powiadomień o zbliżających się płatnościach, trialach i braku aktywności.
 * Przyjmuje subskrypcje jako argument (nie wywołuje store wewnątrz),
 * dzięki czemu ma stałą liczbę hooków: dokładnie useRef + useEffect.
 *
 * Tiery powiadomień:
 *  – error   : płatność po terminie
 *  – warning : płatność za ≤3 dni | trial kończy się za ≤2 dni
 *  – info    : płatność za 4–7 dni | brak aktywności ≥30 dni | raport kwartalny
 */
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Subscription } from "@/types";
import {
  is_payment_upcoming,
  is_payment_soon,
  is_payment_overdue,
  is_trial_ending_soon,
  get_inactive_subscriptions,
  days_until_payment,
  format_currency,
  calculate_total_monthly,
  calculate_total_yearly,
  get_next_payment_date,
  get_next_billing_cycle,
} from "@/lib/utils";

/** Czy dziś jest pierwszy dzień kwartału (sty/kwi/lip/paź)? */
function is_first_day_of_quarter(): boolean {
  const d = new Date();
  const m = d.getMonth(); // 0-based
  const day = d.getDate();
  return day === 1 && (m === 0 || m === 3 || m === 6 || m === 9);
}

export function use_upcoming_notifications(subscriptions: Subscription[]) {
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current || subscriptions.length === 0) return;
    shown.current = true;

    const active = subscriptions.filter((s) => s.is_active);

    // ── 1. PŁATNOŚCI PO TERMINIE ─────────────────────────────────────────────
    const overdue = active.filter((s) => {
      const next = get_next_payment_date(s) ?? "";
      const is_trial = get_next_billing_cycle(s)?.is_trial ?? false;
      return !is_trial && is_payment_overdue(next);
    });
    if (overdue.length > 0) {
      toast.error(
        overdue.length === 1
          ? "1 subskrypcja po terminie!"
          : `${overdue.length} subskrypcje po terminie!`,
        {
          description: overdue
            .map((s) => `• ${s.name} (${format_currency(s.amount)})`)
            .join("\n"),
          duration: 8000,
        }
      );
    }

    // ── 2. PŁATNOŚCI PILNE ≤3 DNI ────────────────────────────────────────────
    const soon = active.filter((s) => {
      const next = get_next_payment_date(s) ?? "";
      const is_trial = get_next_billing_cycle(s)?.is_trial ?? false;
      return !is_trial && is_payment_soon(next) && !is_payment_overdue(next);
    });
    if (soon.length > 0) {
      toast.warning(
        soon.length === 1 ? "Płatność za mniej niż 3 dni 🔔" : `${soon.length} płatności w ciągu 3 dni 🔔`,
        {
          description: soon
            .map((s) => {
              const next = get_next_payment_date(s) ?? "";
              const d = days_until_payment(next);
              return `• ${s.name} – ${format_currency(s.amount)} (${d === 0 ? "dziś" : `za ${d} ${d === 1 ? "dzień" : "dni"}`})`;
            })
            .join("\n"),
          duration: 7000,
        }
      );
    }

    // ── 3. PŁATNOŚCI ZA 4–7 DNI ──────────────────────────────────────────────
    const upcoming_week = active.filter((s) => {
      const next = get_next_payment_date(s) ?? "";
      const is_trial = get_next_billing_cycle(s)?.is_trial ?? false;
      const d = days_until_payment(next);
      return !is_trial && is_payment_upcoming(next) && !is_payment_soon(next) && !is_payment_overdue(next) && d <= 7;
    });
    if (upcoming_week.length > 0) {
      toast.info(
        `Płatności w przyszłym tygodniu 📅`,
        {
          description: upcoming_week
            .map((s) => {
              const next = get_next_payment_date(s) ?? "";
              const d = days_until_payment(next);
              return `• ${s.name} – ${format_currency(s.amount)} (za ${d} dni)`;
            })
            .join("\n"),
          duration: 6000,
        }
      );
    }

    // ── 4. TRIAL KOŃCZY SIĘ ZA ≤2 DNI ───────────────────────────────────────
    const trials_ending = active.filter((s) => {
      const cycle = get_next_billing_cycle(s);
      if (!cycle?.is_trial) return false;
      const trial_end = cycle.scheduled_payment_date;
      return is_trial_ending_soon(trial_end);
    });
    if (trials_ending.length > 0) {
      toast.warning(
        trials_ending.length === 1
          ? "⚠️ Trial kończy się za 2 dni – sprawdź czy chcesz kontynuować!"
          : `⚠️ ${trials_ending.length} triale kończą się wkrótce!`,
        {
          description: trials_ending
            .map((s) => {
              const cycle = get_next_billing_cycle(s)!;
              const d = days_until_payment(cycle.scheduled_payment_date);
              return `• ${s.name} – po trialu ${format_currency(s.amount)}/${s.payment_cycle === "yearly" ? "rok" : "mies."} (za ${d === 0 ? "dzień" : `${d} dni`})`;
            })
            .join("\n"),
          duration: 10000,
        }
      );
    }

    // ── 5. BRAK AKTYWNOŚCI ≥30 DNI ───────────────────────────────────────────
    const inactive = get_inactive_subscriptions(subscriptions);
    if (inactive.length > 0) {
      toast.info(
        `Nie korzystasz z ${inactive.length === 1 ? `${inactive[0].name}` : `${inactive.length} subskrypcji`} od ponad miesiąca 💤`,
        {
          description:
            inactive.length === 1
              ? `Rozważ wyłączenie ${inactive[0].name} (${format_currency(inactive[0].amount)}/mies.) – zaoszczędzisz ${format_currency(inactive[0].payment_cycle === "yearly" ? inactive[0].amount / 12 : inactive[0].amount)} miesięcznie.`
              : inactive
                  .slice(0, 4)
                  .map((s) => `• ${s.name} (${format_currency(s.payment_cycle === "yearly" ? s.amount / 12 : s.amount)}/mies.)`)
                  .join("\n") + (inactive.length > 4 ? `\n…i ${inactive.length - 4} więcej` : ""),
          duration: 9000,
        }
      );
    }

    // ── 6. KWARTALNY RAPORT OSZCZĘDNOŚCI ────────────────────────────────────
    if (is_first_day_of_quarter() && subscriptions.length > 0) {
      const monthly  = calculate_total_monthly(subscriptions);
      const yearly   = calculate_total_yearly(subscriptions);
      const inactive_saving = inactive.reduce(
        (sum, s) => sum + (s.payment_cycle === "yearly" ? s.amount / 12 : s.amount),
        0
      );
      toast.info(
        "📊 Raport kwartalny SubsControl",
        {
          description:
            `Miesięczne wydatki: ${format_currency(monthly)} (${format_currency(yearly)}/rok)\n` +
            `Aktywne subskrypcje: ${subscriptions.filter((s) => s.is_active).length}\n` +
            (inactive_saving > 0
              ? `💡 Możesz zaoszczędzić ${format_currency(inactive_saving)}/mies. wyłączając nieużywane serwisy.`
              : "✅ Wszystkie subskrypcje są aktywnie używane – świetnie!"),
          duration: 12000,
        }
      );
    }
  }, [subscriptions]);
}
