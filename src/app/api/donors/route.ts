import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calcAvailability } from '@/lib/auth';

export async function GET() {
  try {
    const donors = await db.donor.findMany({ orderBy: { createdAt: 'desc' } });
    const total = donors.length;
    const donorAvail = donors.map(d => {
      const a = calcAvailability(d.lastDonated);
      return {
        id: d.id, name: d.name, bloodGroup: d.bloodGroup, phone: d.phone,
        area: d.area, city: d.city, available: a.available,
        daysLeft: a.daysLeft, nextAvailableDate: a.nextAvailableDate,
        lastDonated: d.lastDonated,
      };
    });
    const available = donorAvail.filter(d => d.available).length;
    const cities = new Set(donors.map(d => d.city)).size;
    return NextResponse.json({ donors: donorAvail, stats: { total, available, cities } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    return NextResponse.json({ error: 'সার্ভার ত্রুটি: ' + msg }, { status: 500 });
  }
}