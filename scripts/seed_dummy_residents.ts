import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import {
  BUGO_PUROKS,
  MONTHLY_INCOME_OPTIONS,
  MALE_CARTOON_AVATARS,
  FEMALE_CARTOON_AVATARS,
} from '../src/data/mockData';
import { normalizePhMobileNumber } from '../src/utils/phoneValidation';
import { isAllowedAccountEmail, normalizeAccountEmail } from '../src/utils/emailValidation';
import type { DisasterCategory, DamageSeverity, ResidentUser } from '../src/types';

const DB_FILE = path.resolve(process.cwd(), 'data', 'db.json');
const DEMO_PASSWORD = process.env.DUMMY_RESIDENT_PASSWORD || 'Resident@Bugo2026!';

const MALE_FIRST_NAMES = [
  'Mateo', 'Gabriel', 'Rafael', 'Daniel', 'Marco',
  'Carlo', 'Angelo', 'Miguel', 'Christian', 'renato',
  'Paolo', 'Noel', 'Arnel', 'Rogelio', 'Fernando',
  'Vicente', 'Eduardo', 'Dominic', 'Adrian', 'Jericho',
  'Kevin', 'Bryan', 'Nathaniel', 'Kenneth', 'Jomar',
].map(n => n.charAt(0).toUpperCase() + n.slice(1));

const FEMALE_FIRST_NAMES = [
  'Elena', 'Clarissa', 'Maricel', 'Angela', 'Camille',
  'Jasmine', 'Patricia', 'Beatriz', 'Rosita', 'Lourdes',
  'Rowena', 'Christine', 'Michelle', 'Vanessa', 'Cecilia',
  'Divina', 'Teresita', 'Katrina', 'Hannah', 'Sophia',
  'Abigail', 'Angelica', 'Marivic', 'Lorna', 'Jocelyn',
];

const MIDDLE_NAMES = [
  'Santos', 'Reyes', 'Cruz', 'Bautista', 'Ocampo',
  'Garcia', 'Mendoza', 'Torres', 'Flores', 'Rivera',
  'Ramos', 'Castillo', 'Morales', 'Aquino', 'Navarro',
  'Salazar', 'Villanueva', 'Pascual', 'Soriano', 'Mercado',
];

const LAST_NAMES = [
  'Abellanosa', 'Alvarez', 'Baculio', 'Balandra', 'Caballero',
  'Cabanilla', 'Cabrera', 'Calderon', 'Carillo', 'Catamco',
  'Dacumos', 'Dagondon', 'Dalisay', 'Delgado', 'Diaz',
  'Enriquez', 'Espinosa', 'Evangelista', 'Fajardo', 'Fernandez',
  'Galang', 'Gomez', 'Gonzaga', 'Guerrero', 'Hernandez',
  'Ibarra', 'Ignacio', 'Jacinto', 'Javier', 'Jimenez',
  'Labadan', 'Ledesma', 'Lim', 'Lopez', 'Macaraeg',
  'Magbanua', 'Manalo', 'Magsaysay', 'Marquez', 'Miranda',
  'Natividad', 'Nolasco', 'Ocampo', 'Oliva', 'Ortega',
  'Padilla', 'Paglinawan', 'Panganiban', 'Parreno', 'Quintero',
];

const ZONE_STREETS: Record<number, string[]> = {
  0: ['Acacia St', 'Riverside Drive', 'Magsaysay Lane', 'San Roque St'],
  1: ['Chapel Road', 'San Vicente St', 'Rosary Lane', 'Purok 2 Alley'],
  2: ['Suntingcahon Rd', 'Valley View St', 'Narra Ext', 'Creekside Lane'],
  3: ['National Highway', 'Crossing Bugo St', 'Maharlika Ave', 'Gateway Rd'],
  4: ['Market Square', 'Palengke St', 'Comercio Alley', 'Kalye Uno'],
  5: ['Upper Hills Rd', 'Pine Ridge St', 'Mahogany Lane', 'Buenavista Ext'],
  6: ['Mangga St', 'Hilltop Drive', 'Santol Alley', 'Orchard View'],
  7: ['Cogonan Rd', 'Plains Ave', 'Kawayan St', 'Greenfield Ext'],
  8: ['Bayside Blvd', 'Coastal Road', 'Seaview Alley', 'Pier Side St'],
  9: ['Industrial Ave', 'San Miguel Ext', 'Factory Gate Rd', 'Del Monte Side St'],
};

const VALID_PREFIXES = [
  '0917', '0918', '0927', '0935', '0945',
  '0991', '0995', '0915', '0920', '0966',
];

const WORKING_OCCUPATIONS: Array<{
  occupation: string;
  employmentStatus: ResidentUser['employmentStatus'];
}> = [
  { occupation: 'Delivery Rider', employmentStatus: 'Self-Employed' },
  { occupation: 'Public Market Vendor', employmentStatus: 'Self-Employed' },
  { occupation: 'Plant Production Worker', employmentStatus: 'Employed (Full-Time)' },
  { occupation: 'Tricycle / Habal-Habal Driver', employmentStatus: 'Self-Employed' },
  { occupation: 'Store Cashier / Clerk', employmentStatus: 'Employed (Full-Time)' },
  { occupation: 'Carpenter / Mason', employmentStatus: 'Employed (Part-Time)' },
  { occupation: 'Barangay Health Aide', employmentStatus: 'Employed (Full-Time)' },
  { occupation: 'Seamstress / Tailor', employmentStatus: 'Self-Employed' },
  { occupation: 'Fisherman / Coastal Vendor', employmentStatus: 'Self-Employed' },
  { occupation: 'Office Administrative Staff', employmentStatus: 'Employed (Full-Time)' },
  { occupation: 'Auto / Motorcycle Mechanic', employmentStatus: 'Employed (Part-Time)' },
  { occupation: 'Security Guard', employmentStatus: 'Employed (Full-Time)' },
  { occupation: 'Elementary / High School Teacher', employmentStatus: 'Employed (Full-Time)' },
  { occupation: 'Sari-Sari Store Owner', employmentStatus: 'Self-Employed' },
  { occupation: 'Household Helper / Caregiver', employmentStatus: 'Employed (Part-Time)' },
  { occupation: 'Warehouse Logistics Aide', employmentStatus: 'Employed (Full-Time)' },
];

const SCHOOLS = [
  'Bugo National High School',
  'Bugo Central School',
  'University of Science and Technology of Southern Philippines (USTP)',
  'Capitol University',
  'Cagayan de Oro College (PHINMA)',
  'TESDA Regional Training Center - Bugo',
];

const PWD_DISABILITY_TYPES = [
  'Visual Impairment',
  'Orthopedic / Mobility Impairment',
  'Hearing Impairment',
  'Chronic Illness Disability',
];

const MEDICAL_NOTES = [
  'Hypertension maintenance',
  'Type 2 Diabetes medication',
  'Post-stroke physical therapy',
  'Asthma / respiratory care',
];

const DISASTER_TYPES: DisasterCategory[] = ['Flood', 'Typhoon / Storm', 'Landslide', 'Fire'];
const DAMAGE_LEVELS: DamageSeverity[] = ['Minor', 'Moderate', 'Severe', 'Total Loss'];

function pad(n: number, len: number): string {
  return String(n).padStart(len, '0');
}

function buildValidPhone(index: number): string {
  const prefix = VALID_PREFIXES[index % VALID_PREFIXES.length];
  // Construct 7 non-repeating, realistic subscriber digits deterministically
  const d1 = (2 + (index % 7));
  const d2 = (4 + Math.floor(index / 3) % 5);
  const d3 = (1 + (index * 3) % 8);
  const d4 = (7 - (index % 6));
  const d5 = (3 + Math.floor(index / 2) % 6);
  const d6 = (8 - (index % 7));
  const d7 = (1 + (index * 7) % 8);
  const raw = `${prefix}${d1}${d2}${d3}${d4}${d5}${d6}${d7}`;
  const normalized = normalizePhMobileNumber(raw);
  if (!normalized.valid) {
    throw new Error(`Generated invalid phone for index ${index}: ${raw} (${normalized.reason})`);
  }
  return normalized.local09;
}

function buildDummyResidents(): Array<ResidentUser & { passwordHash: string }> {
  const dummyList: Array<ResidentUser & { passwordHash: string }> = [];
  const usedEmails = new Set<string>();
  const usedPhones = new Set<string>();
  const usedFullNames = new Set<string>();

  for (let i = 0; i < 100; i++) {
    const seq = i + 1; // 1..100
    const isFemale = i % 2 === 1; // 50 Male, 50 Female
    const gender: 'Male' | 'Female' = isFemale ? 'Female' : 'Male';

    // Pair first name + middle + last name cleanly with zero full-name duplicates
    const firstPool = isFemale ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES;
    const firstIdx = Math.floor(i / 2) % firstPool.length;
    const roundIdx = Math.floor(Math.floor(i / 2) / firstPool.length); // 0 or 1
    const firstName = firstPool[firstIdx];
    const middleName = MIDDLE_NAMES[(i * 3 + roundIdx * 5) % MIDDLE_NAMES.length];
    const lastName = LAST_NAMES[(i * 7 + roundIdx * 13) % LAST_NAMES.length];
    const name = `${firstName} ${middleName} ${lastName}`;

    if (usedFullNames.has(name)) {
      throw new Error(`Duplicate generated name at index ${i}: ${name}`);
    }
    usedFullNames.add(name);

    const emailSlug = `${firstName}.${lastName}${pad(seq, 3)}`
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, '');
    const email = normalizeAccountEmail(`${emailSlug}@gmail.com`);
    if (!isAllowedAccountEmail(email) || usedEmails.has(email)) {
      throw new Error(`Invalid or duplicate email generated: ${email}`);
    }
    usedEmails.add(email);

    const contactNumber = buildValidPhone(i);
    if (usedPhones.has(contactNumber)) {
      throw new Error(`Duplicate generated phone: ${contactNumber}`);
    }
    usedPhones.add(contactNumber);

    // Distribute evenly across all 10 zones (10 per zone)
    const zoneIndex = i % BUGO_PUROKS.length;
    const purok = BUGO_PUROKS[zoneIndex];
    const zoneShort = purok.split(' - ')[0];
    const streetList = ZONE_STREETS[zoneIndex] || ['Main St'];
    const street = streetList[Math.floor(i / 10) % streetList.length];
    const houseNo = 10 + (seq * 3);
    const address = `#${houseNo} ${street}, ${zoneShort}, Barangay Bugo, Cagayan de Oro City`;

    // Age profile distribution across 100 residents:
    // 14 youth/teens (14..17), 26 young adults (18..29), 44 working adults (30..59), 16 seniors (60..76)
    let age: number;
    if (i < 14) {
      age = 14 + (i % 4); // 14..17
    } else if (i < 40) {
      age = 18 + ((i - 14) % 12); // 18..29
    } else if (i < 84) {
      age = 30 + ((i - 40) % 30); // 30..59
    } else {
      age = 60 + ((i - 84) % 17); // 60..76
    }

    const birthYear = 2026 - age;
    const birthMonth = pad((i % 12) + 1, 2);
    const birthDay = pad(((i * 5) % 28) + 1, 2);
    const birthdate = `${birthYear}-${birthMonth}-${birthDay}`;

    const isTeenager = age >= 13 && age <= 19;
    const isSenior = age >= 60;
    const isStudent = age <= 21 || (age <= 24 && i % 3 === 0);
    const isPwd = !isStudent && i % 10 === 4; // 10 PWDs
    const isSoloParent = age >= 22 && age < 60 && i % 10 === 7; // ~8-9 Solo Parents

    let studentLevel: ResidentUser['studentLevel'];
    let schoolName: string | undefined;
    if (isStudent) {
      if (age <= 17) {
        studentLevel = 'High School';
        schoolName = age <= 15 ? SCHOOLS[1] : SCHOOLS[0];
      } else if (i % 4 === 0) {
        studentLevel = 'Vocational';
        schoolName = SCHOOLS[5];
      } else {
        studentLevel = 'College/University';
        schoolName = SCHOOLS[2 + (i % 3)];
      }
    }

    let occupation: string;
    let employmentStatus: ResidentUser['employmentStatus'];
    if (isSenior && i % 3 !== 0) {
      occupation = 'Senior Citizen / Retiree';
      employmentStatus = 'Retired';
    } else if (isStudent) {
      occupation = 'Student';
      employmentStatus = 'Student';
    } else if (i % 17 === 11) {
      occupation = 'Unemployed / Jobseeker';
      employmentStatus = 'Unemployed';
    } else {
      const work = WORKING_OCCUPATIONS[i % WORKING_OCCUPATIONS.length];
      occupation = work.occupation;
      employmentStatus = work.employmentStatus;
    }

    // Civil status aligned with age
    let civilStatus: ResidentUser['civilStatus'] = 'Single';
    if (age >= 60 && i % 3 === 0) civilStatus = 'Widowed';
    else if (isSoloParent) civilStatus = i % 2 === 0 ? 'Separated' : 'Single';
    else if (age >= 27 && i % 5 !== 0) civilStatus = 'Married';

    // Income bracket distribution matching MONTHLY_INCOME_OPTIONS
    // Skewed realistically toward low/lower-middle barangay households so aid filters populate nicely
    let householdIncome: string;
    if (isStudent && age < 18) {
      householdIncome = MONTHLY_INCOME_OPTIONS[1]; // ₱5,000.00 household context
    } else if (isSenior && employmentStatus === 'Retired') {
      householdIncome = i % 2 === 0 ? MONTHLY_INCOME_OPTIONS[0] : MONTHLY_INCOME_OPTIONS[1];
    } else {
      const incomePattern = [1, 2, 2, 3, 3, 4, 4, 5, 6, 8];
      householdIncome = MONTHLY_INCOME_OPTIONS[incomePattern[i % incomePattern.length]];
    }

    const voterStatus: ResidentUser['voterStatus'] =
      age < 18 ? 'Unregistered' : i % 8 === 0 ? 'Unregistered' : 'Registered';

    const familyMembersCount = 1 + ((i * 3) % 7); // 1..7

    // 94 Verified, 6 Pending Approval (last 6 entries) for admin demo visibility
    const isPendingApproval = seq > 94;
    const registrationStatus: ResidentUser['registrationStatus'] = isPendingApproval
      ? 'Pending Approval'
      : 'Verified';
    const isVerified = !isPendingApproval;

    const regMonth = pad((i % 10) + 1, 2);
    const regDay = pad(((i * 3) % 27) + 1, 2);
    const registeredDate = `2026-${regMonth}-${regDay}`;

    const hasMedicalNeed = isSenior ? i % 2 === 0 : isPwd || i % 15 === 0;
    const isDisasterAffected = (zoneIndex === 0 || zoneIndex === 2 || zoneIndex === 8) && i % 2 === 0;

    const avatarPool = isFemale ? FEMALE_CARTOON_AVATARS : MALE_CARTOON_AVATARS;
    const avatarUrl = avatarPool[Math.floor(i / 2) % avatarPool.length].url;

    // Hash unique salted bcrypt password (cost 10 for fast seeding while compatible with server.ts verifyPassword)
    const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);

    dummyList.push({
      id: `dummy-res-${pad(seq, 3)}`,
      name,
      firstName,
      middleName,
      lastName,
      birthdate,
      email,
      username: email,
      passwordHash,
      role: 'resident',
      contactNumber,
      purok,
      address,
      residentIdNumber: `BG-2026-${10000 + seq}`,
      isVerified,
      registrationStatus,
      registeredDate,
      householdIncome,
      familyMembersCount,
      voterStatus,
      occupation,
      employmentStatus,
      civilStatus,
      nationality: 'Filipino',
      age,
      gender,
      yearsOfResidency: Math.min(age, 2 + (seq % 20)),
      accountSource: 'create_account',
      isPwd,
      ...(isPwd
        ? {
            pwdIdNumber: `PWD-CDO-${202600 + seq}`,
            pwdDisabilityType: PWD_DISABILITY_TYPES[i % PWD_DISABILITY_TYPES.length],
          }
        : {}),
      isSoloParent,
      ...(isSoloParent
        ? {
            soloParentIdNumber: `SP-BUGO-${202600 + seq}`,
          }
        : {}),
      isSenior,
      ...(isSenior
        ? {
            seniorIdNumber: `OSCA-CDO-${3000 + seq}`,
          }
        : {}),
      isStudent,
      ...(isStudent
        ? {
            schoolName,
            studentLevel,
          }
        : {}),
      isTeenager,
      hasMedicalNeed,
      ...(hasMedicalNeed
        ? {
            medicalConditionNote: MEDICAL_NOTES[i % MEDICAL_NOTES.length],
          }
        : {}),
      isDisasterAffected,
      ...(isDisasterAffected
        ? {
            disasterType: DISASTER_TYPES[zoneIndex % DISASTER_TYPES.length],
            disasterDamageLevel: DAMAGE_LEVELS[i % DAMAGE_LEVELS.length],
          }
        : {}),
      avatarUrl,
    });
  }

  return dummyList;
}

function main() {
  if (!fs.existsSync(DB_FILE)) {
    throw new Error(`Database file not found at ${DB_FILE}`);
  }

  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  const db = JSON.parse(raw);
  const existingUsers: any[] = Array.isArray(db.users) ? db.users : [];

  // Keep core accounts and any genuine non-dummy/non-test accounts; remove previous dummy-res-* and leftover test.strict* clutter
  const preservedUsers = existingUsers.filter((u: any) => {
    const id = String(u?.id || '');
    const email = String(u?.email || '').toLowerCase();
    if (id.startsWith('dummy-res-')) return false;
    if (email.startsWith('test.strictid.') || email.startsWith('test.strictside.')) return false;
    return true;
  });

  const dummyResidents = buildDummyResidents();
  db.users = [...preservedUsers, ...dummyResidents];

  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');

  const zoneCounts = BUGO_PUROKS.map(z => ({
    zone: z.split(' - ')[0],
    count: dummyResidents.filter(r => r.purok === z).length,
  }));

  console.log(JSON.stringify({
    success: true,
    preservedUsersCount: preservedUsers.length,
    dummyResidentsSeeded: dummyResidents.length,
    totalUsersInDb: db.users.length,
    verifiedCount: dummyResidents.filter(r => r.registrationStatus === 'Verified').length,
    pendingApprovalCount: dummyResidents.filter(r => r.registrationStatus === 'Pending Approval').length,
    maleCount: dummyResidents.filter(r => r.gender === 'Male').length,
    femaleCount: dummyResidents.filter(r => r.gender === 'Female').length,
    seniorCount: dummyResidents.filter(r => r.isSenior).length,
    pwdCount: dummyResidents.filter(r => r.isPwd).length,
    soloParentCount: dummyResidents.filter(r => r.isSoloParent).length,
    studentCount: dummyResidents.filter(r => r.isStudent).length,
    zoneCounts,
    sampleAccounts: dummyResidents.slice(0, 5).map(r => ({
      id: r.id,
      name: r.name,
      email: r.email,
      residentIdNumber: r.residentIdNumber,
      purok: r.purok,
      contactNumber: r.contactNumber,
      registrationStatus: r.registrationStatus,
    })),
    demoPassword: DEMO_PASSWORD,
  }, null, 2));
}

main();
