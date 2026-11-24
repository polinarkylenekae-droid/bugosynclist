export function formatDocumentByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '1.0 KB';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function isRealDocumentUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === '#' || trimmed === 'about:blank') return false;
  return (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('blob:')
  );
}

export function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  if (!dataUrl.startsWith('data:')) return null;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return null;
  const header = dataUrl.slice(0, commaIdx);
  const body = dataUrl.slice(commaIdx + 1);
  if (header.includes(';base64')) {
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(body, 'base64'));
    }
    const bin = atob(body);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  }
  const decoded = decodeURIComponent(body);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i) & 0xff;
  }
  return bytes;
}

export function downloadDocumentFile(url: string, filename: string): void {
  if (!isRealDocumentUrl(url) || typeof document === 'undefined') return;
  let objectUrl: string | null = null;
  let href = url;

  if (url.startsWith('data:')) {
    const bytes = dataUrlToUint8Array(url);
    if (bytes) {
      const mimeMatch = url.match(/^data:([^;,]+)/i);
      const mimeType = mimeMatch?.[1] || (filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const blob = new Blob([copy], { type: mimeType });
      objectUrl = URL.createObjectURL(blob);
      href = objectUrl;
    }
  }

  const link = document.createElement('a');
  link.href = href;
  link.download = filename || 'Barangay_Bugo_Document.pdf';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (objectUrl) {
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl!);
    }, 5000);
  }
}

function sanitizePdfText(text: string): string {
  return String(text || '')
    .replace(/₱/g, 'PHP ')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/[•·]/g, '-')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\s+/g, ' ')
    .trim();
}

function encodeBase64(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'latin1').toString('base64');
  }
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function wrapLine(text: string, maxChars = 72): string[] {
  const clean = sanitizePdfText(text);
  if (!clean) return [];
  const words = clean.split(' ');
  const out: string[] = [];
  let current = '';
  for (const w of words) {
    if (!current) {
      current = w;
    } else if (current.length + 1 + w.length <= maxChars) {
      current += ' ' + w;
    } else {
      out.push(current);
      current = w;
    }
  }
  if (current) out.push(current);
  return out;
}

/**
 * Generates a real, non-empty, formatted %PDF-1.4 document encoded as a base64 data URL.
 */
export function createRealPdfDataUrl(
  title: string,
  lines: string[]
): { dataUrl: string; byteLength: number; sizeLabel: string } {
  const cleanTitle = sanitizePdfText(title || 'Barangay Bugo Official Record').slice(0, 62);
  const ops: string[] = [
    // Outer white background + green header banner
    '1 1 1 rg',
    '0 0 612 792 re f',
    '0.047 0.325 0.169 rg',
    '40 682 532 74 re f',

    // Header text (white)
    'BT',
    '1 1 1 rg',
    '/F2 9 Tf',
    '56 738 Td',
    `(REPUBLIC OF THE PHILIPPINES  -  CITY OF CAGAYAN DE ORO) Tj`,
    'ET',
    'BT',
    '1 1 1 rg',
    '/F2 14 Tf',
    '56 718 Td',
    `(BARANGAY BUGO RESIDENT PORTAL) Tj`,
    'ET',
    'BT',
    '0.85 0.95 0.89 rg',
    '/F2 10.5 Tf',
    '56 697 Td',
    `(${cleanTitle}) Tj`,
    'ET',

    // Document outer frame & sub-header strip
    '0.84 0.87 0.85 RG',
    '1 w',
    '40 116 532 560 re S',
    '0.95 0.97 0.96 rg',
    '41 642 530 33 re f',
    '0.84 0.87 0.85 RG',
    '0.7 w',
    '40 642 m 572 642 l S',

    'BT',
    '0.047 0.325 0.169 rg',
    '/F2 9.5 Tf',
    '56 655 Td',
    '(OFFICIAL SYSTEM-GENERATED VERIFICATION RECORD) Tj',
    'ET'
  ];

  let y = 616;
  const minY = 186;

  for (const rawLine of lines) {
    if (y < minY) break;
    const colonIdx = rawLine.indexOf(':');
    if (colonIdx > 0 && colonIdx < 32) {
      const label = sanitizePdfText(rawLine.slice(0, colonIdx + 1));
      const valRaw = rawLine.slice(colonIdx + 1).trim();
      const wrappedVal = wrapLine(valRaw || 'On file', 54);

      if (y < minY) break;
      ops.push(
        'BT',
        '0.22 0.25 0.28 rg',
        '/F2 10 Tf',
        `56 ${y} Td`,
        `(${label}) Tj`,
        'ET'
      );

      for (let i = 0; i < wrappedVal.length; i++) {
        if (y < minY) break;
        const valX = i === 0 ? 220 : 220;
        ops.push(
          'BT',
          '0.08 0.10 0.12 rg',
          '/F1 10 Tf',
          `${valX} ${y} Td`,
          `(${wrappedVal[i]}) Tj`,
          'ET'
        );
        if (i < wrappedVal.length - 1) {
          y -= 15;
        }
      }

      y -= 9;
      if (y >= minY) {
        ops.push(
          '0.92 0.94 0.93 RG',
          '0.5 w',
          `56 ${y} m 556 ${y} l S`
        );
      }
      y -= 15;
    } else {
      const wrapped = wrapLine(rawLine, 74);
      for (const part of wrapped) {
        if (y < minY) break;
        ops.push(
          'BT',
          '0.10 0.12 0.14 rg',
          '/F1 10 Tf',
          `56 ${y} Td`,
          `(${part}) Tj`,
          'ET'
        );
        y -= 16;
      }
      y -= 4;
    }
  }

  // Official Footer Certification Box
  ops.push(
    '0.95 0.98 0.96 rg',
    '41 117 530 56 re f',
    '0.047 0.325 0.169 RG',
    '0.8 w',
    '41 173 m 571 173 l S',
    'BT',
    '0.047 0.325 0.169 rg',
    '/F2 9 Tf',
    '56 153 Td',
    '(CERTIFIED PORTAL DOCUMENT  -  BARANGAY BUGO ELECTRONIC REGISTRY) Tj',
    'ET',
    'BT',
    '0.28 0.32 0.35 rg',
    '/F1 8.5 Tf',
    '56 136 Td',
    '(Auto-attached from verified resident registry records. Valid for official barangay assistance evaluation.) Tj',
    'ET'
  );

  const contentStream = ops.join('\n');
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
    `6 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const byteLength = pdf.length;
  const dataUrl = `data:application/pdf;base64,${encodeBase64(pdf)}`;
  return {
    dataUrl,
    byteLength,
    sizeLabel: formatDocumentByteSize(byteLength)
  };
}
