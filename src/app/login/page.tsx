'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setError('Invalid email or password. Try admin@luxury.com / adminpassword123.');
      } else {
        // Fetch session to determine role-based redirect
        const sessionRes = await fetch('/api/auth/session');
        const session = await sessionRes.json();
        
        if (session?.user?.role === 'ADMIN') {
          router.push('/admin');
        } else {
          router.push('/dashboard');
        }
        router.refresh();
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Simulated Google Sign-In (Instantly signs in with dummy user credentials for simulation)
  const handleGoogleSignInMock = async () => {
    setError('');
    setLoading(true);
    
    // Simulate by auto-filling demo credentials
    setEmail('john@example.com');
    setPassword('userpassword123');
    
    try {
      const res = await signIn('credentials', {
        redirect: false,
        email: 'john@example.com',
        password: 'userpassword123',
      });
      
      if (res?.error) {
        setError('Google authentication failed.');
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err) {
      setError('An error occurred during Google Auth simulation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#0A0A0A] text-white">
      {/* Left Column: Cinematic Visual */}
      <div className="hidden lg:flex lg:col-span-6 relative overflow-hidden flex-col justify-between p-12 border-r border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_40%,rgba(212,175,55,0.06),transparent_50%)]" />
        {/* Decorative Grid Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none" />

        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2 z-10">
          <span className="text-2xl font-bold tracking-[0.2em] text-[#D4AF37]">AURA</span>
          <span className="text-[10px] tracking-[0.4em] uppercase text-white/50 border-l border-white/20 pl-2">ESTATE</span>
        </Link>

        {/* Cinematic Quote */}
        <div className="space-y-6 z-10 max-w-md my-auto">
          <div className="p-3 bg-[#D4AF37]/5 border border-[#D4AF37]/10 w-fit rounded-lg text-[#F5D67B] animate-pulse">
            <Sparkles size={24} />
          </div>
          <h2 className="text-4xl font-light tracking-tight leading-tight">
            Elevating <br />
            <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#F5D67B]">
              Metropolitan Living
            </span>
          </h2>
          <p className="text-sm text-white/50 leading-relaxed font-light">
            Sign in to access your dashboard, inspect saved floor plans, and review site visit schedules with your personal Client Director.
          </p>
        </div>

        {/* Footnote */}
        <div className="text-[10px] tracking-wider text-white/30 uppercase z-10">
          © 2026 AURA REAL ESTATE. PRIVATE AND SECURED ACCESS ONLY.
        </div>
      </div>

      {/* Right Column: Form */}
      <div className="col-span-1 lg:col-span-6 flex flex-col justify-center px-6 sm:px-12 md:px-24 py-12">
        <div className="max-w-md w-full mx-auto space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-light tracking-wide">Client Sign In</h1>
            <p className="text-xs text-white/50">Enter your credentials below or use Google account.</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleCredentialsSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-white/40 block">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#161616] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-3.5 pl-10 rounded text-white text-sm outline-none transition-colors"
                  placeholder="name@domain.com"
                />
                <Mail className="absolute left-3.5 top-4 text-white/40" size={16} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] uppercase tracking-widest text-white/40 block">Password</label>
                <a href="#" className="text-[10px] text-[#D4AF37] hover:underline">Forgot password?</a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#161616] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-3.5 pl-10 pr-10 rounded text-white text-sm outline-none transition-colors"
                  placeholder="••••••••"
                />
                <Lock className="absolute left-3.5 top-4 text-white/40" size={16} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-4 text-white/40 hover:text-white/60"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="remember"
                className="w-4 h-4 accent-[#D4AF37] bg-[#161616] border-white/10 rounded"
              />
              <label htmlFor="remember" className="text-xs text-white/50 cursor-pointer">Remember this session</label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] text-black font-semibold uppercase tracking-wider text-xs rounded hover:opacity-95 shadow-lg flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight size={14} />
            </button>
          </form>

          <div className="relative flex items-center justify-center py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <span className="relative px-3 bg-[#0A0A0A] text-[10px] uppercase tracking-widest text-white/30">Or Continue With</span>
          </div>

          <button
            onClick={handleGoogleSignInMock}
            className="w-full py-3.5 bg-[#161616] hover:bg-white/5 border border-white/10 rounded text-xs tracking-wider font-semibold text-white/95 transition-all duration-300 flex items-center justify-center gap-2"
          >
            {/* Google G logo SVG */}
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            <span>Sign In with Google</span>
          </button>

          <p className="text-xs text-center text-white/40">
            Don't have an account?{' '}
            <Link href="/register" className="text-[#D4AF37] hover:underline font-semibold">
              Create Client Account
            </Link>
          </p>

          {/* Quick tip for testing */}
          <div className="p-4 bg-[#161616] border border-[#D4AF37]/25 rounded flex items-start gap-3">
            <ShieldCheck className="text-[#D4AF37] shrink-0 mt-0.5" size={18} />
            <div>
              <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold block">Testing Access</span>
              <p className="text-[11px] text-white/50 leading-relaxed mt-1">
                Admin: <code className="text-[#F5D67B]">admin@luxury.com</code> / <code className="text-[#F5D67B]">adminpassword123</code><br />
                User: <code className="text-[#F5D67B]">john@example.com</code> / <code className="text-[#F5D67B]">userpassword123</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
