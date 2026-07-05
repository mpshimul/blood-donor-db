import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clearSessionCookie } from '@/lib/auth';
import { getSessionDonor } from '@/lib/server-auth';

export async function POST() {
  try {
    const auth = await getSessionDonor();
    if (auth) {
      await db.session.deleteMany({ where: { donorId: auth.id } }).catch(() => {});
    }
    return NextResponse.json({ success: true }, { headers: clearSessionCookie() });
  } catch {
    return NextResponse.json({ success: true }, { headers: clearSessionCookie() });
  }
}