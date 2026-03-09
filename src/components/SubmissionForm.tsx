import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Music, User, Disc3, Upload, ChevronRight, ChevronLeft,
  Plus, Trash2, CheckCircle2, AlertCircle, Calendar, Clock,
  Globe, Instagram, Mail
} from 'lucide-react';
import {
  Track, Collaborator, ReleaseType, RELEASE_TYPE_LIMITS, GENRES,
  ReleaseSubmission, AdminSettings, DEFAULT_ADMIN_SETTINGS
} from '../types';
import { addSubmission, checkForDuplicates, saveFormDraft, loadFormDraft, clearFormDraft, queueSubmissionOffline, flushOfflineQueue, getOfflineQueue, type DuplicateWarning } from '../store';
import DrivePickerButton from './DrivePickerButton';

// ── date utils ───────────────────────────────────────────────
function getMinDate(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
function daysUntil(s: string) {
  const t = new Date(); t.setHours(0,0,0,0);
  return Math.round((new Date(s+'T00:00:00').getTime() - t.getTime()) / 86400000);
}
function fmtDate(s: string) {
  if (!s) return '';
  const [y,m,d] = s.split('-');
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${mo[+m-1]} ${+d}, ${y}`;
}

// ── build Spotify-style track display name ───────────────────
function buildTrackDisplay(title: string, features: Collaborator[]): string {
  if (!title.trim()) return '';
  const feats = features.map(f => f.name.trim()).filter(Boolean);
  if (!feats.length) return title;
  return `${title} (feat. ${feats.join(', ')})`;
}

// ── build artist line like Spotify ───────────────────────────
function buildArtistLine(main: string, collabs: Collaborator[]): string {
  const all = [main, ...collabs.map(c => c.name.trim()).filter(Boolean)];
  return all.join(', ');
}

// ── build folder key and name for Drive ──────────────────────
function buildReleaseFolderName(artist: string, title: string): string {
  const year = new Date().getFullYear();
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim().slice(0, 40);
  return `${safe(artist)} — ${safe(title)} (${year})`;
}
function buildReleaseKey(artist: string, title: string): string {
  return `${artist}__${title}`.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 60);
}

// ── defaults ─────────────────────────────────────────────────
const emptyTrack = (): Track => ({
  title: '', previewStart: '0:00', previewEnd: '0:30', explicit: false,
  wavDriveLink: '', lyricsDriveLink: '', lyricsGoogleDocsLink: '',
  producedBy: '', lyricsBy: '', mixedBy: '', masteredBy: '',
  additionalCredits: [],
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

  const getLimits = (t: ReleaseType) => {
    const b = RELEASE_TYPE_LIMITS[t];
    return t === 'album' ? { ...b, max: maxAlbumTracks } : b;
  };

  // ── state ──
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [mainArtist, setMainArtist] = useState('');
  const [artistEmail, setArtistEmail] = useState('');
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

  // ── auto-save draft ──
  const [draftRestored, setDraftRestored] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore draft on mount
  useEffect(() => {
    const draft = loadFormDraft();
    if (!draft) return;
    setShowDraftBanner(true);
  }, []);

  const restoreDraft = () => {
    const draft = loadFormDraft();
    if (!draft) return;
    if (draft.mainArtist) setMainArtist(draft.mainArtist as string);
    if (draft.collaborations) setCollaborations(draft.collaborations as Collaborator[]);
    if (draft.features) setFeatures(draft.features as Collaborator[]);
    if (draft.releaseType) setReleaseType(draft.releaseType as ReleaseType);
    if (draft.releaseTitle) setReleaseTitle(draft.releaseTitle as string);
    if (draft.releaseDate) { setReleaseDate(draft.releaseDate as string); }
    if (draft.explicitContent !== undefined) setExplicitContent(draft.explicitContent as boolean);
    if (draft.genre) setGenre(draft.genre as string);
    if (draft.coverArtDriveLink) setCoverArtDriveLink(draft.coverArtDriveLink as string);
    if (draft.tracks) setTracks(draft.tracks as Track[]);
    if (draft.promoDriveLink) setPromoDriveLink(draft.promoDriveLink as string);
    if (draft.driveFolderLink) setDriveFolderLink(draft.driveFolderLink as string);
    if (draft.step !== undefined) setStep(draft.step as number);
    setDraftRestored(true);
    setShowDraftBanner(false);
  };

  // Auto-save on any field change (debounced 2s)
  const triggerAutoSave = () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveFormDraft({ mainArtist, collaborations, features, releaseType, releaseTitle, releaseDate, explicitContent, genre, coverArtDriveLink, tracks, promoDriveLink, driveFolderLink, step });
    }, 2000);
  };

  // ── duplicate detection ──
  const [duplicates, setDuplicates] = useState<DuplicateWarning[]>([]);
  const [dupChecked, setDupChecked] = useState(false);
  const dupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!mainArtist.trim() || !releaseTitle.trim()) { setDuplicates([]); setDupChecked(false); return; }
    if (dupTimer.current) clearTimeout(dupTimer.current);
    dupTimer.current = setTimeout(async () => {
      const results = await checkForDuplicates(mainArtist, releaseTitle);
      setDuplicates(results);
      setDupChecked(true);
    }, 800);
  }, [mainArtist, releaseTitle]);

  const limits = getLimits(releaseType);

  // ── computed drive context ──
  const releaseFolderName = useMemo(
    () => buildReleaseFolderName(mainArtist, releaseTitle),
    [mainArtist, releaseTitle]
  );
  const releaseKey = useMemo(
    () => buildReleaseKey(mainArtist, releaseTitle),
    [mainArtist, releaseTitle]
  );

  const driveProps = {
    clientId: settings.googleApiClientId || '',
    apiKey: settings.googleApiKey || '',
    rootFolderId: settings.driveUploadFolderId || '',
    releaseKey,
    releaseFolderName,
  };

  // ── date validation ──
  const validateDate = (v: string) => {
    if (!v) return '';
    const d = daysUntil(v);
    if (d < 0) return "You can't pick a past date.";
    if (d === 0) return "Same-day releases aren't accepted.";
    if (minDays > 0 && d < minDays) {
      return `At least ${minDays} day${minDays !== 1 ? 's' : ''} notice required. Earliest: ${fmtDate(getMinDate(minDays))}.`;
    }
    return '';
  };
  const handleDateChange = (v: string) => { setReleaseDate(v); setDateError(validateDate(v)); };
  const isDateValid = releaseDate !== '' && dateError === '';

  // ── track helpers ──
  const updateTrack = (i: number, u: Partial<Track>) =>
    setTracks(p => p.map((t, j) => j === i ? { ...t, ...u } : t));
  const addTrack = () => { if (tracks.length < limits.max) setTracks(p => [...p, emptyTrack()]); };
  const removeTrack = (i: number) => { if (tracks.length > limits.min) setTracks(p => p.filter((_, j) => j !== i)); };
  const handleTypeChange = (t: ReleaseType) => {
    setReleaseType(t);
    const lim = getLimits(t);
    setTracks(p => {
      if (p.length < lim.min) return [...p, ...Array(lim.min - p.length).fill(null).map(emptyTrack)];
      if (p.length > lim.max) return p.slice(0, lim.max);
      return p;
    });
  };

  // ── collab helpers ──
  const updateCollab = (
    list: Collaborator[], setList: (v: Collaborator[]) => void,
    i: number, upd: Partial<Collaborator>
  ) => { const u = [...list]; u[i] = { ...u[i], ...upd }; setList(u); };

  // max collaborators / features limits
  const maxCollabs = settings.maxCollaborators || 0;
  const maxFeats = settings.maxFeatures || 0;

  // ── validation ──
  const isStep1Valid = mainArtist.trim().length > 0;
  const isStep2Valid = releaseTitle.trim().length > 0 && isDateValid && genre.length > 0 && coverArtDriveLink.trim().length > 0;
  // For singles: track title auto-filled from releaseTitle, only need wav
  const isStep3Valid = tracks.length >= limits.min && tracks.every((t, idx) => {
    const effectiveTitle = releaseType === 'single' && idx === 0 ? releaseTitle : t.title;
    return effectiveTitle.trim() && t.wavDriveLink.trim() &&
      (!settings.requireLyrics || t.lyricsDriveLink?.trim() || t.lyricsGoogleDocsLink?.trim()) &&
      t.mixedBy.trim() && t.masteredBy.trim() &&
      t.producedBy.trim() && t.lyricsBy.trim();
  });
  const isStep4Valid =
    rightsConfirmed &&
    (!settings.requireDriveFolder || driveFolderLink.trim().length > 0) &&
    (!settings.requirePromoMaterials || promoDriveLink.trim().length > 0);

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [queuedCount, setQueuedCount] = useState(getOfflineQueue().length);

  // Monitor online/offline status and flush queue when back online
  useEffect(() => {
    const onOnline = async () => {
      setIsOffline(false);
      const flushed = await flushOfflineQueue();
      if (flushed > 0) {
        setQueuedCount(0);
        onSubmitted?.();
      }
    };
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    // Try flush on mount in case they were offline before
    if (navigator.onLine) flushOfflineQueue().then(n => { if (n > 0) { setQueuedCount(0); onSubmitted?.(); } });
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  // ── submit ──
  const handleSubmit = async () => {
    setSubmitting(true); setSubmitError('');
    // For singles, auto-fill track title from release title
    const finalTracks = tracks.map((t, idx) =>
      releaseType === 'single' && idx === 0 ? { ...t, title: t.title || releaseTitle } : t
    );
    const data: Omit<ReleaseSubmission, 'id' | 'createdAt' | 'updatedAt' | 'status'> = {
      mainArtist, collaborations: collaborations.filter(c => c.name.trim()),
      features: features.filter(f => f.name.trim()),
      releaseType, releaseTitle, releaseDate, explicitContent, genre,
      coverArtDriveLink, coverArtImageUrl: '', tracks: finalTracks,
      promoDriveLink: promoDriveLink || undefined,
      driveFolderLink: driveFolderLink || undefined,
      rightsConfirmed,
      artistEmail: artistEmail.trim() || undefined,
    };

    // If offline — queue locally and show success
    if (!navigator.onLine) {
      queueSubmissionOffline(data);
      setQueuedCount(q => q + 1);
      setSubmissionId('QUEUED');
      setSubmitted(true);
      clearFormDraft();
      setSubmitting(false);
      return;
    }

    try {
      const result = await addSubmission(data);
      setSubmissionId(result);
      setSubmitted(true);
      clearFormDraft();
      onSubmitted?.();
    } catch {
      // Network error mid-submit — queue it
      if (!navigator.onLine) {
        queueSubmissionOffline(data);
        setQueuedCount(q => q + 1);
        setSubmissionId('QUEUED');
        setSubmitted(true);
        clearFormDraft();
      } else {
        setSubmitError('Submission failed. Please check your connection and try again.');
      }
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
    setDuplicates([]); setDupChecked(false); setDraftRestored(false);
    clearFormDraft();
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
    const isQueued = submissionId === 'QUEUED';
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-8 md:p-12 max-w-lg w-full text-center fade-in">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isQueued ? 'bg-amber-500/10' : 'accent-bg-subtle'}`}>
            <CheckCircle2 className={`w-10 h-10 ${isQueued ? 'text-amber-400' : 'accent-text'}`} />
          </div>
          <h2 className="text-2xl font-bold mb-2">{isQueued ? 'Saved Offline!' : 'Release Submitted!'}</h2>
          <p className="text-zinc-400 mb-6">
            {isQueued
              ? "You're offline. Your submission has been saved on this device and will be sent automatically when your connection is restored."
              : (settings.submissionSuccessMessage || DEFAULT_ADMIN_SETTINGS.submissionSuccessMessage)}
          </p>
          {!isQueued && (
            <div className="bg-zinc-900/60 rounded-xl p-4 mb-6 border border-white/5">
              <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Submission ID</p>
              <p className="text-lg font-mono font-bold accent-text">{submissionId}</p>
            </div>
          )}
          {isQueued && (
            <div className="bg-amber-500/10 rounded-xl p-4 mb-6 border border-amber-500/20">
              <p className="text-xs text-amber-400 font-medium">📶 {queuedCount} submission{queuedCount !== 1 ? 's' : ''} queued — will sync when online</p>
            </div>
          )}
          <button onClick={resetForm} className="btn-primary px-6 py-3 rounded-xl">Submit Another Release</button>
          {!isQueued && <a href="#status" className="block text-sm text-zinc-500 hover:text-zinc-300 mt-3 transition-colors">Track your release status →</a>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Offline banner */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500/90 backdrop-blur text-black text-center text-xs font-semibold py-2 px-4">
          📶 You're offline — your submission will be saved locally and sent when you reconnect
          {queuedCount > 0 && ` · ${queuedCount} queued`}
        </div>
      )}
      {/* Header */}
      <header className={`border-b border-white/5 bg-black/40 backdrop-blur-xl sticky z-50 ${isOffline ? 'top-8' : 'top-0'}`}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          {settings.companyLogo && (
            <img src={settings.companyLogo} alt={settings.companyName} className="h-10 w-10 object-contain rounded-xl" />
          )}
          <div>
            <h1 className="font-bold text-lg">{settings.companyName}</h1>
            <p className="text-xs text-zinc-500">{settings.formWelcomeText}</p>
          </div>
          <a href="#status" className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Check release status →</a>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Draft restore banner */}
        {showDraftBanner && (
          <div className="mb-6 flex items-center gap-3 bg-violet-500/10 border border-violet-500/30 rounded-xl px-4 py-3 text-sm fade-in">
            <span className="text-violet-300 flex-1">📝 You have an unsaved draft — want to restore it?</span>
            <button onClick={restoreDraft} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 transition-all">Restore</button>
            <button onClick={() => { clearFormDraft(); setShowDraftBanner(false); }} className="px-3 py-1.5 rounded-lg border border-white/10 text-zinc-400 text-xs hover:text-white transition-all">Discard</button>
          </div>
        )}
        {draftRestored && (
          <div className="mb-4 text-xs text-emerald-400 text-center fade-in">✓ Draft restored</div>
        )}
        {/* Stepper */}
        <div className="flex items-center justify-between mb-10">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <button onClick={() => { if (i < step) setStep(i); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  i === step ? 'accent-bg-subtle accent-text glow-border' :
                  i < step ? 'text-emerald-400 cursor-pointer' : 'text-zinc-600'
                }`}>
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

            <div className="glass-card rounded-2xl p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Main Artist <span className="text-red-400">*</span></label>
                <input type="text" value={mainArtist} onChange={e => { setMainArtist(e.target.value); triggerAutoSave(); }}
                  placeholder="Artist or band name" className="input-dark w-full px-4 py-3 rounded-xl" />
              </div>
              {settings.showArtistEmail !== false && (
              <div>
                <label className="block text-sm font-semibold mb-1">Artist Email <span className="text-zinc-500 font-normal text-xs ml-1">— for release status updates</span></label>
                <input type="email" value={artistEmail} onChange={e => setArtistEmail(e.target.value)}
                  placeholder="artist@email.com" className="input-dark w-full px-4 py-3 rounded-xl" />
                <p className="text-xs text-zinc-600 mt-1.5">We'll email you when your release status changes. Optional but recommended.</p>
              </div>
              )}
            </div>

            {/* Collaborations */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">Collaborations</h3>
                  <p className="text-xs text-zinc-500">Other main artists credited on the release</p>
                </div>
                {(maxCollabs === 0 || collaborations.length < maxCollabs) && (
                  <button onClick={() => setCollaborations(p => [...p, emptyCollab()])}
                    className="flex items-center gap-1 text-sm accent-text hover:opacity-80">
                    <Plus className="w-4 h-4" /> Add
                  </button>
                )}
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
                    {(['spotify','appleMusic','anghami'] as const).map(pl => (
                      <input key={pl} type="url" value={c.platformLinks[pl] || ''}
                        onChange={e => updateCollab(collaborations, setCollaborations, i, { platformLinks: { ...c.platformLinks, [pl]: e.target.value } })}
                        placeholder={pl === 'appleMusic' ? 'Apple Music' : pl === 'anghami' ? 'Anghami' : 'Spotify'}
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
                  <p className="text-xs text-zinc-500">Artists featured on specific tracks (appear as "feat." in track names)</p>
                </div>
                {(maxFeats === 0 || features.length < maxFeats) && (
                  <button onClick={() => setFeatures(p => [...p, emptyCollab()])}
                    className="flex items-center gap-1 text-sm accent-text hover:opacity-80">
                    <Plus className="w-4 h-4" /> Add
                  </button>
                )}
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
                    {(['spotify','appleMusic','anghami'] as const).map(pl => (
                      <input key={pl} type="url" value={f.platformLinks[pl] || ''}
                        onChange={e => updateCollab(features, setFeatures, i, { platformLinks: { ...f.platformLinks, [pl]: e.target.value } })}
                        placeholder={pl === 'appleMusic' ? 'Apple Music' : pl === 'anghami' ? 'Anghami' : 'Spotify'}
                        className="input-dark px-3 py-2 rounded-lg text-xs" />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Artist line preview */}
            {(mainArtist || collaborations.some(c => c.name.trim())) && (
              <div className="text-center py-2 opacity-60">
                <p className="text-xs text-zinc-500 mb-1">Will appear as</p>
                <p className="font-semibold text-sm">{buildArtistLine(mainArtist, collaborations)}</p>
              </div>
            )}

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
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${allowedTypes.length}, 1fr)` }}>
                  {allowedTypes.map(type => {
                    const lim = getLimits(type);
                    const active = releaseType === type;
                    return (
                      <button key={type} onClick={() => handleTypeChange(type)}
                        className={`p-4 rounded-xl border text-center transition-all ${active ? 'accent-border accent-bg-subtle accent-text' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600'}`}>
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
                <input type="text" value={releaseTitle} onChange={e => { setReleaseTitle(e.target.value); triggerAutoSave(); }}
                  placeholder="Title of the release" className="input-dark w-full px-4 py-3 rounded-xl" />
                {/* Duplicate warning */}
                {dupChecked && duplicates.length > 0 && (
                  <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 space-y-2 fade-in">
                    <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">⚠️ Possible duplicate detected</p>
                    {duplicates.map(d => (
                      <div key={d.id} className="text-xs text-zinc-400 flex justify-between items-center">
                        <span><span className="text-white font-medium">{d.mainArtist}</span> — {d.releaseTitle}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${d.similarity === 'exact' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>{d.similarity}</span>
                      </div>
                    ))}
                    <p className="text-[11px] text-zinc-600">You can still submit — just double-check this isn't a duplicate.</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Release Date */}
                <div>
                  <label className="block text-sm font-semibold mb-2">Release Date <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                    <input type="date" value={releaseDate}
                      min={getMinDate(Math.max(1, minDays))}
                      onChange={e => handleDateChange(e.target.value)}
                      className={`input-dark w-full pl-10 pr-4 py-3 rounded-xl ${dateError ? 'border-red-500/50' : ''}`} />
                  </div>
                  {dateError ? (
                    <div className="mt-2 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-300">{dateError}</p>
                    </div>
                  ) : releaseDate && isDateValid ? (
                    <div className="mt-2 flex items-center gap-2 text-emerald-400 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {fmtDate(releaseDate)} — {daysUntil(releaseDate)} days from today
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-1.5 text-zinc-600 text-xs">
                      <Clock className="w-3 h-3" />
                      {minDays > 0 ? `Min ${minDays} day${minDays !== 1 ? 's' : ''} notice — earliest: ${fmtDate(getMinDate(minDays))}` : 'Any future date'}
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
                    className={`px-6 py-2.5 rounded-lg border text-sm font-medium transition-all ${!explicitContent ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}>
                    Clean
                  </button>
                  <button onClick={() => setExplicitContent(true)}
                    className={`px-6 py-2.5 rounded-lg border text-sm font-medium transition-all ${explicitContent ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}>
                    Explicit
                  </button>
                </div>
              </div>
            </div>

            {/* Cover Art */}
            <div className="glass-card rounded-2xl p-6 space-y-5">
              <div>
                <h3 className="font-semibold mb-1">Cover Art</h3>
                <p className="text-xs text-zinc-500">JPG or PNG, 3000×3000px recommended — upload only</p>
              </div>

              <DrivePickerButton
                value={coverArtDriveLink}
                onChange={(link) => setCoverArtDriveLink(link)}
                label="Cover Art File"
                hint="Upload your artwork directly"
                required
                showPreview
                uploadOnly
                subFolder="Cover Art"
                pickerTitle="Upload Cover Art"
                copyAsName={releaseTitle ? `${mainArtist} — ${releaseTitle}` : undefined}
                {...driveProps}
              />

              {/* Drive not configured — plain upload via link is removed, show note */}
              {!driveProps.clientId && (
                <p className="text-xs text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  Drive upload not configured — paste a public Drive link instead
                </p>
              )}
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
                  {limits.label} · {tracks.length}/{limits.max} tracks
                  {settings.requireLyrics && <span className="ml-2 text-amber-400 text-xs">· Lyrics required</span>}
                  {settings.requireMixMaster && <span className="ml-2 text-amber-400 text-xs">· Mix/master credits required</span>}
                </p>
              </div>
              {tracks.length < limits.max && (
                <button onClick={addTrack} className="btn-primary px-4 py-2 rounded-lg flex items-center gap-1.5 text-sm">
                  <Plus className="w-4 h-4" /> Add Track
                </button>
              )}
            </div>

            {tracks.map((track, idx) => {
              const isSingleTrack = releaseType === 'single' && idx === 0;
              const effectiveTitle = isSingleTrack ? releaseTitle : track.title;
              const trackFolderName = `Track ${String(idx + 1).padStart(2, '0')}${effectiveTitle ? ` — ${effectiveTitle}` : ''}`;
              const displayName = buildTrackDisplay(effectiveTitle, features);
              return (
                <div key={idx} className="glass-card rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-widest accent-text">Track {idx + 1}</span>
                      {displayName && (
                        <p className="text-xs text-zinc-500 mt-0.5 font-mono">{displayName}</p>
                      )}
                    </div>
                    {tracks.length > limits.min && (
                      <button onClick={() => removeTrack(idx)} className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Remove
                      </button>
                    )}
                  </div>

                  {/* Title + Explicit */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {isSingleTrack ? (
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5">Track Title</label>
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          <span className="text-sm text-emerald-300 font-medium">{releaseTitle}</span>
                          <span className="text-xs text-zinc-500 ml-auto">auto-filled from release title</span>
                        </div>
                      </div>
                    ) : (
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5">Track Title <span className="text-red-400">*</span></label>
                        <input type="text" value={track.title} onChange={e => updateTrack(idx, { title: e.target.value })}
                          placeholder="Track title" className="input-dark w-full px-3 py-2.5 rounded-lg text-sm" />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1.5">Explicit</label>
                      <div className="flex gap-2">
                        <button onClick={() => updateTrack(idx, { explicit: false })}
                          className={`flex-1 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${!track.explicit ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-zinc-800 text-zinc-600'}`}>
                          Clean
                        </button>
                        <button onClick={() => updateTrack(idx, { explicit: true })}
                          className={`flex-1 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${track.explicit ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-zinc-800 text-zinc-600'}`}>
                          Explicit
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* TikTok timestamps */}
                  {(settings.requireTikTokTimestamp || true) && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                          Preview Start {settings.requireTikTokTimestamp && <span className="text-amber-400">*</span>}
                        </label>
                        <input type="text" value={track.previewStart} onChange={e => updateTrack(idx, { previewStart: e.target.value })}
                          placeholder="0:00" className="input-dark w-full px-3 py-2.5 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                          Preview End {settings.requireTikTokTimestamp && <span className="text-amber-400">*</span>}
                        </label>
                        <input type="text" value={track.previewEnd} onChange={e => updateTrack(idx, { previewEnd: e.target.value })}
                          placeholder="0:30" className="input-dark w-full px-3 py-2.5 rounded-lg text-sm" />
                      </div>
                    </div>
                  )}

                  {/* WAV upload */}
                  <DrivePickerButton
                    value={track.wavDriveLink}
                    onChange={(link) => updateTrack(idx, { wavDriveLink: link })}
                    label="WAV File"
                    hint="Master WAV — upload or paste a Drive link"
                    required
                    size="sm"
                    subFolder={trackFolderName}
                    pickerTitle={`Upload WAV — Track ${idx + 1}${track.title ? `: ${track.title}` : ''}`}
                    {...driveProps}
                  />

                  {/* Lyrics — Google Docs only (Drive upload removed) */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Lyrics — Google Docs Link {settings.requireLyrics && <span className="text-amber-400">*</span>}
                    </label>
                    <input type="url" value={track.lyricsGoogleDocsLink || ''}
                      onChange={e => updateTrack(idx, { lyricsGoogleDocsLink: e.target.value })}
                      placeholder="https://docs.google.com/document/d/..." className="input-dark w-full px-3 py-2.5 rounded-lg text-sm" />
                  </div>

                  {/* Credits + ISRC */}
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Credits <span className="text-red-400">*</span>
                    </label>

                    {/* Core credits — 2 per row */}
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        ['producedBy', 'Produced by'],
                        ['lyricsBy',   'Lyrics by'],
                        ['mixedBy',    'Mixed by'],
                        ['masteredBy', 'Mastered by'],
                      ] as const).map(([key, label]) => {
                        const vals = (track as Record<string,string>)[key]
                          ? (track as Record<string,string>)[key].split('|')
                          : [''];
                        return (
                          <div key={key} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-zinc-400">{label} <span className="text-red-400">*</span></span>
                              <button
                                onClick={() => updateTrack(idx, { [key]: [...vals, ''].join('|') } as Partial<Track>)}
                                className="flex items-center gap-0.5 text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
                              >
                                <Plus className="w-3 h-3" /> Add
                              </button>
                            </div>
                            {vals.map((v, vi) => (
                              <div key={vi} className="flex gap-1.5">
                                <input
                                  type="text"
                                  value={v}
                                  onChange={e => {
                                    const nv = [...vals]; nv[vi] = e.target.value;
                                    updateTrack(idx, { [key]: nv.join('|') } as Partial<Track>);
                                  }}
                                  placeholder={label}
                                  className="input-dark flex-1 px-2.5 py-2 rounded-lg text-sm"
                                />
                                {vals.length > 1 && (
                                  <button
                                    onClick={() => {
                                      const nv = vals.filter((_,i) => i !== vi);
                                      updateTrack(idx, { [key]: nv.join('|') } as Partial<Track>);
                                    }}
                                    className="text-zinc-700 hover:text-red-400 transition-colors p-1 flex-shrink-0"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>

                    {/* Custom credit roles */}
                    {(track.additionalCredits || []).map((credit, ci) => (
                      <div key={ci} className="grid grid-cols-2 gap-1.5 items-start">
                        <input
                          type="text"
                          value={credit.role}
                          onChange={e => {
                            const u = [...(track.additionalCredits||[])];
                            u[ci] = { ...u[ci], role: e.target.value };
                            updateTrack(idx, { additionalCredits: u });
                          }}
                          placeholder="Role"
                          className="input-dark px-2.5 py-2 rounded-lg text-sm"
                        />
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={credit.name}
                            onChange={e => {
                              const u = [...(track.additionalCredits||[])];
                              u[ci] = { ...u[ci], name: e.target.value };
                              updateTrack(idx, { additionalCredits: u });
                            }}
                            placeholder="Name(s)"
                            className="input-dark flex-1 px-2.5 py-2 rounded-lg text-sm"
                          />
                          <button
                            onClick={() => updateTrack(idx, { additionalCredits: (track.additionalCredits||[]).filter((_,i)=>i!==ci) })}
                            className="text-zinc-700 hover:text-red-400 transition-colors p-1 flex-shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={() => updateTrack(idx, { additionalCredits: [...(track.additionalCredits||[]), { role: '', name: '' }] })}
                      className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-violet-400 transition-colors px-3 py-2 rounded-xl border border-dashed border-white/10 hover:border-violet-500/30 w-full justify-center"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add custom credit role
                    </button>

                    {/* ISRC */}
                    <div>
                      <label className="block text-[11px] text-zinc-500 mb-1.5">ISRC <span className="text-zinc-600">— optional, label can fill later</span></label>
                      <input type="text" value={track.isrc || ''}
                        onChange={e => updateTrack(idx, { isrc: e.target.value.toUpperCase() })}
                        placeholder="e.g. USRC17607839"
                        className="input-dark w-full px-3 py-2 rounded-lg text-sm font-mono" />
                    </div>
                  </div>
                </div>
              );
            })}

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
              <p className="text-zinc-500 text-sm">Additional links and final confirmation</p>
            </div>

            <div className="glass-card rounded-2xl p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Promo Materials {settings.requirePromoMaterials && <span className="text-red-400">*</span>}
                </label>
                <p className="text-xs text-zinc-500 mb-3">Google Drive folder with promo photos & videos</p>
                <DrivePickerButton
                  value={promoDriveLink}
                  onChange={(link) => setPromoDriveLink(link)}
                  subFolder="Promo Materials"
                  pickerTitle="Upload Promo Materials"
                  required={settings.requirePromoMaterials}
                  {...driveProps}
                />
                {settings.requirePromoMaterials && !promoDriveLink.trim() && (
                  <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Required by your label
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Main Drive Folder {settings.requireDriveFolder && <span className="text-red-400">*</span>}
                </label>
                <p className="text-xs text-zinc-500 mb-3">Shared folder containing all release assets</p>
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
              <div className="flex gap-4">
                {coverArtDriveLink && (() => {
                  const m = coverArtDriveLink.match(/\/file\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/);
                  const id = m?.[1] || m?.[2];
                  return id ? (
                    <img src={`https://drive.google.com/thumbnail?id=${id}&sz=w200`} alt="Cover"
                      className="w-20 h-20 rounded-xl object-cover border border-white/10 flex-shrink-0 bg-zinc-900" />
                  ) : null;
                })()}
                <div className="flex-1 space-y-2">
                  {[
                    ['Artist', buildArtistLine(mainArtist, collaborations)],
                    ['Title', `${releaseTitle} (${releaseType.toUpperCase()})`],
                    ['Genre', genre],
                    ['Release', `${fmtDate(releaseDate)} · ${daysUntil(releaseDate)} days away`],
                    ['Tracks', `${tracks.length} track${tracks.length !== 1 ? 's' : ''}`],
                    ['Explicit', explicitContent ? 'Yes' : 'No'],
                  ].map(([l, v]) => (
                    <div key={l} className="flex justify-between text-sm py-1 border-b border-white/[0.04] last:border-0">
                      <span className="text-zinc-500">{l}</span>
                      <span className="font-medium text-right max-w-xs truncate">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Track list with Spotify-style names */}
              {tracks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/[0.04]">
                  <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">Tracks</p>
                  <div className="space-y-1">
                    {tracks.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-zinc-600 w-5 text-right flex-shrink-0">{i + 1}</span>
                        <span className="font-medium">{buildTrackDisplay(t.title, features) || <span className="text-zinc-600 italic">Untitled</span>}</span>
                        {t.explicit && <span className="text-xs text-red-400 border border-red-400/30 px-1 rounded">E</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Rights */}
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
                  ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</>
                  : <><CheckCircle2 className="w-5 h-5" /> Submit Release</>}
              </button>
            </div>

            {/* Footer */}
            {(settings.formFooterText || settings.labelEmail || settings.labelInstagram || settings.labelWebsite) && (
              <div className="text-center pt-4 border-t border-white/5 space-y-2">
                {settings.formFooterText && (
                  <p className="text-xs text-zinc-600">{settings.formFooterText}</p>
                )}
                <div className="flex items-center justify-center gap-4 flex-wrap">
                  {settings.labelEmail && (
                    <a href={`mailto:${settings.labelEmail}`} className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400">
                      <Mail className="w-3 h-3" /> {settings.labelEmail}
                    </a>
                  )}
                  {settings.labelInstagram && (
                    <a href={`https://instagram.com/${settings.labelInstagram.replace('@','')}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400">
                      <Instagram className="w-3 h-3" /> @{settings.labelInstagram.replace('@','')}
                    </a>
                  )}
                  {settings.labelWebsite && (
                    <a href={settings.labelWebsite} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400">
                      <Globe className="w-3 h-3" /> {settings.labelWebsite.replace(/^https?:\/\//,'')}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
