import React, { useEffect, useMemo, useState } from 'react';
import { 
  LayoutDashboard, 
  HeartHandshake, 
  Megaphone, 
  HelpCircle, 
  Settings, 
  Upload,
  CheckCircle,
  AlertCircle,
  FileCheck2,
  Printer,
  X,
  FileText,
  ShieldCheck,
  Check,
  Clock,
  Send,
  Eye,
  Download,
  Camera,
  CreditCard,
  UploadCloud,
  Trash2,
  QrCode,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Ban,
  MapPin,
  Lock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BugoLogo } from '../BugoLogo';
import { TopNavBar } from '../TopNavBar';
import { 
  ResidentDashboardView, 
  ResidentServicesView, 
  ResidentSettingsView,
  ResidentHelpView
} from './ResidentOperationsViews';
import { AssistanceProgram, IdPhotoAnalysis, AnnouncementItem, UploadedDocument } from '../../types';
import { BUGO_PUROKS, MONTHLY_INCOME_OPTIONS } from '../../data/mockData';
import { PROGRAM_RULES, parseMonthlyIncome, inspectIdPhotoClientHeuristic, evaluateApplicantEligibility, findExistingProgramApplication, hasVerifiedStudentDocument, canResidentViewAnnouncement, isBarangayServiceApplicationItem, isDisasterProgram } from '../../utils/eligibilityEngine';
import { matchProgramRequirementsWithAccount, getAutoAttachedAccountDocuments, getEffectiveProgramRequirements } from '../../utils/requirementMatcher';
import { getRequirementHintLabel } from '../../utils/requirementKeywordMatcher';
import { formatDocumentByteSize, isRealDocumentUrl } from '../../utils/realDocumentPdf';
import {
  compressImageDataUrlForScan,
  scanIdPhotoWithClarityAndType,
  scanQualificationDocumentPhoto,
  checkDuplicateIdImageAttachment,
  DocumentPhotoScanResult
} from '../../utils/imageScanner';
import { GUIDE_ASSETS } from '../../data/guideAssets';
import { AnnouncementModal } from '../AnnouncementModal';
import { DocumentPreviewModal } from '../DocumentPreviewModal';
import { BugoHazardMapView } from '../maps/BugoHazardMapView';
import { normalizePhMobileNumber } from '../../utils/phoneValidation';
import { printResidentReceipt } from '../../utils/printReport';

export const ResidentLayout: React.FC = () => {
  const { 
    residentTab, 
    setResidentTab, 
    currentUser,
    submitAssistanceApplication,
    programs,
    announcements,
    applications,
    disasterVictims,
    incrementAnnouncementViews,
    pendingApplyProgram,
    openProgramApplication
  } = useApp();

  const [viewingAnn, setViewingAnn] = useState<AnnouncementItem | null>(null);

  // Registration & Service Application Fill-up Form Modal State
  const [applyingProgram, setApplyingProgram] = useState<AssistanceProgram | null>(null);
  const [applicationStep, setApplicationStep] = useState<1 | 2 | 3>(1);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Clean empty initial form state (Empty & Realistic by Default)
  const [appForm, setAppForm] = useState({
    applicantName: '',
    email: '',
    contactNumber: '',
    purok: '',
    address: '',
    householdIncome: '',
    familyMembersCount: '',
    occupation: '',
    purpose: '',
    agreedToTerms: false,
    idType: 'PhilSys National ID (PhilID / ePhilID)',
    frontIdFileName: '',
    frontIdPreviewUrl: '',
    frontIdSize: '',
    frontIdAnalysis: null as IdPhotoAnalysis | null,
    isScanningId: false,
    backIdFileName: '',
    backIdPreviewUrl: '',
    backIdSize: '',
    backIdAnalysis: null as IdPhotoAnalysis | null,
    isScanningBackId: false
  });

  const [previewDocModal, setPreviewDocModal] = useState<{ title: string; url: string } | null>(null);
  const [reqUploads, setReqUploads] = useState<Record<number, { name: string; url: string; size: string; type: string }>>({});
  const [reqUploadScans, setReqUploadScans] = useState<Record<number, DocumentPhotoScanResult & { isScanning?: boolean }>>({});
  const [frontIdNotice, setFrontIdNotice] = useState<string>('');
  const [backIdNotice, setBackIdNotice] = useState<string>('');

  const existingProgramApplication = useMemo(
    () =>
      applyingProgram
        ? findExistingProgramApplication(applications, currentUser, applyingProgram)
        : null,
    [applyingProgram, applications, currentUser]
  );
  const isStepsLocked = Boolean(existingProgramApplication && !submittedRef);

  const residentStoredDocs = useMemo<UploadedDocument[]>(() => {
    if (!currentUser) return [];
    const docs: UploadedDocument[] = [];
    const seen = new Set<string>();
    for (const app of applications || []) {
      const sameUser =
        (app.applicantId && currentUser.id && app.applicantId === currentUser.id) ||
        (app.email && currentUser.email && app.email.trim().toLowerCase() === currentUser.email.trim().toLowerCase());
      if (!sameUser) continue;
      for (const doc of app.documents || []) {
        const url = doc.fileUrl || doc.previewUrl;
        if (!isRealDocumentUrl(url)) continue;
        const key = `${doc.name || ''}::${url?.slice(0, 64) || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        docs.push(doc);
      }
    }
    return docs;
  }, [applications, currentUser]);

  const handleStartApply = (prog: AssistanceProgram) => {
    setApplyingProgram(prog);
    setApplicationStep(1);
    setSubmittedRef(null);
    setFormError('');
    setIsSubmitting(false);
    setReqUploads({});
    setReqUploadScans({});
    setFrontIdNotice('');
    setBackIdNotice('');

    const hasAccountFrontId = Boolean(currentUser?.frontIdUrl);
    const hasAccountBackId = Boolean(currentUser?.backIdUrl);
    const resolvedIdType = currentUser?.idType || 'PhilSys National ID (PhilID / ePhilID)';

    // Initialize form with verified resident profile & auto-attached Create Account IDs
    setAppForm({
      applicantName: currentUser?.name || '',
      email: currentUser?.email || '',
      contactNumber: currentUser?.contactNumber || '',
      purok: currentUser?.purok || '',
      address: currentUser?.address || '',
      householdIncome: currentUser?.householdIncome || '',
      familyMembersCount: currentUser?.familyMembersCount ? String(currentUser.familyMembersCount) : '',
      occupation: currentUser?.occupation || '',
      purpose: '',
      agreedToTerms: false,
      idType: resolvedIdType,
      frontIdFileName: hasAccountFrontId ? `${resolvedIdType}_Front_ID.jpg` : '',
      frontIdPreviewUrl: currentUser?.frontIdUrl || '',
      frontIdSize: hasAccountFrontId ? 'From Account' : '',
      frontIdAnalysis: hasAccountFrontId
        ? (currentUser?.idPhotoAnalysis || {
            isId: true,
            isClear: true,
            detectedDocType: resolvedIdType,
            warning: null,
            score: 95
          })
        : null,
      isScanningId: false,
      backIdFileName: hasAccountBackId ? `${resolvedIdType}_Back_ID.jpg` : '',
      backIdPreviewUrl: currentUser?.backIdUrl || '',
      backIdSize: hasAccountBackId ? 'From Account' : '',
      backIdAnalysis: hasAccountBackId
        ? (currentUser?.backIdPhotoAnalysis || {
            isId: true,
            isClear: true,
            detectedDocType: resolvedIdType,
            warning: null,
            score: 95
          })
        : null,
      isScanningBackId: false
    });
  };

  useEffect(() => {
    if (pendingApplyProgram) {
      handleStartApply(pendingApplyProgram);
      openProgramApplication(null);
    }
  }, [pendingApplyProgram]);


  const handleFrontIdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFrontIdNotice('Front ID file exceeds 5MB limit. Please select a smaller file.');
      return;
    }
    setFormError('');
    setFrontIdNotice('');

    const expectedType = appForm.idType;
    const sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    const reader = new FileReader();
    reader.onloadend = async () => {
      if (typeof reader.result === 'string') {
        const base64Data = await compressImageDataUrlForScan(reader.result);
        if (appForm.backIdPreviewUrl) {
          const dupCheck = await checkDuplicateIdImageAttachment({
            candidateDataUrl: base64Data,
            candidateFileName: file.name,
            candidateFileSize: file.size,
            otherDataUrl: appForm.backIdPreviewUrl,
            otherFileName: appForm.backIdFileName,
            otherSideLabel: 'Back of ID',
          });
          if (dupCheck.isDuplicate) {
            setFrontIdNotice(dupCheck.reason || 'Same file/photo cannot be attached to both Front and Back of ID.');
            return;
          }
        }

        const localCheck = inspectIdPhotoClientHeuristic(file);

        setAppForm(prev => ({
          ...prev,
          frontIdFileName: file.name,
          frontIdPreviewUrl: base64Data,
          frontIdSize: sizeStr,
          frontIdAnalysis: localCheck,
          isScanningId: true
        }));

        const analysis = await scanIdPhotoWithClarityAndType({
          file,
          base64Data,
          side: 'front',
          expectedIdType: expectedType,
          expectedName: currentUser?.name,
          localHeuristic: localCheck
        });

        setAppForm(prev => ({
          ...prev,
          frontIdAnalysis: analysis,
          isScanningId: false
        }));

        if (analysis.aiVisionUsed === false && analysis.isId !== false) {
          setFrontIdNotice(analysis.warning || 'ID verification service is temporarily busy. Please try again in a few seconds.');
        } else if (!analysis.isId) {
          setFrontIdNotice(`Front upload rejected: "${file.name}" is not a valid ID. Please attach your ${expectedType} and try again.`);
        } else if (analysis.matchesExpectedSide === false || analysis.detectedSide === 'back') {
          setFrontIdNotice('Front ID slot contains the Back side of an ID. Please attach the actual Front photo.');
        } else if (analysis.matchesExpectedType === false) {
          setFrontIdNotice(`Front ID mismatch: Uploaded "${analysis.detectedDocType}" does not match selected "${expectedType}". Please try again.`);
        } else if (analysis.matchesExpectedName === false) {
          setFrontIdNotice(analysis.warning || `Front ID name mismatch: Uploaded ID name does not match "${currentUser?.name}". Please upload your own valid ID.`);
        } else if (!analysis.isClear || analysis.isBlurry) {
          setFrontIdNotice(analysis.warning || 'Front ID photo is blurry or unclear. Please retake a clearer photo and try again.');
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveFrontId = () => {
    setFrontIdNotice('');
    if (/Front of ID|same file|same image/i.test(backIdNotice)) setBackIdNotice('');
    setAppForm(prev => ({
      ...prev,
      frontIdFileName: '',
      frontIdPreviewUrl: '',
      frontIdSize: '',
      frontIdAnalysis: null,
      isScanningId: false
    }));
  };

  const handleBackIdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setBackIdNotice('Back ID file exceeds 5MB limit. Please select a smaller file.');
      return;
    }
    setFormError('');
    setBackIdNotice('');

    const expectedType = appForm.idType;
    const sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    const reader = new FileReader();
    reader.onloadend = async () => {
      if (typeof reader.result === 'string') {
        const base64Data = await compressImageDataUrlForScan(reader.result);
        if (appForm.frontIdPreviewUrl) {
          const dupCheck = await checkDuplicateIdImageAttachment({
            candidateDataUrl: base64Data,
            candidateFileName: file.name,
            candidateFileSize: file.size,
            otherDataUrl: appForm.frontIdPreviewUrl,
            otherFileName: appForm.frontIdFileName,
            otherSideLabel: 'Front of ID',
          });
          if (dupCheck.isDuplicate) {
            setBackIdNotice(dupCheck.reason || 'Same file/photo cannot be attached to both Front and Back of ID.');
            return;
          }
        }

        const localCheck = inspectIdPhotoClientHeuristic(file);

        setAppForm(prev => ({
          ...prev,
          backIdFileName: file.name,
          backIdPreviewUrl: base64Data,
          backIdSize: sizeStr,
          backIdAnalysis: localCheck,
          isScanningBackId: true
        }));

        const analysis = await scanIdPhotoWithClarityAndType({
          file,
          base64Data,
          side: 'back',
          expectedIdType: expectedType,
          expectedName: currentUser?.name,
          localHeuristic: localCheck
        });

        setAppForm(prev => ({
          ...prev,
          backIdAnalysis: analysis,
          isScanningBackId: false
        }));

        if (analysis.aiVisionUsed === false && analysis.isId !== false) {
          setBackIdNotice(analysis.warning || 'ID verification service is temporarily busy. Please try again in a few seconds.');
        } else if (!analysis.isId) {
          setBackIdNotice(`Back upload rejected: "${file.name}" is not a valid ID. Please attach the back of your ${expectedType} and try again.`);
        } else if (analysis.matchesExpectedSide === false || analysis.detectedSide === 'front') {
          setBackIdNotice('Back ID slot contains the Front side of an ID. Please attach the actual Back photo.');
        } else if (analysis.matchesExpectedType === false) {
          setBackIdNotice(`Back ID mismatch: Uploaded "${analysis.detectedDocType}" does not match selected "${expectedType}". Please try again.`);
        } else if (analysis.matchesExpectedName === false) {
          setBackIdNotice(analysis.warning || `Back ID name mismatch: Uploaded ID name does not match "${currentUser?.name}". Please upload your own valid ID.`);
        } else if (!analysis.isClear || analysis.isBlurry) {
          setBackIdNotice(analysis.warning || 'Back ID photo is blurry or unclear. Please retake a clearer photo and try again.');
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveBackId = () => {
    setBackIdNotice('');
    if (/Back of ID|same file|same image/i.test(frontIdNotice)) setFrontIdNotice('');
    setAppForm(prev => ({
      ...prev,
      backIdFileName: '',
      backIdPreviewUrl: '',
      backIdSize: '',
      backIdAnalysis: null,
      isScanningBackId: false
    }));
  };

  const handleRequirementFileUpload = (reqIndex: number, reqLabel: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size === 0) {
      setFormError(`Selected file for "${reqLabel}" is empty. Please choose a valid document.`);
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Qualification file exceeds 5MB limit.');
      return;
    }
    setFormError('');
    const sizeStr = formatDocumentByteSize(file.size);
    const reader = new FileReader();
    reader.onloadend = async () => {
      if (typeof reader.result === 'string') {
        const dataUrl = reader.result as string;
        setReqUploads(prev => ({
          ...prev,
          [reqIndex]: {
            name: file.name,
            url: dataUrl,
            size: sizeStr,
            type: file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Image'
          }
        }));
        setReqUploadScans(prev => ({
          ...prev,
          [reqIndex]: {
            isValid: true,
            isClear: true,
            detectedDocType: 'Scanning photo...',
            warning: null,
            advice: 'Scanning for blur and document validity...',
            score: 80,
            isScanning: true
          }
        }));
        const scanRes = await scanQualificationDocumentPhoto({
          file,
          base64Data: dataUrl,
          expectedRequirementLabel: reqLabel
        });
        setReqUploadScans(prev => ({
          ...prev,
          [reqIndex]: { ...scanRes, isScanning: false }
        }));
        if (!scanRes.isClear || !scanRes.isValid) {
          setFormError(
            scanRes.warning ||
              `"${file.name}" for "${reqLabel}" appears blurry or invalid. Please upload a clearer photo and try again.`
          );
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveRequirementFile = (reqIndex: number) => {
    setReqUploads(prev => {
      const next = { ...prev };
      delete next[reqIndex];
      return next;
    });
    setReqUploadScans(prev => {
      const next = { ...prev };
      delete next[reqIndex];
      return next;
    });
  };

  const hasInvalidQualificationPhoto = () => {
    const reqScanValues = Object.values(reqUploadScans) as Array<DocumentPhotoScanResult & { isScanning?: boolean }>;
    if (reqScanValues.some(s => s.isScanning)) {
      return 'Please wait while your attached qualification photos finish scanning.';
    }
    const badReq = reqScanValues.find(s => !s.isClear || !s.isValid);
    if (badReq) {
      return badReq.warning || 'One of your attached Qualification Document photos is blurry or invalid. Please replace it and try again.';
    }
    return null;
  };

  const validateStep2ForSubmission = (): string | null => {
    if (!applyingProgram) return 'No program selected.';
    if (!appForm.applicantName.trim()) {
      return 'Please enter your full legal name.';
    }
    if (!appForm.contactNumber.trim()) {
      return 'Please enter your contact phone number.';
    }
    const phoneCheck = normalizePhMobileNumber(appForm.contactNumber);
    if (!phoneCheck.valid) {
      return phoneCheck.reason || 'Please enter a valid 11-digit Philippine mobile number.';
    }
    if (!appForm.purok) {
      return 'Please select your Purok / Zone.';
    }
    if (!appForm.address.trim()) {
      return 'Please enter your complete street address.';
    }
    if (!appForm.purpose.trim() || appForm.purpose.trim().length < 10) {
      return 'Please provide a detailed purpose or reason for your request (at least 10 characters).';
    }
    if (appForm.isScanningId || appForm.isScanningBackId) {
      return 'Please wait while your ID photos are being checked.';
    }
    if (!appForm.frontIdPreviewUrl || !appForm.backIdPreviewUrl) {
      return 'Please attach both Front and Back photos of your ID.';
    }
    if (appForm.frontIdPreviewUrl.length > 500 && appForm.frontIdPreviewUrl === appForm.backIdPreviewUrl) {
      return 'Front ID and Back ID cannot use the same file or photo. Please attach separate Front and Back photos.';
    }
    if (appForm.frontIdAnalysis?.aiVisionUsed === false || appForm.backIdAnalysis?.aiVisionUsed === false) {
      return (
        appForm.frontIdAnalysis?.warning ||
        appForm.backIdAnalysis?.warning ||
        'ID verification service was temporarily busy. Please re-attach or try scanning your ID again.'
      );
    }
    if (appForm.frontIdAnalysis?.isId === false || appForm.backIdAnalysis?.isId === false) {
      return 'Not qualified: Front and Back must both be valid IDs.';
    }
    if (
      appForm.frontIdAnalysis?.matchesExpectedSide === false ||
      appForm.frontIdAnalysis?.detectedSide === 'back' ||
      appForm.backIdAnalysis?.matchesExpectedSide === false ||
      appForm.backIdAnalysis?.detectedSide === 'front'
    ) {
      return 'ID side mismatch: Please attach the Front photo in Front of ID and the Back photo in Back of ID.';
    }
    if (appForm.frontIdAnalysis?.matchesExpectedType === false || appForm.backIdAnalysis?.matchesExpectedType === false) {
      return `ID mismatch: Attached Front & Back IDs must match your selected "${appForm.idType}". Please try again.`;
    }
    if (appForm.frontIdAnalysis?.matchesExpectedName === false || appForm.backIdAnalysis?.matchesExpectedName === false) {
      return (
        appForm.frontIdAnalysis?.warning ||
        appForm.backIdAnalysis?.warning ||
        'ID name mismatch: Attached ID must belong to the applicant.'
      );
    }
    if (
      appForm.frontIdAnalysis?.isClear === false ||
      appForm.frontIdAnalysis?.isBlurry === true ||
      appForm.backIdAnalysis?.isClear === false ||
      appForm.backIdAnalysis?.isBlurry === true
    ) {
      return 'ID photo is blurry or unclear. Please try again with a clearer photo.';
    }
    const docScanError = hasInvalidQualificationPhoto();
    if (docScanError) {
      return docScanError;
    }
    const reqMatchesCheck = matchProgramRequirementsWithAccount(applyingProgram, currentUser, residentStoredDocs);
    const missingReq = reqMatchesCheck.find(
      (req, idx) => !req.isOptional && req.status !== 'auto-attached' && !isRealDocumentUrl(reqUploads[idx]?.url)
    );
    if (missingReq) {
      return `Please upload the required document: ${missingReq.requirement}`;
    }
    return null;
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingProgram) return;
    if (isStepsLocked || existingProgramApplication) {
      setFormError(
        `You have already applied for "${applyingProgram.title}"${existingProgramApplication?.referenceCode ? ` (Ref: ${existingProgramApplication.referenceCode})` : ''}. Application steps are locked.`
      );
      return;
    }

    const validationErr = validateStep2ForSubmission();
    if (validationErr) {
      setFormError(validationErr);
      return;
    }
    const phoneCheck = normalizePhMobileNumber(appForm.contactNumber);

    const autoAccountDocsForCheck = getAutoAttachedAccountDocuments(applyingProgram, currentUser, {
      includeIdDoc: false,
      existingDocs: residentStoredDocs
    });
    const autoDocsCount = autoAccountDocsForCheck.length;
    const reqMatchesForCheck = matchProgramRequirementsWithAccount(applyingProgram, currentUser, residentStoredDocs);
    const uploadedReqDocsForCheck = Object.keys(reqUploads).map((idxStr) => {
      const idx = Number(idxStr);
      const uploaded = reqUploads[idx];
      const scanMeta = reqUploadScans[idx];
      const reqLabel = reqMatchesForCheck[idx]?.requirement;
      return {
        name: reqLabel ? `[${reqLabel}] ${uploaded.name}` : uploaded.name,
        docCategory: 'General Requirement',
        fileUrl: uploaded.url,
        previewUrl: uploaded.url,
        verified: Boolean(scanMeta?.isValid !== false),
        ...(scanMeta ? { scanResult: scanMeta } : {})
      };
    });
    const hasVerifiedStudentDoc = hasVerifiedStudentDocument([
      ...autoAccountDocsForCheck,
      ...uploadedReqDocsForCheck,
      ...(appForm.frontIdPreviewUrl
        ? [{ name: appForm.frontIdFileName, docCategory: 'Front ID', fileUrl: appForm.frontIdPreviewUrl, analysis: appForm.frontIdAnalysis || undefined }]
        : [])
    ]);
    const preCheck = evaluateApplicantEligibility({
      programId: applyingProgram.id,
      programTitle: applyingProgram.title,
      programCategory: applyingProgram.category,
      targetAudience: applyingProgram.targetAudience,
      programType: applyingProgram.programType,
      qualificationRules: applyingProgram.qualificationRules,
      eligibilityCriteria: applyingProgram.eligibilityCriteria,
      applicantName: appForm.applicantName,
      purok: appForm.purok,
      address: appForm.address,
      householdIncome: appForm.householdIncome || '₱8,500.00',
      familyCount: Number(appForm.familyMembersCount) || 4,
      occupation: appForm.occupation || 'Resident',
      employmentStatus: currentUser?.employmentStatus,
      age: currentUser?.age,
      civilStatus: currentUser?.civilStatus,
      isPwd: currentUser?.isPwd,
      isSenior: currentUser?.isSenior,
      isSoloParent: currentUser?.isSoloParent,
      isStudent: currentUser?.isStudent,
      hasVerifiedStudentDoc,
      isTeenager: currentUser?.isTeenager,
      isBanned: currentUser?.isBanned,
      hasMedicalNeed: Boolean(currentUser?.hasMedicalNeed),
      isDisasterAffected: Boolean(currentUser?.isDisasterAffected),
      purpose: appForm.purpose,
      hasFrontId: Boolean(appForm.frontIdPreviewUrl),
      hasBackId: Boolean(appForm.backIdPreviewUrl),
      hasSupportingDoc: Object.keys(reqUploads).length > 0 || autoDocsCount > 0,
      hasMissingRequiredDocs: false,
      idAnalysis: appForm.frontIdAnalysis || undefined,
      backIdAnalysis: appForm.backIdAnalysis || undefined
    });

    const isDisasterTarget = isDisasterProgram(applyingProgram);
    const disasterBlockingRule = isDisasterTarget
      ? preCheck.rules.find(
          r =>
            !r.passed &&
            r.ruleName !== 'Income & Priority Bracket' &&
            r.ruleName !== 'Profile & Sector Qualification'
        )
      : undefined;

    if (isDisasterTarget && disasterBlockingRule) {
      setFormError(`${disasterBlockingRule.ruleName}: ${disasterBlockingRule.explanation}`);
      return;
    }
    if (!isDisasterTarget && !preCheck.isCapable) {
      setFormError(
        preCheck.disqualifiedReason ||
          'Application cannot be submitted because one or more qualifications or requirements are invalid.'
      );
      return;
    }

    if (!appForm.agreedToTerms) {
      setFormError('Please accept the certification acknowledgment before submitting.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);

    const documentsToSubmit = [];

    if (appForm.frontIdPreviewUrl) {
      documentsToSubmit.push({
        id: `doc-front-${Date.now()}`,
        name: `[Front ID] ${appForm.frontIdFileName || 'Front_ID.jpg'}`,
        type: 'Image',
        docCategory: 'Front ID' as const,
        previewUrl: appForm.frontIdPreviewUrl,
        fileUrl: appForm.frontIdPreviewUrl,
        size: appForm.frontIdSize || '1.2 MB',
        uploadDate: 'Today',
        verified: false,
        analysis: appForm.frontIdAnalysis || undefined
      });
    }

    if (appForm.backIdPreviewUrl) {
      documentsToSubmit.push({
        id: `doc-back-${Date.now()}`,
        name: `[Back ID] ${appForm.backIdFileName || 'Back_ID.jpg'}`,
        type: 'Image',
        docCategory: 'Back ID' as const,
        previewUrl: appForm.backIdPreviewUrl,
        fileUrl: appForm.backIdPreviewUrl,
        size: appForm.backIdSize || '1.1 MB',
        uploadDate: 'Today',
        verified: false,
        analysis: appForm.backIdAnalysis || undefined
      });
    }

    const autoAccountDocs = getAutoAttachedAccountDocuments(applyingProgram, currentUser, {
      includeIdDoc: false,
      existingDocs: residentStoredDocs
    });
    for (const autoDoc of autoAccountDocs) {
      if (isRealDocumentUrl(autoDoc.fileUrl || autoDoc.previewUrl)) {
        documentsToSubmit.push(autoDoc);
      }
    }

    const reqMatches = matchProgramRequirementsWithAccount(applyingProgram, currentUser, residentStoredDocs);
    Object.keys(reqUploads).forEach((idxStr) => {
      const idx = Number(idxStr);
      const uploaded = reqUploads[idx];
      if (!uploaded || !isRealDocumentUrl(uploaded.url)) return;
      const reqLabel = reqMatches[idx]?.requirement;
      const scanMeta = reqUploadScans[idx];
      documentsToSubmit.push({
        id: `doc-req-${idxStr}-${Date.now()}`,
        name: reqLabel ? `[${reqLabel}] ${uploaded.name}` : uploaded.name,
        type: uploaded.type,
        docCategory: 'General Requirement' as const,
        previewUrl: uploaded.url,
        fileUrl: uploaded.url,
        size: uploaded.size || '1.0 KB',
        uploadDate: 'Today',
        verified: Boolean(scanMeta?.isValid !== false),
        ...(scanMeta ? { scanResult: scanMeta } : {})
      });
    });

    try {
      const ref = await submitAssistanceApplication({
        programId: applyingProgram.id,
        programTitle: applyingProgram.title,
        programCategory: applyingProgram.category,
        programType: applyingProgram.programType,
        category: applyingProgram.category,
        applicantName: appForm.applicantName,
        contactNumber: appForm.contactNumber.trim().startsWith('+') ? (phoneCheck.e164 || appForm.contactNumber) : (phoneCheck.local09 || appForm.contactNumber),
        email: appForm.email,
        purok: appForm.purok,
        address: appForm.address,
        householdMonthlyIncome: appForm.householdIncome || '₱8,500.00',
        familyMembersCount: Number(appForm.familyMembersCount) || 1,
        occupation: appForm.occupation || 'Resident',
        employmentStatus: currentUser?.employmentStatus,
        age: currentUser?.age,
        civilStatus: currentUser?.civilStatus,
        isPwd: currentUser?.isPwd,
        isSenior: currentUser?.isSenior,
        isSoloParent: currentUser?.isSoloParent,
        isStudent: currentUser?.isStudent,
        isTeenager: currentUser?.isTeenager,
        hasMedicalNeed: currentUser?.hasMedicalNeed,
        isDisasterAffected: currentUser?.isDisasterAffected,
        purposeOrDiagnosis: appForm.purpose,
        idCardFrontUrl: appForm.frontIdPreviewUrl,
        idCardBackUrl: appForm.backIdPreviewUrl,
        documents: documentsToSubmit
      });

      setSubmittedRef(ref);
    } catch (err: any) {
      setFormError(
        err?.message ||
          'Application cannot be submitted because required documents or qualifications are incomplete or invalid.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const upperNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'services', label: 'Certification', icon: FileCheck2 },
    { id: 'hazard-map', label: 'Hazard Map', icon: MapPin },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
  ] as const;

  const lowerNavItems = [
    { id: 'help', label: 'Help', icon: HelpCircle },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <div className="min-h-screen flex bg-[#f0f4f9] text-gray-800 font-sans antialiased">
      {/* Left Sidebar (Hidden on Mobile Web, Visible on Desktop) */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col flex-shrink-0 min-h-screen sticky top-0 h-screen z-40">
        <div>
          {/* Logo */}
          <div className="p-6 border-b border-gray-100">
            <BugoLogo size="md" />
          </div>

          {/* Navigation */}
          <nav className="p-4 space-y-1.5">
            {/* Upper Navigations */}
            {upperNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = residentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setResidentTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#0c532b] text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {/* Help & Settings placed directly below upper navigations */}
            <div className="pt-2 mt-2 border-t border-gray-100 space-y-1.5">
              {lowerNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = residentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setResidentTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#0c532b] text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-w-0 ${applyingProgram ? 'no-print' : ''}`}>
        <TopNavBar />

        <main className="flex-1 p-4 sm:p-6 md:p-8 pb-24 md:pb-8 max-w-7xl w-full mx-auto">
          {residentTab === 'dashboard' && (
            <ResidentDashboardView 
              onApplyProgram={handleStartApply}
              onNavigateTab={(tab) => setResidentTab(tab as any)}
            />
          )}

          {residentTab === 'services' && (
            <ResidentServicesView 
              onApplyProgram={handleStartApply}
            />
          )}

          {residentTab === 'announcements' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                  Barangay Announcements & Advisories
                </h1>
              </div>

              {(() => {
                const visibleAnnouncements = announcements.filter(ann =>
                  canResidentViewAnnouncement(currentUser, ann, programs, { disasterVictims, applications })
                );
                if (visibleAnnouncements.length === 0) {
                  return (
                    <div className="py-16 text-center text-gray-400 bg-white rounded-3xl border border-gray-200">
                      <Megaphone className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                      <p className="text-sm font-semibold text-gray-700">No Announcements Available</p>
                      <p className="text-xs text-gray-400 mt-1">There are currently no active public or targeted announcements for your profile.</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {visibleAnnouncements.map((ann) => {
                      const isExclusive = ann.targetAudienceType === 'Qualified Beneficiaries Only';

                      return (
                        <div 
                          key={ann.id} 
                          onClick={() => {
                            setViewingAnn(ann);
                            incrementAnnouncementViews(ann.id);
                          }}
                          className={`bg-white rounded-2xl p-5 border shadow-xs hover:border-[#0c532b] hover:shadow-md transition cursor-pointer flex flex-col justify-between space-y-3 group ${
                            isExclusive ? 'border-emerald-300 ring-1 ring-emerald-100 bg-emerald-50/20' : 'border-gray-200'
                          }`}
                        >
                          <div>
                            <h3 className="text-sm font-bold text-gray-900 group-hover:text-[#0c532b] transition-colors">{ann.title}</h3>
                            <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 mt-1">{ann.description}</p>

                            {/* Release Schedule Quick Preview */}
                            {isExclusive && (ann.releaseDate || ann.meetingTime) && (
                              <div className="mt-2.5 p-2 bg-emerald-100/60 rounded-xl border border-emerald-200 text-[11px] text-emerald-950 space-y-0.5">
                                {ann.releaseDate && (
                                  <div className="font-semibold flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-emerald-700" />
                                    <span>Release Date: {ann.releaseDate}</span>
                                  </div>
                                )}
                                {ann.meetingVenue && (
                                  <div className="text-[10px] text-emerald-800 truncate">
                                    Venue: {ann.meetingVenue}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                            <span className="flex items-center gap-1 font-semibold text-gray-600">
                              <Eye className="w-3.5 h-3.5 text-gray-400" />
                              {ann.viewsCount || 0} {(ann.viewsCount || 0) === 1 ? 'view' : 'views'}
                            </span>
                            <span className="text-emerald-700 font-semibold text-[11px] group-hover:underline">Read Full Notice &rarr;</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              <AnnouncementModal 
                announcement={viewingAnn}
                onClose={() => setViewingAnn(null)}
              />
            </div>
          )}

          {residentTab === 'hazard-map' && (
            <BugoHazardMapView canManage={false} />
          )}

          {residentTab === 'settings' && (
            <ResidentSettingsView />
          )}

          {residentTab === 'help' && (
            <ResidentHelpView />
          )}
        </main>

        {/* Mobile Bottom Quick Navigation Bar (Hidden on Desktop) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 z-40 px-2 py-1.5 flex items-center justify-around shadow-lg">
          <button
            onClick={() => setResidentTab('dashboard')}
            className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition ${residentTab === 'dashboard' ? 'text-[#0c532b] font-bold' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px]">Home</span>
          </button>
          <button
            onClick={() => setResidentTab('services')}
            className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition ${residentTab === 'services' ? 'text-[#0c532b] font-bold' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <FileCheck2 className="w-5 h-5" />
            <span className="text-[10px]">Certification</span>
          </button>
          <button
            onClick={() => setResidentTab('hazard-map')}
            className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition ${residentTab === 'hazard-map' ? 'text-[#0c532b] font-bold' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <MapPin className="w-5 h-5" />
            <span className="text-[10px]">Map</span>
          </button>
          <button
            onClick={() => setResidentTab('announcements')}
            className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition ${residentTab === 'announcements' ? 'text-[#0c532b] font-bold' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Megaphone className="w-5 h-5" />
            <span className="text-[10px]">Notices</span>
          </button>
        </div>
      </div>

      {/* Official Registration & Application Fill-up Form Modal (Empty, Realistic & Simple) */}
      {applyingProgram && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 border border-gray-200 shadow-2xl max-h-[92vh] overflow-y-auto space-y-5 my-6 animate-in fade-in">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-gray-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0c532b]">
                  {isBarangayServiceApplicationItem(applyingProgram)
                    ? 'Official Certificate Application'
                    : 'Official Program Application'}
                </span>
                <h2 className="text-xl font-bold text-gray-900 mt-0.5">
                  {applyingProgram.title}
                </h2>
              </div>
              <button 
                onClick={() => setApplyingProgram(null)}
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!submittedRef ? (
              <form onSubmit={handleSubmitApplication} className="space-y-5 text-xs">
                {/* 3-Step Wizard Navigation Stepper */}
                <div className="grid grid-cols-3 gap-2 pb-2 border-b border-gray-100">
                  <button
                    type="button"
                    disabled={isStepsLocked}
                    onClick={() => {
                      if (isStepsLocked) return;
                      setApplicationStep(1);
                    }}
                    className={`py-2 px-2 rounded-xl text-center transition flex flex-col items-center gap-1 ${
                      isStepsLocked
                        ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-75'
                        : applicationStep === 1
                        ? 'bg-emerald-50 text-[#0c532b] font-extrabold border border-emerald-200 cursor-pointer'
                        : 'text-gray-500 hover:bg-gray-50 cursor-pointer'
                    }`}
                  >
                    <span className="text-[10px] uppercase tracking-wider inline-flex items-center gap-1">
                      {isStepsLocked && <Lock className="w-3 h-3 text-amber-600" />}
                      <span>Step 1</span>
                    </span>
                    <span className="text-xs font-bold truncate">Resident Info</span>
                  </button>

                  <button
                    type="button"
                    disabled={isStepsLocked}
                    onClick={() => {
                      if (isStepsLocked) return;
                      if (!appForm.applicantName.trim() || !appForm.contactNumber.trim() || !appForm.purok || !appForm.address.trim()) {
                        setFormError('Please fill out all required fields in Step 1 first.');
                        return;
                      }
                      const phoneCheckStep2 = normalizePhMobileNumber(appForm.contactNumber);
                      if (!phoneCheckStep2.valid) {
                        setFormError(phoneCheckStep2.reason || 'Please enter a valid 11-digit Philippine mobile number.');
                        return;
                      }
                      setFormError('');
                      setApplicationStep(2);
                    }}
                    className={`py-2 px-2 rounded-xl text-center transition flex flex-col items-center gap-1 ${
                      isStepsLocked
                        ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-75'
                        : applicationStep === 2
                        ? 'bg-emerald-50 text-[#0c532b] font-extrabold border border-emerald-200 cursor-pointer'
                        : 'text-gray-500 hover:bg-gray-50 cursor-pointer'
                    }`}
                  >
                    <span className="text-[10px] uppercase tracking-wider inline-flex items-center gap-1">
                      {isStepsLocked && <Lock className="w-3 h-3 text-amber-600" />}
                      <span>Step 2</span>
                    </span>
                    <span className="text-xs font-bold truncate">Qualification</span>
                  </button>

                  <button
                    type="button"
                    disabled={isStepsLocked}
                    onClick={() => {
                      if (isStepsLocked) return;
                      const err = validateStep2ForSubmission();
                      if (err) {
                        setFormError(err);
                        return;
                      }
                      setFormError('');
                      setApplicationStep(3);
                    }}
                    className={`py-2 px-2 rounded-xl text-center transition flex flex-col items-center gap-1 ${
                      isStepsLocked
                        ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-75'
                        : applicationStep === 3
                        ? 'bg-emerald-50 text-[#0c532b] font-extrabold border border-emerald-200 cursor-pointer'
                        : 'text-gray-500 hover:bg-gray-50 cursor-pointer'
                    }`}
                  >
                    <span className="text-[10px] uppercase tracking-wider inline-flex items-center gap-1">
                      {isStepsLocked && <Lock className="w-3 h-3 text-amber-600" />}
                      <span>Step 3</span>
                    </span>
                    <span className="text-xs font-bold truncate">Review & Submit</span>
                  </button>
                </div>

                {/* Locked State Banner when resident has already applied to this program/service */}
                {isStepsLocked && existingProgramApplication && (
                  <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center mx-auto">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-extrabold text-amber-950">
                        Application Steps Locked — Already Applied
                      </h3>
                      <p className="text-xs text-amber-900 leading-relaxed max-w-md mx-auto">
                        You have already submitted an application for <strong>{applyingProgram.title}</strong>. Only one application per program or service is allowed.
                      </p>
                    </div>
                    <div className="bg-white rounded-xl p-3.5 border border-amber-200 text-left space-y-1.5 max-w-sm mx-auto">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Reference Code:</span>
                        <span className="font-mono font-bold text-gray-900">{existingProgramApplication.referenceCode}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Current Status:</span>
                        <span className="font-bold text-[#0c532b]">{existingProgramApplication.status}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Submitted:</span>
                        <span className="font-semibold text-gray-700">{existingProgramApplication.submissionDate}</span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 pt-1 max-w-sm mx-auto">
                      <button
                        type="button"
                        onClick={() => setApplyingProgram(null)}
                        className="flex-1 py-2.5 bg-white hover:bg-gray-100 text-gray-700 font-bold rounded-xl border border-gray-300 transition cursor-pointer"
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResidentTab('dashboard');
                          setApplyingProgram(null);
                        }}
                        className="flex-1 py-2.5 bg-[#0c532b] hover:bg-[#094222] text-white font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <FileCheck2 className="w-4 h-4" />
                        <span>View My Application</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Form Error Alert */}
                {!isStepsLocked && formError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 font-semibold">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Step 1 Container */}
                {!isStepsLocked && applicationStep === 1 && (
                  <div className="space-y-4">


                {/* Section 1: Applicant Personal Information */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 font-bold text-gray-900 border-b border-gray-100 pb-1.5">
                    <span>Applicant Personal Information</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Full Legal Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Juan C. Dela Cruz"
                        value={appForm.applicantName}
                        onChange={(e) => setAppForm({ ...appForm, applicantName: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 font-medium outline-none focus:ring-2 focus:ring-[#0c532b] focus:border-[#0c532b]"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block font-bold text-gray-700">
                          Contact Phone <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[10px] text-gray-400">
                          {appForm.contactNumber.replace(/\D/g, '').length}/12
                        </span>
                      </div>
                      <input
                        type="tel"
                        maxLength={13}
                        required
                        placeholder="0917 628 4915 or +639176284915"
                        value={appForm.contactNumber}
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          const hasPlus = raw.startsWith('+');
                          const digits = raw.replace(/\D/g, '').slice(0, 12);
                          setAppForm({ ...appForm, contactNumber: hasPlus ? `+${digits}` : digits });
                        }}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 font-medium outline-none focus:ring-2 focus:ring-[#0c532b] focus:border-[#0c532b]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Purok / Zone <span className="text-rose-500">*</span>
                      </label>
                      <select
                        required
                        value={appForm.purok}
                        onChange={(e) => setAppForm({ ...appForm, purok: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 font-medium outline-none focus:ring-2 focus:ring-[#0c532b] focus:border-[#0c532b]"
                      >
                        <option value="">-- Select Purok / Zone --</option>
                        {BUGO_PUROKS.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Complete Street Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="House No., Street, Purok / Sitio"
                        value={appForm.address}
                        onChange={(e) => setAppForm({ ...appForm, address: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 font-medium outline-none focus:ring-2 focus:ring-[#0c532b] focus:border-[#0c532b]"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Socio-Economic Profile */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 font-bold text-gray-900 border-b border-gray-100 pb-1.5">
                    <span>Socio-Economic & Household Profile</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Monthly Household Income</label>
                      <select
                        value={appForm.householdIncome}
                        onChange={(e) => setAppForm({ ...appForm, householdIncome: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 font-medium outline-none focus:ring-2 focus:ring-[#0c532b] focus:border-[#0c532b]"
                      >
                        <option value="">-- Select Income Bracket --</option>
                        {MONTHLY_INCOME_OPTIONS.map((inc) => (
                          <option key={inc} value={inc}>{inc}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Dependents in Family</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 4"
                        value={appForm.familyMembersCount}
                        onChange={(e) => setAppForm({ ...appForm, familyMembersCount: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 font-medium outline-none focus:ring-2 focus:ring-[#0c532b] focus:border-[#0c532b]"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Primary Occupation</label>
                      <input
                        type="text"
                        placeholder="e.g. Self-Employed, Employee, Student"
                        value={appForm.occupation}
                        onChange={(e) => setAppForm({ ...appForm, occupation: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 font-medium outline-none focus:ring-2 focus:ring-[#0c532b] focus:border-[#0c532b]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setApplyingProgram(null)}
                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!appForm.applicantName.trim()) {
                        setFormError('Please enter your full legal name.');
                        return;
                      }
                      if (!appForm.contactNumber.trim()) {
                        setFormError('Please enter your contact phone number.');
                        return;
                      }
                      if (!appForm.purok) {
                        setFormError('Please select your Purok / Zone.');
                        return;
                      }
                      if (!appForm.address.trim()) {
                        setFormError('Please enter your complete street address.');
                        return;
                      }
                      setFormError('');
                      setApplicationStep(2);
                    }}
                    className="px-6 py-2.5 bg-[#0c532b] hover:bg-[#094222] text-white font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Continue to ID & Documents</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: PURPOSE & VALID ID VERIFICATION */}
            {!isStepsLocked && applicationStep === 2 && (
              <div className="space-y-4">
                {/* Section 3: Purpose of Application */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between font-bold text-gray-900 border-b border-gray-100 pb-1.5">
                    <span>Purpose of Request <span className="text-rose-500">*</span></span>
                    <span className="text-[10px] font-normal text-gray-400">Min. 10 characters</span>
                  </div>

                  <div>
                    <textarea
                      rows={3}
                      required
                      placeholder="State why you are applying for this program or certificate..."
                      value={appForm.purpose}
                      onChange={(e) => setAppForm({ ...appForm, purpose: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-xl p-3 font-medium outline-none focus:ring-2 focus:ring-[#0c532b] focus:border-[#0c532b]"
                    />
                  </div>
                </div>

                {/* Section 3.5: Qualification Documents (Auto-Attached from Account + Photo Scan Uploads) */}
                {(() => {
                  const reqMatches = matchProgramRequirementsWithAccount(applyingProgram, currentUser, residentStoredDocs);
                  const autoCount = reqMatches.filter(r => r.status === 'auto-attached').length;

                  return (
                    <div className="space-y-3 bg-gray-50/80 border border-gray-200 rounded-2xl p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-gray-900 block">Qualification Documents</span>
                          <span className="text-[10px] text-gray-500">
                            Auto-checked for clarity and validity.
                          </span>
                        </div>
                        {autoCount > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-emerald-700">
                              {autoCount}/{reqMatches.length} auto-attached
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        {reqMatches.map((req, idx) => {
                          const uploaded = reqUploads[idx];
                          const scan = reqUploadScans[idx];
                          const isAuto = req.status === 'auto-attached';
                          const scanFailed = Boolean(scan && !scan.isScanning && (!scan.isClear || !scan.isValid));

                          return (
                            <div
                              key={idx}
                              className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border ${
                                scanFailed
                                  ? 'bg-rose-50/80 border-rose-300'
                                  : isAuto || (uploaded && !scan?.isScanning)
                                  ? 'bg-emerald-50/60 border-emerald-200'
                                  : 'bg-white border-gray-200'
                              }`}
                            >
                              <div className="flex items-start gap-2 min-w-0">
                                {scanFailed ? (
                                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                ) : scan?.isScanning ? (
                                  <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0 mt-0.5" />
                                ) : isAuto || uploaded ? (
                                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                ) : (
                                  <FileText className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                                )}
                                <div className="min-w-0">
                                  <p className="font-semibold text-gray-900 leading-snug">{req.requirement}</p>
                                  {isAuto ? (
                                    <p className="text-[11px] text-emerald-700 truncate">
                                      {req.sourceLabel || 'Matched from your account'}
                                    </p>
                                  ) : scan?.isScanning ? (
                                    <p className="text-[11px] text-blue-700 font-semibold">
                                      Scanning {uploaded?.name} for clarity &amp; validity...
                                    </p>
                                  ) : scanFailed ? (
                                    <p className="text-[11px] text-rose-700 font-semibold leading-snug">
                                      {scan?.warning || 'Blurry or invalid photo. Please upload a clearer photo and try again.'}
                                    </p>
                                  ) : uploaded ? (
                                    <p className="text-[11px] text-emerald-700 truncate">
                                      Verified: {uploaded.name} ({uploaded.size})
                                      {scan?.matchedKeywords && scan.matchedKeywords.length > 0
                                        ? ` · Keyword: ${scan.matchedKeywords.slice(0, 2).join(', ')}`
                                        : ''}
                                    </p>
                                  ) : (() => {
                                    const reqHint = getRequirementHintLabel(req.requirement);
                                    const hasDistinctHint = reqHint.toLowerCase() !== req.requirement.trim().toLowerCase();
                                    return (
                                      <p className="text-[11px] text-gray-500">
                                        {req.isOptional
                                          ? 'Optional — attach if applicable'
                                          : hasDistinctHint
                                          ? `Must be ${reqHint}`
                                          : 'Upload clear photo or PDF'}
                                      </p>
                                    );
                                  })()}
                                </div>
                              </div>

                              {isAuto ? (
                                <div className="flex items-center gap-2 shrink-0">
                                  {(req.docPayload?.fileUrl || req.docPayload?.previewUrl) && isRealDocumentUrl(req.docPayload.fileUrl || req.docPayload.previewUrl) && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPreviewDocModal({
                                          title: req.docPayload?.name || req.requirement,
                                          url: req.docPayload?.fileUrl || req.docPayload?.previewUrl || ''
                                        })
                                      }
                                      className="text-[11px] font-semibold text-[#0c532b] hover:underline cursor-pointer"
                                    >
                                      View
                                    </button>
                                  )}
                                  <span className="text-[11px] font-semibold text-emerald-700 shrink-0">
                                    {req.shortStatus || 'Ready'}
                                  </span>
                                </div>
                              ) : uploaded ? (
                                <div className="flex items-center gap-2 shrink-0">
                                  {isRealDocumentUrl(uploaded.url) && (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewDocModal({ title: uploaded.name, url: uploaded.url })}
                                      className="text-[11px] font-semibold text-[#0c532b] hover:underline cursor-pointer"
                                    >
                                      View
                                    </button>
                                  )}
                                  {scanFailed && (
                                    <label className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold cursor-pointer">
                                      Try Again
                                      <input
                                        type="file"
                                        accept=".pdf,image/*"
                                        onChange={(e) => handleRequirementFileUpload(idx, req.requirement, e)}
                                        className="hidden"
                                      />
                                    </label>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRequirementFile(idx)}
                                    className="text-[11px] font-bold text-rose-600 hover:underline shrink-0 cursor-pointer"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ) : (
                                <label className="px-2.5 py-1 bg-white hover:bg-gray-50 text-[#0c532b] border border-gray-300 rounded-lg text-[11px] font-bold cursor-pointer shrink-0">
                                  Upload
                                  <input
                                    type="file"
                                    accept=".pdf,image/*"
                                    onChange={(e) => handleRequirementFileUpload(idx, req.requirement, e)}
                                    className="hidden"
                                  />
                                </label>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Section 4: Front and Back ID Verification */}
                <div className="space-y-3">
                  {/* Visual Step-by-Step Guide for Taking a Valid ID Photo */}
                  <div className="rounded-xl border border-[#0c532b]/35 overflow-hidden bg-white shadow-2xs">
                    <img
                      src={GUIDE_ASSETS.idCaptureSteps}
                      alt="Step-by-step guide: prepare lighting and surface, capture clear front and back, match and verify ID type"
                      className="w-full h-auto object-contain block"
                    />
                  </div>

                  {/* ID Type Selector */}
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Select Valid Government ID Type <span className="text-[10px] font-normal text-gray-500">(Attached Front &amp; Back must match this ID)</span>
                    </label>
                    <select
                      value={appForm.idType}
                      onChange={async (e) => {
                        const nextType = e.target.value;
                        setAppForm(prev => ({ ...prev, idType: nextType }));
                        setFormError('');
                        setFrontIdNotice('');
                        setBackIdNotice('');

                        const recheck = async (side: 'front' | 'back', dataUrl: string, fileName: string) => {
                          if (!dataUrl || !dataUrl.startsWith('data:image/')) return;
                          setAppForm(prev => ({
                            ...prev,
                            ...(side === 'front' ? { isScanningId: true } : { isScanningBackId: true })
                          }));
                          try {
                            const analysis = await scanIdPhotoWithClarityAndType({
                              dataUrl,
                              fileName,
                              side,
                              expectedIdType: nextType,
                              expectedName: currentUser?.name,
                            });
                            setAppForm(prev => ({
                              ...prev,
                              ...(side === 'front'
                                ? { frontIdAnalysis: analysis, isScanningId: false }
                                : { backIdAnalysis: analysis, isScanningBackId: false })
                            }));
                            if (!analysis.isId) {
                              const msg = analysis.warning || `${side === 'front' ? 'Front' : 'Back'} photo is not a valid ID.`;
                              if (side === 'front') setFrontIdNotice(msg);
                              else setBackIdNotice(msg);
                            } else if (analysis.matchesExpectedType === false) {
                              const msg = `${side === 'front' ? 'Front' : 'Back'} ID mismatch: Uploaded "${analysis.detectedDocType}" does not match selected "${nextType}". Please try again.`;
                              if (side === 'front') setFrontIdNotice(msg);
                              else setBackIdNotice(msg);
                            }
                          } catch {
                            setAppForm(prev => ({
                              ...prev,
                              ...(side === 'front' ? { isScanningId: false } : { isScanningBackId: false })
                            }));
                            setFormError('Unable to reach ID verification service. Please try again.');
                          }
                        };

                        if (appForm.frontIdPreviewUrl) {
                          await recheck('front', appForm.frontIdPreviewUrl, appForm.frontIdFileName || 'front.jpg');
                        }
                        if (appForm.backIdPreviewUrl) {
                          await recheck('back', appForm.backIdPreviewUrl, appForm.backIdFileName || 'back.jpg');
                        }
                      }}
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 font-medium outline-none focus:ring-2 focus:ring-[#0c532b]"
                    >
                      {currentUser?.idType &&
                        ![
                          'PhilSys National ID (PhilID / ePhilID)',
                          "LTO Driver's License",
                          "COMELEC Voter's ID / Certificate",
                          'Barangay Bugo Citizen ID',
                          'UMID / SSS ID',
                          'DFA Philippine Passport',
                          'Senior Citizen / PWD ID',
                          'Valid Student ID'
                        ].includes(currentUser.idType) && (
                          <option value={currentUser.idType}>{currentUser.idType}</option>
                        )}
                      <option value="PhilSys National ID (PhilID / ePhilID)">PhilSys National ID (PhilID / ePhilID)</option>
                      <option value="LTO Driver's License">LTO Driver's License</option>
                      <option value="COMELEC Voter's ID / Certificate">COMELEC Voter's ID / Certificate</option>
                      <option value="Barangay Bugo Citizen ID">Barangay Bugo Official Citizen ID</option>
                      <option value="UMID / SSS ID">Unified Multi-Purpose ID (UMID / SSS)</option>
                      <option value="DFA Philippine Passport">DFA Philippine Passport</option>
                      <option value="Senior Citizen / PWD ID">Senior Citizen / PWD Identification Card</option>
                      <option value="Valid Student ID">DepEd / CHED Valid Student ID</option>
                    </select>
                  </div>

                  {/* Front & Back ID Uploads in 2 Columns (Independent Scanners & Notices) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Front ID Dropzone */}
                    <div className="bg-gray-50/80 rounded-2xl border-2 border-dashed border-gray-300 hover:border-[#0c532b] transition p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-800 flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-[#0c532b]" />
                          <span>Front of ID</span>
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                          Front Scanner
                        </span>
                      </div>

                      {appForm.frontIdPreviewUrl ? (
                        <div className="space-y-2">
                          <div className="relative rounded-xl overflow-hidden h-28 bg-gray-100 border border-gray-200 group">
                            <img 
                              src={appForm.frontIdPreviewUrl} 
                              alt="Front ID Preview" 
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setPreviewDocModal({ title: 'Front of ID', url: appForm.frontIdPreviewUrl })}
                                className="p-1.5 bg-white text-gray-900 rounded-lg shadow-sm hover:scale-105"
                                title="Zoom Image"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          {appForm.isScanningId ? (
                            <p className="text-[11px] font-semibold text-[#0c532b] flex items-center gap-1.5">
                              <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
                              <span>Front scanner checking ID...</span>
                            </p>
                          ) : appForm.frontIdAnalysis?.aiVisionUsed === false ? (
                            <p className="text-[11px] font-bold text-amber-700">Verification service busy — Try again.</p>
                          ) : appForm.frontIdAnalysis?.isId === false ? (
                            <p className="text-[11px] font-bold text-rose-600">Not a valid Front ID — Try again.</p>
                          ) : appForm.frontIdAnalysis?.matchesExpectedSide === false || appForm.frontIdAnalysis?.detectedSide === 'back' ? (
                            <p className="text-[11px] font-bold text-rose-600">Front slot contains Back side — Attach Front photo.</p>
                          ) : appForm.frontIdAnalysis?.matchesExpectedType === false ? (
                            <p className="text-[11px] font-bold text-rose-600">Does not match {appForm.idType} — Try again.</p>
                          ) : appForm.frontIdAnalysis?.isClear === false ? (
                            <p className="text-[11px] font-bold text-amber-700">Front photo blurry / not clear — Try again.</p>
                          ) : (
                            <p className="text-[11px] font-semibold text-emerald-700">
                              Front Verified ({appForm.frontIdAnalysis?.detectedDocType || appForm.idType})
                            </p>
                          )}
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-600 truncate max-w-[130px]">
                              {appForm.frontIdFileName}
                            </span>
                            <div className="flex items-center gap-2">
                              <label className="cursor-pointer text-[#0c532b] font-bold hover:underline">
                                {appForm.frontIdAnalysis && (appForm.frontIdAnalysis.aiVisionUsed === false || !appForm.frontIdAnalysis.isId || !appForm.frontIdAnalysis.isClear || appForm.frontIdAnalysis.matchesExpectedType === false || appForm.frontIdAnalysis.matchesExpectedSide === false) ? 'Try Again' : 'Change'}
                                <input type="file" accept="image/*" onChange={handleFrontIdUpload} className="hidden" />
                              </label>
                              <button
                                type="button"
                                onClick={handleRemoveFrontId}
                                className="text-rose-600 hover:text-rose-800 p-1 rounded"
                                title="Remove file"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center h-28 bg-white rounded-xl border border-gray-200 cursor-pointer hover:bg-emerald-50/40 transition p-3 text-center">
                          <UploadCloud className="w-7 h-7 text-gray-400 mb-1.5" />
                          <span className="text-xs font-bold text-gray-800">Attach Front of ID</span>
                          <span className="text-[10px] text-gray-400 mt-0.5">JPG or PNG up to 5MB</span>
                          <input type="file" accept="image/*" onChange={handleFrontIdUpload} className="hidden" />
                        </label>
                      )}
                      {frontIdNotice && (
                        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] font-semibold text-rose-800 flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <span>{frontIdNotice}</span>
                        </div>
                      )}
                    </div>

                    {/* Back ID Dropzone */}
                    <div className="bg-gray-50/80 rounded-2xl border-2 border-dashed border-gray-300 hover:border-[#0c532b] transition p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-800 flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-[#0c532b]" />
                          <span>Back of ID</span>
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                          Back Scanner
                        </span>
                      </div>

                      {appForm.backIdPreviewUrl ? (
                        <div className="space-y-2">
                          <div className="relative rounded-xl overflow-hidden h-28 bg-gray-100 border border-gray-200 group">
                            <img 
                              src={appForm.backIdPreviewUrl} 
                              alt="Back ID Preview" 
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setPreviewDocModal({ title: 'Back of ID', url: appForm.backIdPreviewUrl })}
                                className="p-1.5 bg-white text-gray-900 rounded-lg shadow-sm hover:scale-105"
                                title="Zoom Image"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          {appForm.isScanningBackId ? (
                            <p className="text-[11px] font-semibold text-[#0c532b] flex items-center gap-1.5">
                              <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
                              <span>Back scanner checking ID...</span>
                            </p>
                          ) : appForm.backIdAnalysis?.aiVisionUsed === false ? (
                            <p className="text-[11px] font-bold text-amber-700">Verification service busy — Try again.</p>
                          ) : appForm.backIdAnalysis?.isId === false ? (
                            <p className="text-[11px] font-bold text-rose-600">Not a valid Back ID — Try again.</p>
                          ) : appForm.backIdAnalysis?.matchesExpectedSide === false || appForm.backIdAnalysis?.detectedSide === 'front' ? (
                            <p className="text-[11px] font-bold text-rose-600">Back slot contains Front side — Attach Back photo.</p>
                          ) : appForm.backIdAnalysis?.matchesExpectedType === false ? (
                            <p className="text-[11px] font-bold text-rose-600">Does not match {appForm.idType} — Try again.</p>
                          ) : appForm.backIdAnalysis?.isClear === false ? (
                            <p className="text-[11px] font-bold text-amber-700">Back photo blurry / not clear — Try again.</p>
                          ) : (
                            <p className="text-[11px] font-semibold text-emerald-700">
                              Back Verified ({appForm.backIdAnalysis?.detectedDocType || appForm.idType})
                            </p>
                          )}
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-600 truncate max-w-[130px]">
                              {appForm.backIdFileName}
                            </span>
                            <div className="flex items-center gap-2">
                              <label className="cursor-pointer text-[#0c532b] font-bold hover:underline">
                                {appForm.backIdAnalysis && (appForm.backIdAnalysis.aiVisionUsed === false || !appForm.backIdAnalysis.isId || !appForm.backIdAnalysis.isClear || appForm.backIdAnalysis.matchesExpectedType === false || appForm.backIdAnalysis.matchesExpectedSide === false) ? 'Try Again' : 'Change'}
                                <input type="file" accept="image/*" onChange={handleBackIdUpload} className="hidden" />
                              </label>
                              <button
                                type="button"
                                onClick={handleRemoveBackId}
                                className="text-rose-600 hover:text-rose-800 p-1 rounded"
                                title="Remove file"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center h-28 bg-white rounded-xl border border-gray-200 cursor-pointer hover:bg-emerald-50/40 transition p-3 text-center">
                          <UploadCloud className="w-7 h-7 text-gray-400 mb-1.5" />
                          <span className="text-xs font-bold text-gray-800">Attach Back of ID</span>
                          <span className="text-[10px] text-gray-400 mt-0.5">JPG or PNG up to 5MB</span>
                          <input type="file" accept="image/*" onChange={handleBackIdUpload} className="hidden" />
                        </label>
                      )}
                      {backIdNotice && (
                        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] font-semibold text-rose-800 flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <span>{backIdNotice}</span>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setApplicationStep(1)}
                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Resident Info</span>
                  </button>

                  <button
                    type="button"
                    disabled={appForm.isScanningId || appForm.isScanningBackId}
                    onClick={() => {
                      const err = validateStep2ForSubmission();
                      if (err) {
                        setFormError(err);
                        return;
                      }
                      setFormError('');
                      setApplicationStep(3);
                    }}
                    className="px-6 py-2.5 bg-[#0c532b] hover:bg-[#094222] text-white font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>{appForm.isScanningId || appForm.isScanningBackId ? 'Checking IDs...' : 'Review Application'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: REVIEW & SWORN CERTIFICATION */}
            {!isStepsLocked && applicationStep === 3 && (() => {
              const step3AutoDocs = getAutoAttachedAccountDocuments(applyingProgram, currentUser, { includeIdDoc: false, existingDocs: residentStoredDocs });
              const autoDocsCount = step3AutoDocs.length;
              const step3ReqMatches = matchProgramRequirementsWithAccount(applyingProgram, currentUser, residentStoredDocs);
              const step3MissingReqs = step3ReqMatches.filter(
                (req, idx) => !req.isOptional && req.status !== 'auto-attached' && !isRealDocumentUrl(reqUploads[idx]?.url)
              );
              const step3ScanError = hasInvalidQualificationPhoto();
              const step3ValidationError = validateStep2ForSubmission();
              const hasMissingDocs = Boolean(step3MissingReqs.length > 0 || step3ScanError || step3ValidationError);
              const missingDocsLabel = step3ValidationError
                ? step3ValidationError
                : step3ScanError
                ? step3ScanError
                : step3MissingReqs.length > 0
                ? `Missing required document(s): ${step3MissingReqs.map(r => `${r.requirement} (${getRequirementHintLabel(r.requirement)})`).join('; ')}`
                : undefined;
              const step3UploadedDocs = Object.keys(reqUploads).map((idxStr) => {
                const idx = Number(idxStr);
                const uploaded = reqUploads[idx];
                const scanMeta = reqUploadScans[idx];
                const reqLabel = step3ReqMatches[idx]?.requirement;
                return {
                  name: reqLabel ? `[${reqLabel}] ${uploaded.name}` : uploaded.name,
                  docCategory: 'General Requirement',
                  fileUrl: uploaded.url,
                  previewUrl: uploaded.url,
                  verified: Boolean(scanMeta?.isValid !== false),
                  ...(scanMeta ? { scanResult: scanMeta } : {})
                };
              });
              const hasVerifiedStudentDoc = hasVerifiedStudentDocument([
                ...step3AutoDocs,
                ...step3UploadedDocs,
                ...(appForm.frontIdPreviewUrl
                  ? [{ name: appForm.frontIdFileName, docCategory: 'Front ID', fileUrl: appForm.frontIdPreviewUrl, analysis: appForm.frontIdAnalysis || undefined }]
                  : [])
              ]);
              const preCheck = evaluateApplicantEligibility({
                programId: applyingProgram.id,
                programTitle: applyingProgram.title,
                programCategory: applyingProgram.category,
                targetAudience: applyingProgram.targetAudience,
                programType: applyingProgram.programType,
                qualificationRules: applyingProgram.qualificationRules,
                eligibilityCriteria: applyingProgram.eligibilityCriteria,
                applicantName: appForm.applicantName,
                purok: appForm.purok,
                address: appForm.address,
                householdIncome: appForm.householdIncome || '₱8,500.00',
                familyCount: Number(appForm.familyMembersCount) || 4,
                occupation: appForm.occupation || 'Resident',
                employmentStatus: currentUser?.employmentStatus,
                age: currentUser?.age,
                civilStatus: currentUser?.civilStatus,
                isPwd: currentUser?.isPwd,
                isSenior: currentUser?.isSenior,
                isSoloParent: currentUser?.isSoloParent,
                isStudent: currentUser?.isStudent,
                hasVerifiedStudentDoc,
                isTeenager: currentUser?.isTeenager,
                isBanned: currentUser?.isBanned,
                hasMedicalNeed: Boolean(currentUser?.hasMedicalNeed),
                isDisasterAffected: Boolean(currentUser?.isDisasterAffected),
                purpose: appForm.purpose,
                hasFrontId: Boolean(appForm.frontIdPreviewUrl),
                hasBackId: Boolean(appForm.backIdPreviewUrl),
                hasSupportingDoc: Object.keys(reqUploads).length > 0 || autoDocsCount > 0,
                hasMissingRequiredDocs: hasMissingDocs,
                missingDocsLabel,
                idAnalysis: appForm.frontIdAnalysis || undefined,
                backIdAnalysis: appForm.backIdAnalysis || undefined
              });
              const isDisasterTarget = isDisasterProgram(applyingProgram);
              const disasterBlockingRule = isDisasterTarget
                ? preCheck.rules.find(
                    r =>
                      !r.passed &&
                      r.ruleName !== 'Income & Priority Bracket' &&
                      r.ruleName !== 'Profile & Sector Qualification'
                  )
                : undefined;
              const canSubmit = isDisasterTarget
                ? !hasMissingDocs && !disasterBlockingRule
                : !hasMissingDocs && preCheck.isCapable;

              return (
              <div className="space-y-4">
                {/* Automatic System Qualification Assessment */}
                <div className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
                  canSubmit
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50 border-rose-300 text-rose-950'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold flex items-center gap-1.5 text-xs">
                      <ShieldCheck className={`w-4 h-4 ${canSubmit ? 'text-[#0c532b]' : 'text-rose-700'}`} />
                      <span>System Qualification</span>
                    </span>
                    <span className={`text-xs font-bold flex items-center gap-1 ${
                      canSubmit ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {canSubmit ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5" />
                      )}
                      <span>{canSubmit ? (isDisasterTarget ? 'Complete' : 'Valid') : 'Invalid'}</span>
                    </span>
                  </div>
                  <p className="text-xs leading-snug">
                    {canSubmit
                      ? isDisasterTarget
                        ? 'All required documents and details are complete. Ready to submit for Barangay Admin review.'
                        : 'All requirements and qualifications satisfied. Application will be marked as Valid and submitted.'
                      : (missingDocsLabel ||
                          (disasterBlockingRule ? `${disasterBlockingRule.ruleName}: ${disasterBlockingRule.explanation}` : undefined) ||
                          preCheck.disqualifiedReason ||
                          preCheck.summary)}
                  </p>
                  {!canSubmit && (
                    <p className="text-[11px] font-bold text-rose-700 pt-0.5">
                      Submission prevented: All requirements and qualifications must be valid and complete before you can submit.
                    </p>
                  )}
                </div>

                {/* Summary Ticket Card */}
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Application Summary</span>
                    <span className="text-xs font-bold text-[#0c532b] bg-emerald-100 px-2 py-0.5 rounded">
                      {applyingProgram.category}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-400">Requested Service:</span>
                      <p className="font-bold text-gray-900">{applyingProgram.title}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Processing Time:</span>
                      <p className="font-bold text-gray-900">{applyingProgram.processingTime}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Applicant:</span>
                      <p className="font-semibold text-gray-800">{appForm.applicantName}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Contact Number:</span>
                      <p className="font-semibold text-gray-800">{appForm.contactNumber}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Zone / Purok:</span>
                      <p className="font-semibold text-gray-800">{appForm.purok}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Government ID:</span>
                      <p className="font-bold text-[#0c532b]">{appForm.idType}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-200 text-xs">
                    <span className="text-gray-400">Statement of Purpose:</span>
                    <p className="font-medium text-gray-700 italic mt-0.5">{appForm.purpose}</p>
                  </div>

                  {(() => {
                    const reqMatches = matchProgramRequirementsWithAccount(applyingProgram, currentUser, residentStoredDocs);
                    if (reqMatches.length === 0) return null;
                    return (
                      <div className="pt-2 border-t border-gray-200 text-xs space-y-1">
                        <span className="text-gray-400 block">Qualification Documents Status:</span>
                        <div className="space-y-1">
                          {reqMatches.map((r, i) => {
                            const uploaded = reqUploads[i];
                            const ready = r.status === 'auto-attached' || Boolean(uploaded);
                            return (
                              <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="text-gray-700 truncate">{r.requirement}</span>
                                <span className={`font-semibold shrink-0 ${ready ? 'text-emerald-700' : 'text-gray-400'}`}>
                                  {uploaded ? 'Uploaded' : r.shortStatus || (r.status === 'auto-attached' ? 'Ready' : r.isOptional ? 'Optional' : 'Upload')}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Section 5: Sworn Certification */}
                <div className="p-3.5 bg-white rounded-2xl border border-gray-200">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      checked={appForm.agreedToTerms}
                      onChange={(e) => setAppForm({ ...appForm, agreedToTerms: e.target.checked })}
                      className="mt-0.5 rounded text-[#0c532b] focus:ring-[#0c532b]"
                    />
                    <span className="text-[11px] text-gray-700 leading-snug">
                      I hereby swear and certify that all information provided and attached identification documents are authentic, accurate, and belong to me.
                    </span>
                  </label>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => setApplicationStep(2)}
                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Edit Documents</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting || !appForm.agreedToTerms || !canSubmit}
                    className="px-6 py-2.5 bg-[#0c532b] hover:bg-[#094222] text-white font-bold rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <span>Processing...</span>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Submit Application</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              );
            })()}
              </form>
            ) : (
              /* Official Application Receipt & System Decision Slip (Approved or Invalid) */
              (() => {
                const submittedApp = applications.find(a => a.referenceCode === submittedRef);
                const isDisqualified = submittedApp?.status === 'Disqualified';
                const isPendingAdminReview =
                  isDisasterProgram(applyingProgram) || submittedApp?.status === 'Under Review';
                const evaluation = submittedApp?.eligibilityEvaluation;
                const handlePrintCurrentReceipt = () => {
                  if (!submittedRef) return;
                  const statusLabel = isPendingAdminReview && !isDisqualified
                    ? 'Under Review (Admin Decision)'
                    : isDisqualified
                    ? 'Disqualified (Invalid)'
                    : (submittedApp?.status || 'Valid');
                  const summaryNote = isPendingAdminReview && !isDisqualified
                    ? 'Only the Barangay Admin decides who is qualified in Disaster Programs. You will be notified once reviewed.'
                    : isDisqualified
                    ? (evaluation?.disqualifiedReason || submittedApp?.rejectionReason || 'Does not meet program requirements.')
                    : 'All requirements and qualifications satisfied. Marked as Valid and successfully submitted.';
                  printResidentReceipt({
                    referenceCode: submittedRef,
                    programTitle: submittedApp?.programTitle || applyingProgram.title,
                    programCategory: submittedApp?.programCategory || applyingProgram.category,
                    processingTime: applyingProgram.processingTime,
                    approvedAmount: submittedApp?.approvedAmount || applyingProgram.maxBenefitAmount,
                    applicantName: submittedApp?.applicantName || appForm.applicantName,
                    contactNumber: submittedApp?.contactNumber || appForm.contactNumber,
                    email: submittedApp?.email || appForm.email,
                    purok: submittedApp?.purok || appForm.purok,
                    address: submittedApp?.address || appForm.address,
                    purpose: submittedApp?.purposeOrDiagnosis || appForm.purpose,
                    status: statusLabel,
                    submissionDate: submittedApp?.submissionDate,
                    summaryNote,
                    documents: submittedApp?.documents?.map(d => ({
                      name: d.name,
                      docCategory: d.docCategory,
                      verified: d.verified
                    })),
                    rules: evaluation?.rules?.map(r => ({
                      ruleName: r.ruleName,
                      passed: r.passed,
                      explanation: r.explanation
                    }))
                  });
                };

                if (isPendingAdminReview && !isDisqualified) {
                  return (
                    <div className="space-y-4 text-xs">
                      <div className="p-5 bg-white border-2 border-amber-200 rounded-3xl text-center space-y-3 font-sans printable-document">
                        <div className="w-11 h-11 rounded-full bg-amber-600 text-white flex items-center justify-center mx-auto shadow-sm">
                          <Clock className="w-5 h-5" />
                        </div>

                        <div className="space-y-0.5">
                          <h3 className="text-base font-extrabold text-gray-900">
                            Submitted for Admin Review
                          </h3>
                          <p className="text-xs text-amber-700 font-medium">
                            Pending Barangay Admin Qualification Decision
                          </p>
                        </div>

                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 text-left space-y-2 text-xs">
                          <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                            <span className="text-gray-500">Reference:</span>
                            <span className="font-mono font-bold text-gray-900 text-sm">
                              {submittedRef}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-gray-500">Service:</span>
                            <span className="font-bold text-gray-900">{applyingProgram.title}</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-gray-500">Applicant:</span>
                            <span className="font-semibold text-gray-800">{appForm.applicantName}</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-gray-500">Purok / Zone:</span>
                            <span className="font-semibold text-gray-800">{appForm.purok}</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-gray-500">Status:</span>
                            <span className="font-bold text-amber-700">Under Review (Admin Decision)</span>
                          </div>
                        </div>

                        <p className="text-[11px] text-amber-800 font-medium px-2">
                          Only the Barangay Admin decides who is qualified in Disaster Programs. You will be notified once reviewed.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 no-print">
                        <button
                          type="button"
                          onClick={handlePrintCurrentReceipt}
                          className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                          <span>Print Receipt</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setResidentTab('dashboard');
                            setApplyingProgram(null);
                          }}
                          className="flex-1 py-2.5 bg-[#0c532b] hover:bg-[#094222] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                        >
                          <FileCheck2 className="w-4 h-4" />
                          <span>View In Dashboard</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setApplyingProgram(null)}
                          className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  );
                }

                if (isDisqualified) {
                  return (
                    <div className="space-y-4 text-xs">
                      <div className="p-5 bg-rose-50/80 border border-rose-300 rounded-3xl text-center space-y-3 font-sans">
                        <div className="w-11 h-11 rounded-full bg-rose-600 text-white flex items-center justify-center mx-auto shadow-sm">
                          <AlertTriangle className="w-5 h-5" />
                        </div>

                        <div className="space-y-0.5">
                          <h3 className="text-base font-extrabold text-rose-950">
                            Application Invalid
                          </h3>
                          <p className="text-xs text-rose-700">
                            Automatic System Decision • Does not meet qualifications
                          </p>
                        </div>

                        <div className="bg-white rounded-2xl p-4 border border-rose-200 text-left space-y-2 text-xs">
                          <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                            <span className="text-gray-400">Reference:</span>
                            <span className="font-mono font-bold text-gray-900 text-sm">
                              {submittedRef}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-gray-400">Service:</span>
                            <span className="font-bold text-gray-900">{applyingProgram.title}</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-gray-400">Applicant:</span>
                            <span className="font-semibold text-gray-800">{appForm.applicantName}</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-gray-400">Status:</span>
                            <span className="font-bold text-rose-700">Disqualified (Invalid)</span>
                          </div>

                          <div className="pt-2 border-t border-gray-100 text-rose-900">
                            <strong className="block text-rose-950 mb-0.5">Reason:</strong>
                            <p className="text-[11px] leading-relaxed">
                              {evaluation?.disqualifiedReason || submittedApp?.rejectionReason || 'Does not meet program requirements.'}
                            </p>
                          </div>

                          {evaluation && evaluation.rules && (
                            <div className="pt-2 border-t border-gray-100 space-y-1 text-[11px]">
                              {evaluation.rules.map((r, i) => (
                                <div key={i} className={`flex items-center justify-between ${
                                  r.passed ? 'text-emerald-700' : 'text-rose-700 font-semibold'
                                }`}>
                                  <span>{r.ruleName}</span>
                                  <span>{r.passed ? 'Passed' : 'Failed'}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={handlePrintCurrentReceipt}
                          className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                          <span>Print Notice</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setApplyingProgram(null)}
                          className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4 text-xs">
                    <div className="p-5 bg-white border-2 border-emerald-200 rounded-3xl text-center space-y-3 font-sans printable-document">
                      <div className="w-11 h-11 rounded-full bg-[#0c532b] text-white flex items-center justify-center mx-auto shadow-sm">
                        <CheckCircle className="w-5 h-5" />
                      </div>

                      <div className="space-y-0.5">
                        <h3 className="text-base font-extrabold text-gray-900">
                          Application Valid &amp; Submitted
                        </h3>
                        <p className="text-xs text-emerald-700 font-medium">
                          All Requirements &amp; Qualifications Satisfied
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 text-left space-y-2 text-xs">
                        <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                          <span className="text-gray-500">Reference:</span>
                          <span className="font-mono font-bold text-gray-900 text-sm">
                            {submittedRef}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-gray-500">Service:</span>
                          <span className="font-bold text-gray-900">{applyingProgram.title}</span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-gray-500">Applicant:</span>
                          <span className="font-semibold text-gray-800">{appForm.applicantName}</span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-gray-500">Purok / Zone:</span>
                          <span className="font-semibold text-gray-800">{appForm.purok}</span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-gray-500">Status:</span>
                          <span className="font-bold text-emerald-700">{submittedApp?.status || 'Valid'}</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-[#0c532b] font-medium px-2">
                        All requirements and qualifications satisfied. Marked as Valid and successfully submitted.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 no-print">
                      <button
                        type="button"
                        onClick={handlePrintCurrentReceipt}
                        className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Print Receipt</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setResidentTab('dashboard');
                          setApplyingProgram(null);
                        }}
                        className="flex-1 py-2.5 bg-[#0c532b] hover:bg-[#094222] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                      >
                        <FileCheck2 className="w-4 h-4" />
                        <span>View In Dashboard</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setApplyingProgram(null)}
                        className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* Document Zoom Modal */}
      {previewDocModal && (
        <DocumentPreviewModal
          title={previewDocModal.title}
          url={previewDocModal.url}
          onClose={() => setPreviewDocModal(null)}
        />
      )}
    </div>
  );
};
