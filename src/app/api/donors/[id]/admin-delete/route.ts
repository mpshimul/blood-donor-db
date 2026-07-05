import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionDonor } from '@/lib/server-auth';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getSessionDonor();
    if (!auth || auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'অনুমতি নেই' }, { status: 403 });
    }
    await db.donor.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    return NextResponse.json({ error: 'সার্ভার ত্রুটি: ' + msg }, { status: 500 });
  }
}