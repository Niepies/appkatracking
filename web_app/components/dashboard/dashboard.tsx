"use client";

/**
 * Główny dashboard aplikacji SubsControl
 * Lista subskrypcji posortowana wg daty, z podsumowaniem i powiadomieniami
 */
import { useState, useMemo, useEffect } from "react";
import { use_subscription_store } from "@/store/subscription-store";
import { sort_subscriptions_by_date, cn, is_payment_upcoming, is_payment_overdue, export_to_csv, get_next_payment_date, get_next_billing_cycle } from "@/lib/utils";
import { SummarySection } from "@/components/dashboard/summary-section";
import { SubscriptionCard } from "@/components/subscription/subscription-card";
import { SubscriptionDetailModal } from "@/components/subscription/subscription-detail-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SubscriptionForm } from "@/components/subscription/subscription-form";
import { use_upcoming_notifications } from "@/hooks/use-upcoming-notifications";
import type { Subscription } from "@/types";
import { Plus, Search, Inbox, Download } from "lucide-react";
import { toast } from "sonner";

type SortOption = "date" | "amount" | "name";
type FilterOption = "all" | "active" | "inactive" | "upcoming";

export function Dashboard() {
  const [mounted, set_mounted] = useState(false);
  const [subscriptions, set_subscriptions] = useState<Subscription[]>(() =>
    use_subscription_store.getState().subscriptions
  );
  useEffect(() => {
    set_mounted(true);
    set_subscriptions(use_subscription_store.getState().subscriptions);
    const unsub = use_subscription_store.subscribe((s) => set_subscriptions(s.subscriptions));
    return unsub;
  }, []);

  use_upcoming_notifications(subscriptions);

  const [selected_subscription, set_selected_subscription] = useState<Subscription | null>(null);
  const [is_detail_open, set_is_detail_open] = useState(false);
  const [is_add_open, set_is_add_open] = useState(false);
  const [search_query, set_search_query] = useState("");
  const [sort_by, set_sort_by] = useState<SortOption>("date");
  const [filter, set_filter] = useState<FilterOption>("all");

  const handle_card_click = (sub: Subscription) => {
    set_selected_subscription(sub);
    set_is_detail_open(true);
  };

  const handle_export = () => {
    if (subscriptions.length === 0) {
      toast.error("Brak subskrypcji do eksportu.");
      return;
    }
    export_to_csv(subscriptions);
    toast.success(`Wyeksportowano ${subscriptions.length} subskrypcji do CSV.`);
  };

  const filtered_subscriptions = useMemo(() => {
    let result = [...subscriptions];
    if (search_query.trim()) {
      result = result.filter((s) =>
        s.name.toLowerCase().includes(search_query.toLowerCase())
      );
    }
    if (filter === "active") result = result.filter((s) => s.is_active);
    else if (filter === "inactive") result = result.filter((s) => !s.is_active);
    else if (filter === "upcoming") {
      result = result.filter((s) => {
        const next = get_next_payment_date(s) ?? "";
        const is_trial = get_next_billing_cycle(s)?.is_trial ?? false;
        return s.is_active && !is_trial && (is_payment_upcoming(next) || is_payment_overdue(next));
      });
    }
    if (sort_by === "date") return sort_subscriptions_by_date(result);
    if (sort_by === "amount") return result.sort((a, b) => b.amount - a.amount);
    if (sort_by === "name") return result.sort((a, b) => a.name.localeCompare(b.name, "pl"));
    return result;
  }, [subscriptions, search_query, sort_by, filter]);

  const filter_buttons: { key: FilterOption; label: string }[] = [
    { key: "all", label: "Wszystkie" },
    { key: "active", label: "Aktywne" },
    { key: "upcoming", label: "Wkrótce" },
    { key: "inactive", label: "Nieaktywne" },
  ];

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Dialog open={is_add_open} onOpenChange={set_is_add_open}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nowa subskrypcja</DialogTitle>
          </DialogHeader>
          <SubscriptionForm
            on_success={() => set_is_add_open(false)}
            on_cancel={() => set_is_add_open(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className={cn(
        "sticky top-0 z-20 border-b shadow-sm",
        "bg-white dark:bg-gray-900",
        "border-gray-100 dark:border-gray-800"
      )}>
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="5" y="2" width="14" height="20" rx="3" />
                <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
                <circle cx="12" cy="9" r="1.2" fill="currentColor" stroke="none" />
                <circle cx="15" cy="9" r="1.2" fill="currentColor" stroke="none" />
                <path d="M12 14v4M10 16h4" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">SubsControl</h1>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-none">Zarządzaj subskrypcjami</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Eksport CSV */}
            {subscriptions.length > 0 && (
              <button
                onClick={handle_export}
                title="Eksportuj do CSV"
                className={cn(
                  "h-9 w-9 rounded-xl flex items-center justify-center transition-all",
                  "bg-gray-100 hover:bg-gray-200 text-gray-600",
                  "dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300"
                )}
              >
                <Download className="h-4 w-4" />
              </button>
            )}
            {/* Dark mode toggle */}
            <ThemeToggle />
            {/* Dodaj subskrypcję */}
            <Button size="sm" className="gap-1.5" onClick={() => set_is_add_open(true)}>
              <Plus className="h-4 w-4" />
              Dodaj
            </Button>
          </div>
        </div>
      </header>

      {/* Główna zawartość */}
      <main className="max-w-md mx-auto px-4 py-5 space-y-5 pb-36">
        <SummarySection subscriptions={subscriptions} />

        {subscriptions.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search_query}
              onChange={(e) => set_search_query(e.target.value)}
              placeholder="Szukaj subskrypcji..."
              className={cn(
                "w-full h-10 pl-9 pr-4 rounded-xl border text-sm shadow-sm",
                "bg-white dark:bg-gray-800",
                "border-gray-200 dark:border-gray-700",
                "text-gray-900 dark:text-gray-100",
                "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              )}
            />
          </div>
        )}

        {subscriptions.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {filter_buttons.map((btn) => (
              <button
                key={btn.key}
                onClick={() => set_filter(btn.key)}
                className={cn(
                  "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  filter === btn.key
                    ? "bg-blue-500 text-white shadow-sm"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-blue-300"
                )}
              >
                {btn.label}
              </button>
            ))}
            <div className="ml-auto flex-shrink-0">
              <select
                value={sort_by}
                onChange={(e) => set_sort_by(e.target.value as SortOption)}
                className={cn(
                  "h-7 pl-2 pr-6 rounded-full text-xs border focus:outline-none focus:ring-1 focus:ring-blue-400 appearance-none cursor-pointer",
                  "bg-white dark:bg-gray-800",
                  "text-gray-600 dark:text-gray-400",
                  "border-gray-200 dark:border-gray-700"
                )}
              >
                <option value="date">Wg daty</option>
                <option value="amount">Wg kwoty</option>
                <option value="name">Wg nazwy</option>
              </select>
            </div>
          </div>
        )}

        {subscriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-4">
              <Inbox className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Brak subskrypcji</h3>
            <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs mb-6">
              Dodaj swoje pierwsze subskrypcje, aby śledzić wydatki i nigdy nie przeoczyć płatności.
            </p>
            <Button className="gap-2" size="lg" onClick={() => set_is_add_open(true)}>
              <Plus className="h-5 w-5" />
              Dodaj pierwszą subskrypcję
            </Button>
          </div>
        ) : filtered_subscriptions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-400 dark:text-gray-500">Brak wyników dla „{search_query}"</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered_subscriptions.map((sub) => (
              <SubscriptionCard
                key={sub.id}
                subscription={sub}
                on_click={() => handle_card_click(sub)}
              />
            ))}
          </div>
        )}
      </main>

      {/* FAB */}
      {subscriptions.length > 0 && (
        <div className="fixed bottom-20 right-4 z-20">
          <button
            onClick={() => set_is_add_open(true)}
            className="h-14 w-14 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-all"
          >
            <Plus className="h-7 w-7" />
          </button>
        </div>
      )}

      <SubscriptionDetailModal
        subscription={selected_subscription}
        is_open={is_detail_open}
        on_close={() => {
          set_is_detail_open(false);
          set_selected_subscription(null);
        }}
      />
    </div>
  );
}

