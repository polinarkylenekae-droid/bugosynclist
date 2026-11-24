import React, { useMemo, useState } from 'react';
import { X, Search, Copy, Check, LogIn } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ResidentUser } from '../../types';

export type DirectoryCategoryFilter =
  | 'all'
  | 'admin'
  | 'verified'
  | 'male'
  | 'female'
  | 'student'
  | 'pwd'
  | 'senior'
  | 'solo_parent'
  | 'disaster';

export type DirectoryGroupBy = 'sector' | 'gender' | 'status' | 'zone' | 'none';

interface AccountDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFillCredentials: (email: string, password: string) => void;
}

function getKnownDemoPassword(user: ResidentUser): string | null {
  const email = String(user.email || '').trim().toLowerCase();
  if (user.role === 'admin' && email === 'admin@bugo.gov.ph') {
    return 'Admin@Bugo2026!';
  }
  if (email === 'polinar.kylenekae@gmail.com') {
    return 'Kylene1234!';
  }
  if (user.id.startsWith('dummy-res-') || email === 'resident@bugo.gov.ph') {
    return 'Resident@Bugo2026!';
  }
  return null;
}

function getShortTags(user: ResidentUser): string[] {
  const tags: string[] = [];
  const zoneShort = (user.purok || '').split(' - ')[0];
  if (zoneShort) tags.push(zoneShort);
  if (user.role === 'admin') tags.push('Admin');
  if (user.gender) tags.push(user.gender);
  const status = user.registrationStatus || 'Verified';
  if (status !== 'Verified') tags.push(status);
  if (user.isStudent) tags.push('Student');
  if (user.isPwd) tags.push('PWD');
  if (user.isSenior || (typeof user.age === 'number' && user.age >= 60)) tags.push('Senior');
  if (user.isSoloParent) tags.push('Solo Parent');
  if (user.isDisasterAffected) tags.push('Disaster');
  if (user.role === 'resident' && user.idType) tags.push(user.idType);
  return tags;
}

function getPrimarySectorGroup(user: ResidentUser): string {
  if (user.role === 'admin') return 'Admin';
  const status = user.registrationStatus || 'Verified';
  if (status === 'Rejected' || status === 'Banned' || user.isBanned) return 'Restricted';
  if (user.isPwd) return 'PWD';
  if (user.isSenior || (typeof user.age === 'number' && user.age >= 60)) return 'Senior Citizens';
  if (user.isSoloParent) return 'Solo Parents';
  if (user.isStudent) return 'Students';
  if (user.isDisasterAffected) return 'Disaster Affected';
  if ((user.gender || '').toLowerCase() === 'female') return 'Female Residents';
  if ((user.gender || '').toLowerCase() === 'male') return 'Male Residents';
  return 'Residents';
}

export const AccountDirectoryModal: React.FC<AccountDirectoryModalProps> = ({
  isOpen,
  onClose,
  onFillCredentials
}) => {
  const { residentsList, loginWithCredentials } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DirectoryCategoryFilter>('all');
  const [groupBy, setGroupBy] = useState<DirectoryGroupBy>('sector');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [signingInId, setSigningInId] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  const categoryCounts = useMemo(() => {
    return {
      all: residentsList.length,
      admin: residentsList.filter(u => u.role === 'admin').length,
      verified: residentsList.filter(u => (u.registrationStatus || 'Verified') === 'Verified').length,
      male: residentsList.filter(u => (u.gender || '').toLowerCase() === 'male').length,
      female: residentsList.filter(u => (u.gender || '').toLowerCase() === 'female').length,
      student: residentsList.filter(u => Boolean(u.isStudent)).length,
      pwd: residentsList.filter(u => Boolean(u.isPwd)).length,
      senior: residentsList.filter(u => Boolean(u.isSenior || (typeof u.age === 'number' && u.age >= 60))).length,
      solo_parent: residentsList.filter(u => Boolean(u.isSoloParent)).length,
      disaster: residentsList.filter(u => Boolean(u.isDisasterAffected)).length,
    };
  }, [residentsList]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return residentsList.filter(u => {
      const status = u.registrationStatus || 'Verified';
      const isSenior = Boolean(u.isSenior || (typeof u.age === 'number' && u.age >= 60));

      if (categoryFilter === 'admin' && u.role !== 'admin') return false;
      if (categoryFilter === 'verified' && status !== 'Verified') return false;
      if (categoryFilter === 'male' && (u.gender || '').toLowerCase() !== 'male') return false;
      if (categoryFilter === 'female' && (u.gender || '').toLowerCase() !== 'female') return false;
      if (categoryFilter === 'student' && !u.isStudent) return false;
      if (categoryFilter === 'pwd' && !u.isPwd) return false;
      if (categoryFilter === 'senior' && !isSenior) return false;
      if (categoryFilter === 'solo_parent' && !u.isSoloParent) return false;
      if (categoryFilter === 'disaster' && !u.isDisasterAffected) return false;

      if (!q) return true;
      return [u.name, u.email, u.residentIdNumber, u.idNumber, u.idType, u.purok, ...getShortTags(u)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [residentsList, categoryFilter, searchQuery]);

  const groupedSections = useMemo(() => {
    if (groupBy === 'none') {
      return [{ title: 'All', users: filteredUsers }];
    }

    const groups = new Map<string, ResidentUser[]>();
    for (const user of filteredUsers) {
      let key = 'Other';
      if (groupBy === 'sector') {
        key = getPrimarySectorGroup(user);
      } else if (groupBy === 'gender') {
        key = user.gender || 'Unspecified';
      } else if (groupBy === 'status') {
        key = user.registrationStatus || 'Verified';
      } else if (groupBy === 'zone') {
        key = (user.purok || '').split(' - ')[0] || 'Other';
      }

      const list = groups.get(key) || [];
      list.push(user);
      groups.set(key, list);
    }

    const sectorOrder = [
      'Admin',
      'PWD',
      'Senior Citizens',
      'Solo Parents',
      'Students',
      'Disaster Affected',
      'Female Residents',
      'Male Residents',
      'Residents',
      'Restricted',
    ];

    const entries = Array.from(groups.entries());
    if (groupBy === 'sector') {
      entries.sort((a, b) => {
        const ia = sectorOrder.indexOf(a[0]);
        const ib = sectorOrder.indexOf(b[0]);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
    } else if (groupBy === 'zone') {
      entries.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
    } else {
      entries.sort((a, b) => a[0].localeCompare(b[0]));
    }

    return entries.map(([title, users]) => ({ title, users }));
  }, [filteredUsers, groupBy]);

  if (!isOpen) return null;

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(prev => (prev === key ? null : prev)), 1500);
    } catch {
      // Ignore clipboard permission restrictions
    }
  };

  const handleAutoLogin = async (user: ResidentUser) => {
    const pwd = getKnownDemoPassword(user);
    if (!pwd) {
      onFillCredentials(user.email, '');
      onClose();
      return;
    }

    setSigningInId(user.id);
    setLoginError(null);
    const res = await loginWithCredentials(user.email, pwd);
    setSigningInId(null);
    if (res.success) {
      onClose();
    } else {
      setLoginError(res.message || 'Sign in failed.');
    }
  };

  const filterTabs: Array<{ id: DirectoryCategoryFilter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: categoryCounts.all },
    { id: 'admin', label: 'Admin', count: categoryCounts.admin },
    { id: 'verified', label: 'Verified', count: categoryCounts.verified },
    { id: 'male', label: 'Male', count: categoryCounts.male },
    { id: 'female', label: 'Female', count: categoryCounts.female },
    { id: 'student', label: 'Student', count: categoryCounts.student },
    { id: 'pwd', label: 'PWD', count: categoryCounts.pwd },
    { id: 'senior', label: 'Senior', count: categoryCounts.senior },
    { id: 'solo_parent', label: 'Solo Parent', count: categoryCounts.solo_parent },
    { id: 'disaster', label: 'Disaster', count: categoryCounts.disaster },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-gray-950/50 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="accounts-directory-title"
    >
      <div className="bg-white w-full max-w-4xl max-h-[88vh] rounded-2xl border border-gray-200 shadow-2xl flex flex-col overflow-hidden">
        {/* Compact Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-gray-200 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2.5 min-w-0">
            <h2 id="accounts-directory-title" className="text-base font-bold text-gray-900">
              Accounts
            </h2>
            <span className="text-xs text-gray-500 tabular-nums">
              {filteredUsers.length} of {residentsList.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Clean Controls */}
        <div className="px-4 sm:px-5 py-3 border-b border-gray-200 bg-gray-50/70 space-y-2.5">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name or email..."
                className="w-full bg-white border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-[#0c532b]"
              />
            </div>

            <select
              aria-label="Group accounts by"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as DirectoryGroupBy)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-[#0c532b] cursor-pointer"
            >
              <option value="sector">Group: Sector</option>
              <option value="gender">Group: Gender</option>
              <option value="status">Group: Status</option>
              <option value="zone">Group: Zone</option>
              <option value="none">No Group</option>
            </select>
          </div>

          {/* Single-row Filter Strip */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5" role="tablist" aria-label="Account filters">
            {filterTabs.map(tab => {
              const active = categoryFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap tabular-nums flex-shrink-0 ${
                    active
                      ? 'bg-[#0c532b] text-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/70'
                  }`}
                >
                  {tab.label} {tab.count}
                </button>
              );
            })}
          </div>

          {loginError && (
            <p className="text-xs font-semibold text-rose-600">{loginError}</p>
          )}
        </div>

        {/* Compact Account Rows */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 space-y-4">
          {filteredUsers.length === 0 ? (
            <p className="py-10 text-center text-xs text-gray-500">
              No matching accounts.
            </p>
          ) : (
            groupedSections.map(section => (
              <div key={section.title} className="space-y-1">
                <div className="flex items-center justify-between py-1 border-b border-gray-200 sticky top-0 bg-white z-10">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                    {section.title}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-400 tabular-nums">
                    {section.users.length}
                  </span>
                </div>

                <div className="divide-y divide-gray-100">
                  {section.users.map(user => {
                    const demoPassword = getKnownDemoPassword(user);
                    const tags = getShortTags(user);
                    const isSigning = signingInId === user.id;

                    return (
                      <div
                        key={`${section.title}-${user.id}`}
                        className="py-2 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs hover:bg-gray-50/80 px-1.5 rounded-lg transition"
                      >
                        {/* Name + Short Inline Meta */}
                        <div className="min-w-0 md:w-[36%]">
                          <div className="font-semibold text-gray-900 truncate">{user.name}</div>
                          <div className="text-[11px] text-gray-500 truncate">
                            {tags.join(' · ')}
                          </div>
                        </div>

                        {/* Clean Username & Password */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 md:flex-1 min-w-0">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="font-mono text-[11px] text-gray-800 truncate select-all">
                              {user.email}
                            </span>
                            <button
                              type="button"
                              onClick={() => void handleCopy(`email-${user.id}`, user.email)}
                              className="p-0.5 text-gray-400 hover:text-gray-700 cursor-pointer flex-shrink-0"
                              aria-label={`Copy email for ${user.name}`}
                            >
                              {copiedKey === `email-${user.id}` ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="font-mono text-[11px] text-gray-500 select-all">
                              {demoPassword || 'Custom'}
                            </span>
                            {demoPassword && (
                              <button
                                type="button"
                                onClick={() => void handleCopy(`pwd-${user.id}`, demoPassword)}
                                className="p-0.5 text-gray-400 hover:text-gray-700 cursor-pointer flex-shrink-0"
                                aria-label={`Copy password for ${user.name}`}
                              >
                                {copiedKey === `pwd-${user.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Compact Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              onFillCredentials(user.email, demoPassword || '');
                              onClose();
                            }}
                            className="px-2.5 py-1 rounded-md border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-100 font-medium transition cursor-pointer"
                          >
                            Fill
                          </button>
                          {demoPassword && (
                            <button
                              type="button"
                              disabled={Boolean(signingInId)}
                              onClick={() => void handleAutoLogin(user)}
                              className="px-2.5 py-1 rounded-md bg-[#0c532b] hover:bg-[#083c1f] disabled:opacity-50 text-white font-semibold transition cursor-pointer flex items-center gap-1 whitespace-nowrap"
                            >
                              <LogIn className="w-3 h-3" />
                              <span>{isSigning ? '...' : 'Sign In'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
