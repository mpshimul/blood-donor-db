import { db } from '@/lib/db';
import { cookies } from 'next/headers';

export async function getSessionDonor(): Promise<{ id: string; role: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { token },
    include: { donor: { select: { id: true, role: true } } },
  });
  if (!session || session.expiresAt < new Date()) {
    if (session) await db.session.delete({ where: { id: session.id } });
    return null;
  }
  return { id: session.donor.id, role: session.donor.role };
}