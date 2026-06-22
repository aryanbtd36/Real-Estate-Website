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
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-white text-slate-900 font-sans antialiased">
      {/* Left Column: Decision Support Context */}
      <div className="hidden lg:flex lg:col-span-6 relative overflow-hidden flex-col justify-between p-12 bg-slate-50 border-r border-slate-200">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2 z-10">
          <span className="text-xl font-bold tracking-tight text-trust-blue">Aura Estates</span>
          <span className="text-[10px] tracking-widest uppercase text-slate-400 border-l border-slate-200 pl-2">Decision Support</span>
        </Link>

        {/* Narrative info */}
        <div className="space-y-6 z-10 max-w-sm my-auto text-left">
          <div className="p-3 bg-trust-blue/10 w-fit rounded-lg text-trust-blue">
            <Mail size={24} />
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight leading-none text-slate-900">
            Account <br />
            <span className="text-trust-blue">Security</span>
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed font-normal">
            If you have misplaced your client account credentials, you may request a secure single-use link to reset your password code.
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
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Recover Password</h1>
            <p className="text-xs text-slate-500">Enter email below to receive a secure password configuration invite.</p>
          </div>

          {isOAuthRedirect && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-blue-50 border border-blue-200 rounded flex gap-3 text-xs leading-relaxed"
            >
              <ShieldCheck className="text-trust-blue shrink-0" size={18} />
              <div>
                <span className="font-bold text-slate-900 block mb-0.5">Google OAuth Account Detected</span>
                Your account is currently configured to sign in via Google. Please enter your email below to configure a new password, enabling credentials-based login.
              </div>
            </motion.div>
          )}

          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-8 bg-green-50 border border-green-200 text-center rounded-xl space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 mx-auto">
                <Check size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Reset Link Dispatched</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                If an account matches that email, a secure, single-use password reset link has been sent. Please check your inbox.
              </p>
              <div className="pt-4">
                <Link href="/login" className="text-xs text-trust-blue hover:underline font-bold">
                  Back to Sign In
                </Link>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">
                  {error}
                </div>
              )}

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

              {/* Turnstile Widget */}
              <div className="py-2">
                <Turnstile onVerify={setTurnstileToken} onError={() => setTurnstileToken('')} onExpire={() => setTurnstileToken('')} />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-trust-blue hover:bg-trust-blue-hover text-white font-bold uppercase tracking-wider text-xs rounded-lg shadow transition-colors flex items-center justify-center gap-2"
              >
                <span>{loading ? 'Requesting Link...' : 'Send Reset Link'}</span>
                <ArrowRight size={14} />
              </button>
            </form>
          )}

          <p className="text-xs text-center text-slate-500">
            Remember your credentials?{' '}
            <Link href="/login" className="text-trust-blue hover:underline font-bold">
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
      <div className="min-h-screen bg-white flex items-center justify-center text-slate-900">
        <div className="w-8 h-8 border-2 border-trust-blue border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ForgotPasswordContent />
    </Suspense>
  );
}
