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

function generateTempPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  let out = '';
  const cryptoObj = (globalThis as any).crypto || undefined;
  for (let i = 0; i < length; i++) {
    if (cryptoObj?.getRandomValues) {
      const arr = new Uint32Array(1);
      cryptoObj.getRandomValues(arr);
      out += chars[arr[0] % chars.length];
    } else {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const { uid, email } = await request.json();
    const auth = getAdminAuth();

    let targetUid = uid as string | undefined;
    if (!targetUid && email) {
      const user = await auth.getUserByEmail(email as string);
      targetUid = user.uid;
    }
    if (!targetUid) {
      return NextResponse.json({ ok: false, error: 'Missing uid or email' }, { status: 400 });
    }

    const tempPassword = generateTempPassword(12);
    await auth.updateUser(targetUid, { password: tempPassword });
    return NextResponse.json({ ok: true, tempPassword });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}


