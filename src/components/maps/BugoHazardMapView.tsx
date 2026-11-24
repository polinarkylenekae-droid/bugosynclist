import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Plus,
  Edit3,
  Trash2,
  X,
  Move,
  Info,
  Loader2,
  CheckCircle2,
  LocateFixed,
  BarChart3,
  Activity,
  Flame,
  Calendar,
  Navigation,
  Waves,
  Mountain,
  AlertTriangle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  BUGO_MAP_BOUNDS,
  BUGO_MAP_CENTER,
  HAZARD_CATEGORY_META,
  RISK_LEVEL_BADGES,
  BUGO_MONTHLY_DISASTER_STATS
} from '../../data/hazardDefaults';
import { BUGO_PUROKS } from '../../data/mockData';
import {
  BugoHazardZone,
  HazardCategory,
  HazardRiskLevel,
  HazardSummaryCategory
} from '../../types';

const CATEGORIES: HazardCategory[] = ['Flood', 'Landslide', 'Earthquake', 'Fire', 'Other'];
const RISK_LEVELS: HazardRiskLevel[] = ['Low', 'Moderate', 'High'];

interface BugoHazardMapViewProps {
  canManage: boolean;
}

interface DetectedLocationInfo {
  areaName: string;
  formattedAddress: string;
  matchedZone: string;
  nearbyLandmark?: string;
  suggestedTitle: string;
}

function createHazardPinIcon(
  bg: string,
  border: string,
  glyph: string,
  emphasized: boolean
): L.DivIcon {
  const scale = emphasized ? 1.18 : 1;
  const width = Math.round(32 * scale);
  const height = Math.round(42 * scale);
  const fontSize = Math.round(12 * scale);

  const html = `
    <div style="width:${width}px;height:${height}px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.32));">
      <svg viewBox="0 0 32 42" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 1C7.716 1 1 7.716 1 16c0 10.5 15 25 15 25s15-14.5 15-25C31 7.716 24.284 1 16 1z" fill="${bg}" stroke="${border}" stroke-width="2"/>
        <circle cx="16" cy="15.5" r="8.5" fill="rgba(255,255,255,0.2)"/>
        <text x="16" y="19.5" text-anchor="middle" fill="#ffffff" font-family="Inter,system-ui,sans-serif" font-size="${fontSize}" font-weight="800">${glyph}</text>
      </svg>
    </div>
  `;

  return L.divIcon({
    className: 'bugo-osm-hazard-pin',
    html,
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -height + 4]
  });
}

function buildPopupElement(
  zone: BugoHazardZone,
  canManage: boolean,
  callbacks: {
    onStartMove: (z: BugoHazardZone) => void;
    onEdit: (z: BugoHazardZone) => void;
    onDelete: (id: string) => void;
  }
): HTMLElement {
  const meta = HAZARD_CATEGORY_META[zone.disasterType] || HAZARD_CATEGORY_META.Other;

  const root = document.createElement('div');
  root.className = 'p-0.5 space-y-2 text-xs text-gray-800 min-w-[215px] max-w-[260px]';

  const badgesRow = document.createElement('div');
  badgesRow.className = 'flex items-center justify-between gap-2';

  const catBadge = document.createElement('span');
  catBadge.className = `px-2 py-0.5 rounded border text-[11px] font-bold ${meta.badgeClass}`;
  catBadge.textContent = meta.label;

  const riskBadge = document.createElement('span');
  riskBadge.className = `px-2 py-0.5 rounded border text-[11px] font-bold ${RISK_LEVEL_BADGES[zone.riskLevel]}`;
  riskBadge.textContent = `${zone.riskLevel} Risk`;

  badgesRow.append(catBadge, riskBadge);
  root.appendChild(badgesRow);

  const titleWrap = document.createElement('div');
  const titleEl = document.createElement('p');
  titleEl.className = 'font-extrabold text-gray-900 text-sm leading-snug !m-0';
  titleEl.textContent = zone.name;

  const subEl = document.createElement('p');
  subEl.className = 'text-[11px] text-gray-600 !mt-0.5 !mb-0';
  subEl.textContent = `${zone.purok.split(' - ')[0]} • ${zone.radiusMeters}m area`;

  titleWrap.append(titleEl, subEl);
  root.appendChild(titleWrap);

  const descEl = document.createElement('p');
  descEl.className = 'text-xs text-gray-700 leading-snug !m-0';
  descEl.textContent = zone.description;
  root.appendChild(descEl);

  if (canManage) {
    const actionsRow = document.createElement('div');
    actionsRow.className = 'grid grid-cols-3 gap-1.5 pt-2 border-t border-gray-100';

    const moveBtn = document.createElement('button');
    moveBtn.type = 'button';
    moveBtn.className =
      'py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg font-bold text-[11px] cursor-pointer';
    moveBtn.textContent = 'Move';
    moveBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      callbacks.onStartMove(zone);
    });

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className =
      'py-1.5 px-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-bold text-[11px] cursor-pointer';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      callbacks.onEdit(zone);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className =
      'py-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-[11px] cursor-pointer';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      callbacks.onDelete(zone.id);
    });

    actionsRow.append(moveBtn, editBtn, deleteBtn);
    root.appendChild(actionsRow);
  }

  return root;
}

export const BugoHazardMapView: React.FC<BugoHazardMapViewProps> = ({ canManage }) => {
  const {
    hazardZones,
    hazardSummaries,
    disasterVictims,
    addHazardZone,
    updateHazardZone,
    deleteHazardZone,
    updateHazardSummaryItem
  } = useApp();

  const [categoryFilter, setCategoryFilter] = useState<'All' | HazardCategory>('All');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [focusedSpot, setFocusedSpot] = useState<{
    lat: number;
    lng: number;
    label: string;
    subtitle?: string;
    category: HazardCategory;
    details?: string;
  } | null>(null);
  const [dataTab, setDataTab] = useState<'monthly' | 'flood' | 'landslide' | 'earthquake' | 'fire' | 'other'>('monthly');

  // Admin Edit Info state for Hazard Summary Cards (Flood, Landslide, Earthquake, Fire, Other)
  const [editingSummary, setEditingSummary] = useState<{ category: HazardSummaryCategory; id: string } | null>(null);
  const [summaryForm, setSummaryForm] = useState<Record<string, string | number>>({});
  const [summarySaving, setSummarySaving] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  const openSummaryEditModal = (category: HazardSummaryCategory, item: any) => {
    if (!canManage) return;
    setSummaryError('');
    setEditingSummary({ category, id: item.id });
    setSummaryForm({ ...item });
  };

  const handleSaveSummaryInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !editingSummary) return;
    setSummarySaving(true);
    setSummaryError('');
    const res = await updateHazardSummaryItem(editingSummary.category, editingSummary.id, summaryForm as any);
    setSummarySaving(false);
    if (!res.success) {
      setSummaryError(res.message || 'Unable to save hazard information.');
      return;
    }
    setEditingSummary(null);
    showNotice('Updated hazard info — changes are now visible to residents.');
  };

  // Simple Admin Pinning & Moving States
  const [pinModeCategory, setPinModeCategory] = useState<HazardCategory | null>(null);
  const [movingZoneId, setMovingZoneId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Automatic Area / Zone Detection States
  const [isLocatingArea, setIsLocatingArea] = useState(false);
  const [detectedLocation, setDetectedLocation] = useState<DetectedLocationInfo | null>(null);
  const nameManuallyEditedRef = useRef(false);
  const geoReqIdRef = useRef(0);

  // Add/Edit modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<BugoHazardZone | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [form, setForm] = useState({
    name: '',
    disasterType: 'Flood' as HazardCategory,
    riskLevel: 'Moderate' as HazardRiskLevel,
    purok: BUGO_PUROKS[0],
    lat: BUGO_MAP_CENTER.lat,
    lng: BUGO_MAP_CENTER.lng,
    radiusMeters: 200,
    description: ''
  });

  // Leaflet instance & layer refs
  const mapSectionRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const focusedLayerRef = useRef<L.LayerGroup | null>(null);
  const markersByIdRef = useRef<Map<string, L.Marker>>(new Map());
  const mapClickHandlerRef = useRef<(coords: { lat: number; lng: number }) => void>(() => {});
  const isDraggingMarkerRef = useRef(false);

  useEffect(() => {
    if (!statusNotice) return;
    const t = setTimeout(() => setStatusNotice(null), 3200);
    return () => clearTimeout(t);
  }, [statusNotice]);

  const visibleZones = useMemo(() => {
    return hazardZones.filter(z => categoryFilter === 'All' || z.disasterType === categoryFilter);
  }, [hazardZones, categoryFilter]);

  const selectedZone = useMemo(
    () => visibleZones.find(z => z.id === selectedZoneId) || null,
    [visibleZones, selectedZoneId]
  );

  const movingZone = useMemo(
    () => hazardZones.find(z => z.id === movingZoneId) || null,
    [hazardZones, movingZoneId]
  );

  const showNotice = (msg: string) => {
    setStatusNotice(msg);
  };

  const focusMapCoords = (
    lat: number,
    lng: number,
    label: string,
    options?: { subtitle?: string; category?: HazardCategory; details?: string }
  ) => {
    const category = options?.category || 'Other';
    if (categoryFilter !== 'All' && categoryFilter !== category) {
      setCategoryFilter('All');
    }

    const matchingZone = hazardZones.find(
      z =>
        Math.abs(z.lat - lat) < 0.0008 &&
        Math.abs(z.lng - lng) < 0.0008 &&
        z.disasterType === category
    );

    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (matchingZone) {
      setFocusedSpot(null);
      setSelectedZoneId(matchingZone.id);
      setTimeout(() => {
        mapRef.current?.flyTo([matchingZone.lat, matchingZone.lng], 16, { duration: 0.7 });
      }, 180);
    } else {
      setSelectedZoneId(null);
      setFocusedSpot({
        lat,
        lng,
        label,
        subtitle: options?.subtitle,
        category,
        details: options?.details
      });
      setTimeout(() => {
        mapRef.current?.flyTo([lat, lng], 16, { duration: 0.7 });
      }, 180);
    }

    showNotice(`Focused map on ${label}`);
  };

  const locateAreaForCoords = async (lat: number, lng: number): Promise<DetectedLocationInfo | null> => {
    try {
      const res = await fetch(`/api/maps/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) return null;
      return {
        areaName: data.areaName || '',
        formattedAddress: data.formattedAddress || '',
        matchedZone: data.matchedZone || BUGO_PUROKS[0],
        nearbyLandmark: data.nearbyLandmark || '',
        suggestedTitle: data.suggestedTitle || data.areaName || BUGO_PUROKS[0]
      };
    } catch {
      return null;
    }
  };

  const startPinMode = (cat: HazardCategory = 'Flood') => {
    setMovingZoneId(null);
    setSelectedZoneId(null);
    setPinModeCategory(cat);
  };

  const startMoveZone = (zone: BugoHazardZone) => {
    setPinModeCategory(null);
    setSelectedZoneId(null);
    setIsModalOpen(false);
    mapRef.current?.closePopup();
    setMovingZoneId(zone.id);
  };

  const openAddModal = (coords?: { lat: number; lng: number }, legend?: HazardCategory) => {
    const targetLat = Number((coords?.lat ?? BUGO_MAP_CENTER.lat).toFixed(6));
    const targetLng = Number((coords?.lng ?? BUGO_MAP_CENTER.lng).toFixed(6));
    setEditingZone(null);
    setFormError('');
    nameManuallyEditedRef.current = false;
    setDetectedLocation(null);
    const chosenCategory = legend || pinModeCategory || (categoryFilter !== 'All' ? categoryFilter : 'Flood');
    setForm({
      name: '',
      disasterType: chosenCategory,
      riskLevel: 'Moderate',
      purok: BUGO_PUROKS[0],
      lat: targetLat,
      lng: targetLng,
      radiusMeters: 200,
      description: ''
    });
    setPinModeCategory(null);
    setMovingZoneId(null);
    setIsModalOpen(true);

    const reqId = ++geoReqIdRef.current;
    setIsLocatingArea(true);
    locateAreaForCoords(targetLat, targetLng).then((geo) => {
      if (geoReqIdRef.current !== reqId) return;
      setIsLocatingArea(false);
      if (!geo) return;
      setDetectedLocation(geo);
      setForm(prev => ({
        ...prev,
        purok: geo.matchedZone || prev.purok,
        name: nameManuallyEditedRef.current ? prev.name : geo.suggestedTitle
      }));
    });
  };

  const openEditModal = (z: BugoHazardZone) => {
    setEditingZone(z);
    setFormError('');
    nameManuallyEditedRef.current = false;
    setDetectedLocation(null);
    setForm({
      name: z.name,
      disasterType: z.disasterType,
      riskLevel: z.riskLevel,
      purok: z.purok,
      lat: z.lat,
      lng: z.lng,
      radiusMeters: z.radiusMeters || 200,
      description: z.description
    });
    setPinModeCategory(null);
    setMovingZoneId(null);
    setSelectedZoneId(null);
    mapRef.current?.closePopup();
    setIsModalOpen(true);

    const reqId = ++geoReqIdRef.current;
    setIsLocatingArea(true);
    locateAreaForCoords(z.lat, z.lng).then((geo) => {
      if (geoReqIdRef.current !== reqId) return;
      setIsLocatingArea(false);
      if (geo) setDetectedLocation(geo);
    });
  };

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('Please enter a short place name.');
      return;
    }

    setSaving(true);
    setFormError('');
    const payload = {
      name: form.name.trim(),
      disasterType: form.disasterType,
      riskLevel: form.riskLevel,
      purok: form.purok,
      lat: form.lat,
      lng: form.lng,
      radiusMeters: Math.max(50, Math.min(2000, Number(form.radiusMeters) || 200)),
      description: form.description.trim() || `${form.disasterType}-prone area in ${form.purok.split(' - ')[0]}.`
    };

    const res = editingZone
      ? await updateHazardZone(editingZone.id, payload)
      : await addHazardZone(payload);

    setSaving(false);
    if (!res.success) {
      setFormError(res.message || 'Unable to save location.');
      return;
    }
    setIsModalOpen(false);
    if (res.zone) {
      setSelectedZoneId(res.zone.id);
      showNotice(editingZone ? `Updated "${res.zone.name}"` : `Pinned "${res.zone.name}"`);
    }
  };

  const handleMapClick = async (coords: { lat: number; lng: number }) => {
    if (!canManage) return;

    // 1. Moving an existing pin with 1 click + auto-locating new area & zone name
    if (movingZone) {
      const targetZone = movingZone;
      const lat = Number(coords.lat.toFixed(6));
      const lng = Number(coords.lng.toFixed(6));
      setMovingZoneId(null);
      showNotice(`Locating new area for "${targetZone.name}"...`);

      const geo = await locateAreaForCoords(lat, lng);
      const nextPurok = geo?.matchedZone || targetZone.purok;
      const nextName = geo?.suggestedTitle || targetZone.name;

      const res = await updateHazardZone(targetZone.id, {
        lat,
        lng,
        purok: nextPurok,
        name: nextName
      });
      if (res.success && res.zone) {
        setSelectedZoneId(res.zone.id);
        showNotice(`Moved to ${res.zone.name}`);
      }
      return;
    }

    // 2. Dropping a new pin for selected legend
    if (pinModeCategory) {
      openAddModal(coords, pinModeCategory);
    }
  };

  const handleMarkerDragFinish = async (zone: BugoHazardZone, pos: { lat: number; lng: number }) => {
    const lat = Number(pos.lat.toFixed(6));
    const lng = Number(pos.lng.toFixed(6));
    showNotice(`Locating new area for "${zone.name}"...`);

    const geo = await locateAreaForCoords(lat, lng);
    const nextPurok = geo?.matchedZone || zone.purok;
    const nextName = geo?.suggestedTitle || zone.name;

    const res = await updateHazardZone(zone.id, {
      lat,
      lng,
      purok: nextPurok,
      name: nextName
    });
    if (res.success && res.zone) {
      setSelectedZoneId(res.zone.id);
      showNotice(`Moved to ${res.zone.name}`);
    }
  };

  const handleDeleteZone = async (id: string) => {
    const target = hazardZones.find(z => z.id === id);
    mapRef.current?.closePopup();
    await deleteHazardZone(id);
    if (selectedZoneId === id) setSelectedZoneId(null);
    if (movingZoneId === id) setMovingZoneId(null);
    if (target) showNotice(`Removed "${target.name}"`);
  };

  // Keep latest map click handler ref updated
  mapClickHandlerRef.current = (coords) => {
    void handleMapClick(coords);
  };

  // Keep latest popup action callbacks updated
  const popupCallbacksRef = useRef({
    onStartMove: startMoveZone,
    onEdit: openEditModal,
    onDelete: (id: string) => {
      void handleDeleteZone(id);
    }
  });
  popupCallbacksRef.current = {
    onStartMove: startMoveZone,
    onEdit: openEditModal,
    onDelete: (id: string) => {
      void handleDeleteZone(id);
    }
  };

  // Initialize Leaflet + OpenStreetMap instance once
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current) return;

    const bounds = L.latLngBounds(
      [BUGO_MAP_BOUNDS.south, BUGO_MAP_BOUNDS.west],
      [BUGO_MAP_BOUNDS.north, BUGO_MAP_BOUNDS.east]
    );

    const map = L.map(container, {
      center: [BUGO_MAP_CENTER.lat, BUGO_MAP_CENTER.lng],
      zoom: 15,
      minZoom: 13,
      maxZoom: 19,
      maxBounds: bounds,
      maxBoundsViscosity: 0.75,
      zoomControl: true,
      attributionControl: false
    });

    const osmLayer = L.tileLayer('/api/maps/tiles/{z}/{x}/{y}.png', {
      maxZoom: 19
    });

    osmLayer.on('load', () => setMapReady(true));
    osmLayer.addTo(map);
    // Mark ready promptly in case cached tiles load synchronously
    setMapReady(true);

    const layerGroup = L.layerGroup().addTo(map);
    const focusedLayer = L.layerGroup().addTo(map);

    map.on('click', (ev: L.LeafletMouseEvent) => {
      mapClickHandlerRef.current({ lat: ev.latlng.lat, lng: ev.latlng.lng });
    });

    mapRef.current = map;
    layerGroupRef.current = layerGroup;
    focusedLayerRef.current = focusedLayer;

    // Ensure Leaflet measures container cleanly after layout transitions
    const invalidateTimer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(container);
    }

    return () => {
      clearTimeout(invalidateTimer);
      resizeObserver?.disconnect();
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      focusedLayerRef.current = null;
      markersByIdRef.current.clear();
    };
  }, []);

  // Update crosshair cursor when pinning or moving
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const container = map.getContainer();
    container.style.cursor = canManage && (pinModeCategory || movingZoneId) ? 'crosshair' : '';
  }, [canManage, pinModeCategory, movingZoneId]);

  // Synchronize hazard circles & markers on OpenStreetMap
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup || isDraggingMarkerRef.current) return;

    layerGroup.clearLayers();
    markersByIdRef.current.clear();

    visibleZones.forEach(zone => {
      const meta = HAZARD_CATEGORY_META[zone.disasterType] || HAZARD_CATEGORY_META.Other;
      const isSelected = selectedZoneId === zone.id;
      const isBeingMoved = movingZoneId === zone.id;

      const circle = L.circle([zone.lat, zone.lng], {
        radius: zone.radiusMeters || 180,
        color: meta.circleStroke,
        opacity: isBeingMoved ? 0.95 : 0.85,
        weight: isBeingMoved ? 2.5 : 1.5,
        fillColor: meta.circleFill,
        fillOpacity: zone.riskLevel === 'High' ? 0.28 : zone.riskLevel === 'Moderate' ? 0.2 : 0.14,
        interactive: false
      });
      circle.addTo(layerGroup);

      const marker = L.marker([zone.lat, zone.lng], {
        draggable: canManage,
        title: canManage
          ? `${zone.name} (${zone.disasterType}) — Drag to move`
          : `${zone.name} (${zone.disasterType} - ${zone.riskLevel})`,
        icon: createHazardPinIcon(
          meta.pinBg,
          isBeingMoved ? '#111827' : meta.pinBorder,
          meta.pinGlyph,
          isSelected || isBeingMoved
        )
      });

      const popupNode = buildPopupElement(zone, canManage, {
        onStartMove: (z) => popupCallbacksRef.current.onStartMove(z),
        onEdit: (z) => popupCallbacksRef.current.onEdit(z),
        onDelete: (id) => popupCallbacksRef.current.onDelete(id)
      });

      marker.bindPopup(popupNode, {
        maxWidth: 280,
        closeButton: true
      });

      marker.on('click', () => {
        setSelectedZoneId(zone.id);
      });

      marker.on('popupclose', () => {
        setSelectedZoneId(prev => (prev === zone.id ? null : prev));
      });

      if (canManage) {
        marker.on('dragstart', () => {
          isDraggingMarkerRef.current = true;
        });
        marker.on('drag', () => {
          const pos = marker.getLatLng();
          circle.setLatLng(pos);
        });
        marker.on('dragend', () => {
          isDraggingMarkerRef.current = false;
          const pos = marker.getLatLng();
          void handleMarkerDragFinish(zone, { lat: pos.lat, lng: pos.lng });
        });
      }

      marker.addTo(layerGroup);
      markersByIdRef.current.set(zone.id, marker);
    });
  }, [visibleZones, selectedZoneId, movingZoneId, canManage]);

  // Pan to & open popup when a zone is selected from list or after save
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedZone) return;
    map.panTo([selectedZone.lat, selectedZone.lng], { animate: true });
    const marker = markersByIdRef.current.get(selectedZone.id);
    if (marker && !marker.isPopupOpen()) {
      marker.openPopup();
    }
  }, [selectedZone]);

  // Render focused spot marker & auto-open popup when navigating from Disaster & Hazard Summary
  useEffect(() => {
    const map = mapRef.current;
    const focusedLayer = focusedLayerRef.current;
    if (!map || !focusedLayer) return;

    focusedLayer.clearLayers();
    if (!focusedSpot) return;

    const meta = HAZARD_CATEGORY_META[focusedSpot.category] || HAZARD_CATEGORY_META.Other;

    const circle = L.circle([focusedSpot.lat, focusedSpot.lng], {
      radius: 170,
      color: meta.circleStroke,
      opacity: 0.9,
      weight: 2,
      dashArray: '5 4',
      fillColor: meta.circleFill,
      fillOpacity: 0.22,
      interactive: false
    });
    circle.addTo(focusedLayer);

    const marker = L.marker([focusedSpot.lat, focusedSpot.lng], {
      icon: createHazardPinIcon(meta.pinBg, '#111827', meta.pinGlyph, true),
      title: focusedSpot.label,
      zIndexOffset: 1000
    });

    const popupRoot = document.createElement('div');
    popupRoot.className = 'p-0.5 space-y-1.5 text-xs text-gray-800 min-w-[200px] max-w-[250px]';

    const badge = document.createElement('span');
    badge.className = `inline-block px-2 py-0.5 rounded border text-[11px] font-bold ${meta.badgeClass}`;
    badge.textContent = meta.label;
    popupRoot.appendChild(badge);

    const title = document.createElement('p');
    title.className = 'font-extrabold text-gray-900 text-sm leading-snug !m-0';
    title.textContent = focusedSpot.label;
    popupRoot.appendChild(title);

    if (focusedSpot.subtitle) {
      const sub = document.createElement('p');
      sub.className = 'text-[11px] font-semibold text-gray-600 !m-0';
      sub.textContent = focusedSpot.subtitle;
      popupRoot.appendChild(sub);
    }

    if (focusedSpot.details) {
      const desc = document.createElement('p');
      desc.className = 'text-xs text-gray-700 leading-snug !m-0';
      desc.textContent = focusedSpot.details;
      popupRoot.appendChild(desc);
    }

    marker.bindPopup(popupRoot, { maxWidth: 270, closeButton: true });
    marker.on('popupclose', () => {
      setFocusedSpot(null);
    });
    marker.addTo(focusedLayer);
    marker.openPopup();
  }, [focusedSpot]);

  const activeLegendMeta = pinModeCategory ? HAZARD_CATEGORY_META[pinModeCategory] : null;

  return (
    <div className="space-y-4">
      {/* Simple Readable Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Bugo Disaster Hazard Map
          </h1>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            {pinModeCategory ? (
              <button
                type="button"
                onClick={() => setPinModeCategory(null)}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Cancel Pinning</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => startPinMode(categoryFilter !== 'All' ? categoryFilter : 'Flood')}
                className="px-4 py-2 bg-[#0c532b] hover:bg-[#094222] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Pin New Hazard</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Simple Legend Bar (Filters + One-Click Pin Legend Picker for Admin) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-extrabold text-gray-800 uppercase tracking-wide">
            {pinModeCategory ? 'Step 1: Choose Hazard Legend to Pin' : 'Hazard Legends'}
          </span>
          {statusNotice && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{statusNotice}</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {!pinModeCategory && (
            <button
              type="button"
              onClick={() => setCategoryFilter('All')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                categoryFilter === 'All'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              All ({hazardZones.length})
            </button>
          )}

          {CATEGORIES.map(cat => {
            const meta = HAZARD_CATEGORY_META[cat];
            const count = hazardZones.filter(z => z.disasterType === cat).length;
            const isActiveFilter = !pinModeCategory && categoryFilter === cat;
            const isActivePin = pinModeCategory === cat;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  if (pinModeCategory) {
                    setPinModeCategory(cat);
                  } else {
                    setCategoryFilter(cat);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-2 transition cursor-pointer ${
                  isActivePin
                    ? 'bg-emerald-50 text-gray-900 border-[#0c532b] ring-2 ring-[#0c532b]/25'
                    : isActiveFilter
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span className={`w-3 h-3 rounded-full shrink-0 ${meta.dotClass}`} />
                <span>{meta.label}</span>
                {!pinModeCategory && (
                  <span className={`text-[11px] ${isActiveFilter ? 'text-gray-300' : 'text-gray-500'}`}>
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Map + Clean Readable Locations List */}
      <div ref={mapSectionRef} className="grid grid-cols-1 lg:grid-cols-3 gap-4 scroll-mt-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs flex flex-col">
          {/* Clear Action Banner when Pinning or Moving */}
          {canManage && (pinModeCategory || movingZone) && (
            <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                {movingZone ? (
                  <>
                    <Move className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      Moving <strong>{movingZone.name}</strong> — click the new spot on the map
                    </span>
                  </>
                ) : (
                  <>
                    <span className={`w-3 h-3 rounded-full shrink-0 ${activeLegendMeta?.dotClass}`} />
                    <span>
                      Step 2: Click anywhere on the map to pin a{' '}
                      <strong>{activeLegendMeta?.label}</strong> area
                    </span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPinModeCategory(null);
                  setMovingZoneId(null);
                }}
                className="px-2.5 py-1 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-bold rounded-lg cursor-pointer shrink-0"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="w-full h-[460px] relative isolate bg-gray-100">
            {!mapReady && (
              <div className="absolute inset-0 z-10 bg-gray-50/80 flex flex-col items-center justify-center gap-2 pointer-events-none">
                <Loader2 className="w-6 h-6 text-[#0c532b] animate-spin" />
                <span className="text-xs font-semibold text-gray-600">Loading Barangay Bugo OpenStreetMap...</span>
              </div>
            )}
            <div ref={mapContainerRef} className="w-full h-full z-0" />
          </div>

          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              {canManage
                ? 'Tip: Drag any pin directly on the OpenStreetMap to adjust its position.'
                : 'For barangay planning & awareness only. For live emergencies, call 911.'}
            </span>
            <span className="font-semibold text-gray-500 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              OpenStreetMap • Barangay Bugo, CDO
            </span>
          </div>
        </div>

        {/* Simple, Readable Pinned Areas List */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col max-h-[520px]">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h2 className="text-sm font-extrabold text-gray-900">
              Pinned Areas ({visibleZones.length})
            </h2>
            {canManage && !pinModeCategory && (
              <button
                type="button"
                onClick={() => startPinMode(categoryFilter !== 'All' ? categoryFilter : 'Flood')}
                className="text-xs font-bold text-[#0c532b] hover:underline cursor-pointer"
              >
                + Add Pin
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 mt-1 pr-1">
            {visibleZones.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-10">
                No hazard pins in this category yet.
              </p>
            ) : (
              visibleZones.map(z => {
                const meta = HAZARD_CATEGORY_META[z.disasterType] || HAZARD_CATEGORY_META.Other;
                const active = selectedZoneId === z.id || movingZoneId === z.id;
                return (
                  <div
                    key={z.id}
                    onClick={() => {
                      setFocusedSpot(null);
                      setSelectedZoneId(z.id);
                      mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      mapRef.current?.flyTo([z.lat, z.lng], 16, { duration: 0.6 });
                    }}
                    className={`py-3 px-2.5 rounded-xl cursor-pointer transition space-y-1.5 ${
                      movingZoneId === z.id
                        ? 'bg-amber-50 border border-amber-200'
                        : active
                        ? 'bg-emerald-50/80'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${meta.badgeClass}`}>
                        {meta.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${RISK_LEVEL_BADGES[z.riskLevel]}`}>
                        {z.riskLevel}
                      </span>
                    </div>

                    <p className="text-sm font-bold text-gray-900 leading-snug">{z.name}</p>
                    <p className="text-xs text-gray-600">
                      {z.purok.split(' - ')[0]} • {z.radiusMeters}m area
                    </p>

                    {canManage && (
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startMoveZone(z);
                          }}
                          className="text-xs font-bold text-amber-700 hover:text-amber-900 cursor-pointer flex items-center gap-1"
                        >
                          <Move className="w-3 h-3" />
                          <span>Move</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(z);
                          }}
                          className="text-xs font-bold text-gray-700 hover:text-gray-950 cursor-pointer flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteZone(z.id);
                          }}
                          className="text-xs font-bold text-rose-600 hover:text-rose-800 cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Barangay Bugo Disaster Data: Monthly Stats, Earthquake Exposure & Fire-Prone Areas */}
      {(() => {
        const totals = BUGO_MONTHLY_DISASTER_STATS.reduce(
          (acc, m) => ({
            flood: acc.flood + m.flood,
            fire: acc.fire + m.fire,
            landslide: acc.landslide + m.landslide,
            earthquake: acc.earthquake + m.earthquake,
            typhoon: acc.typhoon + m.typhoon,
            affectedHouseholds: acc.affectedHouseholds + m.affectedHouseholds,
            evacuatedIndividuals: acc.evacuatedIndividuals + m.evacuatedIndividuals
          }),
          { flood: 0, fire: 0, landslide: 0, earthquake: 0, typhoon: 0, affectedHouseholds: 0, evacuatedIndividuals: 0 }
        );
        const totalIncidents = totals.flood + totals.fire + totals.landslide + totals.earthquake + totals.typhoon;
        const maxMonthlyIncidents = Math.max(
          ...BUGO_MONTHLY_DISASTER_STATS.map(m => m.flood + m.fire + m.landslide + m.earthquake + m.typhoon),
          1
        );

        return (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#0c532b]" />
                  <span>Disaster &amp; Hazard Summary</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Monthly incidents, flood, landslide, earthquake, fire, and other local hazards.
                </p>
              </div>

              <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-gray-100 rounded-xl text-xs font-semibold self-start md:self-auto">
                <button
                  type="button"
                  onClick={() => setDataTab('monthly')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 transition cursor-pointer ${
                    dataTab === 'monthly' ? 'bg-white text-[#0c532b] shadow-2xs font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Monthly</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDataTab('flood')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 transition cursor-pointer ${
                    dataTab === 'flood' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Waves className="w-3.5 h-3.5" />
                  <span>Flood ({hazardSummaries.flood.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDataTab('landslide')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 transition cursor-pointer ${
                    dataTab === 'landslide' ? 'bg-white text-amber-700 shadow-2xs font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Mountain className="w-3.5 h-3.5" />
                  <span>Landslide ({hazardSummaries.landslide.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDataTab('earthquake')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 transition cursor-pointer ${
                    dataTab === 'earthquake' ? 'bg-white text-purple-800 shadow-2xs font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Earthquake ({hazardSummaries.earthquake.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDataTab('fire')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 transition cursor-pointer ${
                    dataTab === 'fire' ? 'bg-white text-rose-700 shadow-2xs font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Fire Areas ({hazardSummaries.fire.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDataTab('other')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 transition cursor-pointer ${
                    dataTab === 'other' ? 'bg-white text-teal-700 shadow-2xs font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Other Hazard ({hazardSummaries.other.length})</span>
                </button>
              </div>
            </div>

            {/* Clean 4-Column Stat Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 rounded-xl border border-gray-200 bg-gray-50/50 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
              <div className="p-3.5">
                <span className="text-xs font-medium text-gray-500 block">Total Incidents</span>
                <p className="text-xl font-extrabold text-gray-900 tabular-nums mt-0.5">{totalIncidents}</p>
                <span className="text-[11px] text-gray-500">
                  {totals.flood} flood · {totals.landslide} landslide · {totals.fire} fire · {totals.earthquake} quake · {totals.typhoon} typhoon
                </span>
              </div>
              <div className="p-3.5">
                <span className="text-xs font-medium text-blue-700 block">Affected / Year</span>
                <p className="text-xl font-extrabold text-gray-900 tabular-nums mt-0.5">
                  {totals.affectedHouseholds.toLocaleString()} HH
                </p>
                <span className="text-[11px] text-gray-500">
                  {totals.evacuatedIndividuals.toLocaleString()} evacuated
                </span>
              </div>
              <div className="p-3.5">
                <span className="text-xs font-medium text-purple-700 block">Quake Exposure</span>
                <p className="text-xl font-extrabold text-gray-900 tabular-nums mt-0.5">
                  {hazardSummaries.earthquake.reduce((s, e) => s + e.exposedHouseholds, 0)} HH
                </p>
                <span className="text-[11px] text-gray-500">
                  {hazardSummaries.earthquake.length} Bugo sectors · Tagoloan Fault ~14–16 km
                </span>
              </div>
              <div className="p-3.5">
                <span className="text-xs font-medium text-rose-700 block">Fire Hotspots</span>
                <p className="text-xl font-extrabold text-gray-900 tabular-nums mt-0.5">
                  {hazardSummaries.fire.reduce((s, f) => s + f.incidentsLast3Years, 0)} fires
                </p>
                <span className="text-[11px] text-gray-500">
                  3 yrs · {disasterVictims.length} enrolled
                </span>
              </div>
            </div>

            {/* Tab 1: Monthly Disaster Data */}
            {dataTab === 'monthly' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] text-gray-500 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2.5 whitespace-nowrap">Month</th>
                      <th className="px-2.5 py-2.5 text-center text-blue-700 whitespace-nowrap">Flood</th>
                      <th className="px-2.5 py-2.5 text-center text-rose-700 whitespace-nowrap">Fire</th>
                      <th className="px-2.5 py-2.5 text-center text-amber-700 whitespace-nowrap">Landslide</th>
                      <th className="px-2.5 py-2.5 text-center text-purple-700 whitespace-nowrap">Quake</th>
                      <th className="px-2.5 py-2.5 text-center text-teal-700 whitespace-nowrap">Typhoon</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">Affected</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">Notes (2026)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 tabular-nums">
                    {BUGO_MONTHLY_DISASTER_STATS.map(row => {
                      const monthTotal = row.flood + row.fire + row.landslide + row.earthquake + row.typhoon;
                      const barPct = Math.round((monthTotal / maxMonthlyIncidents) * 100);
                      return (
                        <tr
                          key={row.month}
                          onClick={() =>
                            focusMapCoords(row.lat, row.lng, row.locationLabel, {
                              subtitle: `${row.month} 2026 · ${row.affectedHouseholds} HH`,
                              category: row.primaryHazard,
                              details: row.remarks
                            })
                          }
                          className="hover:bg-emerald-50/50 transition cursor-pointer"
                        >
                          <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <span className="w-20">{row.month}</span>
                              <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                                <div
                                  className="h-full bg-[#0c532b] rounded-full"
                                  style={{ width: `${barPct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className={`px-2.5 py-2.5 text-center font-semibold ${row.flood ? 'text-blue-700' : 'text-gray-300'}`}>
                            {row.flood || '—'}
                          </td>
                          <td className={`px-2.5 py-2.5 text-center font-semibold ${row.fire ? 'text-rose-700' : 'text-gray-300'}`}>
                            {row.fire || '—'}
                          </td>
                          <td className={`px-2.5 py-2.5 text-center font-semibold ${row.landslide ? 'text-amber-700' : 'text-gray-300'}`}>
                            {row.landslide || '—'}
                          </td>
                          <td className={`px-2.5 py-2.5 text-center font-semibold ${row.earthquake ? 'text-purple-700' : 'text-gray-300'}`}>
                            {row.earthquake || '—'}
                          </td>
                          <td className={`px-2.5 py-2.5 text-center font-semibold ${row.typhoon ? 'text-teal-700' : 'text-gray-300'}`}>
                            {row.typhoon || '—'}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="font-semibold text-gray-900">{row.affectedHouseholds} HH</span>
                            <span className="text-gray-400"> · {row.evacuatedIndividuals} evac</span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 max-w-[240px] truncate" title={row.remarks}>
                            {row.remarks}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200 font-bold text-gray-900 tabular-nums">
                    <tr>
                      <td className="px-3 py-2.5 whitespace-nowrap">2026 Total</td>
                      <td className="px-2.5 py-2.5 text-center text-blue-800">{totals.flood}</td>
                      <td className="px-2.5 py-2.5 text-center text-rose-800">{totals.fire}</td>
                      <td className="px-2.5 py-2.5 text-center text-amber-800">{totals.landslide}</td>
                      <td className="px-2.5 py-2.5 text-center text-purple-800">{totals.earthquake}</td>
                      <td className="px-2.5 py-2.5 text-center text-teal-800">{totals.typhoon}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span>{totals.affectedHouseholds} HH</span>
                        <span className="text-gray-500 font-medium"> · {totals.evacuatedIndividuals} evac</span>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] font-medium text-gray-500">Barangay Bugo BDRRMC 2026 Summary</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Tab 2: Flood-Prone Areas */}
            {dataTab === 'flood' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {hazardSummaries.flood.map(flood => (
                  <div key={flood.id} className="p-4 rounded-xl border border-gray-200 bg-white space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">{flood.areaName}</h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">{flood.purok} · Est. Depth {flood.peakDepthEst}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md border text-[11px] font-bold shrink-0 ${RISK_LEVEL_BADGES[flood.riskLevel]}`}>
                        {flood.riskLevel}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2.5 border-t border-gray-100 text-[11px]">
                      <div>
                        <span className="text-gray-400 block">Exposure</span>
                        <span className="font-semibold text-gray-900 tabular-nums">{flood.exposedHouseholds} HH</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Evac Site</span>
                        <span className="font-semibold text-gray-900">{flood.evacuationSite}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-400 block">Trigger &amp; Drainage</span>
                        <span className="text-gray-700">{flood.primaryTrigger} — {flood.drainageStatus}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          focusMapCoords(flood.lat, flood.lng, flood.areaName, {
                            subtitle: `${flood.purok} · Depth ${flood.peakDepthEst} · Evac: ${flood.evacuationSite}`,
                            category: 'Flood',
                            details: `${flood.exposedHouseholds} exposed HH · ${flood.primaryTrigger}`
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-[11px] whitespace-nowrap transition cursor-pointer"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>View on Map</span>
                      </button>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => openSummaryEditModal('flood', flood)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-lg text-[11px] whitespace-nowrap transition cursor-pointer border border-gray-200"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Info</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 3: Landslide-Prone Areas */}
            {dataTab === 'landslide' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {hazardSummaries.landslide.map(ls => (
                  <div key={ls.id} className="p-4 rounded-xl border border-gray-200 bg-white space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">{ls.sectorName}</h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">{ls.purok} · {ls.slopeGrade}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md border text-[11px] font-bold shrink-0 ${RISK_LEVEL_BADGES[ls.riskLevel]}`}>
                        {ls.riskLevel}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2.5 border-t border-gray-100 text-[11px]">
                      <div>
                        <span className="text-gray-400 block">Exposure</span>
                        <span className="font-semibold text-gray-900 tabular-nums">{ls.exposedHouseholds} HH</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Evac Site</span>
                        <span className="font-semibold text-gray-900">{ls.safeAssemblySite}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-400 block">Slope &amp; Mitigation</span>
                        <span className="text-gray-700">{ls.soilAndTrigger} — {ls.mitigationNotes}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          focusMapCoords(ls.lat, ls.lng, ls.sectorName, {
                            subtitle: `${ls.purok} · ${ls.slopeGrade} · Evac: ${ls.safeAssemblySite}`,
                            category: 'Landslide',
                            details: `${ls.exposedHouseholds} exposed HH · ${ls.mitigationNotes}`
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-[11px] whitespace-nowrap transition cursor-pointer"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>View on Map</span>
                      </button>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => openSummaryEditModal('landslide', ls)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-lg text-[11px] whitespace-nowrap transition cursor-pointer border border-gray-200"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Info</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 4: Earthquake Exposure */}
            {dataTab === 'earthquake' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {hazardSummaries.earthquake.map(eq => (
                  <div key={eq.id} className="p-4 rounded-xl border border-gray-200 bg-white space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">{eq.sectorName}</h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">{eq.purok} · {eq.peisIntensityEstimate}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md border text-[11px] font-bold shrink-0 ${RISK_LEVEL_BADGES[eq.riskLevel]}`}>
                        {eq.riskLevel}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2.5 border-t border-gray-100 text-[11px]">
                      <div>
                        <span className="text-gray-400 block">Exposure</span>
                        <span className="font-semibold text-gray-900 tabular-nums">{eq.exposedHouseholds} HH · {eq.faultProximityKm} km fault</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Evac Site</span>
                        <span className="font-semibold text-gray-900">{eq.safeAssemblySite}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-400 block">Soil &amp; Note</span>
                        <span className="text-gray-700">{eq.soilProfile} — {eq.notes}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          focusMapCoords(eq.lat, eq.lng, eq.sectorName, {
                            subtitle: `${eq.purok} · ${eq.peisIntensityEstimate} · Evac: ${eq.safeAssemblySite}`,
                            category: 'Earthquake',
                            details: `${eq.exposedHouseholds} exposed HH · ${eq.notes}`
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-lg text-[11px] whitespace-nowrap transition cursor-pointer"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>View on Map</span>
                      </button>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => openSummaryEditModal('earthquake', eq)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-lg text-[11px] whitespace-nowrap transition cursor-pointer border border-gray-200"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Info</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 5: Fire-Prone Areas */}
            {dataTab === 'fire' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {hazardSummaries.fire.map(fire => (
                  <div key={fire.id} className="p-4 rounded-xl border border-gray-200 bg-white space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">{fire.areaName}</h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">{fire.purok} · {fire.frequencyLabel}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md border text-[11px] font-bold shrink-0 tabular-nums ${RISK_LEVEL_BADGES[fire.riskLevel]}`}>
                        {fire.incidentsLast3Years} fires / 3 yrs
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2.5 border-t border-gray-100 text-[11px]">
                      <div>
                        <span className="text-gray-400 block">Structures</span>
                        <span className="font-semibold text-gray-900 tabular-nums">~{fire.affectedStructuresEst} exposed</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Access</span>
                        <span className="font-semibold text-gray-900">{fire.accessConstraint}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Main Causes</span>
                        <span className="text-gray-700">{fire.primaryCauses}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Water Supply</span>
                        <span className="text-gray-700">{fire.hydrantStatus}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          focusMapCoords(fire.lat, fire.lng, fire.areaName, {
                            subtitle: `${fire.purok} · ${fire.frequencyLabel} (${fire.incidentsLast3Years} fires / 3 yrs)`,
                            category: 'Fire',
                            details: `${fire.primaryCauses} · ${fire.hydrantStatus}`
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-[11px] whitespace-nowrap transition cursor-pointer"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>View on Map</span>
                      </button>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => openSummaryEditModal('fire', fire)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-lg text-[11px] whitespace-nowrap transition cursor-pointer border border-gray-200"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Info</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 6: Other Hazards */}
            {dataTab === 'other' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {hazardSummaries.other.map(other => (
                  <div key={other.id} className="p-4 rounded-xl border border-gray-200 bg-white space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">{other.areaName}</h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">{other.purok} · {other.hazardSubtype}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md border text-[11px] font-bold shrink-0 ${RISK_LEVEL_BADGES[other.riskLevel]}`}>
                        {other.riskLevel}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2.5 border-t border-gray-100 text-[11px]">
                      <div>
                        <span className="text-gray-400 block">Exposure</span>
                        <span className="font-semibold text-gray-900 tabular-nums">{other.exposedHouseholds} HH</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Category</span>
                        <span className="font-semibold text-gray-900">{other.hazardSubtype}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-400 block">Hazard &amp; Contingency</span>
                        <span className="text-gray-700">{other.description} — {other.contingencyAction}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          focusMapCoords(other.lat, other.lng, other.areaName, {
                            subtitle: `${other.purok} · ${other.hazardSubtype}`,
                            category: 'Other',
                            details: `${other.exposedHouseholds} exposed HH · ${other.contingencyAction}`
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg text-[11px] whitespace-nowrap transition cursor-pointer"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>View on Map</span>
                      </button>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => openSummaryEditModal('other', other)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-lg text-[11px] whitespace-nowrap transition cursor-pointer border border-gray-200"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Info</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Simple, Clean Pin Details Modal */}
      {isModalOpen && canManage && (
        <div className="fixed inset-0 z-[1000] bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-extrabold text-gray-900">
                {editingZone ? 'Edit Hazard Pin' : 'Save Hazard Pin'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveZone} className="space-y-4 text-xs">
              {/* Visual Legend Picker */}
              <div>
                <label className="block font-bold text-gray-800 mb-1.5">Hazard Legend</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(cat => {
                    const meta = HAZARD_CATEGORY_META[cat];
                    const selected = form.disasterType === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setForm({ ...form, disasterType: cat })}
                        className={`px-2.5 py-1.5 rounded-xl font-bold border flex items-center gap-1.5 transition cursor-pointer ${
                          selected
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-gray-50 text-gray-800 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${meta.dotClass}`} />
                        <span>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Auto-Located Specific Area & Zone */}
              <div className="px-3 py-2 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {isLocatingArea ? (
                    <Loader2 className="w-4 h-4 text-[#0c532b] animate-spin shrink-0" />
                  ) : (
                    <LocateFixed className="w-4 h-4 text-[#0c532b] shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-emerald-950 truncate">
                      {isLocatingArea
                        ? 'Locating specific area & zone via OpenStreetMap...'
                        : detectedLocation
                        ? `Detected: ${detectedLocation.suggestedTitle}`
                        : 'Area ready'}
                    </p>
                    {detectedLocation && !isLocatingArea && (
                      <p className="text-[10px] text-emerald-800 truncate">
                        {detectedLocation.matchedZone}
                      </p>
                    )}
                  </div>
                </div>
                {editingZone && detectedLocation && !isLocatingArea && (
                  <button
                    type="button"
                    onClick={() => {
                      nameManuallyEditedRef.current = true;
                      setForm(prev => ({
                        ...prev,
                        name: detectedLocation.suggestedTitle,
                        purok: detectedLocation.matchedZone
                      }));
                    }}
                    className="px-2.5 py-1 bg-white border border-emerald-300 hover:bg-emerald-100 text-[#0c532b] text-[11px] font-bold rounded-lg shrink-0 cursor-pointer"
                  >
                    Use Detected
                  </button>
                )}
              </div>

              {/* Place Name */}
              <div>
                <label className="block font-bold text-gray-800 mb-1">Place / Area Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => {
                    nameManuallyEditedRef.current = true;
                    setForm({ ...form, name: e.target.value });
                  }}
                  placeholder={isLocatingArea ? 'Detecting area name...' : 'e.g. Zone 2 Creek Overflow'}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0c532b]"
                />
              </div>

              {/* Risk Level + Purok */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-800 mb-1.5">Risk Level</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {RISK_LEVELS.map(level => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setForm({ ...form, riskLevel: level })}
                        className={`py-2 rounded-xl font-bold border transition cursor-pointer ${
                          form.riskLevel === level
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-800 mb-1.5">Purok / Zone</label>
                  <select
                    value={form.purok}
                    onChange={(e) => setForm({ ...form, purok: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-semibold outline-none"
                  >
                    {BUGO_PUROKS.map(p => (
                      <option key={p} value={p}>{p.split(' - ')[0]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Simple Radius Slider */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-gray-800">Affected Area Size</label>
                  <span className="font-extrabold text-[#0c532b]">{form.radiusMeters} meters</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={800}
                  step={10}
                  value={Math.min(800, Math.max(50, form.radiusMeters))}
                  onChange={(e) => setForm({ ...form, radiusMeters: Number(e.target.value) })}
                  className="w-full accent-[#0c532b] cursor-pointer"
                />
              </div>

              {/* Short Note */}
              <div>
                <label className="block font-bold text-gray-800 mb-1">Short Note (Optional)</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief warning for residents..."
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                />
              </div>

              {/* Clean Spot Footer + Move on Map option when editing */}
              {editingZone && (
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[11px] text-gray-600">
                    Spot: {form.lat.toFixed(4)}, {form.lng.toFixed(4)}
                  </span>
                  <button
                    type="button"
                    onClick={() => startMoveZone(editingZone)}
                    className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
                  >
                    <Move className="w-3.5 h-3.5" />
                    <span>Move Pin on Map</span>
                  </button>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-[#0c532b] hover:bg-[#094222] text-white font-bold rounded-xl cursor-pointer disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Pin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin-Only Edit Hazard Summary Info Modal */}
      {editingSummary && canManage && (
        <div className="fixed inset-0 z-[1000] bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-gray-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-extrabold text-gray-900">
                  Edit Hazard Area Info
                </h2>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Updates sync immediately and are visible to all residents.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSummary(null)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {summaryError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
                {summaryError}
              </div>
            )}

            <form onSubmit={handleSaveSummaryInfo} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  {editingSummary.category === 'landslide' || editingSummary.category === 'earthquake'
                    ? 'Sector / Area Name *'
                    : 'Area / Location Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={
                    editingSummary.category === 'landslide' || editingSummary.category === 'earthquake'
                      ? String(summaryForm.sectorName || '')
                      : String(summaryForm.areaName || '')
                  }
                  onChange={(e) => {
                    const key =
                      editingSummary.category === 'landslide' || editingSummary.category === 'earthquake'
                        ? 'sectorName'
                        : 'areaName';
                    setSummaryForm({ ...summaryForm, [key]: e.target.value });
                  }}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Zone / Purok</label>
                  <select
                    value={String(summaryForm.purok || BUGO_PUROKS[0])}
                    onChange={(e) => setSummaryForm({ ...summaryForm, purok: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-semibold outline-none"
                  >
                    {BUGO_PUROKS.map(p => {
                      const shortZone = p.split(' - ')[0];
                      return (
                        <option key={p} value={shortZone}>{shortZone}</option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-800 mb-1">Risk Level</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {RISK_LEVELS.map(level => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setSummaryForm({ ...summaryForm, riskLevel: level })}
                        className={`py-2 rounded-xl font-bold border transition cursor-pointer ${
                          summaryForm.riskLevel === level
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {editingSummary.category === 'flood' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-800 mb-1">Estimated Peak Depth</label>
                      <input
                        type="text"
                        required
                        value={String(summaryForm.peakDepthEst || '')}
                        onChange={(e) => setSummaryForm({ ...summaryForm, peakDepthEst: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-800 mb-1">Exposed Households</label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={Number(summaryForm.exposedHouseholds ?? 0)}
                        onChange={(e) => setSummaryForm({ ...summaryForm, exposedHouseholds: Number(e.target.value) })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">Evacuation Site</label>
                    <input
                      type="text"
                      required
                      value={String(summaryForm.evacuationSite || '')}
                      onChange={(e) => setSummaryForm({ ...summaryForm, evacuationSite: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">Primary Trigger</label>
                    <input
                      type="text"
                      required
                      value={String(summaryForm.primaryTrigger || '')}
                      onChange={(e) => setSummaryForm({ ...summaryForm, primaryTrigger: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">Drainage &amp; Monitoring Status</label>
                    <textarea
                      rows={2}
                      required
                      value={String(summaryForm.drainageStatus || '')}
                      onChange={(e) => setSummaryForm({ ...summaryForm, drainageStatus: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                    />
                  </div>
                </>
              )}

              {editingSummary.category === 'landslide' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-800 mb-1">Slope Grade</label>
                      <input
                        type="text"
                        required
                        value={String(summaryForm.slopeGrade || '')}
                        onChange={(e) => setSummaryForm({ ...summaryForm, slopeGrade: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-800 mb-1">Exposed Households</label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={Number(summaryForm.exposedHouseholds ?? 0)}
                        onChange={(e) => setSummaryForm({ ...summaryForm, exposedHouseholds: Number(e.target.value) })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">Safe Assembly / Evac Site</label>
                    <input
                      type="text"
                      required
                      value={String(summaryForm.safeAssemblySite || '')}
                      onChange={(e) => setSummaryForm({ ...summaryForm, safeAssemblySite: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">Soil &amp; Trigger Conditions</label>
                    <input
                      type="text"
                      required
                      value={String(summaryForm.soilAndTrigger || '')}
                      onChange={(e) => setSummaryForm({ ...summaryForm, soilAndTrigger: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">Mitigation Notes</label>
                    <textarea
                      rows={2}
                      required
                      value={String(summaryForm.mitigationNotes || '')}
                      onChange={(e) => setSummaryForm({ ...summaryForm, mitigationNotes: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                    />
                  </div>
                </>
              )}

              {editingSummary.category === 'earthquake' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-gray-800 mb-1">PEIS Intensity</label>
                      <input
                        type="text"
                        required
                        value={String(summaryForm.peisIntensityEstimate || '')}
                        onChange={(e) => setSummaryForm({ ...summaryForm, peisIntensityEstimate: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-800 mb-1">Exposed HH</label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={Number(summaryForm.exposedHouseholds ?? 0)}
                        onChange={(e) => setSummaryForm({ ...summaryForm, exposedHouseholds: Number(e.target.value) })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-800 mb-1">Fault Dist. (km)</label>
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        required
                        value={Number(summaryForm.faultProximityKm ?? 0)}
                        onChange={(e) => setSummaryForm({ ...summaryForm, faultProximityKm: Number(e.target.value) })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">Evac Site</label>
                    <input
                      type="text"
                      required
                      value={String(summaryForm.safeAssemblySite || '')}
                      onChange={(e) => setSummaryForm({ ...summaryForm, safeAssemblySite: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">Soil Profile</label>
                    <input
                      type="text"
                      required
                      value={String(summaryForm.soilProfile || '')}
                      onChange={(e) => setSummaryForm({ ...summaryForm, soilProfile: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">Notes</label>
                    <textarea
                      rows={2}
                      required
                      value={String(summaryForm.notes || '')}
                      onChange={(e) => setSummaryForm({ ...summaryForm, notes: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                    />
                  </div>
                </>
              )}

              {editingSummary.category === 'fire' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-gray-800 mb-1">Frequency Label</label>
                      <input
                        type="text"
                        required
                        value={String(summaryForm.frequencyLabel || '')}
                        onChange={(e) => setSummaryForm({ ...summaryForm, frequencyLabel: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-800 mb-1">Fires (3 yrs)</label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={Number(summaryForm.incidentsLast3Years ?? 0)}
                        onChange={(e) => setSummaryForm({ ...summaryForm, incidentsLast3Years: Number(e.target.value) })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-800 mb-1">Exposed Structures</label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={Number(summaryForm.affectedStructuresEst ?? 0)}
                        onChange={(e) => setSummaryForm({ ...summaryForm, affectedStructuresEst: Number(e.target.value) })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">Access Constraint</label>
                    <input
                      type="text"
                      required
                      value={String(summaryForm.accessConstraint || '')}
                      onChange={(e) => setSummaryForm({ ...summaryForm, accessConstraint: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">Main Causes</label>
                    <input
                      type="text"
                      required
                      value={String(summaryForm.primaryCauses || '')}
                      onChange={(e) => setSummaryForm({ ...summaryForm, primaryCauses: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">Water Supply / Hydrant Status</label>
                    <input
                      type="text"
                      required
                      value={String(summaryForm.hydrantStatus || '')}
                      onChange={(e) => setSummaryForm({ ...summaryForm, hydrantStatus: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                    />
                  </div>
                </>
              )}

              {editingSummary.category === 'other' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-800 mb-1">Hazard Category / Subtype</label>
                      <input
                        type="text"
                        required
                        value={String(summaryForm.hazardSubtype || '')}
                        onChange={(e) => setSummaryForm({ ...summaryForm, hazardSubtype: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-800 mb-1">Exposed Households</label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={Number(summaryForm.exposedHouseholds ?? 0)}
                        onChange={(e) => setSummaryForm({ ...summaryForm, exposedHouseholds: Number(e.target.value) })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">Hazard Description</label>
                    <textarea
                      rows={2}
                      required
                      value={String(summaryForm.description || '')}
                      onChange={(e) => setSummaryForm({ ...summaryForm, description: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">Contingency Action</label>
                    <textarea
                      rows={2}
                      required
                      value={String(summaryForm.contingencyAction || '')}
                      onChange={(e) => setSummaryForm({ ...summaryForm, contingencyAction: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0c532b]"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSummary(null)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={summarySaving}
                  className="flex-1 py-2.5 bg-[#0c532b] hover:bg-[#094222] text-white font-bold rounded-xl cursor-pointer disabled:opacity-60"
                >
                  {summarySaving ? 'Saving...' : 'Save Info'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
