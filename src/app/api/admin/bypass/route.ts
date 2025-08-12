export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { uid, enabled } = await request.json();
    if (!uid || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Missing uid or enabled' }, { status: 400 });
    }
    const auth = getAdminAuth();
    const user = await auth.getUser(uid);
    const oldClaims = user.customClaims || {};
    const newClaims = { ...oldClaims, one_time_bypass: enabled };
    await auth.setCustomUserClaims(uid, newClaims);
    return NextResponse.json({ ok: true, claims: newClaims });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}


