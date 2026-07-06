import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { donorPublic, generateToken, setSessionCookie, verifyPassword, isFirebaseConfigured } from '@/lib/auth';
import { verifyFirebaseToken } from '@/lib/firebase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, firebaseIdToken } = body;

    // ── Firebase auth path ──
    if (firebaseIdToken && isFirebaseConfigured()) {
      const firebaseUser = await verifyFirebaseToken(firebaseIdToken);
      if (!firebaseUser || !firebaseUser.email) {
        return NextResponse.json({ error: 'ফায়ারবেস টোকেন যাচাই করা যায়নি' }, { status: 401 });
      }

      // Find donor by firebaseUid or email
      let donor = await db.donor.findUnique({ where: { firebaseUid: firebaseUser.uid } });
      if (!donor) {
        donor = await db.donor.findUnique({ where: { email: firebaseUser.email } });
      }
      if (!donor) {
        return NextResponse.json({ error: 'এই ইমেইলে কোনো একাউন্ট নেই। নিবন্ধন করুন।' }, { status: 400 });
      }

      // Link firebase UID if not already linked
      if (!donor.firebaseUid) {
        await db.donor.update({ where: { id: donor.id }, data: { firebaseUid: firebaseUser.uid } });
      }

      await db.session.deleteMany({ where: { donorId: donor.id } });
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.session.create({ data: { token, donorId: donor.id, expiresAt } });

      return NextResponse.json({ success: true, donor: donorPublic(donor) }, {
        headers: setSessionCookie(token),
      });
    }

    // ── Fallback: email/password login ──
    if (!email || !password) {
      return NextResponse.json({ error: 'ইমেইল ও পাসওয়ার্ড দিন' }, { status: 400 });
    }
    const donor = await db.donor.findUnique({ where: { email } });
    if (!donor) {
      return NextResponse.json({ error: 'এই ইমেইলে কোনো একাউন্ট নেই' }, { status: 400 });
    }

    // If donor has no password (Firebase-only user), can't login with password
    if (!donor.password) {
      return NextResponse.json({ error: 'এই একাউন্ট ফায়ারবেস দিয়ে তৈরি হয়েছে। ফায়ারবেস দিয়ে লগইন করুন।' }, { status: 400 });
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