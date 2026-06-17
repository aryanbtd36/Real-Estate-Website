import { getServerSession } from 'next-auth';
import { authOptions } from '../auth';
import { db } from '../db';
import { UserRole } from '@prisma/client';

export async function hasRole(userId: string, allowedRoles: UserRole[]): Promise<boolean> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) return false;
    return allowedRoles.includes(user.role);
  } catch (err) {
    console.error('[hasRole] Error checking role:', err);
    return false;
  }
}

export async function hasPermission(userId: string, permissionName: string): Promise<boolean> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) return false;

    // SUPER_ADMIN role bypasses all permission checks
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Resolve via RolePermission table
    const rolePermission = await db.rolePermission.findFirst({
      where: {
        role: user.role,
        permission: {
          name: permissionName,
        },
      },
    });

    return !!rolePermission;
  } catch (err) {
    console.error('[hasPermission] Error checking permission:', err);
    return false;
  }
}

export async function requireRole(allowedRoles: UserRole[]): Promise<any> {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    throw new Error('Unauthorized');
  }
  const userId = (session.user as any).id;
  const authorized = await hasRole(userId, allowedRoles);
  if (!authorized) {
    throw new Error('Forbidden');
  }
  return session.user;
}

export async function requirePermission(permissionName: string): Promise<any> {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    throw new Error('Unauthorized');
  }
  const userId = (session.user as any).id;
  const authorized = await hasPermission(userId, permissionName);
  if (!authorized) {
    throw new Error('Forbidden');
  }
  return session.user;
}
