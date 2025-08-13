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
    const uid: string | undefined = body?.uid;
    const email: string | undefined = body?.email;
    if (!uid && !email) {
      return NextResponse.json({ error: 'uid or email required' }, { status: 400 });
    }
    const auth = getAdminAuth();
    let user: admin.auth.UserRecord;
    if (uid) {
      try {
        user = await auth.getUser(uid);
      } catch (e) {
        // Fallback to email lookup for legacy profiles where Firestore doc id != Auth UID
        if (email) {
          user = await auth.getUserByEmail(email);
        } else {
          throw e;
        }
      }
    } else {
      user = await auth.getUserByEmail(email!);
    }

    // Create a simple action link to the security page
    const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const securityUrl = `${baseUrl}/users/security`;

    // Send using Admin SDK email action is not available for custom content.
    // Instead, trigger a verification link as a nudge (if not verified), appended with a note in return payload.
    let link: string | null = null;
    try {
      link = await auth.generateEmailVerificationLink(user.email!, { url: securityUrl });
    } catch {
      // ignore if fails; we still return the security URL for manual copy
    }

    return NextResponse.json({ ok: true, securityUrl, verificationLink: link });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}


