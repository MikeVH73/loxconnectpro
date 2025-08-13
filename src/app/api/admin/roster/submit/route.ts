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
    const docRef = db.doc(`accessReviews/${reviewMonth}/countries/${body.country}`);
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
    const allIds = new Set((body.allUsers || []).map((u) => u.id));
    const activeSet = new Set(body.activeUserIds);
    const toDisable = [...allIds].filter((id) => !activeSet.has(id));

    const ops = toDisable.map((uid) => auth.updateUser(uid, { disabled: true }));
    await Promise.allSettled(ops);

    return NextResponse.json({ ok: true, disabledCount: toDisable.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}


