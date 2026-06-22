'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';
import { Turnstile } from '@/components/turnstile';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!turnstileToken) {
      setError('Please complete the Turnstile bot verification check.');
      return;
    }

    setLoading(true);

    try {
      const res = await signIn('credentials', {
        redirect: false,
        email,
        password,
        turnstileToken,
      });

      if (res?.error) {
        if (res.error === 'OAuthUserNoPassword') {
          router.push(`/forgot-password?error=oauth-credentials-login&email=${encodeURIComponent(email)}`);
        } else {
          setError('Invalid credentials or account temporarily unavailable.');
        }
      } else {
        const sessionRes = await fetch('/api/auth/session');
        const session = await sessionRes.json();
        
        if (session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN') {
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

  const handleGoogleSignIn = () => {
    setError('');
    signIn('google', { callbackUrl: '/dashboard' });
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-white text-slate-900 font-sans antialiased">
      {/* Left Column: Decision Support Context */}
      <div className="hidden lg:flex lg:col-span-6 relative overflow-hidden flex-col justify-between p-12 bg-slate-50 border-r border-slate-200">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2 z-10">
          <span className="text-xl font-bold tracking-tight text-trust-blue">Aura Estates</span>
          <span className="text-[10px] tracking-widest uppercase text-slate-400 border-l border-slate-200 pl-2">Decision Support</span>
        </Link>

        {/* Narrative info */}
        <div className="space-y-6 z-10 max-w-md my-auto text-left">
          <div className="p-3 bg-trust-blue/10 w-fit rounded-lg text-trust-blue">
            <ShieldCheck size={24} />
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight leading-none text-slate-900">
            Make Better <br />
            <span className="text-trust-blue">Property Decisions</span>
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed font-normal">
            Sign in to check pending site visit details, examine saved property records, track transaction price history, and chat with your localized support desk.
          </p>
        </div>

        {/* Footnote */}
        <div className="text-[10px] tracking-wider text-slate-400 uppercase z-10">
          © 2026 AURA ESTATES. REGISTERED DECISION SUPPORT DESK.
        </div>
      </div>

      {/* Right Column: Form */}
      <div className="col-span-1 lg:col-span-6 flex flex-col justify-center px-6 sm:px-12 md:px-24 py-12">
        <div className="max-w-md w-full mx-auto space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Client Sign In</h1>
            <p className="text-xs text-slate-500">Enter your credentials below or use your Google account.</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleCredentialsSubmit} className="space-y-5 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-trust-blue p-3 pl-10 rounded-lg text-slate-700 text-sm outline-none transition-colors"
                  placeholder="name@domain.com"
                />
                <Mail className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Password</label>
                <Link href="/forgot-password" className="text-[10px] text-trust-blue hover:underline font-bold">Forgot password?</Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-trust-blue p-3 pl-10 pr-10 rounded-lg text-slate-700 text-sm outline-none transition-colors"
                  placeholder="••••••••"
                />
                <Lock className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="remember"
                  className="w-4 h-4 accent-trust-blue bg-slate-50 border-slate-200 rounded"
                />
                <label htmlFor="remember" className="text-xs text-slate-500 cursor-pointer">Remember this session</label>
              </div>
            </div>

            {/* Turnstile Widget */}
            <div className="py-1">
              <Turnstile onVerify={setTurnstileToken} onError={() => setTurnstileToken('')} onExpire={() => setTurnstileToken('')} />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-trust-blue hover:bg-trust-blue-hover text-white font-bold uppercase tracking-wider text-xs rounded-lg shadow transition-colors flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight size={14} />
            </button>
          </form>

          <div className="relative flex items-center justify-center py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <span className="relative px-3 bg-white text-[10px] uppercase tracking-widest text-slate-400 font-bold">Or Continue With</span>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-bold text-slate-700 transition-colors flex items-center justify-center gap-2"
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

          <p className="text-xs text-center text-slate-500">
            Don't have an account?{' '}
            <Link href="/register" className="text-trust-blue hover:underline font-bold">
              Create Client Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
