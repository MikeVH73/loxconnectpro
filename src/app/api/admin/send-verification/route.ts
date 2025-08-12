export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(request: NextRequest) {
  try {
    const { uid } = await request.json();
    if (!uid || typeof uid !== 'string') {
      return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
    }
    const auth = getAdminAuth();
    const user = await auth.getUser(uid);
    if (!user.email) {
      return NextResponse.json({ error: 'User has no email' }, { status: 400 });
    }
    const link = await auth.generateEmailVerificationLink(user.email);
    return NextResponse.json({ ok: true, link });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}


