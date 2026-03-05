"use client";

/**
 * Karta wyniku wyszukiwania – film/serial + gdzie dostępny + czy masz subskrypcję
 */
import { ExternalLink, Star, Tv, Film } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Show } from "@/types/streaming";
import { SERVICE_KEY_MAP } from "@/types/streaming";
import type { Subscription } from "@/types";

interface ShowCardProps {
  show: Show;
  user_subscriptions: Subscription[];
}

export function ShowCard({ show, user_subscriptions }: ShowCardProps) {
  const country_services = show.streamingInfo?.pl ?? show.streamingInfo?.us ?? {};
  const service_keys = Object.keys(country_services).filter(
    (k) => country_services[k]?.some((o) => o.type === "subscription")
  );

  const user_service_names = user_subscriptions
    .filter((s) => s.is_active)
    .map((s) => s.name.toLowerCase());

  const poster =
    show.imageSet?.verticalPoster?.w240 ||
    show.imageSet?.verticalPoster?.w360 ||
    show.imageSet?.horizontalPoster?.w360;

  return (
    <div className={cn(
      "bg-white dark:bg-gray-800",
      "border border-gray-100 dark:border-gray-700",
      "rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200",
      "flex flex-col"
    )}>
      {/* Plakat */}
      <div className="relative aspect-[2/3] bg-gray-100 dark:bg-gray-700 overflow-hidden">
        {poster ? (
          <img
            src={poster}
            alt={show.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {show.showType === "movie" ? (
              <Film className="h-12 w-12 text-gray-300 dark:text-gray-600" />
            ) : (
              <Tv className="h-12 w-12 text-gray-300 dark:text-gray-600" />
            )}
          </div>
        )}

        {/* Ocena */}
        {show.rating && (
          <div className="absolute top-2 right-2 bg-black/70 text-yellow-400 text-xs font-bold px-1.5 py-0.5 rounded-lg flex items-center gap-1">
            <Star className="h-3 w-3 fill-yellow-400" />
            {(show.rating / 10).toFixed(1)}
          </div>
        )}

        {/* Typ */}
        <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-lg">
          {show.showType === "movie" ? "Film" : "Serial"}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col gap-2">
        <div>
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 line-clamp-2 leading-tight">
            {show.title}
          </h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {show.releaseYear}
            {show.seasonCount && ` · ${show.seasonCount} sez.`}
            {show.runtime && ` · ${show.runtime} min`}
          </p>
        </div>

        {/* Serwisy streamingowe */}
        {service_keys.length > 0 ? (
          <div className="flex flex-col gap-1.5 mt-auto">
            {service_keys.slice(0, 4).map((key) => {
              const option = country_services[key]?.find((o) => o.type === "subscription");
              const service_name = SERVICE_KEY_MAP[key]?.[0] ?? key;
              const mapped_names = SERVICE_KEY_MAP[key] ?? [key];
              const user_has = mapped_names.some((n) =>
                user_service_names.includes(n.toLowerCase())
              );

              return (
                <a
                  key={key}
                  href={option?.link ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => { if (!option?.link) e.preventDefault(); }}
                  className={cn(
                    "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    user_has
                      ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
                      : "bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600"
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {user_has && <span className="text-green-500">✓</span>}
                    {service_name}
                  </span>
                  <ExternalLink className="h-3 w-3 opacity-60 flex-shrink-0" />
                </a>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-auto italic">
            Brak w streamingu PL
          </p>
        )}
      </div>
    </div>
  );
}
