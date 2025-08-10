import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
export const runtime = 'nodejs';

function getExpiresMs(): number {
  const env = process.env.SESSION_MAX_AGE_MS;
  const fallback = 8 * 60 * 60 * 1000; // 8 hours
  if (!env) return fallback;
  const parsed = Number(env);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    const auth = getAdminAuth();
    // Verify token to ensure it's valid for this project
    await auth.verifyIdToken(idToken);

    const expiresIn = getExpiresMs();
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set('__session', sessionCookie, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(expiresIn / 1000),
    });
    return res;
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to set session' }, { status: 400 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set('__session', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}


