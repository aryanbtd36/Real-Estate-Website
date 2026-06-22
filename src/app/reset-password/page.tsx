'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Lock, Sparkles, ArrowRight, Check, Eye, EyeOff } from 'lucide-react';
import { Turnstile } from '@/components/turnstile';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [token, setToken] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Password Strength State
  const [strength, setStrength] = useState({ score: 0, label: 'Weak', color: 'bg-red-500' });

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setError('Invalid reset request: Token missing from address bar.');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!password) {
      setStrength({ score: 0, label: 'Weak', color: 'bg-red-500' });
      return;
    }
    let score = 0;
    if (password.length >= 6) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    let label = 'Weak';
    let color = 'bg-red-500';
    if (score === 2) {
      label = 'Fair';
      color = 'bg-yellow-500';
    } else if (score === 3) {
      label = 'Good';
      color = 'bg-blue-500';
    } else if (score >= 4) {
      label = 'Strong';
      color = 'bg-green-500';
    }
    setStrength({ score, label, color });
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!token) {
      setError('Cannot complete request: invalid token.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!turnstileToken) {
      setError('Please complete Turnstile bot protection check.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, turnstileToken }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else {
        setError(data.error || 'Failed to reset password.');
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
            <Lock size={24} />
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight leading-none text-slate-900">
            Configure <br />
            <span className="text-trust-blue">Credentials</span>
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed font-normal">
            Once submitted, your old password will be deprecated immediately. All active client sessions will require re-authentication.
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
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Set New Password</h1>
            <p className="text-xs text-slate-500">Enter and verify your new account security credentials below.</p>
          </div>

          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-8 bg-green-50 border border-green-200 text-center rounded-xl space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 mx-auto">
                <Check size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Password Configured</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Your new password has been securely registered. Redirecting you to the sign in screen...
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 text-xs">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">New Password</label>
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

                {password && (
                  <div className="space-y-1 mt-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-400 font-bold">Strength:</span>
                      <span className="font-semibold text-slate-700">{strength.label}</span>
                    </div>
                    <div className="h-1 w-full bg-slate-100 rounded overflow-hidden">
                      <div className={`h-full ${strength.color} transition-all duration-300`} style={{ width: `${(strength.score / 4) * 100}%` }}></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Confirm Password</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-trust-blue p-3 pl-10 rounded-lg text-slate-700 text-sm outline-none transition-colors"
                    placeholder="••••••••"
                  />
                  <Lock className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                </div>
              </div>

              {/* Turnstile Widget */}
              {token && (
                <div className="py-2">
                  <Turnstile onVerify={setTurnstileToken} onError={() => setTurnstileToken('')} onExpire={() => setTurnstileToken('')} />
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !token}
                className="w-full py-3.5 bg-trust-blue hover:bg-trust-blue-hover text-white font-bold uppercase tracking-wider text-xs rounded-lg shadow transition-colors flex items-center justify-center gap-2"
              >
                <span>{loading ? 'Configuring Password...' : 'Reset Password'}</span>
                <ArrowRight size={14} />
              </button>
            </form>
          )}

          <p className="text-xs text-center text-slate-500">
            Back to{' '}
            <Link href="/login" className="text-trust-blue hover:underline font-bold">
              Client Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center text-slate-900">
        <div className="w-8 h-8 border-2 border-trust-blue border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
