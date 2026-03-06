# SubsControl – Instrukcja użytkownika i dokumentacja techniczna

> Aplikacja uruchomiona pod adresem: **http://localhost:3000**

---

## Spis treści

1. [Dla użytkownika – jak działa aplikacja](#1-dla-użytkownika--jak-działa-aplikacja)
2. [Widoki i funkcje](#2-widoki-i-funkcje)
3. [Dla deweloperów – architektura techniczna](#3-dla-deweloperów--architektura-techniczna)
4. [Uruchomienie projektu](#4-uruchomienie-projektu)
5. [Struktura katalogów](#5-struktura-katalogów)
6. [Dane i persystencja](#6-dane-i-persystencja)
7. [API Routes](#7-api-routes)
8. [Store – Zustand](#8-store--zustand)
9. [Walidacja formularzy – Zod](#9-walidacja-formularzy--zod)
10. [Moduł automatyzacji – Python](#10-moduł-automatyzacji--python)
11. [Testy](#11-testy)

---

## 1. Dla użytkownika – jak działa aplikacja

**SubsControl** to narzędzie do zarządzania wszystkimi Twoimi subskrypcjami w jednym miejscu (Netflix, Spotify, Disney+, itp.).

### Co możesz zrobić:

- **Dodaj subskrypcję** – podaj nazwę, kwotę, walutę, cykl płatności (miesięczny/roczny), kategorię i datę następnej płatności.
- **Śledź płatności** – aplikacja automatycznie liczy kiedy nastąpi kolejna płatność i wyświetla countdown.
- **Oznaczaj jako zapłacone** – po opłaceniu subskrypcji kliknij „Zapłacono" – system odnotuje płatność i przesunie termin o kolejny cykl.
- **Zarządzaj budżetem** – ustaw miesięczny limit wydatków na subskrypcje.
- **Przeglądaj statystyki** – wykresy wydatków, porównanie miesięcy, rozkład według kategorii.
- **Odkrywaj treści** – wyszukaj film/serial i sprawdź, na jakim serwisie możesz go obejrzeć.
- **Powiadomienia** – automatyczne alerty o zbliżających się płatnościach (7 dni, 3 dni, po terminie).
- **Okres próbny (trial)** – zaznacz, że subskrypcja jest na trialu – aplikacja pokaże kiedy trial się kończy.
- **Ciemny motyw** – przełącz między jasnym i ciemnym trybem.
- **Niezależność od konta** – dane zapisywane lokalnie w przeglądarce, bez rejestracji.

---

## 2. Widoki i funkcje

### Dashboard (`/`) – Strona główna
- Lista wszystkich subskrypcji z kartami (nazwa, kwota, waluta, data płatności, dni do płatności).
- Sekcja podsumowania: łączny koszt miesięczny i roczny, liczba aktywnych subskrypcji.
- Pasek budżetu – ile z ustawionego limitu zostało wydane.
- Filtrowanie i sortowanie subskrypcji.
- Przycisk „Dodaj subskrypcję" – otwiera formularz modalny.
- Kliknięcie karty otwiera szczegóły subskrypcji: historia płatności, linki do zarządzania/anulowania w serwisie.

### Stats (`/stats`) – Statystyki
- Wykres wydatków w czasie (Recharts).
- Rozkład według kategorii (Rozrywka, Technologia, Media/Dom, Zdrowie, Jedzenie, Inne).
- Porównanie miesięcy, sumy roczne.
- Historia 200 ostatnich płatności.

### Browse (`/browse`) – Odkrywaj
- Wyszukiwarka filmów i seriali.
- Sprawdza dostępność na serwisach streamingowych powiązanych z Twoimi subskrypcjami.

---

## 3. Dla deweloperów – architektura techniczna

### Stack technologiczny

| Warstwa | Technologia | Wersja |
|---|---|---|
| Framework | Next.js | 16.1.6 |
| Język | TypeScript | 5.x |
| Style | Tailwind CSS | 4.x |
| Komponenty UI | Radix UI | najnowsza |
| State management | Zustand | 5.x |
| Walidacja | Zod | 4.x |
| Formularze | React Hook Form | 7.x |
| Toasty/Notyfikacje | Sonner | 2.x |
| Wykresy | Recharts | 3.x |
| Daty | date-fns | 4.x |
| Ikony | Lucide React | najnowsza |
| Testy | Vitest + Testing Library | 4.x |

### Konwencje kodu

- **Nazewnictwo**: `snake_case` dla funkcji, hooków, zmiennych (np. `use_automation`, `save_subscriptions`)
- **Komponenty**: `PascalCase` (np. `DashboardClient`, `SubscriptionCard`)
- **Pliki**: `kebab-case` (np. `subscription-store.ts`, `browse-client.tsx`)
- **"use client"** – dodawane tylko tam, gdzie faktycznie potrzebne (interaktywność, hooki)
- **SSR-safe** – store hydratowany ręcznie przez `StoreHydration` (unika niezgodności SSR/CSR)

---

## 4. Uruchomienie projektu

### Web App (Next.js)
```bash
cd web_app
npm install
npm run dev        # http://localhost:3000
npm run build      # build produkcyjny
npm run start      # uruchom build produkcyjny
npm run test       # testy jednostkowe (Vitest)
npm run test:watch # testy w trybie watch
```

### Backend (Node.js/Express)
```bash
cd backend
npm install
npm start          # http://localhost:3001 (domyślnie)
```

### Moduł automatyzacji (Python)
```bash
cd automation
pip install -r requirements.txt
python main.py     # uruchamia mikroserwis automatyzacji
```

### Aplikacja mobilna (Expo)
```bash
cd mobile_app
npm install
npx expo start        # uruchamia Expo Dev Server
npx expo start --android
npx expo start --ios
```

---

## 5. Struktura katalogów

```
web_app/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Strona główna → DashboardClient
│   ├── layout.tsx          # Root layout (ThemeProvider, StoreHydration, BottomNav, Toaster)
│   ├── globals.css         # Style globalne (Tailwind v4)
│   ├── browse/page.tsx     # Strona odkrywania treści
│   ├── stats/page.tsx      # Strona statystyk
│   └── api/                # API Routes (Next.js)
│       ├── automation/     # Proxy do mikroserwisu Python
│       ├── credentials/    # Zarządzanie danymi logowania
│       └── streaming/      # Dane o serwisach streamingowych
├── components/
│   ├── dashboard/          # Dashboard, DashboardClient, SummarySection
│   ├── subscription/       # SubscriptionCard, SubscriptionForm, SubscriptionDetailModal
│   ├── browse/             # BrowseClient, ShowCard
│   ├── stats/              # StatsClientWrapper, StatsClient
│   ├── automation/         # AutomationButton, AutomationModal
│   ├── ui/                 # Komponenty UI (Button, Input, BottomNav, itp.)
│   ├── store-hydration.tsx # Hydratacja store z localStorage
│   └── theme-provider.tsx  # Dark/light mode
├── store/
│   └── subscription-store.ts  # Zustand store + persystencja localStorage
├── hooks/
│   ├── use-upcoming-notifications.ts  # Powiadomienia Sonner
│   ├── use-automation.ts              # Integracja z Python mikroserwisem
│   └── use-credential-check.ts        # Sprawdzanie zapisanych danych logowania
├── lib/
│   ├── utils.ts            # Funkcje pomocnicze (daty, sumy, formaty)
│   ├── validators.ts       # Schematy Zod
│   └── service-urls.ts     # Słownik URL-i serwisów (Netflix, Spotify, itp.)
├── types/
│   ├── index.ts            # Typy główne (Subscription, BillingCycle, itp.)
│   ├── automation.ts       # Typy automatyzacji
│   └── streaming.ts        # Typy danych streamingowych
└── tests/                  # Testy jednostkowe
    ├── components/
    ├── hooks/
    ├── lib/
    └── store/
```

---

## 6. Dane i persystencja

Aplikacja używa wyłącznie **localStorage** przeglądarki – brak backendu dla danych użytkownika, brak rejestracji.

| Klucz localStorage | Zawartość |
|---|---|
| `subscontrol-subscriptions` | Tablica obiektów `Subscription[]` (JSON) |
| `subscontrol-payment-history` | Tablica `PaymentHistoryEntry[]` (max 200 wpisów) |
| `subscontrol-budget` | Miesięczny budżet użytkownika (liczba) |

### Model danych – `Subscription`

```typescript
interface Subscription {
  id: string;
  name: string;
  amount: number;              // Kwota bazowa cyklu
  currency: Currency;          // PLN | USD | EUR | GBP | CHF | ...
  payment_cycle: "monthly" | "yearly";
  category: SubscriptionCategory;
  is_active: boolean;
  billing_cycles: BillingCycle[];  // Historia i przyszłe cykle
  created_at: string;          // ISO timestamp
  logo_url?: string;
  description?: string;
  color?: string;
}
```

### Model danych – `BillingCycle`

```typescript
interface BillingCycle {
  id: string;
  subscription_id: string;
  period_start: string;             // "YYYY-MM-DD"
  period_end: string;               // "YYYY-MM-DD"
  scheduled_payment_date: string;   // "YYYY-MM-DD"
  status: "pending" | "paid" | "failed" | "cancelled";
  paid_at?: string;                 // ISO timestamp (gdy paid)
  amount_charged: number;
  is_trial: boolean;
  is_final_after_cancel: boolean;
}
```

### Migracja danych

Store zawiera funkcję `migrate_subscription()` – automatycznie aktualizuje stare dane z localStorage (bez `billing_cycles`) do nowego formatu przy ładowaniu.

---

## 7. API Routes

Wszystkie endpointy w `web_app/app/api/` są proxy do mikroserwisu Python lub do zewnętrznych API.

### Automatyzacja (`/api/automation/`)

| Metoda | Endpoint | Opis |
|---|---|---|
| GET | `/api/automation/jobs` | Sprawdza dostępność mikroserwisu |
| POST | `/api/automation/run` | Uruchamia job automatyzacji |
| GET | `/api/automation/status/:job_id` | Pobiera status joba |
| POST | `/api/automation/continue` | Kontynuacja po CAPTCHA/2FA |

### Dane logowania (`/api/credentials/`)

| Metoda | Endpoint | Opis |
|---|---|---|
| GET | `/api/credentials` | Lista zapisanych danych logowania |
| POST | `/api/credentials` | Zapis danych logowania |
| DELETE | `/api/credentials/:id` | Usunięcie danych logowania |

### Streaming (`/api/streaming/`)

| Metoda | Endpoint | Opis |
|---|---|---|
| GET | `/api/streaming/search` | Wyszukiwanie filmów/seriali |
| GET | `/api/streaming/availability` | Dostępność tytułu na serwisach |

---

## 8. Store – Zustand

Plik: `web_app/store/subscription-store.ts`

### Dlaczego brak middleware `persist`?

Standardowy `persist` middleware Zustand powoduje błąd „Rules of Hooks" przy SSR (Next.js). Persystencja jest obsługiwana **ręcznie**:
- `StoreHydration` komponent (renderowany w `layout.tsx`) wczytuje dane z localStorage po stronie klienta po pierwszym renderze.
- Każda akcja store (dodaj, edytuj, usuń, zapłać) wywołuje `save_subscriptions()` / `save_history()`.

### Główne akcje store:

```typescript
// Dodanie nowej subskrypcji
add_subscription(data: SubscriptionFormData): void

// Edycja istniejącej
edit_subscription(id: string, data: SubscriptionFormData): void

// Usunięcie
delete_subscription(id: string): void

// Oznaczenie cyklu jako zapłaconego (przesuwa termin o kolejny cykl)
mark_as_paid(subscription_id: string, cycle_id: string): void

// Przełączanie aktywności (anuluj/reaktywuj)
toggle_subscription(id: string): void

// Ustawienie budżetu
set_budget(amount: number): void
```

---

## 9. Walidacja formularzy – Zod

Plik: `web_app/lib/validators.ts`

Formularz subskrypcji walidowany przez `subscription_schema`:

- `name` – wymagane, max 100 znaków
- `amount` – liczba > 0, max 100 000
- `currency` – jedna z 12 obsługiwanych walut (PLN, USD, EUR, GBP, CHF, CZK, NOK, SEK, DKK, JPY, CAD, AUD)
- `payment_cycle` – `"monthly"` lub `"yearly"`
- `next_payment_date` – wymagana, poprawny format daty
- `category` – jedna z 6 kategorii
- `description` – opcjonalny, max 250 znaków
- `has_trial` + `trial_end_date` – jeśli trial = true, data końca jest wymagana i musi być późniejsza od daty startu

---

## 10. Moduł automatyzacji – Python

### Cel

Mikroserwis Python (`automation/`) automatyzuje interakcje z zewnętrznymi serwisami streamingowymi (logowanie, pobieranie statusu) za pomocą automatyzacji przeglądarki (Playwright/Selenium).

### Obsługiwane serwisy

- Netflix
- Spotify
- Disney+
- Generic (dowolny serwis przez skrypt bazowy)

### Architektura (Python)

```
automation/
├── main.py                      # Punkt wejścia – uruchamia serwer API
├── config.py                    # Konfiguracja (porty, timeouty, sekrety)
├── src/
│   ├── routes/
│   │   ├── automation_routes.py # Endpointy: run, status, continue
│   │   └── credential_routes.py # Endpointy: credentials CRUD
│   ├── services/
│   │   ├── browser_service.py   # Zarządzanie przeglądarką (Playwright)
│   │   ├── credential_service.py# Szyfrowanie i zapis danych logowania
│   │   └── session_service.py   # Zarządzanie sesjami jobów
│   ├── scripts/
│   │   ├── base_automation.py   # Klasa bazowa dla skryptów automatyzacji
│   │   ├── netflix.py           # Skrypt Netflix
│   │   ├── spotify.py           # Skrypt Spotify
│   │   ├── disney_plus.py       # Skrypt Disney+
│   │   └── generic.py           # Skrypt generyczny
│   ├── middleware/
│   │   └── auth_middleware.py   # Autoryzacja requestów
│   └── utils/
│       ├── audit_logger.py      # Logowanie zdarzeń
│       └── screenshot_utils.py  # Zrzuty ekranu do debugowania
```

### Cykl życia joba automatyzacji

1. Frontend wywołuje `POST /api/automation/run` z: ID subskrypcji, kluczem serwisu, akcją, loginem i hasłem.
2. Mikroserwis tworzy job, zwraca `job_id`.
3. Frontend polluje `GET /api/automation/status/:job_id` co 2 sekundy.
4. Jeśli serwis żąda CAPTCHA/2FA → status zmienia się na `WAITING_FOR_USER`, frontend wyświetla screenshot.
5. Użytkownik wykonuje akcję w przeglądarce, frontend wywołuje `POST /api/automation/continue`.
6. Job kończy się statusem `COMPLETED` lub `FAILED`.

---

## 11. Testy

### Uruchomienie

```bash
cd web_app
npm run test            # jednorazowy run
npm run test:watch      # tryb watch
npm run test:coverage   # z raportem pokrycia
```

### Framework: Vitest + Testing Library

Testy zlokalizowane w `web_app/tests/`:
- `tests/components/` – testy komponentów React
- `tests/hooks/` – testy hooków
- `tests/lib/` – testy funkcji pomocniczych (utils, validators)
- `tests/store/` – testy logiki store Zustand

### Konfiguracja: `vitest.config.ts` + `tests/setup.ts`

---

## Powiadomienia – logika

Hook `use_upcoming_notifications` (Sonner) wyświetla toasty przy ładowaniu aplikacji:

| Tier | Warunek | Typ toastu |
|---|---|---|
| Error | Płatność po terminie | `toast.error` (czerwony) |
| Warning | Płatność w ≤3 dni | `toast.warning` (żółty) |
| Info | Płatność w 4–7 dni | `toast.info` (niebieski) |
| Warning | Trial kończy się w ≤2 dni | `toast.warning` |
| Info | Subskrypcja nieaktywna ≥30 dni | `toast.info` |
| Info | Raport kwartalny (1. dzień kwartału) | `toast.info` |

---

## Słownik linków serwisów

Plik `web_app/lib/service-urls.ts` zawiera słownik URL-i do zarządzania i anulowania subskrypcji dla dziesiątek serwisów (Netflix, HBO Max, Disney+, Amazon Prime, Apple TV+, Spotify, YouTube Premium, itp.). Linki wyświetlane są w szczegółach subskrypcji, dzięki czemu użytkownik może jednym kliknięciem przejść do panelu zarządzania danym serwisem.
