import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy do endpointów credential mikroserwisu automatyzacji.
 * Ścieżki pod /api/credentials/[...path] → <AUTOMATION_URL>/api/credentials/...
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

  const upstream_url = `${AUTOMATION_URL}${path}`;
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
      cache: "no-store",
    });
    const data = await upstream.text();
    return new NextResponse(data, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[credentials proxy]", err);
    return NextResponse.json(
      { error: "Nie można połączyć się z serwisem automatyzacji." },
      { status: 502 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const suffix = path.length ? `/${path.join("/")}` : "";
  return proxy(req, `/api/credentials${suffix}`);
}

export async function POST(req: NextRequest) {
  return proxy(req, "/api/credentials");
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(req, `/api/credentials/${path.join("/")}`);
}
