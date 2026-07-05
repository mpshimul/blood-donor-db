import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionDonor } from '@/lib/server-auth';
import { calcAvailability } from '@/lib/auth';

export async function GET() {
  try {
    const auth = await getSessionDonor();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const donor = await db.donor.findUnique({ where: { id: auth.id } });
    if (!donor) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const avail = calcAvailability(donor.lastDonated);
    return NextResponse.json({
      id: donor.id,
      name: donor.name,
      email: donor.email,
      bloodGroup: donor.bloodGroup,
      phone: donor.phone,
      area: donor.area,
      city: donor.city,
      role: donor.role,
      available: avail.available,
      daysLeft: avail.daysLeft,
      nextAvailableDate: avail.nextAvailableDate,
      lastDonated: donor.lastDonated,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    return NextResponse.json({ error: 'সার্ভার ত্রুটি: ' + msg }, { status: 500 });
  }
}