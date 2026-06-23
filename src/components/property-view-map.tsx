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
      console.log(`[GIS Diagnostics] Initializing View Map at lat: ${defaultLat}, lng: ${defaultLng}`);
      mapRef.current = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: latitude && longitude ? 15 : 13,
        scrollWheelZoom: false,
      });

      // Recalculate size after render
      setTimeout(() => {
        if (mapRef.current) {
          console.log('[GIS Diagnostics] View Map size invalidated on mount');
          mapRef.current.invalidateSize();
        }
      }, 150);
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
      console.log(`[GIS Diagnostics] View Map rendering marker at coords: [${latitude}, ${longitude}]`);
      markerRef.current = L.marker([latitude, longitude]).addTo(map);
      map.setView([latitude, longitude], map.getZoom());
    }

    // Draw Polygon Boundary
    if (boundary) {
      try {
        const coords = JSON.parse(boundary);
        if (Array.isArray(coords) && coords.length > 0) {
          console.log(`[GIS Diagnostics] View Map drawing boundary polygon with ${coords.length} points`);
          polygonRef.current = L.polygon(coords, {
            color: '#0b4c8c',
            fillColor: '#10b981',
            fillOpacity: 0.15,
            weight: 3,
          }).addTo(map);
          
          // Fit map boundary
          map.fitBounds(polygonRef.current.getBounds(), { padding: [20, 20] });
        }
      } catch (err) {
        console.error('[GIS Diagnostics] View Map failed to parse boundary JSON:', err);
      }
    }

    // Invalidate size in case of layout shifts
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 200);

    return () => {
      // Cleanup happens on complete unmount
    };
  }, [latitude, longitude, boundary]);

  // Clean up on complete unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        console.log('[GIS Diagnostics] View Map component unmounting. Removing Leaflet map instance.');
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
      console.log(`[GIS Diagnostics] View Map removing base tile layer`);
      map.removeLayer(baseTileLayerRef.current);
      baseTileLayerRef.current = null;
    }
    if (overlayTileLayerRef.current) {
      console.log(`[GIS Diagnostics] View Map removing overlay tile layer`);
      map.removeLayer(overlayTileLayerRef.current);
      overlayTileLayerRef.current = null;
    }

    console.log(`[GIS Diagnostics] View Map changing tile provider to: "${mapLayer}"`);

    const setupLayerDiagnostics = (layer: L.TileLayer, name: string) => {
      layer.on('loading', () => {
        console.log(`[GIS Diagnostics] View Map Tile Layer "${name}" loading tiles...`);
      });
      layer.on('load', () => {
        console.log(`[GIS Diagnostics] View Map Tile Layer "${name}" loaded all tiles.`);
      });
      layer.on('tileerror', (e) => {
        console.error(`[GIS Diagnostics] View Map Tile Layer "${name}" failed to load tile:`, e.coords, `URL:`, (e.tile as HTMLImageElement).src);
      });
    };

    if (mapLayer === 'satellite' || mapLayer === 'hybrid') {
      baseTileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; Esri, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        }
      );
      setupLayerDiagnostics(baseTileLayerRef.current, 'Esri World Imagery');
      baseTileLayerRef.current.addTo(map);

      if (mapLayer === 'hybrid') {
        overlayTileLayerRef.current = L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          {
            attribution: '&copy; Esri, HERE, Garmin, OpenStreetMap contributors',
          }
        );
        setupLayerDiagnostics(overlayTileLayerRef.current, 'Esri Hybrid Overlays');
        overlayTileLayerRef.current.addTo(map);
      }
    } else {
      baseTileLayerRef.current = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution: '&copy; OpenStreetMap contributors',
        }
      );
      setupLayerDiagnostics(baseTileLayerRef.current, 'OpenStreetMap');
      baseTileLayerRef.current.addTo(map);
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
            className={`px-2.5 py-1 border text-[9px] uppercase tracking-wider font-bold rounded transition-colors ${
              mapLayer === layer
                ? 'border-trust-blue bg-trust-blue/10 text-trust-blue'
                : 'border-slate-200 text-slate-500 hover:text-slate-700 bg-white'
            }`}
          >
            {layer === 'standard' && '🗺 Standard'}
            {layer === 'satellite' && '🛰 Satellite'}
            {layer === 'hybrid' && '🌍 Hybrid'}
          </button>
        ))}
      </div>
      <div className="w-full h-full min-h-[300px] md:min-h-[400px] rounded-xl overflow-hidden border border-slate-200 relative">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
