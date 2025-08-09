import { NextRequest } from 'next/server';

// Simple FX proxy using exchangerate.host (free) with 24h CDN cache
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = (searchParams.get('from') || 'EUR').toUpperCase();
    const to = (searchParams.get('to') || 'EUR').toUpperCase();

    if (from === to) {
      return new Response(JSON.stringify({ rate: 1, source: 'exchangerate.host', date: new Date().toISOString().slice(0,10) }), {
        headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=86400, stale-while-revalidate=86400' }
      });
    }

    const apiUrl = `https://api.exchangerate.host/latest?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`;
    const res = await fetch(apiUrl, { next: { revalidate: 86400 } }); // 24h
    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'failed_to_fetch' }), { status: 502 });
    }
    const data = await res.json();
    const rate = data?.rates?.[to];
    const date = data?.date || new Date().toISOString().slice(0,10);
    if (typeof rate !== 'number') {
      return new Response(JSON.stringify({ error: 'invalid_rate' }), { status: 502 });
    }
    return new Response(JSON.stringify({ rate, source: 'exchangerate.host', date }), {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=86400, stale-while-revalidate=86400' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'unknown' }), { status: 500 });
  }
}


