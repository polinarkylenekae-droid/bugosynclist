import { AnnouncementItem, AssistanceProgram, NotificationItem } from '../types';
import { isDisasterProgram } from './eligibilityEngine';

const normalizeText = (value?: string | null): string =>
  String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function stripAnnouncementNotificationPrefix(title?: string | null): string {
  return String(title || '')
    .replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\s]+/gu, '')
    .replace(/^(release schedule|announcement|new service open|advisory|bulletin)\s*:\s*/i, '')
    .trim();
}

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'all',
  'are',
  'you',
  'your',
  'barangay',
  'bugo',
  'assistance',
  'program',
  'programs',
  'service',
  'services',
  'certification',
  'certificate',
  'announcement',
  'release',
  'schedule',
  'notice',
  'advisory',
  'official',
  'resident',
  'residents',
  'qualified',
  'beneficiaries',
  'please',
  'bring',
  'valid',
  'hall',
  'tba',
]);

interface ProgramAliasRule {
  programId: string;
  phrases: string[];
  boost?: number;
}

const PROGRAM_ALIAS_RULES: ProgramAliasRule[] = [
  { programId: 'prog-barangay-clearance', phrases: ['barangay clearance', 'clearance issuance', 'brgy clearance'], boost: 75 },
  { programId: 'prog-admin-residency', phrases: ['certificate of residency', 'residency certificate', 'proof of residency'], boost: 75 },
  { programId: 'prog-admin-indigency', phrases: ['certificate of indigency', 'indigency certificate', 'indigent cert'], boost: 75 },
  { programId: 'prog-admin-good-moral', phrases: ['good moral', 'certificate of good moral'], boost: 75 },
  { programId: 'prog-admin-first-job', phrases: ['first time job', 'first job seeker', 'job seeker', 'ra 11261'], boost: 80 },
  { programId: 'prog-live-business-processing', phrases: ['business permit processing'], boost: 85 },
  { programId: 'prog-admin-business-permit', phrases: ['business permit', 'business clearance'], boost: 75 },
  { programId: 'prog-cert-solo-parent', phrases: ['solo parent', 'ra 11861'], boost: 75 },
  { programId: 'prog-cert-senior-citizen', phrases: ['senior citizen', 'osca', 'elderly', 'senior pension'], boost: 75 },
  { programId: 'prog-cert-pwd', phrases: ['pwd', 'person with disability', 'persons with disabilities', 'ra 10754'], boost: 75 },
  { programId: 'prog-apply-dswd-educational', phrases: ['dswd educational', 'dswd education'], boost: 90 },
  { programId: 'prog-cert-student-grant', phrases: ['student grant', 'student barangay', 'fee waiver', 'scholarship', 'educational scholarship', 'student assistance'], boost: 70 },
  { programId: 'prog-civil-late-birth', phrases: ['late birth', 'birth registration'], boost: 75 },
  { programId: 'prog-civil-marriage', phrases: ['marriage registration', 'marriage certificate'], boost: 75 },
  { programId: 'prog-civil-death', phrases: ['death registration', 'death certificate'], boost: 75 },
  { programId: 'prog-apply-ovm-burial', phrases: ['vice mayor burial', 'ovm burial'], boost: 90 },
  { programId: 'prog-apply-dswd-burial', phrases: ['dswd burial', 'burial assistance', 'burial aid', 'funeral'], boost: 75 },
  { programId: 'prog-apply-dswd-transportation', phrases: ['dswd transportation', 'transportation assistance', 'fare assistance', 'balík probinsya', 'balik probinsya'], boost: 80 },
  { programId: 'prog-apply-ovm-medical-financial', phrases: ['vice mayor financial', 'ovm financial', 'vice mayor medical'], boost: 90 },
  { programId: 'prog-apply-hospital-bill', phrases: ['hospital bill', 'hospitalization', 'billing assistance'], boost: 80 },
  { programId: 'prog-apply-lab-procedures', phrases: ['laboratories', 'laboratory', 'lab procedure', 'diagnostic', 'x ray', 'ct scan', 'ultrasound'], boost: 80 },
  { programId: 'prog-apply-reseta-tambal', phrases: ['reseta', 'tambal', 'medicine assistance', 'prescription medicine'], boost: 80 },
  { programId: 'prog-apply-medical-implants', phrases: ['stainless', 'medical implant', 'implant'], boost: 80 },
  { programId: 'prog-medical-assistance', phrases: ['medical assistance', 'medical aid', 'medical checkup', 'health checkup'], boost: 65 },
  { programId: 'prog-livelihood-program', phrases: ['livelihood', 'skills training', 'starter kit', 'small business grant'], boost: 75 },
  { programId: 'prog-financial-assistance', phrases: ['financial assistance', 'cash aid', 'cash assistance', 'ayuda'], boost: 60 },
  { programId: 'prog-disaster-relief', phrases: ['disaster relief', 'calamity relief', 'relief goods', 'emergency relief'], boost: 65 },
];

export interface AnnouncementMatchInput {
  targetProgramId?: string;
  targetProgramTitle?: string;
  title?: string;
  subject?: string;
  category?: string;
  description?: string;
  message?: string;
}

export function resolveProgramFromAnnouncementText(
  input: AnnouncementMatchInput,
  programs: AssistanceProgram[] = []
): AssistanceProgram | null {
  if (!Array.isArray(programs) || programs.length === 0) return null;

  if (input.targetProgramId) {
    const byId = programs.find(p => p.id === input.targetProgramId);
    if (byId) return byId;
  }

  const orderedPrograms = [
    ...programs.filter(p => p.status !== 'Closed'),
    ...programs.filter(p => p.status === 'Closed'),
  ];

  const primaryText = normalizeText(
    [
      input.targetProgramTitle,
      input.subject,
      stripAnnouncementNotificationPrefix(input.title),
    ]
      .filter(Boolean)
      .join(' ')
  );
  const fullText = normalizeText(
    [
      input.targetProgramTitle,
      input.subject,
      stripAnnouncementNotificationPrefix(input.title),
      input.category,
      input.description,
      input.message,
    ]
      .filter(Boolean)
      .join(' ')
  );

  if (!fullText) return null;

  // 1. Exact title matches (disambiguated by category if duplicate titles exist, e.g., multiple "Disaster" programs)
  const exactMatches = orderedPrograms.filter(p => {
    const pTitleNorm = normalizeText(p.title);
    return pTitleNorm.length >= 4 && (
      pTitleNorm === normalizeText(input.targetProgramTitle) ||
      pTitleNorm === normalizeText(input.subject) ||
      pTitleNorm === normalizeText(stripAnnouncementNotificationPrefix(input.title))
    );
  });

  if (exactMatches.length === 1) {
    return exactMatches[0];
  }
  if (exactMatches.length > 1) {
    const withCatMatch = exactMatches.find(p => {
      const catNorm = normalizeText(p.category);
      return catNorm && fullText.includes(catNorm);
    });
    return withCatMatch || exactMatches[0];
  }

  // 2. Score all candidate programs by title containment, aliases, disaster category, and token overlap
  let bestProgram: AssistanceProgram | null = null;
  let bestScore = 0;

  const isDisasterContext = /\b(disaster|calamity|fire|flood|typhoon|storm|landslide|earthquake|evacuation|relief)\b/.test(fullText);

  for (const prog of orderedPrograms) {
    let score = 0;
    const titleNorm = normalizeText(prog.title);
    const catNorm = normalizeText(prog.category);

    if (titleNorm.length >= 5) {
      if (primaryText.includes(titleNorm)) {
        score += 120 + titleNorm.length;
      } else if (fullText.includes(titleNorm)) {
        score += 90 + titleNorm.length;
      }
    }

    // Alias rules
    for (const rule of PROGRAM_ALIAS_RULES) {
      if (rule.programId !== prog.id) continue;
      for (const phrase of rule.phrases) {
        const phraseNorm = normalizeText(phrase);
        if (!phraseNorm) continue;
        if (primaryText.includes(phraseNorm)) {
          score += (rule.boost || 70) + 25;
        } else if (fullText.includes(phraseNorm)) {
          score += rule.boost || 70;
        }
      }
    }

    // Specific disaster matching (Fire, Flood, Landslide, Typhoon, Earthquake, Disaster Relief)
    if (isDisasterProgram(prog)) {
      if (catNorm && fullText.includes(catNorm)) {
        score += primaryText.includes(catNorm) ? 95 : 70;
      }
      if (isDisasterContext) {
        score += titleNorm.includes('relief') ? 35 : 25;
      }
    }

    // Meaningful token overlap on primary text
    const titleTokens = titleNorm.split(' ').filter(t => t.length >= 3 && !STOP_WORDS.has(t));
    if (titleTokens.length > 0) {
      const matchedTokens = titleTokens.filter(tok => primaryText.includes(tok));
      if (matchedTokens.length === titleTokens.length) {
        score += 55 + matchedTokens.length * 10;
      } else if (matchedTokens.length > 0) {
        score += matchedTokens.length * 18;
      }
    }

    if (prog.status !== 'Closed' && score > 0) {
      score += 5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestProgram = prog;
    }
  }

  return bestScore >= 40 ? bestProgram : null;
}

export function resolveProgramFromAnnouncementNotification(
  notification: NotificationItem,
  programs: AssistanceProgram[] = [],
  announcements: AnnouncementItem[] = []
): AssistanceProgram | null {
  if (!notification || !Array.isArray(programs) || programs.length === 0) return null;

  // 1. Direct targetProgramId on notification
  if (notification.targetProgramId) {
    const direct = programs.find(p => p.id === notification.targetProgramId);
    if (direct) return direct;
  }

  // 2. Look up linked announcement record
  const cleanedNotifTitle = stripAnnouncementNotificationPrefix(notification.title);
  const notifSubject = notification.documentData?.subject;
  const ctrl = notification.documentData?.controlNumber || '';
  const ctrlSuffixMatch = ctrl.match(/ADV-\d+-([a-zA-Z0-9]+)$/);
  const ctrlSuffix = ctrlSuffixMatch ? ctrlSuffixMatch[1] : '';

  const linkedAnn = announcements.find(a => {
    if (notification.announcementId && a.id === notification.announcementId) return true;
    if (ctrlSuffix && a.id.endsWith(ctrlSuffix)) return true;
    const annTitleNorm = normalizeText(a.title);
    if (!annTitleNorm) return false;
    return (
      annTitleNorm === normalizeText(cleanedNotifTitle) ||
      annTitleNorm === normalizeText(notifSubject)
    );
  });

  if (linkedAnn?.targetProgramId) {
    const fromAnn = programs.find(p => p.id === linkedAnn.targetProgramId);
    if (fromAnn) return fromAnn;
  }

  // 3. Fuzzy / keyword resolution combining linked announcement & notification text
  return resolveProgramFromAnnouncementText(
    {
      targetProgramId: notification.targetProgramId || linkedAnn?.targetProgramId,
      targetProgramTitle: notification.targetProgramTitle || linkedAnn?.targetProgramTitle,
      title: linkedAnn?.title || cleanedNotifTitle,
      subject: notifSubject,
      category: linkedAnn?.category,
      description: linkedAnn?.description,
      message: notification.message,
    },
    programs
  );
}
