'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { BLOOD_GROUPS } from '@/lib/auth';

// ─── Types ───
interface DonorPublic {
  id: string;
  name: string;
  bloodGroup: string;
  phone: string;
  area: string;
  city: string;
  role?: string;
  available: boolean;
  daysLeft: number | null;
  nextAvailableDate: string | null;
  lastDonated: string | null;
  facebookUrl: string | null;
  phoneHidden: boolean;
}

interface DonorMe extends DonorPublic {
  email: string;
  firebaseUid?: string | null;
}

interface Stats {
  total: number;
  available: number;
  cities: number;
}

interface FirebaseConfig {
  firebaseEnabled: boolean;
  hasApiKey: boolean;
  hasAuthDomain: boolean;
  hasProjectId: boolean;
  hasAdminConfig: boolean;
}

type Page = 'home' | 'register' | 'login' | 'profile' | 'admin';

// ─── Firebase dynamic import helpers ───
let _firebaseAuth: typeof import('firebase/auth') | null = null;
async function getFirebaseAuthModule() {
  if (!_firebaseAuth) {
    _firebaseAuth = await import('firebase/auth');
  }
  return _firebaseAuth;
}

// ─── Helpers ───
function toBanglaNum(num: number | null | undefined): string {
  if (num == null) return '';
  const bd = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num.toString().replace(/\d/g, (d) => bd[parseInt(d)]);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'কখনো না';
  const d = new Date(dateStr);
  return `${toBanglaNum(d.getDate())}/${toBanglaNum(d.getMonth() + 1)}/${toBanglaNum(d.getFullYear())}`;
}

function formatNextAvailable(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${toBanglaNum(d.getDate())}/${toBanglaNum(d.getMonth() + 1)}/${toBanglaNum(d.getFullYear())}`;
}

function normalizeFacebookUrl(url: string): string {
  if (!url) return '';
  // Remove trailing slashes, add https if missing
  let normalized = url.trim().replace(/\/+$/, '');
  if (!normalized.startsWith('http')) {
    normalized = 'https://' + normalized;
  }
  return normalized;
}

// ─── Toast Component ───
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info' | 'warn'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = { success: 'bg-green-500', error: 'bg-red-500', info: 'bg-blue-500', warn: 'bg-amber-500' };
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warn: '⚠️' };

  return (
    <div className={`fixed top-5 right-5 z-[9999] ${colors[type]} text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-slide-down`}>
      <span>{icons[type]}</span>
      <span>{message}</span>
    </div>
  );
}

// ─── Toggle Switch Component ───
function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (val: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-3 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div className="relative" onClick={() => { if (!disabled) onChange(!checked); }}>
        <div className={`w-11 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
          <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-5' : ''}`} />
        </div>
      </div>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
    </label>
  );
}

// ─── Main App ───
export default function BloodDonorApp() {
  const { theme, setTheme } = useTheme();
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [currentUser, setCurrentUser] = useState<DonorMe | null>(null);
  const [allDonors, setAllDonors] = useState<DonorPublic[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [currentFilter, setCurrentFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warn' } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [firebaseConfig, setFirebaseConfig] = useState<FirebaseConfig | null>(null);
  const [firebaseAppInitialized, setFirebaseAppInitialized] = useState(false);

  // Registration state
  const [regStep, setRegStep] = useState(1);
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regOtpVerified, setRegOtpVerified] = useState(false);
  const [demoOtp, setDemoOtp] = useState('');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regBloodGroup, setRegBloodGroup] = useState('');
  const [regArea, setRegArea] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regOtpInput, setRegOtpInput] = useState('');
  const [regFacebookUrl, setRegFacebookUrl] = useState('');
  const [regPhoneHidden, setRegPhoneHidden] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Edit profile state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editLastDonated, setEditLastDonated] = useState('');
  const [editFacebookUrl, setEditFacebookUrl] = useState('');
  const [editPhoneHidden, setEditPhoneHidden] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');

  const [loading, setLoading] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warn' = 'success') => {
    setToast({ message, type });
  }, []);

  const closeToast = useCallback(() => { setToast(null); }, []);

  // ─── Firebase Init ───
  const initFirebase = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/firebase-config');
      const config: FirebaseConfig = await res.json();
      setFirebaseConfig(config);

      if (!config.firebaseEnabled || !config.hasApiKey) return;

      // Dynamic import firebase
      const firebaseModule = await import('firebase/app');
      const { getApps, initializeApp } = firebaseModule;
      if (getApps().length > 0) {
        setFirebaseAppInitialized(true);
        return;
      }
      initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
      });
      setFirebaseAppInitialized(true);
    } catch {
      // Firebase not available
    }
  }, []);

  // ─── Auth ───
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
      }
    } catch { /* not logged in */ }
  }, []);

  const loadDonors = useCallback(async () => {
    try {
      const res = await fetch('/api/donors');
      if (res.ok) {
        const data = await res.json();
        setAllDonors(data.donors || []);
        setStats(data.stats || null);
      }
    } catch { /* error */ }
  }, []);

  useEffect(() => {
    if (mounted) {
      initFirebase();
      checkAuth();
      loadDonors();
    }
  }, [mounted, initFirebase, checkAuth, loadDonors]);

  // ─── Page Navigation ───
  const showPage = useCallback((page: Page) => {
    setCurrentPage(page);
    if (page === 'home') loadDonors();
    if (page === 'profile') checkAuth();
    if (page === 'admin') loadDonors();
    window.scrollTo(0, 0);
  }, [loadDonors, checkAuth]);

  // ─── Registration ───
  async function startRegistration() {
    if (!regEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) {
      showToast('সঠিক ইমেইল দিন', 'error'); return;
    }

    // Firebase path
    if (firebaseConfig?.firebaseEnabled && firebaseAppInitialized) {
      if (!regPassword || regPassword.length < 6) {
        showToast('কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন', 'error'); return;
      }
      setLoading(true);
      try {
        const { getAuth, createUserWithEmailAndPassword } = await getFirebaseAuthModule();
        const auth = getAuth();
        const cred = await createUserWithEmailAndPassword(auth, regEmail, regPassword);
        const idToken = await cred.user.getIdToken();

        // Check if email already registered
        const checkRes = await fetch('/api/auth/send-otp', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: regEmail }),
        });
        const checkData = await checkRes.json();
        if (checkRes.ok && !checkData.useFirebase) {
          // Email already exists
          showToast('এই ইমেইলে ইতিমধ্যে একাউন্ট আছে। দয়া করে লগইন করুন।', 'error');
          // Delete the Firebase user we just created (cleanup)
          try { await cred.user.delete(); } catch {}
          return;
        }

        setRegStep(3);
        showToast('ফায়ারবেসে একাউন্ট তৈরি হয়েছে!');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'সমস্যা হয়েছে';
        if (msg.includes('email-already-in-use')) {
          showToast('এই ইমেইলে ইতিমধ্যে ফায়ারবেস একাউন্ট আছে। লগইন করুন।', 'error');
        } else if (msg.includes('weak-password')) {
          showToast('পাসওয়ার্ড দুর্বল, কমপক্ষে ৬ অক্ষর দিন', 'error');
        } else if (msg.includes('invalid-email')) {
          showToast('সঠিক ইমেইল দিন', 'error');
        } else {
          showToast('ফায়ারবেস ত্রুটি: ' + msg, 'error');
        }
      } finally { setLoading(false); }
      return;
    }

    // Fallback: OTP path
    if (!regPassword || regPassword.length < 6) {
      showToast('কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন', 'error'); return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error, 'error'); return; }
      if (data.useFirebase) {
        showToast('ফায়ারবেস কনফিগার করা আছে, কিন্তু ক্লায়েন্ট লোড হয়নি। পৃষ্ঠা রিফ্রেশ করুন।', 'warn');
        return;
      }
      setDemoOtp(data.otp);
      setRegStep(2);
      showToast(data.message || 'ভেরিফিকেশন কোড তৈরি হয়েছে');
    } catch { showToast('সংযোগে সমস্যা', 'error'); }
    finally { setLoading(false); }
  }

  async function verifyDemoOTP() {
    if (!regOtpInput || regOtpInput.length !== 6) {
      showToast('৬ সংখ্যার কোড দিন', 'error'); return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail, code: regOtpInput }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error, 'error'); return; }
      setRegOtpVerified(true);
      setRegStep(3);
      showToast('ইমেইল যাচাই সফল!');
    } catch { showToast('সংযোগে সমস্যা', 'error'); }
    finally { setLoading(false); }
  }

  async function completeRegistration() {
    if (!regName) { showToast('নাম দিন', 'error'); return; }
    if (!regPhone || regPhone.length !== 11 || !regPhone.startsWith('01')) { showToast('সঠিক বাংলাদেশি ফোন নম্বর দিন', 'error'); return; }
    if (!regBloodGroup) { showToast('রক্তের গ্রুপ নির্বাচন করুন', 'error'); return; }
    if (!regArea) { showToast('এলাকা দিন', 'error'); return; }
    if (!regCity) { showToast('শহর দিন', 'error'); return; }
    if (regPhoneHidden && !normalizeFacebookUrl(regFacebookUrl)) { showToast('ফোন গোপন করতে হলে ফেসবুক প্রোফাইল লিংক দিতে হবে', 'error'); return; }
    setLoading(true);
    try {
      let body: Record<string, unknown> = {
        email: regEmail, password: regPassword, name: regName,
        phone: regPhone, bloodGroup: regBloodGroup, area: regArea, city: regCity,
        facebookUrl: normalizeFacebookUrl(regFacebookUrl) || null,
        phoneHidden: regPhoneHidden,
      };

      // If Firebase is active, get the ID token
      if (firebaseConfig?.firebaseEnabled && firebaseAppInitialized) {
        try {
          const { getAuth } = await getFirebaseAuthModule();
          const auth = getAuth();
          const user = auth.currentUser;
          if (user) {
            const idToken = await user.getIdToken();
            body.firebaseIdToken = idToken;
            delete body.password; // No need to send password to our server
          }
        } catch {}
      }

      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error, 'error'); return; }
      setCurrentUser(data.donor);
      showToast('নিবন্ধন সফল! স্বাগতম, ' + data.donor.name);
      resetRegForm();
      showPage('home');
    } catch { showToast('সংযোগে সমস্যা', 'error'); }
    finally { setLoading(false); }
  }

  function resetRegForm() {
    setRegEmail(''); setRegPassword(''); setRegOtpVerified(false); setRegStep(1);
    setRegName(''); setRegPhone(''); setRegBloodGroup(''); setRegArea(''); setRegCity('');
    setRegOtpInput(''); setRegFacebookUrl(''); setRegPhoneHidden(false); setDemoOtp('');
  }

  // ─── Login ───
  async function loginUser() {
    if (!loginEmail || !loginPassword) { showToast('ইমেইল ও পাসওয়ার্ড দিন', 'error'); return; }

    // Firebase path
    if (firebaseConfig?.firebaseEnabled && firebaseAppInitialized) {
      setLoading(true);
      try {
        const { getAuth, signInWithEmailAndPassword } = await getFirebaseAuthModule();
        const auth = getAuth();
        const cred = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
        const idToken = await cred.user.getIdToken();

        const res = await fetch('/api/auth/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: loginEmail, firebaseIdToken: idToken }),
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error, 'error'); return; }
        setCurrentUser(data.donor);
        showToast('স্বাগতম, ' + data.donor.name + '!');
        setLoginEmail(''); setLoginPassword('');
        showPage('home');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'সমস্যা হয়েছে';
        if (msg.includes('user-not-found') || msg.includes('invalid-credential')) {
          showToast('ইমেইল বা পাসওয়ার্ড ভুল', 'error');
        } else if (msg.includes('wrong-password') || msg.includes('invalid-email')) {
          showToast('ইমেইল বা পাসওয়ার্ড ভুল', 'error');
        } else {
          showToast('ফায়ারবেস ত্রুটি: ' + msg, 'error');
        }
      } finally { setLoading(false); }
      return;
    }

    // Fallback: email/password
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error, 'error'); return; }
      setCurrentUser(data.donor);
      showToast('স্বাগতম, ' + data.donor.name + '!');
      setLoginEmail(''); setLoginPassword('');
      showPage('home');
    } catch { showToast('সংযোগে সমস্যা', 'error'); }
    finally { setLoading(false); }
  }

  // ─── Logout ───
  async function logout() {
    // Sign out from Firebase if active
    if (firebaseConfig?.firebaseEnabled && firebaseAppInitialized) {
      try {
        const { getAuth, signOut: firebaseSignOut } = await getFirebaseAuthModule();
        await firebaseSignOut(getAuth());
      } catch {}
    }
    await fetch('/api/auth/logout', { method: 'POST' });
    setCurrentUser(null);
    showToast('সফলভাবে বের হয়েছেন');
    showPage('home');
  }

  // ─── Edit Profile ───
  function openEditModal() {
    if (!currentUser) return;
    setEditName(currentUser.name || '');
    setEditPhone(currentUser.phone || '');
    setEditArea(currentUser.area || '');
    setEditCity(currentUser.city || '');
    setEditLastDonated(currentUser.lastDonated ? currentUser.lastDonated.split('T')[0] : '');
    setEditFacebookUrl(currentUser.facebookUrl || '');
    setEditPhoneHidden(currentUser.phoneHidden || false);
    setShowEditModal(true);
  }

  async function saveProfile() {
    if (!currentUser) return;
    if (!editName) { showToast('নাম দিন', 'error'); return; }
    if (!editPhone || editPhone.length !== 11 || !editPhone.startsWith('01')) { showToast('সঠিক বাংলাদেশি ফোন নম্বর দিন', 'error'); return; }
    if (!editArea) { showToast('এলাকা দিন', 'error'); return; }
    if (!editCity) { showToast('শহর দিন', 'error'); return; }
    if (editPhoneHidden && !normalizeFacebookUrl(editFacebookUrl)) { showToast('ফোন গোপন করতে হলে ফেসবুক প্রোফাইল লিংক দিতে হবে', 'error'); return; }
    setLoading(true);
    try {
      const body: Record<string, string | boolean> = {
        name: editName, phone: editPhone, area: editArea, city: editCity,
        facebookUrl: normalizeFacebookUrl(editFacebookUrl) || '',
        phoneHidden: editPhoneHidden,
      };
      if (editLastDonated) body.lastDonated = editLastDonated;
      const res = await fetch(`/api/donors/${currentUser.id}/profile`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error, 'error'); return; }
      setCurrentUser(data.donor);
      setShowEditModal(false);
      showToast('প্রোফাইল আপডেট হয়েছে!');
      checkAuth();
    } catch { showToast('সংযোগে সমস্যা', 'error'); }
    finally { setLoading(false); }
  }

  // ─── Delete ───
  function openDeleteModal(id: string) {
    setDeleteTargetId(id);
    setDeletePassword('');
    setShowDeleteModal(true);
  }

  async function confirmDelete() {
    const targetId = deleteTargetId;
    if (!targetId) return;

    // Check if user is Firebase-only (no password stored)
    const isFirebaseUser = !!currentUser?.firebaseUid;
    if (!isFirebaseUser && !deletePassword) {
      showToast('পাসওয়ার্ড দিন', 'error'); return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/donors/${targetId}/delete`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword || '' }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error, 'error'); return; }
      setShowDeleteModal(false);
      showToast('একাউন্ট মুছে ফেলা হয়েছে');
      if (currentUser && currentUser.id === targetId) {
        setCurrentUser(null);
        showPage('home');
      } else {
        loadDonors();
      }
    } catch { showToast('সমস্যা হয়েছে', 'error'); }
    finally { setLoading(false); }
  }

  // ─── Admin Delete ───
  async function adminDeleteDonor(id: string, name: string) {
    if (!confirm(name + ' এর একাউন্ট মুছে ফেলতে চান?')) return;
    try {
      const res = await fetch(`/api/donors/${id}/admin-delete`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); showToast(d.error, 'error'); return; }
      showToast(name + ' এর একাউন্ট মুছে ফেলা হয়েছে');
      loadDonors();
    } catch { showToast('সমস্যা হয়েছে', 'error'); }
  }

  // ─── Filter & Search ───
  const filteredDonors = allDonors.filter(d => {
    if (currentFilter !== 'all' && d.bloodGroup !== currentFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return d.name.toLowerCase().includes(q) || d.area.toLowerCase().includes(q) || d.city.toLowerCase().includes(q) || d.phone.includes(q);
    }
    return true;
  });

  const useFirebase = firebaseConfig?.firebaseEnabled && firebaseAppInitialized;

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">🩸</div>
          <p className="text-gray-500 dark:text-gray-400 text-lg">রক্তদাতা ডাটাবেস লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  const isDark = theme === 'dark';

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}

      {/* ─── NAV ─── */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => showPage('home')}>
            <span className="text-2xl animate-pulse">🩸</span>
            <span className="text-lg font-bold text-gray-800 dark:text-gray-100">রক্তদাতা ডাটাবেস</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button onClick={() => showPage('home')} className="px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-600 dark:text-gray-300 hover:text-red-600 transition font-medium">হোম</button>
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition" title="ডার্ক মোড">
              {isDark ? '☀️' : '🌙'}
            </button>
            {!currentUser ? (
              <div className="flex gap-2">
                <button onClick={() => showPage('login')} className="px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition font-medium">প্রবেশ</button>
                <button onClick={() => showPage('register')} className="bg-gradient-to-r from-red-600 to-red-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:from-red-700 hover:to-red-600 transition">নিবন্ধন</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => showPage('profile')} className="px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-600 dark:text-gray-300 hover:text-red-600 transition font-medium">আমার প্রোফাইল</button>
                {currentUser.role === 'ADMIN' && (
                  <button onClick={() => showPage('admin')} className="px-3 py-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:text-amber-800 transition font-medium">অ্যাডমিন</button>
                )}
                <button onClick={logout} className="px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition font-medium">বের হোন</button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">

        {/* ─── HOME PAGE ─── */}
        {currentPage === 'home' && (
          <div>
            <div className="text-center mb-8 animate-[fadeUp_0.4s_ease-out_both]">
              <div className="text-5xl mb-3 animate-pulse">🩸</div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 dark:text-gray-100 mb-2">রক্তদাতা খুঁজুন</h1>
              <p className="text-gray-500 dark:text-gray-400 text-lg">জরুরি রক্তের প্রয়োজনে দ্রুত রক্তদাতা খুঁজে নিন</p>
              {stats && (
                <div className="flex justify-center gap-6 mt-4 text-sm text-gray-500 dark:text-gray-400">
                  <span>👤 মোট <strong className="text-red-600 dark:text-red-400">{toBanglaNum(stats.total)}</strong> জন</span>
                  <span>✅ সক্রিয় <strong className="text-green-600 dark:text-green-400">{toBanglaNum(stats.available)}</strong> জন</span>
                  <span>📍 <strong className="text-gray-700 dark:text-gray-300">{toBanglaNum(stats.cities)}</strong> শহর</span>
                </div>
              )}
            </div>

            <div className="mb-6 animate-[fadeUp_0.4s_ease-out_both]" style={{ animationDelay: '0.1s' }}>
              <div className="flex flex-wrap gap-2 justify-center mb-4">
                <button onClick={() => setCurrentFilter('all')} className={`px-4 py-2 rounded-full text-sm font-semibold transition ${currentFilter === 'all' ? 'bg-red-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-red-300 hover:text-red-600'}`}>সব</button>
                {BLOOD_GROUPS.map(g => (
                  <button key={g} onClick={() => setCurrentFilter(g)} className={`px-4 py-2 rounded-full text-sm font-semibold transition ${currentFilter === g ? 'bg-red-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-red-300 hover:text-red-600'}`}>{g}</button>
                ))}
              </div>
              <div className="relative max-w-md mx-auto">
                <input type="text" placeholder="নাম, এলাকা বা শহর দিয়ে খুঁজুন..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 pr-10 text-gray-800 dark:text-gray-100 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10 transition" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDonors.length === 0 ? (
                <div className="col-span-full text-center py-16 text-gray-400">
                  <div className="text-5xl mb-3">😔</div>
                  <p className="text-lg">কোনো রক্তদাতা পাওয়া যায়নি</p>
                </div>
              ) : filteredDonors.map((d, i) => {
                const isOwner = currentUser?.id === d.id;
                const isAdmin = currentUser?.role === 'ADMIN';
                const canModify = isOwner || isAdmin;
                return (
                  <div key={d.id} className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 transition-all hover:-translate-y-0.5 hover:shadow-lg animate-[fadeUp_0.4s_ease-out_both] ${d.available ? 'border-l-4 border-l-green-400' : 'border-l-4 border-l-amber-300 opacity-80'}`} style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-500 font-bold text-sm">{d.name.charAt(0)}</div>
                        <div>
                          <h3 className="font-bold text-gray-800 dark:text-gray-100">{d.name}</h3>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">{d.bloodGroup}</span>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${d.available ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                        {d.available ? '✅ সক্রিয়' : `⏰ আরও ${toBanglaNum(d.daysLeft)} দিন`}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-500 dark:text-gray-400">
                      {/* Phone or Facebook contact */}
                      {d.phoneHidden ? (
                        d.facebookUrl ? (
                          <p>📘 <a href={d.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 font-medium hover:underline">ফেসবুকে যোগাযোগ করুন</a> <span className="text-xs text-gray-400">(ফোন গোপন)</span></p>
                        ) : (
                          <p className="text-gray-400 text-xs">⚠️ যোগাযোগের তথ্য গোপন</p>
                        )
                      ) : (
                        <p>📞 <a href={`tel:${d.phone}`} className="text-gray-700 dark:text-gray-200 hover:text-red-600 font-medium">{d.phone}</a></p>
                      )}
                      <p>📍 {d.area}, {d.city}</p>
                      <p>📅 সর্বশেষ দান: {formatDate(d.lastDonated)}</p>
                      {d.daysLeft && <p className="text-amber-600 dark:text-amber-400 font-medium">পরবর্তী দান যাবে: {formatNextAvailable(d.nextAvailableDate)}</p>}
                    </div>
                    {canModify && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        {isOwner && <button onClick={() => showPage('profile')} className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition">✉ প্রোফাইল</button>}
                        <button onClick={() => openDeleteModal(d.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition">🗑️ মুছুন</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── REGISTER PAGE ─── */}
        {currentPage === 'register' && (
          <div className="max-w-md mx-auto">
            <div className="text-center mb-6 animate-[fadeUp_0.4s_ease-out_both]">
              <div className="text-4xl mb-2">🩸</div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">রক্তদাতা হিসেবে নিবন্ধন করুন</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                {useFirebase ? 'ফায়ারবেস দিয়ে নিবন্ধন করুন' : 'মাত্র ৩টি ধাপে সম্পন্ন করুন'}
              </p>
            </div>

            {/* Step indicators */}
            {useFirebase ? (
              <div className="flex items-center justify-center gap-3 mb-6">
                {[1, 2].map(s => (
                  <div key={s} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${s < regStep ? 'bg-green-500 text-white' : s === regStep ? 'bg-red-500 text-white scale-110' : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'}`}>
                      {s < regStep ? '✓' : toBanglaNum(s)}
                    </div>
                    {s < 2 && <div className={`w-8 h-0.5 ${s < regStep ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-600'}`} />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3 mb-6">
                {[1, 2, 3].map(s => (
                  <div key={s} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${s < regStep ? 'bg-green-500 text-white' : s === regStep ? 'bg-red-500 text-white scale-110' : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'}`}>
                      {s < regStep ? '✓' : toBanglaNum(s)}
                    </div>
                    {s < 3 && <div className={`w-8 h-0.5 ${s < regStep ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-600'}`} />}
                  </div>
                ))}
              </div>
            )}

            {/* Step 1: Email + Password */}
            {regStep === 1 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4 animate-[fadeUp_0.4s_ease-out_both]">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">📧 ইমেইল</label>
                  <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-800 dark:text-gray-100 outline-none focus:border-red-500 transition" placeholder="example@gmail.com" />
                  <p className="text-xs text-gray-400 mt-1">
                    {useFirebase ? 'ফায়ারবেস দিয়ে একাউন্ট তৈরি হবে' : 'আপনার ইমেইলে একটি ভেরিফিকেশন কোড পাঠানো হবে'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">🔒 পাসওয়ার্ড</label>
                  <input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-800 dark:text-gray-100 outline-none focus:border-red-500 transition" placeholder="কমপক্ষে ৬ অক্ষর" />
                </div>
                <button onClick={startRegistration} disabled={loading} className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-700 hover:to-red-600 disabled:opacity-60 transition">
                  {loading ? 'প্রক্রিয়া চলছে...' : 'এগিয়ে যান'}
                </button>
                <p className="text-center text-sm text-gray-500 dark:text-gray-400">ইতিমধ্যে একাউন্ট আছে? <button onClick={() => showPage('login')} className="text-red-600 font-semibold hover:underline">প্রবেশ করুন</button></p>
              </div>
            )}

            {/* Step 2: OTP verification (only in demo/fallback mode) */}
            {regStep === 2 && !useFirebase && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 animate-[fadeUp_0.4s_ease-out_both]">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">🔐 ভেরিফিকেশন কোড</label>
                <p className="text-xs text-gray-400 mb-3">নিচের ৬ সংখ্যার কোডটি লিখুন</p>
                <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs p-3 rounded-lg mb-3">
                  ⚠️ <strong>ডেমো মোড:</strong> ফায়ারবেস কনফিগার করলে ইমেইলে কোড যাবে। ডেমোতে কোড: <strong>{demoOtp}</strong>
                </div>
                <input type="text" value={regOtpInput} onChange={e => setRegOtpInput(e.target.value.replace(/[^0-9]/g, ''))} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-center text-2xl tracking-[0.5em] mb-4 text-gray-800 dark:text-gray-100 outline-none focus:border-red-500 transition" placeholder="• • • • • •" maxLength={6} />
                <div className="flex gap-3">
                  <button onClick={() => setRegStep(1)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition">বাতিল</button>
                  <button onClick={verifyDemoOTP} disabled={loading} className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-700 hover:to-red-600 disabled:opacity-60 transition">{loading ? 'যাচাই হচ্ছে...' : 'যাচাই করুন'}</button>
                </div>
              </div>
            )}

            {/* Step 3: Profile info (step 2 in Firebase mode, step 3 in OTP mode) */}
            {regStep === 3 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4 animate-[fadeUp_0.4s_ease-out_both]">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">👤 আপনার নাম</label>
                  <input type="text" value={regName} onChange={e => setRegName(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-800 dark:text-gray-100 outline-none focus:border-red-500 transition" placeholder="পূর্ণ নাম" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">📱 মোবাইল নম্বর</label>
                  <input type="tel" value={regPhone} onChange={e => setRegPhone(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-800 dark:text-gray-100 outline-none focus:border-red-500 transition" placeholder="০১XXXXXXXXX" maxLength={11} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">🩸 রক্তের গ্রুপ</label>
                  <div className="grid grid-cols-4 gap-2">
                    {BLOOD_GROUPS.map(g => (
                      <button key={g} type="button" onClick={() => setRegBloodGroup(g)} className={`py-2 rounded-lg text-sm font-semibold border transition ${regBloodGroup === g ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-red-300 hover:text-red-600'}`}>{g}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">📍 এলাকা</label>
                    <input type="text" value={regArea} onChange={e => setRegArea(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-800 dark:text-gray-100 outline-none focus:border-red-500 transition" placeholder="ধানমন্ডি" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">🏙️ শহর</label>
                    <input type="text" value={regCity} onChange={e => setRegCity(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-800 dark:text-gray-100 outline-none focus:border-red-500 transition" placeholder="ঢাকা" />
                  </div>
                </div>

                {/* ── Facebook URL + Phone Hidden ── */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">📘 ফেসবুক প্রোফাইল লিংক <span className="text-xs text-gray-400 font-normal">(ঐচ্ছিক)</span></label>
                  <input type="url" value={regFacebookUrl} onChange={e => setRegFacebookUrl(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-800 dark:text-gray-100 outline-none focus:border-red-500 transition" placeholder="https://facebook.com/your.profile" />
                  <p className="text-xs text-gray-400 mt-1">ফোন গোপন করলে মানুষ ফেসবুকে যোগাযোগ করতে পারবে</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                  <Toggle
                    checked={regPhoneHidden}
                    onChange={setRegPhoneHidden}
                    label="🔒 ফোন নম্বর গোপন রাখুন"
                    disabled={!normalizeFacebookUrl(regFacebookUrl)}
                  />
                  {!normalizeFacebookUrl(regFacebookUrl) && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 ml-14">
                      ⚠️ ফোন গোপন করতে হলে আগে উপরে ফেসবুক লিংক দিন
                    </p>
                  )}
                  {regPhoneHidden && normalizeFacebookUrl(regFacebookUrl) && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2 ml-14">
                      ✅ ফেসবুক লিংক দেওয়া আছে — মানুষ ফেসবুকে যোগাযোগ করতে পারবে
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setRegStep(useFirebase ? 1 : 2)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition">পেছনে</button>
                  <button onClick={completeRegistration} disabled={loading} className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-700 hover:to-red-600 disabled:opacity-60 transition animate-[pulse-glow_2s_ease-in-out_infinite]">{loading ? 'সম্পন্ন হচ্ছে...' : 'নিবন্ধন সম্পন্ন করুন'}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── LOGIN PAGE ─── */}
        {currentPage === 'login' && (
          <div className="max-w-md mx-auto animate-[fadeUp_0.4s_ease-out_both]">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🔐</div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">প্রবেশ করুন</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">আপনার একাউন্টে প্রবেশ করুন</p>
              {useFirebase && (
                <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">🔥 ফায়ারবেস সক্রিয়</span>
              )}
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">📧 ইমেইল</label>
                <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-800 dark:text-gray-100 outline-none focus:border-red-500 transition" placeholder="example@gmail.com" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">🔒 পাসওয়ার্ড</label>
                <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && loginUser()} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-800 dark:text-gray-100 outline-none focus:border-red-500 transition" placeholder="পাসওয়ার্ড" />
              </div>
              <button onClick={loginUser} disabled={loading} className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-700 hover:to-red-600 disabled:opacity-60 transition">
                {loading ? 'প্রবেশ করা হচ্ছে...' : 'প্রবেশ'}
              </button>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">একাউন্ট নেই? <button onClick={() => showPage('register')} className="text-red-600 font-semibold hover:underline">নিবন্ধন করুন</button></p>
            </div>
          </div>
        )}

        {/* ─── PROFILE PAGE ─── */}
        {currentPage === 'profile' && currentUser && (
          <div className="max-w-lg mx-auto animate-[fadeUp_0.4s_ease-out_both]">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-8 text-white">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">{currentUser.name.charAt(0)}</div>
                  <div>
                    <h2 className="text-xl font-bold">{currentUser.name}</h2>
                    <p className="text-red-100">{currentUser.bloodGroup} &bull; {currentUser.area}, {currentUser.city}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold ${currentUser.role === 'ADMIN' ? 'bg-amber-400 text-amber-900' : 'bg-white/20 text-white'}`}>
                      {currentUser.role === 'ADMIN' ? '🛡️ অ্যাডমিন' : '👤 সাধারণ ব্যবহারকারী'}
                    </span>
                    {currentUser.firebaseUid && (
                      <span className="inline-block mt-1 ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-blue-400/30 text-blue-100">🔥 Firebase</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: '📧 ইমেইল', value: currentUser.email, full: true },
                    { label: '📞 ফোন', value: currentUser.phone + (currentUser.phoneHidden ? ' (গোপন)' : '') },
                    { label: '🩸 রক্তের গ্রুপ', value: currentUser.bloodGroup, red: true },
                    { label: '📍 এলাকা', value: currentUser.area },
                    { label: '🏙️ শহর', value: currentUser.city },
                    { label: '📅 সর্বশেষ দান', value: formatDate(currentUser.lastDonated) },
                    ...(currentUser.facebookUrl ? [{ label: '📘 ফেসবুক', value: currentUser.facebookUrl, full: true, link: true }] : []),
                  ].map((item, i) => (
                    <div key={i} className={`bg-gray-50 dark:bg-gray-700 rounded-xl p-4 ${'full' in item && item.full ? 'col-span-2' : ''}`}>
                      <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                      {'link' in item && item.link ? (
                        <a href={item.value} target="_blank" rel="noopener noreferrer" className={`font-semibold text-sm text-blue-600 dark:text-blue-400 hover:underline break-all`}>{item.value}</a>
                      ) : (
                        <p className={`font-semibold text-sm ${'red' in item && item.red ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'} ${'full' in item && item.full ? 'break-all' : ''}`}>{item.value}</p>
                      )}
                    </div>
                  ))}
                </div>
                <div className={`bg-gray-50 dark:bg-gray-700 rounded-xl p-4 border ${currentUser.available ? 'border-green-200 dark:border-green-800' : 'border-amber-200 dark:border-amber-800'}`}>
                  <p className="text-xs text-gray-400 mb-1">💬 স্ট্যাটাস</p>
                  <p className={`font-semibold text-sm ${currentUser.available ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                    {currentUser.available
                      ? '✅ রক্ত দান করতে প্রস্তুত'
                      : `⏰ আরও ${toBanglaNum(currentUser.daysLeft)} দিন পর দান করতে পারবেন (${formatNextAvailable(currentUser.nextAvailableDate)})`}
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={openEditModal} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition">✏️ সম্পাদনা করুন</button>
                  <button onClick={() => openDeleteModal(currentUser.id)} className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800 transition">🗑️ একাউন্ট মুছুন</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── ADMIN PAGE ─── */}
        {currentPage === 'admin' && currentUser?.role === 'ADMIN' && (
          <div className="animate-[fadeUp_0.4s_ease-out_both]">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">🛡️ অ্যাডমিন প্যানেল</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">সকল রক্তদাতা পরিচালনা করুন</p>
            </div>
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 text-center">
                  <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{toBanglaNum(stats.total)}</p>
                  <p className="text-xs text-gray-400 mt-1">মোট দাতা</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{toBanglaNum(stats.available)}</p>
                  <p className="text-xs text-gray-400 mt-1">সক্রিয়</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 text-center">
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{toBanglaNum(stats.total - stats.available)}</p>
                  <p className="text-xs text-gray-400 mt-1">অপেক্ষমান</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 text-center">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{toBanglaNum(stats.cities)}</p>
                  <p className="text-xs text-gray-400 mt-1">শহর</p>
                </div>
              </div>
            )}
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {allDonors.map(d => (
                <div key={d.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-500 font-bold text-sm">{d.name.charAt(0)}</div>
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-gray-100">
                        {d.name} {d.role === 'ADMIN' && <span className="text-xs text-amber-600 dark:text-amber-400">অ্যাডমিন</span>}
                        {d.phoneHidden && <span className="text-xs text-blue-600 dark:text-blue-400 ml-1">🔒</span>}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{d.bloodGroup} &bull; {d.area}, {d.city} &bull; {d.phoneHidden ? 'ফোন গোপন' : d.phone}</p>
                      {d.facebookUrl && <p className="text-xs text-blue-500 dark:text-blue-400">📘 {d.facebookUrl}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${d.available ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                      {d.available ? 'সক্রিয়' : `আরও ${toBanglaNum(d.daysLeft)} দিন`}
                    </span>
                    <button onClick={() => adminDeleteDonor(d.id, d.name)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800 transition">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-4 mt-auto">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-400">
          🩸 রক্তদাতা ডাটাবেস — একটি জীবন বাঁচান, রক্ত দান করুন
        </div>
      </footer>

      {/* ─── DELETE MODAL ─── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full animate-[fadeUp_0.4s_ease-out_both]" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">একাউন্ট মুছে ফেলুন?</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">আপনার একাউন্ট স্থায়ীভাবে মুছে যাবে।</p>
              {currentUser?.firebaseUid ? (
                <p className="text-blue-600 dark:text-blue-400 text-sm mb-5">🔥 ফায়ারবেস একাউন্ট — পাসওয়ার্ডের প্রয়োজন নেই।</p>
              ) : (
                <>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">পাসওয়ার্ড দিয়ে নিশ্চিত করুন:</p>
                  <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 mb-4 text-gray-800 dark:text-gray-100 outline-none focus:border-red-500 transition" placeholder="পাসওয়ার্ড" />
                </>
              )}
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-semibold text-sm">বাতিল</button>
                <button onClick={confirmDelete} disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-semibold text-sm transition disabled:opacity-60">{loading ? 'মুছা হচ্ছে...' : 'মুছে ফেলুন'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── EDIT PROFILE MODAL ─── */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full animate-[fadeUp_0.4s_ease-out_both] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">✏️ প্রোফাইল সম্পাদনা</h3>
              <button onClick={() => setShowEditModal(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition text-xl">&times;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">👤 নাম</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-800 dark:text-gray-100 outline-none focus:border-red-500 transition" placeholder="পূর্ণ নাম" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">📱 মোবাইল নম্বর</label>
                <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-800 dark:text-gray-100 outline-none focus:border-red-500 transition" placeholder="০১XXXXXXXXX" maxLength={11} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">📍 এলাকা</label>
                <input type="text" value={editArea} onChange={e => setEditArea(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-800 dark:text-gray-100 outline-none focus:border-red-500 transition" placeholder="ধানমন্ডি" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">🏙️ শহর</label>
                <input type="text" value={editCity} onChange={e => setEditCity(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-800 dark:text-gray-100 outline-none focus:border-red-500 transition" placeholder="ঢাকা" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">📅 সর্বশেষ রক্তদানের তারিখ</label>
                <input type="date" value={editLastDonated} onChange={e => setEditLastDonated(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-800 dark:text-gray-100 outline-none focus:border-red-500 transition" />
                <p className="text-xs text-gray-400 mt-1">খালি রাখলে &quot;কখনো না&quot; থাকবে</p>
              </div>

              {/* ── Facebook URL ── */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">📘 ফেসবুক প্রোফাইল লিংক</label>
                <input type="url" value={editFacebookUrl} onChange={e => setEditFacebookUrl(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-800 dark:text-gray-100 outline-none focus:border-red-500 transition" placeholder="https://facebook.com/your.profile" />
              </div>

              {/* ── Phone Hidden Toggle ── */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                <Toggle
                  checked={editPhoneHidden}
                  onChange={setEditPhoneHidden}
                  label="🔒 ফোন নম্বর গোপন রাখুন"
                  disabled={!normalizeFacebookUrl(editFacebookUrl)}
                />
                {!normalizeFacebookUrl(editFacebookUrl) && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 ml-14">
                    ⚠️ ফোন গোপন করতে হলে আগে ফেসবুক লিংক দিন
                  </p>
                )}
                {editPhoneHidden && normalizeFacebookUrl(editFacebookUrl) && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2 ml-14">
                    ✅ ফেসবুক লিংক দেওয়া আছে — মানুষ ফেসবুকে যোগাযোগ করতে পারবে
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowEditModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition">বাতিল</button>
                <button onClick={saveProfile} disabled={loading} className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-700 hover:to-red-600 disabled:opacity-60 transition">{loading ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}