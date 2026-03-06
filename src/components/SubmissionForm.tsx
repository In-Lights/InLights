import { useState, useRef, type ChangeEvent } from 'react';
import {
  User, Image, Disc, ListMusic, FileText, ShieldCheck,
  ChevronRight, ChevronLeft, Plus, X, Check, Upload,
  Music, AlertCircle, ExternalLink, Sparkles, Headphones,
} from 'lucide-react';
import {
  type FormState, type Collaborator, type TrackData,
  type ReleaseType, type Release,
  initialFormState, createTrack, createCollaborator,
  getTrackLimits, isValidUrl, generateId, saveRelease,
} from '@/lib/types';

const STEPS = [
  { n: 1, title: 'Artist', desc: 'Who are you?', icon: User },
  { n: 2, title: 'Cover Art', desc: 'Your artwork', icon: Image },
  { n: 3, title: 'Release', desc: 'Type & details', icon: Disc },
  { n: 4, title: 'Tracks', desc: 'Your tracklist', icon: ListMusic },
  { n: 5, title: 'Files', desc: 'Audio & docs', icon: FileText },
  { n: 6, title: 'Submit', desc: 'Review & send', icon: ShieldCheck },
];

const font = { fontFamily: "'Outfit', sans-serif" };
const inputCls = 'w-full input-glow rounded-xl px-4 py-3.5 text-white text-sm focus:outline-none';
const labelCls = 'block text-[11px] font-bold text-violet-300/30 uppercase tracking-[0.15em] mb-2';
const errorCls = 'text-rose-400/80 text-[11px] mt-1.5 flex items-center gap-1';

export default function SubmissionForm() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({ ...initialFormState });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

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
    await new Promise(r => setTimeout(r, 2000));
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

  // ─── Success Screen ────────────────────
  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-scale-in">
        <div className="vinyl-orbit mb-8 flex items-center justify-center">
          <div className="vinyl" style={{ width: 160, height: 160 }} />
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-emerald-300 font-semibold uppercase tracking-wider">Submitted</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 text-center" style={font}>
          Release Submitted
        </h2>
        <p className="text-white/25 mb-2 text-center max-w-md">
          Your release <span className="text-gradient font-bold">"{form.releaseTitle}"</span> has been
          submitted for review.
        </p>
        <p className="text-white/15 text-sm mb-10 font-mono">We'll be in touch soon.</p>
        <button
          onClick={() => { setForm({ ...initialFormState }); setStep(1); setSubmitted(false); }}
          className="btn-primary px-8 py-3.5 rounded-xl text-sm"
        >
          <span className="flex items-center gap-2">Submit Another Release</span>
        </button>
      </div>
    );
  }

  // ─── Submitting State ──────────────────
  if (submitting) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <div className="vinyl-orbit mb-8 flex items-center justify-center">
          <div className="vinyl" style={{ width: 140, height: 140 }} />
        </div>
        <p className="text-lg text-violet-300/50 font-semibold" style={font}>
          Processing your release...
        </p>
        <p className="text-sm text-white/15 mt-2 font-mono">Please wait</p>
      </div>
    );
  }

  // ─── Step Indicator ────────────────────
  const StepBar = () => (
    <div className="mb-10">
      {/* Desktop */}
      <div className="hidden sm:flex items-center justify-between relative">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => { if (s.n < step) setStep(s.n); }}
              className={`flex flex-col items-center relative group ${s.n < step ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div
                className={`
                  w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 mb-2
                  ${step > s.n
                    ? 'bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/25'
                    : step === s.n
                      ? 'glass-strong border border-violet-500/30 shadow-[0_0_30px_rgba(139,92,246,0.15)] neon-purple'
                      : 'glass'
                  }
                `}
              >
                {step > s.n ? (
                  <Check className="w-5 h-5 text-white" strokeWidth={3} />
                ) : (
                  <s.icon className={`w-5 h-5 transition-colors ${step === s.n ? 'text-violet-300' : 'text-white/15'}`} />
                )}
              </div>
              <span className={`text-[11px] font-bold transition-colors ${
                step >= s.n ? 'text-violet-200/50' : 'text-white/10'
              }`} style={font}>{s.title}</span>
              <span className={`text-[9px] font-mono transition-colors ${
                step >= s.n ? 'text-violet-300/20' : 'text-white/5'
              }`}>{s.desc}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className="flex-1 mx-3 step-connector rounded-full">
                <div
                  className="step-connector-fill"
                  style={{ transform: `scaleX(${step > s.n ? 1 : 0})` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-violet-200/50" style={font}>
            Step {step} <span className="text-white/15">of 6</span>
          </span>
          <span className="text-xs text-violet-300/25 font-mono">{STEPS[step - 1].title}</span>
        </div>
        <div className="h-1.5 rounded-full bg-violet-500/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(step / 6) * 100}%`,
              background: 'linear-gradient(90deg, #8B5CF6, #D946EF, #22D3EE)',
              boxShadow: '0 0 12px rgba(139,92,246,0.5)',
            }}
          />
        </div>
      </div>
    </div>
  );

  const Err = ({ k }: { k: string }) => errors[k]
    ? <p className={errorCls}><AlertCircle className="w-3 h-3" />{errors[k]}</p>
    : null;

  const CollabSection = ({ type, label }: { type: 'collaborations' | 'features'; label: string }) => (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white/60" style={font}>{label}</h3>
          <p className="text-[11px] text-violet-300/15 font-mono">Optional</p>
        </div>
        <button type="button" onClick={() => addCollab(type)}
          className="btn-ghost px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
      {form[type].map((c: Collaborator, i: number) => (
        <div key={c.id} className="glass-card rounded-xl p-5 mb-3 animate-fade-in">
          <div className="flex items-center justify-between mb-4 relative z-10">
            <span className="text-[11px] text-violet-400/25 font-bold uppercase tracking-wider font-mono">
              {label.slice(0, -1)} #{i + 1}
            </span>
            <button type="button" onClick={() => removeCollab(type, c.id)}
              className="text-white/15 hover:text-rose-400/70 transition p-1 rounded-lg hover:bg-rose-500/10">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3 relative z-10">
            <div>
              <input value={c.name} onChange={e => updateCollab(type, c.id, 'name', e.target.value)}
                className={inputCls} placeholder="Artist name" />
              <Err k={`${type === 'collaborations' ? 'col' : 'ft'}_${i}_name`} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { key: 'spotifyUrl' as const, label: 'Spotify', ph: 'https://open.spotify.com/...', ek: 'sp' },
                { key: 'appleMusicUrl' as const, label: 'Apple Music', ph: 'https://music.apple.com/...', ek: 'am' },
                { key: 'anghamiUrl' as const, label: 'Anghami', ph: 'https://play.anghami.com/...', ek: 'an' },
              ].map(p => (
                <div key={p.key}>
                  <label className="text-[10px] text-violet-300/15 mb-1 block uppercase tracking-wider font-semibold">{p.label}</label>
                  <input type="url" value={c[p.key]} onChange={e => updateCollab(type, c.id, p.key, e.target.value)}
                    className={inputCls} placeholder={p.ph} />
                  <Err k={`${type === 'collaborations' ? 'col' : 'ft'}_${i}_${p.ek}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════
  return (
    <div className="animate-slide-up max-w-3xl mx-auto">
      <StepBar />

      <div className="glass-card gradient-border rounded-3xl p-6 sm:p-10 min-h-[420px]">
        {/* ── STEP 1: Artist Info ───────── */}
        {step === 1 && (
          <div className="animate-fade-in relative z-10" key="s1">
            <StepHeader icon={User} title="Artist Information" desc="Tell us about the artist behind this release" />
            <div className="animate-fade-in stagger-1">
              <label className={labelCls}>Main Artist <span className="text-violet-400">*</span></label>
              <input value={form.artistName} onChange={e => set('artistName', e.target.value)}
                className={inputCls} placeholder="Enter artist or band name" />
              <Err k="artistName" />
            </div>
            <CollabSection type="collaborations" label="Collaborations" />
            <CollabSection type="features" label="Features" />
          </div>
        )}

        {/* ── STEP 2: Cover Art ──────────── */}
        {step === 2 && (
          <div className="animate-fade-in relative z-10" key="s2">
            <StepHeader icon={Image} title="Cover Art" desc="Upload your release artwork" />

            <div
              onClick={() => coverInputRef.current?.click()}
              className={`
                relative rounded-2xl p-8 text-center cursor-pointer transition-all duration-500 group overflow-hidden
                ${form.coverArtPreview
                  ? 'border border-violet-500/20'
                  : 'border-2 border-dashed border-violet-500/[0.08] hover:border-violet-500/25'
                }
              `}
              style={{ background: 'rgba(139,92,246,0.02)' }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-violet-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              {form.coverArtPreview ? (
                <div className="flex flex-col items-center relative z-10">
                  <div className="relative mb-5">
                    <img src={form.coverArtPreview} alt="Cover"
                      className="w-52 h-52 object-cover rounded-2xl shadow-2xl shadow-violet-900/50" />
                    <div className="absolute inset-0 rounded-2xl ring-1 ring-violet-500/20" />
                  </div>
                  <p className="text-sm text-white/40 font-semibold">{form.coverArtFileName}</p>
                  <p className="text-[11px] text-violet-300/15 mt-1 font-mono">Click to replace</p>
                </div>
              ) : (
                <div className="flex flex-col items-center py-10 relative z-10">
                  <div className="w-20 h-20 rounded-2xl glass flex items-center justify-center mb-5 group-hover:neon-purple transition-all duration-500">
                    <Upload className="w-8 h-8 text-white/15 group-hover:text-violet-400/60 transition-colors duration-500" />
                  </div>
                  <p className="text-sm text-white/30 font-bold mb-1" style={font}>Drop your artwork here</p>
                  <p className="text-[11px] text-violet-300/15 font-mono">JPG — 3000 × 3000 pixels recommended</p>
                </div>
              )}
              <input ref={coverInputRef} type="file" accept="image/jpeg,image/jpg,image/png"
                onChange={handleCoverUpload} className="hidden" />
            </div>
            <Err k="coverArt" />

            <div className="flex items-center gap-4 my-8">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-violet-500/10 to-transparent" />
              <span className="text-[10px] text-violet-300/15 uppercase tracking-[0.3em] font-bold font-mono">or</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-violet-500/10 to-transparent" />
            </div>

            <div>
              <label className={labelCls}>Full Google Drive Folder</label>
              <p className="text-[11px] text-violet-300/12 mb-3 font-mono">
                Provide a Drive folder to skip individual uploads.
              </p>
              <input type="url" value={form.fullDriveFolderLink}
                onChange={e => set('fullDriveFolderLink', e.target.value)}
                className={inputCls} placeholder="https://drive.google.com/drive/folders/..." />
              <Err k="fullDriveFolderLink" />
            </div>
          </div>
        )}

        {/* ── STEP 3: Release Type ──────── */}
        {step === 3 && (
          <div className="animate-fade-in relative z-10" key="s3">
            <StepHeader icon={Disc} title="Release Type" desc="Select the format and provide details" />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {([
                { type: 'single' as ReleaseType, label: 'Single', desc: '1 track', icon: Music, gradient: 'from-violet-500/15 to-violet-500/[0.02]', border: 'border-violet-500/30', shadow: 'shadow-violet-500/15' },
                { type: 'ep' as ReleaseType, label: 'EP', desc: '3–6 tracks', icon: Disc, gradient: 'from-fuchsia-500/15 to-fuchsia-500/[0.02]', border: 'border-fuchsia-500/30', shadow: 'shadow-fuchsia-500/15' },
                { type: 'album' as ReleaseType, label: 'Album', desc: 'Up to 32', icon: Headphones, gradient: 'from-cyan-500/15 to-cyan-500/[0.02]', border: 'border-cyan-500/30', shadow: 'shadow-cyan-500/15' },
              ]).map(r => (
                <button key={r.type} type="button" onClick={() => setReleaseType(r.type)}
                  className={`
                    release-card relative p-6 rounded-2xl text-left group overflow-hidden
                    ${form.releaseType === r.type
                      ? `selected glass-strong ${r.border} shadow-lg ${r.shadow}`
                      : 'glass hover:border-violet-500/10'
                    }
                  `}>
                  <div className={`absolute inset-0 bg-gradient-to-b ${r.gradient} opacity-0 ${
                    form.releaseType === r.type ? 'opacity-100' : 'group-hover:opacity-60'
                  } transition-opacity duration-500`} />

                  {form.releaseType === r.type && (
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30 z-10">
                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                    </div>
                  )}

                  <div className="relative z-10">
                    <r.icon className={`w-10 h-10 mb-4 transition-colors duration-300 ${
                      form.releaseType === r.type ? 'text-violet-300' : 'text-white/10 group-hover:text-white/25'
                    }`} strokeWidth={1.5} />
                    <h3 className="font-black text-white text-xl mb-1" style={font}>{r.label}</h3>
                    <p className="text-sm text-white/20 font-mono">{r.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <Err k="releaseType" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div>
                <label className={labelCls}>Release Title <span className="text-violet-400">*</span></label>
                <input value={form.releaseTitle} onChange={e => set('releaseTitle', e.target.value)}
                  className={inputCls} placeholder="e.g., Midnight Dreams" />
                <Err k="releaseTitle" />
              </div>
              <div>
                <label className={labelCls}>Release Date <span className="text-violet-400">*</span></label>
                <input type="date" value={form.releaseDate} onChange={e => set('releaseDate', e.target.value)}
                  className={inputCls} />
                <Err k="releaseDate" />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4: Tracklist ────────── */}
        {step === 4 && (
          <div className="animate-fade-in relative z-10" key="s4">
            <StepHeader icon={ListMusic} title="Tracklist" desc={
              form.releaseType === 'single' ? '1 track' :
              form.releaseType === 'ep' ? `${form.tracks.length} of 3–6 tracks` :
              `${form.tracks.length} of up to 32 tracks`
            } />

            <div className="space-y-4">
              {form.tracks.map((track, i) => (
                <div key={track.id} className="glass-card rounded-2xl p-5 sm:p-6 animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="flex items-center justify-between mb-5 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/10 flex items-center justify-center border border-violet-500/15">
                        <span className="text-xs font-black text-violet-300 font-mono">{String(i + 1).padStart(2, '0')}</span>
                      </div>
                      <span className="text-sm font-bold text-white/50" style={font}>
                        Track {i + 1}
                      </span>
                    </div>
                    {form.releaseType !== 'single' && form.tracks.length > getTrackLimits(form.releaseType as ReleaseType).min && (
                      <button type="button" onClick={() => removeTrack(track.id)}
                        className="text-white/10 hover:text-rose-400/60 transition p-1.5 rounded-lg hover:bg-rose-500/10">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 relative z-10">
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Track Title <span className="text-violet-400">*</span></label>
                      <input value={track.title} onChange={e => updateTrack(track.id, 'title', e.target.value)}
                        className={inputCls} placeholder="Track name" />
                      <Err k={`tr_${i}_title`} />
                    </div>
                    <div>
                      <label className={labelCls}>Preview Time</label>
                      <input value={track.previewTime} onChange={e => updateTrack(track.id, 'previewTime', e.target.value)}
                        className={inputCls} placeholder="e.g., 0:15 – 0:30" />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-5 relative z-10">
                    <label className="text-xs text-violet-300/20 font-bold uppercase tracking-wider">Explicit</label>
                    <button type="button" onClick={() => updateTrack(track.id, 'explicit', !track.explicit)}
                      className={`toggle-track w-12 h-7 rounded-full relative ${
                        track.explicit
                          ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500'
                          : 'bg-white/[0.04]'
                      }`}>
                      <div className={`toggle-thumb w-5 h-5 rounded-full bg-white absolute top-1 shadow-lg ${
                        track.explicit ? 'left-6' : 'left-1'
                      }`} />
                    </button>
                    <span className={`text-xs font-bold font-mono ${track.explicit ? 'text-violet-300' : 'text-white/10'}`}>
                      {track.explicit ? 'Yes' : 'No'}
                    </span>
                  </div>

                  <div className="border-t border-violet-500/[0.06] pt-5 relative z-10">
                    <p className="text-[10px] font-bold text-violet-400/15 uppercase tracking-[0.2em] mb-4 font-mono">Credits</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { key: 'producedBy' as const, label: 'Produced by', ph: 'Producer name' },
                        { key: 'lyricsBy' as const, label: 'Lyrics by', ph: 'Lyricist name' },
                        { key: 'mixedBy' as const, label: 'Mixed by', ph: 'Mix engineer' },
                        { key: 'masteredBy' as const, label: 'Mastered by', ph: 'Mastering engineer' },
                      ].map(c => (
                        <div key={c.key}>
                          <label className="text-[10px] text-violet-300/12 mb-1 block uppercase tracking-wider font-semibold">{c.label}</label>
                          <input value={track[c.key]} onChange={e => updateTrack(track.id, c.key, e.target.value)}
                            className={inputCls} placeholder={c.ph} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {form.releaseType !== 'single' && form.tracks.length < getTrackLimits(form.releaseType as ReleaseType).max && (
              <button type="button" onClick={addTrack}
                className="mt-5 w-full py-4 border-2 border-dashed border-violet-500/[0.06] rounded-2xl text-sm text-white/15 hover:border-violet-500/20 hover:text-violet-300/50 transition-all duration-300 flex items-center justify-center gap-2 group">
                <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" /> Add Track
              </button>
            )}
          </div>
        )}

        {/* ── STEP 5: Files & Links ─────── */}
        {step === 5 && (
          <div className="animate-fade-in relative z-10" key="s5">
            <StepHeader icon={FileText} title="Files & Links" desc="Upload audio and provide document links" />

            {form.fullDriveFolderLink && (
              <div className="glass rounded-xl p-4 mb-6 flex items-start gap-3 border border-violet-500/10 animate-fade-in">
                <Sparkles className="w-5 h-5 text-violet-400/60 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-violet-300/60 font-bold">Drive folder linked</p>
                  <p className="text-[11px] text-white/15 mt-0.5 font-mono">Individual WAV uploads below are optional.</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {form.tracks.map((track, i) => (
                <div key={track.id} className="glass-card rounded-2xl p-5 sm:p-6">
                  <div className="flex items-center gap-3 mb-5 relative z-10">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 flex items-center justify-center border border-violet-500/10">
                      <span className="text-[11px] font-black text-violet-300 font-mono">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <span className="text-sm font-bold text-white/60" style={font}>{track.title || `Track ${i + 1}`}</span>
                  </div>

                  <div className="space-y-4 relative z-10">
                    <div>
                      <label className={labelCls}>WAV File</label>
                      <label className={`flex items-center gap-3 ${inputCls} cursor-pointer group`}>
                        <Upload className="w-4 h-4 text-white/10 shrink-0 group-hover:text-violet-400/50 transition-colors" />
                        <span className={`text-sm truncate ${track.wavFileName ? 'text-white/40' : 'text-white/10'}`}>
                          {track.wavFileName || 'Choose WAV file...'}
                        </span>
                        {track.wavFileName && <Check className="w-4 h-4 text-emerald-400/60 ml-auto shrink-0" />}
                        <input type="file" accept=".wav,audio/wav" onChange={(e) => handleWavUpload(track.id, e)} className="hidden" />
                      </label>
                    </div>

                    <div>
                      <label className={labelCls}>Lyrics <span className="text-violet-300/10">(Google Docs Link)</span></label>
                      <div className="relative">
                        <input type="url" value={track.lyricsDocLink}
                          onChange={e => updateTrack(track.id, 'lyricsDocLink', e.target.value)}
                          className={`${inputCls} pr-10`} placeholder="https://docs.google.com/document/..." />
                        {track.lyricsDocLink && isValidUrl(track.lyricsDocLink) && (
                          <ExternalLink className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400/20" />
                        )}
                      </div>
                      <Err k={`tr_${i}_lyrics`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <label className={labelCls}>Promo Pictures / Videos <span className="text-violet-300/10">(Drive Folder)</span></label>
              <input type="url" value={form.promoFolderLink}
                onChange={e => set('promoFolderLink', e.target.value)}
                className={inputCls} placeholder="https://drive.google.com/drive/folders/..." />
              <Err k="promoFolderLink" />
            </div>
          </div>
        )}

        {/* ── STEP 6: Agreement ──────────── */}
        {step === 6 && (
          <div className="animate-fade-in relative z-10" key="s6">
            <StepHeader icon={ShieldCheck} title="Review & Submit" desc="Confirm your release details" />

            {/* Summary */}
            <div className="glass-card rounded-2xl p-6 mb-6">
              <p className="text-[10px] font-bold text-violet-400/15 uppercase tracking-[0.2em] mb-5 font-mono relative z-10">Summary</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 relative z-10">
                {[
                  { label: 'Artist', value: form.artistName },
                  { label: 'Release', value: form.releaseTitle },
                  { label: 'Type', value: form.releaseType, capitalize: true },
                  { label: 'Date', value: form.releaseDate ? new Date(form.releaseDate + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—' },
                  { label: 'Tracks', value: `${form.tracks.length} track${form.tracks.length !== 1 ? 's' : ''}` },
                  { label: 'Cover Art', value: form.coverArtFileName || (form.fullDriveFolderLink ? 'Via Drive' : '—') },
                ].map(item => (
                  <div key={item.label}>
                    <span className="text-[10px] text-violet-300/12 uppercase tracking-wider font-mono">{item.label}</span>
                    <p className={`text-sm text-white/60 font-bold mt-0.5 ${item.capitalize ? 'capitalize' : ''}`} style={font}>{item.value}</p>
                  </div>
                ))}
              </div>

              {(form.collaborations.length > 0 || form.features.length > 0) && (
                <div className="border-t border-violet-500/[0.06] mt-5 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                  {form.collaborations.length > 0 && (
                    <div>
                      <span className="text-[10px] text-violet-300/12 uppercase tracking-wider font-mono">Collaborations</span>
                      <p className="text-sm text-white/60 font-bold mt-0.5" style={font}>{form.collaborations.map(c => c.name).join(', ')}</p>
                    </div>
                  )}
                  {form.features.length > 0 && (
                    <div>
                      <span className="text-[10px] text-violet-300/12 uppercase tracking-wider font-mono">Features</span>
                      <p className="text-sm text-white/60 font-bold mt-0.5" style={font}>{form.features.map(f => f.name).join(', ')}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-violet-500/[0.06] mt-5 pt-4 relative z-10">
                <p className="text-[10px] font-bold text-violet-400/12 uppercase tracking-[0.2em] mb-3 font-mono">Tracks</p>
                <div className="space-y-2">
                  {form.tracks.map((t, i) => (
                    <div key={t.id} className="flex items-center gap-3 text-sm py-1.5">
                      <span className="text-violet-400/30 font-mono text-xs w-5 text-right">{String(i + 1).padStart(2, '0')}</span>
                      <span className="text-white/50 flex-1 font-semibold">{t.title || 'Untitled'}</span>
                      {t.explicit && (
                        <span className="text-[8px] font-black text-violet-300/20 border border-violet-500/10 rounded px-1.5 py-0.5 uppercase font-mono">E</span>
                      )}
                      {t.wavFileName && <Check className="w-3.5 h-3.5 text-emerald-400/40" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Agreement */}
            <div className="glass-card rounded-2xl p-6">
              <label className="flex items-start gap-4 cursor-pointer group relative z-10">
                <div className="mt-0.5">
                  <button type="button" onClick={() => set('agreement', !form.agreement)}
                    className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-300 ${
                      form.agreement
                        ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/25'
                        : 'border border-violet-500/15 group-hover:border-violet-500/30'
                    }`}>
                    {form.agreement && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                  </button>
                </div>
                <span className="text-sm text-white/30 leading-relaxed group-hover:text-white/40 transition-colors">
                  I confirm all information is accurate and I own the rights to submit this release for distribution through In Lights.
                </span>
              </label>
              <Err k="agreement" />
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ──────────────────── */}
      <div className="flex items-center justify-between mt-8 mb-4">
        {step > 1 ? (
          <button type="button" onClick={prev}
            className="btn-ghost flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold">
            <ChevronLeft className="w-4 h-4" /> <span>Back</span>
          </button>
        ) : <div />}

        {step < 6 ? (
          <button type="button" onClick={next}
            className="btn-primary flex items-center gap-2 px-7 py-3 rounded-xl text-sm">
            <span>Continue</span> <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={!form.agreement || submitting}
            className="btn-primary flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:shadow-none">
            <span>Submit Release</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Step Header ─────────────────────────
function StepHeader({ icon: Icon, title, desc }: { icon: typeof User; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 flex items-center justify-center border border-violet-500/15 neon-purple">
        <Icon className="w-5 h-5 text-violet-300" />
      </div>
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
          {title}
        </h2>
        <p className="text-sm text-violet-300/20 font-mono">{desc}</p>
      </div>
    </div>
  );
}
