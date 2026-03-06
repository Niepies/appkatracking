"use client";
"use no memo";

/**
 * Modal automatycznego pobierania danych rozliczeniowych.
 *
 * Flow (bez podawania loginu/hasla do aplikacji):
 *   opening -> waiting (uzytkownik loguje sie recznie w przegladarce Selenium)
 *           -> running (Selenium scrapuje dane) -> preview -> done | failed
 *
 * Aplikacja NIGDY nie widzi loginow ani hasel – uzytkownik loguje sie sam
 * w prawdziwej przegladarce, a my tylko odczytujemy dane bez poswiadczen.
 */
import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { use_automation } from "@/hooks/use-automation";
import { use_subscription_store } from "@/store/subscription-store";
import type { ScrapedBillingData } from "@/types/automation";
import { CURRENCY_OPTIONS } from "@/types";
import {
  Loader2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Bot,
  Download,
  Pencil,
  MousePointerClick,
  LogIn,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ScrapeModalProps {
  is_open: boolean;
  on_close: () => void;
  subscription_id: string;
  service_key: string;
  service_name: string;
}

type Step = "opening" | "waiting" | "running" | "preview" | "done" | "failed";

export function ScrapeModal({
  is_open,
  on_close,
  subscription_id,
  service_key,
  service_name,
}: ScrapeModalProps) {
  const [step, set_step] = useState<Step>("opening");
  const [screenshot_url, set_screenshot_url] = useState<string | null>(null);
  const [error_msg, set_error_msg] = useState("");
  const [scraped, set_scraped] = useState<ScrapedBillingData>({});
  const [is_confirming, set_is_confirming] = useState(false);

  const screenshot_interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const started_ref = useRef(false);

  const { update_from_scrape } = use_subscription_store.getState();

  const { job, run, continue_after_captcha, reset } = use_automation({
    on_completed: (result_str) => {
      try {
        const data: ScrapedBillingData = JSON.parse(result_str);
        set_scraped(data);
        set_step("preview");
      } catch {
        set_scraped({ raw_info: result_str });
        set_step("preview");
      }
    },
    on_failed: (error) => {
      set_error_msg(error);
      set_step("failed");
    },
  });

  useEffect(() => {
    if (!job) return;
    if (job.status === "running") set_step("running");
    else if (job.status === "waiting_for_user") {
      set_step("waiting");
      if (job.screenshot_url) {
        set_screenshot_url(`/api/automation/screenshot/${job.job_id}?t=${Date.now()}`);
      }
    }
  }, [job]);

  useEffect(() => {
    if (step === "waiting" && job?.job_id) {
      screenshot_interval.current = setInterval(() => {
        set_screenshot_url(`/api/automation/screenshot/${job.job_id}?t=${Date.now()}`);
      }, 3000);
    } else {
      if (screenshot_interval.current) {
        clearInterval(screenshot_interval.current);
        screenshot_interval.current = null;
      }
    }
    return () => {
      if (screenshot_interval.current) clearInterval(screenshot_interval.current);
    };
  }, [step, job?.job_id]);

  useEffect(() => {
    if (is_open && !started_ref.current) {
      started_ref.current = true;
      handle_start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is_open]);

  const handle_start = async () => {
    set_step("opening");
    set_screenshot_url(null);
    set_error_msg("");
    set_scraped({});
    await run(subscription_id, service_key, "scrape", "", "");
  };

  const handle_logged_in = async () => {
    set_is_confirming(true);
    set_step("running");
    await continue_after_captcha();
    set_is_confirming(false);
  };

  const handle_save = () => {
    update_from_scrape(subscription_id, scraped);
    toast.success("Dane rozliczeniowe zapisane!", {
      description: scraped.plan_name ? `Plan: ${scraped.plan_name}` : "Subskrypcja wlaczona.",
    });
    set_step("done");
  };

  const handle_close = () => {
    reset();
    set_step("opening");
    set_screenshot_url(null);
    set_error_msg("");
    set_scraped({});
    set_is_confirming(false);
    on_close();
  };

  return (
    <Dialog open={is_open} onOpenChange={(open) => !open && handle_close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-emerald-500" />
            <DialogTitle>Pobierz dane {service_name} automatycznie</DialogTitle>
          </div>
        </DialogHeader>

        {step === "opening" && (
          <div className="py-8 flex flex-col items-center gap-4 text-center">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Bot className="h-8 w-8 text-emerald-500 animate-pulse" />
              </div>
              <Loader2 className="h-5 w-5 text-emerald-500 animate-spin absolute -bottom-1 -right-1 bg-white dark:bg-gray-900 rounded-full" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                Otwieramy przegladarke...
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Za chwile pojawi sie strona logowania {service_name}.
              </p>
            </div>
          </div>
        )}

        {step === "waiting" && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>
                <strong>Twoje dane sa bezpieczne.</strong>{" "}
                Logujesz sie bezposrednio na stronie {service_name} - aplikacja
                nie widzi Twojego loginu ani hasla. Pobieramy tylko dane rozliczeniowe.
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-3">
              <LogIn className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-semibold">
                  {job?.message ?? `Zaloguj sie do ${service_name} w otwartej przegladarce`}
                </p>
                <p className="mt-0.5 text-blue-600 dark:text-blue-300">
                  Po zalogowaniu kliknij przycisk ponizej.
                </p>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 min-h-[160px] flex flex-col">
              {screenshot_url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={screenshot_url}
                    alt="Podglad przegladarki"
                    className="w-full object-contain max-h-60"
                    onError={() => set_screenshot_url(null)}
                  />
                  <p className="text-center text-xs text-gray-400 py-1">
                    Podglad na zywo - odswieza co 3 s
                  </p>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center gap-2 text-sm text-gray-400 py-6">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Czekam na podglad przegladarki...
                </div>
              )}
            </div>

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              onClick={handle_logged_in}
              disabled={is_confirming}
            >
              <MousePointerClick className="h-4 w-4" />
              Zalogowałem się — pobierz dane
            </Button>

            <Button variant="ghost" className="w-full text-gray-500" onClick={handle_close}>
              Anuluj
            </Button>
          </div>
        )}

        {step === "running" && (
          <div className="py-8 flex flex-col items-center gap-4 text-center">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Download className="h-8 w-8 text-emerald-500 animate-pulse" />
              </div>
              <Loader2 className="h-5 w-5 text-emerald-500 animate-spin absolute -bottom-1 -right-1 bg-white dark:bg-gray-900 rounded-full" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                Pobieram dane rozliczeniowe...
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {job?.message ?? "Nawiguje do strony konta i odczytuje plan, kwote i daty platnosci"}
              </p>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full w-1/2" />
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>
                Dane pobrane pomyslnie. Sprawdz i ewentualnie popraw wartosci, a nastepnie
                kliknij <strong>Zapisz</strong>.
              </p>
            </div>

            <div className="space-y-3">
              <ScrapedField
                label="Plan / nazwa"
                value={scraped.plan_name ?? ""}
                onChange={(v) => set_scraped((s) => ({ ...s, plan_name: v || null }))}
                placeholder="np. Premium Individual"
              />
              <div className="grid grid-cols-2 gap-2">
                <ScrapedField
                  label="Kwota"
                  value={scraped.amount != null ? String(scraped.amount) : ""}
                  onChange={(v) =>
                    set_scraped((s) => ({
                      ...s,
                      amount: v ? parseFloat(v.replace(",", ".")) || null : null,
                    }))
                  }
                  type="number"
                  placeholder="np. 49.99"
                />
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Waluta
                  </label>
                  <select
                    value={scraped.currency ?? "PLN"}
                    onChange={(e) =>
                      set_scraped((s) => ({ ...s, currency: e.target.value || null }))
                    }
                    className="w-full h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.value}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Cykl platnosci
                </label>
                <select
                  value={scraped.payment_cycle ?? "monthly"}
                  onChange={(e) =>
                    set_scraped((s) => ({
                      ...s,
                      payment_cycle: (e.target.value as "monthly" | "yearly") || null,
                    }))
                  }
                  className="w-full h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="monthly">Miesieczny</option>
                  <option value="yearly">Roczny</option>
                </select>
              </div>

              <ScrapedField
                label="Data nastepnej platnosci"
                value={scraped.next_payment_date ?? ""}
                onChange={(v) => set_scraped((s) => ({ ...s, next_payment_date: v || null }))}
                type="date"
                placeholder="YYYY-MM-DD"
              />

              {scraped.raw_info && (
                <details className="text-xs text-gray-400 dark:text-gray-600">
                  <summary className="cursor-pointer hover:text-gray-500">
                    Szczegoly pobierania
                  </summary>
                  <p className="mt-1 break-all">{scraped.raw_info}</p>
                </details>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={handle_close}>
                Anuluj
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handle_save}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Zapisz i wlacz subskrypcje
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="py-6 flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">Subskrypcja aktywna!</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Dane rozliczeniowe zostaly zapisane automatycznie.
                {scraped.plan_name && ` Plan: ${scraped.plan_name}.`}
              </p>
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handle_close}>
              Zamknij
            </Button>
          </div>
        )}

        {step === "failed" && (
          <div className="py-6 flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                Nie udalo sie pobrac danych
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs">{error_msg}</p>
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={handle_close}>
                Zamknij
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={() => { reset(); handle_start(); }}
              >
                <RefreshCw className="h-4 w-4" />
                Sprobuj ponownie
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ScrapedFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "number" | "date";
}

function ScrapedField({ label, value, onChange, placeholder, type = "text" }: ScrapedFieldProps) {
  const is_empty = !value;
  return (
    <div className="space-y-1">
      <label
        className={cn(
          "text-xs font-medium",
          is_empty ? "text-amber-600 dark:text-amber-400" : "text-gray-600 dark:text-gray-400"
        )}
      >
        {label}
        {is_empty && <span className="ml-1 text-amber-500">(nie pobrano)</span>}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full h-9 rounded-lg border px-3 pr-8 text-sm outline-none focus:ring-2 focus:ring-emerald-500",
            "bg-white dark:bg-gray-800",
            is_empty
              ? "border-amber-300 dark:border-amber-700"
              : "border-gray-200 dark:border-gray-700"
          )}
        />
        <Pencil className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-300 pointer-events-none" />
      </div>
    </div>
  );
}
