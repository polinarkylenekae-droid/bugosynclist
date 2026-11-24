export interface PrintableReportColumn {
  label: string;
  align?: 'left' | 'right';
}

export interface PrintableReportOptions {
  title: string;
  subtitle?: string;
  generatedLabel?: string;
  columns: PrintableReportColumn[];
  rows: string[][];
}

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildPrintableReportHtml(options: PrintableReportOptions): string {
  const {
    title,
    subtitle = 'Republic of the Philippines • Barangay Bugo, Cagayan de Oro City',
    generatedLabel = `Generated on ${new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })} • ${options.rows.length} ${options.rows.length === 1 ? 'record' : 'records'}`,
    columns,
    rows
  } = options;

  const headCells = columns
    .map(
      col =>
        `<th style="text-align:${col.align === 'right' ? 'right' : 'left'}">${escapeHtml(col.label)}</th>`
    )
    .join('');

  const bodyRows =
    rows.length === 0
      ? `<tr><td colspan="${columns.length}" style="text-align:center;color:#6b7280;padding:24px;">No records available for this report.</td></tr>`
      : rows
          .map(
            row =>
              `<tr>${columns
                .map(
                  (col, idx) =>
                    `<td style="text-align:${col.align === 'right' ? 'right' : 'left'}">${escapeHtml(row[idx] ?? '—')}</td>`
                )
                .join('')}</tr>`
          )
          .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: auto; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #111827;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.45;
    }
    .report-header {
      text-align: center;
      border-bottom: 2px solid #111827;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .report-subtitle {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #4b5563;
      margin: 0;
    }
    .report-title {
      font-size: 17px;
      font-weight: 800;
      color: #111827;
      margin: 4px 0 2px;
    }
    .report-meta {
      font-size: 10px;
      color: #6b7280;
      margin: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #374151;
      border-bottom: 1.5px solid #9ca3af;
      padding: 6px 8px;
      background: #f9fafb;
    }
    td {
      border-bottom: 1px solid #e5e7eb;
      padding: 6px 8px;
      vertical-align: top;
      color: #111827;
      word-break: break-word;
    }
    .report-footer {
      margin-top: 18px;
      padding-top: 8px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="report-header">
    <p class="report-subtitle">${escapeHtml(subtitle)}</p>
    <h1 class="report-title">${escapeHtml(title)}</h1>
    <p class="report-meta">${escapeHtml(generatedLabel)}</p>
  </div>
  <table>
    <thead>
      <tr>${headCells}</tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>
  <div class="report-footer">
    <span>Barangay Bugo Resident &amp; Disaster Records System</span>
    <span>Printed ${escapeHtml(new Date().toLocaleString('en-US'))}</span>
  </div>
</body>
</html>`;
}

function printHtmlViaIframe(html: string): boolean {
  try {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';

    let hasTriggeredPrint = false;
    const cleanup = () => {
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 1500);
    };

    const triggerPrint = () => {
      if (hasTriggeredPrint) return;
      hasTriggeredPrint = true;
      try {
        const win = iframe.contentWindow;
        if (!win) {
          cleanup();
          window.print();
          return;
        }
        win.onafterprint = cleanup;
        win.focus();
        win.print();
        setTimeout(cleanup, 60000);
      } catch {
        cleanup();
        window.print();
      }
    };

    iframe.onload = triggerPrint;
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      // Fallback in case browser does not fire onload after synchronous document.write/close
      setTimeout(triggerPrint, 180);
    } else {
      iframe.srcdoc = html;
    }
    return true;
  } catch {
    window.print();
    return false;
  }
}

export function printReportDocument(options: PrintableReportOptions): boolean {
  const html = buildPrintableReportHtml(options);
  return printHtmlViaIframe(html);
}

export interface PrintableResidentReceiptDocument {
  name: string;
  docCategory?: string;
  verified?: boolean;
}

export interface PrintableResidentReceiptRule {
  ruleName: string;
  passed: boolean;
  explanation?: string;
}

export interface PrintableResidentReceipt {
  referenceCode: string;
  programTitle: string;
  programCategory?: string;
  processingTime?: string;
  approvedAmount?: string;
  applicantName: string;
  contactNumber?: string;
  email?: string;
  purok?: string;
  address?: string;
  purpose?: string;
  status: string;
  submissionDate?: string;
  queueNumber?: number;
  summaryNote?: string;
  documents?: PrintableResidentReceiptDocument[];
  rules?: PrintableResidentReceiptRule[];
}

export function buildResidentReceiptHtml(receipt: PrintableResidentReceipt): string {
  const statusLower = (receipt.status || '').toLowerCase();
  const isPositive =
    statusLower === 'valid' ||
    statusLower === 'approved' ||
    statusLower === 'ready for release' ||
    statusLower === 'disbursed';
  const isWarning = statusLower.includes('review') || statusLower.includes('needs') || statusLower.includes('re-submitted');
  const statusBg = isPositive ? '#dcfce7' : isWarning ? '#fef3c7' : '#fee2e2';
  const statusColor = isPositive ? '#0c532b' : isWarning ? '#92400e' : '#991b1b';
  const statusBorder = isPositive ? '#86efac' : isWarning ? '#fcd34d' : '#fca5a5';

  const submittedLabel =
    receipt.submissionDate ||
    new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });

  const docsHtml =
    Array.isArray(receipt.documents) && receipt.documents.length > 0
      ? `<div class="section">
          <div class="section-title">Attached &amp; Verified Documents (${receipt.documents.length})</div>
          <ul class="doc-list">
            ${receipt.documents
              .map(
                (doc) =>
                  `<li><span>${escapeHtml(doc.name)}</span><span class="doc-tag">${escapeHtml(
                    doc.docCategory || (doc.verified === false ? 'Attached' : 'Verified')
                  )}</span></li>`
              )
              .join('')}
          </ul>
        </div>`
      : '';

  const rulesHtml =
    Array.isArray(receipt.rules) && receipt.rules.length > 0
      ? `<div class="section">
          <div class="section-title">System Qualification Check</div>
          <ul class="doc-list">
            ${receipt.rules
              .map(
                (r) =>
                  `<li><span>${escapeHtml(r.ruleName)}${r.explanation ? ` — <small>${escapeHtml(r.explanation)}</small>` : ''}</span><span class="doc-tag" style="color:${
                    r.passed ? '#0c532b' : '#991b1b'
                  };font-weight:700;">${r.passed ? 'Passed' : 'Failed'}</span></li>`
              )
              .join('')}
          </ul>
        </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Official Receipt - ${escapeHtml(receipt.referenceCode)}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #111827;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.5;
    }
    .receipt-shell {
      max-width: 680px;
      margin: 0 auto;
      border: 2px solid #0c532b;
      border-radius: 14px;
      padding: 24px 28px;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    .republic {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #4b5563;
      margin: 0;
    }
    .barangay {
      font-size: 16px;
      font-weight: 800;
      color: #0c532b;
      margin: 2px 0;
    }
    .doc-title {
      font-size: 13px;
      font-weight: 700;
      color: #111827;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin: 6px 0 0;
    }
    .ref-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      background: #f9fafb;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 16px;
    }
    .ref-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6b7280;
      display: block;
    }
    .ref-code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 18px;
      font-weight: 800;
      color: #111827;
      letter-spacing: 0.04em;
    }
    .status-pill {
      display: inline-block;
      padding: 5px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      background: ${statusBg};
      color: ${statusColor};
      border: 1px solid ${statusBorder};
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 18px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 14px;
    }
    .field-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #6b7280;
      display: block;
    }
    .field-value {
      font-size: 12px;
      font-weight: 600;
      color: #111827;
      word-break: break-word;
    }
    .section {
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 14px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #374151;
      margin-bottom: 6px;
    }
    .purpose-text {
      margin: 0;
      color: #1f2937;
      font-size: 12px;
    }
    .doc-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .doc-list li {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 4px 0;
      border-bottom: 1px dashed #e5e7eb;
      font-size: 11px;
    }
    .doc-list li:last-child {
      border-bottom: none;
    }
    .doc-tag {
      color: #4b5563;
      white-space: nowrap;
      font-size: 10px;
    }
    .note-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #0c532b;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 14px;
    }
    .footer {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 10px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="receipt-shell">
    <div class="header">
      <p class="republic">Republic of the Philippines • City of Cagayan de Oro</p>
      <p class="barangay">Barangay Bugo Resident Assistance &amp; Certification Portal</p>
      <p class="doc-title">Official Application Receipt</p>
    </div>

    <div class="ref-banner">
      <div>
        <span class="ref-label">Reference Code${receipt.queueNumber ? ` • Queue #${receipt.queueNumber}` : ''}</span>
        <span class="ref-code">${escapeHtml(receipt.referenceCode)}</span>
      </div>
      <span class="status-pill">${escapeHtml(receipt.status)}</span>
    </div>

    <div class="grid">
      <div>
        <span class="field-label">Requested Program / Service</span>
        <span class="field-value">${escapeHtml(receipt.programTitle)}</span>
      </div>
      <div>
        <span class="field-label">Category</span>
        <span class="field-value">${escapeHtml(receipt.programCategory || 'Barangay Service')}</span>
      </div>
      <div>
        <span class="field-label">Applicant Name</span>
        <span class="field-value">${escapeHtml(receipt.applicantName)}</span>
      </div>
      <div>
        <span class="field-label">Contact Number</span>
        <span class="field-value">${escapeHtml(receipt.contactNumber || 'On file')}</span>
      </div>
      <div>
        <span class="field-label">Purok / Zone</span>
        <span class="field-value">${escapeHtml(receipt.purok || 'Barangay Bugo')}</span>
      </div>
      <div>
        <span class="field-label">Submission Date</span>
        <span class="field-value">${escapeHtml(submittedLabel)}</span>
      </div>
      ${
        receipt.address
          ? `<div style="grid-column:1 / -1;">
              <span class="field-label">Address</span>
              <span class="field-value">${escapeHtml(receipt.address)}</span>
            </div>`
          : ''
      }
      ${
        receipt.processingTime
          ? `<div>
              <span class="field-label">Processing Time</span>
              <span class="field-value">${escapeHtml(receipt.processingTime)}</span>
            </div>`
          : ''
      }
      ${
        receipt.approvedAmount
          ? `<div>
              <span class="field-label">Benefit / Endorsement</span>
              <span class="field-value">${escapeHtml(receipt.approvedAmount)}</span>
            </div>`
          : ''
      }
    </div>

    ${
      receipt.purpose
        ? `<div class="section">
            <div class="section-title">Statement of Purpose</div>
            <p class="purpose-text">${escapeHtml(receipt.purpose)}</p>
          </div>`
        : ''
    }

    ${docsHtml}
    ${rulesHtml}

    ${
      receipt.summaryNote
        ? `<div class="note-box">${escapeHtml(receipt.summaryNote)}</div>`
        : ''
    }

    <div class="footer">
      <span>Present this reference code at Barangay Hall when claiming or verifying.</span>
      <span>Printed ${escapeHtml(new Date().toLocaleString('en-US'))}</span>
    </div>
  </div>
</body>
</html>`;
}

export function printResidentReceipt(receipt: PrintableResidentReceipt): boolean {
  const html = buildResidentReceiptHtml(receipt);
  return printHtmlViaIframe(html);
}
