import { useState, useRef, type ChangeEvent } from 'react';
import {
  User, Image, Disc, ListMusic, FileText, ShieldCheck,
  ChevronRight, ChevronLeft, Plus, X, Check, Upload,
  Music, AlertCircle, ExternalLink, Sparkles, Headphones, RotateCcw,
} from 'lucide-react';
import {
  type FormState, type Collaborator, type TrackData,
  type ReleaseType, type Release,
  initialFormState, createTrack, createCollaborator,
  getTrackLimits, isValidUrl, generateId, saveRelease,
} from '@/lib/types';

const STEPS = [
  { n: 1, title: 'Artist Info', icon: User },
  { n: 2, title: 'Cover Art', icon: Image },
  { n: 3, title: 'Release Type', icon: Disc },
  { n: 4, title: 'Tracklist', icon: ListMusic },
  { n: 5, title: 'Credits & Files', icon: FileText },
  { n: 6, title: 'Agreement', icon: ShieldCheck },
];

const syne = { fontFamily: "'Syne', sans-serif" };

export default function SubmissionForm() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({ ...initialFormState });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm(p => ({ ...p, [key]: val }));
    setErrors(p => { const n = { ...p }; delete n[key as string]; return n; });
  };

  const setReleaseType = (type: ReleaseType) => {
    const lim = getTrackLimits(type);
    let tracks = [...form.tracks];
    if (type === 'single') tracks = [tracks[0] || createTrack()];
    else if (type === 'ep') {
      while (tracks.length < lim.min) tracks.push(createTrack());
      if (tracks.length > lim.max) tracks = tracks.slice(0, lim.max);
    } else {
      if (tracks.length === 0) tracks = [createTrack()];
    }
    setForm(p => ({ ...p, releaseType: type, tracks }));
    setErrors(p => { const n = { ...p }; delete n.releaseType; return n; });
  };

  const addTrack = () => {
    const lim = getTrackLimits(form.releaseType as ReleaseType);
    if (form.tracks.length < lim.max) setForm(p => ({ ...p, tracks: [...p.tracks, createTrack()] }));
  };

  const removeTrack = (id: string) => {
    const lim = getTrackLimits(form.releaseType as ReleaseType);
    if (form.tracks.length > lim.min) setForm(p => ({ ...p, tracks: p.tracks.filter(t => t.id !== id) }));
  };

  const updateTrack = (id: string, field: keyof TrackData, value: unknown) => {
    setForm(p => ({ ...p, tracks: p.tracks.map(t => t.id === id ? { ...t, [field]: value } : t) }));
  };

  const addCollab = (type: 'collaborations' | 'features') =>
    setForm(p => ({ ...p, [type]: [...p[type], createCollaborator()] }));

  const removeCollab = (type: 'collaborations' | 'features', id: string) =>
    setForm(p => ({ ...p, [type]: p[type].filter((c: Collaborator) => c.id !== id) }));

  const updateCollab = (type: 'collaborations' | 'features', id: string, field: keyof Collaborator, val: string) =>
    setForm(p => ({ ...p, [type]: p[type].map((c: Collaborator) => c.id === id ? { ...c, [field]: val } : c) }));

  const handleCoverUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm(p => ({ ...p, coverArtFileName: file.name }));
    const reader = new FileReader();
    reader.onload = (ev) => setForm(p => ({ ...p, coverArtPreview: ev.target?.result as string }));
    reader.readAsDataURL(file);
    setErrors(p => { const n = { ...p }; delete n.coverArt; return n; });
  };

  const handleWavUpload = (trackId: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) updateTrack(trackId, 'wavFileName', file.name);
  };

  const validate = (s: number): boolean => {
    const errs: Record<string, string> = {};
    if (s === 1) {
      if (!form.artistName.trim()) errs.artistName = 'Artist name is required';
      form.collaborations.forEach((c, i) => {
        if (!c.name.trim()) errs[`col_${i}_name`] = 'Name required';
        if (c.spotifyUrl && !isValidUrl(c.spotifyUrl)) errs[`col_${i}_sp`] = 'Invalid URL';
        if (c.appleMusicUrl && !isValidUrl(c.appleMusicUrl)) errs[`col_${i}_am`] = 'Invalid URL';
        if (c.anghamiUrl && !isValidUrl(c.anghamiUrl)) errs[`col_${i}_an`] = 'Invalid URL';
      });
      form.features.forEach((f, i) => {
        if (!f.name.trim()) errs[`ft_${i}_name`] = 'Name required';
        if (f.spotifyUrl && !isValidUrl(f.spotifyUrl)) errs[`ft_${i}_sp`] = 'Invalid URL';
        if (f.appleMusicUrl && !isValidUrl(f.appleMusicUrl)) errs[`ft_${i}_am`] = 'Invalid URL';
        if (f.anghamiUrl && !isValidUrl(f.anghamiUrl)) errs[`ft_${i}_an`] = 'Invalid URL';
      });
    }
    if (s === 2) {
      if (!form.coverArtFileName && !form.fullDriveFolderLink.trim()) errs.coverArt = 'Upload cover art or provide a Drive folder link';
      if (form.fullDriveFolderLink && !isValidUrl(form.fullDriveFolderLink)) errs.fullDriveFolderLink = 'Must be a valid URL';
    }
    if (s === 3) {
      if (!form.releaseType) errs.releaseType = 'Select a release type';
      if (!form.releaseTitle.trim()) errs.releaseTitle = 'Release title is required';
      if (!form.releaseDate) errs.releaseDate = 'Release date is required';
    }
    if (s === 4) {
      form.tracks.forEach((t, i) => { if (!t.title.trim()) errs[`tr_${i}_title`] = 'Track title required'; });
    }
    if (s === 5) {
      form.tracks.forEach((t, i) => {
        if (t.lyricsDocLink && !isValidUrl(t.lyricsDocLink)) errs[`tr_${i}_lyrics`] = 'Invalid URL';
      });
      if (form.promoFolderLink && !isValidUrl(form.promoFolderLink)) errs.promoFolderLink = 'Invalid URL';
    }
    if (s === 6) {
      if (!form.agreement) errs.agreement = 'You must agree before submitting';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => { if (validate(step)) setStep(s => Math.min(s + 1, 6)); };
  const prev = () => setStep(s => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    if (!validate(6)) return;
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1500));
    const release: Release = {
      id: generateId(), artistName: form.artistName,
      collaborations: form.collaborations, features: form.features,
      coverArtFileName: form.coverArtFileName,
      releaseType: form.releaseType as ReleaseType,
      releaseTitle: form.releaseTitle, releaseDate: form.releaseDate,
      tracks: form.tracks, promoFolderLink: form.promoFolderLink,
      fullDriveFolderLink: form.fullDriveFolderLink, agreement: true,
      status: 'pending', createdAt: new Date().toISOString(),
      driveFolderLink: form.fullDriveFolderLink || '',
    };
    saveRelease(release);
    setSubmitting(false);
    setSubmitted(true);
  };

  // ─── SUCCESS ────────────────────────
  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-scale-in">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-6">
          <Check className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2" style={syne}>Release Submitted!</h2>
        <p className="text-[var(--text-muted)] mb-1">
          <span className="text-[var(--purple-light)] font-semibold">"{form.releaseTitle}"</span> has been submitted for review.
        </p>
        <p className="text-sm text-[var(--text-muted)] mb-8">We'll be in touch soon.</p>
        <button onClick={() => { setForm({ ...initialFormState }); setStep(1); setSubmitted(false); }} className="btn-secondary">
          <RotateCcw className="w-4 h-4" /> Submit Another
        </button>
      </div>
    );
  }

  // ─── SUBMITTING ─────────────────────
  if (submitting) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <div className="w-10 h-10 border-3 border-[var(--border)] border-t-[var(--purple)] rounded-full mb-6" style={{ animation: 'spin 0.8s linear infinite' }} />
        <p className="text-base text-white font-semibold" style={syne}>Processing your release...</p>
        <p className="text-sm text-[var(--text-muted)] mt-1">Please wait</p>
      </div>
    );
  }

  const Err = ({ k }: { k: string }) => errors[k]
    ? <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors[k]}</p>
    : null;

  // ─── STEP BAR ───────────────────────
  const StepBar = () => (
    <div className="mb-8">
      {/* Desktop */}
      <div className="hidden sm:flex items-center justify-between">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => { if (s.n < step) setStep(s.n); }}
              className={`flex flex-col items-center ${s.n < step ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-1.5 transition-all ${
                step > s.n
                  ? 'bg-[var(--purple)] text-white'
                  : step === s.n
                    ? 'bg-[var(--purple)]/15 border border-[var(--purple)]/40 text-[var(--purple-light)]'
                    : 'bg-[var(--card)] border border-[var(--border)] text-[var(--text-muted)]'
              }`}>
                {step > s.n ? <Check className="w-4 h-4" strokeWidth={3} /> : <s.icon className="w-4 h-4" />}
              </div>
              <span className={`text-xs font-medium ${step >= s.n ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}>
                {s.title}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className="flex-1 mx-3 step-line rounded-full">
                <div className="step-line-fill" style={{ transform: `scaleX(${step > s.n ? 1 : 0})` }} />
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Mobile */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-white">Step {step} <span className="text-[var(--text-muted)]">of 6</span></span>
          <span className="text-sm text-[var(--text-muted)]">{STEPS[step - 1].title}</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--card)] overflow-hidden">
          <div className="h-full rounded-full bg-[var(--purple)] transition-all duration-500" style={{ width: `${(step / 6) * 100}%` }} />
        </div>
      </div>
    </div>
  );

  const CollabSection = ({ type, label }: { type: 'collaborations' | 'features'; label: string }) => (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{label}</h3>
          <p className="text-xs text-[var(--text-muted)]">Optional</p>
        </div>
        <button type="button" onClick={() => addCollab(type)} className="btn-ghost text-xs">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
      {form[type].map((c: Collaborator, i: number) => (
        <div key={c.id} className="card p-4 mb-3 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
              {label.slice(0, -1)} #{i + 1}
            </span>
            <button type="button" onClick={() => removeCollab(type, c.id)} className="text-[var(--text-muted)] hover:text-red-400 transition p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <input value={c.name} onChange={e => updateCollab(type, c.id, 'name', e.target.value)} className="input" placeholder="Artist name" />
              <Err k={`${type === 'collaborations' ? 'col' : 'ft'}_${i}_name`} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { key: 'spotifyUrl' as const, label: 'Spotify', ph: 'https://open.spotify.com/...', ek: 'sp' },
                { key: 'appleMusicUrl' as const, label: 'Apple Music', ph: 'https://music.apple.com/...', ek: 'am' },
                { key: 'anghamiUrl' as const, label: 'Anghami', ph: 'https://play.anghami.com/...', ek: 'an' },
              ].map(p => (
                <div key={p.key}>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">{p.label}</label>
                  <input type="url" value={c[p.key]} onChange={e => updateCollab(type, c.id, p.key, e.target.value)} className="input" placeholder={p.ph} />
                  <Err k={`${type === 'collaborations' ? 'col' : 'ft'}_${i}_${p.ek}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="animate-fade-in-slow max-w-3xl mx-auto">
      <StepBar />

      <div className="card-elevated p-6 sm:p-8 min-h-[380px]">
        {/* STEP 1 */}
        {step === 1 && (
          <div className="animate-fade-in" key="s1">
            <StepHead icon={User} title="Artist Information" desc="Who's behind this release?" />
            <div>
              <label className="label label-required">Main Artist</label>
              <input value={form.artistName} onChange={e => set('artistName', e.target.value)} className="input" placeholder="Enter artist or band name" />
              <Err k="artistName" />
            </div>
            <CollabSection type="collaborations" label="Collaborations" />
            <CollabSection type="features" label="Features" />
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="animate-fade-in" key="s2">
            <StepHead icon={Image} title="Cover Art" desc="Upload your release artwork" />
            <div
              onClick={() => coverRef.current?.click()}
              className={`rounded-xl p-8 text-center cursor-pointer transition-all border-2 border-dashed ${
                form.coverArtPreview ? 'border-[var(--purple)]/30 bg-[var(--purple)]/5' : 'border-[var(--border)] hover:border-[var(--border-light)]'
              }`}
            >
              {form.coverArtPreview ? (
                <div className="flex flex-col items-center">
                  <img src={form.coverArtPreview} alt="Cover" className="w-48 h-48 object-cover rounded-xl mb-4 shadow-lg" />
                  <p className="text-sm text-white font-medium">{form.coverArtFileName}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Click to replace</p>
                </div>
              ) : (
                <div className="flex flex-col items-center py-8">
                  <Upload className="w-10 h-10 text-[var(--text-muted)] mb-4" />
                  <p className="text-sm text-white font-medium mb-1">Click to upload cover art</p>
                  <p className="text-xs text-[var(--text-muted)]">JPG — 3000 × 3000 pixels recommended</p>
                </div>
              )}
              <input ref={coverRef} type="file" accept="image/jpeg,image/jpg,image/png" onChange={handleCoverUpload} className="hidden" />
            </div>
            <Err k="coverArt" />

            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="text-xs text-[var(--text-muted)] font-medium">OR</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>

            <div>
              <label className="label">Full Google Drive Folder</label>
              <p className="text-xs text-[var(--text-muted)] mb-2">Provide a Drive folder to skip individual uploads</p>
              <input type="url" value={form.fullDriveFolderLink} onChange={e => set('fullDriveFolderLink', e.target.value)} className="input" placeholder="https://drive.google.com/drive/folders/..." />
              <Err k="fullDriveFolderLink" />
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="animate-fade-in" key="s3">
            <StepHead icon={Disc} title="Release Type" desc="Choose format and provide details" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {([
                { type: 'single' as ReleaseType, label: 'Single', desc: '1 track', icon: Music },
                { type: 'ep' as ReleaseType, label: 'EP', desc: '3–6 tracks', icon: Disc },
                { type: 'album' as ReleaseType, label: 'Album', desc: 'Up to 32', icon: Headphones },
              ]).map(r => (
                <button key={r.type} type="button" onClick={() => setReleaseType(r.type)}
                  className={`release-type-card card p-5 text-left relative ${form.releaseType === r.type ? 'selected' : ''}`}>
                  {form.releaseType === r.type && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[var(--purple)] flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </div>
                  )}
                  <r.icon className={`w-8 h-8 mb-3 ${form.releaseType === r.type ? 'text-[var(--purple-light)]' : 'text-[var(--text-muted)]'}`} strokeWidth={1.5} />
                  <h3 className="text-base font-bold text-white mb-0.5" style={syne}>{r.label}</h3>
                  <p className="text-xs text-[var(--text-muted)]">{r.desc}</p>
                </button>
              ))}
            </div>
            <Err k="releaseType" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="label label-required">Release Title</label>
                <input value={form.releaseTitle} onChange={e => set('releaseTitle', e.target.value)} className="input" placeholder="e.g., Midnight Dreams" />
                <Err k="releaseTitle" />
              </div>
              <div>
                <label className="label label-required">Release Date</label>
                <input type="date" value={form.releaseDate} onChange={e => set('releaseDate', e.target.value)} className="input" />
                <Err k="releaseDate" />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div className="animate-fade-in" key="s4">
            <StepHead icon={ListMusic} title="Tracklist" desc={
              form.releaseType === 'single' ? '1 track' :
              form.releaseType === 'ep' ? `${form.tracks.length} of 3–6 tracks` :
              `${form.tracks.length} of up to 32 tracks`
            } />
            <div className="space-y-4">
              {form.tracks.map((track, i) => (
                <div key={track.id} className="card p-5 animate-fade-in">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[var(--purple)]/10 border border-[var(--purple)]/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-[var(--purple-light)]">{String(i + 1).padStart(2, '0')}</span>
                      </div>
                      <span className="text-sm font-semibold text-white">Track {i + 1}</span>
                    </div>
                    {form.releaseType !== 'single' && form.tracks.length > getTrackLimits(form.releaseType as ReleaseType).min && (
                      <button type="button" onClick={() => removeTrack(track.id)} className="text-[var(--text-muted)] hover:text-red-400 transition p-1">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <div className="sm:col-span-2">
                      <label className="label label-required">Track Title</label>
                      <input value={track.title} onChange={e => updateTrack(track.id, 'title', e.target.value)} className="input" placeholder="Track name" />
                      <Err k={`tr_${i}_title`} />
                    </div>
                    <div>
                      <label className="label">Preview Time</label>
                      <input value={track.previewTime} onChange={e => updateTrack(track.id, 'previewTime', e.target.value)} className="input" placeholder="e.g., 0:15 – 0:30" />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-4">
                    <label className="text-sm text-[var(--text-secondary)]">Explicit Content</label>
                    <button type="button" onClick={() => updateTrack(track.id, 'explicit', !track.explicit)}
                      className={`toggle ${track.explicit ? 'toggle-on' : 'toggle-off'}`}>
                      <div className={`toggle-knob ${track.explicit ? 'toggle-knob-on' : 'toggle-knob-off'}`} />
                    </button>
                    <span className={`text-sm font-medium ${track.explicit ? 'text-[var(--purple-light)]' : 'text-[var(--text-muted)]'}`}>
                      {track.explicit ? 'Yes' : 'No'}
                    </span>
                  </div>

                  <div className="border-t border-[var(--border)] pt-4">
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Credits</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { key: 'producedBy' as const, label: 'Produced by', ph: 'Producer name' },
                        { key: 'lyricsBy' as const, label: 'Lyrics by', ph: 'Lyricist name' },
                        { key: 'mixedBy' as const, label: 'Mixed by', ph: 'Mix engineer' },
                        { key: 'masteredBy' as const, label: 'Mastered by', ph: 'Mastering engineer' },
                      ].map(c => (
                        <div key={c.key}>
                          <label className="text-xs text-[var(--text-muted)] mb-1 block">{c.label}</label>
                          <input value={track[c.key]} onChange={e => updateTrack(track.id, c.key, e.target.value)} className="input" placeholder={c.ph} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {form.releaseType !== 'single' && form.tracks.length < getTrackLimits(form.releaseType as ReleaseType).max && (
              <button type="button" onClick={addTrack}
                className="mt-4 w-full py-3.5 border-2 border-dashed border-[var(--border)] rounded-xl text-sm text-[var(--text-muted)] hover:border-[var(--purple)]/30 hover:text-[var(--purple-light)] transition-all flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Add Track
              </button>
            )}
          </div>
        )}

        {/* STEP 5 */}
        {step === 5 && (
          <div className="animate-fade-in" key="s5">
            <StepHead icon={FileText} title="Files & Links" desc="Upload audio and provide document links" />

            {form.fullDriveFolderLink && (
              <div className="card-purple rounded-xl p-4 mb-5 flex items-start gap-3 animate-fade-in">
                <Sparkles className="w-5 h-5 text-[var(--purple-light)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-white font-medium">Drive folder linked</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Individual WAV uploads below are optional.</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {form.tracks.map((track, i) => (
                <div key={track.id} className="card p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-[var(--purple)]/10 border border-[var(--purple)]/20 flex items-center justify-center">
                      <span className="text-[11px] font-bold text-[var(--purple-light)]">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <span className="text-sm font-semibold text-white">{track.title || `Track ${i + 1}`}</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="label">WAV File</label>
                      <label className="input flex items-center gap-3 cursor-pointer hover:border-[var(--border-light)] transition">
                        <Upload className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                        <span className={`text-sm truncate ${track.wavFileName ? 'text-white' : 'text-[var(--text-muted)]'}`}>
                          {track.wavFileName || 'Choose WAV file...'}
                        </span>
                        {track.wavFileName && <Check className="w-4 h-4 text-emerald-400 ml-auto shrink-0" />}
                        <input type="file" accept=".wav,audio/wav" onChange={(e) => handleWavUpload(track.id, e)} className="hidden" />
                      </label>
                    </div>

                    <div>
                      <label className="label">Lyrics <span className="label-hint">(Google Docs Link)</span></label>
                      <div className="relative">
                        <input type="url" value={track.lyricsDocLink} onChange={e => updateTrack(track.id, 'lyricsDocLink', e.target.value)}
                          className="input pr-10" placeholder="https://docs.google.com/document/..." />
                        {track.lyricsDocLink && isValidUrl(track.lyricsDocLink) && (
                          <ExternalLink className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                        )}
                      </div>
                      <Err k={`tr_${i}_lyrics`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <label className="label">Promo Pictures / Videos <span className="label-hint">(Drive Folder Link)</span></label>
              <input type="url" value={form.promoFolderLink} onChange={e => set('promoFolderLink', e.target.value)} className="input" placeholder="https://drive.google.com/drive/folders/..." />
              <Err k="promoFolderLink" />
            </div>
          </div>
        )}

        {/* STEP 6 */}
        {step === 6 && (
          <div className="animate-fade-in" key="s6">
            <StepHead icon={ShieldCheck} title="Review & Submit" desc="Confirm your release details" />

            {/* Summary */}
            <div className="card p-5 mb-5">
              <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-4">Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Artist', value: form.artistName },
                  { label: 'Release', value: form.releaseTitle },
                  { label: 'Type', value: form.releaseType, cap: true },
                  { label: 'Date', value: form.releaseDate ? new Date(form.releaseDate + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—' },
                  { label: 'Tracks', value: `${form.tracks.length} track${form.tracks.length !== 1 ? 's' : ''}` },
                  { label: 'Cover Art', value: form.coverArtFileName || (form.fullDriveFolderLink ? 'Via Drive' : '—') },
                ].map(item => (
                  <div key={item.label}>
                    <p className="text-xs text-[var(--text-muted)] mb-0.5">{item.label}</p>
                    <p className={`text-sm text-white font-medium ${item.cap ? 'capitalize' : ''}`}>{item.value}</p>
                  </div>
                ))}
              </div>

              {(form.collaborations.length > 0 || form.features.length > 0) && (
                <div className="border-t border-[var(--border)] mt-4 pt-3 grid grid-cols-2 gap-4">
                  {form.collaborations.length > 0 && (
                    <div>
                      <p className="text-xs text-[var(--text-muted)] mb-0.5">Collaborations</p>
                      <p className="text-sm text-white font-medium">{form.collaborations.map(c => c.name).join(', ')}</p>
                    </div>
                  )}
                  {form.features.length > 0 && (
                    <div>
                      <p className="text-xs text-[var(--text-muted)] mb-0.5">Features</p>
                      <p className="text-sm text-white font-medium">{form.features.map(f => f.name).join(', ')}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-[var(--border)] mt-4 pt-3">
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Tracks</p>
                {form.tracks.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-3 py-1.5 text-sm">
                    <span className="text-[var(--text-muted)] w-5 text-right text-xs">{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-white flex-1">{t.title || 'Untitled'}</span>
                    {t.explicit && <span className="text-[10px] font-bold text-[var(--text-muted)] border border-[var(--border)] rounded px-1.5 py-0.5">E</span>}
                    {t.wavFileName && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Agreement */}
            <div className="card p-5">
              <label className="flex items-start gap-3 cursor-pointer group">
                <button type="button" onClick={() => set('agreement', !form.agreement)}
                  className={`w-5 h-5 rounded-md flex items-center justify-center mt-0.5 shrink-0 transition-all ${
                    form.agreement ? 'bg-[var(--purple)]' : 'border border-[var(--border-light)] group-hover:border-[var(--purple)]/40'
                  }`}>
                  {form.agreement && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </button>
                <span className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  I confirm all information is accurate and I own the rights to submit this release for distribution through In Lights.
                </span>
              </label>
              <Err k="agreement" />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6 mb-8">
        {step > 1 ? (
          <button type="button" onClick={prev} className="btn-secondary">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        ) : <div />}

        {step < 6 ? (
          <button type="button" onClick={next} className="btn-primary">
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={!form.agreement || submitting} className="btn-primary">
            Submit Release
          </button>
        )}
      </div>
    </div>
  );
}

function StepHead({ icon: Icon, title, desc }: { icon: typeof User; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl bg-[var(--purple)]/10 border border-[var(--purple)]/20 flex items-center justify-center">
        <Icon className="w-5 h-5 text-[var(--purple-light)]" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Syne', sans-serif" }}>{title}</h2>
        <p className="text-sm text-[var(--text-muted)]">{desc}</p>
      </div>
    </div>
  );
}
