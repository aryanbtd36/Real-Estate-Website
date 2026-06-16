'use client';

import React from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building,
  Calendar,
  Users as UsersIcon,
  LogOut,
  Home as HomeIcon,
  Mail,
  Clock,
  BarChart2,
  ShieldAlert,
  Compass,
  UserCheck
} from 'lucide-react';

export function AdminSidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const userRole = (session?.user as any)?.role;

  const navigationItems = [
    { href: '/admin', name: 'Dashboard stats', icon: LayoutDashboard, exact: true },
    { href: '/admin/analytics', name: 'BI Analytics', icon: BarChart2, exact: false },
    { href: '/admin/users', name: 'Client CRM', icon: UsersIcon, exact: false },
    { href: '/admin/properties', name: 'Manage residences', icon: Building, exact: false },
    { href: '/admin/appointments', name: 'Visits manager', icon: Calendar, exact: false },
    { href: '/admin/inquiries', name: 'Concierge leads', icon: Mail, exact: false },
    { href: '/admin/audit-logs', name: 'Audit logs', icon: Clock, exact: false },
  ];

  const isSuper = userRole === 'PRIMARY_SUPER_ADMIN' || userRole === 'FOUNDER_SUPER_ADMIN';
  if (isSuper) {
    navigationItems.push(
      { href: '/admin/admins', name: 'Manage admins', icon: UserCheck, exact: false },
      { href: '/admin/security', name: 'Security SOC', icon: ShieldAlert, exact: false },
      { href: '/admin/super-admin', name: 'Executive center', icon: Compass, exact: false }
    );
  }

  if (userRole === 'FOUNDER_SUPER_ADMIN') {
    navigationItems.push(
      { href: '/founder', name: 'Founder console', icon: ShieldAlert, exact: false }
    );
  }

  const isActive = (item: typeof navigationItems[0]) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  const getRoleTitleAndBadge = (role: string) => {
    switch (role) {
      case 'FOUNDER_SUPER_ADMIN':
        return { title: '👑 Founder Super Administrator', badge: 'IMMORTAL' };
      case 'PRIMARY_SUPER_ADMIN':
        return { title: '🛡️ Primary Super Administrator', badge: 'PRIMARY SA' };
      case 'ADMIN':
        return { title: 'Administrator', badge: 'ADMIN' };
      default:
        return { title: 'Client', badge: 'USER' };
    }
  };
  const { title: displayTitle, badge: displayBadge } = getRoleTitleAndBadge(userRole || 'USER');

  return (
    <aside className="w-full md:w-72 bg-[#161616] border-r border-white/5 flex flex-col justify-between p-6 shrink-0 md:min-h-screen">
      <div className="space-y-8">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-2xl font-bold tracking-[0.2em] text-[#D4AF37]">AURA</span>
          <span className="text-[10px] tracking-[0.4em] uppercase text-white/50 border-l border-white/20 pl-2">ESTATE</span>
        </Link>

        {/* User Badge */}
        <div className="p-4 bg-[#1E1E1E] rounded-lg border border-white/5 flex flex-col gap-2">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#F5D67B] font-semibold">
              {session?.user?.name?.charAt(0) || 'A'}
            </div>
            <div className="overflow-hidden flex-1">
              <span className="text-[10px] text-[#D4AF37] block font-bold truncate uppercase">{displayTitle}</span>
              <span className="text-sm font-medium text-white truncate block max-w-[150px]">{session?.user?.name || 'User'}</span>
            </div>
          </div>
          <div className="flex justify-start">
            <span className={`text-[8px] font-extrabold tracking-wider px-2 py-0.5 rounded border ${
              userRole === 'FOUNDER_SUPER_ADMIN' ? 'bg-[#D4AF37]/15 border-[#D4AF37]/30 text-[#D4AF37]' :
              userRole === 'PRIMARY_SUPER_ADMIN' ? 'bg-blue-500/10 border-blue-500/25 text-blue-400' :
              userRole === 'ADMIN' ? 'bg-green-500/10 border-green-500/25 text-green-400' :
              'bg-white/5 border-white/10 text-white/50'
            }`}>
              {displayBadge}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col space-y-1">
          {navigationItems.map(item => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded text-sm text-left transition-colors ${
                  active
                    ? 'bg-gradient-to-r from-[#D4AF37]/20 to-[#F5D67B]/5 text-[#F5D67B] border-l-2 border-[#D4AF37]'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Actions */}
      <div className="space-y-2 pt-6 border-t border-white/5 mt-6">
        <Link
          href="/"
          className="flex items-center space-x-3 px-4 py-3 rounded text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          <HomeIcon size={18} />
          <span>Go to Site</span>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded text-sm text-red-400 hover:bg-red-500/5 transition-colors text-left"
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
