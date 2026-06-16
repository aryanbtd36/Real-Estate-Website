'use client';

import React, { useEffect, useRef } from 'react';
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

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current);
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
      // Cleanup map on unmount
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [latitude, longitude, boundary]);

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-white/10 relative z-10">
      <div ref={mapContainerRef} className="w-full h-full min-h-[300px] md:min-h-[400px]" />
    </div>
  );
}
