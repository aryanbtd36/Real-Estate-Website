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

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Default coordinates: NY Manhattan center
    const defaultLat = 40.7831;
    const defaultLng = -73.9712;

    // Initialize map
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: 2,
        scrollWheelZoom: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current);

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

    return () => {
      // Don't fully destroy map on simple point updates, but let's clean up on unmount
    };
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

  return (
    <div className="w-full h-[400px] rounded-xl overflow-hidden border border-white/10 relative z-10">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
