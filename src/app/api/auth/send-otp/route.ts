import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { otpStore, generateOTP, OTP_EXPIRY_MS, isFirebaseConfigured } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'সঠিক ইমেইল দিন' }, { status: 400 });
    }

    // If Firebase is configured, tell the client to use Firebase instead
    if (isFirebaseConfigured()) {
      return NextResponse.json({
        success: true,
        useFirebase: true,
        message: 'ফায়ারবেস কনফিগার করা আছে, ফায়ারবেস দিয়ে নিবন্ধন করুন',
      });
    }

    const existing = await db.donor.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'এই ইমেইলে ইতিমধ্যে একাউন্ট আছে। দয়া করে লগইন করুন।' }, { status: 400 });
    }
    const code = generateOTP();
    otpStore.set(email, { code, expiresAt: Date.now() + OTP_EXPIRY_MS, verified: false });
    return NextResponse.json({ success: true, sentVia: 'demo', otp: code, message: 'ডেমো মোডে কোড দেখানো হচ্ছে', useFirebase: false });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    return NextResponse.json({ error: 'সার্ভার ত্রুটি: ' + msg }, { status: 500 });
  }
}