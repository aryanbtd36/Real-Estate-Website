import React from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { UserStatus } from '@prisma/client';

import { AdminSidebar } from '@/components/admin-sidebar';
import { NotificationCenter } from '@/components/notification-center';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect('/login');
  }

  // Double-verify ADMIN role and ACTIVE status against the database (single source of truth)
  const dbUser = await db.user.findUnique({
    where: { email: session.user.email },
    select: { role: true, status: true },
  });

  if (!dbUser || (dbUser.role !== 'ADMIN' && dbUser.role !== 'SUPER_ADMIN')) {
    console.warn(`[SECURITY MONITOR] Forbidden admin access attempt by: ${session.user.email}`);
    redirect('/');
  }

  if (dbUser.status === UserStatus.SUSPENDED) {
    console.warn(`[SECURITY MONITOR] Suspended administrator access attempt blocked: ${session.user.email}`);
    redirect('/login?error=suspended');
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col md:flex-row">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Admin Top Header Bar */}
        <header className="h-16 border-b border-white/5 bg-[#161616]/40 flex items-center justify-between px-6 sm:px-12 shrink-0">
          <div>
            <span className="text-[10px] tracking-[0.2em] uppercase text-white/40 font-semibold">Luxury CRM Hub</span>
          </div>
          <div className="flex items-center space-x-4">
            {/* Notification Bell Dropdown */}
            <NotificationCenter />
          </div>
        </header>

        {/* Main Administrative Views */}
        <main className="flex-1 p-6 sm:p-12 overflow-y-auto max-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
