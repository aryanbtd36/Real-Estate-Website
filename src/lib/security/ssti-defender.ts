import { SecurityEventLogger } from './event-logger';
import { SecurityEventSeverity, SecurityEventCategory } from '@prisma/client';

export async function detectSsti(input: string, userId?: string, email?: string): Promise<boolean> {
  if (!input) return false;

  // SSTI patterns for standard engines (JS literals, Mustache/Handlebars, EJS)
  const sstiPatterns = [
    /\$\{[^}]+\}/,
    /\{\{[^}]+\}\}/,
    /<%=[^%>]+%>/,
    /\{\{\s*constructor\s*\}\}/,
    /\{\{\s*prototype\s*\}\}/,
    /\$\{\s*constructor\s*\}/
  ];

  const hasSsti = sstiPatterns.some((pattern) => pattern.test(input));

  if (hasSsti) {
    await SecurityEventLogger.log({
      userId,
      userEmail: email,
      eventType: 'SSTI_ATTEMPT_BLOCKED',
      severity: SecurityEventSeverity.CRITICAL,
      category: SecurityEventCategory.SYSTEM,
      title: 'SSTI Attempt Blocked',
      description: 'Potential Server-Side Template Injection attempt was blocked and logged.',
      metadata: { originalPayload: input.substring(0, 500) },
    });
    return true;
  }

  return false;
}
