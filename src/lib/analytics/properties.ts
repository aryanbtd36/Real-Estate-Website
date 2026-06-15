import { db } from '../db';

export interface PropertyPerformanceMetric {
  propertyId: string;
  propertyName: string;
  views: number;
  saves: number;
  inquiries: number;
  appointments: number;
  wonDeals: number;
}

export interface FunnelStageMetric {
  stage: string;
  count: number;
  conversionRate: number; // overall
  stageConversionRate: number; // stage-to-stage
  dropOffRate: number;
}

export interface PropertyAnalyticsData {
  performance: PropertyPerformanceMetric[];
  topPerforming: {
    mostViewed: PropertyPerformanceMetric[];
    mostSaved: PropertyPerformanceMetric[];
    mostInquired: PropertyPerformanceMetric[];
    mostScheduled: PropertyPerformanceMetric[];
  };
  conversionFunnel: FunnelStageMetric[];
}

export const PropertyAnalyticsService = {
  /**
   * Generates property performance metrics, rankings, and funnel details.
   */
  async getPropertyAnalytics(): Promise<PropertyAnalyticsData> {
    try {
      const [properties, views, saves, appointments, leads] = await Promise.all([
        db.property.findMany({
          select: { id: true, name: true, price: true },
        }),
        db.propertyView.findMany({
          select: { propertyId: true, userId: true },
        }),
        db.savedProperty.findMany({
          select: { propertyId: true, userId: true },
        }),
        db.appointment.findMany({
          select: { id: true, propertyId: true, userId: true, email: true, status: true },
        }),
        db.lead.findMany({
          select: { id: true, email: true, message: true, status: true },
        }),
      ]);

      // Resolve user ID to email maps to intersect user interactions with lead inquiries
      const users = await db.user.findMany({
        select: { id: true, email: true },
      });
      const userEmailMap = new Map<string, string>();
      users.forEach((u) => userEmailMap.set(u.id, u.email.toLowerCase()));

      // Maps to track metrics per property
      const viewsMap = new Map<string, number>();
      const savesMap = new Map<string, number>();
      const inquiriesMap = new Map<string, number>();
      const appointmentsMap = new Map<string, number>();
      const wonDealsMap = new Map<string, number>();

      properties.forEach((p) => {
        viewsMap.set(p.id, 0);
        savesMap.set(p.id, 0);
        inquiriesMap.set(p.id, 0);
        appointmentsMap.set(p.id, 0);
        wonDealsMap.set(p.id, 0);
      });

      // 1. Map Views
      views.forEach((v) => {
        viewsMap.set(v.propertyId, (viewsMap.get(v.propertyId) || 0) + 1);
      });

      // 2. Map Saves
      saves.forEach((s) => {
        savesMap.set(s.propertyId, (savesMap.get(s.propertyId) || 0) + 1);
      });

      // 3. Map Appointments
      appointments.forEach((a) => {
        appointmentsMap.set(a.propertyId, (appointmentsMap.get(a.propertyId) || 0) + 1);
        if (a.status === 'COMPLETED') {
          // Check if lead with matching email is WON or if status is completed
          wonDealsMap.set(a.propertyId, (wonDealsMap.get(a.propertyId) || 0) + 1);
        }
      });

      // 4. Heuristic Inquiry Mapping: Map Lead to Property
      leads.forEach((l) => {
        const leadEmail = l.email.toLowerCase();
        const msg = l.message.toLowerCase();

        properties.forEach((p) => {
          const name = p.name.toLowerCase();
          
          // Heuristic A: Message text matching
          let isMatch = msg.includes(name);

          // Heuristic B: Significant keywords matching (avoid generic words)
          if (!isMatch) {
            const words = name.split(/\s+/).filter(w => w.length > 3 && w !== 'the' && w !== 'tower' && w !== 'villa' && w !== 'penthouse' && w !== 'duplex');
            if (words.length > 0 && words.every(w => msg.includes(w))) {
              isMatch = true;
            }
          }

          // Heuristic C: User session linkage (user with lead's email viewed, saved, or booked this property)
          if (!isMatch) {
            const hasView = views.some(v => v.propertyId === p.id && v.userId && userEmailMap.get(v.userId) === leadEmail);
            const hasSave = saves.some(s => s.propertyId === p.id && s.userId && userEmailMap.get(s.userId) === leadEmail);
            const hasApp = appointments.some(a => a.propertyId === p.id && a.email.toLowerCase() === leadEmail);
            if (hasView || hasSave || hasApp) {
              isMatch = true;
            }
          }

          if (isMatch) {
            inquiriesMap.set(p.id, (inquiriesMap.get(p.id) || 0) + 1);
            if (l.status === 'WON') {
              wonDealsMap.set(p.id, (wonDealsMap.get(p.id) || 0) + 1);
            }
          }
        });
      });

      // Construct metrics list
      const performance: PropertyPerformanceMetric[] = properties.map((p) => {
        const viewsCount = viewsMap.get(p.id) || 0;
        const savesCount = savesMap.get(p.id) || 0;
        const inquiriesCount = inquiriesMap.get(p.id) || 0;
        const appointmentsCount = appointmentsMap.get(p.id) || 0;
        const wonCount = wonDealsMap.get(p.id) || 0;

        return {
          propertyId: p.id,
          propertyName: p.name,
          views: viewsCount,
          saves: savesCount,
          inquiries: inquiriesCount,
          appointments: appointmentsCount,
          wonDeals: wonCount,
        };
      });

      // Rank top performing listings
      const mostViewed = [...performance].sort((a, b) => b.views - a.views).slice(0, 5);
      const mostSaved = [...performance].sort((a, b) => b.saves - a.saves).slice(0, 5);
      const mostInquired = [...performance].sort((a, b) => b.inquiries - a.inquiries).slice(0, 5);
      const mostScheduled = [...performance].sort((a, b) => b.appointments - a.appointments).slice(0, 5);

      // Compute Global Funnel (Cumulative)
      const totalViews = performance.reduce((sum, p) => sum + p.views, 0);
      const totalSaves = performance.reduce((sum, p) => sum + p.saves, 0);
      const totalInquiries = performance.reduce((sum, p) => sum + p.inquiries, 0);
      const totalAppointments = performance.reduce((sum, p) => sum + p.appointments, 0);
      const totalWon = performance.reduce((sum, p) => sum + p.wonDeals, 0);

      const funnelStages = [
        { stage: 'View', count: totalViews },
        { stage: 'Save', count: totalSaves },
        { stage: 'Inquiry', count: totalInquiries },
        { stage: 'Appointment', count: totalAppointments },
        { stage: 'Won', count: totalWon },
      ];

      const conversionFunnel: FunnelStageMetric[] = funnelStages.map((fs, idx) => {
        const precedingCount = idx > 0 ? funnelStages[idx - 1].count : fs.count;

        const conversionRate = totalViews > 0 ? (fs.count / totalViews) * 100 : 0;
        const stageConversionRate = precedingCount > 0 ? (fs.count / precedingCount) * 100 : 100;
        const dropOffRate = 100 - stageConversionRate;

        return {
          stage: fs.stage,
          count: fs.count,
          conversionRate: parseFloat(conversionRate.toFixed(2)),
          stageConversionRate: parseFloat(stageConversionRate.toFixed(2)),
          dropOffRate: parseFloat(dropOffRate.toFixed(2)),
        };
      });

      return {
        performance,
        topPerforming: {
          mostViewed,
          mostSaved,
          mostInquired,
          mostScheduled,
        },
        conversionFunnel,
      };
    } catch (error) {
      console.error('[PropertyAnalyticsService.getPropertyAnalytics] Error:', error);
      throw error;
    }
  },
};
