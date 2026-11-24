import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  UserRole, 
  ResidentUser, 
  AssistanceProgram, 
  AssistanceApplication, 
  ApplicationStatus,
  AnnouncementItem,
  NotificationItem,
  ActivityLogItem,
  ArchiveItem,
  CensusData,
  UploadedDocument,
  NotificationDocumentData,
  EditableResidentProfileFields,
  ProfileChangeRequest,
  DisasterVictimRecord,
  BugoHazardZone,
  SecretariatDetails,
  RankingPriorityLevel,
  RankingClassificationEntry,
  HazardSummaryCategory,
  HazardSummariesData
} from '../types';
import { 
  DEMO_ADMIN_USER, 
  DEMO_RESIDENT_USER, 
  INITIAL_PROGRAMS, 
  INITIAL_APPLICATIONS, 
  INITIAL_RESIDENT_RECORDS, 
  INITIAL_ANNOUNCEMENTS, 
  INITIAL_NOTIFICATIONS,
  INITIAL_ACTIVITY_LOGS,
  INITIAL_ARCHIVED_ITEMS,
  DEFAULT_BUGO_CENSUS
} from '../data/mockData';
import { createRealPdfDataUrl, isRealDocumentUrl } from '../utils/realDocumentPdf';
import { DEFAULT_BUGO_HAZARD_ZONES, createDefaultHazardSummaries } from '../data/hazardDefaults';
import { evaluateApplicantEligibility, evaluateResidentForProgram, findExistingProgramApplication, hasVerifiedStudentDocument, isBarangayServiceApplicationItem, isDisasterProgram } from '../utils/eligibilityEngine';
import { sortProgramsAlphabetically, sortApplicationsFCFS } from '../utils/sortUtils';
import { sortRankingClassifications } from '../utils/rankingClassification';
import { isAllowedAccountEmail, normalizeAccountEmail, ALLOWED_EMAIL_DOMAIN_MESSAGE } from '../utils/emailValidation';
import { normalizePhMobileNumber } from '../utils/phoneValidation';
import { matchProgramRequirementsWithAccount } from '../utils/requirementMatcher';
import { getRequirementHintLabel } from '../utils/requirementKeywordMatcher';

export type AdminTabType = 'dashboard' | 'residents' | 'programs' | 'status-tracking' | 'disaster-aid' | 'hazard-map' | 'records-io' | 'announcements' | 'archives' | 'help' | 'settings';
export type ResidentTabType = 'dashboard' | 'services' | 'hazard-map' | 'announcements' | 'settings' | 'help' | 'profile';
export type AuthViewType = 'welcome' | 'login' | 'register' | 'guest';

interface AppContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  authView: AuthViewType;
  setAuthView: (view: AuthViewType) => void;
  prefilledLoginEmail: string;
  setPrefilledLoginEmail: (email: string) => void;
  currentUser: ResidentUser | null;
  setCurrentUser: (user: ResidentUser | null) => void;
  
  // Navigation Tabs
  adminTab: AdminTabType;
  setAdminTab: (tab: AdminTabType) => void;
  residentTab: ResidentTabType;
  setResidentTab: (tab: ResidentTabType) => void;
  selectedZoneForRegistry: string | null;
  setSelectedZoneForRegistry: (zone: string | null) => void;

  // Search & Global Modals
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (open: boolean) => void;
  isProfileDrawerOpen: boolean;
  setIsProfileDrawerOpen: (open: boolean) => void;

  // Session Timeout & Account Status Alert State
  isSessionTimedOut: boolean;
  dismissSessionTimeout: () => void;
  accountStatusAlert: string | null;
  dismissAccountStatusAlert: () => void;

  // Data Collections
  programs: AssistanceProgram[];
  applications: AssistanceApplication[];
  residentsList: ResidentUser[];
  announcements: AnnouncementItem[];
  notifications: NotificationItem[];
  activityLogs: ActivityLogItem[];
  archivedItems: ArchiveItem[];
  disasterVictims: DisasterVictimRecord[];
  hazardZones: BugoHazardZone[];
  hazardSummaries: HazardSummariesData;
  rankingClassifications: RankingClassificationEntry[];

  // Auth Operations
  loginWithCredentials: (email: string, pass: string) => Promise<{ success: boolean; message?: string }>;
  loginAsDemoAdmin: () => Promise<{ success: boolean; message?: string }>;
  loginAsDemoResident: () => Promise<{ success: boolean; message?: string }>;
  loginAsGuest: () => void;
  logout: () => void;
  registerResidentAccount: (data: any) => Promise<{ success: boolean; message?: string; residentId?: string; residentIdNumber?: string; email?: string; username?: string }>;
  updateUserProfile: (updates: Partial<ResidentUser>) => void;
  submitProfileChangeRequest: (changes: Partial<EditableResidentProfileFields>) => Promise<{ success: boolean; message: string }>;
  cancelProfileChangeRequest: () => Promise<void>;
  reviewProfileChangeRequest: (residentId: string, decision: 'approve' | 'reject', rejectionReason?: string) => Promise<{ success: boolean; message: string }>;
  changePassword: (
    optionsOrCurrentPassword: { currentPassword?: string; verificationToken?: string; newPassword: string } | string,
    maybeNewPassword?: string
  ) => Promise<{ success: boolean; message: string }>;
  verifyCurrentPassword: (currentPassword: string) => Promise<{ success: boolean; message: string; verificationToken?: string }>;
  incrementAnnouncementViews: (id: string) => Promise<void>;

  // Admin Approval, Verification, Editing, Deletion & Banning Operations
  approveResidentRegistration: (residentId: string) => Promise<void>;
  rejectResidentRegistration: (residentId: string, reason?: string) => Promise<void>;
  autoValidateRegistrationsFromApplications: () => Promise<{ success: boolean; updatedCount?: number; message?: string }>;
  banResidentAccount: (residentId: string, reason: string) => Promise<void>;
  unbanResidentAccount: (residentId: string) => Promise<void>;
  verifyResidentAccount: (residentId: string) => Promise<void>;
  addNewResidentRecord: (data: Partial<ResidentUser> & { password?: string }) => Promise<{ success: boolean; user?: ResidentUser; message?: string }>;
  updateResidentAccount: (residentId: string, updates: Partial<ResidentUser>) => Promise<{ success: boolean; user?: ResidentUser; message?: string }>;
  deleteResidentAccount: (residentId: string) => Promise<{ success: boolean; message?: string }>;
  deleteResidentAccounts: (residentIds: string[]) => Promise<{ success: boolean; deletedCount?: number; message?: string }>;

  // Activity Logs & Archive Operations
  logActivity: (log: Omit<ActivityLogItem, 'id' | 'timestamp'>) => void;
  archiveRecord: (item: Omit<ArchiveItem, 'id' | 'deletedAt' | 'status'>) => void;
  restoreArchivedItem: (id: string) => Promise<{ success: boolean; message?: string }>;
  deleteArchivedItemPermanently: (id: string) => void;

  // Service Application & Status Tracking Operations
  submitAssistanceApplication: (data: any) => Promise<string>;
  verifyApplicationDocument: (appId: string, docId: string, isVerified: boolean) => void;
  updateApplicationStatus: (
    appId: string, 
    newStatus: ApplicationStatus, 
    officerName?: string, 
    remarks?: string, 
    approvedAmount?: string
  ) => Promise<void>;
  resubmitApplicationRequirements: (
    appId: string, 
    documents: UploadedDocument[], 
    note?: string
  ) => Promise<{ success: boolean; message?: string; application?: AssistanceApplication }>;
  deleteApplication: (appIdOrRef: string) => Promise<boolean>;
  deleteApplications: (appIds: string[]) => Promise<{ success: boolean; deletedCount?: number; message?: string }>;

  // Programs, Announcements & Targeted Releases
  addProgram: (data: Omit<AssistanceProgram, 'id'>) => Promise<{ success: boolean; program?: AssistanceProgram; message?: string }>;
  updateProgram: (programId: string, updates: Partial<AssistanceProgram>) => Promise<{ success: boolean; program?: AssistanceProgram; message?: string }>;
  deleteProgram: (programId: string) => Promise<{ success: boolean; message?: string }>;
  deletePrograms: (programIds: string[]) => Promise<{ success: boolean; deletedCount?: number; message?: string }>;
  addAnnouncement: (
    data: Omit<AnnouncementItem, 'id' | 'viewsCount'>
  ) => Promise<{ success: boolean; announcement?: AnnouncementItem; message?: string }>;
  updateAnnouncement: (
    id: string,
    updates: Partial<AnnouncementItem>
  ) => Promise<{ success: boolean; announcement?: AnnouncementItem; message?: string }>;
  secretariatDetails: SecretariatDetails;
  updateSecretariatDetails: (payload: {
    lguUnit: string;
    punongBarangay: string;
    currentPassword?: string;
    verificationToken?: string;
  }) => Promise<{ success: boolean; message: string; secretariatDetails?: SecretariatDetails }>;
  deleteAnnouncement: (id: string) => Promise<{ success: boolean; message?: string }>;
  broadcastProgramQualificationAlerts: (
    programId: string,
    programTitle: string,
    targetResidentId?: string
  ) => Promise<{
    success: boolean;
    count: number;
    alreadyNotifiedCount: number;
    qualifiedTotal: number;
    recipients: string[];
    alreadyNotifiedRecipients: string[];
  }>;
  notifyAllQualifiedUsers: (
    programId?: string,
    residentIds?: string[]
  ) => Promise<{
    success: boolean;
    sentCount: number;
    residentsNotifiedCount: number;
    alreadyNotifiedCount: number;
    message?: string;
  }>;
  // Notification Operations
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAllNotifications: (userId?: string) => void;
  addNotification: (
    title: string, 
    message: string, 
    userId?: string, 
    type?: NotificationItem['type'], 
    applicationRef?: string,
    targetArea?: NotificationItem['targetArea'],
    documentData?: NotificationDocumentData
  ) => void;

  // Selection state for viewing/editing
  selectedApplicationForReview: AssistanceApplication | null;
  setSelectedApplicationForReview: (app: AssistanceApplication | null) => void;
  pendingApplyProgram: AssistanceProgram | null;
  openProgramApplication: (program: AssistanceProgram | null) => void;

  // Community Census (Realistic & Adjustable)
  censusData: CensusData;
  updateCensusData: (updated: Partial<CensusData>) => void;
  resetCensusToBenchmark: () => void;

  // Disaster Victim Records
  addDisasterVictim: (data: Partial<DisasterVictimRecord>) => Promise<{ success: boolean; victim?: DisasterVictimRecord; message?: string }>;
  updateDisasterVictim: (id: string, updates: Partial<DisasterVictimRecord>) => Promise<{ success: boolean; victim?: DisasterVictimRecord; message?: string }>;
  deleteDisasterVictim: (id: string) => Promise<{ success: boolean; message?: string }>;

  // Bugo Disaster Hazard Map Zones & Summary Info
  addHazardZone: (data: Omit<BugoHazardZone, 'id' | 'updatedAt'>) => Promise<{ success: boolean; zone?: BugoHazardZone; message?: string }>;
  updateHazardZone: (id: string, updates: Partial<BugoHazardZone>) => Promise<{ success: boolean; zone?: BugoHazardZone; message?: string }>;
  deleteHazardZone: (id: string) => Promise<{ success: boolean; message?: string }>;
  updateHazardSummaryItem: <K extends HazardSummaryCategory>(
    category: K,
    id: string,
    updates: Partial<HazardSummariesData[K][number]>
  ) => Promise<{ success: boolean; message?: string }>;

  // Ranking Classification (Priority 1 Critical - 5 No Damage)
  upsertRankingClassification: (residentId: string, priority: RankingPriorityLevel) => Promise<{ success: boolean; message?: string }>;
  bulkUpsertRankingClassifications: (params: {
    residentIds?: string[];
    zone?: string;
    selectAll?: boolean;
    priority: RankingPriorityLevel;
  }) => Promise<{ success: boolean; updatedCount?: number; message?: string }>;
  updateRankingClassification: (id: string, priority: RankingPriorityLevel) => Promise<{ success: boolean; message?: string }>;
  deleteRankingClassification: (id: string) => Promise<{ success: boolean; message?: string }>;
  bulkDeleteRankingClassifications: (ids: string[]) => Promise<{ success: boolean; deletedCount?: number; message?: string }>;

  // Admin Import / Export
  downloadExportedRecords: (type: 'all' | 'victims' | 'hazards' | 'applications' | 'programs', format: 'json' | 'csv', programId?: string) => Promise<{ success: boolean; message?: string }>;
  importRecords: (recordType: 'victims' | 'hazards' | 'programs', mode: 'merge' | 'replace', records: any[], programId?: string) => Promise<{ success: boolean; importedCount?: number; message?: string }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Inactivity threshold: 15 minutes (in ms)
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

const ADMIN_TAB_STORAGE_KEY = 'bugo_admin_tab';
const RESIDENT_TAB_STORAGE_KEY = 'bugo_resident_tab';
const VALID_ADMIN_TABS: AdminTabType[] = ['dashboard', 'residents', 'programs', 'status-tracking', 'disaster-aid', 'hazard-map', 'records-io', 'announcements', 'archives', 'help', 'settings'];
const VALID_RESIDENT_TABS: ResidentTabType[] = ['dashboard', 'services', 'hazard-map', 'announcements', 'settings', 'help', 'profile'];

const isPlainEqual = (a: any, b: any): boolean => {
  if (Object.is(a, b)) return true;
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!isPlainEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const keysA = Object.keys(a).filter(k => a[k] !== undefined);
  const keysB = Object.keys(b).filter(k => b[k] !== undefined);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, k) || !isPlainEqual(a[k], b[k])) return false;
  }
  return true;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation & Role State
  const [role, setRole] = useState<UserRole>('guest');
  const [authView, setAuthView] = useState<AuthViewType>('welcome');
  const [prefilledLoginEmail, setPrefilledLoginEmail] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<ResidentUser | null>(null);

  const [adminTab, setAdminTabState] = useState<AdminTabType>(() => {
    try {
      const saved = sessionStorage.getItem(ADMIN_TAB_STORAGE_KEY) as AdminTabType | null;
      if (saved && VALID_ADMIN_TABS.includes(saved)) return saved;
    } catch {}
    return 'dashboard';
  });
  const [residentTab, setResidentTabState] = useState<ResidentTabType>(() => {
    try {
      const saved = sessionStorage.getItem(RESIDENT_TAB_STORAGE_KEY) as ResidentTabType | null;
      if (saved && VALID_RESIDENT_TABS.includes(saved)) return saved;
    } catch {}
    return 'dashboard';
  });

  const setAdminTab = (tab: AdminTabType) => {
    setAdminTabState(tab);
    try {
      sessionStorage.setItem(ADMIN_TAB_STORAGE_KEY, tab);
    } catch {}
  };

  const setResidentTab = (tab: ResidentTabType) => {
    setResidentTabState(tab);
    try {
      sessionStorage.setItem(RESIDENT_TAB_STORAGE_KEY, tab);
    } catch {}
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSessionTimedOut, setIsSessionTimedOut] = useState(false);

  // Core Data
  const [programs, setPrograms] = useState<AssistanceProgram[]>(() => sortProgramsAlphabetically(INITIAL_PROGRAMS));
  const [applications, setApplications] = useState<AssistanceApplication[]>(() => sortApplicationsFCFS(INITIAL_APPLICATIONS));
  const [residentsList, setResidentsList] = useState<ResidentUser[]>(INITIAL_RESIDENT_RECORDS);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>(INITIAL_ACTIVITY_LOGS);
  const [archivedItems, setArchivedItems] = useState<ArchiveItem[]>(INITIAL_ARCHIVED_ITEMS);
  const [disasterVictims, setDisasterVictims] = useState<DisasterVictimRecord[]>([]);
  const [hazardZones, setHazardZones] = useState<BugoHazardZone[]>(DEFAULT_BUGO_HAZARD_ZONES);
  const [hazardSummaries, setHazardSummaries] = useState<HazardSummariesData>(createDefaultHazardSummaries);
  const [rankingClassifications, setRankingClassifications] = useState<RankingClassificationEntry[]>([]);
  const [secretariatDetails, setSecretariatDetails] = useState<SecretariatDetails>({
    lguUnit: 'Barangay Bugo, Cagayan de Oro City',
    punongBarangay: 'Hon. Juan Dela Cruz',
  });

  const [selectedApplicationForReview, setSelectedApplicationForReview] = useState<AssistanceApplication | null>(null);
  const [pendingApplyProgram, setPendingApplyProgram] = useState<AssistanceProgram | null>(null);
  const openProgramApplication = (program: AssistanceProgram | null) => {
    if (program) {
      setResidentTab(isBarangayServiceApplicationItem(program) ? 'services' : 'dashboard');
    }
    setPendingApplyProgram(program);
  };
  const [selectedZoneForRegistry, setSelectedZoneForRegistry] = useState<string | null>(null);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [accountStatusAlert, setAccountStatusAlert] = useState<string | null>(null);

  const dismissAccountStatusAlert = () => setAccountStatusAlert(null);

  const currentUserRef = useRef<ResidentUser | null>(currentUser);
  const roleRef = useRef<UserRole>(role);
  const syncInFlightRef = useRef(false);
  const activeMutationsRef = useRef(0);
  const mutationEpochRef = useRef(0);
  const pendingSyncQueuedRef = useRef(false);

  const residentsListRef = useRef<ResidentUser[]>(residentsList);
  const programsRef = useRef<AssistanceProgram[]>(programs);
  const applicationsRef = useRef<AssistanceApplication[]>(applications);
  const announcementsRef = useRef<AnnouncementItem[]>(announcements);
  const activityLogsRef = useRef<ActivityLogItem[]>(activityLogs);
  const archivedItemsRef = useRef<ArchiveItem[]>(archivedItems);
  const notificationsRef = useRef<NotificationItem[]>(notifications);
  const disasterVictimsRef = useRef<DisasterVictimRecord[]>(disasterVictims);
  const hazardZonesRef = useRef<BugoHazardZone[]>(hazardZones);
  const hazardSummariesRef = useRef<HazardSummariesData>(hazardSummaries);
  const rankingClassificationsRef = useRef<RankingClassificationEntry[]>(rankingClassifications);
  const secretariatDetailsRef = useRef<SecretariatDetails>(secretariatDetails);
  const selectedAppForReviewRef = useRef<AssistanceApplication | null>(selectedApplicationForReview);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  useEffect(() => { residentsListRef.current = residentsList; }, [residentsList]);
  useEffect(() => { programsRef.current = programs; }, [programs]);
  useEffect(() => { applicationsRef.current = applications; }, [applications]);
  useEffect(() => { announcementsRef.current = announcements; }, [announcements]);
  useEffect(() => { activityLogsRef.current = activityLogs; }, [activityLogs]);
  useEffect(() => { archivedItemsRef.current = archivedItems; }, [archivedItems]);
  useEffect(() => { notificationsRef.current = notifications; }, [notifications]);
  useEffect(() => { disasterVictimsRef.current = disasterVictims; }, [disasterVictims]);
  useEffect(() => { hazardZonesRef.current = hazardZones; }, [hazardZones]);
  useEffect(() => { hazardSummariesRef.current = hazardSummaries; }, [hazardSummaries]);
  useEffect(() => { rankingClassificationsRef.current = rankingClassifications; }, [rankingClassifications]);
  useEffect(() => { secretariatDetailsRef.current = secretariatDetails; }, [secretariatDetails]);
  useEffect(() => { selectedAppForReviewRef.current = selectedApplicationForReview; }, [selectedApplicationForReview]);

  const AUTH_TOKEN_STORAGE_KEY = 'bugo_auth_token';
  const authTokenRef = useRef<string | null>((() => {
    try {
      return sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  })());

  const setStoredAuthToken = (token: string | null) => {
    authTokenRef.current = token;
    try {
      if (token) {
        sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
      } else {
        sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      }
    } catch {}
  };

  const getAuthHeaders = (extra?: Record<string, string>): Record<string, string> => {
    const headers: Record<string, string> = { ...(extra || {}) };
    if (authTokenRef.current) {
      headers.Authorization = `Bearer ${authTokenRef.current}`;
    }
    return headers;
  };

  // Helper to safely retrieve user-chosen avatar across sessions
  const getSavedAvatarForUser = (email?: string, id?: string): string | null => {
    try {
      if (email) {
        const byEmail = localStorage.getItem(`bugo_avatar_${email.toLowerCase().trim()}`);
        if (byEmail) return byEmail;
      }
      if (id) {
        const byId = localStorage.getItem(`bugo_avatar_${id}`);
        if (byId) return byId;
      }
    } catch {}
    return null;
  };

  // Realistic & Adjustable Community Census Data State
  const [censusData, setCensusData] = useState<CensusData>(() => {
    try {
      const saved = localStorage.getItem('bugo_census_data');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_BUGO_CENSUS;
  });
  const censusDataRef = useRef<CensusData>(censusData);
  useEffect(() => { censusDataRef.current = censusData; }, [censusData]);

  const runTrackedMutation = async <T,>(fn: () => Promise<T>): Promise<T> => {
    activeMutationsRef.current += 1;
    mutationEpochRef.current += 1;
    try {
      return await fn();
    } finally {
      mutationEpochRef.current += 1;
      activeMutationsRef.current = Math.max(0, activeMutationsRef.current - 1);
      if (activeMutationsRef.current === 0 && pendingSyncQueuedRef.current) {
        pendingSyncQueuedRef.current = false;
        setTimeout(() => {
          void syncFromServer();
        }, 80);
      }
    }
  };

  const updateCensusData = (updated: Partial<CensusData>) => {
    const next: CensusData = {
      ...censusDataRef.current,
      ...updated,
      lastUpdated: new Date().toISOString().split('T')[0]
    };
    censusDataRef.current = next;
    setCensusData(next);
    try {
      localStorage.setItem('bugo_census_data', JSON.stringify(next));
    } catch {}
    void runTrackedMutation(async () => {
      try {
        const res = await fetch('/api/census', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ census: next })
        });
        if (res.ok) {
          const json = await res.json().catch(() => null);
          if (json?.census) {
            censusDataRef.current = json.census;
            setCensusData(json.census);
            try {
              localStorage.setItem('bugo_census_data', JSON.stringify(json.census));
            } catch {}
          }
        }
      } catch {}
    });
  };

  const resetCensusToBenchmark = () => {
    censusDataRef.current = DEFAULT_BUGO_CENSUS;
    setCensusData(DEFAULT_BUGO_CENSUS);
    try {
      localStorage.setItem('bugo_census_data', JSON.stringify(DEFAULT_BUGO_CENSUS));
    } catch {}
    void runTrackedMutation(async () => {
      try {
        const res = await fetch('/api/census', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ census: DEFAULT_BUGO_CENSUS })
        });
        if (res.ok) {
          const json = await res.json().catch(() => null);
          if (json?.census) {
            censusDataRef.current = json.census;
            setCensusData(json.census);
            try {
              localStorage.setItem('bugo_census_data', JSON.stringify(json.census));
            } catch {}
          }
        }
      } catch {}
    });
  };

  // Inactivity tracking
  const lastActiveRef = useRef<number>(Date.now());

  // ----------------------------------------------------
  // Sync with Persistent Express Database + Real-Time SSE
  // ----------------------------------------------------
  const prependUniqueNotification = (notif: NotificationItem | null | undefined) => {
    if (!notif || !notif.id) return;
    setNotifications(prev => {
      if (prev.some(n => n.id === notif.id)) return prev;
      return [notif, ...prev];
    });
  };

  const prependArchivedItems = (items: Array<ArchiveItem | null | undefined> | null | undefined) => {
    if (!Array.isArray(items) || items.length === 0) return;
    const valid = items.filter((item): item is ArchiveItem => Boolean(item && item.id));
    if (valid.length === 0) return;
    setArchivedItems(prev => {
      const existingIds = new Set(prev.map(a => a.id));
      const toAdd = valid.filter(item => !existingIds.has(item.id));
      return toAdd.length > 0 ? [...toAdd, ...prev] : prev;
    });
  };

  const syncFromServer = async () => {
    if (activeMutationsRef.current > 0) {
      pendingSyncQueuedRef.current = true;
      return;
    }
    if (syncInFlightRef.current) {
      pendingSyncQueuedRef.current = true;
      return;
    }
    syncInFlightRef.current = true;
    const startEpoch = mutationEpochRef.current;

    const isSyncStale = () =>
      activeMutationsRef.current > 0 || mutationEpochRef.current !== startEpoch;

    try {
      const res = await fetch('/api/data', { cache: 'no-store' });
      if (!res.ok || isSyncStale()) {
        if (isSyncStale()) pendingSyncQueuedRef.current = true;
        return;
      }
      const data = await res.json();
      if (!data || isSyncStale()) {
        if (isSyncStale()) pendingSyncQueuedRef.current = true;
        return;
      }

      let mergedUsers: ResidentUser[] = [];
      if (Array.isArray(data.users) && data.users.length > 0) {
        mergedUsers = data.users.map((u: ResidentUser) => {
          const savedAvatar = getSavedAvatarForUser(u.email, u.id);
          return savedAvatar ? { ...u, avatarUrl: savedAvatar } : u;
        });
        if (!isPlainEqual(residentsListRef.current, mergedUsers)) {
          residentsListRef.current = mergedUsers;
          setResidentsList(mergedUsers);
        }
      }
      if (Array.isArray(data.programs)) {
        const nextPrograms = sortProgramsAlphabetically(data.programs);
        if (!isPlainEqual(programsRef.current, nextPrograms)) {
          programsRef.current = nextPrograms;
          setPrograms(nextPrograms);
        }
      }
      if (Array.isArray(data.applications)) {
        const sortedApps = sortApplicationsFCFS(data.applications);
        if (!isPlainEqual(applicationsRef.current, sortedApps)) {
          applicationsRef.current = sortedApps;
          setApplications(sortedApps);
        }
        const prevSelected = selectedAppForReviewRef.current;
        if (prevSelected) {
          const matchedSelected = sortedApps.find((a: AssistanceApplication) => a.id === prevSelected.id) || null;
          if (!isPlainEqual(prevSelected, matchedSelected)) {
            selectedAppForReviewRef.current = matchedSelected;
            setSelectedApplicationForReview(matchedSelected);
          }
        }
      }
      if (Array.isArray(data.announcements) && !isPlainEqual(announcementsRef.current, data.announcements)) {
        announcementsRef.current = data.announcements;
        setAnnouncements(data.announcements);
      }
      if (Array.isArray(data.activityLogs) && !isPlainEqual(activityLogsRef.current, data.activityLogs)) {
        activityLogsRef.current = data.activityLogs;
        setActivityLogs(data.activityLogs);
      }
      if (Array.isArray(data.archivedItems) && !isPlainEqual(archivedItemsRef.current, data.archivedItems)) {
        archivedItemsRef.current = data.archivedItems;
        setArchivedItems(data.archivedItems);
      }
      if (Array.isArray(data.notifications) && !isPlainEqual(notificationsRef.current, data.notifications)) {
        notificationsRef.current = data.notifications;
        setNotifications(data.notifications);
      }
      if (Array.isArray(data.disasterVictims) && !isPlainEqual(disasterVictimsRef.current, data.disasterVictims)) {
        disasterVictimsRef.current = data.disasterVictims;
        setDisasterVictims(data.disasterVictims);
      }
      if (Array.isArray(data.hazardZones) && !isPlainEqual(hazardZonesRef.current, data.hazardZones)) {
        hazardZonesRef.current = data.hazardZones;
        setHazardZones(data.hazardZones);
      }
      if (data.hazardSummaries && typeof data.hazardSummaries === 'object' && !isPlainEqual(hazardSummariesRef.current, data.hazardSummaries)) {
        hazardSummariesRef.current = data.hazardSummaries;
        setHazardSummaries(data.hazardSummaries);
      }
      if (Array.isArray(data.rankingClassifications)) {
        const nextRankings = sortRankingClassifications(data.rankingClassifications);
        if (!isPlainEqual(rankingClassificationsRef.current, nextRankings)) {
          rankingClassificationsRef.current = nextRankings;
          setRankingClassifications(nextRankings);
        }
      }
      if (data.census && !isPlainEqual(censusDataRef.current, data.census)) {
        censusDataRef.current = data.census;
        setCensusData(data.census);
        try {
          localStorage.setItem('bugo_census_data', JSON.stringify(data.census));
        } catch {}
      }
      if (data.secretariatDetails) {
        const nextSecretariat: SecretariatDetails = {
          lguUnit: String(data.secretariatDetails.lguUnit || 'Barangay Bugo, Cagayan de Oro City'),
          punongBarangay: String(data.secretariatDetails.punongBarangay || 'Hon. Juan Dela Cruz'),
          updatedAt: data.secretariatDetails.updatedAt,
          updatedBy: data.secretariatDetails.updatedBy,
        };
        if (!isPlainEqual(secretariatDetailsRef.current, nextSecretariat)) {
          secretariatDetailsRef.current = nextSecretariat;
          setSecretariatDetails(nextSecretariat);
        }
      }

      const activeToken = authTokenRef.current;
      const activeUser = currentUserRef.current;
      const activeRole = roleRef.current;

      const forceTerminateSession = (reasonMessage: string) => {
        setStoredAuthToken(null);
        roleRef.current = 'guest';
        currentUserRef.current = null;
        setRole('guest');
        setAuthView('login');
        setCurrentUser(null);
        setSelectedApplicationForReview(null);
        setAccountStatusAlert(reasonMessage);
      };

      if (activeToken) {
        try {
          const meRes = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${activeToken}` },
            cache: 'no-store'
          });
          if (isSyncStale()) {
            pendingSyncQueuedRef.current = true;
            return;
          }
          if (meRes.ok) {
            const meData = await meRes.json();
            if (isSyncStale()) {
              pendingSyncQueuedRef.current = true;
              return;
            }
            if (meData?.success && meData.user) {
              const freshUser: ResidentUser = { ...meData.user };
              const savedAvatar = getSavedAvatarForUser(freshUser.email, freshUser.id);
              if (savedAvatar) freshUser.avatarUrl = savedAvatar;
              if (!isPlainEqual(currentUserRef.current, freshUser)) {
                currentUserRef.current = freshUser;
                setCurrentUser(freshUser);
              }
              if (roleRef.current !== freshUser.role) {
                roleRef.current = freshUser.role;
                setRole(freshUser.role);
              }
              if (!activeUser) {
                lastActiveRef.current = Date.now();
              }
            }
          } else if (meRes.status === 401 || meRes.status === 403 || meRes.status === 404) {
            const errJson = await meRes.json().catch(() => null);
            if (activeRole !== 'guest' || activeUser) {
              forceTerminateSession(
                errJson?.message ||
                  (meRes.status === 403
                    ? 'Your resident account has been banned or suspended by an administrator.'
                    : 'Your account session ended because the account was updated or removed by an administrator.')
              );
            } else {
              setStoredAuthToken(null);
            }
          }
        } catch {
          // Ignore transient network errors during reload/poll
        }
      } else if (activeRole !== 'guest' && activeUser && mergedUsers.length > 0) {
        const matched = mergedUsers.find(
          u => u.id === activeUser.id || u.email.toLowerCase() === activeUser.email.toLowerCase()
        );
        if (!matched) {
          forceTerminateSession('Your resident account was removed from the Barangay Bugo registry by an administrator.');
        } else if (matched.isBanned || matched.registrationStatus === 'Banned') {
          forceTerminateSession(`Account is banned: ${matched.banReason || 'Administrative policy violation.'}`);
        } else {
          const freshUser = { ...matched };
          const savedAvatar = getSavedAvatarForUser(freshUser.email, freshUser.id);
          if (savedAvatar) freshUser.avatarUrl = savedAvatar;
          if (!isPlainEqual(currentUserRef.current, freshUser)) {
            currentUserRef.current = freshUser;
            setCurrentUser(freshUser);
          }
        }
      }
    } catch {
      // Standalone fallback: in-memory mock data already active
    } finally {
      syncInFlightRef.current = false;
      if (pendingSyncQueuedRef.current && activeMutationsRef.current === 0) {
        pendingSyncQueuedRef.current = false;
        setTimeout(() => {
          void syncFromServer();
        }, 80);
      }
    }
  };

  useEffect(() => {
    void syncFromServer();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleSync = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void syncFromServer();
      }, 250);
    };

    let eventSource: EventSource | null = null;
    if (typeof window !== 'undefined' && 'EventSource' in window) {
      try {
        eventSource = new EventSource('/api/events');
        eventSource.addEventListener('system_update', scheduleSync);
      } catch {
        // Ignore if SSE fails to initialize
      }
    }

    let wasHidden = document.visibilityState === 'hidden';
    let lastVisibilitySyncAt = 0;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        wasHidden = true;
        return;
      }
      if (document.visibilityState === 'visible' && wasHidden) {
        wasHidden = false;
        const now = Date.now();
        if (now - lastVisibilitySyncAt > 2000) {
          lastVisibilitySyncAt = now;
          scheduleSync();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (eventSource) eventSource.close();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // ----------------------------------------------------
  // Inactivity Session Timeout Monitor (15 mins idle)
  // ----------------------------------------------------
  useEffect(() => {
    const recordUserActivity = () => {
      lastActiveRef.current = Date.now();
    };

    window.addEventListener('mousemove', recordUserActivity, { passive: true });
    window.addEventListener('keydown', recordUserActivity, { passive: true });
    window.addEventListener('click', recordUserActivity, { passive: true });
    window.addEventListener('touchstart', recordUserActivity, { passive: true });

    const interval = setInterval(() => {
      if (role !== 'guest' && currentUser) {
        const idleDuration = Date.now() - lastActiveRef.current;
        if (idleDuration >= INACTIVITY_TIMEOUT_MS) {
          // Trigger automatic secure logout
          setStoredAuthToken(null);
          setRole('guest');
          setCurrentUser(null);
          setAuthView('login');
          setIsSessionTimedOut(true);
        }
      }
    }, 15000); // Check every 15s

    return () => {
      window.removeEventListener('mousemove', recordUserActivity);
      window.removeEventListener('keydown', recordUserActivity);
      window.removeEventListener('click', recordUserActivity);
      window.removeEventListener('touchstart', recordUserActivity);
      clearInterval(interval);
    };
  }, [role, currentUser]);

  const dismissSessionTimeout = () => {
    setIsSessionTimedOut(false);
  };

  const formatExactNotificationDate = (d = new Date()): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${month} ${day}, ${year} • ${hours}:${minutes} ${ampm}`;
  };

  const addNotification = (
    title: string, 
    message: string, 
    userId: string = 'all', 
    type: NotificationItem['type'] = 'status_update', 
    applicationRef?: string,
    targetArea?: NotificationItem['targetArea'],
    documentData?: NotificationDocumentData
  ) => {
    // Non-repetitive check: do not insert duplicate notification if already exists
    setNotifications(prev => {
      const isDuplicate = prev.some(n => 
        (userId === 'all' || n.userId === userId) && 
        n.title === title && 
        n.message === message
      );
      if (isDuplicate) return prev;

      const exactTime = formatExactNotificationDate();
      const newNotif: NotificationItem = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        userId,
        title,
        message,
        timestamp: exactTime,
        createdAt: new Date().toISOString(),
        read: false,
        type,
        applicationRef,
        targetArea,
        documentData
      };
      return [newNotif, ...prev];
    });
  };

  // Log activity
  const logActivity = (entry: Omit<ActivityLogItem, 'id' | 'timestamp'>) => {
    const now = new Date();
    const formatted = `${now.toISOString().split('T')[0]} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const tempId = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newLog: ActivityLogItem = {
      ...entry,
      id: tempId,
      timestamp: formatted
    };
    setActivityLogs(prev => [newLog, ...prev]);

    void runTrackedMutation(async () => {
      try {
        const res = await fetch('/api/logs', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(entry)
        });
        if (res.ok) {
          const json = await res.json().catch(() => null);
          if (json?.log?.id) {
            setActivityLogs(prev => prev.map(l => (l.id === tempId ? json.log : l)));
          }
        }
      } catch {}
    });
  };

  // Archive a record
  const archiveRecord = (item: Omit<ArchiveItem, 'id' | 'deletedAt' | 'status'>) => {
    const now = new Date();
    const formatted = `${now.toISOString().split('T')[0]} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const tempId = `arch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newArch: ArchiveItem = {
      ...item,
      id: tempId,
      deletedAt: formatted,
      status: 'Archived'
    };
    setArchivedItems(prev => [newArch, ...prev]);

    void runTrackedMutation(async () => {
      try {
        const res = await fetch('/api/archives', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(item)
        });
        if (res.ok) {
          const json = await res.json().catch(() => null);
          if (json?.item?.id) {
            setArchivedItems(prev => prev.map(a => (a.id === tempId ? json.item : a)));
          }
        } else {
          setArchivedItems(prev => prev.filter(a => a.id !== tempId));
        }
      } catch {}
    });

    logActivity({
      residentName: item.deletedBy || 'Admin Juan Dela Cruz',
      residentIdNumber: 'BG-ADMIN-001',
      purok: 'Administrative Office',
      actionType: 'Status Updated',
      locationOrService: 'Archives & Records Unit',
      officerInCharge: item.deletedBy || 'Admin Secretary',
      status: 'Completed',
      details: `Archived record "${item.title}" (${item.originalCategory}).`
    });
  };

  const restoreArchivedItem = async (id: string): Promise<{ success: boolean; message?: string }> => {
    const item = archivedItems.find(a => a.id === id);
    if (!item) return { success: false, message: 'Archived item not found.' };

    setArchivedItems(prev => prev.filter(a => a.id !== id));
    const result = await runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/archives/${encodeURIComponent(id)}?restore=true`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || (json && json.success === false)) {
          setArchivedItems(prev => (prev.some(a => a.id === id) ? prev : [item, ...prev]));
          return { success: false, message: json?.message || 'Failed to restore archived record.' };
        }
        return { success: true };
      } catch {
        setArchivedItems(prev => (prev.some(a => a.id === id) ? prev : [item, ...prev]));
        return { success: false, message: 'Network error while restoring archived record.' };
      }
    });
    if (result.success) {
      await syncFromServer();
    }
    return result;
  };

  const deleteArchivedItemPermanently = (id: string) => {
    const targetItem = archivedItemsRef.current.find(a => a.id === id);
    setArchivedItems(prev => prev.filter(a => a.id !== id));
    void runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/archives/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        if (!res.ok && targetItem) {
          setArchivedItems(prev => (prev.some(a => a.id === id) ? prev : [targetItem, ...prev]));
        }
      } catch {
        if (targetItem) {
          setArchivedItems(prev => (prev.some(a => a.id === id) ? prev : [targetItem, ...prev]));
        }
      }
    });
  };

  const submitProfileChangeRequest = async (
    changes: Partial<EditableResidentProfileFields>
  ): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) {
      return { success: false, message: 'You must be signed in.' };
    }

    const diffEntries = (Object.entries(changes) as Array<[keyof EditableResidentProfileFields, any]>).filter(
      ([key, val]) => val !== undefined && val !== (currentUser as any)[key]
    );
    if (diffEntries.length === 0) {
      return { success: false, message: 'No changes detected.' };
    }

    const filteredChanges = Object.fromEntries(diffEntries) as Partial<EditableResidentProfileFields>;
    const pendingRequest: ProfileChangeRequest = {
      requestedAt: formatExactNotificationDate(),
      status: 'Pending',
      changes: filteredChanges
    };

    return runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/residents/${currentUser.id}/profile-change-request`, {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ changes: filteredChanges })
        });
        const data = await res.json();
        if (res.ok && data.success && data.user) {
          const updatedUser = { ...currentUser, ...data.user };
          currentUserRef.current = updatedUser;
          setCurrentUser(updatedUser);
          setResidentsList(prev => prev.map(r => r.id === currentUser.id ? { ...r, ...data.user } : r));
          return { success: true, message: data.message || 'Submitted for admin approval.' };
        }
        return { success: false, message: data.message || 'Could not submit profile changes.' };
      } catch {
        return { success: false, message: 'Network error while submitting profile changes.' };
      }
    });
  };

  const cancelProfileChangeRequest = async (): Promise<void> => {
    if (!currentUser) return;
    setCurrentUser(prev => {
      if (!prev) return null;
      const copy = { ...prev };
      delete copy.pendingProfileUpdate;
      currentUserRef.current = copy;
      return copy;
    });
    setResidentsList(prev => prev.map(r => {
      if (r.id !== currentUser.id) return r;
      const copy = { ...r };
      delete copy.pendingProfileUpdate;
      return copy;
    }));
    await runTrackedMutation(async () => {
      try {
        await fetch(`/api/residents/${currentUser.id}/profile-change-request`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
      } catch {}
    });
  };

  const reviewProfileChangeRequest = async (
    residentId: string,
    decision: 'approve' | 'reject',
    rejectionReason?: string
  ): Promise<{ success: boolean; message: string }> => {
    // Strictly only Admin can approve or reject profile changes
    if (role !== 'admin' || currentUser?.role !== 'admin') {
      return { success: false, message: 'Only administrators can approve profile changes.' };
    }

    const target = residentsList.find(r => r.id === residentId);
    if (!target || !target.pendingProfileUpdate || target.pendingProfileUpdate.status !== 'Pending') {
      return { success: false, message: 'No pending profile changes found.' };
    }

    return runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/residents/${residentId}/profile-change-decision`, {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            adminId: currentUser.id,
            decision,
            rejectionReason
          })
        });
        const data = await res.json();
        if (res.ok && data.success && data.user) {
          setResidentsList(prev => prev.map(r => r.id === residentId ? { ...r, ...data.user, pendingProfileUpdate: data.user.pendingProfileUpdate } : r));
          if (currentUser.id === residentId) {
            currentUserRef.current = data.user;
            setCurrentUser(data.user);
          }
          if (Array.isArray(data.applications)) setApplications(sortApplicationsFCFS(data.applications));
          if (Array.isArray(data.disasterVictims)) setDisasterVictims(data.disasterVictims);
          prependUniqueNotification(data.notification);
          return { success: true, message: data.message };
        }
        return { success: false, message: data.message || 'Action failed.' };
      } catch {
        return { success: false, message: 'Network error while reviewing profile change request.' };
      }
    });
  };

  const updateUserProfile = (updates: Partial<ResidentUser>) => {
    if (!currentUser) return;

    const { avatarUrl, ...otherUpdates } = updates;

    // Avatar updates apply directly across sessions
    if (avatarUrl !== undefined) {
      setCurrentUser(prev => {
        const next = prev ? { ...prev, avatarUrl } : null;
        currentUserRef.current = next;
        return next;
      });
      setResidentsList(prev => prev.map(r => r.id === currentUser.id ? { ...r, avatarUrl } : r));
      try {
        if (currentUser.email) {
          localStorage.setItem(`bugo_avatar_${currentUser.email.toLowerCase().trim()}`, avatarUrl);
        }
        localStorage.setItem(`bugo_avatar_${currentUser.id}`, avatarUrl);
      } catch {}
      void runTrackedMutation(async () => {
        try {
          await fetch(`/api/residents/${currentUser.id}`, {
            method: 'PATCH',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ avatarUrl })
          });
        } catch {}
      });
    }

    // Non-avatar profile info updates by residents MUST go through Admin approval
    if (Object.keys(otherUpdates).length > 0) {
      if (currentUser.role !== 'admin') {
        void submitProfileChangeRequest(otherUpdates as Partial<EditableResidentProfileFields>);
        return;
      }

      setCurrentUser(prev => {
        const next = prev ? { ...prev, ...otherUpdates } : null;
        currentUserRef.current = next;
        return next;
      });
      setResidentsList(prev => prev.map(r => r.id === currentUser.id ? { ...r, ...otherUpdates } : r));
      void runTrackedMutation(async () => {
        try {
          await fetch(`/api/residents/${currentUser.id}`, {
            method: 'PATCH',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ adminId: currentUser.id, ...otherUpdates })
          });
        } catch {}
      });
    }
  };

  const verifyCurrentPassword = async (currentPassword: string): Promise<{ success: boolean; message: string; verificationToken?: string }> => {
    if (!currentUser) {
      return { success: false, message: 'You must be signed in to verify password.' };
    }
    try {
      const response = await fetch('/api/auth/verify-current-password', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          userId: currentUser.id,
          email: currentUser.email,
          currentPassword
        })
      });
      const data = await response.json();
      return data;
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error while verifying current password.' };
    }
  };

  const changePassword = async (
    optionsOrCurrentPassword: { currentPassword?: string; verificationToken?: string; newPassword: string } | string,
    maybeNewPassword?: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) {
      return { success: false, message: 'You must be signed in to change your password.' };
    }

    let payload: any;
    if (typeof optionsOrCurrentPassword === 'object') {
      payload = {
        userId: currentUser.id,
        email: currentUser.email,
        ...optionsOrCurrentPassword
      };
    } else {
      payload = {
        userId: currentUser.id,
        email: currentUser.email,
        currentPassword: optionsOrCurrentPassword,
        newPassword: maybeNewPassword
      };
    }

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        return {
          success: false,
          message: data.message || 'Failed to update password. Please check your verification credentials.'
        };
      }

      // Update current session user password
      if (payload.newPassword) {
        setCurrentUser(prev => prev ? { ...prev, password: payload.newPassword } : null);
      }

      // Add alert notification to resident/admin
      addNotification(
        'Security Password Updated',
        'Your account credentials have been changed successfully. Use your new strong password for subsequent logins.',
        currentUser.id,
        'system_alert',
        undefined,
        'settings'
      );

      return {
        success: true,
        message: data.message || 'Password updated successfully!'
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Network error while attempting to change password.'
      };
    }
  };

  const loginAsGuest = () => {
    setAuthView('guest');
  };

  // Auth: Real Backend Authentication with Rate Limiting & PBKDF2 Password Hashing
  const loginWithCredentials = async (email: string, pass: string): Promise<{ success: boolean; message?: string }> => {
    const cleanEmail = normalizeAccountEmail(email);

    if (!isAllowedAccountEmail(cleanEmail)) {
      return {
        success: false,
        message: ALLOWED_EMAIL_DOMAIN_MESSAGE
      };
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: pass })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          message: data.message || 'Invalid email or password.'
        };
      }

      // Successful server-side authentication with JWT token
      if (data.token || data.sessionToken) {
        setStoredAuthToken(data.token || data.sessionToken);
      }
      const user: ResidentUser = data.user;
      const savedAvatar = getSavedAvatarForUser(user.email, user.id);
      if (savedAvatar) {
        user.avatarUrl = savedAvatar;
      }
      currentUserRef.current = user;
      roleRef.current = user.role;
      setAccountStatusAlert(null);
      setCurrentUser(user);
      setRole(user.role);
      lastActiveRef.current = Date.now();
      setIsSessionTimedOut(false);

      if (user.role === 'admin') {
        setAdminTab('dashboard');
      } else {
        setResidentTab('dashboard');
      }

      void syncFromServer();
      return { success: true };
    } catch {
      return {
        success: false,
        message: 'Unable to reach authentication server. Please verify your connection and try again.'
      };
    }
  };

  const loginAsDemoAdmin = async (): Promise<{ success: boolean; message?: string }> => {
    return loginWithCredentials(DEMO_ADMIN_USER.email, 'Admin@Bugo2026!');
  };

  const loginAsDemoResident = async (): Promise<{ success: boolean; message?: string }> => {
    return loginWithCredentials(DEMO_RESIDENT_USER.email, 'Resident@Bugo2026!');
  };

  const logout = () => {
    setStoredAuthToken(null);
    roleRef.current = 'guest';
    currentUserRef.current = null;
    setRole('guest');
    setAuthView('welcome');
    setCurrentUser(null);
    setSelectedApplicationForReview(null);
    setPendingApplyProgram(null);
    try {
      sessionStorage.removeItem(ADMIN_TAB_STORAGE_KEY);
      sessionStorage.removeItem(RESIDENT_TAB_STORAGE_KEY);
    } catch {}
    setAdminTabState('dashboard');
    setResidentTabState('dashboard');
  };

  // Register with backend password hashing & immediately enter Resident Dashboard
  const registerResidentAccount = async (data: any): Promise<{ success: boolean; message?: string; residentId?: string; residentIdNumber?: string; email?: string; username?: string }> => {
    const cleanEmail = normalizeAccountEmail(data?.email);
    if (!isAllowedAccountEmail(cleanEmail)) {
      return { success: false, message: ALLOWED_EMAIL_DOMAIN_MESSAGE };
    }

    return runTrackedMutation(async () => {
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, email: cleanEmail, username: cleanEmail })
        });

        const resData = await response.json().catch(() => ({}));

        if (!response.ok || !resData.success || !resData.user) {
          return {
            success: false,
            message: resData.message || (response.status === 413 ? 'Uploaded ID images are too large. Please attach smaller photos and try again.' : 'Registration failed.')
          };
        }

        if (resData.token || resData.sessionToken) {
          setStoredAuthToken(resData.token || resData.sessionToken);
        }

        const newUser: ResidentUser = {
          ...resData.user,
          email: cleanEmail,
          username: resData.user.username || cleanEmail,
        };
        const savedAvatar = getSavedAvatarForUser(newUser.email, newUser.id);
        if (savedAvatar) {
          newUser.avatarUrl = savedAvatar;
        }

        const nextResidents = [newUser, ...residentsListRef.current.filter(u => u.id !== newUser.id)];
        residentsListRef.current = nextResidents;
        setResidentsList(nextResidents);
        currentUserRef.current = newUser;
        roleRef.current = newUser.role || 'resident';
        setAccountStatusAlert(null);
        setCurrentUser(newUser);
        setRole(newUser.role || 'resident');
        lastActiveRef.current = Date.now();
        setIsSessionTimedOut(false);
        setResidentTab('dashboard');
        pendingSyncQueuedRef.current = true;

        return {
          success: true,
          residentId: newUser.id,
          residentIdNumber: resData.residentIdNumber || newUser.residentIdNumber,
          email: newUser.email,
          username: newUser.username
        };
      } catch {
        return {
          success: false,
          message: 'Unable to reach registration server. Please check your connection and try again.'
        };
      }
    });
  };

  // Admin approves resident registration
  const approveResidentRegistration = async (residentId: string) => {
    setResidentsList(prev => prev.map(res => {
      if (res.id === residentId) {
        return { ...res, isVerified: true, registrationStatus: 'Verified', isBanned: false, banReason: undefined };
      }
      return res;
    }));

    await runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/residents/${residentId}`, {
          method: 'PATCH',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ adminId: currentUser?.id || 'admin-juan-delacruz', isVerified: true, registrationStatus: 'Verified', isBanned: false })
        });
        if (res.ok) {
          const json = await res.json();
          if (json.user) {
            setResidentsList(prev => prev.map(r => r.id === residentId ? { ...r, ...json.user } : r));
            if (currentUser?.id === residentId) {
              currentUserRef.current = json.user;
              setCurrentUser(json.user);
            }
          }
          prependUniqueNotification(json.notification);
        }
      } catch {}
    });
  };

  const verifyResidentAccount = approveResidentRegistration;

  // Admin bans resident account
  const banResidentAccount = async (residentId: string, reason: string) => {
    setResidentsList(prev => prev.map(res => {
      if (res.id === residentId) {
        return {
          ...res,
          isVerified: false,
          isBanned: true,
          registrationStatus: 'Banned',
          banReason: reason || 'Administrative decision',
          bannedDate: new Date().toISOString().split('T')[0]
        };
      }
      return res;
    }));

    await runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/residents/${residentId}`, {
          method: 'PATCH',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ adminId: currentUser?.id || 'admin-juan-delacruz', isVerified: false, isBanned: true, registrationStatus: 'Banned', banReason: reason })
        });
        if (res.ok) {
          const json = await res.json();
          if (json.user) {
            setResidentsList(prev => prev.map(r => r.id === residentId ? { ...r, ...json.user } : r));
          }
          prependUniqueNotification(json.notification);
        }
      } catch {}
    });
  };

  const unbanResidentAccount = async (residentId: string) => {
    setResidentsList(prev => prev.map(res => {
      if (res.id === residentId) {
        return { ...res, isVerified: true, isBanned: false, registrationStatus: 'Verified', banReason: undefined, bannedDate: undefined };
      }
      return res;
    }));

    await runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/residents/${residentId}`, {
          method: 'PATCH',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ adminId: currentUser?.id || 'admin-juan-delacruz', isVerified: true, isBanned: false, registrationStatus: 'Verified' })
        });
        if (res.ok) {
          const json = await res.json();
          if (json.user) {
            setResidentsList(prev => prev.map(r => r.id === residentId ? { ...r, ...json.user, banReason: undefined, bannedDate: undefined } : r));
          }
          prependUniqueNotification(json.notification);
        }
      } catch {}
    });
  };

  const rejectResidentRegistration = async (residentId: string, reason?: string) => {
    const cleanReason = reason?.trim() || 'Incomplete or invalid residency proof.';
    setResidentsList(prev => prev.map(res => {
      if (res.id === residentId) {
        return { ...res, isVerified: false, registrationStatus: 'Rejected', rejectionReason: cleanReason };
      }
      return res;
    }));

    await runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/residents/${residentId}`, {
          method: 'PATCH',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            adminId: currentUser?.id || 'admin-juan-delacruz',
            isVerified: false,
            registrationStatus: 'Rejected',
            rejectionReason: cleanReason
          })
        });
        if (res.ok) {
          const json = await res.json();
          if (json.user) {
            setResidentsList(prev => prev.map(r => r.id === residentId ? { ...r, ...json.user } : r));
          }
          prependUniqueNotification(json.notification);
        }
      } catch {}
    });
  };

  const autoValidateRegistrationsFromApplications = async (): Promise<{
    success: boolean;
    updatedCount?: number;
    message?: string;
  }> => {
    return runTrackedMutation(async () => {
      try {
        const res = await fetch('/api/residents/auto-validate', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' })
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          return { success: false, message: json.message || 'Could not run auto-validation.' };
        }
        if (Array.isArray(json.users)) {
          setResidentsList(json.users);
        }
        return {
          success: true,
          updatedCount: Number(json.updatedCount) || 0,
          message: json.message
        };
      } catch {
        return { success: false, message: 'Network error while auto-validating registrations.' };
      }
    });
  };

  const addNewResidentRecord = async (
    data: Partial<ResidentUser> & { password?: string }
  ): Promise<{ success: boolean; user?: ResidentUser; message?: string }> => {
    return runTrackedMutation(async () => {
      try {
        const res = await fetch('/api/residents', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(data)
        });
        const json = await res.json();
        if (!res.ok || !json.success || !json.user) {
          return { success: false, message: json.message || 'Failed to add resident account.' };
        }
        setResidentsList(prev => [json.user, ...prev]);
        return { success: true, user: json.user };
      } catch {
        return { success: false, message: 'Network error while creating resident account.' };
      }
    });
  };

  const updateResidentAccount = async (
    residentId: string,
    updates: Partial<ResidentUser>
  ): Promise<{ success: boolean; user?: ResidentUser; message?: string }> => {
    return runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/residents/${encodeURIComponent(residentId)}`, {
          method: 'PATCH',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ adminId: currentUser?.id || 'admin-juan-delacruz', ...updates })
        });
        const json = await res.json();
        if (!res.ok || !json.success || !json.user) {
          return { success: false, message: json.message || 'Failed to update resident account.' };
        }
        const savedAvatar = getSavedAvatarForUser(json.user.email, json.user.id);
        const mergedUser: ResidentUser = savedAvatar && !updates.avatarUrl
          ? { ...json.user, avatarUrl: savedAvatar }
          : json.user;

        setResidentsList(prev => prev.map(r => r.id === residentId ? mergedUser : r));
        if (currentUser?.id === residentId) {
          currentUserRef.current = mergedUser;
          setCurrentUser(mergedUser);
        }
        if (Array.isArray(json.applications)) setApplications(sortApplicationsFCFS(json.applications));
        if (Array.isArray(json.disasterVictims)) setDisasterVictims(json.disasterVictims);
        prependUniqueNotification(json.notification);
        return { success: true, user: mergedUser };
      } catch {
        return { success: false, message: 'Network error while updating resident account.' };
      }
    });
  };

  const deleteResidentAccount = async (
    residentId: string
  ): Promise<{ success: boolean; message?: string }> => {
    return runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/residents/${encodeURIComponent(residentId)}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          return { success: false, message: json.message || 'Failed to delete resident account.' };
        }
        const removedAppRefs = new Set(
          applicationsRef.current.filter(a => a.applicantId === residentId).map(a => a.referenceCode)
        );
        setResidentsList(prev => prev.filter(r => r.id !== residentId));
        setApplications(prev => prev.filter(a => a.applicantId !== residentId));
        setNotifications(prev =>
          prev.filter(n => n.userId !== residentId && (!n.applicationRef || !removedAppRefs.has(n.applicationRef)))
        );
        setDisasterVictims(prev => prev.filter(v => v.residentId !== residentId));
        setRankingClassifications(prev => prev.filter(rc => rc.residentId !== residentId));
        prependArchivedItems(json.archivedItem ? [json.archivedItem] : undefined);
        return { success: true };
      } catch {
        return { success: false, message: 'Network error while deleting resident account.' };
      }
    });
  };

  const deleteResidentAccounts = async (
    residentIds: string[]
  ): Promise<{ success: boolean; deletedCount?: number; message?: string }> => {
    if (!residentIds.length) {
      return { success: false, message: 'No residents selected.' };
    }
    return runTrackedMutation(async () => {
      try {
        const res = await fetch('/api/residents/bulk-delete', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ ids: residentIds })
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          return { success: false, message: json.message || 'Failed to delete selected residents.' };
        }
        const deletedIdSet = new Set<string>(Array.isArray(json.deletedIds) ? json.deletedIds : residentIds);
        const removedAppRefs = new Set(
          applicationsRef.current.filter(a => deletedIdSet.has(a.applicantId)).map(a => a.referenceCode)
        );
        setResidentsList(prev => prev.filter(r => !deletedIdSet.has(r.id)));
        setApplications(prev => prev.filter(a => !deletedIdSet.has(a.applicantId)));
        setNotifications(prev =>
          prev.filter(n => !deletedIdSet.has(n.userId) && (!n.applicationRef || !removedAppRefs.has(n.applicationRef)))
        );
        setDisasterVictims(prev => prev.filter(v => !v.residentId || !deletedIdSet.has(v.residentId)));
        setRankingClassifications(prev => prev.filter(rc => !deletedIdSet.has(rc.residentId)));
        prependArchivedItems(json.archivedItems);
        return { success: true, deletedCount: json.deletedCount ?? deletedIdSet.size };
      } catch {
        return { success: false, message: 'Network error while deleting selected residents.' };
      }
    });
  };

  // Submit Assistance Application with Automated Boundary & Capability Brain
  const submitAssistanceApplication = async (applicationData: any): Promise<string> => {
    const randomCode = `BUG-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString().split('T')[0];

    const submittedDocs = Array.isArray(applicationData.documents) ? applicationData.documents : [];
    const frontDoc = submittedDocs.find(
      (d: any) => d?.docCategory === 'Front ID' || d?.name?.includes('Front')
    );
    const backDoc = submittedDocs.find(
      (d: any) => d?.docCategory === 'Back ID' || d?.name?.includes('Back')
    );
    const frontUrlResolved = frontDoc?.fileUrl || frontDoc?.previewUrl || applicationData.idCardFrontUrl;
    const backUrlResolved = backDoc?.fileUrl || backDoc?.previewUrl || applicationData.idCardBackUrl;
    const hasFrontId = isRealDocumentUrl(frontUrlResolved) || Boolean(frontDoc?.autoAttached);
    const hasBackId = isRealDocumentUrl(backUrlResolved) || Boolean(backDoc?.autoAttached);
    const hasSupportingDoc = submittedDocs.length > 2;

    const matchedProgram = programs.find(
      p => p.id === (applicationData.programId || '') || p.title === (applicationData.programTitle || '')
    );

    const existingDuplicate = findExistingProgramApplication(
      applications,
      {
        id: applicationData.applicantId || currentUser?.id,
        email: applicationData.email || currentUser?.email
      },
      {
        id: applicationData.programId || matchedProgram?.id,
        title: applicationData.programTitle || matchedProgram?.title
      }
    );
    if (existingDuplicate) {
      throw new Error(
        `You have already applied for "${applicationData.programTitle || matchedProgram?.title || 'this service'}" (Ref: ${existingDuplicate.referenceCode}). Only one application per program or service is allowed.`
      );
    }

    const applicantNameTrimmed = String(applicationData.applicantName || currentUser?.name || '').trim();
    const contactRaw = String(applicationData.contactNumber || currentUser?.contactNumber || '').trim();
    const phoneCheck = normalizePhMobileNumber(contactRaw);
    const purokTrimmed = String(applicationData.purok || currentUser?.purok || '').trim();
    const addressTrimmed = String(applicationData.address || currentUser?.address || '').trim();
    const purposeTrimmed = String(applicationData.purposeOrDiagnosis || applicationData.purpose || '').trim();

    if (!applicantNameTrimmed || !purokTrimmed || !addressTrimmed) {
      throw new Error('Please complete all required personal and Barangay Bugo residency fields before submitting.');
    }
    if (!contactRaw || !phoneCheck.valid) {
      throw new Error(phoneCheck.reason || 'Please enter a valid 11-digit Philippine mobile number.');
    }
    if (purposeTrimmed.length < 10) {
      throw new Error('Purpose statement is incomplete. Please provide at least 10 characters explaining your request.');
    }

    const frontAnalysis = frontDoc?.analysis;
    const backAnalysis = backDoc?.analysis;
    if (
      frontUrlResolved &&
      backUrlResolved &&
      String(frontUrlResolved).length > 500 &&
      String(frontUrlResolved) === String(backUrlResolved)
    ) {
      throw new Error('Front ID and Back ID cannot use the same file or photo. Please attach separate Front and Back photos.');
    }
    if (frontAnalysis?.aiVisionUsed === false || backAnalysis?.aiVisionUsed === false) {
      throw new Error(
        frontAnalysis?.warning ||
        backAnalysis?.warning ||
        'ID verification did not complete. Please re-attach and scan your Front and Back ID photos.'
      );
    }
    if (frontAnalysis?.isId === false || backAnalysis?.isId === false) {
      throw new Error('Attached Front and Back IDs must both be valid identification cards.');
    }
    if (
      frontAnalysis?.matchesExpectedSide === false ||
      frontAnalysis?.detectedSide === 'back' ||
      backAnalysis?.matchesExpectedSide === false ||
      backAnalysis?.detectedSide === 'front'
    ) {
      throw new Error('ID side mismatch: Please attach the Front photo in Front of ID and the Back photo in Back of ID.');
    }
    if (frontAnalysis?.matchesExpectedType === false || backAnalysis?.matchesExpectedType === false) {
      throw new Error('ID type mismatch: Attached Front and Back IDs must match your selected ID type.');
    }
    if (frontAnalysis?.matchesExpectedName === false || backAnalysis?.matchesExpectedName === false) {
      throw new Error(
        frontAnalysis?.warning ||
        backAnalysis?.warning ||
        'ID name mismatch: Attached ID must belong to the applicant.'
      );
    }
    if (
      frontAnalysis?.isClear === false ||
      frontAnalysis?.isBlurry === true ||
      backAnalysis?.isClear === false ||
      backAnalysis?.isBlurry === true
    ) {
      throw new Error('ID photo is blurry or unclear. Please upload a clearer photo and try again.');
    }

    let computedHasMissingDocs = Boolean(applicationData.hasMissingRequiredDocs);
    let computedMissingDocsLabel = applicationData.missingDocsLabel ? String(applicationData.missingDocsLabel) : '';
    const invalidUploadedDoc = submittedDocs.find(
      (d: any) =>
        d &&
        d.docCategory !== 'Front ID' &&
        d.docCategory !== 'Back ID' &&
        (d.analysis?.isValid === false ||
          d.scanResult?.isValid === false ||
          d.scanResult?.isClear === false ||
          d.analysis?.isClear === false)
    );
    if (invalidUploadedDoc) {
      computedHasMissingDocs = true;
      computedMissingDocsLabel =
        invalidUploadedDoc.analysis?.warning ||
        invalidUploadedDoc.scanResult?.warning ||
        `Invalid or unclear requirement file "${invalidUploadedDoc.name}".`;
    }

    if (!computedHasMissingDocs && matchedProgram && Array.isArray(matchedProgram.requirements) && matchedProgram.requirements.length > 0) {
      const validSubmittedDocs = submittedDocs.filter(
        (d: any) =>
          d &&
          d.analysis?.isValid !== false &&
          d.scanResult?.isValid !== false &&
          d.scanResult?.isClear !== false &&
          isRealDocumentUrl(d.fileUrl || d.previewUrl)
      );
      const reqSlots = matchProgramRequirementsWithAccount(matchedProgram, currentUser, validSubmittedDocs);
      const missingMandatorySlot = reqSlots.find(slot => !slot.isOptional && slot.status !== 'auto-attached');
      if (missingMandatorySlot) {
        const hint = getRequirementHintLabel(missingMandatorySlot.requirement);
        computedHasMissingDocs = true;
        computedMissingDocsLabel = `Missing or invalid required document: "${missingMandatorySlot.requirement}" (must upload ${hint}).`;
      }
    }

    const evaluation = evaluateApplicantEligibility({
      programId: applicationData.programId || 'prog-barangay-clearance',
      programTitle: applicationData.programTitle || matchedProgram?.title || 'Barangay Service Request',
      programCategory: applicationData.programCategory || applicationData.category || matchedProgram?.category,
      targetAudience: matchedProgram?.targetAudience,
      programType: applicationData.programType || matchedProgram?.programType,
      qualificationRules: matchedProgram?.qualificationRules,
      eligibilityCriteria: matchedProgram?.eligibilityCriteria,
      applicantName: applicantNameTrimmed,
      purok: purokTrimmed,
      address: addressTrimmed,
      householdIncome: applicationData.householdMonthlyIncome || currentUser?.householdIncome || '₱8,500.00',
      familyCount: Number(applicationData.familyMembersCount ?? currentUser?.familyMembersCount) || 4,
      occupation: applicationData.occupation || currentUser?.occupation || 'Resident',
      employmentStatus: applicationData.employmentStatus || currentUser?.employmentStatus,
      age: typeof applicationData.age === 'number' ? applicationData.age : currentUser?.age,
      civilStatus: applicationData.civilStatus || currentUser?.civilStatus,
      isPwd: Boolean(applicationData.isPwd ?? currentUser?.isPwd),
      isSenior: Boolean(applicationData.isSenior ?? currentUser?.isSenior),
      isSoloParent: Boolean(applicationData.isSoloParent ?? currentUser?.isSoloParent),
      isStudent: Boolean(applicationData.isStudent ?? currentUser?.isStudent),
      hasVerifiedStudentDoc: hasVerifiedStudentDocument(submittedDocs),
      isTeenager: Boolean(applicationData.isTeenager ?? currentUser?.isTeenager),
      isBanned: Boolean(currentUser?.isBanned),
      hasMedicalNeed: Boolean(applicationData.hasMedicalNeed ?? currentUser?.hasMedicalNeed),
      isDisasterAffected: Boolean(applicationData.isDisasterAffected ?? currentUser?.isDisasterAffected),
      purpose: purposeTrimmed,
      hasFrontId,
      hasBackId,
      hasSupportingDoc,
      hasMissingRequiredDocs: computedHasMissingDocs,
      missingDocsLabel: computedMissingDocsLabel || undefined,
      idAnalysis: frontDoc?.analysis || submittedDocs.find((d: any) => d?.analysis)?.analysis,
      backIdAnalysis: backDoc?.analysis
    });

    const isDisasterTarget = isDisasterProgram(
      matchedProgram || {
        id: applicationData.programId,
        title: applicationData.programTitle,
        category: applicationData.programCategory || applicationData.category,
        programType: applicationData.programType
      }
    );

    const disasterBlockingRule = isDisasterTarget
      ? evaluation.rules.find(
          r =>
            !r.passed &&
            r.ruleName !== 'Income & Priority Bracket' &&
            r.ruleName !== 'Profile & Sector Qualification'
        )
      : undefined;

    if (isDisasterTarget && (computedHasMissingDocs || disasterBlockingRule)) {
      throw new Error(
        computedMissingDocsLabel ||
          (disasterBlockingRule ? `${disasterBlockingRule.ruleName}: ${disasterBlockingRule.explanation}` : undefined) ||
          'Application cannot be submitted because required documents or details are incomplete or invalid.'
      );
    }

    if (!isDisasterTarget && (computedHasMissingDocs || !evaluation.isCapable)) {
      throw new Error(
        computedMissingDocsLabel ||
          evaluation.disqualifiedReason ||
          'Application cannot be submitted because required documents or qualifications are incomplete or invalid.'
      );
    }

    const isCapable = isDisasterTarget ? false : evaluation.isCapable;
    const finalStatus: ApplicationStatus = isDisasterTarget ? 'Under Review' : 'Valid';

    const submittedIso = new Date().toISOString();
    const newApp: AssistanceApplication = {
      id: `app-${Date.now()}`,
      referenceCode: randomCode,
      programId: applicationData.programId || 'prog-barangay-clearance',
      programTitle: applicationData.programTitle || 'Barangay Service Request',
      programCategory: applicationData.programCategory || applicationData.category || 'Clearance & Certification',
      applicantId: applicationData.applicantId || currentUser?.id || 'user-maria-santos',
      applicantName: applicationData.applicantName || currentUser?.name || 'Resident Applicant',
      contactNumber: applicationData.contactNumber || currentUser?.contactNumber || '0917 628 4915',
      email: applicationData.email || currentUser?.email || 'resident@bugo.gov.ph',
      purok: applicationData.purok || currentUser?.purok || 'Zone 1',
      address: applicationData.address || currentUser?.address || 'Barangay Bugo, CDO',
      householdMonthlyIncome: applicationData.householdMonthlyIncome || '₱8,500.00',
      familyMembersCount: Number(applicationData.familyMembersCount) || 4,
      occupation: applicationData.occupation || currentUser?.occupation || 'Resident',
      purposeOrDiagnosis: applicationData.purposeOrDiagnosis || applicationData.purpose || 'Official service request.',
      requestedAmount: applicationData.requestedAmount || '',
      approvedAmount: !isDisasterTarget && isCapable ? (applicationData.approvedAmount || matchedProgram?.maxBenefitAmount) : undefined,
      status: finalStatus,
      isCertificateQualified: isDisasterTarget ? false : true,
      submissionDate: now,
      submittedAt: submittedIso,
      lastUpdated: now,
      idCardFrontUrl: applicationData.idCardFrontUrl || frontDoc?.fileUrl || frontDoc?.previewUrl,
      idCardBackUrl: applicationData.idCardBackUrl || backDoc?.fileUrl || backDoc?.previewUrl,
      eligibilityEvaluation: evaluation,
      rejectionReason: undefined,
      priorityScore: applicationData.priorityScore || 'Normal',
      documents: (applicationData.documents || []).map((d: any, index: number) => {
        const rawUrl = d.fileUrl || d.previewUrl || d.url;
        const hasRealUrl = isRealDocumentUrl(rawUrl);
        const generated = !hasRealUrl
          ? createRealPdfDataUrl(d.name || 'Submitted Application Document', [
              `Applicant: ${applicationData.applicantName || currentUser?.name || 'Resident'}`,
              `Program: ${applicationData.programTitle || 'Barangay Assistance'}`,
              `Reference: ${randomCode}`,
              `Document: ${d.name || 'Submitted Document'}`,
              `Category: ${d.docCategory || 'General Requirement'}`,
              `Uploaded: ${d.uploadDate || now}`
            ])
          : null;
        const resolvedUrl = hasRealUrl ? rawUrl : generated!.dataUrl;
        return {
          id: d.id || `doc-${Date.now()}-${index}`,
          name: d.name || 'Submitted_Document.pdf',
          type: hasRealUrl ? (d.type || 'PDF') : 'PDF',
          size: hasRealUrl && d.size ? d.size : (generated?.sizeLabel || '1.5 KB'),
          uploadDate: d.uploadDate || now,
          verified: typeof d.verified === 'boolean' ? d.verified : isCapable,
          fileUrl: resolvedUrl,
          previewUrl: d.previewUrl && isRealDocumentUrl(d.previewUrl) ? d.previewUrl : resolvedUrl,
          ...(d.docCategory ? { docCategory: d.docCategory } : {}),
          ...(d.analysis ? { analysis: d.analysis } : {}),
          ...(d.scanResult ? { scanResult: d.scanResult } : {}),
          ...(d.autoAttached ? { autoAttached: true } : {}),
          ...(d.sourceLabel ? { sourceLabel: d.sourceLabel } : {})
        };
      }),
      timeline: [
        {
          status: finalStatus,
          timestamp: 'Just now',
          officerName: isDisasterTarget ? 'Disaster Relief Desk' : 'Automated System',
          remarks: isDisasterTarget
            ? 'Submitted for Barangay Admin review. Only the Barangay Admin decides who is qualified in Disaster Programs.'
            : 'All requirements and qualifications satisfied. Marked as Valid and submitted.'
        }
      ]
    };

    // Send to backend and wait for authoritative confirmation before adding to local state
    return runTrackedMutation(async () => {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...newApp,
          employmentStatus: applicationData.employmentStatus || currentUser?.employmentStatus,
          age: typeof applicationData.age === 'number' ? applicationData.age : currentUser?.age,
          civilStatus: applicationData.civilStatus || currentUser?.civilStatus,
          isPwd: Boolean(applicationData.isPwd ?? currentUser?.isPwd),
          isSenior: Boolean(applicationData.isSenior ?? currentUser?.isSenior),
          isSoloParent: Boolean(applicationData.isSoloParent ?? currentUser?.isSoloParent),
          isStudent: Boolean(applicationData.isStudent ?? currentUser?.isStudent),
          isTeenager: Boolean(applicationData.isTeenager ?? currentUser?.isTeenager),
          hasMissingRequiredDocs: Boolean(applicationData.hasMissingRequiredDocs),
          missingDocsLabel: applicationData.missingDocsLabel,
          hasMedicalNeed: Boolean(applicationData.hasMedicalNeed ?? currentUser?.hasMedicalNeed),
          isDisasterAffected: Boolean(applicationData.isDisasterAffected ?? currentUser?.isDisasterAffected)
        })
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(
          json?.message ||
            'Application cannot be submitted because required documents or qualifications are incomplete or invalid.'
        );
      }
      const confirmedApp: AssistanceApplication = json.application || newApp;
      setApplications(prev => sortApplicationsFCFS([...prev.filter(a => a.id !== confirmedApp.id), confirmedApp]));
      if (json?.autoValidatedResident && json?.updatedResident) {
        const updated = json.updatedResident as ResidentUser;
        setResidentsList(prev => prev.map(r => (r.id === updated.id ? { ...r, ...updated } : r)));
        if (currentUser?.id === updated.id) {
          const nextUser = { ...currentUser, ...updated };
          currentUserRef.current = nextUser;
          setCurrentUser(nextUser);
        }
      }
      if (Array.isArray(json?.createdNotifications)) {
        json.createdNotifications.forEach((n: NotificationItem) => prependUniqueNotification(n));
      }
      return json?.referenceCode || confirmedApp.referenceCode || randomCode;
    });
  };

  // Admin application status update (allowed by server for Disaster Programs where only Admin decides qualifiers)
  const updateApplicationStatus = async (
    appId: string,
    newStatus: ApplicationStatus,
    officerName?: string,
    remarks?: string,
    approvedAmount?: string
  ): Promise<void> => {
    await runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/applications/${encodeURIComponent(appId)}/status`, {
          method: 'PATCH',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            status: newStatus,
            ...(officerName ? { officerName } : {}),
            ...(remarks ? { remarks } : {}),
            ...(approvedAmount ? { approvedAmount } : {})
          })
        });
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        if (json?.application) {
          setApplications(prev =>
            sortApplicationsFCFS(prev.map(a => (a.id === json.application.id ? json.application : a)))
          );
          setSelectedApplicationForReview(prev =>
            prev && prev.id === json.application.id ? json.application : prev
          );
        }
        if (Array.isArray(json?.createdNotifications) && json.createdNotifications.length > 0) {
          setNotifications(prev => [...json.createdNotifications, ...prev]);
        }
      } catch {}
    });
  };

  const verifyApplicationDocument = (appId: string, docId: string, isVerified: boolean) => {
    setApplications(prev => prev.map(app => {
      if (app.id === appId || app.referenceCode === appId) {
        return {
          ...app,
          documents: app.documents.map(doc => doc.id === docId ? { ...doc, verified: isVerified } : doc)
        };
      }
      return app;
    }));
    setSelectedApplicationForReview(prev => {
      if (!prev || (prev.id !== appId && prev.referenceCode !== appId)) return prev;
      return {
        ...prev,
        documents: prev.documents.map(doc => doc.id === docId ? { ...doc, verified: isVerified } : doc)
      };
    });

    void runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/applications/${encodeURIComponent(appId)}/documents/${encodeURIComponent(docId)}`, {
          method: 'PATCH',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ verified: isVerified })
        });
        if (res.ok) {
          const json = await res.json().catch(() => null);
          if (json?.application) {
            setApplications(prev =>
              sortApplicationsFCFS(prev.map(a => (a.id === json.application.id ? json.application : a)))
            );
            setSelectedApplicationForReview(prev =>
              prev && prev.id === json.application.id ? json.application : prev
            );
          }
        }
      } catch {}
    });
  };

  // Resident Resubmit Missing Requirements
  const resubmitApplicationRequirements = async (appId: string, documents: UploadedDocument[], note?: string) => {
    return runTrackedMutation(async () => {
      try {
        const response = await fetch(`/api/applications/${appId}/resubmit`, {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            documents,
            note,
            applicantName: currentUser?.name || 'Resident Applicant'
          })
        });
        const data = await response.json();
        if (data.success && data.application) {
          setApplications(prev => sortApplicationsFCFS(prev.map(a => (a.id === appId || a.referenceCode === appId) ? data.application : a)));
          return { success: true, message: data.message, application: data.application };
        }
        return { success: false, message: data.message || 'Resubmission failed.' };
      } catch {
        return { success: false, message: 'Network error while resubmitting requirements.' };
      }
    });
  };

  // Delete an Application permanently
  const deleteApplication = async (appIdOrRef: string): Promise<boolean> => {
    return runTrackedMutation(async () => {
      try {
        const response = await fetch(`/api/applications/${encodeURIComponent(appIdOrRef)}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        if (response.ok) {
          const json = await response.json().catch(() => null);
          const targetRef = json?.deletedRef || appIdOrRef;
          setApplications(prev => prev.filter(a => a.id !== appIdOrRef && a.referenceCode !== appIdOrRef));
          setNotifications(prev => prev.filter(n => n.applicationRef !== targetRef && n.applicationRef !== appIdOrRef && !n.message?.includes(targetRef)));
          prependUniqueNotification(json?.notification);
          prependArchivedItems(json?.archivedItem ? [json.archivedItem] : undefined);
          return true;
        }
        return false;
      } catch (err) {
        console.error('Failed to delete application on server:', err);
        return false;
      }
    });
  };

  const deleteApplications = async (
    appIds: string[]
  ): Promise<{ success: boolean; deletedCount?: number; message?: string }> => {
    if (!appIds.length) {
      return { success: false, message: 'No applications selected.' };
    }
    return runTrackedMutation(async () => {
      try {
        const response = await fetch('/api/applications/bulk-delete', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ ids: appIds })
        });
        const json = await response.json();
        if (!response.ok || !json.success) {
          return { success: false, message: json.message || 'Failed to delete selected applications.' };
        }
        const deletedIdSet = new Set<string>(Array.isArray(json.deletedIds) ? json.deletedIds : appIds);
        const deletedRefs: string[] = Array.isArray(json.deletedRefs) ? json.deletedRefs : [];
        const deletedRefSet = new Set<string>(deletedRefs);
        setApplications(prev => prev.filter(a => !deletedIdSet.has(a.id) && !deletedRefSet.has(a.referenceCode)));
        setNotifications(prev =>
          prev.filter(n => {
            if (n.applicationRef && (deletedRefSet.has(n.applicationRef) || deletedIdSet.has(n.applicationRef))) {
              return false;
            }
            if (n.message && deletedRefs.some(ref => n.message.includes(ref))) {
              return false;
            }
            return true;
          })
        );
        if (Array.isArray(json.notifications)) {
          json.notifications.forEach((n: NotificationItem) => prependUniqueNotification(n));
        }
        prependArchivedItems(json.archivedItems);
        return { success: true, deletedCount: json.deletedCount ?? deletedIdSet.size };
      } catch {
        return { success: false, message: 'Network error while deleting selected applications.' };
      }
    });
  };

  // Announcements & Targeted Releases (with Server-Side Qualified Resident Notifications)
  const addAnnouncement = async (
    data: Omit<AnnouncementItem, 'id' | 'viewsCount'>
  ): Promise<{ success: boolean; announcement?: AnnouncementItem; message?: string }> => {
    const tempId = `ann-${Date.now()}`;
    const optimisticAnn: AnnouncementItem = {
      ...data,
      id: tempId,
      viewsCount: 0,
      viewedBy: [],
      date: 'Today',
      status: 'Published'
    };
    setAnnouncements(prev => [optimisticAnn, ...prev]);

    return runTrackedMutation(async () => {
      try {
        const res = await fetch('/api/announcements', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(optimisticAnn)
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && json.announcement) {
          const savedAnn: AnnouncementItem = json.announcement;
          setAnnouncements(prev => prev.map(a => a.id === tempId ? savedAnn : a));
          if (Array.isArray(json.createdNotifications)) {
            json.createdNotifications.forEach((n: NotificationItem) => prependUniqueNotification(n));
          }
          return { success: true, announcement: savedAnn };
        }
        setAnnouncements(prev => prev.filter(a => a.id !== tempId));
        return { success: false, message: json?.message || 'Failed to publish announcement.' };
      } catch {
        setAnnouncements(prev => prev.filter(a => a.id !== tempId));
        return { success: false, message: 'Network error while publishing announcement.' };
      }
    });
  };

  const updateAnnouncement = async (
    id: string,
    updates: Partial<AnnouncementItem>
  ): Promise<{ success: boolean; announcement?: AnnouncementItem; message?: string }> => {
    return runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/announcements/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(updates)
        });
        const json = await res.json();
        if (!res.ok || !json.success || !json.announcement) {
          return { success: false, message: json.message || 'Failed to update announcement.' };
        }
        setAnnouncements(prev => prev.map(a => a.id === id ? json.announcement : a));
        if (Array.isArray(json.createdNotifications)) {
          json.createdNotifications.forEach((n: NotificationItem) => prependUniqueNotification(n));
        }
        return { success: true, announcement: json.announcement };
      } catch {
        return { success: false, message: 'Network error while updating announcement.' };
      }
    });
  };

  const updateSecretariatDetails = async (payload: {
    lguUnit: string;
    punongBarangay: string;
    currentPassword?: string;
    verificationToken?: string;
  }): Promise<{ success: boolean; message: string; secretariatDetails?: SecretariatDetails }> => {
    if (role !== 'admin' || currentUser?.role !== 'admin') {
      return { success: false, message: 'Only Barangay Administrators may edit Secretariat Details.' };
    }
    return runTrackedMutation(async () => {
      try {
        const res = await fetch('/api/admin/secretariat-details', {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          return { success: false, message: json.message || 'Unable to update Barangay Secretariat Details.' };
        }
        if (json.secretariatDetails) {
          secretariatDetailsRef.current = json.secretariatDetails;
          setSecretariatDetails(json.secretariatDetails);
        }
        if (json.activityLog) {
          setActivityLogs(prev => [json.activityLog, ...prev]);
        }
        return {
          success: true,
          message: json.message || 'Barangay Secretariat Details updated successfully.',
          secretariatDetails: json.secretariatDetails,
        };
      } catch {
        return { success: false, message: 'Network error while saving Barangay Secretariat Details.' };
      }
    });
  };

  const deleteAnnouncement = async (id: string): Promise<{ success: boolean; message?: string }> => {
    return runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/announcements/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          return { success: false, message: json.message || 'Failed to delete announcement.' };
        }
        const deletedTitle = json.deletedTitle;
        setAnnouncements(prev => prev.filter(a => a.id !== id));
        setNotifications(prev =>
          prev.filter(
            n =>
              n.title !== `Announcement: ${deletedTitle}` &&
              n.title !== `Release Schedule: ${deletedTitle}`
          )
        );
        prependArchivedItems(json.archivedItem ? [json.archivedItem] : undefined);
        return { success: true };
      } catch {
        return { success: false, message: 'Network error while deleting announcement.' };
      }
    });
  };

  // Qualifications-module auto-qualification notifications are disabled; notifications are reserved for new/important updates.
  const broadcastProgramQualificationAlerts = async (
    _programId: string,
    _programTitle: string,
    _targetResidentId?: string
  ): Promise<{
    success: boolean;
    count: number;
    alreadyNotifiedCount: number;
    qualifiedTotal: number;
    recipients: string[];
    alreadyNotifiedRecipients: string[];
  }> => {
    return {
      success: true,
      count: 0,
      alreadyNotifiedCount: 0,
      qualifiedTotal: 0,
      recipients: [],
      alreadyNotifiedRecipients: []
    };
  };

  const notifyAllQualifiedUsers = async (
    programId?: string,
    residentIds?: string[]
  ): Promise<{
    success: boolean;
    sentCount: number;
    residentsNotifiedCount: number;
    alreadyNotifiedCount: number;
    message?: string;
  }> => {
    return runTrackedMutation(async () => {
      try {
        const res = await fetch('/api/notifications/notify-all-qualified', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ programId: programId || 'all', residentIds })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          return {
            success: false,
            sentCount: 0,
            residentsNotifiedCount: 0,
            alreadyNotifiedCount: 0,
            message: data?.message || 'Could not notify qualified users.'
          };
        }
        if (Array.isArray(data.createdNotifications) && data.createdNotifications.length > 0) {
          setNotifications(prev => {
            const existingIds = new Set(prev.map(n => n.id));
            const toAdd = data.createdNotifications.filter((n: NotificationItem) => !existingIds.has(n.id));
            return [...toAdd, ...prev];
          });
        }
        return {
          success: true,
          sentCount: Number(data.sentCount) || 0,
          residentsNotifiedCount: Number(data.residentsNotifiedCount) || 0,
          alreadyNotifiedCount: Number(data.alreadyNotifiedCount) || 0
        };
      } catch {
        return {
          success: false,
          sentCount: 0,
          residentsNotifiedCount: 0,
          alreadyNotifiedCount: 0,
          message: 'Network error while sending qualification notices.'
        };
      }
    });
  };


  // Notifications (Real event synchronization & read state persistence)
  const markNotificationAsRead = (id: string) => {
    const uid = currentUser?.id;
    const isAdminRole = role === 'admin';
    setNotifications(prev =>
      prev.map(n => {
        if (n.id !== id) return n;
        const isBroadcast = !n.userId || n.userId === 'all';
        const nextRead = isAdminRole || !isBroadcast ? true : n.read;
        const nextReadBy = uid
          ? Array.from(new Set([...(n.readBy || []), uid]))
          : n.readBy;
        return { ...n, read: nextRead, ...(nextReadBy ? { readBy: nextReadBy } : {}) };
      })
    );
    void runTrackedMutation(async () => {
      try {
        await fetch('/api/notifications/read', {
          method: 'PATCH',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ id })
        });
      } catch {}
    });
  };

  const markAllNotificationsAsRead = () => {
    const uid = currentUser?.id;
    const isAdminRole = role === 'admin';
    setNotifications(prev =>
      prev.map(n => {
        const isBroadcast = !n.userId || n.userId === 'all';
        const shouldSetRead = isAdminRole || (!isBroadcast && (!uid || n.userId === uid));
        const nextReadBy = uid
          ? Array.from(new Set([...(n.readBy || []), uid]))
          : n.readBy;
        return {
          ...n,
          read: shouldSetRead ? true : n.read,
          ...(nextReadBy ? { readBy: nextReadBy } : {})
        };
      })
    );
    void runTrackedMutation(async () => {
      try {
        await fetch('/api/notifications/read', {
          method: 'PATCH',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ all: true, ...(isAdminRole ? {} : { userId: uid }) })
        });
      } catch {}
    });
  };

  const deleteNotification = (id: string) => {
    const uid = currentUser?.id;
    const isAdminRole = role === 'admin';
    const prevSnapshot = notificationsRef.current;
    setNotifications(prev =>
      prev.flatMap(n => {
        if (n.id !== id) return [n];
        if (!isAdminRole && uid && (!n.userId || n.userId === 'all')) {
          return [{
            ...n,
            dismissedBy: Array.from(new Set([...(n.dismissedBy || []), uid])),
            readBy: Array.from(new Set([...(n.readBy || []), uid])),
          }];
        }
        return [];
      })
    );
    void runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/notifications/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        if (!res.ok) {
          setNotifications(prevSnapshot);
        }
      } catch {
        setNotifications(prevSnapshot);
      }
    });
  };

  const clearAllNotifications = (userId?: string) => {
    const isAdminRole = role === 'admin';
    const effectiveUid = isAdminRole ? userId : (userId || currentUser?.id);
    const prevSnapshot = notificationsRef.current;
    setNotifications(prev => {
      if (!effectiveUid || (isAdminRole && !userId)) {
        return [];
      }
      return prev.flatMap(n => {
        if (n.userId === effectiveUid) return [];
        if (!n.userId || n.userId === 'all') {
          return [{
            ...n,
            dismissedBy: Array.from(new Set([...(n.dismissedBy || []), effectiveUid])),
            readBy: Array.from(new Set([...(n.readBy || []), effectiveUid])),
          }];
        }
        return [n];
      });
    });
    const url = effectiveUid ? `/api/notifications?userId=${encodeURIComponent(effectiveUid)}` : '/api/notifications';
    void runTrackedMutation(async () => {
      try {
        const res = await fetch(url, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        if (!res.ok) {
          setNotifications(prevSnapshot);
        }
      } catch {
        setNotifications(prevSnapshot);
      }
    });
  };

  const incrementAnnouncementViews = async (id: string) => {
    if (!currentUser || currentUser.role !== 'resident' || !currentUser.id) {
      return;
    }
    const residentId = currentUser.id;
    const existingAnn = announcements.find(a => a.id === id);
    const existingViewedBy = Array.isArray(existingAnn?.viewedBy) ? existingAnn.viewedBy : [];
    if (existingViewedBy.includes(residentId)) {
      return;
    }

    const optimisticViewedBy = [...existingViewedBy, residentId];
    setAnnouncements(prev =>
      prev.map(a => {
        if (a.id !== id) return a;
        const currViewed = Array.isArray(a.viewedBy) ? a.viewedBy : [];
        if (currViewed.includes(residentId)) return a;
        const nextViewed = [...currViewed, residentId];
        return { ...a, viewedBy: nextViewed, viewsCount: nextViewed.length };
      })
    );

    try {
      const res = await fetch(`/api/announcements/${id}/view`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const serverViewedBy = Array.isArray(data.viewedBy) ? data.viewedBy : optimisticViewedBy;
        const serverViewsCount = typeof data.viewsCount === 'number' ? data.viewsCount : serverViewedBy.length;
        setAnnouncements(prev =>
          prev.map(a => (a.id === id ? { ...a, viewsCount: serverViewsCount, viewedBy: serverViewedBy } : a))
        );
      }
    } catch {}
  };

  const addProgram = async (
    data: Omit<AssistanceProgram, 'id'>
  ): Promise<{ success: boolean; program?: AssistanceProgram; message?: string }> => {
    return runTrackedMutation(async () => {
      try {
        const res = await fetch('/api/programs', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(data)
        });
        const json = await res.json();
        if (!res.ok || !json.success || !json.program) {
          return { success: false, message: json.message || 'Failed to add program.' };
        }
        setPrograms(prev => sortProgramsAlphabetically([json.program, ...prev]));
        if (Array.isArray(json.disasterVictims)) {
          setDisasterVictims(json.disasterVictims);
        }
        if (Array.isArray(json.createdNotifications) && json.createdNotifications.length > 0) {
          json.createdNotifications.forEach((n: NotificationItem) => prependUniqueNotification(n));
        }
        return { success: true, program: json.program };
      } catch {
        return { success: false, message: 'Network error while saving program.' };
      }
    });
  };

  const updateProgram = async (
    programId: string,
    updates: Partial<AssistanceProgram>
  ): Promise<{ success: boolean; program?: AssistanceProgram; message?: string }> => {
    return runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/programs/${encodeURIComponent(programId)}`, {
          method: 'PATCH',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(updates)
        });
        const json = await res.json();
        if (!res.ok || !json.success || !json.program) {
          return { success: false, message: json.message || 'Failed to update program.' };
        }
        setPrograms(prev => sortProgramsAlphabetically(prev.map(p => p.id === programId ? json.program : p)));
        if (Array.isArray(json.applications)) setApplications(sortApplicationsFCFS(json.applications));
        if (Array.isArray(json.announcements)) setAnnouncements(json.announcements);
        if (Array.isArray(json.disasterVictims)) setDisasterVictims(json.disasterVictims);
        if (Array.isArray(json.createdNotifications) && json.createdNotifications.length > 0) {
          json.createdNotifications.forEach((n: NotificationItem) => prependUniqueNotification(n));
        }
        return { success: true, program: json.program };
      } catch {
        return { success: false, message: 'Network error while updating program.' };
      }
    });
  };

  const deleteProgram = async (
    programId: string
  ): Promise<{ success: boolean; message?: string }> => {
    return runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/programs/${encodeURIComponent(programId)}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          return { success: false, message: json.message || 'Failed to delete program.' };
        }
        setPrograms(prev => prev.filter(p => p.id !== programId));
        setDisasterVictims(prev =>
          prev.map(v => ({
            ...v,
            enrolledProgramIds: (v.enrolledProgramIds || []).filter(pid => pid !== programId),
            enrolledProgramTitles: (v.enrolledProgramTitles || []).filter(t => t !== json.deletedTitle)
          }))
        );
        prependArchivedItems(json.archivedItem ? [json.archivedItem] : undefined);
        return { success: true };
      } catch {
        return { success: false, message: 'Network error while deleting program.' };
      }
    });
  };

  const deletePrograms = async (
    programIds: string[]
  ): Promise<{ success: boolean; deletedCount?: number; message?: string }> => {
    if (!programIds.length) {
      return { success: false, message: 'No programs selected.' };
    }
    return runTrackedMutation(async () => {
      try {
        const res = await fetch('/api/programs/bulk-delete', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ ids: programIds })
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          return { success: false, message: json.message || 'Failed to delete selected programs.' };
        }
        const deletedIdSet = new Set<string>(Array.isArray(json.deletedIds) ? json.deletedIds : programIds);
        const deletedTitleSet = new Set<string>(Array.isArray(json.deletedTitles) ? json.deletedTitles : []);
        setPrograms(prev => prev.filter(p => !deletedIdSet.has(p.id)));
        setDisasterVictims(prev =>
          prev.map(v => ({
            ...v,
            enrolledProgramIds: (v.enrolledProgramIds || []).filter(pid => !deletedIdSet.has(pid)),
            enrolledProgramTitles: (v.enrolledProgramTitles || []).filter(t => !deletedTitleSet.has(t))
          }))
        );
        prependArchivedItems(json.archivedItems);
        return { success: true, deletedCount: json.deletedCount ?? deletedIdSet.size };
      } catch {
        return { success: false, message: 'Network error while deleting selected programs.' };
      }
    });
  };

  const addDisasterVictim = async (
    data: Partial<DisasterVictimRecord>
  ): Promise<{ success: boolean; victim?: DisasterVictimRecord; message?: string }> => {
    return runTrackedMutation(async () => {
      try {
        const res = await fetch('/api/disaster-victims', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(data)
        });
        const json = await res.json();
        if (!res.ok || !json.success || !json.victim) {
          return { success: false, message: json.message || 'Failed to save victim record.' };
        }
        setDisasterVictims(prev => {
          const exists = prev.some(v => v.id === json.victim.id);
          return exists
            ? prev.map(v => (v.id === json.victim.id ? json.victim : v))
            : [json.victim, ...prev];
        });
        return { success: true, victim: json.victim };
      } catch {
        return { success: false, message: 'Network error while saving victim record.' };
      }
    });
  };

  const updateDisasterVictim = async (
    id: string,
    updates: Partial<DisasterVictimRecord>
  ): Promise<{ success: boolean; victim?: DisasterVictimRecord; message?: string }> => {
    return runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/disaster-victims/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(updates)
        });
        const json = await res.json();
        if (!res.ok || !json.success || !json.victim) {
          return { success: false, message: json.message || 'Failed to update victim record.' };
        }
        setDisasterVictims(prev => prev.map(v => v.id === id ? json.victim : v));
        return { success: true, victim: json.victim };
      } catch {
        return { success: false, message: 'Network error while updating victim record.' };
      }
    });
  };

  const deleteDisasterVictim = async (id: string): Promise<{ success: boolean; message?: string }> => {
    return runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/disaster-victims/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          return { success: false, message: json.message || 'Failed to delete victim record.' };
        }
        setDisasterVictims(prev => prev.filter(v => v.id !== id));
        prependArchivedItems(json.archivedItem ? [json.archivedItem] : undefined);
        return { success: true };
      } catch {
        return { success: false, message: 'Network error while deleting victim record.' };
      }
    });
  };

  const addHazardZone = async (
    data: Omit<BugoHazardZone, 'id' | 'updatedAt'>
  ): Promise<{ success: boolean; zone?: BugoHazardZone; message?: string }> => {
    return runTrackedMutation(async () => {
      try {
        const res = await fetch('/api/hazard-zones', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(data)
        });
        const json = await res.json();
        if (!res.ok || !json.success || !json.zone) {
          return { success: false, message: json.message || 'Failed to add hazard zone.' };
        }
        setHazardZones(prev => [json.zone, ...prev]);
        if (Array.isArray(json.createdNotifications) && json.createdNotifications.length > 0) {
          json.createdNotifications.forEach((n: NotificationItem) => prependUniqueNotification(n));
        }
        return { success: true, zone: json.zone };
      } catch {
        return { success: false, message: 'Network error while saving hazard zone.' };
      }
    });
  };

  const updateHazardZone = async (
    id: string,
    updates: Partial<BugoHazardZone>
  ): Promise<{ success: boolean; zone?: BugoHazardZone; message?: string }> => {
    return runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/hazard-zones/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(updates)
        });
        const json = await res.json();
        if (!res.ok || !json.success || !json.zone) {
          return { success: false, message: json.message || 'Failed to update hazard zone.' };
        }
        setHazardZones(prev => prev.map(z => z.id === id ? json.zone : z));
        return { success: true, zone: json.zone };
      } catch {
        return { success: false, message: 'Network error while updating hazard zone.' };
      }
    });
  };

  const deleteHazardZone = async (id: string): Promise<{ success: boolean; message?: string }> => {
    return runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/hazard-zones/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          return { success: false, message: json.message || 'Failed to delete hazard zone.' };
        }
        setHazardZones(prev => prev.filter(z => z.id !== id));
        prependArchivedItems(json.archivedItem ? [json.archivedItem] : undefined);
        return { success: true };
      } catch {
        return { success: false, message: 'Network error while deleting hazard zone.' };
      }
    });
  };

  const updateHazardSummaryItem = async <K extends HazardSummaryCategory>(
    category: K,
    id: string,
    updates: Partial<HazardSummariesData[K][number]>
  ): Promise<{ success: boolean; message?: string }> => {
    return runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/hazard-summaries/${encodeURIComponent(category)}/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(updates)
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          return { success: false, message: json.message || 'Failed to update hazard information.' };
        }
        if (json.hazardSummaries && typeof json.hazardSummaries === 'object') {
          hazardSummariesRef.current = json.hazardSummaries;
          setHazardSummaries(json.hazardSummaries);
        } else if (json.item) {
          setHazardSummaries(prev => ({
            ...prev,
            [category]: prev[category].map((item: any) => (item.id === id ? json.item : item))
          }));
        }
        return { success: true };
      } catch {
        return { success: false, message: 'Network error while updating hazard information.' };
      }
    });
  };

  const upsertRankingClassification = async (
    residentId: string,
    priority: RankingPriorityLevel
  ): Promise<{ success: boolean; message?: string }> => {
    return runTrackedMutation(async () => {
      try {
        const res = await fetch('/api/ranking-classifications', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ residentId, priority })
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          return { success: false, message: json.message || 'Failed to save ranking.' };
        }
        if (Array.isArray(json.rankingClassifications)) {
          setRankingClassifications(sortRankingClassifications(json.rankingClassifications));
        }
        return { success: true };
      } catch {
        return { success: false, message: 'Network error while saving ranking.' };
      }
    });
  };

  const updateRankingClassification = async (
    id: string,
    priority: RankingPriorityLevel
  ): Promise<{ success: boolean; message?: string }> => {
    return runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/ranking-classifications/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ priority })
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          return { success: false, message: json.message || 'Failed to update ranking.' };
        }
        if (Array.isArray(json.rankingClassifications)) {
          setRankingClassifications(sortRankingClassifications(json.rankingClassifications));
        }
        return { success: true };
      } catch {
        return { success: false, message: 'Network error while updating ranking.' };
      }
    });
  };

  const bulkUpsertRankingClassifications = async (params: {
    residentIds?: string[];
    zone?: string;
    selectAll?: boolean;
    priority: RankingPriorityLevel;
  }): Promise<{ success: boolean; updatedCount?: number; message?: string }> => {
    return runTrackedMutation(async () => {
      try {
        const res = await fetch('/api/ranking-classifications/bulk', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(params)
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          return { success: false, message: json.message || 'Failed to save rankings.' };
        }
        if (Array.isArray(json.rankingClassifications)) {
          setRankingClassifications(sortRankingClassifications(json.rankingClassifications));
        }
        return { success: true, updatedCount: json.updatedCount };
      } catch {
        return { success: false, message: 'Network error while saving rankings.' };
      }
    });
  };

  const deleteRankingClassification = async (id: string): Promise<{ success: boolean; message?: string }> => {
    return runTrackedMutation(async () => {
      try {
        const res = await fetch(`/api/ranking-classifications/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          return { success: false, message: json.message || 'Failed to remove resident from ranking.' };
        }
        if (Array.isArray(json.rankingClassifications)) {
          setRankingClassifications(sortRankingClassifications(json.rankingClassifications));
        } else {
          setRankingClassifications(prev => prev.filter(item => item.id !== id));
        }
        return { success: true };
      } catch {
        return { success: false, message: 'Network error while removing ranking.' };
      }
    });
  };

  const bulkDeleteRankingClassifications = async (
    ids: string[]
  ): Promise<{ success: boolean; deletedCount?: number; message?: string }> => {
    return runTrackedMutation(async () => {
      try {
        const res = await fetch('/api/ranking-classifications/bulk-delete', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ ids })
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          return { success: false, message: json.message || 'Failed to remove selected rankings.' };
        }
        if (Array.isArray(json.rankingClassifications)) {
          setRankingClassifications(sortRankingClassifications(json.rankingClassifications));
        } else {
          const idSet = new Set(ids);
          setRankingClassifications(prev => prev.filter(item => !idSet.has(item.id)));
        }
        return { success: true, deletedCount: json.deletedCount };
      } catch {
        return { success: false, message: 'Network error while removing selected rankings.' };
      }
    });
  };

  const downloadExportedRecords = async (
    type: 'all' | 'victims' | 'hazards' | 'applications' | 'programs',
    format: 'json' | 'csv',
    programId?: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const qs = new URLSearchParams({ type, format });
      if (programId) qs.set('programId', programId);
      const res = await fetch(`/api/admin/export-records?${qs.toString()}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        return { success: false, message: err?.message || 'Export failed.' };
      }
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/i);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = match?.[1] || `bugo_${type}_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return { success: true };
    } catch {
      return { success: false, message: 'Network error during export.' };
    }
  };

  const importRecords = async (
    recordType: 'victims' | 'hazards' | 'programs',
    mode: 'merge' | 'replace',
    records: any[],
    programId?: string
  ): Promise<{ success: boolean; importedCount?: number; message?: string }> => {
    return runTrackedMutation(async () => {
      try {
        const res = await fetch('/api/admin/import-records', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ recordType, mode, records, ...(programId ? { programId } : {}) })
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          return { success: false, message: json.message || 'Import failed.' };
        }
        if (Array.isArray(json.disasterVictims)) setDisasterVictims(json.disasterVictims);
        if (Array.isArray(json.hazardZones)) setHazardZones(json.hazardZones);
        if (Array.isArray(json.programs)) setPrograms(sortProgramsAlphabetically(json.programs));
        return { success: true, importedCount: json.importedCount };
      } catch {
        return { success: false, message: 'Network error during import.' };
      }
    });
  };

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        authView,
        setAuthView,
        prefilledLoginEmail,
        setPrefilledLoginEmail,
        currentUser,
        setCurrentUser,
        adminTab,
        setAdminTab,
        residentTab,
        setResidentTab,
        selectedZoneForRegistry,
        setSelectedZoneForRegistry,
        searchQuery,
        setSearchQuery,
        isNotificationsOpen,
        setIsNotificationsOpen,
        isProfileDrawerOpen,
        setIsProfileDrawerOpen,
        isSessionTimedOut,
        dismissSessionTimeout,
        accountStatusAlert,
        dismissAccountStatusAlert,
        programs,
        applications,
        residentsList,
        announcements,
        notifications,
        activityLogs,
        archivedItems,
        disasterVictims,
        hazardZones,
        hazardSummaries,
        rankingClassifications,
        loginWithCredentials,
        loginAsDemoAdmin,
        loginAsDemoResident,
        loginAsGuest,
        logout,
        registerResidentAccount,
        updateUserProfile,
        submitProfileChangeRequest,
        cancelProfileChangeRequest,
        reviewProfileChangeRequest,
        changePassword,
        verifyCurrentPassword,
        approveResidentRegistration,
        rejectResidentRegistration,
        autoValidateRegistrationsFromApplications,
        banResidentAccount,
        unbanResidentAccount,
        verifyResidentAccount,
        addNewResidentRecord,
        updateResidentAccount,
        deleteResidentAccount,
        deleteResidentAccounts,
        logActivity,
        archiveRecord,
        restoreArchivedItem,
        deleteArchivedItemPermanently,
        submitAssistanceApplication,
        verifyApplicationDocument,
        updateApplicationStatus,
        resubmitApplicationRequirements,
        deleteApplication,
        deleteApplications,
        addProgram,
        updateProgram,
        deleteProgram,
        deletePrograms,
        addAnnouncement,
        updateAnnouncement,
        secretariatDetails,
        updateSecretariatDetails,
        deleteAnnouncement,
        broadcastProgramQualificationAlerts,
        notifyAllQualifiedUsers,
        incrementAnnouncementViews,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        deleteNotification,
        clearAllNotifications,
        addNotification,
        selectedApplicationForReview,
        setSelectedApplicationForReview,
        pendingApplyProgram,
        openProgramApplication,
        censusData,
        updateCensusData,
        resetCensusToBenchmark,
        addDisasterVictim,
        updateDisasterVictim,
        deleteDisasterVictim,
        addHazardZone,
        updateHazardZone,
        deleteHazardZone,
        updateHazardSummaryItem,
        upsertRankingClassification,
        bulkUpsertRankingClassifications,
        updateRankingClassification,
        deleteRankingClassification,
        bulkDeleteRankingClassifications,
        downloadExportedRecords,
        importRecords
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
