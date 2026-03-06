import { useState, useEffect } from 'react';
import { ReleaseSubmission, AdminSettings } from './types';
import { getAdminSettings, isAdminLoggedIn, loginAdmin, logoutAdmin, fetchPublicBranding, DEFAULT_SETTINGS } from './store';
import SubmissionForm from './components/SubmissionForm';
import Dashboard from './components/Dashboard';
import ReleaseDetail from './components/ReleaseDetail';
import AdminSettingsPanel from './components/AdminSettings';
import { Lock, Eye, EyeOff, ArrowLeft, LayoutDashboard, Settings, LogOut, Disc3 } from 'lucide-react';

type AdminView = 'dashboard' | 'detail' | 'settings';

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminView, setAdminView] = useState<AdminView>('dashboard');
  const [selectedRelease, setSelectedRelease] = useState<ReleaseSubmission | null>(null);
  const [adminSettings, setAdminSettings] = useState<AdminSettings>(getAdminSettings());

  // Public branding (fetched from Google Sheets for all visitors)
  const [publicBranding, setPublicBranding] = useState({
    companyName: DEFAULT_SETTINGS.companyName,
    companyLogo: DEFAULT_SETTINGS.companyLogo,
    welcomeText: DEFAULT_SETTINGS.welcomeText,
    welcomeDescription: DEFAULT_SETTINGS.welcomeDescription,
  });

  // Check if admin route
  useEffect(() => {
    const checkRoute = () => {
      if (window.location.hash === '#admin') {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    };
    checkRoute();
    window.addEventListener('hashchange', checkRoute);
    return () => window.removeEventListener('hashchange', checkRoute);
  }, []);

  // Fetch public branding from Google Sheets (or use admin settings fallback)
  useEffect(() => {
    async function loadBranding() {
      const settings = getAdminSettings();
      // Try Google Sheets first for global branding
      const sheetBranding = await fetchPublicBranding();
      if (sheetBranding && sheetBranding.companyName) {
        setPublicBranding({
          companyName: sheetBranding.companyName || settings.companyName,
          companyLogo: sheetBranding.companyLogo || settings.companyLogo,
          welcomeText: sheetBranding.welcomeText || settings.welcomeText,
          welcomeDescription: sheetBranding.welcomeDescription || settings.welcomeDescription,
        });
      } else {
        // Fallback to local settings
        setPublicBranding({
          companyName: settings.companyName,
          companyLogo: settings.companyLogo,
          welcomeText: settings.welcomeText,
          welcomeDescription: settings.welcomeDescription,
        });
      }
    }
    loadBranding();
  }, [adminSettings]);

  // Public form page — merge public branding into settings for the form
  if (!isAdmin) {
    const formSettings: AdminSettings = {
      ...adminSettings,
      companyName: publicBranding.companyName,
      companyLogo: publicBranding.companyLogo,
      welcomeText: publicBranding.welcomeText,
      welcomeDescription: publicBranding.welcomeDescription,
    };
    return (
      <SubmissionForm
        settings={formSettings}
      />
    );
  }

  // Admin page
  return <AdminPanel
    adminSettings={adminSettings}
    onSettingsChange={s => { setAdminSettings(s); }}
    adminView={adminView}
    setAdminView={setAdminView}
    selectedRelease={selectedRelease}
    setSelectedRelease={setSelectedRelease}
  />;
}

interface AdminPanelProps {
  adminSettings: AdminSettings;
  onSettingsChange: (s: AdminSettings) => void;
  adminView: AdminView;
  setAdminView: (v: AdminView) => void;
  selectedRelease: ReleaseSubmission | null;
  setSelectedRelease: (r: ReleaseSubmission | null) => void;
}

function AdminPanel({ adminSettings, onSettingsChange, adminView, setAdminView, selectedRelease, setSelectedRelease }: AdminPanelProps) {
  const [loggedIn, setLoggedIn] = useState(isAdminLoggedIn());

  if (!loggedIn) {
    return <AdminLogin onLogin={() => setLoggedIn(true)} />;
  }

  const handleLogout = () => {
    logoutAdmin();
    setLoggedIn(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Admin Sidebar */}
      <div className="flex">
        <aside className="w-64 bg-zinc-900 border-r border-zinc-800 min-h-screen p-4 hidden md:block">
          <div className="flex items-center gap-3 mb-8 px-2">
            {adminSettings.companyLogo && (
              <img src={adminSettings.companyLogo} alt="" className="w-10 h-10 rounded-lg object-contain bg-zinc-800" />
            )}
            <div>
              <h1 className="text-white font-bold text-sm">{adminSettings.companyName}</h1>
              <p className="text-zinc-500 text-xs">Admin Panel</p>
            </div>
          </div>

          <nav className="space-y-1">
            <button onClick={() => { setAdminView('dashboard'); setSelectedRelease(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                adminView === 'dashboard' && !selectedRelease ? 'bg-purple-500/20 text-purple-300' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}>
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>
            <button onClick={() => setAdminView('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                adminView === 'settings' ? 'bg-purple-500/20 text-purple-300' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}>
              <Settings className="w-4 h-4" /> Settings
            </button>
            <a href="/" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
              <Disc3 className="w-4 h-4" /> View Submission Form
            </a>
          </nav>

          <div className="absolute bottom-4 left-4 right-4 md:left-4 md:right-auto md:w-56">
            <button onClick={handleLogout}
              className="w-full flex items-center gap-2 text-zinc-500 hover:text-red-400 text-sm px-3 py-2 transition-colors">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </aside>

        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 bg-zinc-900 border-b border-zinc-800 z-20 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {adminSettings.companyLogo && <img src={adminSettings.companyLogo} alt="" className="w-8 h-8 rounded-lg object-contain bg-zinc-800" />}
              <span className="text-white font-bold text-sm">{adminSettings.companyName}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setAdminView('dashboard'); setSelectedRelease(null); }}
                className={`p-2 rounded-lg ${adminView === 'dashboard' && !selectedRelease ? 'bg-purple-500/20 text-purple-300' : 'text-zinc-400'}`}>
                <LayoutDashboard className="w-4 h-4" />
              </button>
              <button onClick={() => setAdminView('settings')}
                className={`p-2 rounded-lg ${adminView === 'settings' ? 'bg-purple-500/20 text-purple-300' : 'text-zinc-400'}`}>
                <Settings className="w-4 h-4" />
              </button>
              <button onClick={handleLogout} className="p-2 text-zinc-400 hover:text-red-400">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8 mt-14 md:mt-0">
          {adminView === 'settings' ? (
            <AdminSettingsPanel settings={adminSettings} onSettingsChange={onSettingsChange} />
          ) : selectedRelease ? (
            <ReleaseDetail
              release={selectedRelease}
              onBack={() => { setSelectedRelease(null); setAdminView('dashboard'); }}
              onUpdated={() => { setSelectedRelease(null); setAdminView('dashboard'); }}
            />
          ) : (
            <Dashboard onViewRelease={(r) => { setSelectedRelease(r); setAdminView('detail'); }} />
          )}
        </main>
      </div>
    </div>
  );
}

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const settings = getAdminSettings();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    await new Promise(r => setTimeout(r, 800));

    if (loginAdmin(username, password)) {
      onLogin();
    } else {
      setError('Invalid credentials');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-zinc-800 p-8 shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-zinc-800 flex items-center justify-center overflow-hidden shadow-lg shadow-purple-500/20">
              {settings.companyLogo ? (
                <img src={settings.companyLogo} alt="" className="w-full h-full object-contain p-2" />
              ) : (
                <Lock className="w-8 h-8 text-purple-400" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-white">{settings.companyName}</h1>
            <p className="text-zinc-500 text-sm mt-1">Admin Panel</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} required
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30 transition-all"
                placeholder="Enter username" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 pr-12 text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30 transition-all"
                  placeholder="Enter password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-2.5 rounded-xl text-center animate-shake">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-purple-500/25">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Authenticating...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a href="/" className="text-zinc-500 hover:text-zinc-300 text-sm flex items-center justify-center gap-1 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to submission form
            </a>
          </div>
        </div>

        <p className="text-center text-zinc-600 text-xs mt-4">🔒 Secured admin access only</p>
      </div>
    </div>
  );
}
