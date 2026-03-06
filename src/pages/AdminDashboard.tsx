import { useState, useEffect, useRef, useMemo } from 'react';
import {
  LogOut, Download, Search, Eye, Trash2, ChevronDown, X,
  Music, Disc, ExternalLink, Settings, Check,
  LayoutDashboard, Upload, Save, AlertTriangle, Calendar, Clock,
  Headphones,
} from 'lucide-react';
import {
  type Release, type ReleaseStatus, type Settings as SettingsType,
  getReleases, updateRelease, deleteReleaseById, exportToCSV,
  getSettings, saveSettings, statusColors, statusLabels, releaseTypeLabels,
  logout,
} from '@/lib/types';

interface Props {
  onLogout: () => void;
}

const STATUSES: (ReleaseStatus | 'all')[] = ['all', 'pending', 'approved', 'scheduled', 'released'];
const typeIcons = { single: Music, ep: Disc, album: Headphones };
const font = { fontFamily: "'Outfit', sans-serif" };

export default function AdminDashboard({ onLogout }: Props) {
  const [releases, setReleases] = useState<Release[]>([]);
  const [filter, setFilter] = useState<ReleaseStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'releases' | 'settings'>('releases');
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [settings, setSettingsState] = useState<SettingsType>(getSettings());
  const [settingsSaved, setSettingsSaved] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const stars = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 1 + 0.5,
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 2,
      opacity: Math.random() * 0.2 + 0.05,
    }))
  , []);

  useEffect(() => { setReleases(getReleases()); }, []);

  const filtered = releases
    .filter(r => filter === 'all' || r.status === filter)
    .filter(r => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return r.artistName.toLowerCase().includes(s) ||
        r.releaseTitle.toLowerCase().includes(s) ||
        r.id.toLowerCase().includes(s);
    });

  const counts = {
    all: releases.length,
    pending: releases.filter(r => r.status === 'pending').length,
    approved: releases.filter(r => r.status === 'approved').length,
    scheduled: releases.filter(r => r.status === 'scheduled').length,
    released: releases.filter(r => r.status === 'released').length,
  };

  const handleStatusChange = (id: string, status: ReleaseStatus) => {
    updateRelease(id, { status });
    setReleases(getReleases());
    if (selectedRelease?.id === id) setSelectedRelease({ ...selectedRelease, status });
  };

  const handleDelete = (id: string) => {
    deleteReleaseById(id);
    setReleases(getReleases());
    setDeleteConfirm(null);
    if (selectedRelease?.id === id) setSelectedRelease(null);
  };

  const handleLogout = () => { logout(); onLogout(); };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setSettingsState(p => ({ ...p, logoUrl: url }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = () => {
    saveSettings(settings);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const inputCls = 'w-full input-glow rounded-xl px-4 py-3.5 text-white text-sm focus:outline-none';

  return (
    <div className="min-h-screen relative">
      {/* Subtle background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="aurora" style={{ opacity: 0.5 }} />
        <div className="scene-orb scene-orb-1" style={{ opacity: 0.2 }} />
        <div className="scene-orb scene-orb-2" style={{ opacity: 0.15 }} />
      </div>
      <div className="starfield">
        {stars.map(s => (
          <div key={s.id} className="star" style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.size}px`, height: `${s.size}px`, animationDelay: `${s.delay}s`, animationDuration: `${s.duration}s`, opacity: s.opacity }} />
        ))}
      </div>
      <div className="scanlines" />
      <div className="scene-noise" />
      <div className="top-glow" />

      {/* ── Top Nav ──────────────────────── */}
      <header className="glass sticky top-0 z-40 border-b border-violet-500/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-5">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-7 w-auto" />
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                  <span className="text-white font-black text-[9px]" style={font}>IL</span>
                </div>
                <h1 className="text-base font-black tracking-[0.15em] text-gradient animate-neon" style={font}>
                  IN LIGHTS
                </h1>
              </div>
            )}
            <div className="hidden sm:flex h-5 w-px bg-violet-500/[0.08]" />
            <nav className="hidden sm:flex items-center gap-1">
              {[
                { key: 'releases' as const, icon: LayoutDashboard, label: 'Releases' },
                { key: 'settings' as const, icon: Settings, label: 'Settings' },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                    tab === t.key
                      ? 'glass-strong text-violet-300 shadow-[0_0_20px_rgba(139,92,246,0.08)]'
                      : 'text-white/20 hover:text-white/40'
                  }`} style={font}>
                  <t.icon className="w-4 h-4" /> {t.label}
                </button>
              ))}
            </nav>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-white/20 hover:text-rose-400/70 transition font-bold px-3 py-2 rounded-xl hover:bg-rose-500/5" style={font}>
            <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* ── Mobile Nav ──────────────────── */}
      <div className="sm:hidden flex glass border-b border-violet-500/[0.06]">
        {[
          { key: 'releases' as const, label: 'Releases' },
          { key: 'settings' as const, label: 'Settings' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-3.5 text-center text-sm font-bold transition-all ${
              tab === t.key ? 'text-violet-300 border-b-2 border-violet-500' : 'text-white/20'
            }`} style={font}>
            {t.label}
          </button>
        ))}
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 relative z-10">
        {/* ════════════════════════════════════ */}
        {/* RELEASES TAB                        */}
        {/* ════════════════════════════════════ */}
        {tab === 'releases' && (
          <div className="animate-fade-in">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
              {[
                { label: 'Total', val: counts.all, icon: Music, gradient: 'from-violet-500/15 to-violet-500/5', iconColor: 'text-violet-300', border: 'border-violet-500/10', glow: 'shadow-violet-500/5' },
                { label: 'Pending', val: counts.pending, icon: Clock, gradient: 'from-amber-500/15 to-amber-500/5', iconColor: 'text-amber-300', border: 'border-amber-500/10', glow: 'shadow-amber-500/5' },
                { label: 'Approved', val: counts.approved, icon: Check, gradient: 'from-emerald-500/15 to-emerald-500/5', iconColor: 'text-emerald-300', border: 'border-emerald-500/10', glow: 'shadow-emerald-500/5' },
                { label: 'Scheduled', val: counts.scheduled, icon: Calendar, gradient: 'from-fuchsia-500/15 to-fuchsia-500/5', iconColor: 'text-fuchsia-300', border: 'border-fuchsia-500/10', glow: 'shadow-fuchsia-500/5' },
              ].map(s => (
                <div key={s.label} className={`glass-card rounded-2xl p-5 border ${s.border} relative overflow-hidden shadow-lg ${s.glow}`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient} pointer-events-none`} />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <s.icon className={`w-5 h-5 ${s.iconColor}`} />
                    </div>
                    <p className="text-3xl font-black text-white mb-0.5" style={font}>
                      {s.val}
                    </p>
                    <p className="text-[11px] text-white/20 font-bold uppercase tracking-wider font-mono">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
              <div className="relative flex-1 w-full sm:w-auto">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400/15" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full input-glow rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none"
                  placeholder="Search artist, title, or ID..." />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {STATUSES.map(s => (
                  <button key={s} onClick={() => setFilter(s)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-300 capitalize ${
                      filter === s
                        ? 'glass-strong text-violet-300 border border-violet-500/20 shadow-[0_0_15px_rgba(139,92,246,0.08)]'
                        : 'glass text-white/20 hover:text-white/35'
                    }`} style={font}>
                    {s}{s !== 'all' ? ` (${counts[s]})` : ''}
                  </button>
                ))}
              </div>
              <button onClick={() => exportToCSV(filtered)}
                className="btn-ghost flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold ml-auto shrink-0">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            </div>

            {/* Table / Cards */}
            {filtered.length === 0 ? (
              <div className="text-center py-20 glass-card rounded-2xl">
                <Music className="w-12 h-12 text-violet-500/10 mx-auto mb-4" />
                <p className="text-white/20 text-sm" style={font}>No releases found</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block glass-card rounded-2xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-violet-500/[0.06]">
                        {['Artist', 'Release', 'Type', 'Date', 'Status', 'Actions'].map(h => (
                          <th key={h} className="text-left text-[10px] font-bold text-violet-300/15 uppercase tracking-[0.15em] px-6 py-4 font-mono">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => {
                        const Icon = typeIcons[r.releaseType] || Music;
                        return (
                          <tr key={r.id} className="border-b border-violet-500/[0.04] last:border-0 hover:bg-violet-500/[0.02] transition-colors duration-300 group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 flex items-center justify-center border border-violet-500/10 shrink-0">
                                  <Icon className="w-4 h-4 text-violet-300" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-white/70" style={font}>{r.artistName}</p>
                                  <p className="text-[10px] text-violet-300/15 font-mono">{r.id}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm text-white/50 font-bold" style={font}>{r.releaseTitle}</p>
                              <p className="text-[10px] text-violet-300/12 font-mono">{r.tracks.length} track{r.tracks.length !== 1 ? 's' : ''}</p>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs text-white/25 capitalize font-mono">{releaseTypeLabels[r.releaseType]}</span>
                            </td>
                            <td className="px-6 py-4 text-xs text-white/25 font-mono">
                              {new Date(r.releaseDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="px-6 py-4">
                              <StatusDropdown status={r.status} onChange={(s) => handleStatusChange(r.id, s)} />
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-1 opacity-30 group-hover:opacity-100 transition-opacity duration-300">
                                <button onClick={() => setSelectedRelease(r)}
                                  className="p-2 rounded-xl hover:bg-violet-500/[0.06] text-white/30 hover:text-violet-300 transition-all" title="View">
                                  <Eye className="w-4 h-4" />
                                </button>
                                {deleteConfirm === r.id ? (
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => handleDelete(r.id)} className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400/80 hover:bg-rose-500/20 transition text-xs font-bold" style={font}>
                                      Confirm
                                    </button>
                                    <button onClick={() => setDeleteConfirm(null)} className="p-2 text-white/20 hover:text-white/40 transition">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => setDeleteConfirm(r.id)}
                                    className="p-2 rounded-xl hover:bg-rose-500/5 text-white/20 hover:text-rose-400/60 transition-all" title="Delete">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {filtered.map(r => {
                    const Icon = typeIcons[r.releaseType] || Music;
                    return (
                      <div key={r.id} className="glass-card rounded-2xl p-5">
                        <div className="flex items-start justify-between mb-4 relative z-10">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 flex items-center justify-center border border-violet-500/10">
                              <Icon className="w-5 h-5 text-violet-300" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white/70" style={font}>{r.artistName}</p>
                              <p className="text-xs text-white/25" style={font}>{r.releaseTitle}</p>
                            </div>
                          </div>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border ${statusColors[r.status]}`}>
                            {statusLabels[r.status]}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-white/15 mb-4 font-mono relative z-10">
                          <span className="capitalize">{releaseTypeLabels[r.releaseType]}</span>
                          <span>{r.tracks.length} tracks</span>
                          <span>{new Date(r.releaseDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center gap-2 relative z-10">
                          <StatusDropdown status={r.status} onChange={(s) => handleStatusChange(r.id, s)} />
                          <button onClick={() => setSelectedRelease(r)}
                            className="p-2.5 rounded-xl glass text-white/25 hover:text-violet-300 transition">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => { if (deleteConfirm === r.id) handleDelete(r.id); else setDeleteConfirm(r.id); }}
                            className={`p-2.5 rounded-xl transition ${deleteConfirm === r.id ? 'glass text-rose-400/70 bg-rose-500/5' : 'glass text-white/15 hover:text-rose-400/60'}`}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════ */}
        {/* SETTINGS TAB                        */}
        {/* ════════════════════════════════════ */}
        {tab === 'settings' && (
          <div className="max-w-2xl animate-fade-in">
            <h2 className="text-2xl font-black text-white mb-8 flex items-center gap-3" style={font}>
              <Settings className="w-6 h-6 text-violet-300" /> System Settings
            </h2>

            <div className="space-y-6">
              {/* Logo */}
              <div className="glass-card rounded-2xl p-6">
                <label className="block text-[11px] font-bold text-violet-300/30 uppercase tracking-[0.15em] mb-4 relative z-10">Company Logo</label>
                <div className="flex items-center gap-4 relative z-10">
                  {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo" className="h-14 w-auto rounded-xl glass p-2" />
                  ) : (
                    <div className="h-14 px-5 rounded-xl glass flex items-center text-sm text-violet-300/15 font-mono">
                      No logo uploaded
                    </div>
                  )}
                  <button onClick={() => logoInputRef.current?.click()}
                    className="btn-ghost flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold">
                    <Upload className="w-3.5 h-3.5" /> {settings.logoUrl ? 'Change' : 'Upload'}
                  </button>
                  {settings.logoUrl && (
                    <button onClick={() => setSettingsState(p => ({ ...p, logoUrl: '' }))}
                      className="text-xs text-rose-400/40 hover:text-rose-400/70 transition font-bold">Remove</button>
                  )}
                  <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </div>
              </div>

              {/* Fields */}
              <div className="glass-card rounded-2xl p-6 space-y-5">
                {[
                  { key: 'companyName' as const, label: 'Company Name', type: 'text', ph: 'In Lights', hint: '' },
                  { key: 'adminEmail' as const, label: 'Admin Email', type: 'email', ph: 'admin@inlights.com', hint: 'Receives notifications on new submissions' },
                  { key: 'discordWebhookUrl' as const, label: 'Discord Webhook URL', type: 'url', ph: 'https://discord.com/api/webhooks/...', hint: 'Sends notification to Discord on new submission' },
                  { key: 'googleSheetId' as const, label: 'Google Sheet ID', type: 'text', ph: '1BxiMVs0XRA5nFMdKvBd...', hint: 'Submissions are mirrored to this Google Sheet' },
                ].map(f => (
                  <div key={f.key} className="relative z-10">
                    <label className="block text-[11px] font-bold text-violet-300/30 uppercase tracking-[0.15em] mb-2">{f.label}</label>
                    <input type={f.type} value={settings[f.key]}
                      onChange={e => setSettingsState(p => ({ ...p, [f.key]: e.target.value }))}
                      className={inputCls} placeholder={f.ph} />
                    {f.hint && <p className="text-[11px] text-violet-300/10 mt-1.5 font-mono">{f.hint}</p>}
                  </div>
                ))}
              </div>

              {/* Integration Notes */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-xs font-bold text-violet-300/20 uppercase tracking-wider mb-4 flex items-center gap-2 relative z-10">
                  <AlertTriangle className="w-4 h-4 text-amber-400/40" /> Integration Notes
                </h3>
                <ul className="space-y-2.5 text-[11px] text-white/15 relative z-10 font-mono">
                  {[
                    ['Supabase', 'Configure SUPABASE_URL and SUPABASE_ANON_KEY as env variables'],
                    ['Google Drive', 'Set up a Service Account and share the root folder'],
                    ['Google Sheets', 'Share the target spreadsheet with the service account email'],
                    ['Email', 'Configure an SMTP provider or use Supabase Edge Functions'],
                    ['Discord', 'Create a webhook in your Discord channel settings'],
                  ].map(([name, desc]) => (
                    <li key={name}>
                      <span className="text-violet-300/25 font-bold">{name}:</span> {desc}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Save */}
              <button onClick={handleSaveSettings}
                className="btn-primary flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm">
                <span className="flex items-center gap-2">
                  {settingsSaved ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Settings</>}
                </span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ════════════════════════════════════ */}
      {/* RELEASE DETAIL PANEL                */}
      {/* ════════════════════════════════════ */}
      {selectedRelease && (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-lg" onClick={() => setSelectedRelease(null)} />
          <div className="relative w-full max-w-xl h-full overflow-y-auto custom-scroll animate-slide-in-right"
            style={{ background: 'rgba(6,2,15,0.95)', backdropFilter: 'blur(40px)', borderLeft: '1px solid rgba(139,92,246,0.08)' }}>
            {/* Header */}
            <div className="sticky top-0 z-10 px-6 py-5 flex items-center justify-between"
              style={{ background: 'rgba(6,2,15,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(139,92,246,0.06)' }}>
              <h3 className="text-lg font-black text-white" style={font}>
                Release Details
              </h3>
              <button onClick={() => setSelectedRelease(null)}
                className="p-2 rounded-xl hover:bg-violet-500/[0.06] text-white/25 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Overview */}
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/10 flex items-center justify-center border border-violet-500/15 neon-purple">
                    {(() => { const I = typeIcons[selectedRelease.releaseType] || Music; return <I className="w-7 h-7 text-violet-300" />; })()}
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-white" style={font}>
                      {selectedRelease.releaseTitle}
                    </h4>
                    <p className="text-sm text-violet-300/25 font-mono">by {selectedRelease.artistName}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Release Type', value: releaseTypeLabels[selectedRelease.releaseType] },
                    { label: 'Release Date', value: new Date(selectedRelease.releaseDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) },
                    { label: 'Submission ID', value: selectedRelease.id },
                    { label: 'Submitted', value: new Date(selectedRelease.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
                    { label: 'Cover Art', value: selectedRelease.coverArtFileName || '—' },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="text-[10px] text-violet-300/12 uppercase tracking-wider mb-1 font-mono">{item.label}</p>
                      <p className="text-sm text-white/50 font-bold break-all" style={font}>{item.value}</p>
                    </div>
                  ))}
                  <div>
                    <p className="text-[10px] text-violet-300/12 uppercase tracking-wider mb-1 font-mono">Status</p>
                    <StatusDropdown status={selectedRelease.status} onChange={(s) => handleStatusChange(selectedRelease.id, s)} />
                  </div>
                </div>
              </div>

              {/* Artists */}
              {(selectedRelease.collaborations.length > 0 || selectedRelease.features.length > 0) && (
                <div className="border-t border-violet-500/[0.06] pt-6">
                  <p className="text-[10px] font-bold text-violet-400/12 uppercase tracking-[0.2em] mb-4 font-mono">Artists</p>
                  {selectedRelease.collaborations.map((c, i) => (
                    <div key={i} className="mb-3">
                      <p className="text-sm text-white/40"><span className="text-violet-300/15">Collab:</span> {c.name}</p>
                      <div className="flex gap-2 mt-1.5">
                        {c.spotifyUrl && <LinkPill href={c.spotifyUrl} label="Spotify" />}
                        {c.appleMusicUrl && <LinkPill href={c.appleMusicUrl} label="Apple Music" />}
                        {c.anghamiUrl && <LinkPill href={c.anghamiUrl} label="Anghami" />}
                      </div>
                    </div>
                  ))}
                  {selectedRelease.features.map((f, i) => (
                    <div key={i} className="mb-3">
                      <p className="text-sm text-white/40"><span className="text-violet-300/15">Feat:</span> {f.name}</p>
                      <div className="flex gap-2 mt-1.5">
                        {f.spotifyUrl && <LinkPill href={f.spotifyUrl} label="Spotify" />}
                        {f.appleMusicUrl && <LinkPill href={f.appleMusicUrl} label="Apple Music" />}
                        {f.anghamiUrl && <LinkPill href={f.anghamiUrl} label="Anghami" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tracklist */}
              <div className="border-t border-violet-500/[0.06] pt-6">
                <p className="text-[10px] font-bold text-violet-400/12 uppercase tracking-[0.2em] mb-4 font-mono">
                  Tracklist ({selectedRelease.tracks.length})
                </p>
                <div className="space-y-3">
                  {selectedRelease.tracks.map((t, i) => (
                    <div key={t.id} className="glass rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-black text-violet-400/30 w-5 font-mono">{String(i + 1).padStart(2, '0')}</span>
                        <span className="text-sm font-bold text-white/60 flex-1" style={font}>{t.title}</span>
                        {t.explicit && <span className="text-[8px] font-black text-violet-300/15 border border-violet-500/10 rounded px-1.5 py-0.5 font-mono">E</span>}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-white/15 ml-8 font-mono">
                        {t.previewTime && <span>Preview: {t.previewTime}</span>}
                        {t.producedBy && <span>Prod: {t.producedBy}</span>}
                        {t.lyricsBy && <span>Lyrics: {t.lyricsBy}</span>}
                        {t.mixedBy && <span>Mix: {t.mixedBy}</span>}
                        {t.masteredBy && <span>Master: {t.masteredBy}</span>}
                        {t.wavFileName && <span className="text-emerald-400/30">✓ {t.wavFileName}</span>}
                      </div>
                      {t.lyricsDocLink && (
                        <div className="mt-2 ml-8">
                          <LinkPill href={t.lyricsDocLink} label="Lyrics Doc" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Links */}
              {(selectedRelease.fullDriveFolderLink || selectedRelease.promoFolderLink) && (
                <div className="border-t border-violet-500/[0.06] pt-6">
                  <p className="text-[10px] font-bold text-violet-400/12 uppercase tracking-[0.2em] mb-4 font-mono">Links</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedRelease.fullDriveFolderLink && <LinkPill href={selectedRelease.fullDriveFolderLink} label="Drive Folder" />}
                    {selectedRelease.promoFolderLink && <LinkPill href={selectedRelease.promoFolderLink} label="Promo Folder" />}
                  </div>
                </div>
              )}

              {/* Delete */}
              <div className="border-t border-violet-500/[0.06] pt-6">
                {deleteConfirm === selectedRelease.id ? (
                  <div className="glass rounded-xl p-4 border border-rose-500/10 flex items-center justify-between">
                    <p className="text-sm text-rose-400/50" style={font}>Delete permanently?</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleDelete(selectedRelease.id)}
                        className="px-4 py-2 rounded-lg bg-rose-500/15 text-rose-400/70 text-xs font-black hover:bg-rose-500/25 transition" style={font}>Delete</button>
                      <button onClick={() => setDeleteConfirm(null)}
                        className="px-4 py-2 rounded-lg glass text-white/25 text-xs font-bold hover:text-white/40 transition" style={font}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(selectedRelease.id)}
                    className="flex items-center gap-2 text-sm text-white/10 hover:text-rose-400/50 transition font-bold" style={font}>
                    <Trash2 className="w-4 h-4" /> Delete Release
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Status Dropdown ─────────────────────
function StatusDropdown({ status, onChange }: { status: ReleaseStatus; onChange: (s: ReleaseStatus) => void }) {
  const [open, setOpen] = useState(false);
  const statuses: ReleaseStatus[] = ['pending', 'approved', 'scheduled', 'released'];

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-2 rounded-xl border transition-all ${statusColors[status]}`}>
        {statusLabels[status]}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-2 z-50 glass-card rounded-xl py-1.5 shadow-2xl min-w-[140px] animate-scale-in border border-violet-500/[0.08]">
            {statuses.map(s => (
              <button key={s} onClick={() => { onChange(s); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-xs font-bold capitalize transition flex items-center gap-2 ${
                  s === status ? 'text-violet-300 bg-violet-500/5' : 'text-white/25 hover:text-white/50 hover:bg-violet-500/[0.03]'
                }`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                {s === status && <Check className="w-3 h-3" />}
                {statusLabels[s]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Link Pill ───────────────────────────
function LinkPill({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-[10px] text-violet-300/40 hover:text-violet-300/70 transition glass rounded-lg px-3 py-1.5 border border-violet-500/10 hover:border-violet-500/20 font-bold font-mono">
      <ExternalLink className="w-3 h-3" /> {label}
    </a>
  );
}
