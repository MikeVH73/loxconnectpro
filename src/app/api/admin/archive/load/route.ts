export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

let adminApp: admin.app.App | null = null;
function getStorage() {
  if (!adminApp) {
    try { adminApp = admin.app(); }
    catch {
      const projectId = process.env.FIREBASE_PROJECT_ID as string;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL as string;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY as string;
      if (!projectId || !clientEmail || !privateKey) throw new Error('Firebase Admin credentials are not set');
      privateKey = privateKey.replace(/\\n/g, '\n');
      adminApp = admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
    }
  }
  return admin.storage(adminApp!);
}

// GET /api/admin/archive/load?quoteRequestId=...&ym=YYYY-MM
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const quoteRequestId = searchParams.get('quoteRequestId');
    const ym = searchParams.get('ym'); // YYYY-MM
    if (!quoteRequestId || !ym) {
      return NextResponse.json({ ok: false, error: 'Missing quoteRequestId or ym' }, { status: 400 });
    }
    const bucketName = process.env.ARCHIVE_BUCKET || 'loxconnect-archive';
    const storage = getStorage();
    const [files] = await storage.bucket(bucketName).getFiles({ prefix: `messages/${quoteRequestId}/${ym}/` });
    if (!files || files.length === 0) {
      return NextResponse.json({ ok: true, messages: [] });
    }
    const all: any[] = [];
    for (const f of files) {
      const [buf] = await f.download();
      const text = buf.toString('utf8');
      const lines = text.split('\n').filter(Boolean);
      for (const line of lines) {
        try { all.push(JSON.parse(line)); } catch { /* ignore malformed */ }
      }
    }
    // Sort by createdAt asc
    all.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return NextResponse.json({ ok: true, messages: all });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}


