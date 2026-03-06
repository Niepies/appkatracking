#!/usr/bin/env python
"""
Narzędzie do interaktywnego znajdowania selektorów CSS na stronach subskrypcji.

Uruchom:
    python selector_inspector.py netflix
    python selector_inspector.py spotify
    python selector_inspector.py disney+
    python selector_inspector.py max

Co robi:
  1. Otwiera widoczną przeglądarkę (non-headless) z Chrome Remote Debugging.
  2. Wstrzykuje nakładkę – najedź myszką na element, zobaczysz unikalny selektor.
     Kliknij element → selektor skopiowany do schowka + zalogowany w konsoli.
  3. Po naciśnięciu ENTER automatycznie skanuje stronę i drukuje kandydatów
     na selektory elementów związanych z billing (data, kwota, plan).
  4. Zapisuje raport do data/selectors_<serwis>.json.

Chrome DevTools: http://localhost:9222  (podczas działania narzędzia)
"""

import json
import sys
import time
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager


# ──────────────────────────────────────────────────────────────────────────────
# Konfiguracja URL-i dla każdego serwisu
# ──────────────────────────────────────────────────────────────────────────────
SERVICE_URLS = {
    "netflix": {
        "login":  "https://www.netflix.com/login",
        "manage": "https://www.netflix.com/account",
    },
    "spotify": {
        "login":  "https://accounts.spotify.com/pl/login",
        "manage": "https://www.spotify.com/pl/account/subscription/",
    },
    "disney+": {
        "login":  "https://www.disneyplus.com/login",
        "manage": "https://www.disneyplus.com/account/subscription",
    },
    "max": {
        "login":  "https://play.max.com/login",
        "manage": "https://play.max.com/settings",
    },
    "amazon": {
        "login":  "https://www.amazon.pl",
        "manage": "https://www.amazon.pl/gp/video/settings/ref=atv_nb_sot_settings",
    },
    "youtube": {
        "login":  "https://accounts.google.com/ServiceLogin",
        "manage": "https://www.youtube.com/paid_memberships",
    },
}

# ──────────────────────────────────────────────────────────────────────────────
# JavaScript – interaktywna nakładka inspektora
# ──────────────────────────────────────────────────────────────────────────────
_INSPECTOR_JS = """
(function() {
    // Usuń poprzednią instancję
    var old = document.getElementById('__subs_inspector__');
    if (old) old.remove();

    // Buduje optymalny, jednoznaczny selektor CSS dla elementu
    function buildSelector(el) {
        if (!el || el.nodeType !== 1) return '';

        // 1. id
        if (el.id && el.id.trim()) {
            return '#' + CSS.escape(el.id.trim());
        }

        // 2. data-testid / data-uia / data-encore-id (specyficzne dla serwisu)
        var dataAttrs = ['data-testid', 'data-uia', 'data-encore-id', 'data-tracking-id'];
        for (var a of dataAttrs) {
            var v = el.getAttribute(a);
            if (v && v.trim()) {
                var sel = '[' + a + '="' + v.trim() + '"]';
                // Sprawdź unikalność
                if (document.querySelectorAll(sel).length === 1) return sel;
            }
        }

        // 3. Pełna ścieżka CSS aż do elementu z id/testid lub body
        var parts = [];
        var cur = el;
        while (cur && cur.tagName && cur.tagName !== 'BODY' && cur.tagName !== 'HTML') {
            var part = cur.tagName.toLowerCase();

            if (cur.id && cur.id.trim()) {
                parts.unshift('#' + CSS.escape(cur.id.trim()));
                break;
            }

            // data-testid na ancestors
            for (var a2 of dataAttrs) {
                var v2 = cur.getAttribute(a2);
                if (v2 && v2.trim()) {
                    part = '[' + a2 + '="' + v2.trim() + '"]';
                    parts.unshift(part);
                    cur = null;
                    break;
                }
            }
            if (cur === null) break;

            // nth-of-type dla disambiguation
            var siblings = cur.parentElement
                ? Array.from(cur.parentElement.children).filter(c => c.tagName === cur.tagName)
                : [];
            if (siblings.length > 1) {
                part += ':nth-of-type(' + (siblings.indexOf(cur) + 1) + ')';
            }

            // Pierwsze 2 klasy (wyglądające jak stabilne nazwy, nie hash)
            var stableClasses = Array.from(cur.classList)
                .filter(c => c.length > 2 && c.length < 60 && !/^[a-z0-9]{8,}$/.test(c))
                .slice(0, 2);
            if (stableClasses.length) {
                part += '.' + stableClasses.join('.');
            }

            parts.unshift(part);
            cur = cur.parentElement;
        }
        return parts.join(' > ');
    }

    // Nakładka z selektorem
    var overlay = document.createElement('div');
    overlay.id = '__subs_inspector__';
    overlay.style.cssText = [
        'position:fixed',
        'bottom:0',
        'left:0',
        'right:0',
        'background:rgba(0,20,0,0.92)',
        'color:#00ff88',
        'font:13px/1.5 "Courier New",monospace',
        'padding:10px 16px',
        'z-index:2147483647',
        'pointer-events:none',
        'border-top:2px solid #00ff88',
        'white-space:pre-wrap',
        'word-break:break-all',
        'max-height:120px',
        'overflow:hidden',
    ].join(';');
    document.body.appendChild(overlay);

    function updateOverlay(el) {
        var sel  = buildSelector(el);
        var txt  = (el.textContent || '').trim().substring(0, 120);
        var tag  = el.tagName.toLowerCase();
        var rect = el.getBoundingClientRect();
        overlay.textContent = (
            'TAG: ' + tag + '  |  SIZE: ' + Math.round(rect.width) + 'x' + Math.round(rect.height) + '\\n' +
            'SEL: ' + sel + '\\n' +
            'TXT: ' + txt
        );
        // Podświetl element
        el.style.outline = '2px solid #00ff88';
        el.style.outlineOffset = '1px';
    }

    var lastEl = null;
    document.addEventListener('mouseover', function(e) {
        if (lastEl) { lastEl.style.outline = ''; lastEl.style.outlineOffset = ''; }
        lastEl = e.target;
        updateOverlay(e.target);
    }, true);

    document.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var sel = buildSelector(e.target);
        var txt = (e.target.textContent || '').trim().substring(0, 100);
        // Kopia do schowka
        try { navigator.clipboard.writeText(sel); } catch(_) {}
        // Log do konsoli
        console.log('[SUBS_INSPECTOR] KLIK:', sel, '|', txt);
        // Flash overlay
        overlay.style.background = 'rgba(0,80,0,0.95)';
        setTimeout(function(){ overlay.style.background = 'rgba(0,20,0,0.92)'; }, 400);
    }, true);

    console.log('[SUBS_INSPECTOR] Inspektor aktywny. Najedź myszką → zobaczysz selektor. Kliknij → skopiuj.');
    return 'OK';
})();
"""

# ──────────────────────────────────────────────────────────────────────────────
# JavaScript – automatyczny skan kandydatów billing
# ──────────────────────────────────────────────────────────────────────────────
_COLLECT_JS = """
(function() {
    var BILLING_KW = [
        'plan', 'premium', 'standard', 'basic', 'subscription', 'subskrypcj',
        'price', 'cen', 'kwota', 'amount', 'cost', 'opłat',
        'billing', 'rachun', 'płatn', 'payment',
        'renewal', 'odnow', 'next', 'nastep',
        'date', 'dat', 'period', 'cykl', 'monthly', 'miesięcz',
        'invoice', 'faktura',
    ];

    var DATE_RE  = /\\b(\\d{1,2}[.\\/-]\\d{1,2}[.\\/-]20\\d{2}|20\\d{2}-\\d{2}-\\d{2}|\\d{1,2}\\s+\\w+\\s+20\\d{2}|\\w+\\s+\\d{1,2},?\\s+20\\d{2})\\b/i;
    var PRICE_RE = /\\b(\\d+[,.]\\d{2})\\s*(zł|PLN|USD|EUR|GBP|\\$|€|£)/i;

    function buildSelector(el) {
        if (el.id && el.id.trim()) return '#' + el.id.trim();
        var dataAttrs = ['data-testid', 'data-uia', 'data-encore-id'];
        for (var a of dataAttrs) {
            var v = el.getAttribute(a);
            if (v && v.trim()) {
                var s = '[' + a + '="' + v.trim() + '"]';
                if (document.querySelectorAll(s).length === 1) return s;
                return s;
            }
        }
        // Klasy stabilne (nie hashowe)
        var cls = Array.from(el.classList)
            .filter(c => c.length > 2 && c.length < 60 && !/^[a-z0-9]{8,}$/.test(c))
            .slice(0, 3);
        var tag = el.tagName.toLowerCase();
        return tag + (cls.length ? '.' + cls.join('.') : '');
    }

    var results = [];
    var seen = new Set();

    document.querySelectorAll('*').forEach(function(el) {
        // Pomiń kontenery z dziećmi – interesują nas liście DOM
        if (el.children.length > 0) return;

        var txt = (el.textContent || '').trim();
        if (!txt || txt.length > 300 || txt.length < 2) return;

        var key = el.getAttribute('data-testid') || el.getAttribute('data-uia') || '';
        var cls = (el.className && typeof el.className === 'string') ? el.className : '';
        var combined = (txt + ' ' + key + ' ' + cls + ' ' + el.id).toLowerCase();

        var score = 0;
        BILLING_KW.forEach(function(kw) { if (combined.includes(kw)) score++; });

        var isDate  = DATE_RE.test(txt);
        var isPrice = PRICE_RE.test(txt);
        if (isDate)  score += 5;
        if (isPrice) score += 5;

        if (score < 1) return;

        var sel = buildSelector(el);
        if (seen.has(sel + txt)) return;
        seen.add(sel + txt);

        var rect = el.getBoundingClientRect();

        results.push({
            sel:     sel,
            tag:     el.tagName.toLowerCase(),
            text:    txt,
            score:   score,
            isDate:  isDate,
            isPrice: isPrice,
            visible: rect.width > 0 && rect.height > 0,
            attrs: {
                id:          el.id || null,
                testid:      el.getAttribute('data-testid'),
                uia:         el.getAttribute('data-uia'),
                encoreId:    el.getAttribute('data-encore-id'),
                class:       cls.substring(0, 120) || null,
            }
        });
    });

    results.sort(function(a, b) {
        // Widoczne najpierw, potem po score
        if (a.visible !== b.visible) return a.visible ? -1 : 1;
        return b.score - a.score;
    });

    return JSON.stringify(results.slice(0, 50));
})();
"""


# ──────────────────────────────────────────────────────────────────────────────
# Główna logika
# ──────────────────────────────────────────────────────────────────────────────
def create_driver() -> webdriver.Chrome:
    options = Options()
    # NON-HEADLESS – widoczna przeglądarka
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1440,900")
    options.add_argument("--remote-debugging-port=9222")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
    return webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options,
    )


def inject_inspector(driver: webdriver.Chrome) -> None:
    try:
        result = driver.execute_script(_INSPECTOR_JS)
        if result == "OK":
            print("  [✓] Inspektor DOM wstrzyknięty – najedź myszką na elementy")
    except Exception as e:
        print(f"  [!] Nie można wstrzyknąć inspektora: {e}")


def collect_candidates(driver: webdriver.Chrome) -> list:
    try:
        raw = driver.execute_script(_COLLECT_JS)
        return json.loads(raw) if raw else []
    except Exception as e:
        print(f"  [!] Błąd skanowania: {e}")
        return []


def print_candidates(candidates: list, service: str) -> None:
    if not candidates:
        print("  Nie znaleziono kandydatów. Upewnij się, że jesteś na właściwej stronie.")
        return

    print(f"\n{'═'*100}")
    print(f"  KANDYDACI NA SELEKTORY BILLING – {service.upper()}")
    print(f"{'═'*100}")
    print(f"  {'SELEKTOR':<55} {'TYP':<8} {'TEKST':<45}")
    print(f"  {'-'*55} {'-'*8} {'-'*45}")

    for c in candidates:
        typ = ("📅 DATA " if c.get("isDate") else
               "💰 CENA " if c.get("isPrice") else
               "📋 INFO ")
        vis = "" if c.get("visible") else " [ukryty]"
        print(f"  {c['sel'][:54]:<55} {typ}  {c['text'][:44]}{vis}")

    print(f"\n  Łącznie: {len(candidates)} kandydatów")


def save_report(candidates: list, service: str, driver: webdriver.Chrome) -> None:
    data_dir = Path(__file__).parent / "data"
    data_dir.mkdir(exist_ok=True)
    out = data_dir / f"selectors_{service.replace('+', 'plus')}.json"

    # Zbierz logi konsoli
    console_logs = []
    try:
        for entry in driver.get_log("browser"):
            msg = entry.get("message", "")
            if "SUBS_INSPECTOR" in msg:
                console_logs.append(msg)
    except Exception:
        pass

    report = {
        "service": service,
        "url": driver.current_url,
        "candidates": candidates,
        "clicked_selectors": console_logs,
    }
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n  [✓] Raport zapisany → {out}")


def main() -> None:
    service = (sys.argv[1].lower() if len(sys.argv) > 1 else "").strip()

    if not service or service not in SERVICE_URLS:
        print("\nUżycie: python selector_inspector.py <serwis>")
        print(f"Dostępne serwisy: {', '.join(SERVICE_URLS)}\n")
        sys.exit(1)

    urls = SERVICE_URLS[service]

    print(f"\n{'═'*60}")
    print(f"  INSPEKTOR SELEKTORÓW – {service.upper()}")
    print(f"{'═'*60}")
    print(f"\n  Chrome DevTools: http://localhost:9222")
    print(f"  Strona zarządzania: {urls['manage']}\n")

    driver = create_driver()

    try:
        # Otwórz stronę logowania
        print(f"  → Otwieram: {urls['login']}")
        driver.get(urls["login"])
        time.sleep(1)
        inject_inspector(driver)

        print("\n" + "─" * 60)
        print("  INSTRUKCJA:")
        print("  1. Zaloguj się ręcznie w przeglądarce")
        print(f"  2. Przejdź do: {urls['manage']}")
        print("  3. Najedź myszką na elementy → selektor pojawi się na dole")
        print("  4. Kliknij element → selektor skopiowany do schowka")
        print("─" * 60)
        input("\n  [ENTER] gdy jesteś na stronie zarządzania subskrypcją...\n")

        # Ponownie wstrzyknij inspektor po nawigacji
        inject_inspector(driver)
        time.sleep(1)

        print(f"\n  Aktualna strona: {driver.current_url}")
        input("  [ENTER] aby przeskanować stronę i wyświetlić kandydatów...\n")

        print("  Skanowanie strony...")
        candidates = collect_candidates(driver)
        print_candidates(candidates, service)
        save_report(candidates, service, driver)

        # Pokaż logi konsoli (kliknięcia)
        try:
            logs = [
                e["message"] for e in driver.get_log("browser")
                if "SUBS_INSPECTOR" in e.get("message", "")
            ]
            if logs:
                print("\n  KLIKNIĘTE ELEMENTY (skopiowane do schowka):")
                for log in logs:
                    print(f"    {log}")
        except Exception:
            pass

        input("\n  [ENTER] aby zamknąć przeglądarkę...")

    finally:
        driver.quit()
        print("  Przeglądarka zamknięta.\n")


if __name__ == "__main__":
    main()
