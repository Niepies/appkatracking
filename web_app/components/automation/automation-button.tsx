"use client";

/**
 * Przycisk automatyzacji subskrypcji – wyświetlany w karcie/modalu subskrypcji.
 *
 * Sprawdza dostępność mikroserwisu i wyświetla odpowiedni stan.
 * Po kliknięciu otwiera AutomationModal.
 */
import { useState, useEffect } from "react";
import { Bot, Loader2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AutomationModal } from "./automation-modal";
import type { AutomationAction } from "@/types/automation";
import { cn } from "@/lib/utils";

interface AutomationButtonProps {
  subscription_id: string;
  service_name: string;
  action: AutomationAction;
  /** Jeśli nie podano, service_key = service_name.toLowerCase().replace(/\s+/g,"") */
  service_key?: string;
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default";
}

export function AutomationButton({
  subscription_id,
  service_name,
  action,
  service_key,
  className,
  variant = "outline",
  size = "sm",
}: AutomationButtonProps) {
  const [is_modal_open, set_is_modal_open] = useState(false);
  const [is_checking, set_is_checking] = useState(false);
  const [is_available, set_is_available] = useState<boolean | null>(null);

  const resolved_key =
    service_key ?? service_name.toLowerCase().replace(/[\s+]/g, "").replace(/[^a-z0-9\-_]/g, "");

  const action_label = action === "cancel" ? "Anuluj automatycznie" : "Wznów automatycznie";

  // Sprawdź dostępność mikroserwisu przy montowaniu
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      set_is_checking(true);
      try {
        const res = await fetch("/api/automation/jobs", {
          signal: AbortSignal.timeout(3000),
        });
        if (!cancelled) set_is_available(res.ok);
      } catch {
        if (!cancelled) set_is_available(false);
      } finally {
        if (!cancelled) set_is_checking(false);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (is_checking) {
    return (
      <Button variant={variant} size={size} disabled className={className}>
        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
        <span>Sprawdzam…</span>
      </Button>
    );
  }

  if (is_available === false) {
    return (
      <Button
        variant="ghost"
        size={size}
        disabled
        className={cn("text-gray-400 cursor-not-allowed", className)}
        title="Mikroserwis automatyzacji jest niedostępny. Uruchom: cd automation && python main.py"
      >
        <WifiOff className="h-3.5 w-3.5 mr-1.5" />
        <span className="text-xs">Automatyzacja offline</span>
      </Button>
    );
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => set_is_modal_open(true)}
        className={cn(
          action === "cancel"
            ? "border-orange-200 text-orange-600 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-900/20"
            : "border-green-200 text-green-600 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20",
          className
        )}
      >
        <Bot className="h-3.5 w-3.5 mr-1.5" />
        {action_label}
      </Button>

      <AutomationModal
        is_open={is_modal_open}
        on_close={() => set_is_modal_open(false)}
        subscription_id={subscription_id}
        service_key={resolved_key}
        service_name={service_name}
        action={action}
      />
    </>
  );
}
