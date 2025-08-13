export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

let adminApp: admin.app.App | null = null;
function getAdmin() {
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
  return { auth: admin.auth(adminApp), db: admin.firestore(adminApp) };
}

type SubmitBody = {
  country: string;
  reviewedBy: string;
  reviewedAt?: string;
  month?: string;
  activeUserIds: string[];
  allUsers?: { id: string; email?: string; displayName?: string }[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SubmitBody;
    if (!body?.country || !Array.isArray(body.activeUserIds)) {
      return NextResponse.json({ error: 'country and activeUserIds[] required' }, { status: 400 });
    }
    const reviewMonth = body.month || new Date().toISOString().slice(0, 7);
    const { auth, db } = getAdmin();

    // 1) Persist review record
    const countryKey = body.country && body.country.trim() ? body.country.trim() : 'Global';
    const docRef = db.doc(`accessReviews/${reviewMonth}/countries/${countryKey}`);
    await docRef.set(
      {
        reviewedBy: body.reviewedBy || 'unknown',
        reviewedAt: body.reviewedAt || new Date().toISOString(),
        activeUserIds: body.activeUserIds,
        totalUsers: body.allUsers?.length || null,
      },
      { merge: true }
    );

    // 2) Disable users not marked active
    const activeSet = new Set(body.activeUserIds);
    const all = body.allUsers || [];
    const targets = all.filter((u) => !activeSet.has(u.id));

    const results: { email?: string; uid?: string; ok: boolean; error?: string }[] = [];
    for (const t of targets) {
      try {
        let uid: string | null = null;
        if (t.email) {
          try {
            const byEmail = await auth.getUserByEmail(t.email);
            uid = byEmail.uid;
          } catch {
            // ignore and try by id
          }
        }
        if (!uid) {
          try {
            const byId = await auth.getUser(t.id);
            uid = byId.uid;
          } catch {
            // no match
          }
        }
        if (!uid) {
          results.push({ email: t.email, ok: false, error: 'User not found in Auth' });
          continue;
        }
        await auth.updateUser(uid, { disabled: true });
        results.push({ email: t.email, uid, ok: true });
      } catch (e: any) {
        results.push({ email: t.email, ok: false, error: e?.message || String(e) });
      }
    }

    const disabledCount = results.filter((r) => r.ok).length;
    return NextResponse.json({ ok: true, disabledCount, results });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}


