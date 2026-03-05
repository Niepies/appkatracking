"use client";

/**
 * Modal szczegółów subskrypcji – wyświetla pełne informacje
 * Umożliwia edycję, usunięcie i oznaczenie jako opłaconą
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SubscriptionForm } from "./subscription-form";
import { use_subscription_store } from "@/store/subscription-store";
import {
  CATEGORY_LABELS,
  CYCLE_LABELS,
  type Subscription,
  type BillingCycle,
} from "@/types";
import {
  format_currency,
  format_date,
  days_until_payment,
  is_payment_upcoming,
  is_payment_overdue,
  to_monthly_amount,
  to_yearly_amount,
  get_initials,
  get_next_payment_date,
  get_next_billing_cycle,
  cn,
} from "@/lib/utils";
import {
  CheckCircle2,
  Edit3,
  Trash2,
  Power,
  Calendar,
  Tag,
  FileText,
  AlertTriangle,
  History,
  ExternalLink,
  Globe,
  XCircle,
  X,
  Clock,
  Plus,
  LogIn,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { get_service_urls } from "@/lib/service-urls";
import { AutomationButton } from "@/components/automation/automation-button";
import { use_credential_check } from "@/hooks/use-credential-check";
import { normalize_service_key } from "@/lib/utils";
import type { CheckPaymentResult } from "@/types/automation";

interface SubscriptionDetailModalProps {
  subscription: Subscription | null;
  is_open: boolean;
  on_close: () => void;
}

export function SubscriptionDetailModal({
  subscription,
  is_open,
  on_close,
}: SubscriptionDetailModalProps) {
  const { mark_as_paid, delete_subscription, toggle_active, cancel_subscription, add_next_cycle_manually, get_history_for } = use_subscription_store.getState();
  const [is_editing, set_is_editing] = useState(false);
  const [confirm_delete, set_confirm_delete] = useState(false);
  const [confirm_cancel, set_confirm_cancel] = useState(false);
  const [is_paying, set_is_paying] = useState(false);
  const [show_history, set_show_history] = useState(false);

  const { has_credentials } = use_credential_check(subscription?.name ?? "");

  if (!subscription) return null;

  const payment_history = get_history_for ? get_history_for(subscription.id) : [];
  const service_urls    = get_service_urls(subscription.name);
  const next_payment    = get_next_payment_date(subscription) ?? "";
  const next_cycle      = get_next_billing_cycle(subscription);
  const is_trial_active = next_cycle?.is_trial ?? false;
  const is_cancelled    = !subscription.is_active && (subscription.billing_cycles ?? []).some((c) => c.is_final_after_cancel);

  const is_overdue  = !is_trial_active && is_payment_overdue(next_payment);
  const is_upcoming = !is_trial_active && is_payment_upcoming(next_payment);
  const days        = days_until_payment(next_payment);
  const accent_color = subscription.color || "#3b82f6";

  const handle_pay = async () => {
    // Brak danych logowania → przekieruj na login serwisu
    if (has_credentials === false) {
      window.open(service_urls.manage_url, "_blank", "noopener,noreferrer");
      toast.warning(
        `Zaloguj się do ${service_urls.display}, aby sprawdzić płatność automatycznie.`,
        {
          description: "Zapisz dane logowania, aby przyciski działały automatycznie.",
          duration: 5000,
          icon: <LogIn className="h-4 w-4" />,
        }
      );
      return;
    }

    set_is_paying(true);

    // Mamy dane logowania → weryfikuj przez Selenium
    if (has_credentials === true) {
      try {
        const service_key = normalize_service_key(subscription.name);
        const res = await fetch("/api/automation/check-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription_id: subscription.id,
            service_key,
            expected_amount: subscription.amount,
            expected_date: next_payment,
          }),
          signal: AbortSignal.timeout(90_000),
        });
        if (res.ok) {
          const result: CheckPaymentResult = await res.json();
          if (result.payment_found) {
            mark_as_paid(subscription.id);
            toast.success("Subskrypcja oznaczona jako opłacona! ✓", { description: result.message });
            on_close();
          } else {
            toast.warning(`Nie wykryto płatności`, {
              description: result.message,
              action: {
                label: "Oznacz ręcznie",
                onClick: () => { mark_as_paid(subscription.id); toast.success("Oznaczono ręcznie."); on_close(); },
              },
              duration: 8000,
            });
          }
        } else {
          throw new Error("Błąd API");
        }
      } catch {
        mark_as_paid(subscription.id);
        toast.success("Subskrypcja oznaczona jako opłacona (lokalnie).");
        on_close();
      } finally {
        set_is_paying(false);
      }
      return;
    }

    // API niedostępne → lokalny fallback
    setTimeout(() => {
      mark_as_paid(subscription.id);
      set_is_paying(false);
      toast.success("Subskrypcja oznaczona jako opłacona! ✓");
      on_close();
    }, 700);
  };

  const handle_delete = () => {
    if (!confirm_delete) {
      set_confirm_delete(true);
      // Auto-reset potwierdzenia po 3 sekundy
      setTimeout(() => set_confirm_delete(false), 3000);
      return;
    }
    delete_subscription(subscription.id);
    toast.success(`${subscription.name} usunięte.`);
    on_close();
  };

  const handle_cancel_sub = () => {
    if (!confirm_cancel) {
      set_confirm_cancel(true);
      setTimeout(() => set_confirm_cancel(false), 3000);
      return;
    }
    cancel_subscription(subscription.id);
    toast.success(`${subscription.name} anulowane. Dostęp trwa do końca opłaconego okresu.`);
    on_close();
  };

  const handle_add_cycle = () => {
    add_next_cycle_manually(subscription.id);
    toast.success("Dodano kolejny cykl rozliczeniowy.");
  };

  const handle_toggle = () => {
    // Brak danych logowania → przekieruj na login serwisu
    if (has_credentials === false) {
      window.open(service_urls.manage_url, "_blank", "noopener,noreferrer");
      toast.warning(
        `Zaloguj się do ${service_urls.display}, aby zarządzać subskrypcją automatycznie.`,
        {
          description: "Zapisz dane logowania w ustawieniach → przyciski zadziałają automatycznie.",
          duration: 5000,
          icon: <LogIn className="h-4 w-4" />,
        }
      );
      return;
    }
    toggle_active(subscription.id);
    toast.info(subscription.is_active ? "Subskrypcja wyłączona" : "Subskrypcja włączona");
    on_close();
  };

  const handle_close = () => {
    set_is_editing(false);
    set_confirm_delete(false);
    on_close();
  };

  return (
    <Dialog open={is_open} onOpenChange={(open) => !open && handle_close()}>
      <DialogContent className="max-w-md">
        {is_editing ? (
          <>
            <DialogHeader>
              <DialogTitle>Edytuj subskrypcję</DialogTitle>
            </DialogHeader>
            <SubscriptionForm
              subscription={subscription}
              on_success={() => {
                set_is_editing(false);
                toast.success("Subskrypcja zaktualizowana!");
                on_close();
              }}
              on_cancel={() => set_is_editing(false)}
            />
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div
                  className="h-14 w-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-sm flex-shrink-0"
                  style={{ backgroundColor: subscription.is_active ? accent_color : "#9ca3af" }}
                >
                  {get_initials(subscription.name)}
                </div>
                <div>
                  <DialogTitle className="text-xl">{subscription.name}</DialogTitle>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {CATEGORY_LABELS[subscription.category]}
                  </p>
                </div>
              </div>
            </DialogHeader>

            {/* Status alert */}
            {subscription.is_active && (is_overdue || is_upcoming) && (
              <div
                className={cn(
                  "rounded-xl p-3 flex items-start gap-2 text-sm",
                  is_overdue
                    ? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                    : "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                )}
              >
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  {is_overdue
                    ? `Płatność była ${Math.abs(days)} ${Math.abs(days) === 1 ? "dzień" : "dni"} temu!`
                    : days === 0
                    ? "Płatność jest dziś!"
                    : `Płatność za ${days} ${days === 1 ? "dzień" : "dni"}.`}
                </span>
              </div>
            )}

            {/* Tabs: Szczegóły / Historia */}
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <button
                onClick={() => set_show_history(false)}
                className={cn(
                  "flex-1 py-1.5 text-sm font-medium rounded-lg transition-all",
                  !show_history
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                )}
              >
                Szczegóły
              </button>
              <button
                onClick={() => set_show_history(true)}
                className={cn(
                  "flex-1 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5",
                  show_history
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                )}
              >
                <History className="h-3.5 w-3.5" />
                Historia
                {payment_history.length > 0 && (
                  <span className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-xs rounded-full px-1.5">
                    {payment_history.length}
                  </span>
                )}
              </button>
            </div>

            {!show_history ? (
            /* Dane */
            <div className="space-y-3 py-1">
              {/* Kwota */}
              <div className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700">
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">Kwota</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {format_currency(subscription.amount)}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{CYCLE_LABELS[subscription.payment_cycle]}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 dark:text-gray-500">Miesięcznie</p>
                  <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                    {format_currency(to_monthly_amount(subscription.amount, subscription.payment_cycle))}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Rocznie: {format_currency(to_yearly_amount(subscription.amount, subscription.payment_cycle))}
                  </p>
                </div>
              </div>

              {/* Data */}
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500 dark:text-gray-400">
                  {is_trial_active ? "Koniec trialu:" : "Następna płatność:"}
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {next_payment ? format_date(next_payment) : "—"}
                </span>
                {is_trial_active && (
                  <Badge variant="secondary" className="text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 text-xs">
                    Trial
                  </Badge>
                )}
              </div>

              {/* Kategoria */}
              <div className="flex items-center gap-2 text-sm">
                <Tag className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500 dark:text-gray-400">Kategoria:</span>
                <Badge variant="secondary">{CATEGORY_LABELS[subscription.category]}</Badge>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2 text-sm">
                <Power className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500 dark:text-gray-400">Status:</span>
                <Badge variant={subscription.is_active ? "success" : "secondary"}>
                  {subscription.is_active ? "Aktywna" : "Nieaktywna"}
                </Badge>
              </div>

              {/* Opis */}
              {subscription.description && (
                <div className="flex items-start gap-2 text-sm">
                  <FileText className="h-4 w-4 text-gray-400 mt-0.5" />
                  <p className="text-gray-600 dark:text-gray-400">{subscription.description}</p>
                </div>
              )}

              {/* Zarządzaj subskrypcją */}
              <div className={cn(
                "rounded-2xl p-4 space-y-3 border",
                service_urls.is_direct
                  ? "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800"
                  : "bg-gray-50 dark:bg-gray-800/60 border-gray-100 dark:border-gray-700"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className={cn(
                      "h-4 w-4",
                      service_urls.is_direct ? "text-blue-500" : "text-gray-400"
                    )} />
                    <span className={cn(
                      "text-sm font-semibold",
                      service_urls.is_direct
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-gray-700 dark:text-gray-300"
                    )}>
                      Zarządzaj w serwisie
                    </span>
                  </div>
                  <span className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    service_urls.is_direct
                      ? "bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-200"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                  )}>
                    {service_urls.is_direct ? "Bezpośredni link" : "Wyszukiwarka"}
                  </span>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {service_urls.is_direct
                    ? `Kliknij poniżej, aby przejść do panelu ${service_urls.display} i samodzielnie zarządzać lub anulować subskrypcję.`
                    : `Nie mamy bezpośredniego linku dla tego serwisu. Kliknij, aby wyszukać instrukcję w Google.`
                  }
                </p>

                <div className="flex gap-2">
                  <a
                    href={service_urls.manage_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-sm font-medium transition-all",
                      service_urls.is_direct
                        ? "bg-blue-500 hover:bg-blue-600 text-white shadow-sm"
                        : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
                    )}
                    onClick={() => toast.info(`Otwieram panel ${service_urls.display}…`, { duration: 2000 })}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Panel konta
                  </a>

                  {service_urls.is_direct && service_urls.cancel_url && service_urls.cancel_url !== service_urls.manage_url && (
                    <a
                      href={service_urls.cancel_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
                      onClick={() => toast.info("Otwieram stronę anulowania…", { duration: 2000 })}
                    >
                      <X className="h-3.5 w-3.5" />
                      Anuluj
                    </a>
                  )}
                </div>
              </div>
            </div>
            ) : (
            /* Historia / Cykle płatności */
            <div className="py-1">
              {subscription.billing_cycles.length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-400 dark:text-gray-500">Brak zapisanych cykli</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {[...subscription.billing_cycles]
                    .sort((a, b) => b.period_start.localeCompare(a.period_start))
                    .map((cycle: BillingCycle) => {
                      const status_icons: Record<string, React.ReactNode> = {
                        paid:      <CheckCircle2 className="h-4 w-4 text-green-500" />,
                        pending:   <Clock className="h-4 w-4 text-orange-400" />,
                        failed:    <XCircle className="h-4 w-4 text-red-500" />,
                        cancelled: <X className="h-4 w-4 text-gray-400" />,
                      };
                      const status_labels: Record<string, string> = {
                        paid:      "Opłacony",
                        pending:   cycle.is_trial ? "Trial (oczekuje)" : "Oczekuje",
                        failed:    "Błąd płatności",
                        cancelled: "Anulowany",
                      };
                      return (
                        <div
                          key={cycle.id}
                          className="flex items-start justify-between py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5">{status_icons[cycle.status]}</div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {format_date(cycle.period_start)} – {format_date(cycle.period_end)}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                Płatność: {format_date(cycle.scheduled_payment_date)}
                                {cycle.is_final_after_cancel && " · ostatni cykl"}
                              </p>
                              <p className="text-xs mt-0.5">
                                <span className={cn(
                                  "font-medium",
                                  cycle.status === "paid"      && "text-green-600 dark:text-green-400",
                                  cycle.status === "pending"   && "text-orange-500 dark:text-orange-400",
                                  cycle.status === "failed"    && "text-red-500",
                                  cycle.status === "cancelled" && "text-gray-400"
                                )}>
                                  {status_labels[cycle.status]}
                                </span>
                              </p>
                            </div>
                          </div>
                          <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm flex-shrink-0">
                            {cycle.is_trial ? "Trial" : format_currency(cycle.amount_charged)}
                          </span>
                        </div>
                      );
                    })
                  }
                </div>
              )}

              {/* Ręczne dodanie cyklu */}
              {subscription.is_active && (
                <button
                  onClick={handle_add_cycle}
                  className="mt-3 w-full flex items-center justify-center gap-2 h-9 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-xs text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Dodaj kolejny cykl ręcznie
                </button>
              )}
            </div>
            )}

            {/* Akcje */}
            <div className="space-y-2 pt-2">
              {/* Ostrzeżenie o braku danych logowania */}
              {has_credentials === false && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs">
                  <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    Brak zapisanych danych logowania – przyciski przekierują na stronę serwisu.
                  </span>
                </div>
              )}

              {/* Opłać */}
              {subscription.is_active && (
                <Button
                  className="w-full gap-2"
                  variant={is_overdue ? "destructive" : is_upcoming ? "warning" : "default"}
                  onClick={handle_pay}
                  disabled={is_paying}
                  size="lg"
                >
                  {is_paying ? (
                    <>
                      <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                      Oznaczam jako opłaconą...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      Opłać teraz
                    </>
                  )}
                </Button>
              )}

              <div className="grid grid-cols-3 gap-2">
                {/* Edytuj */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => set_is_editing(true)}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edytuj
                </Button>

                {/* Włącz/Wyłącz */}
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "gap-1.5",
                    !subscription.is_active && "text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300"
                  )}
                  onClick={handle_toggle}
                >
                  <Power className="h-3.5 w-3.5" />
                  {subscription.is_active ? "Wyłącz" : "Włącz"}
                </Button>

                {/* Usuń */}
                <Button
                  variant={confirm_delete ? "destructive" : "outline"}
                  size="sm"
                  className={cn(
                    "gap-1.5",
                    !confirm_delete && "text-red-500 border-red-200 hover:bg-red-50"
                  )}
                  onClick={handle_delete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {confirm_delete ? "Na pewno?" : "Usuń"}
                </Button>
              </div>

              {/* Anuluj subskrypcję */}
              {subscription.is_active && !is_cancelled && (
                <Button
                  variant={confirm_cancel ? "destructive" : "outline"}
                  size="sm"
                  className={cn(
                    "w-full gap-1.5 mt-1",
                    !confirm_cancel && "text-orange-600 border-orange-200 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:hover:bg-orange-900/30"
                  )}
                  onClick={handle_cancel_sub}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  {confirm_cancel
                    ? "Potwierdź anulowanie subskrypcji"
                    : "Anuluj subskrypcję (dostęp do końca okresu)"}
                </Button>
              )}

              {/* Automatyzacja – anulowanie */}
              {subscription.is_active && !is_cancelled && (
                <AutomationButton
                  subscription_id={subscription.id}
                  service_name={subscription.name}
                  action="cancel"
                  className="w-full justify-center"
                  size="sm"
                />
              )}

              {/* Automatyzacja – wznowienie */}
              {is_cancelled && (
                <AutomationButton
                  subscription_id={subscription.id}
                  service_name={subscription.name}
                  action="resume"
                  className="w-full justify-center"
                  size="sm"
                />
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
