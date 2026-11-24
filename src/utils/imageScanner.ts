import { IdPhotoAnalysis } from '../types';
import { isNonIdDocumentFilename } from './idNameMatcher';
import { loadPdfJs } from './pdfLoader';
import { dataUrlToUint8Array } from './realDocumentPdf';
import {
  extractTextFromInlineDataUrl,
  getRequirementHintLabel,
  matchRequirementKeywords,
} from './requirementKeywordMatcher';

export interface ClientClarityResult {
  isClear: boolean;
  isBlurry: boolean;
  isTooDark: boolean;
  isLowResolution: boolean;
  sharpnessScore: number;
  avgBrightness: number;
  warning: string | null;
}

export interface DocumentPhotoScanResult {
  isValid: boolean;
  isClear: boolean;
  detectedDocType: string;
  warning: string | null;
  advice: string;
  score: number;
  matchedKeywords?: string[];
  expectedKeywords?: string[];
  extractedText?: string;
}

function isGenericScannerFilename(name?: string): boolean {
  const lower = String(name || '').trim().toLowerCase();
  if (!lower) return true;
  return (
    lower === 'front-id.jpg' ||
    lower === 'back-id.jpg' ||
    lower === 'front.jpg' ||
    lower === 'back.jpg' ||
    lower.startsWith('scanned-front-id-') ||
    lower.startsWith('scanned-back-id-')
  );
}

export async function compressImageDataUrlForScan(
  dataUrl: string,
  maxDim = 1400,
  quality = 0.86
): Promise<string> {
  if (
    typeof document === 'undefined' ||
    typeof Image === 'undefined' ||
    !dataUrl ||
    !dataUrl.startsWith('data:image/') ||
    dataUrl.startsWith('data:image/svg+xml')
  ) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => resolve(dataUrl);
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) {
          resolve(dataUrl);
          return;
        }
        const needsResize = w > maxDim || h > maxDim;
        const needsSizeShrink = dataUrl.length > 350_000;
        if (!needsResize && !needsSizeShrink) {
          resolve(dataUrl);
          return;
        }
        const scale = needsResize ? Math.min(maxDim / w, maxDim / h) : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed && compressed.length < dataUrl.length ? compressed : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.src = dataUrl;
  });
}

export async function computeImageVisualSignature(dataUrl: string): Promise<number[] | null> {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const size = 16;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const lum: number[] = [];
        for (let i = 0; i < data.length; i += 4) {
          lum.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        }
        resolve(lum);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export async function checkDuplicateIdImageAttachment(params: {
  candidateDataUrl: string;
  candidateFileName?: string;
  candidateFileSize?: number;
  otherDataUrl?: string;
  otherFileName?: string;
  otherFileSize?: number;
  otherSideLabel: 'Front of ID' | 'Back of ID';
}): Promise<{ isDuplicate: boolean; reason?: string }> {
  const candUrl = String(params.candidateDataUrl || '');
  const otherUrl = String(params.otherDataUrl || '');
  if (!candUrl || !otherUrl) {
    return { isDuplicate: false };
  }

  if (candUrl.length > 100 && candUrl === otherUrl) {
    return {
      isDuplicate: true,
      reason: `Same image as ${params.otherSideLabel}${params.otherFileName ? ` ("${params.otherFileName}")` : ''}. Front and Back of ID cannot use the same file or photo.`,
    };
  }

  const candName = String(params.candidateFileName || '').trim().toLowerCase();
  const otherName = String(params.otherFileName || '').trim().toLowerCase();
  if (
    candName &&
    otherName &&
    !isGenericScannerFilename(candName) &&
    !isGenericScannerFilename(otherName) &&
    candName === otherName &&
    (!params.candidateFileSize || !params.otherFileSize || params.candidateFileSize === params.otherFileSize)
  ) {
    return {
      isDuplicate: true,
      reason: `Same file "${params.candidateFileName}" is already attached in ${params.otherSideLabel}. Front and Back of ID must be two different files.`,
    };
  }

  const [sigA, sigB] = await Promise.all([
    computeImageVisualSignature(candUrl),
    computeImageVisualSignature(otherUrl),
  ]);
  if (sigA && sigB && sigA.length === sigB.length && sigA.length > 0) {
    let absDiffSum = 0;
    let sumA = 0;
    let sumB = 0;
    for (let i = 0; i < sigA.length; i += 1) {
      absDiffSum += Math.abs(sigA[i] - sigB[i]);
      sumA += sigA[i];
      sumB += sigB[i];
    }
    const mad = absDiffSum / sigA.length;
    const meanA = sumA / sigA.length;
    const meanB = sumB / sigB.length;
    let num = 0;
    let denA = 0;
    let denB = 0;
    for (let i = 0; i < sigA.length; i += 1) {
      const da = sigA[i] - meanA;
      const db = sigB[i] - meanB;
      num += da * db;
      denA += da * da;
      denB += db * db;
    }
    const denom = Math.sqrt(denA * denB);
    const corr = denom > 1e-6 ? num / denom : (mad < 1 ? 1 : 0);

    if (mad < 5.5 && corr > 0.98) {
      return {
        isDuplicate: true,
        reason: `This photo looks identical to the image already attached in ${params.otherSideLabel}. Please attach a different photo for the other side of your ID.`,
      };
    }
  }

  return { isDuplicate: false };
}

export async function analyzeImageClarity(dataUrl: string): Promise<ClientClarityResult> {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    return {
      isClear: true,
      isBlurry: false,
      isTooDark: false,
      isLowResolution: false,
      sharpnessScore: 85,
      avgBrightness: 140,
      warning: null,
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        if (w < 120 || h < 90) {
          resolve({
            isClear: false,
            isBlurry: true,
            isTooDark: false,
            isLowResolution: true,
            sharpnessScore: 20,
            avgBrightness: 120,
            warning: `Image resolution (${w}x${h}) is too low or unclear. Please upload a sharper photo and try again.`,
          });
          return;
        }

        const targetW = Math.min(240, w);
        const targetH = Math.max(1, Math.round((h / w) * targetW));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            isClear: true,
            isBlurry: false,
            isTooDark: false,
            isLowResolution: false,
            sharpnessScore: 85,
            avgBrightness: 130,
            warning: null,
          });
          return;
        }

        ctx.drawImage(img, 0, 0, targetW, targetH);
        const { data } = ctx.getImageData(0, 0, targetW, targetH);

        const lum = new Float32Array(targetW * targetH);
        let sumLum = 0;
        for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
          const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          lum[p] = y;
          sumLum += y;
        }
        const avgBrightness = sumLum / Math.max(1, lum.length);

        // Compute discrete Laplacian variance across interior pixels
        let lapSum = 0;
        let lapSqSum = 0;
        let count = 0;
        for (let y = 1; y < targetH - 1; y += 1) {
          for (let x = 1; x < targetW - 1; x += 1) {
            const idx = y * targetW + x;
            const lap =
              -4 * lum[idx] +
              lum[idx - 1] +
              lum[idx + 1] +
              lum[idx - targetW] +
              lum[idx + targetW];
            lapSum += lap;
            lapSqSum += lap * lap;
            count += 1;
          }
        }

        const meanLap = count > 0 ? lapSum / count : 0;
        const variance = count > 0 ? Math.max(0, lapSqSum / count - meanLap * meanLap) : 0;
        const sharpnessScore = Math.min(100, Math.round(Math.sqrt(variance) * 3.2));

        const isTooDark = avgBrightness < 26 || avgBrightness > 249;
        const isBlurry = variance < 16;

        if (isTooDark) {
          resolve({
            isClear: false,
            isBlurry: false,
            isTooDark: true,
            isLowResolution: false,
            sharpnessScore,
            avgBrightness: Math.round(avgBrightness),
            warning:
              avgBrightness < 26
                ? 'Photo is too dark to read. Retake in bright natural light and try again.'
                : 'Photo is washed out or has heavy flash glare. Retake without flash and try again.',
          });
          return;
        }

        if (isBlurry) {
          resolve({
            isClear: false,
            isBlurry: true,
            isTooDark: false,
            isLowResolution: false,
            sharpnessScore,
            avgBrightness: Math.round(avgBrightness),
            warning: 'Photo appears blurred or out of focus. Hold your camera steady on a flat surface and try again.',
          });
          return;
        }

        resolve({
          isClear: true,
          isBlurry: false,
          isTooDark: false,
          isLowResolution: false,
          sharpnessScore: Math.max(60, sharpnessScore),
          avgBrightness: Math.round(avgBrightness),
          warning: null,
        });
      } catch {
        resolve({
          isClear: true,
          isBlurry: false,
          isTooDark: false,
          isLowResolution: false,
          sharpnessScore: 85,
          avgBrightness: 130,
          warning: null,
        });
      }
    };
    img.onerror = () => {
      resolve({
        isClear: false,
        isBlurry: true,
        isTooDark: false,
        isLowResolution: true,
        sharpnessScore: 0,
        avgBrightness: 0,
        warning: 'Could not read this image file. Please upload a valid JPG or PNG photo.',
      });
    };
    img.src = dataUrl;
  });
}

export async function scanIdPhotoWithClarityAndType(params: {
  file?: File;
  base64Data?: string;
  dataUrl?: string;
  fileName?: string;
  mimeType?: string;
  side: 'front' | 'back';
  expectedIdType?: string;
  expectedName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  expectedBirthdate?: string;
  expectedAge?: number;
  expectedIdNumber?: string;
  expectedGender?: 'Male' | 'Female' | '';
  expectedCivilStatus?: string;
  localHeuristic?: IdPhotoAnalysis;
}): Promise<IdPhotoAnalysis> {
  const imageData = params.base64Data || params.dataUrl || '';
  const resolvedName = params.file?.name || params.fileName || `${params.side}_id.jpg`;
  const resolvedMime = params.file?.type || params.mimeType || 'image/jpeg';
  const fallbackHeuristic: IdPhotoAnalysis = params.localHeuristic || {
    isId: true,
    isClear: true,
    detectedDocType: params.expectedIdType || 'Government ID',
    warning: null,
    score: 85
  };

  const clarity = await analyzeImageClarity(imageData);

  if (!clarity.isClear) {
    return {
      ...fallbackHeuristic,
      isId: true,
      isClear: false,
      isBlurry: clarity.isBlurry,
      expectedIdType: params.expectedIdType,
      expectedName: params.expectedName,
      warning: clarity.warning || 'Photo is blurred or unclear. Please try again.',
      advice: 'Place your ID flat under bright light with no flash glare and try again.',
      score: Math.min(40, clarity.sharpnessScore || 30),
    };
  }

  const preparedImageData = await compressImageDataUrlForScan(imageData);
  const preparedMime = preparedImageData.startsWith('data:image/jpeg')
    ? 'image/jpeg'
    : resolvedMime;

  let serverMessage = '';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) {
      const jitter = Math.floor(Math.random() * 500);
      await new Promise((r) => setTimeout(r, 2500 + jitter));
    }
    try {
      const fetchSignal =
        typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
          ? AbortSignal.timeout(70000)
          : undefined;
      const res = await fetch('/api/ai/validate-id-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(fetchSignal ? { signal: fetchSignal } : {}),
        body: JSON.stringify({
          imageBase64: preparedImageData,
          mimeType: preparedMime,
          fileName: resolvedName,
          side: params.side,
          expectedIdType: params.expectedIdType,
          expectedName: params.expectedName,
          firstName: params.firstName,
          middleName: params.middleName,
          lastName: params.lastName,
          suffix: params.suffix,
          expectedBirthdate: params.expectedBirthdate,
          expectedAge: params.expectedAge,
          expectedIdNumber: params.expectedIdNumber,
          expectedGender: params.expectedGender,
          expectedCivilStatus: params.expectedCivilStatus,
        }),
      });
      const resData = await res.json().catch(() => ({}));
      if (res.ok && resData?.success && resData.analysis) {
        return resData.analysis as IdPhotoAnalysis;
      }
      if (resData?.message) {
        serverMessage = String(resData.message);
      }
      const isTransient503 =
        res.status === 503 ||
        (resData?.aiUnavailable === true &&
          (Number(resData?.upstreamStatus) === 503 || Number(resData?.upstreamStatus) === 429));
      if (attempt === 0 && isTransient503) {
        continue;
      }
      break;
    } catch (err: any) {
      const isAbortOrNetwork =
        err?.name === 'TimeoutError' ||
        err?.name === 'AbortError' ||
        err instanceof TypeError;
      serverMessage = isAbortOrNetwork
        ? 'ID verification request timed out. Please try again in a few seconds.'
        : 'Unable to reach ID verification service. Please check your connection and try again.';
      if (attempt === 0 && isAbortOrNetwork) {
        continue;
      }
      break;
    }
  }

  if (isNonIdDocumentFilename(resolvedName)) {
    return {
      isId: false,
      isClear: true,
      isBlurry: false,
      detectedDocType: 'Not an ID',
      expectedIdType: params.expectedIdType,
      matchesExpectedType: false,
      expectedName: params.expectedName,
      matchesExpectedName: false,
      aiVisionUsed: false,
      warning: `Not a valid ${params.side} ID. File "${resolvedName}" does not match ${params.expectedIdType || 'selected ID'}.`,
      advice: `Upload a clear photo of your ${params.expectedIdType || 'selected Government ID'}.`,
      score: 20,
    };
  }

  return {
    isId: true,
    isClear: true,
    isBlurry: false,
    detectedDocType: 'Verification Service Busy',
    expectedIdType: params.expectedIdType,
    matchesExpectedType: false,
    expectedName: params.expectedName,
    matchesExpectedName: false,
    matchesExpectedBirthdate: false,
    matchesExpectedIdNumber: false,
    matchesExpectedGender: false,
    matchesExpectedCivilStatus: false,
    aiVisionUsed: false,
    warning: serverMessage || `Could not verify ${params.side} ID right now due to high service demand. Please tap Rescan in a few seconds.`,
    advice: `Tap Rescan to verify your ${params.expectedIdType || 'Resident ID'} once the service is ready.`,
    score: 0,
  };
}

async function extractTextFromPdfDataUrl(dataUrl: string): Promise<string> {
  try {
    const bytes = dataUrlToUint8Array(dataUrl);
    if (!bytes || bytes.byteLength === 0) return '';
    const pdfjsLib = await loadPdfJs();
    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    const pdfDoc = await loadingTask.promise;
    const maxPages = Math.min(pdfDoc.numPages || 1, 5);
    const chunks: string[] = [];
    for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageStr = (textContent.items || [])
        .map((item: any) => (typeof item?.str === 'string' ? item.str : ''))
        .filter(Boolean)
        .join(' ');
      if (pageStr) chunks.push(pageStr);
    }
    return chunks.join(' ').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

export async function scanQualificationDocumentPhoto(params: {
  file: File;
  base64Data: string;
  expectedRequirementLabel?: string;
  additionalRequirements?: string[];
}): Promise<DocumentPhotoScanResult> {
  const expectedLabel = (params.expectedRequirementLabel || '').trim();
  const isPdf = params.file.name.toLowerCase().endsWith('.pdf') || params.file.type === 'application/pdf';
  const inlineText = extractTextFromInlineDataUrl(params.base64Data);

  if (isPdf) {
    const pdfExtractedText = await extractTextFromPdfDataUrl(params.base64Data);
    const combinedText = [pdfExtractedText, inlineText].filter(Boolean).join(' ').trim();

    // If PDF has little/no selectable text (scanned image PDF), run server AI Vision inspection
    // so an unrelated scanned PDF renamed to match the requirement (e.g. "TOR.pdf") is caught.
    if (combinedText.length < 20 && params.base64Data.length <= 6_500_000) {
      try {
        const pdfSignal =
          typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
            ? AbortSignal.timeout(70000)
            : undefined;
        const res = await fetch('/api/ai/validate-document-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          ...(pdfSignal ? { signal: pdfSignal } : {}),
          body: JSON.stringify({
            imageBase64: params.base64Data,
            mimeType: 'application/pdf',
            fileName: params.file.name,
            expectedDocument: expectedLabel,
            additionalRequirements: params.additionalRequirements || [],
            extractedText: combinedText,
          }),
        });
        const resData = await res.json();
        if (resData?.success && resData.analysis) {
          return resData.analysis as DocumentPhotoScanResult;
        }
      } catch {
        // Fallback to local keyword verification below
      }
    }

    const kwCheck = matchRequirementKeywords({
      expectedRequirement: expectedLabel,
      additionalRequirements: params.additionalRequirements,
      fileName: params.file.name,
      extractedText: combinedText,
    });

    const expectedHint = expectedLabel ? getRequirementHintLabel(expectedLabel) : 'required document';
    if (!kwCheck.isMatch) {
      return {
        isValid: false,
        isClear: true,
        detectedDocType: 'Unrelated / Keyword Mismatch PDF',
        warning:
          kwCheck.reason ||
          `Invalid PDF: "${params.file.name}" does not match "${expectedLabel || 'required document'}" (must be ${expectedHint}).`,
        advice: `Attach a PDF clearly showing ${expectedHint}.`,
        score: 15,
        matchedKeywords: [],
        expectedKeywords: kwCheck.expectedKeywords,
        extractedText: combinedText.slice(0, 400),
      };
    }

    return {
      isValid: true,
      isClear: true,
      detectedDocType: kwCheck.matchedRequirement || expectedLabel || 'PDF Document',
      warning: null,
      advice:
        kwCheck.matchedKeywords.length > 0
          ? `PDF verified — detected keyword(s): ${kwCheck.matchedKeywords.slice(0, 4).join(', ')}.`
          : 'PDF document attached and ready for review.',
      score: 94,
      matchedKeywords: kwCheck.matchedKeywords,
      expectedKeywords: kwCheck.expectedKeywords,
      extractedText: combinedText.slice(0, 400),
    };
  }

  const clarity = await analyzeImageClarity(params.base64Data);
  if (!clarity.isClear) {
    return {
      isValid: false,
      isClear: false,
      detectedDocType: 'Blurred / Unclear Image',
      warning: clarity.warning || 'Photo is blurred or unclear. Please try again.',
      advice: 'Retake a clear, flat photo of the full document and try again.',
      score: Math.min(38, clarity.sharpnessScore || 30),
    };
  }

  const preparedDocImage = await compressImageDataUrlForScan(params.base64Data);
  const preparedDocMime = preparedDocImage.startsWith('data:image/jpeg')
    ? 'image/jpeg'
    : (params.file.type || 'image/jpeg');

  try {
    const docSignal =
      typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(70000)
        : undefined;
    const res = await fetch('/api/ai/validate-document-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(docSignal ? { signal: docSignal } : {}),
      body: JSON.stringify({
        imageBase64: preparedDocImage,
        mimeType: preparedDocMime,
        fileName: params.file.name,
        expectedDocument: expectedLabel,
        additionalRequirements: params.additionalRequirements || [],
        extractedText: inlineText,
      }),
    });
    const resData = await res.json();
    if (resData?.success && resData.analysis) {
      return resData.analysis as DocumentPhotoScanResult;
    }
  } catch {
    // Local keyword verification fallback below
  }

  const fallbackKw = matchRequirementKeywords({
    expectedRequirement: expectedLabel,
    additionalRequirements: params.additionalRequirements,
    fileName: params.file.name,
    extractedText: inlineText,
  });

  if (!fallbackKw.isMatch) {
    const expectedHint = expectedLabel ? getRequirementHintLabel(expectedLabel) : 'required document';
    return {
      isValid: false,
      isClear: true,
      detectedDocType: 'Unrelated / Keyword Mismatch File',
      warning:
        fallbackKw.reason ||
        `Invalid document: "${params.file.name}" does not match "${expectedLabel || 'required document'}" (must be ${expectedHint}).`,
      advice: `Upload a clear file showing ${expectedHint}.`,
      score: 20,
      matchedKeywords: [],
      expectedKeywords: fallbackKw.expectedKeywords,
      extractedText: inlineText.slice(0, 400),
    };
  }

  return {
    isValid: true,
    isClear: true,
    detectedDocType: fallbackKw.matchedRequirement || expectedLabel || 'Supporting Qualification Document',
    warning: null,
    advice:
      fallbackKw.matchedKeywords.length > 0
        ? `Verified keyword(s): ${fallbackKw.matchedKeywords.slice(0, 4).join(', ')}.`
        : 'Document photo looks clear and readable.',
    score: clarity.sharpnessScore || 90,
    matchedKeywords: fallbackKw.matchedKeywords,
    expectedKeywords: fallbackKw.expectedKeywords,
  };
}
