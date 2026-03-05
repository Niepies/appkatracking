import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy do mikroserwisu automatyzacji Python/FastAPI.
 * Ukrywa adres i klucz API mikroserwisu przed klientem.
 *
 * Obsługuje wszystkie ścieżki pod /api/automation/[...path]
 *   GET  /api/automation/status/:job_id   → GET  <AUTOMATION_URL>/api/automation/status/:job_id
 *   POST /api/automation/run              → POST <AUTOMATION_URL>/api/automation/run
 *   ... itd.
 *
 * Wymaga zmiennych środowiskowych:
 *   AUTOMATION_API_URL  – adres mikroserwisu (np. http://localhost:8001)
 *   AUTOMATION_API_KEY  – klucz API (ten sam co w .env mikroserwisu)
 */

const AUTOMATION_URL = process.env.AUTOMATION_API_URL ?? "http://localhost:8001";
const AUTOMATION_KEY = process.env.AUTOMATION_API_KEY ?? "";

async function proxy(req: NextRequest, path: string): Promise<NextResponse> {
  if (!AUTOMATION_KEY) {
    return NextResponse.json(
      { error: "Brak AUTOMATION_API_KEY w zmiennych środowiskowych serwera." },
      { status: 503 }
    );
  }

  const upstream_url = `${AUTOMATION_URL}${path}${
    req.nextUrl.search ? req.nextUrl.search : ""
  }`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Key": AUTOMATION_KEY,
  };

  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      body = await req.text();
    } catch {
      body = undefined;
    }
  }

  try {
    const upstream = await fetch(upstream_url, {
      method: req.method,
      headers,
      body,
      // Nie cache'ujemy – żądania są real-time
      cache: "no-store",
    });

    const data = await upstream.text();

    // Jeśli odpowiedź to obraz PNG (screenshot), przekaż binarnie
    const content_type = upstream.headers.get("content-type") ?? "application/json";
    if (content_type.includes("image/")) {
      const buffer = Buffer.from(data, "binary");
      return new NextResponse(buffer, {
        status: upstream.status,
        headers: { "Content-Type": content_type },
      });
    }

    return new NextResponse(data, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[automation proxy]", err);
    return NextResponse.json(
      { error: "Nie można połączyć się z serwisem automatyzacji." },
      { status: 502 }
    );
  }
}

// Next.js route handlers dla wszystkich metod HTTP

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(req, `/api/automation/${path.join("/")}`);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(req, `/api/automation/${path.join("/")}`);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(req, `/api/automation/${path.join("/")}`);
}
