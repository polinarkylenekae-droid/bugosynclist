import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { ALL_BARANGAY_SERVICES } from '../src/data/servicesCatalog';

dotenv.config();

const prisma = new PrismaClient();

const DEFAULT_CENSUS_PUROKS = [
  { purokName: 'Zone 1 - Centro Riverside', population: 4820, households: 1205 },
  { purokName: 'Zone 2 - Chapel Area', population: 4150, households: 1038 },
  { purokName: 'Zone 3 - Suntingcahon Valley', population: 3920, households: 980 },
  { purokName: 'Zone 4 - Highway View', population: 3450, households: 863 },
  { purokName: 'Zone 5 - Lower Bugo Market', population: 3810, households: 953 },
  { purokName: 'Zone 6 - Upper Bugo Hills', population: 3650, households: 912 },
  { purokName: 'Zone 7 - Mangga Heights', population: 2980, households: 745 },
  { purokName: 'Zone 8 - Cogonan Plains', population: 3240, households: 810 },
  { purokName: 'Zone 9 - Bayside Coastal', population: 3110, households: 778 },
  { purokName: 'Zone 10 - San Miguel Industrial', population: 3710, households: 926 },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured. Set it in your .env file before running prisma db seed.');
  }

  const isProd = process.env.NODE_ENV === 'production';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || (!isProd ? 'Admin@Bugo2026!' : '');
  const residentPassword = process.env.SEED_RESIDENT_PASSWORD || (!isProd ? 'Resident@Bugo2026!' : '');

  if (isProd && (!adminPassword || !residentPassword)) {
    throw new Error('In production, SEED_ADMIN_PASSWORD and SEED_RESIDENT_PASSWORD must be provided via environment variables.');
  }

  const rounds = Math.min(14, Math.max(10, Number(process.env.BCRYPT_ROUNDS) || 12));
  const adminHash = await bcrypt.hash(adminPassword, rounds);
  const residentHash = await bcrypt.hash(residentPassword, rounds);

  console.log('Seeding Barangay Bugo MySQL database via Prisma...');

  await prisma.user.upsert({
    where: { id: 'admin-juan-delacruz' },
    update: { contactNumber: '09922998218' },
    create: {
      id: 'admin-juan-delacruz',
      name: 'Brgy. Bugo Admin',
      email: 'admin@bugo.gov.ph',
      passwordHash: adminHash,
      role: 'admin',
      contactNumber: '09922998218',
      purok: 'Zone 1 - Centro Riverside',
      address: 'Barangay Bugo Administrative Complex, Cagayan de Oro City',
      residentIdNumber: 'BG-ADMIN-001',
      isVerified: true,
      registrationStatus: 'Verified',
      registeredDate: '2020-01-01',
      nationality: 'Filipino',
      occupation: 'Barangay Administrator & Secretary',
      familyMembersCount: 1,
      voterStatus: 'Registered',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AdminCapitan&top=shortRound&facialHair=moustacheMagnum&clothing=blazerAndShirt&backgroundColor=d1d4f9',
    },
  });

  await prisma.user.upsert({
    where: { id: 'user-maria-santos' },
    update: { contactNumber: '+639944772143' },
    create: {
      id: 'user-maria-santos',
      name: 'Joshua Abella Laurio',
      email: 'resident@bugo.gov.ph',
      passwordHash: residentHash,
      role: 'resident',
      contactNumber: '+639944772143',
      purok: 'Zone 3 - Suntingcahon Valley',
      address: 'Block 4 Lot 12, Suntingcahon Valley, Barangay Bugo, Cagayan de Oro City',
      residentIdNumber: 'BG-2026-04829',
      isVerified: true,
      registrationStatus: 'Verified',
      registeredDate: '2025-03-14',
      nationality: 'Filipino',
      occupation: 'Self-Employed / Market Vendor',
      householdIncome: '₱8,500.00 (Informal / Low Income)',
      familyMembersCount: 4,
      voterStatus: 'Registered',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Joshua&top=shortFlat&facialHair=beardLight&clothing=collarAndSweater&backgroundColor=b6e3f4',
    },
  });

  for (const prog of ALL_BARANGAY_SERVICES) {
    await prisma.assistanceProgram.upsert({
      where: { id: prog.id },
      update: {
        title: prog.title,
        category: prog.category,
        tagline: prog.tagline || null,
        description: prog.description,
        imageUrl: prog.imageUrl,
        status: prog.status,
        badgeText: prog.badgeText || null,
        deadline: prog.deadline || null,
        targetAudience: prog.targetAudience || null,
        processingTime: prog.processingTime || null,
        maxBenefitAmount: prog.maxBenefitAmount || null,
        requirementsJson: prog.requirements || [],
        eligibilityCriteriaJson: prog.eligibilityCriteria || [],
      },
      create: {
        id: prog.id,
        title: prog.title,
        category: prog.category,
        tagline: prog.tagline || null,
        description: prog.description,
        imageUrl: prog.imageUrl,
        status: prog.status,
        badgeText: prog.badgeText || null,
        deadline: prog.deadline || null,
        targetAudience: prog.targetAudience || null,
        processingTime: prog.processingTime || null,
        maxBenefitAmount: prog.maxBenefitAmount || null,
        requirementsJson: prog.requirements || [],
        eligibilityCriteriaJson: prog.eligibilityCriteria || [],
      },
    });
  }

  for (const row of DEFAULT_CENSUS_PUROKS) {
    await prisma.censusPurok.upsert({
      where: { purokName: row.purokName },
      update: {},
      create: {
        purokName: row.purokName,
        population: row.population,
        households: row.households,
        registeredVoters: Math.round(row.population * 0.61),
        seniorCitizens: Math.round(row.population * 0.085),
        workingAge: Math.round(row.population * 0.6),
        minors: Math.round(row.population * 0.315),
      },
    });
  }

  await prisma.announcement.upsert({
    where: { id: 'ann-01' },
    update: {},
    create: {
      id: 'ann-01',
      title: 'Scheduled Water Interruption Notice',
      category: 'Water',
      description: 'COWD maintenance works on October 28 from 8:00 AM to 5:00 PM affecting Zones 1 to 5.',
      date: 'Today',
      viewsCount: 142,
      iconType: 'water',
      isPinned: true,
      status: 'Published',
    },
  });

  console.log(`Seed complete: 2 users, ${ALL_BARANGAY_SERVICES.length} services, ${DEFAULT_CENSUS_PUROKS.length} census puroks.`);
}

main()
  .catch((err) => {
    console.error('Prisma seed error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
