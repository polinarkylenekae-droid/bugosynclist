import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  FileCheck2, 
  Megaphone, 
  Settings, 
  Archive,
  Plus, 
  FileText, 
  X, 
  Printer,
  CreditCard,
  HelpCircle,
  ClipboardList,
  MapPin,
  FileSpreadsheet
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BugoLogo } from '../BugoLogo';
import { TopNavBar } from '../TopNavBar';
import { AdminDashboardView } from './AdminDashboardView';
import { 
  AdminResidentsView, 
  AdminStatusTrackingView, 
  AdminAnnouncementsView, 
  AdminProgramsView,
  AdminSettingsView 
} from './AdminOperationsViews';
import { AdminArchivesView } from './AdminArchivesView';
import { AdminHelpView } from './AdminHelpView';
import { BugoHazardMapView } from '../maps/BugoHazardMapView';
import { AdminImportExportView } from './AdminImportExportView';
import { BUGO_PUROKS } from '../../data/mockData';
import { isAllowedAccountEmail, normalizeAccountEmail, ALLOWED_EMAIL_DOMAIN_MESSAGE } from '../../utils/emailValidation';
import { evaluatePasswordStrength } from '../../utils/passwordStrength';

export const AdminLayout: React.FC = () => {
  const { 
    adminTab, 
    setAdminTab, 
    addNewResidentRecord,
    addAnnouncement,
    residentsList,
    secretariatDetails
  } = useApp();

  // Modals state
  const [showNewResidentModal, setShowNewResidentModal] = useState(false);
  const [showNewAnnouncementModal, setShowNewAnnouncementModal] = useState(false);
  const [showClearanceModal, setShowClearanceModal] = useState(false);

  // Form states
  const [resForm, setResForm] = useState({ name: '', email: '', password: '', contact: '', purok: BUGO_PUROKS[0], income: '₱8,500.00' });
  const [annForm, setAnnForm] = useState({ title: '', category: 'General' as const, description: '', iconType: 'general' as const });
  const [clearanceForm, setClearanceForm] = useState({ residentName: '', purpose: 'Employment Requirement', issuedDate: new Date().toISOString().split('T')[0] });
  const [clearanceGenerated, setClearanceGenerated] = useState(false);
  const [clearanceControlNo, setClearanceControlNo] = useState('');
  const [clearanceError, setClearanceError] = useState('');

  const [quickModalError, setQuickModalError] = useState('');
  const [isQuickSaving, setIsQuickSaving] = useState(false);

  const handleCreateResident = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickModalError('');
    const cleanEmail = normalizeAccountEmail(resForm.email);
    if (!isAllowedAccountEmail(cleanEmail)) {
      setQuickModalError(ALLOWED_EMAIL_DOMAIN_MESSAGE);
      return;
    }
    const customPass = resForm.password || '';
    if (customPass.trim() !== '') {
      const passEval = evaluatePasswordStrength(customPass);
      if (!passEval.isValid) {
        setQuickModalError(passEval.errorMessage || 'Password must meet all strong security criteria.');
        return;
      }
    }
    setIsQuickSaving(true);
    try {
      const res = await addNewResidentRecord({
        name: resForm.name.trim(),
        email: cleanEmail,
        username: cleanEmail,
        ...(customPass.trim() !== '' ? { password: customPass } : {}),
        contactNumber: resForm.contact.trim(),
        purok: resForm.purok,
        householdIncome: resForm.income
      });
      if (!res.success) {
        setQuickModalError(res.message || 'Could not create resident account.');
        return;
      }
      setShowNewResidentModal(false);
      setResForm({ name: '', email: '', password: '', contact: '', purok: BUGO_PUROKS[0], income: '₱8,500.00' });
    } finally {
      setIsQuickSaving(false);
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickModalError('');
    setIsQuickSaving(true);
    try {
      const res = await addAnnouncement({
        title: annForm.title.trim(),
        category: annForm.category,
        description: annForm.description.trim(),
        date: 'Today',
        iconType: (annForm.category as string) === 'Disaster' ? 'alert' : annForm.iconType,
        status: 'Published',
        targetAudienceType: 'All'
      });
      if (!res.success) {
        setQuickModalError(res.message || 'Could not publish announcement.');
        return;
      }
      setShowNewAnnouncementModal(false);
      setAnnForm({ title: '', category: 'General', description: '', iconType: 'general' });
    } finally {
      setIsQuickSaving(false);
    }
  };

  interface NavItem {
    id: 'dashboard' | 'residents' | 'programs' | 'status-tracking' | 'disaster-aid' | 'hazard-map' | 'records-io' | 'announcements' | 'archives';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'residents', label: 'Resident Account', icon: Users },
    { id: 'programs', label: 'Programs & Aid', icon: ClipboardList },
    { id: 'status-tracking', label: 'Applications', icon: FileCheck2 },
    { id: 'hazard-map', label: 'Hazard Map', icon: MapPin },
    { id: 'records-io', label: 'Import & Export', icon: FileSpreadsheet },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'archives', label: 'Archives', icon: Archive },
  ];

  return (
    <div className="min-h-screen flex bg-[#f0f4f9] text-gray-800 font-sans antialiased">
      {/* Left Sidebar (Hidden on Mobile Web, Visible on Desktop) */}
      <aside className="hidden md:flex w-60 bg-white border-r border-gray-200 flex-col flex-shrink-0 min-h-screen sticky top-0 h-screen z-40">
        <div>
          {/* Brand Logo in sidebar */}
          <div className="p-5 border-b border-gray-100">
            <BugoLogo size="md" />
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = adminTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setAdminTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#0c532b] text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                </button>
              );
            })}

            {/* Help & Settings placed directly below upper navigations */}
            <div className="pt-2 mt-2 border-t border-gray-100 space-y-1">
              <button
                onClick={() => setAdminTab('help')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  adminTab === 'help'
                    ? 'bg-[#0c532b] text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
                }`}
              >
                <HelpCircle className={`w-4 h-4 ${adminTab === 'help' ? 'text-white' : 'text-gray-500'}`} />
                <span>Help & Support</span>
              </button>

              <button
                onClick={() => setAdminTab('settings')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  adminTab === 'settings'
                    ? 'bg-[#0c532b] text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Settings className={`w-4 h-4 ${adminTab === 'settings' ? 'text-white' : 'text-gray-500'}`} />
                  <span>Settings</span>
                </div>
                {(() => {
                  const pendingCount = residentsList.filter(
                    r => r.role === 'resident' && r.pendingProfileUpdate?.status === 'Pending'
                  ).length;
                  return pendingCount > 0 ? (
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                        adminTab === 'settings'
                          ? 'bg-white/20 text-white'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {pendingCount}
                    </span>
                  ) : null;
                })()}
              </button>
            </div>
          </nav>
        </div>
      </aside>

      {/* Main Administrative Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <TopNavBar />

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-5 md:p-8 pb-24 md:pb-8 max-w-7xl w-full mx-auto">
          {adminTab === 'dashboard' && (
            <AdminDashboardView 
              onNavigateTab={(tab) => setAdminTab(tab)}
              onOpenNewResidentModal={() => setShowNewResidentModal(true)}
              onOpenNewAnnouncementModal={() => setShowNewAnnouncementModal(true)}
              onOpenClearanceModal={() => {
                const defaultResidentName = residentsList.find(r => r.role === 'resident')?.name || residentsList[0]?.name || '';
                setClearanceForm(prev => ({
                  ...prev,
                  residentName: prev.residentName && residentsList.some(r => r.name === prev.residentName) ? prev.residentName : defaultResidentName,
                }));
                setClearanceError('');
                setClearanceGenerated(false);
                setShowClearanceModal(true);
              }}
            />
          )}

          {adminTab === 'residents' && (
            <AdminResidentsView />
          )}

          {(adminTab === 'programs' || adminTab === 'disaster-aid') && (
            <AdminProgramsView />
          )}

          {adminTab === 'status-tracking' && (
            <AdminStatusTrackingView />
          )}

          {adminTab === 'hazard-map' && (
            <BugoHazardMapView canManage={true} />
          )}

          {adminTab === 'records-io' && (
            <AdminImportExportView />
          )}

          {adminTab === 'announcements' && (
            <AdminAnnouncementsView />
          )}

          {adminTab === 'archives' && (
            <AdminArchivesView />
          )}

          {adminTab === 'help' && (
            <AdminHelpView />
          )}

          {adminTab === 'settings' && (
            <AdminSettingsView />
          )}
        </main>

        {/* Mobile Bottom Quick Navigation Bar for Admin (Hidden on Desktop) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 z-40 px-2 py-1.5 flex items-center justify-around shadow-lg">
          <button
            onClick={() => setAdminTab('dashboard')}
            className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition ${adminTab === 'dashboard' ? 'text-[#0c532b] font-bold' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="text-[9px]">Dashboard</span>
          </button>
          <button
            onClick={() => setAdminTab('residents')}
            className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl relative transition ${adminTab === 'residents' ? 'text-[#0c532b] font-bold' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Users className="w-4 h-4" />
            <span className="text-[9px] truncate max-w-[68px]">Resident Account</span>
          </button>
          <button
            onClick={() => setAdminTab('programs')}
            className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition ${adminTab === 'programs' ? 'text-[#0c532b] font-bold' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <ClipboardList className="w-4 h-4" />
            <span className="text-[9px]">Programs</span>
          </button>
          <button
            onClick={() => setAdminTab('status-tracking')}
            className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition ${adminTab === 'status-tracking' ? 'text-[#0c532b] font-bold' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <FileCheck2 className="w-4 h-4" />
            <span className="text-[9px]">Tracking</span>
          </button>
          <button
            onClick={() => setAdminTab('hazard-map')}
            className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition ${adminTab === 'hazard-map' ? 'text-[#0c532b] font-bold' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <MapPin className="w-4 h-4" />
            <span className="text-[9px]">Map</span>
          </button>
          <button
            onClick={() => setAdminTab('records-io')}
            className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition ${adminTab === 'records-io' ? 'text-[#0c532b] font-bold' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="text-[9px]">Records</span>
          </button>
        </div>
      </div>

      {/* Modal 1: Register Resident Modal */}
      {showNewResidentModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Register Resident Manually</h2>
              <button
                type="button"
                onClick={() => { setQuickModalError(''); setShowNewResidentModal(false); }}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {quickModalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
                {quickModalError}
              </div>
            )}

            <form onSubmit={handleCreateResident} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Juan Carlos Dela Cruz"
                  value={resForm.name}
                  onChange={(e) => setResForm({ ...resForm, name: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-medium outline-none focus:ring-2 focus:ring-[#0c532b]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Username</label>
                <input
                  type="email"
                  required
                  placeholder="resident@gmail.com or name@bugo.gov.ph"
                  value={resForm.email}
                  onChange={(e) => setResForm({ ...resForm, email: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-medium outline-none focus:ring-2 focus:ring-[#0c532b]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Portal Password (Optional)</label>
                <input
                  type="password"
                  placeholder="Defaults to Resident@Bugo2026!"
                  value={resForm.password}
                  onChange={(e) => setResForm({ ...resForm, password: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-medium outline-none focus:ring-2 focus:ring-[#0c532b]"
                />
                <p className="text-[10px] text-gray-500 mt-0.5">Leave blank for Resident@Bugo2026!, or enter a strong 8+ char password.</p>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Contact Number</label>
                <input
                  type="text"
                  required
                  placeholder="0917 123 4567"
                  value={resForm.contact}
                  onChange={(e) => setResForm({ ...resForm, contact: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-medium outline-none focus:ring-2 focus:ring-[#0c532b]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Purok / Zone</label>
                <select
                  value={resForm.purok}
                  onChange={(e) => setResForm({ ...resForm, purok: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-semibold outline-none focus:ring-2 focus:ring-[#0c532b]"
                >
                  {BUGO_PUROKS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isQuickSaving}
                  onClick={() => { setQuickModalError(''); setShowNewResidentModal(false); }}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isQuickSaving}
                  className="flex-1 py-2.5 bg-[#0c532b] hover:bg-[#094222] disabled:opacity-60 text-white font-bold rounded-xl transition shadow-xs cursor-pointer"
                >
                  {isQuickSaving ? 'Saving...' : 'Save Resident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Create Announcement Modal */}
      {showNewAnnouncementModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Broadcast Announcement</h2>
              <button
                type="button"
                onClick={() => { setQuickModalError(''); setShowNewAnnouncementModal(false); }}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {quickModalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
                {quickModalError}
              </div>
            )}

            <form onSubmit={handleCreateAnnouncement} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Water Interruption Notice"
                  value={annForm.title}
                  onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-medium outline-none focus:ring-2 focus:ring-[#0c532b]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Category</label>
                <select
                  value={annForm.category}
                  onChange={(e) => setAnnForm({ ...annForm, category: e.target.value as any })}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-semibold outline-none focus:ring-2 focus:ring-[#0c532b]"
                >
                  <option value="General">General Notice</option>
                  <option value="Disaster">Disaster &amp; Emergency Alert</option>
                  <option value="Water">Water Interruption</option>
                  <option value="Health">Health & Medical</option>
                  <option value="Sports">Sports & SK</option>
                  <option value="Assembly">Barangay Assembly</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Details</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Announcement description for citizens..."
                  value={annForm.description}
                  onChange={(e) => setAnnForm({ ...annForm, description: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 font-medium outline-none focus:ring-2 focus:ring-[#0c532b]"
                />
              </div>

              <button
                type="submit"
                disabled={isQuickSaving}
                className="w-full py-2.5 bg-[#0c532b] hover:bg-[#094222] disabled:opacity-60 text-white font-bold rounded-xl transition shadow-xs cursor-pointer"
              >
                {isQuickSaving ? 'Publishing...' : 'Publish Notice'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Official Barangay Clearance Generator */}
      {showClearanceModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-gray-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Official Barangay Clearance Generator</h2>
              <button onClick={() => setShowClearanceModal(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!clearanceGenerated ? (
              <div className="space-y-3 text-xs">
                {clearanceError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
                    {clearanceError}
                  </div>
                )}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Select Resident</label>
                  <select
                    value={clearanceForm.residentName}
                    onChange={(e) => {
                      setClearanceError('');
                      setClearanceForm({ ...clearanceForm, residentName: e.target.value });
                    }}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-semibold outline-none focus:ring-2 focus:ring-[#0c532b]"
                  >
                    <option value="">Select a resident</option>
                    {residentsList.map(r => (
                      <option key={r.id} value={r.name}>{r.name} ({r.residentIdNumber})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Purpose of Clearance</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Local Employment Requirement, Postal ID, Bank Account"
                    value={clearanceForm.purpose}
                    onChange={(e) => {
                      setClearanceError('');
                      setClearanceForm({ ...clearanceForm, purpose: e.target.value });
                    }}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-medium outline-none focus:ring-2 focus:ring-[#0c532b]"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!clearanceForm.residentName.trim()) {
                      setClearanceError('Please select a resident first.');
                      return;
                    }
                    if (!clearanceForm.purpose.trim()) {
                      setClearanceError('Please specify the purpose of the clearance.');
                      return;
                    }
                    setClearanceError('');
                    setClearanceControlNo(`BG-CLR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
                    setClearanceGenerated(true);
                  }}
                  className="w-full py-2.5 bg-[#0c532b] hover:bg-[#094222] text-white font-bold rounded-xl transition shadow-xs cursor-pointer"
                >
                  Generate Stamped Certificate
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Official Stamped Document Preview */}
                <div className="p-8 bg-white border-2 border-double border-gray-400 rounded-2xl text-center space-y-4 font-serif text-gray-800 printable-document shadow-sm">
                  <div className="text-xs font-bold text-gray-600 uppercase tracking-widest leading-relaxed">
                    Republic of the Philippines<br />
                    Province of Misamis Oriental • City of Cagayan de Oro<br />
                    <strong className="text-gray-900 font-extrabold font-sans text-sm">OFFICE OF THE PUNONG BARANGAY • BARANGAY BUGO</strong>
                  </div>
                  <div className="w-16 h-0.5 bg-[#0c532b] mx-auto my-2" />
                  <h3 className="text-base font-extrabold uppercase tracking-wider text-[#0c532b]">
                    BARANGAY CLEARANCE & RESIDENCY CERTIFICATION
                  </h3>
                  <p className="text-xs leading-relaxed text-gray-700 text-justify px-4 indent-8">
                    TO WHOM IT MAY CONCERN: This is to certify that <strong>{clearanceForm.residentName}</strong>, of legal age, is a bona fide resident of {secretariatDetails.lguUnit}. According to records of this office, the subject individual is verified, maintains good moral character, and is in good community standing with no pending administrative holds.
                  </p>
                  <div className="text-left text-[11px] text-gray-700 px-4 pt-2 space-y-1">
                    <p><strong>Purpose of Issuance:</strong> {clearanceForm.purpose}</p>
                    <p><strong>Official Control No:</strong> {clearanceControlNo}</p>
                    <p><strong>Date Issued:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <div className="pt-6 flex justify-between items-end text-xs px-4">
                    <div className="text-left">
                      <div className="w-16 h-16 rounded-full border-2 border-emerald-800 border-dashed flex items-center justify-center text-[9px] text-emerald-900 font-bold uppercase text-center p-1">
                        OFFICIAL SEAL
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 font-sans">Barangay Bugo Dry Seal</p>
                    </div>
                    <div className="text-center">
                      <p className="font-extrabold text-gray-900 border-t border-gray-800 pt-1 tracking-wide">{secretariatDetails.punongBarangay.toUpperCase()}</p>
                      <p className="text-[11px] text-gray-500 font-sans">Punong Barangay</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 no-print">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex-1 py-2.5 bg-[#0c532b] hover:bg-[#094222] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Official Clearance</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearanceModal(false)}
                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
