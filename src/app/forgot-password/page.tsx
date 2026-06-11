'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, Sparkles, ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { Turnstile } from '@/components/turnstile';

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isOAuthRedirect, setIsOAuthRedirect] = useState(false);

  useEffect(() => {
    const errParam = searchParams.get('error');
    const emailParam = searchParams.get('email');
    
    if (errParam === 'oauth-credentials-login') {
      setIsOAuthRedirect(true);
      if (emailParam) {
        setEmail(emailParam);
      }
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    if (!turnstileToken) {
      setError('Please complete Turnstile bot protection check.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstileToken }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || 'Failed to request password reset link.');
      }
    } catch (err) {
      setError('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#0A0A0A] text-white">
      {/* Left Column: Cinematic Visual */}
      <div className="hidden lg:flex lg:col-span-5 relative overflow-hidden flex-col justify-between p-12 border-r border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_40%,rgba(212,175,55,0.06),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none" />

        <Link href="/" className="flex items-center space-x-2 z-10">
          <span className="text-2xl font-bold tracking-[0.2em] text-[#D4AF37]">AURA</span>
          <span className="text-[10px] tracking-[0.4em] uppercase text-white/50 border-l border-white/20 pl-2">ESTATE</span>
        </Link>

        <div className="space-y-6 z-10 max-w-sm my-auto">
          <div className="p-3 bg-[#D4AF37]/5 border border-[#D4AF37]/10 w-fit rounded-lg text-[#F5D67B] animate-pulse">
            <Sparkles size={24} />
          </div>
          <h2 className="text-4xl font-light tracking-tight leading-tight">
            Security & <br />
            <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#F5D67B]">
              Privacy First
            </span>
          </h2>
          <p className="text-sm text-white/50 leading-relaxed font-light">
            If you have misplaced your client account credentials, you may request a secure single-use link to reset your password code.
          </p>
        </div>

        <div className="text-[10px] tracking-wider text-white/30 uppercase z-10">
          © 2026 AURA REAL ESTATE. SECURED CLIENT PROTOCOLS.
        </div>
      </div>

      {/* Right Column: Form */}
      <div className="col-span-1 lg:col-span-7 flex flex-col justify-center px-6 sm:px-12 md:px-24 py-12">
        <div className="max-w-md w-full mx-auto space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-light tracking-wide">Recover Password</h1>
            <p className="text-xs text-white/50">Enter email below to receive a secure password configuration invite.</p>
          </div>

          {isOAuthRedirect && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-[#D4AF37]/10 border border-[#D4AF37]/35 rounded flex gap-3 text-xs leading-relaxed"
            >
              <ShieldCheck className="text-[#D4AF37] shrink-0" size={18} />
              <div>
                <span className="font-bold text-[#F5D67B] block mb-0.5">Google OAuth Account Detected</span>
                Your account is currently configured to sign in via Google. Please enter your email below to configure a new password, enabling credentials-based login.
              </div>
            </motion.div>
          )}

          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-8 bg-green-500/10 border border-green-500/20 text-center rounded-xl space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-green-500/25 flex items-center justify-center text-green-400 mx-auto">
                <Check size={24} />
              </div>
              <h3 className="text-xl font-medium text-white">Reset Link Dispatched</h3>
              <p className="text-sm text-white/50 leading-relaxed">
                If an account matches that email, a secure, single-use password reset link has been sent. Please check your inbox.
              </p>
              <div className="pt-4">
                <Link href="/login" className="text-xs text-[#D4AF37] hover:underline font-semibold">
                  Back to Sign In
                </Link>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded">
                  {error}
                </div>
              )}

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

              {/* Turnstile Widget */}
              <div className="py-2">
                <Turnstile onVerify={setTurnstileToken} onError={() => setTurnstileToken('')} onExpire={() => setTurnstileToken('')} />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] text-black font-semibold uppercase tracking-wider text-xs rounded hover:opacity-95 shadow-lg flex items-center justify-center gap-2"
              >
                <span>{loading ? 'Requesting Link...' : 'Send Reset Link'}</span>
                <ArrowRight size={14} />
              </button>
            </form>
          )}

          <p className="text-xs text-center text-white/40">
            Remember your credentials?{' '}
            <Link href="/login" className="text-[#D4AF37] hover:underline font-semibold">
              Client Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-white">
        <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ForgotPasswordContent />
    </Suspense>
  );
}
