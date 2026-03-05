/**
 * Testy funkcji get_service_urls() z lib/service-urls.ts
 *
 * Testujemy:
 * - Dopasowanie dokładne (np. "Netflix")
 * - Dopasowanie case-insensitive
 * - Dopasowanie po znormalizowanej nazwie
 * - cancel_url gdy jest w bazie
 * - cancel_url == manage_url gdy brak cancel_url
 * - Fallback na Google Search dla nieznanych serwisów
 * - Flaga is_direct
 */
import { describe, it, expect } from "vitest";
import { get_service_urls } from "@/lib/service-urls";

describe("get_service_urls – znane serwisy", () => {
  it("Netflix: zwraca bezpośredni link z is_direct=true", () => {
    const result = get_service_urls("Netflix");
    expect(result.is_direct).toBe(true);
    expect(result.manage_url).toContain("netflix.com");
    expect(result.cancel_url).toContain("netflix.com");
    expect(result.display).toBe("Netflix");
  });

  it("Netflix: cancel_url jest inny niż manage_url", () => {
    const result = get_service_urls("Netflix");
    expect(result.cancel_url).not.toBe(result.manage_url);
    expect(result.cancel_url).toContain("cancelplan");
  });

  it("Spotify: zwraca linka do manage", () => {
    const result = get_service_urls("Spotify");
    expect(result.is_direct).toBe(true);
    expect(result.manage_url).toContain("spotify.com");
  });

  it("Disney+: rozpoznaje zapis z plusem", () => {
    const result = get_service_urls("Disney+");
    expect(result.is_direct).toBe(true);
    expect(result.manage_url).toContain("disneyplus.com");
  });

  it("YouTube Premium: zarządzanie w youtube.com", () => {
    const result = get_service_urls("YouTube Premium");
    expect(result.is_direct).toBe(true);
    expect(result.manage_url).toContain("youtube.com");
  });

  it("Amazon Prime: bezpośredni link na amazon.pl", () => {
    const result = get_service_urls("Amazon Prime");
    expect(result.is_direct).toBe(true);
    expect(result.manage_url).toContain("amazon");
  });
});

describe("get_service_urls – normalizacja nazwy", () => {
  it("NETFLIX (uppercase) → dopasowanie", () => {
    const result = get_service_urls("NETFLIX");
    expect(result.is_direct).toBe(true);
  });

  it("   netflix   (spacje) → dopasowanie", () => {
    const result = get_service_urls("  netflix  ");
    expect(result.is_direct).toBe(true);
  });

  it("netflix (lowercase) → dopasowanie", () => {
    const result = get_service_urls("netflix");
    expect(result.is_direct).toBe(true);
  });

  it("Spotify Premium (dodatkowe słowo) → częściowe dopasowanie", () => {
    const result = get_service_urls("Spotify Premium");
    // zawiera 'spotify' więc powinno dopasować
    expect(result.is_direct).toBe(true);
    expect(result.manage_url).toContain("spotify.com");
  });
});

describe("get_service_urls – fallback na Google Search", () => {
  it("nieznany serwis: is_direct=false", () => {
    const result = get_service_urls("ZupełnieNieznanySerwis123");
    expect(result.is_direct).toBe(false);
  });

  it("fallback: manage_url to Google Search", () => {
    const result = get_service_urls("MójNieznanySerwis");
    expect(result.manage_url).toContain("google.com");
  });

  it("fallback: cancel_url === manage_url", () => {
    const result = get_service_urls("NieznanySerwis456");
    expect(result.cancel_url).toBe(result.manage_url);
  });

  it("fallback: display to podana nazwa serwisu", () => {
    const name = "MójTestowyAplikacja";
    const result = get_service_urls(name);
    expect(result.display).toBe(name);
  });
});

describe("get_service_urls – poprawność zwracanych URL", () => {
  it("wszystkie manage_url zaczynają się od https:// (Netflix)", () => {
    const result = get_service_urls("Netflix");
    expect(result.manage_url).toMatch(/^https:\/\//);
  });

  it("HBO Max: brak oddzielnego cancel_url → cancel_url == manage_url", () => {
    const result = get_service_urls("HBO Max");
    expect(result.manage_url).toContain("max.com");
    expect(result.cancel_url).toBe(result.manage_url);
  });

  it("Apple TV+: rozpoznaje zapis z plusem", () => {
    const result = get_service_urls("Apple TV+");
    expect(result.is_direct).toBe(true);
    expect(result.manage_url).toContain("appleid.apple.com");
  });
});
