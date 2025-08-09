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

    // Prefer convert endpoint (more reliable), fallback to latest
    const convertUrl = `https://api.exchangerate.host/convert?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    let res = await fetch(convertUrl, { next: { revalidate: 86400 } });
    let ok = res.ok;
    let payload: any = ok ? await res.json() : null;
    let rate: number | undefined;
    let date: string | undefined;
    if (ok) {
      rate = typeof payload?.result === 'number' ? payload.result : (typeof payload?.info?.rate === 'number' ? payload.info.rate : undefined);
      date = payload?.date || new Date().toISOString().slice(0,10);
    }

    if (!ok || typeof rate !== 'number') {
      const latestUrl = `https://api.exchangerate.host/latest?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`;
      res = await fetch(latestUrl, { next: { revalidate: 86400 } });
      if (!res.ok) {
        return new Response(JSON.stringify({ error: 'failed_to_fetch' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      const data = await res.json();
      rate = data?.rates?.[to];
      date = data?.date || new Date().toISOString().slice(0,10);
      if (typeof rate !== 'number') {
        return new Response(JSON.stringify({ error: 'invalid_rate' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
    }

    return new Response(JSON.stringify({ rate, source: 'exchangerate.host', date }), {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=86400, stale-while-revalidate=86400' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'unknown' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
}


