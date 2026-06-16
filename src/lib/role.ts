import { db } from './db';
import { UserRole } from '@prisma/client';

export function resolveUserRole(email: string, dbRole?: string): UserRole {
  const normalized = email.toLowerCase();
  if (normalized === 'aryanmishra8113@gmail.com' || normalized === 'mishraaryan3662@gmail.com') {
    return UserRole.SUPER_ADMIN;
  }
  return (dbRole as UserRole) || UserRole.USER;
}

export const RoleService = {
  /**
   * Retrieves the user's role from the database.
   * Ensures the initial administrator emails are always resolved correctly.
   */
  async getUserRole(email: string): Promise<UserRole> {
    const normalized = email.toLowerCase();
    if (normalized === 'aryanmishra8113@gmail.com' || normalized === 'mishraaryan3662@gmail.com') {
      return UserRole.SUPER_ADMIN;
    }

    try {
      const user = await db.user.findUnique({
        where: { email },
        select: { role: true },
      });
      return user?.role || UserRole.USER;
    } catch (error) {
      console.error('RoleService getUserRole error:', error);
      return UserRole.USER;
    }
  },

  /**
   * Validates if the user has ADMIN or SUPER_ADMIN privileges.
   */
  async isAdmin(email: string): Promise<boolean> {
    const role = await this.getUserRole(email);
    return role === 'ADMIN' || role === 'SUPER_ADMIN';
  },

  /**
   * Validates if the user has SUPER_ADMIN privileges.
   */
  async isSuperAdmin(email: string): Promise<boolean> {
    const role = await this.getUserRole(email);
    return role === 'SUPER_ADMIN';
  },

  /**
   * Validates if the user is the Founder (Immortal).
   */
  async isFounder(email: string): Promise<boolean> {
    const normalized = email.toLowerCase();
    if (normalized === 'aryanmishra8113@gmail.com') {
      return true;
    }
    try {
      const user = await db.user.findUnique({
        where: { email },
        select: { isFounder: true },
      });
      return !!user?.isFounder;
    } catch {
      return false;
    }
  }
};
