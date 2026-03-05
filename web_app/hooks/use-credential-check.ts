"use client";

/**
 * Hook sprawdzający czy w mikroserwisie automatyzacji są zapisane dane logowania
 * dla danego serwisu. Wynik jest cache'owany przez 5 minut w pamięci modułu.
 *
 * Zastosowanie: guard dla przycisków akcji – jeśli brak danych logowania,
 * przekieruj użytkownika na stronę logowania serwisu zamiast wykonywać
 * operację „w powietrzu".
 *
 * has_credentials:
 *   true  – dane zapisane → można wykonać akcję automatycznie
 *   false – brak danych   → przekieruj na login serwisu
 *   null  – API nieosiągalne → pozwól na kontynuację (graceful degradation)
 */
import { useState, useEffect, useCallback } from "react";
import { normalize_service_key } from "@/lib/utils";

// ── Cache na poziomie modułu (persist między renderami) ───────────────────────
const _cache = new Map<string, { has: boolean; ts: number }>();
const CACHE_MS = 5 * 60 * 1000; // 5 minut

export function use_credential_check(service_name: string) {
  const service_key = normalize_service_key(service_name);
  const [has_credentials, set_has_credentials] = useState<boolean | null>(null);
  const [is_checking, set_is_checking] = useState(false);

  const check = useCallback(async () => {
    // Zwróć wynik z cache jeśli świeży
    const cached = _cache.get(service_key);
    if (cached && Date.now() - cached.ts < CACHE_MS) {
      set_has_credentials(cached.has);
      return;
    }

    set_is_checking(true);
    try {
      const res = await fetch(
        `/api/credentials/${encodeURIComponent(service_key)}`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (res.ok) {
        const data: { has_credentials: boolean } = await res.json();
        _cache.set(service_key, { has: data.has_credentials, ts: Date.now() });
        set_has_credentials(data.has_credentials);
      } else if (res.status === 404) {
        // Serwis rozpoznany, ale brak zapisanych danych
        _cache.set(service_key, { has: false, ts: Date.now() });
        set_has_credentials(false);
      } else {
        // Inny błąd serwera – nie blokujemy akcji
        set_has_credentials(null);
      }
    } catch {
      // Mikroserwis nieosiągalny – nie blokujemy (graceful degradation)
      set_has_credentials(null);
    } finally {
      set_is_checking(false);
    }
  }, [service_key]);

  useEffect(() => {
    void check();
  }, [check]);

  /** Czyści cache dla danego serwisu (np. po zapisaniu danych logowania) */
  const invalidate = useCallback(() => {
    _cache.delete(service_key);
    void check();
  }, [service_key, check]);

  return { has_credentials, is_checking_creds: is_checking, service_key, invalidate };
}
