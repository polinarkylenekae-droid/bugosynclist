/**
 * Shared sorting helpers for Barangay Bugo Portal
 * - Alphabetical ordering (A-Z) for Programs & Certificates
 * - First-Come, First-Served (FCFS) ordering for Applications (earliest at top, latest at bottom)
 */

export function sortProgramsAlphabetically<T extends readonly any[]>(items: T): T {
  return [...items].sort((a, b) =>
    String((a as any)?.title || '')
      .trim()
      .localeCompare(String((b as any)?.title || '').trim(), undefined, {
        sensitivity: 'base',
        numeric: true,
      })
  ) as unknown as T;
}

const DISASTER_CATEGORY_SET = new Set([
  'flood',
  'fire',
  'landslide',
  'earthquake',
  'typhoon / storm',
  'other',
]);

function getProgramListingTier(prog: any): number {
  const idLower = String(prog?.id || '').toLowerCase();
  const titleLower = String(prog?.title || '').toLowerCase();
  const catLower = String(prog?.category || '').trim().toLowerCase();
  const isApply =
    prog?.applicationMode === 'apply' ||
    prog?.badgeText === 'Apply Program' ||
    idLower.startsWith('prog-apply-');
  if (isApply) return 0; // Application-needed programs first

  const isDisaster =
    prog?.programType === 'disaster' ||
    prog?.badgeText === 'Disaster Program' ||
    idLower === 'prog-disaster-relief' ||
    titleLower === 'disaster relief assistance' ||
    (prog?.programType !== 'regular' &&
      prog?.programType !== 'service' &&
      (prog?.autoEnrollVictims === true ||
        DISASTER_CATEGORY_SET.has(catLower) ||
        idLower === 'prog-emergency-disaster-prep' ||
        idLower === 'prog-emergency-evacuation' ||
        titleLower.includes('calamity') ||
        titleLower.includes('evacuation')));
  if (isDisaster) return 1; // Disaster programs before Create-Account automatic programs

  const isService =
    prog?.programType === 'service' ||
    prog?.badgeText === 'Barangay Service' ||
    catLower === 'clearance & certification' ||
    catLower === 'barangay administrative services' ||
    catLower === 'civil registration services' ||
    idLower.startsWith('prog-cert-') ||
    idLower.startsWith('prog-admin-') ||
    idLower.startsWith('prog-civil-') ||
    idLower === 'prog-barangay-clearance' ||
    idLower === 'prog-live-business-processing';
  if (isService) return 3; // Certifications & Barangay Services

  return 2; // Existing Automatic / Create-Account qualification programs listed below
}

export function sortProgramsApplyFirst<T extends readonly any[]>(items: T): T {
  return [...items].sort((a, b) => {
    const tierDiff = getProgramListingTier(a) - getProgramListingTier(b);
    if (tierDiff !== 0) return tierDiff;
    return String((a as any)?.title || '')
      .trim()
      .localeCompare(String((b as any)?.title || '').trim(), undefined, {
        sensitivity: 'base',
        numeric: true,
      });
  }) as unknown as T;
}

export function getApplicationQueueTimestamp(app: {
  submittedAt?: string | null;
  createdAt?: string | null;
  submissionDate?: string | null;
  id?: string | null;
}): number {
  if (app?.submittedAt) {
    const parsed = Date.parse(app.submittedAt);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (app?.createdAt) {
    const parsed = Date.parse(app.createdAt);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (app?.id) {
    const match = String(app.id).match(/(\d{12,15})/);
    if (match) {
      const epochMs = Number(match[1]);
      if (Number.isFinite(epochMs) && epochMs > 0) return epochMs;
    }
  }
  if (app?.submissionDate) {
    const parsed = Date.parse(app.submissionDate);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

export function sortApplicationsFCFS<T extends readonly any[]>(applications: T): T {
  return [...applications].sort((a, b) => {
    const timeA = getApplicationQueueTimestamp(a as any);
    const timeB = getApplicationQueueTimestamp(b as any);
    if (timeA !== timeB) {
      return timeA - timeB; // Earliest (first-come) at index 0 (top), latest at bottom
    }
    const idCmp = String((a as any)?.id || '').localeCompare(String((b as any)?.id || ''));
    if (idCmp !== 0) return idCmp;
    return String((a as any)?.referenceCode || '').localeCompare(String((b as any)?.referenceCode || ''));
  }) as unknown as T;
}

export function formatShortQueueDateTime(app: {
  submittedAt?: string | null;
  submissionDate?: string | null;
}): string {
  if (app?.submittedAt) {
    const d = new Date(app.submittedAt);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  }
  return app?.submissionDate || '—';
}
