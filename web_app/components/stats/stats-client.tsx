"use client";

/**
 * Strona statystyk – wykresy wydatków, budżet, kategorie, top subskrypcje
 * Używa biblioteki Recharts do wizualizacji danych
 */
import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { use_subscription_store } from "@/store/subscription-store";
import {
  calculate_totals_by_currency,
  calculate_total_monthly,
  format_currency,
  get_monthly_trend,
  get_category_breakdown,
  cn,
} from "@/lib/utils";
import type { Subscription, PaymentHistoryEntry } from "@/types";
import {
  TrendingUp,
  PieChart,
  Target,
  Pencil,
  CheckCircle2,
  BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function StatsClient() {
  const [mounted, set_mounted] = useState(false);
  const [subscriptions, set_subscriptions] = useState<Subscription[]>(() =>
    use_subscription_store.getState().subscriptions
  );
  const [payment_history, set_payment_history] = useState<PaymentHistoryEntry[]>(() =>
    use_subscription_store.getState().payment_history
  );
  const [monthly_budget, set_monthly_budget] = useState(() =>
    use_subscription_store.getState().monthly_budget
  );
  const [budget_input, set_budget_input] = useState("");
  const [editing_budget, set_editing_budget] = useState(false);

  useEffect(() => {
    set_mounted(true);
    const unsub = use_subscription_store.subscribe((s) => {
      set_subscriptions(s.subscriptions);
      set_payment_history(s.payment_history);
      set_monthly_budget(s.monthly_budget);
    });
    return unsub;
  }, []);

  if (!mounted) return null;

  const totals_by_currency = calculate_totals_by_currency(subscriptions);
  const currencies = Object.keys(totals_by_currency);
  // Budget is tracked in PLN only
  const monthly_total = totals_by_currency["PLN"]?.monthly ?? calculate_total_monthly(subscriptions);
  const active_count  = subscriptions.filter((s) => s.is_active).length;

  const trend_data    = get_monthly_trend(payment_history, 6);
  const category_data = get_category_breakdown(subscriptions);

  const budget_pct  = monthly_budget > 0 ? Math.min(100, (monthly_total / monthly_budget) * 100) : 0;
  const budget_over = monthly_budget > 0 && monthly_total > monthly_budget;

  const handle_save_budget = () => {
    const val = parseFloat(budget_input.replace(",", "."));
    if (isNaN(val) || val <= 0) {
      toast.error("Podaj prawidłową kwotę budżetu.");
      return;
    }
    use_subscription_store.getState().set_budget(val);
    set_editing_budget(false);
    set_budget_input("");
    toast.success(`Budżet miesięczny: ${format_currency(val, "PLN")}`);
  };

  const top_subs = [...subscriptions]
    .filter((s) => s.is_active)
    .sort((a, b) => {
      const ma = a.payment_cycle === "yearly" ? a.amount / 12 : a.amount;
      const mb = b.payment_cycle === "yearly" ? b.amount / 12 : b.amount;
      return mb - ma;
    })
    .slice(0, 5);

  const max_monthly_amount = top_subs.reduce((m, s) => {
    const mo = s.payment_cycle === "yearly" ? s.amount / 12 : s.amount;
    return Math.max(m, mo);
  }, 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className={cn(
        "sticky top-0 z-20 border-b shadow-sm",
        "bg-white dark:bg-gray-900",
        "border-gray-100 dark:border-gray-800"
      )}>
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-9 w-9 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
            <BarChart2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">Statystyki</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 leading-none">Analizy i wykresy</p>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-5 space-y-4 pb-36">

        {/* Kluczowe metryki */}
        <div className="grid grid-cols-3 gap-3">
          {/* Aktywne */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-3 text-center">
            <p className="font-bold text-gray-900 dark:text-gray-100 text-base leading-tight">{active_count}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Aktywne</p>
          </div>
          {/* Miesięcznie per waluta */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-3 text-center">
            {currencies.length === 0 ? (
              <p className="font-bold text-gray-900 dark:text-gray-100 text-base leading-tight">—</p>
            ) : (
              currencies.map((cur) => (
                <p key={cur} className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-tight">
                  {format_currency(totals_by_currency[cur].monthly, cur)}
                </p>
              ))
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Miesięcznie</p>
          </div>
          {/* Rocznie per waluta */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-3 text-center">
            {currencies.length === 0 ? (
              <p className="font-bold text-gray-900 dark:text-gray-100 text-base leading-tight">—</p>
            ) : (
              currencies.map((cur) => (
                <p key={cur} className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-tight">
                  {format_currency(totals_by_currency[cur].yearly, cur)}
                </p>
              ))
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Rocznie</p>
          </div>
        </div>

        {/* Budżet miesięczny */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-violet-500" />
              <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Budżet miesięczny</span>
            </div>
            <button
              onClick={() => {
                set_editing_budget(true);
                set_budget_input(monthly_budget > 0 ? String(monthly_budget) : "");
              }}
              className={cn(
                "h-7 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors",
                "text-violet-600 dark:text-violet-400",
                "bg-violet-50 dark:bg-violet-900/30",
                "hover:bg-violet-100 dark:hover:bg-violet-900/50"
              )}
            >
              <Pencil className="h-3 w-3" />
              {monthly_budget > 0 ? "Zmień" : "Ustaw"}
            </button>
          </div>

          {editing_budget && (
            <div className="flex gap-2 mb-3">
              <input
                type="number"
                value={budget_input}
                onChange={(e) => set_budget_input(e.target.value)}
                placeholder="np. 200"
                className={cn(
                  "flex-1 h-9 px-3 rounded-xl border text-sm",
                  "bg-white dark:bg-gray-700",
                  "border-gray-200 dark:border-gray-600",
                  "text-gray-900 dark:text-gray-100",
                  "placeholder:text-gray-400",
                  "focus:outline-none focus:ring-2 focus:ring-violet-500"
                )}
                onKeyDown={(e) => e.key === "Enter" && handle_save_budget()}
                autoFocus
              />
              <Button
                size="sm"
                onClick={handle_save_budget}
                className="bg-violet-500 hover:bg-violet-600"
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => set_editing_budget(false)}
                className="text-gray-400"
              >
                ✕
              </Button>
            </div>
          )}

          {monthly_budget > 0 ? (
            <>
              {currencies.length > 1 && (
                <p className="text-xs text-amber-500 dark:text-amber-400 mb-2">
                  Budżet dotyczy tylko subskrypcji w PLN.
                </p>
              )}
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className={cn(
                  "font-semibold",
                  budget_over
                    ? "text-red-600 dark:text-red-400"
                    : "text-gray-800 dark:text-gray-200"
                )}>
                  {format_currency(monthly_total, "PLN")}
                </span>
                <span className="text-gray-400 dark:text-gray-500 text-xs">
                  limit: {format_currency(monthly_budget, "PLN")}
                </span>
              </div>
              <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    budget_over
                      ? "bg-red-500"
                      : budget_pct > 80
                      ? "bg-orange-400"
                      : "bg-violet-500"
                  )}
                  style={{ width: `${budget_pct}%` }}
                />
              </div>
              <p className={cn(
                "text-xs mt-1.5",
                budget_over
                  ? "text-red-500 dark:text-red-400"
                  : "text-gray-400 dark:text-gray-500"
              )}>
                {budget_over
                  ? `⚠ Przekroczono o ${format_currency(monthly_total - monthly_budget, "PLN")}`
                  : `Pozostało ${format_currency(monthly_budget - monthly_total, "PLN")} · ${(100 - budget_pct).toFixed(0)}% wolne`}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Brak ustawionego budżetu. Ustaw limit, aby śledzić miesięczne wydatki.
            </p>
          )}
        </div>

        {/* Trend miesięczny */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
              Trend płatności – ostatnie 6 miesięcy
            </span>
          </div>
          {payment_history.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2">
              <TrendingUp className="h-8 w-8 text-gray-200 dark:text-gray-600" />
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center">
                Brak danych historycznych.<br />
                Opłać subskrypcje, aby zobaczyć wykres.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={trend_data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v}`}
                />
                <Tooltip
                  formatter={(value: number | undefined) => [format_currency(value ?? 0), "Kwota"]}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    fontSize: "12px",
                    padding: "8px 12px",
                  }}
                  cursor={{ fill: "rgba(59,130,246,0.08)" }}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Kategorie */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="h-4 w-4 text-violet-500" />
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
              Miesięczne wydatki wg kategorii
            </span>
          </div>

          {category_data.length === 0 ? (
            <div className="h-32 flex items-center justify-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">Brak aktywnych subskrypcji.</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={Math.max(category_data.length * 44, 80)}>
                <BarChart
                  data={category_data}
                  layout="vertical"
                  margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v} zł`}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                    width={82}
                  />
                  <Tooltip
                    formatter={(value: number | undefined) => [format_currency(value ?? 0), "Miesięcznie"]}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e5e7eb",
                      fontSize: "12px",
                      padding: "8px 12px",
                    }}
                    cursor={{ fill: "rgba(139,92,246,0.08)" }}
                  />
                  <Bar dataKey="monthly" radius={[0, 6, 6, 0]} maxBarSize={28}>
                    {category_data.map((entry) => (
                      <Cell key={entry.category} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Legenda */}
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3 pt-3 border-t border-gray-50 dark:border-gray-700">
                {category_data.map((e) => (
                  <div key={e.category} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
                    {e.label} ({e.count})
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Top 5 najdroższych */}
        {top_subs.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-4">
              Top {top_subs.length} – najdroższe subskrypcje
            </p>
            <div className="space-y-3">
              {top_subs.map((sub, i) => {
                const monthly = sub.payment_cycle === "yearly" ? sub.amount / 12 : sub.amount;
                const pct = max_monthly_amount > 0 ? (monthly / max_monthly_amount) * 100 : 0;
                return (
                  <div key={sub.id} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-300 dark:text-gray-600 w-4 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {sub.name}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
                          {format_currency(monthly, sub.currency ?? "PLN")}/mies.
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: sub.color || "#3b82f6",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
