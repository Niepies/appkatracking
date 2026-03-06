"use client";

/**
 * Karta pojedynczej subskrypcji – wyświetla dane, przyciski akcji
 * Przyjazna, czysta, minimalistyczna – zgodna z wytycznymi UI/UX
 */
import { useState } from "react";
import { type Subscription, CATEGORY_LABELS, CYCLE_LABELS } from "@/types";
import {
  format_currency,
  format_date,
  days_until_payment,
  is_payment_upcoming,
  is_payment_soon,
  is_payment_overdue,
  is_trial_ending_soon,
  get_payment_urgency_label,
  get_initials,
  to_monthly_amount,
  get_next_payment_date,
  get_next_billing_cycle,
  normalize_service_key,
  cn,
} from "@/lib/utils";
import { use_subscription_store } from "@/store/subscription-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronRight, Power, ExternalLink, LogIn, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { get_service_urls } from "@/lib/service-urls";

interface SubscriptionCardProps {
  subscription: Subscription;
  on_click?: () => void;
}

export function SubscriptionCard({ subscription, on_click }: SubscriptionCardProps) {
  const { mark_as_paid, toggle_active } = use_subscription_store.getState();
  const [is_paying, set_is_paying] = useState(false);
  const service_urls = get_service_urls(subscription.name);

  const handle_manage = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(service_urls.manage_url, "_blank", "noopener,noreferrer");
    toast.info(
      service_urls.is_direct
        ? `Otwieram panel ${service_urls.display}…`
        : `Szukam instrukcji dla ${subscription.name}…`,
      { duration: 2000 }
    );
  };

  const next_payment      = get_next_payment_date(subscription) ?? "";
  const next_cycle        = get_next_billing_cycle(subscription);
  const is_trial_pending  = next_cycle?.is_trial ?? false;
  const trial_ends_soon   = is_trial_pending && next_payment ? is_trial_ending_soon(next_payment) : false;

  const urgency     = get_payment_urgency_label(next_payment);
  const is_upcoming = is_payment_upcoming(next_payment);
  const is_soon     = is_payment_soon(next_payment);
  const is_overdue  = is_payment_overdue(next_payment);
  const days        = days_until_payment(next_payment);

  // Kolor akcentu z danych subskrypcji lub domyślny niebieski
  const accent_color = subscription.color || "#3b82f6";

  // Dane logowania: null = nieznany, true = ma, false = brak
  // Feature niezaimplementowany – domyślnie null (ukrywa badge/przyciski logowania)
  const has_credentials: boolean | null = null;

  const handle_pay = (e: React.MouseEvent) => {
    e.stopPropagation();
    set_is_paying(true);
    setTimeout(() => {
      mark_as_paid(subscription.id);
      set_is_paying(false);
      toast.success(`${subscription.name} oznaczone jako opłacone! ✓`, {
        description: "Następna płatność obliczona automatycznie.",
      });
    }, 400);
  };

  const handle_toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggle_active(subscription.id);
    toast.info(
      subscription.is_active
        ? `${subscription.name} wyłączone`
        : `${subscription.name} włączone`
    );
  };

  return (
    <div
      onClick={on_click}
      className={cn(
        "group relative bg-white dark:bg-gray-800 rounded-2xl shadow-sm border transition-all duration-200 cursor-pointer",
        "hover:shadow-md hover:-translate-y-0.5",
        subscription.is_active
          ? "border-gray-100 dark:border-gray-700"
          : "border-dashed border-gray-200 dark:border-gray-600 opacity-60",
        (is_upcoming || is_overdue) && subscription.is_active && !is_trial_pending && "border-orange-200 dark:border-orange-700",
        is_trial_pending && trial_ends_soon && "border-orange-200 dark:border-orange-700"
      )}
    >
      {/* Pasek kolorystyczny na górze karty */}
      <div
        className="h-1 rounded-t-2xl transition-all"
        style={{
          backgroundColor: subscription.is_active ? accent_color : "#e5e7eb",
          opacity: subscription.is_active ? 1 : 0.4,
        }}
      />

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar / inicjały */}
          <div
            className="flex-shrink-0 h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
            style={{ backgroundColor: subscription.is_active ? accent_color : "#9ca3af" }}
          >
            {get_initials(subscription.name)}
          </div>

          {/* Dane główne */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate text-base leading-tight">
                  {subscription.name}
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {CATEGORY_LABELS[subscription.category]} · {CYCLE_LABELS[subscription.payment_cycle]}
                </p>
              </div>
              {/* Kwota */}
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-gray-900 dark:text-gray-100 text-base">
                  {format_currency(subscription.amount, subscription.currency ?? "PLN")}
                </p>
                {subscription.payment_cycle === "yearly" && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {format_currency(to_monthly_amount(subscription.amount, "yearly"), subscription.currency ?? "PLN")}/mies.
                  </p>
                )}
              </div>
            </div>

            {/* Data następnej płatności */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {is_trial_pending ? (
                    <>
                      Trial do:{" "}
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        {next_payment ? format_date(next_payment) : "—"}
                      </span>
                    </>
                  ) : (
                    <>
                      Płatność:{" "}
                      <span className="font-medium">
                        {next_payment ? format_date(next_payment) : "—"}
                      </span>
                    </>
                  )}
                </span>
                {/* Etykieta „Wkrótce” lub „Po terminie” */}
                {subscription.is_active && !is_trial_pending && (is_upcoming || is_overdue) && (
                  <Badge variant={is_overdue ? "destructive" : is_soon ? "warning" : "secondary"}
                    className={!is_overdue && !is_soon ? "text-yellow-700 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200" : ""}>
                    {is_overdue ? "Po terminie!" : days === 0 ? "Dziś!" : `Za ${days} dni`}
                  </Badge>
                )}
                {subscription.is_active && is_trial_pending && (
                  <Badge variant="secondary" className={trial_ends_soon
                    ? "text-orange-700 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200"
                    : "text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200"}>
                    {trial_ends_soon ? `Trial kończy się za ${days_until_payment(next_payment)} dni!` : "Trial"}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Przycisk szybkiego zarządzania */}
          <button
            onClick={handle_manage}
            title={service_urls.is_direct ? `Zarządzaj ${service_urls.display}` : `Szukaj jak anulować ${subscription.name}`}
            className={cn(
              "flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100",
              service_urls.is_direct
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-400 dark:text-blue-400 hover:text-blue-600"
                : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600"
            )}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>

          {/* Strzałka nawigacji */}
          <ChevronRight className="flex-shrink-0 h-4 w-4 text-gray-300 group-hover:text-gray-400 mt-1 transition-colors" />
        </div>

        {/* Przyciski akcji */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50 dark:border-gray-700">
          {/* Badge: brak połączenia z serwisem */}
          {has_credentials === false && (
            <span
              title="Zapisz dane logowania, aby korzystać z automatyzacji"
              className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-full px-2 py-0.5 mr-auto"
            >
              <ShieldAlert className="h-3 w-3" />
              Niezalogowany
            </span>
          )}

          {/* Opłać */}
          {subscription.is_active && (
            <Button
              size="sm"
              variant={is_overdue ? "destructive" : is_upcoming ? "warning" : "outline"}
              className="flex-1 gap-1"
              onClick={handle_pay}
              disabled={is_paying}
              title={has_credentials === false ? `Zaloguj się do ${service_urls.display} aby sprawdzić płatność` : undefined}
            >
              {is_paying ? (
                <>
                  <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
                  Sprawdzam…
                </>
              ) : has_credentials === false ? (
                <>
                  <LogIn className="h-3.5 w-3.5" />
                  Zaloguj się
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Opłać
                </>
              )}
            </Button>
          )}

          {/* Włącz / Wyłącz */}
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "gap-1.5 px-3",
              subscription.is_active
                ? "text-gray-500 hover:text-gray-700"
                : "text-blue-500 hover:text-blue-700 font-medium"
            )}
            onClick={handle_toggle}
            title={has_credentials === false ? `Zaloguj się do ${service_urls.display} aby zarządzać subskrypcją` : undefined}
          >
            {has_credentials === false ? (
              <LogIn className="h-3.5 w-3.5" />
            ) : (
              <Power className="h-3.5 w-3.5" />
            )}
            {subscription.is_active ? "Wyłącz" : "Włącz"}
          </Button>
        </div>
      </div>
    </div>
  );
}
