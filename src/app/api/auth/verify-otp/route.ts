import { NextRequest, NextResponse } from 'next/server';
import { otpStore } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();
    const entry = otpStore.get(email);
    if (!entry) {
      return NextResponse.json({ error: 'প্রথমে ভেরিফিকেশন কোড পাঠান' }, { status: 400 });
    }
    if (Date.now() > entry.expiresAt) {
      otpStore.delete(email);
      return NextResponse.json({ error: 'কোডের মেয়াদ উত্তীর্ণ হয়েছে, আবার পাঠান' }, { status: 400 });
    }
    if (entry.code !== code) {
      return NextResponse.json({ error: 'ভুল কোড' }, { status: 400 });
    }
    entry.verified = true;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    return NextResponse.json({ error: 'সার্ভার ত্রুটি: ' + msg }, { status: 500 });
  }
}