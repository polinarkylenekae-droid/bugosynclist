import { AssistanceProgram } from '../types';

export const ALL_BARANGAY_SERVICES: AssistanceProgram[] = [
  // ==========================================
  // 1. BARANGAY ADMINISTRATIVE SERVICES
  // ==========================================
  {
    id: 'prog-barangay-clearance',
    title: 'Issuance of Barangay Clearance',
    category: 'Barangay Administrative Services',
    tagline: 'Official certification certifying residency, good character, and clean barangay record.',
    description: 'Universal administrative document required for employment, passport application, bank account opening, postal ID, and government transactions in Cagayan de Oro City.',
    imageUrl: '/assets/services/brgy_clearance_cert_1794197711166.jpg',
    status: 'Active',
    badgeText: 'Instant Pipeline',
    deadline: 'Year-Round Service',
    targetAudience: 'All Registered Bugo Residents',
    processingTime: 'Same Day (1-2 Hours)',
    requirements: [
      'Valid Government ID or Student ID',
      'Community Tax Certificate (Cedula)',
      'Proof of Residency (Zone 1 to 10 of Bugo)'
    ],
    eligibilityCriteria: [
      'Bona fide resident of Barangay Bugo for at least 6 months',
      'Verified Barangay Bugo resident in good community standing'
    ],
    maxBenefitAmount: 'Standard Fee: ₱50.00 (Waived for Indigents)'
  },
  {
    id: 'prog-admin-residency',
    title: 'Certificate of Residency',
    category: 'Barangay Administrative Services',
    tagline: 'Formal proof of physical residence within the territorial jurisdiction of Barangay Bugo.',
    description: 'Official certification verifying that the individual currently resides in a specific Purok/Zone of Bugo. Commonly needed for court filings, electric/water utility meter applications, and school enrollments.',
    imageUrl: '/assets/services/brgy_clearance_cert_1794197711166.jpg',
    status: 'Active',
    badgeText: 'Express Release',
    deadline: 'Ongoing Availability',
    targetAudience: 'Homeowners, Renters, and Bugo Dwellers',
    processingTime: '1 - 2 Business Hours',
    requirements: [
      'Valid Government ID with Bugo address',
      'Purok Leader Endorsement / Sitio Clearance',
      'Proof of Billing or House Rental Contract'
    ],
    eligibilityCriteria: [
      'Currently living in Barangay Bugo',
      'Minimum residence duration of 3 months'
    ],
    maxBenefitAmount: 'Standard Certification'
  },
  {
    id: 'prog-admin-indigency',
    title: 'Certificate of Indigency',
    category: 'Barangay Administrative Services',
    tagline: 'Affidavit of indigent economic status for legal aid, medical fee waivers, and government relief.',
    description: 'Free official certification confirming that the family belongs to the low-income bracket. Used to request medical subsidy at Northern Mindanao Medical Center (NMMC), JR Borja General Hospital, PAO legal services, and DSWD assistance.',
    imageUrl: '/assets/services/brgy_senior_pension_1794197712463.jpg',
    status: 'Active',
    badgeText: '100% Free',
    deadline: 'Year-Round Service',
    targetAudience: 'Low-income and indigent families',
    processingTime: 'Within 24 Hours',
    requirements: [
      'Valid Resident ID or Voter Certification',
      'Endorsement from Purok / Zone Chairman',
      'Affidavit of Low Income or Certificate of Non-Filing of ITR'
    ],
    eligibilityCriteria: [
      'Household monthly income at or below statutory poverty threshold',
      'Resident of Barangay Bugo'
    ],
    maxBenefitAmount: 'Fee Exemption Granted'
  },
  {
    id: 'prog-admin-good-moral',
    title: 'Certificate of Good Moral Character',
    category: 'Barangay Administrative Services',
    tagline: 'Attestation of good civic behavior, community standing, and law-abiding citizenship.',
    description: 'Documentary proof required by universities, scholarship foundations, security agencies, and prospective employers confirming the applicant possesses exemplary community conduct.',
    imageUrl: '/assets/services/brgy_clearance_cert_1794197711166.jpg',
    status: 'Active',
    badgeText: 'Verified Conduct',
    deadline: 'Continuous',
    targetAudience: 'Students, Job Applicants, and Professionals',
    processingTime: '1 - 2 Business Days',
    requirements: [
      'Valid Government ID',
      'Barangay Clearance copy',
      '2 Character Reference sign-offs from neighbors or Purok Officer'
    ],
    eligibilityCriteria: [
      'Clean barangay record with no administrative sanctions or peace violations',
      'Verified resident of Barangay Bugo'
    ],
    maxBenefitAmount: 'Official Endorsement'
  },
  {
    id: 'prog-admin-first-job',
    title: 'First-Time Job Seeker Certification',
    category: 'Barangay Administrative Services',
    tagline: 'Republic Act 11261 waiver granting 100% free government clearances and certificates for new graduates.',
    description: 'Under the First-Time Jobseekers Assistance Act, this certification waives fees for NBI Clearance, Police Clearance, Barangay Clearance, Medical Certificates, and Birth Certificates when seeking first-time employment.',
    imageUrl: '/assets/services/brgy_job_student_1795014568227.jpg',
    status: 'Active',
    badgeText: 'RA 11261 Mandated',
    deadline: 'Valid for 1 Year from Issuance',
    targetAudience: 'Recent Graduates & First-Time Job Seekers',
    processingTime: 'Same Day Issuance',
    requirements: [
      'School Diploma, Transcript, or Certificate of Graduation',
      'Barangay Resident ID or Proof of Bugo Address',
      'Signed Oath of Undertaking for First-Time Job Seekers'
    ],
    eligibilityCriteria: [
      'First-time entrant to the formal job market',
      'Resident of Barangay Bugo'
    ],
    maxBenefitAmount: 'Full Fee Exemption'
  },
  {
    id: 'prog-admin-business-permit',
    title: 'Business Permit Endorsement',
    category: 'Barangay Administrative Services',
    tagline: 'Barangay commercial clearance endorsement required for City Hall Mayor’s Business Permit.',
    description: 'Administrative assessment and environmental clearance inspection for sari-sari stores, retail enterprises, food stalls, and commercial establishments operating within Bugo.',
    imageUrl: '/assets/services/brgy_business_permit_1795014566314.jpg',
    status: 'Active',
    badgeText: 'Commercial Clearance',
    deadline: 'Annual Renewal & New Registrations',
    targetAudience: 'Micro, Small, & Medium Enterprise Owners',
    processingTime: '2 - 3 Business Days',
    requirements: [
      'DTI Business Name Registration or SEC Certificate',
      'Lease Contract or Proof of Property Ownership',
      'Fire Safety Inspection and Sanitation Endorsement'
    ],
    eligibilityCriteria: [
      'Business establishment located within Barangay Bugo',
      'Compliance with local zoning and environmental waste disposal ordinances'
    ],
    maxBenefitAmount: 'Official Regulatory Clearance'
  },
  {
    id: 'prog-cert-solo-parent',
    title: 'Solo Parent Barangay Certification (RA 11861)',
    category: 'Barangay Administrative Services',
    tagline: 'Official certification certifying Solo Parent status under the Expanded Solo Parents Welfare Act.',
    description: 'Mandatory certificate needed to claim the ₱1,000 monthly city cash subsidy, 7-day parental leave, education scholarship priorities, and government relief for solo mothers and fathers.',
    imageUrl: '/assets/services/brgy_solo_parent_1795014567048.jpg',
    status: 'Active',
    badgeText: 'RA 11861 Welfare',
    deadline: 'Year-Round Intake',
    targetAudience: 'Solo / Single Parents Parenting Dependents in Bugo',
    processingTime: 'Same Day Issuance',
    requirements: [
      'Affidavit of Solo Parenting (detailing abandonment, separation, or widowhood)',
      'Birth Certificate of dependent children (unmarried & below 22)',
      'Valid Government ID or Barangay Resident ID'
    ],
    eligibilityCriteria: [
      'Sole financial and physical custody of minor or dependent children',
      'Registered resident of Barangay Bugo',
      'Household income not exceeding statutory threshold'
    ],
    maxBenefitAmount: 'Official RA 11861 Certification'
  },
  {
    id: 'prog-cert-senior-citizen',
    title: 'Senior Citizen Barangay Endorsement & Certification',
    category: 'Barangay Administrative Services',
    tagline: 'Formal endorsement and certification of elderly status for OSCA ID and social pension benefits.',
    description: 'Barangay certification attesting that the resident is aged 60 and above, residing within Bugo. Used for OSCA Booklet issuance, PhilHealth senior lifetime membership, and local birthday cash gifts.',
    imageUrl: '/assets/services/brgy_senior_pension_1794197712463.jpg',
    status: 'Active',
    badgeText: 'Senior Citizen OSCA',
    deadline: 'Continuous Registration',
    targetAudience: 'Senior Citizens (Aged 60+)',
    processingTime: 'Same Day Issuance',
    requirements: [
      'PSA Birth Certificate or Proof of Age (60 years old and above)',
      'Barangay Resident ID Card or Voter Certification',
      '2 copies 2x2 recent ID photos'
    ],
    eligibilityCriteria: [
      'Filipino citizen residing in Barangay Bugo',
      'Must be 60 years of age or older'
    ],
    maxBenefitAmount: 'Official OSCA Endorsement'
  },
  {
    id: 'prog-cert-pwd',
    title: 'PWD Barangay Endorsement & Certification (RA 10754)',
    category: 'Barangay Administrative Services',
    tagline: 'Official certification endorsing Persons with Disabilities for National PWD ID and discounts.',
    description: 'Official attestation confirming the applicant has a permanent physical, sensory, or psychosocial impairment and resides in Bugo. Required for City Social Welfare PWD ID card issuance and 20% discount booklet.',
    imageUrl: '/assets/services/brgy_pwd_wheelchair_1794197737143.jpg',
    status: 'Active',
    badgeText: 'RA 10754 Mandated',
    deadline: 'Continuous Enrollment',
    targetAudience: 'Children and Adults with Disabilities',
    processingTime: 'Same Day (1-2 Hours)',
    requirements: [
      'Medical Certificate with Disability Assessment from a licensed physician',
      'Barangay Resident ID or Proof of Bugo Address',
      '2 copies 2x2 recent ID photos'
    ],
    eligibilityCriteria: [
      'Diagnosed with physical, sensory, cognitive, or psychological disability',
      'Resident of Barangay Bugo'
    ],
    maxBenefitAmount: 'Official PWD Certification'
  },
  {
    id: 'prog-cert-student-grant',
    title: 'Student Barangay Certification & Fee Waiver Endorsement',
    category: 'Barangay Administrative Services',
    tagline: 'Official certification certifying active student status for fee waivers and academic grants.',
    description: 'Documentary certification required by tertiary institutions, TESDA academies, and CHED scholarship boards to verify active student residency in Bugo for student fare discounts and educational stipends.',
    imageUrl: '/assets/services/brgy_job_student_1795014568227.jpg',
    status: 'Active',
    badgeText: 'Student Clearance',
    deadline: 'Continuous Semester Processing',
    targetAudience: 'Elementary, High School, College, & Vocational Students',
    processingTime: 'Same Day Issuance',
    requirements: [
      'Valid School ID or Certificate of Registration (COR)',
      'Barangay Resident ID or Proof of Address',
      'Latest Report Card or Transcript of Records'
    ],
    eligibilityCriteria: [
      'Currently enrolled in an accredited public or private school/college',
      'Bona fide resident of Barangay Bugo'
    ],
    maxBenefitAmount: 'Free Student Endorsement'
  },

  // ==========================================
  // 2. CIVIL REGISTRATION & PERMIT SERVICES
  // ==========================================
  {
    id: 'prog-civil-late-birth',
    title: 'Late Birth Registration Assistance',
    category: 'Civil Registration Services',
    tagline: 'Delayed birth registration endorsements, negative PSA certificate verification, and affidavits.',
    description: 'Legal document assistance for individuals whose births were never registered with the Philippine Statistics Authority (PSA). Essential for obtaining National ID, passports, and school enrollment.',
    imageUrl: '/assets/services/brgy_birth_registry_1795014566625.jpg',
    status: 'Active',
    badgeText: 'Delayed Registry Aid',
    deadline: 'Year-Round Service',
    targetAudience: 'Unregistered Youth and Adults',
    processingTime: '5 - 7 Business Days',
    requirements: [
      'PSA Negative Certification of Birth',
      'Joint Affidavit of Two Disinterested Persons who witnessed birth',
      'Baptismal Certificate or Elementary School Form 137',
      'Barangay Certificate of Residency'
    ],
    eligibilityCriteria: [
      'Born in Barangay Bugo without an existing PSA birth record',
      'Resident of Bugo'
    ],
    maxBenefitAmount: 'Document Packaging & Endorsement'
  },
  {
    id: 'prog-civil-marriage',
    title: 'Marriage Registration Assistance',
    category: 'Civil Registration Services',
    tagline: 'Pre-marriage counseling compliance, marriage license filing, and Kasalang Bayan coordination.',
    description: 'Assistance for engaged couples seeking civil marriage license documentation, compliance with Pre-Marriage Orientation and Counseling (PMOC), and enrollment in mass wedding ceremonies.',
    imageUrl: '/assets/services/brgy_civil_wedding_1794197758046.jpg',
    status: 'Active',
    badgeText: 'Marriage Registry',
    deadline: 'Ongoing & Kasalang Bayan Cycles',
    targetAudience: 'Engaged Couples Residing in Bugo',
    processingTime: '3 - 5 Business Days',
    requirements: [
      'PSA Birth Certificates of both partners',
      'Certificate of No Marriage Record (CENOMAR) from PSA',
      'Pre-Marriage Counseling (PMC) Certificate',
      'Barangay Certificate of Residency for both parties'
    ],
    eligibilityCriteria: [
      'At least one party must be a legal resident of Barangay Bugo',
      'Legal capacity to contract marriage under Philippine Family Code'
    ],
    maxBenefitAmount: 'Endorsement & Kasalang Bayan Access'
  },
  {
    id: 'prog-civil-death',
    title: 'Death Registration Assistance',
    category: 'Civil Registration Services',
    tagline: 'Certificate of Death processing, municipal cemetery burial clearance, and mortuary assistance.',
    description: 'Expedited processing of Certificate of Death with the local civil registrar, issuance of barangay burial permit, and coordination with local cemeteries and mortuary financial aid programs.',
    imageUrl: '/assets/services/brgy_burial_sympathy_1795014567931.jpg',
    status: 'Active',
    badgeText: 'Immediate Civil Filing',
    deadline: 'Within 48 Hours of Passing',
    targetAudience: 'Bereaved Families in Bugo',
    processingTime: 'Same Day Expedited',
    requirements: [
      'Certificate of Death signed by attending physician or City Health Officer',
      'Valid ID of Informant / Immediate Family Member',
      'Barangay Certificate of Residency of the deceased'
    ],
    eligibilityCriteria: [
      'Deceased was a resident of Barangay Bugo or passing occurred in Bugo',
      'Authorized surviving relative filing report'
    ],
    maxBenefitAmount: 'Burial Permit & Mortuary Referral'
  },
  {
    id: 'prog-live-business-processing',
    title: 'Business Permit Processing Assistance',
    category: 'Livelihood and Employment Services',
    tagline: 'Technical guidance for micro-enterprises on DTI registration, BIR TIN, and business compliance.',
    description: 'Consultation desk helping local entrepreneurs, market vendors, and sari-sari store owners navigate regulatory permits, BMBE (Barangay Micro Business Enterprise) tax exemptions, and food handling certificates.',
    imageUrl: '/assets/services/brgy_business_permit_1795014566314.jpg',
    status: 'Active',
    badgeText: 'MSME Business Desk',
    deadline: 'Continuous Business Support',
    targetAudience: 'Sari-Sari Store Owners, Vendors, & Startups',
    processingTime: '1 - 2 Business Days',
    requirements: [
      'Proposed Business Name and Location',
      'Valid Resident ID of Business Owner',
      'Sketch of Business Location within Bugo'
    ],
    eligibilityCriteria: [
      'Business located within Barangay Bugo',
      'Filipino citizen enterprise owner'
    ],
    maxBenefitAmount: 'Free Technical Guidance & Forms'
  },

  // ==========================================
  // 3. AUTOMATIC PROGRAMS (CREATE ACCOUNT MATCH)
  // ==========================================
  {
    id: 'prog-financial-assistance',
    title: 'Financial Assistance',
    category: 'Social Welfare Services',
    tagline: 'Cash aid for low-income, unemployed, and vulnerable Bugo households.',
    description: 'Direct barangay financial support for families experiencing urgent financial hardship, income loss, or priority sector needs.',
    imageUrl: '/assets/services/brgy_senior_pension_1794197712463.jpg',
    status: 'Active',
    badgeText: 'Auto-Matched Program',
    deadline: 'Year-Round Intake',
    targetAudience: 'Low-income, unemployed, and priority Bugo households',
    processingTime: '1 - 3 Business Days',
    programType: 'regular',
    applicationMode: 'automatic',
    requirements: [
      'Barangay Certificate of Residency',
      'Valid Government-Issued ID',
      'Certificate of Indigency',
      'Accomplished Financial Assistance Application Form'
    ],
    eligibilityCriteria: [
      'Verified Barangay Bugo resident (Zone 1 to 10)',
      'Household income ≤ ₱15,000, unemployed, or priority sector (Senior, PWD, Solo Parent)'
    ],
    maxBenefitAmount: 'Up to ₱5,000.00 Assistance'
  },
  {
    id: 'prog-medical-assistance',
    title: 'Medical Assistance',
    category: 'Health and Medical Services',
    tagline: 'Hospital bill, medicine, and treatment support for qualified residents.',
    description: 'Medical cash assistance and clinical support covering medical certificates, hospital bills, and statements of account.',
    imageUrl: '/assets/services/brgy_medical_clinic_1794197711940.jpg',
    status: 'Active',
    badgeText: 'Auto-Matched Program',
    deadline: 'Immediate Processing',
    targetAudience: 'Residents with medical needs, low-income, Seniors, and PWDs',
    processingTime: '24 - 48 Hours',
    programType: 'regular',
    applicationMode: 'automatic',
    requirements: [
      'Barangay Certificate of Residency',
      'Valid Government-Issued ID',
      'Medical Certificate, Hospital Bill, or Statement of Account',
      'Medical Assistance Application Form'
    ],
    eligibilityCriteria: [
      'Verified Barangay Bugo resident (Zone 1 to 10)',
      'Medical need declared on profile, income ≤ ₱15,000, Senior (60+), PWD, or Solo Parent'
    ],
    maxBenefitAmount: 'Medical & Hospitalization Support'
  },
  {
    id: 'prog-livelihood-program',
    title: 'Livelihood Programs',
    category: 'Livelihood and Employment Services',
    tagline: 'Starter kits, micro-business capital, and skills support for earners.',
    description: 'Support for small vendors, farmers, artisans, and unemployed working-age residents to launch or grow sustainable household income.',
    imageUrl: '/assets/services/brgy_agriculture_seeds_1794197712913.jpg',
    status: 'Active',
    badgeText: 'Auto-Matched Program',
    deadline: 'Quarterly Intake',
    targetAudience: 'Unemployed, self-employed, vendors, farmers, and part-time earners',
    processingTime: '3 - 5 Business Days',
    programType: 'regular',
    applicationMode: 'automatic',
    requirements: [
      'Barangay Certificate of Residency',
      'Valid Government-Issued ID',
      'Accomplished Livelihood Application Form',
      'Simple Business or Livelihood Proposal',
      'Certificate of Indigency (if required)',
      'Proof of Existing Livelihood (if applicable)'
    ],
    eligibilityCriteria: [
      'Verified Barangay Bugo resident aged 18 to 65',
      'Unemployed, self-employed, or part-time earner with household income ≤ ₱20,000'
    ],
    maxBenefitAmount: 'Livelihood Starter Kit / Grant'
  },
  {
    id: 'prog-disaster-relief',
    title: 'Disaster Relief Assistance',
    category: 'Community and Emergency Services',
    tagline: 'Emergency relief packs and recovery aid for calamity-affected households.',
    description: 'Immediate food, shelter support, and recovery aid for Bugo households affected by flood, fire, landslide, typhoon, or earthquake.',
    imageUrl: '/assets/services/brgy_disaster_rescue_1794197713383.jpg',
    status: 'Active',
    badgeText: 'Disaster Program',
    deadline: 'Active Emergency Intake',
    targetAudience: 'Disaster and calamity-affected Bugo households',
    processingTime: 'Same Day Dispatch',
    programType: 'disaster',
    requirements: [
      'Barangay Certificate of Residency (if available)',
      'Valid Government-Issued ID (if available)',
      'Disaster Incident or Damage Assessment',
      'Accomplished Disaster Assistance Application Form (if required)',
      'Proof of Damaged Property (if applicable)',
      'Household Information'
    ],
    eligibilityCriteria: [
      'Added by Barangay Admin as a beneficiary under this disaster program',
      'Barangay Bugo household affected by a reported disaster or calamity'
    ],
    maxBenefitAmount: 'Relief Packs & Recovery Aid'
  },

  // ==========================================
  // 4. ASSISTANCE PROGRAMS REQUIRING APPLICATION (9 DEDUPLICATED PROGRAMS)
  // ==========================================
  {
    id: 'prog-apply-lab-procedures',
    title: 'Laboratories and Other Procedures',
    category: 'Health and Medical Services',
    tagline: 'Medical diagnostic tests, imaging, and laboratory procedure support.',
    description: 'Financial support for diagnostic laboratory examinations and outpatient medical procedures.',
    imageUrl: '/assets/services/brgy_medical_clinic_1794197711940.jpg',
    status: 'Active',
    badgeText: 'Medical Assistance',
    deadline: 'Year-Round Application',
    targetAudience: 'Bugo residents needing diagnostic tests',
    processingTime: '1 - 3 Business Days',
    programType: 'regular',
    applicationMode: 'apply',
    requirements: [
      'Laboratory Request or Medical Referral',
      'Valid ID (National ID or any valid government ID)',
      'Certificate of Indigency (Optional — Purpose: Medical Assistance)'
    ],
    eligibilityCriteria: [
      'Resident of Barangay Bugo with valid government ID',
      'Diagnostic laboratory request or medical referral'
    ],
    maxBenefitAmount: 'Laboratory & Diagnostic Aid'
  },
  {
    id: 'prog-apply-dswd-burial',
    title: 'DSWD Burial Assistance',
    category: 'Social Welfare Services',
    tagline: 'DSWD burial and funeral expense support for bereaved families.',
    description: 'Assistance through DSWD to help Bugo families cover funeral contract and burial expenses.',
    imageUrl: '/assets/services/brgy_burial_sympathy_1795014567931.jpg',
    status: 'Active',
    badgeText: 'DSWD Assistance',
    deadline: 'Immediate Application',
    targetAudience: 'Bereaved families in Barangay Bugo',
    processingTime: '1 - 2 Business Days',
    programType: 'regular',
    applicationMode: 'apply',
    requirements: [
      'Funeral Contract',
      'Death Certificate (Original Copy)',
      'Certificate of Indigency (Purpose: Burial Assistance)',
      'Valid ID (National ID or any valid government ID)'
    ],
    eligibilityCriteria: [
      'Resident of Barangay Bugo with valid government ID',
      'Completed burial assistance documents'
    ],
    maxBenefitAmount: 'DSWD Burial Cash Aid'
  },
  {
    id: 'prog-apply-medical-implants',
    title: 'Stainless or Medical Implants',
    category: 'Health and Medical Services',
    tagline: 'Medical assistance for orthopedic stainless plates and surgical implants.',
    description: 'Assistance covering stainless steel orthopedic hardware and required surgical implants.',
    imageUrl: '/assets/services/brgy_medical_clinic_1794197711940.jpg',
    status: 'Active',
    badgeText: 'Medical Assistance',
    deadline: 'Year-Round Application',
    targetAudience: 'Patients requiring orthopedic or medical implants',
    processingTime: '1 - 3 Business Days',
    programType: 'regular',
    applicationMode: 'apply',
    requirements: [
      'Medical Abstract or Medical Certificate',
      'Certificate of Indigency (Purpose: Medical Assistance)',
      'Valid ID (National ID or any valid government ID)'
    ],
    eligibilityCriteria: [
      'Resident of Barangay Bugo with valid government ID',
      'Medical abstract or certificate for surgical implant'
    ],
    maxBenefitAmount: 'Medical Implant Assistance'
  },
  {
    id: 'prog-apply-hospital-bill',
    title: 'Hospital Bill Assistance',
    category: 'Health and Medical Services',
    tagline: 'Support for unpaid or final hospital billing statements.',
    description: 'Medical billing assistance applied against final hospital billing statements.',
    imageUrl: '/assets/services/brgy_medical_clinic_1794197711940.jpg',
    status: 'Active',
    badgeText: 'Medical Assistance',
    deadline: 'Year-Round Application',
    targetAudience: 'Hospitalized Bugo residents & families',
    processingTime: '1 - 3 Business Days',
    programType: 'regular',
    applicationMode: 'apply',
    requirements: [
      'Final Hospital Bill',
      'Justification Letter (For private or semi-private room)',
      "Doctor's Note (if applicable, Optional)",
      'Valid ID (National ID or any valid government ID)',
      'Certificate of Indigency (Optional — Purpose: Medical Assistance)'
    ],
    eligibilityCriteria: [
      'Resident of Barangay Bugo with valid government ID',
      'Final hospital bill or statement of account'
    ],
    maxBenefitAmount: 'Hospital Billing Support'
  },
  {
    id: 'prog-apply-dswd-educational',
    title: 'DSWD Educational Assistance',
    category: 'Social Welfare Services',
    tagline: 'DSWD cash aid for enrolled students needing school support.',
    description: 'Educational support through DSWD for students with an active Certificate of Registration and indigency endorsement.',
    imageUrl: '/assets/services/brgy_job_student_1795014568227.jpg',
    status: 'Active',
    badgeText: 'DSWD Assistance',
    deadline: 'Year-Round Application',
    targetAudience: 'Students in Barangay Bugo',
    processingTime: '2 - 5 Business Days',
    programType: 'regular',
    applicationMode: 'apply',
    requirements: [
      'Certificate of Registration (COR)',
      'Certificate of Indigency (Purpose: Educational Assistance)',
      'Valid ID (National ID or any valid government ID)'
    ],
    eligibilityCriteria: [
      'Resident of Barangay Bugo with valid government ID',
      'Active Certificate of Registration (COR)'
    ],
    maxBenefitAmount: 'DSWD Educational Cash Aid'
  },
  {
    id: 'prog-apply-reseta-tambal',
    title: 'Reseta o Tambal (Medicine Assistance)',
    category: 'Health and Medical Services',
    tagline: 'Prescription medicine purchase support for qualified residents.',
    description: 'Medical assistance covering prescribed medicines backed by a doctor prescription and medical certificate.',
    imageUrl: '/assets/services/brgy_medical_clinic_1794197711940.jpg',
    status: 'Active',
    badgeText: 'Medical Assistance',
    deadline: 'Year-Round Application',
    targetAudience: 'Patients needing prescribed medicines',
    processingTime: '1 - 2 Business Days',
    programType: 'regular',
    applicationMode: 'apply',
    requirements: [
      "Doctor's Prescription",
      'Medical Abstract or Medical Certificate',
      'Certificate of Indigency (Purpose: Medical Assistance)',
      'Valid ID (National ID or any valid government ID)'
    ],
    eligibilityCriteria: [
      'Resident of Barangay Bugo with valid government ID',
      'Valid doctor prescription'
    ],
    maxBenefitAmount: 'Prescription Medicine Aid'
  },
  {
    id: 'prog-apply-dswd-transportation',
    title: 'DSWD Transportation Assistance',
    category: 'Social Welfare Services',
    tagline: 'Emergency travel support for stranded or theft-victim residents.',
    description: 'DSWD transportation assistance for stranded individuals or victims of theft verified with a police blotter.',
    imageUrl: '/assets/services/brgy_transport_aid_1795014568517.jpg',
    status: 'Active',
    badgeText: 'DSWD Assistance',
    deadline: 'Immediate Application',
    targetAudience: 'Stranded or theft-affected Bugo residents',
    processingTime: 'Same Day - 2 Business Days',
    programType: 'regular',
    applicationMode: 'apply',
    requirements: [
      'Police Blotter (for theft or stranded cases)',
      'Certificate of Indigency (Purpose: Transportation Assistance)',
      'Valid ID (National ID or any valid government ID)'
    ],
    eligibilityCriteria: [
      'Resident of Barangay Bugo with valid government ID',
      'Police blotter and Certificate of Indigency'
    ],
    maxBenefitAmount: 'DSWD Travel Assistance'
  },
  {
    id: 'prog-apply-ovm-medical-financial',
    title: 'Vice Mayor Financial Assistance (Hospital Bill / Medical)',
    category: 'Social Welfare Services',
    tagline: 'Office of City Vice Mayor Jocelyn "Bebot" Rodriguez medical & billing aid.',
    description: 'Financial assistance endorsed to the Office of the City Vice Mayor Jocelyn "Bebot" Rodriguez for hospital billing or medical treatment.',
    imageUrl: '/assets/services/brgy_medical_clinic_1794197711940.jpg',
    status: 'Active',
    badgeText: 'Office of Vice Mayor',
    deadline: 'Year-Round Application',
    targetAudience: 'Patients & claimants residing in Bugo',
    processingTime: '2 - 4 Business Days',
    programType: 'regular',
    applicationMode: 'apply',
    requirements: [
      'Certificate of Indigency (Hospital Bill / Medical support from Office of Vice Mayor Jocelyn "Bebot" Rodriguez, with claimant & patient name)',
      'Personal Request Letter addressed to Vice Mayor Jocelyn "Bebot" Rodriguez',
      "Patient's Valid ID & Claimant's Valid ID",
      'Hospital Billing: Final Hospital Billing & Medical Abstract (if applicable)',
      'Medical Assistance: Medical Certificate & Latest Medical Prescription (if applicable)'
    ],
    eligibilityCriteria: [
      'Resident of Barangay Bugo with patient and claimant valid IDs',
      'Request letter and Certificate of Indigency for the Office of the City Vice Mayor'
    ],
    maxBenefitAmount: 'City Vice Mayor Medical Grant'
  },
  {
    id: 'prog-apply-ovm-burial',
    title: 'Vice Mayor Burial Assistance',
    category: 'Social Welfare Services',
    tagline: 'Office of City Vice Mayor Jocelyn "Bebot" Rodriguez burial aid.',
    description: 'Burial assistance endorsed to the Office of the City Vice Mayor Jocelyn "Bebot" Rodriguez for bereaved Bugo families.',
    imageUrl: '/assets/services/brgy_burial_sympathy_1795014567931.jpg',
    status: 'Active',
    badgeText: 'Office of Vice Mayor',
    deadline: 'Immediate Application',
    targetAudience: 'Bereaved claimants in Barangay Bugo',
    processingTime: '1 - 3 Business Days',
    programType: 'regular',
    applicationMode: 'apply',
    requirements: [
      'Death Certificate with Registry Number',
      'Certificate of Indigency (Burial assistance from Office of Vice Mayor Jocelyn "Bebot" Rodriguez)',
      'ID of Claimant',
      'Funeral Contract'
    ],
    eligibilityCriteria: [
      'Resident of Barangay Bugo with claimant ID',
      'Registered Death Certificate and Funeral Contract'
    ],
    maxBenefitAmount: 'City Vice Mayor Burial Grant'
  }
];

export const CERTIFICATE_SERVICES: AssistanceProgram[] = [
  ALL_BARANGAY_SERVICES.find(s => s.id === 'prog-barangay-clearance')!,
  ALL_BARANGAY_SERVICES.find(s => s.id === 'prog-admin-residency')!,
  ALL_BARANGAY_SERVICES.find(s => s.id === 'prog-admin-indigency')!,
  ALL_BARANGAY_SERVICES.find(s => s.id === 'prog-admin-good-moral')!,
  ALL_BARANGAY_SERVICES.find(s => s.id === 'prog-admin-first-job')!,
  ALL_BARANGAY_SERVICES.find(s => s.id === 'prog-cert-solo-parent')!,
  ALL_BARANGAY_SERVICES.find(s => s.id === 'prog-cert-senior-citizen')!,
  ALL_BARANGAY_SERVICES.find(s => s.id === 'prog-cert-pwd')!,
  ALL_BARANGAY_SERVICES.find(s => s.id === 'prog-cert-student-grant')!,
  ALL_BARANGAY_SERVICES.find(s => s.id === 'prog-admin-business-permit')!
].filter(Boolean);

