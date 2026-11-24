import React, { useState, useRef } from 'react';
import { 
  Bell, 
  X, 
  CheckCircle, 
  ShieldCheck, 
  LogOut, 
  ChevronDown, 
  Camera, 
  User, 
  FileText, 
  Megaphone,
  Clock,
  HelpCircle,
  Settings,
  CheckCircle2,
  Trash2,
  Accessibility,
  HeartHandshake,
  GraduationCap,
  Sparkles,
  CreditCard,
  Briefcase,
  Users,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BugoLogo } from './BugoLogo';
import { CARTOON_AVATAR_PRESETS, MALE_CARTOON_AVATARS, FEMALE_CARTOON_AVATARS, detectUserGender } from '../data/mockData';
import { NotificationPaperModal } from './NotificationPaperModal';
import { NotificationNoticeModal, cleanNotificationTitle } from './NotificationNoticeModal';
import { NotificationItem } from '../types';
import { resolveProgramFromAnnouncementNotification } from '../utils/announcementTargetMatcher';

export const TopNavBar: React.FC = () => {
  const { 
    currentUser, 
    role, 
    logout, 
    notifications = [], 
    markNotificationAsRead, 
    markAllNotificationsAsRead,
    deleteNotification,
    clearAllNotifications,
    setAdminTab,
    setResidentTab,
    setSelectedApplicationForReview,
    updateUserProfile,
    programs = [],
    announcements = [],
    openProgramApplication
  } = useApp();

  const [showNotifs, setShowNotifs] = useState(false);
  const [activeNoticeNotification, setActiveNoticeNotification] = useState<NotificationItem | null>(null);
  const [activePaperNotification, setActivePaperNotification] = useState<NotificationItem | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfileInfoModal, setShowProfileInfoModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const userDetectedGender = detectUserGender(currentUser);
  const [avatarGenderFilter, setAvatarGenderFilter] = useState<'male' | 'female'>(userDetectedGender);

  React.useEffect(() => {
    setAvatarGenderFilter(detectUserGender(currentUser));
  }, [currentUser, showAvatarModal]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isNotifRead = (n: NotificationItem) =>
    Boolean(n.read || (currentUser?.id && Array.isArray(n.readBy) && n.readBy.includes(currentUser.id)));

  const safeNotifications = (notifications || []).filter(n => {
    if (currentUser?.id && Array.isArray(n.dismissedBy) && n.dismissedBy.includes(currentUser.id)) {
      return false;
    }
    if (role === 'admin') {
      return (
        !n.userId ||
        n.userId === 'all' ||
        n.userId === currentUser?.id ||
        n.userId === 'admin-juan-delacruz' ||
        n.type === 'registration_submitted'
      );
    }
    return !n.userId || n.userId === 'all' || n.userId === currentUser?.id;
  });
  const unreadCount = safeNotifications.filter(n => !isNotifRead(n)).length;

  React.useEffect(() => {
    if (showNotifs && unreadCount > 0) {
      markAllNotificationsAsRead();
    }
  }, [showNotifs, unreadCount]);

  const isAnnouncementNotification = (n: NotificationItem): boolean => {
    if (n.type === 'announcement') return true;
    const lowerTitle = cleanNotificationTitle(n.title).toLowerCase();
    return (
      lowerTitle.startsWith('announcement:') ||
      lowerTitle.startsWith('disaster announcement:') ||
      lowerTitle.startsWith('disaster alert:') ||
      lowerTitle.startsWith('release schedule:') ||
      lowerTitle.startsWith('new service open:') ||
      lowerTitle.startsWith('new certification:') ||
      lowerTitle.startsWith('new certification available:') ||
      lowerTitle.startsWith('new program:') ||
      lowerTitle.startsWith('new program available:') ||
      lowerTitle.startsWith('new disaster program:') ||
      lowerTitle.startsWith('new disaster program available:')
    );
  };

  // Handle clicking on notification item -> route directly to matching view/action
  const handleNotificationClick = (n: NotificationItem) => {
    markNotificationAsRead(n.id);
    setShowNotifs(false);

    if (
      role === 'admin' &&
      (n.targetArea === 'settings' ||
        n.title === 'Profile Edit Approval Required' ||
        /profile edit/i.test(cleanNotificationTitle(n.title || '')))
    ) {
      setAdminTab('settings');
      return;
    }

    if (role === 'resident' && n.targetArea === 'hazard-map') {
      setResidentTab('hazard-map');
      return;
    }

    if (role === 'resident' && isAnnouncementNotification(n)) {
      const matchedProgram = resolveProgramFromAnnouncementNotification(n, programs, announcements);
      if (matchedProgram) {
        openProgramApplication(matchedProgram);
        return;
      }
      const combinedText = `${n.title || ''} ${n.message || ''} ${n.documentData?.subject || ''}`.toLowerCase();
      if (n.targetArea === 'services' || /\b(certificate|certification|clearance|permit|indigency|residency|good moral)\b/.test(combinedText)) {
        setResidentTab('services');
      } else if (n.targetArea === 'dashboard' || /\b(disaster|calamity|fire|flood|typhoon|program|assistance|burial|medical|educational)\b/.test(combinedText)) {
        setResidentTab('dashboard');
      } else {
        setResidentTab('announcements');
      }
      return;
    }

    setActiveNoticeNotification(n);
  };

  const handleNavigateFromPaper = (targetArea: string) => {
    setActivePaperNotification(null);
    if (role === 'admin') {
      if (targetArea === 'residents') setAdminTab('residents');
      else if (targetArea === 'disaster-aid') setAdminTab('disaster-aid');
      else if (targetArea === 'hazard-map') setAdminTab('hazard-map');
      else if (targetArea === 'announcements') setAdminTab('announcements');
      else if (targetArea === 'archives') setAdminTab('archives');
      else if (targetArea === 'settings') setAdminTab('settings');
      else setAdminTab('dashboard');
    } else {
      if (targetArea === 'services') setResidentTab('services');
      else if (targetArea === 'hazard-map') setResidentTab('hazard-map');
      else if (targetArea === 'announcements') setResidentTab('announcements');
      else setResidentTab('dashboard');
    }
  };

  // Avatar file upload handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          updateUserProfile({ avatarUrl: reader.result });
          setShowAvatarModal(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectPresetAvatar = (url: string) => {
    updateUserProfile({ avatarUrl: url });
    setShowAvatarModal(false);
  };

  const handleRemovePhoto = () => {
    updateUserProfile({ avatarUrl: undefined });
    setShowAvatarModal(false);
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left Branding / Page Title (Clean without search bar) */}
      <div className="flex items-center gap-3">
        <div className="md:hidden">
          <BugoLogo size="sm" />
        </div>
        <div className="hidden sm:block">
          <h1 className="text-sm font-extrabold text-gray-900 tracking-tight">
            Barangay Bugo Citizen & Administrative Portal
          </h1>
          <p className="text-[11px] text-gray-500 font-medium">
            {role === 'admin' ? 'Official Operations & Governance Console' : 'Community Services & Digital Citizen Desk'}
          </p>
        </div>
      </div>

      {/* Right Actions: Notifications & User Profile */}
      <div className="flex items-center gap-2 sm:gap-3.5 ml-auto">
        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => {
              const next = !showNotifs;
              setShowNotifs(next);
              if (next && unreadCount > 0) {
                markAllNotificationsAsRead();
              }
            }}
            className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors focus:outline-none cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 min-w-[20px] h-5 bg-rose-600 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center ring-2 ring-white shadow-xs">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifs && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-3 bg-[#0c532b] text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  <span className="font-semibold text-sm">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {unreadCount > 99 ? '99+' : unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllNotificationsAsRead}
                      className="text-xs text-green-100 hover:text-white underline cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                  {safeNotifications.length > 0 && (
                    <button 
                      onClick={() => clearAllNotifications(role === 'resident' ? currentUser?.id : undefined)}
                      className="text-xs text-rose-200 hover:text-white font-semibold cursor-pointer underline ml-1"
                      title="Clear all notifications"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                {safeNotifications.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm">
                    No new notifications
                  </div>
                ) : (
                  safeNotifications.map((n) => {
                    const isRead = isNotifRead(n);
                    const isResidentAnnouncement = role === 'resident' && isAnnouncementNotification(n);
                    const matchedAnnProgram = isResidentAnnouncement
                      ? resolveProgramFromAnnouncementNotification(n, programs, announcements)
                      : null;
                    return (
                    <div 
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3.5 text-xs hover:bg-emerald-50/50 transition cursor-pointer flex items-start gap-3 group ${!isRead ? 'bg-green-50/40' : ''}`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {n.type === 'status_update' || cleanNotificationTitle(n.title).toLowerCase().startsWith('qualified:') ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                        ) : n.type === 'announcement' ? (
                          <Megaphone className="w-4 h-4 text-blue-600" />
                        ) : (
                          <ShieldCheck className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-semibold text-gray-900 truncate">{cleanNotificationTitle(n.title)}</p>
                          {!isRead && (
                            <span className="w-2 h-2 rounded-full bg-[#0c532b] shrink-0" />
                          )}
                        </div>
                        <p className="text-gray-600 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                        
                        <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-1 border-t border-gray-100/80">
                          <p className="text-gray-500 text-[10px] flex items-center gap-1 font-medium">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <span>{n.timestamp}</span>
                          </p>

                          <div className="flex items-center gap-1.5 ml-auto">
                            {isResidentAnnouncement && matchedAnnProgram && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0c532b] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <ArrowRight className="w-3 h-3" />
                                <span>Apply Now</span>
                              </span>
                            )}

                            {n.documentData && !isResidentAnnouncement && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markNotificationAsRead(n.id);
                                  setActivePaperNotification(n);
                                  setShowNotifs(false);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0c532b] bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 transition cursor-pointer"
                                title="View official printable paper document"
                              >
                                <FileText className="w-3 h-3" />
                                <span>Official Paper</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(n.id);
                              }}
                              className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                              title="Delete notification"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Info with Cartoon Avatar */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-gray-100/80 transition-colors focus:outline-none cursor-pointer"
          >
            <div className="text-right hidden md:block">
              <p className="text-xs sm:text-sm font-bold text-gray-900 leading-tight truncate max-w-[140px]">
                {currentUser?.name || (role === 'admin' ? 'Brgy. Bugo Admin' : 'Resident')}
              </p>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                {role === 'admin' ? (
                  <span className="text-[10px] text-gray-500 font-medium">Administrator</span>
                ) : (
                  <div className="flex items-center gap-1">
                    {currentUser?.isPwd && (
                      <span className="px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 text-[9px] font-bold border border-purple-200">
                        PWD
                      </span>
                    )}
                    {currentUser?.isSenior && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold border border-amber-200">
                        Senior
                      </span>
                    )}
                    {currentUser?.isSoloParent && (
                      <span className="px-1.5 py-0.2 rounded-full bg-pink-100 text-pink-800 text-[9px] font-bold border border-pink-200">
                        Solo Parent
                      </span>
                    )}
                    {currentUser?.isStudent && (
                      <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[9px] font-bold border border-blue-200">
                        Student
                      </span>
                    )}
                    {!currentUser?.isPwd && !currentUser?.isSenior && !currentUser?.isSoloParent && !currentUser?.isStudent && (
                      <span className="text-[10px] text-gray-500 font-medium">
                        {currentUser?.civilStatus || 'Resident'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Circular Avatar */}
            <div className="relative">
              {currentUser?.avatarUrl ? (
                <img 
                  src={currentUser.avatarUrl} 
                  alt={currentUser.name} 
                  className="w-9 h-9 rounded-full object-cover border-2 border-[#0c532b] shadow-xs bg-emerald-50"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#0c532b] border-2 border-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs overflow-hidden">
                  {role === 'admin' ? (
                    <span className="text-[10px] font-extrabold tracking-tight">ADMIN</span>
                  ) : (
                    <span>{currentUser?.name ? currentUser.name.charAt(0) : 'R'}</span>
                  )}
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
          </button>

          {/* User Profile Menu */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-gray-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 text-xs">
              {/* Navigation Actions */}
              <div className="p-1 space-y-0.5 border-b border-gray-100">
                {/* 1. Cartoon Avatar Drawer Trigger */}
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    if (role === 'resident') {
                      setResidentTab('settings');
                    } else {
                      setShowAvatarModal(true);
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-800 hover:bg-emerald-50 hover:text-[#0c532b] rounded-xl font-medium transition cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-[#0c532b]" />
                  <span className="font-bold">{role === 'resident' ? 'Profile & Avatar Settings' : 'Change Avatar'}</span>
                </button>

                {/* 2. Resident Profile / Official Info */}
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowProfileInfoModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-800 hover:bg-gray-100 rounded-xl font-medium transition cursor-pointer"
                >
                  <User className="w-4 h-4 text-gray-500" />
                  <span>
                    {role === 'admin' ? 'Official Profile & Info' : 'Resident Profile'}
                  </span>
                </button>

                {/* 3. Help */}
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    if (role === 'resident') {
                      setResidentTab('help');
                    } else {
                      setAdminTab('help');
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-xl font-semibold transition cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 text-gray-500" />
                  <span>Help</span>
                </button>

                {/* 4. Settings */}
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    if (role === 'resident') {
                      setResidentTab('settings');
                    } else {
                      setAdminTab('settings');
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-xl font-semibold transition cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-gray-500" />
                  <span>Settings</span>
                </button>
              </div>

              {/* 5. Sign Out */}
              <div className="p-1">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Clean Resident Profile Information Modal (No redundant large green ID card, No 'Go to Settings' button) */}
      {showProfileInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-gray-200 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 overflow-hidden flex items-center justify-center">
                  {currentUser?.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-[#0c532b]" />
                  )}
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-gray-900 leading-tight">
                    {currentUser?.name || (role === 'admin' ? 'Administrator' : 'Resident Profile')}
                  </h2>
                  <p className="text-[11px] font-mono text-gray-500">
                    ID: {currentUser?.residentIdNumber || 'Not assigned'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowProfileInfoModal(false)} 
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resident Full System Records & Information */}
            <div className="bg-gray-50 rounded-2xl p-4 sm:p-5 border border-gray-200 space-y-3 text-xs">
              <h3 className="font-bold text-gray-900 flex items-center gap-1.5 pb-2 border-b border-gray-200">
                <FileText className="w-4 h-4 text-[#0c532b]" />
                <span>Citizen Information & Household Profile</span>
              </h3>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <span className="text-gray-400 block text-[11px]">Full Legal Name:</span>
                  <span className="font-bold text-gray-900">{currentUser?.name || 'Not specified'}</span>
                </div>

                <div>
                  <span className="text-gray-400 block text-[11px]">Resident ID Number:</span>
                  <span className="font-mono font-bold text-gray-900">{currentUser?.residentIdNumber || 'Not assigned'}</span>
                </div>

                <div>
                  <span className="text-gray-400 block text-[11px]">Zone / Purok:</span>
                  <span className="font-semibold text-gray-800">{currentUser?.purok || 'Not specified'}</span>
                </div>

                <div>
                  <span className="text-gray-400 block text-[11px]">Complete Address:</span>
                  <span className="font-medium text-gray-800">{currentUser?.address || 'Not specified'}</span>
                </div>

                <div>
                  <span className="text-gray-400 block text-[11px]">Civil Status & Age:</span>
                  <span className="font-semibold text-gray-800">
                    {currentUser?.civilStatus || 'Not specified'}
                    {typeof currentUser?.age === 'number' ? ` • ${currentUser.age} y/o` : ''}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 block text-[11px]">Official ID on File:</span>
                  <span className="font-medium text-gray-800">
                    {currentUser?.idType || 'Not specified'}
                    {currentUser?.idNumber ? ` (${currentUser.idNumber})` : ''}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 block text-[11px]">Contact Phone:</span>
                  <span className="font-semibold text-gray-800">{currentUser?.contactNumber || 'Not specified'}</span>
                </div>

                <div>
                  <span className="text-gray-400 block text-[11px]">Email Address:</span>
                  <span className="font-medium text-gray-800 truncate block">{currentUser?.email || 'Not specified'}</span>
                </div>

                <div>
                  <span className="text-gray-400 block text-[11px]">Monthly Household Income:</span>
                  <span className="font-semibold text-gray-800">{currentUser?.householdIncome || 'Not specified'}</span>
                </div>

                <div>
                  <span className="text-gray-400 block text-[11px]">Dependents in Family:</span>
                  <span className="font-bold text-gray-800">
                    {typeof currentUser?.familyMembersCount === 'number' ? `${currentUser.familyMembersCount} Members` : 'Not specified'}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 block text-[11px]">Primary Occupation:</span>
                  <span className="font-semibold text-gray-800">
                    {currentUser?.occupation || 'Not specified'}
                    {currentUser?.employmentStatus ? ` (${currentUser.employmentStatus})` : ''}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 block text-[11px]">Years of Residency:</span>
                  <span className="font-bold text-gray-900">
                    {typeof currentUser?.yearsOfResidency === 'number' ? `${currentUser.yearsOfResidency} Years in Bugo` : 'Not specified'}
                  </span>
                </div>

                {currentUser?.isPwd && (
                  <div className="col-span-2 p-2.5 rounded-xl bg-purple-50 border border-purple-200">
                    <span className="text-purple-900 font-bold block text-[11px]">PWD Classification:</span>
                    <span className="text-purple-800 font-medium">{currentUser.pwdDisabilityType || 'General Disability'} • ID: {currentUser.pwdIdNumber || 'On file'}</span>
                  </div>
                )}

                {currentUser?.isSoloParent && (
                  <div className="col-span-2 p-2.5 rounded-xl bg-pink-50 border border-pink-200">
                    <span className="text-pink-900 font-bold block text-[11px]">Solo Parent Profile (RA 11861):</span>
                    <span className="text-pink-800 font-medium">Registered Solo Parent • ID: {currentUser.soloParentIdNumber || 'On file'}</span>
                  </div>
                )}

                {currentUser?.isSenior && (
                  <div className="col-span-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="text-amber-900 font-bold block text-[11px]">OSCA Senior Citizen Profile:</span>
                    <span className="text-amber-800 font-medium">Age {currentUser.age || 60}+ • OSCA ID: {currentUser.seniorIdNumber || 'Verified in OSCA Bugo Registry'}</span>
                  </div>
                )}

                {currentUser?.isStudent && (
                  <div className="col-span-2 p-2.5 rounded-xl bg-blue-50 border border-blue-200">
                    <span className="text-blue-900 font-bold block text-[11px]">Enrolled Student Profile:</span>
                    <span className="text-blue-800 font-medium">{currentUser.studentLevel || 'College/University'} • School: {currentUser.schoolName || 'Enrolled in CDO'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowProfileInfoModal(false)}
                className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Picture Upload Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-end">
              <button onClick={() => setShowAvatarModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded-full hover:bg-gray-100 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-center py-1">
              <div className="relative inline-block">
                <div className="w-24 h-24 rounded-full mx-auto border-4 border-[#0c532b] shadow-md overflow-hidden bg-emerald-50 flex items-center justify-center">
                  {currentUser?.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-12 h-12 text-gray-400" />
                  )}
                </div>
                <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white" title="Active Avatar">
                  <CheckCircle className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Hidden File Input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              onChange={handlePhotoUpload} 
              className="hidden" 
            />

            {/* Grid of Avatars with Gender Filter */}
            <div className="space-y-3">
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

              <div className="grid grid-cols-4 gap-2.5">
                {(avatarGenderFilter === 'male' ? MALE_CARTOON_AVATARS : FEMALE_CARTOON_AVATARS).map((preset) => {
                  const isSelected = currentUser?.avatarUrl === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPresetAvatar(preset.url)}
                      className={`relative p-1.5 rounded-2xl border-2 transition transform hover:scale-105 flex flex-col items-center gap-1 cursor-pointer group ${
                        isSelected 
                          ? 'border-[#0c532b] bg-emerald-50 ring-2 ring-emerald-300' 
                          : 'border-gray-200 hover:border-emerald-500 bg-gray-50/50'
                      }`}
                      title={preset.name}
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-white shadow-xs">
                        <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[9px] font-bold text-gray-700 truncate max-w-[65px] block text-center">
                        {preset.name.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-gray-600" />
                  <span>Upload Image</span>
                </button>

                {currentUser?.avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      {/* Short, Simple Notice Modal on Notification Click */}
      {activeNoticeNotification && (
        <NotificationNoticeModal
          notification={activeNoticeNotification}
          onClose={() => setActiveNoticeNotification(null)}
          onViewOfficialPaper={
            activeNoticeNotification.documentData
              ? () => {
                  const target = activeNoticeNotification;
                  setActiveNoticeNotification(null);
                  setActivePaperNotification(target);
                }
              : undefined
          }
        />
      )}

      {/* Official Paper Document Page Modal */}
      {activePaperNotification && (
        <NotificationPaperModal
          notification={activePaperNotification}
          onClose={() => setActivePaperNotification(null)}
          onNavigateToArea={handleNavigateFromPaper}
        />
      )}
    </header>
  );
};
