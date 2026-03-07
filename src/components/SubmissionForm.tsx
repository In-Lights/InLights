import { useState, useMemo } from 'react';
import {
  Music, User, Disc3, Upload, ChevronRight, ChevronLeft,
  Plus, Trash2, CheckCircle2, ExternalLink, AlertCircle, Calendar, Clock
} from 'lucide-react';
import {
  Track, Collaborator, ReleaseType, RELEASE_TYPE_LIMITS, GENRES,
  ReleaseSubmission, AdminSettings, DEFAULT_ADMIN_SETTINGS
} from '../types';
import { addSubmission } from '../store';
import DrivePickerButton from './DrivePickerButton';

// ── date utils ───────────────────────────────────────────────
function getMinDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
}

// ── defaults ─────────────────────────────────────────────────
const emptyTrack = (): Track => ({
  title: '', previewStart: '0:00', previewEnd: '0:30', explicit: false,
  wavDriveLink: '', lyricsDriveLink: '', lyricsGoogleDocsLink: '',
  producedBy: '', lyricsBy: '', mixedBy: '', masteredBy: '',
});
const emptyCollab = (): Collaborator => ({
  name: '', role: 'artist', platformLinks: { spotify: '', appleMusic: '', anghami: '' },
});

interface Props {
  settings: AdminSettings;
  onSubmitted?: () => void;
}

export default function SubmissionForm({ settings, onSubmitted }: Props) {
  const minDays = settings.minReleaseDaysNotice ?? 3;
  const maxAlbumTracks = settings.maxTracksAlbum ?? 32;
  const allowedTypes = useMemo(
    () => (settings.allowedReleaseTypes || 'single,ep,album').split(',').filter(Boolean) as ReleaseType[],
    [settings.allowedReleaseTypes]
  );
  const allGenres = useMemo(() => {
    const extras = (settings.customGenres || '').split('\n').map(g => g.trim()).filter(Boolean);
    return [...GENRES, ...extras];
  }, [settings.customGenres]);

  const getLimits = (type: ReleaseType) => {
    const base = RELEASE_TYPE_LIMITS[type];
    return type === 'album' ? { ...base, max: maxAlbumTracks } : base;
  };

  // ── state ──
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [mainArtist, setMainArtist] = useState('');
  const [collaborations, setCollaborations] = useState<Collaborator[]>([]);
  const [features, setFeatures] = useState<Collaborator[]>([]);

  const [releaseType, setReleaseType] = useState<ReleaseType>(allowedTypes[0] || 'single');
  const [releaseTitle, setReleaseTitle] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [dateError, setDateError] = useState('');
  const [explicitContent, setExplicitContent] = useState(false);
  const [genre, setGenre] = useState('');
  const [coverArtDriveLink, setCoverArtDriveLink] = useState('');

  const [tracks, setTracks] = useState<Track[]>([emptyTrack()]);

  const [promoDriveLink, setPromoDriveLink] = useState('');
  const [driveFolderLink, setDriveFolderLink] = useState('');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);

  const limits = getLimits(releaseType);

  // ── date validation ──
  const validateDate = (val: string): string => {
    if (!val) return '';
    const days = daysUntil(val);
    if (days < 0) return "You can't pick a date in the past. Please choose a future date.";
    if (days === 0) return "Same-day releases aren't accepted. Your release must be scheduled in advance.";
    if (minDays > 0 && days < minDays) {
      const earliest = getMinDate(minDays);
      return `Too soon — you need at least ${minDays} day${minDays !== 1 ? 's' : ''} notice. Earliest allowed date: ${formatDate(earliest)}.`;
    }
    return '';
  };

  const handleDateChange = (val: string) => {
    setReleaseDate(val);
    setDateError(validateDate(val));
  };

  const isDateValid = releaseDate !== '' && dateError === '';

  // ── track helpers ──
  const updateTrack = (idx: number, u: Partial<Track>) =>
    setTracks(prev => prev.map((t, i) => i === idx ? { ...t, ...u } : t));

  const addTrack = () => {
    if (tracks.length < limits.max) setTracks(prev => [...prev, emptyTrack()]);
  };

  const removeTrack = (idx: number) => {
    if (tracks.length > limits.min) setTracks(prev => prev.filter((_, i) => i !== idx));
  };

  const handleTypeChange = (type: ReleaseType) => {
    setReleaseType(type);
    const lim = getLimits(type);
    setTracks(prev => {
      if (prev.length < lim.min) return [...prev, ...Array(lim.min - prev.length).fill(null).map(emptyTrack)];
      if (prev.length > lim.max) return prev.slice(0, lim.max);
      return prev;
    });
  };

  // ── collab helpers ──
  const updateCollab = (
    list: Collaborator[], setList: (v: Collaborator[]) => void,
    i: number, upd: Partial<Collaborator>
  ) => { const u = [...list]; u[i] = { ...u[i], ...upd }; setList(u); };

  // ── validation ──
  const isStep1Valid = mainArtist.trim().length > 0;
  const isStep2Valid = releaseTitle.trim().length > 0 && isDateValid && genre.length > 0 && coverArtDriveLink.trim().length > 0;
  const isStep3Valid = tracks.length >= limits.min && tracks.every(t =>
    t.title.trim() && t.wavDriveLink.trim() &&
    (!settings.requireLyrics || t.lyricsDriveLink?.trim() || t.lyricsGoogleDocsLink?.trim())
  );
  const isStep4Valid =
    rightsConfirmed &&
    (!settings.requireDriveFolder || driveFolderLink.trim().length > 0) &&
    (!settings.requirePromoMaterials || promoDriveLink.trim().length > 0);

  // ── submit ──
  const handleSubmit = async () => {
    setSubmitting(true); setSubmitError('');
    try {
      const data: Omit<ReleaseSubmission, 'id' | 'createdAt' | 'updatedAt' | 'status'> = {
        mainArtist, collaborations: collaborations.filter(c => c.name.trim()),
        features: features.filter(f => f.name.trim()),
        releaseType, releaseTitle, releaseDate, explicitContent, genre,
        coverArtDriveLink, tracks,
        promoDriveLink: promoDriveLink || undefined,
        driveFolderLink: driveFolderLink || undefined,
        rightsConfirmed,
      };
      const result = await addSubmission(data);
      setSubmissionId(result.id);
      setSubmitted(true);
      onSubmitted?.();
    } catch {
      setSubmitError('Submission failed. Please check your connection and try again.');
    } finally { setSubmitting(false); }
  };

  const resetForm = () => {
    setStep(0); setSubmitted(false); setMainArtist('');
    setCollaborations([]); setFeatures([]);
    setReleaseType(allowedTypes[0] || 'single'); setReleaseTitle('');
    setReleaseDate(''); setDateError(''); setExplicitContent(false);
    setGenre(''); setCoverArtDriveLink('');
    setTracks([emptyTrack()]); setPromoDriveLink(''); setDriveFolderLink('');
    setRightsConfirmed(false); setSubmitError('');
  };

  const steps = [
    { icon: User, label: 'Artist Info' },
    { icon: Disc3, label: 'Release Info' },
    { icon: Music, label: 'Tracklist' },
    { icon: Upload, label: 'Submit' },
  ];

  // ── maintenance mode ──
  if (settings.maintenanceMode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-10 max-w-md w-full text-center fade-in">
          <div className="text-5xl mb-4">🚧</div>
          <h2 className="text-xl font-bold mb-2">Submissions Paused</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            {settings.maintenanceModeMessage || DEFAULT_ADMIN_SETTINGS.maintenanceModeMessage}
          </p>
          {settings.companyLogo && (
            <img src={settings.companyLogo} alt={settings.companyName}
              className="h-8 w-8 object-contain rounded-lg mx-auto mt-6 opacity-40" />
          )}
        </div>
      </div>
    );
  }

  // ── success screen ──
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-8 md:p-12 max-w-lg w-full text-center fade-in">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 accent-bg-subtle">
            <CheckCircle2 className="w-10 h-10 accent-text" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Release Submitted! 🎉</h2>
          <p className="text-zinc-400 mb-6">
            {settings.submissionSuccessMessage || DEFAULT_ADMIN_SETTINGS.submissionSuccessMessage}
          </p>
          <div className="bg-zinc-900/60 rounded-xl p-4 mb-6 border border-white/5">
            <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Submission ID</p>
            <p className="text-lg font-mono font-bold accent-text">{submissionId}</p>
            <p className="text-xs text-zinc-600 mt-1">Keep this for your records</p>
          </div>
          <button onClick={resetForm} className="btn-primary px-6 py-3 rounded-xl">
            Submit Another Release
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          {settings.companyLogo && (
            <img src={settings.companyLogo} alt={settings.companyName} className="h-10 w-10 object-contain rounded-xl" />
          )}
          <div>
            <h1 className="font-bold text-lg">{settings.companyName}</h1>
            <p className="text-xs text-zinc-500">{settings.formWelcomeText}</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress */}
        <div className="flex items-center justify-between mb-10">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => { if (i < step) setStep(i); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  i === step ? 'accent-bg-subtle accent-text glow-border' :
                  i < step ? 'text-emerald-400 cursor-pointer' : 'text-zinc-600'
                }`}
              >
                <s.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{i + 1}</span>
              </button>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${i < step ? 'bg-emerald-500/40' : 'bg-zinc-800'}`} />
              )}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Artist Info ── */}
        {step === 0 && (
          <div className="fade-in space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-1">Artist Information</h2>
              <p className="text-zinc-500 text-sm">Tell us about the artist(s) on this release</p>
            </div>

            <div className="glass-card rounded-2xl p-6">
              <label className="block text-sm font-semibold mb-2">Main Artist <span className="text-red-400">*</span></label>
              <input type="text" value={mainArtist} onChange={e => setMainArtist(e.target.value)}
                placeholder="Artist or band name" className="input-dark w-full px-4 py-3 rounded-xl" />
            </div>

            {/* Collaborations */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">Collaborations</h3>
                  <p className="text-xs text-zinc-500">Other main artists credited on the release</p>
                </div>
                <button onClick={() => setCollaborations(p => [...p, emptyCollab()])}
                  className="flex items-center gap-1 text-sm accent-text hover:opacity-80">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
              {collaborations.length === 0 && <p className="text-zinc-600 text-sm italic">None added</p>}
              {collaborations.map((c, i) => (
                <div key={i} className="bg-zinc-900/50 rounded-xl p-4 mb-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <input type="text" value={c.name}
                      onChange={e => updateCollab(collaborations, setCollaborations, i, { name: e.target.value })}
                      placeholder="Collaborator name" className="input-dark flex-1 px-3 py-2 rounded-lg text-sm" />
                    <button onClick={() => setCollaborations(p => p.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['spotify','appleMusic','anghami'] as const).map(p => (
                      <input key={p} type="url" value={c.platformLinks[p] || ''}
                        onChange={e => updateCollab(collaborations, setCollaborations, i, { platformLinks: { ...c.platformLinks, [p]: e.target.value } })}
                        placeholder={p === 'appleMusic' ? 'Apple Music' : p === 'anghami' ? 'Anghami' : 'Spotify'}
                        className="input-dark px-3 py-2 rounded-lg text-xs" />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Features */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">Features</h3>
                  <p className="text-xs text-zinc-500">Artists featured on specific tracks</p>
                </div>
                <button onClick={() => setFeatures(p => [...p, emptyCollab()])}
                  className="flex items-center gap-1 text-sm accent-text hover:opacity-80">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
              {features.length === 0 && <p className="text-zinc-600 text-sm italic">None added</p>}
              {features.map((f, i) => (
                <div key={i} className="bg-zinc-900/50 rounded-xl p-4 mb-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <input type="text" value={f.name}
                      onChange={e => updateCollab(features, setFeatures, i, { name: e.target.value })}
                      placeholder="Featured artist name" className="input-dark flex-1 px-3 py-2 rounded-lg text-sm" />
                    <button onClick={() => setFeatures(p => p.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['spotify','appleMusic','anghami'] as const).map(p => (
                      <input key={p} type="url" value={f.platformLinks[p] || ''}
                        onChange={e => updateCollab(features, setFeatures, i, { platformLinks: { ...f.platformLinks, [p]: e.target.value } })}
                        placeholder={p === 'appleMusic' ? 'Apple Music' : p === 'anghami' ? 'Anghami' : 'Spotify'}
                        className="input-dark px-3 py-2 rounded-lg text-xs" />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button onClick={() => setStep(1)} disabled={!isStep1Valid} className="btn-primary px-6 py-3 rounded-xl flex items-center gap-2">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Release Info ── */}
        {step === 1 && (
          <div className="fade-in space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-1">Release Information</h2>
              <p className="text-zinc-500 text-sm">Details about your upcoming release</p>
            </div>

            <div className="glass-card rounded-2xl p-6 space-y-6">
              {/* Release Type */}
              <div>
                <label className="block text-sm font-semibold mb-3">Release Type <span className="text-red-400">*</span></label>
                <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${allowedTypes.length}, 1fr)` }}>
                  {allowedTypes.map(type => {
                    const lim = getLimits(type);
                    const active = releaseType === type;
                    return (
                      <button key={type} onClick={() => handleTypeChange(type)}
                        className={`p-4 rounded-xl border text-center transition-all ${
                          active ? 'accent-border accent-bg-subtle accent-text' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600'
                        }`}>
                        <div className="text-lg font-bold uppercase">{type}</div>
                        <div className="text-xs mt-1 opacity-70">
                          {type === 'single' ? '1 track' : type === 'ep' ? '3–6 tracks' : `Up to ${lim.max} tracks`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold mb-2">Release Title <span className="text-red-400">*</span></label>
                <input type="text" value={releaseTitle} onChange={e => setReleaseTitle(e.target.value)}
                  placeholder="Title of the release" className="input-dark w-full px-4 py-3 rounded-xl" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Release Date */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Release Date <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none z-10" />
                    <input
                      type="date"
                      value={releaseDate}
                      min={getMinDate(Math.max(1, minDays))}
                      onChange={e => handleDateChange(e.target.value)}
                      className={`input-dark w-full pl-10 pr-4 py-3 rounded-xl ${dateError ? 'border-red-500/50' : ''}`}
                    />
                  </div>

                  {/* Validation message */}
                  {dateError ? (
                    <div className="mt-2 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-300 leading-relaxed">{dateError}</p>
                    </div>
                  ) : releaseDate && isDateValid ? (
                    <div className="mt-2 flex items-center gap-2 text-emerald-400 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {formatDate(releaseDate)} — {daysUntil(releaseDate)} days from today
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-1.5 text-zinc-600 text-xs">
                      <Clock className="w-3 h-3" />
                      {minDays > 0
                        ? `Minimum ${minDays} day${minDays !== 1 ? 's' : ''} notice — earliest: ${formatDate(getMinDate(minDays))}`
                        : 'Choose any future date'}
                    </div>
                  )}
                </div>

                {/* Genre */}
                <div>
                  <label className="block text-sm font-semibold mb-2">Genre <span className="text-red-400">*</span></label>
                  <select value={genre} onChange={e => setGenre(e.target.value)} className="input-dark w-full px-4 py-3 rounded-xl">
                    <option value="">Select genre</option>
                    {allGenres.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              {/* Explicit */}
              <div>
                <label className="block text-sm font-semibold mb-3">Explicit Content</label>
                <div className="flex gap-3">
                  <button onClick={() => setExplicitContent(false)}
                    className={`px-5 py-2 rounded-lg border text-sm font-medium transition-all ${!explicitContent ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}>
                    Clean ✓
                  </button>
                  <button onClick={() => setExplicitContent(true)}
                    className={`px-5 py-2 rounded-lg border text-sm font-medium transition-all ${explicitContent ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}>
                    Explicit 🔞
                  </button>
                </div>
              </div>
            </div>

            {/* Cover Art */}
            <div className="glass-card rounded-2xl p-6">
              <DrivePickerButton
                value={coverArtDriveLink}
                onChange={(link) => setCoverArtDriveLink(link)}
                label="Cover Art"
                hint="JPG or PNG, 3000×3000px recommended. Upload directly or paste a Google Drive share link."
                required
                clientId={settings.googleApiClientId || ''}
                apiKey={settings.googleApiKey || ''}
                uploadFolderId={settings.driveUploadFolderId || ''}
                pickerTitle="Upload Cover Art"
              />
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(0)} className="px-6 py-3 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white transition-all flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={() => setStep(2)} disabled={!isStep2Valid} className="btn-primary px-6 py-3 rounded-xl flex items-center gap-2">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Tracklist ── */}
        {step === 2 && (
          <div className="fade-in space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-1">Tracklist</h2>
                <p className="text-zinc-500 text-sm">
                  {limits.label} · {tracks.length} / {limits.max} tracks
                  {settings.requireLyrics && <span className="ml-2 text-amber-400 text-xs">· Lyrics required per track</span>}
                </p>
              </div>
              {tracks.length < limits.max && (
                <button onClick={addTrack} className="btn-primary px-4 py-2 rounded-lg flex items-center gap-1.5 text-sm">
                  <Plus className="w-4 h-4" /> Add Track
                </button>
              )}
            </div>

            {tracks.map((track, idx) => (
              <div key={idx} className="glass-card rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest accent-text">Track {idx + 1}</span>
                  {tracks.length > limits.min && (
                    <button onClick={() => removeTrack(idx)} className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Track Title <span className="text-red-400">*</span></label>
                    <input type="text" value={track.title} onChange={e => updateTrack(idx, { title: e.target.value })}
                      placeholder="Track title" className="input-dark w-full px-3 py-2.5 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Explicit</label>
                    <div className="flex gap-2">
                      <button onClick={() => updateTrack(idx, { explicit: false })}
                        className={`flex-1 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${!track.explicit ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-zinc-800 text-zinc-600'}`}>
                        Clean
                      </button>
                      <button onClick={() => updateTrack(idx, { explicit: true })}
                        className={`flex-1 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${track.explicit ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-zinc-800 text-zinc-600'}`}>
                        🔞
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Preview / TikTok Start</label>
                    <input type="text" value={track.previewStart} onChange={e => updateTrack(idx, { previewStart: e.target.value })}
                      placeholder="0:00" className="input-dark w-full px-3 py-2.5 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Preview / TikTok End</label>
                    <input type="text" value={track.previewEnd} onChange={e => updateTrack(idx, { previewEnd: e.target.value })}
                      placeholder="0:30" className="input-dark w-full px-3 py-2.5 rounded-lg text-sm" />
                  </div>
                </div>

                <div>
                  <DrivePickerButton
                    value={track.wavDriveLink}
                    onChange={(link) => updateTrack(idx, { wavDriveLink: link })}
                    label="WAV File"
                    hint="Upload the master WAV file, or paste a Drive link."
                    required
                    size="sm"
                    clientId={settings.googleApiClientId || ''}
                    apiKey={settings.googleApiKey || ''}
                    uploadFolderId={settings.driveUploadFolderId || ''}
                    pickerTitle={`Upload WAV — Track ${idx + 1}`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <DrivePickerButton
                      value={track.lyricsDriveLink || ''}
                      onChange={(link) => updateTrack(idx, { lyricsDriveLink: link })}
                      label={`Lyrics${settings.requireLyrics ? '' : ' (optional)'}`}
                      hint="Upload a .txt / .docx lyrics file."
                      required={settings.requireLyrics}
                      size="sm"
                      clientId={settings.googleApiClientId || ''}
                      apiKey={settings.googleApiKey || ''}
                      uploadFolderId={settings.driveUploadFolderId || ''}
                      pickerTitle={`Upload Lyrics — Track ${idx + 1}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Lyrics — Google Docs {settings.requireLyrics && <span className="text-amber-400">*</span>}
                    </label>
                    <input type="url" value={track.lyricsGoogleDocsLink || ''} onChange={e => updateTrack(idx, { lyricsGoogleDocsLink: e.target.value })}
                      placeholder="Google Docs link" className="input-dark w-full px-3 py-2.5 rounded-lg text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-2">Credits</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {([['producedBy','Produced by'],['lyricsBy','Lyrics by'],['mixedBy','Mixed by'],['masteredBy','Mastered by']] as const).map(([k, lbl]) => (
                      <input key={k} type="text" value={(track as Record<string, string>)[k]}
                        onChange={e => updateTrack(idx, { [k]: e.target.value } as Partial<Track>)}
                        placeholder={lbl} className="input-dark px-3 py-2.5 rounded-lg text-sm" />
                    ))}
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="px-6 py-3 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white transition-all flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={() => setStep(3)} disabled={!isStep3Valid} className="btn-primary px-6 py-3 rounded-xl flex items-center gap-2">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Links & Submit ── */}
        {step === 3 && (
          <div className="fade-in space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-1">Final Details & Submit</h2>
              <p className="text-zinc-500 text-sm">Add promo links and confirm your submission</p>
            </div>

            <div className="glass-card rounded-2xl p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Promo Pictures / Videos
                  {settings.requirePromoMaterials && <span className="text-red-400 ml-1">*</span>}
                </label>
                <p className="text-xs text-zinc-500 mb-3">Google Drive folder with promo photos & videos for social media</p>
                <DrivePickerButton
                  value={promoDriveLink}
                  onChange={(link) => setPromoDriveLink(link)}
                  label=""
                  hint=""
                  required={settings.requirePromoMaterials}
                  clientId={settings.googleApiClientId || ''}
                  apiKey={settings.googleApiKey || ''}
                  uploadFolderId={settings.driveUploadFolderId || ''}
                  pickerTitle="Upload Promo Materials"
                />
                {settings.requirePromoMaterials && !promoDriveLink.trim() && (
                  <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Required by your label
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Main Drive Folder
                  {settings.requireDriveFolder && <span className="text-red-400 ml-1">*</span>}
                </label>
                <p className="text-xs text-zinc-500 mb-3">Shared folder containing all your release assets (WAV, artwork, docs)</p>
                <input type="url" value={driveFolderLink} onChange={e => setDriveFolderLink(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..." className="input-dark w-full px-4 py-3 rounded-xl" />
                {settings.requireDriveFolder && !driveFolderLink.trim() && (
                  <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Required by your label
                  </p>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-bold mb-4 text-sm uppercase tracking-wider text-zinc-400">Submission Summary</h3>
              <div className="space-y-2.5">
                {[
                  ['Main Artist', mainArtist],
                  ['Title', `${releaseTitle} (${releaseType.toUpperCase()})`],
                  ['Genre', genre],
                  ['Release Date', `${formatDate(releaseDate)} · ${daysUntil(releaseDate)} days away`],
                  ['Tracks', `${tracks.length} track${tracks.length !== 1 ? 's' : ''}`],
                  ['Explicit', explicitContent ? 'Yes 🔞' : 'Clean ✓'],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between text-sm py-1.5 border-b border-white/[0.04] last:border-0">
                    <span className="text-zinc-500">{label}</span>
                    <span className="font-medium text-right max-w-xs truncate">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rights agreement */}
            <label className="flex items-start gap-4 glass-card rounded-2xl p-6 cursor-pointer hover:bg-white/[0.02] transition-all">
              <input type="checkbox" checked={rightsConfirmed} onChange={e => setRightsConfirmed(e.target.checked)}
                className="mt-0.5 w-5 h-5 flex-shrink-0 rounded" style={{ accentColor: 'var(--accent)' }} />
              <span className="text-sm text-zinc-300 leading-relaxed">
                {settings.rightsAgreementText || DEFAULT_ADMIN_SETTINGS.rightsAgreementText}
              </span>
            </label>

            {submitError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {submitError}
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} disabled={submitting}
                className="px-6 py-3 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white transition-all flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={handleSubmit} disabled={!isStep4Valid || submitting}
                className="btn-primary px-8 py-3 rounded-xl flex items-center gap-2 text-base">
                {submitting
                  ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</>
                  : <><CheckCircle2 className="w-5 h-5" /> Submit Release</>
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
