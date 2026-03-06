import { useState, useMemo } from 'react';
import { Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { login } from '@/lib/types';

interface Props {
  onLogin: () => void;
}

export default function AdminLogin({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const stars = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 1.5 + 0.5,
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 2,
      opacity: Math.random() * 0.4 + 0.1,
    }))
  , []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    if (login(email, password)) {
      onLogin();
    } else {
      setError('Invalid credentials. Please try again.');
    }
    setLoading(false);
  };

  const font = { fontFamily: "'Outfit', sans-serif" };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Background */}
      <div className="scene">
        <div className="aurora" />
        <div className="aurora-2" />
        <div className="scene-orb scene-orb-1" />
        <div className="scene-orb scene-orb-2" />
        <div className="scene-orb scene-orb-3" />
      </div>

      {/* Starfield */}
      <div className="starfield">
        {stars.map(s => (
          <div
            key={s.id}
            className="star"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
              opacity: s.opacity,
            }}
          />
        ))}
      </div>

      <div className="scanlines" />
      <div className="scene-noise" />
      <div className="top-glow" />

      {/* Grid pattern - purple tinted */}
      <div
        className="fixed inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(139,92,246,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.4) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />

      <div className="w-full max-w-md relative z-10 animate-fade-in-slow">
        {/* Logo */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-2xl shadow-violet-500/30 mb-6">
            <span className="text-white font-black text-xl" style={font}>IL</span>
          </div>
          <h1
            className="text-3xl font-black tracking-[0.25em] text-gradient mb-4 animate-neon"
            style={font}
          >
            IN LIGHTS
          </h1>
          <div className="wave-divider opacity-30 mb-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <span key={i} />
            ))}
          </div>
          <p className="text-[10px] text-violet-300/20 uppercase tracking-[0.5em] font-mono">
            Admin Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-card gradient-border rounded-3xl p-8 sm:p-10">
          <div className="flex items-center gap-4 mb-8 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 flex items-center justify-center border border-violet-500/15 neon-purple">
              <Lock className="w-5 h-5 text-violet-300" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white" style={font}>
                Sign In
              </h2>
              <p className="text-xs text-violet-300/20 font-mono">Access the admin dashboard</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
            <div>
              <label className="block text-[11px] font-bold text-violet-300/30 uppercase tracking-[0.15em] mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400/15" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full input-glow rounded-xl pl-11 pr-4 py-3.5 text-white text-sm focus:outline-none"
                  placeholder="admin@inlights.com"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-violet-300/30 uppercase tracking-[0.15em] mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400/15" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full input-glow rounded-xl pl-11 pr-4 py-3.5 text-white text-sm focus:outline-none"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 bg-rose-500/5 border border-rose-500/10 rounded-xl px-4 py-3.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400/70 shrink-0" />
                <p className="text-sm text-rose-400/70">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  Sign In <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-violet-500/[0.06] relative z-10">
            <p className="text-[11px] text-violet-300/15 text-center font-mono">
              Demo: <span className="text-violet-300/25">admin@inlights.com</span> / <span className="text-violet-300/25">admin123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
