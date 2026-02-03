// =============================================================================
// Bloomberg Terminal–Grade Login Screen - EXACT REPLICA
// File: src/components/Login.tsx
// =============================================================================

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import EnthropicLogo from '../assets/enthropic-logo.svg';

export function Login() {
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setError(
          err?.response?.data?.message ||
          'Authentication failed. Please verify your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="min-h-screen bg-black relative overflow-hidden text-white font-['Helvetica_Neue','Helvetica','Arial',sans-serif]">
        <div className="absolute inset-0">
          <svg
              width="100%"
              height="100%"
              xmlns="http://www.w3.org/2000/svg"
              className="opacity-[0.03]"
          >
            <defs>
              <pattern
                  id="bloomberg-grid"
                  width="80"
                  height="80"
                  patternUnits="userSpaceOnUse"
              >
                <path
                    d="M40 0 L80 40 L40 80 L0 40 Z"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#bloomberg-grid)" />
          </svg>
        </div>

        {/* Header */}
        <header className="relative z-1 px-9">
          <img
              src={EnthropicLogo}
              alt="Enthropic"
              className="h-[100px] w-auto select-none"
          />
        </header>

        {/* Login panel */}
        <main className="relative z-10 flex items-center justify-center min-h-[calc(100vh-180px)]">
          <div
              className="
            w-[420px]
            bg-[#2b2b2b]
            shadow-[0_8px_32px_rgba(0,0,0,0.6)]
          "
          >
            <div className="px-12 py-12">
              <h1 className="text-[28px] font-light tracking-[-0.3px] mb-5">
                Login
              </h1>

              <p className="text-[#a8a8a8] text-[15px] font-light leading-[1.5] mb-10">
                This is a secure Bloomberg authentication service that allows
                you access to Bloomberg services from wherever you are.
              </p>

              <form onSubmit={handleSubmit} className="space-y-7">
                {/* Username */}
                <div>
                  <label className="block text-[13px] font-semibold mb-2 tracking-[0.2px]">
                    Terminal username
                  </label>
                  <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoComplete="username"
                      className="
                    w-full
                    bg-black
                    text-white
                    text-[15px]
                    font-normal
                    px-4
                    py-[11px]
                    border
                    border-[#4a4a4a]
                    focus:border-[#6b9eff]
                    focus:outline-none
                    transition-colors
                    duration-150
                  "
                      placeholder="Terminal username"
                  />
                </div>

                {/* Password */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-[13px] font-semibold tracking-[0.2px]">
                      Password
                    </label>
                    <button
                        type="button"
                        className="text-[#6b9eff] text-[13px] font-normal hover:underline"
                    >
                      Forgot Password
                    </button>
                  </div>
                  <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="
                    w-full
                    bg-black
                    text-white
                    text-[15px]
                    font-normal
                    px-4
                    py-[11px]
                    border
                    border-[#4a4a4a]
                    focus:border-[#6b9eff]
                    focus:outline-none
                    transition-colors
                    duration-150
                  "
                      placeholder="Password"
                  />
                </div>

                {error && (
                    <div className="bg-[#3d1416] border border-[#8a2d32] px-4 py-3">
                      <p className="text-[#ffb3b3] text-[13px] font-normal">
                        {error}
                      </p>
                    </div>
                )}

                <p className="text-[#8a8a8a] text-[14px] font-light leading-[1.4]">
                  Your B-Unit may be required to log in.
                </p>

                <div className="flex justify-end pt-2">
                  <button
                      type="submit"
                      disabled={loading}
                      className="
                    px-8
                    py-[10px]
                    bg-[#3d3d3d]
                    text-[14px]
                    font-medium
                    tracking-[0.3px]
                    hover:bg-[#4a4a4a]
                    disabled:opacity-50
                    disabled:cursor-not-allowed
                    transition-colors
                    duration-150
                  "
                  >
                    {loading ? 'Authenticating…' : 'Next'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 px-9 text-[12px] text-[#6a6a6a] font-light">
          <div className="flex justify-between items-center">
            <div>© 2026 Entropic LP All rights reserved.</div>
            <div className="space-x-4">
              <button className="hover:text-[#6b9eff] transition-colors">Contact Us</button>
              <span className="text-[#4a4a4a]">|</span>
              <button className="hover:text-[#6b9eff] transition-colors">Terms of Service</button>
              <span className="text-[#4a4a4a]">|</span>
              <button className="hover:text-[#6b9eff] transition-colors">Trademarks</button>
              <span className="text-[#4a4a4a]">|</span>
              <button className="hover:text-[#6b9eff] transition-colors">Privacy Policy</button>
            </div>
          </div>
        </footer>
      </div>
  );
}