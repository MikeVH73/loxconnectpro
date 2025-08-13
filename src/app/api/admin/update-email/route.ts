export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

let adminApp: admin.app.App | null = null;
function getAdminAuth() {
  if (!adminApp) {
    try { adminApp = admin.app(); }
    catch {
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
    }
  }
  return admin.auth(adminApp);
}

export async function POST(request: NextRequest) {
  try {
    const { uid, newEmail } = await request.json();
    if (!uid || !newEmail) return NextResponse.json({ ok: false, error: 'Missing uid or newEmail' }, { status: 400 });
    const auth = getAdminAuth();
    await auth.updateUser(uid, { email: newEmail, emailVerified: false });

    // Generate a fresh verification link for the new email
    const configuredBase = process.env.NEXT_PUBLIC_APP_BASE_URL || 'https://loxconnectpro.vercel.app';
    const link = await auth.generateEmailVerificationLink(newEmail, { url: `${configuredBase}/login`, handleCodeInApp: false });
    return NextResponse.json({ ok: true, link });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}


