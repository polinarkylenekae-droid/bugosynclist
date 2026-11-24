import { 
  AssistanceProgram, 
  AssistanceApplication, 
  ResidentUser, 
  NotificationItem,
  AnnouncementItem,
  ActivityLogItem,
  ArchiveItem
} from '../types';
import { ALL_BARANGAY_SERVICES } from './servicesCatalog';

export const BUGO_PUROKS = [
  'Zone 1',
  'Zone 2',
  'Zone 3',
  'Zone 4',
  'Zone 5',
  'Zone 6',
  'Zone 7',
  'Zone 8',
  'Zone 9',
  'Zone 10',
];

export const MONTHLY_INCOME_OPTIONS = [
  '₱0 (No Income / Dependent)',
  '₱5,000.00 (Below Minimum Wage / Indigent)',
  '₱8,500.00 (Informal / Low Income)',
  '₱10,000.00 (Minimum Wage Range)',
  '₱15,000.00',
  '₱20,000.00',
  '₱25,000.00',
  '₱30,000.00',
  '₱40,000.00',
  '₱50,000.00',
  '₱75,000.00',
  '₱100,000.00+'
];

export const NATIONALITY_OPTIONS = [
  'Filipino',
  'Dual Citizen (Filipino-Foreign)',
  'Naturalized Filipino',
  'American',
  'Japanese',
  'Korean',
  'Chinese',
  'Canadian',
  'Australian',
  'British',
  'Other Foreign National'
];

export interface CartoonAvatarPreset {
  id: string;
  name: string;
  gender: 'male' | 'female';
  url: string;
}

export const MALE_CARTOON_AVATARS: CartoonAvatarPreset[] = [
  { id: 'm1', name: 'Joshua (Youth)', gender: 'male', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Joshua&top=shortFlat&facialHair=beardLight&clothing=collarAndSweater&backgroundColor=b6e3f4' },
  { id: 'm2', name: 'Capitan (Official)', gender: 'male', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AdminCapitan&top=shortRound&facialHair=moustacheMagnum&clothing=blazerAndShirt&backgroundColor=d1d4f9' },
  { id: 'm3', name: 'Pedro (Elder)', gender: 'male', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=PedroElder&top=sides&facialHair=beardMedium&clothing=collarAndSweater&backgroundColor=c0aede' },
  { id: 'm4', name: 'Marcus (Resident)', gender: 'male', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus&top=shortCurly&facialHair=beardLight&clothing=shirtCrewNeck&backgroundColor=ffdfbf' },
  { id: 'm5', name: 'Oliver (Leader)', gender: 'male', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver&top=theCaesar&clothing=blazerAndShirt&backgroundColor=c0aede' },
  { id: 'm6', name: 'Felix (Engineer)', gender: 'male', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&top=shortFlat&clothing=hoodie&backgroundColor=d1d4f9' },
  { id: 'm7', name: 'Gabriel (Athlete)', gender: 'male', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Gabriel&top=frizzle&clothing=shirtCrewNeck&backgroundColor=b6e3f4' },
  { id: 'm8', name: 'Antonio (Farmer)', gender: 'male', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Antonio&top=dreads01&facialHair=beardLight&clothing=shirtCrewNeck&backgroundColor=ffdfbf' },
];

export const FEMALE_CARTOON_AVATARS: CartoonAvatarPreset[] = [
  { id: 'f1', name: 'Maria (Teacher)', gender: 'female', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MariaClara&top=straight02&facialHairProbability=0&clothing=shirtVNeck&backgroundColor=ffd5dc' },
  { id: 'f2', name: 'Aria (Student)', gender: 'female', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AriaStudent&top=curvy&facialHairProbability=0&clothing=collarAndSweater&backgroundColor=ffdfbf' },
  { id: 'f3', name: 'Luna (Artist)', gender: 'female', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=LunaArtist&top=longButNotTooLong&facialHairProbability=0&clothing=shirtCrewNeck&backgroundColor=ffd5dc' },
  { id: 'f4', name: 'Elena (Nurse)', gender: 'female', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ElenaNurse&top=bob&facialHairProbability=0&clothing=collarAndSweater&backgroundColor=d1d4f9' },
  { id: 'f5', name: 'Sophia (Scholar)', gender: 'female', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SophiaScholar&top=straight01&facialHairProbability=0&clothing=blazerAndShirt&backgroundColor=c0aede' },
  { id: 'f6', name: 'Chloe (Leader)', gender: 'female', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ChloeLeader&top=curly&facialHairProbability=0&clothing=shirtVNeck&backgroundColor=b6e3f4' },
  { id: 'f7', name: 'Angelica (Vendor)', gender: 'female', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AngelicaVendor&top=fro&facialHairProbability=0&clothing=overall&backgroundColor=ffdfbf' },
  { id: 'f8', name: 'Rosita (Senior)', gender: 'female', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=RositaSenior&top=curvy&facialHairProbability=0&clothing=collarAndSweater&backgroundColor=ffd5dc' },
];

export const CARTOON_AVATAR_PRESETS: CartoonAvatarPreset[] = [
  ...MALE_CARTOON_AVATARS,
  ...FEMALE_CARTOON_AVATARS,
];

export function detectUserGender(user?: { name?: string; gender?: string } | null, nameFallback?: string): 'male' | 'female' {
  const explicit = (user?.gender || '').trim().toLowerCase();
  if (explicit === 'male' || explicit === 'm') return 'male';
  if (explicit === 'female' || explicit === 'f') return 'female';

  const rawName = (user?.name || nameFallback || '').trim().toLowerCase();
  if (!rawName) return 'male';

  const clean = rawName.replace(/^(hon\.|dr\.|engr\.|capt\.|mr\.|ms\.|mrs\.)\s+/i, '').split(/\s+/);
  const firstName = clean[0] || '';

  const femaleNames = new Set([
    'maria', 'mary', 'ana', 'anna', 'clara', 'elena', 'luna', 'aria', 'sophia', 'sofia', 
    'chloe', 'angelica', 'angela', 'rosita', 'rosa', 'carmen', 'teresa', 'cristina', 'christine',
    'sarah', 'sara', 'grace', 'joy', 'joyce', 'vanessa', 'patricia', 'beatriz', 'diana',
    'jasmine', 'maricel', 'rowena', 'ruby', 'sheila', 'marivic', 'marlene', 'camille', 'cecilia',
    'cynthia', 'divina', 'dolores', 'editha', 'esperanza', 'fatima', 'felisa', 'gloria', 'irene',
    'joan', 'julia', 'juliet', 'katrina', 'lea', 'leah', 'liza', 'lorna', 'lourdes', 'luisa',
    'mercedes', 'michelle', 'vilma', 'jocelyn', 'jennifer', 'jessica', 'katie', 'hannah', 'emma',
    'olivia', 'mia', 'isabella', 'charlotte', 'amelia', 'harper', 'evelyn', 'abigail', 'emily',
    'elizabeth', 'mila', 'ella', 'avery', 'camila', 'scarlett', 'victoria', 'madison', 'penelope',
    'layla', 'riley', 'zoey', 'nora', 'lily'
  ]);

  const maleNames = new Set([
    'joshua', 'pedro', 'juan', 'jose', 'carlos', 'mark', 'john', 'michael', 'james', 'david',
    'roberto', 'antonio', 'alexander', 'angel', 'angelo', 'christian', 'gabriel', 'daniel',
    'francis', 'francisco', 'renato', 'ricardo', 'eduardo', 'rogelio', 'fernando', 'manuel',
    'alfredo', 'edgardo', 'raul', 'ronald', 'rommel', 'archie', 'arnel', 'arturo', 'benjamin',
    'bernardo', 'crisanto', 'domingo', 'fidel', 'gregorio', 'ignacio', 'joel', 'jomar', 'jonathan',
    'joseph', 'leandro', 'leonardo', 'lito', 'louie', 'marlon', 'nestor', 'noel', 'paul', 'paulo',
    'rodolfo', 'rodrigo', 'salvador', 'vicente', 'victor', 'oliver', 'felix', 'marcus', 'leo',
    'liam', 'noah', 'william', 'lucas', 'henry', 'theodore', 'jack', 'levi', 'mateo', 'asher'
  ]);

  if (femaleNames.has(firstName)) return 'female';
  if (maleNames.has(firstName)) return 'male';

  if (firstName.endsWith('a') && firstName !== 'joshua') return 'female';
  if (firstName.endsWith('o')) return 'male';

  return 'male';
}

export const DEFAULT_BUGO_CENSUS = {
  totalPopulation: 36840,
  totalHouseholds: 9210,
  registeredVoters: 22450,
  seniorCitizens: 3140,
  workingAge: 22120,
  minors: 11580,
  purokBreakdown: [
    { purok: 'Zone 1', population: 4820, households: 1205 },
    { purok: 'Zone 2', population: 4150, households: 1038 },
    { purok: 'Zone 3', population: 3920, households: 980 },
    { purok: 'Zone 4', population: 3450, households: 863 },
    { purok: 'Zone 5', population: 3810, households: 953 },
    { purok: 'Zone 6', population: 3650, households: 912 },
    { purok: 'Zone 7', population: 2980, households: 745 },
    { purok: 'Zone 8', population: 3240, households: 810 },
    { purok: 'Zone 9', population: 3110, households: 778 },
    { purok: 'Zone 10', population: 3710, households: 926 }
  ],
  lastUpdated: '2026-11-01'
};

export const DEMO_ADMIN_USER: ResidentUser = {
  id: 'admin-juan-delacruz',
  name: 'Brgy. Bugo Admin',
  email: 'admin@bugo.gov.ph',
  username: 'bugo_admin',
  role: 'admin',
  contactNumber: '09922998218',
  purok: 'Zone 1',
  address: 'Barangay Bugo Administrative Complex, Cagayan de Oro City',
  residentIdNumber: 'BG-ADMIN-001',
  isVerified: true,
  registrationStatus: 'Verified',
  registeredDate: '2020-01-01',
  nationality: 'Filipino',
  occupation: 'Barangay Administrator & Secretary',
  avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AdminCapitan&top=shortRound&facialHair=moustacheMagnum&clothing=blazerAndShirt&backgroundColor=d1d4f9'
};

export const DEMO_RESIDENT_USER: ResidentUser = {
  id: 'user-maria-santos',
  name: 'Joshua Abella Laurio',
  email: 'resident@bugo.gov.ph',
  username: 'joshualaurio',
  role: 'resident',
  contactNumber: '+639944772143',
  purok: 'Zone 3',
  address: 'Block 4 Lot 12, Zone 3, Barangay Bugo, Cagayan de Oro City',
  residentIdNumber: 'BG-2026-04829',
  isVerified: true,
  registrationStatus: 'Verified',
  registeredDate: '2025-03-14',
  householdIncome: '₱8,500.00 (Informal / Low Income)',
  familyMembersCount: 4,
  nationality: 'Filipino',
  voterStatus: 'Registered',
  occupation: 'Self-Employed / Market Vendor',
  employmentStatus: 'Self-Employed',
  age: 34,
  gender: 'Male',
  civilStatus: 'Married',
  idType: 'PhilSys National ID',
  idNumber: 'PH-7120-8841-9230',
  isPwd: false,
  isSoloParent: false,
  isSenior: false,
  isStudent: false,
  isTeenager: false,
  yearsOfResidency: 7,
  avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Joshua&top=shortFlat&facialHair=beardLight&clothing=collarAndSweater&backgroundColor=b6e3f4'
};

// Rich initial resident accounts representing different sectors and zones
export const INITIAL_RESIDENT_RECORDS: ResidentUser[] = [
  {
    id: 'user-maria-santos',
    name: 'Joshua Abella Laurio',
    email: 'resident@bugo.gov.ph',
    username: 'joshualaurio',
    role: 'resident',
    contactNumber: '+639944772143',
    purok: 'Zone 3',
    address: 'Block 4 Lot 12, Zone 3, Bugo, CDO',
    residentIdNumber: 'BG-2026-04829',
    isVerified: true,
    registrationStatus: 'Verified',
    registeredDate: '2025-03-14',
    householdIncome: '₱8,500.00 (Informal / Low Income)',
    familyMembersCount: 4,
    nationality: 'Filipino',
    voterStatus: 'Registered',
    occupation: 'Self-Employed / Market Vendor',
    employmentStatus: 'Self-Employed',
    age: 34,
    gender: 'Male',
    civilStatus: 'Married',
    idType: 'PhilSys National ID',
    idNumber: 'PH-7120-8841-9230',
    isPwd: false,
    isSoloParent: false,
    isSenior: false,
    isStudent: false,
    isTeenager: false,
    yearsOfResidency: 7,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Joshua&top=shortFlat&facialHair=beardLight&clothing=collarAndSweater&backgroundColor=b6e3f4'
  },
  {
    id: 'user-chloe-fernandez',
    name: 'Chloe B. Fernandez',
    email: 'chloe.fernandez@gmail.com',
    username: 'chloefernandez',
    role: 'resident',
    contactNumber: '09187771234',
    purok: 'Zone 5',
    address: 'Zone 5, Bugo, CDO',
    residentIdNumber: 'BG-2026-02194',
    isVerified: true,
    registrationStatus: 'Verified',
    registeredDate: '2025-05-18',
    householdIncome: '₱7,000.00 (Below Minimum Wage / Indigent)',
    familyMembersCount: 3,
    nationality: 'Filipino',
    voterStatus: 'Registered',
    occupation: 'Market Vendor / Daily Earner',
    employmentStatus: 'Self-Employed',
    age: 31,
    gender: 'Female',
    civilStatus: 'Separated',
    idType: 'Solo Parent ID Card',
    idNumber: 'SP-2026-8812',
    isPwd: false,
    isSoloParent: true,
    soloParentIdNumber: 'SP-2026-8812',
    isSenior: false,
    isStudent: false,
    isTeenager: false,
    yearsOfResidency: 4,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ChloeLeader&top=curly&facialHairProbability=0&clothing=shirtVNeck&backgroundColor=b6e3f4'
  },
  {
    id: 'user-elena-ramos',
    name: 'Elena M. Ramos',
    email: 'elena.ramos@yahoo.com',
    username: 'elenaramos',
    role: 'resident',
    contactNumber: '09194445678',
    purok: 'Zone 1',
    address: 'Zone 1, Bugo, CDO',
    residentIdNumber: 'BG-2026-01054',
    isVerified: true,
    registrationStatus: 'Verified',
    registeredDate: '2024-11-09',
    householdIncome: '₱5,000.00 (Below Minimum Wage / Indigent)',
    familyMembersCount: 2,
    nationality: 'Filipino',
    voterStatus: 'Registered',
    occupation: 'Senior Pensioner',
    employmentStatus: 'Retired',
    age: 68,
    gender: 'Female',
    civilStatus: 'Widowed',
    idType: 'Senior Citizen OSCA ID',
    idNumber: 'OSCA-2026-0912',
    isPwd: false,
    isSoloParent: false,
    isSenior: true,
    seniorIdNumber: 'OSCA-2026-0912',
    isStudent: false,
    isTeenager: false,
    yearsOfResidency: 25,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=RositaSenior&top=curvy&facialHairProbability=0&clothing=collarAndSweater&backgroundColor=ffd5dc'
  },
  {
    id: 'user-marcus-villanueva',
    name: 'Marcus V. Villanueva',
    email: 'marcus.villanueva@outlook.com',
    username: 'marcusv',
    role: 'resident',
    contactNumber: '09223339900',
    purok: 'Zone 4',
    address: 'Zone 4, Bugo, CDO',
    residentIdNumber: 'BG-2026-03481',
    isVerified: true,
    registrationStatus: 'Verified',
    registeredDate: '2025-02-20',
    householdIncome: '₱9,000.00 (Informal / Low Income)',
    familyMembersCount: 3,
    nationality: 'Filipino',
    voterStatus: 'Registered',
    occupation: 'Handicraft Artisan',
    employmentStatus: 'Self-Employed',
    age: 33,
    gender: 'Male',
    civilStatus: 'Married',
    idType: 'National PWD ID Card',
    idNumber: 'PWD-2026-4410',
    isPwd: true,
    pwdIdNumber: 'PWD-2026-4410',
    pwdDisabilityType: 'Visual Impairment (Low Vision)',
    isSoloParent: false,
    isSenior: false,
    isStudent: false,
    isTeenager: false,
    yearsOfResidency: 6,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus&top=shortCurly&facialHair=beardLight&clothing=shirtCrewNeck&backgroundColor=ffdfbf'
  },
  {
    id: 'user-aria-manlapaz',
    name: 'Aria T. Manlapaz',
    email: 'aria.manlapaz@student.ustp.edu.ph',
    username: 'ariamanlapaz',
    role: 'resident',
    contactNumber: '09278884433',
    purok: 'Zone 2',
    address: 'Zone 2, Bugo, CDO',
    residentIdNumber: 'BG-2026-05928',
    isVerified: true,
    registrationStatus: 'Verified',
    registeredDate: '2025-06-12',
    householdIncome: '₱10,000.00 (Minimum Wage Range)',
    familyMembersCount: 5,
    nationality: 'Filipino',
    voterStatus: 'Registered',
    occupation: 'College Student (BS Information Tech)',
    employmentStatus: 'Student',
    age: 19,
    gender: 'Female',
    civilStatus: 'Single',
    idType: 'School Student ID Card',
    idNumber: 'USTP-2024-8190',
    isPwd: false,
    isSoloParent: false,
    isSenior: false,
    isStudent: true,
    schoolName: 'USTP Cagayan de Oro Campus',
    studentLevel: 'College/University',
    isTeenager: true,
    yearsOfResidency: 12,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AriaStudent&top=curvy&facialHairProbability=0&clothing=collarAndSweater&backgroundColor=ffdfbf'
  },
  {
    id: 'user-danilo-cruz',
    name: 'Danilo G. Cruz',
    email: 'danilo.cruz@gmail.com',
    username: 'danilocruz',
    role: 'resident',
    contactNumber: '09301112233',
    purok: 'Zone 6',
    address: 'Zone 6, Bugo, CDO',
    residentIdNumber: 'BG-2026-06711',
    isVerified: true,
    registrationStatus: 'Verified',
    registeredDate: '2025-07-01',
    householdIncome: '₱12,000.00',
    familyMembersCount: 4,
    nationality: 'Filipino',
    voterStatus: 'Registered',
    occupation: 'Construction Laborer',
    employmentStatus: 'Employed (Full-Time)',
    age: 38,
    gender: 'Male',
    civilStatus: 'Married',
    idType: 'Voter’s ID Card',
    idNumber: 'COMELEC-2026-8812',
    isPwd: false,
    isSoloParent: false,
    isSenior: false,
    isStudent: false,
    isTeenager: false,
    yearsOfResidency: 9,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Antonio&top=dreads01&facialHair=beardLight&clothing=shirtCrewNeck&backgroundColor=ffdfbf'
  }
];

// Comprehensive Barangay Bugo Services across 7 domains
export const INITIAL_PROGRAMS: AssistanceProgram[] = ALL_BARANGAY_SERVICES;

// Sample Applications with Automated Qualification Separation
export const INITIAL_APPLICATIONS: AssistanceApplication[] = [
  {
    id: 'app-001',
    referenceCode: 'CERT-2026-1049',
    programId: 'prog-cert-solo-parent',
    programTitle: 'Solo Parent Barangay Certification (RA 11861)',
    programCategory: 'Clearance & Certification',
    applicantId: 'user-chloe-fernandez',
    applicantName: 'Chloe B. Fernandez',
    contactNumber: '09187771234',
    email: 'chloe.fernandez@gmail.com',
    purok: 'Zone 5',
    address: 'Zone 5, Bugo, CDO',
    householdMonthlyIncome: '₱7,000.00',
    familyMembersCount: 3,
    occupation: 'Market Vendor / Daily Earner',
    purposeOrDiagnosis: 'Annual renewal for City Social Welfare ₱1,000 monthly cash subsidy and 7-day parental leave entitlement.',
    status: 'Approved',
    submissionDate: '2026-11-02',
    lastUpdated: '2026-11-03',
    priorityScore: 'Normal',
    isCertificateQualified: true,
    qualificationDetails: {
      isQualified: true,
      score: 100,
      passedRules: [
        'Solo Parent Status: Verified registered solo parent under RA 11861 (ID #SP-2026-8812)',
        'Civil Status & Dependents: Registered as Separated with 2 minor children',
        'Territorial Residency: Verified resident of Zone 5',
        'Income Ceiling: Household income of ₱7,000.00 within allowable RA 11861 subsidy bracket'
      ],
      failedRules: [],
      summary: 'Automatically Qualified: Applicant satisfies all requirements under Republic Act 11861.'
    },
    evaluatorNotes: 'Solo Parent ID verified with City Social Welfare records. Official certificate signed by Punong Barangay.',
    timeline: [
      {
        status: 'Submitted',
        timestamp: 'Nov 2, 2026 • 09:30 AM',
        officerName: 'Portal Auto-Qualification Engine',
        remarks: 'Household profile evaluated: 100% Qualified under RA 11861 criteria.'
      },
      {
        status: 'Approved',
        timestamp: 'Nov 3, 2026 • 11:00 AM',
        officerName: 'Hon. Juan Dela Cruz (Punong Barangay)',
        remarks: 'Certificate generated and ready for release at Barangay Window 1.'
      }
    ],
    documents: [
      {
        id: 'doc-sp-1',
        name: 'Solo_Parent_ID_Front.jpg',
        type: 'Image',
        size: '1.2 MB',
        uploadDate: '2026-11-02',
        fileUrl: '/sample-documents/photos/01_valid_government_id_QUALIFIED.jpg',
        previewUrl: '/sample-documents/photos/01_valid_government_id_QUALIFIED.jpg',
        verified: true
      },
      {
        id: 'doc-sp-2',
        name: 'Affidavit_of_Solo_Parenting.pdf',
        type: 'PDF',
        size: '640 KB',
        uploadDate: '2026-11-02',
        fileUrl: '/sample-documents/pdfs/05_civil_registry_psa_QUALIFIED.pdf',
        previewUrl: '/sample-documents/pdfs/05_civil_registry_psa_QUALIFIED.pdf',
        verified: true
      }
    ]
  },
  {
    id: 'app-002',
    referenceCode: 'CERT-2026-2180',
    programId: 'prog-cert-senior-citizen',
    programTitle: 'Senior Citizen Barangay Endorsement & Certification',
    programCategory: 'Clearance & Certification',
    applicantId: 'user-elena-ramos',
    applicantName: 'Elena M. Ramos',
    contactNumber: '09194445678',
    email: 'elena.ramos@yahoo.com',
    purok: 'Zone 1',
    address: 'Zone 1, Bugo, CDO',
    householdMonthlyIncome: '₱5,000.00',
    familyMembersCount: 2,
    occupation: 'Senior Pensioner',
    purposeOrDiagnosis: 'Endorsement for Office of Senior Citizens Affairs (OSCA) purchase discount booklet and social pension enrollment.',
    status: 'Ready for Release',
    submissionDate: '2026-11-05',
    lastUpdated: '2026-11-06',
    priorityScore: 'Normal',
    isCertificateQualified: true,
    qualificationDetails: {
      isQualified: true,
      score: 100,
      passedRules: [
        'Senior Age Criteria: Applicant age is 68 years old (exceeds senior threshold >= 60)',
        'Senior OSCA ID: Documented Senior ID #OSCA-2026-0912',
        'Territorial Residency: Verified resident of Zone 1 for 25 years'
      ],
      failedRules: [],
      summary: 'Automatically Qualified: Age 68 verified with PSA Birth Record.'
    },
    evaluatorNotes: 'Senior citizen certificate printed with dry seal. Stamped and ready for pick-up.',
    timeline: [
      {
        status: 'Submitted',
        timestamp: 'Nov 5, 2026 • 08:45 AM',
        officerName: 'Portal Auto-Qualification Engine',
        remarks: 'Automatic Qualification: Age 68 satisfies Senior Citizen parameters.'
      },
      {
        status: 'Ready for Release',
        timestamp: 'Nov 6, 2026 • 02:15 PM',
        officerName: 'Desk Officer Elena',
        remarks: 'Official certificate dry-sealed. Bring valid ID upon claiming.'
      }
    ],
    documents: [
      {
        id: 'doc-sn-1',
        name: 'OSCA_Senior_ID.jpg',
        type: 'Image',
        size: '1.4 MB',
        uploadDate: '2026-11-05',
        fileUrl: '/sample-documents/photos/01_valid_government_id_QUALIFIED.jpg',
        previewUrl: '/sample-documents/photos/01_valid_government_id_QUALIFIED.jpg',
        verified: true
      }
    ]
  },
  {
    id: 'app-003',
    referenceCode: 'CERT-2026-3490',
    programId: 'prog-cert-pwd',
    programTitle: 'PWD Barangay Endorsement & Certification (RA 10754)',
    programCategory: 'Clearance & Certification',
    applicantId: 'user-marcus-villanueva',
    applicantName: 'Marcus V. Villanueva',
    contactNumber: '09223339900',
    email: 'marcus.villanueva@outlook.com',
    purok: 'Zone 4',
    address: 'Zone 4, Bugo, CDO',
    householdMonthlyIncome: '₱9,000.00',
    familyMembersCount: 3,
    occupation: 'Handicraft Artisan',
    purposeOrDiagnosis: 'Endorsement for City Social Welfare assistive visual magnifier device and travel fare discount renewal.',
    status: 'Under Review',
    submissionDate: '2026-11-07',
    lastUpdated: '2026-11-08',
    priorityScore: 'Normal',
    isCertificateQualified: true,
    qualificationDetails: {
      isQualified: true,
      score: 100,
      passedRules: [
        'PWD Verification: Documented Person with Disability status (Visual Impairment) under RA 10754',
        'PWD ID Card: Registered PWD ID #PWD-2026-4410',
        'Territorial Residency: Resident of Zone 4'
      ],
      failedRules: [],
      summary: 'Automatically Qualified: Documented PWD status verified.'
    },
    evaluatorNotes: 'Clinical assessment form verified. Under signature of Barangay Health & Social Committee.',
    timeline: [
      {
        status: 'Submitted',
        timestamp: 'Nov 7, 2026 • 10:10 AM',
        officerName: 'Portal Auto-Qualification Engine',
        remarks: 'Passed PWD qualification criteria.'
      }
    ],
    documents: [
      {
        id: 'doc-pwd-1',
        name: 'PWD_Identification_Card.jpg',
        type: 'Image',
        size: '1.1 MB',
        uploadDate: '2026-11-07',
        fileUrl: '/sample-documents/photos/01_valid_government_id_QUALIFIED.jpg',
        previewUrl: '/sample-documents/photos/01_valid_government_id_QUALIFIED.jpg',
        verified: true
      }
    ]
  },
  {
    id: 'app-004',
    referenceCode: 'CERT-2026-5512',
    programId: 'prog-cert-solo-parent',
    programTitle: 'Solo Parent Barangay Certification (RA 11861)',
    programCategory: 'Clearance & Certification',
    applicantId: 'user-danilo-cruz',
    applicantName: 'Danilo G. Cruz',
    contactNumber: '09301112233',
    email: 'danilo.cruz@gmail.com',
    purok: 'Zone 6',
    address: 'Zone 6, Bugo, CDO',
    householdMonthlyIncome: '₱12,000.00',
    familyMembersCount: 4,
    occupation: 'Construction Laborer',
    purposeOrDiagnosis: 'Requesting certification for solo parent government aid.',
    status: 'Disqualified',
    submissionDate: '2026-11-08',
    lastUpdated: '2026-11-08',
    priorityScore: 'Normal',
    isCertificateQualified: false,
    qualificationDetails: {
      isQualified: false,
      score: 50,
      passedRules: [
        'Territorial Residency: Verified resident of Zone 6'
      ],
      failedRules: [
        'Solo Parent Criteria: Registered as Married with co-parenting spouse; does not qualify under RA 11861 Solo Parents Act'
      ],
      summary: 'Automatically Flagged: Ineligible under Solo Parents Welfare Act (registered as Married).'
    },
    rejectionReason: 'Applicant is registered as Married with living cohabiting spouse. Under RA 11861, Solo Parent certification is restricted to single parents, widowers, or legally separated sole providers.',
    evaluatorNotes: 'Auto-flagged during account profiling check. Disqualified due to civil status (Married).',
    timeline: [
      {
        status: 'Disqualified',
        timestamp: 'Nov 8, 2026 • 01:20 PM',
        officerName: 'Automated Qualification Engine',
        remarks: 'Disqualified: Civil status is Married; does not meet RA 11861 criteria.'
      }
    ],
    documents: [
      {
        id: 'doc-dc-1',
        name: 'Voters_Certificate.pdf',
        type: 'PDF',
        size: '420 KB',
        uploadDate: '2026-11-08',
        fileUrl: '/sample-documents/pdfs/02_barangay_indigency_residency_NOT_QUALIFIED.pdf',
        previewUrl: '/sample-documents/pdfs/02_barangay_indigency_residency_NOT_QUALIFIED.pdf',
        verified: false
      }
    ]
  },
  {
    id: 'app-005',
    referenceCode: 'CERT-2026-8840',
    programId: 'prog-barangay-clearance',
    programTitle: 'Issuance of Barangay Clearance',
    programCategory: 'Clearance & Certification',
    applicantId: 'user-maria-santos',
    applicantName: 'Joshua Abella Laurio',
    contactNumber: '+639944772143',
    email: 'resident@bugo.gov.ph',
    purok: 'Zone 3',
    address: 'Block 4 Lot 12, Zone 3, Bugo, CDO',
    householdMonthlyIncome: '₱8,500.00',
    familyMembersCount: 4,
    occupation: 'Self-Employed / Market Vendor',
    purposeOrDiagnosis: 'Annual renewal of Cagayan de Oro City Market Vendor Stall permit and postal ID requirement.',
    status: 'Approved',
    submissionDate: '2026-11-09',
    lastUpdated: '2026-11-10',
    priorityScore: 'Normal',
    isCertificateQualified: true,
    qualificationDetails: {
      isQualified: true,
      score: 100,
      passedRules: [
        'ID Verification: PhilSys National ID on file (#PH-7120-8841-9230)',
        'Territorial Residency: Resident of Zone 3 for 7 years',
        'Barangay Standing: Verified community resident in good standing'
      ],
      failedRules: [],
      summary: 'Automatically Qualified: Bonafide resident with verified PhilSys National ID.'
    },
    evaluatorNotes: 'Verified resident standing confirmed. Clearance generated with digital verification barcode.',
    timeline: [
      {
        status: 'Submitted',
        timestamp: 'Nov 9, 2026 • 09:15 AM',
        officerName: 'Portal Online System',
        remarks: 'Clearance request submitted and verified against resident record.'
      },
      {
        status: 'Approved',
        timestamp: 'Nov 10, 2026 • 10:30 AM',
        officerName: 'Hon. Juan Dela Cruz (Punong Barangay)',
        remarks: 'Clearance approved and signed.'
      }
    ],
    documents: [
      {
        id: 'doc-cl-1',
        name: 'National_ID_Front.jpg',
        type: 'Image',
        size: '1.5 MB',
        uploadDate: '2026-11-09',
        fileUrl: '/sample-documents/photos/01_valid_government_id_QUALIFIED.jpg',
        previewUrl: '/sample-documents/photos/01_valid_government_id_QUALIFIED.jpg',
        verified: true
      }
    ]
  }
];

// Exactly 3 Sample Announcements
export const INITIAL_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: 'ann-1',
    title: 'Scheduled Water Interruption (Zone 1 to Zone 3)',
    description: 'Zones 1-3 will experience low to no water pressure from 1:00 PM to 5:00 PM due to main pipe repairs and maintenance by COWD.',
    category: 'Water',
    date: 'Today',
    viewsCount: 845,
    iconType: 'water',
    isPinned: true,
    status: 'Published'
  },
  {
    id: 'ann-2',
    title: 'Free Community Medical & Dental Mission',
    description: 'Annual medical mission at the Barangay Bugo Covered Court starting at 8:00 AM. Free general checkups, vitamins, and pediatric consults.',
    category: 'Health',
    date: 'Oct 15',
    viewsCount: 1204,
    iconType: 'medical',
    isPinned: false,
    status: 'Published'
  },
  {
    id: 'ann-3',
    title: 'Inter-Zone Youth Basketball Tournament Registration',
    description: 'Registration is now open for the SK Youth Basketball Tournament. Submit team rosters to the SK Secretariat before Oct 10.',
    category: 'Sports',
    date: 'Oct 10',
    viewsCount: 960,
    iconType: 'sports',
    isPinned: false,
    status: 'Published'
  }
];

export const DEMOGRAPHICS_DATA = [
  { ageGroup: '0-12', count: 2100, label: 'Children (0-12)', percent: '13.6%' },
  { ageGroup: '13-25', count: 4200, label: 'Youth (13-25)', percent: '27.2%' },
  { ageGroup: '26-40', count: 4900, label: 'Young Adults (26-40)', percent: '31.8%' },
  { ageGroup: '41-59', count: 2800, label: 'Middle Age (41-59)', percent: '18.2%' },
  { ageGroup: '60+', count: 1420, label: 'Seniors (60+)', percent: '9.2%' },
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1794067398272',
    userId: 'user-maria-santos',
    title: 'Educational Grant Approved & Scheduled',
    message: 'Your Educational Support Grant application BG-2026-8840 has been verified and approved. Schedule of release: Nov 15, 2026 at the Barangay Bugo Treasury Office.',
    timestamp: 'Nov 8, 2026 • 9:10 PM',
    createdAt: '2026-11-08T21:10:00.000Z',
    read: false,
    type: 'status_update',
    targetArea: 'services',
    applicationRef: 'BG-2026-8840',
    documentData: {
      docType: 'Official Approval Voucher',
      controlNumber: 'VCH-2026-8840',
      recipientName: 'Joshua Abella Laurio',
      issueDate: 'November 8, 2026',
      subject: 'Barangay Bugo Educational Assistance Grant Release',
      narrative: 'This official voucher confirms the approval of tuition and textbook assistance subsidy in the amount of Php 5,000 under the Barangay Bugo Youth Development Fund.',
      venueOrOffice: 'Barangay Bugo Treasury & Cashier Desk, Cagayan de Oro City',
      officialRemarks: 'Present this digital voucher and a valid School ID upon claiming check or cash disbursement.',
      signatoryName: 'Hon. Juan Dela Cruz',
      signatoryRole: 'Punong Barangay'
    }
  },
  {
    id: 'notif-2',
    userId: 'user-pedro-reyes',
    title: 'Medical Aid Application Under Review',
    message: 'Assistance Filing BG-2026-9120 has been received and verified under the Barangay Bugo Health Desk assistance pipeline.',
    timestamp: 'Nov 8, 2026 • 4:15 PM',
    createdAt: '2026-11-08T16:15:00.000Z',
    read: false,
    type: 'status_update',
    applicationRef: 'BG-2026-9120',
    targetArea: 'dashboard',
    documentData: {
      docType: 'Assistance Approval Voucher',
      controlNumber: 'VCH-2026-9120',
      recipientName: 'Pedro Reyes',
      issueDate: 'November 8, 2026',
      subject: 'Official Status Docket: Financial Medical Subsidy Referral',
      narrative: 'This official certification acknowledges that resident assistance claim BG-2026-9120 has been logged into the Secretariat pipeline. Eligibility criteria under Northern Mindanao Medical Center (NMMC) subsidy referral are undergoing review.',
      venueOrOffice: 'Barangay Bugo Health & Social Services Desk',
      officialRemarks: 'Valid Government ID and Doctor Prescription verified by Barangay Social Worker.',
      signatoryName: 'Hon. Juan Dela Cruz',
      signatoryRole: 'Punong Barangay'
    }
  },
  {
    id: 'notif-3',
    userId: 'all',
    title: 'New Service Open: Barangay Educational Scholarship 2026',
    message: 'Official applications are now open for the 2026 Tertiary Education Student Assistance Grant. Registered residents can apply online.',
    timestamp: 'Nov 7, 2026 • 9:00 AM',
    createdAt: '2026-11-07T09:00:00.000Z',
    read: true,
    type: 'announcement',
    targetArea: 'services',
    documentData: {
      docType: 'Official Administrative Advisory',
      controlNumber: 'ADV-2026-1107',
      recipientName: 'To All Bona Fide Bugo Residents & Students',
      issueDate: 'November 7, 2026',
      subject: 'Official Advisory: Opening of Sangguniang Kabataan & Barangay Scholarship Grant 2026',
      narrative: 'Notice is hereby given to all college and vocational students residing in Zones 1 to 10 that the application period for the Barangay Bugo Educational Assistance Subsidy is officially active.',
      venueOrOffice: 'Sangguniang Kabataan Council Office & Bugo Resident Desk',
      officialRemarks: 'Submit Certificate of Registration (COR) and Barangay Certificate of Indigency.',
      signatoryName: 'Hon. Juan Dela Cruz',
      signatoryRole: 'Punong Barangay'
    }
  }
];

export const INITIAL_ACTIVITY_LOGS: ActivityLogItem[] = [
  {
    id: 'act-001',
    residentName: 'Joshua Abella Laurio',
    residentIdNumber: 'BG-2026-04829',
    purok: 'Zone 3',
    actionType: 'Time-In',
    locationOrService: 'Front Desk - Window 2 (Indigency Section)',
    timestamp: '2026-08-31 08:35 AM',
    officerInCharge: 'Desk Officer Elena',
    status: 'Completed',
    details: 'Physical submission of student clearance documents.'
  },
  {
    id: 'act-002',
    residentName: 'Pedro B. Reyes',
    residentIdNumber: 'BG-2026-01205',
    purok: 'Zone 1',
    actionType: 'Time-In',
    locationOrService: 'Health Center Consultation Desk',
    timestamp: '2026-08-31 09:15 AM',
    officerInCharge: 'Barangay Health Worker Rosita',
    status: 'Active',
    details: 'Senior citizen blood pressure checkup and insulin subsidy verification.'
  },
  {
    id: 'act-003',
    residentName: 'Joshua C. Santos',
    residentIdNumber: 'BG-PENDING-098',
    purok: 'Zone 3',
    actionType: 'Portal Login',
    locationOrService: 'Resident Online Web Portal',
    timestamp: '2026-08-31 10:02 AM',
    officerInCharge: 'System Security Auth',
    status: 'Logged',
    details: 'Online profile verification check and OJT clearance submission.'
  }
];

export const INITIAL_ARCHIVED_ITEMS: ArchiveItem[] = [
  {
    id: 'arch-001',
    title: 'Expired Barangay Business Permit (2025 Cycle)',
    originalCategory: 'Document',
    referenceCode: 'BG-BUS-2025-0199',
    deletedBy: 'Admin Secretary',
    deletedAt: '2026-01-15 04:00 PM',
    reasonForArchive: 'Annual cycle renewal completed. Prior year document safely archived.',
    originalData: { applicant: 'Bugo Sari-Sari Store', zone: 'Zone 5' },
    status: 'Archived'
  },
  {
    id: 'arch-002',
    title: 'Duplicated Resident Registration (Draft)',
    originalCategory: 'Resident Record',
    referenceCode: 'BG-DRAFT-8811',
    deletedBy: 'Hon. Juan Dela Cruz',
    deletedAt: '2026-08-10 11:30 AM',
    reasonForArchive: 'Resident submitted duplicate registration form online; primary profile verified.',
    originalData: { residentName: 'Roberto Gomez', zone: 'Zone 2' },
    status: 'Archived'
  }
];
