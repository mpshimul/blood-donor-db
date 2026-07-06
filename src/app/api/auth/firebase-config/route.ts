import { NextResponse } from 'next/server';
import { isFirebaseConfigured } from '@/lib/auth';

export async function GET() {
  return NextResponse.json({
    firebaseEnabled: isFirebaseConfigured(),
    hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    hasAuthDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    hasAdminConfig: !!(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY),
  });
}