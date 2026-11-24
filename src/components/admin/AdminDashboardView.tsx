import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  FileCheck2,
  Megaphone,
  Plus,
  FileText,
  Droplet,
  Cross,
  Trophy,
  Clock,
  CheckCircle2,
  Eye,
  Sliders,
  RotateCcw,
  Save,
  X,
  BarChart3,
  ListOrdered,
  Trash2,
  ChevronDown,
  Search,
  Check
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BUGO_PUROKS } from '../../data/mockData';
import { CensusData, RankingPriorityLevel } from '../../types';
import { parseMonthlyIncome } from '../../utils/eligibilityEngine';
import { sortApplicationsFCFS, formatShortQueueDateTime } from '../../utils/sortUtils';
import {
  RANKING_TIERS,
  getRankingTierMeta,
  sortRankingClassifications
} from '../../utils/rankingClassification';

interface AdminDashboardViewProps {
  onNavigateTab: (tab: 'dashboard' | 'residents' | 'status-tracking' | 'announcements' | 'settings') => void;
  onOpenNewResidentModal: () => void;
  onOpenNewAnnouncementModal?: () => void;
  onOpenClearanceModal: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  onNavigateTab,
  onOpenNewResidentModal,
  onOpenClearanceModal
}) => {
  const {
    announcements,
    residentsList,
    applications,
    censusData,
    updateCensusData,
    resetCensusToBenchmark,
    setSelectedZoneForRegistry,
    rankingClassifications,
    upsertRankingClassification,
    bulkUpsertRankingClassifications,
    updateRankingClassification,
    deleteRankingClassification,
    bulkDeleteRankingClassifications
  } = useApp();

  const [analyticsView, setAnalyticsView] = useState<'accounts' | 'census'>('accounts');
  const [selectedZone, setSelectedZone] = useState<string>('All');
  const [inspectedZone, setInspectedZone] = useState<string | null>(null);
  const [isAdjustCensusOpen, setIsAdjustCensusOpen] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [censusForm, setCensusForm] = useState<CensusData>(censusData);
  const [selectedRankZone, setSelectedRankZone] = useState<string>('all');
  const [selectedRankResidentIds, setSelectedRankResidentIds] = useState<string[]>([]);
  const [rankResidentSearch, setRankResidentSearch] = useState<string>('');
  const [isRankPickerOpen, setIsRankPickerOpen] = useState<boolean>(false);
  const rankPickerRef = useRef<HTMLDivElement | null>(null);
  const [selectedRankPriority, setSelectedRankPriority] = useState<RankingPriorityLevel>(1);
  const [rankingFilter, setRankingFilter] = useState<'all' | RankingPriorityLevel>('all');
  const [rankingTableZoneFilter, setRankingTableZoneFilter] = useState<string>('all');
  const [selectedRankingRowIds, setSelectedRankingRowIds] = useState<string[]>([]);
  const [isSavingRank, setIsSavingRank] = useState(false);
  const [rankFeedback, setRankFeedback] = useState<string | null>(null);

  const getShortZone = (purok?: string) => String(purok || '').split(' - ')[0].trim();

  const sortedRankings = sortRankingClassifications(rankingClassifications);
  const rankByResidentId = new Map(sortedRankings.map(r => [r.residentId, r]));
  const selectableResidentsForRank = [...residentsList]
    .filter(r => r.role === 'resident' && !r.isBanned && r.registrationStatus !== 'Rejected')
    .sort((a, b) => a.name.localeCompare(b.name));

  const availableRankZones = Array.from(
    new Set([
      ...BUGO_PUROKS.map(z => getShortZone(z)),
      ...selectableResidentsForRank.map(r => getShortZone(r.purok)).filter(Boolean)
    ])
  ).filter(Boolean);

  const zoneFilteredResidents =
    selectedRankZone === 'all'
      ? selectableResidentsForRank
      : selectableResidentsForRank.filter(r => getShortZone(r.purok) === selectedRankZone);

  const pickerFilteredResidents = zoneFilteredResidents.filter(r => {
    const q = rankResidentSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      getShortZone(r.purok).toLowerCase().includes(q)
    );
  });

  const selectedRankIdSet = new Set(selectedRankResidentIds);
  const pickerVisibleIds = pickerFilteredResidents.map(r => r.id);
  const allPickerVisibleSelected =
    pickerVisibleIds.length > 0 && pickerVisibleIds.every(id => selectedRankIdSet.has(id));
  const selectedResidentsPreview = selectableResidentsForRank.filter(r => selectedRankIdSet.has(r.id));

  useEffect(() => {
    const validIds = new Set(selectableResidentsForRank.map(r => r.id));
    setSelectedRankResidentIds(prev => {
      const next = prev.filter(id => validIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [residentsList]);

  useEffect(() => {
    if (!isRankPickerOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (rankPickerRef.current && !rankPickerRef.current.contains(event.target as Node)) {
        setIsRankPickerOpen(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsRankPickerOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isRankPickerOpen]);

  const toggleRankResident = (residentId: string) => {
    setSelectedRankResidentIds(prev =>
      prev.includes(residentId) ? prev.filter(id => id !== residentId) : [...prev, residentId]
    );
  };

  const toggleSelectAllPickerVisible = () => {
    if (pickerVisibleIds.length === 0) return;
    if (allPickerVisibleSelected) {
      const visibleSet = new Set(pickerVisibleIds);
      setSelectedRankResidentIds(prev => prev.filter(id => !visibleSet.has(id)));
    } else {
      setSelectedRankResidentIds(prev => Array.from(new Set([...prev, ...pickerVisibleIds])));
    }
  };

  const visibleRankings = sortedRankings.filter(item => {
    const matchesPriority = rankingFilter === 'all' || item.priority === rankingFilter;
    const matchesZone =
      rankingTableZoneFilter === 'all' || getShortZone(item.purok) === rankingTableZoneFilter;
    return matchesPriority && matchesZone;
  });

  const visibleRowIdSet = new Set(visibleRankings.map(r => r.id));
  const activeSelectedRowIds = selectedRankingRowIds.filter(id => visibleRowIdSet.has(id));
  const allVisibleRowsSelected =
    visibleRankings.length > 0 && activeSelectedRowIds.length === visibleRankings.length;

  const showRankToast = (msg: string) => {
    setRankFeedback(msg);
    setTimeout(() => setRankFeedback(null), 2500);
  };

  const handleAssignRank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRankResidentIds.length === 0) return;
    setIsSavingRank(true);

    const res =
      selectedRankResidentIds.length === 1
        ? await upsertRankingClassification(selectedRankResidentIds[0], selectedRankPriority)
        : await bulkUpsertRankingClassifications({
            residentIds: selectedRankResidentIds,
            priority: selectedRankPriority,
          });

    setIsSavingRank(false);
    if (res.success) {
      const count = selectedRankResidentIds.length;
      setSelectedRankResidentIds([]);
      setRankResidentSearch('');
      setIsRankPickerOpen(false);
      showRankToast(count === 1 ? 'Resident ranked.' : `${count} residents ranked.`);
    } else {
      setRankFeedback(res.message || 'Unable to save rankings.');
    }
  };

  const handleToggleAllVisibleRows = () => {
    if (allVisibleRowsSelected) {
      setSelectedRankingRowIds([]);
    } else {
      setSelectedRankingRowIds(visibleRankings.map(r => r.id));
    }
  };

  const handleToggleSingleRow = (rowId: string) => {
    setSelectedRankingRowIds(prev =>
      prev.includes(rowId) ? prev.filter(id => id !== rowId) : [...prev, rowId]
    );
  };

  const handleBulkMovePriority = async (priority: RankingPriorityLevel) => {
    const selectedEntries = visibleRankings.filter(r => activeSelectedRowIds.includes(r.id));
    if (selectedEntries.length === 0) return;
    setIsSavingRank(true);
    const res = await bulkUpsertRankingClassifications({
      residentIds: selectedEntries.map(r => r.residentId),
      priority,
    });
    setIsSavingRank(false);
    if (res.success) {
      setSelectedRankingRowIds([]);
      showRankToast(`Updated ${selectedEntries.length} resident(s).`);
    } else {
      setRankFeedback(res.message || 'Unable to update selected rankings.');
    }
  };

  const handleBulkRemoveSelected = async () => {
    if (activeSelectedRowIds.length === 0) return;
    setIsSavingRank(true);
    const res = await bulkDeleteRankingClassifications(activeSelectedRowIds);
    setIsSavingRank(false);
    if (res.success) {
      setSelectedRankingRowIds([]);
      showRankToast(`Removed ${res.deletedCount || activeSelectedRowIds.length} resident(s).`);
    } else {
      setRankFeedback(res.message || 'Unable to remove selected residents.');
    }
  };

  useEffect(() => {
    if (!isAdjustCensusOpen) {
      setCensusForm(censusData);
    }
  }, [censusData, isAdjustCensusOpen]);

  // Real account metrics from database
  const totalRealAccounts = residentsList.length;

  // Real Gender breakdown
  const femaleAccountsCount = residentsList.filter(r => (r.gender || '').toLowerCase() === 'female').length;
  const maleAccountsCount = residentsList.filter(r => (r.gender || '').toLowerCase() === 'male').length;
  const femalePct = totalRealAccounts > 0 ? ((femaleAccountsCount / totalRealAccounts) * 100).toFixed(1) : '0';
  const malePct = totalRealAccounts > 0 ? ((maleAccountsCount / totalRealAccounts) * 100).toFixed(1) : '0';

  // Age breakdown
  const realAgeBrackets = [
    { label: 'Youth & Minors (0-17)', count: residentsList.filter(r => (r.age || 0) < 18).length },
    { label: 'Young Adults (18-29)', count: residentsList.filter(r => (r.age || 0) >= 18 && (r.age || 0) <= 29).length },
    { label: 'Working Adults (30-59)', count: residentsList.filter(r => (r.age || 0) >= 30 && (r.age || 0) <= 59).length },
    { label: 'Senior Citizens (60+)', count: residentsList.filter(r => (r.age || 0) >= 60).length }
  ];

  // Income breakdown (mutually exclusive numeric ranges)
  const realIncomeBrackets = [
    {
      label: 'Below ₱5,000 (Indigent)',
      count: residentsList.filter(r => parseMonthlyIncome(r.householdIncome || '') < 5000).length
    },
    {
      label: '₱5,000 - ₱14,999 (Low Income)',
      count: residentsList.filter(r => {
        const inc = parseMonthlyIncome(r.householdIncome || '');
        return inc >= 5000 && inc < 15000;
      }).length
    },
    {
      label: '₱15,000 - ₱34,999 (Lower Middle)',
      count: residentsList.filter(r => {
        const inc = parseMonthlyIncome(r.householdIncome || '');
        return inc >= 15000 && inc < 35000;
      }).length
    },
    {
      label: '₱35,000+ (Middle & Above)',
      count: residentsList.filter(r => parseMonthlyIncome(r.householdIncome || '') >= 35000).length
    }
  ];

  const totalAnnouncementViews = announcements.reduce((sum, item) => sum + (item.viewsCount || 0), 0);

  const handlePurokPopulationChange = (index: number, newPop: number) => {
    const updated = [...censusForm.purokBreakdown];
    const oldPop = updated[index].population;
    const diff = newPop - oldPop;
    updated[index] = {
      ...updated[index],
      population: Math.max(0, newPop),
      households: Math.max(0, Math.round(newPop / 4))
    };

    const newTotalPop = Math.max(0, censusForm.totalPopulation + diff);
    setCensusForm({
      ...censusForm,
      totalPopulation: newTotalPop,
      totalHouseholds: Math.round(newTotalPop / 4),
      purokBreakdown: updated
    });
  };

  const handleSaveCensus = () => {
    const updated = {
      ...censusForm,
      lastUpdated: new Date().toISOString().split('T')[0]
    };
    updateCensusData(updated);
    setSaveSuccessMessage('Census data updated successfully.');
    setTimeout(() => {
      setSaveSuccessMessage(null);
      setIsAdjustCensusOpen(false);
    }, 1500);
  };

  const handleResetBenchmark = () => {
    resetCensusToBenchmark();
    setSaveSuccessMessage('Reset to PSA Official Benchmark (36,840 population).');
    setTimeout(() => {
      setSaveSuccessMessage(null);
      setIsAdjustCensusOpen(false);
    }, 1500);
  };

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={onOpenClearanceModal}
          className="flex items-center gap-2 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold rounded-lg transition cursor-pointer whitespace-nowrap"
        >
          <FileText className="w-4 h-4 text-amber-700" />
          <span>Issue Clearance</span>
        </button>

        <button
          type="button"
          onClick={onOpenNewResidentModal}
          className="flex items-center gap-2 px-3.5 py-2 bg-[#0c532b] hover:bg-[#094222] text-white text-xs font-semibold rounded-lg transition cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Register Resident</span>
        </button>
      </div>

      {/* 3 Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Resident Account */}
        <div
          onClick={() => onNavigateTab('residents')}
          className="bg-white rounded-xl p-5 border border-gray-200 flex flex-col justify-between cursor-pointer hover:border-[#0c532b] transition"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Resident Account</span>
              <Users className="w-4 h-4 text-[#0c532b]" />
            </div>
            <div className="mt-2.5 tabular-nums">
              <span className="text-3xl font-bold text-gray-900">{totalRealAccounts}</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-end text-xs">
            <span className="text-[#0c532b] font-semibold">View Registry &rarr;</span>
          </div>
        </div>

        {/* Service Applications */}
        <div
          onClick={() => onNavigateTab('status-tracking')}
          className="bg-white rounded-xl p-5 border border-gray-200 flex flex-col justify-between cursor-pointer hover:border-[#0c532b] transition"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Service Applications</span>
              <FileCheck2 className="w-4 h-4 text-blue-700" />
            </div>
            <div className="mt-2.5 tabular-nums">
              <span className="text-3xl font-bold text-gray-900">{applications.length}</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-end text-xs">
            <span className="text-[#0c532b] font-semibold">Open Queue &rarr;</span>
          </div>
        </div>

        {/* Announcements & Views */}
        <div
          onClick={() => onNavigateTab('announcements')}
          className="bg-white rounded-xl p-5 border border-gray-200 flex flex-col justify-between cursor-pointer hover:border-[#0c532b] transition"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Announcements & Views</span>
              <Eye className="w-4 h-4 text-[#0c532b]" />
            </div>
            <div className="mt-2.5 tabular-nums">
              <span className="text-3xl font-bold text-gray-900">{totalAnnouncementViews.toLocaleString()}</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-end text-xs">
            <span className="text-[#0c532b] font-semibold">Manage &rarr;</span>
          </div>
        </div>
      </div>

      {/* Ranking Classification Panel */}
      <div className="bg-white rounded-xl p-5 border border-gray-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <ListOrdered className="w-4 h-4 text-[#0c532b]" />
            <h2 className="text-base font-bold text-gray-900">Ranking Classification</h2>
          </div>
          <div className="flex items-center gap-3 text-xs tabular-nums">
            {rankFeedback && (
              <span className="font-semibold text-emerald-700">{rankFeedback}</span>
            )}
            <span className="font-semibold text-gray-600">{sortedRankings.length} ranked</span>
          </div>
        </div>

        {/* Simple Priority Filter Tabs */}
        <div className="flex flex-wrap gap-1.5 text-xs tabular-nums">
          <button
            type="button"
            onClick={() => setRankingFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold border transition cursor-pointer ${
              rankingFilter === 'all'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
            }`}
          >
            All ({sortedRankings.length})
          </button>
          {RANKING_TIERS.map(tier => {
            const count = sortedRankings.filter(item => item.priority === tier.level).length;
            const active = rankingFilter === tier.level;
            return (
              <button
                key={tier.level}
                type="button"
                onClick={() => setRankingFilter(active ? 'all' : tier.level)}
                className={`px-3 py-1.5 rounded-lg font-semibold border transition cursor-pointer ${
                  active
                    ? `${tier.badgeClass} ring-1 ring-current`
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {tier.shortLabel} ({count})
              </button>
            );
          })}
        </div>

        {/* Zone + Multi-Resident Picker + Priority Assign Bar */}
        <form onSubmit={handleAssignRank} className="space-y-2.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            {/* 1. Zone Filter */}
            <select
              value={selectedRankZone}
              onChange={(e) => {
                setSelectedRankZone(e.target.value);
              }}
              aria-label="Filter residents by zone"
              className="sm:col-span-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-[#0c532b]"
            >
              <option value="all">All Zones ({selectableResidentsForRank.length})</option>
              {availableRankZones.map(zone => {
                const count = selectableResidentsForRank.filter(r => getShortZone(r.purok) === zone).length;
                return (
                  <option key={zone} value={zone}>
                    {zone} ({count})
                  </option>
                );
              })}
            </select>

            {/* 2. Specific Residents Multi-Select Picker */}
            <div className="sm:col-span-4 relative" ref={rankPickerRef}>
              <button
                type="button"
                onClick={() => setIsRankPickerOpen(prev => !prev)}
                aria-expanded={isRankPickerOpen}
                aria-label="Choose specific residents or select all"
                className={`w-full flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-left font-medium transition cursor-pointer outline-none focus:ring-2 focus:ring-[#0c532b] ${
                  selectedRankResidentIds.length > 0
                    ? 'bg-emerald-50/70 border-emerald-300 text-gray-900'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="truncate">
                  {selectedRankResidentIds.length === 0
                    ? 'Choose residents...'
                    : selectedRankResidentIds.length === 1
                    ? selectedResidentsPreview[0]?.name || '1 resident selected'
                    : `${selectedRankResidentIds.length} residents selected`}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {selectedRankResidentIds.length > 0 && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRankResidentIds([]);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          setSelectedRankResidentIds([]);
                        }
                      }}
                      className="p-0.5 text-gray-400 hover:text-gray-800 rounded"
                      title="Clear selection"
                    >
                      <X className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isRankPickerOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isRankPickerOpen && (
                <div className="absolute left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden">
                  {/* Search */}
                  <div className="p-2 border-b border-gray-100 bg-gray-50/80">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={rankResidentSearch}
                        onChange={(e) => setRankResidentSearch(e.target.value)}
                        placeholder="Search name or zone..."
                        autoFocus
                        className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#0c532b]"
                      />
                    </div>
                  </div>

                  {/* Select All / Clear Row */}
                  {pickerFilteredResidents.length > 0 && (
                    <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between bg-white">
                      <label className="inline-flex items-center gap-2 font-semibold text-gray-800 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={allPickerVisibleSelected}
                          onChange={toggleSelectAllPickerVisible}
                          className="w-3.5 h-3.5 accent-[#0c532b] rounded cursor-pointer"
                        />
                        <span>
                          {selectedRankZone === 'all'
                            ? `Select All Residents (${pickerFilteredResidents.length})`
                            : `Select All in ${selectedRankZone} (${pickerFilteredResidents.length})`}
                        </span>
                      </label>
                      {selectedRankResidentIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedRankResidentIds([])}
                          className="text-[11px] font-semibold text-gray-500 hover:text-gray-900 cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}

                  {/* Resident Checkboxes List */}
                  <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
                    {pickerFilteredResidents.length === 0 ? (
                      <p className="py-5 text-center text-gray-400">No residents found</p>
                    ) : (
                      pickerFilteredResidents.map(res => {
                        const checked = selectedRankIdSet.has(res.id);
                        const existingRank = rankByResidentId.get(res.id);
                        return (
                          <label
                            key={res.id}
                            className={`px-3 py-2 flex items-center justify-between gap-2 cursor-pointer transition ${
                              checked ? 'bg-emerald-50/70' : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleRankResident(res.id)}
                                className="w-3.5 h-3.5 accent-[#0c532b] rounded cursor-pointer shrink-0"
                              />
                              <span className="font-medium text-gray-900 truncate">{res.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[11px] text-gray-400">{getShortZone(res.purok)}</span>
                              {existingRank && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getRankingTierMeta(existingRank.priority).badgeClass}`}>
                                  P{existingRank.priority}
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>

                  {/* Done Footer */}
                  <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-gray-600 tabular-nums">
                      {selectedRankResidentIds.length} selected
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsRankPickerOpen(false)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#0c532b] hover:bg-[#094222] text-white text-[11px] font-semibold rounded-md cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      <span>Done</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Priority Select */}
            <select
              value={selectedRankPriority}
              onChange={(e) => setSelectedRankPriority(Number(e.target.value) as RankingPriorityLevel)}
              aria-label="Select priority level"
              className="sm:col-span-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-[#0c532b]"
            >
              {RANKING_TIERS.map(tier => (
                <option key={tier.level} value={tier.level}>
                  {tier.shortLabel}
                </option>
              ))}
            </select>

            {/* 4. Assign Button */}
            <button
              type="submit"
              disabled={selectedRankResidentIds.length === 0 || isSavingRank}
              className="sm:col-span-2 px-4 py-2 bg-[#0c532b] hover:bg-[#094222] disabled:opacity-50 text-white font-semibold rounded-lg transition cursor-pointer whitespace-nowrap"
            >
              {isSavingRank
                ? 'Saving...'
                : selectedRankResidentIds.length > 0
                  ? `Assign (${selectedRankResidentIds.length})`
                  : 'Assign'}
            </button>
          </div>

          {/* Selected Resident Preview Chips */}
          {selectedResidentsPreview.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {selectedResidentsPreview.slice(0, 5).map(res => (
                <span
                  key={res.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-md font-medium"
                >
                  <span>{res.name}</span>
                  <button
                    type="button"
                    onClick={() => toggleRankResident(res.id)}
                    className="text-emerald-700 hover:text-emerald-950 cursor-pointer"
                    aria-label={`Remove ${res.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {selectedResidentsPreview.length > 5 && (
                <span className="text-gray-500 font-medium px-1">
                  +{selectedResidentsPreview.length - 5} more
                </span>
              )}
              <button
                type="button"
                onClick={() => setSelectedRankResidentIds([])}
                className="text-gray-500 hover:text-gray-800 underline ml-1 cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
        </form>

        {/* Ranked List Zone Filter & Batch Actions */}
        {sortedRankings.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <label htmlFor="ranking-table-zone-filter" className="text-gray-500 font-medium">
                Zone:
              </label>
              <select
                id="ranking-table-zone-filter"
                value={rankingTableZoneFilter}
                onChange={(e) => {
                  setRankingTableZoneFilter(e.target.value);
                  setSelectedRankingRowIds([]);
                }}
                className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-medium text-gray-800 outline-none focus:ring-2 focus:ring-[#0c532b]"
              >
                <option value="all">All Zones ({sortedRankings.length})</option>
                {availableRankZones.map(zone => {
                  const zoneCount = sortedRankings.filter(item => getShortZone(item.purok) === zone).length;
                  return (
                    <option key={zone} value={zone}>
                      {zone} ({zoneCount})
                    </option>
                  );
                })}
              </select>
            </div>

            {activeSelectedRowIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                <span className="font-semibold text-emerald-900 tabular-nums">
                  {activeSelectedRowIds.length} selected
                </span>
                <select
                  value=""
                  disabled={isSavingRank}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if ([1, 2, 3, 4, 5].includes(val)) {
                      void handleBulkMovePriority(val as RankingPriorityLevel);
                    }
                  }}
                  aria-label="Set priority for selected residents"
                  className="bg-white border border-emerald-300 rounded-md px-2 py-1 font-semibold text-gray-800 outline-none cursor-pointer"
                >
                  <option value="">Change Priority...</option>
                  {RANKING_TIERS.map(t => (
                    <option key={t.level} value={t.level}>
                      {t.shortLabel}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={isSavingRank}
                  onClick={() => void handleBulkRemoveSelected()}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold rounded-md transition cursor-pointer"
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRankingRowIds([])}
                  className="px-1.5 py-1 text-gray-600 hover:text-gray-900 font-medium cursor-pointer"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        )}

        {/* Ranked Residents Table */}
        {visibleRankings.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-500 border border-dashed border-gray-200 rounded-lg">
            {sortedRankings.length === 0
              ? 'No residents ranked yet. Choose residents above and click Assign.'
              : 'No residents match this filter.'}
          </p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                <tr>
                  <th className="py-2 px-3 w-10">
                    <input
                      type="checkbox"
                      checked={allVisibleRowsSelected}
                      onChange={handleToggleAllVisibleRows}
                      aria-label="Select all ranked residents"
                      className="w-3.5 h-3.5 accent-[#0c532b] rounded cursor-pointer align-middle"
                    />
                  </th>
                  <th className="py-2 px-3 w-12">#</th>
                  <th className="py-2 px-3">Resident</th>
                  <th className="py-2 px-3">Priority</th>
                  <th className="py-2 px-3 text-right w-14">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 tabular-nums">
                {visibleRankings.map((entry) => {
                  const globalRank = sortedRankings.findIndex(r => r.id === entry.id) + 1;
                  const tier = getRankingTierMeta(entry.priority);
                  const isRowSelected = activeSelectedRowIds.includes(entry.id);
                  return (
                    <tr key={entry.id} className={isRowSelected ? 'bg-emerald-50/50' : 'hover:bg-gray-50/70'}>
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          checked={isRowSelected}
                          onChange={() => handleToggleSingleRow(entry.id)}
                          aria-label={`Select ${entry.residentName}`}
                          className="w-3.5 h-3.5 accent-[#0c532b] rounded cursor-pointer align-middle"
                        />
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-gray-900">#{globalRank}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-gray-900">{entry.residentName}</div>
                        <div className="text-[11px] text-gray-500">{getShortZone(entry.purok)}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={entry.priority}
                          onChange={(e) => void updateRankingClassification(entry.id, Number(e.target.value) as RankingPriorityLevel)}
                          aria-label={`Priority for ${entry.residentName}`}
                          className={`px-2.5 py-1 rounded-md border text-xs font-semibold outline-none cursor-pointer ${tier.badgeClass}`}
                        >
                          {RANKING_TIERS.map(t => (
                            <option key={t.level} value={t.level} className="bg-white text-gray-900">
                              {t.shortLabel}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => void deleteRankingClassification(entry.id)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition cursor-pointer"
                          title={`Remove ${entry.residentName}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Unified Residence Analytics & Census Panel */}
      <div className="bg-white rounded-xl p-5 sm:p-6 border border-gray-200 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#0c532b]" />
              <span>{analyticsView === 'accounts' ? 'Resident Overview' : 'Barangay Bugo Census'}</span>
            </h2>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center bg-gray-100 p-1 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setAnalyticsView('accounts')}
                className={`px-3 py-1.5 rounded-md transition cursor-pointer whitespace-nowrap ${
                  analyticsView === 'accounts' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Real Accounts ({totalRealAccounts})
              </button>
              <button
                type="button"
                onClick={() => setAnalyticsView('census')}
                className={`px-3 py-1.5 rounded-md transition cursor-pointer whitespace-nowrap ${
                  analyticsView === 'census' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Barangay Census
              </button>
            </div>

            {analyticsView === 'census' && (
              <button
                type="button"
                onClick={() => setIsAdjustCensusOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0c532b] text-white text-xs font-semibold rounded-lg hover:bg-[#094222] transition cursor-pointer whitespace-nowrap"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Adjust Census</span>
              </button>
            )}
          </div>
        </div>

        {/* VIEW 1: SIMPLE, NON-REDUNDANT REAL ACCOUNTS OVERVIEW */}
        {analyticsView === 'accounts' && (
          <div className="space-y-5">
            {/* Compact Gender, Age & Income Summary (No Nested Card Clutter) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Left: Gender & Age */}
              <div className="space-y-4 border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-800">Gender Distribution</span>
                    <span className="text-gray-500 tabular-nums">
                      Female {femaleAccountsCount} ({femalePct}%) · Male {maleAccountsCount} ({malePct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden flex">
                    <div className="bg-rose-500 h-2" style={{ width: `${femalePct}%` }} />
                    <div className="bg-blue-600 h-2" style={{ width: `${malePct}%` }} />
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200/70 space-y-2">
                  <span className="text-xs font-semibold text-gray-800 block">Age Groups</span>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    {realAgeBrackets.map(item => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className="text-gray-600 truncate pr-2">{item.label}</span>
                        <span className="font-semibold text-gray-900 tabular-nums">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Income Breakdown */}
              <div className="space-y-2.5 border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-800">Household Income Brackets</span>
                  <span className="text-gray-500">Aid eligibility profile</span>
                </div>
                <div className="space-y-2 pt-1">
                  {realIncomeBrackets.map(item => {
                    const pct = totalRealAccounts > 0 ? Math.round((item.count / totalRealAccounts) * 100) : 0;
                    return (
                      <div key={item.label} className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-700">{item.label}</span>
                          <span className="font-semibold text-gray-900 tabular-nums">{item.count} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-[#0c532b] h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Unified All Bugo Zones Comparative Matrix */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-gray-900">
                    All Bugo Zones Comparative Matrix
                  </h3>
                </div>

                {selectedZone !== 'All' && (
                  <button
                    type="button"
                    onClick={() => setSelectedZone('All')}
                    className="text-xs font-semibold text-[#0c532b] hover:underline cursor-pointer"
                  >
                    Show All Zones
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 text-gray-500 font-semibold text-[11px] border-b border-gray-200">
                    <tr>
                      <th className="py-2.5 px-3">Zone / Purok</th>
                      <th className="py-2.5 px-3 text-center">Accounts</th>
                      <th className="py-2.5 px-3 text-center">PWD</th>
                      <th className="py-2.5 px-3 text-center">Senior</th>
                      <th className="py-2.5 px-3 text-center">Solo Parent</th>
                      <th className="py-2.5 px-3 text-center">Student</th>
                      <th className="py-2.5 px-3 text-center">Youth</th>
                      <th className="py-2.5 px-3 text-center">Announcements</th>
                      <th className="py-2.5 px-3 text-center">Views</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 tabular-nums">
                    {BUGO_PUROKS.map(purokName => {
                      const resInZone = residentsList.filter(r => r.purok === purokName);
                      const pwds = resInZone.filter(r => r.isPwd).length;
                      const seniors = resInZone.filter(r => r.isSenior || (r.age || 0) >= 60).length;
                      const sps = resInZone.filter(r => r.isSoloParent).length;
                      const students = resInZone.filter(r => r.isStudent || r.employmentStatus === 'Student').length;
                      const youth = resInZone.filter(r => r.isTeenager || ((r.age || 0) >= 13 && (r.age || 0) <= 19)).length;
                      const isCurrent = selectedZone === purokName;

                      return (
                        <tr
                          key={purokName}
                          onClick={() => {
                            setSelectedZone(purokName);
                            setInspectedZone(purokName);
                          }}
                          className={`hover:bg-gray-50 transition cursor-pointer ${
                            isCurrent ? 'bg-emerald-50/70 font-semibold' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 font-medium text-gray-900">{purokName}</td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedZone(purokName);
                                setInspectedZone(purokName);
                              }}
                              className={`inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline cursor-pointer ${
                                resInZone.length > 0 ? 'text-[#0c532b]' : 'text-gray-400 hover:text-gray-700'
                              }`}
                            >
                              <span>{resInZone.length}</span>
                              <span className="text-[11px] font-medium">View</span>
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-center text-gray-700">{pwds}</td>
                          <td className="py-2.5 px-3 text-center text-gray-700">{seniors}</td>
                          <td className="py-2.5 px-3 text-center text-gray-700">{sps}</td>
                          <td className="py-2.5 px-3 text-center text-gray-700">{students}</td>
                          <td className="py-2.5 px-3 text-center text-gray-700">{youth}</td>
                          <td className="py-2.5 px-3 text-center text-gray-500">{announcements.length}</td>
                          <td className="py-2.5 px-3 text-center text-gray-500">{totalAnnouncementViews}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: BARANGAY CENSUS */}
        {analyticsView === 'census' && (
          <div className="space-y-4">
            {saveSuccessMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{saveSuccessMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <span className="text-xs text-gray-500">Total Population</span>
                <div className="text-xl font-bold text-gray-900 mt-0.5">{censusForm.totalPopulation.toLocaleString()}</div>
              </div>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <span className="text-xs text-gray-500">Total Households</span>
                <div className="text-xl font-bold text-gray-900 mt-0.5">{censusForm.totalHouseholds.toLocaleString()}</div>
              </div>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <span className="text-xs text-gray-500">Registered Voters</span>
                <div className="text-xl font-bold text-gray-900 mt-0.5">{censusForm.registeredVoters.toLocaleString()}</div>
              </div>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <span className="text-xs text-gray-500">Senior Citizens (60+)</span>
                <div className="text-xl font-bold text-gray-900 mt-0.5">{censusForm.seniorCitizens.toLocaleString()}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1 tabular-nums">
              {censusForm.purokBreakdown.map((item) => {
                const pct = censusForm.totalPopulation > 0
                  ? ((item.population / censusForm.totalPopulation) * 100).toFixed(1)
                  : '0';
                return (
                  <div key={item.purok} className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-semibold text-gray-800">
                      <span className="truncate pr-2">{item.purok}</span>
                      <span className="text-[#0c532b] shrink-0">
                        {item.population.toLocaleString()} ({pct}%)
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>{item.households.toLocaleString()} households</span>
                      <div className="w-32 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-[#0c532b] h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-gray-400">Last updated: {censusForm.lastUpdated}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetBenchmark}
                  className="text-gray-500 hover:text-gray-800 font-medium text-xs flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> Reset Benchmark
                </button>
                <button
                  type="button"
                  onClick={handleSaveCensus}
                  className="px-3.5 py-1.5 bg-[#0c532b] text-white font-semibold rounded-lg hover:bg-[#094222] transition text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom 2-Column Row: Service Applications & Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Recent Service Applications */}
        <div className="lg:col-span-6 bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900">Service Applications Queue</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('status-tracking')}
              className="text-xs font-semibold text-[#0c532b] hover:underline cursor-pointer"
            >
              View All ({applications.length}) &rarr;
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {applications.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">No service applications filed yet.</p>
            ) : (
              sortApplicationsFCFS(applications).slice(0, 3).map((app, idx) => (
                <div key={app.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold text-gray-900 truncate">
                      <span className="font-mono text-[#0c532b] mr-1.5">#{idx + 1}</span>
                      {app.programTitle}
                    </h3>
                    <p className="text-[11px] text-gray-500 truncate mt-0.5">
                      {app.applicantName} · {app.purok}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums flex items-center gap-1.5">
                      <span>{app.referenceCode}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatShortQueueDateTime(app)}
                      </span>
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-gray-700 shrink-0">{app.status}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Announcements & Views */}
        <div className="lg:col-span-6 bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900">Announcements & Views</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('announcements')}
              className="text-xs font-semibold text-[#0c532b] hover:underline cursor-pointer"
            >
              View All ({announcements.length}) &rarr;
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {announcements.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">No announcements published yet.</p>
            ) : (
              announcements.slice(0, 3).map(item => (
                <div key={item.id} className="py-3 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#0c532b] flex items-center justify-center shrink-0">
                    {item.iconType === 'water' && <Droplet className="w-4 h-4" />}
                    {item.iconType === 'medical' && <Cross className="w-4 h-4" />}
                    {item.iconType === 'sports' && <Trophy className="w-4 h-4" />}
                    {item.iconType === 'general' && <Megaphone className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold text-gray-900 truncate">{item.title}</h3>
                      <span className="text-[11px] text-gray-500 tabular-nums shrink-0">
                        {item.viewsCount || 0} {(item.viewsCount || 0) === 1 ? 'view' : 'views'} · {item.date}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{item.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ADJUST CENSUS MODAL */}
      {isAdjustCensusOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-gray-200 flex flex-col max-h-[90vh]">
            <div className="p-5 bg-[#0c532b] text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-200" />
                  <span>Adjust Barangay Bugo Census Figures</span>
                </h3>
                <p className="text-xs text-emerald-100 mt-0.5">
                  Persistent community census benchmark across sessions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustCensusOpen(false)}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {saveSuccessMessage && (
              <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{saveSuccessMessage}</span>
              </div>
            )}

            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Total Population</label>
                  <input
                    type="number"
                    value={censusForm.totalPopulation}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      setCensusForm({
                        ...censusForm,
                        totalPopulation: val,
                        totalHouseholds: Math.round(val / 4)
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0c532b]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Total Households</label>
                  <input
                    type="number"
                    value={censusForm.totalHouseholds}
                    onChange={(e) => setCensusForm({ ...censusForm, totalHouseholds: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0c532b]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Registered Voters</label>
                  <input
                    type="number"
                    value={censusForm.registeredVoters}
                    onChange={(e) => setCensusForm({ ...censusForm, registeredVoters: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0c532b]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Senior Citizens (60+)</label>
                  <input
                    type="number"
                    value={censusForm.seniorCitizens}
                    onChange={(e) => setCensusForm({ ...censusForm, seniorCitizens: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0c532b]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Minors (0 - 17)</label>
                  <input
                    type="number"
                    value={censusForm.minors}
                    onChange={(e) => setCensusForm({ ...censusForm, minors: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0c532b]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Working Age (18 - 59)</label>
                  <input
                    type="number"
                    value={censusForm.workingAge}
                    onChange={(e) => setCensusForm({ ...censusForm, workingAge: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0c532b]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-2">
                  Adjust Population by Zone / Purok
                </label>
                <div className="space-y-2 max-h-52 overflow-y-auto border border-gray-200 rounded-xl p-3 bg-gray-50/50">
                  {censusForm.purokBreakdown.map((item, idx) => (
                    <div key={item.purok} className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-gray-200 text-xs">
                      <span className="font-medium text-gray-700 truncate flex-1">{item.purok}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-400">Pop:</span>
                        <input
                          type="number"
                          value={item.population}
                          onChange={(e) => handlePurokPopulationChange(idx, parseInt(e.target.value, 10) || 0)}
                          className="w-24 px-2 py-1 text-xs border border-gray-300 rounded font-semibold text-gray-900"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetBenchmark}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Benchmark</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustCensusOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-xs font-semibold text-gray-700 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCensus}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#0c532b] text-white text-xs font-semibold rounded-lg hover:bg-[#094222] transition cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ZONE RESIDENTS INFORMATION MODAL */}
      {inspectedZone && (() => {
        const zoneResidents = residentsList.filter(r => r.purok === inspectedZone);
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
            onClick={() => setInspectedZone(null)}
          >
            <div
              className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-gray-200 flex flex-col max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-gray-900">{inspectedZone}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
                    {zoneResidents.length} registered account{zoneResidents.length === 1 ? '' : 's'} in this area
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedZone(null)}
                  className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 cursor-pointer"
                  aria-label="Close zone residents modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto divide-y divide-gray-100 flex-1 text-xs">
                {zoneResidents.length === 0 ? (
                  <p className="py-8 text-center text-gray-500">
                    No registered accounts are currently listed in {inspectedZone}.
                  </p>
                ) : (
                  zoneResidents.map(res => (
                    <div key={res.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-sm font-semibold text-gray-900">{res.name}</span>
                          <span className="text-gray-500 ml-2 tabular-nums">{res.residentIdNumber || 'No ID'}</span>
                        </div>
                        <span className={`font-semibold ${
                          res.isBanned
                            ? 'text-rose-700'
                            : res.isVerified
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}>
                          {res.registrationStatus || 'Verified'}
                        </span>
                      </div>
                      <p className="text-gray-600">
                        {res.address || inspectedZone}
                      </p>
                      <p className="text-gray-500 tabular-nums">
                        {res.contactNumber || 'No contact'} · {res.email || 'No email'}
                        {res.occupation ? ` · ${res.occupation}` : ''}
                        {res.householdIncome ? ` · ${res.householdIncome.split('(')[0].trim()}` : ''}
                        {typeof res.familyMembersCount === 'number' ? ` · ${res.familyMembersCount} in household` : ''}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedZoneForRegistry(inspectedZone);
                    setInspectedZone(null);
                    onNavigateTab('residents');
                  }}
                  className="text-xs font-semibold text-[#0c532b] hover:underline cursor-pointer"
                >
                  Manage in Resident Account &rarr;
                </button>
                <button
                  type="button"
                  onClick={() => setInspectedZone(null)}
                  className="px-4 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
