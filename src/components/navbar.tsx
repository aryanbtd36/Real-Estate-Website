'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Menu, X, User, LogOut, LayoutDashboard, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function Navbar() {
  const { data: session } = useSession();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Plots', href: '/plots' },
    { name: 'Residencies', href: '/residencies' },
    { name: 'Apartments', href: '/apartments' },
    { name: 'Investment Intelligence', href: '/investment-intelligence' },
    { name: 'Tools', href: '/tools' },
    { name: 'About', href: '/about' },
    { name: 'Contact', href: '/contact' },
  ];

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-white/95 backdrop-blur-md border-b border-slate-100 py-3 shadow-sm'
            : 'bg-white py-4 border-b border-slate-100'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold tracking-tight text-trust-blue">
              Aura Estates
            </span>
            <span className="hidden sm:inline-block text-[9px] tracking-widest uppercase text-slate-400 border-l border-slate-200 pl-2">
              Decision Support
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center space-x-6">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-xs font-semibold tracking-wider text-slate-600 hover:text-trust-blue transition-colors duration-200"
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Auth and Actions */}
          <div className="hidden lg:flex items-center space-x-4">
            {session ? (
              <div className="flex items-center space-x-4">
                <Link
                  href={((session?.user as any)?.role === 'ADMIN' || (session?.user as any)?.role === 'SUPER_ADMIN') ? '/admin' : '/dashboard'}
                  className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 hover:text-trust-blue transition-colors"
                >
                  <User size={14} className="text-trust-blue" />
                  <span>{session?.user?.name || 'Account'}</span>
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                  title="Sign Out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  href="/login"
                  className="text-xs font-semibold text-slate-600 hover:text-trust-blue transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="text-xs font-semibold px-3 py-1.5 border border-slate-200 text-slate-700 hover:border-trust-blue hover:text-trust-blue rounded transition-colors"
                >
                  Register
                </Link>
              </div>
            )}
            <Link
              href={session ? '/dashboard' : '/login'}
              className="text-xs font-semibold px-4 py-2 bg-trust-blue text-white hover:bg-trust-blue-hover rounded transition-colors shadow-sm"
            >
              Post Property
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden text-slate-600 hover:text-trust-blue"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-45 bg-white pt-24 px-6 flex flex-col justify-between pb-8 lg:hidden border-b border-slate-100 shadow-lg"
          >
            <div className="flex flex-col space-y-4">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-base font-semibold text-slate-700 hover:text-trust-blue transition-colors"
                >
                  {link.name}
                </Link>
              ))}
            </div>

            <div className="flex flex-col space-y-4 border-t border-slate-100 pt-6">
              {session ? (
                <>
                  <Link
                    href={((session?.user as any)?.role === 'ADMIN' || (session?.user as any)?.role === 'SUPER_ADMIN') ? '/admin' : '/dashboard'}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center space-x-2 text-sm font-semibold text-slate-700"
                  >
                    <LayoutDashboard size={18} className="text-trust-blue" />
                    <span>Dashboard ({session?.user?.name})</span>
                  </Link>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      signOut({ callbackUrl: '/' });
                    }}
                    className="flex items-center space-x-2 text-sm font-semibold text-red-500 text-left"
                  >
                    <LogOut size={18} />
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <div className="flex gap-4">
                  <Link
                    href="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex-1 text-center py-2.5 border border-slate-200 rounded text-slate-700 font-semibold text-sm hover:border-trust-blue"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex-1 text-center py-2.5 bg-trust-blue text-white rounded font-semibold text-sm hover:bg-trust-blue-hover"
                  >
                    Register
                  </Link>
                </div>
              )}
              <Link
                href={session ? '/dashboard' : '/login'}
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full text-center py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded text-sm tracking-wider"
              >
                POST PROPERTY
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
