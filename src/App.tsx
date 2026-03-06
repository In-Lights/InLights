import { useState, useEffect, useMemo } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import SubmissionForm from '@/components/SubmissionForm';
import AdminLogin from '@/pages/AdminLogin';
import AdminDashboard from '@/pages/AdminDashboard';
import { isAuthenticated, getSettings } from '@/lib/types';

// ─── Starfield ──────────────────────────────
function Starfield() {
  const stars = useMemo(() =>
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 1.5 + 0.5,
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 2,
      opacity: Math.random() * 0.4 + 0.1,
    }))
  , []);

  return (
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
  );
}

// ─── Animated Background Scene ─────────────
function Scene() {
  return (
    <>
      <div className="scene">
        <div className="aurora" />
        <div className="aurora-2" />
        <div className="scene-orb scene-orb-1" />
        <div className="scene-orb scene-orb-2" />
        <div className="scene-orb scene-orb-3" />
      </div>
      <Starfield />
      <div className="scanlines" />
      <div className="scene-noise" />
      <div className="top-glow" />
    </>
  );
}

// ─── Equalizer Component ──────────────────
function Equalizer() {
  return (
    <div className="flex items-end gap-[3px] h-5">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="eq-bar" />
      ))}
    </div>
  );
}

// ─── Sound Wave Divider ───────────────────
function WaveDivider() {
  return (
    <div className="wave-divider my-8 opacity-50">
      {Array.from({ length: 7 }).map((_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}

// ─── Public Layout ────────────────────────
function PublicLayout() {
  const settings = getSettings();

  return (
    <div className="min-h-screen relative">
      <Scene />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="relative z-20">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 py-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt={settings.companyName} className="h-8 w-auto" />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                    <span className="text-white font-black text-xs" style={{ fontFamily: "'Outfit', sans-serif" }}>IL</span>
                  </div>
                  <h1
                    className="text-lg font-extrabold tracking-[0.2em] text-gradient animate-neon"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    {(settings.companyName || 'IN LIGHTS').toUpperCase()}
                  </h1>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Equalizer />
              <div className="hidden sm:flex items-center gap-2 px-4 py-1.5 rounded-full glass">
                <div className="glow-dot" />
                <span className="text-[10px] text-violet-300/40 uppercase tracking-[0.2em] font-semibold font-mono">
                  Accepting
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Hero */}
        <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-6 sm:pt-12 pb-4">
          <div className="text-center mb-8 animate-fade-in-slow">
            {/* Tag */}
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full glass mb-8 animate-float">
              <div className="w-2 h-2 rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400 animate-pulse-soft" />
              <span
                className="text-[11px] text-violet-300/50 uppercase tracking-[0.25em] font-semibold"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                Release Submission Portal
              </span>
            </div>

            {/* Main Title */}
            <h2
              className="text-5xl sm:text-6xl md:text-7xl font-black text-white mb-6 leading-[0.95] tracking-tight"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              Submit Your
              <br />
              <span className="text-gradient">Music</span>
            </h2>

            {/* Subtext */}
            <p className="text-sm sm:text-base text-white/20 max-w-md mx-auto leading-relaxed font-light">
              Complete the form below to submit your release.
              <br className="hidden sm:block" />
              We review every submission personally.
            </p>
          </div>

          <WaveDivider />

          <SubmissionForm />
        </div>

        {/* Footer */}
        <footer className="relative z-10 mt-20">
          <div className="max-w-5xl mx-auto px-5 sm:px-8">
            <div className="border-t border-violet-500/[0.06] py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                  <span className="text-[8px] font-black text-violet-300/40">IL</span>
                </div>
                <p className="text-[11px] text-white/15 font-light">
                  © {new Date().getFullYear()} {settings.companyName || 'In Lights'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="wave-divider opacity-20" style={{ height: 12 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} />
                  ))}
                </div>
                <p className="text-[10px] text-white/10 uppercase tracking-[0.3em] font-mono">
                  Record Label
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ─── Auth Guard ───────────────────────────
function AdminRoute() {
  const [authed, setAuthed] = useState(isAuthenticated());
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setAuthed(isAuthenticated());
  }, [location]);

  if (!authed) {
    return <AdminLogin onLogin={() => setAuthed(true)} />;
  }

  return (
    <AdminDashboard
      onLogout={() => {
        setAuthed(false);
        navigate('/');
      }}
    />
  );
}

// ─── App ──────────────────────────────────
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<PublicLayout />} />
        <Route path="/admin" element={<AdminRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
