import { RankingClassificationEntry, RankingPriorityLevel } from '../types';

export interface RankingTierMeta {
  level: RankingPriorityLevel;
  title: string;
  shortLabel: string;
  tag: string;
  impactBadge: string;
  impactLabel: string;
  description: string;
  surfaceClass: string;
  accentTextClass: string;
  badgeClass: string;
}

export const RANKING_TIERS: RankingTierMeta[] = [
  {
    level: 1,
    title: 'Priority 1 – Critical',
    shortLabel: 'P1 · Critical',
    tag: 'Critical',
    impactBadge: 'Highest',
    impactLabel: 'Most Affected',
    description: 'Completely damaged; urgent assistance needed.',
    surfaceClass: 'bg-rose-50/80 border-rose-200',
    accentTextClass: 'text-rose-800',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
  },
  {
    level: 2,
    title: 'Priority 2 – High',
    shortLabel: 'P2 · High',
    tag: 'High',
    impactBadge: 'High',
    impactLabel: 'High Need',
    description: 'Severe damage; major repairs needed.',
    surfaceClass: 'bg-orange-50/80 border-orange-200',
    accentTextClass: 'text-orange-800',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  {
    level: 3,
    title: 'Priority 3 – Moderate',
    shortLabel: 'P3 · Moderate',
    tag: 'Moderate',
    impactBadge: 'Medium',
    impactLabel: 'Moderate Need',
    description: 'Moderate damage; partial repairs needed.',
    surfaceClass: 'bg-sky-50/80 border-sky-200',
    accentTextClass: 'text-sky-800',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
  },
  {
    level: 4,
    title: 'Priority 4 – Low',
    shortLabel: 'P4 · Low',
    tag: 'Low',
    impactBadge: 'Low',
    impactLabel: 'Low Need',
    description: 'Slight damage; minor repairs needed.',
    surfaceClass: 'bg-emerald-50/80 border-emerald-200',
    accentTextClass: 'text-emerald-800',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    level: 5,
    title: 'Priority 5 – No Damage',
    shortLabel: 'P5 · No Damage',
    tag: 'No Damage',
    impactBadge: 'Least',
    impactLabel: 'Least Affected',
    description: 'No damage recorded.',
    surfaceClass: 'bg-slate-50 border-slate-200',
    accentTextClass: 'text-slate-700',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
];

export function getRankingTierMeta(priority: number): RankingTierMeta {
  return RANKING_TIERS.find(t => t.level === priority) || RANKING_TIERS[4];
}

export function sortRankingClassifications(
  entries: RankingClassificationEntry[]
): RankingClassificationEntry[] {
  return [...entries].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });
}
