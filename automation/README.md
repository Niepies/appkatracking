# SubsControl – Moduł Automatyzacji

Mikroserwis Python (FastAPI + Selenium) do automatycznego anulowania i wznawiania subskrypcji streamingowych bezpośrednio z panelu SubsControl.

---

## Architektura

```
automation/
├── main.py                        # FastAPI – punkt wejścia
├── config.py                      # Konfiguracja ze zmiennych środowiskowych
├── requirements.txt               # Zależności Python
├── .env.example                   # Szablon zmiennych środowiskowych
├── data/                          # Dane runtime (auto-tworzone, NIE commituj)
│   ├── credentials.enc            # Zaszyfrowane dane logowania (Fernet AES-128)
│   └── audit.log                  # Logi audytu (JSONL)
├── tests/
│   └── test_api.py                # Testy jednostkowe i integracyjne
└── src/
    ├── middleware/
    │   └── auth_middleware.py     # Weryfikacja X-API-Key
    ├── routes/
    │   ├── automation_routes.py   # POST /run, GET /status/:id, POST /continue/:id
    │   └── credential_routes.py   # CRUD zaszyfrowanych danych logowania
    ├── scripts/
    │   ├── base_automation.py     # Klasa bazowa (template method)
    │   ├── netflix.py             # Netflix – pełna automatyzacja
    │   ├── spotify.py             # Spotify – pełna automatyzacja
    │   ├── disney_plus.py         # Disney+ – pełna automatyzacja
    │   └── generic.py             # Fallback – otwiera stronę zarządzania
    ├── services/
    │   ├── credential_service.py  # Zaszyfrowany magazyn danych logowania
    │   ├── browser_service.py     # Pula ChromeDriver (max N sesji)
    │   └── session_service.py     # Rejestr i stan zadań (jobs)
    ├── types/
    │   └── automation_types.py    # Modele Pydantic
    └── utils/
        ├── audit_logger.py        # Logi audytu JSONL
        └── screenshot_utils.py    # Zrzuty ekranu z Selenium
```

---

## Szybki start

### 1. Wymagania
- Python 3.11+
- Google Chrome (najnowszy)
- `chromedriver` – instalowany automatycznie przez `webdriver-manager`

### 2. Instalacja

```bash
cd automation
python -m venv .venv
.venv\Scripts\activate     # Windows
# source .venv/bin/activate  # Linux/macOS

pip install -r requirements.txt
```

### 3. Konfiguracja

```bash
cp .env.example .env
```

Edytuj `.env`:

```env
# Generuj klucz API (min 32 znaki):
AUTOMATION_API_KEY=twoj-losowy-klucz-api

# Generuj klucz szyfrowania Fernet:
# python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ENCRYPTION_KEY=twoj-klucz-fernet

HEADLESS=true
PORT=8001
FRONTEND_URL=http://localhost:3000
```

**WAŻNE**: Ten sam `AUTOMATION_API_KEY` wpisz też w `web_app/.env.local`:

```env
AUTOMATION_API_URL=http://localhost:8001
AUTOMATION_API_KEY=twoj-klucz-api
```

### 4. Uruchomienie

```bash
cd automation
python main.py
# Serwer: http://localhost:8001
# Docs:   http://localhost:8001/docs
```

---

## API REST

Wszystkie endpointy (poza `/health` i `/docs`) wymagają nagłówka:
```
X-API-Key: <AUTOMATION_API_KEY>
```

### Dane logowania

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `POST` | `/api/credentials` | Zaszyfruj i zapisz dane logowania |
| `GET`  | `/api/credentials/{service_key}` | Sprawdź czy dane istnieją |
| `GET`  | `/api/credentials` | Lista serwisów z danymi |
| `DELETE` | `/api/credentials/{service_key}` | Usuń dane logowania |

Przykład – zapis:
```bash
curl -X POST http://localhost:8001/api/credentials \
  -H "X-API-Key: twoj-klucz" \
  -H "Content-Type: application/json" \
  -d '{"service_key":"netflix","email":"twoj@email.com","password":"haslo"}'
```

### Automatyzacja

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `POST` | `/api/automation/run` | Uruchom automatyzację |
| `GET`  | `/api/automation/status/{job_id}` | Pobierz status zadania |
| `POST` | `/api/automation/continue/{job_id}` | Kontynuuj po CAPTCHA/2FA |
| `GET`  | `/api/automation/screenshot/{job_id}` | PNG zrzut ekranu |
| `GET`  | `/api/automation/jobs` | Lista wszystkich zadań |

Przykład – uruchomienie:
```bash
curl -X POST http://localhost:8001/api/automation/run \
  -H "X-API-Key: twoj-klucz" \
  -H "Content-Type: application/json" \
  -d '{"subscription_id":"sub-123","service_key":"netflix","action":"cancel"}'
```

---

## Flow automatyzacji

```
Frontend                    Next.js Proxy              Python Mikroserwis
─────────                   ─────────────              ─────────────────
[Kliknij "Anuluj auto."] → POST /api/automation/run → POST /api/automation/run
                                                      ┌─ uruchom wątek ─┐
                                                      │ 1. Odszyfruj creds │
                                                      │ 2. Otwórz Chrome    │
                                                      │ 3. Zaloguj się      │
                                                      │ 4. Nawiguj          │
                              ← job_id: "abc-123" ←  │ 5. Wykonaj akcję    │
[Polluj status co 2s]    → GET /status/abc-123  →    └────────────────────┘
    ↓ status: running
    ↓ status: waiting_for_user  ←  CAPTCHA wykryta!
        [Pobierz screenshot]
        [Pokaż użytkownikowi]
[Kliknij "Kontynuuj"]   → POST /continue/abc-123 →  [Sygnał wznowienia]
    ↓ status: completed  ←  Sukces!
```

---

## Obsługiwane serwisy

| Serwis | Skrypt | Automatyzacja |
|--------|--------|---------------|
| Netflix | `netflix.py` | Pełna (login + anulowanie/wznowienie) |
| Spotify | `spotify.py` | Pełna (login + anulowanie/wznowienie) |
| Disney+ | `disney_plus.py` | Pełna (login + anulowanie/wznowienie) |
| Pozostałe | `generic.py` | Pomocnicza – otwiera stronę zarządzania |

### Dodanie nowego serwisu

1. Stwórz `src/scripts/moj_serwis.py` dziedzicząc po `BaseAutomation`
2. Zaimplementuj `login()`, `navigate_to_subscription()`, `execute_action()`
3. Zarejestruj w `src/scripts/__init__.py`:
   ```python
   from src.scripts.moj_serwis import MojSerwisAutomation
   AUTOMATION_REGISTRY["mojserwis"] = MojSerwisAutomation
   ```

---

## Bezpieczeństwo

- **Szyfrowanie**: Dane logowania szyfrowane Fernet (AES-128-CBC + HMAC-SHA256)
- **Klucz poza repozytorium**: `ENCRYPTION_KEY` tylko w `.env` (gitignore)
- **Auth API**: Każde żądanie weryfikowane nagłówkiem `X-API-Key`
- **Timing-safe**: Porównanie kluczy stałoczasowe (`secrets.compare_digest`)
- **Brak logowania haseł**: `AuditLogger` pomija pola `password`, `token`, `secret`
- **CORS**: Dozwolony tylko skonfigurowany `FRONTEND_URL`
- **Max sesji**: `MAX_CONCURRENT_SESSIONS` (domyślnie 3)

---

## Testy

```bash
cd automation
pytest tests/ -v
```

---

## Monitorowanie i utrzymanie

### Logi audytu
```bash
cat data/audit.log | python -m json.tool  # czytelny format
```

### Aktualizacja skryptów po zmianach UI
Serwisy streamingowe regularnie zmieniają swoje interfejsy. Gdy automatyzacja przestanie działać:
1. Uruchom Chrome bez trybu headless: `HEADLESS=false` w `.env`
2. Wykonaj ręcznie kroki i zaktualizuj selektory CSS w odpowiednim skrypcie
3. Zgłoś issue z nową strukturą strony

### Zgłaszanie błędów skryptów
Gdy automatyzacja napotka nieznany interfejs, zwraca `status: "failed"` z komunikatem:
```
"Nie znaleziono przycisku anulowania. Wymagana aktualizacja skryptu."
```
To sygnał do ręcznej aktualizacji selektorów CSS w `src/scripts/{serwis}.py`.
