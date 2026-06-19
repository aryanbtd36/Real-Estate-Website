export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  address: {
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

export class LocationIntelligenceService {
  /**
   * Validates coordinates according to the business rules:
   * - Reject empty, non-numeric, or bounds violations:
   *   - Latitude: -90 to 90
   *   - Longitude: -180 to 180
   */
  static validateCoordinates(lat: any, lng: any): { valid: boolean; error?: string } {
    if (
      lat === null ||
      lat === undefined ||
      lat === '' ||
      lng === null ||
      lng === undefined ||
      lng === ''
    ) {
      return { valid: false, error: 'Latitude and Longitude cannot be empty.' };
    }
    const numLat = Number(lat);
    const numLng = Number(lng);
    if (isNaN(numLat) || isNaN(numLng)) {
      return { valid: false, error: 'Latitude and Longitude must be numeric values.' };
    }
    if (numLat < -90 || numLat > 90) {
      return { valid: false, error: 'Latitude must be between -90 and 90 degrees.' };
    }
    if (numLng < -180 || numLng > 180) {
      return { valid: false, error: 'Longitude must be between -180 and 180 degrees.' };
    }
    return { valid: true };
  }

  /**
   * Geocodes an address or query using OpenStreetMap Nominatim
   */
  static async geocodeAddress(query: string): Promise<GeocodeResult[]> {
    if (!query || !query.trim()) return [];
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'AuraEstatesLocationIntelligence/1.0',
        },
      });
      if (!res.ok) {
        throw new Error(`Nominatim Geocoding API failed with status ${res.status}`);
      }
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data.map((item: any) => ({
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        displayName: item.display_name,
        address: {
          road: item.address?.road || item.address?.pedestrian || item.address?.suburb || '',
          suburb: item.address?.suburb || item.address?.neighbourhood || '',
          city:
            item.address?.city ||
            item.address?.town ||
            item.address?.village ||
            item.address?.municipality ||
            '',
          state: item.address?.state || '',
          postcode: item.address?.postcode || '',
          country: item.address?.country || '',
        },
      }));
    } catch (err: any) {
      console.error('[LocationIntelligenceService.geocodeAddress Error]', err);
      throw err;
    }
  }

  /**
   * Reverse geocodes coordinates to address details using Nominatim
   */
  static async reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'AuraEstatesLocationIntelligence/1.0',
        },
      });
      if (!res.ok) {
        throw new Error(`Nominatim Reverse Geocoding API failed with status ${res.status}`);
      }
      const item = await res.json();
      if (!item || !item.lat) return null;
      return {
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        displayName: item.display_name,
        address: {
          road: item.address?.road || item.address?.pedestrian || item.address?.suburb || '',
          suburb: item.address?.suburb || item.address?.neighbourhood || '',
          city:
            item.address?.city ||
            item.address?.town ||
            item.address?.village ||
            item.address?.municipality ||
            '',
          state: item.address?.state || '',
          postcode: item.address?.postcode || '',
          country: item.address?.country || '',
        },
      };
    } catch (err: any) {
      console.error('[LocationIntelligenceService.reverseGeocode Error]', err);
      throw err;
    }
  }
}
