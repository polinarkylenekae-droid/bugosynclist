export function canonicalizeIdCategory(raw?: string): string {
  const text = String(raw || '').toLowerCase();
  if (!text) return '';
  if (
    text.includes('philsys') ||
    text.includes('philid') ||
    text.includes('national id') ||
    text.includes('ephilid') ||
    text.includes('psn')
  ) {
    return 'philsys';
  }
  if (text.includes('driver') || text.includes('lto')) return 'driver';
  if (text.includes('umid') || text.includes('unified multi-purpose')) return 'umid';
  if (text.includes('voter') || text.includes('comelec')) return 'voter';
  if (text.includes('senior') || text.includes('osca')) return 'senior';
  if (text.includes('pwd') || text.includes('disability') || text.includes('ncda')) return 'pwd';
  if (text.includes('solo parent')) return 'solo_parent';
  if (text.includes('student') || text.includes('school')) return 'student';
  if (text.includes('postal') || text.includes('philpost')) return 'postal';
  if (text.includes('barangay')) return 'barangay';
  if (text.includes('prc') || text.includes('professional regulation')) return 'prc';
  if (text.includes('passport') || text.includes('dfa')) return 'passport';
  if (text.includes('philhealth')) return 'philhealth';
  if (text.includes('tin') || text.includes('bir')) return 'tin';
  if (text.includes('pag-ibig') || text.includes('pagibig') || text.includes('hdmf')) return 'pagibig';
  if (text.includes('sss')) return 'sss';
  if (text.includes('company') || text.includes('employee')) return 'company';
  return '';
}

const SUFFIX_SET = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v', 'vi']);

export function normalizeNameText(raw?: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeAlpha(raw?: string): string[] {
  return normalizeNameText(raw)
    .replace(/,/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function stripSuffixTokens(tokens: string[]): { base: string[]; suffixes: string[] } {
  const base: string[] = [];
  const suffixes: string[] = [];
  for (const t of tokens) {
    if (SUFFIX_SET.has(t)) {
      suffixes.push(t);
    } else {
      base.push(t);
    }
  }
  return { base, suffixes };
}

export interface ParsedPersonName {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  normalizedFull: string;
}

function toTitleCase(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase();
      if (['II', 'III', 'IV', 'V', 'VI'].includes(upper)) return upper;
      if (['JR', 'SR'].includes(upper)) return upper.charAt(0) + upper.slice(1).toLowerCase() + '.';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export function parseExtractedNameParts(rawName?: string): ParsedPersonName {
  const raw = String(rawName || '').trim();
  if (!raw) {
    return { firstName: '', middleName: '', lastName: '', suffix: '', normalizedFull: '' };
  }

  // Handle "LASTNAME [SUFFIX], FIRSTNAME MIDDLENAME [SUFFIX]"
  if (raw.includes(',')) {
    const [lastPartRaw, restRaw] = raw.split(',', 2);
    const lastTokensRaw = lastPartRaw.trim().split(/\s+/).filter(Boolean);
    const restTokens = restRaw.trim().split(/\s+/).filter(Boolean);
    let suffix = '';
    const lastTokens: string[] = [];
    for (const tok of lastTokensRaw) {
      const cleanTok = tok.replace(/\./g, '').toLowerCase();
      if (SUFFIX_SET.has(cleanTok) && lastTokens.length >= 1) {
        suffix = tok;
      } else {
        lastTokens.push(tok);
      }
    }
    const lastCleaned = lastTokens.join(' ');
    const givenTokens: string[] = [];
    for (const tok of restTokens) {
      const cleanTok = tok.replace(/\./g, '').toLowerCase();
      if (SUFFIX_SET.has(cleanTok)) {
        if (!suffix) suffix = tok;
      } else {
        givenTokens.push(tok);
      }
    }
    const firstName = givenTokens.length > 1
      ? givenTokens.slice(0, givenTokens.length - 1).join(' ')
      : (givenTokens[0] || '');
    const middleName = givenTokens.length > 1 ? givenTokens[givenTokens.length - 1] : '';
    const lastName = lastCleaned;
    const f = toTitleCase(firstName);
    const m = middleName ? toTitleCase(middleName.replace(/\.$/, '')) : '';
    const l = toTitleCase(lastName);
    const s = suffix ? toTitleCase(suffix.replace(/\.$/, '')) : '';
    return {
      firstName: f,
      middleName: m,
      lastName: l,
      suffix: s,
      normalizedFull: [f, m, l, s].filter(Boolean).join(' '),
    };
  }

  const tokens = raw.split(/\s+/).filter(Boolean);
  let suffix = '';
  const nonSuffix: string[] = [];
  for (const tok of tokens) {
    const cleanTok = tok.replace(/\./g, '').toLowerCase();
    if (SUFFIX_SET.has(cleanTok) && nonSuffix.length >= 2) {
      suffix = tok;
    } else {
      nonSuffix.push(tok);
    }
  }

  if (nonSuffix.length === 1) {
    const single = toTitleCase(nonSuffix[0]);
    return { firstName: single, middleName: '', lastName: '', suffix: '', normalizedFull: single };
  }

  let firstName = '';
  let middleName = '';
  let lastName = '';

  const COMPOUND_LAST_PARTICLES = new Set([
    'dela', 'de', 'del', 'delos', 'san', 'santa', 'santo', 'los', 'las', 'la', 'mc', 'mac', 'van', 'von'
  ]);

  // 1. If there is an explicit middle initial (e.g., "JUAN S. DELA CRUZ" or "JUAN S DELA CRUZ")
  const explicitMiIdx = nonSuffix.findIndex(
    (tok, idx) => idx >= 1 && idx < nonSuffix.length - 1 && /^[A-Za-z]\.?$/.test(tok)
  );

  if (explicitMiIdx !== -1) {
    firstName = toTitleCase(nonSuffix.slice(0, explicitMiIdx).join(' '));
    middleName = toTitleCase(nonSuffix[explicitMiIdx].replace(/\.$/, ''));
    lastName = toTitleCase(nonSuffix.slice(explicitMiIdx + 1).join(' '));
  } else {
    // 2. Determine surname boundary respecting Filipino compound surnames ("Dela Cruz", "De Los Santos", "De La Cruz")
    let lastStartIdx = nonSuffix.length - 1;
    if (
      nonSuffix.length >= 4 &&
      nonSuffix[nonSuffix.length - 3].toLowerCase() === 'de' &&
      ['la', 'los', 'las'].includes(nonSuffix[nonSuffix.length - 2].toLowerCase())
    ) {
      lastStartIdx = nonSuffix.length - 3;
    } else if (
      nonSuffix.length >= 3 &&
      COMPOUND_LAST_PARTICLES.has(nonSuffix[nonSuffix.length - 2].toLowerCase())
    ) {
      lastStartIdx = nonSuffix.length - 2;
    }

    lastName = toTitleCase(nonSuffix.slice(lastStartIdx).join(' '));
    const givenTokens = nonSuffix.slice(0, lastStartIdx);

    if (givenTokens.length >= 2) {
      middleName = toTitleCase(givenTokens[givenTokens.length - 1].replace(/\.$/, ''));
      firstName = toTitleCase(givenTokens.slice(0, givenTokens.length - 1).join(' '));
    } else {
      firstName = toTitleCase(givenTokens.join(' '));
    }
  }

  const s = suffix ? toTitleCase(suffix.replace(/\.$/, '')) : '';
  return {
    firstName,
    middleName,
    lastName,
    suffix: s,
    normalizedFull: [firstName, middleName, lastName, s].filter(Boolean).join(' '),
  };
}

export interface NameMatchResult {
  matches: boolean;
  compared: boolean;
  reason?: string;
}

export function matchApplicantNameWithId(
  applicant: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    suffix?: string;
    fullName?: string;
  },
  extractedIdName?: string
): NameMatchResult {
  const rawIdName = String(extractedIdName || '').trim();
  if (!rawIdName) {
    return { matches: true, compared: false };
  }

  // Reject non-person placeholder strings on extracted IDs
  const idParsed = parseExtractedNameParts(rawIdName);
  const idAllTokens = stripSuffixTokens(tokenizeAlpha(rawIdName));
  if (idAllTokens.base.length < 2) {
    return { matches: true, compared: false };
  }

  const rawFirst = String(applicant.firstName || '').trim();
  const rawMiddle = String(applicant.middleName || '').trim();
  const rawLast = String(applicant.lastName || '').trim();
  const rawSuffix = String(applicant.suffix || '').trim();
  const rawFull = String(applicant.fullName || '').trim();

  const composed = [rawFirst, rawMiddle, rawLast, rawSuffix].filter(Boolean).join(' ').trim() || rawFull;
  const applicantTokensAll = stripSuffixTokens(tokenizeAlpha(composed));

  if (applicantTokensAll.base.length < 2) {
    return { matches: true, compared: false };
  }

  // Determine applicant first/last tokens cleanly
  const firstTokens = rawFirst
    ? stripSuffixTokens(tokenizeAlpha(rawFirst)).base
    : [applicantTokensAll.base[0]];
  const lastTokens = rawLast
    ? stripSuffixTokens(tokenizeAlpha(rawLast)).base
    : [applicantTokensAll.base[applicantTokensAll.base.length - 1]];
  const middleTokens = rawMiddle
    ? stripSuffixTokens(tokenizeAlpha(rawMiddle)).base
    : [];

  const idTokenSet = new Set(idAllTokens.base);

  // Every token in applicant First Name and Last Name must appear in the ID name
  const firstOk = firstTokens.every((t) => idTokenSet.has(t));
  const lastOk = lastTokens.every((t) => idTokenSet.has(t));

  if (!firstOk || !lastOk) {
    const displayApplicant = composed;
    return {
      matches: false,
      compared: true,
      reason: `Name mismatch: Account name "${displayApplicant}" does not match the name on the ID ("${rawIdName}").`,
    };
  }

  // Also ensure ID doesn't belong to someone with a completely different family/first name when applicant provided multiple tokens
  const knownApplicantCore = new Set([...firstTokens, ...lastTokens]);
  const remainingIdTokens = idAllTokens.base.filter((t) => !knownApplicantCore.has(t));

  // If the ID explicitly uses "LASTNAME, FIRSTNAME..." comma format, verify the extracted last name matches applicant's last name
  // and applicant's first name is on the given-name side (not solely the middle name)
  const idLastTokens = stripSuffixTokens(tokenizeAlpha(idParsed.lastName)).base;
  if (rawIdName.includes(',') && rawLast && idLastTokens.length > 0) {
    const appAllSet = new Set(applicantTokensAll.base);
    const idLastMatchesApp = idLastTokens.every((t) => appAllSet.has(t));
    if (!idLastMatchesApp) {
      return {
        matches: false,
        compared: true,
        reason: `Name mismatch: Last name on ID ("${idParsed.lastName}") does not match your entered last name ("${rawLast}").`,
      };
    }
    if (rawFirst && idParsed.firstName) {
      const idFirstTokens = stripSuffixTokens(tokenizeAlpha(idParsed.firstName)).base;
      if (idFirstTokens.length > 0 && !firstTokens.some((ft) => idFirstTokens.includes(ft))) {
        return {
          matches: false,
          compared: true,
          reason: `Name mismatch: First name on ID ("${idParsed.firstName}") does not match your entered first name ("${rawFirst}").`,
        };
      }
    }
  } else if (!rawIdName.includes(',') && idAllTokens.base.length >= 3) {
    // Without comma: prevent middle name from falsely passing as Last Name (e.g., "Juan Santos" vs "Juan Santos Dela Cruz")
    const endStartIdx = Math.max(1, idAllTokens.base.length - lastTokens.length);
    const matchesTail = lastTokens.every((t, i) => idAllTokens.base[endStartIdx + i] === t);
    const matchesHead = lastTokens.every((t, i) => idAllTokens.base[i] === t);
    const parsedIdLastTokens = stripSuffixTokens(tokenizeAlpha(idParsed.lastName)).base;
    const matchesParsedLast =
      parsedIdLastTokens.length > 0 &&
      lastTokens.every((t) => parsedIdLastTokens.includes(t));

    if (!matchesTail && !matchesHead && !matchesParsedLast) {
      return {
        matches: false,
        compared: true,
        reason: `Name mismatch: Last name on ID ("${idParsed.lastName || rawIdName}") does not match your entered last name ("${rawLast || lastTokens.join(' ')}").`,
      };
    }
  }

  // Optional Middle Name / Middle Initial consistency check when BOTH applicant and ID carry a middle token
  if (middleTokens.length > 0 && remainingIdTokens.length > 0) {
    const compatible = remainingIdTokens.some((rt) =>
      middleTokens.some(
        (mt) =>
          rt === mt ||
          (rt.length === 1 && mt.startsWith(rt)) ||
          (mt.length === 1 && rt.startsWith(mt))
      )
    );
    if (!compatible) {
      return {
        matches: false,
        compared: true,
        reason: `Name mismatch: Middle name on ID ("${rawIdName}") does not match "${rawMiddle}".`,
      };
    }
  }

  // Conflicting suffix check ONLY if both explicitly supplied different suffixes (e.g. Jr vs Sr)
  if (applicantTokensAll.suffixes.length > 0 && idAllTokens.suffixes.length > 0) {
    if (applicantTokensAll.suffixes[0] !== idAllTokens.suffixes[0]) {
      return {
        matches: false,
        compared: true,
        reason: `Name mismatch: Suffix on ID ("${idAllTokens.suffixes[0].toUpperCase()}") does not match "${applicantTokensAll.suffixes[0].toUpperCase()}".`,
      };
    }
  }

  return { matches: true, compared: true };
}

export function formatSecondsMMSS(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export interface FieldMatchResult {
  matches: boolean;
  compared: boolean;
  reason?: string;
}

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

export function parseFlexibleDateToIso(raw?: string): { iso: string; year: number; month: number; day: number } | null {
  const s = String(raw || '').trim();
  if (!s) return null;

  const formatResult = (year: number, month: number, day: number) => {
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (dt.getUTCFullYear() !== year || dt.getUTCMonth() + 1 !== month || dt.getUTCDate() !== day) return null;
    return {
      iso: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      year,
      month,
      day,
    };
  };

  // YYYY-MM-DD or YYYY/MM/DD
  const ymd = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymd) {
    return formatResult(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  }

  // MM/DD/YYYY or DD/MM/YYYY or MM-DD-YYYY
  const dmyOrMdy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyOrMdy) {
    const a = Number(dmyOrMdy[1]);
    const b = Number(dmyOrMdy[2]);
    const y = Number(dmyOrMdy[3]);
    if (a > 12 && b <= 12) return formatResult(y, b, a);
    return formatResult(y, a, b);
  }

  // Textual month: "January 15, 1995", "JAN 15 1995", "MAY-14-1995", "MAY 14,1995"
  const mdyText = s.match(/^([A-Za-z]+)[\s\-/.,]+(\d{1,2})[\s\-/.,]+(\d{4})$/);
  if (mdyText) {
    const m = MONTH_MAP[mdyText[1].toLowerCase()];
    if (m) return formatResult(Number(mdyText[3]), m, Number(mdyText[2]));
  }

  // Textual day-first: "15 JAN 1995", "14-MAY-1995", "15 January, 1995"
  const dmyText = s.match(/^(\d{1,2})[\s\-/.,]+([A-Za-z]+)[\s\-/.,]+(\d{4})$/);
  if (dmyText) {
    const m = MONTH_MAP[dmyText[2].toLowerCase()];
    if (m) return formatResult(Number(dmyText[3]), m, Number(dmyText[1]));
  }

  // Year-first textual month: "1995 MAY 14", "1995-MAY-14"
  const ymdText = s.match(/^(\d{4})[\s\-/.,]+([A-Za-z]+)[\s\-/.,]+(\d{1,2})$/);
  if (ymdText) {
    const m = MONTH_MAP[ymdText[2].toLowerCase()];
    if (m) return formatResult(Number(ymdText[1]), m, Number(ymdText[3]));
  }

  // ISO timestamp prefix fallback
  const isoPrefix = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoPrefix) {
    return formatResult(Number(isoPrefix[1]), Number(isoPrefix[2]), Number(isoPrefix[3]));
  }

  return null;
}

export function matchApplicantBirthdateWithId(
  applicant: { birthdate?: string; age?: number },
  extracted: { extractedBirthdate?: string; extractedAge?: number }
): FieldMatchResult {
  const appDob = parseFlexibleDateToIso(applicant.birthdate);
  const idDob = parseFlexibleDateToIso(extracted.extractedBirthdate);

  if (appDob && idDob) {
    if (appDob.iso !== idDob.iso) {
      return {
        matches: false,
        compared: true,
        reason: `Birthdate mismatch: Entered birthdate (${appDob.iso}) does not match the birthdate printed on your ID (${idDob.iso}).`,
      };
    }
    return { matches: true, compared: true };
  }

  const appAge = typeof applicant.age === 'number' && applicant.age > 0 ? applicant.age : undefined;
  const idAge = typeof extracted.extractedAge === 'number' && extracted.extractedAge > 0 ? extracted.extractedAge : undefined;
  if (appAge !== undefined && idAge !== undefined) {
    if (Math.abs(appAge - idAge) > 1) {
      return {
        matches: false,
        compared: true,
        reason: `Age/Birthdate mismatch: Entered age (${appAge}) does not match the age shown on your ID (${idAge}).`,
      };
    }
    return { matches: true, compared: true };
  }

  return { matches: true, compared: false };
}

export function normalizeIdCode(raw?: string): string {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function stripCommonIdPrefix(code: string): string {
  return code.replace(/^(?:PSN|CRN|VIN|TIN|IDNO|ID|NO)(?=\d{4,})/, '');
}

export function matchApplicantIdNumberWithId(
  enteredIdNumber?: string,
  extractedIdNumber?: string
): FieldMatchResult {
  const normEntered = normalizeIdCode(enteredIdNumber);
  const normExtracted = normalizeIdCode(extractedIdNumber);

  const ignoreTokens = new Set(['NONE', 'NA', 'VERIFIED', 'UNKNOWN', 'PENDING']);
  if (!normEntered || !normExtracted || normExtracted.length < 4 || ignoreTokens.has(normExtracted)) {
    return { matches: true, compared: false };
  }

  if (normEntered === normExtracted) {
    return { matches: true, compared: true };
  }

  const coreEntered = stripCommonIdPrefix(normEntered);
  const coreExtracted = stripCommonIdPrefix(normExtracted);
  if (coreEntered.length >= 6 && coreEntered === coreExtracted) {
    return { matches: true, compared: true };
  }

  return {
    matches: false,
    compared: true,
    reason: `ID Number mismatch: Entered ID Number "${String(enteredIdNumber).trim()}" does not match the ID Number on the card ("${String(extractedIdNumber).trim()}").`,
  };
}

export function isIdNumberPrefixMatch(
  enteredIdNumber?: string,
  extractedIdNumber?: string
): boolean {
  const normEntered = stripCommonIdPrefix(normalizeIdCode(enteredIdNumber));
  const normExtracted = stripCommonIdPrefix(normalizeIdCode(extractedIdNumber));
  const ignoreTokens = new Set(['NONE', 'NA', 'VERIFIED', 'UNKNOWN', 'PENDING']);
  if (!normEntered || normEntered.length < 2 || normExtracted.length <= normEntered.length || ignoreTokens.has(normExtracted)) {
    return false;
  }
  return normExtracted.startsWith(normEntered);
}

export interface CrossSideIdNumberMatchResult {
  matches: boolean;
  compared: boolean;
  frontMismatch: boolean;
  backMismatch: boolean;
  reason?: string;
}

export function matchApplicantIdNumberAcrossSides(
  enteredIdNumber?: string,
  frontExtractedIdNumber?: string,
  backExtractedIdNumber?: string
): CrossSideIdNumberMatchResult {
  const frontCheck = matchApplicantIdNumberWithId(enteredIdNumber, frontExtractedIdNumber);
  const backCheck = matchApplicantIdNumberWithId(enteredIdNumber, backExtractedIdNumber);

  const frontMatched = frontCheck.compared && frontCheck.matches;
  const backMatched = backCheck.compared && backCheck.matches;

  if (frontMatched || backMatched) {
    return {
      matches: true,
      compared: true,
      frontMismatch: false,
      backMismatch: false,
    };
  }

  if (!frontCheck.compared && !backCheck.compared) {
    return {
      matches: true,
      compared: false,
      frontMismatch: false,
      backMismatch: false,
    };
  }

  const frontMismatch = frontCheck.compared && !frontCheck.matches;
  const backMismatch = backCheck.compared && !backCheck.matches;
  return {
    matches: false,
    compared: true,
    frontMismatch,
    backMismatch,
    reason: (frontMismatch && frontCheck.reason) || (backMismatch && backCheck.reason) || undefined,
  };
}

const GENERIC_ADDRESS_WORDS = new Set([
  'brgy', 'barangay', 'bugo', 'cagayan', 'de', 'oro', 'city', 'cdo',
  'misamis', 'oriental', 'philippines', 'ph', 'street', 'st', 'road', 'rd',
  'avenue', 'ave', 'block', 'blk', 'lot', 'phase', 'purok', 'zone', 'sitio',
  'house', 'no', 'compound', 'subdivision', 'subd', 'village', 'village'
]);

const OTHER_KNOWN_LOCALITIES = [
  'lapasan', 'gusa', 'carmen', 'macasandig', 'macabalan', 'nazareth', 'kauswagan',
  'iponan', 'bulua', 'patag', 'balulang', 'canitoan', 'camaman-an', 'puntod',
  'tablon', 'agusan', 'puerto', 'cugman', 'bonbon', 'bayabas', 'lumbia',
  'tagoloan', 'opol', 'villanueva', 'jasaan', 'claveria', 'manila', 'cebu', 'davao'
];

export function matchApplicantAddressWithId(
  applicant: { address?: string; purok?: string },
  extractedAddress?: string
): FieldMatchResult {
  const rawIdAddr = String(extractedAddress || '').trim();
  const rawAppAddr = [applicant.address || '', applicant.purok || ''].filter(Boolean).join(' ').trim();
  if (!rawIdAddr || rawIdAddr.length < 6 || !rawAppAddr) {
    return { matches: true, compared: false };
  }

  const normId = normalizeNameText(rawIdAddr);
  const normApp = normalizeNameText(rawAppAddr);

  // 1. Check conflicting Zone/Purok number if both specify one
  const idZoneMatch = normId.match(/\b(?:zone|purok)\s*(\d{1,2})\b/);
  const appZoneMatch = normApp.match(/\b(?:zone|purok)\s*(\d{1,2})\b/);
  if (idZoneMatch && appZoneMatch && idZoneMatch[1] !== appZoneMatch[1]) {
    return {
      matches: false,
      compared: true,
      reason: `Address mismatch: ID shows Zone/Purok ${idZoneMatch[1]} ("${rawIdAddr}"), which conflicts with your selected Zone/Purok ${appZoneMatch[1]}.`,
    };
  }

  // 2. Check conflicting Block or Lot numbers when both specify them
  const idBlockMatch = normId.match(/\b(?:block|blk)\s*([a-z0-9]+)\b/);
  const appBlockMatch = normApp.match(/\b(?:block|blk)\s*([a-z0-9]+)\b/);
  if (idBlockMatch && appBlockMatch && idBlockMatch[1] !== appBlockMatch[1]) {
    return {
      matches: false,
      compared: true,
      reason: `Address mismatch: ID shows Block ${idBlockMatch[1].toUpperCase()} ("${rawIdAddr}"), which conflicts with Block ${appBlockMatch[1].toUpperCase()} in your entered address.`,
    };
  }
  const idLotMatch = normId.match(/\b(?:lot)\s*([a-z0-9]+)\b/);
  const appLotMatch = normApp.match(/\b(?:lot)\s*([a-z0-9]+)\b/);
  if (idLotMatch && appLotMatch && idLotMatch[1] !== appLotMatch[1]) {
    return {
      matches: false,
      compared: true,
      reason: `Address mismatch: ID shows Lot ${idLotMatch[1].toUpperCase()} ("${rawIdAddr}"), which conflicts with Lot ${appLotMatch[1].toUpperCase()} in your entered address.`,
    };
  }

  // 3. Check if ID explicitly indicates a different barangay/city not present in entered address, or entered address specifies an external locality while ID says Bugo
  for (const loc of OTHER_KNOWN_LOCALITIES) {
    const locRegex = new RegExp(`\\b${loc}\\b`, 'i');
    if (locRegex.test(normId) && !locRegex.test(normApp)) {
      return {
        matches: false,
        compared: true,
        reason: `Address mismatch: ID address ("${rawIdAddr}") indicates a different locality outside your entered Barangay Bugo address.`,
      };
    }
    if (/\bbugo\b/.test(normId) && locRegex.test(normApp) && !locRegex.test(normId)) {
      return {
        matches: false,
        compared: true,
        reason: `Address mismatch: Entered address references "${loc}", which conflicts with your ID address ("${rawIdAddr}").`,
      };
    }
  }

  // 4. Compare specific street/subdivision/sitio tokens when ID gives granular details
  const idSpecificTokens = normId
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !GENERIC_ADDRESS_WORDS.has(t));
  const appSpecificTokens = normApp
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !GENERIC_ADDRESS_WORDS.has(t));
  const appTokensSet = new Set(
    normApp.split(/\s+/).filter((t) => t.length >= 2)
  );

  if (idSpecificTokens.length >= 2 || (idSpecificTokens.length >= 1 && appSpecificTokens.length >= 1)) {
    const hasSpecificOverlap = idSpecificTokens.some((tok) => appTokensSet.has(tok));
    if (!hasSpecificOverlap) {
      return {
        matches: false,
        compared: true,
        reason: `Address mismatch: Entered address does not match the address printed on your ID ("${rawIdAddr}").`,
      };
    }
  }

  return { matches: true, compared: true };
}

export function matchApplicantGenderWithId(
  applicantGender?: string,
  extractedGender?: string
): FieldMatchResult {
  const appG = String(applicantGender || '').trim().toLowerCase();
  const idG = String(extractedGender || '').trim().toLowerCase();
  if ((appG === 'male' || appG === 'female') && (idG === 'male' || idG === 'female')) {
    if (appG !== idG) {
      return {
        matches: false,
        compared: true,
        reason: `Gender mismatch: Selected "${appG === 'male' ? 'Male' : 'Female'}" does not match sex/gender printed on ID ("${idG === 'male' ? 'Male' : 'Female'}").`,
      };
    }
    return { matches: true, compared: true };
  }
  return { matches: true, compared: false };
}

export function matchIdTypeWithProfile(params: {
  idType?: string;
  age?: number;
  isSenior?: boolean;
}): { matches: boolean; reason?: string } {
  const canon = canonicalizeIdCategory(params.idType);
  if (canon === 'senior' && typeof params.age === 'number' && params.age > 0 && params.age < 60) {
    return {
      matches: false,
      reason: `ID Type invalid for age ${params.age}: Senior Citizen OSCA ID requires the applicant to be at least 60 years old.`,
    };
  }
  return { matches: true };
}

export function matchApplicantCivilStatusWithId(
  applicantCivilStatus?: string,
  extractedCivilStatus?: string
): FieldMatchResult {
  const normalizeStatus = (raw?: string) => {
    const t = String(raw || '').trim().toLowerCase();
    if (!t) return '';
    if (t.startsWith('single') || t === 's') return 'single';
    if (t.startsWith('married') || t === 'm') return 'married';
    if (t.startsWith('widow') || t === 'w') return 'widowed';
    if (t.startsWith('separat') || t.startsWith('annul')) return 'separated';
    return '';
  };
  const appStatus = normalizeStatus(applicantCivilStatus);
  const idStatus = normalizeStatus(extractedCivilStatus);
  if (appStatus && idStatus) {
    if (appStatus !== idStatus) {
      return {
        matches: false,
        compared: true,
        reason: `Civil Status mismatch: Selected "${applicantCivilStatus}" does not match civil status printed on ID ("${extractedCivilStatus}").`,
      };
    }
    return { matches: true, compared: true };
  }
  return { matches: true, compared: false };
}

export function matchFrontAndBackIdConsistency(
  front?: {
    extractedIdType?: string;
    detectedDocType?: string;
    extractedName?: string;
    extractedIdNumber?: string;
    extractedBirthdate?: string;
    extractedAddress?: string;
  } | null,
  back?: {
    extractedIdType?: string;
    detectedDocType?: string;
    extractedName?: string;
    extractedIdNumber?: string;
    extractedBirthdate?: string;
    extractedAddress?: string;
  } | null,
  options?: { expectedIdNumber?: string }
): FieldMatchResult {
  if (!front || !back) {
    return { matches: true, compared: false };
  }

  const frontType = canonicalizeIdCategory(front.extractedIdType || front.detectedDocType);
  const backType = canonicalizeIdCategory(back.extractedIdType || back.detectedDocType);
  if (frontType && backType && frontType !== backType) {
    return {
      matches: false,
      compared: true,
      reason: `Front & Back ID mismatch: Front ID is "${front.extractedIdType || front.detectedDocType}" while Back ID is "${back.extractedIdType || back.detectedDocType}".`,
    };
  }

  const frontName = String(front.extractedName || '').trim();
  const backName = String(back.extractedName || '').trim();
  if (frontName && backName) {
    const parsedFront = parseExtractedNameParts(frontName);
    const crossName = matchApplicantNameWithId(
      {
        firstName: parsedFront.firstName,
        middleName: parsedFront.middleName,
        lastName: parsedFront.lastName,
        suffix: parsedFront.suffix,
        fullName: frontName,
      },
      backName
    );
    if (crossName.compared && !crossName.matches) {
      return {
        matches: false,
        compared: true,
        reason: `Front & Back ID mismatch: Front ID name ("${frontName}") does not match Back ID name ("${backName}").`,
      };
    }
  }

  const frontIdNum = normalizeIdCode(front.extractedIdNumber);
  const backIdNum = normalizeIdCode(back.extractedIdNumber);
  if (frontIdNum.length >= 4 && backIdNum.length >= 4) {
    const idCheck = matchApplicantIdNumberWithId(front.extractedIdNumber, back.extractedIdNumber);
    if (idCheck.compared && !idCheck.matches) {
      return {
        matches: false,
        compared: true,
        reason: `Front & Back ID mismatch: Front ID number ("${front.extractedIdNumber}") does not match Back ID number ("${back.extractedIdNumber}").`,
      };
    }
  }

  const dobCheck = matchApplicantBirthdateWithId(
    { birthdate: front.extractedBirthdate },
    { extractedBirthdate: back.extractedBirthdate }
  );
  if (dobCheck.compared && !dobCheck.matches) {
    return {
      matches: false,
      compared: true,
      reason: `Front & Back ID mismatch: Birthdate on Front ID (${front.extractedBirthdate}) differs from Back ID (${back.extractedBirthdate}).`,
    };
  }

  const frontAddr = String(front.extractedAddress || '').trim();
  const backAddr = String(back.extractedAddress || '').trim();
  if (frontAddr.length >= 6 && backAddr.length >= 6) {
    const frontNorm = normalizeNameText(frontAddr);
    const backNorm = normalizeNameText(backAddr);
    const frontSpecific = frontNorm.split(/\s+/).filter((t) => t.length >= 3 && !GENERIC_ADDRESS_WORDS.has(t));
    const backSpecific = backNorm.split(/\s+/).filter((t) => t.length >= 3 && !GENERIC_ADDRESS_WORDS.has(t));
    const addrCheck = matchApplicantAddressWithId({ address: frontAddr }, backAddr);
    const onlyOneSideHasStreet =
      (frontSpecific.length === 0 || backSpecific.length === 0) &&
      !addrCheck.reason?.includes('Zone/Purok') &&
      !addrCheck.reason?.includes('locality');
    if (addrCheck.compared && !addrCheck.matches && !onlyOneSideHasStreet) {
      return {
        matches: false,
        compared: true,
        reason: `Front & Back ID mismatch: Address on Front ID ("${frontAddr}") differs from Back ID ("${backAddr}").`,
      };
    }
  }

  return { matches: true, compared: true };
}

export function isNonIdDocumentFilename(fileName?: string): boolean {
  const nameLower = String(fileName || '').toLowerCase();
  if (!nameLower) return false;
  const nonIdKeywords = [
    'food', 'selfie', 'cat', 'dog', 'screenshot', 'wallpaper', 'meme',
    'landscape', 'flower', 'party', 'vacation', 'hospital', 'medical_cert',
    'school_cor', 'cor_', 'prescription', 'blotter', 'funeral', 'contract',
    'request_letter', 'psa', 'birth_cert', 'indigency', 'receipt', 'cedula', 'dti'
  ];
  return nonIdKeywords.some((kw) => nameLower.includes(kw));
}

