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
    const uids: string[] = Array.isArray(body?.uids) ? body.uids.filter(Boolean) : [];
    const emails: string[] = Array.isArray(body?.emails) ? body.emails.filter(Boolean) : [];
    if (!uids.length && !emails.length) {
      return NextResponse.json({ error: 'uids or emails required' }, { status: 400 });
    }

    const auth = getAdminAuth();
    const byUid: Record<string, { mfaEnabled: boolean; disabled: boolean; emailVerified: boolean; email?: string }> = {};
    const byEmail: Record<string, { mfaEnabled: boolean; disabled: boolean; emailVerified: boolean; uid?: string }> = {};

    if (uids.length) {
      const result = await auth.getUsers(uids.map((uid) => ({ uid })));
      for (const user of result.users) {
        const mfaEnabled = (user.multiFactor?.enrolledFactors || []).length > 0;
        byUid[user.uid] = { mfaEnabled, disabled: !!user.disabled, emailVerified: !!user.emailVerified, email: (user.email || '').toLowerCase() };
        if (user.email) byEmail[(user.email || '').toLowerCase()] = { mfaEnabled, disabled: !!user.disabled, emailVerified: !!user.emailVerified, uid: user.uid };
      }
      // do not mark notFound here; fallback to email lookup below
    }

    // Lookup by email for any provided emails, or for any uid misses when an email is known
    const emailsToLookup = new Set<string>();
    emails.forEach((e) => emailsToLookup.add((e as string).toLowerCase()));
    // if caller provided pairs of {uid,email} you can include them too, but we'll just resolve provided emails

    for (const email of Array.from(emailsToLookup)) {
      try {
        const user = await auth.getUserByEmail(email);
        const mfaEnabled = (user.multiFactor?.enrolledFactors || []).length > 0;
        byUid[user.uid] = { mfaEnabled, disabled: !!user.disabled, emailVerified: !!user.emailVerified, email: (user.email || '').toLowerCase() };
        if (user.email) byEmail[(user.email || '').toLowerCase()] = { mfaEnabled, disabled: !!user.disabled, emailVerified: !!user.emailVerified, uid: user.uid };
      } catch {
        // ignore not found
      }
    }

    return NextResponse.json({ statusesByUid: byUid, statusesByEmail: byEmail });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}



