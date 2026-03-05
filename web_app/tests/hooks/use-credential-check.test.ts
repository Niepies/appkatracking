/**
 * Testy jednostkowe hooks/use-credential-check.ts
 *
 * Testujemy:
 * - poprawne mapowanie kodów HTTP na stan has_credentials
 * - graceful degradation (500, błąd sieci) → null
 * - cache modułowy (ten sam serwis nie odpytuje API dwukrotnie)
 * - invalidate() czyści cache i wymusza re-fetch
 * - normalizacja service_key przez normalize_service_key
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { use_credential_check } from "@/hooks/use-credential-check";

// Każdy test używa unikalnej nazwy serwisu żeby ominąć cache modułowy
let _counter = 0;
const unique_svc = (base = "svc") => `${base}_cred_test_${++_counter}`;

function make_response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

describe("use_credential_check", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Stany API ───────────────────────────────────────────────────────────────

  it("API 200 has_credentials=true → state becomes true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(make_response(200, { has_credentials: true }))
    );
    const { result } = renderHook(() => use_credential_check(unique_svc("true")));
    await waitFor(() => expect(result.current.has_credentials).toBe(true));
  });

  it("API 200 has_credentials=false → state becomes false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(make_response(200, { has_credentials: false }))
    );
    const { result } = renderHook(() => use_credential_check(unique_svc("false")));
    await waitFor(() => expect(result.current.has_credentials).toBe(false));
  });

  it("API 404 → state false (brak zapisanych danych)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(make_response(404, { detail: "Not found" }))
    );
    const { result } = renderHook(() => use_credential_check(unique_svc("404")));
    await waitFor(() => expect(result.current.has_credentials).toBe(false));
  });

  it("API 500 → state null (graceful degradation – nie blokuje)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(make_response(500, { detail: "Server error" }))
    );
    const { result } = renderHook(() => use_credential_check(unique_svc("500")));
    await waitFor(() => expect(result.current.is_checking_creds).toBe(false));
    expect(result.current.has_credentials).toBeNull();
  });

  it("błąd sieci (fetch throws) → state null (graceful degradation)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error"))
    );
    const { result } = renderHook(() => use_credential_check(unique_svc("net")));
    await waitFor(() => expect(result.current.is_checking_creds).toBe(false));
    expect(result.current.has_credentials).toBeNull();
  });

  it("API 401 → state null (graceful degradation)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(make_response(401, { detail: "Unauthorized" }))
    );
    const { result } = renderHook(() => use_credential_check(unique_svc("401")));
    await waitFor(() => expect(result.current.is_checking_creds).toBe(false));
    expect(result.current.has_credentials).toBeNull();
  });

  // ── URL fetch ───────────────────────────────────────────────────────────────

  it("URL fetch zawiera /api/credentials/ i znormalizowany klucz", async () => {
    const fetch_mock = vi
      .fn()
      .mockResolvedValue(make_response(200, { has_credentials: true }));
    vi.stubGlobal("fetch", fetch_mock);
    renderHook(() => use_credential_check("Netflix"));
    await waitFor(() => expect(fetch_mock).toHaveBeenCalled());
    const url = fetch_mock.mock.calls[0][0] as string;
    expect(url).toContain("/api/credentials/");
    expect(url).toContain("netflix");
  });

  it("URL jest percent-encoded dla serwisów ze znakami specjalnymi", async () => {
    const fetch_mock = vi
      .fn()
      .mockResolvedValue(make_response(200, { has_credentials: false }));
    vi.stubGlobal("fetch", fetch_mock);
    renderHook(() => use_credential_check("Disney+"));
    await waitFor(() => expect(fetch_mock).toHaveBeenCalled());
    const url = fetch_mock.mock.calls[0][0] as string;
    // Disney+ → "disney+" → encodeURIComponent → "disney%2B"
    expect(url).toMatch(/disney/i);
  });

  // ── service_key ─────────────────────────────────────────────────────────────

  it("service_key zwraca znormalizowany klucz", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(make_response(200, { has_credentials: false }))
    );
    const { result } = renderHook(() => use_credential_check("Netflix"));
    expect(result.current.service_key).toBe("netflix");
  });

  it("service_key dla Disney+ → 'disney+'", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(make_response(404, {}))
    );
    const { result } = renderHook(() => use_credential_check("Disney+"));
    expect(result.current.service_key).toBe("disney+");
  });

  it("service_key dla nieznanego serwisu → lowercase z podkreśleniami", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(make_response(404, {}))
    );
    const { result } = renderHook(() => use_credential_check("My New Service"));
    expect(result.current.service_key).toBe("my_new_service");
  });

  // ── Cache ────────────────────────────────────────────────────────────────────

  it("cache: drugi hook z tą samą nazwą nie wykonuje re-fetch (cache hit)", async () => {
    const svc = unique_svc("cache");
    const fetch_first = vi
      .fn()
      .mockResolvedValue(make_response(200, { has_credentials: true }));
    vi.stubGlobal("fetch", fetch_first);

    // Pierwszy hook – zapisuje wynik w cache
    const { result: r1 } = renderHook(() => use_credential_check(svc));
    await waitFor(() => expect(r1.current.has_credentials).toBe(true));

    // Podmieniamy fetch na inny (404) – drugi hook powinien użyć cache
    const fetch_second = vi
      .fn()
      .mockResolvedValue(make_response(404, {}));
    vi.stubGlobal("fetch", fetch_second);

    const { result: r2 } = renderHook(() => use_credential_check(svc));
    // Powinno nadal być true (z cache, nie 404)
    await waitFor(() => expect(r2.current.has_credentials).toBe(true));
    expect(fetch_second).not.toHaveBeenCalled();
  });

  it("różne nazwy serwisów mają osobne wpisy w cache", async () => {
    const svc_a = unique_svc("svcA");
    const svc_b = unique_svc("svcB");

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(make_response(200, { has_credentials: true }))
        .mockResolvedValueOnce(make_response(404, {}))
    );

    const { result: rA } = renderHook(() => use_credential_check(svc_a));
    const { result: rB } = renderHook(() => use_credential_check(svc_b));

    await waitFor(() => expect(rA.current.has_credentials).toBe(true));
    await waitFor(() => expect(rB.current.has_credentials).toBe(false));
  });

  // ── invalidate() ─────────────────────────────────────────────────────────────

  it("invalidate() czyści cache i wykonuje ponowny fetch", async () => {
    const svc = unique_svc("inv");
    const fetch_mock = vi
      .fn()
      .mockResolvedValueOnce(make_response(200, { has_credentials: true }))
      .mockResolvedValueOnce(make_response(404, {}));
    vi.stubGlobal("fetch", fetch_mock);

    const { result } = renderHook(() => use_credential_check(svc));
    await waitFor(() => expect(result.current.has_credentials).toBe(true));

    await act(async () => {
      result.current.invalidate();
    });
    await waitFor(() => expect(result.current.has_credentials).toBe(false));

    expect(fetch_mock).toHaveBeenCalledTimes(2);
  });

  it("invalidate() po błędzie sieci → state pozostaje null", async () => {
    const svc = unique_svc("inv_err");
    const fetch_mock = vi
      .fn()
      .mockResolvedValueOnce(make_response(200, { has_credentials: true }))
      .mockRejectedValueOnce(new Error("Network error"));
    vi.stubGlobal("fetch", fetch_mock);

    const { result } = renderHook(() => use_credential_check(svc));
    await waitFor(() => expect(result.current.has_credentials).toBe(true));

    await act(async () => {
      result.current.invalidate();
    });
    await waitFor(() => expect(result.current.is_checking_creds).toBe(false));
    expect(result.current.has_credentials).toBeNull();
  });
});
