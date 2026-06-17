import crypto from 'crypto';
import { db } from '../db';

// Base32 decode helper
function base32Decode(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = base32.toUpperCase().replace(/=+$/, '');
  const length = clean.length;
  const buffer = Buffer.alloc(Math.floor((length * 5) / 8));
  
  let bits = 0;
  let value = 0;
  let index = 0;
  
  for (let i = 0; i < length; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      buffer[index++] = (value >> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return buffer;
}

export function generateTotp(secret: string, offsetSteps = 0): string {
  const key = base32Decode(secret);
  const counter = Buffer.alloc(8);
  const epoch = Math.floor(Date.now() / 1000);
  const time = Math.floor(epoch / 30) + offsetSteps;
  counter.writeUInt32BE(0, 0);
  counter.writeUInt32BE(time, 4);
  
  const hmac = crypto.createHmac('sha1', key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  
  return String(code % 1000000).padStart(6, '0');
}

export function verifyTotp(secret: string, token: string): boolean {
  // Allow window of +/- 1 time step
  for (let delay = -1; delay <= 1; delay++) {
    const expected = generateTotp(secret, delay);
    if (expected === token) return true;
  }
  return false;
}

export function generateRecoveryCodes(): { plainCodes: string[]; hashedCodes: string[] } {
  const plainCodes: string[] = [];
  const hashedCodes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const plain = crypto.randomBytes(8).toString('hex'); // 16 characters
    plainCodes.push(plain);
    const hashed = crypto.createHash('sha256').update(plain).digest('hex');
    hashedCodes.push(hashed);
  }
  return { plainCodes, hashedCodes };
}

export const MfaService = {
  generateSecret(): string {
    // Generate a standard base32 secret of 32 characters
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const bytes = crypto.randomBytes(32);
    let secret = '';
    for (let i = 0; i < bytes.length; i++) {
      secret += alphabet[bytes[i] % 32];
    }
    return secret;
  },

  async enableMfa(userId: string, secret: string, code: string): Promise<{ success: boolean; recoveryCodes?: string[]; error?: string }> {
    const isValid = verifyTotp(secret, code);
    if (!isValid) {
      return { success: false, error: 'Invalid MFA verification code.' };
    }

    const { plainCodes, hashedCodes } = generateRecoveryCodes();

    await db.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaSecret: secret,
        mfaRecoveryCodes: hashedCodes,
      },
    });

    return { success: true, recoveryCodes: plainCodes };
  },

  async disableMfa(userId: string, code: string): Promise<{ success: boolean; error?: string }> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { mfaSecret: true, mfaRecoveryCodes: true },
    });

    if (!user || !user.mfaSecret) {
      return { success: false, error: 'MFA is not enabled.' };
    }

    // Verify code (either TOTP or a backup recovery code)
    const isTotpValid = verifyTotp(user.mfaSecret, code);
    let isRecoveryValid = false;

    if (!isTotpValid) {
      const inputHash = crypto.createHash('sha256').update(code).digest('hex');
      if (user.mfaRecoveryCodes.includes(inputHash)) {
        isRecoveryValid = true;
      }
    }

    if (!isTotpValid && !isRecoveryValid) {
      return { success: false, error: 'Invalid MFA or recovery code.' };
    }

    await db.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaRecoveryCodes: [],
      },
    });

    return { success: true };
  },

  async verifyRecoveryCode(userId: string, code: string): Promise<boolean> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { mfaRecoveryCodes: true },
    });

    if (!user) return false;

    const inputHash = crypto.createHash('sha256').update(code).digest('hex');
    if (user.mfaRecoveryCodes.includes(inputHash)) {
      // Remove used recovery code (single use)
      const remainingCodes = user.mfaRecoveryCodes.filter((c) => c !== inputHash);
      await db.user.update({
        where: { id: userId },
        data: { mfaRecoveryCodes: remainingCodes },
      });
      return true;
    }

    return false;
  },

  async regenerateRecoveryCodes(userId: string): Promise<{ success: boolean; recoveryCodes?: string[]; error?: string }> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });

    if (!user || !user.mfaEnabled) {
      return { success: false, error: 'MFA is not enabled.' };
    }

    const { plainCodes, hashedCodes } = generateRecoveryCodes();
    await db.user.update({
      where: { id: userId },
      data: { mfaRecoveryCodes: hashedCodes },
    });

    return { success: true, recoveryCodes: plainCodes };
  }
};
