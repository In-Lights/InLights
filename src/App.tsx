import { useState, useEffect } from 'react';
import { LayoutDashboard, Settings, LogOut, Music2 } from 'lucide-react';
import { AdminSettings, DEFAULT_ADMIN_SETTINGS } from './types';
import { fetchPublicBranding, getAdminSettings, isAdminLoggedIn, logoutAdmin } from './store';
import SubmissionForm from './components/SubmissionForm';
import AdminLogin from './components/AdminLogin';
import Dashboard from './components/Dashboard';
import ReleaseDetail from './components/ReleaseDetail';
import AdminSettingsPanel from './components/AdminSettings';
import { ReleaseSubmission } from './types';

type AdminView = 'dashboard' | 'settings' | 'detail';

function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loggedIn, setLoggedIn] = useState(isAdminLoggedIn());
  const [adminView, setAdminView] = useState<AdminView>('dashboard');
  const [selectedRelease, setSelectedRelease] = useState<ReleaseSubmission | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [adminSettings, setAdminSettings] = useState<AdminSettings>({ ...DEFAULT_ADMIN_SETTINGS });
  const [publicBranding, setPublicBranding] = useState<AdminSettings>({ ...DEFAULT_ADMIN_SETTINGS });
  const [brandingLoaded, setBrandingLoaded] = useState(false);

  // Check URL hash for admin route
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      setIsAdmin(hash === '#admin' || hash.startsWith('#admin'));
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // Load public branding from Supabase
  useEffect(() => {
    fetchPublicBranding().then(branding => {
      if (branding) {
        setPublicBranding(prev => ({ ...prev, ...branding }));
      }
      setBrandingLoaded(true);
    });
  }, [refreshKey]);

  // Load full admin settings when logged in
  useEffect(() => {
    if (loggedIn) {
      getAdminSettings().then(settings => {
        setAdminSettings(settings);
      });
    }
  }, [loggedIn, refreshKey]);

  const handleLogout = () => {
    logoutAdmin();
    setLoggedIn(false);
    setAdminView('dashboard');
    setSelectedRelease(null);
  };

  const handleViewRelease = (release: ReleaseSubmission) => {
    setSelectedRelease(release);
    setAdminView('detail');
  };

  const handleSettingsSaved = () => {
    setRefreshKey(k => k + 1);
  };

  // Show nothing until branding is loaded to avoid flash
  if (!brandingLoaded && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // PUBLIC: Submission Form
  if (!isAdmin) {
    return (
      <SubmissionForm
        settings={publicBranding}
        onSubmitted={() => setRefreshKey(k => k + 1)}
      />
    );
  }

  // ADMIN: Login Screen
  if (isAdmin && !loggedIn) {
    return <AdminLogin onLogin={() => setLoggedIn(true)} />;
  }

  // ADMIN: Dashboard
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-black/40 backdrop-blur-xl flex flex-col fixed h-full z-40 hidden lg:flex">
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            {adminSettings.companyLogo && (
              <img src={adminSettings.companyLogo} alt={adminSettings.companyName} className="h-10 w-10 object-contain rounded-lg" />
            )}
            <div>
              <h1 className="font-bold text-sm">{adminSettings.companyName}</h1>
              <p className="text-xs text-zinc-500">Admin Panel</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <button
            onClick={() => { setAdminView('dashboard'); setSelectedRelease(null); }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              adminView === 'dashboard' || adminView === 'detail' ? 'bg-violet-500/10 text-violet-400' : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" /> Releases
          </button>
          <button
            onClick={() => { setAdminView('settings'); setSelectedRelease(null); }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              adminView === 'settings' ? 'bg-violet-500/10 text-violet-400' : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Settings className="w-4 h-4" /> Settings
          </button>
        </nav>

        <div className="p-3 border-t border-white/5">
          <a href="/" className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 transition-all">
            <Music2 className="w-4 h-4" /> View Form
          </a>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-zinc-500 hover:text-red-400 transition-all"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {adminSettings.companyLogo && (
              <img src={adminSettings.companyLogo} alt={adminSettings.companyName} className="h-8 w-8 object-contain rounded-lg" />
            )}
            <span className="font-bold text-sm">{adminSettings.companyName}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setAdminView('dashboard'); setSelectedRelease(null); }}
              className={`p-2 rounded-lg ${adminView === 'dashboard' || adminView === 'detail' ? 'text-violet-400' : 'text-zinc-500'}`}
            >
              <LayoutDashboard className="w-5 h-5" />
            </button>
            <button
              onClick={() => { setAdminView('settings'); setSelectedRelease(null); }}
              className={`p-2 rounded-lg ${adminView === 'settings' ? 'text-violet-400' : 'text-zinc-500'}`}
            >
              <Settings className="w-5 h-5" />
            </button>
            <button onClick={handleLogout} className="p-2 rounded-lg text-zinc-500 hover:text-red-400">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {adminView === 'dashboard' && (
            <Dashboard
              onViewRelease={handleViewRelease}
              refreshKey={refreshKey}
              onRefresh={() => setRefreshKey(k => k + 1)}
            />
          )}
          {adminView === 'detail' && selectedRelease && (
            <ReleaseDetail
              release={selectedRelease}
              onBack={() => { setAdminView('dashboard'); setSelectedRelease(null); setRefreshKey(k => k + 1); }}
            />
          )}
          {adminView === 'settings' && (
            <AdminSettingsPanel
              onSaved={handleSettingsSaved}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
