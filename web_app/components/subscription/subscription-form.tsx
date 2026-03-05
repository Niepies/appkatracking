"use client";

/**
 * Formularz dodawania / edycji subskrypcji
 * Waliduje dane przez Zod, wyświetla błędy inline
 */
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { subscription_schema, type SubscriptionSchemaType } from "@/lib/validators";
import { use_subscription_store } from "@/store/subscription-store";
import { CATEGORY_LABELS, CYCLE_LABELS, POPULAR_SERVICES, type Subscription } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/form-elements";
import { format, parseISO } from "date-fns";
import { pl } from "date-fns/locale";
import { Sparkles, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubscriptionFormProps {
  /** Jeśli podane, formula działa w trybie edycji */
  subscription?: Subscription;
  on_success?: () => void;
  on_cancel?: () => void;
}

export function SubscriptionForm({
  subscription,
  on_success,
  on_cancel,
}: SubscriptionFormProps) {
  const { add_subscription, update_subscription } = use_subscription_store.getState();
  const is_edit_mode = Boolean(subscription);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SubscriptionSchemaType>({
    resolver: zodResolver(subscription_schema),
    defaultValues: {
      name: subscription?.name ?? "",
      amount: subscription?.amount?.toString() ?? "",
      payment_cycle: subscription?.payment_cycle ?? "monthly",
      // Dla nowej miesięcznej subskrypcji next_payment_date jest obliczana
      // reaktywnie przez useEffect – tu podajemy placeholder (zastąpi go efekt)
      next_payment_date:
        subscription?.next_payment_date ??
        (subscription?.payment_cycle === "yearly"
          ? format(new Date(), "yyyy-MM-dd")
          : ""),
      category: subscription?.category ?? "entertainment",
      description: subscription?.description ?? "",
      has_trial: false,
      trial_end_date: "",
    },
  });

  const watched_name         = watch("name");
  const watched_has_trial    = watch("has_trial");
  const watched_payment_cycle = watch("payment_cycle");

  // ── Billing day (tylko dla miesięcznych) ──────────────────────────────────
  const [billing_day, set_billing_day] = useState<number>(() => {
    if (subscription?.next_payment_date) {
      return parseISO(subscription.next_payment_date).getDate();
    }
    return new Date().getDate();
  });

  /** Zwraca najbliższe przyszłe wystąpienie danego dnia miesiąca */
  function get_next_occurrence(day: number): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const safe_day = Math.min(Math.max(1, day), 28);
    let candidate = new Date(today.getFullYear(), today.getMonth(), safe_day);
    if (candidate <= today) {
      candidate = new Date(today.getFullYear(), today.getMonth() + 1, safe_day);
    }
    return format(candidate, "yyyy-MM-dd");
  }

  // Aktualizuj `next_payment_date` gdy zmienia się dzień lub cykl
  useEffect(() => {
    if (watched_payment_cycle === "monthly" && !watched_has_trial) {
      setValue("next_payment_date", get_next_occurrence(billing_day), {
        shouldValidate: true,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billing_day, watched_payment_cycle, watched_has_trial]);

  // Autouzupełnianie z listy popularnych serwisów
  const handle_quick_fill = (service: typeof POPULAR_SERVICES[0]) => {
    setValue("name", service.name);
    setValue("category", service.category);
  };

  const on_submit = (data: SubscriptionSchemaType) => {
    const color =
      POPULAR_SERVICES.find((s) => s.name.toLowerCase() === data.name.toLowerCase())
        ?.color ?? undefined;

    if (is_edit_mode && subscription) {
      // Edycja: aktualizujemy tylko statyczne pola
      update_subscription(subscription.id, {
        name: data.name,
        amount: Number(data.amount),
        payment_cycle: data.payment_cycle,
        category: data.category,
        description: data.description,
        color,
      });
    } else {
      add_subscription({
        name: data.name,
        amount: Number(data.amount),
        payment_cycle: data.payment_cycle,
        next_payment_date: data.next_payment_date,
        has_trial: data.has_trial,
        trial_end_date: data.trial_end_date,
        category: data.category,
        description: data.description,
        color,
      });
    }

    on_success?.();
  };

  // Filtrowanie sugerowanych serwisów
  const suggestions = watched_name
    ? POPULAR_SERVICES.filter((s) =>
        s.name.toLowerCase().includes(watched_name.toLowerCase()) &&
        s.name.toLowerCase() !== watched_name.toLowerCase()
      ).slice(0, 5)
    : [];

  return (
    <form onSubmit={handleSubmit(on_submit)} className="space-y-5">
      {/* Szybki wybór z popularnych serwisów */}
      {!is_edit_mode && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Szybki wybór
          </p>
          <div className="flex flex-wrap gap-2">
            {POPULAR_SERVICES.slice(0, 8).map((service) => (
              <button
                key={service.name}
                type="button"
                onClick={() => handle_quick_fill(service)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                  "hover:scale-105 active:scale-95",
                  watched_name === service.name
                    ? "border-blue-400 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-blue-300"
                )}
              >
                {service.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Nazwa */}
      <div className="space-y-1.5">
        <Label htmlFor="name">Nazwa subskrypcji *</Label>
        <div className="relative">
          <Input
            id="name"
            placeholder="np. Netflix, Spotify, Prąd..."
            {...register("name")}
            error={errors.name?.message}
            autoComplete="off"
          />
          {/* Autouzupełnianie */}
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-10 overflow-hidden">
              {suggestions.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => handle_quick_fill(s)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Kwota i cykl */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="amount">Kwota (PLN) *</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="np. 49.99"
            {...register("amount")}
            error={errors.amount?.message}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Cykl płatności *</Label>
          <Select
            defaultValue={subscription?.payment_cycle ?? "monthly"}
            onValueChange={(val) =>
              setValue("payment_cycle", val as "monthly" | "yearly")
            }
          >
            <SelectTrigger error={errors.payment_cycle?.message}>
              <SelectValue placeholder="Wybierz cykl" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">{CYCLE_LABELS.monthly}</SelectItem>
              <SelectItem value="yearly">{CYCLE_LABELS.yearly}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Data następnej płatności / koniec trial */}
      {watched_payment_cycle === "monthly" && !watched_has_trial ? (
        // ── Miesięczna: wybór dnia miesiąca ─────────────────────────────────
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 text-blue-500" />
            Który dzień miesiąca jest dniem rozliczenia? *
          </Label>

          {/* Szybkie przyciski popularnych dni */}
          <div className="flex flex-wrap gap-1.5">
            {[1, 5, 10, 14, 15, 20, 25, 28].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => set_billing_day(d)}
                className={cn(
                  "w-10 h-9 rounded-lg text-sm font-semibold border transition-all",
                  billing_day === d
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:border-blue-400"
                )}
              >
                {d}.
              </button>
            ))}
          </div>

          {/* Własny dzień */}
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={28}
              value={billing_day}
              onChange={(e) => {
                const v = Math.max(1, Math.min(28, Number(e.target.value) || 1));
                set_billing_day(v);
              }}
              className="w-24 text-center"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">dzień miesiąca (1–28)</span>
          </div>

          {/* Podgląd obliczonej daty */}
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
            → Następna płatność:{" "}
            {format(parseISO(get_next_occurrence(billing_day)), "d MMMM yyyy", { locale: pl })}
          </p>

          {errors.next_payment_date && (
            <p className="text-xs text-red-500">{errors.next_payment_date.message}</p>
          )}
        </div>
      ) : (
        // ── Roczna lub trial: klasyczny date picker ──────────────────────────
        <div className="space-y-1.5">
          <Label htmlFor="next_payment_date">
            {watched_has_trial
              ? "Data startu usługi (start trial) *"
              : "Data następnej płatności *"}
          </Label>
          <Input
            id="next_payment_date"
            type="date"
            {...register("next_payment_date")}
            error={errors.next_payment_date?.message}
          />
        </div>
      )}

      {/* Trial – checkbox */}
      {!is_edit_mode && (
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer"
              {...register("has_trial")}
            />
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none">
                Jestem w trakcie okresu próbnego
              </span>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Zaznacz jeśli korzystasz z darmowego trialu – podaj kiedy kończy się i kiedy nastąpi pierwsza płatność
              </p>
            </div>
          </label>

          {/* Data końca trial */}
          {watched_has_trial && (
            <div className="space-y-1.5 pl-7">
              <Label htmlFor="trial_end_date">Koniec trial / data pierwszej płatności *</Label>
              <Input
                id="trial_end_date"
                type="date"
                {...register("trial_end_date")}
                error={errors.trial_end_date?.message}
              />
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Dzień, w którym kończy się trial i nastąpi pierwsze pobranie opłaty
              </p>
            </div>
          )}
        </div>
      )}

      {/* Kategoria */}
      <div className="space-y-1.5">
        <Label>Kategoria</Label>
        <Select
          defaultValue={subscription?.category ?? "entertainment"}
          onValueChange={(val) => setValue("category", val as any)}
        >
          <SelectTrigger error={errors.category?.message}>
            <SelectValue placeholder="Wybierz kategorię" />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(CATEGORY_LABELS) as [string, string][]).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Opis (opcjonalny) */}
      <div className="space-y-1.5">
        <Label htmlFor="description">Opis (opcjonalnie)</Label>
        <Input
          id="description"
          placeholder="Krótka notatka..."
          {...register("description")}
        />
      </div>

      {/* Przyciski */}
      <div className="flex gap-3 pt-2">
        {on_cancel && (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={on_cancel}
          >
            Anuluj
          </Button>
        )}
        <Button
          type="submit"
          className="flex-1"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Zapisuję..." : is_edit_mode ? "Zapisz zmiany" : "Dodaj subskrypcję"}
        </Button>
      </div>
    </form>
  );
}
