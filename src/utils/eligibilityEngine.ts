import { AssistanceProgram, EligibilityEvaluation, EligibilityRuleResult, IdPhotoAnalysis, ProgramQualificationRules, ProgramQualificationSector } from '../types';

export function parseMonthlyIncome(incomeStr: string): number {
  if (!incomeStr) return 0;
  // Match digits, handle standard Philippine peso strings like "₱8,500.00 (Informal / Low Income)" -> 8500
  const match = incomeStr.replace(/[^\d.]/g, '');
  const parsed = parseFloat(match);
  return isNaN(parsed) ? 0 : parsed;
}

export interface ProgramRuleConfig {
  id: string;
  title: string;
  category: string;
  maxMonthlyIncome: number;
  incomeLabel: string;
  allowedOccupations?: string[];
  disallowedOccupations?: string[];
  minAge?: number;
  maxAge?: number;
  mandatoryDocs: string[];
  description: string;
  specialRules?: string[];
}

export const PROGRAM_RULES: Record<string, ProgramRuleConfig> = {
  'prog-barangay-clearance': {
    id: 'prog-barangay-clearance',
    title: 'Barangay Clearance & Certification',
    category: 'Clearance & Certification',
    maxMonthlyIncome: Infinity,
    incomeLabel: 'Universal (No Income Limit)',
    mandatoryDocs: ['Valid Government ID / Proof of Identity', 'Community Tax Certificate (Cedula)'],
    minAge: 15,
    description: 'Universal administrative certification for all verified Barangay Bugo residents.'
  },
  'prog-admin-residency': {
    id: 'prog-admin-residency',
    title: 'Certificate of Residency',
    category: 'Clearance & Certification',
    maxMonthlyIncome: Infinity,
    incomeLabel: 'Universal (No Income Limit)',
    mandatoryDocs: ['Valid Government ID / Proof of Address', 'Zone Endorsement'],
    minAge: 0,
    description: 'Official certification certifying physical residence in a specific Zone/Purok of Bugo.'
  },
  'prog-admin-indigency': {
    id: 'prog-admin-indigency',
    title: 'Certificate of Indigency',
    category: 'Clearance & Certification',
    maxMonthlyIncome: 10000,
    incomeLabel: 'Maximum ₱10,000.00 / month (Indigent Bracket)',
    mandatoryDocs: ['Valid Resident ID or Voter Certification', 'Zone Endorsement'],
    minAge: 0,
    description: 'Affidavit of low income / indigent status for medical fee waivers, legal aid, and financial relief.'
  },
  'prog-admin-good-moral': {
    id: 'prog-admin-good-moral',
    title: 'Certificate of Good Moral Character',
    category: 'Clearance & Certification',
    maxMonthlyIncome: Infinity,
    incomeLabel: 'Universal (No Income Limit)',
    mandatoryDocs: ['Valid Government or Student ID', 'Barangay Clearance Copy'],
    minAge: 12,
    description: 'Attestation of exemplary community conduct, clean record, and civic standing.'
  },
  'prog-admin-first-job': {
    id: 'prog-admin-first-job',
    title: 'First-Time Job Seeker Certification (RA 11261)',
    category: 'Clearance & Certification',
    maxMonthlyIncome: Infinity,
    incomeLabel: 'Open to First-Time Entrants',
    allowedOccupations: ['Student', 'Unemployed', 'Jobseeker', 'Fresh Graduate', 'Seeking Work', 'Resident'],
    minAge: 18,
    mandatoryDocs: ['Diploma / Transcript / Graduation Proof', 'Valid Government ID', 'Signed Oath of Undertaking'],
    description: 'Republic Act 11261 waiver granting free government clearances for new jobseekers.'
  },
  'prog-cert-solo-parent': {
    id: 'prog-cert-solo-parent',
    title: 'Solo Parent Barangay Certification (RA 11861)',
    category: 'Clearance & Certification',
    maxMonthlyIncome: 35000,
    incomeLabel: 'Maximum ₱35,000.00 / month',
    mandatoryDocs: ['Solo Parent ID or Sworn Affidavit of Solo Parenting', 'Birth Certificate of Dependents', 'Barangay Indigency / Proof of Income'],
    minAge: 18,
    description: 'Official endorsement certifying Solo Parent status under Republic Act 11861 for monthly subsidies and education aid.'
  },
  'prog-cert-senior-citizen': {
    id: 'prog-cert-senior-citizen',
    title: 'Senior Citizen Barangay Endorsement & Certification',
    category: 'Clearance & Certification',
    maxMonthlyIncome: Infinity,
    incomeLabel: 'Universal for Seniors (60+)',
    minAge: 60,
    mandatoryDocs: ['PSA Birth Certificate or Proof of Age 60+', 'Barangay Resident ID', '2x2 Recent Photos'],
    description: 'Official barangay certification for elderly residents (aged 60+) for OSCA ID, 20% discounts, and social pensions.'
  },
  'prog-cert-pwd': {
    id: 'prog-cert-pwd',
    title: 'PWD Barangay Endorsement & Certification (RA 10754)',
    category: 'Clearance & Certification',
    maxMonthlyIncome: Infinity,
    incomeLabel: 'Universal for Persons with Disabilities',
    mandatoryDocs: ['Medical Certificate / Clinical Disability Assessment', 'Barangay Resident ID', '2x2 ID Photos'],
    minAge: 0,
    description: 'Official barangay certification endorsing PWD benefits, discounts, and assistive device grants.'
  },
  'prog-cert-student-grant': {
    id: 'prog-cert-student-grant',
    title: 'Student Barangay Certification & Fee Waiver Endorsement',
    category: 'Clearance & Certification',
    maxMonthlyIncome: 20000,
    incomeLabel: 'Maximum ₱20,000.00 / month',
    allowedOccupations: ['Student', 'College Student', 'Senior High Student', 'Vocational Student', 'Scholar'],
    minAge: 12,
    maxAge: 30,
    mandatoryDocs: ['Valid Student School ID', 'Certificate of Registration (COR) / Enrollment Form', 'Certificate of Indigency'],
    description: 'Official student certification endorsing government scholarships, student fare discounts, and tuition aid.'
  },
  'prog-admin-business-permit': {
    id: 'prog-admin-business-permit',
    title: 'Barangay Business Clearance / Commercial Permit',
    category: 'Clearance & Certification',
    maxMonthlyIncome: Infinity,
    incomeLabel: 'Commercial Enterprise',
    minAge: 18,
    mandatoryDocs: ['DTI / SEC Registration', 'Proof of Business Location in Bugo', 'Valid ID of Enterprise Owner'],
    description: 'Commercial business clearance required for City Hall Mayor’s Business Permit in Cagayan de Oro.'
  },
  'prog-financial-assistance': {
    id: 'prog-financial-assistance',
    title: 'Financial Assistance',
    category: 'Social Welfare Services',
    maxMonthlyIncome: 15000,
    incomeLabel: 'Maximum ₱15,000.00 / month (or Unemployed / Priority Sector)',
    mandatoryDocs: [
      'Barangay Certificate of Residency',
      'Valid Government-Issued ID',
      'Certificate of Indigency',
      'Accomplished Financial Assistance Application Form'
    ],
    description: 'Cash assistance for low-income, unemployed, and vulnerable Bugo households.'
  },
  'prog-medical-assistance': {
    id: 'prog-medical-assistance',
    title: 'Medical Assistance',
    category: 'Health and Medical Services',
    maxMonthlyIncome: 15000,
    incomeLabel: 'Maximum ₱15,000.00 / month (or Medical Need / Senior / PWD / Solo Parent)',
    mandatoryDocs: [
      'Barangay Certificate of Residency',
      'Valid Government-Issued ID',
      'Medical Certificate, Hospital Bill, or Statement of Account',
      'Medical Assistance Application Form'
    ],
    description: 'Hospital bill, medicine, and treatment support for qualified Bugo residents.'
  },
  'prog-livelihood-program': {
    id: 'prog-livelihood-program',
    title: 'Livelihood Programs',
    category: 'Livelihood and Employment Services',
    maxMonthlyIncome: 20000,
    incomeLabel: 'Maximum ₱20,000.00 / month (Unemployed / Self-Employed / Part-Time)',
    minAge: 18,
    maxAge: 65,
    mandatoryDocs: [
      'Barangay Certificate of Residency',
      'Valid Government-Issued ID',
      'Accomplished Livelihood Application Form',
      'Simple Business or Livelihood Proposal',
      'Certificate of Indigency (if required)',
      'Proof of Existing Livelihood (if applicable)'
    ],
    description: 'Starter kits, micro-business grants, and skills support for local earners.'
  },
  'prog-disaster-relief': {
    id: 'prog-disaster-relief',
    title: 'Disaster Relief Assistance',
    category: 'Community and Emergency Services',
    maxMonthlyIncome: Infinity,
    incomeLabel: 'Disaster / Calamity-Affected Bugo Households',
    mandatoryDocs: [
      'Barangay Certificate of Residency (if available)',
      'Valid Government-Issued ID (if available)',
      'Disaster Incident or Damage Assessment',
      'Accomplished Disaster Assistance Application Form (if required)',
      'Proof of Damaged Property (if applicable)',
      'Household Information'
    ],
    description: 'Emergency relief packs and recovery aid for calamity-affected households.'
  },
  'prog-apply-lab-procedures': {
    id: 'prog-apply-lab-procedures',
    title: 'Laboratories and Other Procedures',
    category: 'Health and Medical Services',
    maxMonthlyIncome: Infinity,
    incomeLabel: 'Open to Bugo Residents (Submit Requirements)',
    mandatoryDocs: [
      'Laboratory Request or Medical Referral',
      'Valid ID (National ID or any valid government ID)',
      'Certificate of Indigency (Optional — Purpose: Medical Assistance)'
    ],
    description: 'Medical diagnostic tests, imaging, and laboratory procedure support.'
  },
  'prog-apply-dswd-burial': {
    id: 'prog-apply-dswd-burial',
    title: 'DSWD Burial Assistance',
    category: 'Social Welfare Services',
    maxMonthlyIncome: Infinity,
    incomeLabel: 'Open to Bugo Residents (Submit Requirements)',
    mandatoryDocs: [
      'Funeral Contract',
      'Death Certificate (Original Copy)',
      'Certificate of Indigency (Purpose: Burial Assistance)',
      'Valid ID (National ID or any valid government ID)'
    ],
    description: 'DSWD burial and funeral expense support for bereaved families.'
  },
  'prog-apply-medical-implants': {
    id: 'prog-apply-medical-implants',
    title: 'Stainless or Medical Implants',
    category: 'Health and Medical Services',
    maxMonthlyIncome: Infinity,
    incomeLabel: 'Open to Bugo Residents (Submit Requirements)',
    mandatoryDocs: [
      'Medical Abstract or Medical Certificate',
      'Certificate of Indigency (Purpose: Medical Assistance)',
      'Valid ID (National ID or any valid government ID)'
    ],
    description: 'Medical assistance for orthopedic stainless plates and surgical implants.'
  },
  'prog-apply-hospital-bill': {
    id: 'prog-apply-hospital-bill',
    title: 'Hospital Bill Assistance',
    category: 'Health and Medical Services',
    maxMonthlyIncome: Infinity,
    incomeLabel: 'Open to Bugo Residents (Submit Requirements)',
    mandatoryDocs: [
      'Final Hospital Bill',
      'Justification Letter (For private or semi-private room)',
      "Doctor's Note (if applicable, Optional)",
      'Valid ID (National ID or any valid government ID)',
      'Certificate of Indigency (Optional — Purpose: Medical Assistance)'
    ],
    description: 'Support for unpaid or final hospital billing statements.'
  },
  'prog-apply-dswd-educational': {
    id: 'prog-apply-dswd-educational',
    title: 'DSWD Educational Assistance',
    category: 'Social Welfare Services',
    maxMonthlyIncome: Infinity,
    incomeLabel: 'Open to Enrolled Students in Bugo (Submit Requirements)',
    mandatoryDocs: [
      'Certificate of Registration (COR)',
      'Certificate of Indigency (Purpose: Educational Assistance)',
      'Valid ID (National ID or any valid government ID)'
    ],
    description: 'DSWD cash aid for enrolled students needing school support.'
  },
  'prog-apply-reseta-tambal': {
    id: 'prog-apply-reseta-tambal',
    title: 'Reseta o Tambal (Medicine Assistance)',
    category: 'Health and Medical Services',
    maxMonthlyIncome: Infinity,
    incomeLabel: 'Open to Bugo Residents (Submit Requirements)',
    mandatoryDocs: [
      "Doctor's Prescription",
      'Medical Abstract or Medical Certificate',
      'Certificate of Indigency (Purpose: Medical Assistance)',
      'Valid ID (National ID or any valid government ID)'
    ],
    description: 'Prescription medicine purchase support for qualified residents.'
  },
  'prog-apply-dswd-transportation': {
    id: 'prog-apply-dswd-transportation',
    title: 'DSWD Transportation Assistance',
    category: 'Social Welfare Services',
    maxMonthlyIncome: Infinity,
    incomeLabel: 'Open to Stranded / Theft-Affected Bugo Residents',
    mandatoryDocs: [
      'Police Blotter (for theft or stranded cases)',
      'Certificate of Indigency (Purpose: Transportation Assistance)',
      'Valid ID (National ID or any valid government ID)'
    ],
    description: 'Emergency travel support for stranded or theft-victim residents.'
  },
  'prog-apply-ovm-medical-financial': {
    id: 'prog-apply-ovm-medical-financial',
    title: 'Vice Mayor Financial Assistance (Hospital Bill / Medical)',
    category: 'Social Welfare Services',
    maxMonthlyIncome: Infinity,
    incomeLabel: 'Office of the City Vice Mayor Medical & Billing Aid',
    mandatoryDocs: [
      'Certificate of Indigency (Hospital Bill / Medical support from Office of Vice Mayor Jocelyn "Bebot" Rodriguez, with claimant & patient name)',
      'Personal Request Letter addressed to Vice Mayor Jocelyn "Bebot" Rodriguez',
      "Patient's Valid ID & Claimant's Valid ID",
      'Hospital Billing: Final Hospital Billing & Medical Abstract (if applicable)',
      'Medical Assistance: Medical Certificate & Latest Medical Prescription (if applicable)'
    ],
    description: 'Office of City Vice Mayor Jocelyn "Bebot" Rodriguez medical & billing aid.'
  },
  'prog-apply-ovm-burial': {
    id: 'prog-apply-ovm-burial',
    title: 'Vice Mayor Burial Assistance',
    category: 'Social Welfare Services',
    maxMonthlyIncome: Infinity,
    incomeLabel: 'Office of the City Vice Mayor Burial Aid',
    mandatoryDocs: [
      'Death Certificate with Registry Number',
      'Certificate of Indigency (Burial assistance from Office of Vice Mayor Jocelyn "Bebot" Rodriguez)',
      'ID of Claimant',
      'Funeral Contract'
    ],
    description: 'Office of City Vice Mayor Jocelyn "Bebot" Rodriguez burial aid.'
  }
};

export interface CertificateQualificationResult {
  isQualified: boolean;
  score: number;
  badgeLabel: 'QUALIFIED' | 'NOT QUALIFIED / REQUIREMENTS INCOMPLETE';
  badgeColor: 'emerald' | 'rose';
  shortReason: string;
  passedCriteria: string[];
  failedCriteria: string[];
  passedRules: string[];
  failureReasons: string[];
  failedRules: string[];
  summary: string;
}

export function hasVerifiedStudentDocument(
  documents?: Array<{
    name?: string;
    docCategory?: string;
    fileUrl?: string;
    previewUrl?: string;
    autoAttached?: boolean;
    sourceLabel?: string;
    verified?: boolean;
    scanResult?: {
      isValid?: boolean;
      isClear?: boolean;
      detectedDocType?: string;
      matchedKeywords?: string[];
      extractedText?: string;
    };
    analysis?: {
      isId?: boolean;
      isClear?: boolean;
      isValid?: boolean;
      detectedDocType?: string;
      extractedText?: string;
    };
  }> | null
): boolean {
  if (!Array.isArray(documents) || documents.length === 0) return false;
  return documents.some((doc) => {
    if (!doc) return false;
    const url = doc.fileUrl || doc.previewUrl || '';
    const hasUrlOrVerified = Boolean((typeof url === 'string' && url.trim().length > 10) || doc.autoAttached);
    if (!hasUrlOrVerified) return false;
    if (
      doc.scanResult?.isValid === false ||
      doc.scanResult?.isClear === false ||
      doc.analysis?.isValid === false ||
      doc.analysis?.isClear === false ||
      doc.analysis?.isId === false
    ) {
      return false;
    }

    const catLower = String(doc.docCategory || '').toLowerCase();
    const isIdSlot = catLower === 'front id' || catLower === 'back id';
    if (isIdSlot) {
      const idTypeText = [
        doc.analysis?.detectedDocType || '',
        doc.scanResult?.detectedDocType || '',
        doc.name || '',
        doc.analysis?.extractedText || ''
      ]
        .join(' ')
        .toLowerCase();
      return /\b(?:school id|student id|student identification)\b/.test(idTypeText);
    }

    const combinedText = [
      doc.name || '',
      doc.docCategory || '',
      doc.sourceLabel || '',
      doc.scanResult?.detectedDocType || '',
      ...(Array.isArray(doc.scanResult?.matchedKeywords) ? doc.scanResult!.matchedKeywords : []),
      doc.scanResult?.extractedText || '',
      doc.analysis?.detectedDocType || '',
      doc.analysis?.extractedText || ''
    ]
      .join(' ')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!combinedText) return false;
    return /\b(?:certificate of registration|certificate of enrollment|certificate of enrolment|enrollment form|enrolment form|school enrollment|matriculation|study load|registration form|school id|student id|report card|transcript of records|official transcript|academic transcript|grade sheet|grade slip|copy of grades|form 138|form 137|sf9|sf10|scholastic record|verified student enrollment|student profile|cor|tor)\b/.test(
      combinedText
    );
  });
}

/**
 * Automates the qualification evaluation of a resident's household profiling data
 * against any requested Certificate or Clearance service.
 */
export function evaluateCertificateQualification(
  resident: Partial<import('../types').ResidentUser> | null | undefined,
  serviceId: string,
  serviceMeta?: Partial<import('../types').AssistanceProgram>,
  options?: { hasVerifiedStudentDoc?: boolean }
): CertificateQualificationResult {
  if (!resident) {
    const defaultFail = ['Sign in or create an account to check eligibility.'];
    return {
      isQualified: false,
      score: 0,
      badgeLabel: 'NOT QUALIFIED / REQUIREMENTS INCOMPLETE',
      badgeColor: 'rose',
      shortReason: 'Account required',
      passedCriteria: [],
      failedCriteria: defaultFail,
      passedRules: [],
      failureReasons: defaultFail,
      failedRules: defaultFail,
      summary: 'Sign in to check qualification.'
    };
  }

  const passedCriteria: string[] = [];
  const failedCriteria: string[] = [];
  const incomeVal = parseMonthlyIncome(resident.householdIncome || '');
  const residentAge = resident.age || 0;
  const occ = (resident.occupation || '').toLowerCase();
  const civil = resident.civilStatus || 'Single';

  // Rule 0: Bugo Zone Residency
  const hasValidPurok = Boolean(resident.purok && resident.purok.toLowerCase().includes('zone'));
  if (hasValidPurok) {
    passedCriteria.push(`Verified Territorial Residency: Bona fide resident of ${resident.purok}`);
  } else {
    failedCriteria.push('Territorial Residency: Must be a resident residing within Bugo Zones 1 to 10');
  }

  // Rule 1: Identification on file (Front & Back validity, clarity, type, side & identity match)
  const frontAnalysis = resident.idPhotoAnalysis;
  const backAnalysis = resident.backIdPhotoAnalysis;
  const hasIdMismatch = (a?: typeof frontAnalysis) => Boolean(
    a && (
      a.matchesExpectedType === false ||
      a.matchesExpectedName === false ||
      a.matchesExpectedBirthdate === false ||
      a.matchesExpectedIdNumber === false ||
      a.matchesExpectedGender === false ||
      a.matchesExpectedCivilStatus === false ||
      a.matchesExpectedSide === false
    )
  );
  const frontInvalid = frontAnalysis?.isId === false;
  const backInvalid = backAnalysis?.isId === false;
  const frontBlurry = frontAnalysis?.isClear === false;
  const backBlurry = backAnalysis?.isClear === false;
  const idInfoMismatch = hasIdMismatch(frontAnalysis) || hasIdMismatch(backAnalysis);
  const missingFrontOrBackOnNewAccount = !resident.isVerified && (!resident.frontIdUrl || !resident.backIdUrl);
  const hasIdOnFile = Boolean(resident.idType || resident.idNumber || resident.frontIdUrl || resident.residentIdNumber);

  if (frontInvalid || backInvalid) {
    failedCriteria.push('Invalid ID: Attached Front or Back image is not a valid ID');
  } else if (idInfoMismatch) {
    failedCriteria.push('ID Info Mismatch: Attached Front/Back ID does not match the selected ID Type or registered personal information');
  } else if (frontBlurry || backBlurry) {
    failedCriteria.push('Photo Not Clear: Please attach a clearer Front/Back ID photo and try again');
  } else if (missingFrontOrBackOnNewAccount) {
    failedCriteria.push('Missing ID: Both Front and Back ID photos are required');
  } else if (hasIdOnFile) {
    passedCriteria.push(`ID Verification: Official identity credentials on file (${resident.idType || 'Barangay Resident ID'})`);
  } else {
    failedCriteria.push('Identity Credentials: Valid government, student, or resident ID must be registered on account');
  }

  // Certificate-Specific Rules:
  switch (serviceId) {
    case 'prog-cert-solo-parent': {
      // Must be Solo Parent under RA 11861 or widowed/separated with dependents
      const isSolo = Boolean(resident.isSoloParent);
      const isWidowedOrSeparatedWithKids = (civil === 'Widowed' || civil === 'Separated') && (resident.familyMembersCount || 0) >= 2;
      
      if (isSolo || isWidowedOrSeparatedWithKids) {
        passedCriteria.push(
          isSolo 
            ? `Solo Parent Status: Verified registered solo parent under RA 11861 (${resident.soloParentIdNumber ? `ID #${resident.soloParentIdNumber}` : 'Declared'})`
            : `Civil Status & Dependents: Registered as ${civil} sole head with ${(resident.familyMembersCount || 1) - 1} dependent child/children`
        );
      } else {
        failedCriteria.push(
          civil === 'Married'
            ? 'Solo Parent Criteria: Registered as Married with co-parenting spouse; does not qualify under RA 11861 Solo Parents Act'
            : 'Solo Parent Criteria: Must be registered as a Solo Parent or single head with minor dependents'
        );
      }

      if (incomeVal <= 35000) {
        passedCriteria.push(`Income Ceiling: Household income of ₱${incomeVal.toLocaleString()} is within the RA 11861 subsidy bracket (<= ₱35,000)`);
      } else {
        failedCriteria.push(`Income Ceiling: Household income exceeds RA 11861 threshold of ₱35,000/month`);
      }
      break;
    }

    case 'prog-cert-senior-citizen': {
      // Must be Senior Citizen (60+ yrs old)
      const isSeniorFlag = Boolean(resident.isSenior) || residentAge >= 60;
      if (isSeniorFlag) {
        passedCriteria.push(`Senior Age Criteria: Applicant age is ${residentAge > 0 ? `${residentAge} years old` : '60+ (Senior)'}, qualifying for OSCA endorsement`);
        if (resident.seniorIdNumber) {
          passedCriteria.push(`Senior OSCA ID: Documented Senior ID #${resident.seniorIdNumber}`);
        }
      } else {
        failedCriteria.push(`Age Requirement: Applicant is ${residentAge > 0 ? `${residentAge} years old` : 'under 60'}; Senior Citizen certification requires age 60 and above`);
      }
      break;
    }

    case 'prog-cert-pwd': {
      // Must be PWD
      const isPwd = Boolean(resident.isPwd);
      if (isPwd) {
        passedCriteria.push(`PWD Verification: Documented Person with Disability status (${resident.pwdDisabilityType || 'Registered Impairment'}) under RA 10754`);
        if (resident.pwdIdNumber) {
          passedCriteria.push(`PWD ID Card: Registered PWD ID #${resident.pwdIdNumber}`);
        }
      } else {
        failedCriteria.push('Disability Status: Requires registered Person with Disability (PWD) status under Republic Act 10754');
      }
      break;
    }

    case 'prog-cert-student-grant': {
      // Must be Student (via profile or verified COR / School ID / academic document)
      const hasDoc = Boolean(options?.hasVerifiedStudentDoc);
      const isStudent = Boolean(resident.isStudent) || hasDoc || occ.includes('student') || occ.includes('scholar') || Boolean(resident.isTeenager);
      if (isStudent) {
        passedCriteria.push(
          hasDoc && !resident.isStudent
            ? 'Student Enrolment: Verified via attached Certificate of Registration / Student Document'
            : `Student Enrolment: Verified active student (${resident.schoolName || resident.studentLevel || 'Academic enrollee'})`
        );
      } else {
        failedCriteria.push('Academic Status: Applicant must be an active enrolled student or youth scholar');
      }

      if (incomeVal <= 20000) {
        passedCriteria.push(`Income Bracket: Household income (₱${incomeVal.toLocaleString()}) qualifies for educational fee waiver support`);
      } else {
        failedCriteria.push(`Income Bracket: Household income exceeds educational fee waiver ceiling (<= ₱20,000)`);
      }
      break;
    }

    case 'prog-admin-indigency': {
      // Low income <= 10,000
      if (incomeVal <= 10000) {
        passedCriteria.push(`Economic Need: Monthly income (₱${incomeVal.toLocaleString()}) is at or below the statutory indigency threshold (<= ₱10,000)`);
      } else {
        failedCriteria.push(`Economic Need: Household monthly income (₱${incomeVal.toLocaleString()}) exceeds the ₱10,000.00 indigency threshold`);
      }
      break;
    }

    case 'prog-admin-first-job': {
      // First-time jobseeker
      const isJobseeker = occ.includes('unemployed') || occ.includes('student') || occ.includes('jobseeker') || occ.includes('resident') || occ.includes('graduate');
      if (residentAge >= 18) {
        passedCriteria.push(`Legal Age: Applicant is ${residentAge} years old (meets statutory legal employment age >= 18)`);
      } else if (residentAge > 0 && residentAge < 18) {
        failedCriteria.push(`Legal Age: Applicant must be at least 18 years of age (currently ${residentAge} years old)`);
      }

      if (isJobseeker) {
        passedCriteria.push(`Job Market Status: Applicant qualifies as first-time labor market entrant under RA 11261`);
      } else {
        failedCriteria.push(`Employment Status: Occupation is currently recorded as '${resident.occupation || 'Employed'}'; RA 11261 applies to first-time jobseekers`);
      }
      break;
    }

    case 'prog-admin-business-permit': {
      if (residentAge >= 18) {
        passedCriteria.push(`Legal Age: Applicant is of legal age (${residentAge > 0 ? residentAge : '18+'} years old)`);
      } else {
        failedCriteria.push('Legal Age: Enterprise proprietor must be at least 18 years old');
      }
      passedCriteria.push('Commercial Zoning: Business clearance covers Bugo commercial & residential zones');
      break;
    }

    case 'prog-barangay-clearance':
    case 'prog-admin-residency':
    case 'prog-admin-good-moral':
    default: {
      // Universal resident certificates & custom Admin services
      if (resident.isBanned) {
        failedCriteria.push(`Barangay Standing: Account is currently restricted/banned: ${resident.banReason || 'Policy dispute'}`);
      } else {
        passedCriteria.push('Barangay Standing: Clean community record with no unresolved blotters or sanctions');
      }
      const audienceLower = `${serviceMeta?.targetAudience || ''} ${serviceMeta?.title || ''}`.toLowerCase();
      if (audienceLower.includes('senior') && !(Boolean(resident.isSenior) || residentAge >= 60)) {
        failedCriteria.push('Age Requirement: Service is for Senior Citizens (60+)');
      } else if (audienceLower.includes('pwd') && !resident.isPwd) {
        failedCriteria.push('PWD Requirement: Service is for registered Persons with Disability');
      } else if (audienceLower.includes('solo parent') && !resident.isSoloParent) {
        failedCriteria.push('Solo Parent Requirement: Service is for registered Solo Parents');
      } else if ((audienceLower.includes('indigent') || audienceLower.includes('low income') || audienceLower.includes('low-income')) && incomeVal > 10000) {
        failedCriteria.push(`Economic Need: Monthly income (₱${incomeVal.toLocaleString()}) exceeds ₱10,000 indigency threshold`);
      }
      break;
    }
  }

  const isQualified = failedCriteria.length === 0;
  const totalChecks = passedCriteria.length + failedCriteria.length;
  const score = totalChecks > 0 ? Math.round((passedCriteria.length / totalChecks) * 100) : 100;

  let shortReason = '';
  if (!isQualified) {
    const firstFail = failedCriteria[0] || 'Check profile details';
    shortReason = firstFail.includes(':') ? firstFail.split(':').slice(1).join(':').trim() : firstFail;
  } else {
    const zoneShort = (resident.purok || 'Bugo').split(' - ')[0];
    switch (serviceId) {
      case 'prog-admin-indigency':
        shortReason = `Income ₱${incomeVal.toLocaleString()} ≤ ₱10,000 · ${zoneShort}`;
        break;
      case 'prog-admin-residency':
        shortReason = `${zoneShort}${resident.yearsOfResidency ? ` · ${resident.yearsOfResidency} yrs` : ''}`;
        break;
      case 'prog-cert-solo-parent':
        shortReason = `Registered Solo Parent · ${zoneShort}`;
        break;
      case 'prog-cert-senior-citizen':
        shortReason = `Age ${residentAge || '60+'} Senior · ${zoneShort}`;
        break;
      case 'prog-cert-pwd':
        shortReason = `Registered PWD · ${zoneShort}`;
        break;
      case 'prog-cert-student-grant':
        shortReason = `Enrolled Student · Income ₱${incomeVal.toLocaleString()}`;
        break;
      case 'prog-admin-first-job':
        shortReason = `First-time jobseeker · Age ${residentAge || '18+'}`;
        break;
      default:
        shortReason = `Verified ${zoneShort} resident`;
        break;
    }
  }

  const summary = isQualified
    ? `Qualified · ${shortReason}`
    : `Not Qualified · ${shortReason}`;

  return {
    isQualified,
    score,
    badgeLabel: isQualified ? 'QUALIFIED' : 'NOT QUALIFIED / REQUIREMENTS INCOMPLETE',
    badgeColor: isQualified ? 'emerald' : 'rose',
    shortReason,
    passedCriteria,
    failedCriteria,
    passedRules: passedCriteria,
    failureReasons: failedCriteria,
    failedRules: failedCriteria,
    summary
  };
}

export interface ApplicantEvaluationInput {
  programId: string;
  programTitle?: string;
  programCategory?: string;
  targetAudience?: string;
  programType?: 'regular' | 'disaster' | 'service';
  qualificationRules?: ProgramQualificationRules;
  eligibilityCriteria?: string[];
  applicantName: string;
  purok: string;
  address: string;
  householdIncome: string;
  familyCount?: number;
  occupation?: string;
  employmentStatus?: string;
  age?: number;
  civilStatus?: string;
  isPwd?: boolean;
  isSenior?: boolean;
  isSoloParent?: boolean;
  isStudent?: boolean;
  hasVerifiedStudentDoc?: boolean;
  isTeenager?: boolean;
  isBanned?: boolean;
  hasMedicalNeed?: boolean;
  isDisasterAffected?: boolean;
  purpose: string;
  hasFrontId: boolean;
  hasBackId?: boolean;
  hasSupportingDoc: boolean;
  hasMissingRequiredDocs?: boolean;
  missingDocsLabel?: string;
  idAnalysis?: IdPhotoAnalysis | null;
  backIdAnalysis?: IdPhotoAnalysis | null;
}

export function evaluateApplicantEligibility(input: ApplicantEvaluationInput): EligibilityEvaluation {
  // Find rule config or fallback
  let config = PROGRAM_RULES[input.programId];
  if (!config) {
    // Attempt match by title or category
    const titleLower = (input.programTitle || input.programId).toLowerCase();
    if (titleLower.includes('laborator')) {
      config = PROGRAM_RULES['prog-apply-lab-procedures'];
    } else if (titleLower.includes('implant') || titleLower.includes('stainless')) {
      config = PROGRAM_RULES['prog-apply-medical-implants'];
    } else if (titleLower.includes('hospital bill') && !titleLower.includes('vice mayor')) {
      config = PROGRAM_RULES['prog-apply-hospital-bill'];
    } else if (titleLower.includes('reseta') || titleLower.includes('tambal')) {
      config = PROGRAM_RULES['prog-apply-reseta-tambal'];
    } else if (titleLower.includes('transportation')) {
      config = PROGRAM_RULES['prog-apply-dswd-transportation'];
    } else if (titleLower.includes('dswd educational') || (titleLower.includes('educational') && titleLower.includes('dswd'))) {
      config = PROGRAM_RULES['prog-apply-dswd-educational'];
    } else if (titleLower.includes('vice mayor') && titleLower.includes('burial')) {
      config = PROGRAM_RULES['prog-apply-ovm-burial'];
    } else if (titleLower.includes('vice mayor')) {
      config = PROGRAM_RULES['prog-apply-ovm-medical-financial'];
    } else if (titleLower.includes('burial')) {
      config = PROGRAM_RULES['prog-apply-dswd-burial'];
    } else if (titleLower.includes('disaster relief')) {
      config = PROGRAM_RULES['prog-disaster-relief'];
    } else if (titleLower.includes('livelihood')) {
      config = PROGRAM_RULES['prog-livelihood-program'];
    } else if (titleLower.includes('financial assistance')) {
      config = PROGRAM_RULES['prog-financial-assistance'];
    } else if (titleLower.includes('medical assistance')) {
      config = PROGRAM_RULES['prog-medical-assistance'];
    } else {
      config = PROGRAM_RULES['prog-barangay-clearance'];
    }
  }

  const rules: EligibilityRuleResult[] = [];
  const parsedIncome = parseMonthlyIncome(input.householdIncome);
  const customRules = input.qualificationRules;
  const ageVal = typeof input.age === 'number' ? input.age : 0;
  const civil = input.civilStatus || 'Single';
  const occ = (input.occupation || '').trim().toLowerCase();
  const emp = (input.employmentStatus || '').trim();

  const sectorMatches = {
    unemployed: emp === 'Unemployed' || occ.includes('unemployed') || occ.includes('jobseeker'),
    senior: Boolean(input.isSenior) || ageVal >= 60,
    pwd: Boolean(input.isPwd),
    solo_parent: Boolean(input.isSoloParent) || ((civil === 'Widowed' || civil === 'Separated') && (input.familyCount || 0) >= 2),
    student: Boolean(input.isStudent) || Boolean(input.hasVerifiedStudentDoc) || emp === 'Student' || occ.includes('student') || occ.includes('scholar') || Boolean(input.isTeenager),
    medical_need: Boolean(input.hasMedicalNeed)
  };

  // 1. Income / Program-Specific Priority Check
  const effectiveMaxIncome = customRules
    ? (typeof customRules.maxMonthlyIncome === 'number' && customRules.maxMonthlyIncome >= 0 ? customRules.maxMonthlyIncome : null)
    : config.maxMonthlyIncome;
  const effectiveIncomeLabel = customRules
    ? (effectiveMaxIncome !== null ? `≤ ₱${effectiveMaxIncome.toLocaleString()} / month` : 'No Income Cap')
    : config.incomeLabel;

  let incomePassed = effectiveMaxIncome === null ? true : parsedIncome <= effectiveMaxIncome;
  let incomeExplanation = effectiveMaxIncome === null
    ? 'No monthly income cap set.'
    : incomePassed
      ? `Income ₱${parsedIncome.toLocaleString()} is within ${effectiveIncomeLabel}.`
      : `Income ₱${parsedIncome.toLocaleString()} exceeds ${effectiveIncomeLabel}.`;

  if (customRules) {
    const largeMin = customRules.largeHouseholdMinMembers || 0;
    const largeMax = customRules.largeHouseholdMaxIncome || 0;
    if (!incomePassed && largeMin > 0 && largeMax > 0 && (input.familyCount || 0) >= largeMin && parsedIncome <= largeMax) {
      incomePassed = true;
      incomeExplanation = `Large household (${input.familyCount} members) within ₱${largeMax.toLocaleString()} bracket.`;
    } else if (!incomePassed && customRules.sectorMatchMode === 'any_or_income' && Array.isArray(customRules.eligibleSectors)) {
      const matchedSec = customRules.eligibleSectors.find(sec => sectorMatches[sec]);
      if (matchedSec) {
        incomePassed = true;
        incomeExplanation = `Qualified via priority sector (${matchedSec.replace('_', ' ')}).`;
      }
    }
  } else {
    if (config.id === 'prog-medical-assistance' && input.hasMedicalNeed && parsedIncome <= 35000) {
      incomePassed = true;
      incomeExplanation = 'Medical need declared on resident profile.';
    } else if (config.id === 'prog-financial-assistance' && !incomePassed && (input.familyCount || 0) >= 5 && parsedIncome <= 20000) {
      incomePassed = true;
      incomeExplanation = `Large household (${input.familyCount} members) within ₱20,000 bracket.`;
    } else if (config.id === 'prog-livelihood-program' && !incomePassed && (input.familyCount || 0) >= 5 && parsedIncome <= 25000) {
      incomePassed = true;
      incomeExplanation = `Large household (${input.familyCount} members) within ₱25,000 bracket.`;
    }
  }

  rules.push({
    ruleName: 'Income & Priority Bracket',
    passed: incomePassed,
    actualValue: input.householdIncome || '₱0.00',
    limitValue: effectiveIncomeLabel,
    explanation: incomeExplanation
  });

  // 2. Demographic / Sector / Age Eligibility Check
  let occupationPassed = true;
  let occupationExplanation = 'Meets applicant criteria.';
  const audienceLower = `${input.targetAudience || ''} ${input.programTitle || ''}`.toLowerCase();

  if (input.isBanned) {
    occupationPassed = false;
    occupationExplanation = 'Account is currently banned or restricted.';
  } else if (customRules) {
    const minAge = typeof customRules.minAge === 'number' && customRules.minAge > 0 ? customRules.minAge : null;
    const maxAge = typeof customRules.maxAge === 'number' && customRules.maxAge > 0 ? customRules.maxAge : null;
    if (minAge !== null && ageVal > 0 && ageVal < minAge) {
      occupationPassed = false;
      occupationExplanation = `Age ${ageVal} is below minimum age ${minAge}.`;
    } else if (maxAge !== null && ageVal > maxAge) {
      occupationPassed = false;
      occupationExplanation = `Age ${ageVal} exceeds maximum age ${maxAge}.`;
    } else if (Array.isArray(customRules.allowedEmploymentStatuses) && customRules.allowedEmploymentStatuses.length > 0) {
      const empMatched = customRules.allowedEmploymentStatuses.some(
        allowed =>
          allowed.toLowerCase() === emp.toLowerCase() ||
          (Boolean(input.hasVerifiedStudentDoc) && allowed.toLowerCase().includes('student')) ||
          (allowed.toLowerCase().includes('self') && (occ.includes('vendor') || occ.includes('farm')))
      );
      if (!empMatched) {
        occupationPassed = false;
        occupationExplanation = `${emp || input.occupation || 'Employment status'} is outside allowed groups (${customRules.allowedEmploymentStatuses.join(', ')}).`;
      }
    }
    if (
      occupationPassed &&
      customRules.sectorMatchMode === 'all_required' &&
      Array.isArray(customRules.eligibleSectors) &&
      customRules.eligibleSectors.length > 0
    ) {
      const anySectorMatched = customRules.eligibleSectors.some(sec => sectorMatches[sec]);
      if (!anySectorMatched) {
        occupationPassed = false;
        occupationExplanation = `Requires matching profile sector: ${customRules.eligibleSectors.map(s => s.replace('_', ' ')).join(', ')}.`;
      }
    }
  } else if (config.id === 'prog-cert-senior-citizen' || audienceLower.includes('senior citizen')) {
    const qualifiesSenior = Boolean(input.isSenior) || ageVal >= 60;
    if (!qualifiesSenior) {
      occupationPassed = false;
      occupationExplanation = ageVal > 0 ? `Age ${ageVal} is under 60 (Senior Citizen required).` : 'Senior Citizen status (60+) required.';
    } else {
      occupationExplanation = 'Senior Citizen criteria met (60+).';
    }
  } else if (config.id === 'prog-cert-pwd' || /\bpwd\b|disability/i.test(audienceLower)) {
    if (!input.isPwd) {
      occupationPassed = false;
      occupationExplanation = 'Requires registered PWD profile status.';
    } else {
      occupationExplanation = 'Verified PWD profile criteria met.';
    }
  } else if (config.id === 'prog-cert-solo-parent' || audienceLower.includes('solo parent')) {
    const isSolo = Boolean(input.isSoloParent) || ((civil === 'Widowed' || civil === 'Separated') && (input.familyCount || 0) >= 2);
    if (!isSolo) {
      occupationPassed = false;
      occupationExplanation = 'Requires registered Solo Parent status.';
    } else {
      occupationExplanation = 'Solo Parent criteria met.';
    }
  } else if (config.id === 'prog-cert-student-grant') {
    const isStud =
      Boolean(input.isStudent) ||
      Boolean(input.hasVerifiedStudentDoc) ||
      occ.includes('student') ||
      occ.includes('scholar') ||
      Boolean(input.isTeenager);
    if (!isStud) {
      occupationPassed = false;
      occupationExplanation = 'Requires active Student status or verified Certificate of Registration / School ID.';
    } else {
      occupationExplanation =
        input.hasVerifiedStudentDoc && !input.isStudent
          ? 'Verified student enrollment document attached.'
          : 'Student criteria met.';
    }
  } else if (config.id === 'prog-livelihood-program') {
    const isExcluded =
      emp === 'Retired' ||
      (emp === 'Employed (Full-Time)' && !occ.includes('vendor') && !occ.includes('farm')) ||
      (emp === 'Student' && !occ.includes('vendor'));
    if (isExcluded) {
      occupationPassed = false;
      occupationExplanation = `${emp} is outside target livelihood group.`;
    } else {
      occupationExplanation = `${emp || input.occupation || 'Self-Employed'} qualifies.`;
    }
  } else if (config.id === 'prog-disaster-relief') {
    const purposeLower = (input.purpose || '').toLowerCase();
    const hasDisasterContext =
      Boolean(input.isDisasterAffected) ||
      ['flood', 'fire', 'typhoon', 'storm', 'landslide', 'earthquake', 'calamity', 'disaster', 'damage', 'affected', 'relief'].some(kw => purposeLower.includes(kw));
    if (!hasDisasterContext) {
      occupationPassed = false;
      occupationExplanation = 'Disaster or calamity impact required.';
    } else {
      occupationExplanation = 'Disaster-affected household confirmed.';
    }
  } else if (config.allowedOccupations && config.allowedOccupations.length > 0) {
    const allowsStudent = config.allowedOccupations.some(
      a => a.toLowerCase().includes('student') || a.toLowerCase().includes('scholar')
    );
    const isExplicitlyAllowed =
      Boolean((input.isStudent || input.hasVerifiedStudentDoc) && allowsStudent) ||
      config.allowedOccupations.some(allowed => occ.includes(allowed.toLowerCase()));
    const isExplicitlyDisallowed = config.disallowedOccupations?.some(dis => occ.includes(dis.toLowerCase()));

    if (isExplicitlyDisallowed) {
      occupationPassed = false;
      occupationExplanation = `Occupation '${input.occupation}' does not qualify.`;
    } else if (!isExplicitlyAllowed && !occ.includes('student') && !occ.includes('scholar') && !occ.includes('unemployed') && !occ.includes('dependent')) {
      occupationPassed = false;
      occupationExplanation = `Requires target group: ${config.allowedOccupations.join(', ')}.`;
    } else {
      occupationExplanation =
        input.hasVerifiedStudentDoc && allowsStudent && !input.isStudent
          ? 'Verified student enrollment document attached.'
          : `Occupation '${input.occupation || 'Student'}' qualifies.`;
    }
  }

  if (!customRules && occupationPassed && typeof config.minAge === 'number' && ageVal > 0 && ageVal < config.minAge) {
    occupationPassed = false;
    occupationExplanation = `Minimum age ${config.minAge} required (applicant is ${ageVal}).`;
  }
  if (!customRules && occupationPassed && typeof config.maxAge === 'number' && ageVal > config.maxAge) {
    occupationPassed = false;
    occupationExplanation = `Maximum age limit is ${config.maxAge} (applicant is ${ageVal}).`;
  }

  rules.push({
    ruleName: 'Profile & Sector Qualification',
    passed: occupationPassed,
    actualValue: input.occupation || 'Resident',
    limitValue: config.allowedOccupations ? config.allowedOccupations.join(', ') : 'Program Criteria',
    explanation: occupationExplanation
  });

  // 3. Bugo Residency Boundary Check
  const allowedZones = customRules?.allowedZones || [];
  const inBugoZone = Boolean(input.purok && input.purok.toLowerCase().includes('zone'));
  const matchesCustomZone =
    allowedZones.length === 0 ||
    allowedZones.some(z => (input.purok || '').toLowerCase().includes(z.toLowerCase()));
  const residencyPassed = inBugoZone && matchesCustomZone;
  rules.push({
    ruleName: 'Bugo Residency',
    passed: residencyPassed,
    actualValue: input.purok || 'Unknown Purok',
    limitValue: allowedZones.length > 0 ? allowedZones.join(', ') : 'Zones 1 - 10, Barangay Bugo',
    explanation: residencyPassed
      ? `Resident of ${input.purok}.`
      : allowedZones.length > 0
        ? `Must reside within ${allowedZones.join(', ')}.`
        : 'Must reside within Barangay Bugo Zones 1–10.'
  });

  // 4. Identification & Document Authenticity Check (Front & Back)
  const idOptionalForDisaster = config.id === 'prog-disaster-relief' || input.programType === 'disaster';
  let idPassed = idOptionalForDisaster ? true : (input.hasFrontId && input.hasBackId !== false);
  let idExplanation = 'Front and Back IDs verified.';
  if (input.idAnalysis && !input.idAnalysis.isId) {
    idPassed = false;
    idExplanation = 'Front upload is not a valid ID.';
  } else if (input.backIdAnalysis && !input.backIdAnalysis.isId) {
    idPassed = false;
    idExplanation = 'Back upload is not a valid ID.';
  } else if (input.idAnalysis && !input.idAnalysis.isClear) {
    idPassed = false;
    idExplanation = 'Front ID photo is blurry or unclear.';
  } else if (input.backIdAnalysis && !input.backIdAnalysis.isClear) {
    idPassed = false;
    idExplanation = 'Back ID photo is blurry or unclear.';
  } else if (!input.hasFrontId || input.hasBackId === false) {
    if (idOptionalForDisaster) {
      idPassed = true;
      idExplanation = 'ID optional for emergency relief.';
    } else {
      idPassed = false;
      idExplanation = 'Front and Back valid ID photos required.';
    }
  } else if (input.idAnalysis) {
    idExplanation = `Valid ${input.idAnalysis.detectedDocType || 'ID'} attached.`;
  }

  rules.push({
    ruleName: 'Valid ID Verification',
    passed: idPassed,
    actualValue: !input.hasFrontId || input.hasBackId === false
      ? 'Missing ID'
      : input.idAnalysis?.isId === false || input.backIdAnalysis?.isId === false
        ? 'Invalid ID'
        : input.idAnalysis?.isClear === false || input.backIdAnalysis?.isClear === false
          ? 'Blurry Photo'
          : 'Front & Back Valid',
    limitValue: 'Clear Front & Back ID',
    explanation: idExplanation
  });

  // 5. Required Qualification Documents Check (if flagged)
  if (input.hasMissingRequiredDocs) {
    rules.push({
      ruleName: 'Qualification Documents',
      passed: false,
      actualValue: 'Missing / Invalid',
      limitValue: 'All required documents valid',
      explanation: input.missingDocsLabel || 'Required qualification document missing or invalid.'
    });
  } else {
    rules.push({
      ruleName: 'Qualification Documents',
      passed: true,
      actualValue: 'Complete',
      limitValue: 'Required documents attached',
      explanation: 'All required qualification documents ready.'
    });
  }

  // 6. Purpose Statement Check
  const purposePassed = Boolean(input.purpose && input.purpose.trim().length >= 10);
  rules.push({
    ruleName: 'Purpose Statement',
    passed: purposePassed,
    actualValue: input.purpose ? `${input.purpose.trim().length} chars` : 'Empty',
    limitValue: 'Min. 10 characters',
    explanation: purposePassed
      ? 'Valid purpose provided.'
      : 'Purpose must be at least 10 characters.'
  });

  // Determine overall capability
  const failedRules = rules.filter(r => !r.passed);
  const isCapable = failedRules.length === 0;
  const score = Math.round(((rules.length - failedRules.length) / rules.length) * 100);

  let verdict: 'ELIGIBLE' | 'INELIGIBLE' | 'REQUIRES_MANUAL_REVIEW' = isCapable ? 'ELIGIBLE' : 'INELIGIBLE';
  let summary = '';
  let disqualifiedReason = '';

  if (isCapable) {
    summary = `Fits all qualifications for ${config.title}. Marked as Valid.`;
  } else {
    const reasons = failedRules.map(r => r.ruleName).join(', ');
    disqualifiedReason = failedRules.map(r => `${r.ruleName}: ${r.explanation}`).join(' · ');
    summary = `Invalid / Not Qualified (${reasons}).`;
  }

  return {
    verdict,
    isCapable,
    score,
    summary,
    disqualifiedReason: isCapable ? undefined : disqualifiedReason,
    rules,
    evaluatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
    idAudit: input.idAnalysis ? {
      isId: input.idAnalysis.isId,
      isClear: input.idAnalysis.isClear,
      detectedType: input.idAnalysis.detectedDocType,
      warning: input.idAnalysis.warning || undefined
    } : undefined
  };
}

/**
 * Heuristic client-side ID photo check to warn the user immediately upon selecting a photo
 */
export function inspectIdPhotoClientHeuristic(file: File): IdPhotoAnalysis {
  const fileName = file.name.toLowerCase();
  const isImage = file.type.startsWith('image/');
  const sizeMb = file.size / (1024 * 1024);

  // Check common non-ID hints in file names
  const nonIdKeywords = ['food', 'selfie', 'cat', 'dog', 'screenshot', 'wallpaper', 'meme', 'landscape', 'flower', 'party', 'vacation'];
  const isSuspiciousName = nonIdKeywords.some(kw => fileName.includes(kw));

  // If very small (< 15KB) it might be an icon or extremely blurry thumbnail
  const isTooSmall = file.size < 15 * 1024;
  
  // If user named it ID or similar
  const hasIdKeyword = fileName.includes('id') || fileName.includes('license') || fileName.includes('phil') || fileName.includes('voter') || fileName.includes('card') || fileName.includes('doc');

  if (!isImage) {
    return {
      isId: false,
      isClear: false,
      detectedDocType: 'Non-Image File',
      warning: 'Please select an image file (JPEG, PNG, or WEBP) for ID verification.',
      advice: 'Upload a clear photograph or scan of your physical identification card.',
      score: 10
    };
  }

  if (isSuspiciousName) {
    return {
      isId: false,
      isClear: true,
      detectedDocType: 'Unrecognized Image',
      warning: 'Uploaded photo appears to be a casual photo or non-ID image. Official government/student ID is strictly required.',
      advice: 'Please take a clear photo of your physical ID card against a neutral surface.',
      score: 25
    };
  }

  if (isTooSmall) {
    return {
      isId: true,
      isClear: false,
      detectedDocType: 'Low Resolution / Blurry Image',
      warning: 'Warning: Image resolution is very low and text may be unreadable. Please upload a sharper, higher-resolution photo.',
      advice: 'Ensure good lighting and make sure all text on the ID is crisp and legible.',
      score: 45
    };
  }

  return {
    isId: true,
    isClear: true,
    detectedDocType: hasIdKeyword ? 'Government / Student ID' : 'Identification Document',
    warning: null,
    advice: 'ID document ready for submission.',
    score: hasIdKeyword ? 95 : 85
  };
}

/**
 * Validates if a program is exclusively an Official Certificate / Clearance application
 */
export const OFFICIAL_CERTIFICATE_IDS = new Set([
  'prog-barangay-clearance',
  'prog-admin-residency',
  'prog-admin-indigency',
  'prog-admin-good-moral',
  'prog-admin-first-job',
  'prog-admin-business-permit',
  'prog-cert-solo-parent',
  'prog-cert-senior-citizen',
  'prog-cert-pwd',
  'prog-cert-student-grant'
]);

export function isCertificateProgram(programId: string, title?: string, category?: string): boolean {
  if (OFFICIAL_CERTIFICATE_IDS.has(programId)) return true;
  if (programId === 'prog-live-business-processing') return false;
  const combined = `${programId} ${title || ''} ${category || ''}`.toLowerCase();
  return (
    combined.includes('clearance') ||
    combined.includes('certificate') ||
    combined.includes('certification') ||
    combined.includes('permit')
  );
}

export interface ProgramQualificationEvaluation {
  isQualified: boolean;
  score: number;
  shortReason: string;
  passedCriteria: string[];
  failedCriteria: string[];
  summary: string;
}

export const ON_DEMAND_WALKIN_SERVICE_IDS = new Set([
  'prog-admin-community-concerns',
  'prog-admin-incident-mediation',
  'prog-emergency-dispute-mediation',
  'prog-emergency-disaster-prep',
  'prog-emergency-evacuation',
  'prog-emergency-safety-tanod',
  'prog-legal-doc-assistance',
  'prog-civil-death'
]);

export function isWalkInOrOnDemandService(programId: string): boolean {
  return ON_DEMAND_WALKIN_SERVICE_IDS.has((programId || '').toLowerCase());
}

const SPECIFIC_DISASTER_CATEGORIES = new Set([
  'flood',
  'fire',
  'landslide',
  'earthquake',
  'typhoon / storm',
  'other'
]);

export function isApplyOnlyProgram(program?: Partial<import('../types').AssistanceProgram> | null): boolean {
  if (!program) return false;
  return (
    program.applicationMode === 'apply' ||
    program.badgeText === 'Apply Program' ||
    (program.id || '').startsWith('prog-apply-')
  );
}

export function isDisasterProgram(program?: Partial<import('../types').AssistanceProgram> | null): boolean {
  if (!program) return false;
  const idLower = (program.id || '').toLowerCase();
  const titleLower = (program.title || '').toLowerCase();
  if (
    program.programType === 'disaster' ||
    program.badgeText === 'Disaster Program' ||
    idLower === 'prog-disaster-relief' ||
    titleLower === 'disaster relief assistance'
  ) {
    return true;
  }
  if (program.programType === 'regular' || program.programType === 'service') return false;
  const categoryLower = (program.category || '').trim().toLowerCase();
  return (
    program.autoEnrollVictims === true ||
    SPECIFIC_DISASTER_CATEGORIES.has(categoryLower) ||
    idLower === 'prog-emergency-disaster-prep' ||
    idLower === 'prog-emergency-evacuation' ||
    titleLower.includes('calamity') ||
    titleLower.includes('evacuation')
  );
}

export function doesVictimQualifyForDisasterProgram(
  victimDisasterType: string | undefined | null,
  program?: Partial<import('../types').AssistanceProgram> | null
): boolean {
  if (!program) return false;
  const victimLower = String(victimDisasterType || '').trim().toLowerCase();
  if (!victimLower) return false;
  const catLower = String(program.category || '').trim().toLowerCase();
  if (SPECIFIC_DISASTER_CATEGORIES.has(catLower)) {
    return victimLower === catLower;
  }
  return true;
}

const BARANGAY_SERVICE_IDS = new Set([
  'prog-barangay-clearance',
  'prog-admin-residency',
  'prog-admin-indigency',
  'prog-admin-good-moral',
  'prog-admin-first-job',
  'prog-admin-business-permit',
  'prog-cert-solo-parent',
  'prog-cert-senior-citizen',
  'prog-cert-pwd',
  'prog-cert-student-grant',
  'prog-civil-late-birth',
  'prog-civil-marriage',
  'prog-civil-death',
  'prog-live-business-processing'
]);

/**
 * Identifies Barangay Services (clearances, certificates, endorsements, civil registration)
 * that belong under Admin Barangay Services & Resident Certification.
 */
export function isBarangayServiceApplicationItem(
  program?: Partial<import('../types').AssistanceProgram> | null
): boolean {
  if (!program) return false;
  if (isDisasterProgram(program)) return false;
  if (isApplyOnlyProgram(program)) return false;
  if (program.programType === 'service' || program.badgeText === 'Barangay Service') return true;
  if (program.programType === 'regular') return false;
  if (BARANGAY_SERVICE_IDS.has(program.id || '')) return true;
  if (
    program.category === 'Barangay Administrative Services' ||
    program.category === 'Civil Registration Services' ||
    program.category === 'Clearance & Certification'
  ) {
    return true;
  }
  return isCertificateProgram(program.id || '', program.title, program.category);
}

const SECTOR_LABEL_MAP: Record<ProgramQualificationSector, string> = {
  unemployed: 'Unemployed / Jobseeker',
  senior: 'Senior Citizen (60+)',
  pwd: 'Person with Disability (PWD)',
  solo_parent: 'Solo Parent',
  student: 'Enrolled Student',
  medical_need: 'Declared Medical Need'
};

export function getDefaultQualificationRulesForProgram(
  program?: Partial<AssistanceProgram> | null
): ProgramQualificationRules {
  if (program?.qualificationRules) {
    return {
      maxMonthlyIncome: program.qualificationRules.maxMonthlyIncome ?? null,
      largeHouseholdMinMembers: program.qualificationRules.largeHouseholdMinMembers ?? null,
      largeHouseholdMaxIncome: program.qualificationRules.largeHouseholdMaxIncome ?? null,
      minAge: program.qualificationRules.minAge ?? null,
      maxAge: program.qualificationRules.maxAge ?? null,
      allowedEmploymentStatuses: Array.isArray(program.qualificationRules.allowedEmploymentStatuses)
        ? [...program.qualificationRules.allowedEmploymentStatuses]
        : [],
      eligibleSectors: Array.isArray(program.qualificationRules.eligibleSectors)
        ? [...program.qualificationRules.eligibleSectors]
        : [],
      sectorMatchMode: program.qualificationRules.sectorMatchMode || 'any_or_income',
      allowedZones: Array.isArray(program.qualificationRules.allowedZones)
        ? [...program.qualificationRules.allowedZones]
        : []
    };
  }

  const idLower = (program?.id || '').toLowerCase();
  const titleLower = (program?.title || '').toLowerCase();

  if (idLower === 'prog-financial-assistance' || titleLower === 'financial assistance') {
    return {
      maxMonthlyIncome: 15000,
      largeHouseholdMinMembers: 5,
      largeHouseholdMaxIncome: 20000,
      minAge: null,
      maxAge: null,
      allowedEmploymentStatuses: [],
      eligibleSectors: ['unemployed', 'senior', 'pwd', 'solo_parent'],
      sectorMatchMode: 'any_or_income',
      allowedZones: []
    };
  }

  if (idLower === 'prog-medical-assistance' || titleLower === 'medical assistance') {
    return {
      maxMonthlyIncome: 15000,
      largeHouseholdMinMembers: null,
      largeHouseholdMaxIncome: null,
      minAge: null,
      maxAge: null,
      allowedEmploymentStatuses: [],
      eligibleSectors: ['medical_need', 'senior', 'pwd', 'solo_parent'],
      sectorMatchMode: 'any_or_income',
      allowedZones: []
    };
  }

  if (
    idLower === 'prog-livelihood-program' ||
    titleLower === 'livelihood programs' ||
    titleLower === 'livelihood program'
  ) {
    return {
      maxMonthlyIncome: 20000,
      largeHouseholdMinMembers: 5,
      largeHouseholdMaxIncome: 25000,
      minAge: 18,
      maxAge: 65,
      allowedEmploymentStatuses: ['Unemployed', 'Self-Employed', 'Employed (Part-Time)'],
      eligibleSectors: [],
      sectorMatchMode: 'all_required',
      allowedZones: []
    };
  }

  // Infer sensible defaults from audience/criteria text for custom automatic programs
  const text = `${program?.targetAudience || ''} ${(program?.eligibilityCriteria || []).join(' ')}`.toLowerCase();
  const inferredSectors: ProgramQualificationSector[] = [];
  if (text.includes('senior') && !text.includes('non-senior')) inferredSectors.push('senior');
  if (/\bpwd\b|disabilit/.test(text)) inferredSectors.push('pwd');
  if (text.includes('solo parent') || text.includes('solo-parent')) inferredSectors.push('solo_parent');
  if (text.includes('student') || text.includes('scholar')) inferredSectors.push('student');
  if (text.includes('unemployed') || text.includes('jobseeker')) inferredSectors.push('unemployed');
  if (text.includes('medical need')) inferredSectors.push('medical_need');

  const incomeMatch = text.match(/(?:below|under|max(?:imum)?|up to|<=|≤)\s*(?:php|₱|p)?\s*([\d,]+)/i);
  const inferredIncome = incomeMatch
    ? Number(incomeMatch[1].replace(/,/g, '')) || 10000
    : (text.includes('indigent') || text.includes('low-income') || text.includes('low income'))
      ? 10000
      : null;

  const zoneMatches = Array.from(text.matchAll(/\b(?:zone|purok)\s*(\d+)\b/gi)).map(m => `Zone ${m[1]}`);

  return {
    maxMonthlyIncome: inferredIncome,
    largeHouseholdMinMembers: null,
    largeHouseholdMaxIncome: null,
    minAge: text.includes('senior') ? 60 : null,
    maxAge: null,
    allowedEmploymentStatuses: [],
    eligibleSectors: inferredSectors,
    sectorMatchMode: 'all_required',
    allowedZones: Array.from(new Set(zoneMatches))
  };
}

export function formatEligibilityCriteriaFromRules(rules: ProgramQualificationRules): string[] {
  const lines: string[] = [];
  if (Array.isArray(rules.allowedZones) && rules.allowedZones.length > 0) {
    lines.push(`Verified Barangay Bugo resident (${rules.allowedZones.join(', ')})`);
  } else {
    lines.push('Verified Barangay Bugo resident (Zone 1 to 10)');
  }

  if (typeof rules.minAge === 'number' && typeof rules.maxAge === 'number') {
    lines.push(`Aged ${rules.minAge} to ${rules.maxAge} years old`);
  } else if (typeof rules.minAge === 'number') {
    lines.push(`Aged ${rules.minAge}+ years old`);
  } else if (typeof rules.maxAge === 'number') {
    lines.push(`Aged ${rules.maxAge} years old and below`);
  }

  if (Array.isArray(rules.allowedEmploymentStatuses) && rules.allowedEmploymentStatuses.length > 0) {
    lines.push(`Employment status: ${rules.allowedEmploymentStatuses.join(', ')}`);
  }

  const sectorNames = (rules.eligibleSectors || []).map(s => SECTOR_LABEL_MAP[s]).filter(Boolean);
  const hasIncome = typeof rules.maxMonthlyIncome === 'number' && rules.maxMonthlyIncome >= 0;

  if (rules.sectorMatchMode === 'any_or_income') {
    const orParts: string[] = [];
    if (hasIncome) orParts.push(`Household income ≤ ₱${rules.maxMonthlyIncome!.toLocaleString()}`);
    if (rules.largeHouseholdMinMembers && rules.largeHouseholdMaxIncome) {
      orParts.push(`${rules.largeHouseholdMinMembers}+ household members ≤ ₱${rules.largeHouseholdMaxIncome.toLocaleString()}`);
    }
    if (sectorNames.length > 0) orParts.push(`priority sector (${sectorNames.join(', ')})`);
    if (orParts.length > 0) {
      lines.push(`Qualifies if: ${orParts.join(' OR ')}`);
    }
  } else {
    if (hasIncome) {
      const base = `Household income ≤ ₱${rules.maxMonthlyIncome!.toLocaleString()}`;
      if (rules.largeHouseholdMinMembers && rules.largeHouseholdMaxIncome) {
        lines.push(`${base} (or ≤ ₱${rules.largeHouseholdMaxIncome.toLocaleString()} for ${rules.largeHouseholdMinMembers}+ members)`);
      } else {
        lines.push(base);
      }
    }
    if (sectorNames.length > 0) {
      lines.push(`Target sector: ${sectorNames.join(' / ')}`);
    }
  }

  return lines;
}

function evaluateResidentAgainstQualificationRules(
  resident: Partial<import('../types').ResidentUser>,
  rules: ProgramQualificationRules,
  ctx: {
    income: number;
    age: number;
    occupation: string;
    employmentStatus: string;
    familyMembersCount: number;
    zoneShort: string;
  }
): { passed: string[]; failed: string[]; passSummary: string; failSummary: string } {
  const passed: string[] = [];
  const failed: string[] = [];
  const { income, age, occupation, employmentStatus, familyMembersCount, zoneShort } = ctx;

  // 1. Zone restriction check (if specified)
  const allowedZones = Array.isArray(rules.allowedZones) ? rules.allowedZones.filter(Boolean) : [];
  if (allowedZones.length > 0) {
    const residentZoneText = `${resident.purok || ''} ${resident.address || ''}`.toLowerCase();
    const matchedZone = allowedZones.find(z => {
      const numMatch = z.match(/\d+/);
      if (numMatch) {
        return new RegExp(`\\b(?:zone|purok)\\s*${numMatch[0]}\\b`, 'i').test(residentZoneText);
      }
      return residentZoneText.includes(z.toLowerCase());
    });
    if (matchedZone) {
      passed.push(`Zone Eligibility: Verified resident of ${matchedZone}`);
    } else {
      failed.push(`Zone Eligibility: Restricted to ${allowedZones.join(', ')}`);
    }
  }

  // 2. Age range check
  const minAge = typeof rules.minAge === 'number' && rules.minAge > 0 ? rules.minAge : null;
  const maxAge = typeof rules.maxAge === 'number' && rules.maxAge > 0 ? rules.maxAge : null;
  if (minAge !== null || maxAge !== null) {
    if (minAge !== null && minAge >= 60 && age === 0 && !resident.isSenior) {
      failed.push(`Age Requirement: Minimum age ${minAge} required`);
    } else if (age > 0 && ((minAge !== null && age < minAge) || (maxAge !== null && age > maxAge))) {
      const rangeLabel = minAge !== null && maxAge !== null
        ? `${minAge}–${maxAge}`
        : minAge !== null
          ? `${minAge}+`
          : `≤ ${maxAge}`;
      failed.push(`Age ${age} outside required range (${rangeLabel})`);
    } else if (age > 0) {
      passed.push(`Age ${age} within eligible range`);
    }
  }

  // 3. Employment status check (if specified)
  const allowedEmp = Array.isArray(rules.allowedEmploymentStatuses)
    ? rules.allowedEmploymentStatuses.filter(Boolean)
    : [];
  if (allowedEmp.length > 0) {
    const empLower = employmentStatus.trim().toLowerCase();
    const allowsSelfEmployed = allowedEmp.some(e => e.toLowerCase() === 'self-employed');
    const allowsUnemployed = allowedEmp.some(e => e.toLowerCase() === 'unemployed');
    const allowsFullTime = allowedEmp.some(e => e.toLowerCase().includes('full-time'));
    const allowsStudent = allowedEmp.some(e => e.toLowerCase() === 'student');
    const allowsRetired = allowedEmp.some(e => e.toLowerCase() === 'retired');

    const informalOcc =
      occupation.includes('vendor') ||
      occupation.includes('farm') ||
      occupation.includes('fish') ||
      occupation.includes('artisan') ||
      occupation.includes('store') ||
      occupation.includes('entrepreneur') ||
      occupation.includes('freelancer') ||
      occupation.includes('driver') ||
      occupation.includes('laborer') ||
      occupation.includes('homemaker') ||
      occupation.includes('self-employed');

    const isExplicitMatch = allowedEmp.some(a => a.toLowerCase() === empLower);
    const isInferredSelfMatch =
      allowsSelfEmployed &&
      (occupation.includes('vendor') || occupation.includes('farm') || (!empLower && informalOcc));
    const isInferredUnemployed =
      allowsUnemployed && (occupation.includes('unemployed') || occupation.includes('jobseeker'));
    const isExcludedExplicit =
      (empLower === 'retired' && !allowsRetired) ||
      (empLower.includes('full-time') && !allowsFullTime && !isInferredSelfMatch) ||
      (empLower === 'student' && !allowsStudent && !isInferredSelfMatch);

    if (isExcludedExplicit || (!isExplicitMatch && !isInferredSelfMatch && !isInferredUnemployed)) {
      const statusLabel = employmentStatus || resident.occupation || 'Unspecified';
      failed.push(`${statusLabel} status not in allowed employment groups (${allowedEmp.join(', ')})`);
    } else {
      passed.push(`Employment matched: ${employmentStatus || resident.occupation || allowedEmp[0]}`);
    }
  }

  // 4. Sector checks & Income checks
  const sectors = Array.isArray(rules.eligibleSectors) ? rules.eligibleSectors : [];
  const sectorMatches: Array<{ key: ProgramQualificationSector; label: string }> = [];
  if (sectors.includes('unemployed') && (employmentStatus === 'Unemployed' || occupation.includes('unemployed') || occupation.includes('jobseeker'))) {
    sectorMatches.push({ key: 'unemployed', label: 'Unemployed' });
  }
  if (sectors.includes('senior') && (Boolean(resident.isSenior) || age >= 60)) {
    sectorMatches.push({ key: 'senior', label: 'Senior Citizen' });
  }
  if (sectors.includes('pwd') && (Boolean(resident.isPwd) || Boolean(resident.pwdIdNumber))) {
    sectorMatches.push({ key: 'pwd', label: 'PWD' });
  }
  if (sectors.includes('solo_parent') && (Boolean(resident.isSoloParent) || Boolean(resident.soloParentIdNumber))) {
    sectorMatches.push({ key: 'solo_parent', label: 'Solo Parent' });
  }
  if (sectors.includes('student') && (Boolean(resident.isStudent) || employmentStatus === 'Student' || occupation.includes('student'))) {
    sectorMatches.push({ key: 'student', label: 'Student' });
  }
  if (sectors.includes('medical_need') && Boolean(resident.hasMedicalNeed)) {
    sectorMatches.push({ key: 'medical_need', label: 'Medical need declared' });
  }

  const hasIncomeLimit = typeof rules.maxMonthlyIncome === 'number' && rules.maxMonthlyIncome >= 0;
  const maxIncome = hasIncomeLimit ? rules.maxMonthlyIncome! : Infinity;
  const withinIncomeLimit = !hasIncomeLimit || income <= maxIncome;

  const largeMin = typeof rules.largeHouseholdMinMembers === 'number' && rules.largeHouseholdMinMembers > 0 ? rules.largeHouseholdMinMembers : 0;
  const largeCap = typeof rules.largeHouseholdMaxIncome === 'number' && rules.largeHouseholdMaxIncome > 0 ? rules.largeHouseholdMaxIncome : 0;
  const withinLargeHousehold = Boolean(largeMin > 0 && largeCap > 0 && familyMembersCount >= largeMin && income <= largeCap);

  let passSummary = '';
  let failSummary = '';

  if (rules.sectorMatchMode === 'any_or_income') {
    if (hasIncomeLimit && withinIncomeLimit) {
      passed.push(`Income ₱${income.toLocaleString()} ≤ ₱${maxIncome.toLocaleString()} limit`);
      passSummary = `Income ₱${income.toLocaleString()} ≤ ₱${maxIncome.toLocaleString()} · ${zoneShort}`;
    } else if (sectorMatches.length > 0) {
      const topSector = sectorMatches[0];
      passed.push(`${topSector.label} priority household`);
      passSummary = `${topSector.label} priority · ${zoneShort}`;
    } else if (withinLargeHousehold) {
      passed.push(`Large household (${familyMembersCount} members) ≤ ₱${largeCap.toLocaleString()}`);
      passSummary = `${familyMembersCount}-member household ≤ ₱${largeCap.toLocaleString()}`;
    } else if (!hasIncomeLimit && sectors.length === 0) {
      passed.push(`Verified ${zoneShort} resident`);
      passSummary = `Verified ${zoneShort} resident`;
    } else if (hasIncomeLimit) {
      const sectorNote = sectors.length > 0 ? ' (or matching priority sector)' : '';
      failed.push(`Income ₱${income.toLocaleString()} exceeds ₱${maxIncome.toLocaleString()} limit${sectorNote}`);
      failSummary = `Income ₱${income.toLocaleString()} > ₱${maxIncome.toLocaleString()} limit`;
    } else {
      const needed = sectors.map(s => SECTOR_LABEL_MAP[s]).join(' / ');
      failed.push(`Requires eligible sector: ${needed}`);
      failSummary = `Requires ${needed}`;
    }
  } else {
    // 'all_required' mode: must meet income limit (if set) AND at least one selected sector (if sectors chosen)
    if (hasIncomeLimit) {
      if (withinIncomeLimit) {
        passed.push(`Income ₱${income.toLocaleString()} ≤ ₱${maxIncome.toLocaleString()}`);
      } else if (withinLargeHousehold) {
        passed.push(`Large household (${familyMembersCount} members) ≤ ₱${largeCap.toLocaleString()}`);
      } else {
        failed.push(`Income ₱${income.toLocaleString()} exceeds ₱${maxIncome.toLocaleString()} limit`);
        failSummary = `Income ₱${income.toLocaleString()} > ₱${maxIncome.toLocaleString()} limit`;
      }
    }
    if (sectors.length > 0) {
      if (sectorMatches.length > 0) {
        passed.push(`Sector matched: ${sectorMatches.map(s => s.label).join(', ')}`);
      } else {
        const needed = sectors.map(s => SECTOR_LABEL_MAP[s]).join(' / ');
        failed.push(`Sector requirement: Must be ${needed}`);
        if (!failSummary) failSummary = `Requires ${needed}`;
      }
    }
    if (failed.length === 0) {
      const parts: string[] = [];
      if (sectorMatches.length > 0) parts.push(sectorMatches[0].label);
      else if (employmentStatus) parts.push(employmentStatus);
      if (hasIncomeLimit) parts.push(`Income ₱${income.toLocaleString()}`);
      else parts.push(zoneShort);
      passSummary = parts.join(' · ');
    }
  }

  if (failed.length > 0 && !failSummary) {
    failSummary = failed[0];
  }

  return { passed, failed, passSummary, failSummary };
}

/**
 * Evaluates whether a resident's registered account and verified household profile
 * truly satisfies the qualification criteria for an LGU Assistance Program.
 */
export function evaluateResidentForProgram(
  resident: Partial<import('../types').ResidentUser> | null | undefined,
  programId: string,
  programTitle?: string,
  programMeta?: Partial<import('../types').AssistanceProgram>,
  extraContext?: {
    disasterVictims?: Array<{
      residentId?: string;
      fullName?: string;
      disasterType?: string;
      enrolledProgramIds?: string[];
      selectionStatus?: 'Waitlisted' | 'Selected' | 'Distributed';
    }>;
  }
): ProgramQualificationEvaluation {
  if (!resident) {
    return {
      isQualified: false,
      score: 0,
      shortReason: 'Account required',
      passedCriteria: [],
      failedCriteria: ['No resident account found'],
      summary: 'Not Qualified · Account required'
    };
  }

  const passedCriteria: string[] = [];
  const failedCriteria: string[] = [];
  const income = parseMonthlyIncome(resident.householdIncome || '');
  const age = resident.age || 0;
  const gender = (resident.gender || '').toLowerCase();
  const civilStatus = resident.civilStatus || 'Single';
  const occupation = (resident.occupation || '').toLowerCase();
  const employmentStatus = resident.employmentStatus || '';
  const familyMembersCount = resident.familyMembersCount || 1;
  const zoneShort = (resident.purok || 'Bugo').split(' - ')[0];
  const idLower = (programId || '').toLowerCase();
  const titleLower = (programTitle || '').toLowerCase();
  const idCombined = `${idLower} ${titleLower}`;

  const isGenericDisasterRelief =
    idLower === 'prog-disaster-relief' || titleLower === 'disaster relief assistance';
  const isSpecificDisasterProgram = isDisasterProgram({ id: programId, title: programTitle, ...programMeta });
  const isDisasterReliefProgram = isGenericDisasterRelief || isSpecificDisasterProgram;

  // Baseline Verification Rule
  const hasAnalysisMismatch = (a?: typeof resident.idPhotoAnalysis) => Boolean(
    a && (
      a.matchesExpectedType === false ||
      a.matchesExpectedName === false ||
      a.matchesExpectedBirthdate === false ||
      a.matchesExpectedIdNumber === false ||
      a.matchesExpectedGender === false ||
      a.matchesExpectedCivilStatus === false ||
      a.matchesExpectedSide === false
    )
  );
  const frontRejected = resident.idPhotoAnalysis?.isId === false;
  const backRejected = resident.backIdPhotoAnalysis?.isId === false;
  const frontUnclear = resident.idPhotoAnalysis?.isClear === false;
  const backUnclear = resident.backIdPhotoAnalysis?.isClear === false;
  const idDetailsMismatch = hasAnalysisMismatch(resident.idPhotoAnalysis) || hasAnalysisMismatch(resident.backIdPhotoAnalysis);
  const hasScannedId =
    Boolean(resident.frontIdUrl) &&
    Boolean(resident.backIdUrl) &&
    !frontRejected &&
    !backRejected &&
    !frontUnclear &&
    !backUnclear &&
    !idDetailsMismatch;

  const hasValidBugoZone = Boolean(resident.purok && resident.purok.toLowerCase().includes('zone'));
  if (!hasValidBugoZone) {
    failedCriteria.push('Residency: Must reside in Bugo Zone 1–10');
  }

  if (resident.isBanned) {
    failedCriteria.push(`Account restricted: ${resident.banReason || 'Administrative hold'}`);
  } else if (resident.registrationStatus === 'Rejected') {
    failedCriteria.push('Registration declined by Barangay admin');
  } else if (frontRejected || backRejected) {
    failedCriteria.push('Front or Back photo is not a valid ID');
  } else if (idDetailsMismatch) {
    failedCriteria.push('Attached ID does not match selected ID Type or filled personal details');
  } else if (frontUnclear || backUnclear) {
    failedCriteria.push('ID photo not clear — upload a clearer ID');
  } else if (!isDisasterReliefProgram && !resident.isVerified && resident.registrationStatus === 'Pending Approval' && !hasScannedId) {
    failedCriteria.push('Clear Front & Back ID photos required');
  } else if (!isDisasterReliefProgram && (hasScannedId || resident.isVerified)) {
    passedCriteria.push(`Verified ${zoneShort} resident`);
  }

  let customPassReason = '';
  let customFailReason = '';

  const resolvedRules = programMeta?.qualificationRules
    ? programMeta.qualificationRules
    : (
        idLower === 'prog-financial-assistance' ||
        titleLower === 'financial assistance' ||
        idLower === 'prog-medical-assistance' ||
        titleLower === 'medical assistance' ||
        idLower === 'prog-livelihood-program' ||
        titleLower === 'livelihood programs' ||
        titleLower === 'livelihood program'
      )
      ? getDefaultQualificationRulesForProgram({ id: programId, title: programTitle, ...programMeta })
      : null;

  // 0. Core / Admin-Editable Create-Account Assistance Programs
  if (!isDisasterReliefProgram && !isApplyOnlyProgram({ id: programId, applicationMode: programMeta?.applicationMode, badgeText: programMeta?.badgeText }) && resolvedRules) {
    const evalRuleOutcome = evaluateResidentAgainstQualificationRules(
      resident,
      resolvedRules,
      { income, age, occupation, employmentStatus, familyMembersCount, zoneShort }
    );
    evalRuleOutcome.passed.forEach(p => passedCriteria.push(p));
    evalRuleOutcome.failed.forEach(f => failedCriteria.push(f));
    customPassReason = evalRuleOutcome.passSummary;
    customFailReason = evalRuleOutcome.failSummary;
  } else if (isDisasterReliefProgram) {
    const disasterMeta = { id: programId, title: programTitle, ...programMeta };
    const enrolledVictim = (extraContext?.disasterVictims || []).find(v => {
      const sameResident =
        (Boolean(v.residentId) && Boolean(resident.id) && v.residentId === resident.id) ||
        (Boolean(v.fullName) &&
          Boolean(resident.name) &&
          v.fullName.trim().toLowerCase() === resident.name.trim().toLowerCase());
      if (!sameResident) return false;
      const enrolledUnderProgram =
        Array.isArray(v.enrolledProgramIds) && v.enrolledProgramIds.includes(programId);
      if (!enrolledUnderProgram) return false;
      return isGenericDisasterRelief || doesVictimQualifyForDisasterProgram(v.disasterType, disasterMeta);
    });

    const isAdminQualified = Boolean(
      enrolledVictim &&
      (enrolledVictim.selectionStatus === 'Selected' || enrolledVictim.selectionStatus === 'Distributed')
    );

    if (!enrolledVictim) {
      failedCriteria.push('Only Barangay Admin decides who is qualified for Disaster Programs');
      customFailReason = 'Admin selection required';
    } else if (!isAdminQualified) {
      failedCriteria.push('Waitlisted — pending Barangay Admin qualification under this disaster program');
      customFailReason = 'Pending Admin qualification';
    } else {
      const disType = enrolledVictim.disasterType || programMeta?.category || 'Disaster';
      passedCriteria.push(`Marked Qualified (${enrolledVictim.selectionStatus}) by Barangay Admin under ${disType} disaster program`);
      customPassReason = `${disType} beneficiary · Qualified by Admin`;
    }
  }

  // 1. Apply-Based Assistance Programs (Evaluated for verified Bugo residency + ID, resident applies with documents)
  else if (isApplyOnlyProgram({ id: programId, applicationMode: programMeta?.applicationMode })) {
    if (failedCriteria.length === 0) {
      passedCriteria.push('Verified Bugo resident · Apply with listed requirements');
      customPassReason = `Verified ${zoneShort} resident · Submit requirements to apply`;
    }
  }

  // 2. Fallback for custom/general automatic programs (evaluates all specified eligibility rules)
  else {
    const audienceText = `${programMeta?.targetAudience || ''} ${(programMeta?.eligibilityCriteria || []).join(' ')} ${programTitle || ''}`.toLowerCase();
    let matchedTargetedRule = false;

    if (audienceText.includes('senior') && !audienceText.includes('non-senior')) {
      matchedTargetedRule = true;
      if (resident.isSenior || age >= 60) {
        passedCriteria.push(`Senior Citizen Status: Qualified (${age > 0 ? `${age} yrs old` : '60+ senior'})`);
      } else {
        failedCriteria.push('Age Requirement: Program is for Senior Citizens (60+)');
      }
    }

    if (audienceText.includes('pwd') || audienceText.includes('disabilit')) {
      matchedTargetedRule = true;
      if (resident.isPwd || Boolean(resident.pwdIdNumber)) {
        passedCriteria.push('PWD Registry: Verified Person with Disability status');
      } else {
        failedCriteria.push('PWD Registry: Program is for registered Persons with Disability');
      }
    }

    if (audienceText.includes('solo parent') || audienceText.includes('solo-parent')) {
      matchedTargetedRule = true;
      if (resident.isSoloParent || Boolean(resident.soloParentIdNumber)) {
        passedCriteria.push('Solo Parent Registry: Verified Solo Parent status');
      } else {
        failedCriteria.push('Solo Parent Registry: Program is for registered Solo Parents');
      }
    }

    if (audienceText.includes('student') || audienceText.includes('scholar')) {
      matchedTargetedRule = true;
      const isStudent = Boolean(resident.isStudent) || employmentStatus === 'Student' || occupation.includes('student');
      if (isStudent) {
        passedCriteria.push('Academic Profile: Verified enrolled student');
      } else {
        failedCriteria.push('Academic Profile: Program is for enrolled students');
      }
    }

    if (audienceText.includes('minor') || (audienceText.includes('youth') && !audienceText.includes('senior'))) {
      matchedTargetedRule = true;
      const isMinorTarget = audienceText.includes('minor');
      if (isMinorTarget) {
        if (age > 0 && age < 18) {
          passedCriteria.push(`Age Profile: Qualified minor (${age} yrs old)`);
        } else {
          failedCriteria.push('Age Profile: Program is restricted to minors (under 18)');
        }
      } else {
        if ((age >= 15 && age <= 30) || (age === 0 && Boolean(resident.isStudent))) {
          passedCriteria.push(`Youth Profile: Qualified (${age > 0 ? `${age} yrs old` : 'student/youth'})`);
        } else {
          failedCriteria.push('Age Profile: Program is for youth residents (15–30 yrs old)');
        }
      }
    }

    if (audienceText.includes('unemployed') || audienceText.includes('jobseeker') || audienceText.includes('job seeker')) {
      matchedTargetedRule = true;
      const isJobseeker = employmentStatus === 'Unemployed' || occupation.includes('unemployed') || occupation.includes('job');
      if (isJobseeker) {
        passedCriteria.push('Employment Profile: Registered unemployed / jobseeker');
      } else {
        failedCriteria.push('Employment Profile: Program is for unemployed or jobseeking residents');
      }
    }

    const incomeMatch = audienceText.match(/(?:below|under|max(?:imum)?|up to|<=|≤)\s*(?:php|₱|p)?\s*([\d,]+)/i);
    const requiresIndigent =
      audienceText.includes('indigent') ||
      audienceText.includes('low-income') ||
      audienceText.includes('low income') ||
      Boolean(incomeMatch);

    if (requiresIndigent) {
      matchedTargetedRule = true;
      const maxAllowed = incomeMatch ? Number(incomeMatch[1].replace(/,/g, '')) || 10000 : 10000;
      if (income <= maxAllowed) {
        passedCriteria.push(`Indigent Priority: Household income (₱${income.toLocaleString()}) qualifies (≤ ₱${maxAllowed.toLocaleString()})`);
      } else {
        failedCriteria.push(`Income Criteria: Monthly household income exceeds ₱${maxAllowed.toLocaleString()}`);
      }
    }

    const zoneMatches = Array.from(audienceText.matchAll(/\b(?:zone|purok)\s*(\d+)\b/gi)).map(m => m[1]);
    if (zoneMatches.length > 0) {
      matchedTargetedRule = true;
      const residentZoneText = `${resident.purok || ''} ${resident.address || ''}`.toLowerCase();
      const matchedZone = zoneMatches.find(z => new RegExp(`\\b(?:zone|purok)\\s*${z}\\b`, 'i').test(residentZoneText));
      if (matchedZone) {
        passedCriteria.push(`Zone Eligibility: Verified resident of Zone ${matchedZone}`);
      } else {
        failedCriteria.push(`Zone Eligibility: Program is restricted to Zone ${zoneMatches.join(' / ')}`);
      }
    }

    const genderLower = (resident.gender || '').toLowerCase();
    const isFemaleOnly =
      (audienceText.includes('women only') || audienceText.includes('female only') || audienceText.includes('mothers')) &&
      !audienceText.includes('men and women');
    const isMaleOnly =
      (audienceText.includes('men only') || audienceText.includes('male only') || audienceText.includes('fathers')) &&
      !audienceText.includes('women');

    if (isFemaleOnly) {
      matchedTargetedRule = true;
      if (genderLower === 'female') {
        passedCriteria.push('Demographic Match: Female / Women sector verified');
      } else {
        failedCriteria.push('Demographic Match: Program is for women / female beneficiaries');
      }
    } else if (isMaleOnly) {
      matchedTargetedRule = true;
      if (genderLower === 'male') {
        passedCriteria.push('Demographic Match: Male / Fathers sector verified');
      } else {
        failedCriteria.push('Demographic Match: Program is for male beneficiaries');
      }
    }

    if (!matchedTargetedRule) {
      const isBugoResident =
        !resident.purok ||
        resident.purok.toLowerCase().includes('zone') ||
        resident.purok.toLowerCase().includes('bugo') ||
        (resident.address || '').toLowerCase().includes('bugo');

      if (isBugoResident) {
        passedCriteria.push(`Barangay Program Match: Eligible under ${programMeta?.targetAudience || 'Barangay Bugo Resident'} criteria`);
      } else {
        failedCriteria.push('Residency Criteria: Verified Barangay Bugo address required');
      }
    }
  }

  const isQualified = failedCriteria.length === 0;
  const total = passedCriteria.length + failedCriteria.length;
  const score = total > 0 ? Math.round((passedCriteria.length / total) * 100) : 0;

  let shortReason = isQualified ? customPassReason : customFailReason;
  if (!shortReason) {
    if (!isQualified) {
      const fail = failedCriteria[0] || 'Criteria unmet';
      shortReason = fail.includes(':') ? fail.split(':').slice(1).join(':').trim() : fail;
    } else {
      const pass = passedCriteria[passedCriteria.length - 1] || passedCriteria[0] || 'Account matched';
      shortReason = pass.includes(':') ? pass.split(':').slice(1).join(':').trim() : pass;
    }
  }

  const summary = isQualified
    ? `Qualified · ${shortReason}`
    : `Not Qualified · ${shortReason}`;

  return {
    isQualified,
    score,
    shortReason,
    passedCriteria,
    failedCriteria,
    summary
  };
}

/**
 * Returns automatic Create-Account assistance programs that a resident qualifies for
 */
export function getQualifiedProgramsForResident(
  resident: Partial<import('../types').ResidentUser> | null | undefined,
  allPrograms: import('../types').AssistanceProgram[],
  extraContext?: {
    disasterVictims?: Array<{
      residentId?: string;
      fullName?: string;
      disasterType?: string;
      enrolledProgramIds?: string[];
      selectionStatus?: 'Waitlisted' | 'Selected' | 'Distributed';
    }>;
  }
): import('../types').AssistanceProgram[] {
  if (!resident) return [];
  return allPrograms.filter(prog => {
    // Exclude closed programs, Barangay Services/Certificates, Apply-only programs, and Disaster Programs (Admin-decided only)
    if (prog.status === 'Closed') return false;
    if (isApplyOnlyProgram(prog)) return false;
    if (isBarangayServiceApplicationItem(prog)) return false;
    if (isDisasterProgram(prog)) return false;
    const evalResult = evaluateResidentForProgram(resident, prog.id, prog.title, prog, extraContext);
    return evalResult.isQualified;
  });
}

/**
 * Determines whether a resident can view an announcement.
 * Targeted announcements for specific programs are ONLY visible to qualified beneficiaries!
 */
export function canResidentViewAnnouncement(
  resident: Partial<import('../types').ResidentUser> | null | undefined,
  announcement: import('../types').AnnouncementItem,
  allPrograms?: import('../types').AssistanceProgram[],
  extraContext?: {
    disasterVictims?: Array<{
      residentId?: string;
      fullName?: string;
      disasterType?: string;
      enrolledProgramIds?: string[];
      selectionStatus?: 'Waitlisted' | 'Selected' | 'Distributed';
    }>;
    applications?: import('../types').AssistanceApplication[];
  }
): boolean {
  // Public announcements are visible to everyone
  if (!announcement.targetAudienceType || announcement.targetAudienceType === 'All') {
    return true;
  }

  // If targeted to qualified beneficiaries:
  if (announcement.targetAudienceType === 'Qualified Beneficiaries Only') {
    if (!resident) return false;
    if (!announcement.targetProgramId) return true;
    const matchedProgram = Array.isArray(allPrograms)
      ? allPrograms.find(p => p.id === announcement.targetProgramId)
      : undefined;
    const evalResult = evaluateResidentForProgram(
      resident,
      announcement.targetProgramId,
      matchedProgram?.title || announcement.targetProgramTitle,
      matchedProgram,
      extraContext
    );
    if (evalResult.isQualified) return true;

    const isDisasterTarget = isDisasterProgram(
      matchedProgram || {
        id: announcement.targetProgramId,
        title: announcement.targetProgramTitle
      }
    );
    if (isDisasterTarget && Array.isArray(extraContext?.applications)) {
      return extraContext.applications.some(app => {
        const sameProgram =
          app.programId === announcement.targetProgramId ||
          (Boolean(announcement.targetProgramTitle) && app.programTitle === announcement.targetProgramTitle);
        if (!sameProgram) return false;
        const sameResident =
          (Boolean(app.applicantId) && Boolean(resident.id) && app.applicantId === resident.id) ||
          (Boolean(app.email) && Boolean(resident.email) && app.email.trim().toLowerCase() === resident.email.trim().toLowerCase());
        if (!sameResident) return false;
        return app.status === 'Valid' || app.status === 'Approved' || app.status === 'Ready for Release' || app.status === 'Disbursed';
      });
    }
    return false;
  }

  return true;
}

export function findExistingProgramApplication<
  T extends {
    id?: string;
    referenceCode?: string;
    applicantId?: string;
    email?: string;
    programId?: string;
    programTitle?: string;
    status?: string;
    submissionDate?: string;
  }
>(
  applications: T[] | undefined | null,
  applicant: { id?: string | null; email?: string | null } | null | undefined,
  program: { id?: string | null; title?: string | null } | null | undefined
): T | null {
  if (!Array.isArray(applications) || !program) return null;
  const targetProgId = String(program.id || '').trim();
  const targetProgTitle = String(program.title || '').trim().toLowerCase();
  const targetUserId = String(applicant?.id || '').trim();
  const targetEmail = String(applicant?.email || '').trim().toLowerCase();

  if (!targetProgId && !targetProgTitle) return null;
  if (!targetUserId && !targetEmail) return null;

  return (
    applications.find((app) => {
      if (!app) return false;
      const appUserId = String(app.applicantId || '').trim();
      const appEmail = String(app.email || '').trim().toLowerCase();
      const sameUser =
        (Boolean(targetUserId) && Boolean(appUserId) && appUserId === targetUserId) ||
        (Boolean(targetEmail) && Boolean(appEmail) && appEmail === targetEmail);
      if (!sameUser) return false;

      const appProgId = String(app.programId || '').trim();
      const appProgTitle = String(app.programTitle || '').trim().toLowerCase();
      const sameProgram =
        (Boolean(targetProgId) && Boolean(appProgId) && appProgId === targetProgId) ||
        (Boolean(targetProgTitle) && Boolean(appProgTitle) && appProgTitle === targetProgTitle);
      return sameProgram;
    }) || null
  );
}


