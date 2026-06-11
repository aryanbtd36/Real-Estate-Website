import { db } from './db';

/**
 * Resolves user role for initial database creation only.
 * Do NOT use this for runtime checks; query the database or RoleService instead.
 */
export function resolveUserRole(email: string, dbRole?: string): string {
  if (email.toLowerCase() === 'aryanmishra8113@gmail.com') {
    return 'ADMIN';
  }
  return dbRole || 'USER';
}

export const RoleService = {
  /**
   * Retrieves the user's role from the database.
   * Ensures the initial administrator email is always resolved as ADMIN.
   */
  async getUserRole(email: string): Promise<string> {
    if (email.toLowerCase() === 'aryanmishra8113@gmail.com') {
      return 'ADMIN';
    }

    try {
      const user = await db.user.findUnique({
        where: { email },
        select: { role: true },
      });
      return user?.role || 'USER';
    } catch (error) {
      console.error('RoleService getUserRole error:', error);
      return 'USER';
    }
  },

  /**
   * Validates if the user has ADMIN privileges.
   */
  async isAdmin(email: string): Promise<boolean> {
    const role = await this.getUserRole(email);
    return role === 'ADMIN';
  },
};
