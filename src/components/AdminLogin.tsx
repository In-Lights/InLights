import { useState, useEffect } from 'react';
import { Lock, LogIn, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react';
import { loginAdmin, setAdminSession, fetchPublicBranding } from '../store';
import { DEFAULT_ADMIN_SETTINGS } from '../types';

interface Props {
  onLogin: () => void;
}

export default function AdminLogin({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [branding, setBranding] = useState({ companyName: DEFAULT_ADMIN_SETTINGS.companyName, companyLogo: DEFAULT_ADMIN_SETTINGS.companyLogo });

  useEffect(() => {
    setTimeout(() => setMounted(true), 100);
    fetchPublicBranding().then(b => { if (b) setBranding(b); });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setLoading(true);
    try {
      const ok = await loginAdmin(username, password);
      if (ok) {
        setAdminSession(true);
        onLogin();
      } else {
        setError('Invalid credentials. Please try again.');
        setTimeout(() => setError(''), 4000);
      }
    } catch {
      setError('Connection error. Please try again.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-[#0a0a0f]">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-violet-600/15 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-500/5 rounded-full blur-[200px]" />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      <div className={`relative z-10 w-full max-w-[440px] mx-4 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="h-[2px] bg-gradient-to-r from-transparent via-violet-500 to-transparent rounded-full mb-0" />

        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.06] rounded-2xl shadow-2xl shadow-black/40">
          <div className="pt-10 pb-6 px-8 text-center">
            <div className="relative inline-block mb-5">
              <div className="absolute inset-0 bg-violet-500/20 rounded-2xl blur-xl scale-150" />
              <div className="relative bg-gradient-to-br from-white/10 to-white/[0.02] border border-white/10 rounded-2xl p-3">
                {branding.companyLogo ? (
                  <img src={branding.companyLogo} alt={branding.companyName} className="h-14 w-14 object-contain rounded-lg" />
                ) : (
                  <ShieldCheck className="w-14 h-14 text-violet-400" />
                )}
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
              {branding.companyName}
            </h1>
            <p className="text-zinc-500 text-sm mt-2 font-medium">Label Management Portal</p>
          </div>

          <div className="mx-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <div className="p-8 pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Username</label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-violet-500/10 rounded-xl opacity-0 group-focus-within:opacity-100 blur-xl transition-opacity" />
                  <input
                    type="text"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setError(''); }}
                    placeholder="Enter your username"
                    className="relative w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-all text-sm"
                    autoFocus
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Password</label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-violet-500/10 rounded-xl opacity-0 group-focus-within:opacity-100 blur-xl transition-opacity" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    placeholder="Enter your password"
                    className="relative w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-all text-sm pr-12"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-zinc-600 hover:text-zinc-400 transition-colors rounded-lg hover:bg-white/5"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
                  <div className="w-2 h-2 bg-red-400 rounded-full flex-shrink-0" />
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="relative w-full group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
                <div className="relative flex items-center justify-center gap-2.5 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-300 text-sm">
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Authenticating...</>
                  ) : (
                    <><LogIn className="w-4 h-4" />Sign In to Dashboard</>
                  )}
                </div>
              </button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-2 text-zinc-600">
              <Lock className="w-3 h-3" />
              <span className="text-xs">Secured admin access only</span>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <a href="/" className="inline-flex items-center gap-2 text-xs text-zinc-600 hover:text-violet-400 transition-colors group">
            <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
            Back to release submission
          </a>
        </div>
      </div>
    </div>
  );
}
