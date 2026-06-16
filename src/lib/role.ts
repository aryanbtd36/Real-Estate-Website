import { db } from './db';
import { UserRole } from '@prisma/client';

export function resolveUserRole(email: string, dbRole?: string): UserRole {
  const normalized = email.toLowerCase();
  if (normalized === 'aryanmishra8113@gmail.com') {
    return UserRole.FOUNDER_SUPER_ADMIN;
  }
  if (normalized === 'mishraaryan3662@gmail.com') {
    return UserRole.PRIMARY_SUPER_ADMIN;
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
    if (normalized === 'aryanmishra8113@gmail.com') {
      return UserRole.FOUNDER_SUPER_ADMIN;
    }
    if (normalized === 'mishraaryan3662@gmail.com') {
      return UserRole.PRIMARY_SUPER_ADMIN;
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
   * Validates if the user has ADMIN, PRIMARY_SUPER_ADMIN or FOUNDER_SUPER_ADMIN privileges.
   */
  async isAdmin(email: string): Promise<boolean> {
    const role = await this.getUserRole(email);
    return role === 'ADMIN' || role === 'PRIMARY_SUPER_ADMIN' || role === 'FOUNDER_SUPER_ADMIN';
  },

  /**
   * Validates if the user has SUPER_ADMIN / PRIMARY_SUPER_ADMIN / FOUNDER_SUPER_ADMIN privileges.
   */
  async isSuperAdmin(email: string): Promise<boolean> {
    const role = await this.getUserRole(email);
    return role === 'PRIMARY_SUPER_ADMIN' || role === 'FOUNDER_SUPER_ADMIN';
  },

  /**
   * Validates if the user has FOUNDER_SUPER_ADMIN privileges.
   */
  async isFounder(email: string): Promise<boolean> {
    const role = await this.getUserRole(email);
    return role === 'FOUNDER_SUPER_ADMIN';
  }
};
