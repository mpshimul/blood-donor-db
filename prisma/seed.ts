import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const sampleDonors = [
  { name: 'মোঃ রাসেল আহমেদ', email: 'russel@example.com', bloodGroup: 'A+', phone: '01712345678', area: 'ধানমন্ডি', city: 'ঢাকা', lastDonated: '2025-01-15', available: true, password: 'password' },
  { name: 'ফারহানা আক্তার', email: 'farhana@example.com', bloodGroup: 'O+', phone: '01812345678', area: 'মিরপুর', city: 'ঢাকা', lastDonated: '2024-12-20', available: true, password: 'password' },
  { name: 'মোঃ তানভীর ইসলাম', email: 'tanvir@example.com', bloodGroup: 'B+', phone: '01912345678', area: 'উত্তরা', city: 'ঢাকা', lastDonated: null, available: true, password: 'password' },
  { name: 'সাদিয়া রহমান', email: 'sadia@example.com', bloodGroup: 'AB+', phone: '01512345678', area: 'বনানী', city: 'ঢাকা', lastDonated: '2025-02-10', available: true, password: 'password' },
  { name: 'মোঃ আলী হাসান', email: 'ali@example.com', bloodGroup: 'O-', phone: '01612345678', area: 'মোহাম্মদপুর', city: 'ঢাকা', lastDonated: '2024-11-05', available: true, password: 'password' },
  { name: 'নুসরাত জাহান', email: 'nusrat@example.com', bloodGroup: 'A-', phone: '01822345678', area: 'গুলশান', city: 'ঢাকা', lastDonated: null, available: true, password: 'password' },
  { name: 'মোঃ কামরুল হাসান', email: 'kamrul@example.com', bloodGroup: 'B-', phone: '01922345678', area: 'টঙ্গী', city: 'ঢাকা', lastDonated: '2025-03-01', available: true, password: 'password' },
  { name: 'রুমানা আক্তার', email: 'rumana@example.com', bloodGroup: 'AB-', phone: '01522345678', area: 'পল্লবী', city: 'ঢাকা', lastDonated: null, available: true, password: 'password' },
  { name: 'মোঃ শাকিল আহমেদ', email: 'shakil@example.com', bloodGroup: 'A+', phone: '01622345678', area: 'সাভার', city: 'ঢাকা', lastDonated: '2024-10-15', available: false, password: 'password' },
  { name: 'তাসনিম ফারিয়া', email: 'tasnim@example.com', bloodGroup: 'O+', phone: '01722345678', area: 'মালিবাগ', city: 'ঢাকা', lastDonated: '2025-01-20', available: true, password: 'password' },
  { name: 'মোঃ ইমরান হোসেন', email: 'imran@example.com', bloodGroup: 'B+', phone: '01832345678', area: 'যাত্রাবাড়ী', city: 'ঢাকা', lastDonated: null, available: true, password: 'password' },
  { name: 'মাহমুদা খাতুন', email: 'mahmuda@example.com', bloodGroup: 'A+', phone: '01932345678', area: 'মতিঝিল', city: 'ঢাকা', lastDonated: '2024-09-10', available: true, password: 'password' },
  { name: 'রাকিব হাসান', email: 'rakib@example.com', bloodGroup: 'O+', phone: '01532345678', area: 'নিউ মার্কেট', city: 'ঢাকা', lastDonated: '2025-02-28', available: true, password: 'password' },
  { name: 'জান্নাতুল ফেরদৌস', email: 'jannat@example.com', bloodGroup: 'B+', phone: '01632345678', area: 'শ্যামলী', city: 'ঢাকা', lastDonated: null, available: true, password: 'password' },
  { name: 'মোঃ সোহেল রানা', email: 'sohel@example.com', bloodGroup: 'AB+', phone: '01732345678', area: 'কল্যাণপুর', city: 'ঢাকা', lastDonated: '2024-12-01', available: true, password: 'password' },
];

async function seed() {
  console.log('🌱 Seeding sample donors...');

  for (const donor of sampleDonors) {
    const hashedPassword = await bcrypt.hash(donor.password, 12);
    await prisma.donor.create({
      data: {
        email: donor.email,
        name: donor.name,
        bloodGroup: donor.bloodGroup,
        phone: donor.phone,
        area: donor.area,
        city: donor.city,
        lastDonated: donor.lastDonated ? new Date(donor.lastDonated) : null,
        available: donor.available,
        password: hashedPassword,
        role: 'USER',
      },
    });
  }

  // Admin
  const adminPassword = await bcrypt.hash('admin123', 12);
  await prisma.donor.create({
    data: {
      email: 'admin@blooddonor.local',
      name: 'অ্যাডমিন',
      bloodGroup: 'O+',
      phone: '01700000000',
      area: 'ঢাকা',
      city: 'ঢাকা',
      available: false,
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  console.log(`✅ Seeded ${sampleDonors.length} donors + 1 admin!`);
  console.log(`📧 Admin login: admin@blooddonor.local / admin123`);
  console.log(`📧 Any donor login: <their email> / password`);
}

seed()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });