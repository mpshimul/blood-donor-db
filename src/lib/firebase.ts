import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

let firebaseApp: App | null = null;
let firebaseAuth: Auth | null = null;

export function getFirebaseAuth(): Auth | null {
  // Check if Firebase env vars are configured
  if (!process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    return null;
  }

  if (!firebaseApp) {
    try {
      // Parse the private key - handle escaped newlines from env vars
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

      firebaseApp = initializeApp({
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
          privateKey,
        }),
      });
      firebaseAuth = getAuth(firebaseApp);
    } catch (err) {
      console.error('Firebase init error:', err);
      return null;
    }
  }

  return firebaseAuth;
}

export async function verifyFirebaseToken(idToken: string): Promise<{ uid: string; email: string | null } | null> {
  const auth = getFirebaseAuth();
  if (!auth) return null;

  try {
    const decodedToken = await auth.verifyIdToken(idToken, true);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
  } catch {
    return null;
  }
}