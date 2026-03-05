"use client";

/**
 * Hook do obsługi automatyzacji subskrypcji.
 *
 * Zarządza cyklem życia joba:
 *   1. Sprawdza czy mikroserwis jest dostępny
 *   2. Uruchamia automatyzację (POST /api/automation/run)
 *   3. Polluje status (GET /api/automation/status/:job_id)
 *   4. Wystawia screenshot_url w stanie WAITING_FOR_USER
 *   5. Umożliwia kontynuację po CAPTCHA/2FA
 */
import { useState, useCallback, useRef } from "react";
import type { AutomationJobResponse, AutomationAction, JobStatus } from "@/types/automation";

interface UseAutomationOptions {
  poll_interval_ms?: number;
  on_completed?: (result: string) => void;
  on_failed?: (error: string) => void;
}

interface UseAutomationReturn {
  job: AutomationJobResponse | null;
  is_loading: boolean;
  is_available: boolean | null;
  run: (subscription_id: string, service_key: string, action: AutomationAction, email: string, password: string) => Promise<void>;
  continue_after_captcha: () => Promise<void>;
  reset: () => void;
  check_availability: () => Promise<boolean>;
}

export function use_automation(options: UseAutomationOptions = {}): UseAutomationReturn {
  const { poll_interval_ms = 2000, on_completed, on_failed } = options;

  const [job, set_job] = useState<AutomationJobResponse | null>(null);
  const [is_loading, set_is_loading] = useState(false);
  const [is_available, set_is_available] = useState<boolean | null>(null);

  const poll_ref = useRef<ReturnType<typeof setInterval> | null>(null);
  const job_id_ref = useRef<string | null>(null);

  const stop_polling = useCallback(() => {
    if (poll_ref.current) {
      clearInterval(poll_ref.current);
      poll_ref.current = null;
    }
  }, []);

  const check_availability = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/automation/jobs", {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      });
      const available = res.ok;
      set_is_available(available);
      return available;
    } catch {
      set_is_available(false);
      return false;
    }
  }, []);

  const poll_status = useCallback(
    (id: string) => {
      stop_polling();
      poll_ref.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/automation/status/${id}`);
          if (!res.ok) {
            stop_polling();
            return;
          }
          const data: AutomationJobResponse = await res.json();
          set_job(data);

          const terminal: JobStatus[] = ["completed", "failed"];
          if (terminal.includes(data.status)) {
            stop_polling();
            set_is_loading(false);
            if (data.status === "completed") {
              on_completed?.(data.result ?? "Akcja wykonana.");
            } else {
              on_failed?.(data.error ?? data.message);
            }
          }
        } catch {
          // Sieć niedostępna – kontynuuj polling
        }
      }, poll_interval_ms);
    },
    [stop_polling, poll_interval_ms, on_completed, on_failed]
  );

  const run = useCallback(
    async (
      subscription_id: string,
      service_key: string,
      action: AutomationAction,
      email: string,
      password: string,
    ): Promise<void> => {
      set_is_loading(true);
      set_job(null);

      try {
        const res = await fetch("/api/automation/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription_id, service_key, action, email, password }),
        });

        if (!res.ok) {
          const err = await res.json();
          const error_msg =
            err?.detail ?? err?.error ?? "Błąd uruchamiania automatyzacji.";
          set_job({
            job_id: "",
            status: "failed",
            message: error_msg,
            error: error_msg,
          });
          set_is_loading(false);
          on_failed?.(error_msg);
          return;
        }

        const data: AutomationJobResponse = await res.json();
        job_id_ref.current = data.job_id;
        set_job(data);
        poll_status(data.job_id);
      } catch (err) {
        const msg = "Nie można połączyć się z serwisem automatyzacji.";
        set_job({ job_id: "", status: "failed", message: msg, error: msg });
        set_is_loading(false);
        on_failed?.(msg);
      }
    },
    [poll_status, on_failed]
  );

  const continue_after_captcha = useCallback(async (): Promise<void> => {
    const id = job_id_ref.current;
    if (!id) return;

    try {
      const res = await fetch(`/api/automation/continue/${id}`, { method: "POST" });
      if (res.ok) {
        const data: AutomationJobResponse = await res.json();
        set_job(data);
        // Wznów polling jeśli zatrzymano
        if (!poll_ref.current) {
          poll_status(id);
        }
      }
    } catch {
      // Ignoruj – polling i tak wznowi się automatycznie
    }
  }, [poll_status]);

  const reset = useCallback(() => {
    stop_polling();
    set_job(null);
    set_is_loading(false);
    job_id_ref.current = null;
  }, [stop_polling]);

  return {
    job,
    is_loading,
    is_available,
    run,
    continue_after_captcha,
    reset,
    check_availability,
  };
}

export type { UseAutomationReturn };
