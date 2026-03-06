import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import SubmissionForm from '@/components/SubmissionForm';
import AdminLogin from '@/pages/AdminLogin';
import AdminDashboard from '@/pages/AdminDashboard';
import { isAuthenticated, getSettings } from '@/lib/types';

function PublicLayout() {
  const settings = getSettings();
  const name = (settings.companyName || 'In Lights').toUpperCase();

  return (
    <div className="min-h-screen relative">
      <div className="bg-glow" />
      <div className="top-line" />

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-[var(--border)]">
          <div className="max-w-4xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt={settings.companyName} className="h-7 w-auto" />
              ) : (
                <>
                  <div className="w-8 h-8 rounded-lg bg-[var(--purple)] flex items-center justify-center">
                    <span className="text-white font-bold text-xs" style={{ fontFamily: "'Syne', sans-serif" }}>IL</span>
                  </div>
                  <span className="text-sm font-bold tracking-[0.15em] text-[var(--text-primary)]" style={{ fontFamily: "'Syne', sans-serif" }}>
                    {name}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ animation: 'pulse-dot 2s ease-in-out infinite' }} />
              <span className="text-[11px] text-emerald-400 font-semibold">Accepting Submissions</span>
            </div>
          </div>
        </header>

        {/* Hero */}
        <div className="max-w-4xl mx-auto px-5 sm:px-8 pt-12 sm:pt-20 pb-6">
          <div className="text-center mb-12 animate-fade-in-slow">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--purple)]/8 border border-[var(--purple)]/15 mb-6">
              <span className="text-xs text-[var(--purple-light)] font-semibold">Release Submission Portal</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white mb-4 leading-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
              Submit Your <span className="text-gradient">Release</span>
            </h1>

            <p className="text-base text-[var(--text-muted)] max-w-md mx-auto leading-relaxed">
              Complete the form below to submit your music.
              <br className="hidden sm:block" />
              Every submission is reviewed personally by our team.
            </p>
          </div>

          <SubmissionForm />
        </div>

        {/* Footer */}
        <footer className="mt-16 border-t border-[var(--border)]">
          <div className="max-w-4xl mx-auto px-5 sm:px-8 py-8 flex items-center justify-between">
            <p className="text-xs text-[var(--text-muted)]">
              © {new Date().getFullYear()} {settings.companyName || 'In Lights'}. All rights reserved.
            </p>
            <p className="text-xs text-[var(--text-muted)]">Record Label</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

function AdminRoute() {
  const [authed, setAuthed] = useState(isAuthenticated());
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => { setAuthed(isAuthenticated()); }, [location]);

  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />;
  return <AdminDashboard onLogout={() => { setAuthed(false); navigate('/'); }} />;
}

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
