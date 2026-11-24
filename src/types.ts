export type UserRole = 'admin' | 'resident' | 'guest';

export interface ResidentUser {
  id: string;
  name: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  birthdate?: string;
  email: string;
  username: string;
  role: 'admin' | 'resident';
  contactNumber: string;
  purok: string;
  address: string;
  residentIdNumber: string;
  isVerified: boolean;
  registrationStatus?: 'Verified' | 'Pending Approval' | 'Rejected' | 'Banned';
  rejectionReason?: string;
  autoValidatedFromApplication?: boolean;
  autoValidatedRefCode?: string;
  isBanned?: boolean;
  banReason?: string;
  bannedDate?: string;
  idType?: string;
  idNumber?: string;
  frontIdUrl?: string;
  backIdUrl?: string;
  avatarUrl?: string;
  idPhotoAnalysis?: IdPhotoAnalysis;
  backIdPhotoAnalysis?: IdPhotoAnalysis;
  registeredDate: string;
  householdIncome?: string;
  familyMembersCount?: number;
  voterStatus?: 'Registered' | 'Unregistered';
  occupation?: string;
  employmentStatus?: 'Employed (Full-Time)' | 'Employed (Part-Time)' | 'Self-Employed' | 'Unemployed' | 'Student' | 'Retired';
  nationality?: string;
  age?: number;
  gender?: 'Male' | 'Female';
  // Household Profiling Categories
  isPwd?: boolean;
  pwdIdNumber?: string;
  pwdDisabilityType?: string;
  isSoloParent?: boolean;
  soloParentIdNumber?: string;
  isSenior?: boolean;
  seniorIdNumber?: string;
  isStudent?: boolean;
  schoolName?: string;
  studentLevel?: 'Elementary' | 'High School' | 'College/University' | 'Vocational';
  isTeenager?: boolean;
  hasMedicalNeed?: boolean;
  medicalConditionNote?: string;
  isDisasterAffected?: boolean;
  disasterType?: DisasterCategory;
  disasterDamageLevel?: DamageSeverity;
  civilStatus?: 'Single' | 'Married' | 'Widowed' | 'Separated';
  yearsOfResidency?: number;
  accountSource?: 'create_account' | 'admin_add_resident';
  pendingProfileUpdate?: ProfileChangeRequest;
}

export type EditableResidentProfileFields = Pick<
  ResidentUser,
  | 'name'
  | 'firstName'
  | 'middleName'
  | 'lastName'
  | 'suffix'
  | 'birthdate'
  | 'email'
  | 'contactNumber'
  | 'nationality'
  | 'purok'
  | 'address'
  | 'householdIncome'
  | 'familyMembersCount'
  | 'occupation'
  | 'employmentStatus'
  | 'age'
  | 'gender'
  | 'voterStatus'
>;

export interface ProfileChangeRequest {
  requestedAt: string;
  status: 'Pending' | 'Rejected';
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  changes: Partial<EditableResidentProfileFields>;
}

export interface ActivityLogItem {
  id: string;
  residentName: string;
  residentIdNumber: string;
  purok: string;
  actionType: 'Time-In' | 'Time-Out' | 'Application Submitted' | 'Status Updated' | 'Clearance Issued' | 'Portal Login';
  locationOrService: string;
  timestamp: string;
  officerInCharge: string;
  status: 'Completed' | 'Active' | 'Logged';
  details?: string;
}

export interface ArchiveItem {
  id: string;
  title: string;
  originalCategory:
    | 'Resident Record'
    | 'Service Application'
    | 'Program / Service'
    | 'Notice'
    | 'Document'
    | 'Disaster Victim'
    | 'Hazard Zone';
  referenceCode?: string;
  deletedBy: string;
  deletedAt: string;
  reasonForArchive: string;
  originalData: any;
  status: 'Archived';
}

export type ProgramCategory = 
  | 'Barangay Administrative Services'
  | 'Health and Medical Services'
  | 'Social Welfare Services'
  | 'Civil Registration Services'
  | 'Livelihood and Employment Services'
  | 'Legal Services'
  | 'Community and Emergency Services'
  | 'Flood'
  | 'Fire'
  | 'Landslide'
  | 'Earthquake'
  | 'Typhoon / Storm'
  | 'Other'
  | 'Clearance & Certification' 
  | 'Education' 
  | 'Medical' 
  | 'Financial' 
  | 'Livelihood' 
  | 'General';


export type ProgramQualificationSector =
  | 'unemployed'
  | 'senior'
  | 'pwd'
  | 'solo_parent'
  | 'student'
  | 'medical_need';

export interface ProgramQualificationRules {
  maxMonthlyIncome?: number | null;
  largeHouseholdMinMembers?: number | null;
  largeHouseholdMaxIncome?: number | null;
  minAge?: number | null;
  maxAge?: number | null;
  allowedEmploymentStatuses?: string[];
  eligibleSectors?: ProgramQualificationSector[];
  sectorMatchMode?: 'any_or_income' | 'all_required';
  allowedZones?: string[];
}

export interface AssistanceProgram {
  id: string;
  title: string;
  category: ProgramCategory;
  tagline: string;
  description: string;
  imageUrl: string;
  status: 'Active' | 'Open' | 'Closed';
  badgeText: string;
  deadline: string;
  targetAudience: string;
  processingTime: string;
  requirements: string[];
  eligibilityCriteria: string[];
  maxBenefitAmount?: string;
  slotsAvailable?: number | string;
  programType?: 'regular' | 'disaster' | 'service';
  applicationMode?: 'automatic' | 'apply';
  autoEnrollVictims?: boolean;
  qualificationRules?: ProgramQualificationRules;
}

export type ApplicationStatus = 
  | 'Submitted'
  | 'Under Review'
  | 'Documents Verified'
  | 'Valid'
  | 'Approved'
  | 'Ready for Release'
  | 'Needs Additional Requirements'
  | 'Re-submitted'
  | 'Disbursed'
  | 'Completed'
  | 'Rejected'
  | 'Disqualified';

export interface IdPhotoAnalysis {
  isId: boolean;
  isClear: boolean;
  isBlurry?: boolean;
  detectedDocType: string;
  detectedSide?: 'front' | 'back' | 'unknown';
  matchesExpectedSide?: boolean;
  expectedIdType?: string;
  matchesExpectedType?: boolean;
  photoMatchesExpectedType?: boolean;
  expectedName?: string;
  matchesExpectedName?: boolean;
  expectedBirthdate?: string;
  matchesExpectedBirthdate?: boolean;
  expectedAddress?: string;
  matchesExpectedAddress?: boolean;
  expectedIdNumber?: string;
  matchesExpectedIdNumber?: boolean;
  expectedGender?: 'Male' | 'Female' | '';
  matchesExpectedGender?: boolean;
  expectedCivilStatus?: string;
  matchesExpectedCivilStatus?: boolean;
  aiVisionUsed?: boolean;
  warning?: string | null;
  advice?: string;
  score: number;
  extractedName?: string;
  extractedBirthdate?: string;
  extractedIdType?: string;
  extractedIdNumber?: string;
  extractedAddress?: string;
  extractedAge?: number;
  extractedGender?: 'Male' | 'Female' | '';
  extractedCivilStatus?: string;
  detectedFlags?: {
    isSenior?: boolean;
    isPwd?: boolean;
    isSoloParent?: boolean;
    isStudent?: boolean;
  };
}

export interface EligibilityRuleResult {
  ruleName: string;
  passed: boolean;
  actualValue: string;
  limitValue: string;
  explanation: string;
}

export interface EligibilityEvaluation {
  verdict: 'ELIGIBLE' | 'INELIGIBLE' | 'REQUIRES_MANUAL_REVIEW';
  isCapable: boolean;
  score: number;
  summary: string;
  disqualifiedReason?: string;
  rules: EligibilityRuleResult[];
  evaluatedAt: string;
  idAudit?: {
    isId: boolean;
    isClear: boolean;
    detectedType?: string;
    warning?: string;
  };
}

export interface UploadedDocument {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadDate: string;
  fileUrl?: string;
  previewUrl?: string;
  docCategory?: 'Front ID' | 'Back ID' | 'Proof of Residency' | 'Indigency' | 'Income Certificate' | 'General Requirement';
  verified: boolean;
  autoAttached?: boolean;
  sourceLabel?: string;
  analysis?: IdPhotoAnalysis;
  scanResult?: {
    isValid: boolean;
    isClear?: boolean;
    detectedDocType?: string;
    matchedKeywords?: string[];
    expectedKeywords?: string[];
    extractedText?: string;
    warning?: string | null;
  };
}

export interface StatusHistoryEntry {
  status: ApplicationStatus;
  timestamp: string;
  officerName: string;
  remarks?: string;
}

export interface AssistanceApplication {
  id: string;
  referenceCode: string; // e.g. BUG-2026-9120
  programId: string;
  programTitle: string;
  programCategory: ProgramCategory;
  applicantId: string;
  applicantName: string;
  contactNumber: string;
  email: string;
  purok: string;
  address: string;
  householdMonthlyIncome: string;
  familyMembersCount: number;
  occupation?: string;
  purposeOrDiagnosis: string;
  requestedAmount?: string;
  approvedAmount?: string;
  status: ApplicationStatus;
  submissionDate: string;
  submittedAt?: string;
  queueNumber?: number;
  lastUpdated: string;
  idCardFrontUrl?: string;
  idCardBackUrl?: string;
  documents: UploadedDocument[];
  timeline: StatusHistoryEntry[];
  evaluatorNotes?: string;
  rejectionReason?: string;
  eligibilityEvaluation?: EligibilityEvaluation;
  priorityScore: 'Normal' | 'High' | 'Urgent';
  payoutDate?: string;
  payoutVenue?: string;
  hmacToken?: string;
  disbursedAt?: string;
  disbursedBy?: string;
  officialReceiptNumber?: string;
  paymentMethod?: string;
  resubmittedAt?: string;
  resubmittedNote?: string;
  isCertificateQualified?: boolean;
  qualificationDetails?: {
    isQualified: boolean;
    score: number;
    passedRules?: string[];
    failedRules?: string[];
    failureReasons?: string[];
    passedCriteria?: string[];
    failedCriteria?: string[];
    summary: string;
  };
}

export interface SecretariatDetails {
  lguUnit: string;
  punongBarangay: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  description: string;
  category: 'Water' | 'Health' | 'Sports' | 'Assembly' | 'General' | 'Program Release' | 'Meeting' | 'Disaster';
  date: string;
  viewsCount: number;
  viewedBy?: string[];
  iconType: 'water' | 'medical' | 'sports' | 'alert' | 'general' | 'calendar';
  isPinned?: boolean;
  status?: 'Published' | 'Pending Approval';
  // Targeted Announcements for qualified beneficiaries only
  targetAudienceType?: 'All' | 'Qualified Beneficiaries Only';
  targetProgramId?: string;
  targetProgramTitle?: string;
  releaseDate?: string;
  meetingTime?: string;
  meetingVenue?: string;
  instructions?: string;
}

export interface NotificationDocumentData {
  docType: string;
  controlNumber: string;
  recipientName: string;
  issueDate: string;
  subject: string;
  narrative: string;
  officialRemarks?: string;
  venueOrOffice?: string;
  signatoryName?: string;
  signatoryRole?: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  timestamp: string; // Exact formatted date: e.g. "Nov 8, 2026 • 9:10 PM"
  createdAt?: string; // ISO date string for deduplication and sorting
  read: boolean;
  readBy?: string[];
  dismissedBy?: string[];
  type: 'status_update' | 'announcement' | 'registration_approved' | 'registration_submitted' | 'document_issued' | 'system_alert';
  applicationRef?: string;
  targetArea?: 'dashboard' | 'services' | 'announcements' | 'residents' | 'status-tracking' | 'disaster-aid' | 'hazard-map' | 'archives' | 'help' | 'settings';
  targetProgramId?: string;
  targetProgramTitle?: string;
  announcementId?: string;
  documentData?: NotificationDocumentData;
}

export interface CensusPurokItem {
  purok: string;
  population: number;
  households: number;
}

export interface CensusData {
  totalPopulation: number;
  totalHouseholds: number;
  registeredVoters: number;
  seniorCitizens: number;
  workingAge: number;
  minors: number;
  purokBreakdown: CensusPurokItem[];
  lastUpdated: string;
}

export type DisasterCategory = 'Fire' | 'Flood' | 'Landslide' | 'Earthquake' | 'Typhoon / Storm' | 'Other';
export type DamageSeverity = 'Minor' | 'Moderate' | 'Severe' | 'Total Loss';
export type VictimSelectionStatus = 'Waitlisted' | 'Selected' | 'Distributed';

export interface DisasterVictimRecord {
  id: string;
  residentId?: string;
  victimCode: string;
  fullName: string;
  age?: number;
  contactNumber: string;
  purok: string;
  address: string;
  disasterType: DisasterCategory;
  incidentDate: string;
  damageLevel: DamageSeverity;
  householdSize: number;
  householdIncome: string;
  vulnerabilityTags: string[];
  enrolledProgramIds: string[];
  enrolledProgramTitles: string[];
  selectionStatus: VictimSelectionStatus;
  selectionBatchId?: string;
  selectedAt?: string;
  recordedAt: string;
  notes?: string;
}

export type HazardCategory = 'Earthquake' | 'Flood' | 'Landslide' | 'Fire' | 'Other';
export type HazardRiskLevel = 'Low' | 'Moderate' | 'High';

export interface BugoHazardZone {
  id: string;
  name: string;
  disasterType: HazardCategory;
  riskLevel: HazardRiskLevel;
  purok: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  description: string;
  affectedHouseholdsEst?: number;
  updatedAt: string;
}

export type RankingPriorityLevel = 1 | 2 | 3 | 4 | 5;

export interface RankingClassificationEntry {
  id: string;
  residentId: string;
  residentName: string;
  purok: string;
  priority: RankingPriorityLevel;
  updatedAt: string;
}

export interface BugoEarthquakeZoneInfo {
  id: string;
  sectorName: string;
  purok: string;
  riskLevel: HazardRiskLevel;
  soilProfile: string;
  peisIntensityEstimate: string;
  faultProximityKm: number;
  exposedHouseholds: number;
  safeAssemblySite: string;
  lat: number;
  lng: number;
  notes: string;
}

export interface BugoFireProneArea {
  id: string;
  areaName: string;
  purok: string;
  frequencyLabel: string;
  incidentsLast3Years: number;
  affectedStructuresEst: number;
  riskLevel: HazardRiskLevel;
  primaryCauses: string;
  accessConstraint: string;
  hydrantStatus: string;
  lat: number;
  lng: number;
}

export interface BugoFloodAreaInfo {
  id: string;
  areaName: string;
  purok: string;
  riskLevel: HazardRiskLevel;
  peakDepthEst: string;
  exposedHouseholds: number;
  primaryTrigger: string;
  evacuationSite: string;
  drainageStatus: string;
  lat: number;
  lng: number;
}

export interface BugoLandslideAreaInfo {
  id: string;
  sectorName: string;
  purok: string;
  riskLevel: HazardRiskLevel;
  slopeGrade: string;
  exposedHouseholds: number;
  soilAndTrigger: string;
  safeAssemblySite: string;
  mitigationNotes: string;
  lat: number;
  lng: number;
}

export interface BugoOtherHazardAreaInfo {
  id: string;
  areaName: string;
  purok: string;
  hazardSubtype: string;
  riskLevel: HazardRiskLevel;
  exposedHouseholds: number;
  description: string;
  contingencyAction: string;
  lat: number;
  lng: number;
}

export type HazardSummaryCategory = 'flood' | 'landslide' | 'earthquake' | 'fire' | 'other';

export interface HazardSummariesData {
  flood: BugoFloodAreaInfo[];
  landslide: BugoLandslideAreaInfo[];
  earthquake: BugoEarthquakeZoneInfo[];
  fire: BugoFireProneArea[];
  other: BugoOtherHazardAreaInfo[];
}

