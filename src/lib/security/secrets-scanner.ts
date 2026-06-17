import { SecurityEventLogger } from './event-logger';
import { SecurityEventSeverity, SecurityEventCategory } from '@prisma/client';

export function scanCodeForSecrets(code: string, filepath = 'unknown'): { hasSecrets: boolean; findings: string[] } {
  const findings: string[] = [];

  const patterns = [
    { name: 'Google API Key', regex: /AIza[0-9A-Za-z-_]{35}/ },
    { name: 'Resend API Key', regex: /re_[0-9A-Za-z]{8}_[0-9A-Za-z]{24}/ },
    { name: 'Generic API Key / Token', regex: /(api_key|api_secret|cloudinary_secret|jwt_secret|nextauth_secret|supabase_key)\s*[:=]\s*['"`][0-9A-Za-z-_]{16,}['"`]/i },
    { name: 'Database Connection String', regex: /postgresql?:\/\/[a-zA-Z0-9_]+:[^@\s]+@[a-zA-Z0-9.-]+(:\d+)?\/[a-zA-Z0-9_-]+/ },
    { name: 'NEXT_PUBLIC Secret Leak', regex: /NEXT_PUBLIC_(API_KEY|SECRET|PASSWORD|JWT|DATABASE_URL|TOKEN|API_SECRET)\s*[:=]/i }
  ];

  for (const p of patterns) {
    if (p.regex.test(code)) {
      findings.push(`Exposed ${p.name} in file: ${filepath}`);
    }
  }

  return {
    hasSecrets: findings.length > 0,
    findings
  };
}

export async function runSecretScan(code: string, filepath = 'unknown'): Promise<boolean> {
  const result = scanCodeForSecrets(code, filepath);
  if (result.hasSecrets) {
    await SecurityEventLogger.log({
      eventType: 'SECRET_EXPOSURE_DETECTED',
      severity: SecurityEventSeverity.CRITICAL,
      category: SecurityEventCategory.SYSTEM,
      title: 'Secret Exposure Detected',
      description: `Hardcoded API credential or leaked environment config key identified in source: ${result.findings.join('; ')}`,
      metadata: { filepath, findings: result.findings }
    });
    return true; // exposed
  }
  return false; // clean
}
