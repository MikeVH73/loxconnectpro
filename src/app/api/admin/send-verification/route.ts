export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

let adminApp: admin.app.App | null = null;
function getAdminAuth() {
  try {
    if (!adminApp) {
      // If default app already exists, reuse; otherwise initialize
      try {
        adminApp = admin.app();
      } catch {
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
  } catch (e) {
    throw e;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { uid, email } = await request.json();
    if ((!uid || typeof uid !== 'string') && (!email || typeof email !== 'string')) {
      return NextResponse.json({ error: 'Missing uid or email' }, { status: 400 });
    }
    const auth = getAdminAuth();
    let user: admin.auth.UserRecord;
    if (uid) {
      try { user = await auth.getUser(uid); } catch { user = await auth.getUserByEmail(email as string); }
    } else {
      user = await auth.getUserByEmail(email as string);
    }
    if (!user.email) {
      return NextResponse.json({ error: 'User has no email' }, { status: 400 });
    }
    const link = await auth.generateEmailVerificationLink(user.email);
    return NextResponse.json({ ok: true, link });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}


