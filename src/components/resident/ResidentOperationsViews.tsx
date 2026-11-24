import React, { useMemo, useState } from 'react';
import { isAllowedAccountEmail, normalizeAccountEmail, ALLOWED_EMAIL_DOMAIN_MESSAGE } from '../../utils/emailValidation';
import { normalizePhMobileNumber } from '../../utils/phoneValidation';
import { 
  HeartHandshake, 
  FileText, 
  Clock, 
  Calendar, 
  MapPin, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Plus, 
  Upload, 
  Search, 
  Download, 
  CheckCircle, 
  Check,
  HelpCircle, 
  FileCheck2, 
  ShieldCheck, 
  Building, 
  GraduationCap, 
  Activity, 
  ChevronRight, 
  Printer, 
  X,
  Phone,
  DollarSign,
  Globe,
  Briefcase,
  Users,
  QrCode,
  Sparkles,
  ExternalLink,
  Smile,
  Shuffle,
  Paperclip,
  Trash2,
  Accessibility,
  CreditCard,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  RefreshCw,
  ZoomIn
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AssistanceProgram, AssistanceApplication, UploadedDocument, EditableResidentProfileFields } from '../../types';
import { BUGO_PUROKS, MONTHLY_INCOME_OPTIONS, NATIONALITY_OPTIONS, CARTOON_AVATAR_PRESETS, MALE_CARTOON_AVATARS, FEMALE_CARTOON_AVATARS, detectUserGender } from '../../data/mockData';
import { evaluateCertificateQualification, evaluateResidentForProgram, findExistingProgramApplication, getQualifiedProgramsForResident, canResidentViewAnnouncement, isApplyOnlyProgram, isBarangayServiceApplicationItem, isDisasterProgram } from '../../utils/eligibilityEngine';
import { sortProgramsAlphabetically, sortProgramsApplyFirst, sortApplicationsFCFS, formatShortQueueDateTime } from '../../utils/sortUtils';
import { getRankingTierMeta, sortRankingClassifications } from '../../utils/rankingClassification';
import { matchProgramRequirementsWithAccount } from '../../utils/requirementMatcher';
import { scanQualificationDocumentPhoto, DocumentPhotoScanResult } from '../../utils/imageScanner';
import { getRequirementHintLabel } from '../../utils/requirementKeywordMatcher';
import { formatDocumentByteSize, isRealDocumentUrl } from '../../utils/realDocumentPdf';
import { resolveServiceImageUrl } from '../../utils/serviceImageResolver';
import { DocumentPreviewModal } from '../DocumentPreviewModal';
import { ChangePasswordSection } from '../settings/ChangePasswordSection';
import { printResidentReceipt } from '../../utils/printReport';

// ----------------------------------------------------
// 1. ENHANCED RESIDENT DASHBOARD VIEW
// ----------------------------------------------------
export const ResidentDashboardView: React.FC<{
  onApplyProgram: (prog: AssistanceProgram) => void;
  onNavigateTab: (tab: 'dashboard' | 'services' | 'hazard-map' | 'announcements' | 'profile' | 'help' | 'settings') => void;
}> = ({ onApplyProgram, onNavigateTab }) => {
  const { 
    currentUser, 
    applications, 
    announcements, 
    programs,
    disasterVictims,
    rankingClassifications,
    resubmitApplicationRequirements,
    deleteApplication
  } = useApp();

  const autoQualified = sortProgramsAlphabetically(
    getQualifiedProgramsForResident(currentUser, programs, { disasterVictims })
  );
  const visibleAnnouncements = announcements.filter(ann =>
    canResidentViewAnnouncement(currentUser, ann, programs, { disasterVictims, applications })
  );

  const sortedRankings = useMemo(
    () => sortRankingClassifications(rankingClassifications),
    [rankingClassifications]
  );
  const myRankingIndex = useMemo(
    () => (currentUser ? sortedRankings.findIndex(rc => rc.residentId === currentUser.id) : -1),
    [sortedRankings, currentUser]
  );
  const myRankingEntry = myRankingIndex >= 0 ? sortedRankings[myRankingIndex] : null;

  const [resubmittingApp, setResubmittingApp] = useState<AssistanceApplication | null>(null);
  const [confirmDeleteApp, setConfirmDeleteApp] = useState<AssistanceApplication | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [resubmitDocLabel, setResubmitDocLabel] = useState('2026 Certificate of Matriculation');
  const [resubmitFile, setResubmitFile] = useState<{ name: string; url: string; size: string; type: string; scanResult?: DocumentPhotoScanResult } | null>(null);
  const [resubmitError, setResubmitError] = useState('');
  const [isScanningResubmit, setIsScanningResubmit] = useState(false);
  const [resubmitNote, setResubmitNote] = useState('');
  const [showAllQualified, setShowAllQualified] = useState(false);
  const [applyGroupFilter, setApplyGroupFilter] = useState<'all' | 'medical' | 'dswd' | 'vice-mayor' | 'disaster' | 'other'>('all');
  const [programSearch, setProgramSearch] = useState('');
  const [viewingQualifiedProgram, setViewingQualifiedProgram] = useState<AssistanceProgram | null>(null);
  const [previewDocModal, setPreviewDocModal] = useState<{ title: string; url: string } | null>(null);

  const orderedAllApps = sortApplicationsFCFS(applications || []);
  const queueIndexById = new Map(orderedAllApps.map((a, idx) => [a.id, idx + 1]));

  // Filter applications belonging to the current resident (First-Come, First-Served)
  const residentApps = orderedAllApps.filter(app => {
    if (!app) return false;
    if (!currentUser) return true;
    
    // Check ID match first if available
    if (app.applicantId && currentUser.id && app.applicantId === currentUser.id) {
      return true;
    }

    const currentUserName = (currentUser.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const applicantName = (app.applicantName || '').trim().toLowerCase().replace(/\s+/g, ' ');

    const nameMatches = Boolean(
      !app.applicantId &&
        applicantName &&
        currentUserName &&
        applicantName === currentUserName
    );

    const emailMatches = Boolean(
      currentUser.email &&
        app.email &&
        app.email.trim().toLowerCase() === currentUser.email.trim().toLowerCase()
    );

    return nameMatches || emailMatches;
  });

  const residentStoredDocs = useMemo<UploadedDocument[]>(() => {
    const docs: UploadedDocument[] = [];
    const seen = new Set<string>();
    for (const app of residentApps) {
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
  }, [residentApps]);

  const approvedApps = residentApps.filter(
    a => a && (a.status === 'Valid' || a.status === 'Approved' || a.status === 'Ready for Release' || a.status === 'Disbursed')
  );

  return (
    <div className="space-y-6">
      {/* 1. Citizen Identity & Welcome Hero Banner */}
      <div className="bg-gradient-to-br from-[#0c532b] via-[#0e5c31] to-[#07361c] rounded-2xl p-5 sm:p-6 text-white shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-emerald-100">
              <span className="inline-flex items-center gap-1 font-semibold text-white">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                <span>Verified Resident</span>
              </span>
              <span aria-hidden="true" className="text-white/40">·</span>
              <span className="font-mono tabular-nums">
                ID: {currentUser?.residentIdNumber || 'Pending ID'}
              </span>
              <span aria-hidden="true" className="text-white/40">·</span>
              <span>{currentUser?.purok || 'Barangay Bugo, CDO'}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Mabuhay, {currentUser?.name || 'Resident'}!
            </h1>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-emerald-100/90">
              <span>{currentUser?.civilStatus || 'Single'}</span>
              <span aria-hidden="true" className="text-white/40">·</span>
              <span>{currentUser?.occupation || 'Resident'}</span>
              {currentUser?.isPwd && (
                <>
                  <span aria-hidden="true" className="text-white/40">·</span>
                  <span>PWD ({currentUser.pwdDisabilityType || 'Registered'})</span>
                </>
              )}
              {currentUser?.isSoloParent && (
                <>
                  <span aria-hidden="true" className="text-white/40">·</span>
                  <span>Solo Parent</span>
                </>
              )}
              {currentUser?.isSenior && (
                <>
                  <span aria-hidden="true" className="text-white/40">·</span>
                  <span>Senior Citizen</span>
                </>
              )}
              {currentUser?.isStudent && (
                <>
                  <span aria-hidden="true" className="text-white/40">·</span>
                  <span>Student ({currentUser.studentLevel || 'Enrolled'})</span>
                </>
              )}
              {currentUser?.isTeenager && !currentUser?.isSenior && !currentUser?.isStudent && (
                <>
                  <span aria-hidden="true" className="text-white/40">·</span>
                  <span>Youth</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ranking Classification Notice (Only visible if resident is in Admin's Ranking list) */}
      {myRankingEntry && (() => {
        const tier = getRankingTierMeta(myRankingEntry.priority);
        return (
          <div className={`rounded-2xl p-4 sm:p-5 border flex items-center justify-between gap-4 ${tier.surfaceClass}`}>
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                <span className="font-semibold text-gray-900">Ranking Classification</span>
                <span aria-hidden="true">·</span>
                <span className={`font-semibold ${tier.accentTextClass}`}>{tier.impactLabel}</span>
              </div>
              <div className={`text-lg font-extrabold tracking-tight ${tier.accentTextClass}`}>
                {tier.title}
              </div>
              <p className="text-xs text-gray-700">{tier.description}</p>
            </div>
            <div className="text-right shrink-0 tabular-nums">
              <div className={`text-2xl font-extrabold leading-none ${tier.accentTextClass}`}>
                #{myRankingIndex + 1}
              </div>
              <div className="text-[11px] font-medium text-gray-500 mt-1">
                of {sortedRankings.length} ranked
              </div>
            </div>
          </div>
        );
      })()}

      {/* 2. Key Resident Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Submitted</span>
            <FileCheck2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-gray-900 tabular-nums">{residentApps.length}</span>
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('services')}
          className={`rounded-2xl p-4 sm:p-5 border flex flex-col justify-between transition cursor-pointer hover:border-[#0c532b] ${
            approvedApps.length > 0
              ? 'bg-emerald-50/70 border-emerald-200'
              : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${approvedApps.length > 0 ? 'text-[#0c532b]' : 'text-gray-500'}`}>
              Valid / Approved
            </span>
            <CheckCircle className={`w-4 h-4 ${approvedApps.length > 0 ? 'text-[#0c532b]' : 'text-gray-400'}`} />
          </div>
          <div className="mt-2">
            <span className={`text-2xl sm:text-3xl font-extrabold tabular-nums ${approvedApps.length > 0 ? 'text-emerald-900' : 'text-gray-900'}`}>
              {approvedApps.length}
            </span>
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('announcements')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 flex flex-col justify-between cursor-pointer hover:border-[#0c532b] transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Advisories</span>
            <Building className="w-4 h-4 text-[#0c532b]" />
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-gray-900 tabular-nums">{visibleAnnouncements.length}</span>
          </div>
        </div>
      </div>

      {/* 2.2. Applications & Certificate Requests (Directly Below Analytics) */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Applications &amp; Certificates</h2>
            <p className="text-xs text-gray-500 mt-0.5">Status of your submitted programs and certificates.</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('services')}
            className="text-xs font-semibold text-[#0c532b] hover:underline flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Browse Certification</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {residentApps.length === 0 ? (
          <p className="py-3 text-xs text-gray-500">
            You have no applications or certificate requests yet.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {residentApps.map((app, idx) => {
              const queueNo = queueIndexById.get(app.id) || idx + 1;
              const statusColor =
                app.status === 'Valid' || app.status === 'Approved' || app.status === 'Ready for Release'
                  ? 'text-emerald-700'
                  : app.status === 'Disbursed'
                  ? 'text-blue-700'
                  : app.status === 'Needs Additional Requirements'
                  ? 'text-amber-700'
                  : app.status === 'Re-submitted'
                  ? 'text-sky-700'
                  : app.status === 'Disqualified' || app.status === 'Rejected'
                  ? 'text-rose-700'
                  : 'text-gray-600';

              return (
                <div key={app.id} className="py-3 first:pt-1 last:pb-1 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{app.programTitle}</div>
                      <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-1.5 tabular-nums">
                        <span className="font-mono font-bold text-[#0c532b]">Queue #{queueNo}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-gray-700">{app.referenceCode}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatShortQueueDateTime(app)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-semibold whitespace-nowrap ${statusColor}`}>
                        {app.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const matchedProg = (programs || []).find(
                            p => p.id === app.programId || p.title === app.programTitle
                          );
                          printResidentReceipt({
                            referenceCode: app.referenceCode,
                            queueNumber: queueNo,
                            programTitle: app.programTitle,
                            programCategory: app.programCategory || matchedProg?.category,
                            processingTime: matchedProg?.processingTime,
                            approvedAmount: app.approvedAmount || matchedProg?.maxBenefitAmount,
                            applicantName: app.applicantName,
                            contactNumber: app.contactNumber,
                            email: app.email,
                            purok: app.purok,
                            address: app.address,
                            purpose: app.purposeOrDiagnosis,
                            status: app.status,
                            submissionDate: formatShortQueueDateTime(app),
                            summaryNote:
                              app.status === 'Valid' || app.status === 'Approved' || app.status === 'Ready for Release' || app.status === 'Disbursed'
                                ? 'All requirements and qualifications satisfied.'
                                : app.rejectionReason || app.evaluatorNotes || app.eligibilityEvaluation?.summary,
                            documents: (app.documents || []).map(d => ({
                              name: d.name,
                              docCategory: d.docCategory,
                              verified: d.verified
                            })),
                            rules: app.eligibilityEvaluation?.rules?.map(r => ({
                              ruleName: r.ruleName,
                              passed: r.passed,
                              explanation: r.explanation
                            }))
                          });
                        }}
                        title="Print Receipt"
                        aria-label={`Print receipt for ${app.referenceCode}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:text-[#0c532b] hover:bg-emerald-50 rounded-lg border border-gray-200 transition cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Print Receipt</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteApp(app)}
                        title="Delete Request"
                        className="p-1 text-gray-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {app.status === 'Needs Additional Requirements' && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-50/70 rounded-xl p-2.5 text-xs text-amber-900">
                      <span className="truncate">
                        {app.evaluatorNotes || 'Additional documents requested by evaluator.'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const targetProg = (programs || []).find(p => p.id === app.programId || p.title === app.programTitle);
                          const firstReq = targetProg?.requirements?.find(Boolean);
                          setResubmitDocLabel(firstReq || 'Barangay Indigency Certificate');
                          setResubmitFile(null);
                          setResubmitError('');
                          setResubmittingApp(app);
                        }}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition shrink-0 w-fit cursor-pointer"
                      >
                        Upload Documents
                      </button>
                    </div>
                  )}

                  {(app.status === 'Disqualified' || app.status === 'Rejected') && app.rejectionReason && (
                    <p className="text-xs text-rose-700">{app.rejectionReason}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2.5. Programs (Application-Needed & Disaster Programs Only) */}
      {(() => {
        const applyPrograms = sortProgramsApplyFirst(
          (programs || []).filter(
            p =>
              p.status !== 'Closed' &&
              !isBarangayServiceApplicationItem(p) &&
              (isApplyOnlyProgram(p) || isDisasterProgram(p))
          )
        );

        const getGroupKey = (p: AssistanceProgram): 'medical' | 'dswd' | 'vice-mayor' | 'disaster' | 'other' => {
          if (isDisasterProgram(p)) return 'disaster';
          const text = `${p.id} ${p.badgeText || ''} ${p.title} ${p.category || ''}`.toLowerCase();
          if (text.includes('ovm') || text.includes('vice mayor')) return 'vice-mayor';
          if (text.includes('dswd')) return 'dswd';
          if (
            p.category === 'Health and Medical Services' ||
            text.includes('medical') ||
            text.includes('hospital') ||
            text.includes('laborator') ||
            text.includes('implant') ||
            text.includes('reseta')
          ) {
            return 'medical';
          }
          return 'other';
        };

        const medicalCount = applyPrograms.filter(p => getGroupKey(p) === 'medical').length;
        const dswdCount = applyPrograms.filter(p => getGroupKey(p) === 'dswd').length;
        const ovmCount = applyPrograms.filter(p => getGroupKey(p) === 'vice-mayor').length;
        const disasterCount = applyPrograms.filter(p => getGroupKey(p) === 'disaster').length;
        const otherCount = applyPrograms.filter(p => getGroupKey(p) === 'other').length;

        const filterTabs: Array<{ key: 'all' | 'medical' | 'dswd' | 'vice-mayor' | 'disaster' | 'other'; label: string }> = [
          { key: 'all', label: `All (${applyPrograms.length})` },
          ...(medicalCount > 0 ? [{ key: 'medical' as const, label: `Medical (${medicalCount})` }] : []),
          ...(dswdCount > 0 ? [{ key: 'dswd' as const, label: `DSWD (${dswdCount})` }] : []),
          ...(ovmCount > 0 ? [{ key: 'vice-mayor' as const, label: `Vice Mayor (${ovmCount})` }] : []),
          ...(disasterCount > 0 ? [{ key: 'disaster' as const, label: `Disaster (${disasterCount})` }] : []),
          ...(otherCount > 0 ? [{ key: 'other' as const, label: `Other (${otherCount})` }] : [])
        ];

        const activeFilterKey = filterTabs.some(t => t.key === applyGroupFilter) ? applyGroupFilter : 'all';
        const searchTerm = programSearch.trim().toLowerCase();

        const visibleApplyPrograms = applyPrograms.filter(p => {
          if (activeFilterKey !== 'all' && getGroupKey(p) !== activeFilterKey) {
            return false;
          }
          if (!searchTerm) return true;
          const searchable = [
            p.title,
            p.category,
            p.tagline,
            p.description,
            p.badgeText,
            p.maxBenefitAmount,
            ...(Array.isArray(p.requirements) ? p.requirements : [])
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return searchable.includes(searchTerm);
        });

        const renderProgramCard = (prog: AssistanceProgram) => {
          const existingApp = findExistingProgramApplication(applications, currentUser, prog);
          return (
            <div
              key={prog.id}
              className="rounded-xl border border-gray-200 bg-white hover:border-[#0c532b]/60 transition p-4 flex flex-col justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                  <img
                    src={resolveServiceImageUrl(prog)}
                    alt={prog.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/assets/services/brgy_clearance_cert_1794197711166.jpg';
                    }}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 min-w-0">
                    {prog.title}
                  </h3>
                </div>
              </div>

              <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
                <span className="text-[11px] text-gray-500 truncate">
                  {existingApp ? `Applied · ${existingApp.referenceCode}` : (prog.maxBenefitAmount || 'Barangay Assistance')}
                </span>
                <button
                  type="button"
                  onClick={() => onApplyProgram(prog)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap shrink-0 inline-flex items-center gap-1 cursor-pointer ${
                    existingApp
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-[#0c532b] hover:bg-[#094222] text-white'
                  }`}
                >
                  {existingApp && <Lock className="w-3 h-3" />}
                  <span>{existingApp ? 'Already Applied' : 'Apply'}</span>
                </button>
              </div>
            </div>
          );
        };

        return (
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Programs</h2>

              <div className="relative w-full sm:w-64 shrink-0">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search programs..."
                  aria-label="Search programs"
                  value={programSearch}
                  onChange={(e) => setProgramSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:ring-2 focus:ring-[#0c532b] focus:border-[#0c532b] transition"
                />
                {programSearch && (
                  <button
                    type="button"
                    onClick={() => setProgramSearch('')}
                    aria-label="Clear program search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-700 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {filterTabs.length > 1 && (
              <div className="flex flex-wrap items-center gap-1 p-0.5 bg-gray-100 rounded-lg text-[11px] font-semibold w-fit">
                {filterTabs.map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setApplyGroupFilter(tab.key)}
                    className={`px-2.5 py-1 rounded-md transition whitespace-nowrap shrink-0 cursor-pointer ${
                      activeFilterKey === tab.key
                        ? 'bg-white text-gray-900 shadow-2xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {visibleApplyPrograms.length === 0 ? (
              <div className="py-6 px-4 text-center rounded-xl border border-dashed border-gray-200 bg-gray-50/60 space-y-2">
                <p className="text-xs text-gray-500">
                  {applyPrograms.length === 0
                    ? 'No programs are currently open.'
                    : `No programs match "${programSearch.trim() || activeFilterKey}".`}
                </p>
                {(programSearch || activeFilterKey !== 'all') && applyPrograms.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setProgramSearch('');
                      setApplyGroupFilter('all');
                    }}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-[#0c532b] bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition cursor-pointer"
                  >
                    Reset search &amp; filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {visibleApplyPrograms.map(renderProgramCard)}
              </div>
            )}
          </div>
        );
      })()}

      {/* 2.6. Qualified Programs (Lists ONLY Qualified Create-Account Programs) */}
      {(() => {
        const visiblePrograms = showAllQualified ? autoQualified : autoQualified.slice(0, 6);

        return (
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Qualified Programs</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Programs you qualify for from Barangay Admin based on your account profile.
                </p>
              </div>

              {autoQualified.length > 6 && (
                <button
                  type="button"
                  onClick={() => setShowAllQualified(prev => !prev)}
                  className="text-xs font-semibold text-[#0c532b] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {showAllQualified ? 'Show fewer' : `View all ${autoQualified.length}`}
                </button>
              )}
            </div>

            {autoQualified.length === 0 ? (
              <div className="py-6 px-4 text-center rounded-xl border border-dashed border-gray-200 bg-gray-50/60">
                <p className="text-sm font-semibold text-gray-700">
                  No qualified programs yet
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Available programs are controlled by Barangay Admin.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {visiblePrograms.map(prog => {
                  const qual = evaluateResidentForProgram(currentUser, prog.id, prog.title, prog, { disasterVictims });
                  const targetedAnn = announcements.find(
                    a => a.targetProgramId === prog.id && a.targetAudienceType === 'Qualified Beneficiaries Only'
                  );
                  const hasSchedule = Boolean(targetedAnn && (targetedAnn.releaseDate || targetedAnn.meetingTime));

                  return (
                    <button
                      key={prog.id}
                      type="button"
                      onClick={() => setViewingQualifiedProgram(prog)}
                      className={`w-full text-left p-3.5 rounded-xl border transition flex items-center justify-between gap-3 cursor-pointer group ${
                        hasSchedule
                          ? 'bg-emerald-50/60 border-emerald-200 hover:border-emerald-400'
                          : 'bg-gray-50/60 border-gray-200 hover:border-[#0c532b] hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-11 h-11 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                          <img
                            src={resolveServiceImageUrl(prog)}
                            alt={prog.title}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/assets/services/brgy_clearance_cert_1794197711166.jpg';
                            }}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="text-sm font-semibold text-gray-900 group-hover:text-[#0c532b] truncate">
                            {prog.title}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-1.5 truncate">
                            <span className="truncate">{qual.shortReason}</span>
                            {hasSchedule && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-medium text-emerald-800 shrink-0">
                                  {targetedAnn?.releaseDate || 'Scheduled'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-xs font-semibold whitespace-nowrap ${
                            hasSchedule ? 'text-emerald-700' : 'text-[#0c532b]'
                          }`}
                        >
                          {hasSchedule ? 'Scheduled' : 'Qualified'}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#0c532b] transition-colors" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* 4. Latest Advisories (Simple & Readable Bulletin Feed) */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Latest Advisories</h2>
            <p className="text-xs text-gray-500 mt-0.5">Release schedules and community updates from Barangay Bugo.</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('announcements')}
            className="text-xs font-semibold text-[#0c532b] hover:underline flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>View all</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {visibleAnnouncements.length === 0 ? (
          <p className="py-3 text-xs text-gray-500">No active advisories at this time.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {visibleAnnouncements.slice(0, 3).map((ann) => (
              <button
                key={ann.id}
                type="button"
                onClick={() => onNavigateTab('announcements')}
                className="w-full text-left py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3 hover:bg-gray-50/70 rounded-lg px-1 -mx-1 transition cursor-pointer group"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 group-hover:text-[#0c532b] truncate">
                    {ann.title}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">
                    {ann.category} · {ann.releaseDate ? `Release: ${ann.releaseDate}` : ann.date}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#0c532b] shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: Resident Resubmit Requirements Modal */}
      {resubmittingApp && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-gray-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">Upload Requested Qualification Documents</h3>
                <span className="text-[10px] text-gray-400 font-mono">Reference: {resubmittingApp.referenceCode}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResubmittingApp(null);
                  setResubmitFile(null);
                  setResubmitError('');
                }}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <span className="font-bold block">Evaluator's Specific Request:</span>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                {resubmittingApp.evaluatorNotes || 'Please upload the requested documents to continue evaluation.'}
              </p>
            </div>

            {resubmitError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] font-semibold text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{resubmitError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Requirement Category</label>
                {(() => {
                  const targetProg = (programs || []).find(
                    p => p.id === resubmittingApp.programId || p.title === resubmittingApp.programTitle
                  );
                  const progReqs = (targetProg?.requirements || []).map(r => String(r || '').trim()).filter(Boolean);
                  const presets = progReqs.length > 0
                    ? progReqs
                    : [
                        '2026 Certificate of Matriculation',
                        'Barangay Indigency Certificate',
                        'Doctor Prescription & Hospital Bill',
                        'Electric / Water Utility Receipt'
                      ];
                  const hint = getRequirementHintLabel(resubmitDocLabel);
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        {presets.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setResubmitDocLabel(preset);
                              setResubmitFile(null);
                              setResubmitError('');
                            }}
                            className={`p-2.5 rounded-xl border text-left text-[11px] font-semibold transition cursor-pointer ${
                              resubmitDocLabel === preset
                                ? 'bg-emerald-50 border-[#0c532b] text-[#0c532b] font-bold'
                                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <Paperclip className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
                            <span>{preset}</span>
                          </button>
                        ))}
                      </div>
                      {hint.toLowerCase() !== resubmitDocLabel.trim().toLowerCase() && (
                        <p className="text-[11px] text-gray-500 mt-1.5">
                          Must be: <span className="font-semibold text-gray-700">{hint}</span>
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Upload Real Document File (PDF, JPG, or PNG) <span className="text-rose-500">*</span>
                </label>
                <label className="flex items-center justify-between gap-2 p-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 cursor-pointer transition">
                  <div className="flex items-center gap-2 min-w-0">
                    <Upload className="w-4 h-4 text-[#0c532b] shrink-0" />
                    <span className="text-[11px] font-semibold text-gray-700 truncate">
                      {isScanningResubmit
                        ? 'Scanning file...'
                        : resubmitFile
                        ? `${resubmitFile.name} (${resubmitFile.size})`
                        : 'Select PDF or photo file from device'}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-[#0c532b] shrink-0">
                    {resubmitFile ? 'Replace' : 'Browse'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size === 0) {
                        setResubmitError('Selected file is empty. Please choose a valid document.');
                        return;
                      }
                      if (file.size > 5 * 1024 * 1024) {
                        setResubmitError('File exceeds 5MB limit.');
                        return;
                      }
                      setResubmitError('');
                      setIsScanningResubmit(true);
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        if (typeof reader.result !== 'string') {
                          setIsScanningResubmit(false);
                          setResubmitError('Could not read file.');
                          return;
                        }
                        const dataUrl = reader.result;
                        const scan = await scanQualificationDocumentPhoto({
                          file,
                          base64Data: dataUrl,
                          expectedRequirementLabel: resubmitDocLabel
                        });
                        setIsScanningResubmit(false);
                        if (!scan.isClear || !scan.isValid) {
                          setResubmitFile(null);
                          setResubmitError(scan.warning || 'Document photo appears unclear or invalid. Please upload a clearer file.');
                          return;
                        }
                        setResubmitFile({
                          name: file.name,
                          url: dataUrl,
                          size: formatDocumentByteSize(file.size),
                          type: file.name.toLowerCase().endsWith('.pdf') || file.type.includes('pdf') ? 'PDF' : 'Image',
                          scanResult: scan
                        });
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Applicant Note / Explanation</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Attached certified true copy of 2nd semester school enrolment form..."
                  value={resubmitNote}
                  onChange={(e) => setResubmitNote(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 font-medium outline-none focus:ring-2 focus:ring-[#0c532b]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setResubmittingApp(null);
                    setResubmitFile(null);
                    setResubmitError('');
                  }}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isScanningResubmit}
                  onClick={async () => {
                    if (!resubmitFile || !isRealDocumentUrl(resubmitFile.url)) {
                      setResubmitError('Please upload a real document file before submitting.');
                      return;
                    }
                    const newDoc: UploadedDocument = {
                      id: `doc-${Date.now()}`,
                      name: `[${resubmitDocLabel}] ${resubmitFile.name}`,
                      type: resubmitFile.type,
                      size: resubmitFile.size,
                      fileUrl: resubmitFile.url,
                      previewUrl: resubmitFile.url,
                      uploadDate: new Date().toISOString().split('T')[0],
                      verified: true,
                      ...(resubmitFile.scanResult ? { scanResult: resubmitFile.scanResult } : {})
                    };
                    await resubmitApplicationRequirements(resubmittingApp.id, [newDoc], resubmitNote);
                    setResubmittingApp(null);
                    setResubmitFile(null);
                    setResubmitError('');
                    setResubmitNote('');
                  }}
                  className="flex-1 py-2.5 bg-[#0c532b] hover:bg-[#094222] disabled:opacity-50 text-white font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  <span>Submit Updated Document</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Application */}
      {confirmDeleteApp && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Delete Application?</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Are you sure you want to delete application <span className="font-mono font-bold text-gray-800">{confirmDeleteApp.referenceCode}</span> ({confirmDeleteApp.programTitle})? This record will be permanently removed.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setConfirmDeleteApp(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await deleteApplication(confirmDeleteApp.referenceCode || confirmDeleteApp.id);
                  } finally {
                    setIsDeleting(false);
                    setConfirmDeleteApp(null);
                  }
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Program Details & Requirements Modal */}
      {viewingQualifiedProgram && (() => {
        const qual = evaluateResidentForProgram(
          currentUser,
          viewingQualifiedProgram.id,
          viewingQualifiedProgram.title,
          viewingQualifiedProgram,
          { disasterVictims }
        );
        const primaryReason = qual.shortReason || qual.passedCriteria[1] || qual.passedCriteria[0] || 'Verified resident profile';
        const targetedAnn = announcements.find(
          a => a.targetProgramId === viewingQualifiedProgram.id && a.targetAudienceType === 'Qualified Beneficiaries Only'
        );
        const scheduleText = targetedAnn
          ? [targetedAnn.releaseDate, targetedAnn.meetingTime, targetedAnn.meetingVenue].filter(Boolean).join(' · ')
          : '';
        const reqMatches = matchProgramRequirementsWithAccount(viewingQualifiedProgram, currentUser, residentStoredDocs);

        return (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 border border-gray-200 shadow-2xl space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0 mt-0.5">
                    <img
                      src={resolveServiceImageUrl(viewingQualifiedProgram)}
                      alt={viewingQualifiedProgram.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/assets/services/brgy_clearance_cert_1794197711166.jpg';
                      }}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className={`flex items-center gap-1.5 text-xs font-semibold ${qual.isQualified ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {qual.isQualified ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>{qual.isQualified ? 'Qualified' : 'Not Qualified'}</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mt-1 leading-snug">
                      {viewingQualifiedProgram.title}
                    </h3>
                    {viewingQualifiedProgram.maxBenefitAmount && (
                      <p className="text-xs font-medium text-gray-500 mt-0.5">
                        {viewingQualifiedProgram.maxBenefitAmount}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingQualifiedProgram(null)}
                  className="text-gray-400 hover:text-gray-700 p-1 rounded-lg cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="divide-y divide-gray-100 border-y border-gray-100 text-xs">
                <div className="py-2.5 flex justify-between gap-4">
                  <span className="text-gray-500 shrink-0">{qual.isQualified ? 'Match' : 'Reason'}</span>
                  <span className={`font-medium text-right ${qual.isQualified ? 'text-gray-900' : 'text-rose-700'}`}>
                    {primaryReason}
                  </span>
                </div>

                <div className="py-2.5 flex justify-between gap-4">
                  <span className="text-gray-500 shrink-0">Schedule</span>
                  <span className={`font-medium text-right ${scheduleText ? 'text-emerald-700' : 'text-gray-500'}`}>
                    {scheduleText || 'To be announced'}
                  </span>
                </div>
              </div>

              {reqMatches.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-gray-700">Qualification</p>
                  <ul className="space-y-1 max-h-40 overflow-y-auto">
                    {reqMatches.map((req, idx) => (
                      <li key={idx} className="flex items-center justify-between gap-2 text-[11px] text-gray-600">
                        <span className="flex items-center gap-1.5 min-w-0">
                          {req.status === 'auto-attached' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0 ml-1 mr-1" />
                          )}
                          <span className="truncate">{req.requirement}</span>
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {req.status === 'auto-attached' && isRealDocumentUrl(req.docPayload?.fileUrl || req.docPayload?.previewUrl) && (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewDocModal({
                                  title: req.docPayload?.name || req.requirement,
                                  url: req.docPayload?.fileUrl || req.docPayload?.previewUrl || ''
                                })
                              }
                              className="text-[10px] font-semibold text-[#0c532b] hover:underline cursor-pointer"
                            >
                              View
                            </button>
                          )}
                          <span
                            className={`text-[10px] font-semibold shrink-0 ${
                              req.status === 'auto-attached'
                                ? 'text-emerald-700'
                                : req.isOptional
                                  ? 'text-gray-400'
                                  : 'text-gray-500'
                            }`}
                          >
                            {req.shortStatus || (req.status === 'auto-attached' ? 'Ready' : req.isOptional ? 'Optional' : 'Upload')}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setViewingQualifiedProgram(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
                {(() => {
                  const existingDetailApp = findExistingProgramApplication(applications, currentUser, viewingQualifiedProgram);
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        const target = viewingQualifiedProgram;
                        setViewingQualifiedProgram(null);
                        onApplyProgram(target);
                      }}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition inline-flex items-center gap-1.5 cursor-pointer ${
                        existingDetailApp
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-[#0c532b] hover:bg-[#094222] text-white'
                      }`}
                    >
                      {existingDetailApp && <Lock className="w-3.5 h-3.5" />}
                      <span>{existingDetailApp ? 'Already Applied' : 'Apply'}</span>
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })()}

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

// ----------------------------------------------------
// 2. RESIDENT CERTIFICATION VIEW (Synced 1:1 with Admin Barangay Services)
// ----------------------------------------------------
export const ResidentServicesView: React.FC<{
  onApplyProgram: (prog: AssistanceProgram) => void;
}> = ({ onApplyProgram }) => {
  const { currentUser, programs, applications } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'qualified'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  // Show exact same active Certificates, Clearances, Endorsements & Barangay Services as Admin
  const activeItems = sortProgramsAlphabetically(
    (programs || []).filter(p => p.status !== 'Closed' && isBarangayServiceApplicationItem(p))
  );

  const serviceCategories = Array.from(
    new Set<string>(activeItems.map(item => String(item.category || '')).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const enrichedItems = activeItems.map(item => {
    const qual = evaluateCertificateQualification(currentUser, item.id, item);
    const requirementMatches = matchProgramRequirementsWithAccount(item, currentUser);
    return {
      item,
      isQualified: qual.isQualified,
      shortReason: qual.shortReason,
      requirementMatches
    };
  });

  const qualifiedCount = enrichedItems.filter(e => e.isQualified).length;

  const filteredItems = enrichedItems.filter(({ item, isQualified }) => {
    if (typeFilter === 'qualified' && !isQualified) return false;
    if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      item.title.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      (item.tagline && item.tagline.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Certification
          </h1>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search certificates or services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#0c532b]"
          />
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-lg text-xs font-semibold">
          {[
            { id: 'all' as const, label: `All (${enrichedItems.length})` },
            { id: 'qualified' as const, label: `Qualified (${qualifiedCount})` }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTypeFilter(tab.id)}
              className={`px-3 py-1.5 rounded-md transition whitespace-nowrap shrink-0 cursor-pointer ${
                typeFilter === tab.id
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {serviceCategories.length > 1 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by service category"
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 font-medium outline-none focus:ring-2 focus:ring-[#0c532b]"
          >
            <option value="All">All Categories ({enrichedItems.length})</option>
            {serviceCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        )}
      </div>

      {/* Compact Certificates & Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.length === 0 ? (
          <div className="col-span-full py-10 text-center text-xs text-gray-500 bg-white rounded-xl border border-gray-200">
            {enrichedItems.length === 0
              ? 'No certificates are currently open. Availability is managed by Barangay Admin.'
              : searchTerm.trim()
                ? `No certificates matching "${searchTerm}".`
                : 'No active certificates match this filter.'}
          </div>
        ) : (
          filteredItems.map(({ item, isQualified }) => {
              const existingServiceApp = findExistingProgramApplication(applications, currentUser, item);
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col justify-between gap-3 hover:border-[#0c532b]/60 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                      <img
                        src={resolveServiceImageUrl(item)}
                        alt={item.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/assets/services/brgy_clearance_cert_1794197711166.jpg';
                        }}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <h2 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 min-w-0">
                      {item.title}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => onApplyProgram(item)}
                    className={`w-full py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      existingServiceApp
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                        : isQualified
                        ? 'bg-[#0c532b] hover:bg-[#094222] text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                    }`}
                  >
                    {existingServiceApp ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Already Applied</span>
                      </>
                    ) : (
                      <>
                        <span>{isQualified ? 'Apply' : 'View & Apply'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              );
          })
        )}
      </div>
    </div>
  );
};

// ----------------------------------------------------
// 4. RESIDENT SETTINGS VIEW (Includes Change Profile & Detail Editing)
// ----------------------------------------------------
export const ResidentSettingsView: React.FC = () => {
  const { currentUser, updateUserProfile, submitProfileChangeRequest, verifyCurrentPassword } = useApp();
  const [photoUrl, setPhotoUrl] = useState(currentUser?.avatarUrl || '');

  const buildInitialFormData = (user: typeof currentUser) => ({
    name: user?.name || '',
    email: user?.email || '',
    contactNumber: user?.contactNumber || '',
    nationality: user?.nationality || 'Filipino',
    purok: user?.purok || BUGO_PUROKS[0],
    address: user?.address || '',
    householdIncome: user?.householdIncome || MONTHLY_INCOME_OPTIONS[2],
    familyMembersCount: user?.familyMembersCount || 4,
    occupation: user?.occupation || 'Resident',
    employmentStatus: user?.employmentStatus || 'Self-Employed',
    age: user?.age || 30,
    gender: user?.gender || (detectUserGender(user) === 'male' ? 'Male' : 'Female'),
    voterStatus: user?.voterStatus || 'Registered'
  });

  // Profile Editable Details
  const [formData, setFormData] = useState(() => buildInitialFormData(currentUser));

  // Lock & Password Verification before editing / submitting for approval
  const [isProfileUnlocked, setIsProfileUnlocked] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [showUnlockPass, setShowUnlockPass] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const lastSyncedUserIdRef = React.useRef<string | undefined>(currentUser?.id);

  const userDetectedGender = detectUserGender(currentUser, formData.name);
  const [avatarGenderFilter, setAvatarGenderFilter] = useState<'male' | 'female'>(userDetectedGender);

  React.useEffect(() => {
    setAvatarGenderFilter(detectUserGender(currentUser, formData.name));
  }, [currentUser, formData.name]);

  React.useEffect(() => {
    if (!currentUser) return;
    if (lastSyncedUserIdRef.current !== currentUser.id) {
      lastSyncedUserIdRef.current = currentUser.id;
      setIsProfileUnlocked(false);
      setFormData(buildInitialFormData(currentUser));
      return;
    }
    if (!isProfileUnlocked) {
      setFormData(buildInitialFormData(currentUser));
    }
  }, [currentUser, isProfileUnlocked]);

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [savedSuccess, setSavedSuccess] = useState<string | false>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Field validation rules
  const errors: Record<string, string> = {};
  if (!formData.name.trim()) errors.name = 'Full legal name is required';
  const cleanEmailInput = normalizeAccountEmail(formData.email);
  if (!cleanEmailInput) {
    errors.email = 'Email address is required';
  } else if (!isAllowedAccountEmail(cleanEmailInput)) {
    errors.email = ALLOWED_EMAIL_DOMAIN_MESSAGE;
  }
  
  const phoneCheck = normalizePhMobileNumber(formData.contactNumber);
  if (!formData.contactNumber.trim()) {
    errors.contactNumber = 'Contact number is required';
  } else if (!phoneCheck.valid) {
    errors.contactNumber = phoneCheck.reason || 'Enter a valid 11-digit Philippine mobile number (e.g. 0917 628 4915)';
  }

  if (!formData.nationality) errors.nationality = 'Nationality is required';
  if (!formData.purok) errors.purok = 'Purok / Zone selection is required';
  if (!formData.address.trim()) errors.address = 'Street address is required';
  if (!formData.householdIncome) errors.householdIncome = 'Monthly income selection is required';

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.trim();
    const hasLeadingPlus = raw.startsWith('+');
    const digitsOnly = raw.replace(/\D/g, '').slice(0, 12);
    setFormData(prev => ({ ...prev, contactNumber: hasLeadingPlus ? `+${digitsOnly}` : digitsOnly }));
  };

  const handleUpdatePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setPhotoUrl(reader.result);
          updateUserProfile({ avatarUrl: reader.result });
          setSavedSuccess('Profile photo updated.');
          setTimeout(() => setSavedSuccess(false), 3000);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectPreset = (url: string) => {
    setPhotoUrl(url);
    updateUserProfile({ avatarUrl: url });
    setSavedSuccess('Profile photo updated.');
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleUnlockWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError('');
    if (!unlockPassword.trim()) {
      setUnlockError('Please enter your account password.');
      return;
    }
    setIsVerifyingPassword(true);
    try {
      const res = await verifyCurrentPassword(unlockPassword);
      if (res.success) {
        setIsProfileUnlocked(true);
        setShowUnlockModal(false);
        setUnlockPassword('');
        setUnlockError('');
      } else {
        setUnlockError(res.message || 'Incorrect password.');
      }
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const handleSaveProfileDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!isProfileUnlocked) {
      setUnlockPassword('');
      setUnlockError('');
      setShowUnlockModal(true);
      return;
    }

    const allTouched: Record<string, boolean> = {
      name: true,
      email: true,
      contactNumber: true,
      nationality: true,
      purok: true,
      address: true,
      householdIncome: true
    };
    setTouched(allTouched);

    if (Object.keys(errors).length > 0) {
      setErrorMsg('Please complete all highlighted fields marked in red.');
      return;
    }

    const baseline = buildInitialFormData(currentUser);
    const changedFields: Partial<EditableResidentProfileFields> = {};
    if (formData.name !== baseline.name) changedFields.name = formData.name;
    if (formData.email !== baseline.email) changedFields.email = formData.email;
    if (formData.contactNumber !== baseline.contactNumber) {
      changedFields.contactNumber = phoneCheck.valid
        ? (formData.contactNumber.trim().startsWith('+') ? phoneCheck.e164 : phoneCheck.local09)
        : formData.contactNumber;
    }
    if (formData.nationality !== baseline.nationality) changedFields.nationality = formData.nationality;
    if (formData.purok !== baseline.purok) changedFields.purok = formData.purok;
    if (formData.address !== baseline.address) changedFields.address = formData.address;
    if (formData.householdIncome !== baseline.householdIncome) changedFields.householdIncome = formData.householdIncome;
    if (Number(formData.familyMembersCount) !== Number(baseline.familyMembersCount)) {
      changedFields.familyMembersCount = Number(formData.familyMembersCount);
    }
    if (formData.occupation !== baseline.occupation) changedFields.occupation = formData.occupation;
    if (formData.employmentStatus !== baseline.employmentStatus) {
      changedFields.employmentStatus = formData.employmentStatus as any;
    }
    if (Number(formData.age) !== Number(baseline.age)) changedFields.age = Number(formData.age);
    if (formData.gender !== baseline.gender) changedFields.gender = formData.gender as any;
    if (formData.voterStatus !== baseline.voterStatus) changedFields.voterStatus = formData.voterStatus as any;

    if (Object.keys(changedFields).length === 0) {
      setErrorMsg('No changes detected.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitProfileChangeRequest(changedFields);

      if (!result.success) {
        setErrorMsg(result.message);
        return;
      }

      setIsProfileUnlocked(false);
      setSavedSuccess('Profile changes submitted. Only the Barangay Admin can approve these updates.');
      setTimeout(() => setSavedSuccess(false), 4500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFieldClass = (field: string) => {
    if (!isProfileUnlocked) {
      return 'w-full bg-gray-100 border border-gray-200 text-gray-500 rounded-xl px-3 py-2.5 font-medium outline-none cursor-not-allowed transition';
    }
    const isRed = touched[field] && Boolean(errors[field]);
    if (isRed) {
      return 'w-full bg-rose-50/50 border-2 border-rose-500 text-rose-950 rounded-xl px-3 py-2.5 font-medium outline-none ring-2 ring-rose-200 placeholder-rose-400 transition';
    }
    return 'w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-xl px-3 py-2.5 font-medium outline-none focus:ring-2 focus:ring-[#0c532b] transition';
  };

  const pendingRequest = currentUser?.pendingProfileUpdate;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">

      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-xs animate-in fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{savedSuccess}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-300 p-3.5 rounded-2xl text-xs text-rose-800 font-semibold flex items-start gap-2.5 shadow-xs animate-in fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-xs">

        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-emerald-100 shadow-md bg-gray-100 flex items-center justify-center">
              {currentUser?.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-gray-400" />
              )}
            </div>
          </div>

          <div className="space-y-3 flex-1 text-center sm:text-left">
            <div>
              <h3 className="text-sm font-bold text-gray-900">{currentUser?.name}</h3>
              <p className="text-xs text-gray-500 font-mono">Resident ID: {currentUser?.residentIdNumber}</p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              <label className="cursor-pointer px-4 py-2 text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-2 bg-[#0c532b] hover:bg-[#083c1f] text-white">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Custom Photo</span>
                <input type="file" accept="image/*" onChange={handleUpdatePhoto} className="hidden" />
              </label>

              {currentUser?.avatarUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setPhotoUrl('');
                    updateUserProfile({ avatarUrl: '' });
                  }}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Remove Picture
                </button>
              )}
            </div>

            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-end pb-1">
                <div className="flex items-center bg-gray-100 p-0.5 rounded-xl border border-gray-200 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setAvatarGenderFilter('male')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      avatarGenderFilter === 'male'
                        ? 'bg-[#0c532b] text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Male
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarGenderFilter('female')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      avatarGenderFilter === 'female'
                        ? 'bg-[#0c532b] text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Female
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {(avatarGenderFilter === 'male' ? MALE_CARTOON_AVATARS : FEMALE_CARTOON_AVATARS).map((preset) => {
                  const isSelected = currentUser?.avatarUrl === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.url)}
                      className={`relative p-1.5 rounded-xl border-2 transition transform hover:scale-105 flex flex-col items-center gap-1 cursor-pointer ${
                        isSelected 
                          ? 'border-[#0c532b] bg-emerald-50 ring-2 ring-emerald-300' 
                          : 'border-gray-200 hover:border-emerald-500 bg-gray-50/50'
                      }`}
                      title={preset.name}
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-white shadow-xs">
                        <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[9px] font-bold text-gray-700 truncate max-w-[55px] block text-center">
                        {preset.name.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resident Details Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-xs space-y-5">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#0c532b]" />
            <h2 className="text-base font-bold text-gray-900">Resident Details</h2>
          </div>
          {!isProfileUnlocked ? (
            <button
              type="button"
              onClick={() => {
                setUnlockPassword('');
                setUnlockError('');
                setShowUnlockModal(true);
              }}
              className="px-3.5 py-1.5 bg-[#0c532b] hover:bg-[#083c1f] text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Unlock to Edit</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsProfileUnlocked(false)}
              className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock</span>
            </button>
          )}
        </div>

        {pendingRequest?.status === 'Rejected' && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Previous edit request declined: </span>
              <span>{pendingRequest.rejectionReason || 'Submitted changes could not be verified.'}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSaveProfileDetails} noValidate className="space-y-5 text-xs">
          <div className="space-y-3">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className={`block font-bold ${touched.name && errors.name ? 'text-rose-600' : 'text-gray-700'}`}>
                    Full Legal Name <span className="text-rose-500">*</span>
                  </label>
                  {touched.name && errors.name && (
                    <span className="text-[11px] font-bold text-rose-600">{errors.name}</span>
                  )}
                </div>
                <input
                  type="text"
                  disabled={!isProfileUnlocked}
                  value={formData.name}
                  onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={getFieldClass('name')}
                  placeholder="Juan Carlos Dela Cruz"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className={`block font-bold ${touched.email && errors.email ? 'text-rose-600' : 'text-gray-700'}`}>
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  {touched.email && errors.email && (
                    <span className="text-[11px] font-bold text-rose-600">{errors.email}</span>
                  )}
                </div>
                <input
                  type="email"
                  disabled={!isProfileUnlocked}
                  value={formData.email}
                  onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={getFieldClass('email')}
                  placeholder="name@gmail.com or name@bugo.gov.ph"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className={`block font-bold ${touched.contactNumber && errors.contactNumber ? 'text-rose-600' : 'text-gray-700'}`}>
                    Mobile Contact (12 Digits Max) <span className="text-rose-500">*</span>
                  </label>
                  {touched.contactNumber && errors.contactNumber ? (
                    <span className="text-[11px] font-bold text-rose-600">{errors.contactNumber}</span>
                  ) : (
                    <span className="text-[10px] text-gray-400">{formData.contactNumber.replace(/\D/g, '').length}/12 digits</span>
                  )}
                </div>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    disabled={!isProfileUnlocked}
                    maxLength={13}
                    placeholder="09171234567 or +639171234567"
                    value={formData.contactNumber}
                    onBlur={() => setTouched(prev => ({ ...prev, contactNumber: true }))}
                    onChange={handleContactChange}
                    className={`${getFieldClass('contactNumber')} pl-9`}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className={`block font-bold ${touched.nationality && errors.nationality ? 'text-rose-600' : 'text-gray-700'}`}>
                    Nationality <span className="text-rose-500">*</span>
                  </label>
                  {touched.nationality && errors.nationality && (
                    <span className="text-[11px] font-bold text-rose-600">{errors.nationality}</span>
                  )}
                </div>
                <div className="relative">
                  <Globe className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    disabled={!isProfileUnlocked}
                    value={formData.nationality}
                    onBlur={() => setTouched(prev => ({ ...prev, nationality: true }))}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    className={`${getFieldClass('nationality')} pl-9 font-semibold`}
                  >
                    {NATIONALITY_OPTIONS.map(nat => (
                      <option key={nat} value={nat}>{nat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className={`block font-bold ${touched.purok && errors.purok ? 'text-rose-600' : 'text-gray-700'}`}>
                    Purok / Zone <span className="text-rose-500">*</span>
                  </label>
                  {touched.purok && errors.purok && (
                    <span className="text-[11px] font-bold text-rose-600">{errors.purok}</span>
                  )}
                </div>
                <select
                  disabled={!isProfileUnlocked}
                  value={formData.purok}
                  onBlur={() => setTouched(prev => ({ ...prev, purok: true }))}
                  onChange={(e) => setFormData({ ...formData, purok: e.target.value })}
                  className={`${getFieldClass('purok')} font-semibold`}
                >
                  {BUGO_PUROKS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Voter Registration Status</label>
                <select
                  disabled={!isProfileUnlocked}
                  value={formData.voterStatus}
                  onChange={(e) => setFormData({ ...formData, voterStatus: e.target.value as any })}
                  className={`${getFieldClass('voterStatus')} font-semibold`}
                >
                  <option value="Registered">Registered Voter (COMELEC Bugo)</option>
                  <option value="Unregistered">Unregistered / Transfer Pending</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className={`block font-bold ${touched.address && errors.address ? 'text-rose-600' : 'text-gray-700'}`}>
                  Street Address <span className="text-rose-500">*</span>
                </label>
                {touched.address && errors.address && (
                  <span className="text-[11px] font-bold text-rose-600">{errors.address}</span>
                )}
              </div>
              <input
                type="text"
                disabled={!isProfileUnlocked}
                value={formData.address}
                onBlur={() => setTouched(prev => ({ ...prev, address: true }))}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className={getFieldClass('address')}
                placeholder="House No., Street Name, Bugo, Cagayan de Oro City"
              />
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-gray-100">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className={`block font-bold ${touched.householdIncome && errors.householdIncome ? 'text-rose-600' : 'text-gray-700'}`}>
                    Monthly Household Income (Select Bracket) <span className="text-rose-500">*</span>
                  </label>
                  {touched.householdIncome && errors.householdIncome && (
                    <span className="text-[11px] font-bold text-rose-600">{errors.householdIncome}</span>
                  )}
                </div>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    disabled={!isProfileUnlocked}
                    value={formData.householdIncome}
                    onBlur={() => setTouched(prev => ({ ...prev, householdIncome: true }))}
                    onChange={(e) => setFormData({ ...formData, householdIncome: e.target.value })}
                    className={`${getFieldClass('householdIncome')} pl-9 font-semibold`}
                  >
                    {MONTHLY_INCOME_OPTIONS.map((inc) => (
                      <option key={inc} value={inc}>{inc}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Family Dependents Count</label>
                <input
                  type="number"
                  disabled={!isProfileUnlocked}
                  min="1"
                  max="25"
                  value={formData.familyMembersCount}
                  onChange={(e) => setFormData({ ...formData, familyMembersCount: Number(e.target.value) })}
                  className={`${getFieldClass('familyMembersCount')} font-semibold`}
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Occupation / Employment</label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    disabled={!isProfileUnlocked}
                    value={formData.occupation}
                    onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                    className={`${getFieldClass('occupation')} pl-9`}
                    placeholder="e.g. Market Vendor, Teacher, Carpenter"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Age</label>
                  <input
                    type="number"
                    disabled={!isProfileUnlocked}
                    min="1"
                    max="120"
                    value={formData.age}
                    onChange={(e) => {
                      const newAge = Number(e.target.value) || 0;
                      setFormData(prev => ({
                        ...prev,
                        age: newAge
                      }));
                    }}
                    className={`${getFieldClass('age')} font-semibold`}
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Gender</label>
                  <select
                    disabled={!isProfileUnlocked}
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                    className={`${getFieldClass('gender')} font-semibold`}
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {isProfileUnlocked && (
            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-[#0c532b] hover:bg-[#083c1f] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit for Admin Approval'}</span>
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Password Verification Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-gray-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#0c532b]" />
                <h3 className="text-base font-bold text-gray-900">Verify Password</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUnlockModal(false);
                  setUnlockError('');
                }}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Enter your password to edit and submit changes for admin approval.
            </p>

            <form onSubmit={handleUnlockWithPassword} className="space-y-3">
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showUnlockPass ? 'text' : 'password'}
                  autoFocus
                  value={unlockPassword}
                  onChange={(e) => {
                    setUnlockPassword(e.target.value);
                    setUnlockError('');
                  }}
                  placeholder="Account password"
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-xl pl-9 pr-10 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-[#0c532b]"
                />
                <button
                  type="button"
                  onClick={() => setShowUnlockPass(!showUnlockPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  {showUnlockPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {unlockError && (
                <p className="text-xs font-semibold text-rose-600">{unlockError}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowUnlockModal(false);
                    setUnlockError('');
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingPassword || !unlockPassword}
                  className="px-4 py-2 bg-[#0c532b] hover:bg-[#083c1f] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  {isVerifyingPassword && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Unlock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Change Password & Security Credentials */}
      <ChangePasswordSection />
    </div>
  );
};


// ----------------------------------------------------
// 5. RESIDENT HELP & SUPPORT VIEW
// ----------------------------------------------------
export const ResidentHelpView: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          Citizen Help Center & Assistance Guide
        </h1>
      </div>

      {/* Official Helpdesk & Precinct Contact Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#0c532b] flex items-center justify-center">
            <Building className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">Barangay Bugo Hall Desk</h3>
          <p className="text-xs text-gray-500">National Highway, Bugo, CDO</p>
          <p className="text-xs font-bold text-[#0c532b] bg-gray-50 p-2 rounded-xl border border-gray-200 text-center">Tel: (088) 855-2244</p>
          <p className="text-[11px] text-gray-400 text-center">Mon - Fri • 8:00 AM - 5:00 PM</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">PNP Precinct 6 Bugo</h3>
          <p className="text-xs text-gray-500">Barangay Security & Patrol</p>
          <p className="text-xs font-bold text-blue-700 bg-gray-50 p-2 rounded-xl border border-gray-200 text-center">Mobile: 0917-882-9911</p>
          <p className="text-[11px] text-gray-400 text-center">24/7 Police Assistance</p>
        </div>
      </div>

      {/* Step-by-Step Instructions */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-xs space-y-6">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-[#0c532b]" />
          <span>Step-by-Step Guide for Barangay Services</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-gray-50 p-4 rounded-2xl space-y-2 border border-gray-100">
            <div className="w-7 h-7 rounded-lg bg-[#0c532b] text-white font-bold flex items-center justify-center text-xs">
              1
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Upload Front & Back ID</h3>
            <p className="text-gray-600 leading-relaxed">
              When applying for assistance, attach clear photos of the Front and Back of your valid government ID (PhilSys, Driver's License, Voter's ID, or Barangay ID).
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-2xl space-y-2 border border-gray-100">
            <div className="w-7 h-7 rounded-lg bg-[#0c532b] text-white font-bold flex items-center justify-center text-xs">
              2
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Administrative Verification</h3>
            <p className="text-gray-600 leading-relaxed">
              Barangay Bugo evaluators review all submitted qualification documents and eligibility data. You will receive live notifications when approved.
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-2xl space-y-2 border border-gray-100">
            <div className="w-7 h-7 rounded-lg bg-[#0c532b] text-white font-bold flex items-center justify-center text-xs">
              3
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Release of Aid & Assistance</h3>
            <p className="text-gray-600 leading-relaxed">
              Present your Reference Code and valid Resident ID at the Barangay Hall Treasury Window to receive your approved grant or certificate.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------
// 6. RESIDENT PROFILE & DIGITAL RESIDENT ID CARD (Used in Drawer / Upper Right)
// ----------------------------------------------------
export const ResidentProfileView: React.FC = () => {
  const { currentUser, updateUserProfile } = useApp();
  const [photoUrl, setPhotoUrl] = useState(currentUser?.avatarUrl || '');
  const [previewIdDoc, setPreviewIdDoc] = useState<{ title: string; url: string; subtitle: string } | null>(null);

  const handleUpdatePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setPhotoUrl(reader.result);
          updateUserProfile({ avatarUrl: reader.result });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          Official Digital Resident ID & Information
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Your centralized digital citizen identity and records in Barangay Bugo, CDO.
        </p>
      </div>

      {/* ID Card Front */}
      <div className="bg-linear-to-br from-[#0c532b] via-[#0f6837] to-[#083a1e] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border-2 border-emerald-400/30">
        <div className="flex items-center justify-between pb-4 border-b border-emerald-400/30">
          <div>
            <p className="text-[10px] tracking-widest uppercase font-bold text-emerald-200">Republic of the Philippines</p>
            <h2 className="text-base font-extrabold tracking-tight">BARANGAY BUGO</h2>
            <p className="text-[10px] text-emerald-200">Cagayan de Oro City • Northern Mindanao</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white text-[#0c532b] font-extrabold flex items-center justify-center text-lg shadow-sm">
            BG
          </div>
        </div>

        <div className="py-6 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-2xl bg-white/20 border-2 border-white/40 overflow-hidden flex items-center justify-center text-3xl font-extrabold text-white flex-shrink-0 shadow-md">
            {currentUser?.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" />
            ) : (
              currentUser?.name.slice(0, 2).toUpperCase()
            )}
          </div>

          <div className="space-y-1.5 text-center sm:text-left flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Official Resident ID</span>
            <h3 className="text-xl font-extrabold tracking-tight">{currentUser?.name}</h3>
            <p className="text-xs text-emerald-100 font-medium">{currentUser?.purok}</p>
            <p className="text-[11px] text-emerald-200/80">{currentUser?.address}</p>
            <div className="pt-2 flex flex-wrap gap-2 justify-center sm:justify-start">
              <span className="px-2.5 py-0.5 bg-white/20 text-white rounded-md text-[10px] font-mono font-bold">
                {currentUser?.residentIdNumber}
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-400 text-emerald-950 rounded-md text-[10px] font-bold">
                Voter: {currentUser?.voterStatus || 'Registered'}
              </span>
              <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold ${
                currentUser?.isVerified ? 'bg-emerald-300 text-emerald-950' : 'bg-amber-300 text-amber-950'
              }`}>
                {currentUser?.isVerified ? 'Verified Citizen' : 'Pending Verification'}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-emerald-400/30 flex justify-between items-center text-[10px] text-emerald-200">
          <span>Registered: {currentUser?.registeredDate}</span>
          <span className="font-bold text-white uppercase">Valid & Certified</span>
        </div>
      </div>

      {/* Household & Economic Summary */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs space-y-4 text-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Resident Registry Particulars</h3>
          <label className="cursor-pointer text-[#0c532b] hover:underline font-bold text-xs">
            <span>Change Photo</span>
            <input type="file" accept="image/*" onChange={handleUpdatePhoto} className="hidden" />
          </label>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-gray-400 block">Monthly Household Income:</span>
            <span className="font-bold text-gray-900 text-sm">{currentUser?.householdIncome || '₱8,500.00'}</span>
          </div>
          <div>
            <span className="text-gray-400 block">Dependents Count:</span>
            <span className="font-bold text-gray-900 text-sm">{currentUser?.familyMembersCount || 4} Members</span>
          </div>
          <div>
            <span className="text-gray-400 block">Email Address:</span>
            <span className="font-medium text-gray-800">{currentUser?.email}</span>
          </div>
          <div>
            <span className="text-gray-400 block">Contact Phone:</span>
            <span className="font-medium text-gray-800">{currentUser?.contactNumber}</span>
          </div>
          <div>
            <span className="text-gray-400 block">Occupation:</span>
            <span className="font-medium text-gray-800">{currentUser?.occupation || 'Resident'}</span>
          </div>
          <div>
            <span className="text-gray-400 block">Civil Status:</span>
            <span className="font-medium text-gray-800">{currentUser?.civilStatus || 'Single'}</span>
          </div>
          <div>
            <span className="text-gray-400 block">Registered Valid ID Type:</span>
            <span className="font-bold text-gray-900">{currentUser?.idType || 'PhilSys National ID'}</span>
          </div>
          <div>
            <span className="text-gray-400 block">ID Number:</span>
            <span className="font-mono font-bold text-[#0c532b]">{currentUser?.idNumber || currentUser?.residentIdNumber}</span>
          </div>
        </div>
      </div>

      {/* Valid Government / Resident ID On File (Front & Back) */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#0c532b]" />
              <span>Submitted Valid ID On File</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {currentUser?.idType || 'Valid Government / Barangay ID'}
              {currentUser?.idNumber ? ` · ${currentUser.idNumber}` : ''}
            </p>
          </div>
          {(currentUser?.frontIdUrl || currentUser?.backIdUrl) && (
            <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified ID</span>
            </span>
          )}
        </div>

        {(currentUser?.frontIdUrl || currentUser?.backIdUrl) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {currentUser?.frontIdUrl && (
              <button
                type="button"
                onClick={() => setPreviewIdDoc({
                  title: `${currentUser.idType || 'Valid ID'} (Front View)`,
                  subtitle: `${currentUser.name} • ${currentUser.idNumber || currentUser.residentIdNumber}`,
                  url: currentUser.frontIdUrl!
                })}
                className="text-left group rounded-xl overflow-hidden border border-gray-200 hover:border-[#0c532b]/50 bg-slate-50 shadow-xs transition cursor-pointer"
              >
                <div className="aspect-[16/10] w-full overflow-hidden flex items-center justify-center bg-slate-100">
                  <img
                    src={currentUser.frontIdUrl}
                    alt={`Front of ${currentUser.idType || 'Valid ID'}`}
                    className="w-full h-full object-contain group-hover:scale-[1.02] transition duration-200"
                  />
                </div>
                <div className="px-3 py-2 bg-white border-t border-gray-100 flex items-center justify-between text-xs font-bold text-gray-800">
                  <span>Front of Valid ID</span>
                  <span className="text-[#0c532b] inline-flex items-center gap-1">
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>View Full</span>
                  </span>
                </div>
              </button>
            )}

            {currentUser?.backIdUrl && (
              <button
                type="button"
                onClick={() => setPreviewIdDoc({
                  title: `${currentUser.idType || 'Valid ID'} (Back View)`,
                  subtitle: `${currentUser.name} • ${currentUser.idNumber || currentUser.residentIdNumber}`,
                  url: currentUser.backIdUrl!
                })}
                className="text-left group rounded-xl overflow-hidden border border-gray-200 hover:border-[#0c532b]/50 bg-slate-50 shadow-xs transition cursor-pointer"
              >
                <div className="aspect-[16/10] w-full overflow-hidden flex items-center justify-center bg-slate-100">
                  <img
                    src={currentUser.backIdUrl}
                    alt={`Back of ${currentUser.idType || 'Valid ID'}`}
                    className="w-full h-full object-contain group-hover:scale-[1.02] transition duration-200"
                  />
                </div>
                <div className="px-3 py-2 bg-white border-t border-gray-100 flex items-center justify-between text-xs font-bold text-gray-800">
                  <span>Back of Valid ID</span>
                  <span className="text-[#0c532b] inline-flex items-center gap-1">
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>View Full</span>
                  </span>
                </div>
              </button>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-500">
            No front/back valid ID images are attached to this account yet.
          </div>
        )}
      </div>

      {previewIdDoc && (
        <DocumentPreviewModal
          title={previewIdDoc.title}
          subtitle={previewIdDoc.subtitle}
          url={previewIdDoc.url}
          footerText="Verified Valid ID on Resident Account"
          closeLabel="Close"
          onClose={() => setPreviewIdDoc(null)}
        />
      )}
    </div>
  );
};
