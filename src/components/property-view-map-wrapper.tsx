'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const PropertyViewMap = dynamic(() => import('./property-view-map'), { ssr: false });

interface PropertyViewMapWrapperProps {
  latitude: number | null;
  longitude: number | null;
  boundary: string | null;
}

export default function PropertyViewMapWrapper(props: PropertyViewMapWrapperProps) {
  return <PropertyViewMap {...props} />;
}
