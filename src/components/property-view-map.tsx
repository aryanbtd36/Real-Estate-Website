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

interface PropertyViewMapProps {
  latitude: number | null;
  longitude: number | null;
  boundary: string | null; // Stringified JSON array of [lat, lng]
}

export default function PropertyViewMap({ latitude, longitude, boundary }: PropertyViewMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const polygonRef = useRef<L.Polygon | null>(null);

  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayTileLayerRef = useRef<L.TileLayer | null>(null);

  const [mapLayer, setMapLayer] = useState<'standard' | 'satellite' | 'hybrid'>('standard');

  // Load saved layer choices
  useEffect(() => {
    const savedLayer = localStorage.getItem('aura_estates_map_layer');
    if (savedLayer === 'satellite' || savedLayer === 'hybrid' || savedLayer === 'standard') {
      setMapLayer(savedLayer);
    }
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const defaultLat = latitude || 26.8467;
    const defaultLng = longitude || 80.9462;

    // Initialize map
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: latitude && longitude ? 15 : 13,
        scrollWheelZoom: false,
      });
    }

    const map = mapRef.current;

    // Clear old marker
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }

    // Clear old polygon
    if (polygonRef.current) {
      map.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }

    // Draw Pin Marker
    if (latitude && longitude) {
      markerRef.current = L.marker([latitude, longitude]).addTo(map);
      map.setView([latitude, longitude], map.getZoom());
    }

    // Draw Polygon Boundary
    if (boundary) {
      try {
        const coords = JSON.parse(boundary);
        if (Array.isArray(coords) && coords.length > 0) {
          polygonRef.current = L.polygon(coords, {
            color: '#D4AF37',
            fillColor: '#D4AF37',
            fillOpacity: 0.15,
            weight: 3,
          }).addTo(map);

          // Fit map boundary
          map.fitBounds(polygonRef.current.getBounds(), { padding: [20, 20] });
        }
      } catch (err) {
        console.error('Failed to parse boundary JSON:', err);
      }
    }

    return () => {
      // Cleanup happens on complete unmount
    };
  }, [latitude, longitude, boundary]);

  // Clean up on complete unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update map tile layers
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
          attribution: '&copy; Esri, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
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

  return (
    <div className="w-full h-full relative z-10 flex flex-col gap-2">
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
            className={`px-2.5 py-1 bg-black/40 border text-[9px] uppercase tracking-wider font-bold rounded transition-colors ${
              mapLayer === layer
                ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#F5D67B]'
                : 'border-white/5 text-white/40 hover:text-white'
            }`}
          >
            {layer === 'standard' && '🗺 Standard'}
            {layer === 'satellite' && '🛰 Satellite'}
            {layer === 'hybrid' && '🌍 Hybrid'}
          </button>
        ))}
      </div>
      <div className="w-full h-full min-h-[300px] md:min-h-[400px] rounded-xl overflow-hidden border border-white/10 relative">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
