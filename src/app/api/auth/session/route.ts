import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import * as admin from 'firebase-admin';

let adminApp: admin.app.App | null = null;
function getAdminAuth() {
  if (adminApp) return admin.auth(adminApp);
  const projectId = process.env.FIREBASE_PROJECT_ID as string;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL as string;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY as string;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin credentials are not set');
  }
  privateKey = privateKey.replace(/\\n/g, '\n');
  adminApp = admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
  return admin.auth(adminApp);
}

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


