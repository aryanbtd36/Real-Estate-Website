import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { db } from './db';
import { Permission, UserRole } from '@prisma/client';

/**
 * Checks if a user has a specific permission or is a SUPER_ADMIN.
 */
export async function hasPermission(userId: string, permission: Permission): Promise<boolean> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) return false;

    // SUPER_ADMIN has god-mode privileges and bypasses all permission checks
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Only administrators (ADMIN) can hold granular permissions
    if (user.role !== UserRole.ADMIN) {
      return false;
    }

    const permissionRecord = await db.adminPermission.findUnique({
      where: {
        userId_permission: {
          userId,
          permission,
        },
      },
    });

    return !!permissionRecord;
  } catch (error) {
    console.error('[hasPermission] Error checking permission:', error);
    return false;
  }
}

/**
 * Helper for API routes to enforce granular permission checks.
 * Returns the session user object if valid, otherwise returns an error description and status.
 */
export async function requirePermission(request: NextRequest, permission: Permission) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { error: 'Unauthorized', status: 401 };
  }

  const userId = (session.user as any).id;
  const isAllowed = await hasPermission(userId, permission);
  if (!isAllowed) {
    return { error: 'Forbidden: Insufficient privileges', status: 403 };
  }

  return { user: session.user, userId };
}

/**
 * Helper for API routes to restrict access exclusively to SUPER_ADMIN.
 */
export async function requireSuperAdmin(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { error: 'Unauthorized', status: 401 };
  }

  const userRole = (session.user as any).role;
  if (userRole !== 'SUPER_ADMIN') {
    return { error: 'Forbidden: Super Admin access required', status: 403 };
  }

  return { user: session.user, userId: (session.user as any).id };
}
