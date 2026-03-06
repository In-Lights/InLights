import { useState } from 'react';
import { Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { login } from '@/lib/types';

export default function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) { setError('Please enter both email and password'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    if (login(email, password)) { onLogin(); } else { setError('Invalid credentials'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="bg-glow" />
      <div className="top-line" />

      <div className="w-full max-w-sm relative z-10 animate-fade-in-slow">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--purple)] mb-5">
            <span className="text-white font-bold text-lg" style={{ fontFamily: "'Syne', sans-serif" }}>IL</span>
          </div>
          <h1 className="text-2xl font-bold tracking-[0.15em] text-white mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>
            IN LIGHTS
          </h1>
          <p className="text-sm text-[var(--text-muted)]">Admin Portal</p>
        </div>

        {/* Form */}
        <div className="card-elevated p-6 sm:p-8">
          <h2 className="text-lg font-bold text-white mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>Sign In</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">Access the admin dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input pl-10" placeholder="admin@inlights.com" autoComplete="email" />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input pl-10" placeholder="••••••••" autoComplete="current-password" />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" style={{ animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <>Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--text-muted)] text-center">
              Demo: <span className="text-[var(--text-secondary)]">admin@inlights.com</span> / <span className="text-[var(--text-secondary)]">admin123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
