export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '../../../../lib/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { uid } = await request.json();
    if (!uid || typeof uid !== 'string') {
      return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
    }
    const auth = getAdminAuth();
    const user = await auth.getUser(uid);
    if (!user.email) {
      return NextResponse.json({ error: 'User has no email' }, { status: 400 });
    }
    const link = await auth.generateEmailVerificationLink(user.email);
    return NextResponse.json({ ok: true, link });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}


