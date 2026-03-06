# SubsControl – Modul Automatyzacji

Mikroserwis Python (FastAPI + Selenium) do automatycznego pobierania danych rozliczeniowych subskrypcji.  
Uzytkownik loguje sie recznie w oknie przegladarki – aplikacja nigdy nie widzi hasla.

---

## Architektura

```
automation/
├── main.py                        # FastAPI – punkt wejscia
├── config.py                      # Konfiguracja ze zmiennych srodowiskowych
├── requirements.txt               # Zaleznosci Python
├── .env.example                   # Szablon zmiennych srodowiskowych
├── data/                          # Dane runtime (auto-tworzone, NIE commituj)
│   └── audit.log                  # Logi audytu (JSONL)
└── src/
    ├── middleware/
    │   └── auth_middleware.py     # Weryfikacja X-API-Key
    ├── routes/
    │   └── automation_routes.py   # POST /run, GET /status/:id, POST /continue/:id
    ├── scripts/
    │   ├── base_automation.py     # Klasa bazowa (template method)
    │   ├── netflix.py             # Netflix
    │   ├── spotify.py             # Spotify
    │   ├── disney_plus.py         # Disney+
    │   ├── max.py                 # Max (HBO Max) – scraper SPA
    │   └── generic.py             # Fallback dla pozostalych serwisow
    ├── services/
    │   ├── browser_service.py     # Pula ChromeDriver
    │   └── session_service.py     # Rejestr i stan zadan (jobs)
    ├── types/
    │   └── automation_types.py    # Modele Pydantic
    └── utils/
        ├── audit_logger.py        # Logi audytu JSONL
        ├── screenshot_utils.py    # Zrzuty ekranu z Selenium
        └── scrape_helpers.py      # Wspolne funkcje scrapingu (SPA, innerText)
```

---

## Szybki start

### 1. Wymagania
- Python 3.11+
- Google Chrome (najnowszy)
- `chromedriver` instalowany automatycznie przez `webdriver-manager`

### 2. Instalacja

```bash
cd automation
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/macOS

pip install -r requirements.txt
```

### 3. Konfiguracja

```bash
cp .env.example .env
```

Edytuj `.env` – wazne pola:

```env
# Ten sam klucz musi byc w web_app/.env.local jako AUTOMATION_API_KEY
AUTOMATION_API_KEY=twoj-losowy-klucz

# false = Chrome otworzy sie z oknem (wymagane do recznego logowania)
HEADLESS=false

PORT=8001
FRONTEND_URL=http://localhost:3000
```

Oraz w `web_app/.env.local`:

```env
AUTOMATION_API_URL=http://localhost:8001
AUTOMATION_API_KEY=twoj-losowy-klucz   # identyczny jak powyzej
```

### 4. Uruchomienie

```bash
cd automation
python main.py
# Serwer: http://localhost:8001
# Docs:   http://localhost:8001/docs
```

---

## Jak dziala SCRAPE (pobieranie danych)

1. Uzytkownik klika **"Wlacz i pobierz dane"** na karcie subskrypcji
2. Selenium otwiera strone logowania serwisu (np. play.max.com/login)
3. Uzytkownik loguje sie recznie w oknie przegladarki
4. Uzytkownik klika **"Zalogowalem sie – pobierz dane"** w aplikacji
5. Selenium nawiguje do strony konta i scrapuje dane rozliczeniowe
6. Dane (plan, kwota, data) pojawia sie w formularzu do weryfikacji

Aplikacja **nigdy nie widzi** loginu ani hasla uzytkownika.

---

## API REST

Wszystkie endpointy (oprocz `/health`) wymagaja naglowka:
```
X-API-Key: <AUTOMATION_API_KEY>
```

| Metoda | Sciezka | Opis |
|--------|---------|------|
| `POST` | `/api/automation/run` | Uruchom automatyzacje |
| `GET`  | `/api/automation/status/{job_id}` | Pobierz status zadania |
| `POST` | `/api/automation/continue/{job_id}` | Kontynuuj po recznym logowaniu |
| `GET`  | `/api/automation/screenshot/{job_id}` | Podglad ekranu przegladarki |
| `GET`  | `/api/automation/jobs` | Lista aktywnych zadan |
| `GET`  | `/health` | Health check |
