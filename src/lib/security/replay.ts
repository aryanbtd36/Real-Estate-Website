import { db } from '../db';
import { SecurityEventLogger } from './event-logger';
import { SecurityEventSeverity } from '@prisma/client';

export class ReplayService {
  /**
   * Validates if a nonce is unique and has not been used.
   * If valid, saves it to the database with a 5 minute expiration window.
   */
  static async validateAndRegisterNonce(nonce: string, ip: string, ua: string): Promise<boolean> {
    if (!nonce || nonce.trim() === '') {
      return false;
    }

    try {
      // 1. Check if the nonce already exists
      const existing = await db.replayNonce.findUnique({
        where: { nonce },
      });

      if (existing) {
        // Nonce is reused! Flag a replay attack.
        await SecurityEventLogger.log({
          ipAddress: ip,
          userAgent: ua,
          action: 'Replay Attack Blocked',
          severity: SecurityEventSeverity.CRITICAL,
          description: `Login replay attack blocked: Nonce ${nonce} was reused.`,
          details: { nonce, ip, action: 'SECURITY_REPLAY_ATTACK_BLOCKED' },
        });
        return false;
      }

      // 2. Register the nonce with a 5-minute expiry
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 mins

      await db.replayNonce.create({
        data: {
          nonce,
          expiresAt,
        },
      });

      // Cleanup expired nonces in a non-blocking background sweep
      db.replayNonce.deleteMany({
        where: { expiresAt: { lt: now } },
      }).catch((err) => console.error('[ReplayService Cleanup Error]:', err));

      return true;
    } catch (err) {
      console.error('[ReplayService Error]:', err);
      return false;
    }
  }
}
