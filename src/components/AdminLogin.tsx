import { useState, useEffect } from 'react';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { loginAdmin, fetchPublicBranding } from '../store';
import { DEFAULT_ADMIN_SETTINGS } from '../types';

interface Props { onLogin: () => void; }

const FLOATING_TAGS = [
  { text: 'Hip-Hop', x: '12%', y: '18%', delay: '0s', rotate: '-3deg' },
  { text: 'New Drop', x: '62%', y: '12%', delay: '0.4s', rotate: '2deg' },
  { text: 'Trap', x: '8%', y: '52%', delay: '0.8s', rotate: '-6deg' },
  { text: 'Approved ✓', x: '58%', y: '58%', delay: '0.2s', rotate: '4deg' },
  { text: 'R&B', x: '75%', y: '30%', delay: '1s', rotate: '-2deg' },
  { text: 'In Review', x: '20%', y: '78%', delay: '0.6s', rotate: '3deg' },
  { text: 'Afrobeats', x: '65%', y: '80%', delay: '1.2s', rotate: '-4deg' },
  { text: 'Single', x: '40%', y: '40%', delay: '0.3s', rotate: '1deg' },
];

export default function AdminLogin({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [branding, setBranding] = useState({
    companyName: DEFAULT_ADMIN_SETTINGS.companyName,
    companyLogo: DEFAULT_ADMIN_SETTINGS.companyLogo,
  });

  useEffect(() => {
    setTimeout(() => setMounted(true), 80);
    fetchPublicBranding().then(b => { if (b) setBranding(b as typeof branding); });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Enter both username and password');
      setTimeout(() => setError(''), 3000);
      return;
    }
    setLoading(true);
    try {
      const ok = await loginAdmin(username, password);
      if (ok) { onLogin(); }
      else {
        setError('Wrong credentials — try again');
        setTimeout(() => setError(''), 4000);
      }
    } catch {
      setError('Connection error — try again');
      setTimeout(() => setError(''), 4000);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex overflow-hidden bg-[#080808]">

      {/* ── LEFT PANEL — Visual ── */}
      <div className={`hidden lg:flex flex-col flex-1 relative overflow-hidden transition-all duration-1000 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        {/* Deep noise background */}
        <div className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 30% 40%, #1a0533 0%, #080808 70%)',
          }}
        />
        {/* Grain overlay */}
        <div className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
            backgroundSize: '128px',
          }}
        />
        {/* Accent glow */}
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)' }}
        />

        {/* Floating genre/status tags */}
        {FLOATING_TAGS.map((tag, i) => (
          <div
            key={i}
            className="absolute select-none"
            style={{
              left: tag.x, top: tag.y,
              transform: `rotate(${tag.rotate})`,
              animation: `floatTag 6s ease-in-out infinite`,
              animationDelay: tag.delay,
              opacity: mounted ? 1 : 0,
              transition: `opacity 0.8s ease ${tag.delay}`,
            }}
          >
            <div className="px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.35)',
                backdropFilter: 'blur(8px)',
              }}
            >
              {tag.text}
            </div>
          </div>
        ))}

        {/* Center content */}
        <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-12">
          <div
            className="text-center"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.2s',
            }}
          >
            {/* Logo */}
            {branding.companyLogo ? (
              <img src={branding.companyLogo} alt={branding.companyName}
                className="h-20 w-20 object-contain rounded-2xl mx-auto mb-8"
                style={{ boxShadow: '0 0 60px rgba(139,92,246,0.3)' }}
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl mx-auto mb-8 flex items-center justify-center text-3xl font-black"
                style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(217,70,239,0.2))',
                  border: '1px solid rgba(139,92,246,0.3)',
                  boxShadow: '0 0 60px rgba(139,92,246,0.2)',
                  color: 'rgba(255,255,255,0.9)',
                }}
              >
                {branding.companyName?.charAt(0) || 'L'}
              </div>
            )}

            <h2 className="text-5xl font-black tracking-tighter mb-3"
              style={{
                background: 'linear-gradient(135deg, #ffffff 30%, rgba(139,92,246,0.8) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1.1,
              }}
            >
              {branding.companyName}
            </h2>
            <p className="text-sm tracking-[0.3em] uppercase font-medium"
              style={{ color: 'rgba(255,255,255,0.25)' }}>
              Label Management
            </p>
          </div>

          {/* Stat pills */}
          <div
            className="flex gap-3 mt-16 flex-wrap justify-center"
            style={{
              opacity: mounted ? 1 : 0,
              transition: 'opacity 0.8s ease 0.6s',
            }}
          >
            {['Submissions', 'Status Tracking', 'Team Workflow', 'AI Pitches'].map(stat => (
              <div key={stat} className="px-4 py-2 rounded-full text-xs font-medium tracking-wide"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.3)',
                }}
              >
                {stat}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 inset-x-0 h-32"
          style={{ background: 'linear-gradient(to top, #080808, transparent)' }}
        />
      </div>

      {/* ── RIGHT PANEL — Form ── */}
      <div className="w-full lg:w-[480px] flex-shrink-0 flex flex-col justify-center relative"
        style={{ background: '#0d0d0d', borderLeft: '1px solid rgba(255,255,255,0.04)' }}
      >
        {/* Subtle top line */}
        <div className="absolute top-0 inset-x-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.5), transparent)' }}
        />

        <div
          className="px-10 py-12"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateX(0)' : 'translateX(16px)',
            transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.15s',
          }}
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            {branding.companyLogo
              ? <img src={branding.companyLogo} alt="" className="h-9 w-9 rounded-xl object-contain" />
              : <div className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-black"
                  style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}>
                  {branding.companyName?.charAt(0)}
                </div>
            }
            <span className="font-bold text-white">{branding.companyName}</span>
          </div>

          <div className="mb-10">
            <h1 className="text-2xl font-black tracking-tight text-white mb-2">Welcome back</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Sign in to your label dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label className="block text-xs font-semibold mb-2 tracking-widest uppercase"
                style={{ color: 'rgba(255,255,255,0.3)' }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                placeholder="your username"
                autoFocus
                disabled={loading}
                className="w-full px-4 py-3.5 rounded-xl text-sm text-white placeholder-zinc-700 outline-none transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
                onFocus={e => {
                  e.target.style.border = '1px solid rgba(139,92,246,0.5)';
                  e.target.style.background = 'rgba(139,92,246,0.05)';
                }}
                onBlur={e => {
                  e.target.style.border = '1px solid rgba(255,255,255,0.07)';
                  e.target.style.background = 'rgba(255,255,255,0.04)';
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold mb-2 tracking-widest uppercase"
                style={{ color: 'rgba(255,255,255,0.3)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full px-4 py-3.5 pr-12 rounded-xl text-sm text-white placeholder-zinc-700 outline-none transition-all duration-200"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                  onFocus={e => {
                    e.target.style.border = '1px solid rgba(139,92,246,0.5)';
                    e.target.style.background = 'rgba(139,92,246,0.05)';
                  }}
                  onBlur={e => {
                    e.target.style.border = '1px solid rgba(255,255,255,0.07)';
                    e.target.style.background = 'rgba(255,255,255,0.04)';
                  }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="relative w-full py-3.5 rounded-xl text-sm font-bold tracking-wide overflow-hidden group transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                color: 'white',
                boxShadow: '0 0 30px rgba(124,58,237,0.25)',
              }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}
              />
              <span className="relative flex items-center justify-center gap-2.5">
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 rounded-full animate-spin"
                      style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'white' }}
                    />
                    Signing in…
                  </>
                ) : (
                  <>
                    Enter Dashboard
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </span>
            </button>
          </form>

          {/* Back link */}
          <div className="mt-8 pt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <a href="/"
              className="text-xs transition-colors hover:text-white"
              style={{ color: 'rgba(255,255,255,0.2)' }}
            >
              ← Back to submission form
            </a>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes floatTag {
          0%, 100% { transform: translateY(0px) rotate(var(--r, 0deg)); }
          50% { transform: translateY(-8px) rotate(var(--r, 0deg)); }
        }
      `}</style>
    </div>
  );
}
