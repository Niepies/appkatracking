import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy dla Streaming Availability API (RapidAPI).
 * Klucz API nigdy nie jest widoczny po stronie klienta.
 *
 * GET /api/streaming?q=netflix&country=pl&type=all
 */
export async function GET(req: NextRequest) {
  const api_key = process.env.RAPIDAPI_KEY;

  if (!api_key) {
    return NextResponse.json(
      { error: "Brak klucza RAPIDAPI_KEY w zmiennych środowiskowych." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const country = searchParams.get("country") ?? "pl";
  const show_type = searchParams.get("type") ?? "all";

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ error: "Podaj co najmniej 2 znaki." }, { status: 400 });
  }

  const url = new URL("https://streaming-availability.p.rapidapi.com/shows/search/title");
  url.searchParams.set("title", query.trim());
  url.searchParams.set("country", country);
  url.searchParams.set("show_type", show_type);
  url.searchParams.set("output_language", "pl");

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "x-rapidapi-host": "streaming-availability.p.rapidapi.com",
        "x-rapidapi-key": api_key,
        "Content-Type": "application/json",
      },
      next: { revalidate: 300 }, // cache 5 min
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `API error ${response.status}: ${text}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[streaming route]", err);
    return NextResponse.json({ error: "Błąd połączenia z API." }, { status: 500 });
  }
}
