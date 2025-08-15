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

export async function POST(req: Request) {
  try {
    const { countries, month } = await req.json();
    if (!Array.isArray(countries) || countries.length === 0) {
      return NextResponse.json({ error: 'countries[] required' }, { status: 400 });
    }
    const reviewMonth = typeof month === 'string' && month ? month : new Date().toISOString().slice(0, 7);
    const { db } = getAdmin();

    const results: Record<string, any> = {};
    for (const country of countries) {
      const docRef = db.doc(`accessReviews/${reviewMonth}/countries/${country}`);
      const snap = await docRef.get();
      results[country] = snap.exists ? snap.data() : null;
    }

    return NextResponse.json({ ok: true, month: reviewMonth, countries: results });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}


