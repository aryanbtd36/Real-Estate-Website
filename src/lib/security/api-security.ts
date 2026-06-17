import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth';
import { z } from 'zod';
import { SecurityEventLogger } from './event-logger';
import { CsrfService } from './csrf';
import { RateLimiter } from './rate-limiter';
import { SecurityEventSeverity } from '@prisma/client';

export interface SecureRouteOptions {
  schema?: z.ZodSchema<any>;
  sizeLimit?: number; // in bytes
  csrfCheck?: boolean;
  rateLimit?: {
    max: number;
    windowMs: number;
    keyPrefix: string;
  };
  botProtection?: boolean;
  roleRequired?: string[];
}

function sanitizeString(str: string): string {
  if (!str) return str;
  let clean = str;
  
  // Remove script tags
  clean = clean.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '');
  
  // Remove dangerous tags like iframe, object, embed, link, meta, style, svg
  clean = clean.replace(/<(iframe|object|embed|link|meta|style|svg)[^>]*>([\s\S]*?)<\/\1>/gi, '');
  clean = clean.replace(/<(iframe|object|embed|link|meta|style|svg)[^>]*\/?>/gi, '');

  // Remove inline on* events
  clean = clean.replace(/on\w+\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi, '');
  
  // Remove javascript: protocols
  clean = clean.replace(/javascript\s*:\s*[^'"\s]+/gi, '');

  return clean;
}

export function sanitizeInput(data: any): any {
  if (typeof data === 'string') {
    return sanitizeString(data);
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeInput);
  }
  if (data !== null && typeof data === 'object') {
    const clean: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        clean[key] = sanitizeInput(data[key]);
      }
    }
    return clean;
  }
  return data;
}

export function secureApiHandler(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse>,
  options: SecureRouteOptions = {}
) {
  return async (req: NextRequest, context?: any) => {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const ua = req.headers.get('user-agent') || 'unknown';

    // 1. Content-Length Header check (Immediate reject before parsing)
    const contentLength = req.headers.get('content-length');
    if (contentLength && options.sizeLimit) {
      const size = parseInt(contentLength, 10);
      if (size > options.sizeLimit) {
        await SecurityEventLogger.log({
          ipAddress: ip,
          userAgent: ua,
          action: 'Payload Limit Exceeded',
          severity: SecurityEventSeverity.HIGH,
          description: `Payload header content-length ${size} exceeds limit of ${options.sizeLimit} on ${req.nextUrl.pathname}`,
          details: { path: req.nextUrl.pathname, size, limit: options.sizeLimit },
        });
        return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
      }
    }

    // 2. CSRF Protection
    if (options.csrfCheck && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const csrfPassed = await CsrfService.protect(req);
      if (!csrfPassed) {
        return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
      }
    }

    // 3. Rate Limiting Check
    if (options.rateLimit) {
      const session = await getServerSession(authOptions);
      const limitKey = `${options.rateLimit.keyPrefix}:${session?.user ? (session.user as any).id : ip}`;
      const { allowed } = await RateLimiter.check(
        limitKey,
        ip,
        options.rateLimit.max,
        options.rateLimit.windowMs,
        req.nextUrl.pathname,
        session?.user ? (session.user as any).id : undefined
      );

      if (!allowed) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      }
    }

    // 4. Request Body reading, limit validation, sanitization & Zod checks
    let body: any = null;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      try {
        const text = await req.text();

        // Safe fallback check on exact stream size in memory
        if (options.sizeLimit && text.length > options.sizeLimit) {
          await SecurityEventLogger.log({
            ipAddress: ip,
            userAgent: ua,
            action: 'Payload Limit Exceeded',
            severity: SecurityEventSeverity.HIGH,
            description: `Payload stream byte size ${text.length} exceeds limit of ${options.sizeLimit} on ${req.nextUrl.pathname}`,
            details: { path: req.nextUrl.pathname, size: text.length, limit: options.sizeLimit },
          });
          return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
        }

        if (text) {
          body = JSON.parse(text);

          // Honeypot field bot protection
          if (options.botProtection && body && body.website_url) {
            await SecurityEventLogger.log({
              ipAddress: ip,
              userAgent: ua,
              action: 'Bot Submission Blocked',
              severity: SecurityEventSeverity.MEDIUM,
              description: `Automated honeypot submit caught on ${req.nextUrl.pathname}: website_url was populated.`,
              details: { value: body.website_url },
            });
            return NextResponse.json({ error: 'Request rejected' }, { status: 400 });
          }

          // Input XSS Sanitization
          body = sanitizeInput(body);

          // Zod Validation Schema
          if (options.schema) {
            const parsed = options.schema.safeParse(body);
            if (!parsed.success) {
              return NextResponse.json(
                { error: 'Validation failed', details: parsed.error.format() },
                { status: 400 }
              );
            }
            body = parsed.data;
          }
        }
      } catch (err) {
        if (options.schema) {
          return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
        }
      }
    }

    // Override req.json and req.text methods to avoid "body stream already read" issues
    if (body) {
      req.json = async () => body;
      req.text = async () => JSON.stringify(body);
      (req as any).validatedBody = body;
    }

    // 5. Role restrictions checks
    if (options.roleRequired) {
      const session = await getServerSession(authOptions);
      const userRole = session?.user ? (session.user as any).role : null;
      if (!userRole || !options.roleRequired.includes(userRole)) {
        return NextResponse.json({ error: 'Forbidden: Insufficient role permissions' }, { status: 403 });
      }
    }

    return handler(req, context);
  };
}
