'use client';

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
}

export default function PropertyEditMap({
  latitude,
  longitude,
  boundary,
  boundaryZones,
  onChangeLocation,
  onChangeBoundary,
  onChangeBoundaryZones,
}: PropertyEditMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  
  // Graphical Layer Refs
  const primaryPolygonRef = useRef<L.Polygon | null>(null);
  const primaryPointsRef = useRef<L.CircleMarker[]>([]);
  const zonesPolygonsRef = useRef<Map<number, L.Polygon>>(new Map());
  const zonesPointsRef = useRef<Map<number, L.CircleMarker[]>>(new Map());

  // Edit Modes: 'pin' | 'boundary' | 'upload' | 'measurement' | 'zones'
  const [activeTab, setActiveTab] = useState<'pin' | 'boundary' | 'upload' | 'measurement' | 'zones'>('pin');

  // State arrays for drawing
  const [tempPoints, setTempPoints] = useState<[number, number][]>([]);
  const [zones, setZones] = useState<BoundaryZone[]>([]);
  
  // Zones editor state
  const [selectedZoneIndex, setSelectedZoneIndex] = useState<number | null>(null);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneColor, setNewZoneColor] = useState('#D4AF37');

  // Paste upload state
  const [pasteData, setPasteData] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);

  // Measurement state (sq ft)
  const [sqFtArea, setSqFtArea] = useState('5000');

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

  // Map Initialization
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const defaultLat = latitude || -33.8688;
    const defaultLng = longitude || 151.2093;

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: latitude && longitude ? 14 : 10,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapRef.current);
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
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [latitude, longitude, activeTab, selectedZoneIndex, onChangeLocation, onChangeBoundary, onChangeBoundaryZones]);

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
        color: '#D4AF37',
        fillColor: '#D4AF37',
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
      <div className="flex flex-wrap gap-1 bg-[#0A0A0A] p-1.5 border border-white/5 rounded-xl">
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
                ? 'bg-[#D4AF37] text-black font-extrabold'
                : 'text-white/45 hover:text-white/80 hover:bg-white/5'
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
      <div className="p-4 bg-[#161616] border border-white/5 rounded-xl space-y-4">
        
        {activeTab === 'pin' && (
          <div className="space-y-3">
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Center Pin Mode</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[8px] uppercase tracking-wider text-white/35 block">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={latitude || ''}
                  onChange={(e) => onChangeLocation(parseFloat(e.target.value) || 0, longitude || 0)}
                  className="w-full bg-[#0A0A0A] border border-white/10 p-2.5 rounded text-white text-xs outline-none focus:border-[#D4AF37]"
                  placeholder="-33.8688"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] uppercase tracking-wider text-white/35 block">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={longitude || ''}
                  onChange={(e) => onChangeLocation(latitude || 0, parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0A0A0A] border border-white/10 p-2.5 rounded text-white text-xs outline-none focus:border-[#D4AF37]"
                  placeholder="151.2093"
                />
              </div>
            </div>
            <p className="text-[10px] text-white/40 italic">Type coordinates above or click directly on the map to drop the marker pin.</p>
          </div>
        )}

        {activeTab === 'boundary' && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Polygon Drawing Mode</p>
              <p className="text-[10px] text-white/40 italic">Click spots on the map to define the perimeter outlines ({tempPoints.length} points).</p>
            </div>
            {tempPoints.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleUndoPoint}
                  className="px-3 py-1.5 border border-white/10 hover:border-white/20 text-white/60 text-[9px] uppercase font-bold rounded"
                >
                  Undo Point
                </button>
                <button
                  type="button"
                  onClick={handleClearBoundary}
                  className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-black text-red-400 text-[9px] uppercase font-bold rounded transition-colors"
                >
                  Clear Boundary
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="space-y-3">
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Coordinate Upload Mode</p>
            <textarea
              rows={3}
              value={pasteData}
              onChange={(e) => setPasteData(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-white/10 p-2.5 rounded text-white text-xs outline-none focus:border-[#D4AF37] leading-relaxed font-mono resize-none"
              placeholder={`Paste format:\nJSON: [[lat, lng], [lat, lng], ...]\nCSV: lat,lng (per line)`}
            />
            {pasteError && (
              <p className="text-[9px] text-red-400">{pasteError}</p>
            )}
            <button
              type="button"
              onClick={handleParsePaste}
              className="px-4 py-2 bg-[#D4AF37] hover:opacity-90 text-black text-[10px] font-bold uppercase tracking-wider rounded"
            >
              Parse & Apply Perimeter
            </button>
          </div>
        )}

        {activeTab === 'measurement' && (
          <div className="space-y-3">
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Measurement-Based Auto-generate square boundary</p>
            <div className="flex gap-4">
              <div className="flex-1 space-y-1">
                <label className="text-[8px] uppercase tracking-wider text-white/35 block">Target Footprint Area (Sq Ft)</label>
                <input
                  type="number"
                  value={sqFtArea}
                  onChange={(e) => setSqFtArea(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-white/10 p-2.5 rounded text-white text-xs outline-none focus:border-[#D4AF37]"
                  placeholder="5000"
                />
              </div>
              <button
                type="button"
                onClick={handleGenerateMeasurementBoundary}
                className="self-end px-4 py-3 bg-[#D4AF37] hover:opacity-90 text-black text-[10px] font-bold uppercase tracking-wider rounded shrink-0"
              >
                Generate Square
              </button>
            </div>
            <p className="text-[10px] text-white/40 italic">Automatically generates a square boundary polygon centered around the Pin coordinates matching the specified area.</p>
          </div>
        )}

        {activeTab === 'zones' && (
          <div className="space-y-4">
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Multiple Boundary Zones Manager</p>
            
            {/* Create new zone form */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-6 space-y-1">
                <label className="text-[8px] uppercase tracking-wider text-white/35 block">New Zone Name</label>
                <input
                  type="text"
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-white/10 p-2 rounded text-white text-xs outline-none"
                  placeholder="Zone A - Master Suite Block"
                />
              </div>
              <div className="sm:col-span-3 space-y-1">
                <label className="text-[8px] uppercase tracking-wider text-white/35 block">Color</label>
                <div className="flex items-center gap-2 bg-[#0A0A0A] border border-white/10 rounded p-1">
                  <input
                    type="color"
                    value={newZoneColor}
                    onChange={(e) => setNewZoneColor(e.target.value)}
                    className="w-8 h-6 bg-transparent border-0 cursor-pointer"
                  />
                  <span className="text-[10px] text-white/50">{newZoneColor}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddZone}
                className="sm:col-span-3 py-2 bg-[#D4AF37] hover:opacity-90 text-black text-[10px] font-bold uppercase tracking-wider rounded"
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
                        ? 'border-[#D4AF37] bg-[#D4AF37]/5'
                        : 'border-white/5 bg-[#0A0A0A]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedZoneIndex(idx)}
                      className="flex-1 flex items-center gap-3 text-left"
                    >
                      <span className="w-3.5 h-3.5 rounded-full border border-white/10 shrink-0" style={{ backgroundColor: zone.color }} />
                      <span className="text-xs font-semibold text-white/90">{zone.name}</span>
                      <span className="text-[9px] text-white/40">({zone.points.length} nodes)</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleClearZonePoints(idx)}
                        className="text-[9px] uppercase font-bold text-white/40 hover:text-white"
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
            <p className="text-[10px] text-white/40 italic">Select a zone in the list, then click on the map to set the perimeter boundary nodes for that zone.</p>
          </div>
        )}

      </div>

      {/* Map Container */}
      <div className="w-full h-[300px] md:h-[400px] rounded-xl overflow-hidden border border-white/10 relative z-10">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
