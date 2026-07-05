import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionDonor } from '@/lib/server-auth';
import { verifyPassword } from '@/lib/auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getSessionDonor();
    if (!auth) {
      return NextResponse.json({ error: 'প্রবেশ করুন' }, { status: 401 });
    }
    const donor = await db.donor.findUnique({ where: { id } });
    if (!donor) {
      return NextResponse.json({ error: 'দাতা পাওয়া যায়নি' }, { status: 404 });
    }
    if (auth.id !== id && auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'আপনার এই কাজ করার অনুমতি নেই' }, { status: 403 });
    }
    const { password } = await req.json();
    const valid = await verifyPassword(password, donor.password);
    if (!valid) {
      return NextResponse.json({ error: 'ভুল পাসওয়ার্ড' }, { status: 403 });
    }
    await db.donor.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    return NextResponse.json({ error: 'সার্ভার ত্রুটি: ' + msg }, { status: 500 });
  }
}