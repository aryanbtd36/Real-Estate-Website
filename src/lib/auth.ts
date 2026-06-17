import { NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';
import { db } from './db';
import { RoleService, resolveUserRole } from './role';
import { verifyTurnstile } from './turnstile';
import { eventEmitter, EVENTS } from './events';

export const authOptions: NextAuthOptions = {
  // @ts-expect-error - Vercel compatibility
  trustHost: true,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
        turnstileToken: { label: 'Turnstile Token', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const reqHeaders = await headers();
        const ip = reqHeaders.get('x-forwarded-for') || reqHeaders.get('x-real-ip') || '127.0.0.1';
        const userAgent = reqHeaders.get('user-agent') || 'unknown';

        // DoS password length check (length <= 128)
        if (credentials.password.length > 128) {
          throw new Error('AccountLockedOrInvalid');
        }

        // 1. Verify Cloudflare Turnstile token
        const isTurnstileValid = await verifyTurnstile(credentials.turnstileToken);
        if (!isTurnstileValid) {
          throw new Error('Turnstile verification failed.');
        }

        // 1.5. Verify if global lockdown is active
        const { isGlobalLockdownActive } = await import('./governance');
        if (await isGlobalLockdownActive()) {
          if (credentials.email.toLowerCase() !== 'aryanmishra8113@gmail.com') {
            throw new Error('GlobalLockdownActive');
          }
        }

        // Helper to parse user agent
        const parseUserAgent = (ua: string) => {
          let browser = 'unknown';
          let device = 'unknown';
          const uaLower = ua.toLowerCase();
          if (uaLower.includes('firefox')) browser = 'Firefox';
          else if (uaLower.includes('chrome')) browser = 'Chrome';
          else if (uaLower.includes('safari')) browser = 'Safari';
          else if (uaLower.includes('edge')) browser = 'Edge';
          else if (uaLower.includes('msie') || uaLower.includes('trident')) browser = 'IE';

          if (uaLower.includes('mobile') || uaLower.includes('android') || uaLower.includes('iphone') || uaLower.includes('ipad')) {
            device = 'Mobile';
          } else {
            device = 'Desktop';
          }
          return { browser, device };
        };

        const { browser, device } = parseUserAgent(userAgent);

        // 2. Fetch user from database
        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          // Record failed login attempt for non-existent user to prevent timing attack / track brute force
          await db.loginAttempt.create({
            data: {
              email: credentials.email,
              ipAddress: ip,
              userAgent,
              browser,
              device,
              success: false,
            },
          });
          throw new Error('AccountLockedOrInvalid');
        }

        // Check lock status
        if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
          await db.loginAttempt.create({
            data: {
              email: credentials.email,
              ipAddress: ip,
              userAgent,
              browser,
              device,
              success: false,
            },
          });
          throw new Error('AccountLockedOrInvalid');
        }

        // Block soft-deleted users
        if (user.deletedAt) {
          await db.loginAttempt.create({
            data: {
              email: credentials.email,
              ipAddress: ip,
              userAgent,
              browser,
              device,
              success: false,
            },
          });
          throw new Error('AccountLockedOrInvalid');
        }

        // Block suspended users
        if (user.status === 'SUSPENDED') {
          await db.loginAttempt.create({
            data: {
              email: credentials.email,
              ipAddress: ip,
              userAgent,
              browser,
              device,
              success: false,
            },
          });
          throw new Error('AccountLockedOrInvalid');
        }

        // 3. Google OAuth Transition Check
        if (!user.password) {
          // Account registered via Google, no password set yet
          throw new Error('OAuthUserNoPassword');
        }

        // 4. Password validation and auto-migration
        const isBcrypt =
          user.password.startsWith('$2a$') ||
          user.password.startsWith('$2b$') ||
          user.password.startsWith('$2y$');
        let isValid = false;

        if (isBcrypt) {
          isValid = await bcrypt.compare(credentials.password, user.password);
        } else {
          // Strict transition boundary: plaintext comparison allowed ONLY for legacy seeded users
          const seededEmails = ['admin@luxury.com', 'john@example.com'];
          const isLegacySeeded = seededEmails.includes(user.email.toLowerCase());

          if (!isLegacySeeded) {
            console.warn(
              `[SECURITY MONITOR] Plaintext password attempt rejected for non-legacy account: ${user.email}`
            );
            await db.loginAttempt.create({
              data: {
                email: credentials.email,
                ipAddress: ip,
                userAgent,
                browser,
                device,
                success: false,
              },
            });
            throw new Error('AccountLockedOrInvalid');
          }

          isValid = credentials.password === user.password;

          if (isValid) {
            // Upgrade plaintext password to bcrypt hash on successful login
            const hashedPassword = await bcrypt.hash(credentials.password, 10);
            await db.user.update({
              where: { id: user.id },
              data: { password: hashedPassword },
            });
            console.log(`[SECURITY MONITOR] Legacy password auto-migrated for: ${user.email}`);
          }
        }

        if (!isValid) {
          // Handle failed login attempts
          let attempts = user.failedLoginAttempts;
          if (user.accountLockedUntil && user.accountLockedUntil <= new Date()) {
            attempts = 0;
          }
          const newAttempts = attempts + 1;
          const updateData: any = {
            failedLoginAttempts: newAttempts,
            lastFailedLoginAt: new Date(),
          };
          if (newAttempts >= 5) {
            updateData.accountLockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 mins
          }
          await db.user.update({
            where: { id: user.id },
            data: updateData,
          });

          await db.loginAttempt.create({
            data: {
              email: credentials.email,
              ipAddress: ip,
              userAgent,
              browser,
              device,
              success: false,
            },
          });
          throw new Error('AccountLockedOrInvalid');
        }

        // Reset failed login attempts on successful login
        // Also record metadata: lastLoginAt, lastLoginIP, lastLoginDevice
        await db.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            accountLockedUntil: null,
            lastLoginAt: new Date(),
            lastLoginIP: ip,
            lastLoginDevice: userAgent,
          },
        });

        // Record successful login
        await db.loginAttempt.create({
          data: {
            email: credentials.email,
            ipAddress: ip,
            userAgent,
            browser,
            device,
            success: true,
          },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const email = user.email;
        if (!email) return false;

        // Verify if global lockdown is active
        const { isGlobalLockdownActive } = await import('./governance');
        if (await isGlobalLockdownActive()) {
          if (email.toLowerCase() !== 'aryanmishra8113@gmail.com') {
            console.warn(`[SECURITY MONITOR] Blocked Google sign-in during global lockdown for: ${email}`);
            return false;
          }
        }

        try {
          const dbUser = await db.user.findUnique({
            where: { email },
          });

          // Block soft-deleted users
          if (dbUser?.deletedAt) {
            console.warn(`[SECURITY MONITOR] Blocked Google sign-in for soft-deleted account: ${email}`);
            return false;
          }

          if (!dbUser) {
            // User creation: resolve role using resolveUserRole helper
            const initialRole = resolveUserRole(email, 'USER');

            await db.user.create({
              data: {
                email,
                name: user.name || '',
                role: initialRole,
                password: null, // Google OAuth account has no password originally
                emailVerified: new Date(), // Google emails are pre-verified
              },
            });
          }
        } catch (err) {
          console.error('NextAuth signIn callback error:', err);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        try {
          const reqHeaders = await headers();
          const ipAddress = reqHeaders.get('x-forwarded-for') || reqHeaders.get('x-real-ip') || '127.0.0.1';
          const userAgent = reqHeaders.get('user-agent') || 'unknown';
          const country = reqHeaders.get('x-vercel-ip-country') || 'IN';
          const state = reqHeaders.get('x-vercel-ip-country-region') || 'UP';
          const city = reqHeaders.get('x-vercel-ip-city') || 'Lucknow';
          const latitude = parseFloat(reqHeaders.get('x-vercel-ip-latitude') || '26.8467');
          const longitude = parseFloat(reqHeaders.get('x-vercel-ip-longitude') || '80.9462');
          const asn = reqHeaders.get('x-vercel-ip-as-number') || 'AS0';

          const dbUser = await db.user.findUnique({
            where: { id: user.id },
            select: { mfaEnabled: true }
          });

          const { SessionManager } = await import('./security/session-manager');
          const session = await SessionManager.createSession(user.id, user.email!, (user as any).role, {
            userAgent,
            ipAddress,
            country,
            state,
            city,
            latitude,
            longitude,
            asn,
          });

          token.sessionId = session.id;
          token.loginAt = session.loginAt.toISOString();
          token.mfaEnabled = dbUser?.mfaEnabled || false;
        } catch (err) {
          console.error('NextAuth initial session creation failed:', err);
        }
      }

      if (token.email) {
        try {
          const dbUser = await db.user.findUnique({
            where: { email: token.email },
            select: {
              id: true,
              phone: true,
              emailVerified: true,
              isFounder: true,
              isPrimarySA: true,
              role: true,
              mfaEnabled: true,
              passwordChangedAt: true
            },
          });

          if (dbUser) {
            const { SessionManager } = await import('./security/session-manager');

            if (token.sessionId) {
              const activeSession = await SessionManager.validateSession(token.sessionId as string);
              if (!activeSession) {
                return {};
              }

              let shouldRotate = false;
              if (token.role && token.role !== dbUser.role) shouldRotate = true;
              else if (token.mfaEnabled !== undefined && token.mfaEnabled !== dbUser.mfaEnabled) shouldRotate = true;
              else if (token.isFounder !== undefined && token.isFounder !== dbUser.isFounder) shouldRotate = true;
              else if (token.isPrimarySA !== undefined && token.isPrimarySA !== dbUser.isPrimarySA) shouldRotate = true;
              else if (dbUser.passwordChangedAt && token.loginAt && new Date(dbUser.passwordChangedAt) > new Date(token.loginAt as string)) {
                shouldRotate = true;
              }

              if (shouldRotate) {
                try {
                  const rotated = await SessionManager.rotateSession(token.sessionId as string);
                  token.sessionId = rotated.id;
                  token.loginAt = rotated.loginAt.toISOString();
                } catch (rotErr) {
                  console.error('Session rotation failed:', rotErr);
                  return {};
                }
              }
            }

            token.role = dbUser.role;
            token.id = dbUser.id;
            token.phone = dbUser.phone;
            token.emailVerified = dbUser.emailVerified ? dbUser.emailVerified.toISOString() : null;
            token.isFounder = dbUser.isFounder;
            token.isPrimarySA = dbUser.isPrimarySA;
            token.mfaEnabled = dbUser.mfaEnabled;
          } else {
            return {};
          }
        } catch (err) {
          console.error('NextAuth jwt callback error:', err);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).phone = token.phone;
        (session.user as any).emailVerified = token.emailVerified;
        (session.user as any).isFounder = token.isFounder;
        (session.user as any).isPrimarySA = token.isPrimarySA;
        (session.user as any).sessionId = token.sessionId;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      try {
        let dbUserId = user.id;
        if (account?.provider === 'google' && user.email) {
          const dbUser = await db.user.findUnique({
            where: { email: user.email },
            select: { id: true },
          });
          if (dbUser) {
            dbUserId = dbUser.id;
          }
        }
        eventEmitter.emit(EVENTS.LOGIN_SUCCESS, {
          userId: dbUserId,
          provider: account?.provider || 'credentials',
        });
      } catch (err) {
        console.error('Failed to log signin event:', err);
      }
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
