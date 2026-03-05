"use client";

/**
 * Sekcja podsumowania kosztów na dashboardzie
 * Wyświetla łączne koszty miesięczne i roczne, liczbę aktywnych subskrypcji
 */
import { useMemo } from "react";
import type { Subscription } from "@/types";
import {
  calculate_total_monthly,
  calculate_total_yearly,
  format_currency,
} from "@/lib/utils";
import { CreditCard, TrendingUp, Layers } from "lucide-react";

interface SummarySectionProps {
  subscriptions: Subscription[];
}

export function SummarySection({ subscriptions }: SummarySectionProps) {

  const stats = useMemo(() => {
    const active = subscriptions.filter((s) => s.is_active);
    return {
      monthly_total: calculate_total_monthly(subscriptions),
      yearly_total: calculate_total_yearly(subscriptions),
      active_count: active.length,
      total_count: subscriptions.length,
    };
  }, [subscriptions]);

  const cards = [
    {
      label: "Miesięcznie",
      value: format_currency(stats.monthly_total),
      subtitle: "łącznie aktywne",
      icon: CreditCard,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      label: "Rocznie",
      value: format_currency(stats.yearly_total),
      subtitle: "szacunkowo",
      icon: TrendingUp,
      color: "text-indigo-500",
      bg: "bg-indigo-50",
    },
    {
      label: "Subskrypcje",
      value: `${stats.active_count}`,
      subtitle: `z ${stats.total_count} łącznie`,
      icon: Layers,
      color: "text-green-500",
      bg: "bg-green-50",
    },
  ];

  if (subscriptions.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex flex-col gap-2"
          >
            <div className={`${card.bg} ${card.color} h-8 w-8 rounded-xl flex items-center justify-center`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-gray-100 text-lg leading-tight">{card.value}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{card.label}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{card.subtitle}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
