import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { BLOOD_GROUPS, otpStore, donorPublic, generateToken, setSessionCookie, hashPassword, isFirebaseConfigured } from '@/lib/auth';
import { verifyFirebaseToken } from '@/lib/firebase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, phone, bloodGroup, area, city, facebookUrl, phoneHidden, firebaseIdToken } = body;

    // ── Firebase auth path ──
    if (firebaseIdToken && isFirebaseConfigured()) {
      const firebaseUser = await verifyFirebaseToken(firebaseIdToken);
      if (!firebaseUser || !firebaseUser.email) {
        return NextResponse.json({ error: 'ফায়ারবেস টোকেন যাচাই করা যায়নি' }, { status: 401 });
      }
      if (firebaseUser.email !== email) {
        return NextResponse.json({ error: 'ফায়ারবেস ইমেইল মিলছে না' }, { status: 400 });
      }

      if (!BLOOD_GROUPS.includes(bloodGroup)) {
        return NextResponse.json({ error: 'সঠিক রক্তের গ্রুপ নির্বাচন করুন' }, { status: 400 });
      }
      if (!name || !phone || !area || !city) {
        return NextResponse.json({ error: 'সব তথ্য পূরণ করুন' }, { status: 400 });
      }
      if (phone.length !== 11 || !phone.startsWith('01')) {
        return NextResponse.json({ error: 'সঠিক বাংলাদেশি ফোন নম্বর দিন' }, { status: 400 });
      }

      const existing = await db.donor.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json({ error: 'এই ইমেইলে ইতিমধ্যে একাউন্ট আছে। দয়া করে লগইন করুন।' }, { status: 400 });
      }

      const donor = await db.donor.create({
        data: {
          email, name, phone, bloodGroup, area, city,
          password: '',
          firebaseUid: firebaseUser.uid,
          facebookUrl: facebookUrl || null,
          phoneHidden: phoneHidden || false,
        }
      });
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.session.create({ data: { token, donorId: donor.id, expiresAt } });

      return NextResponse.json({ success: true, donor: donorPublic(donor) }, {
        headers: setSessionCookie(token),
      });
    }

    // ── Fallback: OTP-verified registration (when Firebase is not configured) ──
    const otpEntry = otpStore.get(email);
    if (!otpEntry || !otpEntry.verified) {
      return NextResponse.json({ error: 'ইমেইল যাচাই করুন' }, { status: 400 });
    }

    if (!BLOOD_GROUPS.includes(bloodGroup)) {
      return NextResponse.json({ error: 'সঠিক রক্তের গ্রুপ নির্বাচন করুন' }, { status: 400 });
    }
    if (!name || !phone || !area || !city || !password) {
      return NextResponse.json({ error: 'সব তথ্য পূরণ করুন' }, { status: 400 });
    }
    if (phone.length !== 11 || !phone.startsWith('01')) {
      return NextResponse.json({ error: 'সঠিক বাংলাদেশি ফোন নম্বর দিন' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' }, { status: 400 });
    }

    const hashedPassword = await hashPassword(password);
    const donor = await db.donor.create({
      data: {
        email, name, phone, bloodGroup, area, city,
        password: hashedPassword,
        facebookUrl: facebookUrl || null,
        phoneHidden: phoneHidden || false,
      }
    });
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.session.create({ data: { token, donorId: donor.id, expiresAt } });
    otpStore.delete(email);

    return NextResponse.json({ success: true, donor: donorPublic(donor) }, {
      headers: setSessionCookie(token),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    return NextResponse.json({ error: 'সার্ভার ত্রুটি: ' + msg }, { status: 500 });
  }
}