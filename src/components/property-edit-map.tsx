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

interface PropertyEditMapProps {
  latitude: number | null;
  longitude: number | null;
  boundary: string | null; // Stringified JSON array of [lat, lng]
  onChangeLocation: (lat: number, lng: number) => void;
  onChangeBoundary: (boundaryStr: string | null) => void;
}

export default function PropertyEditMap({
  latitude,
  longitude,
  boundary,
  onChangeLocation,
  onChangeBoundary,
}: PropertyEditMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const pointsRef = useRef<L.CircleMarker[]>([]);

  // State to track if we are drawing
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [tempPoints, setTempPoints] = useState<[number, number][]>([]);

  useEffect(() => {
    // Parse initial boundary if any
    if (boundary && tempPoints.length === 0) {
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
    if (!mapContainerRef.current) return;

    const defaultLat = latitude || -33.8688;
    const defaultLng = longitude || 151.2093;

    // Initialize Leaflet map
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: latitude && longitude ? 14 : 10,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;

    // Click handler for map to handle pin setting or drawing
    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (isDrawingMode) {
        setTempPoints((prev) => {
          const next = [...prev, [lat, lng] as [number, number]];
          onChangeBoundary(JSON.stringify(next));
          return next;
        });
      } else {
        onChangeLocation(lat, lng);
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [latitude, longitude, isDrawingMode, onChangeLocation, onChangeBoundary]);

  // Synchronize Marker & Polygon graphics with props and state
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // 1. Draw/Update Pin Marker
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }

    if (latitude !== null && longitude !== null) {
      markerRef.current = L.marker([latitude, longitude], {
        draggable: true,
      }).addTo(map);

      // Drag handler to update parent coordinates
      markerRef.current.on('dragend', (e) => {
        const marker = e.target;
        const position = marker.getLatLng();
        onChangeLocation(position.lat, position.lng);
      });
    }

    // 2. Draw/Update Polygon Boundary and point handle circles
    if (polygonRef.current) {
      map.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }

    pointsRef.current.forEach((marker) => map.removeLayer(marker));
    pointsRef.current = [];

    if (tempPoints.length > 0) {
      // Draw polygon outline
      polygonRef.current = L.polygon(tempPoints, {
        color: '#D4AF37',
        fillColor: '#D4AF37',
        fillOpacity: 0.15,
        weight: 3,
      }).addTo(map);

      // Draw small circles on points for visualization
      tempPoints.forEach((pt) => {
        const circle = L.circleMarker(pt, {
          radius: 4,
          color: '#F5D67B',
          fillColor: '#000000',
          fillOpacity: 0.8,
          weight: 2,
        }).addTo(map);
        pointsRef.current.push(circle);
      });
    }
  }, [latitude, longitude, tempPoints, onChangeLocation]);

  // Actions
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

  return (
    <div className="space-y-4">
      {/* Map Control Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#161616] border border-white/5 rounded-xl">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold block">Map Actions:</span>
          <button
            type="button"
            onClick={() => setIsDrawingMode(!isDrawingMode)}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded border transition-colors ${
              isDrawingMode
                ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                : 'border-white/10 hover:border-white/20 text-white/70 hover:text-white'
            }`}
          >
            {isDrawingMode ? 'Drawing Boundary...' : 'Draw Boundary'}
          </button>
        </div>

        {tempPoints.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndoPoint}
              className="px-3 py-1.5 border border-white/10 hover:border-white/20 text-white/60 hover:text-white text-[10px] uppercase font-bold rounded"
            >
              Undo last point ({tempPoints.length})
            </button>
            <button
              type="button"
              onClick={handleClearBoundary}
              className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-black text-red-400 text-[10px] uppercase font-bold rounded transition-colors"
            >
              Clear Boundary
            </button>
          </div>
        )}
      </div>

      <div className="text-[10px] text-white/40 italic">
        {isDrawingMode 
          ? 'Click points on the map to define the boundary polygon.' 
          : 'Click anywhere on the map or drag the pin marker to specify property coordinates.'}
      </div>

      {/* Actual Map Container */}
      <div className="w-full h-[300px] md:h-[400px] rounded-xl overflow-hidden border border-white/10 relative z-10">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
