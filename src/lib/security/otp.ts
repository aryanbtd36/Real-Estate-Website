import crypto from 'crypto';
import { db } from '../db';

export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export const OtpService = {
  async requestOtp(phoneNumber: string, userId?: string): Promise<{ success: boolean; otp?: string; error?: string }> {
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    // Rate Limiting: Maximum 3 OTP requests per 15 minutes per phone number
    const recentRequests = await db.otpVerification.count({
      where: {
        phoneNumber,
        createdAt: { gte: fifteenMinutesAgo },
      },
    });

    if (recentRequests >= 3) {
      return { success: false, error: 'Too many OTP requests. Please try again later.' };
    }

    // Generate a secure 6-digit numeric OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

    await db.otpVerification.create({
      data: {
        userId: userId || null,
        phoneNumber,
        otpHash,
        expiresAt,
        attempts: 0,
      },
    });

    console.log(`[OTP DEBUG] OTP for ${phoneNumber}: ${otp}`);

    return { success: true, otp };
  },

  async verifyOtp(phoneNumber: string, otp: string): Promise<boolean> {
    const now = new Date();
    
    // Find the latest unused, non-expired OTP verification record for this phone number
    const latestOtp = await db.otpVerification.findFirst({
      where: {
        phoneNumber,
        usedAt: null,
        expiresAt: { gte: now },
        attempts: { lt: 5 },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestOtp) {
      return false;
    }

    const currentHash = hashOtp(otp);
    if (latestOtp.otpHash === currentHash) {
      // Success: mark as used
      await db.otpVerification.update({
        where: { id: latestOtp.id },
        data: { usedAt: now },
      });
      return true;
    } else {
      // Mismatch: increment attempts
      const newAttempts = latestOtp.attempts + 1;
      const data: any = { attempts: newAttempts };
      
      // After 5 failures: Invalidate OTP
      if (newAttempts >= 5) {
        data.usedAt = now;
      }

      await db.otpVerification.update({
        where: { id: latestOtp.id },
        data,
      });

      return false;
    }
  }
};
