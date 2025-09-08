import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { uid } = await req.json();
    if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
    const auth = getAdminAuth();
    const tempPassword = Math.random().toString(36).slice(-10);
    await auth.updateUser(uid, { password: tempPassword });
    return NextResponse.json({ tempPassword });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to reset' }, { status: 500 });
  }
}














