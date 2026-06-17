import DOMPurify from 'isomorphic-dompurify';
import { SecurityEventLogger } from '../event-logger';
import { SecurityEventSeverity, SecurityEventCategory } from '@prisma/client';

export async function sanitizePlainText(input: string, userId?: string, email?: string): Promise<string> {
  if (!input) return '';
  
  const clean = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });

  const hasHtmlTags = /<[^>]*>/g.test(input) || clean !== input;

  if (hasHtmlTags && clean !== input) {
    await SecurityEventLogger.log({
      userId,
      userEmail: email,
      eventType: 'XSS_PAYLOAD_BLOCKED',
      severity: SecurityEventSeverity.HIGH,
      category: SecurityEventCategory.SYSTEM,
      title: 'Plain Text XSS Payload Blocked',
      description: 'HTML tags or scripting elements were stripped from plain text input.',
      metadata: { originalLength: input.length },
    });
  }

  return clean;
}
