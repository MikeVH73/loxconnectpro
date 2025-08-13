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

// GET for Vercel cron: returns list of countries missing current-month review
export async function GET() {
  try {
    const month = new Date().toISOString().slice(0, 7);
    const { db } = getAdmin();

    const countriesSnap = await db.collection('countries').get();
    const allCountries = countriesSnap.docs.map((d) => (d.data() as any).name).filter(Boolean);

    const missing: string[] = [];
    for (const country of allCountries) {
      const docRef = db.doc(`accessReviews/${month}/countries/${country}`);
      const snap = await docRef.get();
      if (!snap.exists) missing.push(country);
    }

    return NextResponse.json({ ok: true, month, missing });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}


