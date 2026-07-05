import bcrypt from 'bcryptjs';

export const DONATION_WAIT_DAYS = 56;
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export function calcAvailability(lastDonated: Date | null) {
  if (!lastDonated) return { available: true, daysLeft: null as number | null, nextAvailableDate: null as string | null };
  const donated = new Date(lastDonated);
  const nextAvailable = new Date(donated);
  nextAvailable.setDate(nextAvailable.getDate() + DONATION_WAIT_DAYS);
  const now = new Date();
  const diffMs = nextAvailable.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return { available: true, daysLeft: null, nextAvailableDate: null };
  return { available: false, daysLeft: diffDays, nextAvailableDate: nextAvailable.toISOString() };
}

export function donorPublic(d: { id: string; name: string; email: string; bloodGroup: string; phone: string; area: string; city: string; role: string; lastDonated: Date | null }) {
  const a = calcAvailability(d.lastDonated);
  return { id: d.id, name: d.name, bloodGroup: d.bloodGroup, phone: d.phone, area: d.area, city: d.city, role: d.role, available: a.available, daysLeft: a.daysLeft, nextAvailableDate: a.nextAvailableDate, lastDonated: d.lastDonated };
}

export function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

export function setSessionCookie(token: string) {
  return { 'Set-Cookie': `session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}` };
}

export function clearSessionCookie() {
  return { 'Set-Cookie': 'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// In-memory OTP store (for demo mode)
export const otpStore = new Map<string, { code: string; expiresAt: number; verified: boolean }>();
export const OTP_EXPIRY_MS = 5 * 60 * 1000;

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}