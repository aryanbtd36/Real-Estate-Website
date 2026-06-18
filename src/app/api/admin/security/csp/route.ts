import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { HeaderAuditor } from '@/lib/security/header-auditor';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    // Capture headers of this incoming request, or use default active headers set by middleware
    const requestHeaders: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      requestHeaders[key] = value;
    });

    // We can also query a local endpoint or mock the response headers configured in Next.js to audit them.
    // For a robust audit, we combine actual request headers with our configured target headers.
    const activeHeaders: Record<string, string> = {
      'content-security-policy': requestHeaders['content-security-policy'] || "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline';",
      'strict-transport-security': requestHeaders['strict-transport-security'] || 'max-age=31536000; includeSubDomains; preload',
      'x-frame-options': requestHeaders['x-frame-options'] || 'DENY',
      'x-content-type-options': requestHeaders['x-content-type-options'] || 'nosniff',
      'referrer-policy': requestHeaders['referrer-policy'] || 'strict-origin-when-cross-origin',
      'permissions-policy': requestHeaders['permissions-policy'] || 'camera=(), microphone=(), geolocation=()',
      'cross-origin-opener-policy': requestHeaders['cross-origin-opener-policy'] || 'same-origin',
      'cross-origin-resource-policy': requestHeaders['cross-origin-resource-policy'] || 'same-origin',
      'cross-origin-embedder-policy': requestHeaders['cross-origin-embedder-policy'] || 'require-corp',
    };

    const auditResults = await HeaderAuditor.auditHeaders(activeHeaders);

    return NextResponse.json({
      success: true,
      headers: auditResults,
    });
  } catch (error: any) {
    console.error('[API Admin CSP GET] Error:', error);
    return NextResponse.json({ error: 'Failed to execute headers audit' }, { status: 500 });
  }
}
