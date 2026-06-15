import { db } from '../db';
import { PropertyAnalyticsService } from './properties';

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  weight: number;
  propertyName: string;
}

export interface GeographicRanking {
  name: string;
  score: number;
  views: number;
  saves: number;
  inquiries: number;
  appointments: number;
}

export interface GeographicAnalyticsData {
  demandHeatmap: HeatmapPoint[];
  interestMap: HeatmapPoint[];
  rankings: {
    cities: GeographicRanking[];
    areas: GeographicRanking[];
    localities: GeographicRanking[];
  };
}

export const GeographicAnalyticsService = {
  /**
   * Evaluates spatial coordinates, boundaries, and aggregates locality trends.
   */
  async getGeographicAnalytics(): Promise<GeographicAnalyticsData> {
    try {
      const [properties, propertyStats] = await Promise.all([
        db.property.findMany({
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            address: true,
            location: true,
            latitude: true,
            longitude: true,
          },
        }),
        PropertyAnalyticsService.getPropertyAnalytics(),
      ]);

      const statsMap = new Map<string, typeof propertyStats.performance[0]>();
      propertyStats.performance.forEach((stat) => statsMap.set(stat.propertyId, stat));

      const demandHeatmap: HeatmapPoint[] = [];
      const interestMap: HeatmapPoint[] = [];

      // Rankings aggregates
      const cityAgg: Record<string, { score: number; views: number; saves: number; inquiries: number; appointments: number }> = {};
      const areaAgg: Record<string, { score: number; views: number; saves: number; inquiries: number; appointments: number }> = {};
      const localityAgg: Record<string, { score: number; views: number; saves: number; inquiries: number; appointments: number }> = {};

      properties.forEach((p) => {
        const stats = statsMap.get(p.id) || { views: 0, saves: 0, inquiries: 0, appointments: 0 };
        
        // Scoring formula for ranking: Views * 1 + Saves * 3 + Inquiries * 5 + Appointments * 10
        const score = stats.views * 1 + stats.saves * 3 + stats.inquiries * 5 + stats.appointments * 10;

        // Aggregate by City
        const cityKey = p.city || p.location.split(',')[1]?.trim() || 'Unknown City';
        if (!cityAgg[cityKey]) {
          cityAgg[cityKey] = { score: 0, views: 0, saves: 0, inquiries: 0, appointments: 0 };
        }
        cityAgg[cityKey].score += score;
        cityAgg[cityKey].views += stats.views;
        cityAgg[cityKey].saves += stats.saves;
        cityAgg[cityKey].inquiries += stats.inquiries;
        cityAgg[cityKey].appointments += stats.appointments;

        // Aggregate by Area (State or region)
        const areaKey = p.state || p.location.split(',')[0]?.trim() || 'Unknown Area';
        if (!areaAgg[areaKey]) {
          areaAgg[areaKey] = { score: 0, views: 0, saves: 0, inquiries: 0, appointments: 0 };
        }
        areaAgg[areaKey].score += score;
        areaAgg[areaKey].views += stats.views;
        areaAgg[areaKey].saves += stats.saves;
        areaAgg[areaKey].inquiries += stats.inquiries;
        areaAgg[areaKey].appointments += stats.appointments;

        // Aggregate by Locality (Address/neighborhood)
        const localityKey = p.address || p.name || 'Unknown Locality';
        if (!localityAgg[localityKey]) {
          localityAgg[localityKey] = { score: 0, views: 0, saves: 0, inquiries: 0, appointments: 0 };
        }
        localityAgg[localityKey].score += score;
        localityAgg[localityKey].views += stats.views;
        localityAgg[localityKey].saves += stats.saves;
        localityAgg[localityKey].inquiries += stats.inquiries;
        localityAgg[localityKey].appointments += stats.appointments;

        // Map Heatmap points if coordinates are valid
        if (p.latitude !== null && p.longitude !== null) {
          const lat = typeof p.latitude === 'string' ? parseFloat(p.latitude) : p.latitude;
          const lng = typeof p.longitude === 'string' ? parseFloat(p.longitude) : p.longitude;

          if (!isNaN(lat) && !isNaN(lng)) {
            // Demand weight: inquiries + appointments
            const demandWeight = stats.inquiries * 2 + stats.appointments * 5;
            demandHeatmap.push({
              latitude: lat,
              longitude: lng,
              weight: demandWeight || 1, // base weight of 1
              propertyName: p.name,
            });

            // Interest weight: views + saves
            const interestWeight = stats.views + stats.saves * 3;
            interestMap.push({
              latitude: lat,
              longitude: lng,
              weight: interestWeight || 1,
              propertyName: p.name,
            });
          }
        }
      });

      // Format rankings lists and sort by score desc
      const cities: GeographicRanking[] = Object.keys(cityAgg).map((name) => ({
        name,
        ...cityAgg[name],
      })).sort((a, b) => b.score - a.score);

      const areas: GeographicRanking[] = Object.keys(areaAgg).map((name) => ({
        name,
        ...areaAgg[name],
      })).sort((a, b) => b.score - a.score);

      const localities: GeographicRanking[] = Object.keys(localityAgg).map((name) => ({
        name,
        ...localityAgg[name],
      })).sort((a, b) => b.score - a.score);

      return {
        demandHeatmap,
        interestMap,
        rankings: {
          cities,
          areas,
          localities,
        },
      };
    } catch (error) {
      console.error('[GeographicAnalyticsService.getGeographicAnalytics] Error:', error);
      throw error;
    }
  },
};
