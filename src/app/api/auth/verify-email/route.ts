import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { TokenService } from '@/lib/token';
import { eventEmitter, EVENTS } from '@/lib/events';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/login?verify-error=true`);
  }

  try {
    // 1. Verify verification token
    const user = await TokenService.validateAndUseToken(token, 'VERIFY_EMAIL');
    
    if (!user || user.deletedAt !== null) {
      console.warn(`[SECURITY MONITOR] Email verification failed: invalid, expired, or deleted account token "${token}"`);
      return NextResponse.redirect(`${baseUrl}/login?verify-error=true`);
    }

    // 2. Mark email as verified in the database
    await db.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });

    // Emit decoupled event
    eventEmitter.emit(EVENTS.EMAIL_VERIFIED, {
      userId: user.id,
      email: user.email,
    });

    console.log(`[SECURITY MONITOR] Email verified successfully for user: ${user.email}`);
    
    return NextResponse.redirect(`${baseUrl}/login?verified=true`);
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.redirect(`${baseUrl}/login?verify-error=true`);
  }
}
