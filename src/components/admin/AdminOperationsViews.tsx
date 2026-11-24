import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileText, 
  Eye, 
  EyeOff,
  Check, 
  X, 
  AlertCircle, 
  UserCheck, 
  ChevronRight, 
  Plus, 
  Calendar, 
  MapPin, 
  Mail, 
  ShieldCheck, 
  RefreshCw,
  Paperclip,
  Ban,
  ShieldAlert,
  ZoomIn,
  CreditCard,
  Building,
  CheckCircle,
  QrCode,
  Lock,
  AlertTriangle,
  Archive,
  Briefcase,
  Trash2,
  ArrowLeft,
  Flame,
  Pencil,
  Download,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ApplicationStatus, AssistanceApplication, AssistanceProgram, DisasterCategory, ProgramCategory, ProgramQualificationRules, ProgramQualificationSector, ResidentUser, AnnouncementItem } from '../../types';
import { BUGO_PUROKS, MONTHLY_INCOME_OPTIONS, NATIONALITY_OPTIONS } from '../../data/mockData';
import { AnnouncementModal } from '../AnnouncementModal';
import { DocumentPreviewModal } from '../DocumentPreviewModal';
import { ChangePasswordSection } from '../settings/ChangePasswordSection';
import {
  doesVictimQualifyForDisasterProgram,
  evaluateCertificateQualification,
  evaluateResidentForProgram,
  formatEligibilityCriteriaFromRules,
  getDefaultQualificationRulesForProgram,
  isApplyOnlyProgram,
  isBarangayServiceApplicationItem,
  isCertificateProgram,
  isDisasterProgram,
  isWalkInOrOnDemandService
} from '../../utils/eligibilityEngine';
import { sortProgramsAlphabetically, sortProgramsApplyFirst, sortApplicationsFCFS, formatShortQueueDateTime } from '../../utils/sortUtils';
import { isAllowedAccountEmail, normalizeAccountEmail, ALLOWED_EMAIL_DOMAIN_MESSAGE } from '../../utils/emailValidation';
import { normalizePhMobileNumber } from '../../utils/phoneValidation';
import { evaluatePasswordStrength } from '../../utils/passwordStrength';
import { AdminDisasterVictimsView } from './AdminDisasterVictimsView';


// ----------------------------------------------------
// 1. ADMIN RESIDENTS VIEW & REGISTRATION APPROVAL
// ----------------------------------------------------
export const AdminResidentsView: React.FC = () => {
  const { 
    currentUser,
    residentsList, 
    banResidentAccount,
    unbanResidentAccount,
    reviewProfileChangeRequest,
    addNewResidentRecord,
    updateResidentAccount,
    deleteResidentAccount,
    deleteResidentAccounts,
    selectedZoneForRegistry,
    setSelectedZoneForRegistry
  } = useApp();

  const [filterPurok, setFilterPurok] = useState(selectedZoneForRegistry ? selectedZoneForRegistry.split(' - ')[0] : 'All');

  useEffect(() => {
    if (selectedZoneForRegistry) {
      setFilterPurok(selectedZoneForRegistry.split(' - ')[0]);
      setSelectedZoneForRegistry(null);
    }
  }, [selectedZoneForRegistry, setSelectedZoneForRegistry]);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Verified' | 'Banned'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResident, setSelectedResident] = useState<ResidentUser | null>(null);
  const [zoomedIdDoc, setZoomedIdDoc] = useState<{ title: string; url: string; type: string } | null>(null);
  const [profileRejectReason, setProfileRejectReason] = useState('');
  const [isReviewingProfileEdit, setIsReviewingProfileEdit] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [residentToBan, setResidentToBan] = useState<ResidentUser | null>(null);
  const [banReasonInput, setBanReasonInput] = useState('Violation of barangay policy / unverified residency');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Selection & Deletion State
  const [selectedResidentIds, setSelectedResidentIds] = useState<string[]>([]);
  const [residentToDelete, setResidentToDelete] = useState<ResidentUser | null>(null);
  const [isBulkDeleteResidentsOpen, setIsBulkDeleteResidentsOpen] = useState(false);
  const [isDeletingResidents, setIsDeletingResidents] = useState(false);
  const selectAllResidentsRef = useRef<HTMLInputElement | null>(null);

  // Manual Add Resident Modal State
  const [showAddResidentModal, setShowAddResidentModal] = useState(false);
  const [isAddingResident, setIsAddingResident] = useState(false);
  const [addModalError, setAddModalError] = useState('');
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    contactNumber: '',
    purok: BUGO_PUROKS[0],
    address: '',
    householdIncome: MONTHLY_INCOME_OPTIONS[2],
    familyMembersCount: 4,
    occupation: '',
    employmentStatus: 'Employed (Full-Time)' as NonNullable<ResidentUser['employmentStatus']>,
    civilStatus: 'Single' as NonNullable<ResidentUser['civilStatus']>,
    age: 28,
    gender: 'Male' as 'Male' | 'Female',
    voterStatus: 'Registered' as 'Registered' | 'Unregistered',
    nationality: 'Filipino',
    isPwd: false,
    isSenior: false,
    isSoloParent: false,
    isStudent: false,
    isTeenager: false,
    isVerified: true
  });

  // Edit Resident Modal State
  const [editingResident, setEditingResident] = useState<ResidentUser | null>(null);
  const [isUpdatingResident, setIsUpdatingResident] = useState(false);
  const [editModalError, setEditModalError] = useState('');
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    contactNumber: '',
    purok: BUGO_PUROKS[0],
    address: '',
    householdIncome: MONTHLY_INCOME_OPTIONS[2],
    familyMembersCount: 4,
    occupation: '',
    employmentStatus: 'Employed (Full-Time)' as NonNullable<ResidentUser['employmentStatus']>,
    civilStatus: 'Single' as NonNullable<ResidentUser['civilStatus']>,
    age: 28,
    gender: 'Male' as 'Male' | 'Female',
    voterStatus: 'Registered' as 'Registered' | 'Unregistered',
    nationality: 'Filipino',
    isVerified: true,
    registrationStatus: 'Verified' as NonNullable<ResidentUser['registrationStatus']>,
    isPwd: false,
    isSenior: false,
    isSoloParent: false,
    isStudent: false,
    isTeenager: false
  });

  const canModifyResident = (res: ResidentUser) =>
    res.role !== 'admin' && res.id !== currentUser?.id;

  const filteredResidents = residentsList.filter(res => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = (res.name || '').toLowerCase().includes(q) || 
                          (res.email || '').toLowerCase().includes(q) ||
                          (res.residentIdNumber || '').toLowerCase().includes(q) ||
                          Boolean(res.occupation && res.occupation.toLowerCase().includes(q)) ||
                          Boolean(res.idNumber && res.idNumber.toLowerCase().includes(q));
    const matchesPurok = filterPurok === 'All' || (res.purok || '').split(' - ')[0].trim() === filterPurok;
    const matchesStatus = filterStatus === 'All' 
      ? true 
      : filterStatus === 'Banned'
      ? (res.isBanned || res.registrationStatus === 'Banned')
      : !res.isBanned && res.registrationStatus !== 'Banned';

    return matchesSearch && matchesPurok && matchesStatus;
  });

  const deletableVisibleResidentIds = useMemo(
    () => filteredResidents.filter(canModifyResident).map(r => r.id),
    [filteredResidents, currentUser?.id]
  );
  const selectedResidentIdSet = useMemo(() => new Set(selectedResidentIds), [selectedResidentIds]);
  const selectedVisibleResidentsCount = useMemo(
    () => deletableVisibleResidentIds.filter(id => selectedResidentIdSet.has(id)).length,
    [deletableVisibleResidentIds, selectedResidentIdSet]
  );
  const allVisibleResidentsSelected =
    deletableVisibleResidentIds.length > 0 &&
    selectedVisibleResidentsCount === deletableVisibleResidentIds.length;
  const someVisibleResidentsSelected =
    selectedVisibleResidentsCount > 0 && !allVisibleResidentsSelected;
  const selectedResidentsForDelete = useMemo(
    () => residentsList.filter(r => selectedResidentIdSet.has(r.id) && canModifyResident(r)),
    [residentsList, selectedResidentIdSet, currentUser?.id]
  );

  useEffect(() => {
    const activeDeletableIds = new Set(residentsList.filter(canModifyResident).map(r => r.id));
    setSelectedResidentIds(prev => {
      const next = prev.filter(id => activeDeletableIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [residentsList, currentUser?.id]);

  useEffect(() => {
    if (selectAllResidentsRef.current) {
      selectAllResidentsRef.current.indeterminate = someVisibleResidentsSelected;
    }
  }, [someVisibleResidentsSelected]);

  const toggleSelectResident = (residentId: string) => {
    setSelectedResidentIds(prev =>
      prev.includes(residentId) ? prev.filter(id => id !== residentId) : [...prev, residentId]
    );
  };

  const toggleSelectAllVisibleResidents = () => {
    if (deletableVisibleResidentIds.length === 0) return;
    if (allVisibleResidentsSelected) {
      const visibleSet = new Set(deletableVisibleResidentIds);
      setSelectedResidentIds(prev => prev.filter(id => !visibleSet.has(id)));
    } else {
      setSelectedResidentIds(prev => Array.from(new Set([...prev, ...deletableVisibleResidentIds])));
    }
  };

  const openAddResidentModal = () => {
    setFeedback(null);
    setAddForm({
      name: '',
      email: '',
      username: '',
      password: '',
      contactNumber: '',
      purok: BUGO_PUROKS[0],
      address: '',
      householdIncome: MONTHLY_INCOME_OPTIONS[2],
      familyMembersCount: 4,
      occupation: '',
      employmentStatus: 'Employed (Full-Time)',
      civilStatus: 'Single',
      age: 28,
      gender: 'Male',
      voterStatus: 'Registered',
      nationality: 'Filipino',
      isPwd: false,
      isSenior: false,
      isSoloParent: false,
      isStudent: false,
      isTeenager: false,
      isVerified: true
    });
    setAddModalError('');
    setShowAddResidentModal(true);
  };

  const openEditResidentModal = (res: ResidentUser) => {
    setFeedback(null);
    setEditModalError('');
    setEditingResident(res);
    setEditForm({
      name: res.name || '',
      email: res.email || '',
      contactNumber: res.contactNumber || '',
      purok: res.purok || BUGO_PUROKS[0],
      address: res.address || '',
      householdIncome: res.householdIncome || MONTHLY_INCOME_OPTIONS[2],
      familyMembersCount: res.familyMembersCount || 1,
      occupation: res.occupation || '',
      employmentStatus: res.employmentStatus || 'Self-Employed',
      civilStatus: res.civilStatus || 'Single',
      age: res.age || 28,
      gender: res.gender || 'Male',
      voterStatus: res.voterStatus || 'Registered',
      nationality: res.nationality || 'Filipino',
      isVerified: Boolean(res.isVerified ?? true),
      registrationStatus: res.isBanned ? 'Banned' : (res.registrationStatus === 'Pending Approval' ? 'Verified' : (res.registrationStatus || 'Verified')),
      isPwd: Boolean(res.isPwd),
      isSenior: Boolean(res.isSenior),
      isSoloParent: Boolean(res.isSoloParent),
      isStudent: Boolean(res.isStudent),
      isTeenager: Boolean(res.isTeenager)
    });
  };

  const handleAddResidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddModalError('');
    const cleanEmail = normalizeAccountEmail(addForm.email);
    if (!addForm.name.trim() || !cleanEmail) {
      setAddModalError('Resident full name and email address are required.');
      return;
    }
    if (!isAllowedAccountEmail(cleanEmail)) {
      setAddModalError(ALLOWED_EMAIL_DOMAIN_MESSAGE);
      return;
    }
    const customPass = addForm.password || '';
    if (customPass.trim() !== '') {
      const passEval = evaluatePasswordStrength(customPass);
      if (!passEval.isValid) {
        setAddModalError(passEval.errorMessage || 'Password must meet all strong security criteria (8+ chars, uppercase, lowercase, number, special symbol).');
        return;
      }
    }
    let normalizedContact = '';
    if (addForm.contactNumber.trim()) {
      const phoneCheck = normalizePhMobileNumber(addForm.contactNumber);
      if (!phoneCheck.valid) {
        setAddModalError(phoneCheck.reason || 'Please enter a valid 11-digit Philippine mobile number (e.g. 0917 628 4915).');
        return;
      }
      normalizedContact = addForm.contactNumber.trim().startsWith('+') ? phoneCheck.e164 : phoneCheck.local09;
    }
    setIsAddingResident(true);
    const res = await addNewResidentRecord({
      ...addForm,
      name: addForm.name.trim(),
      email: cleanEmail,
      username: cleanEmail,
      ...(customPass.trim() !== '' ? { password: customPass } : { password: '' }),
      contactNumber: normalizedContact,
      address: addForm.address.trim() || `${addForm.purok}, Barangay Bugo, Cagayan de Oro City`,
      occupation: addForm.occupation.trim() || 'Resident'
    });
    setIsAddingResident(false);
    if (res.success && res.user) {
      setShowAddResidentModal(false);
      setFeedback({
        type: 'success',
        message: `Added resident "${res.user.name}" (${res.user.residentIdNumber}). Username saved: ${res.user.email} (${customPass.trim() !== '' ? 'custom password saved' : 'default password: Resident@Bugo2026!'}).`
      });
    } else {
      const msg = res.message || 'Could not add resident record.';
      setAddModalError(msg);
      setFeedback({ type: 'error', message: msg });
    }
  };

  const handleEditResidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditModalError('');
    if (!editingResident || !editForm.name.trim()) return;
    const cleanEmail = normalizeAccountEmail(editForm.email);
    if (!isAllowedAccountEmail(cleanEmail)) {
      setEditModalError(ALLOWED_EMAIL_DOMAIN_MESSAGE);
      return;
    }
    let normalizedContact = '';
    if (editForm.contactNumber.trim()) {
      const phoneCheck = normalizePhMobileNumber(editForm.contactNumber);
      if (!phoneCheck.valid) {
        setEditModalError(phoneCheck.reason || 'Please enter a valid 11-digit Philippine mobile number (e.g. 0917 628 4915).');
        return;
      }
      normalizedContact = editForm.contactNumber.trim().startsWith('+') ? phoneCheck.e164 : phoneCheck.local09;
    }
    setIsUpdatingResident(true);
    const res = await updateResidentAccount(editingResident.id, {
      ...editForm,
      name: editForm.name.trim(),
      email: cleanEmail,
      contactNumber: normalizedContact,
      address: editForm.address.trim(),
      occupation: editForm.occupation.trim()
    });
    setIsUpdatingResident(false);
    if (res.success && res.user) {
      if (selectedResident?.id === res.user.id) {
        setSelectedResident(res.user);
      }
      setEditingResident(null);
      setFeedback({
        type: 'success',
        message: `Updated "${res.user.name}" and synced changes to resident account & linked applications.`
      });
    } else {
      const msg = res.message || 'Could not update resident account.';
      setEditModalError(msg);
      setFeedback({ type: 'error', message: msg });
    }
  };

  const bannedCount = residentsList.filter(r => r.isBanned || r.registrationStatus === 'Banned').length;

  const handleOpenBanModal = (res: ResidentUser) => {
    setResidentToBan(res);
    setBanReasonInput('Violation of barangay residency criteria or fraudulent submission');
    setShowBanModal(true);
  };

  const handleConfirmBan = () => {
    if (!residentToBan) return;
    banResidentAccount(residentToBan.id, banReasonInput);
    setShowBanModal(false);
    setResidentToBan(null);
    if (selectedResident && selectedResident.id === residentToBan.id) {
      setSelectedResident(null);
    }
  };

  const handleUnban = (res: ResidentUser) => {
    unbanResidentAccount(res.id);
    if (selectedResident && selectedResident.id === res.id) {
      setSelectedResident(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Resident Account
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={openAddResidentModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0c532b] hover:bg-[#094222] text-white text-xs font-semibold rounded-lg transition shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Resident</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-medium flex items-center justify-between gap-2 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-gray-400 hover:text-gray-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name, email, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#0c532b]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Tabs */}
            <div className="flex items-center bg-gray-100 p-1 rounded-lg text-xs font-medium tabular-nums">
              <button
                onClick={() => setFilterStatus('All')}
                className={`px-3 py-1 rounded-md transition whitespace-nowrap cursor-pointer ${
                  filterStatus === 'All' ? 'bg-white text-gray-900 shadow-2xs font-semibold' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All · {residentsList.length}
              </button>
              <button
                onClick={() => setFilterStatus('Verified')}
                className={`px-3 py-1 rounded-md transition whitespace-nowrap cursor-pointer ${
                  filterStatus === 'Verified' ? 'bg-white text-gray-900 shadow-2xs font-semibold' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Verified
              </button>
              <button
                onClick={() => setFilterStatus('Banned')}
                className={`px-3 py-1 rounded-md transition whitespace-nowrap cursor-pointer ${
                  filterStatus === 'Banned' ? 'bg-rose-700 text-white shadow-2xs font-semibold' : 'text-gray-600 hover:text-rose-700'
                }`}
              >
                Banned{bannedCount > 0 ? ` · ${bannedCount}` : ''}
              </button>
            </div>

            {/* Purok Filter */}
            <select
              value={filterPurok}
              onChange={(e) => setFilterPurok(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 outline-none focus:ring-2 focus:ring-[#0c532b]"
            >
              <option value="All">All Zones</option>
              {BUGO_PUROKS.map(p => (
                <option key={p} value={p.split(' - ')[0]}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Residents Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {deletableVisibleResidentIds.length > 0 && (
          <div className={`px-4 py-2.5 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 transition ${
            selectedResidentIds.length > 0 ? 'bg-rose-50/70' : 'bg-gray-50/60'
          }`}>
            <div className="flex items-center gap-3 text-xs">
              <label className="inline-flex items-center gap-2 font-semibold text-gray-700 hover:text-gray-900 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allVisibleResidentsSelected}
                  onChange={toggleSelectAllVisibleResidents}
                  aria-label="Select all visible residents"
                  className="w-4 h-4 rounded border-gray-300 text-[#0c532b] focus:ring-[#0c532b] cursor-pointer accent-[#0c532b]"
                />
                <span>
                  {allVisibleResidentsSelected
                    ? `Deselect All (${deletableVisibleResidentIds.length})`
                    : `Select All (${deletableVisibleResidentIds.length})`}
                </span>
              </label>

              {selectedResidentIds.length > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="font-bold text-rose-700 tabular-nums">
                    {selectedResidentIds.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedResidentIds([])}
                    className="text-xs font-semibold text-gray-500 hover:text-gray-800 underline cursor-pointer"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>

            {selectedResidentIds.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFeedback(null);
                  setIsBulkDeleteResidentsOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition shadow-2xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedResidentIds.length})</span>
              </button>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
              <tr>
                <th className="pl-4 pr-2 py-3 w-10">
                  <input
                    ref={selectAllResidentsRef}
                    type="checkbox"
                    checked={allVisibleResidentsSelected}
                    disabled={deletableVisibleResidentIds.length === 0}
                    onChange={toggleSelectAllVisibleResidents}
                    aria-label="Select all residents in table"
                    className="w-4 h-4 rounded border-gray-300 text-[#0c532b] focus:ring-[#0c532b] cursor-pointer accent-[#0c532b] disabled:opacity-40"
                  />
                </th>
                <th className="px-4 py-3">Resident</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredResidents.map((res) => {
                const hasPendingProfileEdit = res.pendingProfileUpdate?.status === 'Pending';
                const isBanned = res.isBanned || res.registrationStatus === 'Banned';
                const canModify = canModifyResident(res);
                const isChecked = canModify && selectedResidentIdSet.has(res.id);

                const metaParts = [
                  res.civilStatus || 'Single',
                  res.occupation || 'Resident',
                  ...(res.idType || res.idNumber
                    ? [`${res.idType || 'Valid ID'}${res.idNumber ? `: ${res.idNumber}` : ''}`]
                    : []),
                  ...(res.isPwd ? ['PWD'] : []),
                  ...((res.isSenior || (res.age || 0) >= 60) ? ['Senior'] : []),
                  ...(res.isSoloParent ? ['Solo Parent'] : []),
                  ...((res.isStudent || res.employmentStatus === 'Student') ? ['Student'] : []),
                  ...(res.isTeenager && !res.isSenior && ((res.age || 0) < 60) ? ['Youth'] : [])
                ];

                return (
                  <tr key={res.id} className={`transition ${isChecked ? 'bg-rose-50/40 hover:bg-rose-50/60' : isBanned ? 'bg-rose-50/30 hover:bg-rose-50/50' : 'hover:bg-gray-50/70'}`}>
                    <td className="pl-4 pr-2 py-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={!canModify}
                        onChange={() => canModify && toggleSelectResident(res.id)}
                        aria-label={`Select ${res.name}`}
                        title={canModify ? `Select ${res.name}` : 'Admin / active session protected'}
                        className="w-4 h-4 rounded border-gray-300 text-[#0c532b] focus:ring-[#0c532b] cursor-pointer accent-[#0c532b] disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full font-bold flex items-center justify-center text-xs overflow-hidden shrink-0 ${
                          isBanned ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-[#0c532b]/10 text-[#0c532b]'
                        }`}>
                          {res.avatarUrl ? (
                            <img src={res.avatarUrl} alt={res.name} className="w-full h-full object-cover" />
                          ) : (
                            res.name.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-semibold text-gray-900 flex items-center gap-1.5">
                            <span className="truncate">{res.name}</span>
                            {isBanned && (
                              <span className="text-[10px] font-bold text-rose-700 uppercase">Banned</span>
                            )}
                          </p>
                          <p className="text-[11px] text-gray-500 truncate">{res.email} · {res.contactNumber}</p>
                          <p className="text-[11px] text-gray-400 truncate">{metaParts.join(' · ')}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="space-y-0.5">
                        {isBanned ? (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-rose-700">
                            <Ban className="w-3.5 h-3.5" />
                            <span>Banned</span>
                          </span>
                        ) : res.registrationStatus === 'Rejected' ? (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-gray-600">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Rejected</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verified</span>
                          </span>
                        )}
                        {res.registrationStatus === 'Rejected' && res.rejectionReason && (
                          <span className="block text-[10px] text-rose-600 truncate max-w-[150px]" title={res.rejectionReason}>
                            {res.rejectionReason}
                          </span>
                        )}
                        {hasPendingProfileEdit && (
                          <span className="block text-[11px] font-medium text-amber-700">
                            Edit Pending
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* 0. If Pending Profile Edit -> Review Changes */}
                        {hasPendingProfileEdit && (
                          <button
                            onClick={() => {
                              setProfileRejectReason('');
                              setSelectedResident(res);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg transition shadow-xs cursor-pointer"
                            title="Review and approve resident profile changes"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Review Edits</span>
                          </button>
                        )}

                        {/* 3. If Banned -> Unban Action */}
                        {isBanned && (
                          <button
                            onClick={() => handleUnban(res)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-lg transition shadow-xs cursor-pointer"
                            title="Unban this resident account"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Unban Account</span>
                          </button>
                        )}

                        {/* 4. Ban Account Button (if not already banned and not admin/self) */}
                        {!isBanned && canModify && (
                          <button
                            onClick={() => handleOpenBanModal(res)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold rounded-lg border border-rose-200 transition cursor-pointer"
                            title="Ban resident account from system"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Ban</span>
                          </button>
                        )}

                        {/* 5. Edit Account */}
                        <button
                          type="button"
                          onClick={() => openEditResidentModal(res)}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#0c532b] font-semibold text-[11px] rounded-lg border border-emerald-200 transition inline-flex items-center gap-1 cursor-pointer"
                          title="Edit resident account details"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        {/* 6. View Full Profile Modal */}
                        <button
                          onClick={() => {
                            setProfileRejectReason('');
                            setSelectedResident(res);
                          }}
                          className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-[11px] rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Profile</span>
                        </button>

                        {/* 7. Delete Non-Admin Resident */}
                        {canModify && (
                          <button
                            type="button"
                            onClick={() => {
                              setFeedback(null);
                              setResidentToDelete(res);
                            }}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                            title="Delete resident account"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Ban Account Modal */}
      {showBanModal && residentToBan && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-rose-700">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="text-base font-extrabold text-gray-900">Ban Resident Account</h3>
              </div>
              <button onClick={() => setShowBanModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 space-y-1">
              <p className="font-bold">Are you sure you want to ban {residentToBan.name}?</p>
              <p className="text-[11px] text-rose-700 leading-relaxed">
                This resident will be blocked from logging into the portal and applying for barangay services until unbanned by an administrator.
              </p>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Official Grounds / Ban Reason</label>
              <textarea
                rows={3}
                required
                value={banReasonInput}
                onChange={(e) => setBanReasonInput(e.target.value)}
                placeholder="Enter justification (e.g. Ineligible residency, falsified documents, policy violation)..."
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 font-medium outline-none focus:ring-2 focus:ring-rose-600"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBanModal(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBan}
                className="flex-1 py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Confirm Ban</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resident Detail Modal with Administrative Controls */}
      {selectedResident && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedResident(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-xl w-full p-6 border border-gray-200 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0c532b]">Official Registry Dossier</span>
                <h2 className="text-base font-extrabold text-gray-900">{selectedResident.name}</h2>
              </div>
              <button 
                onClick={() => setSelectedResident(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resident Header Info */}
            <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl">
              <div className="w-16 h-16 rounded-2xl bg-[#0c532b]/10 text-[#0c532b] font-extrabold text-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                {selectedResident.avatarUrl ? (
                  <img src={selectedResident.avatarUrl} alt={selectedResident.name} className="w-full h-full object-cover" />
                ) : (
                  selectedResident.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-gray-900">{selectedResident.name}</h3>
                <p className="text-xs font-mono text-gray-600 font-semibold">{selectedResident.residentIdNumber}</p>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    selectedResident.isBanned 
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {selectedResident.isBanned ? 'Banned Account' : 'Verified Citizen'}
                  </span>
                  <span className="text-[10px] font-medium text-gray-500">Reg: {selectedResident.registeredDate}</span>
                </div>
              </div>
            </div>

            {/* Ban Notification in Modal if Banned */}
            {selectedResident.isBanned && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800">
                <span className="font-bold block">Account Ban Details:</span>
                <p className="text-rose-700 mt-0.5">{selectedResident.banReason || 'Administrative policy violation.'}</p>
              </div>
            )}

            {/* Resident Dossier Particulars */}
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Purok / Zone:</span>
                <span className="font-bold text-gray-800">{selectedResident.purok}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Complete Address:</span>
                <span className="font-semibold text-gray-800 text-right">{selectedResident.address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Nationality:</span>
                <span className="font-bold text-gray-800">{selectedResident.nationality || 'Filipino'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Contact Number:</span>
                <span className="font-semibold text-gray-800">{selectedResident.contactNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Email Address:</span>
                <span className="font-semibold text-gray-800">{selectedResident.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Monthly Household Income:</span>
                <span className="font-bold text-emerald-700">{selectedResident.householdIncome || '₱8,500.00'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Family Members:</span>
                <span className="font-semibold text-gray-800">{selectedResident.familyMembersCount || 4} dependents</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Civil Status & Age:</span>
                <span className="font-semibold text-gray-800">{selectedResident.civilStatus || 'Single'} • {selectedResident.age || 28} years old</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Government / Resident ID:</span>
                <span className="font-semibold text-gray-800">{selectedResident.idType || 'PhilSys National ID'} ({selectedResident.idNumber || 'Verified'})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Primary Occupation:</span>
                <span className="font-semibold text-gray-800">{selectedResident.occupation || 'Resident'} ({selectedResident.employmentStatus || 'Self-Employed'})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">COMELEC Voter Status:</span>
                <span className="font-bold text-gray-800">{selectedResident.voterStatus || 'Registered Voter'}</span>
              </div>
            </div>

            {/* Valid Government / Resident ID (Front & Back) */}
            <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-[#0c532b]" />
                    <span>Valid ID On File</span>
                  </span>
                  <p className="text-[11px] text-emerald-800 font-semibold mt-0.5">
                    {selectedResident.idType || 'PhilSys National ID'}
                    {selectedResident.idNumber ? ` · ${selectedResident.idNumber}` : ''}
                  </p>
                </div>
                {(selectedResident.frontIdUrl || selectedResident.backIdUrl) && (
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                    Verified Front &amp; Back
                  </span>
                )}
              </div>

              {(selectedResident.frontIdUrl || selectedResident.backIdUrl) ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedResident.frontIdUrl && (
                    <button
                      type="button"
                      onClick={() => setZoomedIdDoc({
                        title: `${selectedResident.idType || 'Valid ID'} (Front) - ${selectedResident.name}`,
                        url: selectedResident.frontIdUrl!,
                        type: `${selectedResident.idType || 'Valid ID'} • ${selectedResident.idNumber || selectedResident.residentIdNumber}`
                      })}
                      className="text-left group relative rounded-xl overflow-hidden border border-emerald-300/70 bg-white shadow-xs cursor-pointer"
                    >
                      <div className="aspect-[16/10] w-full bg-slate-50 overflow-hidden flex items-center justify-center">
                        <img
                          src={selectedResident.frontIdUrl}
                          alt={`Front of ${selectedResident.idType || 'Valid ID'}`}
                          className="w-full h-full object-contain group-hover:scale-[1.02] transition duration-200"
                        />
                      </div>
                      <div className="px-2.5 py-1.5 bg-white border-t border-emerald-100 flex items-center justify-between text-[11px] font-bold text-gray-700">
                        <span>Front View</span>
                        <span className="text-[#0c532b] inline-flex items-center gap-1">
                          <ZoomIn className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </span>
                      </div>
                    </button>
                  )}

                  {selectedResident.backIdUrl && (
                    <button
                      type="button"
                      onClick={() => setZoomedIdDoc({
                        title: `${selectedResident.idType || 'Valid ID'} (Back) - ${selectedResident.name}`,
                        url: selectedResident.backIdUrl!,
                        type: `${selectedResident.idType || 'Valid ID'} • ${selectedResident.idNumber || selectedResident.residentIdNumber}`
                      })}
                      className="text-left group relative rounded-xl overflow-hidden border border-emerald-300/70 bg-white shadow-xs cursor-pointer"
                    >
                      <div className="aspect-[16/10] w-full bg-slate-50 overflow-hidden flex items-center justify-center">
                        <img
                          src={selectedResident.backIdUrl}
                          alt={`Back of ${selectedResident.idType || 'Valid ID'}`}
                          className="w-full h-full object-contain group-hover:scale-[1.02] transition duration-200"
                        />
                      </div>
                      <div className="px-2.5 py-1.5 bg-white border-t border-emerald-100 flex items-center justify-between text-[11px] font-bold text-gray-700">
                        <span>Back View</span>
                        <span className="text-[#0c532b] inline-flex items-center gap-1">
                          <ZoomIn className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </span>
                      </div>
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-gray-500">No front/back ID images uploaded yet.</p>
              )}
            </div>

            {/* Pending Profile Edit Request (Admin-Only Approval) */}
            {selectedResident.pendingProfileUpdate?.status === 'Pending' && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-950 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-700" />
                    Pending Profile Information Changes
                  </span>
                  <span className="text-[11px] text-amber-800">
                    {selectedResident.pendingProfileUpdate.requestedAt}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {Object.entries(selectedResident.pendingProfileUpdate.changes).map(([field, newVal]) => {
                    const currentVal = (selectedResident as any)[field];
                    return (
                      <div key={field} className="bg-white border border-amber-200/80 rounded-xl px-3 py-2 flex items-center justify-between gap-3">
                        <span className="font-semibold text-gray-500 capitalize">{field.replace(/([A-Z])/g, ' $1')}</span>
                        <div className="text-right">
                          <span className="text-gray-400 line-through mr-2">{String(currentVal ?? '—')}</span>
                          <span className="font-bold text-gray-900">{String(newVal)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <input
                  type="text"
                  value={profileRejectReason}
                  onChange={(e) => setProfileRejectReason(e.target.value)}
                  placeholder="Optional reason if declining..."
                  className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#0c532b]"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isReviewingProfileEdit}
                    onClick={async () => {
                      setIsReviewingProfileEdit(true);
                      try {
                        await reviewProfileChangeRequest(selectedResident.id, 'approve');
                        setSelectedResident(null);
                      } finally {
                        setIsReviewingProfileEdit(false);
                      }
                    }}
                    className="flex-1 py-2 bg-[#0c532b] hover:bg-[#094222] disabled:opacity-50 text-white font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve Changes</span>
                  </button>
                  <button
                    type="button"
                    disabled={isReviewingProfileEdit}
                    onClick={async () => {
                      setIsReviewingProfileEdit(true);
                      try {
                        await reviewProfileChangeRequest(
                          selectedResident.id,
                          'reject',
                          profileRejectReason.trim() || undefined
                        );
                        setProfileRejectReason('');
                        setSelectedResident(null);
                      } finally {
                        setIsReviewingProfileEdit(false);
                      }
                    }}
                    className="flex-1 py-2 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 font-bold rounded-xl border border-rose-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            )}

            {/* Admin Account Controls inside Resident Info Dossier */}
            {canModifyResident(selectedResident) && (
              <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-2 text-xs">
                {selectedResident.isBanned || selectedResident.registrationStatus === 'Banned' ? (
                  <button
                    type="button"
                    onClick={() => handleUnban(selectedResident)}
                    className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Unban Account</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedResident;
                      setSelectedResident(null);
                      handleOpenBanModal(target);
                    }}
                    className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl border border-rose-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Ban Account</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const target = selectedResident;
                    setSelectedResident(null);
                    setFeedback(null);
                    setResidentToDelete(target);
                  }}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Account</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Add Resident Modal */}
      {showAddResidentModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => !isAddingResident && setShowAddResidentModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-xl w-full p-6 border border-gray-200 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Add New Resident Account</h2>
                <p className="text-xs text-gray-500">Creates a live resident portal account synced across the database.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddResidentModal(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addModalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{addModalError}</span>
              </div>
            )}

            <form onSubmit={handleAddResidentSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Full Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    placeholder="e.g. Maria Elena Santos"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Email Address <span className="text-rose-500">*</span></label>
                  <input
                    type="email"
                    required
                    value={addForm.email}
                    onChange={(e) => {
                      setAddForm({ ...addForm, email: e.target.value });
                      if (addModalError) setAddModalError('');
                    }}
                    placeholder="resident@gmail.com or name@bugo.gov.ph"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Portal Password (optional)</label>
                  <input
                    type="password"
                    value={addForm.password}
                    onChange={(e) => {
                      setAddForm({ ...addForm, password: e.target.value });
                      if (addModalError) setAddModalError('');
                    }}
                    placeholder="Defaults to Resident@Bugo2026!"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5">Leave blank for Resident@Bugo2026!, or enter a strong 8+ char password.</p>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Contact Number</label>
                  <input
                    type="text"
                    value={addForm.contactNumber}
                    onChange={(e) => {
                      setAddForm({ ...addForm, contactNumber: e.target.value });
                      if (addModalError) setAddModalError('');
                    }}
                    placeholder="0917 628 4915"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Purok / Zone</label>
                  <select
                    value={addForm.purok}
                    onChange={(e) => setAddForm({ ...addForm, purok: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  >
                    {BUGO_PUROKS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Household Monthly Income</label>
                  <select
                    value={addForm.householdIncome}
                    onChange={(e) => setAddForm({ ...addForm, householdIncome: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  >
                    {MONTHLY_INCOME_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Complete Address</label>
                <input
                  type="text"
                  value={addForm.address}
                  onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                  placeholder="House #, Street, Zone, Barangay Bugo, CDO"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Age</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={addForm.age}
                    onChange={(e) => setAddForm({ ...addForm, age: Number(e.target.value) || 18 })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Gender</label>
                  <select
                    value={addForm.gender}
                    onChange={(e) => setAddForm({ ...addForm, gender: e.target.value as 'Male' | 'Female' })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Civil Status</label>
                  <select
                    value={addForm.civilStatus}
                    onChange={(e) => setAddForm({ ...addForm, civilStatus: e.target.value as NonNullable<ResidentUser['civilStatus']> })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  >
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Family Members</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={addForm.familyMembersCount}
                    onChange={(e) => setAddForm({ ...addForm, familyMembersCount: Number(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Occupation</label>
                  <input
                    type="text"
                    value={addForm.occupation}
                    onChange={(e) => setAddForm({ ...addForm, occupation: e.target.value })}
                    placeholder="e.g. Vendor"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Employment Status</label>
                  <select
                    value={addForm.employmentStatus}
                    onChange={(e) => setAddForm({ ...addForm, employmentStatus: e.target.value as NonNullable<ResidentUser['employmentStatus']> })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  >
                    <option value="Employed (Full-Time)">Employed (Full-Time)</option>
                    <option value="Employed (Part-Time)">Employed (Part-Time)</option>
                    <option value="Self-Employed">Self-Employed</option>
                    <option value="Unemployed">Unemployed</option>
                    <option value="Student">Student</option>
                    <option value="Retired">Retired</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Nationality</label>
                  <select
                    value={addForm.nationality}
                    onChange={(e) => setAddForm({ ...addForm, nationality: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  >
                    {NATIONALITY_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-1.5 font-medium text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={addForm.isPwd} onChange={(e) => setAddForm({ ...addForm, isPwd: e.target.checked })} className="accent-[#0c532b]" />
                  <span>PWD</span>
                </label>
                <label className="inline-flex items-center gap-1.5 font-medium text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={addForm.isSenior} onChange={(e) => setAddForm({ ...addForm, isSenior: e.target.checked })} className="accent-[#0c532b]" />
                  <span>Senior</span>
                </label>
                <label className="inline-flex items-center gap-1.5 font-medium text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={addForm.isSoloParent} onChange={(e) => setAddForm({ ...addForm, isSoloParent: e.target.checked })} className="accent-[#0c532b]" />
                  <span>Solo Parent</span>
                </label>
                <label className="inline-flex items-center gap-1.5 font-medium text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={addForm.isStudent} onChange={(e) => setAddForm({ ...addForm, isStudent: e.target.checked })} className="accent-[#0c532b]" />
                  <span>Student</span>
                </label>
                <label className="inline-flex items-center gap-1.5 font-medium text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={addForm.isTeenager} onChange={(e) => setAddForm({ ...addForm, isTeenager: e.target.checked })} className="accent-[#0c532b]" />
                  <span>Youth</span>
                </label>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isAddingResident}
                  onClick={() => setShowAddResidentModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingResident}
                  className="px-4 py-2 bg-[#0c532b] hover:bg-[#094222] disabled:opacity-60 text-white font-semibold rounded-lg cursor-pointer"
                >
                  {isAddingResident ? 'Creating...' : 'Create Resident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Resident Account Modal */}
      {editingResident && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => !isUpdatingResident && setEditingResident(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-xl w-full p-6 border border-gray-200 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Edit Resident Account</h2>
                <p className="text-xs text-gray-500">
                  Changes propagate immediately to the resident&apos;s live account, applications, and disaster records.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingResident(null)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editModalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{editModalError}</span>
              </div>
            )}

            <form onSubmit={handleEditResidentSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Full Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Email Address <span className="text-rose-500">*</span></label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => {
                      setEditForm({ ...editForm, email: e.target.value });
                      if (editModalError) setEditModalError('');
                    }}
                    placeholder="resident@gmail.com or name@bugo.gov.ph"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Contact Number</label>
                  <input
                    type="text"
                    value={editForm.contactNumber}
                    onChange={(e) => {
                      setEditForm({ ...editForm, contactNumber: e.target.value });
                      if (editModalError) setEditModalError('');
                    }}
                    placeholder="0917 628 4915"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Purok / Zone</label>
                  <select
                    value={editForm.purok}
                    onChange={(e) => setEditForm({ ...editForm, purok: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  >
                    {BUGO_PUROKS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Complete Address</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Household Monthly Income</label>
                  <select
                    value={editForm.householdIncome}
                    onChange={(e) => setEditForm({ ...editForm, householdIncome: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  >
                    {!MONTHLY_INCOME_OPTIONS.includes(editForm.householdIncome) && (
                      <option value={editForm.householdIncome}>{editForm.householdIncome}</option>
                    )}
                    {MONTHLY_INCOME_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Family Members</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={editForm.familyMembersCount}
                    onChange={(e) => setEditForm({ ...editForm, familyMembersCount: Number(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Registration Status</label>
                  <select
                    value={editForm.registrationStatus}
                    onChange={(e) => {
                      const status = e.target.value as NonNullable<ResidentUser['registrationStatus']>;
                      setEditForm({
                        ...editForm,
                        registrationStatus: status,
                        isVerified: status === 'Verified'
                      });
                    }}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  >
                    <option value="Verified">Verified</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Banned">Banned</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Age</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={editForm.age}
                    onChange={(e) => setEditForm({ ...editForm, age: Number(e.target.value) || 18 })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Gender</label>
                  <select
                    value={editForm.gender}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value as 'Male' | 'Female' })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Civil Status</label>
                  <select
                    value={editForm.civilStatus}
                    onChange={(e) => setEditForm({ ...editForm, civilStatus: e.target.value as NonNullable<ResidentUser['civilStatus']> })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  >
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Voter Status</label>
                  <select
                    value={editForm.voterStatus}
                    onChange={(e) => setEditForm({ ...editForm, voterStatus: e.target.value as 'Registered' | 'Unregistered' })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  >
                    <option value="Registered">Registered</option>
                    <option value="Unregistered">Unregistered</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Occupation</label>
                  <input
                    type="text"
                    value={editForm.occupation}
                    onChange={(e) => setEditForm({ ...editForm, occupation: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Employment Status</label>
                  <select
                    value={editForm.employmentStatus}
                    onChange={(e) => setEditForm({ ...editForm, employmentStatus: e.target.value as NonNullable<ResidentUser['employmentStatus']> })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  >
                    <option value="Employed (Full-Time)">Employed (Full-Time)</option>
                    <option value="Employed (Part-Time)">Employed (Part-Time)</option>
                    <option value="Self-Employed">Self-Employed</option>
                    <option value="Unemployed">Unemployed</option>
                    <option value="Student">Student</option>
                    <option value="Retired">Retired</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Nationality</label>
                  <select
                    value={editForm.nationality}
                    onChange={(e) => setEditForm({ ...editForm, nationality: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  >
                    {!NATIONALITY_OPTIONS.includes(editForm.nationality) && (
                      <option value={editForm.nationality}>{editForm.nationality}</option>
                    )}
                    {NATIONALITY_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-1.5 font-medium text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={editForm.isPwd} onChange={(e) => setEditForm({ ...editForm, isPwd: e.target.checked })} className="accent-[#0c532b]" />
                  <span>PWD</span>
                </label>
                <label className="inline-flex items-center gap-1.5 font-medium text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={editForm.isSenior} onChange={(e) => setEditForm({ ...editForm, isSenior: e.target.checked })} className="accent-[#0c532b]" />
                  <span>Senior</span>
                </label>
                <label className="inline-flex items-center gap-1.5 font-medium text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={editForm.isSoloParent} onChange={(e) => setEditForm({ ...editForm, isSoloParent: e.target.checked })} className="accent-[#0c532b]" />
                  <span>Solo Parent</span>
                </label>
                <label className="inline-flex items-center gap-1.5 font-medium text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={editForm.isStudent} onChange={(e) => setEditForm({ ...editForm, isStudent: e.target.checked })} className="accent-[#0c532b]" />
                  <span>Student</span>
                </label>
                <label className="inline-flex items-center gap-1.5 font-medium text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={editForm.isTeenager} onChange={(e) => setEditForm({ ...editForm, isTeenager: e.target.checked })} className="accent-[#0c532b]" />
                  <span>Youth</span>
                </label>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isUpdatingResident}
                  onClick={() => setEditingResident(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingResident}
                  className="px-4 py-2 bg-[#0c532b] hover:bg-[#094222] disabled:opacity-60 text-white font-semibold rounded-lg cursor-pointer"
                >
                  {isUpdatingResident ? 'Saving...' : 'Save & Sync Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Delete Resident Confirmation Modal */}
      {residentToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isDeletingResidents && setResidentToDelete(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 border border-gray-200 shadow-2xl space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Delete Resident Account?</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Are you sure you want to remove <span className="font-semibold text-gray-800">{residentToDelete.name}</span>? Their account and linked records will be removed from active lists and automatically recorded in Archives.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={isDeletingResidents}
                onClick={() => setResidentToDelete(null)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingResidents}
                onClick={async () => {
                  setIsDeletingResidents(true);
                  const deletedId = residentToDelete.id;
                  const deletedName = residentToDelete.name;
                  const res = await deleteResidentAccount(deletedId);
                  setIsDeletingResidents(false);
                  setResidentToDelete(null);
                  if (res.success) {
                    setSelectedResidentIds(prev => prev.filter(id => id !== deletedId));
                    setFeedback({
                      type: 'success',
                      message: `Deleted resident account "${deletedName}".`
                    });
                  } else {
                    setFeedback({
                      type: 'error',
                      message: res.message || 'Could not delete resident account.'
                    });
                  }
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                {isDeletingResidents ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Selected Residents Confirmation Modal */}
      {isBulkDeleteResidentsOpen && selectedResidentIds.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isDeletingResidents && setIsBulkDeleteResidentsOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Delete {selectedResidentIds.length} Selected {selectedResidentIds.length === 1 ? 'Resident' : 'Residents'}?
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                This will remove the selected accounts from active lists, sign out active sessions, and automatically record them in Archives.
              </p>
            </div>
            {selectedResidentsForDelete.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-left max-h-36 overflow-y-auto">
                <ul className="space-y-1 text-xs text-gray-700">
                  {selectedResidentsForDelete.slice(0, 6).map(r => (
                    <li key={r.id} className="truncate font-medium">
                      • {r.name} ({r.email})
                    </li>
                  ))}
                  {selectedResidentsForDelete.length > 6 && (
                    <li className="text-[11px] font-semibold text-gray-500 pt-0.5">
                      + {selectedResidentsForDelete.length - 6} more resident(s)
                    </li>
                  )}
                </ul>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={isDeletingResidents}
                onClick={() => setIsBulkDeleteResidentsOpen(false)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingResidents}
                onClick={async () => {
                  setIsDeletingResidents(true);
                  const targetIds = [...selectedResidentIds];
                  const res = await deleteResidentAccounts(targetIds);
                  setIsDeletingResidents(false);
                  setIsBulkDeleteResidentsOpen(false);
                  if (res.success) {
                    const count = res.deletedCount ?? targetIds.length;
                    setSelectedResidentIds([]);
                    setFeedback({
                      type: 'success',
                      message: `Deleted ${count} selected resident ${count === 1 ? 'account' : 'accounts'}.`
                    });
                  } else {
                    setFeedback({
                      type: 'error',
                      message: res.message || 'Could not delete selected residents.'
                    });
                  }
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                {isDeletingResidents ? 'Deleting...' : `Delete (${selectedResidentIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {zoomedIdDoc && (
        <DocumentPreviewModal
          title={zoomedIdDoc.title}
          subtitle={zoomedIdDoc.type}
          url={zoomedIdDoc.url}
          footerText="Verified Resident Identification Credential"
          closeLabel="Back to Dossier"
          onClose={() => setZoomedIdDoc(null)}
        />
      )}
    </div>
  );
};


// ----------------------------------------------------
// 2. ADMIN STATUS TRACKING & SERVICE APPLICATIONS VIEW
// ----------------------------------------------------
interface BulletListEditorProps {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  helperText?: string;
}

const BulletListEditor: React.FC<BulletListEditorProps> = ({
  label,
  items,
  onChange,
  placeholder = 'Enter item...',
  addLabel = 'Add Item',
  helperText
}) => {
  const safeItems = items.length > 0 ? items : [''];
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="block font-semibold text-gray-700">
          {label} <span className="text-[11px] font-normal text-gray-400">(1 per bullet)</span>
        </label>
        <button
          type="button"
          onClick={() => onChange([...safeItems, ''])}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-[#0c532b] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>{addLabel}</span>
        </button>
      </div>
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
        {safeItems.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="w-4 text-center text-sm font-bold text-[#0c532b] select-none shrink-0"
            >
              •
            </span>
            <input
              type="text"
              value={item}
              placeholder={placeholder}
              onChange={(e) => {
                const next = [...safeItems];
                next[idx] = e.target.value;
                onChange(next);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const next = [...safeItems];
                  next.splice(idx + 1, 0, '');
                  onChange(next);
                }
              }}
              className="flex-1 min-w-0 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
            />
            <button
              type="button"
              onClick={() => {
                const next = safeItems.filter((_, i) => i !== idx);
                onChange(next.length > 0 ? next : ['']);
              }}
              title="Remove bullet"
              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      {helperText && <p className="text-[11px] text-gray-500">{helperText}</p>}
    </div>
  );
};

export const AdminStatusTrackingView: React.FC = () => {
  const { 
    currentUser,
    applications, 
    programs,
    selectedApplicationForReview,
    setSelectedApplicationForReview,
    archiveRecord,
    updateApplicationStatus,
    deleteApplication,
    deleteApplications,
    addProgram,
    updateProgram,
    deleteProgram,
    deletePrograms
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'applications' | 'services'>('applications');
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<string>('All');
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<string>('All');
  const [serviceAccessFilter, setServiceAccessFilter] = useState<'all' | 'available' | 'closed'>('all');
  const [togglingServiceId, setTogglingServiceId] = useState<string | null>(null);
  const [viewingService, setViewingService] = useState<AssistanceProgram | null>(null);
  const [editingService, setEditingService] = useState<AssistanceProgram | null>(null);
  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);
  const [isSavingService, setIsSavingService] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    title: '',
    category: 'Clearance & Certification' as ProgramCategory,
    status: 'Active' as 'Active' | 'Open' | 'Closed',
    processingTime: 'Same Day',
    targetAudience: 'All Bugo Residents',
    maxBenefitAmount: '',
    tagline: '',
    description: '',
    requirementsList: ['Valid Government ID', 'Barangay Certificate of Residency'] as string[]
  });

  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [qualificationQueue, setQualificationQueue] = useState<'All' | 'Qualified' | 'Ineligible'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [archiveSuccessMsg, setArchiveSuccessMsg] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Barangay Services (Certificates, Clearances, Permits) selection & deletion state
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [serviceToDelete, setServiceToDelete] = useState<AssistanceProgram | null>(null);
  const [isBulkDeleteServicesOpen, setIsBulkDeleteServicesOpen] = useState(false);
  const [isDeletingServices, setIsDeletingServices] = useState(false);
  const selectAllServicesRef = useRef<HTMLInputElement | null>(null);

  // Resident Applications selection & deletion state
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [appToDelete, setAppToDelete] = useState<AssistanceApplication | null>(null);
  const [isBulkDeleteAppsOpen, setIsBulkDeleteAppsOpen] = useState(false);
  const [isDeletingApps, setIsDeletingApps] = useState(false);
  const selectAllAppsRef = useRef<HTMLInputElement | null>(null);

  const openAddServiceModal = () => {
    setFeedback(null);
    setEditingService(null);
    setServiceForm({
      title: '',
      category: 'Clearance & Certification',
      status: 'Active',
      processingTime: 'Same Day',
      targetAudience: 'All Bugo Residents',
      maxBenefitAmount: 'Standard Certification',
      tagline: '',
      description: '',
      requirementsList: ['Valid Government ID', 'Barangay Certificate of Residency']
    });
    setIsAddServiceModalOpen(true);
  };

  const openEditServiceModal = (svc: AssistanceProgram) => {
    setFeedback(null);
    setIsAddServiceModalOpen(false);
    setEditingService(svc);
    setServiceForm({
      title: svc.title || '',
      category: svc.category || 'Barangay Administrative Services',
      status: svc.status || 'Active',
      processingTime: svc.processingTime || 'Same Day',
      targetAudience: svc.targetAudience || 'All Bugo Residents',
      maxBenefitAmount: svc.maxBenefitAmount || '',
      tagline: svc.tagline || '',
      description: svc.description || '',
      requirementsList: svc.requirements && svc.requirements.length > 0 ? [...svc.requirements] : ['']
    });
  };

  const closeServiceModal = () => {
    if (isSavingService) return;
    setIsAddServiceModalOpen(false);
    setEditingService(null);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceForm.title.trim() || !serviceForm.description.trim()) return;
    setIsSavingService(true);
    const requirements = serviceForm.requirementsList
      .map(s => s.trim())
      .filter(Boolean);
    const resolvedTitle = serviceForm.title.trim();
    const resolvedDescription = serviceForm.description.trim();
    const resolvedProcessing = serviceForm.processingTime.trim() || 'Same Day';
    const resolvedAudience = serviceForm.targetAudience.trim() || 'All Bugo Residents';
    const resolvedFee = serviceForm.maxBenefitAmount.trim() || 'Barangay Certification / Service';
    const resolvedTagline = serviceForm.tagline.trim() || resolvedDescription.slice(0, 110);

    if (editingService) {
      const res = await updateProgram(editingService.id, {
        title: resolvedTitle,
        category: serviceForm.category,
        status: serviceForm.status,
        processingTime: resolvedProcessing,
        targetAudience: resolvedAudience,
        maxBenefitAmount: resolvedFee,
        tagline: resolvedTagline,
        description: resolvedDescription,
        requirements,
        programType: 'service'
      });
      setIsSavingService(false);
      if (res.success && res.program) {
        setEditingService(null);
        setFeedback({
          type: 'success',
          message: `Updated "${res.program.title}" and synced to Resident Certification.`
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'Could not update Barangay Service.'
        });
      }
      return;
    }

    const res = await addProgram({
      title: resolvedTitle,
      category: serviceForm.category,
      tagline: resolvedTagline,
      description: resolvedDescription,
      imageUrl: '/assets/services/brgy_clearance_cert_1794197711166.jpg',
      status: serviceForm.status,
      badgeText: 'Barangay Service',
      deadline: 'Year-Round Service',
      targetAudience: resolvedAudience,
      processingTime: resolvedProcessing,
      maxBenefitAmount: resolvedFee,
      requirements: requirements.length > 0 ? requirements : ['Valid Government ID'],
      eligibilityCriteria: ['Verified resident of Barangay Bugo'],
      programType: 'service'
    });
    setIsSavingService(false);
    if (res.success && res.program) {
      setIsAddServiceModalOpen(false);
      setFeedback({
        type: 'success',
        message: `Added "${res.program.title}" to Barangay Services and Resident Certification.`
      });
    } else {
      setFeedback({
        type: 'error',
        message: res.message || 'Could not add Barangay Service.'
      });
    }
  };
  
  // Evaluation inspection modal zoom state (view-only)
  const [zoomedRequirement, setZoomedRequirement] = useState<{ title: string; url: string; type: string } | null>(null);

  const barangayServices = useMemo(
    () => sortProgramsAlphabetically(programs.filter(p => isBarangayServiceApplicationItem(p))),
    [programs]
  );

  const serviceCategories = useMemo(
    () => Array.from(new Set<string>(barangayServices.map(s => String(s.category || '')))).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [barangayServices]
  );

  const handleToggleServiceAccess = async (svc: AssistanceProgram) => {
    const nextStatus: 'Active' | 'Closed' = svc.status === 'Closed' ? 'Active' : 'Closed';
    setTogglingServiceId(svc.id);
    const res = await updateProgram(svc.id, { status: nextStatus, programType: 'service' });
    setTogglingServiceId(null);
    if (res.success) {
      setFeedback({
        type: 'success',
        message:
          nextStatus === 'Closed'
            ? `"${svc.title}" is now Closed and hidden from Resident Certification.`
            : `"${svc.title}" is now Available in Resident Certification.`
      });
    } else {
      setFeedback({
        type: 'error',
        message: res.message || 'Could not update certificate access.'
      });
    }
  };

  const openServicesCount = useMemo(
    () => barangayServices.filter(s => s.status !== 'Closed').length,
    [barangayServices]
  );

  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    return barangayServices.filter(s => {
      const matchesCat = serviceCategoryFilter === 'All' || s.category === serviceCategoryFilter;
      const matchesAccess =
        serviceAccessFilter === 'all' ||
        (serviceAccessFilter === 'available' ? s.status !== 'Closed' : s.status === 'Closed');
      const matchesSearch =
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        (s.tagline || '').toLowerCase().includes(q);
      return matchesCat && matchesAccess && matchesSearch;
    });
  }, [barangayServices, serviceCategoryFilter, serviceAccessFilter, serviceSearch]);

  const qualifiedCount = applications.filter(a => a.isCertificateQualified !== false).length;
  const disqualifiedCount = applications.filter(a => a.isCertificateQualified === false).length;

  const filteredApplications = useMemo(() => {
    const matching = applications.filter(app => {
      const matchesSearch = app.referenceCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            app.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            app.programTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (app.purok && app.purok.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'All' || app.status === statusFilter;
      const matchesService =
        selectedServiceFilter === 'All' ||
        app.programId === selectedServiceFilter ||
        app.programTitle.toLowerCase() === selectedServiceFilter.toLowerCase();
      
      const isQual = app.isCertificateQualified !== false;
      const matchesQueue = 
        qualificationQueue === 'All' ? true :
        qualificationQueue === 'Qualified' ? isQual :
        !isQual;

      return matchesSearch && matchesStatus && matchesService && matchesQueue;
    });
    return sortApplicationsFCFS(matching);
  }, [applications, searchTerm, statusFilter, selectedServiceFilter, qualificationQueue]);

  // Barangay Services selection helpers
  const visibleServiceIds = useMemo(() => filteredServices.map(s => s.id), [filteredServices]);
  const selectedServiceIdSet = useMemo(() => new Set(selectedServiceIds), [selectedServiceIds]);
  const selectedVisibleServicesCount = useMemo(
    () => visibleServiceIds.filter(id => selectedServiceIdSet.has(id)).length,
    [visibleServiceIds, selectedServiceIdSet]
  );
  const allVisibleServicesSelected =
    visibleServiceIds.length > 0 && selectedVisibleServicesCount === visibleServiceIds.length;
  const someVisibleServicesSelected =
    selectedVisibleServicesCount > 0 && !allVisibleServicesSelected;
  const selectedServicesList = useMemo(
    () => barangayServices.filter(s => selectedServiceIdSet.has(s.id)),
    [barangayServices, selectedServiceIdSet]
  );

  useEffect(() => {
    const activeIds = new Set(barangayServices.map(s => s.id));
    setSelectedServiceIds(prev => {
      const next = prev.filter(id => activeIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [barangayServices]);

  useEffect(() => {
    if (selectAllServicesRef.current) {
      selectAllServicesRef.current.indeterminate = someVisibleServicesSelected;
    }
  }, [someVisibleServicesSelected]);

  const toggleSelectService = (serviceId: string) => {
    setSelectedServiceIds(prev =>
      prev.includes(serviceId) ? prev.filter(id => id !== serviceId) : [...prev, serviceId]
    );
  };

  const toggleSelectAllVisibleServices = () => {
    if (visibleServiceIds.length === 0) return;
    if (allVisibleServicesSelected) {
      const visibleSet = new Set(visibleServiceIds);
      setSelectedServiceIds(prev => prev.filter(id => !visibleSet.has(id)));
    } else {
      setSelectedServiceIds(prev => Array.from(new Set([...prev, ...visibleServiceIds])));
    }
  };

  // Resident Applications selection helpers
  const visibleAppIds = useMemo(() => filteredApplications.map(a => a.id), [filteredApplications]);
  const selectedAppIdSet = useMemo(() => new Set(selectedAppIds), [selectedAppIds]);
  const selectedVisibleAppsCount = useMemo(
    () => visibleAppIds.filter(id => selectedAppIdSet.has(id)).length,
    [visibleAppIds, selectedAppIdSet]
  );
  const allVisibleAppsSelected =
    visibleAppIds.length > 0 && selectedVisibleAppsCount === visibleAppIds.length;
  const someVisibleAppsSelected =
    selectedVisibleAppsCount > 0 && !allVisibleAppsSelected;
  const selectedAppsList = useMemo(
    () => applications.filter(a => selectedAppIdSet.has(a.id)),
    [applications, selectedAppIdSet]
  );

  useEffect(() => {
    const activeIds = new Set(applications.map(a => a.id));
    setSelectedAppIds(prev => {
      const next = prev.filter(id => activeIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [applications]);

  useEffect(() => {
    if (selectAllAppsRef.current) {
      selectAllAppsRef.current.indeterminate = someVisibleAppsSelected;
    }
  }, [someVisibleAppsSelected]);

  const toggleSelectApp = (appId: string) => {
    setSelectedAppIds(prev =>
      prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId]
    );
  };

  const toggleSelectAllVisibleApps = () => {
    if (visibleAppIds.length === 0) return;
    if (allVisibleAppsSelected) {
      const visibleSet = new Set(visibleAppIds);
      setSelectedAppIds(prev => prev.filter(id => !visibleSet.has(id)));
    } else {
      setSelectedAppIds(prev => Array.from(new Set([...prev, ...visibleAppIds])));
    }
  };

  const handleOpenReview = (app: AssistanceApplication) => {
    setSelectedApplicationForReview(app);
  };

  const handleArchiveApplication = (app: AssistanceApplication) => {
    archiveRecord({
      title: `${app.programTitle} - ${app.applicantName}`,
      originalCategory: 'Service Application',
      referenceCode: app.referenceCode,
      deletedBy: currentUser?.name || 'Barangay Administrator',
      reasonForArchive: `Application (${app.status}) archived from tracking view.`,
      originalData: app
    });

    setArchiveSuccessMsg(`Application "${app.referenceCode}" successfully archived!`);
    setTimeout(() => setArchiveSuccessMsg(null), 3000);
    setSelectedApplicationForReview(null);
  };

  return (
    <div className="space-y-6">
      {/* Header & Section Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Applications &amp; Barangay Services
          </h1>
        </div>

        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl self-start sm:self-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveSubTab('applications')}
            className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
              activeSubTab === 'applications' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Applications ({applications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('services')}
            className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
              activeSubTab === 'services' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Barangay Services ({barangayServices.length})
          </button>
        </div>
      </div>

      {(feedback || archiveSuccessMsg) && (
        <div
          className={`p-3 rounded-xl text-xs font-medium flex items-center justify-between gap-2 border ${
            feedback?.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback?.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{feedback?.message || archiveSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              setArchiveSuccessMsg(null);
            }}
            className="text-gray-400 hover:text-gray-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {activeSubTab === 'services' ? (
        <div className="space-y-4">
          {/* Barangay Services Search, Filter & Add Button */}
          <div className="bg-white rounded-xl p-3.5 border border-gray-200 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search clearance, certificate, or permit..."
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-[#0c532b]"
                />
              </div>

              <select
                value={serviceCategoryFilter}
                onChange={(e) => setServiceCategoryFilter(e.target.value)}
                className="w-full sm:w-56 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 font-medium outline-none focus:bg-white focus:ring-2 focus:ring-[#0c532b]"
              >
                <option value="All">All Categories ({barangayServices.length})</option>
                {serviceCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg text-xs font-semibold shrink-0">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'available', label: `Available (${openServicesCount})` },
                    { id: 'closed', label: `Closed (${barangayServices.length - openServicesCount})` }
                  ] as const
                ).map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setServiceAccessFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-md transition whitespace-nowrap shrink-0 cursor-pointer ${
                      serviceAccessFilter === tab.id ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={openAddServiceModal}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#0c532b] hover:bg-[#094222] text-white text-xs font-semibold rounded-lg transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Service / Certification</span>
            </button>
          </div>

          {/* Barangay Services Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {filteredServices.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">
                No Barangay Services match your search.
              </div>
            ) : (
              <>
                <div className={`px-4 py-2.5 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 transition ${
                  selectedServiceIds.length > 0 ? 'bg-rose-50/70' : 'bg-gray-50/60'
                }`}>
                  <div className="flex items-center gap-3 text-xs">
                    <label className="inline-flex items-center gap-2 font-semibold text-gray-700 hover:text-gray-900 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={allVisibleServicesSelected}
                        onChange={toggleSelectAllVisibleServices}
                        aria-label="Select all visible barangay services"
                        className="w-4 h-4 rounded border-gray-300 text-[#0c532b] focus:ring-[#0c532b] cursor-pointer accent-[#0c532b]"
                      />
                      <span>
                        {allVisibleServicesSelected
                          ? `Deselect All (${filteredServices.length})`
                          : `Select All (${filteredServices.length})`}
                      </span>
                    </label>

                    {selectedServiceIds.length > 0 && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span className="font-bold text-rose-700 tabular-nums">
                          {selectedServiceIds.length} selected
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedServiceIds([])}
                          className="text-xs font-semibold text-gray-500 hover:text-gray-800 underline cursor-pointer"
                        >
                          Clear
                        </button>
                      </>
                    )}
                  </div>

                  {selectedServiceIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFeedback(null);
                        setIsBulkDeleteServicesOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition shadow-2xs cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Selected ({selectedServiceIds.length})</span>
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-500 font-semibold text-[11px] border-b border-gray-200">
                      <tr>
                        <th className="py-2.5 pl-4 pr-2 w-10">
                          <input
                            ref={selectAllServicesRef}
                            type="checkbox"
                            checked={allVisibleServicesSelected}
                            onChange={toggleSelectAllVisibleServices}
                            aria-label="Select all barangay services in table"
                            className="w-4 h-4 rounded border-gray-300 text-[#0c532b] focus:ring-[#0c532b] cursor-pointer accent-[#0c532b]"
                          />
                        </th>
                        <th className="py-2.5 px-4">Barangay Service</th>
                        <th className="py-2.5 px-4">Resident Access</th>
                        <th className="py-2.5 px-4">Processing Time</th>
                        <th className="py-2.5 px-4 text-center">Requests</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredServices.map(svc => {
                        const isChecked = selectedServiceIdSet.has(svc.id);
                        const isAvailable = svc.status !== 'Closed';
                        const isToggling = togglingServiceId === svc.id;
                        const reqCount = applications.filter(
                          a => a.programId === svc.id || a.programTitle.toLowerCase() === svc.title.toLowerCase()
                        ).length;

                        return (
                          <tr
                            key={svc.id}
                            className={`transition ${isChecked ? 'bg-rose-50/40 hover:bg-rose-50/60' : 'hover:bg-gray-50/70'}`}
                          >
                            <td className="py-3 pl-4 pr-2 w-10">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelectService(svc.id)}
                                aria-label={`Select ${svc.title}`}
                                className="w-4 h-4 rounded border-gray-300 text-[#0c532b] focus:ring-[#0c532b] cursor-pointer accent-[#0c532b]"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-gray-900">{svc.title}</p>
                              <p className="text-[11px] text-gray-500">{svc.category}</p>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <button
                                type="button"
                                disabled={isToggling}
                                onClick={() => handleToggleServiceAccess(svc)}
                                title={isAvailable ? 'Click to close for residents' : 'Click to enable for residents'}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer disabled:opacity-50 ${
                                  isAvailable
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                                    : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {isToggling ? 'Updating...' : isAvailable ? 'Available' : 'Closed'}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                              {svc.processingTime || 'Same Day'}
                            </td>
                            <td className="py-3 px-4 text-center tabular-nums">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                reqCount > 0 ? 'bg-emerald-50 text-[#0c532b]' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {reqCount} {reqCount === 1 ? 'request' : 'requests'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedServiceFilter(svc.id);
                                    setActiveSubTab('applications');
                                  }}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#0c532b] rounded-lg text-xs font-bold cursor-pointer transition"
                                >
                                  View Applications
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditServiceModal(svc)}
                                  className="text-xs font-semibold text-[#0c532b] hover:text-[#094222] hover:underline cursor-pointer"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setViewingService(svc)}
                                  className="text-xs font-semibold text-gray-600 hover:text-gray-900 hover:underline cursor-pointer"
                                >
                                  Details
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFeedback(null);
                                    setServiceToDelete(svc);
                                  }}
                                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {viewingService && (
            <div
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
              onClick={() => setViewingService(null)}
            >
              <div
                className="bg-white rounded-2xl max-w-md w-full p-5 border border-gray-200 shadow-2xl space-y-3 text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-gray-100">
                  <div>
                    <p className="text-[11px] text-gray-500 font-medium">{viewingService.category}</p>
                    <h2 className="text-base font-bold text-gray-900 mt-0.5">{viewingService.title}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingService(null)}
                    className="p-1 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-gray-700 leading-relaxed">{viewingService.description}</p>

                <div className="grid grid-cols-2 gap-2.5 bg-gray-50 p-3 rounded-xl">
                  <div>
                    <span className="text-[11px] text-gray-400 block">Target Residents</span>
                    <span className="font-semibold text-gray-900">{viewingService.targetAudience}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-400 block">Processing Time</span>
                    <span className="font-semibold text-gray-900">{viewingService.processingTime}</span>
                  </div>
                </div>

                {viewingService.requirements?.length > 0 && (
                  <div>
                    <span className="font-semibold text-gray-800 block mb-1">Requirements</span>
                    <ul className="list-disc list-inside text-gray-600 space-y-0.5">
                      {viewingService.requirements.map((req, idx) => (
                        <li key={idx}>{req}</li>
                      ))}
                    </ul>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* Add / Edit Barangay Service or Certification Modal */}
          {(isAddServiceModalOpen || editingService) && (
            <div
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
              onClick={closeServiceModal}
            >
              <div
                className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 border border-gray-200 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      {editingService ? 'Edit Service / Certification' : 'Add Service / Certification'}
                    </h2>
                    <p className="text-xs text-gray-500">
                      Visible immediately under Resident Certification.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeServiceModal}
                    className="p-1 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveService} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">
                      Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Certificate of Low Income / Barangay ID"
                      value={serviceForm.title}
                      onChange={(e) => setServiceForm({ ...serviceForm, title: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Category</label>
                      <select
                        value={serviceForm.category}
                        onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value as ProgramCategory })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                      >
                        <option value="Clearance & Certification">Clearance &amp; Certification</option>
                        <option value="Barangay Administrative Services">Barangay Administrative Services</option>
                        <option value="Civil Registration Services">Civil Registration Services</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Status</label>
                      <select
                        value={serviceForm.status}
                        onChange={(e) => setServiceForm({ ...serviceForm, status: e.target.value as 'Active' | 'Open' | 'Closed' })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                      >
                        <option value="Active">Active</option>
                        <option value="Open">Open</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Processing Time</label>
                      <input
                        type="text"
                        placeholder="e.g. Same Day"
                        value={serviceForm.processingTime}
                        onChange={(e) => setServiceForm({ ...serviceForm, processingTime: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Fee / Note</label>
                      <input
                        type="text"
                        placeholder="e.g. Free or ₱50.00"
                        value={serviceForm.maxBenefitAmount}
                        onChange={(e) => setServiceForm({ ...serviceForm, maxBenefitAmount: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">
                      Description <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      required
                      placeholder="Short description of what this certificate or service covers..."
                      value={serviceForm.description}
                      onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                    />
                  </div>

                  <BulletListEditor
                    label="Requirements"
                    items={serviceForm.requirementsList}
                    onChange={(next) => setServiceForm({ ...serviceForm, requirementsList: next })}
                    placeholder="e.g. Valid Government ID"
                    addLabel="Add Requirement"
                    helperText="Each bullet is verified against uploaded resident files; files without matching keywords are marked invalid."
                  />

                  <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={isSavingService}
                      onClick={closeServiceModal}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingService}
                      className="px-4 py-2 bg-[#0c532b] hover:bg-[#094222] disabled:opacity-60 text-white font-semibold rounded-lg cursor-pointer"
                    >
                      {isSavingService ? 'Saving...' : editingService ? 'Save Changes' : 'Add Service'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {selectedServiceFilter !== 'All' && (
            <div className="flex items-center justify-between px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900">
              <span>
                Filtered by service:{' '}
                {barangayServices.find(s => s.id === selectedServiceFilter)?.title || selectedServiceFilter}
              </span>
              <button
                type="button"
                onClick={() => setSelectedServiceFilter('All')}
                className="text-emerald-700 hover:underline cursor-pointer"
              >
                Show All Applications
              </button>
            </div>
          )}

          {/* Filters & Search */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative w-full lg:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search code, applicant, or service..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#0c532b]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Qualification Queue Tabs */}
              <div className="flex items-center bg-gray-100 p-1 rounded-lg text-xs font-medium tabular-nums">
                <button
                  type="button"
                  onClick={() => setQualificationQueue('All')}
                  className={`px-3 py-1 rounded-md transition whitespace-nowrap cursor-pointer ${
                    qualificationQueue === 'All' ? 'bg-white text-gray-900 shadow-2xs font-semibold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All · {applications.length}
                </button>
                <button
                  type="button"
                  onClick={() => setQualificationQueue('Qualified')}
                  className={`px-3 py-1 rounded-md transition whitespace-nowrap cursor-pointer ${
                    qualificationQueue === 'Qualified' ? 'bg-[#0c532b] text-white shadow-2xs font-semibold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Qualified · {qualifiedCount}
                </button>
                <button
                  type="button"
                  onClick={() => setQualificationQueue('Ineligible')}
                  className={`px-3 py-1 rounded-md transition whitespace-nowrap cursor-pointer ${
                    qualificationQueue === 'Ineligible' ? 'bg-rose-700 text-white shadow-2xs font-semibold' : 'text-gray-600 hover:text-rose-700'
                  }`}
                >
                  Disqualified · {disqualifiedCount}
                </button>
              </div>

              {/* Status Dropdown */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 outline-none focus:ring-2 focus:ring-[#0c532b]"
              >
                {[
                  'All',
                  'Valid',
                  'Submitted',
                  'Under Review',
                  'Documents Verified',
                  'Approved',
                  'Needs Additional Requirements',
                  'Re-submitted',
                  'Disbursed',
                  'Disqualified',
                  'Rejected'
                ].map(s => (
                  <option key={s} value={s}>
                    {s === 'All' ? 'All Statuses' : s}
                  </option>
                ))}
              </select>
            </div>
          </div>

      {/* Applications Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredApplications.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">
            No applications match your current search or filter criteria.
          </div>
        ) : (
          <>
            <div className={`px-4 py-2.5 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 transition ${
              selectedAppIds.length > 0 ? 'bg-rose-50/70' : 'bg-gray-50/60'
            }`}>
              <div className="flex items-center gap-3 text-xs">
                <label className="inline-flex items-center gap-2 font-semibold text-gray-700 hover:text-gray-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allVisibleAppsSelected}
                    onChange={toggleSelectAllVisibleApps}
                    aria-label="Select all visible applications"
                    className="w-4 h-4 rounded border-gray-300 text-[#0c532b] focus:ring-[#0c532b] cursor-pointer accent-[#0c532b]"
                  />
                  <span>
                    {allVisibleAppsSelected
                      ? `Deselect All (${filteredApplications.length})`
                      : `Select All (${filteredApplications.length})`}
                  </span>
                </label>

                {selectedAppIds.length > 0 && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span className="font-bold text-rose-700 tabular-nums">
                      {selectedAppIds.length} selected
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedAppIds([])}
                      className="text-xs font-semibold text-gray-500 hover:text-gray-800 underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>

              {selectedAppIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setFeedback(null);
                    setIsBulkDeleteAppsOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition shadow-2xs cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedAppIds.length})</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="py-3 pl-4 pr-2 w-10">
                      <input
                        ref={selectAllAppsRef}
                        type="checkbox"
                        checked={allVisibleAppsSelected}
                        onChange={toggleSelectAllVisibleApps}
                        aria-label="Select all applications in table"
                        className="w-4 h-4 rounded border-gray-300 text-[#0c532b] focus:ring-[#0c532b] cursor-pointer accent-[#0c532b]"
                      />
                    </th>
                    <th className="px-3 py-3 w-16">Queue</th>
                    <th className="px-4 py-3">Ref.</th>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Applicant</th>
                    <th className="px-4 py-3">Eligibility</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredApplications.map((app, index) => {
                    const isAutoQual = app.isCertificateQualified !== false;
                    const isChecked = selectedAppIdSet.has(app.id);

                    return (
                      <tr
                        key={app.id}
                        onClick={() => handleOpenReview(app)}
                        title="Click to view system qualification & details"
                        className={`cursor-pointer transition ${isChecked ? 'bg-rose-50/40 hover:bg-rose-50/60' : 'hover:bg-gray-50/70'}`}
                      >
                        <td
                          className="py-3.5 pl-4 pr-2 w-10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectApp(app.id)}
                            aria-label={`Select application ${app.referenceCode}`}
                            className="w-4 h-4 rounded border-gray-300 text-[#0c532b] focus:ring-[#0c532b] cursor-pointer accent-[#0c532b]"
                          />
                        </td>
                        <td className="px-3 py-3.5 font-mono font-bold text-[#0c532b] whitespace-nowrap tabular-nums">
                          #{index + 1}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap tabular-nums">
                          <p className="font-mono font-medium text-gray-800">{app.referenceCode}</p>
                          <p className="text-[11px] text-gray-400">{formatShortQueueDateTime(app)}</p>
                        </td>

                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-gray-900">{app.programTitle}</p>
                          <p className="text-[11px] text-gray-500">{app.programCategory}</p>
                        </td>

                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-gray-800">{app.applicantName}</p>
                          <p className="text-[11px] text-gray-500">{app.purok} · {app.contactNumber}</p>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {(() => {
                            const appProg = programs.find(p => p.id === app.programId);
                            const isDisApp = isDisasterProgram(appProg || { id: app.programId, title: app.programTitle, category: app.programCategory });
                            if (isDisApp) {
                              if (app.status === 'Valid' || app.status === 'Approved' || app.status === 'Ready for Release' || app.status === 'Disbursed') {
                                return (
                                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Admin Qualified</span>
                                  </span>
                                );
                              }
                              if (app.status === 'Disqualified' || app.status === 'Rejected') {
                                return (
                                  <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    <span>Not Qualified</span>
                                  </span>
                                );
                              }
                              return (
                                <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>Admin Decision</span>
                                </span>
                              );
                            }
                            return isAutoQual ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Qualified</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>Invalid</span>
                              </span>
                            );
                          })()}
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={`font-semibold ${
                            app.status === 'Valid' || app.status === 'Approved'
                              ? 'text-emerald-700'
                              : app.status === 'Under Review' || app.status === 'Documents Verified'
                              ? 'text-blue-700'
                              : app.status === 'Ready for Release'
                              ? 'text-purple-700'
                              : app.status === 'Disqualified' || app.status === 'Rejected'
                              ? 'text-rose-700'
                              : 'text-amber-700'
                          }`}>
                            {app.status}
                          </span>
                        </td>

                        <td
                          className="px-4 py-3.5 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleArchiveApplication(app)}
                              className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                              title="Archive application"
                            >
                              <Archive className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Archive</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFeedback(null);
                                setAppToDelete(app);
                              }}
                              className="px-2 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
        </>
      )}

      {/* Admin Application Evaluation & Submitted Requirements Inspection Modal */}
      {selectedApplicationForReview && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedApplicationForReview(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-3xl w-full p-6 border border-gray-200 shadow-2xl space-y-5 my-8 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0c532b]">System Qualification Record (View-Only)</span>
                <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                  <span>{selectedApplicationForReview.programTitle}</span>
                  <span className="text-xs font-mono text-gray-600">
                    {selectedApplicationForReview.referenceCode}
                  </span>
                </h2>
              </div>
              <button 
                onClick={() => setSelectedApplicationForReview(null)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Applicant Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-2xl text-xs">
              <div>
                <span className="text-gray-400 block font-semibold">Applicant:</span>
                <span className="font-bold text-gray-900 text-sm">{selectedApplicationForReview.applicantName}</span>
                <span className="text-gray-500 block">{selectedApplicationForReview.purok}</span>
              </div>

              <div>
                <span className="text-gray-400 block font-semibold">Contact:</span>
                <span className="font-semibold text-gray-800">{selectedApplicationForReview.contactNumber}</span>
                <span className="text-gray-500 block">{selectedApplicationForReview.email}</span>
              </div>

              <div>
                <span className="text-gray-400 block font-semibold">Submitted:</span>
                <span className="font-bold text-gray-800">{selectedApplicationForReview.submissionDate}</span>
                <span className="text-[11px] font-semibold text-[#0c532b] block">{selectedApplicationForReview.programCategory}</span>
              </div>

              <div className="col-span-2 sm:col-span-3 pt-2 border-t border-gray-200/60">
                <span className="text-gray-400 block font-semibold">Purpose:</span>
                <p className="font-medium text-gray-800 mt-0.5 leading-snug">
                  {selectedApplicationForReview.purposeOrDiagnosis}
                </p>
              </div>
            </div>

            {/* Consolidated Qualification Card */}
            {(() => {
              const appProg = programs.find(p => p.id === selectedApplicationForReview.programId);
              const isDisApp = isDisasterProgram(appProg || {
                id: selectedApplicationForReview.programId,
                title: selectedApplicationForReview.programTitle,
                category: selectedApplicationForReview.programCategory
              });
              const evalData = selectedApplicationForReview.eligibilityEvaluation;
              const qualDetails = selectedApplicationForReview.qualificationDetails;
              const isQual = isDisApp
                ? (selectedApplicationForReview.status === 'Valid' || selectedApplicationForReview.status === 'Approved' || selectedApplicationForReview.status === 'Ready for Release' || selectedApplicationForReview.status === 'Disbursed')
                : (evalData ? evalData.isCapable : selectedApplicationForReview.isCertificateQualified !== false);
              const isDisRejected = isDisApp && (selectedApplicationForReview.status === 'Disqualified' || selectedApplicationForReview.status === 'Rejected');
              const score = evalData?.score ?? qualDetails?.score ?? (isQual ? 100 : 0);
              const ruleItems = evalData?.rules || evalData?.ruleResults;

              return (
                <div className={`p-4 rounded-2xl border text-xs space-y-2.5 ${
                  isQual
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    : isDisApp && !isDisRejected
                      ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                      : 'bg-rose-50/90 border-rose-300 text-rose-950'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-bold">
                      <ShieldCheck className={`w-4 h-4 ${isQual ? 'text-emerald-700' : isDisApp && !isDisRejected ? 'text-amber-700' : 'text-rose-700'}`} />
                      <span>{isDisApp ? 'Disaster Program Qualification (Admin Decision Only)' : 'System Qualification'}</span>
                    </div>
                    <span className={`font-bold tabular-nums ${isQual ? 'text-emerald-700' : isDisApp && !isDisRejected ? 'text-amber-700' : 'text-rose-700'}`}>
                      {isDisApp
                        ? (isQual ? 'Qualified (Approved by Admin)' : isDisRejected ? 'Not Qualified (Disqualified by Admin)' : 'Pending Admin Decision')
                        : (isQual ? `${selectedApplicationForReview.status === 'Valid' ? 'Valid' : 'Approved'} (${score}%)` : `Invalid / Disqualified (${score}%)`)}
                    </span>
                  </div>

                  <p className="text-xs leading-snug">
                    {isDisApp
                      ? (isQual
                          ? 'Approved as a Qualified beneficiary by Barangay Admin.'
                          : isDisRejected
                            ? (selectedApplicationForReview.rejectionReason || 'Marked Not Qualified by Barangay Admin.')
                            : 'Disaster Programs are excluded from Qualified automation. Use the Admin Decision buttons below to mark this resident Qualified or Disqualified.')
                      : (evalData?.disqualifiedReason || evalData?.summary || (isQual ? 'Fits all qualifications and requirements. Marked Valid automatically by system.' : 'Does not meet program requirements.'))}
                  </p>

                  {ruleItems && ruleItems.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                      {ruleItems.map((r, i) => (
                        <div key={i} className={`p-2 rounded-xl border flex items-start gap-2 ${
                          r.passed ? 'bg-white/80 border-emerald-100' : 'bg-white border-rose-200'
                        }`}>
                          {r.passed ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0">
                            <span className="font-bold text-gray-900 block">{r.ruleName}</span>
                            <span className="text-[11px] text-gray-600 block">{r.explanation || r.details}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : qualDetails ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                      {qualDetails.passedRules?.map((rule, idx) => (
                        <div key={`p-${idx}`} className="p-2 rounded-xl bg-white/80 border border-emerald-100 flex items-start gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="text-[11px] font-medium text-emerald-950">{rule}</span>
                        </div>
                      ))}
                      {qualDetails.failureReasons?.map((reason, idx) => (
                        <div key={`f-${idx}`} className="p-2 rounded-xl bg-white border border-rose-200 flex items-start gap-1.5">
                          <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <span className="text-[11px] font-semibold text-rose-950">{reason}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })()}

            {/* SUBMITTED REQUIREMENTS & ID CARDS INSPECTION SECTION */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-[#0c532b]" />
                  <span>Submitted Resident ID Verification (Front & Back)</span>
                </h4>
                <span className="text-[11px] font-semibold text-gray-500">Click any image to zoom in</span>
              </div>

              {/* ID Cards Preview Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Front of ID */}
                <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#0c532b]" />
                      <span>Front of Valid ID</span>
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      Submitted
                    </span>
                  </div>

                  <div 
                    onClick={() => setZoomedRequirement({
                      title: `Front of ID - ${selectedApplicationForReview.applicantName}`,
                      url: selectedApplicationForReview.idCardFrontUrl || '/assets/services/brgy_clearance_cert_1794197711166.jpg',
                      type: 'Valid Government / Barangay ID (Front)'
                    })}
                    className="relative group cursor-pointer aspect-video rounded-xl bg-gray-900 overflow-hidden border border-emerald-300/60 shadow-xs flex items-center justify-center"
                  >
                    <img 
                      src={selectedApplicationForReview.idCardFrontUrl || '/assets/services/brgy_clearance_cert_1794197711166.jpg'} 
                      alt="Front of ID"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5 text-white text-xs font-bold">
                      <ZoomIn className="w-4 h-4" />
                      <span>Click to Inspect Full Size</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 text-center font-medium">Valid Government / Barangay Citizen ID Front View</p>
                </div>

                {/* Back of ID */}
                <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#0c532b]" />
                      <span>Back of Valid ID</span>
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      Submitted
                    </span>
                  </div>

                  <div 
                    onClick={() => setZoomedRequirement({
                      title: `Back of ID - ${selectedApplicationForReview.applicantName}`,
                      url: selectedApplicationForReview.idCardBackUrl || '/assets/services/brgy_clearance_cert_1794197711166.jpg',
                      type: 'Valid Government / Barangay ID (Back)'
                    })}
                    className="relative group cursor-pointer aspect-video rounded-xl bg-gray-900 overflow-hidden border border-emerald-300/60 shadow-xs flex items-center justify-center"
                  >
                    <img 
                      src={selectedApplicationForReview.idCardBackUrl || '/assets/services/brgy_clearance_cert_1794197711166.jpg'} 
                      alt="Back of ID"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5 text-white text-xs font-bold">
                      <ZoomIn className="w-4 h-4" />
                      <span>Click to Inspect Full Size</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 text-center font-medium">Valid Government / Barangay Citizen ID Back View</p>
                </div>
              </div>

              {/* Supporting Requirement Documents Checklist */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-gray-500" />
                  <span>Supporting Documents & Certifications ({selectedApplicationForReview.documents.length})</span>
                </h4>
                <div className="space-y-2">
                  {selectedApplicationForReview.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#0c532b]/10 text-[#0c532b] flex items-center justify-center font-bold">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-gray-900 block">{doc.name}</span>
                          <span className="text-[10px] text-gray-400">File size: {doc.size} • Type: {doc.type || 'Official Document'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const docUrl = doc.fileUrl || doc.previewUrl || '';
                          return (
                            <button
                              type="button"
                              disabled={!docUrl}
                              title={!docUrl ? 'No attached file preview available' : 'View attached document'}
                              onClick={() => {
                                if (!docUrl) return;
                                setZoomedRequirement({
                                  title: doc.name,
                                  url: docUrl,
                                  type: doc.type || 'Official Requirement Attachment'
                                });
                              }}
                              className={`px-2.5 py-1 border rounded-lg font-bold text-[11px] transition inline-flex items-center gap-1 ${
                                docUrl
                                  ? 'bg-white hover:bg-gray-100 text-gray-700 border-gray-200 cursor-pointer'
                                  : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-70'
                              }`}
                            >
                              <Eye className={`w-3.5 h-3.5 ${docUrl ? 'text-[#0c532b]' : 'text-gray-400'}`} />
                              <span>{docUrl ? 'View Doc' : 'No File'}</span>
                            </button>
                          );
                        })()}
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                          Verified
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Status Timeline History */}
            <div>
              <h4 className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-500" />
                <span>Status History & Audit Trail</span>
              </h4>
              <div className="space-y-2 border-l-2 border-gray-200 ml-3 pl-3 text-xs">
                {selectedApplicationForReview.timeline.map((entry, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-[#0c532b]"></div>
                    <p className="font-bold text-gray-900">{entry.status} <span className="text-[10px] font-normal text-gray-400">• {entry.timestamp}</span></p>
                    <p className="text-[11px] text-gray-500">{entry.remarks || 'Status logged by ' + entry.officerName}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Decision Footer (Admin Decision for Disaster Programs, System View-Only for Regular/Services) */}
            {(() => {
              const appProg = programs.find(p => p.id === selectedApplicationForReview.programId);
              const isDisApp = isDisasterProgram(appProg || {
                id: selectedApplicationForReview.programId,
                title: selectedApplicationForReview.programTitle,
                category: selectedApplicationForReview.programCategory
              });
              if (isDisApp) {
                return (
                  <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-gray-600">
                      <ShieldCheck className={`w-4 h-4 shrink-0 ${
                        selectedApplicationForReview.status === 'Valid' || selectedApplicationForReview.status === 'Approved'
                          ? 'text-emerald-700'
                          : selectedApplicationForReview.status === 'Disqualified' || selectedApplicationForReview.status === 'Rejected'
                            ? 'text-rose-700'
                            : 'text-amber-700'
                      }`} />
                      <span>
                        <strong className="text-gray-900">Admin Decision: {selectedApplicationForReview.status}</strong> · Only Barangay Admin decides Disaster Program qualifiers.
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                      {selectedApplicationForReview.status !== 'Approved' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await updateApplicationStatus(
                              selectedApplicationForReview.id,
                              'Approved',
                              currentUser?.name || 'Barangay Administrator',
                              'Approved and marked Qualified by Barangay Admin under Disaster Program.'
                            );
                          }}
                          className="px-3.5 py-2 bg-[#0c532b] hover:bg-[#094222] text-white font-semibold rounded-lg transition text-xs cursor-pointer"
                        >
                          Mark Qualified (Approve)
                        </button>
                      )}
                      {selectedApplicationForReview.status !== 'Disqualified' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await updateApplicationStatus(
                              selectedApplicationForReview.id,
                              'Disqualified',
                              currentUser?.name || 'Barangay Administrator',
                              'Marked Not Qualified by Barangay Admin under Disaster Program.'
                            );
                          }}
                          className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition text-xs cursor-pointer"
                        >
                          Disqualify
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedApplicationForReview(null)}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-lg transition text-xs cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-gray-600">
                    <ShieldCheck className={`w-4 h-4 shrink-0 ${
                      selectedApplicationForReview.status === 'Valid' || selectedApplicationForReview.status === 'Approved' ? 'text-emerald-700' : 'text-rose-700'
                    }`} />
                    <span>
                      <strong className="text-gray-900">System Decision: {selectedApplicationForReview.status}</strong> · Handled automatically (Admin view-only).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedApplicationForReview(null)}
                    className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-lg transition text-xs cursor-pointer self-end sm:self-auto"
                  >
                    Close
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Requirement / ID Zoom Modal */}
      {zoomedRequirement && (
        <DocumentPreviewModal
          title={zoomedRequirement.title}
          subtitle={zoomedRequirement.type}
          url={zoomedRequirement.url}
          footerText="Document verified by resident authentication pipeline"
          closeLabel="Back to Evaluation"
          onClose={() => setZoomedRequirement(null)}
        />
      )}

      {/* Delete Single Barangay Service Confirmation Modal */}
      {serviceToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isDeletingServices && setServiceToDelete(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 border border-gray-200 shadow-2xl space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Delete Barangay Service?</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Are you sure you want to remove <span className="font-semibold text-gray-800">{serviceToDelete.title}</span> from the active Barangay Services catalog? It will be recorded in Archives.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={isDeletingServices}
                onClick={() => setServiceToDelete(null)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingServices}
                onClick={async () => {
                  setIsDeletingServices(true);
                  const deletedId = serviceToDelete.id;
                  const deletedTitle = serviceToDelete.title;
                  const res = await deleteProgram(deletedId);
                  setIsDeletingServices(false);
                  setServiceToDelete(null);
                  if (res.success) {
                    setSelectedServiceIds(prev => prev.filter(id => id !== deletedId));
                    if (selectedServiceFilter === deletedId) setSelectedServiceFilter('All');
                    setFeedback({
                      type: 'success',
                      message: `Deleted "${deletedTitle}".`
                    });
                  } else {
                    setFeedback({
                      type: 'error',
                      message: res.message || 'Could not delete barangay service.'
                    });
                  }
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                {isDeletingServices ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Selected Barangay Services Confirmation Modal */}
      {isBulkDeleteServicesOpen && selectedServiceIds.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isDeletingServices && setIsBulkDeleteServicesOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Delete {selectedServiceIds.length} Selected {selectedServiceIds.length === 1 ? 'Service' : 'Services'}?
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                This will remove the selected {selectedServiceIds.length === 1 ? 'service' : 'services'} from the active Barangay Services catalog and automatically record them in Archives.
              </p>
            </div>
            {selectedServicesList.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-left max-h-36 overflow-y-auto">
                <ul className="space-y-1 text-xs text-gray-700">
                  {selectedServicesList.slice(0, 6).map(s => (
                    <li key={s.id} className="truncate font-medium">
                      • {s.title}
                    </li>
                  ))}
                  {selectedServicesList.length > 6 && (
                    <li className="text-[11px] font-semibold text-gray-500 pt-0.5">
                      + {selectedServicesList.length - 6} more service(s)
                    </li>
                  )}
                </ul>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={isDeletingServices}
                onClick={() => setIsBulkDeleteServicesOpen(false)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingServices}
                onClick={async () => {
                  setIsDeletingServices(true);
                  const targetIds = [...selectedServiceIds];
                  const res = await deletePrograms(targetIds);
                  setIsDeletingServices(false);
                  setIsBulkDeleteServicesOpen(false);
                  if (res.success) {
                    const count = res.deletedCount ?? targetIds.length;
                    setSelectedServiceIds([]);
                    if (targetIds.includes(selectedServiceFilter)) setSelectedServiceFilter('All');
                    setFeedback({
                      type: 'success',
                      message: `Deleted ${count} selected ${count === 1 ? 'barangay service' : 'barangay services'}.`
                    });
                  } else {
                    setFeedback({
                      type: 'error',
                      message: res.message || 'Could not delete selected barangay services.'
                    });
                  }
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                {isDeletingServices ? 'Deleting...' : `Delete (${selectedServiceIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Application Confirmation Modal */}
      {appToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isDeletingApps && setAppToDelete(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 border border-gray-200 shadow-2xl space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Delete Application?</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Are you sure you want to remove application{' '}
                <span className="font-mono font-semibold text-gray-800">{appToDelete.referenceCode}</span>{' '}
                ({appToDelete.programTitle})? It will be removed from active records and recorded in Archives.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={isDeletingApps}
                onClick={() => setAppToDelete(null)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingApps}
                onClick={async () => {
                  setIsDeletingApps(true);
                  const deletedId = appToDelete.id;
                  const deletedRef = appToDelete.referenceCode;
                  const ok = await deleteApplication(deletedId);
                  setIsDeletingApps(false);
                  setAppToDelete(null);
                  if (ok) {
                    setSelectedAppIds(prev => prev.filter(id => id !== deletedId));
                    setFeedback({
                      type: 'success',
                      message: `Deleted application "${deletedRef}".`
                    });
                  } else {
                    setFeedback({
                      type: 'error',
                      message: 'Could not delete application.'
                    });
                  }
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                {isDeletingApps ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Selected Applications Confirmation Modal */}
      {isBulkDeleteAppsOpen && selectedAppIds.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isDeletingApps && setIsBulkDeleteAppsOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Delete {selectedAppIds.length} Selected {selectedAppIds.length === 1 ? 'Application' : 'Applications'}?
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                This will remove the selected {selectedAppIds.length === 1 ? 'application' : 'applications'} from active lists and automatically record them in Archives.
              </p>
            </div>
            {selectedAppsList.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-left max-h-36 overflow-y-auto">
                <ul className="space-y-1 text-xs text-gray-700">
                  {selectedAppsList.slice(0, 6).map(a => (
                    <li key={a.id} className="truncate font-medium">
                      • <span className="font-mono">{a.referenceCode}</span> — {a.applicantName} ({a.programTitle})
                    </li>
                  ))}
                  {selectedAppsList.length > 6 && (
                    <li className="text-[11px] font-semibold text-gray-500 pt-0.5">
                      + {selectedAppsList.length - 6} more application(s)
                    </li>
                  )}
                </ul>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={isDeletingApps}
                onClick={() => setIsBulkDeleteAppsOpen(false)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingApps}
                onClick={async () => {
                  setIsDeletingApps(true);
                  const targetIds = [...selectedAppIds];
                  const res = await deleteApplications(targetIds);
                  setIsDeletingApps(false);
                  setIsBulkDeleteAppsOpen(false);
                  if (res.success) {
                    const count = res.deletedCount ?? targetIds.length;
                    setSelectedAppIds([]);
                    setFeedback({
                      type: 'success',
                      message: `Deleted ${count} selected ${count === 1 ? 'application' : 'applications'}.`
                    });
                  } else {
                    setFeedback({
                      type: 'error',
                      message: res.message || 'Could not delete selected applications.'
                    });
                  }
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                {isDeletingApps ? 'Deleting...' : `Delete (${selectedAppIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal removed */}
    </div>
  );
};


// ----------------------------------------------------
// 3. ADMIN ANNOUNCEMENTS VIEW
// ----------------------------------------------------
export const AdminAnnouncementsView: React.FC = () => {
  const { 
    announcements, 
    programs, 
    residentsList,
    applications,
    disasterVictims,
    addAnnouncement, 
    updateAnnouncement,
    deleteAnnouncement
  } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingAnn, setEditingAnn] = useState<AnnouncementItem | null>(null);
  const [annToDelete, setAnnToDelete] = useState<AnnouncementItem | null>(null);
  const [isSavingAnn, setIsSavingAnn] = useState(false);
  const [isDeletingAnn, setIsDeletingAnn] = useState(false);
  const [viewingAnn, setViewingAnn] = useState<AnnouncementItem | null>(null);
  const [publishFeedback, setPublishFeedback] = useState<string | null>(null);

  const assistancePrograms = useMemo(
    () => sortProgramsAlphabetically(programs.filter(p => p.status !== 'Closed')),
    [programs]
  );

  const [annForm, setAnnForm] = useState<{
    title: string;
    category: AnnouncementItem['category'];
    description: string;
    iconType: AnnouncementItem['iconType'];
    targetAudienceType: 'All' | 'Qualified Beneficiaries Only';
    targetProgramId: string;
    releaseDate: string;
    meetingTime: string;
    meetingVenue: string;
    instructions: string;
  }>({
    title: '',
    category: 'General',
    description: '',
    iconType: 'general',
    targetAudienceType: 'All',
    targetProgramId: assistancePrograms[0]?.id || '',
    releaseDate: '',
    meetingTime: '08:30 AM',
    meetingVenue: 'Barangay Bugo Covered Court / Session Hall',
    instructions: 'Bring your Barangay Bugo Resident ID and original valid government ID.'
  });

  const selectedTargetProgram = assistancePrograms.find(p => p.id === annForm.targetProgramId);

  const qualifiedRecipientContacts = useMemo(() => {
    if (annForm.targetAudienceType !== 'Qualified Beneficiaries Only' || !selectedTargetProgram) {
      return [];
    }
    const map = new Map<string, { id: string; name: string; contactNumber: string }>();
    for (const r of residentsList) {
      if (r.role !== 'resident' || r.isBanned) continue;
      if (
        evaluateResidentForProgram(
          r,
          selectedTargetProgram.id,
          selectedTargetProgram.title,
          selectedTargetProgram,
          { disasterVictims }
        ).isQualified
      ) {
        map.set(r.id, { id: r.id, name: r.name, contactNumber: r.contactNumber || '' });
      }
    }
    for (const v of disasterVictims) {
      if (!(v.enrolledProgramIds || []).includes(selectedTargetProgram.id)) continue;
      if (v.selectionStatus !== 'Selected' && v.selectionStatus !== 'Distributed') continue;
      const key = v.residentId || `victim-${v.id}`;
      if (!map.has(key)) {
        map.set(key, { id: key, name: v.fullName, contactNumber: v.contactNumber || '' });
      }
    }
    if (isDisasterProgram(selectedTargetProgram)) {
      for (const app of applications) {
        if (app.programId !== selectedTargetProgram.id) continue;
        if (!['Valid', 'Approved', 'Ready for Release', 'Disbursed'].includes(app.status)) continue;
        const matchedUser = residentsList.find(
          r =>
            (app.applicantId && r.id === app.applicantId) ||
            (app.email && r.email && r.email.toLowerCase() === app.email.toLowerCase())
        );
        const key = matchedUser?.id || app.applicantId || `app-${app.id}`;
        if (!map.has(key)) {
          map.set(key, {
            id: key,
            name: matchedUser?.name || app.applicantName || 'Qualified Beneficiary',
            contactNumber: matchedUser?.contactNumber || app.contactNumber || ''
          });
        }
      }
    }
    return Array.from(map.values());
  }, [annForm.targetAudienceType, selectedTargetProgram, residentsList, disasterVictims, applications]);

  const openNewAnnouncementModal = () => {
    setEditingAnn(null);
    setAnnForm({
      title: '',
      category: 'General',
      description: '',
      iconType: 'general',
      targetAudienceType: 'Qualified Beneficiaries Only',
      targetProgramId: assistancePrograms[0]?.id || '',
      releaseDate: '',
      meetingTime: '08:30 AM',
      meetingVenue: 'Barangay Bugo Covered Court / Session Hall',
      instructions: 'Bring your Barangay Bugo Resident ID and original valid government ID.'
    });
    setShowModal(true);
  };

  const openEditAnnouncementModal = (ann: AnnouncementItem) => {
    setEditingAnn(ann);
    setAnnForm({
      title: ann.title || '',
      category: ann.category || 'General',
      description: ann.description || '',
      iconType: ann.iconType || 'general',
      targetAudienceType: ann.targetAudienceType === 'Qualified Beneficiaries Only' ? 'Qualified Beneficiaries Only' : 'All',
      targetProgramId: ann.targetProgramId || (ann.targetAudienceType === 'Qualified Beneficiaries Only' ? (assistancePrograms[0]?.id || '') : ''),
      releaseDate: ann.releaseDate || '',
      meetingTime: ann.meetingTime || '08:30 AM',
      meetingVenue: ann.meetingVenue || 'Barangay Bugo Covered Court / Session Hall',
      instructions: ann.instructions || 'Bring your Barangay Bugo Resident ID and original valid government ID.'
    });
    setShowModal(true);
  };

  const handleCreateOrSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const isTargeted = annForm.targetAudienceType === 'Qualified Beneficiaries Only';
    setIsSavingAnn(true);

    const payload: Omit<AnnouncementItem, 'id' | 'viewsCount'> = {
      title: annForm.title.trim(),
      category: isTargeted && annForm.category === 'General' ? 'Program Release' : annForm.category,
      description: annForm.description.trim(),
      date: editingAnn?.date || 'Today',
      iconType: isTargeted ? 'calendar' : annForm.category === 'Disaster' ? 'alert' : annForm.iconType,
      status: editingAnn?.status || 'Published',
      targetAudienceType: annForm.targetAudienceType,
      ...(isTargeted && selectedTargetProgram ? {
        targetProgramId: selectedTargetProgram.id,
        targetProgramTitle: selectedTargetProgram.title,
        releaseDate: annForm.releaseDate || undefined,
        meetingTime: annForm.meetingTime || undefined,
        meetingVenue: annForm.meetingVenue || undefined,
        instructions: annForm.instructions || undefined
      } : {
        targetProgramId: selectedTargetProgram?.id || undefined,
        targetProgramTitle: selectedTargetProgram?.title || undefined,
        releaseDate: undefined,
        meetingTime: undefined,
        meetingVenue: undefined,
        instructions: undefined
      })
    };

    if (editingAnn) {
      const res = await updateAnnouncement(editingAnn.id, payload);
      setIsSavingAnn(false);
      if (res.success) {
        setShowModal(false);
        setEditingAnn(null);
        setPublishFeedback('Notice updated and synced.');
        setTimeout(() => setPublishFeedback(null), 5000);
      } else {
        setPublishFeedback(res.message || 'Could not update notice. Please try again.');
        setTimeout(() => setPublishFeedback(null), 5000);
      }
      return;
    }

    const res = await addAnnouncement(payload);
    setIsSavingAnn(false);

    if (res.success) {
      setShowModal(false);
      setPublishFeedback(
        isTargeted
          ? `Release schedule published to ${qualifiedRecipientContacts.length} qualified.`
          : 'Public notice published.'
      );
      setTimeout(() => setPublishFeedback(null), 5000);
      setAnnForm({
        title: '',
        category: 'General',
        description: '',
        iconType: 'general',
        targetAudienceType: 'All',
        targetProgramId: assistancePrograms[0]?.id || '',
        releaseDate: '',
        meetingTime: '08:30 AM',
        meetingVenue: 'Barangay Bugo Covered Court / Session Hall',
        instructions: 'Bring your Barangay Bugo Resident ID and original valid government ID.'
      });
    } else {
      setPublishFeedback(res.message || 'Could not publish notice. Please try again.');
      setTimeout(() => setPublishFeedback(null), 5000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Barangay Announcements
          </h1>
        </div>

        <button
          onClick={openNewAnnouncementModal}
          className="flex items-center gap-2 px-4 py-2 bg-[#0c532b] hover:bg-[#094222] text-white text-sm font-semibold rounded-lg transition shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Announcement</span>
        </button>
      </div>

      {publishFeedback && (
        <div
          className={`p-3.5 border rounded-2xl text-xs font-bold flex items-center gap-2 ${
            /failed|could not/i.test(publishFeedback)
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          {/failed|could not/i.test(publishFeedback) ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span>{publishFeedback}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {announcements.map((ann) => {
          const isExclusive = ann.targetAudienceType === 'Qualified Beneficiaries Only';
          return (
            <div 
              key={ann.id} 
              onClick={() => {
                setViewingAnn(ann);
              }}
              className={`bg-white rounded-2xl p-5 border shadow-xs hover:border-[#0c532b] hover:shadow-md transition cursor-pointer flex flex-col justify-between space-y-3 group ${
                isExclusive ? 'border-emerald-300 ring-1 ring-emerald-100 bg-emerald-50/20' : 'border-gray-200'
              }`}
            >
              <div>
                <h3 className="text-sm font-bold text-gray-900 group-hover:text-[#0c532b] transition-colors">{ann.title}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-3 leading-relaxed">{ann.description}</p>

                {isExclusive && (ann.releaseDate || ann.meetingTime) && (
                  <div className="mt-2.5 p-2 bg-emerald-100/60 rounded-xl border border-emerald-200 text-[11px] text-emerald-950 space-y-0.5">
                    {ann.releaseDate && (
                      <div className="font-semibold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-700" />
                        <span>{ann.releaseDate} {ann.meetingTime ? `• ${ann.meetingTime}` : ''}</span>
                      </div>
                    )}
                    {ann.meetingVenue && (
                      <div className="text-[10px] text-emerald-800 truncate">
                        {ann.meetingVenue}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1 font-semibold text-gray-600">
                  <Eye className="w-3.5 h-3.5 text-gray-400" />
                  {ann.viewsCount || 0} {(ann.viewsCount || 0) === 1 ? 'view' : 'views'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditAnnouncementModal(ann);
                    }}
                    className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#0c532b] transition cursor-pointer"
                    title="Edit announcement"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAnnToDelete(ann);
                    }}
                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                    title="Delete announcement"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* View Announcement Detail Modal */}
      <AnnouncementModal 
        announcement={viewingAnn}
        onClose={() => setViewingAnn(null)}
      />

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-gray-200 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">
                {editingAnn ? 'Edit Barangay Notice' : 'Publish Barangay Notice'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingAnn(null);
                }}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrSave} className="space-y-3 text-xs">
              {/* Target Audience Switcher */}
              <div>
                <label className="block font-bold text-gray-700 mb-1.5">Target Audience</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAnnForm({ ...annForm, targetAudienceType: 'All', targetProgramId: '' })}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      annForm.targetAudienceType === 'All'
                        ? 'bg-emerald-50 border-[#0c532b] text-[#0c532b] font-bold'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-xs font-extrabold">All Residents</div>
                    <div className="text-[10px] opacity-80">Public bulletin</div>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setAnnForm({
                        ...annForm,
                        targetAudienceType: 'Qualified Beneficiaries Only',
                        category: 'Program Release',
                        targetProgramId: annForm.targetProgramId || assistancePrograms[0]?.id || ''
                      })
                    }
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      annForm.targetAudienceType === 'Qualified Beneficiaries Only'
                        ? 'bg-emerald-50 border-[#0c532b] text-[#0c532b] font-bold'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-xs font-extrabold">Qualified Only</div>
                    <div className="text-[10px] opacity-80">Targeted Schedule Notice</div>
                  </button>
                </div>
              </div>

              {annForm.targetAudienceType === 'All' && (
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Linked Cert., Program, or Disaster (Optional)
                  </label>
                  <select
                    value={annForm.targetProgramId}
                    onChange={(e) => setAnnForm({ ...annForm, targetProgramId: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-[#0c532b]"
                  >
                    <option value="">Auto-detect from Title / General Notice</option>
                    {assistancePrograms.map(prog => (
                      <option key={prog.id} value={prog.id}>
                        {prog.title} ({prog.category})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Targeted Program / Service & Release Fields */}
              {annForm.targetAudienceType === 'Qualified Beneficiaries Only' && (
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
                  <div>
                    <label className="block font-bold text-emerald-950 mb-1">Target Program or Barangay Service (A–Z)</label>
                    <select
                      value={annForm.targetProgramId}
                      onChange={(e) => setAnnForm({ ...annForm, targetProgramId: e.target.value })}
                      className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-[#0c532b]"
                    >
                      {assistancePrograms.map(prog => (
                        <option key={prog.id} value={prog.id}>
                          {prog.title} ({prog.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-emerald-950 mb-1">Release Date</label>
                      <input
                        type="date"
                        value={annForm.releaseDate}
                        onChange={(e) => setAnnForm({ ...annForm, releaseDate: e.target.value })}
                        className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 font-medium outline-none focus:ring-2 focus:ring-[#0c532b]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-emerald-950 mb-1">Time</label>
                      <input
                        type="text"
                        placeholder="e.g. 08:30 AM - 12:00 PM"
                        value={annForm.meetingTime}
                        onChange={(e) => setAnnForm({ ...annForm, meetingTime: e.target.value })}
                        className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 font-medium outline-none focus:ring-2 focus:ring-[#0c532b]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-emerald-950 mb-1">Venue</label>
                    <input
                      type="text"
                      placeholder="e.g. Barangay Bugo Covered Court"
                      value={annForm.meetingVenue}
                      onChange={(e) => setAnnForm({ ...annForm, meetingVenue: e.target.value })}
                      className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 font-medium outline-none focus:ring-2 focus:ring-[#0c532b]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-emerald-950 mb-1">Bring / Note</label>
                    <input
                      type="text"
                      placeholder="What to bring..."
                      value={annForm.instructions}
                      onChange={(e) => setAnnForm({ ...annForm, instructions: e.target.value })}
                      className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 font-medium outline-none focus:ring-2 focus:ring-[#0c532b]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder={annForm.targetAudienceType === 'Qualified Beneficiaries Only' ? 'e.g. Senior Citizen Pension Release' : 'e.g. Free Medical Checkup'}
                  value={annForm.title}
                  onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-medium outline-none focus:ring-2 focus:ring-[#0c532b]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Category</label>
                <select
                  value={annForm.category}
                  onChange={(e) => setAnnForm({ ...annForm, category: e.target.value as AnnouncementItem['category'] })}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-semibold outline-none focus:ring-2 focus:ring-[#0c532b]"
                >
                  <option value="Program Release">Program Release</option>
                  <option value="Disaster">Disaster &amp; Emergency Alert</option>
                  <option value="Meeting">Beneficiary Meeting</option>
                  <option value="Water">Water Interruption</option>
                  <option value="Health">Health & Medical</option>
                  <option value="Sports">Sports & SK</option>
                  <option value="Assembly">Barangay Assembly</option>
                  <option value="General">General Notice</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Details</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Write short details..."
                  value={annForm.description}
                  onChange={(e) => setAnnForm({ ...annForm, description: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 font-medium outline-none focus:ring-2 focus:ring-[#0c532b]"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingAnn}
                className="w-full py-2.5 bg-[#0c532b] hover:bg-[#094222] disabled:opacity-60 text-white font-bold rounded-xl transition shadow-xs cursor-pointer"
              >
                {isSavingAnn
                  ? 'Saving...'
                  : editingAnn
                  ? 'Save Changes'
                  : annForm.targetAudienceType === 'Qualified Beneficiaries Only'
                  ? `Publish to ${qualifiedRecipientContacts.length} Qualified`
                  : 'Publish Notice'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Announcement Confirmation Modal */}
      {annToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isDeletingAnn && setAnnToDelete(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 border border-gray-200 shadow-2xl space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Delete Announcement?</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Remove <span className="font-semibold text-gray-800">{annToDelete.title}</span> from the portal? It will be recorded in Archives.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={isDeletingAnn}
                onClick={() => setAnnToDelete(null)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingAnn}
                onClick={async () => {
                  setIsDeletingAnn(true);
                  const deletedTitle = annToDelete.title;
                  const res = await deleteAnnouncement(annToDelete.id);
                  setIsDeletingAnn(false);
                  setAnnToDelete(null);
                  if (res.success) {
                    setPublishFeedback(`Deleted "${deletedTitle}".`);
                    setTimeout(() => setPublishFeedback(null), 4000);
                  } else {
                    setPublishFeedback(res.message || `Could not delete "${deletedTitle}".`);
                    setTimeout(() => setPublishFeedback(null), 5000);
                  }
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                {isDeletingAnn ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// ----------------------------------------------------
// 3.5 PROGRAM-SCOPED QUALIFIED RESIDENTS ("VIEW RESIDENTS")
// ----------------------------------------------------
interface AdminProgramQualifiedResidentsViewProps {
  program: AssistanceProgram;
  onBack: () => void;
}

const AdminProgramQualifiedResidentsView: React.FC<AdminProgramQualifiedResidentsViewProps> = ({
  program,
  onBack
}) => {
  const { residentsList, disasterVictims } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [residentScope, setResidentScope] = useState<'qualified' | 'not-qualified' | 'all'>('qualified');
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);

  const activeResidents = useMemo(() => {
    const seen = new Set<string>();
    return residentsList
      .filter(r => r.role === 'resident' && !r.isBanned)
      .filter(r => {
        const key = `${r.id}`;
        const nameKey = (r.name || '').trim().toLowerCase();
        if (seen.has(key) || (nameKey && seen.has(nameKey))) return false;
        seen.add(key);
        if (nameKey) seen.add(nameKey);
        return true;
      });
  }, [residentsList]);

  const isCertificationProgram = !isDisasterProgram(program) && isBarangayServiceApplicationItem(program);

  const evaluations = activeResidents
    .map(resident => {
      const evaluation = isCertificationProgram
        ? evaluateCertificateQualification(resident, program.id, program)
        : evaluateResidentForProgram(resident, program.id, program.title, program, { disasterVictims });
      return { resident, eval: evaluation };
    })
    .sort((a, b) => {
      if (a.eval.isQualified !== b.eval.isQualified) {
        return Number(b.eval.isQualified) - Number(a.eval.isQualified);
      }
      return (a.resident.name || '').localeCompare(b.resident.name || '');
    });

  const qualifiedCount = evaluations.filter(e => e.eval.isQualified).length;
  const notQualifiedCount = evaluations.length - qualifiedCount;

  const filtered = evaluations.filter(entry => {
    const matchesScope =
      residentScope === 'all'
        ? true
        : residentScope === 'qualified'
          ? entry.eval.isQualified
          : !entry.eval.isQualified;
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (entry.resident.name || '').toLowerCase().includes(q) ||
      (entry.resident.purok || '').toLowerCase().includes(q) ||
      (entry.resident.residentIdNumber || '').toLowerCase().includes(q);
    return matchesScope && matchesSearch;
  });

  const inspected = selectedResidentId
    ? evaluations.find(e => e.resident.id === selectedResidentId) || null
    : null;

  const formatTraits = (res: ResidentUser): string => {
    const traits: string[] = [];
    if (res.householdIncome) traits.push(res.householdIncome.split('(')[0].trim());
    if (res.employmentStatus) traits.push(res.employmentStatus);
    else if (res.occupation) traits.push(res.occupation);
    if (res.isSenior || (typeof res.age === 'number' && res.age >= 60)) traits.push('Senior');
    if (res.isPwd) traits.push('PWD');
    if (res.isSoloParent) traits.push('Solo Parent');
    if (res.isStudent) traits.push('Student');
    if (res.hasMedicalNeed) traits.push('Medical Need');
    if (res.isDisasterAffected) traits.push(res.disasterType || 'Disaster-Affected');
    return traits.join(' · ');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="mt-0.5 p-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-700 cursor-pointer transition"
            title="Back to Programs"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
              {program.title}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
              {qualifiedCount} qualified · {notQualifiedCount} not qualified · {activeResidents.length} residents
            </p>
          </div>
        </div>
      </div>

      {/* Search & Qualified Toggle */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search resident name, ID, or zone..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#0c532b]"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setResidentScope('qualified')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              residentScope === 'qualified' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Qualified ({qualifiedCount})
          </button>
          <button
            type="button"
            onClick={() => setResidentScope('not-qualified')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              residentScope === 'not-qualified' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Not Qualified ({notQualifiedCount})
          </button>
          <button
            type="button"
            onClick={() => setResidentScope('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              residentScope === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All ({activeResidents.length})
          </button>
        </div>
      </div>

      {/* Residents Qualification Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
        {filtered.length === 0 ? (
          <div className="py-12 text-center px-4">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-700">No residents found</p>
            <p className="text-xs text-gray-400 mt-1">
              {residentScope === 'qualified'
                ? 'No residents match the qualification criteria for this program.'
                : 'Try another filter or search keyword.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase">
                  <th className="py-3 px-4">Resident</th>
                  <th className="py-3 px-4">Account Profile</th>
                  <th className="py-3 px-4">Result</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(({ resident, eval: evalRes }) => {
                  const traits = formatTraits(resident);
                  return (
                    <tr key={resident.id} className="hover:bg-gray-50/70">
                      <td className="py-3 px-4">
                        <p className="font-bold text-gray-900">{resident.name}</p>
                        <p className="text-[11px] text-gray-500">
                          {resident.residentIdNumber || 'No ID'} · {(resident.purok || 'Bugo').split(' - ')[0]}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-[11px] text-gray-600">
                        {traits || 'Registered Resident'}
                      </td>
                      <td className="py-3 px-4">
                        <p className={`text-xs font-bold ${evalRes.isQualified ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {evalRes.isQualified ? 'Qualified' : 'Not Qualified'}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate max-w-xs">
                          {evalRes.shortReason}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedResidentId(resident.id)}
                          className="px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 text-[11px] font-semibold rounded-lg cursor-pointer"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Qualification Breakdown Modal */}
      {inspected && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedResidentId(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 border border-gray-200 shadow-2xl space-y-3 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">{inspected.resident.name}</h2>
                <p className="text-[11px] text-gray-500">
                  {program.title} · {(inspected.resident.purok || 'Bugo').split(' - ')[0]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedResidentId(null)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className={`p-3 rounded-xl border ${
              inspected.eval.isQualified
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              <p className="font-bold">{inspected.eval.isQualified ? 'Qualified' : 'Not Qualified'}</p>
              <p className="text-[11px] mt-0.5">{inspected.eval.summary}</p>
            </div>

            {inspected.eval.passedCriteria.length > 0 && (
              <div className="space-y-1">
                <p className="font-bold text-emerald-800">Passed Criteria</p>
                <ul className="list-disc list-inside text-gray-700 space-y-0.5">
                  {inspected.eval.passedCriteria.map((c, idx) => (
                    <li key={idx}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {inspected.eval.failedCriteria.length > 0 && (
              <div className="space-y-1">
                <p className="font-bold text-rose-700">Unmet Criteria</p>
                <ul className="list-disc list-inside text-rose-700 space-y-0.5">
                  {inspected.eval.failedCriteria.map((c, idx) => (
                    <li key={idx}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setSelectedResidentId(null)}
                className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// ----------------------------------------------------
// 4. ADMIN SETTINGS VIEW
// ----------------------------------------------------
export const AdminSettingsView: React.FC = () => {
  const {
    role,
    currentUser,
    residentsList,
    reviewProfileChangeRequest,
    secretariatDetails,
    verifyCurrentPassword,
    updateSecretariatDetails,
  } = useApp();

  const isAdminUser = role === 'admin' && currentUser?.role === 'admin';

  const pendingProfileRequests = useMemo(
    () =>
      residentsList.filter(
        (r) => r.role === 'resident' && r.pendingProfileUpdate?.status === 'Pending'
      ),
    [residentsList]
  );

  const [declineReasons, setDeclineReasons] = useState<Record<string, string>>({});
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [profileReviewFeedback, setProfileReviewFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const formatProfileFieldLabel = (field: string) => {
    const customLabels: Record<string, string> = {
      name: 'Full Name',
      email: 'Email',
      contactNumber: 'Contact No.',
      nationality: 'Nationality',
      purok: 'Zone / Purok',
      address: 'Address',
      householdIncome: 'Monthly Income',
      familyMembersCount: 'Household Size',
      occupation: 'Occupation',
      employmentStatus: 'Employment',
      age: 'Age',
      gender: 'Gender',
      voterStatus: 'Voter Status',
    };
    return customLabels[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  };

  const handleProfileEditDecision = async (
    resident: ResidentUser,
    decision: 'approve' | 'reject'
  ) => {
    if (!isAdminUser || processingRequestId) return;
    setProfileReviewFeedback(null);
    setProcessingRequestId(resident.id);
    const reason = declineReasons[resident.id]?.trim() || undefined;
    const res = await reviewProfileChangeRequest(resident.id, decision, reason);
    setProcessingRequestId(null);

    if (!res.success) {
      setProfileReviewFeedback({
        type: 'error',
        message: res.message || 'Could not update request.',
      });
      return;
    }

    setDeclineReasons((prev) => {
      const next = { ...prev };
      delete next[resident.id];
      return next;
    });
    setProfileReviewFeedback({
      type: 'success',
      message:
        decision === 'approve'
          ? `Approved profile edit for ${resident.name}.`
          : `Declined profile edit for ${resident.name}.`,
    });
  };

  const [lguUnitInput, setLguUnitInput] = useState(secretariatDetails.lguUnit);
  const [punongBarangayInput, setPunongBarangayInput] = useState(secretariatDetails.punongBarangay);
  const [isSecretariatUnlocked, setIsSecretariatUnlocked] = useState(false);
  const [verifiedEditToken, setVerifiedEditToken] = useState('');
  const [verifiedPassword, setVerifiedPassword] = useState('');

  // Password Prompt Modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState('');

  const [isSavingSecretariat, setIsSavingSecretariat] = useState(false);
  const [secretariatFeedback, setSecretariatFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!isSecretariatUnlocked) {
      setLguUnitInput(secretariatDetails.lguUnit);
      setPunongBarangayInput(secretariatDetails.punongBarangay);
    }
  }, [secretariatDetails, isSecretariatUnlocked]);

  const handleOpenUnlockModal = () => {
    if (!isAdminUser) return;
    setSecretariatFeedback(null);
    setAdminPasswordInput('');
    setShowAdminPassword(false);
    setPasswordModalError('');
    setShowPasswordModal(true);
  };

  const handleCloseUnlockModal = () => {
    if (isVerifyingPassword) return;
    setShowPasswordModal(false);
    setAdminPasswordInput('');
    setPasswordModalError('');
  };

  const handleVerifyAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminUser) {
      setPasswordModalError('Only Barangay Administrators can edit Secretariat Details.');
      return;
    }
    if (!adminPasswordInput) {
      setPasswordModalError('Please enter your administrator password.');
      return;
    }

    setPasswordModalError('');
    setIsVerifyingPassword(true);
    const res = await verifyCurrentPassword(adminPasswordInput);
    setIsVerifyingPassword(false);

    if (!res.success || !res.verificationToken) {
      setPasswordModalError(res.message || 'Incorrect administrator password.');
      return;
    }

    setVerifiedEditToken(res.verificationToken);
    setVerifiedPassword(adminPasswordInput);
    setLguUnitInput(secretariatDetails.lguUnit);
    setPunongBarangayInput(secretariatDetails.punongBarangay);
    setIsSecretariatUnlocked(true);
    setShowPasswordModal(false);
    setAdminPasswordInput('');
    setPasswordModalError('');
  };

  const handleCancelSecretariatEdit = () => {
    setIsSecretariatUnlocked(false);
    setVerifiedEditToken('');
    setVerifiedPassword('');
    setLguUnitInput(secretariatDetails.lguUnit);
    setPunongBarangayInput(secretariatDetails.punongBarangay);
    setSecretariatFeedback(null);
  };

  const handleSaveSecretariatDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminUser || !isSecretariatUnlocked) return;

    const cleanLgu = lguUnitInput.trim();
    const cleanCaptain = punongBarangayInput.trim();

    if (!cleanLgu) {
      setSecretariatFeedback({ type: 'error', message: 'LGU / Barangay Unit cannot be empty.' });
      return;
    }
    if (!cleanCaptain) {
      setSecretariatFeedback({ type: 'error', message: 'Punong Barangay (Captain) cannot be empty.' });
      return;
    }
    if (!verifiedEditToken && !verifiedPassword) {
      setSecretariatFeedback({ type: 'error', message: 'Administrator password verification is required.' });
      handleOpenUnlockModal();
      return;
    }

    setSecretariatFeedback(null);
    setIsSavingSecretariat(true);
    const res = await updateSecretariatDetails({
      lguUnit: cleanLgu,
      punongBarangay: cleanCaptain,
      verificationToken: verifiedEditToken || undefined,
      currentPassword: verifiedPassword || undefined,
    });
    setIsSavingSecretariat(false);

    if (!res.success) {
      setSecretariatFeedback({ type: 'error', message: res.message });
      return;
    }

    setIsSecretariatUnlocked(false);
    setVerifiedEditToken('');
    setVerifiedPassword('');
    setSecretariatFeedback({
      type: 'success',
      message: res.message || 'Barangay Secretariat Details updated and locked.',
    });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          System Account & Administrative Settings
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Barangay Bugo administrative configuration and security credentials.
        </p>
      </div>

      {/* Profile Edit Approvals */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#0c532b]" />
            <h3 className="text-sm font-bold text-gray-900">Profile Edit Requests</h3>
          </div>
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
              pendingProfileRequests.length > 0
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}
          >
            {pendingProfileRequests.length} Pending
          </span>
        </div>

        {profileReviewFeedback && (
          <div
            className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              profileReviewFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {profileReviewFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{profileReviewFeedback.message}</span>
          </div>
        )}

        {pendingProfileRequests.length === 0 ? (
          <p className="text-xs text-gray-500 py-1">No pending profile edit requests.</p>
        ) : (
          <div className="space-y-3">
            {pendingProfileRequests.map((resident) => {
              const pending = resident.pendingProfileUpdate!;
              const isBusy = processingRequestId === resident.id;
              return (
                <div
                  key={resident.id}
                  className="rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                        {resident.name}
                      </span>
                      <span className="text-[11px] text-gray-500 font-medium">
                        {resident.purok}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-400">{pending.requestedAt}</span>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                    {Object.entries(pending.changes).map(([field, newValue]) => {
                      const oldValue = (resident as unknown as Record<string, unknown>)[field];
                      return (
                        <div
                          key={field}
                          className="px-3 py-2 flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="font-semibold text-gray-600">
                            {formatProfileFieldLabel(field)}
                          </span>
                          <div className="flex items-center gap-1.5 font-medium text-right">
                            <span className="text-gray-400 line-through">
                              {oldValue !== undefined && oldValue !== '' ? String(oldValue) : '—'}
                            </span>
                            <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
                            <span className="font-bold text-[#0c532b]">{String(newValue)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      value={declineReasons[resident.id] || ''}
                      onChange={(e) =>
                        setDeclineReasons((prev) => ({ ...prev, [resident.id]: e.target.value }))
                      }
                      placeholder="Decline reason (optional)"
                      disabled={isBusy}
                      className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0c532b]/20 focus:border-[#0c532b]"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleProfileEditDecision(resident, 'approve')}
                        className="flex-1 sm:flex-none px-3.5 py-1.5 bg-[#0c532b] hover:bg-[#094222] disabled:opacity-50 text-white font-bold rounded-lg text-xs inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleProfileEditDecision(resident, 'reject')}
                        className="flex-1 sm:flex-none px-3.5 py-1.5 bg-white hover:bg-rose-50 disabled:opacity-50 text-rose-700 font-bold rounded-lg border border-rose-200 text-xs inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Decline</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Change Password & Security Credentials */}
      <ChangePasswordSection />

      {/* LGU Secretariat Details (Admin-Only & Password-Protected Editing) */}
      <form onSubmit={handleSaveSecretariatDetails} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-gray-900">Barangay Secretariat Details</h3>
            {isSecretariatUnlocked ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                <CheckCircle2 className="w-3 h-3" />
                Unlocked for Admin
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200 text-[10px] font-bold">
                <Lock className="w-3 h-3" />
                Password Protected
              </span>
            )}
          </div>

          {isAdminUser && (
            <div className="flex items-center gap-2">
              {!isSecretariatUnlocked ? (
                <button
                  type="button"
                  onClick={handleOpenUnlockModal}
                  className="px-3.5 py-1.5 bg-[#0c532b] hover:bg-[#094222] text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Details</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCancelSecretariatEdit}
                    disabled={isSavingSecretariat}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSecretariat}
                    className="px-3.5 py-1.5 bg-[#0c532b] hover:bg-[#094222] text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-2xs"
                  >
                    {isSavingSecretariat ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{isSavingSecretariat ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {secretariatFeedback && (
          <div
            className={`p-3 rounded-xl border flex items-start gap-2 text-xs font-medium ${
              secretariatFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {secretariatFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{secretariatFeedback.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-gray-600 mb-1">LGU / Barangay Unit</label>
            <input
              type="text"
              readOnly={!isAdminUser || !isSecretariatUnlocked}
              required
              maxLength={160}
              value={lguUnitInput}
              onChange={(e) => setLguUnitInput(e.target.value)}
              className={`w-full rounded-xl px-3 py-2 font-bold border transition ${
                isAdminUser && isSecretariatUnlocked
                  ? 'bg-white border-[#0c532b] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0c532b]/20'
                  : 'bg-gray-100 border-gray-200 text-gray-700'
              }`}
            />
          </div>
          <div>
            <label className="block font-bold text-gray-600 mb-1">Punong Barangay (Captain)</label>
            <input
              type="text"
              readOnly={!isAdminUser || !isSecretariatUnlocked}
              required
              maxLength={160}
              value={punongBarangayInput}
              onChange={(e) => setPunongBarangayInput(e.target.value)}
              className={`w-full rounded-xl px-3 py-2 font-bold border transition ${
                isAdminUser && isSecretariatUnlocked
                  ? 'bg-white border-[#0c532b] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0c532b]/20'
                  : 'bg-gray-100 border-gray-200 text-gray-700'
              }`}
            />
          </div>
        </div>

        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-[#0c532b] flex-shrink-0" />
          <p className="text-[11px] text-[#0c532b] font-medium">
            Barangay Citizen & Administrative Portal is encrypted with role-based access control. All status updates, SQL exports, and registrations are timestamped on audit logs.
          </p>
        </div>
      </form>

      {/* Admin Password Verification Modal for Editing Secretariat Details */}
      {showPasswordModal && isAdminUser && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={handleCloseUnlockModal}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#0c532b] border border-emerald-100 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-gray-900">Verify Administrator Password</h4>
                  <p className="text-[11px] text-gray-500">
                    Enter your Admin password to unlock and edit Barangay Secretariat Details.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseUnlockModal}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {passwordModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{passwordModalError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyAdminPassword} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1.5">
                  Administrator Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    autoFocus
                    required
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="Enter your current Admin password"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-3.5 pr-10 py-2.5 font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0c532b]/20 focus:border-[#0c532b]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                    aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                  >
                    {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCloseUnlockModal}
                  disabled={isVerifyingPassword}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingPassword || !adminPasswordInput}
                  className="px-4 py-2 bg-[#0c532b] hover:bg-[#094222] text-white font-bold rounded-xl inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {isVerifyingPassword ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>{isVerifyingPassword ? 'Verifying...' : 'Verify & Unlock'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


// ----------------------------------------------------
// 5. ADMIN PROGRAMS CATALOG & ADD PROGRAM VIEW
// ----------------------------------------------------
const PROGRAM_CATEGORIES: ProgramCategory[] = [
  'Social Welfare Services',
  'Health and Medical Services',
  'Livelihood and Employment Services',
  'Legal Services',
  'Community and Emergency Services',
];

const DISASTER_CATEGORIES: DisasterCategory[] = [
  'Flood',
  'Fire',
  'Landslide',
  'Earthquake',
  'Typhoon / Storm',
  'Other',
];

const SERVICE_CATEGORIES: ProgramCategory[] = [
  'Clearance & Certification',
  'Barangay Administrative Services',
  'Civil Registration Services',
];

const QUALIFICATION_SECTOR_OPTIONS: Array<{ id: ProgramQualificationSector; label: string }> = [
  { id: 'unemployed', label: 'Unemployed / Jobseeker' },
  { id: 'senior', label: 'Senior Citizen (60+)' },
  { id: 'pwd', label: 'PWD' },
  { id: 'solo_parent', label: 'Solo Parent' },
  { id: 'student', label: 'Student' },
  { id: 'medical_need', label: 'Medical Need' },
];

const EMPLOYMENT_STATUS_OPTIONS = [
  'Unemployed',
  'Self-Employed',
  'Employed (Part-Time)',
  'Employed (Full-Time)',
  'Student',
  'Retired',
];

const TARGET_AUDIENCE_PRESETS = [
  'All Bugo Residents',
  'Low-Income / Indigent (<= ₱10,000)',
  'Senior Citizens (60+)',
  'Persons with Disability (PWD)',
  'Solo Parents',
  'Students',
  'Unemployed / Jobseekers',
];

export const AdminProgramsView: React.FC = () => {
  const { programs, disasterVictims, residentsList, addProgram, updateProgram, deleteProgram, deletePrograms } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [programTypeFilter, setProgramTypeFilter] = useState<'all' | 'automatic' | 'apply' | 'disaster' | 'certification'>('all');
  const [programAccessFilter, setProgramAccessFilter] = useState<'all' | 'available' | 'closed'>('all');
  const [togglingProgramId, setTogglingProgramId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedProgramForVictims, setSelectedProgramForVictims] = useState<AssistanceProgram | null>(null);
  const [selectedProgramForResidents, setSelectedProgramForResidents] = useState<AssistanceProgram | null>(null);
  const [viewingProgram, setViewingProgram] = useState<AssistanceProgram | null>(null);
  const [editingProgram, setEditingProgram] = useState<AssistanceProgram | null>(null);
  const [programToDelete, setProgramToDelete] = useState<AssistanceProgram | null>(null);
  const [selectedProgramIds, setSelectedProgramIds] = useState<string[]>([]);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalMode, setModalMode] = useState<'regular' | 'disaster' | 'service' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const selectAllCheckboxRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    title: '',
    category: 'Social Welfare Services' as ProgramCategory,
    tagline: '',
    description: '',
    deadline: 'Year-Round Service',
    targetAudience: 'All Bugo Residents',
    processingTime: '1 - 3 Business Days',
    maxBenefitAmount: '',
    status: 'Active' as 'Active' | 'Open' | 'Closed',
    applicationMode: 'automatic' as 'automatic' | 'apply',
    requirementsList: [''] as string[],
    eligibilityList: ['Resident of Barangay Bugo'] as string[],
    autoEnrollVictims: false,
    qualificationRules: getDefaultQualificationRulesForProgram(null) as ProgramQualificationRules
  });

  const activeResidents = useMemo(() => {
    const seen = new Set<string>();
    return residentsList
      .filter(r => r.role === 'resident' && !r.isBanned)
      .filter(r => {
        const nameKey = (r.name || '').trim().toLowerCase();
        if (seen.has(r.id) || (nameKey && seen.has(nameKey))) return false;
        seen.add(r.id);
        if (nameKey) seen.add(nameKey);
        return true;
      });
  }, [residentsList]);

  const catalogPrograms = useMemo(
    () => sortProgramsApplyFirst(programs),
    [programs]
  );
  const openProgramsCount = useMemo(
    () => catalogPrograms.filter(p => p.status !== 'Closed').length,
    [catalogPrograms]
  );
  const categories = Array.from(new Set<string>(catalogPrograms.map(p => String(p.category || '')))).filter(Boolean).sort((a, b) => a.localeCompare(b));

  const handleToggleProgramAccess = async (prog: AssistanceProgram) => {
    const nextStatus: 'Active' | 'Closed' = prog.status === 'Closed' ? 'Active' : 'Closed';
    setTogglingProgramId(prog.id);
    const res = await updateProgram(prog.id, { status: nextStatus });
    setTogglingProgramId(null);
    if (res.success) {
      setFeedback({
        type: 'success',
        message:
          nextStatus === 'Closed'
            ? `"${prog.title}" is now Closed and hidden from Residents.`
            : `"${prog.title}" is now Available to Residents.`
      });
    } else {
      setFeedback({
        type: 'error',
        message: res.message || 'Could not update program access.'
      });
    }
  };

  const filteredPrograms = catalogPrograms.filter(p => {
    const q = searchTerm.trim().toLowerCase();
    const isDis = isDisasterProgram(p);
    const isCert = !isDis && isBarangayServiceApplicationItem(p);
    const isApply = !isDis && !isCert && isApplyOnlyProgram(p);
    const matchesType =
      programTypeFilter === 'all' ||
      (programTypeFilter === 'disaster' && isDis) ||
      (programTypeFilter === 'certification' && isCert) ||
      (programTypeFilter === 'apply' && isApply) ||
      (programTypeFilter === 'automatic' && !isDis && !isCert && !isApply);
    const matchesAccess =
      programAccessFilter === 'all' ||
      (programAccessFilter === 'available' ? p.status !== 'Closed' : p.status === 'Closed');
    const matchesSearch =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.targetAudience || '').toLowerCase().includes(q);
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesType && matchesAccess && matchesSearch && matchesCategory;
  });

  const visibleProgramIds = useMemo(
    () => filteredPrograms.map(p => p.id),
    [filteredPrograms]
  );

  const selectedIdSet = useMemo(() => new Set(selectedProgramIds), [selectedProgramIds]);

  const selectedVisibleCount = useMemo(
    () => visibleProgramIds.filter(id => selectedIdSet.has(id)).length,
    [visibleProgramIds, selectedIdSet]
  );

  const allVisibleSelected =
    visibleProgramIds.length > 0 && selectedVisibleCount === visibleProgramIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  const selectedPrograms = useMemo(
    () => catalogPrograms.filter(p => selectedIdSet.has(p.id)),
    [catalogPrograms, selectedIdSet]
  );

  useEffect(() => {
    const activeIds = new Set(catalogPrograms.map(p => p.id));
    setSelectedProgramIds(prev => {
      const next = prev.filter(id => activeIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [catalogPrograms]);

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  const toggleSelectProgram = (programId: string) => {
    setSelectedProgramIds(prev =>
      prev.includes(programId)
        ? prev.filter(id => id !== programId)
        : [...prev, programId]
    );
  };

  const toggleSelectAllVisible = () => {
    if (visibleProgramIds.length === 0) return;
    if (allVisibleSelected) {
      const visibleSet = new Set(visibleProgramIds);
      setSelectedProgramIds(prev => prev.filter(id => !visibleSet.has(id)));
    } else {
      setSelectedProgramIds(prev => Array.from(new Set([...prev, ...visibleProgramIds])));
    }
  };

  const openModal = (mode: 'regular' | 'disaster' | 'service') => {
    setFeedback(null);
    setEditingProgram(null);
    setModalMode(mode);
    setForm({
      title: '',
      category:
        mode === 'disaster'
          ? 'Flood'
          : mode === 'service'
          ? 'Clearance & Certification'
          : 'Social Welfare Services',
      tagline: '',
      description: '',
      deadline: 'Year-Round Service',
      targetAudience: mode === 'disaster' ? 'Affected Disaster Victims' : 'All Bugo Residents',
      processingTime:
        mode === 'disaster'
          ? 'Immediate / Emergency'
          : mode === 'service'
          ? 'Same Day'
          : '1 - 3 Business Days',
      maxBenefitAmount: mode === 'service' ? 'Standard Certification' : '',
      status: 'Active',
      applicationMode: 'automatic',
      requirementsList:
        mode === 'service' ? ['Valid Government ID', 'Barangay Certificate of Residency'] : [''],
      eligibilityList:
        mode === 'disaster'
          ? ['Recorded Disaster Victim']
          : mode === 'service'
          ? ['Verified resident of Barangay Bugo']
          : ['Resident of Barangay Bugo'],
      autoEnrollVictims: false,
      qualificationRules: getDefaultQualificationRulesForProgram({ programType: mode, applicationMode: 'automatic' })
    });
  };

  const openEditModal = (prog: AssistanceProgram) => {
    setFeedback(null);
    const mode = isDisasterProgram(prog)
      ? 'disaster'
      : isBarangayServiceApplicationItem(prog)
      ? 'service'
      : 'regular';
    setEditingProgram(prog);
    setModalMode(mode);
    setForm({
      title: prog.title || '',
      category: prog.category || (mode === 'disaster' ? 'Flood' : mode === 'service' ? 'Clearance & Certification' : 'Social Welfare Services'),
      tagline: prog.tagline || '',
      description: prog.description || '',
      deadline: prog.deadline || 'Year-Round Service',
      targetAudience: prog.targetAudience || (mode === 'disaster' ? 'Affected Disaster Victims' : 'All Bugo Residents'),
      processingTime: prog.processingTime || (mode === 'disaster' ? 'Immediate / Emergency' : mode === 'service' ? 'Same Day' : '1 - 3 Business Days'),
      maxBenefitAmount: prog.maxBenefitAmount || '',
      status: prog.status || 'Active',
      applicationMode: isApplyOnlyProgram(prog) ? 'apply' : 'automatic',
      requirementsList: prog.requirements && prog.requirements.length > 0 ? [...prog.requirements] : [''],
      eligibilityList:
        prog.eligibilityCriteria && prog.eligibilityCriteria.length > 0
          ? [...prog.eligibilityCriteria]
          : [mode === 'disaster' ? 'Recorded Disaster Victim' : mode === 'service' ? 'Verified resident of Barangay Bugo' : 'Resident of Barangay Bugo'],
      autoEnrollVictims: Boolean(prog.autoEnrollVictims),
      qualificationRules: getDefaultQualificationRulesForProgram(prog)
    });
  };

  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalMode || !form.title.trim()) return;

    const isDisaster = modalMode === 'disaster';
    const isService = modalMode === 'service';
    if (!isDisaster && !form.description.trim()) return;

    setIsSaving(true);
    const requirements = form.requirementsList
      .map(s => s.trim())
      .filter(Boolean);
    const eligibilityCriteria = form.eligibilityList
      .map(s => s.trim())
      .filter(Boolean);

    const resolvedDescription = isDisaster
      ? (form.description.trim() || `${form.category} disaster assistance program.`)
      : form.description.trim();

    if (editingProgram) {
      const res = await updateProgram(editingProgram.id, {
        title: form.title.trim(),
        category: form.category,
        tagline: form.tagline.trim() || resolvedDescription.slice(0, 110),
        description: resolvedDescription,
        status: form.status,
        deadline: form.deadline.trim() || editingProgram.deadline || 'Year-Round Service',
        targetAudience: isDisaster ? 'Affected Disaster Victims' : (form.targetAudience.trim() || 'All Bugo Residents'),
        processingTime: form.processingTime.trim() || (isService ? 'Same Day' : '1 - 3 Business Days'),
        maxBenefitAmount: isDisaster
          ? (form.maxBenefitAmount.trim() || 'Disaster Assistance')
          : isService
          ? (form.maxBenefitAmount.trim() || 'Barangay Certification / Service')
          : (form.maxBenefitAmount.trim() || 'Barangay Assistance'),
        requirements: isDisaster ? editingProgram.requirements || [] : requirements,
        eligibilityCriteria: eligibilityCriteria.length > 0 ? eligibilityCriteria : [isService ? 'Verified resident of Barangay Bugo' : 'Resident of Barangay Bugo'],
        ...(isService && { programType: 'service' as const }),
        ...(!isDisaster && !isService && {
          applicationMode: form.applicationMode,
          qualificationRules: form.qualificationRules
        })
      });
      setIsSaving(false);
      if (res.success && res.program) {
        setFeedback({
          type: 'success',
          message: `Updated "${res.program.title}" and synced changes to resident portal & linked applications.`
        });
        setModalMode(null);
        setEditingProgram(null);
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'Could not update program.'
        });
      }
      return;
    }

    const res = await addProgram({
      title: form.title.trim(),
      category: form.category,
      tagline: form.tagline.trim() || resolvedDescription.slice(0, 110),
      description: resolvedDescription,
      imageUrl: isDisaster
        ? '/assets/services/brgy_disaster_rescue_1794197713383.jpg'
        : isService
        ? '/assets/services/brgy_clearance_cert_1794197711166.jpg'
        : '/assets/services/real_barangay_hall_1788172230992.jpg',
      status: isDisaster ? 'Active' : form.status,
      badgeText: isDisaster
        ? 'Disaster Program'
        : isService
        ? 'Barangay Service'
        : (form.applicationMode === 'apply' ? 'Apply Program' : 'Auto-Matched Program'),
      deadline: form.deadline.trim() || 'Year-Round Service',
      targetAudience: isDisaster ? 'Affected Disaster Victims' : (form.targetAudience.trim() || 'All Bugo Residents'),
      processingTime: form.processingTime.trim() || (isService ? 'Same Day' : '1 - 3 Business Days'),
      maxBenefitAmount: isDisaster
        ? 'Disaster Assistance'
        : isService
        ? (form.maxBenefitAmount.trim() || 'Barangay Certification / Service')
        : (form.maxBenefitAmount.trim() || 'Barangay Assistance'),
      requirements: isDisaster ? [] : (isService && requirements.length === 0 ? ['Valid Government ID'] : requirements),
      eligibilityCriteria: eligibilityCriteria.length > 0 ? eligibilityCriteria : [isService ? 'Verified resident of Barangay Bugo' : 'Resident of Barangay Bugo'],
      programType: modalMode,
      ...(!isDisaster && !isService && {
        applicationMode: form.applicationMode,
        qualificationRules: form.qualificationRules
      }),
      autoEnrollVictims: false
    });

    setIsSaving(false);

    if (res.success && res.program) {
      setFeedback({
        type: 'success',
        message: isService
          ? `Added certificate "${res.program.title}" — now available in Resident Certification & Barangay Services.`
          : `Added ${isDisaster ? 'disaster program' : 'program'} "${res.program.title}".`
      });
      setModalMode(null);
    } else {
      setFeedback({
        type: 'error',
        message: res.message || `Could not add ${isService ? 'certificate' : 'program'}. Please check your session and try again.`
      });
    }
  };

  if (selectedProgramForVictims) {
    return (
      <AdminDisasterVictimsView
        program={selectedProgramForVictims}
        onBack={() => setSelectedProgramForVictims(null)}
      />
    );
  }

  if (selectedProgramForResidents) {
    return (
      <AdminProgramQualifiedResidentsView
        program={selectedProgramForResidents}
        onBack={() => setSelectedProgramForResidents(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Programs & Disaster Aid
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => openModal('disaster')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Flame className="w-4 h-4" />
            <span>Add a Disaster Program</span>
          </button>
          <button
            type="button"
            onClick={() => openModal('regular')}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#0c532b] hover:bg-[#094222] text-white text-xs font-semibold rounded-lg transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Program</span>
          </button>
          <button
            type="button"
            onClick={() => openModal('service')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Certificate</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-medium flex items-center justify-between gap-2 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-gray-400 hover:text-gray-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white rounded-xl p-3.5 border border-gray-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1">
          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search programs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-[#0c532b]"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by category"
            className="w-full sm:w-48 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 font-medium outline-none focus:bg-white focus:ring-2 focus:ring-[#0c532b] cursor-pointer"
          >
            <option value="All">All Categories ({catalogPrograms.length})</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={programAccessFilter}
            onChange={(e) => setProgramAccessFilter(e.target.value as 'all' | 'available' | 'closed')}
            aria-label="Filter by resident access"
            className="w-full sm:w-40 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 font-medium outline-none focus:bg-white focus:ring-2 focus:ring-[#0c532b] cursor-pointer"
          >
            <option value="all">All Access</option>
            <option value="available">Available ({openProgramsCount})</option>
            <option value="closed">Closed ({catalogPrograms.length - openProgramsCount})</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-gray-100 rounded-lg self-start lg:self-auto">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'automatic', label: 'Automatic' },
              { id: 'apply', label: 'Apply' },
              { id: 'disaster', label: 'Disaster' },
              { id: 'certification', label: 'Certification' }
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setProgramTypeFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
                programTypeFilter === tab.id ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Simple Programs Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredPrograms.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">
            No programs match your search or selected filters.
          </div>
        ) : (
          <>
            <div className={`px-4 py-2.5 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 transition ${
              selectedProgramIds.length > 0 ? 'bg-rose-50/70' : 'bg-gray-50/60'
            }`}>
              <div className="flex items-center gap-3 text-xs">
                <label className="inline-flex items-center gap-2 font-semibold text-gray-700 hover:text-gray-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    aria-label="Select all visible programs"
                    className="w-4 h-4 rounded border-gray-300 text-[#0c532b] focus:ring-[#0c532b] cursor-pointer accent-[#0c532b]"
                  />
                  <span>
                    {allVisibleSelected
                      ? `Deselect All (${filteredPrograms.length})`
                      : `Select All (${filteredPrograms.length})`}
                  </span>
                </label>

                {selectedProgramIds.length > 0 && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span className="font-bold text-rose-700 tabular-nums">
                      {selectedProgramIds.length} selected
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedProgramIds([])}
                      className="text-xs font-semibold text-gray-500 hover:text-gray-800 underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>

              {selectedProgramIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setFeedback(null);
                    setIsBulkDeleteConfirmOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition shadow-2xs cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedProgramIds.length})</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-500 font-semibold text-[11px] border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 pl-4 pr-2 w-10">
                      <input
                        ref={selectAllCheckboxRef}
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                        aria-label="Select all programs in table"
                        className="w-4 h-4 rounded border-gray-300 text-[#0c532b] focus:ring-[#0c532b] cursor-pointer accent-[#0c532b]"
                      />
                    </th>
                    <th className="py-2.5 px-4">Program</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Resident Access</th>
                    <th className="py-2.5 px-4 text-center">Eligible / Victims</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPrograms.map(prog => {
                    const isDis = isDisasterProgram(prog);
                    const isCert = !isDis && isBarangayServiceApplicationItem(prog);
                    const isApply = !isDis && !isCert && isApplyOnlyProgram(prog);
                    const isChecked = selectedIdSet.has(prog.id);
                    const isAvailable = prog.status !== 'Closed';
                    const isToggling = togglingProgramId === prog.id;
                    const victimCount = isDis
                      ? new Set(
                          disasterVictims
                            .filter(v => (v.enrolledProgramIds || []).includes(prog.id) && doesVictimQualifyForDisasterProgram(v.disasterType, prog))
                            .map(v => (v.residentId ? `id:${v.residentId}` : `name:${v.fullName.trim().toLowerCase()}`))
                        ).size
                      : 0;
                    const qualifiedCount = !isDis
                      ? activeResidents.filter(r =>
                          isCert
                            ? evaluateCertificateQualification(r, prog.id, prog).isQualified
                            : evaluateResidentForProgram(r, prog.id, prog.title, prog, { disasterVictims }).isQualified
                        ).length
                      : 0;

                    return (
                      <tr
                        key={prog.id}
                        className={`transition ${isChecked ? 'bg-rose-50/40 hover:bg-rose-50/60' : 'hover:bg-gray-50/70'}`}
                      >
                        <td className="py-3 pl-4 pr-2 w-10">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectProgram(prog.id)}
                            aria-label={`Select ${prog.title}`}
                            className="w-4 h-4 rounded border-gray-300 text-[#0c532b] focus:ring-[#0c532b] cursor-pointer accent-[#0c532b]"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-gray-900">{prog.title}</p>
                          <p className="text-[11px] text-gray-500">{prog.category}</p>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`text-xs font-semibold ${
                              isDis
                                ? 'text-amber-700'
                                : isCert
                                ? 'text-blue-700'
                                : isApply
                                ? 'text-sky-700'
                                : 'text-[#0c532b]'
                            }`}
                          >
                            {isDis ? 'Disaster' : isCert ? 'Certification' : isApply ? 'Apply' : 'Automatic'}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => handleToggleProgramAccess(prog)}
                            title={isAvailable ? 'Click to close for residents' : 'Click to make available to residents'}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer disabled:opacity-50 ${
                              isAvailable
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                                : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {isToggling ? 'Updating...' : isAvailable ? 'Available' : 'Closed'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-center tabular-nums">
                          {isDis ? (
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              victimCount > 0 ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {victimCount} {victimCount === 1 ? 'victim' : 'victims'}
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              qualifiedCount > 0 ? 'bg-emerald-50 text-[#0c532b]' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {qualifiedCount} qualified
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2.5">
                            {isDis ? (
                              <button
                                type="button"
                                onClick={() => setSelectedProgramForVictims(prog)}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg text-xs font-bold cursor-pointer transition"
                              >
                                View Victims
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSelectedProgramForResidents(prog)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#0c532b] rounded-lg text-xs font-bold cursor-pointer transition"
                              >
                                View Residents
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditModal(prog)}
                              className="text-xs font-semibold text-[#0c532b] hover:text-[#094222] hover:underline cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setViewingProgram(prog)}
                              className="text-xs font-semibold text-gray-600 hover:text-gray-900 hover:underline cursor-pointer"
                            >
                              Details
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFeedback(null);
                                setProgramToDelete(prog);
                              }}
                              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* View Program Details Modal */}
      {viewingProgram && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setViewingProgram(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 border border-gray-200 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-100">
              <div>
                <p className="text-[11px] font-medium text-gray-500">{viewingProgram.category}</p>
                <h2 className="text-base font-bold text-gray-900 mt-0.5">{viewingProgram.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setViewingProgram(null)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-gray-700 leading-relaxed">{viewingProgram.description}</p>

              <div className="grid grid-cols-2 gap-3 pt-1 text-gray-600">
                <div>
                  <span className="text-[11px] text-gray-400 block">Target Audience</span>
                  <span className="font-semibold text-gray-900">{viewingProgram.targetAudience}</span>
                </div>
                <div>
                  <span className="text-[11px] text-gray-400 block">Processing Time</span>
                  <span className="font-semibold text-gray-900">{viewingProgram.processingTime}</span>
                </div>
                {viewingProgram.maxBenefitAmount && (
                  <div className="col-span-2">
                    <span className="text-[11px] text-gray-400 block">Benefit / Service Provided</span>
                    <span className="font-semibold text-gray-900">{viewingProgram.maxBenefitAmount}</span>
                  </div>
                )}
              </div>

              {viewingProgram.requirements?.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <span className="font-semibold text-gray-800 block mb-1">Requirements</span>
                  <ul className="list-disc list-inside text-gray-600 space-y-0.5">
                    {viewingProgram.requirements.map((req, idx) => (
                      <li key={idx}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}

              {viewingProgram.eligibilityCriteria?.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <span className="font-semibold text-gray-800 block mb-1">Eligibility Criteria</span>
                  <ul className="list-disc list-inside text-gray-600 space-y-0.5">
                    {viewingProgram.eligibilityCriteria.map((crit, idx) => (
                      <li key={idx}>{crit}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!isDisasterProgram(viewingProgram) && !isApplyOnlyProgram(viewingProgram) && !isBarangayServiceApplicationItem(viewingProgram) && (
                <div className="pt-2 border-t border-gray-100">
                  <span className="font-semibold text-gray-800 block mb-1">
                    Create-Account Qualification Rules
                  </span>
                  <ul className="list-disc list-inside text-emerald-800 bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 space-y-0.5">
                    {formatEligibilityCriteriaFromRules(
                      getDefaultQualificationRulesForProgram(viewingProgram)
                    ).map((line, idx) => (
                      <li key={idx}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Delete Program Confirmation Modal */}
      {programToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isDeleting && setProgramToDelete(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 border border-gray-200 shadow-2xl space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Delete Program?</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Are you sure you want to remove <span className="font-semibold text-gray-800">{programToDelete.title}</span> from the catalog? It will be recorded in Archives.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setProgramToDelete(null)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  const deletedId = programToDelete.id;
                  const deletedTitle = programToDelete.title;
                  const res = await deleteProgram(deletedId);
                  setIsDeleting(false);
                  setProgramToDelete(null);
                  if (res.success) {
                    setSelectedProgramIds(prev => prev.filter(id => id !== deletedId));
                    setFeedback({
                      type: 'success',
                      message: `Deleted "${deletedTitle}".`
                    });
                  } else {
                    setFeedback({
                      type: 'error',
                      message: res.message || 'Could not delete program.'
                    });
                  }
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Selected Programs Confirmation Modal */}
      {isBulkDeleteConfirmOpen && selectedProgramIds.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isDeleting && setIsBulkDeleteConfirmOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Delete {selectedProgramIds.length} Selected {selectedProgramIds.length === 1 ? 'Program' : 'Programs'}?
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                This will remove the selected {selectedProgramIds.length === 1 ? 'program' : 'programs'} from the active catalog and automatically record them in Archives.
              </p>
            </div>
            {selectedPrograms.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-left max-h-36 overflow-y-auto">
                <ul className="space-y-1 text-xs text-gray-700">
                  {selectedPrograms.slice(0, 6).map(p => (
                    <li key={p.id} className="truncate font-medium">
                      • {p.title}
                    </li>
                  ))}
                  {selectedPrograms.length > 6 && (
                    <li className="text-[11px] font-semibold text-gray-500 pt-0.5">
                      + {selectedPrograms.length - 6} more program(s)
                    </li>
                  )}
                </ul>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setIsBulkDeleteConfirmOpen(false)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  const targetIds = [...selectedProgramIds];
                  const res = await deletePrograms(targetIds);
                  setIsDeleting(false);
                  setIsBulkDeleteConfirmOpen(false);
                  if (res.success) {
                    const count = res.deletedCount ?? targetIds.length;
                    setSelectedProgramIds([]);
                    setFeedback({
                      type: 'success',
                      message: `Deleted ${count} selected ${count === 1 ? 'program' : 'programs'}.`
                    });
                  } else {
                    setFeedback({
                      type: 'error',
                      message: res.message || 'Could not delete selected programs.'
                    });
                  }
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : `Delete (${selectedProgramIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Program Modal */}
      {modalMode && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => {
            setModalMode(null);
            setEditingProgram(null);
          }}
        >
          <div
            className={`bg-white rounded-2xl w-full p-6 border border-gray-200 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto ${
              modalMode === 'regular' ? 'max-w-2xl' : 'max-w-lg'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  {editingProgram
                    ? (modalMode === 'disaster'
                        ? 'Edit Disaster Program'
                        : modalMode === 'service'
                        ? 'Edit Certification / Service'
                        : 'Edit Program')
                    : modalMode === 'disaster'
                    ? 'Add a Disaster Program'
                    : modalMode === 'service'
                    ? 'Add Certificate'
                    : 'Add Program'}
                </h2>
                <p className="text-xs text-gray-500">
                  {editingProgram
                    ? 'Updates apply immediately to the resident portal, linked applications, and notifications.'
                    : modalMode === 'disaster'
                    ? 'For disaster relief victims managed under View Victims.'
                    : modalMode === 'service'
                    ? 'Published immediately under Resident Certification & Barangay Services.'
                    : 'Qualified residents are matched automatically under View Residents.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalMode(null);
                  setEditingProgram(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProgram} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  {modalMode === 'service' ? 'Certificate Title' : 'Program Title'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    modalMode === 'disaster'
                      ? 'e.g. Flood Emergency Cash & Food Aid'
                      : modalMode === 'service'
                      ? 'e.g. Scholarship Endorsement Certificate'
                      : 'e.g. Senior Citizen Medical Grant'
                  }
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                />
              </div>

              {modalMode === 'disaster' ? (
                <>
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value as ProgramCategory })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                    >
                      {DISASTER_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <BulletListEditor
                    label="Eligibility Criteria"
                    items={form.eligibilityList}
                    onChange={(next) => setForm({ ...form, eligibilityList: next })}
                    placeholder="e.g. Recorded Disaster Victim"
                    addLabel="Add Criterion"
                  />
                </>
              ) : modalMode === 'service' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Category</label>
                      <select
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value as ProgramCategory })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                      >
                        {SERVICE_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Status</label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value as 'Active' | 'Open' | 'Closed' })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                      >
                        <option value="Active">Active</option>
                        <option value="Open">Open</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Tagline / Short Summary</label>
                    <input
                      type="text"
                      placeholder="Short one-line summary shown on cards..."
                      value={form.tagline}
                      onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">
                      Description <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={2}
                      placeholder="Short description of what this certificate covers for residents..."
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Qualified Group / Target Audience</label>
                      <input
                        type="text"
                        list="admin-qualified-group-presets"
                        placeholder="e.g. All Bugo Residents"
                        value={form.targetAudience}
                        onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                      />
                      <datalist id="admin-qualified-group-presets">
                        {TARGET_AUDIENCE_PRESETS.map(preset => (
                          <option key={preset} value={preset} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Processing Time</label>
                      <input
                        type="text"
                        placeholder="e.g. Same Day"
                        value={form.processingTime}
                        onChange={(e) => setForm({ ...form, processingTime: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Fee / Benefit Note</label>
                      <input
                        type="text"
                        placeholder="e.g. Free or ₱50.00"
                        value={form.maxBenefitAmount}
                        onChange={(e) => setForm({ ...form, maxBenefitAmount: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Availability / Deadline</label>
                      <input
                        type="text"
                        placeholder="e.g. Year-Round Service"
                        value={form.deadline}
                        onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    <BulletListEditor
                      label="Requirements"
                      items={form.requirementsList}
                      onChange={(next) => setForm({ ...form, requirementsList: next })}
                      placeholder="e.g. Valid School ID or Certificate of Registration (COR)"
                      addLabel="Add Requirement"
                      helperText="Each bullet is verified against uploaded resident files."
                    />

                    <BulletListEditor
                      label="Eligibility Criteria"
                      items={form.eligibilityList}
                      onChange={(next) => setForm({ ...form, eligibilityList: next })}
                      placeholder="e.g. Verified resident of Barangay Bugo"
                      addLabel="Add Criterion"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Category</label>
                      <select
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value as ProgramCategory })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                      >
                        {PROGRAM_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Program Mode</label>
                      <select
                        value={form.applicationMode}
                        onChange={(e) => setForm({ ...form, applicationMode: e.target.value as 'automatic' | 'apply' })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                      >
                        <option value="automatic">Automatic (Create Account)</option>
                        <option value="apply">Apply (Submit Requirements)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Status</label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value as 'Active' | 'Open' | 'Closed' })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                      >
                        <option value="Active">Active</option>
                        <option value="Open">Open</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">
                      Description <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={2}
                      placeholder="Program description..."
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Qualified Group / Target Audience</label>
                      <input
                        type="text"
                        list="admin-qualified-group-presets"
                        placeholder="e.g. Low-Income / Indigent, Senior Citizens, Solo Parents"
                        value={form.targetAudience}
                        onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                      />
                      <datalist id="admin-qualified-group-presets">
                        {TARGET_AUDIENCE_PRESETS.map(preset => (
                          <option key={preset} value={preset} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Benefit / Aid Provided</label>
                      <input
                        type="text"
                        placeholder="e.g. ₱5,000 Cash Aid or Relief Pack"
                        value={form.maxBenefitAmount}
                        onChange={(e) => setForm({ ...form, maxBenefitAmount: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                      />
                    </div>
                  </div>

                  {/* Create-Account Qualification Rules Editor */}
                  <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-emerald-950 block">
                          Create-Account Qualification Rules
                        </span>
                        <span className="text-[11px] text-emerald-800/80">
                          Controls automatic resident qualification and View Residents matching immediately when saved.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setForm(prev => ({
                            ...prev,
                            eligibilityList: formatEligibilityCriteriaFromRules(prev.qualificationRules)
                          }))
                        }
                        className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-[#0c532b] border border-emerald-300 rounded-lg text-[11px] font-bold transition cursor-pointer shrink-0"
                      >
                        Sync to Criteria Bullets
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                          Qualification Rule Mode
                        </label>
                        <select
                          value={form.qualificationRules.sectorMatchMode || 'all_required'}
                          onChange={(e) =>
                            setForm(prev => ({
                              ...prev,
                              qualificationRules: {
                                ...prev.qualificationRules,
                                sectorMatchMode: e.target.value as 'any_or_income' | 'all_required'
                              }
                            }))
                          }
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#0c532b]"
                        >
                          <option value="any_or_income">Income Cap OR Any Selected Sector</option>
                          <option value="all_required">Must Meet All Selected Criteria</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                          Max Monthly Income (₱)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={500}
                          placeholder="No income limit"
                          value={form.qualificationRules.maxMonthlyIncome ?? ''}
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            setForm(prev => ({
                              ...prev,
                              qualificationRules: {
                                ...prev.qualificationRules,
                                maxMonthlyIncome: raw === '' ? null : Math.max(0, Number(raw))
                              }
                            }));
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#0c532b]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                          5+ Household Income Cap (₱)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={500}
                          placeholder="Optional"
                          value={form.qualificationRules.largeHouseholdMaxIncome ?? ''}
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            const val = raw === '' ? null : Math.max(0, Number(raw));
                            setForm(prev => ({
                              ...prev,
                              qualificationRules: {
                                ...prev.qualificationRules,
                                largeHouseholdMinMembers: val !== null ? (prev.qualificationRules.largeHouseholdMinMembers || 5) : null,
                                largeHouseholdMaxIncome: val
                              }
                            }));
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#0c532b]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">Min Age</label>
                        <input
                          type="number"
                          min={0}
                          max={120}
                          placeholder="Any"
                          value={form.qualificationRules.minAge ?? ''}
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            setForm(prev => ({
                              ...prev,
                              qualificationRules: {
                                ...prev.qualificationRules,
                                minAge: raw === '' ? null : Math.max(0, Number(raw))
                              }
                            }));
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#0c532b]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">Max Age</label>
                        <input
                          type="number"
                          min={0}
                          max={120}
                          placeholder="Any"
                          value={form.qualificationRules.maxAge ?? ''}
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            setForm(prev => ({
                              ...prev,
                              qualificationRules: {
                                ...prev.qualificationRules,
                                maxAge: raw === '' ? null : Math.max(0, Number(raw))
                              }
                            }));
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#0c532b]"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                          Large Household Min Members
                        </label>
                        <input
                          type="number"
                          min={2}
                          max={20}
                          placeholder="e.g. 5"
                          value={form.qualificationRules.largeHouseholdMinMembers ?? ''}
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            setForm(prev => ({
                              ...prev,
                              qualificationRules: {
                                ...prev.qualificationRules,
                                largeHouseholdMinMembers: raw === '' ? null : Math.max(2, Number(raw))
                              }
                            }));
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#0c532b]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                        Eligible Profile Sectors (Create Account Flags)
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {QUALIFICATION_SECTOR_OPTIONS.map(sector => {
                          const selected = (form.qualificationRules.eligibleSectors || []).includes(sector.id);
                          return (
                            <button
                              key={sector.id}
                              type="button"
                              onClick={() => {
                                setForm(prev => {
                                  const curr = prev.qualificationRules.eligibleSectors || [];
                                  const next = curr.includes(sector.id)
                                    ? curr.filter(s => s !== sector.id)
                                    : [...curr, sector.id];
                                  return {
                                    ...prev,
                                    qualificationRules: { ...prev.qualificationRules, eligibleSectors: next }
                                  };
                                });
                              }}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                                selected
                                  ? 'bg-[#0c532b] border-[#0c532b] text-white'
                                  : 'bg-white border-gray-200 text-gray-700 hover:border-[#0c532b]'
                              }`}
                            >
                              {sector.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                        Allowed Employment Statuses <span className="font-normal text-gray-500">(leave all unselected for any)</span>
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {EMPLOYMENT_STATUS_OPTIONS.map(status => {
                          const selected = (form.qualificationRules.allowedEmploymentStatuses || []).includes(status);
                          return (
                            <button
                              key={status}
                              type="button"
                              onClick={() => {
                                setForm(prev => {
                                  const curr = prev.qualificationRules.allowedEmploymentStatuses || [];
                                  const next = curr.includes(status)
                                    ? curr.filter(s => s !== status)
                                    : [...curr, status];
                                  return {
                                    ...prev,
                                    qualificationRules: { ...prev.qualificationRules, allowedEmploymentStatuses: next }
                                  };
                                });
                              }}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                                selected
                                  ? 'bg-[#0c532b] border-[#0c532b] text-white'
                                  : 'bg-white border-gray-200 text-gray-700 hover:border-[#0c532b]'
                              }`}
                            >
                              {status}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                        Allowed Bugo Zones <span className="font-normal text-gray-500">(leave all unselected for Zones 1–10)</span>
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {BUGO_PUROKS.map(zone => {
                          const selected = (form.qualificationRules.allowedZones || []).includes(zone);
                          return (
                            <button
                              key={zone}
                              type="button"
                              onClick={() => {
                                setForm(prev => {
                                  const curr = prev.qualificationRules.allowedZones || [];
                                  const next = curr.includes(zone)
                                    ? curr.filter(z => z !== zone)
                                    : [...curr, zone];
                                  return {
                                    ...prev,
                                    qualificationRules: { ...prev.qualificationRules, allowedZones: next }
                                  };
                                });
                              }}
                              className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                                selected
                                  ? 'bg-[#0c532b] border-[#0c532b] text-white'
                                  : 'bg-white border-gray-200 text-gray-700 hover:border-[#0c532b]'
                              }`}
                            >
                              {zone}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    <BulletListEditor
                      label="Requirements (optional)"
                      items={form.requirementsList}
                      onChange={(next) => setForm({ ...form, requirementsList: next })}
                      placeholder="e.g. Valid Government ID or Certificate of Indigency"
                      addLabel="Add Requirement"
                      helperText="Requirement keywords are checked in uploaded files; unrelated uploads are rejected as invalid."
                    />

                    <BulletListEditor
                      label="Eligibility Criteria"
                      items={form.eligibilityList}
                      onChange={(next) => setForm({ ...form, eligibilityList: next })}
                      placeholder="e.g. Bona fide resident of Barangay Bugo"
                      addLabel="Add Criterion"
                    />
                  </div>
                </>
              )}

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalMode(null);
                    setEditingProgram(null);
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`px-4 py-2 disabled:opacity-60 text-white font-semibold rounded-lg transition cursor-pointer ${
                    modalMode === 'disaster'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : modalMode === 'service'
                      ? 'bg-blue-700 hover:bg-blue-800'
                      : 'bg-[#0c532b] hover:bg-[#094222]'
                  }`}
                >
                  {isSaving
                    ? 'Saving...'
                    : editingProgram
                    ? 'Save Changes'
                    : modalMode === 'disaster'
                    ? 'Save Disaster Program'
                    : modalMode === 'service'
                    ? 'Save Certificate'
                    : 'Save Program'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

