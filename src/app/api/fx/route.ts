import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// FX proxy with resilient fallbacks and 24h cache
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

    // Try provider 1: exchangerate.host
    const tryExchangerateHost = async () => {
      const apiUrl = `https://api.exchangerate.host/latest?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`;
      const res = await fetch(apiUrl, { next: { revalidate: 86400 } }); // 24h
      if (!res.ok) throw new Error('exchangerate_host_failed');
      const data = await res.json();
      const rate = data?.rates?.[to];
      const date = data?.date || new Date().toISOString().slice(0,10);
      if (typeof rate !== 'number') throw new Error('exchangerate_host_invalid');
      return { rate, source: 'exchangerate.host', date };
    };

    // Try provider 2: frankfurter.app
    const tryFrankfurter = async () => {
      const apiUrl = `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const res = await fetch(apiUrl, { next: { revalidate: 86400 } });
      if (!res.ok) throw new Error('frankfurter_failed');
      const data = await res.json();
      const rate = data?.rates?.[to];
      const date = data?.date || new Date().toISOString().slice(0,10);
      if (typeof rate !== 'number') throw new Error('frankfurter_invalid');
      return { rate, source: 'frankfurter.app', date };
    };

    // Try provider 3: open.er-api.com
    const tryOpenER = async () => {
      const apiUrl = `https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`;
      const res = await fetch(apiUrl, { next: { revalidate: 86400 } });
      if (!res.ok) throw new Error('open_er_failed');
      const data = await res.json();
      const rate = data?.rates?.[to];
      const date = data?.time_last_update_utc ? new Date(data.time_last_update_utc).toISOString().slice(0,10) : new Date().toISOString().slice(0,10);
      if (typeof rate !== 'number') throw new Error('open_er_invalid');
      return { rate, source: 'open.er-api.com', date };
    };

    let result;
    try {
      result = await tryExchangerateHost();
    } catch {
      try {
        result = await tryFrankfurter();
      } catch {
        result = await tryOpenER();
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=86400, stale-while-revalidate=86400' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'unknown' }), { status: 500 });
  }
}


