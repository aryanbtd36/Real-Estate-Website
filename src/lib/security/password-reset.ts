import crypto from 'crypto';
import { db } from '../db';
import { User } from '@prisma/client';

export const PasswordResetTokenService = {
  async createToken(userId: string) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    return await db.passwordResetToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });
  },

  async validateAndUseToken(tokenStr: string): Promise<User | null> {
    if (!tokenStr) return null;

    const dbToken = await db.passwordResetToken.findUnique({
      where: { token: tokenStr },
      include: { user: true },
    });

    if (!dbToken) return null;
    if (dbToken.usedAt !== null) return null;
    if (dbToken.expiresAt < new Date()) return null;
    if (dbToken.user.deletedAt !== null) return null;

    // Mark as used
    await db.passwordResetToken.update({
      where: { id: dbToken.id },
      data: { usedAt: new Date() },
    });

    // Invalidate all active password reset tokens belonging to this user
    await db.passwordResetToken.updateMany({
      where: {
        userId: dbToken.userId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    return dbToken.user;
  }
};
