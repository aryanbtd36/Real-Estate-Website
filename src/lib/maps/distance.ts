/**
 * Calculates the geodetic distance between two points on the Earth's surface
 * using the Haversine formula.
 *
 * @param lat1 Latitude of point 1 in degrees
 * @param lon1 Longitude of point 1 in degrees
 * @param lat2 Latitude of point 2 in degrees
 * @param lon2 Longitude of point 2 in degrees
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Filters and sorts items by distance from a given latitude and longitude.
 */
export function sortByDistance<
  T extends { latitude: number | null; longitude: number | null }
>(items: T[], lat: number, lng: number): (T & { distanceKm: number })[] {
  return items
    .filter((item) => item.latitude !== null && item.longitude !== null)
    .map((item) => {
      const distanceKm = calculateDistance(
        lat,
        lng,
        item.latitude!,
        item.longitude!
      );
      return {
        ...item,
        distanceKm,
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Ranks nearby properties based on distance (closer is better) and featured status.
 * Ranks featured properties higher.
 */
export function rankNearbyProperties<
  T extends { latitude: number | null; longitude: number | null; featured?: boolean }
>(properties: T[], lat: number, lng: number): (T & { distanceKm: number; score: number })[] {
  const sorted = sortByDistance(properties, lat, lng);
  return sorted
    .map((p) => {
      // Proximity score: closer = higher score. E.g. score = 100 / (distanceKm + 1)
      const proximityScore = 100 / (p.distanceKm + 1);
      // Featured status boost
      const featuredBoost = p.featured ? 50 : 0;
      const score = proximityScore + featuredBoost;
      return {
        ...p,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);
}
