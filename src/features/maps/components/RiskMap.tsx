import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  Squares2X2Icon,
  MapIcon,
  CloudIcon,
  MapPinIcon,
  PlusIcon,
  XMarkIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  getLocalAssessment,
  getLocalAssessments,
  getLocalProperties,
} from '@/shared/services/offlineStorage';
import { showErrorToast, showSuccessToast } from '@/shared/stores/toastStore';
import { track } from '@/shared/services/analytics';
import { useMapLayers } from '../hooks/useMapLayers';
import { useUserLocation } from '../hooks/useUserLocation';
import { PropertyMarker } from './PropertyMarker';
import { AnnotationMarker } from './AnnotationMarker';
import { FireHistoryLayer } from './FireHistoryLayer';
import { VegetationLayer } from './VegetationLayer';
import { SlopeLayer } from './SlopeLayer';
import { MapControls, LayerToggle } from './MapControls';
import { MapLegend } from './MapLegend';
import { UserLocationMarker } from './UserLocationMarker';
import { UserAccuracyCircle } from './UserAccuracyCircle';
import { useAnnotations } from '../hooks/useAnnotations';
import buffer from '@turf/buffer';
import { createCircleFeature } from '../utils/geo';
import type {
  AnnotationType,
  GeoCoordinates,
  MapAnnotation,
  Property,
  RiskLevel,
} from '@/shared/types';

// Set Mapbox token
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
mapboxgl.accessToken = MAPBOX_TOKEN;

// Same thresholds as Dashboard / AssessmentDetail.
function getRiskLevelFromScore(score: number): RiskLevel {
  if (score >= 8) return 'low';
  if (score >= 6) return 'moderate';
  if (score >= 4) return 'high';
  return 'extreme';
}

// Defensible-space zones, outward from the structure (feet).
const DEFENSIBLE_ZONE_SPECS = [
  { zone: 0, radiusFeet: 5 },
  { zone: 1, radiusFeet: 30 },
  { zone: 2, radiusFeet: 100 },
] as const;

// Concentric-circle zones around a point — the fallback used when no building
// footprint is available (rural properties, low zoom, or missing map data).
function circleZoneFeatures(center: GeoCoordinates): GeoJSON.Feature[] {
  return DEFENSIBLE_ZONE_SPECS.map(({ zone, radiusFeet }) =>
    createCircleFeature(center, radiusFeet * 0.3048, { zone })
  ).reverse(); // largest first, so smaller/brighter zones render on top
}

// Structure-shaped zones: buffer the building footprint outward by each zone
// distance so the rings follow the building outline instead of a circle.
function footprintZoneFeatures(footprint: GeoJSON.Feature): GeoJSON.Feature[] {
  const out: GeoJSON.Feature[] = [];
  for (const { zone, radiusFeet } of DEFENSIBLE_ZONE_SPECS) {
    const buffered = buffer(
      footprint as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
      radiusFeet,
      { units: 'feet' }
    );
    if (!buffered) return []; // degenerate geometry — signal caller to keep circles
    out.push({ ...(buffered as GeoJSON.Feature), properties: { zone } });
  }
  return out.reverse();
}

// The Mapbox building footprint rendered under a point, if any. Only returns a
// result once the building layer is painted (~zoom 15+), so callers query after
// the map settles.
function buildingFootprintAt(
  map: mapboxgl.Map,
  coords: GeoCoordinates
): GeoJSON.Feature | null {
  const p = map.project([coords.longitude, coords.latitude]);
  const pad = 12; // small pixel box, to catch a footprint the point sits just off
  let feats;
  try {
    feats = map.queryRenderedFeatures([
      [p.x - pad, p.y - pad],
      [p.x + pad, p.y + pad],
    ]);
  } catch {
    return null;
  }
  const building = feats.find(
    (f) =>
      f.sourceLayer === 'building' &&
      (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
  );
  return building
    ? { type: 'Feature', properties: {}, geometry: building.geometry }
    : null;
}

// Swatch colors for the layer toggle list.
const LAYER_COLORS: Record<string, string> = {
  'defensible-zones': '#f97316',
  'fire-history': '#ef4444',
  vegetation: '#22c55e',
  terrain: '#a16207',
};

interface PropertyMarkerData {
  property: Property;
  coordinates: GeoCoordinates;
  riskLevel?: RiskLevel;
}

interface RiskMapProps {
  initialCenter?: GeoCoordinates;
  initialZoom?: number;
  showControls?: boolean;
  interactive?: boolean;
}

export default function RiskMap({
  initialCenter,
  initialZoom = 15,
  showControls = true,
  interactive = true,
}: RiskMapProps) {
  const { assessmentId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  // Bumped on every 'style.load' so style-bound children remount and re-add
  // their sources/layers (a setStyle() wipes all custom layers).
  const [styleVersion, setStyleVersion] = useState(0);
  const [mapStyle, setMapStyle] = useState<'satellite' | 'streets' | 'terrain'>('satellite');
  const [propertyMarkers, setPropertyMarkers] = useState<PropertyMarkerData[]>([]);

  // Annotation placement (Phase 1: place an icon on the map). Annotations are
  // assessment-scoped, so placement is only offered when opened from one.
  const { annotations, addAnnotation, removeAnnotation } = useAnnotations(assessmentId);
  const [isPlacing, setIsPlacing] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<GeoCoordinates | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<MapAnnotation | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftType, setDraftType] = useState<AnnotationType>('risk-marker');
  const [draftRisk, setDraftRisk] = useState<RiskLevel>('high');

  // Property selection: pick a location by address (Mapbox geocoding) or by
  // tapping the map. The chosen point is focused (defensible-space zones drawn)
  // and pinned so the user can see what they selected.
  const [selectedLocation, setSelectedLocation] = useState<{
    coords: GeoCoordinates;
    label?: string;
  } | null>(null);
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [isPickingProperty, setIsPickingProperty] = useState(false);
  const [addressQuery, setAddressQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Last center we drew defensible-space zones around, so they can be redrawn
  // after a style switch.
  const zoneCenterRef = useRef<GeoCoordinates | null>(null);
  const initialViewRef = useRef<{ center: GeoCoordinates; zoom: number } | null>(null);
  const appliedStyleRef = useRef<string | null>(null);

  const { layers, toggleLayer } = useMapLayers();
  const fireHistory = layers.find((l) => l.id === 'fire-history');
  const vegetation = layers.find((l) => l.id === 'vegetation');
  const terrain = layers.find((l) => l.id === 'terrain');

  // Live device position (browser asks for permission on first map visit).
  const userLocation = useUserLocation();
  const autoCenteredRef = useRef(false);
  // Deep links take precedence over GPS auto-centering.
  const hasExplicitCenter =
    !!initialCenter || !!assessmentId || searchParams.has('lat') || searchParams.has('lng');

  // Count one "map opened" per mount (only when the map is actually usable).
  useEffect(() => {
    if (MAPBOX_TOKEN) void track('map_opened');
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const center = initialCenter || {
      latitude: parseFloat(searchParams.get('lat') || '34.0522'),
      longitude: parseFloat(searchParams.get('lng') || '-118.2437'),
    };
    initialViewRef.current = { center, zoom: initialZoom };

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: getMapStyle(mapStyle),
        center: [center.longitude, center.latitude],
        zoom: initialZoom,
        pitch: mapStyle === 'terrain' ? 45 : 0,
        interactive,
        preserveDrawingBuffer: true, // needed for canvas screenshots
      });

      map.current.on('error', (e) => {
        console.error('Mapbox error:', e.error);
      });

      if (import.meta.env.DEV) {
        // Test hook: lets e2e probes query layers/sources directly.
        (window as unknown as Record<string, unknown>).__riskMap = map.current;
      }

      map.current.on('load', () => {
        setMapLoaded(true);
        if (showControls) {
          map.current!.addControl(new mapboxgl.ScaleControl(), 'bottom-left');
        }
      });

      // Fires on the initial load AND after every setStyle(). Style switches
      // wipe all custom sources/layers, so (re-)create them here.
      map.current.on('style.load', () => {
        addCustomLayers();
        if (zoneCenterRef.current) {
          addDefensibleSpaceZones(zoneCenterRef.current);
        }
        setStyleVersion((v) => v + 1);
      });
    } catch (error) {
      console.error('Failed to initialize map:', error);
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update map style (skip the initial value — it was set at construction).
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const styleUrl = getMapStyle(mapStyle);
    if (appliedStyleRef.current === null) {
      appliedStyleRef.current = styleUrl;
      return;
    }
    if (appliedStyleRef.current !== styleUrl) {
      appliedStyleRef.current = styleUrl;
      map.current.setStyle(styleUrl);
    }
  }, [mapStyle, mapLoaded]);

  // Sync layer visibility with map. fire-history, vegetation and terrain
  // (slope) are owned by the <FireHistoryLayer> / <VegetationLayer> /
  // <SlopeLayer> components below; styleVersion re-applies everything after a
  // style switch rebuilds the layers.
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    layers.forEach((layer) => {
      const visibility = layer.visible ? 'visible' : 'none';

      if (layer.id === 'defensible-zones') {
        ['defensible-zone-0', 'defensible-zone-1', 'defensible-zone-2'].forEach((layerId) => {
          if (map.current?.getLayer(layerId)) {
            map.current.setLayoutProperty(layerId, 'visibility', visibility);
          }
        });
      }
    });
  }, [layers, mapLoaded, styleVersion]);

  // Load the user's properties (offline-first, straight from Dexie) and the
  // latest scored assessment per property to color its marker by risk.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const properties = await getLocalProperties(user.id);
        const markers = await Promise.all(
          properties
            .filter((p): p is Property & { coordinates: GeoCoordinates } => !!p.coordinates)
            .map(async (property) => {
              const assessments = await getLocalAssessments(property.id);
              const latestScored = assessments
                .filter((a) => a.overallScore !== undefined)
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
              return {
                property,
                coordinates: property.coordinates,
                riskLevel: latestScored
                  ? getRiskLevelFromScore(latestScored.overallScore!)
                  : undefined,
              };
            })
        );
        if (!cancelled) setPropertyMarkers(markers);
      } catch (error) {
        console.error('Failed to load properties for map:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const getMapStyle = (style: string): string => {
    switch (style) {
      case 'satellite':
        return 'mapbox://styles/mapbox/satellite-streets-v12';
      case 'terrain':
        return 'mapbox://styles/mapbox/outdoors-v12';
      default:
        return 'mapbox://styles/mapbox/streets-v12';
    }
  };

  const addCustomLayers = () => {
    if (!map.current || map.current.getSource('defensible-zones')) return;

    // Add defensible space rings source and layer
    map.current.addSource('defensible-zones', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });

    // Zone 0 (0-5 ft) - Red
    map.current.addLayer({
      id: 'defensible-zone-0',
      type: 'fill',
      source: 'defensible-zones',
      filter: ['==', ['get', 'zone'], 0],
      paint: {
        'fill-color': '#ef4444',
        'fill-opacity': 0.3,
      },
    });

    // Zone 1 (5-30 ft) - Orange
    map.current.addLayer({
      id: 'defensible-zone-1',
      type: 'fill',
      source: 'defensible-zones',
      filter: ['==', ['get', 'zone'], 1],
      paint: {
        'fill-color': '#f97316',
        'fill-opacity': 0.2,
      },
    });

    // Zone 2 (30-100 ft) - Yellow
    map.current.addLayer({
      id: 'defensible-zone-2',
      type: 'fill',
      source: 'defensible-zones',
      filter: ['==', ['get', 'zone'], 2],
      paint: {
        'fill-color': '#eab308',
        'fill-opacity': 0.15,
      },
    });
  };

  const addDefensibleSpaceZones = useCallback(
    (center: GeoCoordinates) => {
      const m = map.current;
      if (!m) return;

      const source = m.getSource('defensible-zones') as mapboxgl.GeoJSONSource;
      if (!source) return;

      zoneCenterRef.current = center;

      // Instant feedback with circles, then upgrade to the building's actual
      // shape once footprints are queryable (after any fly animation settles).
      source.setData({ type: 'FeatureCollection', features: circleZoneFeatures(center) });

      const upgradeToFootprint = () => {
        const map2 = map.current;
        // Bail if a newer selection has superseded this one.
        if (!map2 || zoneCenterRef.current !== center) return;
        const footprint = buildingFootprintAt(map2, center);
        if (!footprint) return; // no footprint here — keep the circles
        const zones = footprintZoneFeatures(footprint);
        if (zones.length !== DEFENSIBLE_ZONE_SPECS.length) return;
        const src = map2.getSource('defensible-zones') as mapboxgl.GeoJSONSource | undefined;
        src?.setData({ type: 'FeatureCollection', features: zones });
      };

      // Footprints only paint once the map is idle at a high-enough zoom.
      if (m.isMoving()) {
        m.once('idle', upgradeToFootprint);
      } else {
        upgradeToFootprint();
      }
    },
    []
  );

  const flyTo = useCallback((coords: GeoCoordinates, zoom?: number) => {
    map.current?.flyTo({
      center: [coords.longitude, coords.latitude],
      zoom: zoom || map.current.getZoom(),
      duration: 1500,
    });
  }, []);

  const focusProperty = useCallback(
    (coords: GeoCoordinates) => {
      flyTo(coords, 17);
      addDefensibleSpaceZones(coords);
    },
    [flyTo, addDefensibleSpaceZones]
  );

  // Select a property location: pin it, focus it (fly + draw defensible zones).
  const selectProperty = useCallback(
    (coords: GeoCoordinates, label?: string) => {
      setSelectedLocation({ coords, label });
      focusProperty(coords);
    },
    [focusProperty]
  );

  // Geocode the typed address via Mapbox and select the best match.
  const searchAddress = useCallback(async () => {
    const query = addressQuery.trim();
    if (!query) return;
    setIsSearching(true);
    try {
      const center = map.current?.getCenter();
      const proximity = center ? `&proximity=${center.lng},${center.lat}` : '';
      const url =
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
        `?access_token=${MAPBOX_TOKEN}&limit=1&country=us${proximity}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
      const data = (await res.json()) as {
        features?: Array<{ center: [number, number]; place_name: string }>;
      };
      const feature = data.features?.[0];
      if (!feature) {
        showErrorToast('Address not found', `No match for "${query}".`);
        return;
      }
      const [longitude, latitude] = feature.center;
      selectProperty({ latitude, longitude }, feature.place_name);
      setAddressQuery(feature.place_name);
      setShowSelectModal(false);
      showSuccessToast('Property selected', feature.place_name);
    } catch (error) {
      console.error('Address search failed:', error);
      showErrorToast('Search failed', 'Could not look up that address.');
    } finally {
      setIsSearching(false);
    }
  }, [addressQuery, selectProperty]);

  // "Pick on map" mode: the next map tap sets the property location.
  const startPickingProperty = useCallback(() => {
    setShowSelectModal(false);
    setIsPlacing(false); // don't run alongside annotation placement
    setIsPickingProperty(true);
  }, []);

  const clearSelectedProperty = useCallback(() => {
    setSelectedLocation(null);
    setAddressQuery('');
  }, []);

  // While picking, the next map click captures the property location.
  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded || !isPickingProperty) return;

    const handler = (e: mapboxgl.MapMouseEvent) => {
      selectProperty({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
      setIsPickingProperty(false);
    };
    m.on('click', handler);
    m.getCanvas().style.cursor = 'crosshair';

    return () => {
      m.off('click', handler);
      const canvas = m.getCanvas();
      if (canvas) canvas.style.cursor = '';
    };
  }, [isPickingProperty, mapLoaded, selectProperty]);

  // Center on the user's position once, on the first GPS fix — unless the map
  // was opened with an explicit target (props, URL coords, or assessment link).
  useEffect(() => {
    if (!userLocation.coords || !mapLoaded || autoCenteredRef.current) return;
    autoCenteredRef.current = true;
    if (!hasExplicitCenter) {
      flyTo(userLocation.coords, 16);
    }
  }, [userLocation.coords, mapLoaded, hasExplicitCenter, flyTo]);

  // Defensible-space zones are normally drawn around a focused property (tap a
  // marker or use Locate). If the layer is on but nothing has been focused yet,
  // draw a preview around the user's location — or the map center — so toggling
  // the layer always shows something. Guarded by zoneCenterRef so a later
  // property focus (or GPS jitter) doesn't override it. When the map is about to
  // auto-center on the first GPS fix, we wait for that fix and draw there, so
  // the rings land under the recentred view instead of at the old center.
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const ds = layers.find((l) => l.id === 'defensible-zones');
    if (!ds?.visible || zoneCenterRef.current) return;

    if (userLocation.coords) {
      addDefensibleSpaceZones(userLocation.coords);
    } else if (hasExplicitCenter || userLocation.error) {
      // Explicit center, or GPS denied/unavailable — no auto-center is coming,
      // so draw around the current map center.
      const c = map.current.getCenter();
      addDefensibleSpaceZones({ latitude: c.lat, longitude: c.lng });
    }
    // else: auto-center to GPS is pending — rerun when the fix (or error) arrives.
  }, [
    layers,
    mapLoaded,
    userLocation.coords,
    userLocation.error,
    hasExplicitCenter,
    addDefensibleSpaceZones,
  ]);

  // Deep link: /map/:assessmentId focuses that assessment's property.
  useEffect(() => {
    if (!assessmentId || !mapLoaded) return;
    let cancelled = false;

    (async () => {
      try {
        const assessment = await getLocalAssessment(assessmentId);
        if (!assessment || cancelled) return;
        const marker = propertyMarkers.find(
          (m) => m.property.id === assessment.propertyId
        );
        if (marker) focusProperty(marker.coordinates);
      } catch (error) {
        console.error('Failed to focus assessment property:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assessmentId, mapLoaded, propertyMarkers, focusProperty]);

  // Set when the user taps Locate without a fix yet, so the first position that
  // arrives flies there (rather than only silently seeding the marker).
  const pendingLocateRef = useRef(false);

  const getCurrentLocation = useCallback(() => {
    // The watcher usually has a fresh fix already — use it instantly.
    if (userLocation.coords) {
      focusProperty(userLocation.coords);
      return;
    }
    // Otherwise (re)start the watch from this tap. The user gesture is what
    // makes iOS/WebKit actually show the permission prompt — an auto-request on
    // page load is ignored there. Fly to the first fix once it arrives.
    pendingLocateRef.current = true;
    userLocation.request();
  }, [focusProperty, userLocation]);

  // Deliver a pending Locate: fly to the first fix, or toast on failure.
  useEffect(() => {
    if (!pendingLocateRef.current) return;
    if (userLocation.coords) {
      pendingLocateRef.current = false;
      focusProperty(userLocation.coords);
    } else if (userLocation.error) {
      pendingLocateRef.current = false;
      showErrorToast(
        'Location unavailable',
        'Allow location access in your browser and device settings, then try again.'
      );
    }
  }, [userLocation.coords, userLocation.error, focusProperty]);

  const handleResetView = useCallback(() => {
    const initial = initialViewRef.current;
    if (initial) flyTo(initial.center, initial.zoom);
  }, [flyTo]);

  const handleScreenshot = useCallback(() => {
    const canvas = map.current?.getCanvas();
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'wildfire-risk-map.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showSuccessToast('Screenshot saved');
  }, []);

  const handleShare = useCallback(async () => {
    if (!map.current) return;
    const center = map.current.getCenter();
    const url = `${window.location.origin}/map?lat=${center.lat.toFixed(5)}&lng=${center.lng.toFixed(5)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Wildfire Risk Map', url });
      } else {
        await navigator.clipboard.writeText(url);
        showSuccessToast('Link copied to clipboard');
      }
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') {
        showErrorToast('Could not share map link');
      }
    }
  }, []);

  // While placing, the next map click captures the drop point and opens the
  // annotation form. Crosshair cursor signals the mode.
  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded || !isPlacing) return;

    const handler = (e: mapboxgl.MapMouseEvent) => {
      setPendingCoords({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
      setIsPlacing(false);
    };
    m.on('click', handler);
    m.getCanvas().style.cursor = 'crosshair';

    return () => {
      m.off('click', handler);
      const canvas = m.getCanvas();
      if (canvas) canvas.style.cursor = '';
    };
  }, [isPlacing, mapLoaded]);

  const handleSaveAnnotation = useCallback(async () => {
    if (!pendingCoords) return;
    const title = draftTitle.trim() || 'Untitled marker';
    await addAnnotation({
      coordinates: pendingCoords,
      annotationType: draftType,
      content: {
        title,
        riskLevel: draftType === 'risk-marker' ? draftRisk : undefined,
        source: 'map',
      },
    });
    showSuccessToast('Marker placed', title);
    setPendingCoords(null);
    setDraftTitle('');
  }, [pendingCoords, draftTitle, draftType, draftRisk, addAnnotation]);

  const annotationElements = useMemo(() => {
    if (!mapLoaded) return null;
    return annotations.map((a) => (
      <AnnotationMarker
        key={a.id}
        map={map.current}
        annotation={a}
        onClick={() => setSelectedAnnotation(a)}
      />
    ));
  }, [annotations, mapLoaded]);

  // Memoized so marker elements keep their identity across unrelated
  // re-renders — PropertyMarker tears down/re-creates its mapboxgl.Marker
  // whenever its props change.
  const markerElements = useMemo(() => {
    if (!mapLoaded) return null;
    return propertyMarkers.map(({ property, coordinates, riskLevel }) => (
      <PropertyMarker
        key={property.id}
        map={map.current}
        coordinates={coordinates}
        riskLevel={riskLevel}
        label={property.address}
        onClick={() => focusProperty(coordinates)}
      />
    ));
  }, [propertyMarkers, mapLoaded, focusProperty]);

  // Show message if no Mapbox token. Placed after all hooks so hook order stays
  // constant across renders (Rules of Hooks); the map container isn't rendered
  // in this branch, so the init effect above bails on its null-container guard.
  if (!MAPBOX_TOKEN) {
    return (
      <div className="h-[calc(100vh-12rem)] min-h-[500px] rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <MapPinIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Map Not Configured
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            To use the interactive map, you need to add a Mapbox access token.
          </p>
          <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4 text-left">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              1. Get a free token at{' '}
              <a
                href="https://mapbox.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fire-600 hover:underline"
              >
                mapbox.com
              </a>
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              2. Create a <code className="bg-gray-300 dark:bg-gray-600 px-1 rounded">.env</code> file in the project root
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              3. Add: <code className="bg-gray-300 dark:bg-gray-600 px-1 rounded">VITE_MAPBOX_TOKEN=your_token</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-12rem)] min-h-[500px] rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Map container */}
      <div ref={mapContainer} className="w-full h-full" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

      {/* Map-bound children (render null; manage mapbox layers/markers) */}
      {mapLoaded && (
        <FireHistoryLayer
          key={styleVersion}
          map={map.current}
          visible={fireHistory?.visible ?? false}
          opacity={fireHistory?.opacity ?? 0.7}
        />
      )}
      {mapLoaded && (
        <VegetationLayer
          key={`veg-${styleVersion}`}
          map={map.current}
          visible={vegetation?.visible ?? false}
          opacity={vegetation?.opacity ?? 0.6}
        />
      )}
      {mapLoaded && (
        <SlopeLayer
          key={`slope-${styleVersion}`}
          map={map.current}
          visible={terrain?.visible ?? false}
          opacity={terrain?.opacity ?? 0.5}
        />
      )}
      {markerElements}
      {annotationElements}

      {/* Selected-property pin (address search / map pick) */}
      {mapLoaded && selectedLocation && (
        <PropertyMarker
          map={map.current}
          coordinates={selectedLocation.coords}
          label={selectedLocation.label || 'Selected property'}
          onClick={() => focusProperty(selectedLocation.coords)}
        />
      )}

      {/* "You are here" indicator + GPS accuracy halo */}
      {mapLoaded && userLocation.coords && (
        <>
          <UserAccuracyCircle
            key={styleVersion}
            map={map.current}
            coordinates={userLocation.coords}
            accuracy={userLocation.accuracy}
          />
          <UserLocationMarker map={map.current} coordinates={userLocation.coords} />
        </>
      )}

      {/* Map style selector */}
      {showControls && (
        <div className="absolute top-4 left-4 z-10">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-1 flex gap-1">
            <button
              onClick={() => setMapStyle('satellite')}
              className={`p-2 rounded ${
                mapStyle === 'satellite'
                  ? 'bg-fire-100 text-fire-600 dark:bg-fire-900/30'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="Satellite View"
            >
              <Squares2X2Icon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setMapStyle('streets')}
              className={`p-2 rounded ${
                mapStyle === 'streets'
                  ? 'bg-fire-100 text-fire-600 dark:bg-fire-900/30'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="Street View"
            >
              <MapIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setMapStyle('terrain')}
              className={`p-2 rounded ${
                mapStyle === 'terrain'
                  ? 'bg-fire-100 text-fire-600 dark:bg-fire-900/30'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="Terrain View"
            >
              <CloudIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Layer controls */}
      {showControls && (
        <div className="absolute top-4 right-4 z-10 w-48">
          <LayerToggle
            layers={layers.map((layer) => ({
              ...layer,
              color: LAYER_COLORS[layer.id],
            }))}
            onToggle={toggleLayer}
          />
        </div>
      )}

      {/* Enable-location prompt. iOS/WebKit only shows the geolocation prompt
          for a request tied to a user gesture, so surface an explicit tap
          target (mirrors the AR view's "Enable AR positioning" button). Hidden
          once we have a fix. */}
      {showControls && mapLoaded && !userLocation.coords && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={getCurrentLocation}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-fire-600 text-white text-sm font-medium shadow-lg hover:bg-fire-700"
          >
            <MapPinIcon className="w-4 h-4" />
            {userLocation.error ? 'Location off — enable' : 'Enable location'}
          </button>
        </div>
      )}

      {/* Map controls: zoom, reset, locate, screenshot, share */}
      {showControls && (
        <div className="absolute bottom-4 right-4 z-10">
          <MapControls
            onZoomIn={() => map.current?.zoomIn()}
            onZoomOut={() => map.current?.zoomOut()}
            onResetView={handleResetView}
            onLocate={getCurrentLocation}
            onSelectProperty={() => setShowSelectModal(true)}
            onScreenshot={handleScreenshot}
            onShare={handleShare}
          />
        </div>
      )}

      {/* Per-layer legend — a key appears only while its layer is visible */}
      <MapLegend layers={layers} />

      {/* Place-marker toggle (only when opened from an assessment) */}
      {showControls && assessmentId && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={() => {
              setIsPlacing((p) => !p);
              setPendingCoords(null);
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-sm font-medium ${
              isPlacing
                ? 'bg-fire-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {isPlacing ? (
              <>
                <XMarkIcon className="w-4 h-4" /> Tap the map to place — cancel
              </>
            ) : (
              <>
                <PlusIcon className="w-4 h-4" /> Place marker
              </>
            )}
          </button>
        </div>
      )}

      {/* New-annotation form */}
      {pendingCoords && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="card p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">New marker</h3>
            <div>
              <label className="label">Title</label>
              <input
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="input"
                placeholder="e.g. Dead tree near deck"
              />
            </div>
            <div>
              <label className="label">Type</label>
              <select
                value={draftType}
                onChange={(e) => setDraftType(e.target.value as AnnotationType)}
                className="input"
              >
                <option value="risk-marker">Risk marker</option>
                <option value="recommendation">Recommendation</option>
                <option value="photo-location">Photo location</option>
                <option value="measurement">Measurement</option>
                <option value="note">Note</option>
              </select>
            </div>
            {draftType === 'risk-marker' && (
              <div>
                <label className="label">Risk level</label>
                <select
                  value={draftRisk}
                  onChange={(e) => setDraftRisk(e.target.value as RiskLevel)}
                  className="input"
                >
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                  <option value="extreme">Extreme</option>
                </select>
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {pendingCoords.latitude.toFixed(5)}, {pendingCoords.longitude.toFixed(5)}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setPendingCoords(null)} className="btn-outline">
                Cancel
              </button>
              <button onClick={handleSaveAnnotation} className="btn-primary">
                Save marker
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected-marker detail */}
      {selectedAnnotation && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-xs px-4">
          <div className="card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {selectedAnnotation.content.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                  {selectedAnnotation.annotationType.replace('-', ' ')}
                  {selectedAnnotation.content.riskLevel
                    ? ` · ${selectedAnnotation.content.riskLevel} risk`
                    : ''}
                </p>
              </div>
              <button
                onClick={() => setSelectedAnnotation(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={async () => {
                await removeAnnotation(selectedAnnotation.id);
                setSelectedAnnotation(null);
                showSuccessToast('Marker removed');
              }}
              className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
            >
              <TrashIcon className="w-4 h-4" /> Remove marker
            </button>
          </div>
        </div>
      )}

      {/* Pick-on-map hint while selecting a property location */}
      {showControls && isPickingProperty && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={() => setIsPickingProperty(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg bg-fire-600 text-white text-sm font-medium"
          >
            <XMarkIcon className="w-4 h-4" /> Tap the map to set the property — cancel
          </button>
        </div>
      )}

      {/* Select-property modal: search by address or pick on the map */}
      {showControls && showSelectModal && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <div className="card p-6 w-full max-w-sm space-y-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Select a property
              </h3>
              <button
                onClick={() => setShowSelectModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void searchAddress();
              }}
            >
              <label className="label">Address</label>
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={addressQuery}
                  onChange={(e) => setAddressQuery(e.target.value)}
                  className="input flex-1"
                  placeholder="e.g. 1600 Amphitheatre Pkwy"
                />
                <button type="submit" className="btn-primary" disabled={isSearching}>
                  {isSearching ? '…' : 'Search'}
                </button>
              </div>
            </form>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs text-gray-400">or</span>
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            </div>

            <button onClick={startPickingProperty} className="btn-outline w-full flex items-center justify-center gap-2">
              <MapPinIcon className="w-4 h-4" /> Pick location on the map
            </button>

            {selectedLocation && (
              <button
                onClick={() => {
                  clearSelectedProperty();
                  setShowSelectModal(false);
                }}
                className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
              >
                <TrashIcon className="w-4 h-4" /> Clear selected property
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-fire-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Loading map...</span>
          </div>
        </div>
      )}
    </div>
  );
}
