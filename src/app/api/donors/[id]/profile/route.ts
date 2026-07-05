import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionDonor } from '@/lib/server-auth';
import { donorPublic } from '@/lib/auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getSessionDonor();
    if (!auth) {
      return NextResponse.json({ error: 'প্রবেশ করুন' }, { status: 401 });
    }
    if (auth.id !== id && auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'আপনার এই কাজ করার অনুমতি নেই' }, { status: 403 });
    }
    const body = await req.json();
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.phone !== undefined) {
      if (body.phone.length !== 11 || !body.phone.startsWith('01')) {
        return NextResponse.json({ error: 'সঠিক বাংলাদেশি ফোন নম্বর দিন' }, { status: 400 });
      }
      updateData.phone = body.phone;
    }
    if (body.area !== undefined) updateData.area = body.area;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.lastDonated !== undefined) {
      updateData.lastDonated = body.lastDonated ? new Date(body.lastDonated) : null;
    }
    const updated = await db.donor.update({ where: { id }, data: updateData });
    return NextResponse.json({ success: true, donor: donorPublic(updated) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    return NextResponse.json({ error: 'সার্ভার ত্রুটি: ' + msg }, { status: 500 });
  }
}