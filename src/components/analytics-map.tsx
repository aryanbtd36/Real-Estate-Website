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

interface MapPoint {
  latitude: number;
  longitude: number;
  weight: number;
  propertyName: string;
}

interface AnalyticsMapProps {
  points: MapPoint[];
  type: 'demand' | 'interest';
}

export default function AnalyticsMap({ points, type }: AnalyticsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

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

    // Default coordinates: Lucknow center
    const defaultLat = 26.8467;
    const defaultLng = 80.9462;

    // Initialize map
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: 12,
        scrollWheelZoom: false,
      });

      layersRef.current = L.layerGroup().addTo(mapRef.current);
    }

    const map = mapRef.current;
    const layerGroup = layersRef.current;

    if (layerGroup) {
      layerGroup.clearLayers();
    }

    if (points.length > 0) {
      const bounds: L.LatLngExpression[] = [];

      points.forEach((p) => {
        if (p.latitude && p.longitude) {
          bounds.push([p.latitude, p.longitude]);

          const color = type === 'demand' ? '#E53E3E' : '#D4AF37'; // Red for demand, Gold for interest
          const radius = Math.min(200, 10 + p.weight * 5); // pixel or meter radius adjustment

          const circle = L.circle([p.latitude, p.longitude], {
            color,
            fillColor: color,
            fillOpacity: 0.5,
            radius: radius * 50, // in meters
          });

          circle.bindPopup(
            `<div style="color: black; font-family: sans-serif; font-size: 12px;">
              <strong>${p.propertyName}</strong><br/>
              ${type === 'demand' ? 'Demand Heat' : 'Visitor Interest'}: ${p.weight}
            </div>`
          );

          if (layerGroup) {
            circle.addTo(layerGroup);
          }
        }
      });

      if (bounds.length > 0 && map) {
        map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
      }
    }
  }, [points, type]);

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
    <div className="w-full h-[400px] rounded-xl overflow-hidden border border-white/10 relative z-10 flex flex-col gap-2 p-1 bg-[#161616]">
      {/* Map Layer Switcher */}
      <div className="flex gap-2 justify-end px-2 pt-1">
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
      <div className="w-full h-full relative overflow-hidden rounded-lg">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
