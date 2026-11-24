import React, { useState, useRef, useEffect } from 'react';
import { 
  ShieldCheck, 
  ArrowLeft, 
  CheckCircle2, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Lock, 
  AlertCircle, 
  FileText,
  Eye,
  EyeOff,
  Check,
  X,
  ShieldAlert,
  Accessibility,
  HeartHandshake,
  GraduationCap,
  Sparkles,
  CreditCard,
  Briefcase,
  Users,
  Camera,
  Upload,
  Loader2,
  Trash2,
  Stethoscope,
  CloudLightning
} from 'lucide-react';
import { BugoLogo, BugoSealEmblem } from '../BugoLogo';
import { useApp } from '../../context/AppContext';
import { 
  BUGO_PUROKS, 
  MONTHLY_INCOME_OPTIONS, 
  MALE_CARTOON_AVATARS, 
  FEMALE_CARTOON_AVATARS, 
  detectUserGender 
} from '../../data/mockData';
import { evaluatePasswordStrength } from '../../utils/passwordStrength';
import { isAllowedAccountEmail, normalizeAccountEmail, ALLOWED_EMAIL_DOMAIN_MESSAGE } from '../../utils/emailValidation';
import { DisasterCategory, IdPhotoAnalysis } from '../../types';
import {
  scanIdPhotoWithClarityAndType,
  checkDuplicateIdImageAttachment,
} from '../../utils/imageScanner';
import {
  canonicalizeIdCategory,
  matchApplicantNameWithId,
  matchApplicantBirthdateWithId,
  matchApplicantIdNumberWithId,
  matchApplicantIdNumberAcrossSides,
  isIdNumberPrefixMatch,
  matchApplicantGenderWithId,
  matchApplicantCivilStatusWithId,
  matchFrontAndBackIdConsistency,
  matchIdTypeWithProfile,
  normalizeIdCode,
} from '../../utils/idNameMatcher';
import { normalizePhMobileNumber } from '../../utils/phoneValidation';
import { GUIDE_ASSETS } from '../../data/guideAssets';

const GOV_ID_TYPES = [
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
  'PRC Professional License'
];

const DISABILITY_TYPES = [
  'Physical / Mobility Impairment',
  'Visual Impairment / Low Vision / Blindness',
  'Hearing Impairment / Deafness',
  'Speech and Language Impairment',
  'Psychosocial / Mental Health Disability',
  'Intellectual Disability',
  'Learning Disability',
  'Chronic Illness / Multiple Disabilities'
];

const LIVELIHOOD_OPTIONS = [
  'Agricultural Farmer / Planter',
  'Fisherman / Coastal Fisherfolk',
  'Daily Wage Earner / Laborer',
  'Construction Worker / Carpenter / Mason',
  'Tricycle / PUV / Delivery Driver',
  'Market Vendor / Retail Merchant',
  'Sari-Sari Store / Micro-Entrepreneur',
  'Food Vendor / Eatery Operator',
  'Handicraft / Home-Based Artisan',
  'Domestic Helper / Caregiver',
  'Factory / Industrial Worker',
  'Private Sector Employee',
  'Government Employee / Public Servant',
  'Self-Employed / Freelancer',
  'Housewife / Homemaker',
  'College / University Student',
  'High School Student',
  'Fresh Graduate / First-Time Jobseeker',
  'Unemployed / Actively Seeking Work',
  'Retired / Senior Pensioner'
];

export const RegisterPage: React.FC = () => {
  const { setAuthView, registerResidentAccount, residentsList } = useApp();

  const [occupationChoice, setOccupationChoice] = useState<string>('');
  const [customOccupation, setCustomOccupation] = useState<string>('');

  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    suffix: '',
    birthdate: '',
    name: '',
    email: '',
    contactNumber: '',
    purok: BUGO_PUROKS[0],
    address: '',
    age: 28,
    gender: '' as '' | 'Male' | 'Female',
    civilStatus: 'Single' as 'Single' | 'Married' | 'Widowed' | 'Separated',
    occupation: '',
    employmentStatus: 'Self-Employed' as 'Employed (Full-Time)' | 'Employed (Part-Time)' | 'Self-Employed' | 'Unemployed' | 'Student' | 'Retired',
    idType: 'PhilSys National ID',
    idNumber: '',
    householdIncome: MONTHLY_INCOME_OPTIONS[2],
    familyMembersCount: 4,
    yearsOfResidency: 5,
    // Special Profiling Categories
    isPwd: false,
    pwdDisabilityType: DISABILITY_TYPES[0],
    pwdIdNumber: '',
    isSoloParent: false,
    soloParentIdNumber: '',
    isSenior: false,
    seniorIdNumber: '',
    isStudent: false,
    schoolName: '',
    studentLevel: 'College/University' as 'Elementary' | 'High School' | 'College/University' | 'Vocational',
    isTeenager: false,
    hasMedicalNeed: false,
    medicalConditionNote: '',
    isDisasterAffected: false,
    disasterType: 'Flood' as DisasterCategory,
    // Security & Policy
    password: '',
    confirmPassword: '',
    agreeTerms: false,
    agreePrivacy: false,
    agreeTruthfulness: false
  });

  const composeFullLegalName = (first: string, middle: string, last: string, suffix: string) =>
    [first.trim(), middle.trim(), last.trim(), suffix.trim()].filter(Boolean).join(' ');

  const computeAgeFromBirthdate = (dobStr: string): number | null => {
    if (!dobStr) return null;
    const ymd = String(dobStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    let year: number;
    let month: number;
    let day: number;
    if (ymd) {
      year = Number(ymd[1]);
      month = Number(ymd[2]) - 1;
      day = Number(ymd[3]);
    } else {
      const dob = new Date(dobStr);
      if (Number.isNaN(dob.getTime())) return null;
      year = dob.getFullYear();
      month = dob.getMonth();
      day = dob.getDate();
    }
    const today = new Date();
    let age = today.getFullYear() - year;
    const m = today.getMonth() - month;
    if (m < 0 || (m === 0 && today.getDate() < day)) {
      age -= 1;
    }
    return age >= 0 && age <= 120 ? age : null;
  };

  const autoDetectedGender = detectUserGender(null, formData.name.trim());
  const [avatarGenderManual, setAvatarGenderManual] = useState<'male' | 'female' | null>(null);
  const effectiveGender =
    formData.gender === 'Male'
      ? 'male'
      : formData.gender === 'Female'
      ? 'female'
      : avatarGenderManual || autoDetectedGender;
  const currentPresets = effectiveGender === 'male' ? MALE_CARTOON_AVATARS : FEMALE_CARTOON_AVATARS;
  const defaultMatchedAvatar = currentPresets[0]?.url || '';
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Scan ID & Attachment State (Front & Back Independent Scanners & Notices)
  type SideScanNotice = { tone: 'success' | 'error' | 'warning'; message: string } | null;
  const [frontIdUrl, setFrontIdUrl] = useState<string>('');
  const [frontIdFileName, setFrontIdFileName] = useState<string>('');
  const [frontIdFileSize, setFrontIdFileSize] = useState<number>(0);
  const [idAnalysis, setIdAnalysis] = useState<IdPhotoAnalysis | null>(null);
  const [isScanningFrontId, setIsScanningFrontId] = useState(false);
  const [frontScanNotice, setFrontScanNotice] = useState<SideScanNotice>(null);

  const [backIdUrl, setBackIdUrl] = useState<string>('');
  const [backIdFileName, setBackIdFileName] = useState<string>('');
  const [backIdFileSize, setBackIdFileSize] = useState<number>(0);
  const [backIdAnalysis, setBackIdAnalysis] = useState<IdPhotoAnalysis | null>(null);
  const [isScanningBackId, setIsScanningBackId] = useState(false);
  const [backScanNotice, setBackScanNotice] = useState<SideScanNotice>(null);

  const [isIdGuideZoomOpen, setIsIdGuideZoomOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraTargetSide, setCameraTargetSide] = useState<'front' | 'back'>('front');
  const [cameraError, setCameraError] = useState<string>('');

  const frontFileInputRef = useRef<HTMLInputElement | null>(null);
  const backFileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraFallbackInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isScanningId = isScanningFrontId || isScanningBackId;

  const setSideScanNotice = (side: 'front' | 'back', notice: SideScanNotice) => {
    if (side === 'front') setFrontScanNotice(notice);
    else setBackScanNotice(notice);
  };

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idNumberManuallyEdited, setIdNumberManuallyEdited] = useState(false);
  const [addressManuallyEdited, setAddressManuallyEdited] = useState(false);
  const [purokManuallyEdited, setPurokManuallyEdited] = useState(false);

  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const idNumberManuallyEditedRef = useRef(idNumberManuallyEdited);
  idNumberManuallyEditedRef.current = idNumberManuallyEdited;
  const addressManuallyEditedRef = useRef(addressManuallyEdited);
  addressManuallyEditedRef.current = addressManuallyEdited;
  const purokManuallyEditedRef = useRef(purokManuallyEdited);
  purokManuallyEditedRef.current = purokManuallyEdited;

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const compressImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read selected file.'));
      reader.onload = () => {
        const rawUrl = String(reader.result || '');
        const img = new Image();
        img.onerror = () => resolve(rawUrl);
        img.onload = () => {
          const maxDim = 1400;
          const needsResize = img.width > maxDim || img.height > maxDim;
          const needsShrink = rawUrl.length > 350_000;
          if (!needsResize && !needsShrink) {
            resolve(rawUrl);
            return;
          }
          const scale = needsResize ? Math.min(maxDim / img.width, maxDim / img.height) : 1;
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/jpeg', 0.86);
          resolve(compressed && compressed.length < rawUrl.length ? compressed : rawUrl);
        };
        img.src = rawUrl;
      };
      reader.readAsDataURL(file);
    });
  };

  const extractBugoPurokFromAddress = (rawAddress?: string): string | null => {
    const addr = String(rawAddress || '').trim();
    if (!addr) return null;
    const zoneNumMatch = addr.match(/\b(?:purok|zone)\s*[-:#.]?\s*(\d{1,2})\b/i);
    if (zoneNumMatch) {
      const num = parseInt(zoneNumMatch[1], 10);
      const matchedByNum = BUGO_PUROKS.find(
        (p) => p.toLowerCase().startsWith(`zone ${num} `) || p.toLowerCase() === `zone ${num}`
      );
      if (matchedByNum) return matchedByNum;
    }
    const lowerAddr = addr.toLowerCase();
    for (const p of BUGO_PUROKS) {
      const parts = p.split(' - ');
      const subArea = (parts[1] || '').trim().toLowerCase();
      if (subArea && subArea.length >= 4 && lowerAddr.includes(subArea)) {
        return p;
      }
    }
    return null;
  };

  const buildAnalysisForForm = (
    baseAnalysis: IdPhotoAnalysis,
    side: 'front' | 'back',
    targetForm: typeof formData,
    expectedTypeOverrideValue?: string
  ): IdPhotoAnalysis => {
    const targetType = expectedTypeOverrideValue || targetForm.idType;
    const targetName =
      composeFullLegalName(targetForm.firstName, targetForm.middleName, targetForm.lastName, targetForm.suffix) ||
      targetForm.name.trim();
    const targetGender = targetForm.gender;
    const sideMatch =
      (baseAnalysis.detectedSide === side ? true : baseAnalysis.matchesExpectedSide !== false) &&
      !(side === 'front' && baseAnalysis.detectedSide === 'back') &&
      !(side === 'back' && baseAnalysis.detectedSide === 'front');

    const detCanon = canonicalizeIdCategory(baseAnalysis.extractedIdType || baseAnalysis.detectedDocType);
    const tgtCanon = canonicalizeIdCategory(targetType);
    const profChk = matchIdTypeWithProfile({
      idType: targetType,
      age: targetForm.age,
      isSenior: targetForm.isSenior,
    });
    const basePhotoTypeMatches =
      baseAnalysis.photoMatchesExpectedType !== undefined
        ? baseAnalysis.photoMatchesExpectedType !== false
        : baseAnalysis.matchesExpectedType !== false;
    const typeMatches = Boolean(
      profChk.matches &&
        baseAnalysis.isId !== false &&
        (tgtCanon && detCanon
          ? detCanon === tgtCanon
          : targetType !== baseAnalysis.expectedIdType || basePhotoTypeMatches)
    );

    const nameChk = matchApplicantNameWithId(
      {
        firstName: targetForm.firstName,
        middleName: targetForm.middleName,
        lastName: targetForm.lastName,
        suffix: targetForm.suffix,
        fullName: targetName,
      },
      baseAnalysis.extractedName
    );
    const dobChk = matchApplicantBirthdateWithId(
      { birthdate: targetForm.birthdate, age: targetForm.age },
      { extractedBirthdate: baseAnalysis.extractedBirthdate, extractedAge: baseAnalysis.extractedAge }
    );
    const idNumChk = matchApplicantIdNumberWithId(targetForm.idNumber, baseAnalysis.extractedIdNumber);
    const genderChk = matchApplicantGenderWithId(targetGender, baseAnalysis.extractedGender);
    const civilChk = matchApplicantCivilStatusWithId(targetForm.civilStatus, baseAnalysis.extractedCivilStatus);

    return {
      ...baseAnalysis,
      matchesExpectedSide: sideMatch,
      expectedIdType: targetType,
      matchesExpectedType: typeMatches,
      expectedName: targetName || undefined,
      matchesExpectedName: nameChk.compared
        ? nameChk.matches
        : !(baseAnalysis.extractedName?.trim() && baseAnalysis.matchesExpectedName === false),
      expectedBirthdate: targetForm.birthdate || undefined,
      matchesExpectedBirthdate: dobChk.compared ? dobChk.matches : true,
      matchesExpectedAddress: true,
      expectedIdNumber: targetForm.idNumber.trim() || undefined,
      matchesExpectedIdNumber: idNumChk.compared ? idNumChk.matches : true,
      expectedGender: targetGender || undefined,
      matchesExpectedGender: targetGender && genderChk.compared ? genderChk.matches : true,
      expectedCivilStatus: targetForm.civilStatus,
      matchesExpectedCivilStatus: civilChk.compared ? civilChk.matches : true,
    };
  };

  const scanAndAttachId = async (
    side: 'front' | 'back',
    dataUrl: string,
    fileName: string,
    expectedIdTypeOverride?: string,
    fileSize?: number
  ) => {
    const activeExpectedType = expectedIdTypeOverride || formData.idType;
    const declaredName =
      composeFullLegalName(formData.firstName, formData.middleName, formData.lastName, formData.suffix) ||
      formData.name.trim();
    const declaredGender = formData.gender;

    const otherUrl = side === 'front' ? backIdUrl : frontIdUrl;
    const otherName = side === 'front' ? backIdFileName : frontIdFileName;
    const otherSize = side === 'front' ? backIdFileSize : frontIdFileSize;

    // Pre-scan duplicate check: prevent attaching or scanning the same file/image on both sides
    if (otherUrl) {
      const dupCheck = await checkDuplicateIdImageAttachment({
        candidateDataUrl: dataUrl,
        candidateFileName: fileName,
        candidateFileSize: fileSize,
        otherDataUrl: otherUrl,
        otherFileName: otherName,
        otherFileSize: otherSize,
        otherSideLabel: side === 'front' ? 'Back of ID' : 'Front of ID',
      });
      if (dupCheck.isDuplicate) {
        setSideScanNotice(side, {
          tone: 'error',
          message:
            dupCheck.reason ||
            `Duplicate file blocked: ${side === 'front' ? 'Front' : 'Back'} ID cannot use the same file/photo as ${side === 'front' ? 'Back' : 'Front'} ID. Remove the other side or attach a different photo.`,
        });
        setTouched(prev => ({ ...prev, [side === 'front' ? 'frontIdUrl' : 'backIdUrl']: true }));
        return;
      }
    }

    if (side === 'front') {
      setFrontIdUrl(dataUrl);
      setFrontIdFileName(fileName);
      if (typeof fileSize === 'number') setFrontIdFileSize(fileSize);
      setIsScanningFrontId(true);
    } else {
      setBackIdUrl(dataUrl);
      setBackIdFileName(fileName);
      if (typeof fileSize === 'number') setBackIdFileSize(fileSize);
      setIsScanningBackId(true);
    }
    setSideScanNotice(side, null);
    setErrorMsg('');
    setTouched(prev => ({ ...prev, [side === 'front' ? 'frontIdUrl' : 'backIdUrl']: true }));

    try {
      const analysis = await scanIdPhotoWithClarityAndType({
        dataUrl,
        fileName,
        side,
        expectedIdType: activeExpectedType,
        expectedName: declaredName || undefined,
        firstName: formData.firstName.trim() || undefined,
        middleName: formData.middleName.trim() || undefined,
        lastName: formData.lastName.trim() || undefined,
        suffix: formData.suffix.trim() || undefined,
        expectedBirthdate: formData.birthdate || undefined,
        expectedAge: formData.age,
        expectedIdNumber: formData.idNumber.trim() || undefined,
        expectedGender: declaredGender || undefined,
        expectedCivilStatus: formData.civilStatus,
      });

      const matchesSide =
        (analysis.detectedSide === side ? true : analysis.matchesExpectedSide !== false) &&
        !(side === 'front' && analysis.detectedSide === 'back') &&
        !(side === 'back' && analysis.detectedSide === 'front');
      const otherSideAnalysis = side === 'front' ? backIdAnalysis : idAnalysis;

      const currentForm = formDataRef.current;
      const currentDeclaredName =
        composeFullLegalName(currentForm.firstName, currentForm.middleName, currentForm.lastName, currentForm.suffix) ||
        currentForm.name.trim();
      const resolvedExpectedType = expectedIdTypeOverride || currentForm.idType;

      // Gate 1: Reject unusable / non-ID / blurry / wrong-side scans BEFORE processing
      if (analysis.aiVisionUsed === false && analysis.isId !== false) {
        const unverifiedAnalysis = buildAnalysisForForm(analysis, side, currentForm, resolvedExpectedType);
        if (side === 'front') setIdAnalysis(unverifiedAnalysis);
        else setBackIdAnalysis(unverifiedAnalysis);
        setSideScanNotice(side, {
          tone: 'error',
          message:
            unverifiedAnalysis.warning ||
            `Could not verify ${side === 'front' ? 'Front' : 'Back'} ID photo right now. Please try again.`,
        });
        return;
      }

      if (analysis.isId === false) {
        const nonIdAnalysis = buildAnalysisForForm(analysis, side, currentForm, resolvedExpectedType);
        if (side === 'front') setIdAnalysis(nonIdAnalysis);
        else setBackIdAnalysis(nonIdAnalysis);
        setSideScanNotice(side, {
          tone: 'error',
          message:
            nonIdAnalysis.warning ||
            `${side === 'front' ? 'Front' : 'Back'} photo is not a valid official ID. Please upload your ${resolvedExpectedType}.`,
        });
        return;
      }

      if (!matchesSide) {
        const wrongSideAnalysis = buildAnalysisForForm(analysis, side, currentForm, resolvedExpectedType);
        if (side === 'front') setIdAnalysis(wrongSideAnalysis);
        else setBackIdAnalysis(wrongSideAnalysis);
        setSideScanNotice(side, {
          tone: 'error',
          message:
            wrongSideAnalysis.warning ||
            `${side === 'front' ? 'Front' : 'Back'} ID slot contains the wrong side of the ID. Please attach the ${side === 'front' ? 'Front' : 'Back'} photo.`,
        });
        return;
      }

      if (analysis.isClear === false || analysis.isBlurry) {
        const blurryAnalysis = buildAnalysisForForm(analysis, side, currentForm, resolvedExpectedType);
        if (side === 'front') setIdAnalysis(blurryAnalysis);
        else setBackIdAnalysis(blurryAnalysis);
        setSideScanNotice(side, {
          tone: 'warning',
          message:
            blurryAnalysis.warning ||
            `${side === 'front' ? 'Front' : 'Back'} ID photo is blurry or unreadable. Please try again.`,
        });
        return;
      }

      // Gate 2: Validate ID Type strictly against the user's selected Resident ID Type & profile (never overwrite user selection)
      const detectedLabel = analysis.extractedIdType || analysis.detectedDocType || '';
      const detectedCanon = canonicalizeIdCategory(detectedLabel);
      const userDobAge = computeAgeFromBirthdate(currentForm.birthdate);
      const effectiveAgeAfterScan = userDobAge !== null ? userDobAge : currentForm.age;

      const otherIsValidClear = Boolean(
        otherSideAnalysis &&
          otherSideAnalysis.isId &&
          otherSideAnalysis.isClear &&
          !otherSideAnalysis.isBlurry
      );

      const resolvedProfileCheck = matchIdTypeWithProfile({
        idType: resolvedExpectedType,
        age: effectiveAgeAfterScan,
        isSenior: currentForm.isSenior || effectiveAgeAfterScan >= 60,
      });
      const resolvedCanon = canonicalizeIdCategory(resolvedExpectedType);
      const resolvedTypeMatches = Boolean(
        resolvedProfileCheck.matches &&
          (resolvedCanon && detectedCanon
            ? detectedCanon === resolvedCanon
            : resolvedExpectedType !== activeExpectedType || analysis.matchesExpectedType !== false)
      );

      if (!resolvedProfileCheck.matches) {
        const preCheckAnalysis = buildAnalysisForForm(analysis, side, currentForm, resolvedExpectedType);
        if (side === 'front') setIdAnalysis(preCheckAnalysis);
        else setBackIdAnalysis(preCheckAnalysis);
        setSideScanNotice(side, {
          tone: 'error',
          message:
            resolvedProfileCheck.reason ||
            `Selected Resident ID Type "${resolvedExpectedType}" is invalid for your profile.`,
        });
        return;
      }

      if (!resolvedTypeMatches) {
        const mismatchTypeAnalysis = {
          ...buildAnalysisForForm(analysis, side, currentForm, resolvedExpectedType),
          matchesExpectedType: false,
        };
        if (side === 'front') setIdAnalysis(mismatchTypeAnalysis);
        else setBackIdAnalysis(mismatchTypeAnalysis);
        setSideScanNotice(side, {
          tone: 'error',
          message: `ID mismatch on ${side === 'front' ? 'Front' : 'Back'}: Selected "${resolvedExpectedType}", uploaded "${detectedLabel}". Please upload your ${resolvedExpectedType} and try again.`,
        });
        return;
      }

      // Gate 3: Check cross-side consistency against the other attached valid side
      if (otherIsValidClear && otherSideAnalysis) {
        const expectedIdNumForCrossCheck =
          currentForm.idNumber.trim() ||
          (normalizeIdCode(analysis.extractedIdNumber).length >= 4 ? analysis.extractedIdNumber : undefined);
        const crossCheck = side === 'front'
          ? matchFrontAndBackIdConsistency(analysis, otherSideAnalysis, { expectedIdNumber: expectedIdNumForCrossCheck })
          : matchFrontAndBackIdConsistency(otherSideAnalysis, analysis, { expectedIdNumber: expectedIdNumForCrossCheck });
        if (crossCheck.compared && !crossCheck.matches) {
          const crossMismatchAnalysis = buildAnalysisForForm(analysis, side, currentForm, resolvedExpectedType);
          if (side === 'front') setIdAnalysis(crossMismatchAnalysis);
          else setBackIdAnalysis(crossMismatchAnalysis);
          setSideScanNotice(side, {
            tone: 'error',
            message: crossCheck.reason || 'Front and Back ID photos do not belong to the same ID card.',
          });
          return;
        }
      }

      // Gate 4: Auto-fill ONLY ID Number, Complete Residential Address, and Purok / Zone of Residence
      // (All other user inputs — Legal Name, Birthdate, Age, Sex/Gender, Civil Status, ID Type, Special Assistance — stay strictly manual.)
      const updates: Partial<typeof formData> = {};
      const autoFilled: string[] = [];

      // 4a. ID Number / Control No.
      const ignoreIdTokens = new Set(['NONE', 'NA', 'VERIFIED', 'UNKNOWN', 'PENDING']);
      const normalizedExtIdNum = normalizeIdCode(analysis.extractedIdNumber);
      if (
        analysis.extractedIdNumber &&
        normalizedExtIdNum.length >= 4 &&
        !ignoreIdTokens.has(normalizedExtIdNum)
      ) {
        const cleanExtIdNum = analysis.extractedIdNumber.trim();
        if (
          !currentForm.idNumber.trim() ||
          isIdNumberPrefixMatch(currentForm.idNumber, cleanExtIdNum) ||
          !idNumberManuallyEditedRef.current
        ) {
          if (currentForm.idNumber.trim() !== cleanExtIdNum) {
            updates.idNumber = cleanExtIdNum;
            autoFilled.push('ID Number');
          }
        }
      }

      // 4b. Complete Residential Address
      const cleanExtAddr = String(analysis.extractedAddress || '').trim();
      if (cleanExtAddr.length >= 4) {
        if (!currentForm.address.trim() || !addressManuallyEditedRef.current) {
          if (currentForm.address.trim() !== cleanExtAddr) {
            updates.address = cleanExtAddr;
            autoFilled.push('Complete Residential Address');
          }
        }
      }

      // 4c. Purok / Zone of Residence (parsed from extractedAddress)
      const matchedPurok = extractBugoPurokFromAddress(cleanExtAddr);
      if (matchedPurok && !purokManuallyEditedRef.current && currentForm.purok !== matchedPurok) {
        updates.purok = matchedPurok;
        autoFilled.push('Purok / Zone of Residence');
      }

      const nextForm = Object.keys(updates).length > 0 ? { ...currentForm, ...updates } : currentForm;
      if (Object.keys(updates).length > 0) {
        formDataRef.current = nextForm;
        setFormData(prev => ({ ...prev, ...updates }));
      }

      // Gate 5: Validate attached ID strictly against the user's filled-out info (no auto-correcting mismatches)
      const finalAnalysis = buildAnalysisForForm(analysis, side, nextForm, resolvedExpectedType);
      const updatedOtherAnalysis =
        otherSideAnalysis && Object.keys(updates).length > 0
          ? buildAnalysisForForm(otherSideAnalysis, side === 'front' ? 'back' : 'front', nextForm, resolvedExpectedType)
          : otherSideAnalysis;

      if (side === 'front') {
        setIdAnalysis(finalAnalysis);
        if (updatedOtherAnalysis && Object.keys(updates).length > 0) {
          setBackIdAnalysis(updatedOtherAnalysis);
        }
      } else {
        setBackIdAnalysis(finalAnalysis);
        if (updatedOtherAnalysis && Object.keys(updates).length > 0) {
          setIdAnalysis(updatedOtherAnalysis);
        }
      }

      const sideLabel = side === 'front' ? 'Front ID' : 'Back ID';
      const activeFrontAnalysis = side === 'front' ? finalAnalysis : (updatedOtherAnalysis || idAnalysis);
      const activeBackAnalysis = side === 'back' ? finalAnalysis : (updatedOtherAnalysis || backIdAnalysis);
      const nextFullName =
        composeFullLegalName(nextForm.firstName, nextForm.middleName, nextForm.lastName, nextForm.suffix) ||
        nextForm.name.trim();
      const missingBothNames = Boolean(
        activeFrontAnalysis &&
          activeBackAnalysis &&
          activeFrontAnalysis.isId !== false &&
          activeBackAnalysis.isId !== false &&
          activeFrontAnalysis.isClear !== false &&
          activeBackAnalysis.isClear !== false &&
          activeFrontAnalysis.matchesExpectedSide !== false &&
          activeBackAnalysis.matchesExpectedSide !== false &&
          (!activeFrontAnalysis.extractedName || activeFrontAnalysis.extractedName.trim().split(/\s+/).filter(Boolean).length < 2) &&
          (!activeBackAnalysis.extractedName || activeBackAnalysis.extractedName.trim().split(/\s+/).filter(Boolean).length < 2)
      );

      const mismatchReasons: string[] = [];
      if (finalAnalysis.matchesExpectedName === false) {
        mismatchReasons.push(
          `Name on ID${finalAnalysis.extractedName ? ` ("${finalAnalysis.extractedName}")` : ''} does not match "${currentDeclaredName || nextFullName}"`
        );
      }
      if (finalAnalysis.matchesExpectedBirthdate === false) {
        mismatchReasons.push(
          `Birthdate/Age on ID${finalAnalysis.extractedBirthdate ? ` (${finalAnalysis.extractedBirthdate})` : ''} does not match your entered Birthdate/Age`
        );
      }
      if (finalAnalysis.matchesExpectedIdNumber === false) {
        mismatchReasons.push(
          `ID Number on ID${finalAnalysis.extractedIdNumber ? ` (${finalAnalysis.extractedIdNumber})` : ''} does not match "${nextForm.idNumber.trim()}"`
        );
      }
      if (finalAnalysis.matchesExpectedGender === false) {
        mismatchReasons.push(
          `Sex/Gender on ID (${finalAnalysis.extractedGender}) does not match "${nextForm.gender}"`
        );
      }
      if (finalAnalysis.matchesExpectedCivilStatus === false) {
        mismatchReasons.push(
          `Civil Status on ID (${finalAnalysis.extractedCivilStatus}) does not match "${nextForm.civilStatus}"`
        );
      }
      if (missingBothNames) {
        mismatchReasons.push('Could not read a valid full cardholder name on either Front or Back ID');
      }

      const hasRequiredInputsAfterScan = Boolean(
        nextForm.firstName.trim() &&
          nextForm.lastName.trim() &&
          nextForm.birthdate &&
          nextForm.gender &&
          nextForm.idNumber.trim()
      );

      if (mismatchReasons.length > 0) {
        setSideScanNotice(side, {
          tone: 'error',
          message: `Attached ${sideLabel} does not match your filled-out info: ${mismatchReasons[0]}. Update your form details or attach your matching ID.`,
        });
      } else if (!hasRequiredInputsAfterScan) {
        setSideScanNotice(side, {
          tone: 'warning',
          message: `${sideLabel} scanned clearly${autoFilled.length > 0 ? ` (Auto-filled: ${autoFilled.join(', ')})` : ''}. Complete your Name, Birthdate, Sex/Gender, and ID Number so the attached ID can be verified against your inputs.`,
        });
      } else if (autoFilled.length > 0) {
        setSideScanNotice(side, {
          tone: 'success',
          message: `Matched "${resolvedExpectedType}" (${sideLabel}) & auto-filled: ${autoFilled.join(', ')}.`,
        });
      } else {
        setSideScanNotice(side, {
          tone: 'success',
          message: `Verified "${resolvedExpectedType}" (${sideLabel})${
            finalAnalysis.extractedName
              ? ` • ${finalAnalysis.extractedName}`
              : finalAnalysis.extractedIdNumber
                ? ` • ${finalAnalysis.extractedIdNumber}`
                : ''
          }.`,
        });
      }
    } catch {
      const failedAnalysis: IdPhotoAnalysis = {
        isId: false,
        isClear: false,
        detectedDocType: 'Verification Failed',
        expectedIdType: activeExpectedType,
        matchesExpectedType: false,
        expectedName: declaredName || undefined,
        matchesExpectedName: false,
        matchesExpectedBirthdate: false,
        matchesExpectedAddress: false,
        matchesExpectedIdNumber: false,
        matchesExpectedGender: false,
        matchesExpectedCivilStatus: false,
        aiVisionUsed: false,
        warning: 'Could not verify ID photo. Please try again.',
        advice: `Please attach a clear photo of your ${activeExpectedType}.`,
        score: 0
      };
      if (side === 'front') setIdAnalysis(failedAnalysis);
      else setBackIdAnalysis(failedAnalysis);
      setSideScanNotice(side, {
        tone: 'error',
        message: `Could not verify ${side === 'front' ? 'Front' : 'Back'} ID photo. Please try again.`,
      });
    } finally {
      if (side === 'front') setIsScanningFrontId(false);
      else setIsScanningBackId(false);
    }
  };

  const handleSelectedIdTypeChange = async (nextIdType: string) => {
    setFormData(prev => ({ ...prev, idType: nextIdType }));
    if (frontIdUrl) {
      await scanAndAttachId('front', frontIdUrl, frontIdFileName || 'front-id.jpg', nextIdType, frontIdFileSize);
    }
    if (backIdUrl) {
      await scanAndAttachId('back', backIdUrl, backIdFileName || 'back-id.jpg', nextIdType, backIdFileSize);
    }
  };

  const handleIdFileSelect = async (side: 'front' | 'back', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const dataUrl = await compressImageFile(file);
      await scanAndAttachId(side, dataUrl, file.name, undefined, file.size);
    } catch {
      setSideScanNotice(side, {
        tone: 'error',
        message: 'Unable to process selected image. Please try again.',
      });
    }
  };

  const openCameraScanner = async (side: 'front' | 'back') => {
    setCameraTargetSide(side);
    setCameraError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      cameraFallbackInputRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      setIsCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 60);
    } catch {
      setCameraError('Camera unavailable. Please attach a photo instead.');
      cameraFallbackInputRef.current?.click();
    }
  };

  const captureFromCamera = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const width = video.videoWidth || 960;
    const height = video.videoHeight || 600;
    const maxDim = 1400;
    const scale = width > maxDim ? maxDim / width : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const target = cameraTargetSide;
    stopCamera();
    await scanAndAttachId(target, dataUrl, `scanned-${target}-id-${Date.now()}.jpg`);
  };

  // Password Strength Evaluation
  const passwordStrength = evaluatePasswordStrength(formData.password);

  // Automated Age Profiling Sync
  const handleAgeChange = (val: number) => {
    const ageNum = Math.max(0, Math.min(120, val || 0));
    const isSen = ageNum >= 60;
    const isTeen = ageNum >= 13 && ageNum <= 19;
    setFormData(prev => ({
      ...prev,
      age: ageNum,
      isSenior: isSen,
      isTeenager: isTeen,
      ...(isSen && !prev.idType ? { idType: 'Senior Citizen OSCA ID' } : {})
    }));
  };

  // Automated Occupation & Student Profiling Sync
  const handleOccupationChange = (val: string) => {
    const lower = val.toLowerCase();
    const isStud = lower.includes('student');
    const isUnemployed = lower.includes('unemployed') || lower.includes('jobseeker') || lower.includes('fresh graduate');
    const isRet = lower.includes('retired') || lower.includes('pensioner');
    const isFullTime = lower.includes('private sector') || lower.includes('government') || lower.includes('factory');
    const isPartTime = lower.includes('daily wage') || lower.includes('construction') || lower.includes('domestic');
    const isSelfEmp = lower.includes('vendor') || lower.includes('store') || lower.includes('entrepreneur') || lower.includes('self-employed') || lower.includes('farmer') || lower.includes('fisher') || lower.includes('artisan') || lower.includes('driver');

    setFormData(prev => ({
      ...prev,
      occupation: val,
      employmentStatus: isStud
        ? 'Student'
        : isUnemployed
          ? 'Unemployed'
          : isRet
            ? 'Retired'
            : isFullTime
              ? 'Employed (Full-Time)'
              : isPartTime
                ? 'Employed (Part-Time)'
                : isSelfEmp
                  ? 'Self-Employed'
                  : prev.employmentStatus,
      ...(isStud ? { isStudent: true } : {})
    }));
  };

  const handleOccupationSelectChange = (selected: string) => {
    setOccupationChoice(selected);
    setTouched(prev => ({ ...prev, occupation: true }));
    if (selected === 'Others') {
      handleOccupationChange(customOccupation);
    } else {
      setCustomOccupation('');
      handleOccupationChange(selected);
    }
  };

  // Validation rules
  const errors: Record<string, string> = {};

  const composedName = composeFullLegalName(
    formData.firstName,
    formData.middleName,
    formData.lastName,
    formData.suffix
  );
  const cleanName = composedName || formData.name.trim();

  if (!formData.firstName.trim()) {
    errors.firstName = 'First Name is required.';
  } else if (/[0-9]/.test(formData.firstName)) {
    errors.firstName = 'Cannot contain numbers.';
  }
  if (!formData.lastName.trim()) {
    errors.lastName = 'Last Name is required.';
  } else if (/[0-9]/.test(formData.lastName)) {
    errors.lastName = 'Cannot contain numbers.';
  }
  if (!cleanName) {
    errors.name = 'Full legal name is required.';
  } else if (cleanName.split(/\s+/).length < 2) {
    errors.name = 'Must contain both first name and last name.';
  } else if (/[0-9]/.test(cleanName)) {
    errors.name = 'Name cannot contain numbers.';
  }

  if (!formData.birthdate) {
    errors.birthdate = 'Birthdate is required.';
  } else {
    const computed = computeAgeFromBirthdate(formData.birthdate);
    if (computed === null) {
      errors.birthdate = 'Enter a valid birthdate.';
    } else if (Math.abs(formData.age - computed) > 1) {
      errors.age = `Age (${formData.age}) must match Birthdate (age ${computed}).`;
    }
  }

  if (!formData.gender) {
    errors.gender = 'Please select your Sex / Gender.';
  }

  const cleanEmail = normalizeAccountEmail(formData.email);
  if (!cleanEmail) {
    errors.email = 'Gmail or Bugo email username is required.';
  } else if (!isAllowedAccountEmail(cleanEmail)) {
    errors.email = ALLOWED_EMAIL_DOMAIN_MESSAGE;
  } else if (
    (residentsList || []).some(
      u =>
        normalizeAccountEmail(u.email) === cleanEmail ||
        normalizeAccountEmail(u.username) === cleanEmail
    )
  ) {
    errors.email = 'This Gmail / email is already registered. Please sign in instead.';
  }

  const phoneCheck = normalizePhMobileNumber(formData.contactNumber);
  if (!formData.contactNumber.trim()) {
    errors.contactNumber = 'Philippine mobile number is required.';
  } else if (!phoneCheck.valid) {
    errors.contactNumber = phoneCheck.reason || 'Must be a real 11-digit mobile starting with 09 (e.g. 0917 628 4915).';
  }

  if (!formData.address.trim()) {
    errors.address = 'Residential street address is required.';
  } else if (formData.address.trim().length < 5) {
    errors.address = 'Address is too short. Specify house/street details.';
  }

  if (!formData.idNumber.trim()) {
    errors.idNumber = 'Government / Resident ID Number is required for identity records.';
  }

  const declaredGender = formData.gender || (effectiveGender === 'male' ? 'Male' : 'Female');
  const profileIdTypeCheck = matchIdTypeWithProfile({
    idType: formData.idType,
    age: formData.age,
    isSenior: formData.isSenior,
  });
  if (!profileIdTypeCheck.matches) {
    errors.idType = profileIdTypeCheck.reason || 'Selected Resident ID Type is invalid for your age/profile.';
  }

  const isDuplicateIdPhoto = Boolean(
    frontIdUrl && backIdUrl && frontIdUrl.length > 500 && frontIdUrl === backIdUrl
  );

  const isFrontUnverified = Boolean(idAnalysis && idAnalysis.aiVisionUsed === false && idAnalysis.isId !== false);
  const isBackUnverified = Boolean(backIdAnalysis && backIdAnalysis.aiVisionUsed === false && backIdAnalysis.isId !== false);

  const isFrontSideMismatch = Boolean(
    idAnalysis && (idAnalysis.matchesExpectedSide === false || idAnalysis.detectedSide === 'back')
  );
  const isBackSideMismatch = Boolean(
    backIdAnalysis && (backIdAnalysis.matchesExpectedSide === false || backIdAnalysis.detectedSide === 'front')
  );

  const selectedIdCanon = canonicalizeIdCategory(formData.idType);
  const frontDetectedCanon = canonicalizeIdCategory(idAnalysis?.extractedIdType || idAnalysis?.detectedDocType);
  const backDetectedCanon = canonicalizeIdCategory(backIdAnalysis?.extractedIdType || backIdAnalysis?.detectedDocType);

  const isFrontTypeMismatch = Boolean(
    idAnalysis &&
      (!profileIdTypeCheck.matches ||
        (selectedIdCanon && frontDetectedCanon
          ? frontDetectedCanon !== selectedIdCanon
          : (idAnalysis.photoMatchesExpectedType !== undefined
              ? idAnalysis.photoMatchesExpectedType === false
              : idAnalysis.matchesExpectedType === false)))
  );
  const isBackTypeMismatch = Boolean(
    backIdAnalysis &&
      (!profileIdTypeCheck.matches ||
        (selectedIdCanon && backDetectedCanon
          ? backDetectedCanon !== selectedIdCanon
          : (backIdAnalysis.photoMatchesExpectedType !== undefined
              ? backIdAnalysis.photoMatchesExpectedType === false
              : backIdAnalysis.matchesExpectedType === false)))
  );

  const frontNameMatch = matchApplicantNameWithId(
    {
      firstName: formData.firstName,
      middleName: formData.middleName,
      lastName: formData.lastName,
      suffix: formData.suffix,
      fullName: cleanName,
    },
    idAnalysis?.extractedName
  );
  const backNameMatch = matchApplicantNameWithId(
    {
      firstName: formData.firstName,
      middleName: formData.middleName,
      lastName: formData.lastName,
      suffix: formData.suffix,
      fullName: cleanName,
    },
    backIdAnalysis?.extractedName
  );

  const frontHasFullName = Boolean(
    idAnalysis?.extractedName && idAnalysis.extractedName.trim().split(/\s+/).filter(Boolean).length >= 2
  );
  const backHasFullName = Boolean(
    backIdAnalysis?.extractedName && backIdAnalysis.extractedName.trim().split(/\s+/).filter(Boolean).length >= 2
  );
  const isBothSidesMissingName = Boolean(
    idAnalysis &&
      backIdAnalysis &&
      idAnalysis.isId !== false &&
      backIdAnalysis.isId !== false &&
      idAnalysis.isClear !== false &&
      backIdAnalysis.isClear !== false &&
      !isFrontSideMismatch &&
      !isBackSideMismatch &&
      idAnalysis.aiVisionUsed !== false &&
      backIdAnalysis.aiVisionUsed !== false &&
      !frontHasFullName &&
      !backHasFullName
  );

  const isFrontNameMismatch = Boolean(
    idAnalysis &&
      (frontNameMatch.compared
        ? !frontNameMatch.matches
        : (Boolean(idAnalysis.extractedName?.trim()) && idAnalysis.matchesExpectedName === false))
  );
  const isBackNameMismatch = Boolean(
    backIdAnalysis &&
      (backNameMatch.compared
        ? !backNameMatch.matches
        : (Boolean(backIdAnalysis.extractedName?.trim()) && backIdAnalysis.matchesExpectedName === false))
  );

  const frontDobMatch = matchApplicantBirthdateWithId(
    { birthdate: formData.birthdate, age: formData.age },
    { extractedBirthdate: idAnalysis?.extractedBirthdate, extractedAge: idAnalysis?.extractedAge }
  );
  const backDobMatch = matchApplicantBirthdateWithId(
    { birthdate: formData.birthdate, age: formData.age },
    { extractedBirthdate: backIdAnalysis?.extractedBirthdate, extractedAge: backIdAnalysis?.extractedAge }
  );
  const isFrontDobMismatch = Boolean(idAnalysis && frontDobMatch.compared && !frontDobMatch.matches);
  const isBackDobMismatch = Boolean(backIdAnalysis && backDobMatch.compared && !backDobMatch.matches);

  const idNumAcrossSides = matchApplicantIdNumberAcrossSides(
    formData.idNumber,
    idAnalysis?.extractedIdNumber,
    backIdAnalysis?.extractedIdNumber
  );
  const isFrontIdNumMismatch = Boolean(idAnalysis && idNumAcrossSides.frontMismatch);
  const isBackIdNumMismatch = Boolean(backIdAnalysis && idNumAcrossSides.backMismatch);

  const frontGenderMatch = matchApplicantGenderWithId(formData.gender, idAnalysis?.extractedGender);
  const backGenderMatch = matchApplicantGenderWithId(formData.gender, backIdAnalysis?.extractedGender);
  const isFrontGenderMismatch = Boolean(idAnalysis && frontGenderMatch.compared && !frontGenderMatch.matches);
  const isBackGenderMismatch = Boolean(backIdAnalysis && backGenderMatch.compared && !backGenderMatch.matches);

  const frontCivilMatch = matchApplicantCivilStatusWithId(formData.civilStatus, idAnalysis?.extractedCivilStatus);
  const backCivilMatch = matchApplicantCivilStatusWithId(formData.civilStatus, backIdAnalysis?.extractedCivilStatus);
  const isFrontCivilMismatch = Boolean(idAnalysis && frontCivilMatch.compared && !frontCivilMatch.matches);
  const isBackCivilMismatch = Boolean(backIdAnalysis && backCivilMatch.compared && !backCivilMatch.matches);

  const crossSideConsistency = matchFrontAndBackIdConsistency(idAnalysis, backIdAnalysis, {
    expectedIdNumber: formData.idNumber.trim() || undefined,
  });
  const isCrossSideMismatch = Boolean(crossSideConsistency.compared && !crossSideConsistency.matches);

  if (isFrontNameMismatch || isBackNameMismatch) {
    const nameErr =
      (isFrontNameMismatch && frontNameMatch.reason) ||
      (isBackNameMismatch && backNameMatch.reason) ||
      'Name does not match attached ID.';
    if (!errors.firstName) errors.firstName = 'Does not match ID name.';
    if (!errors.lastName) errors.lastName = nameErr;
  }
  if (!errors.birthdate && (isFrontDobMismatch || isBackDobMismatch)) {
    errors.birthdate = (isFrontDobMismatch ? frontDobMatch.reason : backDobMatch.reason) || 'Birthdate does not match attached ID.';
  }
  if (!errors.idNumber && (isFrontIdNumMismatch || isBackIdNumMismatch)) {
    errors.idNumber = idNumAcrossSides.reason || 'ID Number does not match attached ID.';
  }
  if (!errors.gender && (isFrontGenderMismatch || isBackGenderMismatch)) {
    errors.gender = (isFrontGenderMismatch ? frontGenderMatch.reason : backGenderMatch.reason) || 'Sex/Gender does not match attached ID.';
  }
  if (!errors.civilStatus && (isFrontCivilMismatch || isBackCivilMismatch)) {
    errors.civilStatus = (isFrontCivilMismatch ? frontCivilMatch.reason : backCivilMatch.reason) || 'Civil Status does not match attached ID.';
  }

  const frontFieldMismatchMessage = isFrontUnverified
    ? (idAnalysis?.warning || 'Front ID could not be verified. Please re-attach and try again.')
    : isFrontSideMismatch
    ? 'Front ID slot contains the Back side of an ID. Please attach the actual Front photo.'
    : isFrontTypeMismatch
    ? (profileIdTypeCheck.reason || `ID mismatch: expected ${formData.idType}, found ${idAnalysis?.extractedIdType || idAnalysis?.detectedDocType}. Please try again.`)
    : isFrontNameMismatch
    ? (frontNameMatch.reason || `Name mismatch: Front ID name${idAnalysis?.extractedName ? ` ("${idAnalysis.extractedName}")` : ''} does not match "${cleanName}".`)
    : isFrontDobMismatch
    ? (frontDobMatch.reason || 'Birthdate does not match Front ID.')
    : isFrontIdNumMismatch
    ? (idNumAcrossSides.reason || 'ID Number does not match Front ID.')
    : isFrontGenderMismatch
    ? (frontGenderMatch.reason || 'Gender does not match Front ID.')
    : isFrontCivilMismatch
    ? (frontCivilMatch.reason || 'Civil Status does not match Front ID.')
    : '';

  const backFieldMismatchMessage = isDuplicateIdPhoto
    ? 'Back ID cannot be identical to Front ID. Please attach the actual Back photo.'
    : isBackUnverified
    ? (backIdAnalysis?.warning || 'Back ID could not be verified. Please re-attach and try again.')
    : isBackSideMismatch
    ? 'Back ID slot contains the Front side of an ID. Please attach the actual Back photo.'
    : isBackTypeMismatch
    ? (profileIdTypeCheck.reason || `ID mismatch: expected ${formData.idType}, found ${backIdAnalysis?.extractedIdType || backIdAnalysis?.detectedDocType}. Please try again.`)
    : isBothSidesMissingName
    ? 'Could not read the cardholder name on either Front or Back ID. Please upload a clear ID photo showing your full name.'
    : isBackNameMismatch
    ? (backNameMatch.reason || `Name mismatch: Back ID name${backIdAnalysis?.extractedName ? ` ("${backIdAnalysis.extractedName}")` : ''} does not match "${cleanName}".`)
    : isBackDobMismatch
    ? (backDobMatch.reason || 'Birthdate does not match Back ID.')
    : isBackIdNumMismatch
    ? (idNumAcrossSides.reason || 'ID Number does not match Back ID.')
    : isBackGenderMismatch
    ? (backGenderMatch.reason || 'Gender does not match Back ID.')
    : isBackCivilMismatch
    ? (backCivilMatch.reason || 'Civil Status does not match Back ID.')
    : isCrossSideMismatch
    ? (crossSideConsistency.reason || 'Front and Back ID photos do not belong to the same ID card.')
    : '';

  if (!frontIdUrl) {
    errors.frontIdUrl = `Attach Front photo of your ${formData.idType}.`;
  } else if (idAnalysis && idAnalysis.isId === false) {
    errors.frontIdUrl = idAnalysis.warning || 'Front photo is not a valid ID. Please try again.';
  } else if (idAnalysis && (idAnalysis.isClear === false || idAnalysis.isBlurry)) {
    errors.frontIdUrl = 'Front ID is blurry or unclear. Please try again.';
  } else if (frontFieldMismatchMessage) {
    errors.frontIdUrl = frontFieldMismatchMessage;
  }

  if (!backIdUrl) {
    errors.backIdUrl = `Attach Back photo of your ${formData.idType}.`;
  } else if (backIdAnalysis && backIdAnalysis.isId === false) {
    errors.backIdUrl = backIdAnalysis.warning || 'Back photo is not a valid ID. Please try again.';
  } else if (backIdAnalysis && (backIdAnalysis.isClear === false || backIdAnalysis.isBlurry)) {
    errors.backIdUrl = 'Back ID is blurry or unclear. Please try again.';
  } else if (backFieldMismatchMessage) {
    errors.backIdUrl = backFieldMismatchMessage;
  }

  if (!occupationChoice) {
    errors.occupation = 'Please select your occupation / livelihood.';
  } else if (occupationChoice === 'Others' && !formData.occupation.trim()) {
    errors.occupation = 'Please specify your occupation / livelihood.';
  }

  if (formData.isPwd && !formData.pwdIdNumber.trim()) {
    errors.pwdIdNumber = 'PWD ID or medical control number is required.';
  }

  if (formData.isSoloParent && !formData.soloParentIdNumber.trim()) {
    errors.soloParentIdNumber = 'Solo Parent ID or DSWD Case control number is required.';
  }

  if (!formData.password) {
    errors.password = 'Password is required.';
  } else if (!passwordStrength.isValid) {
    errors.password = passwordStrength.errorMessage || 'Password must meet all strong security criteria.';
  }

  if (!formData.confirmPassword) {
    errors.confirmPassword = 'Confirm your password.';
  } else if (formData.password !== formData.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  if (!formData.agreeTerms) {
    errors.agreeTerms = 'You must agree to the Terms of Service.';
  }
  if (!formData.agreePrivacy) {
    errors.agreePrivacy = 'You must consent to the Data Privacy Act.';
  }
  if (!formData.agreeTruthfulness) {
    errors.agreeTruthfulness = 'You must certify the truthfulness of your submission.';
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.startsWith('639')) {
      val = `0${val.slice(2)}`;
    }
    if (val.length > 11) val = val.slice(0, 11);
    setFormData(prev => ({ ...prev, contactNumber: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      firstName: true,
      lastName: true,
      birthdate: true,
      age: true,
      gender: true,
      civilStatus: true,
      name: true,
      email: true,
      contactNumber: true,
      address: true,
      idType: true,
      idNumber: true,
      frontIdUrl: true,
      backIdUrl: true,
      occupation: true,
      pwdIdNumber: true,
      soloParentIdNumber: true,
      password: true,
      confirmPassword: true,
      agreeTerms: true,
      agreePrivacy: true,
      agreeTruthfulness: true
    });

    if (Object.keys(errors).length > 0) {
      const orderedErrorKeys = [
        'firstName',
        'lastName',
        'name',
        'email',
        'contactNumber',
        'address',
        'birthdate',
        'age',
        'civilStatus',
        'gender',
        'occupation',
        'idType',
        'idNumber',
        'frontIdUrl',
        'backIdUrl',
        'pwdIdNumber',
        'soloParentIdNumber',
        'password',
        'confirmPassword',
        'agreeTerms',
        'agreePrivacy',
        'agreeTruthfulness',
      ];
      const activeKeys = orderedErrorKeys.filter((k) => Boolean(errors[k]));
      const fallbackKey = Object.keys(errors)[0];
      const firstKey = activeKeys[0] || fallbackKey;
      const firstErr = (firstKey && errors[firstKey]) || 'Please review the form and resolve the highlighted invalid or mismatched fields.';
      const remainingCount = Math.max(0, Object.keys(errors).length - 1);
      setErrorMsg(
        remainingCount > 0
          ? `${firstErr} (${remainingCount} other highlighted field${remainingCount > 1 ? 's' : ''} also need attention.)`
          : firstErr
      );
      if (typeof window !== 'undefined') {
        requestAnimationFrame(() => {
          const el =
            document.querySelector('[data-reg-field-error="true"]') ||
            document.querySelector('[data-reg-error-banner="true"]');
          if (el && typeof el.scrollIntoView === 'function') {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      }
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const finalAvatar = selectedAvatarUrl || defaultMatchedAvatar;
      const numericAge = Number(formData.age);

      const res = await registerResidentAccount({
        firstName: formData.firstName.trim(),
        middleName: formData.middleName.trim(),
        lastName: formData.lastName.trim(),
        suffix: formData.suffix.trim(),
        birthdate: formData.birthdate,
        name: cleanName,
        email: formData.email.trim(),
        contactNumber: phoneCheck.local09 || formData.contactNumber.trim(),
        nationality: 'Filipino',
        purok: formData.purok,
        address: formData.address.trim(),
        householdIncome: formData.householdIncome,
        familyMembersCount: Number(formData.familyMembersCount) || 4,
        occupation: formData.occupation.trim(),
        employmentStatus: formData.employmentStatus,
        age: Number.isFinite(numericAge) ? numericAge : 28,
        gender: declaredGender,
        civilStatus: formData.civilStatus,
        idType: formData.idType,
        idNumber: formData.idNumber.trim(),
        frontIdUrl,
        backIdUrl,
        idPhotoAnalysis: idAnalysis
          ? {
              ...idAnalysis,
              expectedIdType: formData.idType,
              matchesExpectedType: !isFrontTypeMismatch,
              matchesExpectedSide: !isFrontSideMismatch,
              expectedName: cleanName,
              matchesExpectedName: !isFrontNameMismatch,
              expectedBirthdate: formData.birthdate,
              matchesExpectedBirthdate: !isFrontDobMismatch,
              expectedIdNumber: formData.idNumber.trim(),
              matchesExpectedIdNumber: !isFrontIdNumMismatch,
              matchesExpectedAddress: true,
              expectedGender: declaredGender,
              matchesExpectedGender: !isFrontGenderMismatch,
              expectedCivilStatus: formData.civilStatus,
              matchesExpectedCivilStatus: !isFrontCivilMismatch,
            }
          : undefined,
        backIdPhotoAnalysis: backIdAnalysis
          ? {
              ...backIdAnalysis,
              expectedIdType: formData.idType,
              matchesExpectedType: !isBackTypeMismatch,
              matchesExpectedSide: !isBackSideMismatch,
              expectedName: cleanName,
              matchesExpectedName: !isBackNameMismatch,
              expectedBirthdate: formData.birthdate,
              matchesExpectedBirthdate: !isBackDobMismatch,
              expectedIdNumber: formData.idNumber.trim(),
              matchesExpectedIdNumber: !isBackIdNumMismatch,
              matchesExpectedAddress: true,
              expectedGender: declaredGender,
              matchesExpectedGender: !isBackGenderMismatch,
              expectedCivilStatus: formData.civilStatus,
              matchesExpectedCivilStatus: !isBackCivilMismatch,
            }
          : undefined,
        idDocumentUrl: frontIdUrl,
        avatarUrl: finalAvatar,
        voterStatus: 'Registered',
        // Household Profiling Categories
        isPwd: formData.isPwd,
        pwdIdNumber: formData.pwdIdNumber.trim(),
        pwdDisabilityType: formData.pwdDisabilityType,
        isSoloParent: formData.isSoloParent,
        soloParentIdNumber: formData.soloParentIdNumber.trim(),
        isSenior: formData.isSenior,
        seniorIdNumber: formData.seniorIdNumber.trim(),
        isStudent: formData.isStudent,
        schoolName: formData.schoolName.trim(),
        studentLevel: formData.studentLevel,
        isTeenager: formData.isTeenager,
        hasMedicalNeed: formData.hasMedicalNeed,
        medicalConditionNote: formData.medicalConditionNote.trim(),
        isDisasterAffected: formData.isDisasterAffected,
        disasterType: formData.disasterType,
        yearsOfResidency: Number(formData.yearsOfResidency) || 1,
        password: formData.password
      });

      if (!res.success) {
        setErrorMsg(res.message || 'Registration failed. Please try again.');
      }
    } catch {
      setErrorMsg('Network error occurred during registration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasFrontFieldMismatch =
    isFrontUnverified ||
    isFrontSideMismatch ||
    isFrontTypeMismatch ||
    isFrontNameMismatch ||
    isFrontDobMismatch ||
    isFrontIdNumMismatch ||
    isFrontGenderMismatch ||
    isFrontCivilMismatch;
  const hasBackFieldMismatch =
    isDuplicateIdPhoto ||
    isBackUnverified ||
    isBackSideMismatch ||
    isBackTypeMismatch ||
    isBothSidesMissingName ||
    isBackNameMismatch ||
    isBackDobMismatch ||
    isBackIdNumMismatch ||
    isBackGenderMismatch ||
    isBackCivilMismatch ||
    isCrossSideMismatch;

  const hasRequiredIdentityInputs = Boolean(
    formData.firstName.trim() &&
      formData.lastName.trim() &&
      formData.birthdate &&
      formData.gender &&
      formData.idNumber.trim()
  );

  const isFrontIdQualified = Boolean(
    frontIdUrl &&
      idAnalysis &&
      idAnalysis.isId &&
      idAnalysis.isClear &&
      !idAnalysis.isBlurry &&
      !hasFrontFieldMismatch &&
      hasRequiredIdentityInputs
  );
  const isBackIdQualified = Boolean(
    backIdUrl &&
      backIdAnalysis &&
      backIdAnalysis.isId &&
      backIdAnalysis.isClear &&
      !backIdAnalysis.isBlurry &&
      !hasBackFieldMismatch &&
      hasRequiredIdentityInputs
  );

  const getFieldClass = (field: string) => {
    const isRed = touched[field] && Boolean(errors[field]);
    if (isRed) {
      return 'w-full bg-rose-50/50 border-2 border-rose-500 text-rose-950 rounded-xl px-3.5 py-2.5 font-medium outline-none ring-2 ring-rose-200 placeholder-rose-400 text-xs sm:text-sm transition';
    }
    return 'w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-xl px-3.5 py-2.5 font-medium outline-none focus:ring-2 focus:ring-[#0c532b] focus:bg-white text-xs sm:text-sm transition';
  };

  return (
    <div className="min-h-screen bg-[#f0f4f9] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      {/* Top Header Logo & Left-aligned Back Button */}
      <div className="sm:mx-auto sm:w-full sm:max-w-xl mb-6">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setAuthView('welcome')}
            className="p-2.5 rounded-full bg-white hover:bg-emerald-50 text-gray-700 hover:text-[#0c532b] border border-gray-200 shadow-xs transition-all cursor-pointer"
            title="Back to Portal Home"
            aria-label="Back to Portal Home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10" /> {/* Spacer for balance */}
        </div>

        <div className="text-center">
          <div className="flex justify-center mb-2">
            <BugoSealEmblem sizePx={56} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Create Resident Account
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Barangay Bugo, Cagayan de Oro City Citizen Portal
          </p>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-xl border border-gray-200 rounded-3xl space-y-6">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {errorMsg && (
                <div
                  data-reg-error-banner="true"
                  className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl text-xs text-rose-800 font-semibold flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Split Legal Name Inputs: First Name, Middle Name, Last Name, Suffix */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between items-center mb-1 gap-2">
                      <label className="block text-xs font-bold text-gray-700 shrink-0">
                        First Name <span className="text-rose-500">*</span>
                      </label>
                      {(touched.firstName || isFrontNameMismatch || isBackNameMismatch) && errors.firstName && (
                        <span className="text-[11px] font-bold text-rose-600 text-right">{errors.firstName}</span>
                      )}
                    </div>
                    <div className="relative">
                      <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={formData.firstName}
                        placeholder="e.g. Joshua"
                        onBlur={() => setTouched(prev => ({ ...prev, firstName: true }))}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            firstName: val,
                            name: composeFullLegalName(val, prev.middleName, prev.lastName, prev.suffix)
                          }));
                        }}
                        className={`${getFieldClass('firstName')} pl-10`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Middle Name <span className="text-gray-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.middleName}
                      placeholder="e.g. Abella"
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          middleName: val,
                          name: composeFullLegalName(prev.firstName, val, prev.lastName, prev.suffix)
                        }));
                      }}
                      className={getFieldClass('middleName')}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <div className="flex justify-between items-center mb-1 gap-2">
                      <label className="block text-xs font-bold text-gray-700 shrink-0">
                        Last Name <span className="text-rose-500">*</span>
                      </label>
                      {(touched.lastName || isFrontNameMismatch || isBackNameMismatch) && errors.lastName && (
                        <span className="text-[11px] font-bold text-rose-600 text-right">{errors.lastName}</span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={formData.lastName}
                      placeholder="e.g. Laurio"
                      onBlur={() => setTouched(prev => ({ ...prev, lastName: true }))}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          lastName: val,
                          name: composeFullLegalName(prev.firstName, prev.middleName, val, prev.suffix)
                        }));
                      }}
                      className={getFieldClass('lastName')}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Suffix <span className="text-gray-400 font-normal">(Optional)</span>
                    </label>
                    <select
                      value={formData.suffix}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          suffix: val,
                          name: composeFullLegalName(prev.firstName, prev.middleName, prev.lastName, val)
                        }));
                      }}
                      className={getFieldClass('suffix')}
                    >
                      <option value="">None</option>
                      <option value="Jr.">Jr.</option>
                      <option value="Sr.">Sr.</option>
                      <option value="II">II</option>
                      <option value="III">III</option>
                      <option value="IV">IV</option>
                      <option value="V">V</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Email Address / Portal Username */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-gray-700">
                    Username <span className="text-rose-500">*</span>
                  </label>
                  {touched.email && errors.email && (
                    <span className="text-[11px] font-bold text-rose-600">{errors.email}</span>
                  )}
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={formData.email}
                    placeholder="e.g. resident@gmail.com or name@bugo.gov.ph"
                    onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`${getFieldClass('email')} pl-10`}
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Saved as your portal login username together with your password below.
                </p>
              </div>

              {/* Philippine Mobile Number */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-gray-700">
                    Philippine Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  {touched.contactNumber && errors.contactNumber ? (
                    <span className="text-[11px] font-bold text-rose-600">{errors.contactNumber}</span>
                  ) : phoneCheck.valid ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Active PH ({phoneCheck.telco})
                    </span>
                  ) : null}
                </div>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="tel"
                    maxLength={14}
                    value={formData.contactNumber}
                    placeholder="0917 628 4915"
                    onBlur={() => setTouched(prev => ({ ...prev, contactNumber: true }))}
                    onChange={handlePhoneChange}
                    className={`${getFieldClass('contactNumber')} pl-10`}
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Official Philippine mobile number for resident profile verification and coordination.
                </p>
              </div>

              {/* Purok / Zone Dropdown */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Purok / Zone of Residence <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={formData.purok}
                    onChange={(e) => {
                      purokManuallyEditedRef.current = true;
                      setPurokManuallyEdited(true);
                      setFormData({ ...formData, purok: e.target.value });
                    }}
                    className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-xl pl-10 pr-4 py-2.5 font-semibold outline-none focus:ring-2 focus:ring-[#0c532b] text-xs sm:text-sm"
                  >
                    {BUGO_PUROKS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Complete Address */}
              <div>
                <div className="flex justify-between items-center mb-1 gap-2">
                  <label className="block text-xs font-bold text-gray-700 shrink-0">
                    Complete Residential Address <span className="text-rose-500">*</span>
                  </label>
                  {touched.address && errors.address && (
                    <span className="text-[11px] font-bold text-rose-600 text-right">{errors.address}</span>
                  )}
                </div>
                <input
                  type="text"
                  value={formData.address}
                  placeholder="House No., Street Name, Sitio/Zone, Bugo"
                  onBlur={() => setTouched(prev => ({ ...prev, address: true }))}
                  onChange={(e) => {
                    const val = e.target.value;
                    const edited = val.trim().length > 0;
                    addressManuallyEditedRef.current = edited;
                    setAddressManuallyEdited(edited);
                    setFormData({ ...formData, address: val });
                  }}
                  className={getFieldClass('address')}
                />
              </div>

              {/* Household Profiling & Citizen Status Section */}
              <div className="pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Birthdate with Auto-Calculated Age */}
                  <div>
                    <div className="flex justify-between items-center mb-1 gap-2">
                      <label className="block text-xs font-bold text-gray-700 shrink-0">
                        Birthdate <span className="text-rose-500">*</span>
                      </label>
                      {(touched.birthdate || isFrontDobMismatch || isBackDobMismatch) && errors.birthdate ? (
                        <span className="text-[11px] font-bold text-rose-600 text-right">{errors.birthdate}</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          {formData.birthdate && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Age: {formData.age}
                            </span>
                          )}
                          {formData.age >= 60 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                              Senior (60+)
                            </span>
                          )}
                          {formData.age >= 13 && formData.age <= 19 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
                              Teen / Youth
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <input
                      type="date"
                      max={new Date().toISOString().split('T')[0]}
                      value={formData.birthdate}
                      onBlur={() => setTouched(prev => ({ ...prev, birthdate: true }))}
                      onChange={(e) => {
                        const val = e.target.value;
                        const computed = computeAgeFromBirthdate(val);
                        setFormData(prev => {
                          const nextAge = computed !== null ? computed : prev.age;
                          return {
                            ...prev,
                            birthdate: val,
                            age: nextAge,
                            isSenior: nextAge >= 60,
                            isTeenager: nextAge >= 13 && nextAge <= 19
                          };
                        });
                      }}
                      className={getFieldClass('birthdate')}
                    />
                  </div>

                  {/* Age Display / Adjustment */}
                  <div>
                    <div className="flex justify-between items-center mb-1 gap-2">
                      <label className="block text-xs font-bold text-gray-700 shrink-0">
                        Age <span className="text-rose-500">*</span>
                      </label>
                      {errors.age ? (
                        <span className="text-[11px] font-bold text-rose-600 text-right">{errors.age}</span>
                      ) : (
                        <span className="text-[10px] text-gray-400">Auto-computed from birthdate</span>
                      )}
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={formData.age}
                      onBlur={() => setTouched(prev => ({ ...prev, age: true }))}
                      onChange={(e) => handleAgeChange(parseInt(e.target.value) || 0)}
                      className={getFieldClass('age')}
                    />
                  </div>
                </div>

                {/* Civil Status & Sex / Gender */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                  <div>
                    <div className="flex justify-between items-center mb-1 gap-2">
                      <label className="block text-xs font-bold text-gray-700 shrink-0">
                        Civil Status <span className="text-rose-500">*</span>
                      </label>
                      {(touched.civilStatus || isFrontCivilMismatch || isBackCivilMismatch) && errors.civilStatus && (
                        <span className="text-[11px] font-bold text-rose-600 text-right">{errors.civilStatus}</span>
                      )}
                    </div>
                    <div className="relative">
                      <Users className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        value={formData.civilStatus}
                        onBlur={() => setTouched(prev => ({ ...prev, civilStatus: true }))}
                        onChange={(e) => setFormData({ ...formData, civilStatus: e.target.value as any })}
                        className={`${getFieldClass('civilStatus')} pl-10 font-semibold`}
                      >
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Widowed">Widowed</option>
                        <option value="Separated">Separated</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1 gap-2">
                      <label className="block text-xs font-bold text-gray-700 shrink-0">
                        Sex / Gender <span className="text-rose-500">*</span>
                      </label>
                      {(touched.gender || isFrontGenderMismatch || isBackGenderMismatch) && errors.gender && (
                        <span className="text-[11px] font-bold text-rose-600 text-right">{errors.gender}</span>
                      )}
                    </div>
                    <div className="relative">
                      <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        value={formData.gender}
                        onBlur={() => setTouched(prev => ({ ...prev, gender: true }))}
                        onChange={(e) => {
                          const val = e.target.value as '' | 'Male' | 'Female';
                          setFormData({ ...formData, gender: val });
                          if (val === 'Male') setAvatarGenderManual('male');
                          else if (val === 'Female') setAvatarGenderManual('female');
                        }}
                        className={`${getFieldClass('gender')} pl-10 font-semibold`}
                      >
                        <option value="">Select Sex / Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Occupation & Employment */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-bold text-gray-700">
                        Occupation / Livelihood <span className="text-rose-500">*</span>
                      </label>
                      {touched.occupation && errors.occupation && (
                        <span className="text-[11px] font-bold text-rose-600">{errors.occupation}</span>
                      )}
                    </div>
                    <div className="relative">
                      <Briefcase className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        value={occupationChoice}
                        onBlur={() => setTouched(prev => ({ ...prev, occupation: true }))}
                        onChange={(e) => handleOccupationSelectChange(e.target.value)}
                        className={`${getFieldClass('occupation')} pl-10 font-semibold`}
                      >
                        <option value="">Select Occupation / Livelihood</option>
                        {LIVELIHOOD_OPTIONS.map(occ => (
                          <option key={occ} value={occ}>{occ}</option>
                        ))}
                        <option value="Others">Others (Specify)</option>
                      </select>
                    </div>
                    {occupationChoice === 'Others' && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={customOccupation}
                          placeholder="Specify your occupation / livelihood"
                          onBlur={() => setTouched(prev => ({ ...prev, occupation: true }))}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomOccupation(val);
                            handleOccupationChange(val);
                          }}
                          className={getFieldClass('occupation')}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Employment Classification <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.employmentStatus}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setFormData(prev => ({
                          ...prev,
                          employmentStatus: val,
                          isStudent: val === 'Student' ? true : prev.isStudent
                        }));
                      }}
                      className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-xl px-3.5 py-2.5 font-semibold outline-none focus:ring-2 focus:ring-[#0c532b] text-xs sm:text-sm"
                    >
                      <option value="Employed (Full-Time)">Employed (Full-Time)</option>
                      <option value="Employed (Part-Time)">Employed (Part-Time)</option>
                      <option value="Self-Employed">Self-Employed / Freelancer</option>
                      <option value="Unemployed">Unemployed / Jobseeker</option>
                      <option value="Student">Student</option>
                      <option value="Retired">Retired / Pensioner</option>
                    </select>
                  </div>
                </div>

                {/* Household Monthly Income & Household Members */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Household Monthly Income <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.householdIncome}
                      onChange={(e) => setFormData({ ...formData, householdIncome: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-xl px-3.5 py-2.5 font-semibold outline-none focus:ring-2 focus:ring-[#0c532b] text-xs sm:text-sm"
                    >
                      {MONTHLY_INCOME_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Household Members <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={formData.familyMembersCount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          familyMembersCount: Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1))
                        })
                      }
                      className={getFieldClass('familyMembersCount')}
                    />
                  </div>
                </div>

                {/* Valid ID (Front & Back Required — Validates Strictly Against User Inputs; Auto-Fills Only ID#, Address, and Purok) */}
                <div className="mt-3 p-4 rounded-2xl border border-gray-200 bg-gray-50/70 space-y-3">
                  <p className="text-[11px] text-gray-600 leading-snug">
                    Front and Back use separate scanners and validate directly against <span className="font-bold text-gray-800">the details you filled out</span> (both attached files must be distinct). Only <span className="font-bold text-gray-800">ID Number</span>, <span className="font-bold text-gray-800">Complete Residential Address</span>, and <span className="font-bold text-gray-800">Purok / Zone</span> auto-fill from the ID when not yet edited.
                  </p>
                  {/* Resident ID Type Selector & Control No. Placed FIRST so uploads validate against it */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between items-center mb-1 gap-2">
                        <label className="block text-xs font-bold text-gray-700">
                          Resident ID Type <span className="text-rose-500">*</span>
                        </label>
                        {errors.idType && (
                          <span className="text-[11px] font-bold text-rose-600 text-right">{errors.idType}</span>
                        )}
                      </div>
                      <div className="relative">
                        <CreditCard className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <select
                          value={formData.idType}
                          onChange={(e) => void handleSelectedIdTypeChange(e.target.value)}
                          className={`w-full bg-white border ${errors.idType ? 'border-rose-500 ring-2 ring-rose-200' : 'border-gray-300'} text-gray-900 rounded-xl pl-10 pr-4 py-2.5 font-semibold outline-none focus:ring-2 focus:ring-[#0c532b] text-xs sm:text-sm`}
                        >
                          {GOV_ID_TYPES.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1 gap-2">
                        <label className="block text-xs font-bold text-gray-700 shrink-0">
                          ID Number / Control No. <span className="text-rose-500">*</span>
                        </label>
                        {(touched.idNumber || isFrontIdNumMismatch || isBackIdNumMismatch) && errors.idNumber && (
                          <span className="text-[11px] font-bold text-rose-600 text-right">{errors.idNumber}</span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={formData.idNumber}
                        placeholder="e.g. 1234-5678-9012-3456"
                        onBlur={() => setTouched(prev => ({ ...prev, idNumber: true }))}
                        onChange={(e) => {
                          const typed = e.target.value;
                          if (!typed.trim()) {
                            idNumberManuallyEditedRef.current = false;
                            setIdNumberManuallyEdited(false);
                            setFormData(prev => ({ ...prev, idNumber: typed }));
                            return;
                          }
                          const isAddingChars = typed.length > formData.idNumber.length;
                          const extractedCandidates = [
                            (idAnalysis?.extractedIdNumber || '').trim(),
                            (backIdAnalysis?.extractedIdNumber || '').trim(),
                          ].filter(Boolean);
                          const matchedExtracted = isAddingChars
                            ? extractedCandidates.find((candidate) => isIdNumberPrefixMatch(typed, candidate))
                            : undefined;
                          if (matchedExtracted) {
                            idNumberManuallyEditedRef.current = false;
                            setIdNumberManuallyEdited(false);
                            setFormData(prev => ({ ...prev, idNumber: matchedExtracted }));
                            return;
                          }
                          idNumberManuallyEditedRef.current = true;
                          setIdNumberManuallyEdited(true);
                          setFormData(prev => ({ ...prev, idNumber: typed }));
                        }}
                        className={getFieldClass('idNumber')}
                      />
                    </div>
                  </div>

                  {/* Large HD Step-by-Step Visual ID Capture Guide */}
                  <button
                    type="button"
                    onClick={() => setIsIdGuideZoomOpen(true)}
                    className="w-full block p-2 bg-white border border-emerald-200 rounded-2xl shadow-xs hover:border-[#0c532b] hover:shadow-md transition cursor-pointer group overflow-hidden"
                    title="Click to view full-size HD guide"
                  >
                    <img
                      src={GUIDE_ASSETS.idCaptureSteps}
                      alt="Step-by-step guide to photograph Front and Back ID clearly"
                      referrerPolicy="no-referrer"
                      className="w-full h-auto object-contain rounded-xl bg-white"
                    />
                  </button>

                  {cameraError && (
                    <p className="text-[11px] text-amber-700 font-medium">{cameraError}</p>
                  )}

                  <input
                    ref={frontFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleIdFileSelect('front', e)}
                    className="hidden"
                  />
                  <input
                    ref={backFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleIdFileSelect('back', e)}
                    className="hidden"
                  />
                  <input
                    ref={cameraFallbackInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleIdFileSelect(cameraTargetSide, e)}
                    className="hidden"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* FRONT ID CARD */}
                    <div className={`p-3 rounded-xl border bg-white space-y-2 ${
                      (idAnalysis && (!idAnalysis.isId || !idAnalysis.isClear || idAnalysis.isBlurry || hasFrontFieldMismatch)) ||
                      frontScanNotice?.tone === 'error'
                        ? 'border-rose-300 bg-rose-50/30'
                        : isFrontIdQualified
                          ? 'border-emerald-300'
                          : 'border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900">
                          Front of ID <span className="text-rose-500">*</span>
                        </span>
                        {isFrontIdQualified ? (
                          <span className="text-[10px] font-bold text-emerald-700">Front Matched &amp; Clear</span>
                        ) : frontIdUrl && idAnalysis?.isId && idAnalysis?.isClear && !idAnalysis?.isBlurry && !hasFrontFieldMismatch && !hasRequiredIdentityInputs ? (
                          <span className="text-[10px] font-bold text-amber-700">Awaiting User Info</span>
                        ) : (
                          <span className="text-[10px] font-semibold text-gray-400">Front ID Scanner</span>
                        )}
                      </div>

                      {frontIdUrl ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={frontIdUrl}
                              alt="Front ID"
                              className="w-16 h-11 object-cover rounded-lg border border-gray-200 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-medium text-gray-700 truncate">{frontIdFileName}</p>
                              {isScanningFrontId ? (
                                <p className="text-[11px] text-[#0c532b] font-semibold flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Front scanner: checking ID, type &amp; info...
                                </p>
                              ) : hasFrontFieldMismatch ? (
                                <p className="text-[11px] text-rose-600 font-bold">
                                  {frontFieldMismatchMessage}
                                </p>
                              ) : idAnalysis?.isId === false ? (
                                <p className="text-[11px] text-rose-600 font-bold">
                                  Invalid Front ID photo — Please try again
                                </p>
                              ) : idAnalysis?.isClear === false || idAnalysis?.isBlurry ? (
                                <p className="text-[11px] text-amber-700 font-bold">
                                  Front photo blurry / unclear — Please try again
                                </p>
                              ) : (
                                <p className="text-[11px] text-emerald-700 font-semibold truncate">
                                  {idAnalysis?.detectedDocType || formData.idType}
                                  {idAnalysis?.extractedName
                                    ? ` • ${idAnalysis.extractedName}`
                                    : idAnalysis?.extractedIdNumber
                                      ? ` • ${idAnalysis.extractedIdNumber}`
                                      : ' • Front verified'}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setFrontIdUrl('');
                                setFrontIdFileName('');
                                setFrontIdFileSize(0);
                                setIdAnalysis(null);
                                setFrontScanNotice(null);
                                if (backScanNotice?.tone === 'error' && /Front of ID|same file|same image|identical/i.test(backScanNotice.message)) {
                                  setBackScanNotice(null);
                                }
                              }}
                              title="Remove Front ID"
                              className="p-1 text-gray-400 hover:text-rose-600 rounded cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {idAnalysis && (!idAnalysis.isId || !idAnalysis.isClear || idAnalysis.isBlurry || hasFrontFieldMismatch) && (
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                disabled={isScanningFrontId}
                                onClick={() => void scanAndAttachId('front', frontIdUrl, frontIdFileName || 'front-id.jpg', undefined, frontIdFileSize)}
                                className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50"
                              >
                                {isScanningFrontId ? 'Scanning...' : 'Rescan Front'}
                              </button>
                              <button
                                type="button"
                                disabled={isScanningFrontId}
                                onClick={() => frontFileInputRef.current?.click()}
                                className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50"
                              >
                                Re-attach Front
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => openCameraScanner('front')}
                            disabled={isScanningFrontId}
                            className="flex-1 py-2 bg-[#0c532b] hover:bg-[#094222] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Scan</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => frontFileInputRef.current?.click()}
                            disabled={isScanningFrontId}
                            className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Attach</span>
                          </button>
                        </div>
                      )}

                      {frontScanNotice &&
                        (frontScanNotice.tone === 'success'
                          ? isFrontIdQualified
                          : frontScanNotice.tone === 'warning'
                            ? (!frontIdUrl || (!hasFrontFieldMismatch && idAnalysis?.isId !== false && !isFrontIdQualified))
                            : true) && (
                          <div className={`p-2 rounded-lg border text-[11px] font-semibold flex items-start gap-1.5 ${
                            frontScanNotice.tone === 'error'
                              ? 'bg-rose-50 border-rose-200 text-rose-800'
                              : frontScanNotice.tone === 'warning'
                                ? 'bg-amber-50 border-amber-200 text-amber-800'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          }`}>
                            {frontScanNotice.tone === 'success' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            ) : (
                              <AlertCircle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${frontScanNotice.tone === 'warning' ? 'text-amber-600' : 'text-rose-600'}`} />
                            )}
                            <span>{frontScanNotice.message}</span>
                          </div>
                        )}

                      {!frontIdUrl && !frontScanNotice && touched.frontIdUrl && errors.frontIdUrl && (
                        <p className="text-[11px] font-bold text-rose-600">{errors.frontIdUrl}</p>
                      )}
                    </div>

                    {/* BACK ID CARD */}
                    <div className={`p-3 rounded-xl border bg-white space-y-2 ${
                      (backIdAnalysis && (!backIdAnalysis.isId || !backIdAnalysis.isClear || backIdAnalysis.isBlurry || hasBackFieldMismatch)) ||
                      backScanNotice?.tone === 'error'
                        ? 'border-rose-300 bg-rose-50/30'
                        : isBackIdQualified
                          ? 'border-emerald-300'
                          : 'border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900">
                          Back of ID <span className="text-rose-500">*</span>
                        </span>
                        {isBackIdQualified ? (
                          <span className="text-[10px] font-bold text-emerald-700">Back Matched &amp; Clear</span>
                        ) : backIdUrl && backIdAnalysis?.isId && backIdAnalysis?.isClear && !backIdAnalysis?.isBlurry && !hasBackFieldMismatch && !hasRequiredIdentityInputs ? (
                          <span className="text-[10px] font-bold text-amber-700">Awaiting User Info</span>
                        ) : (
                          <span className="text-[10px] font-semibold text-gray-400">Back ID Scanner</span>
                        )}
                      </div>

                      {backIdUrl ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={backIdUrl}
                              alt="Back ID"
                              className="w-16 h-11 object-cover rounded-lg border border-gray-200 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-medium text-gray-700 truncate">{backIdFileName}</p>
                              {isScanningBackId ? (
                                <p className="text-[11px] text-[#0c532b] font-semibold flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Back scanner: checking ID, type &amp; info...
                                </p>
                              ) : hasBackFieldMismatch ? (
                                <p className="text-[11px] text-rose-600 font-bold">
                                  {backFieldMismatchMessage}
                                </p>
                              ) : backIdAnalysis?.isId === false ? (
                                <p className="text-[11px] text-rose-600 font-bold">
                                  Invalid Back ID photo — Please try again
                                </p>
                              ) : backIdAnalysis?.isClear === false || backIdAnalysis?.isBlurry ? (
                                <p className="text-[11px] text-amber-700 font-bold">
                                  Back photo blurry / unclear — Please try again
                                </p>
                              ) : (
                                <p className="text-[11px] text-emerald-700 font-semibold truncate">
                                  {backIdAnalysis?.detectedDocType || formData.idType}
                                  {backIdAnalysis?.extractedName
                                    ? ` • ${backIdAnalysis.extractedName}`
                                    : backIdAnalysis?.extractedIdNumber
                                      ? ` • ${backIdAnalysis.extractedIdNumber}`
                                      : backIdAnalysis?.extractedAddress
                                        ? ` • ${backIdAnalysis.extractedAddress}`
                                        : ' • Back verified'}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setBackIdUrl('');
                                setBackIdFileName('');
                                setBackIdFileSize(0);
                                setBackIdAnalysis(null);
                                setBackScanNotice(null);
                                if (frontScanNotice?.tone === 'error' && /Back of ID|same file|same image|identical/i.test(frontScanNotice.message)) {
                                  setFrontScanNotice(null);
                                }
                              }}
                              title="Remove Back ID"
                              className="p-1 text-gray-400 hover:text-rose-600 rounded cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {backIdAnalysis && (!backIdAnalysis.isId || !backIdAnalysis.isClear || backIdAnalysis.isBlurry || hasBackFieldMismatch) && (
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                disabled={isScanningBackId}
                                onClick={() => void scanAndAttachId('back', backIdUrl, backIdFileName || 'back-id.jpg', undefined, backIdFileSize)}
                                className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50"
                              >
                                {isScanningBackId ? 'Scanning...' : 'Rescan Back'}
                              </button>
                              <button
                                type="button"
                                disabled={isScanningBackId}
                                onClick={() => backFileInputRef.current?.click()}
                                className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50"
                              >
                                Re-attach Back
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => openCameraScanner('back')}
                            disabled={isScanningBackId}
                            className="flex-1 py-2 bg-[#0c532b] hover:bg-[#094222] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Scan</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => backFileInputRef.current?.click()}
                            disabled={isScanningBackId}
                            className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Attach</span>
                          </button>
                        </div>
                      )}

                      {backScanNotice &&
                        (backScanNotice.tone === 'success'
                          ? isBackIdQualified
                          : backScanNotice.tone === 'warning'
                            ? (!backIdUrl || (!hasBackFieldMismatch && backIdAnalysis?.isId !== false && !isBackIdQualified))
                            : true) && (
                          <div className={`p-2 rounded-lg border text-[11px] font-semibold flex items-start gap-1.5 ${
                            backScanNotice.tone === 'error'
                              ? 'bg-rose-50 border-rose-200 text-rose-800'
                              : backScanNotice.tone === 'warning'
                                ? 'bg-amber-50 border-amber-200 text-amber-800'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          }`}>
                            {backScanNotice.tone === 'success' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            ) : (
                              <AlertCircle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${backScanNotice.tone === 'warning' ? 'text-amber-600' : 'text-rose-600'}`} />
                            )}
                            <span>{backScanNotice.message}</span>
                          </div>
                        )}

                      {!backIdUrl && !backScanNotice && touched.backIdUrl && errors.backIdUrl && (
                        <p className="text-[11px] font-bold text-rose-600">{errors.backIdUrl}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Special Demographics & Assistance Categories */}
                <div className="mt-4 space-y-3">
                  <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                    Special Assistance & Vulnerability Profiling
                  </div>

                  {/* PWD Category */}
                  <div className={`p-3 rounded-2xl border transition-all ${formData.isPwd ? 'bg-purple-50/70 border-purple-300' : 'bg-gray-50 border-gray-200'}`}>
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isPwd}
                        onChange={(e) => setFormData({ ...formData, isPwd: e.target.checked })}
                        className="mt-0.5 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900">
                          <Accessibility className="w-3.5 h-3.5 text-purple-600" />
                          Person with Disability (PWD)
                        </div>
                        <p className="text-[11px] text-gray-500">
                          Check if registered PWD for prioritized disability benefits and certificate fee exemptions.
                        </p>
                      </div>
                    </label>

                    {formData.isPwd && (
                      <div className="mt-3 pt-3 border-t border-purple-200 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">
                            Disability Type
                          </label>
                          <select
                            value={formData.pwdDisabilityType}
                            onChange={(e) => setFormData({ ...formData, pwdDisabilityType: e.target.value })}
                            className="w-full bg-white border border-purple-200 text-gray-900 rounded-xl px-2.5 py-1.5 text-xs font-medium"
                          >
                            {DISABILITY_TYPES.map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">
                            PWD ID / Control No. <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.pwdIdNumber}
                            placeholder="e.g. 10-4305-PWD-2024"
                            onChange={(e) => setFormData({ ...formData, pwdIdNumber: e.target.value })}
                            className="w-full bg-white border border-purple-200 text-gray-900 rounded-xl px-2.5 py-1.5 text-xs font-medium"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Solo Parent Category */}
                  <div className={`p-3 rounded-2xl border transition-all ${formData.isSoloParent ? 'bg-pink-50/70 border-pink-300' : 'bg-gray-50 border-gray-200'}`}>
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isSoloParent}
                        onChange={(e) => setFormData({ ...formData, isSoloParent: e.target.checked })}
                        className="mt-0.5 w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900">
                          <HeartHandshake className="w-3.5 h-3.5 text-pink-600" />
                          Solo Parent (RA 11861 Beneficiary)
                        </div>
                        <p className="text-[11px] text-gray-500">
                          Check if registered solo parent raising dependents under the Solo Parents Welfare Act.
                        </p>
                      </div>
                    </label>

                    {formData.isSoloParent && (
                      <div className="mt-3 pt-3 border-t border-pink-200 animate-in fade-in">
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">
                          Solo Parent ID / DSWD ID Number <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.soloParentIdNumber}
                          placeholder="e.g. SP-BUGO-2024-0089"
                          onChange={(e) => setFormData({ ...formData, soloParentIdNumber: e.target.value })}
                          className="w-full bg-white border border-pink-200 text-gray-900 rounded-xl px-2.5 py-1.5 text-xs font-medium"
                        />
                      </div>
                    )}
                  </div>

                  {/* Senior Citizen Category */}
                  <div className={`p-3 rounded-2xl border transition-all ${formData.isSenior ? 'bg-amber-50/70 border-amber-300' : 'bg-gray-50 border-gray-200'}`}>
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isSenior}
                        onChange={(e) => setFormData({ ...formData, isSenior: e.target.checked })}
                        className="mt-0.5 w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          Senior Citizen (OSCA Member - 60 years or older)
                        </div>
                        <p className="text-[11px] text-gray-500">
                          Automatically enabled for residents aged 60 and above for pension and senior privileges.
                        </p>
                      </div>
                    </label>

                    {formData.isSenior && (
                      <div className="mt-3 pt-3 border-t border-amber-200 animate-in fade-in">
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">
                          OSCA Senior Citizen ID Number
                        </label>
                        <input
                          type="text"
                          value={formData.seniorIdNumber}
                          placeholder="e.g. OSCA-CDO-2023-4412"
                          onChange={(e) => setFormData({ ...formData, seniorIdNumber: e.target.value })}
                          className="w-full bg-white border border-amber-200 text-gray-900 rounded-xl px-2.5 py-1.5 text-xs font-medium"
                        />
                      </div>
                    )}
                  </div>

                  {/* Student Category */}
                  <div className={`p-3 rounded-2xl border transition-all ${formData.isStudent ? 'bg-blue-50/70 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isStudent}
                        onChange={(e) => setFormData({ ...formData, isStudent: e.target.checked })}
                        className="mt-0.5 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900">
                          <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                          Enrolled Student (Academic Assistance & Fee Waivers)
                        </div>
                        <p className="text-[11px] text-gray-500">
                          Qualifies for student barangay clearance fee exemptions and educational subsidies.
                        </p>
                      </div>
                    </label>

                    {formData.isStudent && (
                      <div className="mt-3 pt-3 border-t border-blue-200 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">
                            Educational Level
                          </label>
                          <select
                            value={formData.studentLevel}
                            onChange={(e) => setFormData({ ...formData, studentLevel: e.target.value as any })}
                            className="w-full bg-white border border-blue-200 text-gray-900 rounded-xl px-2.5 py-1.5 text-xs font-medium"
                          >
                            <option value="Elementary">Elementary</option>
                            <option value="High School">High School / Senior High</option>
                            <option value="College/University">College / University</option>
                            <option value="Vocational">TESDA / Vocational</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">
                            School / University Name
                          </label>
                          <input
                            type="text"
                            value={formData.schoolName}
                            placeholder="e.g. Bugo National High School / USTP"
                            onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                            className="w-full bg-white border border-blue-200 text-gray-900 rounded-xl px-2.5 py-1.5 text-xs font-medium"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Medical Need */}
                  <div className={`p-3 rounded-2xl border transition ${formData.hasMedicalNeed ? 'bg-rose-50/70 border-rose-300' : 'bg-gray-50 border-gray-200'}`}>
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.hasMedicalNeed}
                        onChange={(e) => setFormData({ ...formData, hasMedicalNeed: e.target.checked })}
                        className="mt-1 rounded text-[#0c532b] focus:ring-[#0c532b]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900">
                          <Stethoscope className="w-3.5 h-3.5 text-rose-600" />
                          <span>Medical / Health Assistance Need</span>
                        </div>
                        <p className="text-[11px] text-gray-500">
                          Qualifies for Medical Assistance (hospital bills, medicines, lab support).
                        </p>
                      </div>
                    </label>

                    {formData.hasMedicalNeed && (
                      <div className="mt-2.5 pt-2.5 border-t border-rose-200">
                        <input
                          type="text"
                          value={formData.medicalConditionNote}
                          placeholder="Optional note (e.g. Dialysis, Maintenance meds, Hospital bill)"
                          onChange={(e) => setFormData({ ...formData, medicalConditionNote: e.target.value })}
                          className="w-full bg-white border border-rose-200 text-gray-900 rounded-xl px-2.5 py-1.5 text-xs font-medium"
                        />
                      </div>
                    )}
                  </div>

                  {/* Disaster / Calamity Affected */}
                  <div className={`p-3 rounded-2xl border transition ${formData.isDisasterAffected ? 'bg-amber-50/70 border-amber-300' : 'bg-gray-50 border-gray-200'}`}>
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isDisasterAffected}
                        onChange={(e) => setFormData({ ...formData, isDisasterAffected: e.target.checked })}
                        className="mt-1 rounded text-[#0c532b] focus:ring-[#0c532b]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900">
                          <CloudLightning className="w-3.5 h-3.5 text-amber-600" />
                          <span>Affected by Disaster / Calamity</span>
                        </div>
                        <p className="text-[11px] text-gray-500">
                          Records your calamity impact for Barangay Admin disaster relief verification.
                        </p>
                      </div>
                    </label>

                    {formData.isDisasterAffected && (
                      <div className="mt-2.5 pt-2.5 border-t border-amber-200">
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">
                          Incident Type
                        </label>
                        <select
                          value={formData.disasterType}
                          onChange={(e) => setFormData({ ...formData, disasterType: e.target.value as DisasterCategory })}
                          className="w-full bg-white border border-amber-200 text-gray-900 rounded-xl px-2.5 py-1.5 text-xs font-medium"
                        >
                          <option value="Flood">Flood</option>
                          <option value="Fire">Fire</option>
                          <option value="Typhoon / Storm">Typhoon / Storm</option>
                          <option value="Landslide">Landslide</option>
                          <option value="Earthquake">Earthquake</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

                {/* Password & Confirm Password */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                      Security Credentials
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Strong Password Mandatory
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-bold text-gray-700">
                          Create Password <span className="text-rose-500">*</span>
                        </label>
                        {touched.password && errors.password && (
                          <span className="text-[11px] font-bold text-rose-600">{errors.password}</span>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          placeholder="Create strong password"
                          onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className={`${getFieldClass('password')} pl-10 pr-10`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                          title={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-bold text-gray-700">
                          Confirm Password <span className="text-rose-500">*</span>
                        </label>
                        {touched.confirmPassword && errors.confirmPassword && (
                          <span className="text-[11px] font-bold text-rose-600">{errors.confirmPassword}</span>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={formData.confirmPassword}
                          placeholder="Re-type password"
                          onBlur={() => setTouched(prev => ({ ...prev, confirmPassword: true }))}
                          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                          className={`${getFieldClass('confirmPassword')} pl-10 pr-10`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                          title={showConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Password Strength Meter & Real-time Security Checklist */}
                  <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl space-y-2.5 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-gray-600 flex items-center gap-1.5">
                        <span>Password Strength:</span>
                        {!formData.password && (
                          <span className="text-gray-400 font-normal">(Start typing to evaluate)</span>
                        )}
                      </span>
                      <span className={`font-extrabold ${
                        !formData.password ? 'text-gray-400' :
                        passwordStrength.strengthLabel === 'Strong' ? 'text-emerald-700' :
                        passwordStrength.strengthLabel === 'Good' ? 'text-blue-700' :
                        passwordStrength.strengthLabel === 'Fair' ? 'text-yellow-700' :
                        passwordStrength.strengthLabel === 'Weak' ? 'text-amber-700' : 'text-rose-700'
                      }`}>
                        {formData.password ? `${passwordStrength.strengthLabel} (${passwordStrength.score}/5 criteria)` : '0/5 criteria'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${formData.password ? passwordStrength.strengthColor : 'bg-gray-300'} transition-all duration-300`} 
                        style={{ width: formData.password ? passwordStrength.strengthWidth : '0%' }}
                      />
                    </div>

                    {/* Checklist Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px]">
                      {passwordStrength.requirements.map(req => (
                        <div 
                          key={req.id} 
                          className={`flex items-center gap-1.5 ${req.met ? 'text-emerald-700 font-semibold' : 'text-gray-400'}`}
                        >
                          {req.met ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-gray-300 flex-shrink-0" />
                          )}
                          <span>{req.label}</span>
                        </div>
                      ))}
                      <div className={`flex items-center gap-1.5 ${
                        formData.confirmPassword && formData.password === formData.confirmPassword 
                          ? 'text-emerald-700 font-semibold' 
                          : 'text-gray-400'
                      }`}>
                        {formData.confirmPassword && formData.password === formData.confirmPassword ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-gray-300 flex-shrink-0" />
                        )}
                        <span>Both passwords match</span>
                      </div>
                    </div>
                  </div>
                </div>

              {/* Choose Avatar */}
              <div className="pt-2 border-t border-gray-100 space-y-2">
                <div className="flex items-center justify-end">
                  <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarGenderManual('male');
                        setFormData(prev => ({ ...prev, gender: 'Male' }));
                      }}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        effectiveGender === 'male'
                          ? 'bg-[#0c532b] text-white shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Male
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarGenderManual('female');
                        setFormData(prev => ({ ...prev, gender: 'Female' }));
                      }}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        effectiveGender === 'female'
                          ? 'bg-[#0c532b] text-white shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Female
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {(effectiveGender === 'male' ? MALE_CARTOON_AVATARS : FEMALE_CARTOON_AVATARS).map((preset) => {
                    const isSelected = (selectedAvatarUrl || defaultMatchedAvatar) === preset.url;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSelectedAvatarUrl(preset.url)}
                        className={`p-1 rounded-xl border-2 transition transform hover:scale-105 flex flex-col items-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'border-[#0c532b] bg-emerald-50 ring-2 ring-emerald-300'
                            : 'border-gray-200 hover:border-emerald-500 bg-gray-50/50'
                        }`}
                        title={preset.name}
                      >
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-white shadow-xs">
                          <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[8px] font-bold text-gray-700 truncate max-w-[45px] block text-center">
                          {preset.name.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Policy Agreements Checklist */}
              <div className="pt-2 border-t border-gray-100 space-y-2.5">
                <span className="block text-xs font-bold text-gray-900">
                  Required Policy Agreements:
                </span>

                <label className="flex items-start gap-2.5 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.agreeTerms}
                    onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
                    className="mt-0.5 rounded text-[#0c532b] focus:ring-[#0c532b] h-4 w-4"
                  />
                  <span>
                    I agree to the <strong>Barangay Bugo Citizen Portal Terms of Service</strong> and official portal usage guidelines.
                  </span>
                </label>
                {touched.agreeTerms && errors.agreeTerms && (
                  <p className="text-[11px] text-rose-600 font-bold pl-6">{errors.agreeTerms}</p>
                )}

                <label className="flex items-start gap-2.5 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.agreePrivacy}
                    onChange={(e) => setFormData({ ...formData, agreePrivacy: e.target.checked })}
                    className="mt-0.5 rounded text-[#0c532b] focus:ring-[#0c532b] h-4 w-4"
                  />
                  <span>
                    I consent to the collection and processing of my information under the <strong>Data Privacy Act of 2012 (RA 10173)</strong> for barangay record-keeping.
                  </span>
                </label>
                {touched.agreePrivacy && errors.agreePrivacy && (
                  <p className="text-[11px] text-rose-600 font-bold pl-6">{errors.agreePrivacy}</p>
                )}

                <label className="flex items-start gap-2.5 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.agreeTruthfulness}
                    onChange={(e) => setFormData({ ...formData, agreeTruthfulness: e.target.checked })}
                    className="mt-0.5 rounded text-[#0c532b] focus:ring-[#0c532b] h-4 w-4"
                  />
                  <span>
                    I certify under penalty of administrative rules that all information provided is true, correct, and belongs to a bonafide resident.
                  </span>
                </label>
                {touched.agreeTruthfulness && errors.agreeTruthfulness && (
                  <p className="text-[11px] text-rose-600 font-bold pl-6">{errors.agreeTruthfulness}</p>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2 space-y-3">
                {errorMsg && (
                  <div
                    role="alert"
                    className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl text-xs text-rose-800 font-semibold flex items-start gap-2.5"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting || isScanningId}
                  className="w-full py-3 px-4 bg-[#0c532b] hover:bg-[#094222] text-white font-bold rounded-xl text-sm transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <span>Creating Citizen Account...</span>
                  ) : isScanningId ? (
                    <span>Scanning Attached ID...</span>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Complete Account Registration</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-2">
                <p className="text-xs text-gray-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setAuthView('login')}
                    className="text-[#0c532b] font-bold hover:underline cursor-pointer"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </form>
        </div>
      </div>

      {/* Live Camera Scan ID Modal */}
      {isCameraOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={stopCamera}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 border border-gray-200 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#0c532b]" />
                <h3 className="text-sm font-bold text-gray-900">
                  Scan {cameraTargetSide === 'back' ? 'Back' : 'Front'} of ID
                </h3>
              </div>
              <button
                type="button"
                onClick={stopCamera}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="pointer-events-none absolute inset-4 border-2 border-dashed border-emerald-400/80 rounded-lg" />
            </div>

            <p className="text-[11px] text-gray-500 text-center">
              Align your ID card inside the frame and ensure text is clear and well-lit.
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={stopCamera}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={captureFromCamera}
                className="flex-1 py-2.5 bg-[#0c532b] hover:bg-[#094222] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Capture &amp; Scan ID</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen HD ID Guide Lightbox */}
      {isIdGuideZoomOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsIdGuideZoomOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-5xl w-full p-4 sm:p-6 border border-gray-200 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Taking a Valid ID Photo Guide</h3>
              <button
                type="button"
                onClick={() => setIsIdGuideZoomOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
                aria-label="Close full-size guide"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={GUIDE_ASSETS.idCaptureSteps}
              alt="Full HD step-by-step ID capture guide"
              referrerPolicy="no-referrer"
              className="w-full h-auto max-h-[80vh] object-contain rounded-xl bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
};
