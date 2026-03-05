// Typy odpowiedzi Streaming Availability API

export interface StreamingOption {
  type: "subscription" | "rent" | "buy" | "free";
  quality?: string;
  addOn?: string;
  link: string;
  audios?: { language: string }[];
  subtitles?: { locale: { language: string } }[];
  price?: { amount: string; currency: string };
  expiresSoon?: boolean;
  expiresOn?: number;
}

export interface StreamingInfo {
  [country: string]: {
    [service: string]: StreamingOption[];
  };
}

export interface ShowImageSet {
  verticalPoster?: { w240?: string; w360?: string; w480?: string };
  horizontalPoster?: { w360?: string; w480?: string; w720?: string };
  verticalBackdrop?: { w240?: string; w360?: string };
}

export interface Show {
  itemType: "show";
  showType: "movie" | "series";
  id: string;
  imdbId?: string;
  tmdbId?: string;
  title: string;
  overview?: string;
  releaseYear?: number;
  originalTitle?: string;
  genres?: { id: string; name: string }[];
  rating?: number;
  runtime?: number;       // minuty (filmy)
  seasonCount?: number;   // odcinki (seriale)
  episodeCount?: number;
  imageSet?: ShowImageSet;
  streamingInfo: StreamingInfo;
}

/**
 * Mapowanie kluczy API → nazw serwisów w SubsControl
 */
export const SERVICE_KEY_MAP: Record<string, string[]> = {
  netflix: ["Netflix"],
  hbo: ["HBO Max", "HBO Max GO"],
  prime: ["Amazon Prime", "Amazon Prime Video"],
  disney: ["Disney+"],
  apple: ["Apple TV+"],
  youtube: ["YouTube Premium"],
  canal: ["Canal+"],
  polsat: ["Polsat Box"],
  tidal: ["Tidal"],
  mubi: ["Mubi"],
  paramount: ["Paramount+"],
  crunchyroll: ["Crunchyroll"],
  max: ["HBO Max", "Max"],
};
