import { AssistanceProgram, ResidentUser, UploadedDocument } from '../types';
import { PROGRAM_RULES, parseMonthlyIncome } from './eligibilityEngine';
import { createRealPdfDataUrl, formatDocumentByteSize, isRealDocumentUrl } from './realDocumentPdf';
import { extractTextFromInlineDataUrl, matchRequirementKeywords } from './requirementKeywordMatcher';

export interface MatchedRequirementItem {
  requirement: string;
  status: 'auto-attached' | 'upload-needed';
  requirementKind?: 'account-ready' | 'auto-form' | 'upload-required' | 'optional';
  shortStatus?: string;
  isOptional?: boolean;
  sourceLabel?: string;
  matchKey?:
    | 'valid-id'
    | 'residency'
    | 'pwd'
    | 'solo-parent'
    | 'senior'
    | 'student'
    | 'income'
    | 'indigency'
    | 'application-form'
    | 'household-info'
    | 'uploaded-file';
  docPayload?: UploadedDocument;
}

/**
 * Returns the explicit requirements list for a program/certificate,
 * falling back to PROGRAM_RULES or a sensible baseline if empty.
 */
export function getEffectiveProgramRequirements(
  program?: Partial<AssistanceProgram> | null
): string[] {
  if (!program) return [];
  const explicit = Array.isArray(program.requirements)
    ? program.requirements.map(r => String(r).trim()).filter(Boolean)
    : [];
  if (explicit.length > 0) return explicit;

  const rule = program.id ? PROGRAM_RULES[program.id] : undefined;
  if (rule?.mandatoryDocs && rule.mandatoryDocs.length > 0) {
    return rule.mandatoryDocs;
  }

  return ['Valid Government or Resident ID', 'Proof of Residency (Barangay Bugo)'];
}

function isOptionalRequirementText(textLower: string): boolean {
  return (
    textLower.includes('(if applicable') ||
    textLower.includes('(if available') ||
    textLower.includes('(if required') ||
    textLower.includes('(if any') ||
    textLower.includes('(optional') ||
    textLower.includes('*optional')
  );
}

function resolveDataUrlSizeLabel(url?: string | null, fallbackBytes = 2400): string {
  if (!url) return formatDocumentByteSize(fallbackBytes);
  if (url.startsWith('data:')) {
    const commaIdx = url.indexOf(',');
    if (commaIdx !== -1) {
      const base64Len = url.length - commaIdx - 1;
      const estimatedBytes = Math.max(512, Math.round((base64Len * 3) / 4));
      return formatDocumentByteSize(estimatedBytes);
    }
  }
  return formatDocumentByteSize(fallbackBytes);
}

function findMatchingStoredDoc(
  requirement: string,
  existingDocs?: UploadedDocument[]
): UploadedDocument | undefined {
  if (!Array.isArray(existingDocs) || existingDocs.length === 0) return undefined;

  const realDocs = existingDocs.filter(
    (doc) =>
      isRealDocumentUrl(doc.fileUrl || doc.previewUrl) &&
      doc.scanResult?.isValid !== false &&
      doc.scanResult?.isClear !== false &&
      (doc.analysis as any)?.isValid !== false &&
      doc.analysis?.isClear !== false &&
      doc.analysis?.isId !== false
  );
  if (realDocs.length === 0) return undefined;

  for (const doc of realDocs) {
    const inlineText = extractTextFromInlineDataUrl(doc.fileUrl || doc.previewUrl);
    const analysisAny = doc.analysis as any;
    const scanAny = doc.scanResult as any;
    const kwMatch = matchRequirementKeywords({
      expectedRequirement: requirement,
      fileName: doc.name,
      extractedText: [inlineText, scanAny?.extractedText || '', analysisAny?.extractedText || '', doc.docCategory || '']
        .filter(Boolean)
        .join(' '),
      detectedDocType: scanAny?.detectedDocType || analysisAny?.detectedDocType || doc.type,
      matchedKeywordsFromAi: Array.isArray(scanAny?.matchedKeywords) ? scanAny.matchedKeywords : undefined,
      sourceLabel: doc.sourceLabel,
    });
    if (kwMatch.isMatch) {
      return doc;
    }
  }

  return undefined;
}

/**
 * Matches a program's required requirements against data and documents
 * already submitted by the resident on their account or prior uploaded documents.
 */
export function matchProgramRequirementsWithAccount(
  program?: Partial<AssistanceProgram> | null,
  resident?: Partial<ResidentUser> | null,
  existingDocs?: UploadedDocument[]
): MatchedRequirementItem[] {
  const requirements = getEffectiveProgramRequirements(program);
  const today = new Date().toISOString().split('T')[0];

  if (!resident) {
    return requirements.map(req => {
      const opt = isOptionalRequirementText(req.toLowerCase());
      return {
        requirement: req,
        status: 'upload-needed',
        isOptional: opt,
        requirementKind: opt ? 'optional' : 'upload-required',
        shortStatus: opt ? 'Optional' : 'Upload'
      };
    });
  }

  const idTypeLower = (resident.idType || '').toLowerCase();
  const hasPhotoIds = Boolean(isRealDocumentUrl(resident.frontIdUrl) && isRealDocumentUrl(resident.backIdUrl));
  const hasFrontPhotoId = Boolean(isRealDocumentUrl(resident.frontIdUrl));
  const hasAnyIdRecord = Boolean(
    hasFrontPhotoId || (resident.isVerified && (resident.idNumber || resident.idType || resident.residentIdNumber))
  );
  const hasResidencyRecord = Boolean(
    resident.purok &&
      resident.address &&
      (resident.purok.toLowerCase().includes('zone') || resident.address.trim().length >= 5)
  );
  const incomeVal = parseMonthlyIncome(resident.householdIncome || '');
  const residentHeader = [
    `Resident Name: ${resident.name || 'Registered Resident'}`,
    `Resident ID: ${resident.residentIdNumber || resident.id || 'N/A'}`,
    `Purok / Zone: ${resident.purok || 'Barangay Bugo'}`,
    `Address: ${resident.address || 'Barangay Bugo, Cagayan de Oro City'}`,
    `Generated Date: ${today}`,
    `Program: ${program?.title || 'Barangay Assistance'}`
  ];

  return requirements.map((req, idx) => {
    const r = req.toLowerCase();
    const isOptional = isOptionalRequirementText(r);

    // 0. Accomplished / Online Application Form (generated as real PDF)
    if (r.includes('application form')) {
      const pdf = createRealPdfDataUrl('Online Application Form Summary', [
        ...residentHeader,
        `Requirement: ${req}`,
        `Contact: ${resident.contactNumber || 'On file'}`,
        `Email: ${resident.email || 'On file'}`,
        `Occupation: ${resident.occupation || 'Resident'}`,
        `Status: Auto-generated verified portal application record`
      ]);
      return {
        requirement: req,
        status: 'auto-attached',
        requirementKind: 'auto-form',
        shortStatus: 'Auto-filled',
        isOptional,
        matchKey: 'application-form',
        sourceLabel: 'Generated real PDF from this form',
        docPayload: {
          id: `doc-auto-form-${idx}-${Date.now()}`,
          name: `Portal_Application_Form_${idx + 1}.pdf`,
          type: 'PDF',
          size: pdf.sizeLabel,
          uploadDate: today,
          fileUrl: pdf.dataUrl,
          previewUrl: pdf.dataUrl,
          docCategory: 'General Requirement',
          verified: true,
          autoAttached: true,
          sourceLabel: 'Auto-filled online application PDF'
        }
      };
    }

    // 0b. Household Information (captured on Create Account -> real PDF)
    if (r.includes('household information') || r.includes('household info')) {
      const hasHousehold = Boolean(resident.purok && (resident.familyMembersCount || 0) >= 1);
      if (hasHousehold) {
        const hhLabel = `${resident.familyMembersCount || 1} members · ${(resident.purok || '').split(' - ')[0]}`;
        const pdf = createRealPdfDataUrl('Verified Household Profile Record', [
          ...residentHeader,
          `Family Members: ${resident.familyMembersCount || 1}`,
          `Declared Monthly Income: ${resident.householdIncome || 'Declared'}`,
          `Civil Status: ${resident.civilStatus || 'On file'}`,
          `Status: Verified Account Household Record`
        ]);
        return {
          requirement: req,
          status: 'auto-attached',
          requirementKind: 'account-ready',
          shortStatus: 'From Account',
          isOptional,
          matchKey: 'household-info',
          sourceLabel: hhLabel,
          docPayload: {
            id: `doc-auto-hh-${idx}-${Date.now()}`,
            name: `Household_Profile_${(resident.residentIdNumber || 'BUGO').replace(/\s+/g, '_')}.pdf`,
            type: 'PDF',
            size: pdf.sizeLabel,
            uploadDate: today,
            fileUrl: pdf.dataUrl,
            previewUrl: pdf.dataUrl,
            docCategory: 'General Requirement',
            verified: Boolean(resident.isVerified),
            autoAttached: true,
            sourceLabel: 'Auto-attached from Create Account'
          }
        };
      }
    }

    // 0c. Certificate of Indigency (auto-qualified when household income <= ₱10,000 -> real PDF)
    if (r.includes('certificate of indigency') || r.includes('indigency certification')) {
      if (resident.householdIncome && incomeVal <= 10000) {
        const pdf = createRealPdfDataUrl('Barangay Indigency Eligibility Record', [
          ...residentHeader,
          `Declared Monthly Income: PHP ${incomeVal.toLocaleString()}`,
          `Threshold: <= PHP 10,000.00 (Indigent Classification)`,
          `Family Members: ${resident.familyMembersCount || 1}`,
          `Verification: ${resident.isVerified ? 'Verified Resident Account' : 'Account Income Declared'}`
        ]);
        return {
          requirement: req,
          status: 'auto-attached',
          requirementKind: 'account-ready',
          shortStatus: 'Account Eligible',
          isOptional,
          matchKey: 'indigency',
          sourceLabel: `Qualified (Income ₱${incomeVal.toLocaleString()} ≤ ₱10,000)`,
          docPayload: {
            id: `doc-auto-ind-${idx}-${Date.now()}`,
            name: `Barangay_Indigency_Record_${(resident.residentIdNumber || 'BUGO').replace(/\s+/g, '_')}.pdf`,
            type: 'PDF',
            size: pdf.sizeLabel,
            uploadDate: today,
            fileUrl: pdf.dataUrl,
            previewUrl: pdf.dataUrl,
            docCategory: 'Indigency',
            verified: Boolean(resident.isVerified),
            autoAttached: true,
            sourceLabel: 'Auto-matched from Create Account income'
          }
        };
      }
    }

    // 1. Specific School / Student ID only
    const asksStudentIdOnly =
      (r.includes('school id') || r.includes('student id')) &&
      !r.includes('government id') &&
      !r.includes('resident id') &&
      !r.includes('cor') &&
      !r.includes('certificate of registration');

    if (asksStudentIdOnly) {
      const hasStudentId =
        hasFrontPhotoId &&
        (idTypeLower.includes('student') || idTypeLower.includes('school'));
      if (hasStudentId && resident.frontIdUrl) {
        return {
          requirement: req,
          status: 'auto-attached',
          requirementKind: 'account-ready',
          shortStatus: 'Ready',
          isOptional,
          matchKey: 'valid-id',
          sourceLabel: `${resident.idType}${resident.idNumber ? ` (${resident.idNumber})` : ''} from account`,
          docPayload: {
            id: `doc-auto-id-${idx}-${Date.now()}`,
            name: `${(resident.idType || 'Student_ID').replace(/\s+/g, '_')}.jpg`,
            type: 'Image',
            size: resolveDataUrlSizeLabel(resident.frontIdUrl, 85000),
            uploadDate: today,
            fileUrl: resident.frontIdUrl,
            previewUrl: resident.frontIdUrl,
            docCategory: 'Front ID',
            verified: Boolean(resident.isVerified),
            autoAttached: true,
            sourceLabel: 'Auto-attached from Create Account'
          }
        };
      }
    }

    // 2. General Valid ID / Government ID / Resident ID / Voter ID
    const isIdRequirement =
      (r.includes('valid id') ||
        r.includes('national id') ||
        r.includes('id of claimant') ||
        r.includes("claimant's valid id") ||
        r.includes("patient's valid id") ||
        r.includes('government id') ||
        r.includes('government-issued id') ||
        r.includes('resident id') ||
        r.includes('voter') ||
        r.includes('philsys') ||
        r.includes('front id') ||
        r.includes('back id') ||
        r.includes('identification card')) &&
      !r.includes('2x2') &&
      !r.includes('photo');

    if (isIdRequirement || (r.includes('valid') && r.includes('id') && !r.includes('2x2'))) {
      if (hasPhotoIds || (resident.isVerified && hasAnyIdRecord)) {
        const idDesc = `${resident.idType || 'Barangay Resident ID'}${resident.idNumber ? ` (${resident.idNumber})` : ''}`;
        if (hasFrontPhotoId && resident.frontIdUrl) {
          return {
            requirement: req,
            status: 'auto-attached',
            requirementKind: 'account-ready',
            shortStatus: 'Ready',
            isOptional,
            matchKey: 'valid-id',
            sourceLabel: hasPhotoIds ? `${idDesc} · Front & Back` : `${idDesc} (Verified)`,
            docPayload: {
              id: `doc-auto-id-${idx}-${Date.now()}`,
              name: `${(resident.idType || 'Valid_ID').replace(/\s+/g, '_')}.jpg`,
              type: 'Image',
              size: resolveDataUrlSizeLabel(resident.frontIdUrl, 96000),
              uploadDate: today,
              fileUrl: resident.frontIdUrl,
              previewUrl: resident.frontIdUrl,
              docCategory: 'Front ID',
              verified: Boolean(resident.isVerified),
              autoAttached: true,
              sourceLabel: 'Auto-attached from Create Account'
            }
          };
        }

        const pdf = createRealPdfDataUrl('Verified Resident Identification Record', [
          ...residentHeader,
          `ID Reference: ${idDesc}`,
          `Registration Status: ${resident.registrationStatus || 'Verified'}`,
          `Voter Status: ${resident.voterStatus || 'Registered'}`
        ]);
        return {
          requirement: req,
          status: 'auto-attached',
          requirementKind: 'account-ready',
          shortStatus: 'Ready',
          isOptional,
          matchKey: 'valid-id',
          sourceLabel: `${idDesc} (Verified)`,
          docPayload: {
            id: `doc-auto-id-${idx}-${Date.now()}`,
            name: `Verified_ID_Record_${(resident.residentIdNumber || 'BUGO').replace(/\s+/g, '_')}.pdf`,
            type: 'PDF',
            size: pdf.sizeLabel,
            uploadDate: today,
            fileUrl: pdf.dataUrl,
            previewUrl: pdf.dataUrl,
            docCategory: 'Front ID',
            verified: Boolean(resident.isVerified),
            autoAttached: true,
            sourceLabel: 'Auto-attached from Verified Account'
          }
        };
      }
    }

    // 3. PWD ID Card / Status
    const isPwdIdReq =
      (r.includes('pwd id') || r.includes('disability id') || r.includes('pwd card')) &&
      !r.includes('medical certificate') &&
      !r.includes('physician');

    if (isPwdIdReq && resident.isPwd && (resident.pwdIdNumber || idTypeLower.includes('pwd') || resident.pwdDisabilityType)) {
      const pwdLabel = `PWD ID${resident.pwdIdNumber ? ` #${resident.pwdIdNumber}` : ''}${resident.pwdDisabilityType ? ` (${resident.pwdDisabilityType})` : ''}`;
      if (hasFrontPhotoId && idTypeLower.includes('pwd') && resident.frontIdUrl) {
        return {
          requirement: req,
          status: 'auto-attached',
          requirementKind: 'account-ready',
          shortStatus: 'Ready',
          isOptional,
          matchKey: 'pwd',
          sourceLabel: `${pwdLabel} from account`,
          docPayload: {
            id: `doc-auto-pwd-${idx}-${Date.now()}`,
            name: `PWD_ID_${resident.pwdIdNumber || 'Card'}.jpg`,
            type: 'Image',
            size: resolveDataUrlSizeLabel(resident.frontIdUrl, 85000),
            uploadDate: today,
            fileUrl: resident.frontIdUrl,
            previewUrl: resident.frontIdUrl,
            docCategory: 'General Requirement',
            verified: Boolean(resident.isVerified),
            autoAttached: true,
            sourceLabel: 'Auto-attached from Create Account'
          }
        };
      }
      const pdf = createRealPdfDataUrl('Verified PWD Registry Certification', [
        ...residentHeader,
        `PWD Reference: ${pwdLabel}`,
        `Disability Classification: ${resident.pwdDisabilityType || 'Registered PWD'}`
      ]);
      return {
        requirement: req,
        status: 'auto-attached',
        requirementKind: 'account-ready',
        shortStatus: 'Ready',
        isOptional,
        matchKey: 'pwd',
        sourceLabel: `${pwdLabel} from account`,
        docPayload: {
          id: `doc-auto-pwd-${idx}-${Date.now()}`,
          name: `PWD_Registry_Record_${resident.pwdIdNumber || 'BUGO'}.pdf`,
          type: 'PDF',
          size: pdf.sizeLabel,
          uploadDate: today,
          fileUrl: pdf.dataUrl,
          previewUrl: pdf.dataUrl,
          docCategory: 'General Requirement',
          verified: Boolean(resident.isVerified),
          autoAttached: true,
          sourceLabel: 'Auto-attached from Create Account'
        }
      };
    }

    // 4. Solo Parent ID Card
    const isSoloParentIdReq =
      (r.includes('solo parent id') || r.includes('solo parent card')) &&
      !r.includes('birth certificate');

    if (isSoloParentIdReq && resident.isSoloParent && (resident.soloParentIdNumber || idTypeLower.includes('solo parent'))) {
      const spLabel = `Solo Parent ID${resident.soloParentIdNumber ? ` #${resident.soloParentIdNumber}` : ''}`;
      if (hasFrontPhotoId && idTypeLower.includes('solo parent') && resident.frontIdUrl) {
        return {
          requirement: req,
          status: 'auto-attached',
          requirementKind: 'account-ready',
          shortStatus: 'Ready',
          isOptional,
          matchKey: 'solo-parent',
          sourceLabel: `${spLabel} from account`,
          docPayload: {
            id: `doc-auto-sp-${idx}-${Date.now()}`,
            name: `Solo_Parent_ID_${resident.soloParentIdNumber || 'Card'}.jpg`,
            type: 'Image',
            size: resolveDataUrlSizeLabel(resident.frontIdUrl, 85000),
            uploadDate: today,
            fileUrl: resident.frontIdUrl,
            previewUrl: resident.frontIdUrl,
            docCategory: 'General Requirement',
            verified: Boolean(resident.isVerified),
            autoAttached: true,
            sourceLabel: 'Auto-attached from Create Account'
          }
        };
      }
      const pdf = createRealPdfDataUrl('Verified Solo Parent Registry Record', [
        ...residentHeader,
        `Solo Parent Reference: ${spLabel}`,
        `Civil Status: ${resident.civilStatus || 'Solo Parent'}`
      ]);
      return {
        requirement: req,
        status: 'auto-attached',
        requirementKind: 'account-ready',
        shortStatus: 'Ready',
        isOptional,
        matchKey: 'solo-parent',
        sourceLabel: `${spLabel} from account`,
        docPayload: {
          id: `doc-auto-sp-${idx}-${Date.now()}`,
          name: `Solo_Parent_Record_${resident.soloParentIdNumber || 'BUGO'}.pdf`,
          type: 'PDF',
          size: pdf.sizeLabel,
          uploadDate: today,
          fileUrl: pdf.dataUrl,
          previewUrl: pdf.dataUrl,
          docCategory: 'General Requirement',
          verified: Boolean(resident.isVerified),
          autoAttached: true,
          sourceLabel: 'Auto-attached from Create Account'
        }
      };
    }

    // 5. Senior Citizen OSCA ID / Proof of Age 60+
    const isSeniorReq =
      r.includes('osca id') ||
      r.includes('senior citizen id') ||
      r.includes('senior id') ||
      r.includes('proof of age');

    if (isSeniorReq) {
      const isSenior = Boolean(resident.isSenior) || (resident.age || 0) >= 60;
      if (isSenior && (resident.seniorIdNumber || idTypeLower.includes('senior') || (resident.age || 0) >= 60)) {
        const srLabel = resident.seniorIdNumber
          ? `Senior OSCA ID #${resident.seniorIdNumber}`
          : `Verified Age ${resident.age} (Senior Citizen)`;
        if (hasFrontPhotoId && idTypeLower.includes('senior') && resident.frontIdUrl) {
          return {
            requirement: req,
            status: 'auto-attached',
            requirementKind: 'account-ready',
            shortStatus: 'Ready',
            isOptional,
            matchKey: 'senior',
            sourceLabel: `${srLabel} from account`,
            docPayload: {
              id: `doc-auto-sr-${idx}-${Date.now()}`,
              name: `OSCA_Senior_ID_${resident.seniorIdNumber || 'Card'}.jpg`,
              type: 'Image',
              size: resolveDataUrlSizeLabel(resident.frontIdUrl, 85000),
              uploadDate: today,
              fileUrl: resident.frontIdUrl,
              previewUrl: resident.frontIdUrl,
              docCategory: 'General Requirement',
              verified: Boolean(resident.isVerified),
              autoAttached: true,
              sourceLabel: 'Auto-attached from Create Account'
            }
          };
        }
        const pdf = createRealPdfDataUrl('Verified Senior Citizen Record', [
          ...residentHeader,
          `Senior Reference: ${srLabel}`,
          `Declared Age: ${resident.age || '60+'}`
        ]);
        return {
          requirement: req,
          status: 'auto-attached',
          requirementKind: 'account-ready',
          shortStatus: 'Ready',
          isOptional,
          matchKey: 'senior',
          sourceLabel: `${srLabel} from account`,
          docPayload: {
            id: `doc-auto-sr-${idx}-${Date.now()}`,
            name: `Senior_Citizen_Record_${resident.seniorIdNumber || 'BUGO'}.pdf`,
            type: 'PDF',
            size: pdf.sizeLabel,
            uploadDate: today,
            fileUrl: pdf.dataUrl,
            previewUrl: pdf.dataUrl,
            docCategory: 'General Requirement',
            verified: Boolean(resident.isVerified),
            autoAttached: true,
            sourceLabel: 'Auto-attached from Create Account'
          }
        };
      }
    }

    // 6. Proof of Residency / Certificate of Residency / Bugo Address
    const isExternalPropertyDoc =
      r.includes('billing') ||
      r.includes('utility') ||
      r.includes('rental') ||
      r.includes('lease') ||
      r.includes('ownership') ||
      r.includes('sketch') ||
      r.includes('tillage');

    const isResidencyReq =
      !isExternalPropertyDoc &&
      (r.includes('proof of residency') ||
        r.includes('certificate of residency') ||
        r.includes('proof of address') ||
        r.includes('bugo address') ||
        r.includes('zone endorsement') ||
        r.includes('purok') ||
        r.includes('residency in bugo'));

    if (isResidencyReq && hasResidencyRecord) {
      const resLabel = `${resident.purok} · ${resident.address}`;
      const pdf = createRealPdfDataUrl('Barangay Bugo Residency Verification Record', [
        ...residentHeader,
        `Residency Verification: ${resLabel}`,
        `Registered Date: ${resident.registeredDate || 'On file'}`,
        `Verification Status: ${resident.registrationStatus || 'Verified'}`
      ]);
      return {
        requirement: req,
        status: 'auto-attached',
        requirementKind: 'account-ready',
        shortStatus: 'Ready',
        isOptional,
        matchKey: 'residency',
        sourceLabel: `${resident.purok} (${resident.residentIdNumber || 'Registered'})`,
        docPayload: {
          id: `doc-auto-res-${idx}-${Date.now()}`,
          name: `Barangay_Residency_Record_${(resident.residentIdNumber || 'BUGO').replace(/\s+/g, '_')}.pdf`,
          type: 'PDF',
          size: pdf.sizeLabel,
          uploadDate: today,
          fileUrl: pdf.dataUrl,
          previewUrl: pdf.dataUrl,
          docCategory: 'Proof of Residency',
          verified: Boolean(resident.isVerified),
          autoAttached: true,
          sourceLabel: 'Auto-attached from Create Account'
        }
      };
    }

    // 7. Household Income / Family Composition record
    const isIncomeProfileReq =
      (r.includes('family composition') ||
        r.includes('household income') ||
        r.includes('proof of income') ||
        r.includes('low income')) &&
      !r.includes('itr') &&
      !r.includes('non-filing') &&
      !r.includes('affidavit') &&
      !r.includes('certificate of indigency');

    if (isIncomeProfileReq && resident.householdIncome && incomeVal >= 0) {
      const incLabel = `Income: ${resident.householdIncome} · ${resident.familyMembersCount || 1} family members`;
      const pdf = createRealPdfDataUrl('Household Income & Family Composition Record', [
        ...residentHeader,
        `Monthly Household Income: ${resident.householdIncome}`,
        `Household Size: ${resident.familyMembersCount || 1} members`,
        `Occupation: ${resident.occupation || 'Resident'}`
      ]);
      return {
        requirement: req,
        status: 'auto-attached',
        requirementKind: 'account-ready',
        shortStatus: 'Ready',
        isOptional,
        matchKey: 'income',
        sourceLabel: incLabel,
        docPayload: {
          id: `doc-auto-inc-${idx}-${Date.now()}`,
          name: `Income_Composition_Record_${(resident.residentIdNumber || 'BUGO').replace(/\s+/g, '_')}.pdf`,
          type: 'PDF',
          size: pdf.sizeLabel,
          uploadDate: today,
          fileUrl: pdf.dataUrl,
          previewUrl: pdf.dataUrl,
          docCategory: 'Income Certificate',
          verified: Boolean(resident.isVerified),
          autoAttached: true,
          sourceLabel: 'Auto-attached from Create Account'
        }
      };
    }

    // 8. Enrolled Student / School Profile
    const isStudentProfileReq =
      (r.includes('student status') || r.includes('school enrollment')) &&
      !r.includes('cor') &&
      !r.includes('certificate of registration') &&
      !r.includes('report card') &&
      !r.includes('transcript') &&
      !r.includes('tor') &&
      !r.includes('grade') &&
      !r.includes('diploma');

    if (isStudentProfileReq && resident.isStudent && resident.schoolName) {
      const pdf = createRealPdfDataUrl('Verified Student Enrollment Profile', [
        ...residentHeader,
        `School / University: ${resident.schoolName}`,
        `Academic Level: ${resident.studentLevel || 'Student'}`
      ]);
      return {
        requirement: req,
        status: 'auto-attached',
        requirementKind: 'account-ready',
        shortStatus: 'Ready',
        isOptional,
        matchKey: 'student',
        sourceLabel: `${resident.schoolName} (${resident.studentLevel || 'Student'})`,
        docPayload: {
          id: `doc-auto-stu-${idx}-${Date.now()}`,
          name: `Student_Profile_${(resident.residentIdNumber || 'BUGO').replace(/\s+/g, '_')}.pdf`,
          type: 'PDF',
          size: pdf.sizeLabel,
          uploadDate: today,
          fileUrl: pdf.dataUrl,
          previewUrl: pdf.dataUrl,
          docCategory: 'General Requirement',
          verified: Boolean(resident.isVerified),
          autoAttached: true,
          sourceLabel: 'Auto-attached from Create Account'
        }
      };
    }

    // 9. Match against Resident's previously uploaded real documents on file
    const matchedDoc = findMatchingStoredDoc(req, existingDocs);
    if (matchedDoc) {
      const resolvedUrl = matchedDoc.fileUrl || matchedDoc.previewUrl || '';
      return {
        requirement: req,
        status: 'auto-attached',
        requirementKind: 'account-ready',
        shortStatus: 'On File',
        isOptional,
        matchKey: 'uploaded-file',
        sourceLabel: `Auto-attached from your files (${matchedDoc.name})`,
        docPayload: {
          id: `doc-auto-file-${idx}-${Date.now()}`,
          name: matchedDoc.name,
          type: matchedDoc.type || (resolvedUrl.includes('application/pdf') || matchedDoc.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Image'),
          size: matchedDoc.size && !['auto-filled', 'from account', 'verified profile'].includes(matchedDoc.size.toLowerCase())
            ? matchedDoc.size
            : resolveDataUrlSizeLabel(resolvedUrl, 64000),
          uploadDate: matchedDoc.uploadDate || today,
          fileUrl: resolvedUrl,
          previewUrl: matchedDoc.previewUrl || resolvedUrl,
          docCategory: matchedDoc.docCategory || 'General Requirement',
          verified: Boolean(matchedDoc.verified),
          autoAttached: true,
          sourceLabel: 'Auto-attached from previously uploaded document'
        }
      };
    }

    return {
      requirement: req,
      status: 'upload-needed',
      isOptional,
      requirementKind: isOptional ? 'optional' : 'upload-required',
      shortStatus: isOptional ? 'Optional' : 'Upload'
    };
  });
}

/**
 * Builds UploadedDocument entries for all matched Create Account & existing file requirements
 * (excluding Front/Back ID if caller already attaches the full ID cards).
 */
export function getAutoAttachedAccountDocuments(
  program?: Partial<AssistanceProgram> | null,
  resident?: Partial<ResidentUser> | null,
  options?: { includeIdDoc?: boolean; existingDocs?: UploadedDocument[] }
): UploadedDocument[] {
  const matches = matchProgramRequirementsWithAccount(program, resident, options?.existingDocs);
  const seenKeys = new Set<string>();
  const docs: UploadedDocument[] = [];

  for (const item of matches) {
    if (item.status !== 'auto-attached' || !item.docPayload) continue;
    if (!options?.includeIdDoc && item.matchKey === 'valid-id') continue;
    if (!isRealDocumentUrl(item.docPayload.fileUrl || item.docPayload.previewUrl)) continue;
    const dedupeKey = item.matchKey === 'uploaded-file'
      ? `file-${item.docPayload.name}`
      : (item.matchKey || item.requirement);
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);
    docs.push(item.docPayload);
  }

  return docs;
}
