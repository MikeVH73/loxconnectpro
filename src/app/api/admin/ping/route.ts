export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';

export async function GET() {
  try {
    await getAdminAuth().listUsers(1);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}


