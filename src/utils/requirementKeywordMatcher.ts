/**
 * Shared Requirement Keyword Extraction & Uploaded-Document Matching Engine
 * Ensures every document requirement added by Barangay Admin detects matching
 * keywords in the uploaded/attached file (filename, PDF/SVG text, or OCR/AI text).
 * If no keyword related to the requirement is detected, the file is marked invalid.
 */

export const REQUIREMENT_KEYWORD_GROUPS: string[][] = [
  ['certificate of registration', 'certificate of enrollment', 'certificate of enrolment', 'matriculation', 'enrollment form', 'enrolment', 'enrollment', 'enrolled', 'school enrollment', 'cor', 'study load', 'registration form'],
  ['tor', 'transcript of records', 'transcript', 'official transcript', 'academic transcript', 'grades', 'grade', 'copy of grades', 'report card', 'grade sheet', 'grade slip', 'rating sheet', 'form 138', 'form 137', 'sf9', 'sf10', 'scholastic', 'scholastic record', 'gwa', 'gpa', 'school registrar'],
  ['diploma', 'graduation certificate', 'certificate of graduation', 'completion certificate'],
  ['medical certificate', 'med cert', 'medcert', 'medical abstract', 'clinical abstract', 'doctor certificate', 'disability assessment', 'health certificate'],
  ['laboratory request', 'lab request', 'laboratory referral', 'medical referral', 'diagnostic request', 'lab test', 'laboratory', 'diagnostic'],
  ['hospital bill', 'hospital billing', 'final billing', 'statement of account', 'medical bill', 'hospitalization', 'hospital receipt', 'billing statement'],
  ['prescription', 'reseta', 'doctor prescription', 'medical prescription', 'rx'],
  ['doctors note', 'doctor note', 'physician note'],
  ['birth certificate', 'certificate of live birth', 'live birth', 'colb', 'psa birth', 'nso birth', 'negative certification of birth', 'psa negative'],
  ['cenomar', 'certificate of no marriage', 'no marriage record'],
  ['death certificate', 'registered death', 'certificate of death', 'death registry'],
  ['marriage certificate', 'marriage contract'],
  ['pre marriage counseling', 'pmc certificate', 'pmc'],
  ['funeral', 'funeral contract', 'interment', 'embalm', 'embalming', 'mortuary', 'casket', 'burial contract', 'burial receipt', 'memorial service'],
  ['indigency', 'certificate of indigency', 'indigent', 'low income', 'affidavit of low income', 'non filing of itr', 'certificate of non filing'],
  ['certificate of residency', 'proof of residency', 'proof of address', 'proof of bugo address', 'residency', 'purok clearance', 'sitio clearance', 'purok endorsement', 'purok leader endorsement', 'zone endorsement'],
  ['barangay clearance', 'brgy clearance'],
  ['good moral', 'moral character'],
  ['character reference', 'reference sign off'],
  ['utility bill', 'proof of billing', 'electric bill', 'water bill', 'house billing', 'cepalco', 'cowd', 'electricity', 'rental contract', 'lease contract', 'house rental', 'property ownership', 'land title', 'deed of sale'],
  ['police report', 'police blotter', 'blotter', 'police clearance', 'pnp blotter'],
  ['nbi clearance', 'nbi'],
  ['bdrrmc', 'disaster', 'calamity', 'incident report', 'damage assessment', 'fire bureau', 'bfp', 'typhoon', 'flood', 'landslide', 'earthquake'],
  ['damaged property', 'property damage', 'damaged house', 'damage photo'],
  ['business permit', 'dti', 'sec registration', 'sec certificate', 'business name registration', 'mayors permit', 'barangay business'],
  ['fire safety', 'sanitation endorsement', 'fsic', 'sanitary permit'],
  ['sketch of business', 'business location', 'location sketch', 'sketch'],
  ['cedula', 'community tax', 'community tax certificate', 'ctc'],
  ['voter', 'voters certificate', 'voter certification', 'voters id', 'voter id', 'comelec'],
  ['itr', 'income tax return', 'bir', 'tax clearance', '2316'],
  ['certificate of employment', 'coe', 'employment certificate', 'payslip', 'pay slip'],
  ['2x2', 'id photo', 'id picture', 'passport size', '2x2 photo', '2x2 picture'],
  ['solo parent', 'affidavit of solo parenting', 'solo parenting', 'ra 11861'],
  ['pwd id', 'pwd card', 'disability id', 'pdao', 'ncda'],
  ['osca', 'osca id', 'senior citizen id', 'senior id', 'ra 9994', 'proof of age'],
  ['first time jobseeker', 'first time job seeker', 'jobseeker', 'oath of undertaking', 'ra 11261'],
  ['request letter', 'personal request letter', 'letter of request'],
  ['justification letter', 'letter of justification', 'explanation letter'],
  ['livelihood proposal', 'business proposal', 'project proposal', 'business plan'],
  ['existing livelihood', 'proof of livelihood', 'vending permit', 'sari sari'],
  ['baptismal certificate', 'baptismal', 'baptism'],
  ['joint affidavit', 'disinterested persons'],
  ['school id', 'student id'],
  ['valid id', 'government id', 'government issued id', 'national id', 'philsys', 'ephilid', 'front id', 'back id', 'resident id', 'umid', 'sss id', 'driver license', 'drivers license', 'postal id', 'prc id', 'passport', 'tin id', 'philhealth id', 'pagibig id', 'identification card'],
  ['application form', 'accomplished form', 'intake form'],
  ['household information', 'household info', 'family composition', 'household profile'],
  ['pet vaccination', 'vaccination card', 'vaccination', 'vaccine', 'immunization', 'bakuna', 'rabies'],
];

const FILLER_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'any', 'per', 'via',
  'copy', 'copies', 'photocopy', 'original', 'certified', 'true', 'valid',
  'barangay', 'bugo', 'official', 'document', 'documents', 'doc', 'docs',
  'file', 'files', 'photo', 'photos', 'picture', 'image', 'scan', 'scanned',
  'proof', 'supporting', 'attached', 'uploaded', 'upload', 'attach',
  'applicable', 'available', 'required', 'optional', 'issued', 'recent',
  'latest', 'updated', 'signed', 'endorsed', 'resident', 'applicant',
  'claimant', 'claimants', 'patient', 'patients', 'beneficiary', 'member', 'members',
  'person', 'persons', 'status', 'must', 'have', 'not', 'only', 'both',
  'side', 'sides', 'front', 'back', 'cdo', 'cagayan', 'oro', 'city',
  'philippines', 'portal', 'qualification', 'assistance', 'program', 'programs',
  'support', 'purpose', 'medical', 'educational', 'burial', 'transportation',
  'livelihood', 'financial', 'emergency', 'service', 'services', 'office',
  'mayor', 'vice', 'jocelyn', 'bebot', 'rodriguez', 'government', 'national',
  'local', 'purok', 'zone', 'sitio', 'address', 'school', 'hospital', 'clinic',
  'attending', 'licensed', 'registered', 'current', 'new', 'party', 'parties',
  'immediate', 'family', 'dependent', 'dependents', 'children', 'child',
  'below', 'above', 'years', 'year', 'old', 'within', 'detailing', 'showing',
  'containing', 'addressed', 'cases', 'case', 'private', 'semi', 'room',
  'simple', 'proposed', 'existing', 'name', 'owner', 'informant', 'deceased',
  'partners', 'two', 'disinterested', 'witnessed', 'unmarried', 'first', 'time',
  'registration', 'account', 'statement', 'note', 'request', 'personal',
  'certificates', 'non', 'filing', 'psa', 'nso', 'pnp',
]);

// Generic document containers that should NOT match on their own if a requirement has specific topic words
const GENERIC_DOC_CONTAINER_WORDS = new Set([
  'certificate', 'certification', 'clearance', 'permit', 'receipt',
  'bill', 'billing', 'report', 'record', 'records', 'letter', 'form',
  'card', 'contract', 'affidavit', 'endorsement', 'statement', 'summary',
  'id', 'number', 'code', 'sheet', 'slip', 'application', 'accomplished',
]);

const OPTIONAL_QUALIFIERS_REGEX =
  /\(\s*(?:if\s+applicable|if\s+available|if\s+required|if\s+any|optional|original\s*(?:&|and|\/)?\s*photocopy|photocopy|original|certified\s+true\s+copy|latest|recent|purpose\s*:|for\s+private\s+or\s+semi|for\s+theft\s+or\s+stranded|burial\s+assistance\s+from|hospital\s+bill\s*\/\s*medical\s+support\s+from)[^)]*\)/gi;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWholePhrase(normText: string, phrase: string): boolean {
  if (!normText || !phrase) return false;
  return new RegExp(`(?:^|\\s)${escapeRegex(phrase)}(?:\\s|$)`).test(normText);
}

export function normalizeKeywordText(raw?: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Split camelCase / PascalCase before lowercasing (e.g. MedicalCertificate -> Medical Certificate)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips UI-injected requirement prefix like "[Medical Certificate] file.pdf" -> "file.pdf"
 */
export function stripBracketedRequirementPrefix(fileName?: string): string {
  return String(fileName || '').replace(/^\[[^\]]+\]\s*/, '').trim();
}

export interface ExtractedRequirementKeywords {
  requirement: string;
  specificKeywords: string[];
  synonymKeywords: string[];
  genericFallbackKeywords: string[];
  allEffectiveKeywords: string[];
}

export function extractKeywordsForRequirement(requirementLabel: string): ExtractedRequirementKeywords {
  const cleanedLabel = String(requirementLabel || '').replace(OPTIONAL_QUALIFIERS_REGEX, ' ').trim();
  const norm = normalizeKeywordText(cleanedLabel);

  const tokens = norm
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  const tokenSet = new Set(tokens);

  const specificKeywords: string[] = [];
  const genericFallbackKeywords: string[] = [];

  for (const tok of tokens) {
    if (FILLER_STOPWORDS.has(tok)) continue;
    // Skip short 2-char prepositions/conjunctions unless specific doc code (e.g. ID, RX)
    if (tok.length === 2 && !['id', 'rx', 'ok'].includes(tok)) continue;
    if (GENERIC_DOC_CONTAINER_WORDS.has(tok)) {
      if (!genericFallbackKeywords.includes(tok)) genericFallbackKeywords.push(tok);
    } else {
      if (!specificKeywords.includes(tok)) specificKeywords.push(tok);
    }
  }

  // Collect matching synonym groups using whole-token or whole-phrase matching
  // so short acronyms like "tor" or "cor" never false-match inside "doctor" or "record".
  const synonymKeywords: string[] = [];
  for (const group of REQUIREMENT_KEYWORD_GROUPS) {
    const groupMatched = group.some((kw) => {
      const normKw = normalizeKeywordText(kw);
      if (!normKw) return false;
      if (normKw.includes(' ')) {
        return hasWholePhrase(norm, normKw);
      }
      if (
        tokenSet.has(normKw) ||
        tokenSet.has(`${normKw}s`) ||
        tokenSet.has(`${normKw}es`) ||
        (normKw.endsWith('s') && normKw.length >= 4 && tokenSet.has(normKw.slice(0, -1)))
      ) {
        return true;
      }
      return normKw.length >= 6 && norm.includes(normKw);
    });
    if (groupMatched) {
      for (const kw of group) {
        const normKw = normalizeKeywordText(kw);
        if (normKw && !synonymKeywords.includes(normKw)) {
          synonymKeywords.push(normKw);
        }
      }
    }
  }

  // Build effective keywords:
  // If we have specific topic words or synonym keywords, require those (so "Medical Certificate" won't match "Birth Certificate").
  // Only fall back to generic container words (or meaningful label tokens) if no specific/synonym match was found.
  const combined = Array.from(
    new Set([
      ...specificKeywords,
      ...synonymKeywords,
      ...(specificKeywords.length === 0 && synonymKeywords.length === 0 ? genericFallbackKeywords : []),
    ])
  );

  // If custom Admin requirement consists solely of words in filler/generic (e.g. "School Request Letter"),
  // keep the full cleaned phrase so something meaningful is still required.
  if (combined.length === 0 && norm) {
    combined.push(norm);
  }

  // Also include multi-word bigrams for custom admin document labels (e.g. "dental x-ray", "pet vaccine")
  if (tokens.length >= 2) {
    const cleanSpecificPhrase = specificKeywords.join(' ');
    if (cleanSpecificPhrase && cleanSpecificPhrase.includes(' ') && !combined.includes(cleanSpecificPhrase)) {
      combined.unshift(cleanSpecificPhrase);
    }
  }

  return {
    requirement: requirementLabel,
    specificKeywords,
    synonymKeywords,
    genericFallbackKeywords,
    allEffectiveKeywords: combined,
  };
}

/**
 * Returns a concise, user-facing document expectation hint for ANY Admin requirement label
 * (e.g. "TOR" -> "TOR / Transcript of Records / Grades / Report Card").
 */
export function getRequirementHintLabel(requirementLabel: string): string {
  const info = extractKeywordsForRequirement(requirementLabel);
  const kws = info.allEffectiveKeywords;
  const hasTor = kws.includes('tor') || kws.includes('transcript of records') || kws.includes('grades');
  const hasDiploma = kws.includes('diploma') || kws.includes('certificate of graduation');
  if (hasTor && hasDiploma) {
    return 'School Diploma, Transcript of Records (TOR), or Certificate of Graduation';
  }
  if (hasTor) {
    return 'TOR / Transcript of Records / Grades / Report Card';
  }
  if (hasDiploma) {
    return 'School Diploma / Certificate of Graduation';
  }
  if (kws.includes('certificate of registration') || kws.includes('cor')) {
    return 'Certificate of Registration (COR) / Enrollment Form';
  }
  if (kws.includes('laboratory request') || kws.includes('lab request') || kws.includes('medical referral')) {
    return 'Laboratory Request / Medical Referral';
  }
  if (kws.includes('hospital bill') || kws.includes('statement of account')) {
    if (kws.includes('medical certificate') || kws.includes('medical abstract')) {
      return 'Medical Certificate, Hospital Bill, or Statement of Account';
    }
    return 'Final Hospital Bill / Statement of Account';
  }
  if (kws.includes('medical certificate') || kws.includes('medical abstract')) {
    if (kws.includes('prescription') || kws.includes('reseta')) {
      return "Medical Certificate & Doctor's Prescription (Reseta)";
    }
    return 'Medical Certificate / Clinical Abstract';
  }
  if (kws.includes('prescription') || kws.includes('reseta')) {
    return "Doctor's Prescription (Reseta)";
  }
  if (kws.includes('doctors note')) {
    return "Doctor's Note / Medical Note";
  }
  if (kws.includes('cenomar') || kws.includes('certificate of no marriage')) {
    return 'PSA CENOMAR (Certificate of No Marriage Record)';
  }
  if (kws.includes('birth certificate') || kws.includes('live birth')) {
    return 'PSA / Live Birth Certificate';
  }
  if (kws.includes('death certificate')) {
    return 'Official Death Certificate';
  }
  if (kws.includes('funeral') || kws.includes('funeral contract')) {
    return 'Funeral Contract / Burial Receipt';
  }
  if (kws.includes('marriage certificate') || kws.includes('marriage contract')) {
    return 'PSA / Official Marriage Certificate';
  }
  if (kws.includes('pre marriage counseling') || kws.includes('pmc')) {
    return 'Pre-Marriage Counseling (PMC) Certificate';
  }
  if (kws.includes('certificate of indigency') || kws.includes('indigency')) {
    return 'Barangay Certificate of Indigency';
  }
  if (kws.includes('barangay clearance') || kws.includes('brgy clearance')) {
    return 'Barangay Clearance';
  }
  if (kws.includes('certificate of residency') || kws.includes('proof of residency')) {
    return 'Barangay Certificate of Residency / Purok Endorsement';
  }
  if (kws.includes('utility bill') || kws.includes('proof of billing') || kws.includes('rental contract')) {
    return 'Utility Bill (CEPALCO / COWD) or Rental Contract';
  }
  if (kws.includes('police blotter') || kws.includes('police report')) {
    return 'Police Blotter / Police Report';
  }
  if (kws.includes('nbi clearance') || kws.includes('nbi')) {
    return 'NBI Clearance';
  }
  if (kws.includes('cedula') || kws.includes('community tax certificate')) {
    return 'Community Tax Certificate (Cedula)';
  }
  if (kws.includes('voters certificate') || kws.includes('comelec')) {
    return "COMELEC Voter's Certificate / ID";
  }
  if (kws.includes('dti') || kws.includes('sec certificate') || kws.includes('business permit')) {
    return 'DTI / SEC Registration or Business Permit';
  }
  if (kws.includes('fire safety') || kws.includes('sanitation endorsement')) {
    return 'Fire Safety & Sanitation Endorsement';
  }
  if (kws.includes('oath of undertaking') || kws.includes('first time jobseeker')) {
    return 'Signed Oath of Undertaking (RA 11261)';
  }
  if (kws.includes('good moral')) {
    return 'Certificate of Good Moral Character';
  }
  if (kws.includes('request letter')) {
    return 'Signed Request Letter';
  }
  if (kws.includes('justification letter')) {
    return 'Signed Justification Letter';
  }
  if (kws.includes('livelihood proposal') || kws.includes('business proposal')) {
    return 'Business / Livelihood Proposal';
  }
  if (kws.includes('damage assessment') || kws.includes('disaster') || kws.includes('bdrrmc')) {
    return 'Disaster Incident / Damage Assessment Report';
  }
  if (kws.includes('solo parent') || kws.includes('affidavit of solo parenting')) {
    return 'Solo Parent ID / Sworn Affidavit of Solo Parenting';
  }
  if (kws.includes('pwd id') || kws.includes('pwd card')) {
    return 'Official PWD ID Card';
  }
  if (kws.includes('osca id') || kws.includes('senior citizen id')) {
    return 'Senior Citizen (OSCA) ID / Proof of Age 60+';
  }
  if (kws.includes('2x2') || kws.includes('id photo')) {
    return '2x2 Recent ID Photo';
  }
  if (kws.includes('pet vaccination') || kws.includes('vaccination card')) {
    return 'Pet Vaccination Card';
  }
  if (kws.includes('valid id') || kws.includes('government id') || kws.includes('school id')) {
    return kws.includes('school id') && !kws.includes('government id')
      ? 'Valid School / Student ID'
      : 'Valid Government / Resident ID';
  }
  return requirementLabel;
}

function tokenMatchesHaystack(keyword: string, normHaystack: string, haystackTokens: Set<string>): boolean {
  if (!keyword) return false;
  if (keyword.includes(' ')) {
    if (hasWholePhrase(normHaystack, keyword)) return true;
    const parts = keyword.split(/\s+/).filter((p) => p.length >= 3 && !FILLER_STOPWORDS.has(p));
    if (parts.length >= 2) {
      return parts.every((part) => tokenMatchesHaystack(part, normHaystack, haystackTokens));
    }
    return false;
  }

  if (haystackTokens.has(keyword)) return true;
  if (haystackTokens.has(`${keyword}s`) || haystackTokens.has(`${keyword}es`)) return true;
  if (keyword.endsWith('s') && keyword.length >= 4 && haystackTokens.has(keyword.slice(0, -1))) return true;

  // Morphological stem match requiring at least a 5-character shared prefix
  if (keyword.length >= 5) {
    const stem5 = keyword.slice(0, 5);
    for (const hTok of haystackTokens) {
      if (hTok.length >= 5 && hTok.startsWith(stem5)) {
        return true;
      }
    }
  }

  // Exact substring fallback for long concatenated words (e.g. "medcert2026" or "indigencycert")
  if (keyword.length >= 6 && normHaystack.includes(keyword)) {
    return true;
  }

  return false;
}

export interface KeywordMatchResult {
  isMatch: boolean;
  matchedKeywords: string[];
  expectedKeywords: string[];
  matchedRequirement?: string;
  reason?: string;
}

/**
 * Checks if an uploaded/attached file contains at least one keyword matching
 * the Admin-added requirement (or any of `additionalRequirements` when uploading
 * into a general program attachment bucket).
 *
 * When real document content (`extractedText`) or specific AI Vision `detectedDocType`
 * is available, keywords MUST match the document's actual content/detected type so
 * an unrelated document (e.g. a Birth Certificate renamed to `TOR.pdf`) cannot pass.
 */
export function matchRequirementKeywords(params: {
  expectedRequirement: string;
  additionalRequirements?: string[];
  fileName?: string;
  extractedText?: string;
  detectedDocType?: string;
  matchedKeywordsFromAi?: string[];
  sourceLabel?: string;
}): KeywordMatchResult {
  const candidateRequirements = [
    params.expectedRequirement,
    ...(params.additionalRequirements || []),
  ]
    .map((r) => String(r || '').trim())
    .filter(Boolean);

  if (candidateRequirements.length === 0) {
    return {
      isMatch: true,
      matchedKeywords: [],
      expectedKeywords: [],
    };
  }

  const cleanFileName = stripBracketedRequirementPrefix(params.fileName);
  // Strip common file extension so ".pdf" / ".jpg" / ".png" never participates as a keyword
  const fileNameWithoutExt = cleanFileName.replace(/\.[a-z0-9]{2,5}$/i, '');

  const normExtractedText = normalizeKeywordText(params.extractedText || '');
  const detectedDocTypeClean = String(params.detectedDocType || '').trim();
  const hasSpecificAiDocType = Boolean(
    detectedDocTypeClean &&
      !/^(?:supporting(?:\s+qualification)?\s+document|pdf(?:\s+document)?|image|document|file|unknown|unrecognized|scanned\s+image)$/i.test(
        detectedDocTypeClean
      )
  );
  const hasReadableContent =
    normExtractedText.split(/\s+/).filter((w) => w.length >= 2).length >= 3 ||
    normExtractedText.length >= 15 ||
    hasSpecificAiDocType ||
    (Array.isArray(params.matchedKeywordsFromAi) && params.matchedKeywordsFromAi.length > 0);

  const contentHaystack = [
    params.extractedText || '',
    params.detectedDocType || '',
    ...(params.matchedKeywordsFromAi || []),
  ]
    .filter(Boolean)
    .join(' ');
  const normContentHaystack = normalizeKeywordText(contentHaystack);
  const contentTokens = new Set(
    normContentHaystack
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
  );

  const rawHaystack = [
    fileNameWithoutExt,
    contentHaystack,
    params.sourceLabel || '',
  ]
    .filter(Boolean)
    .join(' ');

  const normHaystack = normalizeKeywordText(rawHaystack);
  const haystackTokens = new Set(
    normHaystack
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
  );

  const primaryExtracted = extractKeywordsForRequirement(candidateRequirements[0]);
  const primaryHint = getRequirementHintLabel(candidateRequirements[0]);

  if (!normHaystack) {
    return {
      isMatch: false,
      matchedKeywords: [],
      expectedKeywords: primaryExtracted.allEffectiveKeywords,
      reason: `Invalid file: Must upload ${primaryHint}. Could not detect matching keywords in "${cleanFileName || 'uploaded file'}".`,
    };
  }

  for (const reqLabel of candidateRequirements) {
    const info = extractKeywordsForRequirement(reqLabel);
    if (info.allEffectiveKeywords.length === 0) {
      continue;
    }

    if (hasReadableContent) {
      const contentHits = info.allEffectiveKeywords.filter((kw) =>
        tokenMatchesHaystack(kw, normContentHaystack, contentTokens)
      );
      if (contentHits.length > 0) {
        return {
          isMatch: true,
          matchedKeywords: Array.from(new Set(contentHits)),
          expectedKeywords: info.allEffectiveKeywords,
          matchedRequirement: reqLabel,
        };
      }
      continue;
    }

    const hits = info.allEffectiveKeywords.filter((kw) =>
      tokenMatchesHaystack(kw, normHaystack, haystackTokens)
    );
    if (hits.length > 0) {
      return {
        isMatch: true,
        matchedKeywords: Array.from(new Set(hits)),
        expectedKeywords: info.allEffectiveKeywords,
        matchedRequirement: reqLabel,
      };
    }
  }

  const previewExpected = primaryExtracted.allEffectiveKeywords.slice(0, 6).join(', ');
  const detectedLabel = hasSpecificAiDocType ? ` (detected "${detectedDocTypeClean}")` : '';
  return {
    isMatch: false,
    matchedKeywords: [],
    expectedKeywords: primaryExtracted.allEffectiveKeywords,
    reason: hasReadableContent
      ? `Invalid document${detectedLabel}: Uploaded "${cleanFileName || 'file'}" does not match "${candidateRequirements[0]}" — must be ${primaryHint}.`
      : `Invalid document: Uploaded file "${cleanFileName || 'attachment'}" does not match "${candidateRequirements[0]}" (must be ${primaryHint}${previewExpected ? `; keywords: ${previewExpected}` : ''}).`,
  };
}

/**
 * Extracts readable text from SVG or plain-text data URLs (safe for both browser and Node).
 */
export function extractTextFromInlineDataUrl(dataUrl?: string): string {
  if (!dataUrl || typeof dataUrl !== 'string') return '';
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return '';
  const header = dataUrl.slice(0, commaIdx).toLowerCase();
  const body = dataUrl.slice(commaIdx + 1);

  if (!header.includes('svg') && !header.includes('text/') && !header.includes('xml')) {
    return '';
  }

  try {
    let raw = '';
    if (header.includes(';base64')) {
      if (typeof Buffer !== 'undefined') {
        raw = Buffer.from(body, 'base64').toString('utf-8');
      } else {
        raw = atob(body);
      }
    } else {
      raw = decodeURIComponent(body);
    }
    return raw
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return '';
  }
}
