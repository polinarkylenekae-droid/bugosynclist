import { IdPhotoAnalysis, ResidentUser } from '../types';
import { canonicalizeIdCategory } from './idNameMatcher';

export const RESIDENT_GOV_ID_TYPES = [
  'PhilSys National ID',
  'UMID (Unified Multi-Purpose ID)',
  'Driver’s License',
  'COMELEC Voter’s ID / Certificate',
  'Senior Citizen OSCA ID',
  'Person with Disability (PWD) ID',
  'Solo Parent ID Card',
  'Student School ID Card',
  'Postal ID',
  'Barangay Resident ID Card',
  'PRC Professional License',
] as const;

export type ResidentGovIdType = (typeof RESIDENT_GOV_ID_TYPES)[number];

export type ResidentIdInput = Partial<ResidentUser> & {
  id: string;
  name: string;
  residentIdNumber?: string;
};

interface IdVisualTheme {
  primary: string;
  secondary: string;
  accent: string;
  badgeBg: string;
  badgeText: string;
  republicLine: string;
  agencyLine: string;
  shortLabel: string;
}

const ID_THEMES: Record<string, IdVisualTheme> = {
  philsys: {
    primary: '#1e3a8a',
    secondary: '#1d4ed8',
    accent: '#eab308',
    badgeBg: '#dbeafe',
    badgeText: '#1e3a8a',
    republicLine: 'REPUBLIC OF THE PHILIPPINES',
    agencyLine: 'PHILIPPINE STATISTICS AUTHORITY • PHILSYS',
    shortLabel: 'PHILSYS ID',
  },
  umid: {
    primary: '#0f172a',
    secondary: '#1e40af',
    accent: '#f59e0b',
    badgeBg: '#fef3c7',
    badgeText: '#78350f',
    republicLine: 'REPUBLIC OF THE PHILIPPINES',
    agencyLine: 'UNIFIED MULTI-PURPOSE ID • SSS / GSIS / PHILHEALTH',
    shortLabel: 'UMID CARD',
  },
  driver: {
    primary: '#7f1d1d',
    secondary: '#991b1b',
    accent: '#facc15',
    badgeBg: '#fee2e2',
    badgeText: '#7f1d1d',
    republicLine: 'DEPARTMENT OF TRANSPORTATION',
    agencyLine: 'LAND TRANSPORTATION OFFICE (LTO)',
    shortLabel: "DRIVER'S LICENSE",
  },
  voter: {
    primary: '#312e81',
    secondary: '#4338ca',
    accent: '#fbbf24',
    badgeBg: '#e0e7ff',
    badgeText: '#312e81',
    republicLine: 'COMMISSION ON ELECTIONS (COMELEC)',
    agencyLine: 'OFFICE OF THE ELECTION OFFICER • CDO DISTRICT II',
    shortLabel: "VOTER'S ID",
  },
  senior: {
    primary: '#065f46',
    secondary: '#047857',
    accent: '#f59e0b',
    badgeBg: '#fef3c7',
    badgeText: '#92400e',
    republicLine: 'CITY OF CAGAYAN DE ORO • RA 9994',
    agencyLine: 'OFFICE FOR SENIOR CITIZENS AFFAIRS (OSCA)',
    shortLabel: 'SENIOR OSCA ID',
  },
  pwd: {
    primary: '#4c1d95',
    secondary: '#6d28d9',
    accent: '#2dd4bf',
    badgeBg: '#ede9fe',
    badgeText: '#4c1d95',
    republicLine: 'REPUBLIC OF THE PHILIPPINES • RA 10754',
    agencyLine: 'PERSONS WITH DISABILITY AFFAIRS OFFICE (PDAO)',
    shortLabel: 'PWD ID CARD',
  },
  solo_parent: {
    primary: '#881337',
    secondary: '#be123c',
    accent: '#fda4af',
    badgeBg: '#ffe4e6',
    badgeText: '#881337',
    republicLine: 'DSWD / LGU CAGAYAN DE ORO • RA 11861',
    agencyLine: 'SOLO PARENTS WELFARE IDENTIFICATION',
    shortLabel: 'SOLO PARENT ID',
  },
  student: {
    primary: '#0c4a6e',
    secondary: '#0284c7',
    accent: '#fbbf24',
    badgeBg: '#e0f2fe',
    badgeText: '#0c4a6e',
    republicLine: 'DEPARTMENT OF EDUCATION / CHED',
    agencyLine: 'OFFICIAL STUDENT IDENTIFICATION CARD',
    shortLabel: 'STUDENT ID',
  },
  postal: {
    primary: '#115e59',
    secondary: '#0d9488',
    accent: '#f59e0b',
    badgeBg: '#ccfbf1',
    badgeText: '#115e59',
    republicLine: 'PHILIPPINE POSTAL CORPORATION',
    agencyLine: 'IMPROVED POSTAL IDENTIFICATION CARD',
    shortLabel: 'POSTAL ID',
  },
  barangay: {
    primary: '#0c532b',
    secondary: '#15803d',
    accent: '#eab308',
    badgeBg: '#dcfce7',
    badgeText: '#0c532b',
    republicLine: 'BARANGAY BUGO • CAGAYAN DE ORO CITY',
    agencyLine: 'OFFICE OF THE PUNONG BARANGAY',
    shortLabel: 'BARANGAY ID',
  },
  prc: {
    primary: '#1e293b',
    secondary: '#334155',
    accent: '#eab308',
    badgeBg: '#f1f5f9',
    badgeText: '#0f172a',
    republicLine: 'PROFESSIONAL REGULATION COMMISSION',
    agencyLine: 'REPUBLIC OF THE PHILIPPINES • MANILA / CDO',
    shortLabel: 'PRC LICENSE',
  },
};

function computeEffectiveAge(resident: ResidentIdInput): number {
  if (typeof resident.age === 'number' && resident.age > 0) {
    return resident.age;
  }
  if (resident.birthdate) {
    const parsed = new Date(resident.birthdate);
    if (!Number.isNaN(parsed.getTime())) {
      const refYear = 2026;
      const age = refYear - parsed.getUTCFullYear();
      if (age > 0 && age < 120) return age;
    }
  }
  return 28;
}

function estimateBirthdate(resident: ResidentIdInput, age: number): string {
  if (resident.birthdate && /^\d{4}-\d{2}-\d{2}/.test(resident.birthdate)) {
    return resident.birthdate.slice(0, 10);
  }
  const birthYear = Math.max(1930, 2026 - Math.max(1, age));
  const seed = hashString(resident.id || resident.name);
  const month = String((seed % 12) + 1).padStart(2, '0');
  const day = String(((seed >> 3) % 28) + 1).padStart(2, '0');
  return `${birthYear}-${month}-${day}`;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getEligibleIdTypesForResident(resident: ResidentIdInput): ResidentGovIdType[] {
  const age = computeEffectiveAge(resident);
  const isMinor = age > 0 && age < 18;
  const isSenior = Boolean(resident.isSenior) || age >= 60;
  const isPwd = Boolean(resident.isPwd);
  const isSoloParent = Boolean(resident.isSoloParent);
  const emp = String(resident.employmentStatus || '').toLowerCase();
  const occ = String(resident.occupation || '').toLowerCase();
  const isStudent =
    Boolean(resident.isStudent) ||
    emp === 'student' ||
    occ.includes('student') ||
    occ.includes('scholar');
  const isRegisteredVoter =
    String(resident.voterStatus || '').toLowerCase() === 'registered' && !isMinor;
  const isProfessional =
    !isMinor &&
    (emp.includes('employed') ||
      /teacher|nurse|engineer|accountant|architect|doctor|physician|pharmacist|midwife|lawyer|officer|technician/i.test(
        occ
      ));

  const weightedPool: ResidentGovIdType[] = [];
  const pushWeighted = (type: ResidentGovIdType, weight: number) => {
    for (let i = 0; i < weight; i++) {
      weightedPool.push(type);
    }
  };

  if (isMinor) {
    if (isStudent) {
      pushWeighted('Student School ID Card', 4);
    } else {
      pushWeighted('Student School ID Card', 1);
    }
    pushWeighted('PhilSys National ID', 2);
    pushWeighted('Barangay Resident ID Card', 2);
    if (isPwd) {
      pushWeighted('Person with Disability (PWD) ID', 3);
    }
    return weightedPool;
  }

  // General Adult IDs (age >= 18)
  pushWeighted('PhilSys National ID', 2);
  pushWeighted('Barangay Resident ID Card', 2);
  pushWeighted('Postal ID', 1);
  pushWeighted('UMID (Unified Multi-Purpose ID)', 2);
  if (age <= 75) {
    pushWeighted('Driver’s License', 1);
  }

  if (isRegisteredVoter) {
    pushWeighted('COMELEC Voter’s ID / Certificate', 2);
  }
  if (isSenior) {
    pushWeighted('Senior Citizen OSCA ID', 5);
  }
  if (isPwd) {
    pushWeighted('Person with Disability (PWD) ID', 5);
  }
  if (isSoloParent) {
    pushWeighted('Solo Parent ID Card', 5);
  }
  if (isStudent) {
    pushWeighted('Student School ID Card', 4);
  }
  if (isProfessional) {
    pushWeighted('PRC Professional License', 2);
  }

  return weightedPool;
}

export function selectRandomIdTypeForResident(resident: ResidentIdInput): ResidentGovIdType {
  const pool = getEligibleIdTypesForResident(resident);
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx] || 'PhilSys National ID';
}

function randomDigits(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += String(Math.floor(Math.random() * 10));
  }
  return out;
}

export function generateIdNumberForType(
  idType: string,
  resident?: ResidentIdInput
): string {
  const canon = canonicalizeIdCategory(idType);
  if (canon === 'senior' && resident?.seniorIdNumber) {
    return resident.seniorIdNumber;
  }
  if (canon === 'pwd' && resident?.pwdIdNumber) {
    return resident.pwdIdNumber;
  }
  if (canon === 'solo_parent' && resident?.soloParentIdNumber) {
    return resident.soloParentIdNumber;
  }

  switch (canon) {
    case 'philsys':
      return `PSN-${randomDigits(4)}-${randomDigits(4)}-${randomDigits(4)}`;
    case 'umid':
      return `CRN-0111-${randomDigits(7)}-${randomDigits(1)}`;
    case 'driver':
      return `K02-${randomDigits(2)}-${randomDigits(6)}`;
    case 'voter':
      return `VIN-1043-${randomDigits(4)}-${randomDigits(4)}`;
    case 'senior':
      return `OSCA-CDO-2026-${randomDigits(4)}`;
    case 'pwd':
      return `10-4305-PWD-${randomDigits(4)}`;
    case 'solo_parent':
      return `SP-BUGO-2026-${randomDigits(4)}`;
    case 'student':
      return `STU-BUGO-2026-${randomDigits(4)}`;
    case 'postal':
      return `PRN-K88-${randomDigits(6)}-P`;
    case 'prc':
      return `PRC-01${randomDigits(5)}`;
    case 'barangay':
    default:
      return `BRGY-BG-2026-${randomDigits(4)}`;
  }
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncateText(str: string, maxLen: number): string {
  const clean = String(str || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1).trim()}…`;
}

function encodeSvgDataUrl(svg: string): string {
  if (typeof Buffer !== 'undefined') {
    return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
  }
  const bytes = new TextEncoder().encode(svg);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

function buildDeterministicQrRects(seedStr: string): string {
  const seed = hashString(seedStr);
  const cells: string[] = [];
  const size = 9;
  const cellPx = 8;
  const startX = 486;
  const startY = 178;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const isCornerFinder =
        (r < 3 && c < 3) || (r < 3 && c >= size - 3) || (r >= size - 3 && c < 3);
      const bit = isCornerFinder
        ? r === 1 && c === 1
          ? true
          : r === 0 || r === 2 || c === 0 || c === 2 || r === size - 1 || c === size - 1
        : ((seed >> ((r * size + c) % 24)) ^ (r * 7 + c * 13)) % 2 === 0;
      if (bit) {
        cells.push(
          `<rect x="${startX + c * cellPx}" y="${startY + r * cellPx}" width="${cellPx - 1}" height="${cellPx - 1}" fill="#0f172a" rx="1"/>`
        );
      }
    }
  }
  return cells.join('');
}

export function buildResidentIdCardSvgs(params: {
  resident: ResidentIdInput;
  idType: string;
  idNumber: string;
}): { frontIdUrl: string; backIdUrl: string; birthdate: string } {
  const { resident, idType, idNumber } = params;
  const canon = canonicalizeIdCategory(idType) || 'barangay';
  const theme = ID_THEMES[canon] || ID_THEMES.barangay;
  const age = computeEffectiveAge(resident);
  const birthdate = estimateBirthdate(resident, age);
  const gender = resident.gender || 'Resident';
  const civilStatus = resident.civilStatus || 'Single';
  const nationality = resident.nationality || 'Filipino';
  const purok = String(resident.purok || 'Zone 1').split(' - ')[0].trim();
  const addressLine = truncateText(
    resident.address || `${purok}, Barangay Bugo, Cagayan de Oro City`,
    44
  );
  const displayName = truncateText(resident.name.toUpperCase(), 32);
  const residentRef = resident.residentIdNumber || 'BG-2026-RES';
  const initials = resident.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const frontSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="640" height="400">
  <defs>
    <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${theme.primary}"/>
      <stop offset="100%" stop-color="${theme.secondary}"/>
    </linearGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
  </defs>
  <rect width="640" height="400" rx="24" fill="url(#bg)" stroke="#cbd5e1" stroke-width="3"/>
  <path d="M0 24 Q0 0 24 0 H616 Q640 0 640 24 V92 H0 Z" fill="url(#hdr)"/>
  <rect x="0" y="92" width="640" height="6" fill="${theme.accent}"/>
  <circle cx="52" cy="46" r="24" fill="#ffffff" fill-opacity="0.16" stroke="${theme.accent}" stroke-width="2"/>
  <text x="52" y="52" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-weight="bold" fill="#ffffff">PH</text>
  <text x="90" y="34" font-family="Arial,sans-serif" font-size="11" font-weight="bold" letter-spacing="1.4" fill="#e2e8f0">${escapeXml(theme.republicLine)}</text>
  <text x="90" y="53" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="#ffffff">${escapeXml(truncateText(idType.toUpperCase(), 38))}</text>
  <text x="90" y="72" font-family="Arial,sans-serif" font-size="10" fill="#cbd5e1">${escapeXml(theme.agencyLine)}</text>
  <rect x="510" y="26" width="106" height="28" rx="8" fill="${theme.accent}"/>
  <text x="563" y="44" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="bold" fill="#0f172a">FRONT VIEW</text>

  <rect x="28" y="122" width="136" height="168" rx="14" fill="${theme.badgeBg}" stroke="${theme.secondary}" stroke-width="2"/>
  <circle cx="96" cy="182" r="32" fill="${theme.secondary}" fill-opacity="0.22"/>
  <circle cx="96" cy="176" r="18" fill="${theme.primary}" fill-opacity="0.82"/>
  <path d="M58 248 C58 218 134 218 134 248 Z" fill="${theme.primary}" fill-opacity="0.82"/>
  <text x="96" y="276" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="${theme.badgeText}">${escapeXml(initials)}</text>

  <text x="184" y="138" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="#64748b">CARDHOLDER FULL NAME</text>
  <text x="184" y="160" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="#0f172a">${escapeXml(displayName)}</text>

  <text x="184" y="190" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="#64748b">IDENTIFICATION NUMBER</text>
  <text x="184" y="211" font-family="Courier New,monospace" font-size="17" font-weight="bold" fill="${theme.primary}">${escapeXml(idNumber)}</text>

  <text x="184" y="242" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="#64748b">DATE OF BIRTH</text>
  <text x="184" y="259" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="#1e293b">${escapeXml(birthdate)} (${age} yrs)</text>

  <text x="366" y="242" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="#64748b">SEX / CIVIL STATUS</text>
  <text x="366" y="259" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="#1e293b">${escapeXml(gender)} • ${escapeXml(civilStatus)}</text>

  <text x="184" y="288" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="#64748b">REGISTERED RESIDENCE</text>
  <text x="184" y="305" font-family="Arial,sans-serif" font-size="12" font-weight="bold" fill="#1e293b">${escapeXml(addressLine)}</text>

  <rect x="28" y="330" width="584" height="46" rx="12" fill="#ecfdf5" stroke="#a7f3d0" stroke-width="1.5"/>
  <circle cx="52" cy="353" r="11" fill="#059669"/>
  <path d="M47 353 L51 357 L58 349" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="74" y="350" font-family="Arial,sans-serif" font-size="12" font-weight="bold" fill="#065f46">VALIDATED IDENTITY CREDENTIAL • ${escapeXml(theme.shortLabel)}</text>
  <text x="74" y="366" font-family="Arial,sans-serif" font-size="10" fill="#047857">Barangay Ref: ${escapeXml(residentRef)} • ${escapeXml(purok)}, Barangay Bugo, CDO</text>
</svg>`;

  const qrCells = buildDeterministicQrRects(`${resident.id}:${idNumber}:${idType}`);
  const backSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="640" height="400">
  <defs>
    <linearGradient id="bhdr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${theme.primary}"/>
      <stop offset="100%" stop-color="${theme.secondary}"/>
    </linearGradient>
  </defs>
  <rect width="640" height="400" rx="24" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>
  <path d="M0 24 Q0 0 24 0 H616 Q640 0 640 24 V66 H0 Z" fill="url(#bhdr)"/>
  <rect x="0" y="66" width="640" height="5" fill="${theme.accent}"/>
  <text x="28" y="40" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="#ffffff">${escapeXml(truncateText(idType.toUpperCase(), 38))} — VERIFICATION BACK</text>
  <rect x="516" y="18" width="96" height="28" rx="8" fill="${theme.accent}"/>
  <text x="564" y="36" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="bold" fill="#0f172a">BACK VIEW</text>

  <rect x="0" y="84" width="640" height="30" fill="#1e293b"/>

  <text x="28" y="140" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="#64748b">CARDHOLDER</text>
  <text x="28" y="160" font-family="Arial,sans-serif" font-size="16" font-weight="bold" fill="#0f172a">${escapeXml(displayName)}</text>

  <text x="28" y="190" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="#64748b">ID NUMBER</text>
  <text x="28" y="210" font-family="Courier New,monospace" font-size="15" font-weight="bold" fill="${theme.primary}">${escapeXml(idNumber)}</text>

  <text x="28" y="238" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="#64748b">PERMANENT ADDRESS</text>
  <text x="28" y="255" font-family="Arial,sans-serif" font-size="12" font-weight="bold" fill="#1e293b">${escapeXml(addressLine)}</text>

  <text x="28" y="284" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="#64748b">NATIONALITY &amp; REGISTRY NO.</text>
  <text x="28" y="301" font-family="Arial,sans-serif" font-size="12" font-weight="bold" fill="#1e293b">${escapeXml(nationality)} • ${escapeXml(residentRef)} • ${escapeXml(purok)}</text>

  <rect x="470" y="162" width="104" height="104" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
  ${qrCells}
  <text x="522" y="282" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="bold" fill="#475569">SCAN TO VERIFY ID</text>

  <line x1="28" y1="346" x2="260" y2="346" stroke="#334155" stroke-width="1.5"/>
  <text x="28" y="362" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="#475569">BEARER SIGNATURE</text>
  <text x="28" y="338" font-family="Georgia,serif" font-style="italic" font-size="14" fill="#1e293b">${escapeXml(truncateText(resident.name, 26))}</text>

  <rect x="300" y="324" width="312" height="46" rx="10" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1"/>
  <text x="316" y="344" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="#0f172a">BARANGAY BUGO • AUTHENTICATED RECORD</text>
  <text x="316" y="360" font-family="Arial,sans-serif" font-size="9.5" fill="#475569">Valid for LGU &amp; Barangay Social Welfare Verification</text>
</svg>`;

  return {
    frontIdUrl: encodeSvgDataUrl(frontSvg),
    backIdUrl: encodeSvgDataUrl(backSvg),
    birthdate,
  };
}

export function generateValidIdPackageForResident(resident: ResidentIdInput): {
  idType: ResidentGovIdType;
  idNumber: string;
  birthdate: string;
  frontIdUrl: string;
  backIdUrl: string;
  idPhotoAnalysis: IdPhotoAnalysis;
  backIdPhotoAnalysis: IdPhotoAnalysis;
} {
  const idType = selectRandomIdTypeForResident(resident);
  const idNumber = generateIdNumberForType(idType, resident);
  const age = computeEffectiveAge(resident);
  const { frontIdUrl, backIdUrl, birthdate } = buildResidentIdCardSvgs({
    resident,
    idType,
    idNumber,
  });

  const sharedExtracted = {
    extractedName: resident.name,
    extractedBirthdate: birthdate,
    extractedAge: age,
    extractedIdType: idType,
    extractedIdNumber: idNumber,
    extractedAddress: resident.address || `${resident.purok || 'Zone 1'}, Barangay Bugo, Cagayan de Oro City`,
    extractedGender: resident.gender || undefined,
    extractedCivilStatus: resident.civilStatus || 'Single',
    detectedDocType: idType,
    isId: true,
    isClear: true,
    isBlurry: false,
    aiVisionUsed: true,
    matchesExpectedType: true,
    matchesExpectedName: true,
    matchesExpectedBirthdate: true,
    matchesExpectedAddress: true,
    matchesExpectedIdNumber: true,
    matchesExpectedGender: true,
    matchesExpectedCivilStatus: true,
    matchesExpectedSide: true,
    detectedFlags: {
      isSenior: Boolean(resident.isSenior) || age >= 60,
      isPwd: Boolean(resident.isPwd),
      isSoloParent: Boolean(resident.isSoloParent),
      isStudent:
        Boolean(resident.isStudent) ||
        String(resident.employmentStatus || '').toLowerCase() === 'student',
    },
    score: 96,
  };

  const idPhotoAnalysis: IdPhotoAnalysis = {
    ...sharedExtracted,
    detectedSide: 'front',
    advice: `Verified ${idType} (Front) matching ${resident.name}.`,
  };

  const backIdPhotoAnalysis: IdPhotoAnalysis = {
    ...sharedExtracted,
    detectedSide: 'back',
    advice: `Verified ${idType} (Back) matching ${resident.name}.`,
  };

  return {
    idType,
    idNumber,
    birthdate,
    frontIdUrl,
    backIdUrl,
    idPhotoAnalysis,
    backIdPhotoAnalysis,
  };
}
