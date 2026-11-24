import {
  BugoHazardZone,
  HazardCategory,
  HazardRiskLevel,
  BugoEarthquakeZoneInfo,
  BugoFireProneArea,
  BugoFloodAreaInfo,
  BugoLandslideAreaInfo,
  BugoOtherHazardAreaInfo,
  HazardSummariesData
} from '../types';

export type {
  BugoEarthquakeZoneInfo,
  BugoFireProneArea,
  BugoFloodAreaInfo,
  BugoLandslideAreaInfo,
  BugoOtherHazardAreaInfo,
  HazardSummariesData
};

export const BUGO_MAP_CENTER = { lat: 8.5089, lng: 124.7568 };

export const BUGO_MAP_BOUNDS = {
  north: 8.538,
  south: 8.478,
  west: 124.728,
  east: 124.792
};

export interface HazardCategoryStyle {
  label: string;
  shortDesc: string;
  pinBg: string;
  pinBorder: string;
  pinGlyph: string;
  circleFill: string;
  circleStroke: string;
  badgeClass: string;
  dotClass: string;
}

export const HAZARD_CATEGORY_META: Record<HazardCategory, HazardCategoryStyle> = {
  Flood: {
    label: 'Flood',
    shortDesc: 'Low-lying river & coastal overflow',
    pinBg: '#2563eb',
    pinBorder: '#1d4ed8',
    pinGlyph: 'F',
    circleFill: '#3b82f6',
    circleStroke: '#1d4ed8',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
    dotClass: 'bg-blue-600'
  },
  Landslide: {
    label: 'Landslide',
    shortDesc: 'Steep slopes & soil erosion risk',
    pinBg: '#d97706',
    pinBorder: '#b45309',
    pinGlyph: 'L',
    circleFill: '#f59e0b',
    circleStroke: '#b45309',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-600'
  },
  Earthquake: {
    label: 'Earthquake',
    shortDesc: 'Fault line & ground shaking zone',
    pinBg: '#7c3aed',
    pinBorder: '#6d28d9',
    pinGlyph: 'E',
    circleFill: '#8b5cf6',
    circleStroke: '#6d28d9',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
    dotClass: 'bg-purple-600'
  },
  Fire: {
    label: 'Fire',
    shortDesc: 'Dense housing & industrial fire risk',
    pinBg: '#dc2626',
    pinBorder: '#b91c1c',
    pinGlyph: 'R',
    circleFill: '#ef4444',
    circleStroke: '#b91c1c',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    dotClass: 'bg-red-600'
  },
  Other: {
    label: 'Other Hazard',
    shortDesc: 'Storm surge, drainage, or local hazard',
    pinBg: '#0d9488',
    pinBorder: '#0f766e',
    pinGlyph: 'H',
    circleFill: '#14b8a6',
    circleStroke: '#0f766e',
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
    dotClass: 'bg-teal-600'
  }
};

export const RISK_LEVEL_BADGES: Record<HazardRiskLevel, string> = {
  Low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Moderate: 'bg-amber-50 text-amber-700 border-amber-200',
  High: 'bg-rose-50 text-rose-700 border-rose-200'
};

export const DEFAULT_BUGO_HAZARD_ZONES: BugoHazardZone[] = [
  {
    id: 'hz-bugo-flood-1',
    name: 'Lower Bantiles & Bantiles Creek Basin',
    disasterType: 'Flood',
    riskLevel: 'High',
    purok: 'Zone 1',
    lat: 8.5055,
    lng: 124.7538,
    radiusMeters: 220,
    description: 'Bantiles Creek overflow & street flooding during heavy monsoon and shear-line rains.',
    affectedHouseholdsEst: 140,
    updatedAt: '2026-11-01'
  },
  {
    id: 'hz-bugo-coastal-2',
    name: 'Macajalar Bay Coastal Surge Belt',
    disasterType: 'Flood',
    riskLevel: 'Moderate',
    purok: 'Zone 9',
    lat: 8.5142,
    lng: 124.7524,
    radiusMeters: 200,
    description: 'High-tide and storm-drainage backflow along the Macajalar Bay shoreline.',
    affectedHouseholdsEst: 95,
    updatedAt: '2026-11-01'
  },
  {
    id: 'hz-bugo-landslide-3',
    name: 'Upper Bugo & Sitio Suntingon Slope Sector',
    disasterType: 'Landslide',
    riskLevel: 'High',
    purok: 'Zone 6',
    lat: 8.5005,
    lng: 124.7652,
    radiusMeters: 260,
    description: 'Steep upland hillside near Sitio Suntingon & Sapong ridge prone to soil saturation.',
    affectedHouseholdsEst: 80,
    updatedAt: '2026-11-01'
  },
  {
    id: 'hz-bugo-quake-4',
    name: 'Sitio Suntingon Valley Seismic Zone',
    disasterType: 'Earthquake',
    riskLevel: 'Moderate',
    purok: 'Zone 3',
    lat: 8.5062,
    lng: 124.765,
    radiusMeters: 240,
    description: 'Alluvial valley soil sensitive to regional tremors (Tagoloan River Fault ~14.8 km).',
    affectedHouseholdsEst: 110,
    updatedAt: '2026-11-01'
  },
  {
    id: 'hz-bugo-fire-5',
    name: 'Bugo Public Market & Crossing Fire Zone',
    disasterType: 'Fire',
    riskLevel: 'High',
    purok: 'Zone 5',
    lat: 8.5089,
    lng: 124.7574,
    radiusMeters: 160,
    description: 'Dense market stalls and interior residential alleys near BCIR; BFP Sub-Station 8A response.',
    affectedHouseholdsEst: 125,
    updatedAt: '2026-11-01'
  },
  {
    id: 'hz-bugo-other-6',
    name: 'Bantiles Culvert & Pier Drainage Buffer',
    disasterType: 'Other',
    riskLevel: 'Moderate',
    purok: 'Zone 10',
    lat: 8.5083,
    lng: 124.7533,
    radiusMeters: 180,
    description: 'Coastal industrial buffer, highway culvert bottleneck, and typhoon-surge advisory zone.',
    affectedHouseholdsEst: 65,
    updatedAt: '2026-11-01'
  }
];

export interface BugoMonthlyDisasterStat {
  month: string;
  monthIndex: number;
  flood: number;
  fire: number;
  landslide: number;
  earthquake: number;
  typhoon: number;
  affectedHouseholds: number;
  evacuatedIndividuals: number;
  remarks: string;
  locationLabel: string;
  lat: number;
  lng: number;
  primaryHazard: HazardCategory;
}

export const BUGO_MONTHLY_DISASTER_STATS: BugoMonthlyDisasterStat[] = [
  { month: 'January', monthIndex: 1, flood: 2, fire: 0, landslide: 1, earthquake: 0, typhoon: 0, affectedHouseholds: 24, evacuatedIndividuals: 88, remarks: 'Shear-line rains along Bantiles Creek (Zone 1)', locationLabel: 'Lower Bantiles Creek', lat: 8.5055, lng: 124.7538, primaryHazard: 'Flood' },
  { month: 'February', monthIndex: 2, flood: 2, fire: 0, landslide: 1, earthquake: 0, typhoon: 1, affectedHouseholds: 36, evacuatedIndividuals: 134, remarks: 'TS Basyang rains; Bantiles & Villa Trinitas', locationLabel: 'Villa Trinitas Ph. 1', lat: 8.5112, lng: 124.7666, primaryHazard: 'Flood' },
  { month: 'March', monthIndex: 3, flood: 0, fire: 1, landslide: 0, earthquake: 1, typhoon: 0, affectedHouseholds: 14, evacuatedIndividuals: 48, remarks: 'Dry-season residential fire & minor regional tremor', locationLabel: 'Bugo Crossing / Market', lat: 8.5089, lng: 124.7574, primaryHazard: 'Fire' },
  { month: 'April', monthIndex: 4, flood: 0, fire: 1, landslide: 0, earthquake: 0, typhoon: 0, affectedHouseholds: 9, evacuatedIndividuals: 31, remarks: 'Summer electrical load incident along BCIR', locationLabel: 'BCIR Commercial Strip', lat: 8.5082, lng: 124.7586, primaryHazard: 'Fire' },
  { month: 'May', monthIndex: 5, flood: 1, fire: 1, landslide: 0, earthquake: 0, typhoon: 0, affectedHouseholds: 16, evacuatedIndividuals: 54, remarks: 'Thunderstorm runoff & kitchen fire (Greymar Subd.)', locationLabel: 'Greymar Subdivision', lat: 8.5048, lng: 124.7582, primaryHazard: 'Fire' },
  { month: 'June', monthIndex: 6, flood: 2, fire: 0, landslide: 0, earthquake: 1, typhoon: 0, affectedHouseholds: 22, evacuatedIndividuals: 79, remarks: 'Habagat street flooding near Bugo Central School', locationLabel: 'Bugo Central School', lat: 8.5035, lng: 124.7527, primaryHazard: 'Flood' },
  { month: 'July', monthIndex: 7, flood: 2, fire: 0, landslide: 1, earthquake: 0, typhoon: 1, affectedHouseholds: 31, evacuatedIndividuals: 115, remarks: 'Monsoon downpour & Sitio Suntingon slope runoff', locationLabel: 'Sitio Suntingon', lat: 8.5062, lng: 124.765, primaryHazard: 'Landslide' },
  { month: 'August', monthIndex: 8, flood: 2, fire: 0, landslide: 1, earthquake: 0, typhoon: 0, affectedHouseholds: 26, evacuatedIndividuals: 96, remarks: 'Bantiles Creek rise & Villa Trinitas drainage overflow', locationLabel: 'Villa Trinitas Ph. 2', lat: 8.5111, lng: 124.7723, primaryHazard: 'Flood' },
  { month: 'September', monthIndex: 9, flood: 1, fire: 0, landslide: 0, earthquake: 1, typhoon: 1, affectedHouseholds: 19, evacuatedIndividuals: 68, remarks: 'Macajalar Bay high-tide surge & PEIS III tremor', locationLabel: 'Macajalar Bayside', lat: 8.5142, lng: 124.7524, primaryHazard: 'Flood' },
  { month: 'October', monthIndex: 10, flood: 2, fire: 1, landslide: 1, earthquake: 0, typhoon: 1, affectedHouseholds: 29, evacuatedIndividuals: 108, remarks: 'LPA rainbands & Sapong Creek bank swelling', locationLabel: 'Sapong / Upper Bugo', lat: 8.5005, lng: 124.7652, primaryHazard: 'Landslide' },
  { month: 'November', monthIndex: 11, flood: 2, fire: 0, landslide: 0, earthquake: 0, typhoon: 1, affectedHouseholds: 27, evacuatedIndividuals: 99, remarks: 'ITCZ rains affecting Lower Bantiles & Zone 4', locationLabel: 'Lower Bantiles', lat: 8.505, lng: 124.754, primaryHazard: 'Flood' },
  { month: 'December', monthIndex: 12, flood: 0, fire: 0, landslide: 0, earthquake: 0, typhoon: 0, affectedHouseholds: 0, evacuatedIndividuals: 0, remarks: 'Year-end Amihan & BDRRMC standby monitoring', locationLabel: 'Barangay Bugo Hall', lat: 8.5089, lng: 124.7568, primaryHazard: 'Other' }
];

export const BUGO_EARTHQUAKE_DATA: BugoEarthquakeZoneInfo[] = [
  {
    id: 'eq-zone-3',
    sectorName: 'Sitio Suntingon & Raboca Valley',
    purok: 'Zone 3',
    riskLevel: 'High',
    soilProfile: 'Alluvial valley sediment (higher ground-shaking sensitivity)',
    peisIntensityEstimate: 'PEIS VI–VII',
    faultProximityKm: 14.8,
    exposedHouseholds: 142,
    safeAssemblySite: 'Bugo National High School Open Grounds',
    lat: 8.5062,
    lng: 124.765,
    notes: 'Nearest active source: Tagoloan River Fault (~14.8 km east).'
  },
  {
    id: 'eq-zone-9',
    sectorName: 'Macajalar Bayside Coastal Strip',
    purok: 'Zone 9',
    riskLevel: 'Moderate',
    soilProfile: 'Coastal sand & marine fill (moderate liquefaction watch)',
    peisIntensityEstimate: 'PEIS VI–VII',
    faultProximityKm: 16.4,
    exposedHouseholds: 118,
    safeAssemblySite: 'Bugo Central School Covered Court',
    lat: 8.5142,
    lng: 124.7524,
    notes: 'Coastal evacuation & tsunami readiness sector along Macajalar Bay.'
  },
  {
    id: 'eq-zone-8',
    sectorName: 'Villa Trinitas & Upper Bugo Ridge',
    purok: 'Zone 8',
    riskLevel: 'High',
    soilProfile: 'Sloping volcanic tuff (quake-induced landslide watch)',
    peisIntensityEstimate: 'PEIS VI',
    faultProximityKm: 13.9,
    exposedHouseholds: 94,
    safeAssemblySite: 'Villa Trinitas Open Park & Court',
    lat: 8.5111,
    lng: 124.7723,
    notes: 'Slope stability monitoring during strong regional Cabanglasan/Tagoloan tremors.'
  },
  {
    id: 'eq-zone-10',
    sectorName: 'Del Monte Cannery & BCIR Corridor',
    purok: 'Zone 10',
    riskLevel: 'Moderate',
    soilProfile: 'Compacted coastal terrace & highway fill',
    peisIntensityEstimate: 'PEIS VI',
    faultProximityKm: 15.6,
    exposedHouseholds: 110,
    safeAssemblySite: 'Barangay Bugo Gymnasium & Plaza',
    lat: 8.5083,
    lng: 124.7533,
    notes: 'Industrial & public facility seismic safety compliance zone.'
  }
];

export const BUGO_FIRE_PRONE_AREAS: BugoFireProneArea[] = [
  {
    id: 'fire-zone-5',
    areaName: 'Bugo Public Market & Crossing Alleys',
    purok: 'Zone 5',
    frequencyLabel: 'Top Hotspot',
    incidentsLast3Years: 4,
    affectedStructuresEst: 120,
    riskLevel: 'High',
    primaryCauses: 'Overloaded stall wiring, jumper lines & LPG',
    accessConstraint: 'Narrow 1.5m–2m interior market alleys',
    hydrantStatus: '2 perimeter hydrants · BFP Bugo Sub-Station 8A',
    lat: 8.5089,
    lng: 124.7574
  },
  {
    id: 'fire-zone-1',
    areaName: 'Lower Bantiles Riverside Housing',
    purok: 'Zone 1',
    frequencyLabel: 'Frequent',
    incidentsLast3Years: 3,
    affectedStructuresEst: 96,
    riskLevel: 'High',
    primaryCauses: 'Light-material houses & faulty electrical connections',
    accessConstraint: 'Narrow creek-side road near Bantiles Bridge',
    hydrantStatus: '1 roadside hydrant · BDRRMC water pump staging',
    lat: 8.5055,
    lng: 124.7538
  },
  {
    id: 'fire-zone-4',
    areaName: 'BCIR Commercial & Greymar Junction',
    purok: 'Zone 4',
    frequencyLabel: 'Moderate',
    incidentsLast3Years: 2,
    affectedStructuresEst: 78,
    riskLevel: 'High',
    primaryCauses: 'Aging commercial wiring & kitchen stoves',
    accessConstraint: 'Peak-hour BCIR National Highway traffic',
    hydrantStatus: 'Highway crossing hydrant · BFP Sub-Station 8A',
    lat: 8.5082,
    lng: 124.7586
  },
  {
    id: 'fire-zone-10',
    areaName: 'Del Monte Cannery & Pier Perimeter',
    purok: 'Zone 10',
    frequencyLabel: 'Low',
    incidentsLast3Years: 1,
    affectedStructuresEst: 54,
    riskLevel: 'Moderate',
    primaryCauses: 'Transformer sparks & dry-season grass fires',
    accessConstraint: 'Industrial gate security coordination required',
    hydrantStatus: 'Del Monte plant brigade & industrial hydrants',
    lat: 8.5083,
    lng: 124.7533
  }
];

export const BUGO_FLOOD_AREAS: BugoFloodAreaInfo[] = [
  {
    id: 'flood-zone-1',
    areaName: 'Lower Bantiles & Bantiles Creek Basin',
    purok: 'Zone 1',
    riskLevel: 'High',
    peakDepthEst: '0.8m – 1.4m',
    exposedHouseholds: 140,
    primaryTrigger: 'Bantiles Creek overflow during shear-line & Habagat downpours',
    evacuationSite: 'Bugo Central School Covered Court',
    drainageStatus: 'Silt-cleared creek channel; floodwater gauge monitored by BDRRMC',
    lat: 8.5055,
    lng: 124.7538
  },
  {
    id: 'flood-zone-9',
    areaName: 'Macajalar Bay Coastal & Tidal Strip',
    purok: 'Zone 9',
    riskLevel: 'Moderate',
    peakDepthEst: '0.4m – 0.8m',
    exposedHouseholds: 95,
    primaryTrigger: 'High tide coinciding with heavy coastal drainage runoff',
    evacuationSite: 'Barangay Bugo Gymnasium & Plaza',
    drainageStatus: 'Coastal outfall flap-gates inspected before monsoon season',
    lat: 8.5142,
    lng: 124.7524
  },
  {
    id: 'flood-zone-8',
    areaName: 'Villa Trinitas Phase 1 & 2 Drainage Basin',
    purok: 'Zone 8',
    riskLevel: 'Moderate',
    peakDepthEst: '0.3m – 0.7m',
    exposedHouseholds: 78,
    primaryTrigger: 'Upland sheet runoff overwhelming perimeter subdivision canals',
    evacuationSite: 'Villa Trinitas Multi-Purpose Hall',
    drainageStatus: 'Scheduled canal desilting & detention culvert upgrade',
    lat: 8.5112,
    lng: 124.7666
  },
  {
    id: 'flood-zone-4',
    areaName: 'Bugo Central School & BCIR Lowlands',
    purok: 'Zone 4',
    riskLevel: 'Moderate',
    peakDepthEst: '0.3m – 0.6m',
    exposedHouseholds: 64,
    primaryTrigger: 'Highway gutter backup during intense 1-hour cloudbursts',
    evacuationSite: 'Bugo Central School 2nd Floor Classrooms',
    drainageStatus: 'DPWH highway cross-drainage & barangay declogging crew',
    lat: 8.5035,
    lng: 124.7527
  }
];

export const BUGO_LANDSLIDE_AREAS: BugoLandslideAreaInfo[] = [
  {
    id: 'landslide-zone-6',
    sectorName: 'Upper Bugo & Sapong Ridge Slope',
    purok: 'Zone 6',
    riskLevel: 'High',
    slopeGrade: '30° – 45° steep slope',
    exposedHouseholds: 80,
    soilAndTrigger: 'Saturated clay-loam & Sapong Creek undercutting during prolonged LPA rains',
    safeAssemblySite: 'Upper Bugo Chapel & Covered Court',
    mitigationNotes: 'Pre-emptive evacuation advisory issued after 3 consecutive days of heavy rain.',
    lat: 8.5005,
    lng: 124.7652
  },
  {
    id: 'landslide-zone-3',
    sectorName: 'Sitio Suntingon Upland Escarpment',
    purok: 'Zone 3',
    riskLevel: 'High',
    slopeGrade: '25° – 38° hillside',
    exposedHouseholds: 62,
    soilAndTrigger: 'Weathered volcanic slope runoff & localized tension cracks',
    safeAssemblySite: 'Bugo National High School Open Grounds',
    mitigationNotes: 'Riprap retaining wall & slope drainage trenches inspected quarterly.',
    lat: 8.5062,
    lng: 124.765
  },
  {
    id: 'landslide-zone-8',
    sectorName: 'Villa Trinitas Upper Ridge Perimeter',
    purok: 'Zone 8',
    riskLevel: 'Moderate',
    slopeGrade: '18° – 28° terraced cut',
    exposedHouseholds: 48,
    soilAndTrigger: 'Steep cut-slope embankments along upper subdivision perimeter',
    safeAssemblySite: 'Villa Trinitas Open Park & Court',
    mitigationNotes: 'Vegetative vetiver stabilization & weep-hole maintenance.',
    lat: 8.5111,
    lng: 124.7723
  },
  {
    id: 'landslide-zone-7',
    sectorName: 'Upper Raboca & Hillside Access Cut',
    purok: 'Zone 7',
    riskLevel: 'Moderate',
    slopeGrade: '20° – 32° embankment',
    exposedHouseholds: 41,
    soilAndTrigger: 'Road-cut soil slippage & blocked side ditches during typhoons',
    safeAssemblySite: 'Barangay Bugo Gymnasium & Plaza',
    mitigationNotes: 'BDRRMC clears debris & monitors hillside drainage channels.',
    lat: 8.5038,
    lng: 124.7675
  }
];

export const BUGO_OTHER_HAZARD_AREAS: BugoOtherHazardAreaInfo[] = [
  {
    id: 'other-zone-9',
    areaName: 'Macajalar Bay Storm Surge & Coastal Erosion',
    purok: 'Zone 9',
    hazardSubtype: 'Storm Surge / Wave Overtopping',
    riskLevel: 'Moderate',
    exposedHouseholds: 88,
    description: 'Strong Amihan/typhoon swells pushing seawater and debris onto shoreline dwellings.',
    contingencyAction: 'Early coastal evacuation to Bugo Central School & seawall sandbagging.',
    lat: 8.5142,
    lng: 124.7524
  },
  {
    id: 'other-zone-1',
    areaName: 'Bantiles Bridge & Culvert Bottleneck',
    purok: 'Zone 1',
    hazardSubtype: 'Debris Jam & Flash Runoff',
    riskLevel: 'High',
    exposedHouseholds: 72,
    description: 'Upland logs and solid waste snagging under Bantiles Bridge, causing sudden backwater.',
    contingencyAction: 'Pre-storm debris clearing team & bridge water-level siren.',
    lat: 8.505,
    lng: 124.754
  },
  {
    id: 'other-zone-10',
    areaName: 'Del Monte Cannery & Pier Chemical/Traffic Buffer',
    purok: 'Zone 10',
    hazardSubtype: 'Industrial & Port Safety Buffer',
    riskLevel: 'Low',
    exposedHouseholds: 65,
    description: 'Heavy container-truck staging and industrial ammonia/boiler safety perimeter.',
    contingencyAction: 'Joint Del Monte ERT & Barangay Bugo Tanod traffic/evacuation protocol.',
    lat: 8.5083,
    lng: 124.7533
  },
  {
    id: 'other-zone-5',
    areaName: 'Bugo Crossing BCIR Overhead Utility Corridor',
    purok: 'Zone 5',
    hazardSubtype: 'Gale Wind & Downed Power Lines',
    riskLevel: 'Moderate',
    exposedHouseholds: 54,
    description: 'Dense overhead telecom/power cables and signage vulnerable to severe thunderstorm gusts.',
    contingencyAction: 'CEPALCO hotline coordination & immediate BCIR road-cordon barricades.',
    lat: 8.5089,
    lng: 124.7574
  }
];

export const createDefaultHazardSummaries = (): HazardSummariesData => ({
  flood: BUGO_FLOOD_AREAS.map(item => ({ ...item })),
  landslide: BUGO_LANDSLIDE_AREAS.map(item => ({ ...item })),
  earthquake: BUGO_EARTHQUAKE_DATA.map(item => ({ ...item })),
  fire: BUGO_FIRE_PRONE_AREAS.map(item => ({ ...item })),
  other: BUGO_OTHER_HAZARD_AREAS.map(item => ({ ...item }))
});



