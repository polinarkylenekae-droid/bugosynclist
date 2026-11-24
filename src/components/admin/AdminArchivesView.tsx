import React, { useState } from 'react';
import { 
  Archive, 
  Clock, 
  Trash2, 
  RotateCcw, 
  Search, 
  X, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  UserCheck,
  ShieldCheck,
  ArrowRight,
  Database,
  Download,
  Plus
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BUGO_PUROKS } from '../../data/mockData';
import { ActivityLogItem, ArchiveItem } from '../../types';

export const AdminArchivesView: React.FC = () => {
  const { 
    activityLogs, 
    archivedItems, 
    restoreArchivedItem, 
    deleteArchivedItemPermanently, 
    archiveRecord
  } = useApp();

  const [activeTab, setActiveTab] = useState<'attendance' | 'archives'>('attendance');
  const [searchFilter, setSearchFilter] = useState('');
  const [purokFilter, setPurokFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [notificationBanner, setNotificationBanner] = useState<string | null>(null);

  // Anytime On-Demand Manual Archive Modal State
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'Resident Record' | 'Service Application' | 'Program / Service' | 'Document' | 'Notice' | 'Disaster Victim' | 'Hazard Zone'>('Document');
  const [newRefCode, setNewRefCode] = useState(`ARC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [newReason, setNewReason] = useState('Routine administrative record archival.');
  const [newResidentName, setNewResidentName] = useState('');
  const [newPurok, setNewPurok] = useState(BUGO_PUROKS[0]);
  const [newOfficer, setNewOfficer] = useState('Hon. Juan Dela Cruz (Brgy. Admin)');
  const [newDetails, setNewDetails] = useState('');

  const showNotice = (msg: string) => {
    setNotificationBanner(msg);
    setTimeout(() => setNotificationBanner(null), 3000);
  };

  const handleOpenNewArchive = () => {
    setNewRefCode(`ARC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setShowArchiveModal(true);
  };

  const handleCreateArchiveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      showNotice('Please enter a title or record name.');
      return;
    }

    archiveRecord({
      title: newTitle.trim(),
      originalCategory: newCategory,
      referenceCode: newRefCode.trim(),
      deletedBy: newOfficer,
      reasonForArchive: newReason.trim(),
      originalData: {
        residentName: newResidentName.trim() || undefined,
        purok: newPurok,
        officerInCharge: newOfficer,
        details: newDetails.trim() || 'Archived directly from administrative portal.'
      }
    });

    showNotice(`Record "${newTitle.trim()}" successfully archived right now!`);
    setShowArchiveModal(false);
    setNewTitle('');
    setNewResidentName('');
    setNewDetails('');
    setActiveTab('archives');
  };

  // 1-Click Automatic Archive from Live System Activity
  const handleArchiveSingleActivity = (log: ActivityLogItem) => {
    archiveRecord({
      title: `${log.actionType}: ${log.residentName}`,
      originalCategory: 'Resident Record',
      referenceCode: log.residentIdNumber || `LOG-${Date.now().toString().slice(-4)}`,
      deletedBy: 'Hon. Juan Dela Cruz (Brgy. Admin)',
      reasonForArchive: `Automated archive from ${log.locationOrService} on ${log.timestamp}.`,
      originalData: {
        residentName: log.residentName,
        residentIdNumber: log.residentIdNumber,
        purok: log.purok,
        actionType: log.actionType,
        locationOrService: log.locationOrService,
        timestamp: log.timestamp,
        officerInCharge: log.officerInCharge,
        details: log.details || 'Completed resident desk transaction'
      }
    });
    showNotice(`Activity for "${log.residentName}" automatically archived!`);
  };

  const handleArchiveAllVisibleLogs = () => {
    if (filteredLogs.length === 0) return;
    filteredLogs.forEach(log => {
      archiveRecord({
        title: `${log.actionType}: ${log.residentName}`,
        originalCategory: 'Resident Record',
        referenceCode: log.residentIdNumber || `LOG-${Date.now().toString().slice(-4)}`,
        deletedBy: 'Hon. Juan Dela Cruz (Brgy. Admin)',
        reasonForArchive: `Batch archive from ${log.locationOrService} on ${log.timestamp}.`,
        originalData: {
          residentName: log.residentName,
          residentIdNumber: log.residentIdNumber,
          purok: log.purok,
          actionType: log.actionType,
          locationOrService: log.locationOrService,
          timestamp: log.timestamp,
          officerInCharge: log.officerInCharge,
          details: log.details || 'Desk transaction archive'
        }
      });
    });
    showNotice(`Archived ${filteredLogs.length} activity records right now!`);
    setActiveTab('archives');
  };

  // Filtered attendance logs
  const filteredLogs = activityLogs.filter(log => {
    const matchesSearch = 
      log.residentName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      log.residentIdNumber.toLowerCase().includes(searchFilter.toLowerCase()) ||
      log.locationOrService.toLowerCase().includes(searchFilter.toLowerCase()) ||
      log.officerInCharge.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesPurok = purokFilter === 'All' || log.purok === purokFilter;
    return matchesSearch && matchesPurok;
  });

  // Filtered archived records
  const filteredArchives = archivedItems.filter(item => {
    const matchesSearch = 
      item.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (item.referenceCode && item.referenceCode.toLowerCase().includes(searchFilter.toLowerCase())) ||
      item.reasonForArchive.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || item.originalCategory === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notificationBanner && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#0c532b]" />
            <span>{notificationBanner}</span>
          </div>
          <button onClick={() => setNotificationBanner(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Archives & Activity Logs
          </h1>
        </div>

        <button
          type="button"
          onClick={handleOpenNewArchive}
          className="px-4 py-2.5 bg-[#0c532b] hover:bg-[#083c1f] text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-xs shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Archive Record Anytime</span>
        </button>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-gray-200 gap-6 text-sm font-bold">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`pb-3.5 transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'attendance'
              ? 'text-[#0c532b] border-b-2 border-[#0c532b]'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Live Activity & Visitor Logs</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
            {activityLogs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('archives')}
          className={`pb-3.5 transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'archives'
              ? 'text-[#0c532b] border-b-2 border-[#0c532b]'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>Archived Records Registry</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
            {archivedItems.length}
          </span>
        </button>
      </div>

      {/* 1. Live Resident Activity & Visitor Logs Tab */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          {/* Filters Bar & Batch Archive */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-gray-200">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by resident name, ID, desk..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-gray-50 text-xs pl-9 pr-4 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#0c532b]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-gray-500">Zone / Purok:</span>
              <select
                value={purokFilter}
                onChange={(e) => setPurokFilter(e.target.value)}
                className="bg-gray-50 text-xs px-3 py-2 rounded-xl border border-gray-200 font-semibold outline-none focus:ring-2 focus:ring-[#0c532b]"
              >
                <option value="All">All Zones (1-10)</option>
                {BUGO_PUROKS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              {filteredLogs.length > 0 && (
                <button
                  type="button"
                  onClick={handleArchiveAllVisibleLogs}
                  className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  title="Archive all visible activity logs right now"
                >
                  <Archive className="w-3.5 h-3.5 text-amber-700" />
                  <span>Archive All Visible Logs ({filteredLogs.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Logs Table with Automatic 1-Click Archiving Action */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200">
                  <tr>
                    <th className="py-3.5 px-4">Resident & ID</th>
                    <th className="py-3.5 px-4">Action Type</th>
                    <th className="py-3.5 px-4">Service Window / Location</th>
                    <th className="py-3.5 px-4">Officer on Duty</th>
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-4 text-right">Quick Archive</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        No activity records found matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/80 transition">
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-gray-900">{log.residentName}</p>
                          <p className="text-[11px] text-gray-400 font-mono">{log.residentIdNumber} • {log.purok}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.actionType === 'Time-In' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : log.actionType === 'Time-Out'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            <Clock className="w-3 h-3" />
                            <span>{log.actionType}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-gray-800">{log.locationOrService}</p>
                          {log.details && <p className="text-[10px] text-gray-400 truncate max-w-xs">{log.details}</p>}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-gray-600">
                          {log.officerInCharge}
                        </td>
                        <td className="py-3.5 px-4 text-gray-500 font-mono text-[11px]">
                          {log.timestamp}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleArchiveSingleActivity(log)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 hover:bg-amber-100 text-gray-700 hover:text-amber-900 rounded-lg text-[11px] font-bold transition cursor-pointer"
                            title="Archive this activity without requiring any document"
                          >
                            <Archive className="w-3.5 h-3.5 text-amber-700" />
                            <span>Archive</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. Archived Records Tab (Automatic Details & Restore) */}
      {activeTab === 'archives' && (
        <div className="space-y-4">
          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-gray-200">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search archived files, ref code, reason..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-gray-50 text-xs pl-9 pr-4 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#0c532b]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-gray-500">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-gray-50 text-xs px-3 py-2 rounded-xl border border-gray-200 font-semibold outline-none focus:ring-2 focus:ring-[#0c532b]"
              >
                <option value="All">All Categories</option>
                <option value="Resident Record">Resident Record</option>
                <option value="Service Application">Service Application</option>
                <option value="Program / Service">Program / Service</option>
                <option value="Notice">Notice / Announcement</option>
                <option value="Disaster Victim">Disaster Victim</option>
                <option value="Hazard Zone">Hazard Zone</option>
                <option value="Document">Document</option>
              </select>
            </div>
          </div>

          {/* Archived Records Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredArchives.length === 0 ? (
              <div className="md:col-span-3 py-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-200">
                <Archive className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="font-bold text-gray-600">No archived records found.</p>
                <p className="text-xs text-gray-400 mt-1">Activities can be archived directly with 1-click without file uploads.</p>
              </div>
            ) : (
              filteredArchives.map((item) => (
                <div key={item.id} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800">
                        {item.originalCategory}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">
                        {item.referenceCode}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-gray-900 leading-tight">
                      {item.title}
                    </h3>

                    <p className="text-xs text-gray-500 leading-relaxed">
                      <strong>Reason:</strong> {item.reasonForArchive}
                    </p>

                    {item.originalData && (
                      <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-[11px] text-gray-600 space-y-0.5">
                        {item.originalData.email && (
                          <p><strong>Email:</strong> {item.originalData.email}</p>
                        )}
                        {item.originalData.category && (
                          <p><strong>Category:</strong> {item.originalData.category}</p>
                        )}
                        {item.originalData.programTitle && (
                          <p><strong>Program:</strong> {item.originalData.programTitle}</p>
                        )}
                        {item.originalData.disasterType && (
                          <p><strong>Disaster:</strong> {item.originalData.disasterType}{item.originalData.damageLevel ? ` (${item.originalData.damageLevel})` : ''}</p>
                        )}
                        {item.originalData.riskLevel && (
                          <p><strong>Risk Level:</strong> {item.originalData.riskLevel}</p>
                        )}
                        {item.originalData.locationOrService && (
                          <p><strong>Service:</strong> {item.originalData.locationOrService}</p>
                        )}
                        {item.originalData.purok && (
                          <p><strong>Purok:</strong> {item.originalData.purok}</p>
                        )}
                        {item.originalData.officerInCharge && (
                          <p><strong>Officer:</strong> {item.originalData.officerInCharge}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-gray-100 space-y-2">
                    <div className="text-[11px] text-gray-400">
                      <p>Archived by: <strong className="text-gray-700">{item.deletedBy}</strong></p>
                      <p>Date: {item.deletedAt}</p>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await restoreArchivedItem(item.id);
                          showNotice(
                            res?.success === false
                              ? (res.message || `Could not restore "${item.title}".`)
                              : `Restored record "${item.title}" to active registry.`
                          );
                        }}
                        className="flex-1 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#0c532b] font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore Record</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          deleteArchivedItemPermanently(item.id);
                          showNotice(`Permanently deleted archived record.`);
                        }}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                        title="Permanent Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal: Archive Record Anytime */}
      {showArchiveModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-gray-200 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Archive className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">Archive Record Anytime</h3>
                  <p className="text-xs text-gray-500">Instantly archive any document, record, or incident report.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowArchiveModal(false)}
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateArchiveRecord} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Record Title / Description <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Special Cash Grant Resolution 2026, Barangay Clearance Record..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Original Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  >
                    <option value="Document">Official Document</option>
                    <option value="Resident Record">Resident Record</option>
                    <option value="Service Application">Service Application</option>
                    <option value="Program / Service">Program / Service</option>
                    <option value="Notice">Notice / Advisory</option>
                    <option value="Disaster Victim">Disaster Victim</option>
                    <option value="Hazard Zone">Hazard Zone</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Reference Code / Docket #</label>
                  <input
                    type="text"
                    value={newRefCode}
                    onChange={(e) => setNewRefCode(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-mono text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Subject / Resident Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Juanita Dela Cruz (Optional)"
                    value={newResidentName}
                    onChange={(e) => setNewResidentName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Purok / Zone</label>
                  <select
                    value={newPurok}
                    onChange={(e) => setNewPurok(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                  >
                    {BUGO_PUROKS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Reason for Archiving</label>
                <input
                  type="text"
                  required
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="e.g. Case resolved amicably; transaction completed; expired cycle."
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Archiving Officer</label>
                <input
                  type="text"
                  value={newOfficer}
                  onChange={(e) => setNewOfficer(e.target.value)}
                  className="w-full bg-gray-100 border border-gray-300 rounded-xl px-3 py-2 font-medium text-gray-700 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Detailed Remarks / Findings (Optional)</label>
                <textarea
                  rows={2}
                  value={newDetails}
                  onChange={(e) => setNewDetails(e.target.value)}
                  placeholder="Additional notes, clearance numbers, resolution details..."
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#0c532b] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowArchiveModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0c532b] hover:bg-[#083c1f] text-white font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Archive className="w-4 h-4" />
                  <span>Archive Record Now</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


