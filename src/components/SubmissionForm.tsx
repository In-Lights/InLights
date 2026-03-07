import { useState } from 'react';
import { Music, User, Disc3, Upload, ChevronRight, ChevronLeft, Plus, Trash2, CheckCircle2, ExternalLink } from 'lucide-react';
import { Track, Collaborator, ReleaseType, RELEASE_TYPE_LIMITS, GENRES, ReleaseSubmission, AdminSettings } from '../types';
import { addSubmission } from '../store';

const emptyTrack = (): Track => ({
  title: '',
  previewStart: '0:00',
  previewEnd: '0:30',
  explicit: false,
  wavDriveLink: '',
  lyricsDriveLink: '',
  lyricsGoogleDocsLink: '',
  producedBy: '',
  lyricsBy: '',
  mixedBy: '',
  masteredBy: '',
});

const emptyCollab = (): Collaborator => ({
  name: '',
  role: 'artist',
  platformLinks: { spotify: '', appleMusic: '', anghami: '' },
});

interface Props {
  settings: AdminSettings;
  onSubmitted?: () => void;
}

export default function SubmissionForm({ settings, onSubmitted }: Props) {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState('');

  // Step 1: Artist Info
  const [mainArtist, setMainArtist] = useState('');
  const [collaborations, setCollaborations] = useState<Collaborator[]>([]);
  const [features, setFeatures] = useState<Collaborator[]>([]);

  // Step 2: Release Info + Cover Art
  const [releaseType, setReleaseType] = useState<ReleaseType>('single');
  const [releaseTitle, setReleaseTitle] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [explicitContent, setExplicitContent] = useState(false);
  const [genre, setGenre] = useState('');
  const [coverArtDriveLink, setCoverArtDriveLink] = useState('');

  // Step 3: Tracks
  const [tracks, setTracks] = useState<Track[]>([emptyTrack()]);

  // Step 4: Files & Links
  const [promoDriveLink, setPromoDriveLink] = useState('');
  const [driveFolderLink, setDriveFolderLink] = useState('');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);

  const limits = RELEASE_TYPE_LIMITS[releaseType];

  const updateTrack = (idx: number, updates: Partial<Track>) => {
    setTracks(prev => prev.map((t, i) => i === idx ? { ...t, ...updates } : t));
  };

  const addTrack = () => {
    if (tracks.length < limits.max) setTracks(prev => [...prev, emptyTrack()]);
  };

  const removeTrack = (idx: number) => {
    if (tracks.length > limits.min) setTracks(prev => prev.filter((_, i) => i !== idx));
  };

  const handleTypeChange = (type: ReleaseType) => {
    setReleaseType(type);
    const lim = RELEASE_TYPE_LIMITS[type];
    if (tracks.length < lim.min) {
      setTracks(prev => [...prev, ...Array(lim.min - prev.length).fill(null).map(() => emptyTrack())]);
    } else if (tracks.length > lim.max) {
      setTracks(prev => prev.slice(0, lim.max));
    }
  };

  // Validations per step
  const isStep1Valid = mainArtist.trim().length > 0;
  const isStep2Valid = releaseTitle.trim().length > 0 && releaseDate.length > 0 && genre.length > 0 && coverArtDriveLink.trim().length > 0;
  const isStep3Valid = tracks.length >= limits.min && tracks.every(t => t.title.trim() && t.wavDriveLink.trim());
  const isStep4Valid = rightsConfirmed;

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const data: Omit<ReleaseSubmission, 'id' | 'createdAt' | 'updatedAt' | 'status'> = {
        mainArtist,
        collaborations: collaborations.filter(c => c.name.trim()),
        features: features.filter(f => f.name.trim()),
        releaseType,
        releaseTitle,
        releaseDate,
        explicitContent,
        genre,
        coverArtDriveLink,
        tracks,
        promoDriveLink: promoDriveLink || undefined,
        driveFolderLink: driveFolderLink || undefined,
        rightsConfirmed,
      };
      const result = await addSubmission(data);
      setSubmissionId(result.id);
      setSubmitted(true);
      onSubmitted?.();
    } catch (err) {
      setSubmitError('Failed to submit. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-8 md:p-12 max-w-lg w-full text-center fade-in">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Release Submitted!</h2>
          <p className="text-zinc-400 mb-6">Your submission has been received and is under review.</p>
          <div className="bg-zinc-800/50 rounded-xl p-4 mb-6">
            <p className="text-sm text-zinc-500 mb-1">Submission ID</p>
            <p className="text-lg font-mono font-bold text-violet-400">{submissionId}</p>
          </div>
          <button
            onClick={() => { setSubmitted(false); setStep(0); setMainArtist(''); setCollaborations([]); setFeatures([]); setReleaseType('single'); setReleaseTitle(''); setReleaseDate(''); setExplicitContent(false); setGenre(''); setCoverArtDriveLink(''); setTracks([emptyTrack()]); setPromoDriveLink(''); setDriveFolderLink(''); setRightsConfirmed(false); }}
            className="btn-primary px-6 py-3 rounded-xl"
          >
            Submit Another Release
          </button>
        </div>
      </div>
    );
  }

  const steps = [
    { icon: User, label: 'Artist Info' },
    { icon: Disc3, label: 'Release Info' },
    { icon: Music, label: 'Tracklist' },
    { icon: Upload, label: 'Links & Submit' },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <img src={settings.companyLogo} alt={settings.companyName} className="h-10 w-10 object-contain rounded-lg" />
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
                  i === step ? 'bg-violet-600/20 text-violet-400 glow-border' :
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

        {/* Step 1: Artist Info */}
        {step === 0 && (
          <div className="fade-in space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-1">Artist Information</h2>
              <p className="text-zinc-500 text-sm">Tell us about the artist(s) on this release</p>
            </div>

            {/* Main Artist */}
            <div className="glass-card rounded-2xl p-6">
              <label className="block text-sm font-semibold mb-2">Main Artist <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={mainArtist}
                onChange={e => setMainArtist(e.target.value)}
                placeholder="Artist / Band name"
                className="input-dark w-full px-4 py-3 rounded-xl"
              />
            </div>

            {/* Collaborations */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">Collaborations</h3>
                  <p className="text-xs text-zinc-500">Other artists who collaborated on this release</p>
                </div>
                <button onClick={() => setCollaborations(prev => [...prev, emptyCollab()])} className="flex items-center gap-1 text-violet-400 text-sm hover:text-violet-300">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
              {collaborations.map((c, i) => (
                <div key={i} className="bg-zinc-900/50 rounded-xl p-4 mb-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={c.name}
                      onChange={e => { const u = [...collaborations]; u[i] = { ...u[i], name: e.target.value }; setCollaborations(u); }}
                      placeholder="Collaborator name"
                      className="input-dark flex-1 px-3 py-2 rounded-lg text-sm"
                    />
                    <button onClick={() => setCollaborations(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(['spotify', 'appleMusic', 'anghami'] as const).map(platform => (
                      <input
                        key={platform}
                        type="url"
                        value={c.platformLinks[platform] || ''}
                        onChange={e => { const u = [...collaborations]; u[i] = { ...u[i], platformLinks: { ...u[i].platformLinks, [platform]: e.target.value } }; setCollaborations(u); }}
                        placeholder={platform === 'appleMusic' ? 'Apple Music link' : platform === 'anghami' ? 'Anghami link' : 'Spotify link'}
                        className="input-dark px-3 py-2 rounded-lg text-xs"
                      />
                    ))}
                  </div>
                </div>
              ))}
              {collaborations.length === 0 && <p className="text-zinc-600 text-sm italic">No collaborations added</p>}
            </div>

            {/* Features */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">Features</h3>
                  <p className="text-xs text-zinc-500">Featured artists on specific tracks</p>
                </div>
                <button onClick={() => setFeatures(prev => [...prev, emptyCollab()])} className="flex items-center gap-1 text-violet-400 text-sm hover:text-violet-300">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
              {features.map((f, i) => (
                <div key={i} className="bg-zinc-900/50 rounded-xl p-4 mb-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={f.name}
                      onChange={e => { const u = [...features]; u[i] = { ...u[i], name: e.target.value }; setFeatures(u); }}
                      placeholder="Featured artist name"
                      className="input-dark flex-1 px-3 py-2 rounded-lg text-sm"
                    />
                    <button onClick={() => setFeatures(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(['spotify', 'appleMusic', 'anghami'] as const).map(platform => (
                      <input
                        key={platform}
                        type="url"
                        value={f.platformLinks[platform] || ''}
                        onChange={e => { const u = [...features]; u[i] = { ...u[i], platformLinks: { ...u[i].platformLinks, [platform]: e.target.value } }; setFeatures(u); }}
                        placeholder={platform === 'appleMusic' ? 'Apple Music link' : platform === 'anghami' ? 'Anghami link' : 'Spotify link'}
                        className="input-dark px-3 py-2 rounded-lg text-xs"
                      />
                    ))}
                  </div>
                </div>
              ))}
              {features.length === 0 && <p className="text-zinc-600 text-sm italic">No features added</p>}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setStep(1)}
                disabled={!isStep1Valid}
                className="btn-primary px-6 py-3 rounded-xl flex items-center gap-2"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Release Info + Cover Art */}
        {step === 1 && (
          <div className="fade-in space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-1">Release Information</h2>
              <p className="text-zinc-500 text-sm">Details about your release and cover art</p>
            </div>

            <div className="glass-card rounded-2xl p-6 space-y-6">
              {/* Release Type */}
              <div>
                <label className="block text-sm font-semibold mb-3">Release Type <span className="text-red-400">*</span></label>
                <div className="grid grid-cols-3 gap-3">
                  {(['single', 'ep', 'album'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => handleTypeChange(type)}
                      className={`p-4 rounded-xl border text-center transition-all ${
                        releaseType === type
                          ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                          : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      <div className="text-lg font-bold uppercase">{type}</div>
                      <div className="text-xs mt-1">
                        {type === 'single' ? '1 track' : type === 'ep' ? '3-6 tracks' : 'Up to 32 tracks'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold mb-2">Release Title <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={releaseTitle}
                  onChange={e => setReleaseTitle(e.target.value)}
                  placeholder="Title of the release"
                  className="input-dark w-full px-4 py-3 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Release Date */}
                <div>
                  <label className="block text-sm font-semibold mb-2">Release Date <span className="text-red-400">*</span></label>
                  <input
                    type="date"
                    value={releaseDate}
                    onChange={e => setReleaseDate(e.target.value)}
                    className="input-dark w-full px-4 py-3 rounded-xl"
                  />
                </div>

                {/* Genre */}
                <div>
                  <label className="block text-sm font-semibold mb-2">Genre <span className="text-red-400">*</span></label>
                  <select
                    value={genre}
                    onChange={e => setGenre(e.target.value)}
                    className="input-dark w-full px-4 py-3 rounded-xl"
                  >
                    <option value="">Select genre</option>
                    {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              {/* Explicit */}
              <div>
                <label className="block text-sm font-semibold mb-3">Explicit Content</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setExplicitContent(false)}
                    className={`px-5 py-2 rounded-lg border text-sm font-medium transition-all ${!explicitContent ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-zinc-800 text-zinc-500'}`}
                  >No</button>
                  <button
                    onClick={() => setExplicitContent(true)}
                    className={`px-5 py-2 rounded-lg border text-sm font-medium transition-all ${explicitContent ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-zinc-800 text-zinc-500'}`}
                  >Yes</button>
                </div>
              </div>
            </div>

            {/* Cover Art */}
            <div className="glass-card rounded-2xl p-6">
              <label className="block text-sm font-semibold mb-2">Cover Art — Google Drive Link <span className="text-red-400">*</span></label>
              <p className="text-xs text-zinc-500 mb-3">Upload your cover art (JPG 3000×3000) to Google Drive and paste the share link</p>
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                <input
                  type="url"
                  value={coverArtDriveLink}
                  onChange={e => setCoverArtDriveLink(e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                  className="input-dark w-full px-4 py-3 rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(0)} className="px-6 py-3 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white transition-all flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!isStep2Valid}
                className="btn-primary px-6 py-3 rounded-xl flex items-center gap-2"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Tracklist */}
        {step === 2 && (
          <div className="fade-in space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-1">Tracklist</h2>
                <p className="text-zinc-500 text-sm">
                  {limits.label} — {tracks.length}/{limits.max} tracks (min {limits.min})
                </p>
              </div>
              {tracks.length < limits.max && (
                <button onClick={addTrack} className="btn-primary px-4 py-2 rounded-lg flex items-center gap-1 text-sm">
                  <Plus className="w-4 h-4" /> Add Track
                </button>
              )}
            </div>

            {tracks.map((track, idx) => (
              <div key={idx} className="glass-card rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-violet-400">Track {idx + 1}</h3>
                  {tracks.length > limits.min && (
                    <button onClick={() => removeTrack(idx)} className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  )}
                </div>

                {/* Title + Explicit */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Track Title <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={track.title}
                      onChange={e => updateTrack(idx, { title: e.target.value })}
                      placeholder="Track title"
                      className="input-dark w-full px-3 py-2.5 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Explicit</label>
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => updateTrack(idx, { explicit: false })}
                        className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium ${!track.explicit ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-zinc-800 text-zinc-500'}`}
                      >No</button>
                      <button
                        onClick={() => updateTrack(idx, { explicit: true })}
                        className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium ${track.explicit ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-zinc-800 text-zinc-500'}`}
                      >Yes</button>
                    </div>
                  </div>
                </div>

                {/* TikTok Preview Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Preview/TikTok Start</label>
                    <input
                      type="text"
                      value={track.previewStart}
                      onChange={e => updateTrack(idx, { previewStart: e.target.value })}
                      placeholder="0:00"
                      className="input-dark w-full px-3 py-2.5 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Preview/TikTok End</label>
                    <input
                      type="text"
                      value={track.previewEnd}
                      onChange={e => updateTrack(idx, { previewEnd: e.target.value })}
                      placeholder="0:30"
                      className="input-dark w-full px-3 py-2.5 rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* WAV Drive Link */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">WAV File — Google Drive Link <span className="text-red-400">*</span></label>
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                    <input
                      type="url"
                      value={track.wavDriveLink}
                      onChange={e => updateTrack(idx, { wavDriveLink: e.target.value })}
                      placeholder="https://drive.google.com/file/d/..."
                      className="input-dark w-full px-3 py-2.5 rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Lyrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Lyrics — Google Drive Link</label>
                    <input
                      type="url"
                      value={track.lyricsDriveLink || ''}
                      onChange={e => updateTrack(idx, { lyricsDriveLink: e.target.value })}
                      placeholder="Drive link to lyrics file"
                      className="input-dark w-full px-3 py-2.5 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Lyrics — Google Docs Link</label>
                    <input
                      type="url"
                      value={track.lyricsGoogleDocsLink || ''}
                      onChange={e => updateTrack(idx, { lyricsGoogleDocsLink: e.target.value })}
                      placeholder="Google Docs link"
                      className="input-dark w-full px-3 py-2.5 rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Credits */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-2">Credits</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={track.producedBy}
                      onChange={e => updateTrack(idx, { producedBy: e.target.value })}
                      placeholder="Produced by"
                      className="input-dark px-3 py-2.5 rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      value={track.lyricsBy}
                      onChange={e => updateTrack(idx, { lyricsBy: e.target.value })}
                      placeholder="Lyrics by"
                      className="input-dark px-3 py-2.5 rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      value={track.mixedBy}
                      onChange={e => updateTrack(idx, { mixedBy: e.target.value })}
                      placeholder="Mixed by"
                      className="input-dark px-3 py-2.5 rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      value={track.masteredBy}
                      onChange={e => updateTrack(idx, { masteredBy: e.target.value })}
                      placeholder="Mastered by"
                      className="input-dark px-3 py-2.5 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="px-6 py-3 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white transition-all flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!isStep3Valid}
                className="btn-primary px-6 py-3 rounded-xl flex items-center gap-2"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Links & Submit */}
        {step === 3 && (
          <div className="fade-in space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-1">Additional Links & Submit</h2>
              <p className="text-zinc-500 text-sm">Optional promo materials and final confirmation</p>
            </div>

            <div className="glass-card rounded-2xl p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2">Promo Pictures / Videos — Drive Link</label>
                <p className="text-xs text-zinc-500 mb-2">Share a Google Drive folder with promo materials</p>
                <input
                  type="url"
                  value={promoDriveLink}
                  onChange={e => setPromoDriveLink(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="input-dark w-full px-4 py-3 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Main Drive Folder Link</label>
                <p className="text-xs text-zinc-500 mb-2">Optional: link to a shared Drive folder with all release assets</p>
                <input
                  type="url"
                  value={driveFolderLink}
                  onChange={e => setDriveFolderLink(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="input-dark w-full px-4 py-3 rounded-xl"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-bold mb-4">Submission Summary</h3>
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                <span className="text-zinc-500">Main Artist</span>
                <span className="font-medium">{mainArtist}</span>
                <span className="text-zinc-500">Release</span>
                <span className="font-medium">{releaseTitle} ({releaseType.toUpperCase()})</span>
                <span className="text-zinc-500">Genre</span>
                <span className="font-medium">{genre}</span>
                <span className="text-zinc-500">Release Date</span>
                <span className="font-medium">{releaseDate}</span>
                <span className="text-zinc-500">Tracks</span>
                <span className="font-medium">{tracks.length}</span>
                <span className="text-zinc-500">Explicit</span>
                <span className="font-medium">{explicitContent ? 'Yes' : 'No'}</span>
              </div>
            </div>

            {/* Agreement */}
            <label className="flex items-start gap-3 glass-card rounded-2xl p-6 cursor-pointer">
              <input
                type="checkbox"
                checked={rightsConfirmed}
                onChange={e => setRightsConfirmed(e.target.checked)}
                className="mt-1 w-5 h-5 accent-violet-600"
              />
              <span className="text-sm text-zinc-300">
                I confirm all information is accurate and I own the rights to submit this release. I understand that submitting false or unauthorized content may result in removal and legal action.
              </span>
            </label>

            {submitError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
                {submitError}
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="px-6 py-3 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white transition-all flex items-center gap-2" disabled={submitting}>
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!isStep4Valid || submitting}
                className="btn-primary px-8 py-3 rounded-xl flex items-center gap-2 text-lg disabled:opacity-60"
              >
                {submitting ? (
                  <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</>
                ) : (
                  <><CheckCircle2 className="w-5 h-5" /> Submit Release</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
