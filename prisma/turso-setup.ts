/**
 * One-shot script to set up Turso cloud database from Windows.
 * Creates tables + seeds data — no Prisma CLI needed.
 *
 * Usage (PowerShell):
 *   $env:DATABASE_URL = "libsql://blood-donor-db-xxx.turso.io"
 *   $env:DATABASE_AUTH_TOKEN = "your-token"
 *   npx tsx prisma/turso-setup.ts
 */

import { createClient, type Client } from '@libsql/client';
import bcrypt from 'bcryptjs';

const url = process.env.DATABASE_URL;
const token = process.env.DATABASE_AUTH_TOKEN;

if (!url || !url.startsWith('libsql://')) {
  console.error('❌ Set DATABASE_URL to your Turso libsql:// URL');
  console.error('   $env:DATABASE_URL = "libsql://your-db.turso.io"');
  process.exit(1);
}
if (!token) {
  console.error('❌ Set DATABASE_AUTH_TOKEN to your Turso auth token');
  console.error('   $env:DATABASE_AUTH_TOKEN = "your-token"');
  process.exit(1);
}

const db: Client = createClient({ url, authToken: token });

async function setup() {
  console.log('🔗 Connecting to Turso...');
  await db.execute('SELECT 1');
  console.log('✅ Connected!\n');

  // ── 1. Create tables ──
  console.log('📋 Creating tables...');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "Donor" (
      "id"          TEXT NOT NULL PRIMARY KEY,
      "name"        TEXT NOT NULL,
      "email"       TEXT NOT NULL,
      "bloodGroup"  TEXT NOT NULL,
      "phone"       TEXT NOT NULL,
      "password"    TEXT NOT NULL,
      "area"        TEXT NOT NULL,
      "city"        TEXT NOT NULL,
      "lastDonated" DATETIME,
      "available"   BOOLEAN NOT NULL DEFAULT 1,
      "role"        TEXT NOT NULL DEFAULT 'USER',
      "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"   DATETIME NOT NULL
    );
  `);

  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Donor_email_key" ON "Donor"("email");
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "Session" (
      "id"        TEXT NOT NULL PRIMARY KEY,
      "token"     TEXT NOT NULL,
      "donorId"   TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" DATETIME NOT NULL,
      CONSTRAINT "Session_token_key" UNIQUE ("token"),
      CONSTRAINT "Session_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  console.log('✅ Tables created!\n');

  // ── 2. Check if already seeded ──
  const existing = await db.execute('SELECT COUNT(*) as c FROM Donor');
  const count = Number(existing.rows[0].c);

  if (count > 0) {
    console.log(`⏭️  Database already has ${count} donor(s). Skipping seed.`);
    console.log('   If you want to re-seed, drop tables first from the Turso dashboard.');
    return;
  }

  // ── 3. Seed data ──
  console.log('🌱 Seeding sample donors...');

  const donors = [
    { name: 'মোঃ রাসেল আহমেদ', email: 'russel@example.com', bloodGroup: 'A+', phone: '01712345678', area: 'ধানমন্ডি', city: 'ঢাকা', lastDonated: '2025-01-15', password: 'password' },
    { name: 'ফারহানা আক্তার', email: 'farhana@example.com', bloodGroup: 'O+', phone: '01812345678', area: 'মিরপুর', city: 'ঢাকা', lastDonated: '2024-12-20', password: 'password' },
    { name: 'মোঃ তানভীর ইসলাম', email: 'tanvir@example.com', bloodGroup: 'B+', phone: '01912345678', area: 'উত্তরা', city: 'ঢাকা', lastDonated: null, password: 'password' },
    { name: 'সাদিয়া রহমান', email: 'sadia@example.com', bloodGroup: 'AB+', phone: '01512345678', area: 'বনানী', city: 'ঢাকা', lastDonated: '2025-02-10', password: 'password' },
    { name: 'মোঃ আলী হাসান', email: 'ali@example.com', bloodGroup: 'O-', phone: '01612345678', area: 'মোহাম্মদপুর', city: 'ঢাকা', lastDonated: '2024-11-05', password: 'password' },
    { name: 'নুসরাত জাহান', email: 'nusrat@example.com', bloodGroup: 'A-', phone: '01822345678', area: 'গুলশান', city: 'ঢাকা', lastDonated: null, password: 'password' },
    { name: 'মোঃ কামরুল হাসান', email: 'kamrul@example.com', bloodGroup: 'B-', phone: '01922345678', area: 'টঙ্গী', city: 'ঢাকা', lastDonated: '2025-03-01', password: 'password' },
    { name: 'রুমানা আক্তার', email: 'rumana@example.com', bloodGroup: 'AB-', phone: '01522345678', area: 'পল্লবী', city: 'ঢাকা', lastDonated: null, password: 'password' },
    { name: 'মোঃ শাকিল আহমেদ', email: 'shakil@example.com', bloodGroup: 'A+', phone: '01622345678', area: 'সাভার', city: 'ঢাকা', lastDonated: '2024-10-15', password: 'password' },
    { name: 'তাসনিম ফারিয়া', email: 'tasnim@example.com', bloodGroup: 'O+', phone: '01722345678', area: 'মালিবাগ', city: 'ঢাকা', lastDonated: '2025-01-20', password: 'password' },
    { name: 'মোঃ ইমরান হোসেন', email: 'imran@example.com', bloodGroup: 'B+', phone: '01832345678', area: 'যাত্রাবাড়ী', city: 'ঢাকা', lastDonated: null, password: 'password' },
    { name: 'মাহমুদা খাতুন', email: 'mahmuda@example.com', bloodGroup: 'A+', phone: '01932345678', area: 'মতিঝিল', city: 'ঢাকা', lastDonated: '2024-09-10', password: 'password' },
    { name: 'রাকিব হাসান', email: 'rakib@example.com', bloodGroup: 'O+', phone: '01532345678', area: 'নিউ মার্কেট', city: 'ঢাকা', lastDonated: '2025-02-28', password: 'password' },
    { name: 'জান্নাতুল ফেরদৌস', email: 'jannat@example.com', bloodGroup: 'B+', phone: '01632345678', area: 'শ্যামলী', city: 'ঢাকা', lastDonated: null, password: 'password' },
    { name: 'মোঃ সোহেল রানা', email: 'sohel@example.com', bloodGroup: 'AB+', phone: '01732345678', area: 'কল্যাণপুর', city: 'ঢাকা', lastDonated: '2024-12-01', password: 'password' },
  ];

  for (const d of donors) {
    const hash = await bcrypt.hash(d.password, 12);
    await db.execute({
      sql: `INSERT INTO "Donor" (id, name, email, bloodGroup, phone, password, area, city, lastDonated, available, role, createdAt, updatedAt)
            VALUES (lower(hex(randomblob(8))), ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [d.name, d.email, d.bloodGroup, d.phone, hash, d.area, d.city, d.lastDonated, true],
    });
    console.log(`  ✅ ${d.name}`);
  }

  // Admin
  const adminHash = await bcrypt.hash('admin123', 12);
  await db.execute({
    sql: `INSERT INTO "Donor" (id, name, email, bloodGroup, phone, password, area, city, lastDonated, available, role, createdAt, updatedAt)
          VALUES (lower(hex(randomblob(8))), ?, ?, ?, ?, ?, ?, ?, ?, 0, 'ADMIN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    args: ['অ্যাডমিন', 'admin@blooddonor.local', 'O+', '01700000000', adminHash, 'ঢাকা', 'ঢাকা', null],
  });
  console.log(`  ✅ অ্যাডমিন (ADMIN)`);

  console.log(`\n🎉 Done! Seeded ${donors.length} donors + 1 admin.`);
  console.log(`📧 Admin: admin@blooddonor.local / admin123`);
  console.log(`📧 Any donor: <email> / password`);
}

setup()
  .catch((e) => { console.error('❌ Error:', e.message); process.exit(1); })
  .finally(() => { db.close(); });