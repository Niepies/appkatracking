"use client";

/**
 * Sekcja podsumowania kosztów na dashboardzie
 * Wyświetla łączne koszty miesięczne i roczne, liczbę aktywnych subskrypcji.
 * Obsługuje wiele walut – wyświetla osobne kwoty per waluta.
 */
import { useMemo } from "react";
import type { Subscription } from "@/types";
import {
  calculate_totals_by_currency,
  format_currency,
} from "@/lib/utils";
import { CreditCard, TrendingUp, Layers } from "lucide-react";

interface SummarySectionProps {
  subscriptions: Subscription[];
}

export function SummarySection({ subscriptions }: SummarySectionProps) {

  const stats = useMemo(() => {
    const active = subscriptions.filter((s) => s.is_active);
    const by_currency = calculate_totals_by_currency(subscriptions);
    const currencies = Object.keys(by_currency);
    return {
      by_currency,
      currencies,
      active_count: active.length,
      total_count: subscriptions.length,
    };
  }, [subscriptions]);

  if (subscriptions.length === 0) return null;

  const { by_currency, currencies, active_count, total_count } = stats;
  const multi = currencies.length > 1;

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Miesięcznie */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex flex-col gap-2">
        <div className="bg-blue-50 text-blue-500 h-8 w-8 rounded-xl flex items-center justify-center">
          <CreditCard className="h-4 w-4" />
        </div>
        <div>
          {currencies.map((cur) => (
            <p key={cur} className="font-bold text-gray-900 dark:text-gray-100 text-lg leading-tight">
              {format_currency(by_currency[cur].monthly, cur)}
              {multi && <span className="text-xs font-normal text-gray-400 ml-1">{cur}</span>}
            </p>
          ))}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Miesięcznie</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">łącznie aktywne</p>
        </div>
      </div>

      {/* Rocznie */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex flex-col gap-2">
        <div className="bg-indigo-50 text-indigo-500 h-8 w-8 rounded-xl flex items-center justify-center">
          <TrendingUp className="h-4 w-4" />
        </div>
        <div>
          {currencies.map((cur) => (
            <p key={cur} className="font-bold text-gray-900 dark:text-gray-100 text-lg leading-tight">
              {format_currency(by_currency[cur].yearly, cur)}
              {multi && <span className="text-xs font-normal text-gray-400 ml-1">{cur}</span>}
            </p>
          ))}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Rocznie</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">szacunkowo</p>
        </div>
      </div>

      {/* Subskrypcje */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex flex-col gap-2">
        <div className="bg-green-50 text-green-500 h-8 w-8 rounded-xl flex items-center justify-center">
          <Layers className="h-4 w-4" />
        </div>
        <div>
          <p className="font-bold text-gray-900 dark:text-gray-100 text-lg leading-tight">{active_count}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Subskrypcje</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">z {total_count} łącznie</p>
        </div>
      </div>
    </div>
  );
}
