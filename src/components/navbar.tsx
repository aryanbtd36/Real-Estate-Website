'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { 
  Menu, 
  X, 
  User, 
  LogOut, 
  LayoutDashboard, 
  Home,
  ChevronDown,
  ChevronRight,
  Compass,
  Building,
  Building2,
  TrendingUp,
  BarChart3,
  Percent,
  Navigation,
  Award,
  Calculator,
  Wallet,
  Ruler,
  ArrowLeftRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function PropertiesMenu() {
  const categories = [
    {
      name: 'Plots',
      description: 'Handpicked land parcels with RERA-checked titles and direct ownership registry.',
      href: '/plots',
      icon: Compass,
      color: 'text-indigo-400 bg-indigo-950/40 border-indigo-900/50',
    },
    {
      name: 'Residencies',
      description: 'Premium villas, luxury duplexes, and high-end gated estate communities.',
      href: '/residencies',
      icon: Home,
      color: 'text-rose-400 bg-rose-950/40 border-rose-900/50',
    },
    {
      name: 'Apartments',
      description: 'High-rise studios, premium flats, and penthouses in Lucknow\'s active corridors.',
      href: '/apartments',
      icon: Building,
      color: 'text-amber-400 bg-amber-950/40 border-amber-900/50',
    },
    {
      name: 'Commercial',
      description: 'Strategic retail storefronts, office suites, and commercial workspace corridors.',
      href: '/apartments?type=commercial',
      icon: Building2,
      color: 'text-emerald-400 bg-emerald-950/40 border-emerald-900/50',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-5">
      {categories.map((cat) => (
        <Link
          key={cat.name}
          href={cat.href}
          className="flex gap-4 p-3.5 rounded-2xl hover:bg-slate-700/60 transition-colors border border-transparent hover:border-slate-700/60 group text-left"
        >
          <div className={`p-2.5 rounded-xl border shrink-0 flex items-center justify-center h-11 w-11 transition-transform group-hover:scale-105 duration-200 ${cat.color}`}>
            <cat.icon size={20} />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1">
              <span>{cat.name}</span>
              <ChevronRight size={10} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-slate-500" />
            </h4>
            <p className="text-[11px] leading-relaxed text-slate-400 font-normal">{cat.description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function IntelligenceMenu() {
  const items = [
    {
      name: 'Growth Trends',
      description: 'Appreciation history & CAGR metrics.',
      href: '/investment-intelligence#growth',
      icon: TrendingUp,
    },
    {
      name: 'Demand Analytics',
      description: 'Locality interest and buyer volumes.',
      href: '/investment-intelligence#demand',
      icon: BarChart3,
    },
    {
      name: 'Rental Yield',
      description: 'Optimize cashflow with yield ratings.',
      href: '/investment-intelligence#yield',
      icon: Percent,
    },
    {
      name: 'Emerging Corridors',
      description: 'Transit zones & growth hotspots.',
      href: '/investment-intelligence#corridors',
      icon: Navigation,
    },
    {
      name: 'Locality Rankings',
      description: 'Appreciation scorecard index database.',
      href: '/investment-intelligence#rankings',
      icon: Award,
    },
  ];

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-7 space-y-2">
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-2 px-1">Research & Analytics</span>
        <div className="space-y-1">
          {items.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-700/60 transition-colors border border-transparent hover:border-slate-700/60 group text-left"
            >
              <div className="p-1.5 rounded-lg bg-slate-700 text-blue-400 shrink-0 group-hover:bg-blue-900/50 group-hover:text-blue-300 transition-colors">
                <item.icon size={14} />
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold text-slate-200 block">{item.name}</span>
                <span className="text-[9.5px] text-slate-450 font-normal block leading-tight">{item.description}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
      
      <div className="col-span-5 bg-gradient-to-br from-blue-950/40 via-slate-900 to-slate-950 text-white p-4.5 rounded-2xl flex flex-col justify-between shadow-premium border border-slate-700/50 relative overflow-hidden text-left min-h-[220px]">
        <div className="absolute -top-12 -right-12 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="space-y-2.5 z-10">
          <span className="px-2 py-0.5 bg-blue-900/40 backdrop-blur-md rounded-full text-[8px] font-bold tracking-widest uppercase text-emerald-400 border border-blue-800/30 inline-block">
            Featured Insight
          </span>
          <h4 className="text-xs font-black tracking-tight leading-snug">
            Lucknow Q2 Appreciation Dossier
          </h4>
          <p className="text-[10px] leading-relaxed text-slate-350 font-medium">
            Gomti Nagar extension and Sector 4 index values increase by 12.4% YoY. Registry volume peaks at record highs.
          </p>
        </div>

        <Link
          href="/investment-intelligence"
          className="mt-4 py-2 px-3 bg-blue-600 hover:bg-blue-700 border border-blue-500/20 rounded-xl text-[9px] font-bold uppercase tracking-wider text-center text-white backdrop-blur-sm transition-all duration-200 z-10 block"
        >
          Read Intelligence Dossier
        </Link>
      </div>
    </div>
  );
}

function ToolsMenu() {
  const tools = [
    {
      name: 'EMI Calculator',
      description: 'Preview monthly principal & interest layouts.',
      href: '/tools#emi',
      icon: Calculator,
      color: 'text-violet-400 bg-violet-950/40 border border-violet-900/30',
    },
    {
      name: 'Rental Yield Calculator',
      description: 'Evaluate lease returns and net rental cap rates.',
      href: '/tools#yield',
      icon: Percent,
      color: 'text-emerald-400 bg-emerald-950/40 border border-emerald-900/30',
    },
    {
      name: 'Affordability Calculator',
      description: 'Acquisition boundaries based on savings & income.',
      href: '/tools#affordability',
      icon: Wallet,
      color: 'text-indigo-400 bg-indigo-950/40 border border-indigo-900/30',
    },
    {
      name: 'Unit Converter',
      description: 'Convert Sq Yards, Sq Feet, Bigha, and Acres.',
      href: '/tools#converter',
      icon: Ruler,
      color: 'text-amber-400 bg-amber-950/40 border border-amber-900/30',
    },
    {
      name: 'Property Comparison',
      description: 'Compare legal, price index & specs side-by-side.',
      href: '/tools#compare',
      icon: ArrowLeftRight,
      color: 'text-rose-400 bg-rose-950/40 border border-rose-900/30',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {tools.map((tool) => (
        <Link
          key={tool.name}
          href={tool.href}
          className="flex gap-3 p-2.5 rounded-xl hover:bg-slate-700/60 transition-colors border border-transparent hover:border-slate-700/60 group text-left"
        >
          <div className={`p-2 rounded-lg shrink-0 flex items-center justify-center h-9 w-9 transition-transform group-hover:scale-105 duration-200 border ${tool.color}`}>
            <tool.icon size={16} />
          </div>
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold text-slate-200 block flex items-center gap-1">
              <span>{tool.name}</span>
              <ChevronRight size={8} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-slate-500" />
            </span>
            <span className="text-[9.5px] leading-snug text-slate-450 font-normal block">{tool.description}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function Navbar() {
  const { data: session } = useSession();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [activeMenu, setActiveMenu] = useState<'properties' | 'intelligence' | 'tools' | null>(null);

  const [isMobilePropertiesOpen, setIsMobilePropertiesOpen] = useState(false);
  const [isMobileIntelligenceOpen, setIsMobileIntelligenceOpen] = useState(false);
  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleMouseEnter = (menu: 'properties' | 'intelligence' | 'tools') => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setActiveMenu(menu);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setActiveMenu(null);
    }, 150);
  };

  const handlePanelMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };

  const handlePanelMouseLeave = () => {
    handleMouseLeave();
  };

  const getMenuWidth = () => {
    if (activeMenu === 'properties') return 560;
    if (activeMenu === 'intelligence') return 680;
    if (activeMenu === 'tools') return 560;
    return 400;
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-slate-800/95 backdrop-blur-xl border-b border-slate-700/60 py-3 shadow-sm'
            : 'bg-slate-800/95 backdrop-blur-xl border-b border-slate-700/60 py-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center relative">
          <Link 
            href="/" 
            className="flex items-center space-x-2"
            onMouseEnter={() => setActiveMenu(null)}
          >
            <span className="text-xl font-bold tracking-tight text-white">
              Aura Estates
            </span>
            <span className="hidden sm:inline-block text-[9px] tracking-widest uppercase text-slate-500 border-l border-slate-700/60 pl-2">
              Decision Support
            </span>
          </Link>

          <div className="hidden lg:flex items-center space-x-6 relative py-1">
            <Link
              href="/"
              className="text-xs font-semibold tracking-wider text-slate-300 hover:text-white transition-colors duration-200 py-1"
              onMouseEnter={() => setActiveMenu(null)}
            >
              Home
            </Link>

            <div
              className="relative py-1 cursor-pointer"
              onMouseEnter={() => handleMouseEnter('properties')}
              onMouseLeave={handleMouseLeave}
            >
              <span className={`text-xs font-semibold tracking-wider transition-colors duration-200 flex items-center gap-1 ${activeMenu === 'properties' ? 'text-blue-400' : 'text-slate-300 hover:text-white'}`}>
                Properties
                <ChevronDown size={12} className={`transition-transform duration-200 ${activeMenu === 'properties' ? 'rotate-180 text-blue-400' : 'text-slate-500'}`} />
              </span>
            </div>

            <div
              className="relative py-1 cursor-pointer"
              onMouseEnter={() => handleMouseEnter('intelligence')}
              onMouseLeave={handleMouseLeave}
            >
              <span className={`text-xs font-semibold tracking-wider transition-colors duration-200 flex items-center gap-1 ${activeMenu === 'intelligence' ? 'text-blue-400' : 'text-slate-300 hover:text-white'}`}>
                Investment Intelligence
                <ChevronDown size={12} className={`transition-transform duration-200 ${activeMenu === 'intelligence' ? 'rotate-180 text-blue-400' : 'text-slate-500'}`} />
              </span>
            </div>

            <div
              className="relative py-1 cursor-pointer"
              onMouseEnter={() => handleMouseEnter('tools')}
              onMouseLeave={handleMouseLeave}
            >
              <span className={`text-xs font-semibold tracking-wider transition-colors duration-200 flex items-center gap-1 ${activeMenu === 'tools' ? 'text-blue-400' : 'text-slate-300 hover:text-white'}`}>
                Tools
                <ChevronDown size={12} className={`transition-transform duration-200 ${activeMenu === 'tools' ? 'rotate-180 text-blue-400' : 'text-slate-500'}`} />
              </span>
            </div>

            <Link
              href="/about"
              className="text-xs font-semibold tracking-wider text-slate-300 hover:text-white transition-colors duration-200 py-1"
              onMouseEnter={() => setActiveMenu(null)}
            >
              About
            </Link>

            <Link
              href="/contact"
              className="text-xs font-semibold tracking-wider text-slate-300 hover:text-white transition-colors duration-200 py-1"
              onMouseEnter={() => setActiveMenu(null)}
            >
              Contact
            </Link>

            <AnimatePresence>
              {activeMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0, 
                    scale: 1,
                    width: getMenuWidth(),
                  }}
                  exit={{ opacity: 0, y: 12, scale: 0.96 }}
                  transition={{ 
                    type: 'spring',
                    stiffness: 380,
                    damping: 32,
                    mass: 0.8
                  }}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-3 bg-slate-800/95 backdrop-blur-xl border border-slate-700/60 rounded-[24px] p-6 z-50 text-left pointer-events-auto origin-top"
                  onMouseEnter={handlePanelMouseEnter}
                  onMouseLeave={handlePanelMouseLeave}
                  style={{
                    boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.4), 0 1px 4px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeMenu}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                    >
                      {activeMenu === 'properties' && <PropertiesMenu />}
                      {activeMenu === 'intelligence' && <IntelligenceMenu />}
                      {activeMenu === 'tools' && <ToolsMenu />}
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div 
            className="hidden lg:flex items-center space-x-4"
            onMouseEnter={() => setActiveMenu(null)}
          >
            {session ? (
              <div className="flex items-center space-x-4">
                <Link
                  href={((session?.user as any)?.role === 'ADMIN' || (session?.user as any)?.role === 'SUPER_ADMIN') ? '/admin' : '/dashboard'}
                  className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  <User size={14} className="text-blue-400" />
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
                  className="text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="text-xs font-semibold px-3 py-1.5 border border-slate-600 text-slate-200 hover:bg-slate-700 rounded transition-colors"
                >
                  Register
                </Link>
              </div>
            )}
            <Link
              href={session ? '/dashboard' : '/login'}
              className="text-xs font-semibold px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors shadow-sm"
            >
              Post Property
            </Link>
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-45 bg-slate-800 pt-24 px-6 flex flex-col justify-between pb-8 lg:hidden border-b border-slate-700/60 shadow-lg"
          >
            <div className="flex flex-col space-y-4 overflow-y-auto max-h-[calc(100vh-280px)] pr-2 py-2">
              <Link
                href="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-base font-bold text-slate-200 hover:text-white transition-colors py-1 text-left"
              >
                Home
              </Link>

              <div className="space-y-2">
                <button
                  onClick={() => setIsMobilePropertiesOpen(!isMobilePropertiesOpen)}
                  className="w-full flex justify-between items-center text-base font-bold text-slate-200 hover:text-white py-1"
                >
                  <span>Properties</span>
                  <ChevronDown size={18} className={`transition-transform duration-200 ${isMobilePropertiesOpen ? 'rotate-180 text-blue-400' : 'text-slate-500'}`} />
                </button>
                <AnimatePresence>
                  {isMobilePropertiesOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden pl-4 border-l border-slate-700 flex flex-col space-y-2.5 text-left"
                    >
                      <Link href="/plots" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-semibold text-slate-400 hover:text-white">Plots</Link>
                      <Link href="/residencies" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-semibold text-slate-400 hover:text-white">Residencies</Link>
                      <Link href="/apartments" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-semibold text-slate-400 hover:text-white">Apartments</Link>
                      <Link href="/apartments?type=commercial" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-semibold text-slate-400 hover:text-white">Commercial</Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => setIsMobileIntelligenceOpen(!isMobileIntelligenceOpen)}
                  className="w-full flex justify-between items-center text-base font-bold text-slate-200 hover:text-white py-1"
                >
                  <span>Investment Intelligence</span>
                  <ChevronDown size={18} className={`transition-transform duration-200 ${isMobileIntelligenceOpen ? 'rotate-180 text-blue-400' : 'text-slate-500'}`} />
                </button>
                <AnimatePresence>
                  {isMobileIntelligenceOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden pl-4 border-l border-slate-700 flex flex-col space-y-2.5 text-left"
                    >
                      <Link href="/investment-intelligence#growth" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-semibold text-slate-400 hover:text-white">Growth Trends</Link>
                      <Link href="/investment-intelligence#demand" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-semibold text-slate-400 hover:text-white">Demand Analytics</Link>
                      <Link href="/investment-intelligence#yield" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-semibold text-slate-400 hover:text-white">Rental Yield</Link>
                      <Link href="/investment-intelligence#corridors" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-semibold text-slate-400 hover:text-white">Emerging Corridors</Link>
                      <Link href="/investment-intelligence#rankings" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-semibold text-slate-400 hover:text-white">Locality Rankings</Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => setIsMobileToolsOpen(!isMobileToolsOpen)}
                  className="w-full flex justify-between items-center text-base font-bold text-slate-200 hover:text-white py-1"
                >
                  <span>Tools</span>
                  <ChevronDown size={18} className={`transition-transform duration-200 ${isMobileToolsOpen ? 'rotate-180 text-blue-400' : 'text-slate-500'}`} />
                </button>
                <AnimatePresence>
                  {isMobileToolsOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden pl-4 border-l border-slate-700 flex flex-col space-y-2.5 text-left"
                    >
                      <Link href="/tools#emi" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-semibold text-slate-400 hover:text-white">EMI Calculator</Link>
                      <Link href="/tools#yield" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-semibold text-slate-400 hover:text-white">Rental Yield Calculator</Link>
                      <Link href="/tools#affordability" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-semibold text-slate-400 hover:text-white">Affordability Calculator</Link>
                      <Link href="/tools#converter" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-semibold text-slate-400 hover:text-white">Unit Converter</Link>
                      <Link href="/tools#compare" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-semibold text-slate-400 hover:text-white">Property Comparison</Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Link
                href="/about"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-base font-bold text-slate-200 hover:text-white transition-colors py-1 text-left"
              >
                About
              </Link>

              <Link
                href="/contact"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-base font-bold text-slate-200 hover:text-white transition-colors py-1 text-left"
              >
                Contact
              </Link>
            </div>

            <div className="flex flex-col space-y-4 border-t border-slate-700 pt-6">
              {session ? (
                <>
                  <Link
                    href={((session?.user as any)?.role === 'ADMIN' || (session?.user as any)?.role === 'SUPER_ADMIN') ? '/admin' : '/dashboard'}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center space-x-2 text-sm font-semibold text-slate-300"
                  >
                    <LayoutDashboard size={18} className="text-blue-400" />
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
                    className="flex-1 text-center py-2.5 border border-slate-650 rounded text-slate-200 font-semibold text-sm hover:bg-slate-700"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex-1 text-center py-2.5 bg-blue-600 text-white rounded font-semibold text-sm hover:bg-blue-700"
                  >
                    Register
                  </Link>
                </div>
              )}
              <Link
                href={session ? '/dashboard' : '/login'}
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full text-center py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded text-sm tracking-wider"
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
