'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Phone, HelpCircle, ArrowRight, Check, Sparkles } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [propertyType, setPropertyType] = useState('Apartment');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Password Strength State
  const [strength, setStrength] = useState({ score: 0, label: 'Weak', color: 'bg-red-500' });

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
    
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password }),
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
            Design Your <br />
            <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#F5D67B]">
              Financial Legacy
            </span>
          </h2>
          <p className="text-sm text-white/50 leading-relaxed font-light">
            Create an exclusive client account. Track pending site visit approvals and bookmark bespoke floor plan layouts in your private dashboard.
          </p>
        </div>

        <div className="text-[10px] tracking-wider text-white/30 uppercase z-10">
          © 2026 AURA REAL ESTATE. PRIVATE AND SECURED ACCESS ONLY.
        </div>
      </div>

      {/* Right Column: Form */}
      <div className="col-span-1 lg:col-span-7 flex flex-col justify-center px-6 sm:px-12 md:px-24 py-12">
        <div className="max-w-lg w-full mx-auto space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-light tracking-wide">Create Client Account</h1>
            <p className="text-xs text-white/50">Register to organize properties, view floor plans and schedule site visits.</p>
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
              <h3 className="text-xl font-medium text-white">Registration Successful</h3>
              <p className="text-sm text-white/50">Account created successfully! Redirecting you to sign in...</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 block">Full Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-[#161616] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-3.5 pl-10 rounded text-white text-sm outline-none transition-colors"
                      placeholder="Alexander Vane"
                    />
                    <User className="absolute left-3.5 top-4 text-white/40" size={16} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 block">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#161616] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-3.5 pl-10 rounded text-white text-sm outline-none transition-colors"
                      placeholder="alex@domain.com"
                    />
                    <Mail className="absolute left-3.5 top-4 text-white/40" size={16} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 block">Phone Number</label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-[#161616] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-3.5 pl-10 rounded text-white text-sm outline-none transition-colors"
                      placeholder="+1 (555) 012-3456"
                    />
                    <Phone className="absolute left-3.5 top-4 text-white/40" size={16} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 block">Preferred Property</label>
                  <div className="relative">
                    <select
                      value={propertyType}
                      onChange={(e) => setPropertyType(e.target.value)}
                      className="w-full bg-[#161616] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-3.5 pl-4 rounded text-white text-sm outline-none transition-colors appearance-none"
                    >
                      <option value="Apartment">Luxury Apartment</option>
                      <option value="Villa">Exclusive Villa</option>
                      <option value="Commercial">Penthouse Duplex</option>
                      <option value="Plot">Bespoke Estate Lot</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 block">Password</label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#161616] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-3.5 pl-10 rounded text-white text-sm outline-none transition-colors"
                      placeholder="••••••••"
                    />
                    <Lock className="absolute left-3.5 top-4 text-white/40" size={16} />
                  </div>

                  {/* Password Strength Indicator */}
                  {password && (
                    <div className="space-y-1">
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
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] text-black font-semibold uppercase tracking-wider text-xs rounded hover:opacity-95 shadow-lg flex items-center justify-center gap-2"
              >
                <span>{loading ? 'Registering Account...' : 'Register Account'}</span>
                <ArrowRight size={14} />
              </button>
            </form>
          )}

          <p className="text-xs text-center text-white/40">
            Already have an account?{' '}
            <Link href="/login" className="text-[#D4AF37] hover:underline font-semibold">
              Sign In Instead
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
