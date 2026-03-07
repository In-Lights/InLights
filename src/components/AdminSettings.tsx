import { useState, useEffect } from 'react';
import {
  Save, Settings, FileText, Bell, Lock, Table, Send,
  CheckCircle2, XCircle, Loader2, Palette, ExternalLink,
  Copy, Check, ChevronDown, ChevronUp, Tag, Sliders
} from 'lucide-react';
import { AdminSettings as AdminSettingsType, DEFAULT_ADMIN_SETTINGS } from '../types';
import { getAdminSettings, saveAdminSettings, testDiscordWebhook } from '../store';

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
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-violet-600' : 'bg-zinc-700'}`}
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

export default function AdminSettingsPanel({ onSaved }: Props) {
  const [settings, setSettings] = useState<AdminSettingsType>({ ...DEFAULT_ADMIN_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [activeTab, setActiveTab] = useState<'branding' | 'form' | 'rules' | 'status' | 'security' | 'discord' | 'sheets'>('branding');

  const [testingDiscord, setTestingDiscord] = useState(false);
  const [discordResult, setDiscordResult] = useState<'success' | 'fail' | null>(null);
  const [discordError, setDiscordError] = useState('');
  const [testingSheets, setTestingSheets] = useState(false);
  const [sheetsResult, setSheetsResult] = useState<'success' | 'fail' | null>(null);
  const [copiedAdminUrl, setCopiedAdminUrl] = useState(false);

  useEffect(() => {
    getAdminSettings().then(s => { setSettings(s); setLoading(false); });
  }, []);

  const set = <K extends keyof AdminSettingsType>(key: K, value: AdminSettingsType[K]) =>
    setSettings(prev => ({ ...prev, [key]: value }));

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

  const tabs = [
    { id: 'branding' as const, label: 'Branding', icon: Palette },
    { id: 'form' as const, label: 'Form', icon: FileText },
    { id: 'rules' as const, label: 'Rules', icon: Sliders },
    { id: 'status' as const, label: 'Statuses', icon: Tag },
    { id: 'security' as const, label: 'Security', icon: Lock },
    { id: 'discord' as const, label: 'Discord', icon: Bell },
    { id: 'sheets' as const, label: 'Sheets', icon: Table },
  ];

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
      {activeTab === 'security' && (
        <div className="space-y-5">
          <Section title="Admin Credentials">
            <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 rounded-lg">
              ⚠️ After changing credentials, you'll need to log in again with the new ones.
            </div>
            <Field label="Username">
              <input type="text" value={settings.adminUsername} onChange={e => set('adminUsername', e.target.value)} className="input-dark w-full px-4 py-3 rounded-xl" autoComplete="off" />
            </Field>
            <Field label="Password">
              <input type="password" value={settings.adminPassword} onChange={e => set('adminPassword', e.target.value)} className="input-dark w-full px-4 py-3 rounded-xl" autoComplete="new-password" />
            </Field>
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

      {/* ── DISCORD ── */}
      {activeTab === 'discord' && (
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

      {/* ── GOOGLE SHEETS ── */}
      {activeTab === 'sheets' && (
        <div className="space-y-5">
          <Section title="Google Sheets Mirror" desc="Every new submission is appended as a row — Supabase stays the source of truth">
            <Field label="Apps Script Web App URL">
              <input type="url" value={settings.googleSheetsWebhook} onChange={e => set('googleSheetsWebhook', e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec" className="input-dark w-full px-4 py-3 rounded-xl font-mono text-sm" />
            </Field>

            {settings.googleSheetsWebhook ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={handleTestSheets} disabled={testingSheets}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-600/30 transition-all disabled:opacity-50">
                    {testingSheets ? <><Loader2 className="w-4 h-4 animate-spin" />Sending test row...</> : <><Send className="w-4 h-4" />Send Test Row</>}
                  </button>
                  {sheetsResult === 'success' && <span className="flex items-center gap-1.5 text-emerald-400 text-sm"><CheckCircle2 className="w-4 h-4" />Sent! Check your Sheet</span>}
                  {sheetsResult === 'fail' && <span className="flex items-center gap-1.5 text-red-400 text-sm"><XCircle className="w-4 h-4" />Failed — check URL & redeploy</span>}
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

      {/* Save bar */}
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
    </div>
  );
}
