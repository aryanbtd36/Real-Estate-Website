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
            Configure <br />
            <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#F5D67B]">
              New Credentials
            </span>
          </h2>
          <p className="text-sm text-white/50 leading-relaxed font-light">
            Once submitted, your old password will be deprecated immediately. All active client sessions will require re-authentication.
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
            <h1 className="text-3xl font-light tracking-wide">Set New Password</h1>
            <p className="text-xs text-white/50">Enter and verify your new account security credentials below.</p>
          </div>

          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-8 bg-green-500/10 border border-green-500/20 text-center rounded-xl space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-green-500/25 flex items-center justify-center text-green-400 mx-auto">
                <Check size={24} />
              </div>
              <h3 className="text-xl font-medium text-white">Password Configured</h3>
              <p className="text-sm text-white/50 leading-relaxed">
                Your new password has been securely registered. Redirecting you to the sign in screen...
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-white/40 block">New Password</label>
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

                {password && (
                  <div className="space-y-1 mt-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-white/40">Strength:</span>
                      <span className="font-semibold text-white/80">{strength.label}</span>
                    </div>
                    <div className="h-1 w-full bg-white/10 rounded overflow-hidden">
                      <div className={`h-full ${strength.color} transition-all duration-300`} style={{ width: `${(strength.score / 4) * 100}%` }}></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-white/40 block">Confirm Password</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#161616] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-3.5 pl-10 rounded text-white text-sm outline-none transition-colors"
                    placeholder="••••••••"
                  />
                  <Lock className="absolute left-3.5 top-4 text-white/40" size={16} />
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
                className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] text-black font-semibold uppercase tracking-wider text-xs rounded hover:opacity-95 shadow-lg flex items-center justify-center gap-2"
              >
                <span>{loading ? 'Configuring Password...' : 'Reset Password'}</span>
                <ArrowRight size={14} />
              </button>
            </form>
          )}

          <p className="text-xs text-center text-white/40">
            Back to{' '}
            <Link href="/login" className="text-[#D4AF37] hover:underline font-semibold">
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
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-white">
        <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
