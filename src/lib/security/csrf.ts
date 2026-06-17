import { NextRequest } from 'next/server';
import { SecurityEventLogger } from './event-logger';
import { SecurityEventSeverity } from '@prisma/client';

export class CsrfService {
  static getHost(req: NextRequest): string {
    const hostHeader = req.headers.get('host') || '';
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    return `${proto}://${hostHeader}`;
  }

  static validateHeaders(req: NextRequest): boolean {
    const host = this.getHost(req);
    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');

    // Origin validation
    if (origin && origin !== host) {
      console.warn(`[CSRF] Origin mismatch: got ${origin}, expected ${host}`);
      return false;
    }

    // Referer validation
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const hostUrl = new URL(host);
        if (refererUrl.host !== hostUrl.host) {
          console.warn(`[CSRF] Referer mismatch: got ${refererUrl.host}, expected ${hostUrl.host}`);
          return false;
        }
      } catch {
        console.warn(`[CSRF] Invalid referer header: ${referer}`);
        return false;
      }
    }

    return true;
  }

  static validateToken(req: NextRequest): boolean {
    // Double-submit cookie verification
    const csrfCookie = req.cookies.get('csrf-token')?.value;
    const csrfHeader = req.headers.get('x-csrf-token');

    if (!csrfCookie || !csrfHeader) {
      console.warn('[CSRF] Missing token in cookie or header');
      return false;
    }

    return csrfCookie === csrfHeader;
  }

  static async protect(req: NextRequest): Promise<boolean> {
    const isHeaderValid = this.validateHeaders(req);
    const isTokenValid = this.validateToken(req);

    if (!isHeaderValid || !isTokenValid) {
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
      await SecurityEventLogger.log({
        ipAddress: ip,
        userAgent: req.headers.get('user-agent') || 'unknown',
        action: 'CSRF Attack Blocked',
        severity: SecurityEventSeverity.HIGH,
        description: `CSRF validation failed for endpoint ${req.nextUrl.pathname}. Header valid: ${isHeaderValid}, Token valid: ${isTokenValid}`,
        details: { path: req.nextUrl.pathname, ip },
      });
      return false;
    }

    return true;
  }
}
