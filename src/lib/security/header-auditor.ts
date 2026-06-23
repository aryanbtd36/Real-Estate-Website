import { db } from '../db';
import { FindingSeverity, FindingCategory, FindingStatus } from '@prisma/client';

export interface HeaderAuditResult {
  headerName: string;
  currentValue: string;
  expectedValue: string;
  status: 'PASS' | 'WARNING' | 'FAIL';
}

export class HeaderAuditor {
  static async auditHeaders(headers: Record<string, string>): Promise<HeaderAuditResult[]> {
    const audits: {
      key: string;
      expected: string;
      validator: (val: string) => 'PASS' | 'WARNING' | 'FAIL';
      failSeverity: FindingSeverity;
      failDesc: string;
    }[] = [
      {
        key: 'Content-Security-Policy',
        expected: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://*.tile.openstreetmap.org https://server.arcgisonline.com https://unpkg.com https://res.cloudinary.com; connect-src 'self' https://*.tile.openstreetmap.org https://server.arcgisonline.com;",
        validator: (val) => {
          if (!val) return 'FAIL';
          if (val.includes("default-src 'self'") || val.includes("default-src")) return 'PASS';
          return 'WARNING';
        },
        failSeverity: FindingSeverity.HIGH,
        failDesc: 'Missing or weak Content Security Policy. Directives should block unauthorized cross-site scripting sources.',
      },
      {
        key: 'Strict-Transport-Security',
        expected: 'max-age=31536000; includeSubDomains; preload',
        validator: (val) => {
          if (!val) return 'FAIL';
          if (val.includes('max-age=') && val.includes('includeSubDomains')) return 'PASS';
          return 'WARNING';
        },
        failSeverity: FindingSeverity.HIGH,
        failDesc: 'HTTP Strict Transport Security (HSTS) is misconfigured or missing max-age parameters.',
      },
      {
        key: 'X-Frame-Options',
        expected: 'DENY',
        validator: (val) => {
          if (!val) return 'FAIL';
          if (val.toUpperCase() === 'DENY' || val.toUpperCase() === 'SAMEORIGIN') return 'PASS';
          return 'FAIL';
        },
        failSeverity: FindingSeverity.MEDIUM,
        failDesc: 'X-Frame-Options is missing or not configured to DENY or SAMEORIGIN, creating clickjacking vulnerabilities.',
      },
      {
        key: 'X-Content-Type-Options',
        expected: 'nosniff',
        validator: (val) => {
          if (!val) return 'FAIL';
          if (val.toLowerCase() === 'nosniff') return 'PASS';
          return 'FAIL';
        },
        failSeverity: FindingSeverity.MEDIUM,
        failDesc: 'X-Content-Type-Options should be set to nosniff to prevent MIME type sniffing exploits.',
      },
      {
        key: 'Referrer-Policy',
        expected: 'strict-origin-when-cross-origin',
        validator: (val) => {
          if (!val) return 'FAIL';
          if (['no-referrer', 'same-origin', 'strict-origin-when-cross-origin'].includes(val.toLowerCase())) return 'PASS';
          return 'WARNING';
        },
        failSeverity: FindingSeverity.LOW,
        failDesc: 'Referrer-Policy is missing or permits unsafe cross-origin leakages.',
      },
      {
        key: 'Permissions-Policy',
        expected: 'camera=(), microphone=(), geolocation=()',
        validator: (val) => {
          if (!val) return 'WARNING';
          if (val.includes('camera') || val.includes('geolocation') || val.includes('microphone')) return 'PASS';
          return 'WARNING';
        },
        failSeverity: FindingSeverity.LOW,
        failDesc: 'Permissions-Policy is missing, allowing frames to access browser features by default.',
      },
      {
        key: 'Cross-Origin-Opener-Policy',
        expected: 'same-origin',
        validator: (val) => {
          if (!val) return 'WARNING';
          if (val.toLowerCase() === 'same-origin') return 'PASS';
          return 'WARNING';
        },
        failSeverity: FindingSeverity.LOW,
        failDesc: 'Cross-Origin-Opener-Policy (COOP) not set to same-origin.',
      },
      {
        key: 'Cross-Origin-Resource-Policy',
        expected: 'same-origin',
        validator: (val) => {
          if (!val) return 'WARNING';
          if (['same-origin', 'same-site'].includes(val.toLowerCase())) return 'PASS';
          return 'WARNING';
        },
        failSeverity: FindingSeverity.LOW,
        failDesc: 'Cross-Origin-Resource-Policy (CORP) not set to same-origin.',
      },
      {
        key: 'Cross-Origin-Embedder-Policy',
        expected: 'require-corp',
        validator: (val) => {
          if (!val) return 'WARNING';
          if (val.toLowerCase() === 'require-corp' || val.toLowerCase() === 'unsafe-none') return 'PASS';
          return 'WARNING';
        },
        failSeverity: FindingSeverity.LOW,
        failDesc: 'Cross-Origin-Embedder-Policy (COEP) not set to require-corp.',
      },
    ];

    const results: HeaderAuditResult[] = [];

    for (const a of audits) {
      const val = headers[a.key] || headers[a.key.toLowerCase()] || '';
      const status = a.validator(val);
      results.push({
        headerName: a.key,
        currentValue: val || '[MISSING]',
        expectedValue: a.expected,
        status,
      });

      // Generate security finding if FAILED
      if (status === 'FAIL') {
        try {
          const title = `Insecure Response Header: ${a.key}`;
          const existing = await db.securityFinding.findFirst({
            where: { title, status: FindingStatus.OPEN },
          });

          if (!existing) {
            await db.securityFinding.create({
              data: {
                title,
                description: a.failDesc,
                severity: a.failSeverity,
                category: FindingCategory.INFRASTRUCTURE,
                status: FindingStatus.OPEN,
                source: 'Security Header Audit',
                notes: `Audited header: ${a.key}. Expected: ${a.expected}. Found: ${val || 'MISSING'}.`,
                createdBy: 'SYSTEM_AUDITOR',
              },
            });

            // Also log a security alert
            const { SecurityEventSeverity, SecurityEventCategory } = await import('@prisma/client');
            const newEvent = await db.securityEvent.create({
              data: {
                eventType: 'INSECURE_HEADER_DETECTED',
                severity: SecurityEventSeverity.HIGH,
                category: SecurityEventCategory.SECURITY,
                title: 'Insecure Header Configured',
                description: `HTTP Response header ${a.key} failed security audit checks. Value: ${val || '[MISSING]'}`,
                metadata: { header: a.key, currentValue: val },
              },
            });

            await db.securityAlert.create({
              data: {
                title: 'Insecure Security Header Configuration',
                description: `Header ${a.key} is misconfigured or missing in response pipeline.`,
                severity: SecurityEventSeverity.HIGH,
                status: 'OPEN',
                sourceEventId: newEvent.id,
              },
            });
          }
        } catch (dbErr) {
          console.error('[HeaderAuditor DB Error]', dbErr);
        }
      }
    }

    return results;
  }
}
