export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// Reuse a singleton Admin app across invocations
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
  return {
    db: admin.firestore(adminApp!),
    storage: admin.storage(adminApp!),
    auth: admin.auth(adminApp!),
  };
}

function getEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? (n as number) : fallback;
}

// Archive messages older than ARCHIVE_RETENTION_DAYS to GCS as JSONL
// Also delete notifications older than NOTIF_TTL_DAYS
export async function POST(request: NextRequest) {
  try {
    const { db, storage } = getAdmin();

    const now = Date.now();
    const retentionDays = getEnvInt('ARCHIVE_RETENTION_DAYS', 90);
    const notifTtlDays = getEnvInt('NOTIFICATIONS_TTL_DAYS', 45);
    const cutoff = new Date(now - retentionDays * 24 * 60 * 60 * 1000);
    const notifCutoff = new Date(now - notifTtlDays * 24 * 60 * 60 * 1000);
    const bucketName = process.env.ARCHIVE_BUCKET || 'loxconnect-archive';

    const bucket = storage.bucket(bucketName);

    // Page through messages older than cutoff, group by quoteRequestId + month
    const pageSize = 500;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    let totalArchived = 0;
    const batchDeletes: FirebaseFirestore.WriteBatch[] = [];

    // Utility to flush grouped buffers to GCS
    const saveGroups = async (groups: Map<string, string[]>): Promise<void> => {
      const writes: Array<Promise<any>> = [];
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      groups.forEach((lines, key) => {
        if (lines.length === 0) return;
        const filePath = `messages/${key}/part-${timestamp}.jsonl`;
        const file = bucket.file(filePath);
        const contents = lines.join('\n');
        writes.push(file.save(Buffer.from(contents), { contentType: 'application/json' }));
      });
      await Promise.all(writes);
    };

    // Loop over pages
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let query = db.collection('messages')
        .where('createdAt', '<', cutoff)
        .orderBy('createdAt', 'asc')
        .limit(pageSize) as FirebaseFirestore.Query;
      if (lastDoc) query = (query as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>).startAfter(lastDoc);

      const snap = await query.get();
      if (snap.empty) break;

      // Group lines by quoteRequestId/YYYY-MM
      const groups = new Map<string, string[]>();
      const batch = db.batch();

      snap.docs.forEach((doc) => {
        const data = doc.data() as any;
        const createdAt = (data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)) as Date;
        const ym = `${createdAt.getUTCFullYear()}-${String(createdAt.getUTCMonth() + 1).padStart(2, '0')}`;
        const quoteId = data.quoteRequestId || 'unknown';
        const key = `${quoteId}/${ym}`;
        if (!groups.has(key)) groups.set(key, []);
        const line = JSON.stringify({ id: doc.id, ...data, createdAt: createdAt.toISOString() });
        groups.get(key)!.push(line);
        batch.delete(doc.ref);
      });

      await saveGroups(groups);
      await batch.commit();
      totalArchived += snap.size;
      lastDoc = snap.docs[snap.docs.length - 1];
      batchDeletes.push(db.batch());
      if (snap.size < pageSize) break;
    }

    // TTL cleanup for notifications
    let notifDeleted = 0;
    {
      let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let q = db.collection('notifications')
          .where('createdAt', '<', notifCutoff)
          .orderBy('createdAt', 'asc')
          .limit(500) as FirebaseFirestore.Query;
        if (last) q = (q as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>).startAfter(last);
        const s = await q.get();
        if (s.empty) break;
        const b = db.batch();
        s.docs.forEach((d) => b.delete(d.ref));
        await b.commit();
        notifDeleted += s.size;
        last = s.docs[s.docs.length - 1];
        if (s.size < 500) break;
      }
    }

    return NextResponse.json({ ok: true, archivedMessages: totalArchived, deletedNotifications: notifDeleted, bucket: bucketName, cutoff: cutoff.toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}


