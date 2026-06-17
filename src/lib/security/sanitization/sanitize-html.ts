import DOMPurify from 'isomorphic-dompurify';
import { SecurityEventLogger } from '../event-logger';
import { SecurityEventSeverity, SecurityEventCategory } from '@prisma/client';

export async function sanitizeHtml(input: string, userId?: string, email?: string): Promise<string> {
  if (!input) return '';
  const clean = DOMPurify.sanitize(input, {
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'style', 'xml', 'svg'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'onblur', 'onchange'],
  });

  const hasMaliciousPattern = /<script|iframe|object|embed|on\w+\s*=|javascript:|vbscript:|data:text\/html/i.test(input) || clean !== input;
  
  if (hasMaliciousPattern && clean !== input) {
    await SecurityEventLogger.log({
      userId,
      userEmail: email,
      eventType: 'XSS_PAYLOAD_BLOCKED',
      severity: SecurityEventSeverity.HIGH,
      category: SecurityEventCategory.SYSTEM,
      title: 'HTML XSS Payload Blocked',
      description: 'Dangerous HTML tag or event handler was stripped from input.',
      metadata: { originalLength: input.length },
    });
  }

  return clean;
}
