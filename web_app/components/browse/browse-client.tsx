"use client";

/**
 * Strona odkrywania treści – wyszukaj film/serial i sprawdź
 * na jakim serwisie możesz go obejrzeć (ze swoimi subskrypcjami).
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, Info, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ShowCard } from "@/components/browse/show-card";
import { use_subscription_store } from "@/store/subscription-store";
import type { Show } from "@/types/streaming";
import type { Subscription } from "@/types";

const TRENDING_SEARCHES = ["The Last of Us", "Oppenheimer", "Squid Game", "Dune", "Wednesday"];

type ShowType = "all" | "movie" | "series";

export function BrowseClient() {
  const [query, set_query] = useState("");
  const [show_type, set_show_type] = useState<ShowType>("all");
  const [results, set_results] = useState<Show[]>([]);
  const [loading, set_loading] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const [searched, set_searched] = useState(false);
  const [subscriptions, set_subscriptions] = useState<Subscription[]>(() =>
    use_subscription_store.getState().subscriptions
  );

  const debounce_ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subskrybuj store – identyczny pattern co w dashboard
  useEffect(() => {
    set_subscriptions(use_subscription_store.getState().subscriptions);
    const unsub = use_subscription_store.subscribe((s) => set_subscriptions(s.subscriptions));
    return unsub;
  }, []);

  const search = useCallback(async (q: string, type: ShowType) => {
    if (q.trim().length < 2) return;
    set_loading(true);
    set_error(null);
    try {
      const res = await fetch(
        `/api/streaming?q=${encodeURIComponent(q.trim())}&country=pl&type=${type}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Błąd API");
      set_results(Array.isArray(data) ? data : data.shows ?? []);
      set_searched(true);
    } catch (e) {
      set_error(e instanceof Error ? e.message : "Błąd połączenia");
      set_results([]);
    } finally {
      set_loading(false);
    }
  }, []);

  // Debounce – szukaj 600ms po zatrzymaniu pisania
  const handle_input = (value: string) => {
    set_query(value);
    if (debounce_ref.current) clearTimeout(debounce_ref.current);
    if (value.trim().length >= 2) {
      debounce_ref.current = setTimeout(() => search(value, show_type), 600);
    } else {
      set_results([]);
      set_searched(false);
    }
  };

  const handle_submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounce_ref.current) clearTimeout(debounce_ref.current);
    search(query, show_type);
  };

  const handle_trending = (term: string) => {
    set_query(term);
    search(term, show_type);
  };

  const active_count = subscriptions.filter((s) => s.is_active).length;
  const has_api_key = !error?.includes("RAPIDAPI_KEY");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
      {/* Header */}
      <header className={cn(
        "sticky top-0 z-20 border-b shadow-sm",
        "bg-white dark:bg-gray-900",
        "border-gray-100 dark:border-gray-800"
      )}>
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-9 w-9 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">Odkrywaj</h1>
              <p className="text-xs text-gray-400 leading-none">
                {active_count > 0
                  ? `${active_count} aktywnych subskrypcji`
                  : "Sprawdź co możesz obejrzeć"}
              </p>
            </div>
          </div>

          {/* Wyszukiwarka */}
          <form onSubmit={handle_submit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => handle_input(e.target.value)}
                placeholder="Szukaj filmu lub serialu..."
                className={cn(
                  "w-full h-10 pl-9 pr-4 rounded-xl border text-sm",
                  "bg-white dark:bg-gray-800",
                  "border-gray-200 dark:border-gray-700",
                  "text-gray-900 dark:text-gray-100",
                  "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                )}
              />
            </div>
            {/* Filtr typu */}
            <select
              value={show_type}
              onChange={(e) => {
                const t = e.target.value as ShowType;
                set_show_type(t);
                if (query.trim().length >= 2) search(query, t);
              }}
              className={cn(
                "h-10 px-2 rounded-xl border text-sm font-medium cursor-pointer",
                "bg-white dark:bg-gray-800",
                "border-gray-200 dark:border-gray-700",
                "text-gray-700 dark:text-gray-300",
                "focus:outline-none focus:ring-2 focus:ring-blue-500"
              )}
            >
              <option value="all">Wszystko</option>
              <option value="movie">Filmy</option>
              <option value="series">Seriale</option>
            </select>
          </form>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-5 space-y-5">

        {/* Brak klucza API – info box */}
        {error?.includes("RAPIDAPI_KEY") && (
          <div className={cn(
            "flex gap-3 p-4 rounded-2xl border",
            "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
          )}>
            <Info className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Wymagany klucz API</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                Dodaj <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">RAPIDAPI_KEY=twój_klucz</code> do
                pliku <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">.env.local</code>, a następnie
                zdobądź darmowy klucz na{" "}
                <a
                  href="https://rapidapi.com/movie-of-the-night-movie-of-the-night-default/api/streaming-availability"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-amber-800 dark:text-amber-300"
                >
                  rapidapi.com
                </a>
                .
              </p>
            </div>
          </div>
        )}

        {/* Trendy – stan początkowy */}
        {!searched && !loading && query.length < 2 && has_api_key && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Popularne wyszukiwania
            </p>
            <div className="flex flex-wrap gap-2">
              {TRENDING_SEARCHES.map((term) => (
                <button
                  key={term}
                  onClick={() => handle_trending(term)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm border transition-colors",
                    "bg-white dark:bg-gray-800",
                    "border-gray-200 dark:border-gray-700",
                    "text-gray-600 dark:text-gray-400",
                    "hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400"
                  )}
                >
                  {term}
                </button>
              ))}
            </div>

            {/* Info o funkcji */}
            <div className={cn(
              "rounded-2xl p-4 border",
              "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800"
            )}>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">
                💡 Jak to działa?
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                Wyszukaj film lub serial – zobaczysz na jakim serwisie
                streamingowym jest dostępny. Zielony badge oznacza, że
                <strong> masz tę subskrypcję</strong> w SubsControl i możesz
                już teraz obejrzeć.
              </p>
            </div>
          </div>
        )}

        {/* Ładowanie */}
        {loading && (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Szukam...</span>
          </div>
        )}

        {/* Błąd inny niż brak klucza */}
        {error && !error.includes("RAPIDAPI_KEY") && (
          <div className="text-center py-10">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* Wyniki */}
        {!loading && results.length > 0 && (
          <>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Znaleziono <strong className="text-gray-700 dark:text-gray-300">{results.length}</strong> wyników dla „{query}"
            </p>
            <div className="grid grid-cols-2 gap-3">
              {results.map((show) => (
                <ShowCard
                  key={show.id}
                  show={show}
                  user_subscriptions={subscriptions}
                />
              ))}
            </div>
          </>
        )}

        {/* Brak wyników */}
        {!loading && searched && results.length === 0 && !error && (
          <div className="text-center py-16">
            <p className="text-3xl mb-3">🎬</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Brak wyników dla „{query}"</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Spróbuj innej nazwy lub zmień typ</p>
          </div>
        )}
      </main>
    </div>
  );
}
