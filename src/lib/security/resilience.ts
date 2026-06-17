import { monitorEventLoopDelay } from 'perf_hooks';
import { SecurityEventLogger } from './event-logger';
import { SecurityEventSeverity, SecurityEventCategory } from '@prisma/client';

const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

export function getEventLoopLag(): number {
  return histogram.mean / 1e6; // Convert nanoseconds to milliseconds
}

export function getEventLoopLagState(): 'HEALTHY' | 'LAGGING' | 'CRITICAL' {
  const lag = getEventLoopLag();
  if (lag > 250) return 'CRITICAL';
  if (lag > 100) return 'LAGGING';
  return 'HEALTHY';
}

// Global process exception safety logging
if (typeof window === 'undefined') {
  // Ensure we register listeners only once in Node.js runtime process
  if (!(process as any).__resilienceListenersRegistered) {
    (process as any).__resilienceListenersRegistered = true;

    process.on('uncaughtException', (err) => {
      console.error('[CRITICAL UNCAUGHT EXCEPTION]', err);
      SecurityEventLogger.log({
        eventType: 'SYSTEM_CRASH_PREVENTED',
        severity: SecurityEventSeverity.CRITICAL,
        category: SecurityEventCategory.SYSTEM,
        title: 'Uncaught Exception Logged',
        description: `Process caught uncaughtException to maintain stability: ${err.message || String(err)}`,
        metadata: { stack: err.stack }
      }).catch(console.error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('[CRITICAL UNHANDLED REJECTION]', reason);
      SecurityEventLogger.log({
        eventType: 'UNHANDLED_REJECTION_LOGGED',
        severity: SecurityEventSeverity.HIGH,
        category: SecurityEventCategory.SYSTEM,
        title: 'Unhandled Rejection Logged',
        description: `Process caught unhandledRejection: ${reason instanceof Error ? reason.message : String(reason)}`,
        metadata: { reason: String(reason) }
      }).catch(console.error);
    });
  }
}

// API execution timeout wrapping utility
export function withTimeout(handler: (...args: any[]) => any, limitMs = 15000) {
  return async (req: any, ...args: any[]) => {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), limitMs)
    );
    try {
      return await Promise.race([
        handler(req, ...args),
        timeoutPromise
      ]);
    } catch (err: any) {
      if (err.message === 'REQUEST_TIMEOUT') {
        await SecurityEventLogger.log({
          eventType: 'API_TIMEOUT_ENFORCED',
          severity: SecurityEventSeverity.HIGH,
          category: SecurityEventCategory.SYSTEM,
          title: 'API Request Timeout Enforced',
          description: `API request execution was aborted after exceeding ${limitMs}ms safety limit.`,
          metadata: { path: req.url }
        });
        return new Response(JSON.stringify({ error: 'Request execution timeout exceeded' }), {
          status: 408,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw err;
    }
  };
}
