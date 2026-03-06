import { useState, useEffect, useRef } from 'react';
import {
  LogOut, Download, Search, Eye, Trash2, ChevronDown, X,
  Music, Disc, ExternalLink, Settings, Check,
  LayoutDashboard, Upload, Save, Clock, Calendar,
  Headphones, AlertTriangle, BarChart3, Users,
} from 'lucide-react';
import {
  type Release, type ReleaseStatus, type Settings as SettingsType,
  getReleases, updateRelease, deleteReleaseById, exportToCSV,
  getSettings, saveSettings, statusLabels, releaseTypeLabels, logout,
} from '@/lib/types';

const syne = { fontFamily: "'Syne', sans-serif" };

const STATUSES: (ReleaseStatus | 'all')[] = ['all', 'pending', 'approved', 'scheduled', 'released'];
const typeIcons: Record<string, typeof Music> = { single: Music, ep: Disc, album: Headphones };



export default function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [releases, setReleases] = useState<Release[]>([]);
  const [filter, setFilter] = useState<ReleaseStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'releases' | 'settings'>('releases');
  const [selected, setSelected] = useState<Release | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [settings, setSettingsState] = useState<SettingsType>(getSettings());
  const [saved, setSaved] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setReleases(getReleases()); }, []);

  const filtered = releases
    .filter(r => filter === 'all' || r.status === filter)
    .filter(r => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return r.artistName.toLowerCase().includes(s) || r.releaseTitle.toLowerCase().includes(s) || r.id.toLowerCase().includes(s);
    });

  const counts = {
    all: releases.length,
    pending: releases.filter(r => r.status === 'pending').length,
    approved: releases.filter(r => r.status === 'approved').length,
    scheduled: releases.filter(r => r.status === 'scheduled').length,
    released: releases.filter(r => r.status === 'released').length,
  };

  const handleStatus = (id: string, status: ReleaseStatus) => {
    updateRelease(id, { status });
    setReleases(getReleases());
    if (selected?.id === id) setSelected({ ...selected, status });
  };

  const handleDelete = (id: string) => {
    deleteReleaseById(id);
    setReleases(getReleases());
    setDeleteId(null);
    if (selected?.id === id) setSelected(null);
  };

  const handleLogout = () => { logout(); onLogout(); };

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setSettingsState(p => ({ ...p, logoUrl: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const sideNav = [
    { key: 'releases' as const, icon: LayoutDashboard, label: 'Releases' },
    { key: 'settings' as const, icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* ═══ SIDEBAR (Desktop) ══════════════ */}
      <aside className="sidebar hidden md:flex">
        <div className="p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-7 w-auto" />
            ) : (
              <>
                <div className="w-8 h-8 rounded-lg bg-[var(--purple)] flex items-center justify-center">
                  <span className="text-white font-bold text-xs" style={syne}>IL</span>
                </div>
                <span className="text-sm font-bold tracking-[0.12em] text-white" style={syne}>IN LIGHTS</span>
              </>
            )}
          </div>
        </div>

        <nav className="flex-1 p-3">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-3 mb-2">Menu</p>
          {sideNav.map(n => (
            <button key={n.key} onClick={() => setTab(n.key)}
              className={`sidebar-link w-full ${tab === n.key ? 'sidebar-link-active' : ''}`}>
              <n.icon className="w-4 h-4" /> {n.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-[var(--border)]">
          <button onClick={handleLogout} className="sidebar-link w-full text-red-400/60 hover:text-red-400 hover:bg-red-500/5">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ═══ MAIN CONTENT ═══════════════════ */}
      <div className="flex-1 md:ml-[260px]">
        {/* Mobile Header */}
        <header className="md:hidden border-b border-[var(--border)] bg-[var(--bg)] sticky top-0 z-30">
          <div className="px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-[var(--purple)] flex items-center justify-center">
                <span className="text-white font-bold text-[10px]" style={syne}>IL</span>
              </div>
              <span className="text-sm font-bold text-white" style={syne}>IN LIGHTS</span>
            </div>
            <div className="flex items-center gap-2">
              {sideNav.map(n => (
                <button key={n.key} onClick={() => { setTab(n.key); }}
                  className={`p-2.5 rounded-lg transition ${tab === n.key ? 'bg-[var(--purple)]/10 text-[var(--purple-light)]' : 'text-[var(--text-muted)]'}`}>
                  <n.icon className="w-4 h-4" />
                </button>
              ))}
              <button onClick={handleLogout} className="p-2.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 transition">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 max-w-[1200px]">
          {/* ════════════════════════════════ */}
          {/* RELEASES TAB                    */}
          {/* ════════════════════════════════ */}
          {tab === 'releases' && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-xl font-bold text-white" style={syne}>Releases</h1>
                  <p className="text-sm text-[var(--text-muted)]">Manage all submissions</p>
                </div>
                <button onClick={() => exportToCSV(filtered)} className="btn-secondary text-sm py-2 px-4">
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Total', val: counts.all, icon: BarChart3, color: 'text-white', bg: 'bg-white/5' },
                  { label: 'Pending', val: counts.pending, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/8' },
                  { label: 'Approved', val: counts.approved, icon: Check, color: 'text-emerald-400', bg: 'bg-emerald-500/8' },
                  { label: 'Scheduled', val: counts.scheduled, icon: Calendar, color: 'text-[var(--purple-light)]', bg: 'bg-[var(--purple)]/8' },
                ].map(s => (
                  <div key={s.label} className="card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}>
                        <s.icon className={`w-4 h-4 ${s.color}`} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-white" style={syne}>{s.val}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-10" placeholder="Search artist, title, or ID..." />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {STATUSES.map(s => (
                    <button key={s} onClick={() => setFilter(s)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold capitalize transition ${
                        filter === s
                          ? 'bg-[var(--purple)]/15 text-[var(--purple-light)] border border-[var(--purple)]/30'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-transparent hover:bg-white/[0.03]'
                      }`}>
                      {s === 'all' ? `All (${counts.all})` : `${statusLabels[s]} (${counts[s]})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              {filtered.length === 0 ? (
                <div className="card text-center py-16">
                  <Users className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
                  <p className="text-[var(--text-secondary)] font-medium">No releases found</p>
                  <p className="text-sm text-[var(--text-muted)] mt-1">Try adjusting your filters</p>
                </div>
              ) : (
                <>
                  {/* Desktop */}
                  <div className="hidden lg:block card overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr>
                          {['Artist', 'Release', 'Type', 'Date', 'Status', ''].map(h => (
                            <th key={h} className="table-header text-left">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(r => {
                          const Icon = typeIcons[r.releaseType] || Music;
                          return (
                            <tr key={r.id} className="table-row group">
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-lg bg-[var(--purple)]/8 flex items-center justify-center shrink-0">
                                    <Icon className="w-4 h-4 text-[var(--purple-light)]" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-white">{r.artistName}</p>
                                    <p className="text-[11px] text-[var(--text-muted)]">{r.id}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                <p className="text-sm text-[var(--text-secondary)]">{r.releaseTitle}</p>
                                <p className="text-[11px] text-[var(--text-muted)]">{r.tracks.length} track{r.tracks.length !== 1 ? 's' : ''}</p>
                              </td>
                              <td className="px-5 py-3.5">
                                <span className="text-sm text-[var(--text-muted)] capitalize">{releaseTypeLabels[r.releaseType]}</span>
                              </td>
                              <td className="px-5 py-3.5 text-sm text-[var(--text-muted)]">
                                {new Date(r.releaseDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td className="px-5 py-3.5">
                                <StatusDropdown status={r.status} onChange={s => handleStatus(r.id, s)} />
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => setSelected(r)} className="p-2 rounded-lg hover:bg-white/5 text-[var(--text-muted)] hover:text-white transition" title="View">
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  {deleteId === r.id ? (
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => handleDelete(r.id)} className="btn-danger text-[11px] py-1 px-2">Delete</button>
                                      <button onClick={() => setDeleteId(null)} className="p-1.5 text-[var(--text-muted)] hover:text-white"><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                  ) : (
                                    <button onClick={() => setDeleteId(r.id)} className="p-2 rounded-lg hover:bg-red-500/5 text-[var(--text-muted)] hover:text-red-400 transition" title="Delete">
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

                  {/* Mobile */}
                  <div className="lg:hidden space-y-3">
                    {filtered.map(r => {
                      const Icon = typeIcons[r.releaseType] || Music;
                      return (
                        <div key={r.id} className="card p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-[var(--purple)]/8 flex items-center justify-center">
                                <Icon className="w-5 h-5 text-[var(--purple-light)]" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-white">{r.artistName}</p>
                                <p className="text-xs text-[var(--text-secondary)]">{r.releaseTitle}</p>
                              </div>
                            </div>
                            <span className={`badge ${statusBadge[r.status]}`}>
                              <span className={`badge-dot ${statusDot[r.status]}`} />
                              {statusLabels[r.status]}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mb-3">
                            <span className="capitalize">{releaseTypeLabels[r.releaseType]}</span>
                            <span>•</span>
                            <span>{r.tracks.length} tracks</span>
                            <span>•</span>
                            <span>{new Date(r.releaseDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusDropdown status={r.status} onChange={s => handleStatus(r.id, s)} />
                            <button onClick={() => setSelected(r)} className="p-2 rounded-lg bg-white/[0.03] border border-[var(--border)] text-[var(--text-muted)] hover:text-white transition">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => { if (deleteId === r.id) handleDelete(r.id); else setDeleteId(r.id); }}
                              className={`p-2 rounded-lg border transition ${deleteId === r.id ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-white/[0.03] border-[var(--border)] text-[var(--text-muted)] hover:text-red-400'}`}>
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

          {/* ════════════════════════════════ */}
          {/* SETTINGS TAB                    */}
          {/* ════════════════════════════════ */}
          {tab === 'settings' && (
            <div className="max-w-2xl animate-fade-in">
              <div className="mb-6">
                <h1 className="text-xl font-bold text-white" style={syne}>Settings</h1>
                <p className="text-sm text-[var(--text-muted)]">Configure your label system</p>
              </div>

              <div className="space-y-5">
                {/* Logo */}
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Company Logo</h3>
                  <div className="flex items-center gap-4">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="h-12 w-auto rounded-lg bg-white/5 p-2" />
                    ) : (
                      <div className="h-12 px-5 rounded-lg bg-white/[0.03] border border-[var(--border)] flex items-center text-sm text-[var(--text-muted)]">
                        No logo
                      </div>
                    )}
                    <button onClick={() => logoRef.current?.click()} className="btn-secondary text-sm py-2 px-4">
                      <Upload className="w-3.5 h-3.5" /> {settings.logoUrl ? 'Change' : 'Upload'}
                    </button>
                    {settings.logoUrl && (
                      <button onClick={() => setSettingsState(p => ({ ...p, logoUrl: '' }))} className="text-xs text-red-400/70 hover:text-red-400 transition font-medium">
                        Remove
                      </button>
                    )}
                    <input ref={logoRef} type="file" accept="image/*" onChange={handleLogo} className="hidden" />
                  </div>
                </div>

                {/* Fields */}
                <div className="card p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-white">General</h3>
                  {[
                    { key: 'companyName' as const, label: 'Company Name', type: 'text', ph: 'In Lights', hint: '' },
                    { key: 'adminEmail' as const, label: 'Admin Email', type: 'email', ph: 'admin@inlights.com', hint: 'Receives notifications on new submissions' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="label">{f.label}</label>
                      <input type={f.type} value={settings[f.key]} onChange={e => setSettingsState(p => ({ ...p, [f.key]: e.target.value }))} className="input" placeholder={f.ph} />
                      {f.hint && <p className="text-xs text-[var(--text-muted)] mt-1">{f.hint}</p>}
                    </div>
                  ))}
                </div>

                {/* Integrations */}
                <div className="card p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-white">Integrations</h3>
                  {[
                    { key: 'discordWebhookUrl' as const, label: 'Discord Webhook URL', type: 'url', ph: 'https://discord.com/api/webhooks/...', hint: 'Sends notification on new submissions' },
                    { key: 'googleSheetId' as const, label: 'Google Sheet ID', type: 'text', ph: '1BxiMVs0XRA5nFMdKvBd...', hint: 'Submissions mirrored to this Sheet' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="label">{f.label}</label>
                      <input type={f.type} value={settings[f.key]} onChange={e => setSettingsState(p => ({ ...p, [f.key]: e.target.value }))} className="input" placeholder={f.ph} />
                      {f.hint && <p className="text-xs text-[var(--text-muted)] mt-1">{f.hint}</p>}
                    </div>
                  ))}
                </div>

                {/* Notes */}
                <div className="card p-5 border-amber-500/10">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-2">Integration Notes</h3>
                      <ul className="space-y-1.5 text-sm text-[var(--text-muted)]">
                        <li><b className="text-[var(--text-secondary)]">Supabase:</b> Set SUPABASE_URL & SUPABASE_ANON_KEY as env vars</li>
                        <li><b className="text-[var(--text-secondary)]">Google Drive:</b> Set up a Service Account and share the root folder</li>
                        <li><b className="text-[var(--text-secondary)]">Google Sheets:</b> Share the sheet with the service account email</li>
                        <li><b className="text-[var(--text-secondary)]">Discord:</b> Create a webhook in your channel settings</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <button onClick={handleSave} className="btn-primary">
                  {saved ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Settings</>}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ════════════════════════════════════ */}
      {/* DETAIL PANEL                        */}
      {/* ════════════════════════════════════ */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="overlay absolute inset-0" onClick={() => setSelected(null)} />
          <div className="detail-panel relative w-full max-w-lg h-full overflow-y-auto animate-slide-right">
            {/* Header */}
            <div className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between bg-[#0f0f13] border-b border-[var(--border)]">
              <h3 className="text-base font-bold text-white" style={syne}>Release Details</h3>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-white/5 text-[var(--text-muted)] transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Overview */}
              <div>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 rounded-xl bg-[var(--purple)]/10 border border-[var(--purple)]/20 flex items-center justify-center">
                    {(() => { const I = typeIcons[selected.releaseType] || Music; return <I className="w-6 h-6 text-[var(--purple-light)]" />; })()}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white" style={syne}>{selected.releaseTitle}</h4>
                    <p className="text-sm text-[var(--text-muted)]">by {selected.artistName}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Release Type', value: releaseTypeLabels[selected.releaseType] },
                    { label: 'Release Date', value: new Date(selected.releaseDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) },
                    { label: 'Submission ID', value: selected.id },
                    { label: 'Submitted', value: new Date(selected.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
                    { label: 'Cover Art', value: selected.coverArtFileName || '—' },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="text-xs text-[var(--text-muted)] mb-1">{item.label}</p>
                      <p className="text-sm text-white font-medium break-all">{item.value}</p>
                    </div>
                  ))}
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-1">Status</p>
                    <StatusDropdown status={selected.status} onChange={s => handleStatus(selected.id, s)} />
                  </div>
                </div>
              </div>

              {/* Collaborators */}
              {(selected.collaborations.length > 0 || selected.features.length > 0) && (
                <Section title="Artists">
                  {selected.collaborations.map((c, i) => (
                    <div key={i} className="mb-3">
                      <p className="text-sm text-white"><span className="text-[var(--text-muted)]">Collab:</span> {c.name}</p>
                      <div className="flex gap-2 mt-1.5 flex-wrap">
                        {c.spotifyUrl && <LinkPill href={c.spotifyUrl} label="Spotify" />}
                        {c.appleMusicUrl && <LinkPill href={c.appleMusicUrl} label="Apple Music" />}
                        {c.anghamiUrl && <LinkPill href={c.anghamiUrl} label="Anghami" />}
                      </div>
                    </div>
                  ))}
                  {selected.features.map((f, i) => (
                    <div key={i} className="mb-3">
                      <p className="text-sm text-white"><span className="text-[var(--text-muted)]">Feat:</span> {f.name}</p>
                      <div className="flex gap-2 mt-1.5 flex-wrap">
                        {f.spotifyUrl && <LinkPill href={f.spotifyUrl} label="Spotify" />}
                        {f.appleMusicUrl && <LinkPill href={f.appleMusicUrl} label="Apple Music" />}
                        {f.anghamiUrl && <LinkPill href={f.anghamiUrl} label="Anghami" />}
                      </div>
                    </div>
                  ))}
                </Section>
              )}

              {/* Tracklist */}
              <Section title={`Tracklist (${selected.tracks.length})`}>
                <div className="space-y-2">
                  {selected.tracks.map((t, i) => (
                    <div key={t.id} className="rounded-lg bg-white/[0.02] border border-[var(--border)] p-3">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="text-xs font-bold text-[var(--text-muted)] w-5 text-right">{String(i + 1).padStart(2, '0')}</span>
                        <span className="text-sm font-medium text-white flex-1">{t.title}</span>
                        {t.explicit && <span className="text-[10px] font-bold text-[var(--text-muted)] border border-[var(--border)] rounded px-1.5 py-0.5">E</span>}
                        {t.wavFileName && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-[var(--text-muted)] ml-8">
                        {t.previewTime && <span>Preview: {t.previewTime}</span>}
                        {t.producedBy && <span>Prod: {t.producedBy}</span>}
                        {t.lyricsBy && <span>Lyrics: {t.lyricsBy}</span>}
                        {t.mixedBy && <span>Mix: {t.mixedBy}</span>}
                        {t.masteredBy && <span>Master: {t.masteredBy}</span>}
                        {t.wavFileName && <span className="text-emerald-400/70">✓ {t.wavFileName}</span>}
                      </div>
                      {t.lyricsDocLink && <div className="mt-2 ml-8"><LinkPill href={t.lyricsDocLink} label="Lyrics Doc" /></div>}
                    </div>
                  ))}
                </div>
              </Section>

              {/* Links */}
              {(selected.fullDriveFolderLink || selected.promoFolderLink) && (
                <Section title="Links">
                  <div className="flex flex-wrap gap-2">
                    {selected.fullDriveFolderLink && <LinkPill href={selected.fullDriveFolderLink} label="Drive Folder" />}
                    {selected.promoFolderLink && <LinkPill href={selected.promoFolderLink} label="Promo Folder" />}
                  </div>
                </Section>
              )}

              {/* Delete */}
              <div className="border-t border-[var(--border)] pt-5">
                {deleteId === selected.id ? (
                  <div className="flex items-center justify-between bg-red-500/5 border border-red-500/15 rounded-lg p-3">
                    <p className="text-sm text-red-400">Delete permanently?</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleDelete(selected.id)} className="btn-danger text-xs py-1.5 px-3">Delete</button>
                      <button onClick={() => setDeleteId(null)} className="btn-ghost text-xs">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setDeleteId(selected.id)} className="btn-ghost text-red-400/60 hover:text-red-400 hover:bg-red-500/5">
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-[var(--border)] pt-5">
      <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">{title}</h4>
      {children}
    </div>
  );
}

function StatusDropdown({ status, onChange }: { status: ReleaseStatus; onChange: (s: ReleaseStatus) => void }) {
  const [open, setOpen] = useState(false);
  const all: ReleaseStatus[] = ['pending', 'approved', 'scheduled', 'released'];

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className={`badge ${statusBadge[status]} cursor-pointer`}>
        <span className={`badge-dot ${statusDot[status]}`} />
        {statusLabels[status]}
        <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1.5 z-50 bg-[var(--card)] border border-[var(--border)] rounded-lg py-1 shadow-xl min-w-[140px] animate-scale-in">
            {all.map(s => (
              <button key={s} onClick={() => { onChange(s); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs font-medium capitalize transition flex items-center gap-2 ${
                  s === status ? 'text-white bg-white/[0.04]' : 'text-[var(--text-muted)] hover:text-white hover:bg-white/[0.03]'
                }`}>
                <span className={`badge-dot ${statusDot[s]}`} />
                {statusLabels[s]}
                {s === status && <Check className="w-3 h-3 ml-auto" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const statusBadge: Record<ReleaseStatus, string> = {
  pending: 'badge-pending',
  approved: 'badge-approved',
  scheduled: 'badge-scheduled',
  released: 'badge-released',
};

const statusDot: Record<ReleaseStatus, string> = {
  pending: 'badge-dot-pending',
  approved: 'badge-dot-approved',
  scheduled: 'badge-dot-scheduled',
  released: 'badge-dot-released',
};

function LinkPill({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs text-[var(--purple-light)] hover:text-white transition bg-[var(--purple)]/8 border border-[var(--purple)]/15 hover:border-[var(--purple)]/30 rounded-md px-2.5 py-1 font-medium">
      <ExternalLink className="w-3 h-3" /> {label}
    </a>
  );
}
