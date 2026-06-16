import { db } from './db';
import { UserRole } from '@prisma/client';

export function resolveUserRole(email: string, dbRole?: string): UserRole {
  if (email.toLowerCase() === 'aryanmishra8113@gmail.com') {
    return UserRole.SUPER_ADMIN;
  }
  return (dbRole as UserRole) || UserRole.USER;
}

export const RoleService = {
  /**
   * Retrieves the user's role from the database.
   * Ensures the initial administrator email is always resolved as SUPER_ADMIN.
   */
  async getUserRole(email: string): Promise<UserRole> {
    if (email.toLowerCase() === 'aryanmishra8113@gmail.com') {
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
};
