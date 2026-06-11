import React from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RoleService } from '@/lib/role';
import { redirect } from 'next/navigation';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect('/login');
  }

  // Double-verify ADMIN role against the database (single source of truth)
  const isUserAdmin = await RoleService.isAdmin(session.user.email);

  if (!isUserAdmin) {
    console.warn(`[SECURITY MONITOR] Forbidden admin access attempt by: ${session.user.email}`);
    redirect('/'); // Redirect non-admins to main home page
  }

  return <>{children}</>;
}
