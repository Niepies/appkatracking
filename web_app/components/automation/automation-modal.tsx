"use client";

/**
 * Modal automatyzacji – zarządza danymi logowania i uruchamia automatyzację.
 *
 * Stany:
 *   credentials  – formularz danych logowania
 *   running      – postęp automatyzacji
 *   waiting      – oczekiwanie na interakcję (CAPTCHA/2FA) + podgląd ekranu
 *   completed    – wynik końcowy
 *   failed       – błąd
 */
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { use_automation } from "@/hooks/use-automation";
import type { AutomationAction } from "@/types/automation";
import {
  Loader2,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Bot,
  MonitorSmartphone,
  MousePointerClick,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AutomationModalProps {
  is_open: boolean;
  on_close: () => void;
  subscription_id: string;
  service_key: string;
  service_name: string;
  action: AutomationAction;
}

type Step = "credentials" | "running" | "waiting" | "completed" | "failed";

export function AutomationModal({
  is_open,
  on_close,
  subscription_id,
  service_key,
  service_name,
  action,
}: AutomationModalProps) {
  const [step, set_step] = useState<Step>("credentials");
  const [email, set_email] = useState("");
  const [password, set_password] = useState("");
  const [show_password, set_show_password] = useState(false);
  const [screenshot_url, set_screenshot_url] = useState<string | null>(null);
  const [result_message, set_result_message] = useState("");

  const { job, is_loading, run, continue_after_captcha, reset } = use_automation({
    on_completed: (result) => {
      set_result_message(result);
      set_step("completed");
      toast.success("Automatyzacja zakończona sukcesem!", { duration: 5000 });
    },
    on_failed: (error) => {
      set_result_message(error);
      set_step("failed");
    },
  });

  // Śledź zmiany statusu joba
  useEffect(() => {
    if (!job) return;
    if (job.status === "running") {
      set_step("running");
    } else if (job.status === "waiting_for_user") {
      set_step("waiting");
      // Odśwież URL screenshota
      if (job.screenshot_url) {
        set_screenshot_url(
          `/api/automation/screenshot/${job.job_id}?t=${Date.now()}`
        );
      }
    }
  }, [job]);

  const handle_close = () => {
    reset();
    set_step("credentials");
    set_email("");
    set_password("");
    set_screenshot_url(null);
    set_result_message("");
    on_close();
  };

  // alias dla czytelności JSX
  const handle_save_and_run = handle_run;

  const handle_run = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error("Podaj e-mail i hasło.");
      return;
    }

    set_step("running");
    // Dane logowania trafiają tylko do body żądania HTTP – nie są nigdzie zapisywane
    await run(
      subscription_id,
      service_key.toLowerCase().replace(/\s+/g, ""),
      action,
      email.trim(),
      password,
    );
  };

  const action_label = action === "cancel" ? "Anuluj" : "Wznów";
  const action_label_ing = action === "cancel" ? "Anulowanie" : "Wznawianie";

  return (
    <Dialog open={is_open} onOpenChange={(open) => !open && handle_close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-500" />
            <DialogTitle>
              {action_label} {service_name} – Automatyzacja
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* ── KROK 1: Dane logowania ─────────────────────────────── */}
        {step === "credentials" && (
          <div className="space-y-4">
            {/* Informacja o bezpieczeństwie */}
            <div className="flex items-start gap-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-3 text-sm text-blue-700 dark:text-blue-300">
              <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>
                Dane logowania <strong>nie są nigdzie zapisywane</strong>. Są używane
                jednorazowo do zalogowania się i wykonania akcji, po czym są trwale usuwane
                z pamięci.
              </p>
            </div>

            {/* E-mail */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                E-mail / login {service_name}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => set_email(e.target.value)}
                placeholder="twoj@email.com"
                autoComplete="username"
                className="w-full h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Hasło */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Hasło
              </label>
              <div className="relative">
                <input
                  type={show_password ? "text" : "password"}
                  value={password}
                  onChange={(e) => set_password(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handle_save_and_run();
                  }}
                />
                <button
                  type="button"
                  onClick={() => set_show_password((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {show_password ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Jak działa */}
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Jak to działa?
              </p>
              {[
                { icon: Bot, text: "Otwiera przeglądarkę i loguje się na Twoim koncie" },
                { icon: MonitorSmartphone, text: "Nawiguje do strony zarządzania subskrypcją" },
                { icon: MousePointerClick, text: `Klikuje "${action_label_ing}" i potwierdza akcję` },
                { icon: Info, text: "Jeśli napotka CAPTCHA – przekaże Ci podgląd ekranu" },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Icon className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-gray-400" />
                  <span>{text}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={handle_close}>
                Anuluj
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handle_run}
                disabled={is_loading || !email || !password}
              >
                <Bot className="h-4 w-4 mr-2" /> {action_label} automatycznie
              </Button>
            </div>
          </div>
        )}

        {/* ── KROK 2: Automatyzacja w toku ──────────────────────── */}
        {step === "running" && (
          <div className="py-8 flex flex-col items-center gap-4 text-center">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Bot className="h-8 w-8 text-blue-500 animate-pulse" />
              </div>
              <Loader2 className="h-5 w-5 text-blue-500 animate-spin absolute -bottom-1 -right-1 bg-white dark:bg-gray-900 rounded-full" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {action_label_ing} subskrypcji…
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {job?.message ?? "Proszę czekać – automatyzacja w toku"}
              </p>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite] w-1/2" />
            </div>
          </div>
        )}

        {/* ── KROK 3: Oczekiwanie na CAPTCHA/2FA ───────────────── */}
        {step === "waiting" && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-700 dark:text-amber-300">
              <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>
                <strong>Wymagana interakcja:</strong> {job?.message}
              </p>
            </div>

            {/* Screenshot sesji */}
            {screenshot_url && (
              <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screenshot_url}
                  alt="Podgląd sesji przeglądarki"
                  className="w-full object-contain max-h-64"
                  onError={() => set_screenshot_url(null)}
                />
              </div>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Wypełnij formularz w przeglądarce działającej w tle,
              a następnie kliknij &quot;Kontynuuj&quot;.
            </p>

            <Button
              className="w-full bg-amber-500 hover:bg-amber-600 text-white"
              onClick={async () => {
                set_step("running");
                await continue_after_captcha();
              }}
            >
              <MousePointerClick className="h-4 w-4 mr-2" />
              Kontynuuj po weryfikacji
            </Button>
          </div>
        )}

        {/* ── KROK 4: Sukces ─────────────────────────────────────── */}
        {step === "completed" && (
          <div className="py-6 flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                Gotowe!
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {result_message}
              </p>
            </div>
            <Button className="w-full" onClick={handle_close}>
              Zamknij
            </Button>
          </div>
        )}

        {/* ── KROK 5: Błąd ───────────────────────────────────────── */}
        {step === "failed" && (
          <div className="py-6 flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                Automatyzacja nie powiodła się
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
                {result_message}
              </p>
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={handle_close}>
                Zamknij
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  reset();
                  set_step("credentials");
                  set_result_message("");
                }}
              >
                Spróbuj ponownie
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
