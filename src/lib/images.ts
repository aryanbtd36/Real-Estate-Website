import React from 'react';

/**
 * Validates whether a given URL is a valid Cloudinary media link.
 */
export const isValidCloudinaryUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  return url.startsWith('http') && url.includes('res.cloudinary.com');
};

/**
 * Handles image rendering failure by swapping the source with a premium category fallback.
 */
export const handleImageError = (
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  type?: string | null
) => {
  const target = e.currentTarget;
  const pType = (type || '').toLowerCase();
  
  let fallback = 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&auto=format&fit=crop&q=60'; // Default luxury house
  
  if (pType.includes('plot') || pType.includes('land') || pType.includes('lot')) {
    fallback = 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop&q=60';
  } else if (pType.includes('residency') || pType.includes('villa') || pType.includes('house') || pType.includes('duplex')) {
    fallback = 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&auto=format&fit=crop&q=60';
  } else if (pType.includes('apartment') || pType.includes('flat') || pType.includes('condo') || pType.includes('society')) {
    fallback = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=60';
  }

  if (target.src !== fallback) {
    target.src = fallback;
  }
};
