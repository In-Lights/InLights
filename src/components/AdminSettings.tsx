import { useState, useEffect } from 'react';
import {
  Save, Settings, FileText, Bell, Lock, Table, Send,
  CheckCircle2, XCircle, Loader2, Palette, ExternalLink,
  Copy, Check, ChevronDown, ChevronUp, Tag, Sliders, FolderOpen, Users2, Activity, Database, Mail, Eye, EyeOff, Sparkles
} from 'lucide-react';
import { AdminSettings as AdminSettingsType, DEFAULT_ADMIN_SETTINGS } from '../types';
import { getAdminSettings, saveAdminSettings, saveAdminPassword, testDiscordWebhook, testEmailConfig, getAdminSession, syncAllToSheets } from '../store';
import { applyAccentColor } from '../utils/accentColor';
import TeamManagement from './TeamManagement';
import CustomRoleBuilder from './CustomRoleBuilder';
import ActivityLog from './ActivityLog';
import DataBackup from './DataBackup';
import SupabaseStats from './SupabaseStats';

interface Props { onSaved: () => void; }

const ACCENT_COLORS = [
  { label: 'Violet', value: '#7c3aed' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Rose', value: '#e11d48' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Cyan', value: '#0891b2' },
  { label: 'Fuchsia', value: '#a21caf' },
  { label: 'Orange', value: '#ea580c' },
];

const APPS_SCRIPT_CODE = `function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Releases') || ss.getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    if (data.action === 'newRelease') {
      if (sheet.getLastRow() === 0) {
        sheet.appendRow([
          'ID','Submitted At','Status','Main Artist','Collaborations',
          'Features','Type','Title','Release Date','Genre','Explicit',
          'Track Count','Track Names','Cover Art','Promo Link','Drive Folder'
        ]);
        sheet.getRange(1,1,1,16).setFontWeight('bold');
      }
      sheet.appendRow([
        data.id, data.submittedAt, data.status, data.mainArtist,
        data.collaborations, data.features, data.releaseType,
        data.releaseTitle, data.releaseDate, data.genre, data.explicit,
        data.trackCount, data.tracks, data.coverArtLink,
        data.promoLink, data.driveFolderLink
      ]);
    }
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'active' }))
    .setMimeType(ContentService.MimeType.JSON);
}`;

// ── UI helpers ──────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${value ? '' : 'bg-zinc-700'}`}
      style={value ? { background: 'var(--accent)' } : undefined}
    >
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 p-4 bg-zinc-900/60 rounded-xl cursor-pointer hover:bg-zinc-900/80 transition-all">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
      </div>
      <Toggle value={value} onChange={onChange} />
    </label>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-400 mb-1.5">{label}</label>
      {hint && <p className="text-xs text-zinc-600 mb-2">{hint}</p>}
      {children}
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="bg-black/60 border border-white/5 rounded-xl p-4 text-xs text-emerald-400 overflow-x-auto max-h-56 overflow-y-auto font-mono leading-relaxed">
        {code}
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white text-xs transition-all"
      >
        {copied ? <><Check className="w-3 h-3 text-emerald-400" />Copied!</> : <><Copy className="w-3 h-3" />Copy</>}
      </button>
    </div>
  );
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/5 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/[0.02] transition-all"
      >
        {title}
        {open ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">{children}</div>}
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-6 space-y-5">
      <div>
        <h3 className="font-bold">{title}</h3>
        {desc && <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
    >
      {copied ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
    </button>
  );
}

function SyncAllSheetsButton({ webhookUrl }: { webhookUrl: string }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ sent: number } | null>(null);
  const handle = async () => {
    if (!confirm('This will re-send all releases to your Google Sheet. Existing rows may duplicate depending on your Apps Script. Continue?')) return;
    setSyncing(true); setResult(null);
    const r = await syncAllToSheets();
    setResult(r);
    setSyncing(false);
  };
  return (
    <div className="flex items-center gap-2">
      <button onClick={handle} disabled={syncing || !webhookUrl}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 text-sm font-medium hover:bg-blue-600/30 transition-all disabled:opacity-50">
        {syncing ? <><Loader2 className="w-4 h-4 animate-spin" />Syncing...</> : <>↑ Sync All Releases</>}
      </button>
      {result && <span className="text-xs text-emerald-400">✓ {result.sent} releases synced</span>}
    </div>
  );
}

export default function AdminSettingsPanel({ onSaved }: Props) {
  const [settings, setSettings] = useState<AdminSettingsType>({ ...DEFAULT_ADMIN_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [activeTab, setActiveTab] = useState<'branding' | 'form' | 'rules' | 'status' | 'security' | 'advanced' | 'email' | 'drive' | 'discord' | 'sheets' | 'team' | 'log' | 'backup' | 'ai'>('branding');

  const [testingDiscord, setTestingDiscord] = useState(false);
  const [discordResult, setDiscordResult] = useState<'success' | 'fail' | null>(null);
  const [discordError, setDiscordError] = useState('');
  const [testingSheets, setTestingSheets] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<'success' | 'fail' | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [sheetsResult, setSheetsResult] = useState<'success' | 'fail' | null>(null);
  const [copiedAdminUrl, setCopiedAdminUrl] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordResult, setPasswordResult] = useState<'success' | 'error' | null>(null);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    getAdminSettings().then(s => { setSettings(s); setLoading(false); });
  }, []);

  const set = <K extends keyof AdminSettingsType>(key: K, value: AdminSettingsType[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    if (key === 'accentColor' && typeof value === 'string') applyAccentColor(value);
  };

  const handleSave = async () => {
    setSaving(true); setSaveError('');
    try {
      await saveAdminSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved();
    } catch (err) {
      setSaveError(`Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally { setSaving(false); }
  };

  const handleTestDiscord = async () => {
    if (!settings.discordWebhook) return;
    setTestingDiscord(true); setDiscordResult(null); setDiscordError('');
    try { await saveAdminSettings(settings); } catch {}
    const ok = await testDiscordWebhook(settings.discordWebhook);
    setDiscordResult(ok ? 'success' : 'fail');
    if (!ok) setDiscordError('Webhook URL may be invalid or expired. Double-check and try again.');
    setTestingDiscord(false);
    setTimeout(() => setDiscordResult(null), 8000);
  };

  const handleTestSheets = async () => {
    if (!settings.googleSheetsWebhook) return;
    setTestingSheets(true); setSheetsResult(null);
    try {
      await fetch(settings.googleSheetsWebhook, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'newRelease', id: 'TEST-001',
          submittedAt: new Date().toISOString(), status: 'pending',
          mainArtist: '🧪 Test Artist', collaborations: '', features: '',
          releaseType: 'single', releaseTitle: '✅ Webhook Test Row',
          releaseDate: new Date().toISOString().split('T')[0],
          genre: 'Test', explicit: 'No', trackCount: 1,
          tracks: 'Test Track', coverArtLink: '', promoLink: '', driveFolderLink: '',
        }),
      });
      setSheetsResult('success');
    } catch { setSheetsResult('fail'); }
    setTestingSheets(false);
    setTimeout(() => setSheetsResult(null), 8000);
  };

  const daysLabel = (n: number) => n === 0 ? 'No minimum' : n === 1 ? '1 day' : `${n} days`;

  const role = getAdminSession().role;
  const isOwner = role === 'owner' || !role; // legacy logins treated as owner

  // Tabs restricted to owner only
  const OWNER_ONLY_TABS = ['security', 'discord', 'drive', 'sheets', 'email', 'ai'] as const;

  const tabs = [
    { id: 'branding' as const, label: 'Branding', icon: Palette },
    { id: 'form' as const, label: 'Form', icon: FileText },
    { id: 'rules' as const, label: 'Rules', icon: Sliders },
    { id: 'status' as const, label: 'Statuses', icon: Tag },
    { id: 'security' as const, label: 'Security', icon: Lock },
    { id: 'advanced' as const, label: 'Advanced', icon: Settings },
    { id: 'email' as const, label: 'Email', icon: Mail },
    { id: 'discord' as const, label: 'Discord', icon: Bell },
    { id: 'drive' as const, label: 'Drive', icon: FolderOpen },
    { id: 'sheets' as const, label: 'Sheets', icon: Table },
    { id: 'ai' as const, label: 'AI', icon: Sparkles },
    { id: 'team' as const, label: 'Team', icon: Users2 },
    { id: 'log' as const, label: 'Activity', icon: Activity },
    { id: 'backup' as const, label: 'Backup', icon: Database },
  ].filter(t => isOwner || !OWNER_ONLY_TABS.includes(t.id as typeof OWNER_ONLY_TABS[number]));

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
    </div>
  );

  return (
    <div className="fade-in space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-zinc-500 text-sm">All settings saved to Supabase — synced instantly across all devices</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-white/5 scrollbar-hide">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${
              activeTab === tab.id ? 'bg-white/5 text-white border-b-2 border-violet-500' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── BRANDING ── */}
      {activeTab === 'branding' && (
        <div className="space-y-5">
          <Section title="Company Identity" desc="Shown to all artists on the public submission form">
            <Field label="Company Name">
              <input type="text" value={settings.companyName} onChange={e => set('companyName', e.target.value)} className="input-dark w-full px-4 py-3 rounded-xl" />
            </Field>
            <Field label="Logo URL" hint="Direct image link — hosted on imgbb, Cloudinary, or any CDN">
              <input type="url" value={settings.companyLogo} onChange={e => set('companyLogo', e.target.value)} placeholder="https://..." className="input-dark w-full px-4 py-3 rounded-xl" />
              {settings.companyLogo && (
                <div className="mt-3 flex items-center gap-4 bg-zinc-900/60 rounded-xl p-4">
                  <img src={settings.companyLogo} alt="Preview" className="h-14 w-14 object-contain rounded-lg bg-black/40 p-1" onError={e => (e.currentTarget.style.opacity = '0.2')} />
                  <div>
                    <p className="text-sm font-semibold">{settings.companyName}</p>
                    <p className="text-xs text-zinc-500">Live preview</p>
                  </div>
                </div>
              )}
            </Field>
          </Section>

          <Section title="Accent Color" desc="Primary color used for buttons and highlights">
            <div className="flex flex-wrap gap-3 items-center">
              {ACCENT_COLORS.map(c => (
                <button key={c.value} onClick={() => set('accentColor', c.value)} title={c.label}
                  className={`w-9 h-9 rounded-full border-2 transition-all ${settings.accentColor === c.value ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
              <div className="flex items-center gap-2 ml-1">
                <input type="color" value={settings.accentColor} onChange={e => set('accentColor', e.target.value)}
                  className="w-9 h-9 rounded-full border-2 border-zinc-700 cursor-pointer bg-transparent" title="Custom color" />
                <span className="text-xs text-zinc-500">Custom</span>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-zinc-500">Preview:</span>
              <button className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-none" style={{ backgroundColor: settings.accentColor }}>
                Submit Release
              </button>
              <code className="text-xs text-zinc-500">{settings.accentColor}</code>
            </div>
          </Section>
        </div>
      )}

      {/* ── FORM ── */}
      {activeTab === 'form' && (
        <div className="space-y-5">
          <Section title="Form Text" desc="What artists see on the submission page">
            <Field label="Page Title">
              <input type="text" value={settings.formWelcomeText} onChange={e => set('formWelcomeText', e.target.value)} className="input-dark w-full px-4 py-3 rounded-xl" placeholder="Submit Your Release" />
            </Field>
            <Field label="Subtitle / Description">
              <textarea value={settings.formDescription} onChange={e => set('formDescription', e.target.value)} rows={3} className="input-dark w-full px-4 py-3 rounded-xl resize-none" placeholder="Fill out the form below..." />
            </Field>
            <Field label="Success Message" hint="Shown after a successful submission">
              <textarea value={settings.submissionSuccessMessage} onChange={e => set('submissionSuccessMessage', e.target.value)} rows={2} className="input-dark w-full px-4 py-3 rounded-xl resize-none" placeholder="Your submission has been received..." />
            </Field>
            <Field label="Rights Agreement Text" hint="The checkbox artists must tick before submitting">
              <textarea value={settings.rightsAgreementText} onChange={e => set('rightsAgreementText', e.target.value)} rows={3} className="input-dark w-full px-4 py-3 rounded-xl resize-none" placeholder="I confirm all information is accurate..." />
            </Field>
          </Section>

          <Section title="Genre List" desc="Add your own genres on top of the defaults">
            <Field label="Custom Genres" hint="One per line — these are added to the end of the genre dropdown">
              <textarea
                value={settings.customGenres}
                onChange={e => set('customGenres', e.target.value)}
                rows={5}
                className="input-dark w-full px-4 py-3 rounded-xl resize-none font-mono text-sm"
                placeholder={"Mahraganat\nShaabi\nNubian\nEthiopian Jazz"}
              />
            </Field>
            {settings.customGenres.trim() && (
              <div className="flex flex-wrap gap-2">
                {settings.customGenres.split('\n').filter(g => g.trim()).map(g => (
                  <span key={g} className="text-xs px-2.5 py-1 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-full">{g.trim()}</span>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {/* ── RULES ── */}
      {activeTab === 'rules' && (
        <div className="space-y-5">
          <Section title="Required Fields" desc="Control what artists must provide to submit">
            <div className="space-y-3">
              <ToggleRow label="Require Drive Folder Link" desc="Artists must link their main Google Drive folder with all assets"
                value={settings.requireDriveFolder} onChange={v => set('requireDriveFolder', v)} />
              <ToggleRow label="Require Promo Materials" desc="Artists must provide a promo photos/videos link"
                value={settings.requirePromoMaterials} onChange={v => set('requirePromoMaterials', v)} />
              <ToggleRow label="Require Lyrics" desc="At least one lyrics link (Drive or Google Docs) required per track"
                value={settings.requireLyrics} onChange={v => set('requireLyrics', v)} />
            </div>
          </Section>

          <Section title="Release Types" desc="Which release types artists can submit">
            <div className="flex gap-3 flex-wrap">
              {(['single', 'ep', 'album'] as const).map(type => {
                const active = settings.allowedReleaseTypes.split(',').includes(type);
                return (
                  <button key={type}
                    onClick={() => {
                      const current = settings.allowedReleaseTypes.split(',').filter(Boolean);
                      const next = active ? current.filter(t => t !== type) : [...current, type];
                      if (next.length > 0) set('allowedReleaseTypes', next.join(','));
                    }}
                    className={`px-5 py-2.5 rounded-xl border text-sm font-semibold uppercase transition-all ${
                      active ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'border-zinc-800 text-zinc-600 hover:border-zinc-600'
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-zinc-600">Disabled types won't appear on the form. At least one must stay enabled.</p>
          </Section>

          <Section title="Release Date Rules">
            <Field label="Minimum Notice Period" hint="Artists can't pick a release date earlier than this many days from today">
              <div className="flex items-center gap-4 mt-1">
                <input
                  type="range" min={0} max={90} step={1}
                  value={settings.minReleaseDaysNotice}
                  onChange={e => set('minReleaseDaysNotice', Number(e.target.value))}
                  className="flex-1 accent-violet-500 h-2"
                />
                <div className="w-20 text-center bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg font-mono text-sm font-bold text-violet-400">
                  {daysLabel(settings.minReleaseDaysNotice)}
                </div>
              </div>
              <p className="text-xs text-zinc-600 mt-2">
                {settings.minReleaseDaysNotice === 0
                  ? '⚠️ No minimum — artists can pick any date including today'
                  : `Artists must plan at least ${daysLabel(settings.minReleaseDaysNotice)} ahead`}
              </p>
            </Field>

            <Field label="Max Tracks for Albums" hint="Upper limit on how many tracks an album submission can have">
              <div className="flex items-center gap-4 mt-1">
                <input
                  type="range" min={7} max={50} step={1}
                  value={settings.maxTracksAlbum}
                  onChange={e => set('maxTracksAlbum', Number(e.target.value))}
                  className="flex-1 accent-violet-500 h-2"
                />
                <div className="w-20 text-center bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg font-mono text-sm font-bold text-violet-400">
                  {settings.maxTracksAlbum} tracks
                </div>
              </div>
            </Field>
          </Section>
        </div>
      )}

      {/* ── STATUS LABELS ── */}
      {activeTab === 'status' && (
        <div className="space-y-5">
          <Section title="Status Labels" desc="Rename the submission statuses to match your workflow">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { key: 'statusLabelPending', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400', default: 'Pending' },
                { key: 'statusLabelApproved', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400', default: 'Approved' },
                { key: 'statusLabelScheduled', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', dot: 'bg-blue-400', default: 'Scheduled' },
                { key: 'statusLabelReleased', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', dot: 'bg-purple-400', default: 'Released' },
                { key: 'statusLabelRejected', color: 'text-red-400 bg-red-500/10 border-red-500/20', dot: 'bg-red-400', default: 'Rejected' },
              ] as const).map(({ key, color, dot, default: def }) => (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-2 h-2 rounded-full ${dot}`} />
                    <label className="text-xs font-medium text-zinc-400">{def}</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={settings[key]}
                      onChange={e => set(key, e.target.value)}
                      className="input-dark flex-1 px-3 py-2.5 rounded-xl text-sm"
                      placeholder={def}
                    />
                    <span className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium ${color}`}>
                      {settings[key] || def}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-600">
              These labels appear in the admin dashboard. The underlying status values don't change — only the display names.
            </p>
          </Section>
        </div>
      )}

      {/* ── SECURITY ── */}
      {activeTab === 'security' && isOwner && (
        <div className="space-y-5">
          <Section title="Admin Credentials" desc="Your password is stored as a one-way hash — the real password is never saved anywhere">

            <div className="bg-zinc-900/60 border border-white/5 rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs text-zinc-500">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              Password is hashed before saving — even if someone reads the database, they cannot recover it
            </div>

            <Field label="Username">
              <input
                type="text"
                value={settings.adminUsername}
                onChange={e => set('adminUsername', e.target.value)}
                className="input-dark w-full px-4 py-3 rounded-xl"
                autoComplete="off"
              />
            </Field>

            <Field label="New Password" hint="Leave blank to keep your current password unchanged">
              <input
                type="password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPasswordResult(null); }}
                placeholder="Enter new password"
                className="input-dark w-full px-4 py-3 rounded-xl"
                autoComplete="new-password"
              />
            </Field>

            {newPassword && (
              <Field label="Confirm New Password">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setPasswordResult(null); }}
                  placeholder="Re-enter new password"
                  className={`input-dark w-full px-4 py-3 rounded-xl ${confirmPassword && confirmPassword !== newPassword ? 'border-red-500/50' : ''}`}
                  autoComplete="new-password"
                />
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-xs text-red-400 mt-1.5">Passwords don't match</p>
                )}
              </Field>
            )}

            {newPassword && confirmPassword && newPassword === confirmPassword && (
              <button
                onClick={async () => {
                  setPasswordSaving(true);
                  setPasswordResult(null);
                  setPasswordError('');
                  try {
                    await saveAdminPassword(newPassword);
                    setPasswordResult('success');
                    setNewPassword('');
                    setConfirmPassword('');
                  } catch (e) {
                    setPasswordResult('error');
                    setPasswordError(e instanceof Error ? e.message : 'Failed to save password');
                  } finally {
                    setPasswordSaving(false);
                  }
                }}
                disabled={passwordSaving}
                className="btn-primary px-5 py-2.5 rounded-xl text-sm flex items-center gap-2"
              >
                {passwordSaving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  : <><CheckCircle2 className="w-4 h-4" /> Update Password</>}
              </button>
            )}

            {passwordResult === 'success' && (
              <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 rounded-xl">
                <CheckCircle2 className="w-4 h-4" /> Password updated successfully
              </div>
            )}
            {passwordResult === 'error' && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-3 py-2.5 rounded-xl">
                <XCircle className="w-4 h-4" /> {passwordError}
              </div>
            )}
          </Section>

          <Section title="Admin URL" desc="Share only with your team — this is the link to the admin panel">
            <div className="flex items-center gap-2 bg-zinc-900/60 rounded-xl px-4 py-3">
              <code className="text-sm text-violet-400 flex-1 truncate">{window.location.origin}/#admin</code>
              <button
                onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/#admin`); setCopiedAdminUrl(true); setTimeout(() => setCopiedAdminUrl(false), 2000); }}
                className="text-zinc-500 hover:text-white transition-all flex-shrink-0"
              >
                {copiedAdminUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </Section>
        </div>
      )}

      {/* ── EMAIL ── */}
      {activeTab === 'email' && isOwner && (() => {
        const SCRIPT_CODE = `function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.action !== 'sendEmail') return ok('ignored');
    GmailApp.sendEmail(data.to, data.subject, '', {
      htmlBody: data.html,
      name: data.fromName || 'In Lights'
    });
    return ok('sent');
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function ok(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, msg: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}`;

        return (
        <div className="space-y-5">

          {/* Intro */}
          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5 flex gap-4">
            <Mail className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-violet-300 mb-1">Gmail — via Google Apps Script</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Browsers can't call Gmail SMTP directly (CORS). The fix: a tiny Google Apps Script
                acts as a relay — emails come <strong className="text-zinc-200">from your own Gmail</strong>, completely free, no extra accounts.
                Same approach you already use for Sheets. One-time setup takes about 2 minutes.
              </p>
            </div>
          </div>

          {/* Step 1 */}
          <Section title="Step 1 — Create the Apps Script" desc="script.google.com → New project → paste → deploy">
            <div className="bg-zinc-950 border border-white/10 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
                <span className="text-xs text-zinc-500 font-mono">Code.gs</span>
                <CopyCodeButton code={SCRIPT_CODE} />
              </div>
              <pre className="p-4 text-xs text-zinc-300 overflow-x-auto leading-relaxed font-mono whitespace-pre">{SCRIPT_CODE}</pre>
            </div>
            <ol className="mt-4 space-y-2 text-xs text-zinc-400 list-none">
              {[
                <span>Go to <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">script.google.com</a> → click <strong className="text-zinc-200">New project</strong></span>,
                <span>Delete all existing code, paste the script above</span>,
                <span>Click <strong className="text-zinc-200">Deploy → New deployment</strong></span>,
                <span>Type: <strong className="text-zinc-200">Web app</strong> · Execute as: <strong className="text-zinc-200">Me</strong> · Who has access: <strong className="text-zinc-200">Anyone</strong></span>,
                <span>Click <strong className="text-zinc-200">Deploy</strong> → authorize Gmail access → copy the <strong className="text-zinc-200">Web app URL</strong></span>,
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </Section>

          {/* Step 2 — Webhook URL */}
          <Section title="Step 2 — Paste your Web App URL" desc="From the Apps Script deployment dialog">
            <Field label="Gmail Webhook URL" hint="https://script.google.com/macros/s/.../exec">
              <input
                type="url"
                value={settings.gmailWebhookUrl ?? ''}
                onChange={e => setSettings(p => ({ ...p, gmailWebhookUrl: e.target.value }))}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="input-dark w-full px-4 py-2.5 rounded-xl font-mono text-sm"
              />
            </Field>
            <Field label="From Name" hint="Name recipients see in their inbox">
              <input
                type="text"
                value={settings.emailFromName}
                onChange={e => setSettings(p => ({ ...p, emailFromName: e.target.value }))}
                placeholder={settings.companyName || 'In Lights'}
                className="input-dark w-full px-4 py-2.5 rounded-xl"
              />
            </Field>
          </Section>

          {/* Step 3 — Toggles */}
          <Section title="Step 3 — Choose triggers" desc="What actions send an email">
            <div className="space-y-3">
              {([
                { key: 'emailNotifyOnSubmission' as const, label: 'New submission alert', desc: `Email ${settings.notificationEmail || 'your notification address'} when an artist submits` },
                { key: 'emailNotifyArtistOnStatus' as const, label: 'Artist status updates', desc: 'Email the artist automatically when you change their release status (requires artist email at submission)' },
              ] as const).map(({ key, label, desc }) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative mt-0.5">
                    <input type="checkbox" className="sr-only peer"
                      checked={settings[key] as boolean}
                      onChange={e => setSettings(p => ({ ...p, [key]: e.target.checked }))} />
                    <div className="w-10 h-5 rounded-full bg-zinc-700 peer-checked:bg-violet-600 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{label}</p>
                    <p className="text-xs text-zinc-500">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </Section>

          {/* Test */}
          <Section title="Test it" desc="Fires a real email through your script to your notification address">
            <div className="flex gap-3 items-center flex-wrap">
              <button
                onClick={async () => {
                  setTestingEmail(true); setEmailTestResult(null);
                  const ok = await testEmailConfig(settings.notificationEmail || '');
                  setEmailTestResult(ok ? 'success' : 'fail');
                  setTestingEmail(false);
                }}
                disabled={testingEmail || !settings.gmailWebhookUrl || !settings.notificationEmail}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold transition-colors"
              >
                {testingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Test Email
              </button>
              {emailTestResult === 'success' && <span className="flex items-center gap-1.5 text-sm text-emerald-400"><CheckCircle2 className="w-4 h-4" /> Sent — check your inbox</span>}
              {emailTestResult === 'fail' && <span className="flex items-center gap-1.5 text-sm text-red-400"><XCircle className="w-4 h-4" /> Failed — double-check your webhook URL</span>}
            </div>
            {!settings.notificationEmail && (
              <p className="text-xs text-amber-400 mt-2">⚠️ Set a Notification Email in the Discord tab first — that's where the test goes.</p>
            )}
            {settings.gmailWebhookUrl && settings.notificationEmail && (
              <p className="text-xs text-zinc-600 mt-2">Test will send to: {settings.notificationEmail}</p>
            )}
          </Section>

          {/* Templates */}
          <Section title="Email Templates" desc="Beautiful HTML emails sent from your own Gmail">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: '📬', title: 'New Submission', desc: 'Sent to label when artist submits. Includes all details + admin link.' },
                { icon: '✅', title: 'Approved', desc: 'Sent to artist on approval. Upbeat tone with next steps.' },
                { icon: '❌', title: 'Rejected', desc: 'Sent to artist on rejection. Includes label notes if any.' },
                { icon: '📅', title: 'Scheduled', desc: 'Confirms the release date to the artist.' },
                { icon: '🎵', title: 'Released', desc: 'Celebratory email when a release goes live.' },
                { icon: '⏳', title: 'Under Review', desc: 'Sets expectations when status moves to pending.' },
              ].map(t => (
                <div key={t.title} className="flex gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-2xl">{t.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-zinc-200">{t.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
        );
      })()}
      {/* ── DISCORD ── */}
      {activeTab === 'discord' && isOwner && (
        <div className="space-y-5">
          <Section title="Discord Notifications" desc="Get a rich embed for every new release submission">
            <Field label="Webhook URL">
              <input type="url" value={settings.discordWebhook} onChange={e => set('discordWebhook', e.target.value)}
                placeholder="https://discord.com/api/webhooks/..." className="input-dark w-full px-4 py-3 rounded-xl font-mono text-sm" />
            </Field>

            {settings.discordWebhook ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={handleTestDiscord} disabled={testingDiscord}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-sm font-medium hover:bg-indigo-600/30 transition-all disabled:opacity-50">
                    {testingDiscord ? <><Loader2 className="w-4 h-4 animate-spin" />Sending...</> : <><Send className="w-4 h-4" />Send Test Message</>}
                  </button>
                  {discordResult === 'success' && <span className="flex items-center gap-1.5 text-emerald-400 text-sm"><CheckCircle2 className="w-4 h-4" />Sent! Check your Discord</span>}
                  {discordResult === 'fail' && <span className="flex items-center gap-1.5 text-red-400 text-sm"><XCircle className="w-4 h-4" />Failed</span>}
                </div>
                {discordResult === 'fail' && discordError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{discordError}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-600">Enter a webhook URL above to enable testing.</p>
            )}
          </Section>

          <Collapsible title="📋 How to create a Discord Webhook (2 min)">
            <div className="space-y-3 text-sm text-zinc-400">
              {[
                ['Open Discord', 'Go to the channel where you want release notifications'],
                ['Edit the channel', 'Right-click it → Edit Channel → Integrations → Webhooks → New Webhook'],
                ['Copy & paste', 'Click Copy Webhook URL → paste above → click Send Test Message'],
              ].map(([title, desc]) => (
                <div key={title} className="bg-zinc-900/60 rounded-xl p-4">
                  <p className="text-white font-medium mb-1">{title}</p>
                  <p>{desc}</p>
                </div>
              ))}
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                <p className="text-emerald-400 font-medium">✅ Done! You'll get a rich embed card for every new submission.</p>
              </div>
            </div>
          </Collapsible>
        </div>
      )}

      {/* ── ADVANCED ── */}
      {activeTab === 'advanced' && (
        <div className="space-y-5">
          <Section title="Maintenance Mode" desc="Temporarily disable the submission form — useful during label reviews or holidays">
            <ToggleRow
              label="Enable Maintenance Mode"
              desc="Replaces the form with a custom message. No submissions will be accepted."
              value={settings.maintenanceMode ?? false}
              onChange={v => set('maintenanceMode', v)}
            />
            {settings.maintenanceMode && (
              <Field label="Maintenance Message" hint="What artists see when submissions are paused">
                <textarea
                  value={settings.maintenanceModeMessage}
                  onChange={e => set('maintenanceModeMessage', e.target.value)}
                  rows={3}
                  className="input-dark w-full px-4 py-3 rounded-xl resize-none text-sm"
                  placeholder="The submission portal is temporarily unavailable..."
                />
              </Field>
            )}
            {settings.maintenanceMode && (
              <div className="flex items-center gap-2 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 rounded-xl">
                🚧 Maintenance mode is ON — artists cannot submit releases right now
              </div>
            )}
          </Section>

          <Section title="Submission Controls" desc="Fine-tune how and when artists can submit">
            <Field label="Pending Reminder" hint="Show a dashboard alert when a release has been pending longer than this (0 = never remind)">
              <div className="flex items-center gap-4 mt-1">
                <input
                  type="range" min={0} max={14} step={1}
                  value={settings.pendingReminderDays ?? 2}
                  onChange={e => set('pendingReminderDays', Number(e.target.value))}
                  className="flex-1 h-2"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <div className="w-24 text-center bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg font-mono text-sm font-bold accent-text">
                  {(settings.pendingReminderDays ?? 2) === 0 ? 'Off' : `${settings.pendingReminderDays}d`}
                </div>
              </div>
              <p className="text-xs text-zinc-600 mt-1.5">
                {(settings.pendingReminderDays ?? 2) === 0 ? 'Pending reminders are disabled' : `Remind when pending for more than ${settings.pendingReminderDays} day${settings.pendingReminderDays !== 1 ? 's' : ''}`}
              </p>
            </Field>

            <Field label="Upcoming Release Reminder" hint="Warn you when an approved/scheduled release date is approaching (0 = off)">
              <div className="flex items-center gap-4 mt-1">
                <input
                  type="range" min={0} max={30} step={1}
                  value={settings.releaseReminderDays ?? 7}
                  onChange={e => set('releaseReminderDays', Number(e.target.value))}
                  className="flex-1 h-2"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <div className="w-24 text-center bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg font-mono text-sm font-bold accent-text">
                  {(settings.releaseReminderDays ?? 7) === 0 ? 'Off' : `${settings.releaseReminderDays}d`}
                </div>
              </div>
              <p className="text-xs text-zinc-600 mt-1.5">
                {(settings.releaseReminderDays ?? 7) === 0 ? 'Upcoming release reminders are disabled' : `Highlight releases dropping within ${settings.releaseReminderDays} day${settings.releaseReminderDays !== 1 ? 's' : ''}`}
              </p>
            </Field>
            <Field label="Submission Cooldown" hint="Prevent the same artist name from submitting more than once within this window (0 = no limit)">
              <div className="flex items-center gap-4 mt-1">
                <input
                  type="range" min={0} max={168} step={1}
                  value={settings.submissionCooldownHours ?? 0}
                  onChange={e => set('submissionCooldownHours', Number(e.target.value))}
                  className="flex-1 h-2"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <div className="w-24 text-center bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg font-mono text-sm font-bold accent-text">
                  {(settings.submissionCooldownHours ?? 0) === 0
                    ? 'No limit'
                    : `${settings.submissionCooldownHours}h`}
                </div>
              </div>
              <p className="text-xs text-zinc-600 mt-1.5">
                {(settings.submissionCooldownHours ?? 0) > 0
                  ? `Artists must wait ${settings.submissionCooldownHours} hour${settings.submissionCooldownHours !== 1 ? 's' : ''} between submissions`
                  : 'Artists can submit as many times as they want'}
              </p>
            </Field>

            <ToggleRow
              label="Show Cover Art Specs Checklist"
              desc='Displays a checklist reminder (3000×3000px, JPG, "Anyone can view") before the cover art upload field'
              value={settings.requireCoverArtSpecs ?? false}
              onChange={v => set('requireCoverArtSpecs', v)}
            />
            <ToggleRow
              label="Internal Comments Panel"
              desc="Show a floating chat button on release pages so your team can leave internal notes and @mentions"
              value={settings.internalCommentsEnabled ?? true}
              onChange={v => set('internalCommentsEnabled', v)}
            />
          </Section>

          <Section title="Form Customization" desc="Tweak copy and behavior of the public submission form">
            <Field label="Continue Button Label" hint="The text on the Next/Continue buttons throughout the form">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={settings.formAccentButtonLabel ?? 'Continue'}
                  onChange={e => set('formAccentButtonLabel', e.target.value)}
                  placeholder="Continue"
                  className="input-dark flex-1 px-4 py-3 rounded-xl"
                  maxLength={20}
                />
                <button className="btn-primary px-4 py-3 rounded-xl text-sm whitespace-nowrap" disabled>
                  {settings.formAccentButtonLabel || 'Continue'} →
                </button>
              </div>
            </Field>
          </Section>

          <Section title="Auto-Approve" desc="Experimental: automatically move submissions to Approved after N days of no action">
            <Field label="Auto-Approve After (days)" hint="0 = disabled. If a submission stays Pending for this many days it moves to Approved automatically.">
              <div className="flex items-center gap-4 mt-1">
                <input
                  type="range" min={0} max={30} step={1}
                  value={settings.autoApproveAfterDays ?? 0}
                  onChange={e => set('autoApproveAfterDays', Number(e.target.value))}
                  className="flex-1 h-2"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <div className="w-24 text-center bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg font-mono text-sm font-bold accent-text">
                  {(settings.autoApproveAfterDays ?? 0) === 0 ? 'Off' : `${settings.autoApproveAfterDays}d`}
                </div>
              </div>
              {(settings.autoApproveAfterDays ?? 0) > 0 && (
                <p className="text-xs text-amber-400 mt-2 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg">
                  ⚠️ Auto-approve requires a scheduled job (e.g. Supabase Edge Function cron). This setting saves the config but won't act on its own.
                </p>
              )}
            </Field>
          </Section>

          <Section title="Submission Limits" desc="Control how many collaborators and features artists can add">
            <Field label="Max Collaborators" hint="0 = unlimited">
              <div className="flex items-center gap-4">
                <input type="range" min={0} max={10} step={1}
                  value={settings.maxCollaborators ?? 0}
                  onChange={e => set('maxCollaborators', Number(e.target.value))}
                  className="flex-1 h-2" style={{ accentColor: 'var(--accent)' }} />
                <div className="w-20 text-center bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg font-mono text-sm font-bold accent-text">
                  {(settings.maxCollaborators ?? 0) === 0 ? 'Unlimited' : settings.maxCollaborators}
                </div>
              </div>
            </Field>
            <Field label="Max Featured Artists" hint="0 = unlimited">
              <div className="flex items-center gap-4">
                <input type="range" min={0} max={10} step={1}
                  value={settings.maxFeatures ?? 0}
                  onChange={e => set('maxFeatures', Number(e.target.value))}
                  className="flex-1 h-2" style={{ accentColor: 'var(--accent)' }} />
                <div className="w-20 text-center bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg font-mono text-sm font-bold accent-text">
                  {(settings.maxFeatures ?? 0) === 0 ? 'Unlimited' : settings.maxFeatures}
                </div>
              </div>
            </Field>
          </Section>

          <Section title="Track Credits" desc="Control which credits are shown and required">
            <ToggleRow
              label="Require Mix & Master Credits"
              desc="Artists must fill in 'Mixed by' and 'Mastered by' for every track before submitting"
              value={settings.requireMixMaster ?? false}
              onChange={v => set('requireMixMaster', v)}
            />
            <ToggleRow
              label="Require Producer & Songwriter Credits"
              desc="Artists must fill in 'Produced by' and 'Lyrics by' for every track before submitting"
              value={settings.requireCredits ?? false}
              onChange={v => set('requireCredits', v)}
            />
            <ToggleRow
              label="Require Preview Timestamps"
              desc="Artists must enter TikTok/preview start and end times per track"
              value={settings.requireTikTokTimestamp ?? false}
              onChange={v => set('requireTikTokTimestamp', v)}
            />
          </Section>

          <Section title="Cover Art" desc="Control the artwork fields on the form">
            <ToggleRow
              label="Allow Direct Image URL"
              desc='Artists can paste a direct image URL (e.g. imgbb) — shown as a thumbnail preview in the form and admin panel'
              value={settings.allowCoverArtImageUrl ?? true}
              onChange={v => set('allowCoverArtImageUrl', v)}
            />
          </Section>

          <Section title="Label Contact Info" desc="Shown in the form footer so artists can reach you">
            <Field label="Contact Email">
              <input type="email" value={settings.labelEmail ?? ''}
                onChange={e => set('labelEmail', e.target.value)}
                placeholder="releases@yourlabel.com" className="input-dark w-full px-4 py-3 rounded-xl" />
            </Field>
            <Field label="Instagram Handle" hint="Without the @ symbol">
              <input type="text" value={settings.labelInstagram ?? ''}
                onChange={e => set('labelInstagram', e.target.value)}
                placeholder="yourlabel" className="input-dark w-full px-4 py-3 rounded-xl" />
            </Field>
            <Field label="Website URL">
              <input type="url" value={settings.labelWebsite ?? ''}
                onChange={e => set('labelWebsite', e.target.value)}
                placeholder="https://yourlabel.com" className="input-dark w-full px-4 py-3 rounded-xl" />
            </Field>
          </Section>

          <Section title="Form Footer" desc="Small text shown at the very bottom of the submission form">
            <Field label="Footer Text">
              <input type="text" value={settings.formFooterText ?? ''}
                onChange={e => set('formFooterText', e.target.value)}
                placeholder="© 2026 In Lights. All submissions are confidential."
                className="input-dark w-full px-4 py-3 rounded-xl" />
            </Field>
          </Section>

          <Section title="Label Note Templates" desc="Quick-insert snippets admins can use when writing notes on a release. One template per line.">
            <Field label="Templates (one per line)">
              <textarea
                value={settings.noteTemplates ?? ''}
                onChange={e => set('noteTemplates', e.target.value)}
                rows={8}
                placeholder={'Cover art too small — must be 3000×3000px minimum\nMissing ISRC codes\nRelease date too soon'}
                className="input-dark w-full px-4 py-3 rounded-xl text-sm resize-none font-mono"
              />
              <p className="text-xs text-zinc-600 mt-1">Admins see these as a dropdown next to the Label Notes field on any release.</p>
            </Field>
          </Section>
        </div>
      )}

      {/* ── DRIVE PICKER ── */}
      {activeTab === 'drive' && isOwner && (
        <div className="space-y-5">
          <Section title="Google Drive Uploader" desc="Let artists upload files directly from the submission form — no Drive link copying needed">
            <ToggleRow
              label="Enable Drive Uploader"
              desc="When on, artists see an Upload button on cover art, WAV, and lyrics fields. Manual link input still works as fallback."
              value={settings.drivePickerEnabled ?? false}
              onChange={v => set('drivePickerEnabled', v)}
            />
          </Section>

          {settings.drivePickerEnabled && (
            <>
              <Section title="Google Cloud Credentials" desc="Required to open the Drive file picker and accept uploads">
                <div className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-300 px-3 py-2.5 rounded-xl leading-relaxed">
                  ℹ️ You need a Google Cloud project with the <strong>Google Drive API</strong> and <strong>Google Picker API</strong> enabled. Takes about 10 minutes to set up — see the guide below.
                </div>

                <Field label="OAuth 2.0 Client ID" hint='From Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs. Must be "Web application" type.'>
                  <input
                    type="text"
                    value={settings.googleApiClientId}
                    onChange={e => set('googleApiClientId', e.target.value)}
                    placeholder="123456789-xxxxxxxxxxxx.apps.googleusercontent.com"
                    className="input-dark w-full px-4 py-3 rounded-xl font-mono text-sm"
                  />
                </Field>

                <Field label="API Key" hint="Create a restricted API key — enable Google Drive API + Google Picker API. Add HTTP referrer restrictions for security.">
                  <input
                    type="password"
                    value={settings.googleApiKey}
                    onChange={e => set('googleApiKey', e.target.value)}
                    placeholder="AIzaSy..."
                    className="input-dark w-full px-4 py-3 rounded-xl font-mono text-sm"
                    autoComplete="off"
                  />
                </Field>
              </Section>

              <Section title="Upload Destination" desc="All artist uploads land in this folder — so your label owns and controls the files">
                <Field label="Upload Folder ID" hint='Go to your Google Drive, open the folder you want to use, copy the ID from the URL: drive.google.com/drive/folders/THIS_IS_THE_ID'>
                  <input
                    type="text"
                    value={settings.driveUploadFolderId}
                    onChange={e => set('driveUploadFolderId', e.target.value)}
                    placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs"
                    className="input-dark w-full px-4 py-3 rounded-xl font-mono text-sm"
                  />
                </Field>
                {settings.driveUploadFolderId && (
                  <a
                    href={`https://drive.google.com/drive/folders/${settings.driveUploadFolderId}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs accent-text hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" /> Open upload folder in Drive
                  </a>
                )}

                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs px-3 py-2.5 rounded-xl space-y-1">
                  <p className="font-semibold">⚠️ Important — share the folder:</p>
                  <p>Right-click the folder → Share → change to <strong>"Anyone with the link can edit"</strong>. This is required for artists to be able to upload files into it.</p>
                </div>
              </Section>

              <Collapsible title="📋 Setup guide — Google Cloud (10 min)">
                <div className="space-y-3 text-sm text-zinc-400">
                  {[
                    { step: '1. Create a project', body: <>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="accent-text underline">console.cloud.google.com</a> → New Project → give it a name (e.g. "In Lights").</> },
                    { step: '2. Enable APIs', body: <>Go to <strong className="text-white">APIs & Services → Library</strong>. Search for and enable both: <strong className="text-white">Google Drive API</strong> and <strong className="text-white">Google Picker API</strong>.</> },
                    { step: '3. Create OAuth Client ID', body: <>Go to <strong className="text-white">APIs & Services → Credentials → Create Credentials → OAuth client ID</strong>. Choose <strong className="text-white">Web application</strong>. Under "Authorized JavaScript origins" add your site URL (e.g. <code className="text-violet-300">https://yourdomain.vercel.app</code>). Copy the Client ID.</> },
                    { step: '4. Create API Key', body: <>Still in Credentials, click <strong className="text-white">Create Credentials → API Key</strong>. Click Edit on the key → under "API restrictions" select <strong className="text-white">Restrict key</strong> → add Drive API + Picker API. Add your domain to HTTP referrers. Copy the key.</> },
                    { step: '5. Configure OAuth consent screen', body: <>Go to <strong className="text-white">APIs & Services → OAuth consent screen</strong>. Set app name, support email, and add your domain. Under Scopes add <code className="text-violet-300">../auth/drive.file</code>. Publish the app (or leave as Testing and add test users).</> },
                    { step: '6. Paste credentials here', body: 'Paste the Client ID and API Key into the fields above, enter your Upload Folder ID, and save.' },
                  ].map(({ step, body }) => (
                    <div key={step} className="bg-zinc-900/60 rounded-xl p-4">
                      <p className="text-white font-semibold mb-1">{step}</p>
                      <p className="leading-relaxed">{body}</p>
                    </div>
                  ))}
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-400">
                    ✅ Once configured, artists will see an "Upload" button on each file field. They can also still paste links manually as a fallback.
                  </div>
                </div>
              </Collapsible>
            </>
          )}

          {!settings.drivePickerEnabled && (
            <div className="glass-card rounded-2xl p-8 text-center">
              <div className="text-4xl mb-3">📁</div>
              <p className="text-zinc-400 text-sm">Enable the Drive Uploader above to configure Google credentials and give artists a seamless upload experience.</p>
            </div>
          )}
        </div>
      )}

      {/* ── AI ── */}
      {activeTab === 'ai' && isOwner && (
        <div className="space-y-5">

          {/* Intro card */}
          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5 flex gap-4">
            <Sparkles className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-violet-300 mb-1">AI-Powered Features</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Connect your{' '}
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">
                  Gemini API key
                </a>
                {' '}to unlock AI features directly in the browser — no backend needed.
                Your key is stored in Supabase and never exposed publicly.
                <br /><br />
                Get a key at <span className="text-violet-300">aistudio.google.com</span> → Get API Key.
              </p>
            </div>
          </div>

          {/* API Key */}
          <Section title="Google Gemini API Key" desc="Free tier — 15 req/min, no credit card needed">
            <Field label="API Key" hint="Starts with stored in DB, owner-only">
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={settings.geminiApiKey ?? ''}
                  onChange={e => setSettings(p => ({ ...p, geminiApiKey: e.target.value }))}
                  placeholder="AIza..."
                  className="input-dark w-full px-4 py-2.5 rounded-xl pr-10 font-mono text-sm"
                />
                <button
                  onClick={() => setShowApiKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
          </Section>

          {/* Features */}
          <Section title="AI Features" desc="Available once your API key is set">
            <div className="space-y-3">
              <div className="flex gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/8">
                <span className="text-2xl">🎵</span>
                <div>
                  <p className="text-sm font-semibold text-zinc-200">Spotify Playlist Pitch</p>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                    Auto-generates a professional curator pitch for each release using metadata + lyrics.
                    Available on every release detail page.
                  </p>
                  <span className={`inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full font-medium ${settings.geminiApiKey ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                    {settings.geminiApiKey ? '✓ Active' : 'Requires API key'}
                  </span>
                </div>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* ── GOOGLE SHEETS ── */}
      {activeTab === 'sheets' && isOwner && (
        <div className="space-y-5">
          <Section title="Google Sheets Sync" desc="New submissions auto-append. Status changes auto-update. Use Sync All to backfill existing releases.">
            <Field label="Apps Script Web App URL">
              <input type="url" value={settings.googleSheetsWebhook} onChange={e => set('googleSheetsWebhook', e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec" className="input-dark w-full px-4 py-3 rounded-xl font-mono text-sm" />
            </Field>

            {settings.googleSheetsWebhook ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={handleTestSheets} disabled={testingSheets}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-600/30 transition-all disabled:opacity-50">
                    {testingSheets ? <><Loader2 className="w-4 h-4 animate-spin" />Sending...</> : <><Send className="w-4 h-4" />Send Test Row</>}
                  </button>
                  <SyncAllSheetsButton webhookUrl={settings.googleSheetsWebhook} />
                  {sheetsResult === 'success' && <span className="flex items-center gap-1.5 text-emerald-400 text-sm"><CheckCircle2 className="w-4 h-4" />Sent! Check your Sheet</span>}
                  {sheetsResult === 'fail' && <span className="flex items-center gap-1.5 text-red-400 text-sm"><XCircle className="w-4 h-4" />Failed — check URL & redeploy</span>}
                </div>
                <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-blue-500/8 border border-blue-500/15 text-xs text-zinc-400">
                  <span className="text-blue-400">ℹ</span>
                  <span>Status changes (approve, reject, schedule) automatically push an update row to your Sheet. No manual action needed.</span>
                </div>
                <a href={settings.googleSheetsWebhook} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:underline">
                  <ExternalLink className="w-3 h-3" />Open Apps Script URL
                </a>
              </div>
            ) : (
              <p className="text-xs text-zinc-600">Enter your Apps Script URL above to enable testing.</p>
            )}
          </Section>

          <Collapsible title="📋 How to set up the Google Sheet (5 min)">
            <div className="space-y-4 text-sm text-zinc-400">
              {[
                ['Create a Google Sheet', <>Go to <a href="https://sheets.google.com" target="_blank" rel="noopener noreferrer" className="text-violet-400 underline">sheets.google.com</a> → New spreadsheet</>],
                ['Open Apps Script', <>In your sheet: <span className="text-violet-400">Extensions</span> → <span className="text-violet-400">Apps Script</span> → delete all default code, paste the script below</>],
                ['Deploy', <>Click <span className="text-violet-400">Deploy</span> → New deployment → Type: <strong className="text-white">Web app</strong> → Execute as: <strong className="text-white">Me</strong> → Access: <strong className="text-white">Anyone</strong> → Deploy → copy the URL</>],
                ['Paste URL & test', 'Paste the URL above, save settings, then click Send Test Row to verify it works'],
              ].map(([title, desc]) => (
                <div key={String(title)} className="bg-zinc-900/60 rounded-xl p-4">
                  <p className="text-white font-medium mb-1">{title}</p>
                  <p>{desc}</p>
                </div>
              ))}
              <CodeBlock code={APPS_SCRIPT_CODE} />
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                <p className="text-emerald-400 font-medium">✅ Every real submission will auto-append with headers on first use.</p>
              </div>
            </div>
          </Collapsible>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="space-y-6 fade-in">
          <TeamManagement />
          {isOwner && (
            <Section title="Custom Roles" desc="Create roles beyond Owner, Admin and Reviewer with granular permissions">
              <CustomRoleBuilder />
            </Section>
          )}
        </div>
      )}

      {activeTab === 'log' && (
        <div className="fade-in">
          <ActivityLog />
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="space-y-5 fade-in">
          <DataBackup />

          {/* Supabase DB stats — owner only */}
          {isOwner && (
            <Section title="Database Overview" desc="Live stats from your Supabase project">
              <SupabaseStats />
            </Section>
          )}
        </div>
      )}

      {/* Save bar — hidden on tabs that have nothing to save */}
      {!['team', 'log', 'backup'].includes(activeTab) && (
        <>
          {saveError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">{saveError}</div>
          )}
          <div className="flex items-center gap-4 pt-2 border-t border-white/5">
            <button onClick={handleSave} disabled={saving}
              className={`px-6 py-3 rounded-xl flex items-center gap-2 font-medium transition-all disabled:opacity-60 ${saved ? 'bg-emerald-600 text-white' : 'btn-primary'}`}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
               : saved ? <><CheckCircle2 className="w-4 h-4" />Saved!</>
               : <><Save className="w-4 h-4" />Save Settings</>}
            </button>
            {saved && <span className="text-zinc-500 text-sm">Changes synced to all devices</span>}
          </div>
        </>
      )}
    </div>
  );
}
