'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Phone, ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { Turnstile } from '@/components/turnstile';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [propertyType, setPropertyType] = useState('Plot');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Password Strength State
  const [strength, setStrength] = useState({ score: 0, label: 'Weak', color: 'bg-red-500' });
  const [turnstileToken, setTurnstileToken] = useState('');

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
      color = 'bg-trust-blue';
    } else if (score >= 4) {
      label = 'Strong';
      color = 'bg-soft-green';
    }
    setStrength({ score, label, color });
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!turnstileToken) {
      setError('Please complete the Turnstile bot verification check.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password, turnstileToken }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        setError(data.error || 'Failed to register account.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    signIn('google', { callbackUrl: '/dashboard' });
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-white text-slate-900 font-sans antialiased">
      {/* Left Column: Client Support Context */}
      <div className="hidden lg:flex lg:col-span-5 relative overflow-hidden flex-col justify-between p-12 bg-slate-50 border-r border-slate-200">
        <Link href="/" className="flex items-center space-x-2 z-10">
          <span className="text-xl font-bold tracking-tight text-trust-blue">Aura Estates</span>
          <span className="text-[10px] tracking-widest uppercase text-slate-400 border-l border-slate-200 pl-2">Decision Support</span>
        </Link>

        <div className="space-y-6 z-10 max-w-sm my-auto text-left">
          <div className="p-3 bg-trust-blue/10 w-fit rounded-lg text-trust-blue">
            <ShieldCheck size={24} />
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight leading-none text-slate-900">
            Create Client <br />
            <span className="text-trust-blue font-extrabold">Account Hub</span>
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed font-normal">
            Track site visit registrations, manage saved properties, and download verified boundary files and tax guidelines.
          </p>
        </div>

        <div className="text-[10px] tracking-wider text-slate-400 uppercase z-10">
          © 2026 AURA ESTATES. REGISTERED DECISION SUPPORT DESK.
        </div>
      </div>

      {/* Right Column: Form */}
      <div className="col-span-1 lg:col-span-7 flex flex-col justify-center px-6 sm:px-12 md:px-24 py-12">
        <div className="max-w-lg w-full mx-auto space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Create Client Account</h1>
            <p className="text-xs text-slate-500">Register to search verified plots, estimate EMIs, and schedule site visits.</p>
          </div>

          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-8 bg-green-50 border border-green-200 text-center rounded-xl space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-soft-green/25 flex items-center justify-center text-soft-green mx-auto">
                <Check size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Registration Successful</h3>
              <p className="text-sm text-slate-500">Account created successfully! Redirecting you to sign in...</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 text-xs">
              {error && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Full Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-trust-blue p-3 pl-10 rounded-lg text-slate-700 text-sm outline-none transition-colors"
                      placeholder="Alexander Vane"
                    />
                    <User className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-trust-blue p-3 pl-10 rounded-lg text-slate-700 text-sm outline-none transition-colors"
                      placeholder="alex@domain.com"
                    />
                    <Mail className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Phone Number</label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-trust-blue p-3 pl-10 rounded-lg text-slate-700 text-sm outline-none transition-colors"
                      placeholder="+91 98765 43210"
                    />
                    <Phone className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Preferred Property</label>
                  <div className="relative">
                    <select
                      value={propertyType}
                      onChange={(e) => setPropertyType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-trust-blue p-3 pl-4 rounded-lg text-slate-700 text-sm outline-none transition-colors appearance-none"
                    >
                      <option value="Plot">Residential Land / Plot</option>
                      <option value="Apartment">Apartment / Flat</option>
                      <option value="Villa">Independent House / Villa</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Password</label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-trust-blue p-3 pl-10 rounded-lg text-slate-700 text-sm outline-none transition-colors"
                      placeholder="••••••••"
                    />
                    <Lock className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                  </div>

                  {password && (
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between items-center text-[9px]">
                        <span className="text-slate-400 font-bold uppercase">Password Strength:</span>
                        <span className="font-extrabold text-slate-600">{strength.label}</span>
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
                <span>{loading ? 'Registering Account...' : 'Register Account'}</span>
                <ArrowRight size={14} />
              </button>
            </form>
          )}

          <div className="relative flex items-center justify-center py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <span className="relative px-3 bg-white text-[10px] uppercase tracking-widest text-slate-400 font-bold">Or Register With</span>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignUp}
            className="w-full py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-bold text-slate-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            <span>Register with Google</span>
          </button>

          <p className="text-xs text-center text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="text-trust-blue hover:underline font-bold">
              Sign In Instead
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
