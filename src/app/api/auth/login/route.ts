import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { donorPublic, generateToken, setSessionCookie, verifyPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'ইমেইল ও পাসওয়ার্ড দিন' }, { status: 400 });
    }
    const donor = await db.donor.findUnique({ where: { email } });
    if (!donor) {
      return NextResponse.json({ error: 'এই ইমেইলে কোনো একাউন্ট নেই' }, { status: 400 });
    }
    const valid = await verifyPassword(password, donor.password);
    if (!valid) {
      return NextResponse.json({ error: 'ভুল পাসওয়ার্ড' }, { status: 400 });
    }
    await db.session.deleteMany({ where: { donorId: donor.id } });
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.session.create({ data: { token, donorId: donor.id, expiresAt } });
    return NextResponse.json({ success: true, donor: donorPublic(donor) }, {
      headers: setSessionCookie(token),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    return NextResponse.json({ error: 'সার্ভার ত্রুটি: ' + msg }, { status: 500 });
  }
}