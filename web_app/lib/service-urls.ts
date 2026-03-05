/**
 * Słownik bezpośrednich linków do zarządzania / anulowania subskrypcji.
 *
 * Klucze: znormalizowane nazwy serwisów (lowercase, bez spacji, bez znaków special).
 * Każdy wpis zawiera:
 *   - manage_url  – panel zarządzania subskrypcją
 *   - cancel_url  – bezpośrednia strona anulowania (opcjonalna, jeśli inna niż manage)
 *   - display     – czytelna nazwa serwisu
 */

export interface ServiceUrls {
  display: string;
  manage_url: string;
  cancel_url?: string;
}

// ─── SŁOWNIK ──────────────────────────────────────────────────────────────────
const SERVICE_URL_MAP: Record<string, ServiceUrls> = {

  // ── Streaming wideo ─────────────────────────────────────────────────────────
  netflix: {
    display: "Netflix",
    manage_url: "https://www.netflix.com/account",
    cancel_url: "https://www.netflix.com/cancelplan",
  },
  hbomax: {
    display: "HBO Max",
    manage_url: "https://play.max.com/account/manage-subscriptions",
  },
  max: {
    display: "Max",
    manage_url: "https://play.max.com/account/manage-subscriptions",
  },
  disneyplus: {
    display: "Disney+",
    manage_url: "https://www.disneyplus.com/account/subscription",
    cancel_url: "https://www.disneyplus.com/account/subscription/cancel",
  },
  "disney+": {
    display: "Disney+",
    manage_url: "https://www.disneyplus.com/account/subscription",
    cancel_url: "https://www.disneyplus.com/account/subscription/cancel",
  },
  amazonprime: {
    display: "Amazon Prime",
    manage_url: "https://www.amazon.pl/gp/subs/primeclub/manage/home.html",
    cancel_url: "https://www.amazon.pl/mc/pipelines/cancellation?_encoding=UTF8&deviceType=desktop",
  },
  primevideo: {
    display: "Prime Video",
    manage_url: "https://www.primevideo.com/settings/ref=av_nav_settings",
  },
  appletv: {
    display: "Apple TV+",
    manage_url: "https://appleid.apple.com/account/manage/section/subscriptions",
  },
  "appletv+": {
    display: "Apple TV+",
    manage_url: "https://appleid.apple.com/account/manage/section/subscriptions",
  },
  youtubepremium: {
    display: "YouTube Premium",
    manage_url: "https://www.youtube.com/paid_memberships",
    cancel_url: "https://support.google.com/youtube/answer/6308278",
  },
  canalplus: {
    display: "Canal+",
    manage_url: "https://www.canalplus.com/mon-compte/",
  },
  "canal+": {
    display: "Canal+",
    manage_url: "https://www.canalplus.com/mon-compte/",
  },
  polsatbox: {
    display: "Polsat Box",
    manage_url: "https://www.polsatbox.pl/moje-konto",
  },
  tvn7: {
    display: "Player.pl",
    manage_url: "https://www.player.pl/profil/subskrypcje",
  },
  player: {
    display: "Player.pl",
    manage_url: "https://www.player.pl/profil/subskrypcje",
  },
  viaplay: {
    display: "Viaplay",
    manage_url: "https://viaplay.com/pl-pl/account/subscriptions",
  },
  mubi: {
    display: "MUBI",
    manage_url: "https://mubi.com/account/subscription_plan",
  },
  crunchyroll: {
    display: "Crunchyroll",
    manage_url: "https://www.crunchyroll.com/account/membership",
  },
  paramountplus: {
    display: "Paramount+",
    manage_url: "https://www.paramountplus.com/account/billing/",
  },
  "paramount+": {
    display: "Paramount+",
    manage_url: "https://www.paramountplus.com/account/billing/",
  },
  curiositystream: {
    display: "CuriosityStream",
    manage_url: "https://curiositystream.com/account",
  },

  // ── Muzyka / Audio ───────────────────────────────────────────────────────────
  spotify: {
    display: "Spotify",
    manage_url: "https://www.spotify.com/pl/account/subscription/",
    cancel_url: "https://www.spotify.com/pl/account/subscription/cancel/",
  },
  applemusic: {
    display: "Apple Music",
    manage_url: "https://appleid.apple.com/account/manage/section/subscriptions",
  },
  tidal: {
    display: "Tidal",
    manage_url: "https://listen.tidal.com/account/subscription",
    cancel_url: "https://account.tidal.com/subscription/cancel",
  },
  amazonmusic: {
    display: "Amazon Music",
    manage_url: "https://music.amazon.com/settings",
  },
  youtubemusic: {
    display: "YouTube Music",
    manage_url: "https://music.youtube.com/paid_memberships",
  },
  deezer: {
    display: "Deezer",
    manage_url: "https://www.deezer.com/account/subscription",
  },
  audible: {
    display: "Audible",
    manage_url: "https://www.audible.com/account/flexibilityApp",
  },

  // ── Technologia / SaaS ───────────────────────────────────────────────────────
  chatgpt: {
    display: "ChatGPT Plus",
    manage_url: "https://chatgpt.com/#account/manage-subscription",
  },
  chatgptplus: {
    display: "ChatGPT Plus",
    manage_url: "https://chatgpt.com/#account/manage-subscription",
  },
  openai: {
    display: "OpenAI",
    manage_url: "https://platform.openai.com/account/billing",
  },
  githubcopilot: {
    display: "GitHub Copilot",
    manage_url: "https://github.com/settings/copilot",
    cancel_url: "https://github.com/settings/billing/plans",
  },
  github: {
    display: "GitHub",
    manage_url: "https://github.com/settings/billing/plans",
  },
  adobecc: {
    display: "Adobe Creative Cloud",
    manage_url: "https://account.adobe.com/plans",
    cancel_url: "https://account.adobe.com/plans?q=CANCEL",
  },
  adobe: {
    display: "Adobe",
    manage_url: "https://account.adobe.com/plans",
  },
  microsoft365: {
    display: "Microsoft 365",
    manage_url: "https://account.microsoft.com/services/",
    cancel_url: "https://account.microsoft.com/services/microsoft365/cancel",
  },
  office365: {
    display: "Microsoft 365",
    manage_url: "https://account.microsoft.com/services/",
  },
  microsoft: {
    display: "Microsoft",
    manage_url: "https://account.microsoft.com/services/",
  },
  icloud: {
    display: "iCloud+",
    manage_url: "https://appleid.apple.com/account/manage/section/subscriptions",
  },
  googleone: {
    display: "Google One",
    manage_url: "https://one.google.com/u/0/about",
    cancel_url: "https://support.google.com/googleone/answer/9312519",
  },
  notion: {
    display: "Notion",
    manage_url: "https://www.notion.so/profile/subscription",
  },
  figma: {
    display: "Figma",
    manage_url: "https://www.figma.com/billing",
  },
  dropbox: {
    display: "Dropbox",
    manage_url: "https://www.dropbox.com/account/plan",
    cancel_url: "https://www.dropbox.com/account/plan/cancel",
  },
  onedrive: {
    display: "OneDrive",
    manage_url: "https://account.microsoft.com/services/",
  },
  googledrive: {
    display: "Google Drive",
    manage_url: "https://one.google.com/u/0/about",
  },
  linkedinpremium: {
    display: "LinkedIn Premium",
    manage_url: "https://www.linkedin.com/subscription/manage",
    cancel_url: "https://www.linkedin.com/subscription/manage#ManageSub_CancelAndDowngrade",
  },
  linkedin: {
    display: "LinkedIn Premium",
    manage_url: "https://www.linkedin.com/subscription/manage",
  },
  canva: {
    display: "Canva Pro",
    manage_url: "https://www.canva.com/settings/billing/",
  },
  grammarly: {
    display: "Grammarly",
    manage_url: "https://account.grammarly.com/subscription",
  },
  todoist: {
    display: "Todoist",
    manage_url: "https://todoist.com/prefs/account",
  },
  evernote: {
    display: "Evernote",
    manage_url: "https://www.evernote.com/Billing.action",
  },
  lastpass: {
    display: "LastPass",
    manage_url: "https://lastpass.com/subscribe.php",
  },
  "1password": {
    display: "1Password",
    manage_url: "https://my.1password.com/billing",
  },
  nordvpn: {
    display: "NordVPN",
    manage_url: "https://my.nordaccount.com/subscriptions/",
  },
  expressvpn: {
    display: "ExpressVPN",
    manage_url: "https://subscriptions.expressvpn.com/subscriptions",
  },
  surfshark: {
    display: "Surfshark",
    manage_url: "https://my.surfshark.com/billing",
  },
  protonvpn: {
    display: "Proton VPN",
    manage_url: "https://account.proton.me/u/0/mail/subscription",
  },
  protonmail: {
    display: "Proton Mail",
    manage_url: "https://account.proton.me/u/0/mail/subscription",
  },
  malwarebytes: {
    display: "Malwarebytes",
    manage_url: "https://my.malwarebytes.com/subscriptions",
  },
  bitdefender: {
    display: "Bitdefender",
    manage_url: "https://central.bitdefender.com/my-subscriptions",
  },
  kaspersky: {
    display: "Kaspersky",
    manage_url: "https://my.kaspersky.com/profile/subscriptions",
  },
  nortonantivirus: {
    display: "Norton",
    manage_url: "https://my.norton.com/home/subscriptions",
  },
  slack: {
    display: "Slack",
    manage_url: "https://slack.com/intl/pl-pl/pricing",
  },
  zoom: {
    display: "Zoom",
    manage_url: "https://zoom.us/account/billing/subscription",
  },
  duolingo: {
    display: "Duolingo Plus",
    manage_url: "https://www.duolingo.com/settings/super",
  },

  // ── Gaming ───────────────────────────────────────────────────────────────────
  playstationplus: {
    display: "PlayStation Plus",
    manage_url: "https://store.playstation.com/en-pl/category/subcriptions",
    cancel_url: "https://account.sonyentertainmentnetwork.com/user/subscription",
  },
  psplus: {
    display: "PlayStation Plus",
    manage_url: "https://account.sonyentertainmentnetwork.com/user/subscription",
  },
  xboxgamepass: {
    display: "Xbox Game Pass",
    manage_url: "https://account.microsoft.com/services/",
  },
  xboxgold: {
    display: "Xbox Live Gold",
    manage_url: "https://account.microsoft.com/services/",
  },
  nintendoonline: {
    display: "Nintendo Switch Online",
    manage_url: "https://accounts.nintendo.com/profile/subscription",
  },
  steam: {
    display: "Steam",
    manage_url: "https://store.steampowered.com/account/subscriptions/",
  },
  epicgames: {
    display: "Epic Games",
    manage_url: "https://www.epicgames.com/account/subscriptions",
  },
  geforcenowtv: {
    display: "GeForce Now",
    manage_url: "https://www.nvidia.com/en-us/geforce-now/members-portal/",
  },
  gamepass: {
    display: "Xbox Game Pass",
    manage_url: "https://account.microsoft.com/services/",
  },
  eagames: {
    display: "EA Play",
    manage_url: "https://www.ea.com/ea-play/cancel",
  },
  eaplay: {
    display: "EA Play",
    manage_url: "https://www.ea.com/ea-play/cancel",
  },

  // ── E-booki / Prasa / Wiedza ─────────────────────────────────────────────────
  empikgo: {
    display: "Empik Go",
    manage_url: "https://www.empikgo.pl/konto/subskrypcja",
  },
  empik: {
    display: "Empik Premium",
    manage_url: "https://www.empik.com/premium",
  },
  legimi: {
    display: "Legimi",
    manage_url: "https://www.legimi.com/pl/a/ustawienia",
  },
  storytel: {
    display: "Storytel",
    manage_url: "https://www.storytel.com/pl/pl/account/subscription",
  },
  scribd: {
    display: "Scribd",
    manage_url: "https://www.scribd.com/account-settings/billing",
  },
  kindle: {
    display: "Kindle Unlimited",
    manage_url: "https://www.amazon.pl/kindleunlimited/manage",
  },

  // ── Fitness / Zdrowie ─────────────────────────────────────────────────────────
  calm: {
    display: "Calm",
    manage_url: "https://app.calm.com/account",
    cancel_url: "https://support.calm.com/hc/en-us/articles/115000002251",
  },
  headspace: {
    display: "Headspace",
    manage_url: "https://www.headspace.com/account/subscription",
  },
  noom: {
    display: "Noom",
    manage_url: "https://app.noom.com/my-account",
  },
  whoop: {
    display: "Whoop",
    manage_url: "https://app.whoop.com/membership",
  },
  garmin: {
    display: "Garmin",
    manage_url: "https://connect.garmin.com/premium/",
  },

  // ── Polskie telco / Media ─────────────────────────────────────────────────────
  play: {
    display: "Play",
    manage_url: "https://moje.play.pl/",
  },
  tmobile: {
    display: "T-Mobile",
    manage_url: "https://moja.t-mobile.pl/",
  },
  orange: {
    display: "Orange",
    manage_url: "https://www.orange.pl/konto/",
  },
  plus: {
    display: "Plus",
    manage_url: "https://cyfrowy.plus.pl/",
  },
  nju: {
    display: "nju mobile",
    manage_url: "https://www.njumobile.pl/moje-konto/",
  },
  vectra: {
    display: "Vectra",
    manage_url: "https://vectra.pl/moje-konto",
  },
  upc: {
    display: "UPC (Play)",
    manage_url: "https://www.upc.pl/moje-konto/",
  },
  netia: {
    display: "Netia",
    manage_url: "https://www.netia.pl/pl/klient/moje-uslugi",
  },
  polskifilmonline: {
    display: "Polski Film Online",
    manage_url: "https://polskifilmonline.pl/konto/",
  },
  ipla: {
    display: "Polsat Box Go (Ipla)",
    manage_url: "https://www.polsatboxgo.pl/konto/subskrypcje",
  },
  tvp: {
    display: "TVP VOD",
    manage_url: "https://www.tvp.pl/moje-konto",
  },

  // ── Inne popularne ──────────────────────────────────────────────────────────
  patreon: {
    display: "Patreon",
    manage_url: "https://www.patreon.com/settings/memberships",
  },
  onlyfans: {
    display: "OnlyFans",
    manage_url: "https://onlyfans.com/my/following/subscriptions",
  },
  substack: {
    display: "Substack",
    manage_url: "https://substack.com/account",
  },
  medium: {
    display: "Medium",
    manage_url: "https://medium.com/me/membership",
  },
  setapp: {
    display: "Setapp",
    manage_url: "https://setapp.com/account",
  },
  pocketcasts: {
    display: "Pocket Casts Plus",
    manage_url: "https://www.pocketcasts.com/upgrade/",
  },
  dashlane: {
    display: "Dashlane",
    manage_url: "https://app.dashlane.com/settings/plan",
  },
  expressvpncom: {
    display: "ExpressVPN",
    manage_url: "https://subscriptions.expressvpn.com/subscriptions",
  },
  hulu: {
    display: "Hulu",
    manage_url: "https://secure.hulu.com/account",
    cancel_url: "https://www.hulu.com/account/subscription/cancel",
  },
  peacock: {
    display: "Peacock",
    manage_url: "https://www.peacocktv.com/account/subscriptions",
  },
  twitch: {
    display: "Twitch Turbo",
    manage_url: "https://www.twitch.tv/turbo",
  },
};

// ─── API PUBLICZNE ────────────────────────────────────────────────────────────

/**
 * Normalizuje nazwę serwisu do klucza słownika.
 * Usuwa spacje, myślniki, znaki specjalne, zamienia na lowercase.
 */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9+]/g, "");
}

/**
 * Generuje URL do wyszukiwania Google jako fallback.
 */
function google_fallback(name: string): string {
  const query = encodeURIComponent(`jak anulować lub zarządzać subskrypcją ${name}`);
  return `https://www.google.com/search?q=${query}`;
}

export interface ResolvedServiceUrl {
  manage_url: string;
  cancel_url: string;
  /** true = bezpośredni link z bazy; false = fallback na wyszukiwarkę */
  is_direct: boolean;
  display: string;
}

/**
 * Zwraca najlepsze URL-e dla danej nazwy serwisu.
 * Najpierw szuka dokładnej nazwy, potem normalizuje i sprawdza prefiks.
 * Fallback: Google Search.
 */
export function get_service_urls(service_name: string): ResolvedServiceUrl {
  const key = normalize(service_name);

  // 1. Dokładne dopasowanie
  if (SERVICE_URL_MAP[key]) {
    const entry = SERVICE_URL_MAP[key];
    return {
      manage_url: entry.manage_url,
      cancel_url: entry.cancel_url ?? entry.manage_url,
      is_direct: true,
      display: entry.display,
    };
  }

  // 2. Dopasowanie częściowe – znajdź klucz, który zawiera fragment nazwy lub jest jej fragmentem
  for (const [dict_key, entry] of Object.entries(SERVICE_URL_MAP)) {
    if (key.includes(dict_key) || dict_key.includes(key)) {
      return {
        manage_url: entry.manage_url,
        cancel_url: entry.cancel_url ?? entry.manage_url,
        is_direct: true,
        display: entry.display,
      };
    }
  }

  // 3. Fallback – Google Search
  return {
    manage_url: google_fallback(service_name),
    cancel_url: google_fallback(service_name),
    is_direct: false,
    display: service_name,
  };
}
