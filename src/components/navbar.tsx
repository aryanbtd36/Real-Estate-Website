'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Menu, X, User, LogOut, LayoutDashboard, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function Navbar() {
  const { data: session } = useSession();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', href: '#home' },
    { name: 'Properties', href: '#properties' },
    { name: 'Showcase', href: '#showcase' },
    { name: 'Amenities', href: '#amenities' },
    { name: 'About', href: '#about' },
    { name: 'Testimonials', href: '#testimonials' },
    { name: 'Contact', href: '#contact' },
  ];

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled
            ? 'bg-[#0A0A0ARe] backdrop-blur-md border-b border-white/10 py-4 shadow-2xl bg-opacity-80'
            : 'bg-transparent py-6'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold tracking-[0.2em] text-[#D4AF37]">
              AURA
            </span>
            <span className="text-[10px] tracking-[0.4em] uppercase text-white/50 border-l border-white/20 pl-2">
              ESTATE
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-sm tracking-widest text-white/75 hover:text-[#D4AF37] transition-colors duration-300"
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* Auth and Actions */}
          <div className="hidden md:flex items-center space-x-4">
            {session ? (
              <div className="flex items-center space-x-4">
                <Link
                  href={(session?.user as any)?.role === 'ADMIN' ? '/admin' : '/dashboard'}
                  className="flex items-center space-x-2 text-sm text-white/80 hover:text-[#D4AF37] transition-colors"
                >
                  <User size={16} />
                  <span>{session?.user?.name || 'Account'}</span>
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="p-2 text-white/60 hover:text-red-400 transition-colors"
                  title="Sign Out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  href="/login"
                  className="text-sm text-white/85 hover:text-[#D4AF37] transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="text-sm px-4 py-2 bg-white/5 border border-white/10 hover:border-[#D4AF37] rounded transition-all duration-300 text-white"
                >
                  Register
                </Link>
              </div>
            )}
            <a
              href="#book"
              className="text-xs uppercase tracking-widest font-semibold px-5 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] text-black hover:opacity-90 rounded transition-all shadow-[0_0_15px_rgba(212,175,55,0.3)]"
            >
              Book Appointment
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden text-white/80 hover:text-white"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-[#0A0A0A] pt-28 px-6 flex flex-col justify-between pb-8 md:hidden"
          >
            <div className="flex flex-col space-y-6">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-xl tracking-widest text-white/80 hover:text-[#D4AF37] transition-colors"
                >
                  {link.name}
                </a>
              ))}
            </div>

            <div className="flex flex-col space-y-4 border-t border-white/10 pt-6">
              {session ? (
                <>
                  <Link
                    href={(session?.user as any)?.role === 'ADMIN' ? '/admin' : '/dashboard'}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center space-x-2 text-lg text-white"
                  >
                    <LayoutDashboard size={20} />
                    <span>Dashboard ({session?.user?.name})</span>
                  </Link>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      signOut({ callbackUrl: '/' });
                    }}
                    className="flex items-center space-x-2 text-lg text-red-400 text-left"
                  >
                    <LogOut size={20} />
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-lg text-white/80 hover:text-[#D4AF37]"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-lg text-[#D4AF37]"
                  >
                    Register
                  </Link>
                </>
              )}
              <a
                href="#book"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full text-center py-3 bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] text-black font-semibold rounded tracking-wider"
              >
                BOOK APPOINTMENT
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
