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

export async function GET() {
  try {
    await getAdminAuth().listUsers(1);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}


