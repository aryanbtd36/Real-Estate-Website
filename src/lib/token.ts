import crypto from 'crypto';
import { db } from './db';
import { AuthToken, User } from '@prisma/client';

export const TokenService = {
  /**
   * Generates a secure token, saves it to AuthToken table, and triggers a lazy cleanup of expired tokens.
   */
  async createToken(
    userId: string,
    type: 'VERIFY_EMAIL' | 'RESET_PASSWORD',
    durationMinutes: number
  ): Promise<AuthToken> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    // Lazy cleanup: Delete expired tokens from database to control table size
    try {
      await db.authToken.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });
    } catch (cleanupErr) {
      console.error('Lazy cleanup of expired tokens failed:', cleanupErr);
    }

    return await db.authToken.create({
      data: {
        userId,
        token,
        type,
        expiresAt,
        used: false,
      },
    });
  },

  /**
   * Validates the token and updates its state to used. Returns the user associated with the token.
   * Rejects the token if expired, already used, or type mismatch occurs.
   */
  async validateAndUseToken(
    tokenStr: string,
    type: 'VERIFY_EMAIL' | 'RESET_PASSWORD'
  ): Promise<User | null> {
    if (!tokenStr) return null;

    try {
      const dbToken = await db.authToken.findUnique({
        where: { token: tokenStr },
        include: { user: true },
      });

      if (!dbToken) return null;

      // Strict validation checks
      if (dbToken.used) {
        console.warn(`[SECURITY MONITOR] Token reuse attempt: token=${tokenStr}, type=${type}`);
        return null;
      }

      if (dbToken.type !== type) {
        console.warn(`[SECURITY MONITOR] Token type mismatch: expected=${type}, got=${dbToken.type}`);
        return null;
      }

      if (dbToken.expiresAt < new Date()) {
        console.warn(`[SECURITY MONITOR] Token expired: token=${tokenStr}, expiresAt=${dbToken.expiresAt}`);
        return null;
      }

      // Single-use enforcement: Mark as used immediately
      await db.authToken.update({
        where: { id: dbToken.id },
        data: { used: true },
      });

      return dbToken.user;
    } catch (err) {
      console.error('validateAndUseToken query failed:', err);
      return null;
    }
  },

  /**
   * Run manual/cron cleanup of all expired tokens in the database.
   */
  async cleanupExpiredTokens(): Promise<void> {
    try {
      await db.authToken.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });
    } catch (err) {
      console.error('Manual token cleanup failed:', err);
    }
  },
};
