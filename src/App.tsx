import { useState, useEffect } from 'react';
import { LayoutDashboard, Settings, LogOut, Music2 } from 'lucide-react';
import { AdminSettings, DEFAULT_ADMIN_SETTINGS } from './types';
import { fetchPublicBranding, getAdminSettings, isAdminLoggedIn, logoutAdmin, getAdminSession, getCustomRoles } from './store';
import { applyAccentColor } from './utils/accentColor';
import { usePermissions, setCustomRoles } from './utils/permissions';
import SubmissionForm from './components/SubmissionForm';
import AdminLogin from './components/AdminLogin';
import Dashboard from './components/Dashboard';
import ReleaseDetail from './components/ReleaseDetail';
import AdminSettingsPanel from './components/AdminSettings';
import { ReleaseSubmission } from './types';
import ArtistStatusPage from './components/ArtistStatusPage';
import NotificationCenter from './components/NotificationCenter';

type AdminView = 'dashboard' | 'settings' | 'detail';

function App() {
  const { can } = usePermissions();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStatus, setIsStatus] = useState(false);
  const [loggedIn, setLoggedIn] = useState(isAdminLoggedIn());

  // Re-check session every minute so expired sessions auto-logout
  useEffect(() => {
    if (!loggedIn) return;
    const interval = setInterval(() => {
      if (!isAdminLoggedIn()) {
        logoutAdmin();
        setLoggedIn(false);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [loggedIn]);
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
      setIsStatus(hash === '#status' || hash.startsWith('#status'));
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
        if (branding.accentColor) applyAccentColor(branding.accentColor);
      }
      setBrandingLoaded(true);
    });
  }, [refreshKey]);

  // Load full admin settings when logged in
  useEffect(() => {
    if (loggedIn) {
      getAdminSettings().then(settings => {
        setAdminSettings(settings);
        applyAccentColor(settings.accentColor);
      });
      getCustomRoles().then(setCustomRoles);
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

  const handleNavigateToRelease = async (releaseId: string) => {
    const { getSubmissions } = await import('./store');
    const all = await getSubmissions();
    const found = all.find(r => r.id === releaseId);
    if (found) { setSelectedRelease(found); setAdminView('detail'); }
    else { setAdminView('dashboard'); setRefreshKey(k => k + 1); }
  };

  // Show nothing until branding is loaded to avoid flash
  if (!brandingLoaded && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // PUBLIC: Artist Status Page
  if (isStatus) {
    return <ArtistStatusPage settings={publicBranding} />;
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
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-sm truncate">{adminSettings.companyName}</h1>
              <p className="text-xs text-zinc-500 truncate">
                Welcome, <span className="text-zinc-300 font-medium">{getAdminSession().username || 'Admin'}</span>
                {getAdminSession().role && (
                  <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    getAdminSession().role === 'owner' ? 'bg-amber-500/15 text-amber-400' :
                    getAdminSession().role === 'admin' ? 'bg-violet-500/15 text-violet-400' :
                    'bg-blue-500/15 text-blue-400'
                  }`}>{getAdminSession().role}</span>
                )}
              </p>
            </div>
            <NotificationCenter onNavigateToRelease={handleNavigateToRelease} />
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
          {can.canAccessSettings && (
            <button
              onClick={() => { setAdminView('settings'); setSelectedRelease(null); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                adminView === 'settings' ? 'bg-violet-500/10 text-violet-400' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Settings className="w-4 h-4" /> Settings
            </button>
          )}
        </nav>

        <div className="p-3 border-t border-white/5">
          <a href="/#status" className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 transition-all">
            <Music2 className="w-4 h-4" /> Artist Status Page
          </a>
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

      {/* Mobile Header — just branding, no nav buttons */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center px-4 py-3 gap-3">
          {adminSettings.companyLogo && (
            <img src={adminSettings.companyLogo} alt={adminSettings.companyName} className="h-8 w-8 object-contain rounded-lg" />
          )}
          <div className="flex-1 min-w-0">
            <span className="font-bold text-sm block truncate">{adminSettings.companyName}</span>
            <span className="text-[11px] text-zinc-500">
              Welcome, <span className="text-zinc-300">{getAdminSession().username || 'Admin'}</span>
            </span>
          </div>
          <div className="ml-auto">
            <NotificationCenter onNavigateToRelease={handleNavigateToRelease} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0 pb-20 lg:pb-0">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {adminView === 'dashboard' && (
            <Dashboard
              onViewRelease={handleViewRelease}
              refreshKey={refreshKey}
              onRefresh={() => setRefreshKey(k => k + 1)}
              pendingReminderDays={adminSettings.pendingReminderDays ?? 2}
              releaseReminderDays={adminSettings.releaseReminderDays ?? 7}
              statusLabels={{
                pending: adminSettings.statusLabelPending || 'Pending',
                approved: adminSettings.statusLabelApproved || 'Approved',
                scheduled: adminSettings.statusLabelScheduled || 'Scheduled',
                released: adminSettings.statusLabelReleased || 'Released',
                rejected: adminSettings.statusLabelRejected || 'Rejected',
              }}
            />
          )}
          {adminView === 'detail' && selectedRelease && (
            <ReleaseDetail
              release={selectedRelease}
              onBack={() => { setAdminView('dashboard'); setSelectedRelease(null); setRefreshKey(k => k + 1); }}
              commentsEnabled={adminSettings.internalCommentsEnabled ?? true}
              statusLabels={{
                pending: adminSettings.statusLabelPending || 'Pending',
                approved: adminSettings.statusLabelApproved || 'Approved',
                scheduled: adminSettings.statusLabelScheduled || 'Scheduled',
                released: adminSettings.statusLabelReleased || 'Released',
                rejected: adminSettings.statusLabelRejected || 'Rejected',
              }}
            />
          )}
          {adminView === 'settings' && can.canAccessSettings && (
            <AdminSettingsPanel
              onSaved={handleSettingsSaved}
            />
          )}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-t border-white/5">
        <div className="flex items-center justify-around px-2 py-2">
          <button
            onClick={() => { setAdminView('dashboard'); setSelectedRelease(null); }}
            className={`flex flex-col items-center gap-1 px-5 py-2 rounded-xl transition-all ${
              adminView === 'dashboard' || adminView === 'detail'
                ? 'text-white'
                : 'text-zinc-500'
            }`}
          >
            {(adminView === 'dashboard' || adminView === 'detail') && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full" style={{ background: 'var(--accent)' }} />
            )}
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] font-medium">Releases</span>
          </button>

          {can.canAccessSettings && (
            <button
              onClick={() => { setAdminView('settings'); setSelectedRelease(null); }}
              className={`flex flex-col items-center gap-1 px-5 py-2 rounded-xl transition-all ${
                adminView === 'settings' ? 'text-white' : 'text-zinc-500'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span className="text-[10px] font-medium">Settings</span>
            </button>
          )}

          <a
            href="/"
            className="flex flex-col items-center gap-1 px-5 py-2 rounded-xl text-zinc-500"
          >
            <Music2 className="w-5 h-5" />
            <span className="text-[10px] font-medium">Form</span>
          </a>

          <button
            onClick={handleLogout}
            className="flex flex-col items-center gap-1 px-5 py-2 rounded-xl text-zinc-500 hover:text-red-400 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-[10px] font-medium">Logout</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;
