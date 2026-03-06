# SubsControl 📺💰

Aplikacja webowa do zarządzania subskrypcjami (Netflix, Spotify, HBO, prąd, internet i inne).

## Funkcje

- ✅ Dodawanie / edycja / usuwanie subskrypcji
- ✅ Dashboard z listą subskrypcji posortowaną wg daty płatności
- ✅ Automatyczne przesuwanie daty po oznaczeniu jako opłaconej
- ✅ Powiadomienia (toast) o zbliżających się płatnościach (≤3 dni)
- ✅ Włączanie / wyłączanie subskrypcji
- ✅ Podsumowanie kosztów miesięcznych i rocznych
- ✅ Wyszukiwanie i filtrowanie subskrypcji
- ✅ Szybki wybór popularnych serwisów (Netflix, Spotify, HBO...)
- ✅ Persystencja danych w localStorage
- ✅ Responsywny design (mobile-first)

## Stos technologiczny

| Warstwa | Technologia |
|---------|-------------|
| Frontend | Next.js 16 (App Router), TypeScript |
| Stylowanie | Tailwind CSS v4 |
| Komponenty | Radix UI (Dialogi, Select, Label...) |
| Stan globalny | Zustand (z persystencją localStorage) |
| Formularze | React Hook Form + Zod (walidacja) |
| Powiadomienia | Sonner (toasty) |
| Ikony | Lucide React |
| Daty | date-fns (z lokalizacją polską) |

## Uruchomienie

```bash
# 1. Przejdź do katalogu web_app
cd web_app

# 2. Zainstaluj zależności
npm install

# 3. Skonfiguruj zmienne środowiskowe
cp .env.example .env.local
# Edytuj .env.local – uzupełnij AUTOMATION_API_KEY (musi być identyczny jak w automation/.env)

# 4. Uruchom serwer deweloperski
npm run dev

# Aplikacja dostępna pod: http://localhost:3000
```

> **Funkcja automatycznego pobierania danych** wymaga uruchomionego mikroserwisu Python.  
> Instrukcja: [automation/README.md](../automation/README.md)

## Struktura projektu

```
web_app/
├── app/
│   ├── layout.tsx              # Layout z Sonner i fontem Inter
│   ├── page.tsx                # Główna strona → Dashboard
│   └── globals.css             # Style globalne + Tailwind
├── components/
│   ├── dashboard/
│   │   ├── dashboard.tsx              # Główny dashboard
│   │   └── summary-section.tsx        # Podsumowanie kosztów
│   ├── subscription/
│   │   ├── subscription-card.tsx         # Karta subskrypcji
│   │   ├── subscription-detail-modal.tsx # Modal szczegółów
│   │   └── subscription-form.tsx         # Formularz
│   └── ui/                     # Komponenty bazowe UI
├── store/
│   └── subscription-store.ts   # Zustand store
├── hooks/
│   └── use-upcoming-notifications.ts
├── lib/
│   ├── utils.ts                # Funkcje pomocnicze
│   └── validators.ts           # Schematy Zod
└── types/
    └── index.ts                # Typy TypeScript
```

## Bezpieczeństwo

- Dane przechowywane **lokalnie** w `localStorage`
- Brak transmisji danych na zewnętrzne serwery
- Docelowo: backend z JWT, PostgreSQL i szyfrowaniem

## Status Faza 2 – Retencja użytkowników

| # | Feature | Status |
|---|---------|--------|
| 5 | Konto użytkownika + cloud sync | 🔜 Wymaga backendu (PostgreSQL + JWT) |
| 6 | Smart powiadomienia | ✅ Zaimplementowane (7-dniowe, 3-dniowe, brak aktywności, raport kwartalny) |
| 7 | Historia płatności + wykresy | ✅ Zaimplementowane (Recharts, 12 miesięcy) |
| 8 | Współdzielone subskrypcje (Family plan) | 🔜 Wymaga backendu |
| 9 | Free trial tracker + przypomnienia | ✅ Zaimplementowane (badge, 2-dniowe ostrzeżenie) |

## Roadmap – Faza 3 (Automatyzacja)

- [ ] PWA + Service Worker push notifications
- [ ] Import subskrypcji z e-mail (Gmail API)
- [ ] Automatyczne wykrywanie subskrypcji z wyciągu bankowego
- [ ] Integracja z API banków (Open Banking PSD2)
- [ ] AI asystent – rekomendacje co wyłączyć / zamienić na tańszy plan
- [ ] Widget mobilny (React Native / Expo)

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
