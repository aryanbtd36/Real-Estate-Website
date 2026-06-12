'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Bell, 
  Mail, 
  Calendar, 
  ShieldAlert, 
  User, 
  Sparkles, 
  Check, 
  ExternalLink 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'INQUIRY' | 'APPOINTMENT' | 'PROPERTY' | 'SECURITY' | 'USER_ACTION' | 'SYSTEM';
  read: boolean;
  link: string | null;
  createdAt: string;
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch notifications from API
  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?limit=15');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // REST Polling: Check for new notifications every 10 seconds
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mark a single notification as read
  const handleMarkAsRead = async (id: string, link: string | null) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });

      if (res.ok) {
        // Optimistic UI update
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, read: true } : n))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }

    setIsOpen(false);
    if (link) {
      router.push(link);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });

      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // Get color and icon based on notification type
  const getTypeConfig = (type: NotificationItem['type']) => {
    switch (type) {
      case 'INQUIRY':
        return {
          icon: Mail,
          bgColor: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
        };
      case 'APPOINTMENT':
        return {
          icon: Calendar,
          bgColor: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
        };
      case 'SECURITY':
        return {
          icon: ShieldAlert,
          bgColor: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
        };
      case 'USER_ACTION':
        return {
          icon: User,
          bgColor: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
        };
      case 'SYSTEM':
      default:
        return {
          icon: Sparkles,
          bgColor: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
        };
    }
  };

  // Human-readable time ago helper
  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-full bg-white/5 border border-white/10 text-white/80 hover:text-[#D4AF37] hover:border-[#D4AF37]/30 transition-all focus:outline-none"
        aria-label="Toggle notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#D4AF37] text-[9px] font-bold text-black ring-2 ring-[#0A0A0A]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Luxury Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-3 w-80 sm:w-96 max-h-[500px] z-50 rounded-xl bg-[#161616]/95 backdrop-blur-md border border-white/10 shadow-[0_10px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
              <div>
                <h3 className="text-sm font-semibold tracking-wide text-white">Concierge Alerts</h3>
                <p className="text-[10px] text-white/40">{unreadCount} unread notifications</p>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-[10px] flex items-center gap-1 text-[#D4AF37] hover:text-[#F5D67B] transition-colors uppercase tracking-widest font-semibold"
                >
                  <Check size={12} />
                  <span>Dismiss All</span>
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/5 max-h-[360px] custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <Bell className="mx-auto text-white/10 mb-3" size={28} />
                  <p className="text-xs text-white/40 italic">Your inbox is clear.</p>
                  <p className="text-[10px] text-white/25 mt-1">Updates on viewings & inquiries will display here.</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const config = getTypeConfig(n.type);
                  const Icon = config.icon;
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleMarkAsRead(n.id, n.link)}
                      className={`p-4 flex gap-3.5 hover:bg-white/[0.02] cursor-pointer transition-colors relative group ${
                        !n.read ? 'bg-[#D4AF37]/[0.02]' : ''
                      }`}
                    >
                      {/* Unread indicator dot */}
                      {!n.read && (
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-[#D4AF37] rounded-full" />
                      )}

                      {/* Icon Container */}
                      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${config.bgColor}`}>
                        <Icon size={16} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 space-y-1 min-w-0 pl-1">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className={`text-xs font-semibold truncate ${!n.read ? 'text-white' : 'text-white/70'}`}>
                            {n.title}
                          </h4>
                          <span className="text-[9px] text-white/30 shrink-0 mt-0.5">
                            {formatTimeAgo(n.createdAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/50 leading-relaxed line-clamp-2">
                          {n.message}
                        </p>
                        {n.link && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] text-[#D4AF37] opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                            <span>Open Details</span>
                            <ExternalLink size={8} />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-white/5 bg-white/[0.01] text-center">
              <span className="text-[9px] uppercase tracking-widest text-white/30 font-medium">AURA ESTATES CRM SYSTEM</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
