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
    const { uid, email } = await request.json();
    const auth = getAdminAuth();
    let targetEmail = email as string | undefined;
    if (!targetEmail && uid) {
      const user = await auth.getUser(uid);
      targetEmail = user.email || undefined;
    }
    if (!targetEmail) {
      return NextResponse.json({ ok: false, error: 'Missing email/uid' }, { status: 400 });
    }
    // Provide a continue URL to satisfy Identity Platform requirements
    const origin = new URL(request.url).origin;
    const continueUrl = `${origin}/login`;
    const link = await auth.generatePasswordResetLink(targetEmail, {
      url: continueUrl,
      handleCodeInApp: false,
    });
    return NextResponse.json({ ok: true, link });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}


