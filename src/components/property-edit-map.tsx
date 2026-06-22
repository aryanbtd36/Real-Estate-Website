'use client';

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocationIntelligenceService } from '@/lib/location/geocoding';

// Fix Leaflet marker icon asset paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface BoundaryZone {
  name: string;
  color: string;
  points: [number, number][];
}

interface PropertyEditMapProps {
  latitude: number | null;
  longitude: number | null;
  boundary: string | null; // Stringified JSON array of [lat, lng]
  boundaryZones?: string | null; // Stringified JSON array of BoundaryZone
  onChangeLocation: (lat: number, lng: number) => void;
  onChangeBoundary: (boundaryStr: string | null) => void;
  onChangeBoundaryZones?: (zonesStr: string | null) => void;
  onChangeAddress?: (address: string) => void;
  onChangeCity?: (city: string) => void;
  onChangeState?: (state: string) => void;
  onChangeCountry?: (country: string) => void;
  onChangePostalCode?: (postalCode: string) => void;
}

export default function PropertyEditMap({
  latitude,
  longitude,
  boundary,
  boundaryZones,
  onChangeLocation,
  onChangeBoundary,
  onChangeBoundaryZones,
  onChangeAddress,
  onChangeCity,
  onChangeState,
  onChangeCountry,
  onChangePostalCode,
}: PropertyEditMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  
  // Graphical Layer Refs
  const primaryPolygonRef = useRef<L.Polygon | null>(null);
  const primaryPointsRef = useRef<L.CircleMarker[]>([]);
  const zonesPolygonsRef = useRef<Map<number, L.Polygon>>(new Map());
  const zonesPointsRef = useRef<Map<number, L.CircleMarker[]>>(new Map());

  // Tile layers refs for standard/satellite/hybrid
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayTileLayerRef = useRef<L.TileLayer | null>(null);

  // Edit Modes: 'pin' | 'boundary' | 'upload' | 'measurement' | 'zones'
  const [activeTab, setActiveTab] = useState<'pin' | 'boundary' | 'upload' | 'measurement' | 'zones'>('pin');

  // Map layer state: 'standard' | 'satellite' | 'hybrid'
  const [mapLayer, setMapLayer] = useState<'standard' | 'satellite' | 'hybrid'>('standard');

  // State arrays for drawing
  const [tempPoints, setTempPoints] = useState<[number, number][]>([]);
  const [zones, setZones] = useState<BoundaryZone[]>([]);
  
  // Zones editor state
  const [selectedZoneIndex, setSelectedZoneIndex] = useState<number | null>(null);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneColor, setNewZoneColor] = useState('#0B4C8C');

  // Paste upload state
  const [pasteData, setPasteData] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);

  // Measurement state (sq ft)
  const [sqFtArea, setSqFtArea] = useState('5000');

  // Location Intelligence & Search Engine state
  const [searchQueryText, setSearchQueryText] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'loading' | 'success' | 'error'; text: string } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const lastGeocodedCoords = useRef<{ lat: number; lng: number } | null>(null);

  // Load search history from localStorage
  useEffect(() => {
    const history = localStorage.getItem('aura_estates_search_history');
    if (history) {
      try {
        setSearchHistory(JSON.parse(history));
      } catch {}
    }
  }, []);

  // Autocomplete suggestions search
  useEffect(() => {
    if (!searchQueryText.trim() || searchQueryText.length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setLoadingSuggestions(true);
        const results = await LocationIntelligenceService.geocodeAddress(searchQueryText);
        setSuggestions(results);
      } catch (err) {
        console.error('Autocomplete fetch failed:', err);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQueryText]);

  // Trigger geocoding query
  const handleSearchLocation = async (queryToSearch?: string) => {
    const q = queryToSearch || searchQueryText;
    if (!q || !q.trim()) return;

    const cleanQuery = q.trim();
    setStatusMessage({ type: 'loading', text: 'Searching location...' });
    setSuggestions([]);
    setShowSuggestions(false);

    try {
      const results = await LocationIntelligenceService.geocodeAddress(cleanQuery);
      if (results && results.length > 0) {
        const result = results[0];
        const lat = result.lat;
        const lng = result.lng;

        onChangeLocation(lat, lng);
        if (mapRef.current) {
          mapRef.current.flyTo([lat, lng], 16);
        }

        const road = result.address?.road || '';
        const suburb = result.address?.suburb || '';
        const streetAddress = road ? (suburb ? `${road}, ${suburb}` : road) : suburb;

        if (onChangeAddress) onChangeAddress(streetAddress);
        if (onChangeCity) onChangeCity(result.address?.city || '');
        if (onChangeState) onChangeState(result.address?.state || '');
        if (onChangeCountry) onChangeCountry(result.address?.country || '');
        if (onChangePostalCode) onChangePostalCode(result.address?.postcode || '');

        setSearchQueryText(result.displayName);

        // Update history
        setSearchHistory((prev) => {
          const filtered = prev.filter((item) => item.toLowerCase() !== cleanQuery.toLowerCase());
          const next = [cleanQuery, ...filtered].slice(0, 10);
          localStorage.setItem('aura_estates_search_history', JSON.stringify(next));
          return next;
        });

        setStatusMessage({ type: 'success', text: 'Location found successfully' });
        setTimeout(() => setStatusMessage(null), 3000);
      } else {
        setStatusMessage({ type: 'error', text: 'No locations found. Try a more specific address.' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to search location.' });
    }
  };

  // Trigger reverse geocoding to auto-fill details on map click / marker drag
  const triggerReverseGeocode = async (lat: number, lng: number) => {
    if (lastGeocodedCoords.current && lastGeocodedCoords.current.lat === lat && lastGeocodedCoords.current.lng === lng) {
      return;
    }
    lastGeocodedCoords.current = { lat, lng };

    try {
      setStatusMessage({ type: 'loading', text: 'Fetching address...' });
      const result = await LocationIntelligenceService.reverseGeocode(lat, lng);
      if (result && result.address) {
        const road = result.address.road || '';
        const suburb = result.address.suburb || '';
        const streetAddress = road ? (suburb ? `${road}, ${suburb}` : road) : suburb;

        if (onChangeAddress) onChangeAddress(streetAddress);
        if (onChangeCity) onChangeCity(result.address.city || '');
        if (onChangeState) onChangeState(result.address.state || '');
        if (onChangeCountry) onChangeCountry(result.address.country || '');
        if (onChangePostalCode) onChangePostalCode(result.address.postcode || '');

        setStatusMessage({ type: 'success', text: 'Address synchronized' });
        setTimeout(() => setStatusMessage(null), 3000);
      } else {
        setStatusMessage({ type: 'error', text: 'No address found.' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to fetch address details.' });
    }
  };

  // Jump Map to manual Coordinates
  const handleGoToCoordinates = () => {
    setValidationError(null);
    const check = LocationIntelligenceService.validateCoordinates(latitude, longitude);
    if (!check.valid) {
      setValidationError(check.error || 'Invalid coordinates.');
      return;
    }

    if (mapRef.current && latitude !== null && longitude !== null) {
      mapRef.current.flyTo([latitude, longitude], 16);
      triggerReverseGeocode(latitude, longitude);
      setStatusMessage({ type: 'success', text: 'Coordinates updated' });
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  // Synchronize initial values from props once
  useEffect(() => {
    if (boundary) {
      try {
        const coords = JSON.parse(boundary);
        if (Array.isArray(coords)) {
          setTempPoints(coords);
        }
      } catch (e) {
        console.error('Failed to parse initial boundary', e);
      }
    }
  }, [boundary]);

  useEffect(() => {
    if (boundaryZones) {
      try {
        const parsedZones = JSON.parse(boundaryZones);
        if (Array.isArray(parsedZones)) {
          setZones(parsedZones);
        }
      } catch (e) {
        console.error('Failed to parse initial boundaryZones', e);
      }
    }
  }, [boundaryZones]);

  // Load layer/zoom/center preferences from localStorage
  useEffect(() => {
    const savedLayer = localStorage.getItem('aura_estates_map_layer');
    if (savedLayer === 'satellite' || savedLayer === 'hybrid' || savedLayer === 'standard') {
      setMapLayer(savedLayer);
    }
  }, []);

  // Map Initialization
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const savedCenter = localStorage.getItem('aura_estates_map_center');
    const savedZoom = localStorage.getItem('aura_estates_map_zoom');

    let defaultLat = latitude || 26.8467;
    let defaultLng = longitude || 80.9462;
    let defaultZoom = latitude && longitude ? 14 : 13;

    if (!latitude && !longitude) {
      if (savedCenter) {
        try {
          const parsed = JSON.parse(savedCenter);
          if (Array.isArray(parsed) && parsed.length === 2) {
            defaultLat = parsed[0];
            defaultLng = parsed[1];
          }
        } catch {}
      }
      if (savedZoom) {
        const z = parseInt(savedZoom, 10);
        if (!isNaN(z)) {
          defaultZoom = z;
        }
      }
    }

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: defaultZoom,
      });

      // Move/zoom event persistence listeners
      mapRef.current.on('zoomend', () => {
        if (mapRef.current) {
          localStorage.setItem('aura_estates_map_zoom', mapRef.current.getZoom().toString());
        }
      });

      mapRef.current.on('moveend', () => {
        if (mapRef.current) {
          const center = mapRef.current.getCenter();
          localStorage.setItem('aura_estates_map_center', JSON.stringify([center.lat, center.lng]));
        }
      });
    }

    const map = mapRef.current;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      
      if (activeTab === 'boundary') {
        setTempPoints((prev) => {
          const next = [...prev, [lat, lng] as [number, number]];
          onChangeBoundary(JSON.stringify(next));
          return next;
        });
      } else if (activeTab === 'zones' && selectedZoneIndex !== null) {
        setZones((prev) => {
          const updated = [...prev];
          const targetZone = updated[selectedZoneIndex];
          if (targetZone) {
            targetZone.points = [...targetZone.points, [lat, lng] as [number, number]];
            if (onChangeBoundaryZones) {
              onChangeBoundaryZones(JSON.stringify(updated));
            }
          }
          return updated;
        });
      } else if (activeTab === 'pin') {
        onChangeLocation(lat, lng);
        triggerReverseGeocode(lat, lng);
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [latitude, longitude, activeTab, selectedZoneIndex, onChangeLocation, onChangeBoundary, onChangeBoundaryZones]);

  // Map Tiles Synchronizer Effect
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
      baseTileLayerRef.current = null;
    }
    if (overlayTileLayerRef.current) {
      map.removeLayer(overlayTileLayerRef.current);
      overlayTileLayerRef.current = null;
    }

    if (mapLayer === 'satellite' || mapLayer === 'hybrid') {
      baseTileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        }
      ).addTo(map);

      if (mapLayer === 'hybrid') {
        overlayTileLayerRef.current = L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          {
            attribution: '&copy; Esri, HERE, Garmin, OpenStreetMap contributors',
          }
        ).addTo(map);
      }
    } else {
      baseTileLayerRef.current = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution: '&copy; OpenStreetMap contributors',
        }
      ).addTo(map);
    }
  }, [mapLayer]);


  // Render Pin, Primary Boundary, and Secondary Zones
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // 1. Synchronize Pin Marker
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }

    if (latitude !== null && longitude !== null) {
      markerRef.current = L.marker([latitude, longitude], {
        draggable: true,
      }).addTo(map);

      markerRef.current.on('dragend', (e) => {
        const marker = e.target;
        const position = marker.getLatLng();
        onChangeLocation(position.lat, position.lng);
        triggerReverseGeocode(position.lat, position.lng);
      });
    }

    // 2. Synchronize Primary Boundary
    if (primaryPolygonRef.current) {
      map.removeLayer(primaryPolygonRef.current);
      primaryPolygonRef.current = null;
    }
    primaryPointsRef.current.forEach((circ) => map.removeLayer(circ));
    primaryPointsRef.current = [];

    if (tempPoints.length > 0) {
      primaryPolygonRef.current = L.polygon(tempPoints, {
        color: '#0B4C8C',
        fillColor: '#0B4C8C',
        fillOpacity: 0.15,
        weight: 3,
      }).addTo(map);

      tempPoints.forEach((pt) => {
        const circle = L.circleMarker(pt, {
          radius: 4,
          color: '#F5D67B',
          fillColor: '#000000',
          fillOpacity: 0.8,
          weight: 2,
        }).addTo(map);
        primaryPointsRef.current.push(circle);
      });
    }

    // 3. Synchronize Multiple Zones
    // Remove old layers
    zonesPolygonsRef.current.forEach((polygon) => map.removeLayer(polygon));
    zonesPolygonsRef.current.clear();

    zonesPointsRef.current.forEach((circles) => {
      circles.forEach((circ) => map.removeLayer(circ));
    });
    zonesPointsRef.current.clear();

    // Redraw zones
    zones.forEach((zone, idx) => {
      if (zone.points.length > 0) {
        const polygon = L.polygon(zone.points, {
          color: zone.color,
          fillColor: zone.color,
          fillOpacity: 0.1,
          weight: 2,
        }).addTo(map);
        polygon.bindTooltip(zone.name, { permanent: false, direction: 'center' });
        zonesPolygonsRef.current.set(idx, polygon);

        const circles: L.CircleMarker[] = [];
        zone.points.forEach((pt) => {
          const circle = L.circleMarker(pt, {
            radius: 3.5,
            color: zone.color,
            fillColor: '#000000',
            fillOpacity: 0.9,
            weight: 1.5,
          }).addTo(map);
          circles.push(circle);
        });
        zonesPointsRef.current.set(idx, circles);
      }
    });

  }, [latitude, longitude, tempPoints, zones]);

  // Actions: Main Boundary Undo & Clear
  const handleClearBoundary = () => {
    setTempPoints([]);
    onChangeBoundary(null);
  };

  const handleUndoPoint = () => {
    setTempPoints((prev) => {
      const next = prev.slice(0, -1);
      onChangeBoundary(next.length > 0 ? JSON.stringify(next) : null);
      return next;
    });
  };

  // Action: Paste Coordinates Parse
  const handleParsePaste = () => {
    setPasteError(null);
    try {
      const cleanData = pasteData.trim();
      if (!cleanData) return;

      let parsed: [number, number][] = [];

      // Check if JSON format
      if (cleanData.startsWith('[')) {
        const arr = JSON.parse(cleanData);
        if (Array.isArray(arr)) {
          parsed = arr.map((item: any) => {
            if (Array.isArray(item) && item.length >= 2) {
              return [parseFloat(item[0]), parseFloat(item[1])] as [number, number];
            }
            throw new Error('JSON array item must be [lat, lng] format');
          });
        }
      } else {
        // Assume CSV format
        const lines = cleanData.split('\n');
        parsed = lines.map((line) => {
          const parts = line.split(',');
          if (parts.length >= 2) {
            const lat = parseFloat(parts[0].trim());
            const lng = parseFloat(parts[1].trim());
            if (!isNaN(lat) && !isNaN(lng)) {
              return [lat, lng] as [number, number];
            }
          }
          throw new Error('CSV line must contain lat,lng numbers');
        });
      }

      if (parsed.length > 0) {
        setTempPoints(parsed);
        onChangeBoundary(JSON.stringify(parsed));
        
        // Pan map to first coordinate
        if (mapRef.current && parsed[0]) {
          mapRef.current.setView(parsed[0], 15);
        }
      }
    } catch (err: any) {
      setPasteError(err.message || 'Failed to parse coordinates format.');
    }
  };

  // Action: Measurement-based Auto-generate square boundary centered on pin
  const handleGenerateMeasurementBoundary = () => {
    if (latitude === null || longitude === null) {
      alert('Please click on the map to set a Pin center coordinate first.');
      return;
    }

    const area = parseFloat(sqFtArea);
    if (isNaN(area) || area <= 0) {
      alert('Please specify a valid numeric area in sq ft.');
      return;
    }

    // Convert sq ft to sq meters: 1 sq ft = 0.09290304 sq meters
    const areaSqMeters = area * 0.09290304;
    const sideMeters = Math.sqrt(areaSqMeters);
    const halfSide = sideMeters / 2;

    // Earth's radius in meters
    const rEarth = 6378137;

    // Latitudinal offset in degrees
    const dLat = (halfSide / rEarth) * (180 / Math.PI);
    // Longitudinal offset in degrees (accounting for latitude shrinkage)
    const dLng = dLat / Math.cos(latitude * Math.PI / 180);

    // Calculate 4 corners of the square centered at (latitude, longitude)
    const corners: [number, number][] = [
      [latitude - dLat, longitude - dLng],
      [latitude - dLat, longitude + dLng],
      [latitude + dLat, longitude + dLng],
      [latitude + dLat, longitude - dLng]
    ];

    setTempPoints(corners);
    onChangeBoundary(JSON.stringify(corners));
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Unable to determine current location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        onChangeLocation(lat, lng);
        
        // Persist last coordinates choice
        localStorage.setItem('aura_estates_map_last_coords', JSON.stringify([lat, lng]));

        if (mapRef.current) {
          mapRef.current.setView([lat, lng], 15);
        }

        // Post activity logging
        fetch('/api/admin/audit-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'MAP_CURRENT_LOCATION_USED',
            description: `Map coordinate pin updated to user GPS location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            details: { latitude: lat, longitude: lng }
          })
        }).catch(err => console.error('Failed to log geolocation activity', err));
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          alert("Location permission denied.");
        } else if (error.code === error.TIMEOUT) {
          alert("Location request timed out.");
        } else {
          alert("Unable to determine current location.");
        }
      },
      { timeout: 10000 }
    );
  };


  // Actions: Secondary Zones CRUD
  const handleAddZone = () => {
    if (!newZoneName.trim()) return;
    const nextZone: BoundaryZone = {
      name: newZoneName,
      color: newZoneColor,
      points: []
    };
    setZones((prev) => {
      const next = [...prev, nextZone];
      if (onChangeBoundaryZones) {
        onChangeBoundaryZones(JSON.stringify(next));
      }
      setSelectedZoneIndex(next.length - 1);
      return next;
    });
    setNewZoneName('');
  };

  const handleDeleteZone = (idx: number) => {
    setZones((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (onChangeBoundaryZones) {
        onChangeBoundaryZones(next.length > 0 ? JSON.stringify(next) : null);
      }
      setSelectedZoneIndex(null);
      return next;
    });
  };

  const handleClearZonePoints = (idx: number) => {
    setZones((prev) => {
      const next = [...prev];
      if (next[idx]) {
        next[idx].points = [];
      }
      if (onChangeBoundaryZones) {
        onChangeBoundaryZones(JSON.stringify(next));
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Mode Control Tabs */}
      <div className="flex flex-wrap gap-1 bg-white p-1.5 border border-slate-200/80 rounded-xl">
        {(['pin', 'boundary', 'upload', 'measurement', 'zones'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setActiveTab(tab);
              setPasteError(null);
            }}
            className={`flex-1 min-w-[70px] py-2 text-[9px] uppercase tracking-wider font-bold rounded transition-colors ${
              activeTab === tab
                ? 'bg-[#0B4C8C] text-white font-extrabold'
                : 'text-white/45 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab === 'pin' && '1. Pin Center'}
            {tab === 'boundary' && '2. Draw Boundary'}
            {tab === 'upload' && 'Import Coordinates'}
            {tab === 'measurement' && 'Auto-Boundary'}
            {tab === 'zones' && 'Sub-Zones'}
          </button>
        ))}
      </div>

      {/* Tab Context Inputs */}
      <div className="p-4 bg-white border border-slate-200/80 rounded-xl space-y-4">
        
        {activeTab === 'pin' && (
          <div className="space-y-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Center Pin Mode</p>

            {/* Geocoding Search Panel */}
            <div className="space-y-2 relative">
              <label className="text-[8px] uppercase tracking-wider text-slate-800/35 block">🔍 Search Location</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQueryText}
                  onChange={(e) => {
                    setSearchQueryText(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 250)}
                  className="flex-1 bg-white border border-slate-200 p-2.5 rounded text-slate-800 text-xs outline-none focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20"
                  placeholder="Taj Mahal, Agra or Beverly Hills, CA"
                />
                <button
                  type="button"
                  onClick={() => handleSearchLocation()}
                  className="px-4 py-2 bg-[#0B4C8C] hover:opacity-90 text-white text-xs font-bold uppercase rounded tracking-wider"
                >
                  Search
                </button>
              </div>

              {/* Status Message Banners */}
              {statusMessage && (
                <div className={`p-2 rounded text-[10px] uppercase font-bold flex items-center gap-2 border ${
                  statusMessage.type === 'loading'
                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 animate-pulse'
                    : statusMessage.type === 'success'
                    ? 'bg-green-500/10 border-green-500/20 text-green-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  {statusMessage.type === 'loading' && <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping inline-block" />}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* Suggestions autocomplete dropdown */}
              {showSuggestions && (suggestions.length > 0 || loadingSuggestions) && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-2xl z-50 max-h-[200px] overflow-y-auto divide-y divide-white/5">
                  {loadingSuggestions && (
                    <div className="p-3 text-[10px] text-slate-500 uppercase tracking-wider text-center">Searching suggestions...</div>
                  )}
                  {!loadingSuggestions && suggestions.map((item: any, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent onBlur from hiding suggestions before click completes
                        onChangeLocation(item.lat, item.lng);
                        if (mapRef.current) {
                          mapRef.current.flyTo([item.lat, item.lng], 16);
                        }

                        const road = item.address?.road || '';
                        const suburb = item.address?.suburb || '';
                        const streetAddress = road ? (suburb ? `${road}, ${suburb}` : road) : suburb;

                        if (onChangeAddress) onChangeAddress(streetAddress);
                        if (onChangeCity) onChangeCity(item.address?.city || '');
                        if (onChangeState) onChangeState(item.address?.state || '');
                        if (onChangeCountry) onChangeCountry(item.address?.country || '');
                        if (onChangePostalCode) onChangePostalCode(item.address?.postcode || '');

                        setSearchQueryText(item.displayName);
                        setSuggestions([]);
                        setShowSuggestions(false);

                        // Save search to history
                        setSearchHistory((prev) => {
                          const filtered = prev.filter((h) => h.toLowerCase() !== item.displayName.toLowerCase());
                          const next = [item.displayName, ...filtered].slice(0, 10);
                          localStorage.setItem('aura_estates_search_history', JSON.stringify(next));
                          return next;
                        });

                        setStatusMessage({ type: 'success', text: 'Location found successfully' });
                        setTimeout(() => setStatusMessage(null), 3000);
                      }}
                      className="w-full text-left p-3 hover:bg-slate-50 text-slate-700 hover:text-slate-800 text-xs truncate block"
                    >
                      {item.displayName || (item.lat + ', ' + item.lng)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search History Panel */}
            {searchHistory.length > 0 && (
              <div className="space-y-1">
                <label className="text-[8px] uppercase tracking-wider text-slate-800/35 block">Recent Searches</label>
                <div className="flex flex-wrap gap-1">
                  {searchHistory.map((historyQuery, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSearchQueryText(historyQuery);
                        handleSearchLocation(historyQuery);
                      }}
                      className="px-2 py-1 bg-slate-50 hover:bg-slate-50 border border-slate-200/80 rounded text-[10px] text-slate-650 hover:text-slate-800 transition-colors"
                    >
                      {historyQuery.length > 25 ? `${historyQuery.slice(0, 25)}...` : historyQuery}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[8px] uppercase tracking-wider text-slate-800/35 block">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={latitude || ''}
                  onChange={(e) => onChangeLocation(parseFloat(e.target.value) || 0, longitude || 0)}
                  className="w-full bg-white border border-slate-200 p-2.5 rounded text-slate-800 text-xs outline-none focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20"
                  placeholder="26.8467"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] uppercase tracking-wider text-slate-800/35 block">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={longitude || ''}
                  onChange={(e) => onChangeLocation(latitude || 0, parseFloat(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-200 p-2.5 rounded text-slate-800 text-xs outline-none focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20"
                  placeholder="80.9462"
                />
              </div>
            </div>

            {/* Coordinate Validation Error */}
            {validationError && (
              <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider">{validationError}</p>
            )}

            {/* Go To Coordinates Button */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleGoToCoordinates}
                className="w-full py-2 bg-[#0B4C8C]/80 hover:bg-[#0B4C8C] text-white rounded text-xs flex items-center justify-center gap-1.5 font-bold uppercase tracking-wider transition-colors"
              >
                <span>📍 GO TO COORDINATES</span>
              </button>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="w-full py-2 bg-slate-50 hover:bg-slate-50 border border-slate-200 text-slate-800 rounded text-xs flex items-center justify-center gap-1.5 font-bold uppercase tracking-wider transition-colors"
              >
                <span>📍 Use My Current Location</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-500 italic">Type coordinates and click "Go to Coordinates", use address search, or click directly on the map.</p>
          </div>
        )}

        {activeTab === 'boundary' && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Polygon Drawing Mode</p>
              <p className="text-[10px] text-slate-500 italic">Click spots on the map to define the perimeter outlines ({tempPoints.length} points).</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-50 border border-slate-200 text-slate-800 text-[9px] uppercase font-bold rounded flex items-center gap-1 transition-colors"
              >
                <span>📍 Use Current Location as Property Center</span>
              </button>
              {tempPoints.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleUndoPoint}
                    className="px-3 py-1.5 border border-slate-200 hover:border-slate-300 text-slate-650 text-[9px] uppercase font-bold rounded"
                  >
                    Undo Point
                  </button>
                  <button
                    type="button"
                    onClick={handleClearBoundary}
                    className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-slate-800 text-red-400 text-[9px] uppercase font-bold rounded transition-colors"
                  >
                    Clear Boundary
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="space-y-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Coordinate Upload Mode</p>
            <textarea
              rows={3}
              value={pasteData}
              onChange={(e) => setPasteData(e.target.value)}
              className="w-full bg-white border border-slate-200 p-2.5 rounded text-slate-800 text-xs outline-none focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 leading-relaxed font-mono resize-none"
              placeholder={`Paste format:\nJSON: [[lat, lng], [lat, lng], ...]\nCSV: lat,lng (per line)`}
            />
            {pasteError && (
              <p className="text-[9px] text-red-400">{pasteError}</p>
            )}
            <button
              type="button"
              onClick={handleParsePaste}
              className="px-4 py-2 bg-[#0B4C8C] hover:opacity-90 text-white text-[10px] font-bold uppercase tracking-wider rounded"
            >
              Parse & Apply Perimeter
            </button>
          </div>
        )}

        {activeTab === 'measurement' && (
          <div className="space-y-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Measurement-Based Auto-generate square boundary</p>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px] space-y-1">
                <label className="text-[8px] uppercase tracking-wider text-slate-800/35 block">Target Footprint Area (Sq Ft)</label>
                <input
                  type="number"
                  value={sqFtArea}
                  onChange={(e) => setSqFtArea(e.target.value)}
                  className="w-full bg-white border border-slate-200 p-2.5 rounded text-slate-800 text-xs outline-none focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20"
                  placeholder="5000"
                />
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  className="px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider rounded flex items-center gap-1 transition-colors"
                >
                  <span>📍 Use Current Location as Property Center</span>
                </button>
                <button
                  type="button"
                  onClick={handleGenerateMeasurementBoundary}
                  className="px-4 py-3 bg-[#0B4C8C] hover:opacity-90 text-white text-[10px] font-bold uppercase tracking-wider rounded"
                >
                  Generate Square
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 italic">Automatically generates a square boundary polygon centered around the Pin coordinates matching the specified area.</p>
          </div>
        )}

        {activeTab === 'zones' && (
          <div className="space-y-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Multiple Boundary Zones Manager</p>
            
            {/* Create new zone form */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-6 space-y-1">
                <label className="text-[8px] uppercase tracking-wider text-slate-800/35 block">New Zone Name</label>
                <input
                  type="text"
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  className="w-full bg-white border border-slate-200 p-2 rounded text-slate-800 text-xs outline-none"
                  placeholder="Zone A - Master Suite Block"
                />
              </div>
              <div className="sm:col-span-3 space-y-1">
                <label className="text-[8px] uppercase tracking-wider text-slate-800/35 block">Color</label>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded p-1">
                  <input
                    type="color"
                    value={newZoneColor}
                    onChange={(e) => setNewZoneColor(e.target.value)}
                    className="w-8 h-6 bg-transparent border-0 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-650">{newZoneColor}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddZone}
                className="sm:col-span-3 py-2 bg-[#0B4C8C] hover:opacity-90 text-white text-[10px] font-bold uppercase tracking-wider rounded"
              >
                Create Zone
              </button>
            </div>

            {/* List of current zones */}
            {zones.length > 0 && (
              <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                {zones.map((zone, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-2 rounded border transition-colors ${
                      selectedZoneIndex === idx
                        ? 'border-[#0B4C8C] bg-blue-50/30'
                        : 'border-slate-200/80 bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedZoneIndex(idx)}
                      className="flex-1 flex items-center gap-3 text-left"
                    >
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-200 shrink-0" style={{ backgroundColor: zone.color }} />
                      <span className="text-xs font-semibold text-slate-800/90">{zone.name}</span>
                      <span className="text-[9px] text-slate-500">({zone.points.length} nodes)</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleClearZonePoints(idx)}
                        className="text-[9px] uppercase font-bold text-slate-500 hover:text-slate-800"
                      >
                        Reset points
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteZone(idx)}
                        className="text-[9px] uppercase font-bold text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-slate-500 italic">Select a zone in the list, then click on the map to set the perimeter boundary nodes for that zone.</p>
          </div>
        )}

      </div>

      {/* Map Layer Switcher */}
      <div className="flex gap-2 justify-end">
        {(['standard', 'satellite', 'hybrid'] as const).map((layer) => (
          <button
            key={layer}
            type="button"
            onClick={() => {
              setMapLayer(layer);
              localStorage.setItem('aura_estates_map_layer', layer);
            }}
            className={`px-2.5 py-1 bg-slate-50/40 border text-[9px] uppercase tracking-wider font-bold rounded transition-colors ${
              mapLayer === layer
                ? 'border-[#0B4C8C] bg-blue-50 text-[#0B4C8C]'
                : 'border-slate-200/80 text-slate-500 hover:text-slate-800'
            }`}
          >
            {layer === 'standard' && '🗺 Standard'}
            {layer === 'satellite' && '🛰 Satellite'}
            {layer === 'hybrid' && '🌍 Hybrid'}
          </button>
        ))}
      </div>

      {/* Map Container */}
      <div className="w-full h-[300px] md:h-[400px] rounded-xl overflow-hidden border border-slate-200 relative z-10">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
