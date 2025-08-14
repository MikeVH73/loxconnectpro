export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

let adminApp: admin.app.App | null = null;
function getAdminAuth() {
  if (!adminApp) {
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
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const uids: string[] = Array.isArray(body?.uids) ? body.uids : [];
    if (!uids.length) {
      return NextResponse.json({ error: 'uids required' }, { status: 400 });
    }

    const auth = getAdminAuth();
    const result = await auth.getUsers(uids.map((uid) => ({ uid })));
    const map: Record<string, { mfaEnabled: boolean; disabled: boolean; emailVerified: boolean }> = {};

    for (const user of result.users) {
      const mfaEnabled = (user.multiFactor?.enrolledFactors || []).length > 0;
      map[user.uid] = {
        mfaEnabled,
        disabled: !!user.disabled,
        emailVerified: !!user.emailVerified,
      };
    }
    for (const notFound of result.notFound) {
      if (notFound?.uid) map[notFound.uid] = { mfaEnabled: false, disabled: false, emailVerified: false };
    }

    return NextResponse.json({ statuses: map });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}



