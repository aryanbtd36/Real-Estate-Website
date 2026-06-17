import DOMPurify from 'isomorphic-dompurify';
import { SecurityEventLogger } from '../event-logger';
import { SecurityEventSeverity, SecurityEventCategory } from '@prisma/client';

export async function sanitizeRichText(input: string, userId?: string, email?: string): Promise<string> {
  if (!input) return '';
  const clean = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['p', 'b', 'i', 'strong', 'em', 'ul', 'ol', 'li', 'span', 'br', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ALLOWED_ATTR: ['href', 'target', 'class', 'style'],
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
      title: 'Rich Text XSS Payload Blocked',
      description: 'Dangerous tags or scripting attributes were removed from rich text field.',
      metadata: { originalLength: input.length },
    });
  }

  return clean;
}
