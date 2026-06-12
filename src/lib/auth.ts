import { NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
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

        // 1. Verify Cloudflare Turnstile token
        const isTurnstileValid = await verifyTurnstile(credentials.turnstileToken);
        if (!isTurnstileValid) {
          throw new Error('Turnstile verification failed.');
        }

        // 2. Fetch user from database
        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          return null;
        }

        // Block soft-deleted users
        if (user.deletedAt) {
          throw new Error('UserAccountDeleted');
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
            throw new Error('Invalid credentials');
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
          return null;
        }

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
    async jwt({ token }) {
      // Single source of truth for authorization: always check role in DB
      if (token.email) {
        try {
          const dbUser = await db.user.findUnique({
            where: { email: token.email },
            select: { id: true, phone: true, emailVerified: true },
          });

          if (dbUser) {
            // Resolving role dynamically from database to support real-time privilege validation
            token.role = await RoleService.getUserRole(token.email);
            token.id = dbUser.id;
            token.phone = dbUser.phone;
            token.emailVerified = dbUser.emailVerified ? dbUser.emailVerified.toISOString() : null;
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
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      try {
        eventEmitter.emit(EVENTS.LOGIN_SUCCESS, {
          userId: user.id,
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
