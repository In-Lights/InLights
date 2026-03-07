import { useState } from 'react';
import { ArrowLeft, ExternalLink, Music, Save, Pencil, X, Plus, Trash2, Check, Loader2, ZoomIn, Flag, CheckSquare, Square } from 'lucide-react';
import { ReleaseSubmission, ReleaseStatus, ReleaseType, Track, Collaborator, RELEASE_TYPE_LIMITS, GENRES, ReleasePriority, ChecklistItem } from '../types';
import { updateSubmission } from '../store';
import { StatusBadge, ReleaseTypeBadge } from './ui/Badge';
import Lightbox from './Lightbox';
import AudioPlayer from './AudioPlayer';

interface Props {
  release: ReleaseSubmission;
  onBack: () => void;
}

const emptyTrack = (): Track => ({
  title: '', previewStart: '0:00', previewEnd: '0:30', explicit: false,
  wavDriveLink: '', lyricsDriveLink: '', lyricsGoogleDocsLink: '',
  producedBy: '', lyricsBy: '', mixedBy: '', masteredBy: '',
});

const emptyCollab = (): Collaborator => ({
  name: '', role: 'artist', platformLinks: { spotify: '', appleMusic: '', anghami: '' },
});


// Extract Drive file ID and return thumbnail URL
function driveThumbnail(url: string, size = 300): string | null {
  const m = url?.match(/\/file\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/);
  const id = m?.[1] || m?.[2];
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${size}` : null;
}

// Best available artwork: direct image URL → Drive thumbnail → null
function artworkSrc(imageUrl: string, driveLink: string): string | null {
  if (imageUrl) return imageUrl;
  return driveThumbnail(driveLink);
}

// "Artist1, Artist2" — main + collabs
function formatArtists(mainArtist: string, collaborations: { name: string }[]): string {
  return [mainArtist, ...collaborations.map(c => c.name).filter(Boolean)].join(', ');
}

// "Track Title (feat. X, Y)"
function formatDisplayTitle(
  releaseTitle: string,
  releaseType: string,
  tracks: { title: string }[],
  features: { name: string }[]
): string {
  const featureNames = features.map(f => f.name).filter(Boolean);
  const featSuffix = featureNames.length > 0 ? ` (feat. ${featureNames.join(', ')})` : '';
  if (releaseType === 'single' && tracks.length === 1 && tracks[0]?.title) {
    return `${tracks[0].title}${featSuffix}`;
  }
  return `${releaseTitle}${featSuffix}`;
}

export default function ReleaseDetail({ release: initialRelease, onBack }: Props) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  // Editable state — clone the release
  const [status, setStatus] = useState<ReleaseStatus>(initialRelease.status);
  const [notes, setNotes] = useState(initialRelease.labelNotes || '');
  const [mainArtist, setMainArtist] = useState(initialRelease.mainArtist);
  const [releaseTitle, setReleaseTitle] = useState(initialRelease.releaseTitle);
  const [releaseType, setReleaseType] = useState<ReleaseType>(initialRelease.releaseType);
  const [releaseDate, setReleaseDate] = useState(initialRelease.releaseDate);
  const [genre, setGenre] = useState(initialRelease.genre);
  const [explicitContent, setExplicitContent] = useState(initialRelease.explicitContent);
  const [coverArtDriveLink, setCoverArtDriveLink] = useState(initialRelease.coverArtDriveLink);
  const [promoDriveLink, setPromoDriveLink] = useState(initialRelease.promoDriveLink || '');
  const [driveFolderLink, setDriveFolderLink] = useState(initialRelease.driveFolderLink || '');
  const [collaborations, setCollaborations] = useState<Collaborator[]>([...initialRelease.collaborations]);
  const [features, setFeatures] = useState<Collaborator[]>([...initialRelease.features]);
  const [tracks, setTracks] = useState<Track[]>([...initialRelease.tracks]);
  const [upc, setUpc] = useState(initialRelease.upc || '');
  const [priority, setPriority] = useState<ReleasePriority>(initialRelease.priority || 'normal');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialRelease.checklist || [
    { id: '1', label: 'Cover art approved (3000×3000px)', done: false },
    { id: '2', label: 'WAV files received', done: false },
    { id: '3', label: 'Credits verified', done: false },
    { id: '4', label: 'Metadata complete', done: false },
    { id: '5', label: 'Rights confirmed', done: initialRelease.rightsConfirmed },
    { id: '6', label: 'Distributed to platforms', done: false },
  ]);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await updateSubmission(initialRelease.id, {
        status,
        labelNotes: notes,
        mainArtist,
        releaseTitle,
        releaseType,
        releaseDate,
        genre,
        explicitContent,
        coverArtDriveLink,
        coverArtImageUrl: '',
        promoDriveLink: promoDriveLink || undefined,
        driveFolderLink: driveFolderLink || undefined,
        collaborations: collaborations.filter(c => c.name.trim()),
        features: features.filter(f => f.name.trim()),
        tracks,
        upc: upc || undefined,
        priority,
        checklist,
      });
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setStatus(initialRelease.status);
    setNotes(initialRelease.labelNotes || '');
    setMainArtist(initialRelease.mainArtist);
    setReleaseTitle(initialRelease.releaseTitle);
    setReleaseType(initialRelease.releaseType);
    setReleaseDate(initialRelease.releaseDate);
    setGenre(initialRelease.genre);
    setExplicitContent(initialRelease.explicitContent);
    setCoverArtDriveLink(initialRelease.coverArtDriveLink);
    setPromoDriveLink(initialRelease.promoDriveLink || '');
    setDriveFolderLink(initialRelease.driveFolderLink || '');
    setCollaborations([...initialRelease.collaborations]);
    setFeatures([...initialRelease.features]);
    setTracks([...initialRelease.tracks]);
    setUpc(initialRelease.upc || '');
    setPriority(initialRelease.priority || 'normal');
    setEditing(false);
  };

  const updateTrack = (idx: number, updates: Partial<Track>) => {
    setTracks(prev => prev.map((t, i) => i === idx ? { ...t, ...updates } : t));
  };

  const addTrack = () => {
    const lim = RELEASE_TYPE_LIMITS[releaseType];
    if (tracks.length < lim.max) setTracks(prev => [...prev, emptyTrack()]);
  };

  const removeTrack = (idx: number) => {
    const lim = RELEASE_TYPE_LIMITS[releaseType];
    if (tracks.length > lim.min) setTracks(prev => prev.filter((_, i) => i !== idx));
  };

  const renderLink = (url: string | undefined, label: string) => {
    if (!url) return null;
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-violet-400 hover:text-violet-300 text-sm">
        <ExternalLink className="w-3 h-3" /> {label}
      </a>
    );
  };

  const limits = RELEASE_TYPE_LIMITS[releaseType];

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-all">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <div className="flex items-center gap-3">
          {!editing ? (
            <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600/20 text-violet-400 hover:bg-violet-600/30 transition-all text-sm font-medium">
              <Pencil className="w-4 h-4" /> Edit Release
            </button>
          ) : (
            <>
              <button onClick={handleCancel} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white transition-all text-sm">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm disabled:opacity-60">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Check className="w-4 h-4" /> Save All Changes</>}
              </button>
            </>
          )}
          {saved && <span className="text-emerald-400 text-sm font-medium">✓ Saved!</span>}
        </div>
      </div>

      {/* Title Card */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-start gap-4">
          {/* Artwork — clickable for lightbox */}
          <div
            className="w-20 h-20 rounded-xl flex-shrink-0 overflow-hidden bg-zinc-900 border border-white/10 relative group cursor-pointer"
            onClick={() => { if (artworkSrc(initialRelease.coverArtImageUrl, coverArtDriveLink)) setLightboxOpen(true); }}
          >
            {artworkSrc(initialRelease.coverArtImageUrl, coverArtDriveLink) ? (
              <>
                <img src={artworkSrc(initialRelease.coverArtImageUrl, coverArtDriveLink)!} alt="Cover art"
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <ZoomIn className="w-5 h-5 text-white" />
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music className="w-8 h-8 text-zinc-600" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-3">
                <input type="text" value={releaseTitle} onChange={e => setReleaseTitle(e.target.value)} className="input-dark w-full px-3 py-2 rounded-lg text-lg font-bold" placeholder="Release Title" />
                <input type="text" value={mainArtist} onChange={e => setMainArtist(e.target.value)} className="input-dark w-full px-3 py-2 rounded-lg text-sm" placeholder="Main Artist" />
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold truncate">
                  {formatDisplayTitle(releaseTitle, releaseType, tracks, features)}
                </h2>
                <p className="text-zinc-400 truncate">
                  {formatArtists(mainArtist, collaborations)}
                </p>
              </>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              <StatusBadge status={status} />
              <ReleaseTypeBadge type={releaseType} />
              {priority !== 'normal' && (
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${
                  priority === 'urgent' ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                }`}>
                  <Flag className="w-2.5 h-2.5" />
                  {priority === 'urgent' ? 'URGENT' : 'LOW'}
                </span>
              )}
              <span className="text-xs text-zinc-500">ID: <span className="font-mono text-zinc-400">{initialRelease.id}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && artworkSrc(initialRelease.coverArtImageUrl, coverArtDriveLink) && (
        <Lightbox
          src={artworkSrc(initialRelease.coverArtImageUrl, coverArtDriveLink)!}
          alt={`${formatDisplayTitle(releaseTitle, releaseType, tracks, features)} — Cover Art`}
          driveLink={coverArtDriveLink}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* Release Info */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-bold mb-4">Release Info</h3>
            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Release Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['single', 'ep', 'album'] as const).map(type => (
                      <button key={type} onClick={() => setReleaseType(type)}
                        className={`p-3 rounded-xl border text-center text-sm font-medium transition-all ${releaseType === type ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}>
                        {type.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Release Date</label>
                    <input type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)} className="input-dark w-full px-3 py-2 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Genre</label>
                    <select value={genre} onChange={e => setGenre(e.target.value)} className="input-dark w-full px-3 py-2 rounded-lg text-sm">
                      {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Explicit Content</label>
                  <div className="flex gap-2">
                    <button onClick={() => setExplicitContent(false)} className={`px-4 py-2 rounded-lg border text-xs font-medium ${!explicitContent ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-zinc-800 text-zinc-500'}`}>No</button>
                    <button onClick={() => setExplicitContent(true)} className={`px-4 py-2 rounded-lg border text-xs font-medium ${explicitContent ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-zinc-800 text-zinc-500'}`}>Yes</button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Cover Art — Google Drive Link</label>
                  <input type="url" value={coverArtDriveLink} onChange={e => setCoverArtDriveLink(e.target.value)} className="input-dark w-full px-3 py-2 rounded-lg text-sm" placeholder="https://drive.google.com/..." />
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Cover Art Preview</p>
                  {artworkSrc(initialRelease.coverArtImageUrl, coverArtDriveLink) && (
                    <img src={artworkSrc(initialRelease.coverArtImageUrl, coverArtDriveLink)!} alt="Preview" className="w-20 h-20 rounded-lg object-cover border border-white/10 bg-zinc-900"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-zinc-500">Release Date</span><p className="font-medium">{releaseDate}</p></div>
                <div><span className="text-zinc-500">Genre</span><p className="font-medium">{genre}</p></div>
                <div><span className="text-zinc-500">Explicit</span><p className="font-medium">{explicitContent ? 'Yes' : 'No'}</p></div>
                <div><span className="text-zinc-500">Cover Art</span><div className="mt-1">{renderLink(coverArtDriveLink, 'View Cover Art')}</div></div>
              </div>
            )}
          </div>

          {/* Artist Info */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-bold mb-4">Artist Info</h3>
            {editing ? (
              <div className="space-y-4">
                {/* Collaborations */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-500">Collaborations</span>
                    <button onClick={() => setCollaborations(prev => [...prev, emptyCollab()])} className="text-violet-400 text-xs flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
                  </div>
                  {collaborations.map((c, i) => (
                    <div key={i} className="bg-zinc-900/50 rounded-lg p-3 mb-2 space-y-2">
                      <div className="flex gap-2">
                        <input type="text" value={c.name} onChange={e => { const u = [...collaborations]; u[i] = { ...u[i], name: e.target.value }; setCollaborations(u); }} placeholder="Name" className="input-dark flex-1 px-3 py-2 rounded-lg text-sm" />
                        <button onClick={() => setCollaborations(prev => prev.filter((_, j) => j !== i))} className="text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input type="url" value={c.platformLinks.spotify || ''} onChange={e => { const u = [...collaborations]; u[i] = { ...u[i], platformLinks: { ...u[i].platformLinks, spotify: e.target.value } }; setCollaborations(u); }} placeholder="Spotify" className="input-dark px-2 py-1.5 rounded-lg text-xs" />
                        <input type="url" value={c.platformLinks.appleMusic || ''} onChange={e => { const u = [...collaborations]; u[i] = { ...u[i], platformLinks: { ...u[i].platformLinks, appleMusic: e.target.value } }; setCollaborations(u); }} placeholder="Apple Music" className="input-dark px-2 py-1.5 rounded-lg text-xs" />
                        <input type="url" value={c.platformLinks.anghami || ''} onChange={e => { const u = [...collaborations]; u[i] = { ...u[i], platformLinks: { ...u[i].platformLinks, anghami: e.target.value } }; setCollaborations(u); }} placeholder="Anghami" className="input-dark px-2 py-1.5 rounded-lg text-xs" />
                      </div>
                    </div>
                  ))}
                  {collaborations.length === 0 && <p className="text-zinc-600 text-xs italic">None</p>}
                </div>

                {/* Features */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-500">Features</span>
                    <button onClick={() => setFeatures(prev => [...prev, emptyCollab()])} className="text-violet-400 text-xs flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
                  </div>
                  {features.map((f, i) => (
                    <div key={i} className="bg-zinc-900/50 rounded-lg p-3 mb-2 space-y-2">
                      <div className="flex gap-2">
                        <input type="text" value={f.name} onChange={e => { const u = [...features]; u[i] = { ...u[i], name: e.target.value }; setFeatures(u); }} placeholder="Name" className="input-dark flex-1 px-3 py-2 rounded-lg text-sm" />
                        <button onClick={() => setFeatures(prev => prev.filter((_, j) => j !== i))} className="text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input type="url" value={f.platformLinks.spotify || ''} onChange={e => { const u = [...features]; u[i] = { ...u[i], platformLinks: { ...u[i].platformLinks, spotify: e.target.value } }; setFeatures(u); }} placeholder="Spotify" className="input-dark px-2 py-1.5 rounded-lg text-xs" />
                        <input type="url" value={f.platformLinks.appleMusic || ''} onChange={e => { const u = [...features]; u[i] = { ...u[i], platformLinks: { ...u[i].platformLinks, appleMusic: e.target.value } }; setFeatures(u); }} placeholder="Apple Music" className="input-dark px-2 py-1.5 rounded-lg text-xs" />
                        <input type="url" value={f.platformLinks.anghami || ''} onChange={e => { const u = [...features]; u[i] = { ...u[i], platformLinks: { ...u[i].platformLinks, anghami: e.target.value } }; setFeatures(u); }} placeholder="Anghami" className="input-dark px-2 py-1.5 rounded-lg text-xs" />
                      </div>
                    </div>
                  ))}
                  {features.length === 0 && <p className="text-zinc-600 text-xs italic">None</p>}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-zinc-500">Main Artist</span>
                  <p className="font-medium">{mainArtist}</p>
                </div>
                {collaborations.length > 0 && (
                  <div>
                    <span className="text-xs text-zinc-500">Collaborations</span>
                    {collaborations.map((c, i) => (
                      <div key={i} className="bg-zinc-900/50 rounded-lg p-3 mt-2">
                        <p className="font-medium text-sm">{c.name}</p>
                        <div className="flex flex-wrap gap-3 mt-1">
                          {renderLink(c.platformLinks.spotify, 'Spotify')}
                          {renderLink(c.platformLinks.appleMusic, 'Apple Music')}
                          {renderLink(c.platformLinks.anghami, 'Anghami')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {features.length > 0 && (
                  <div>
                    <span className="text-xs text-zinc-500">Features</span>
                    {features.map((f, i) => (
                      <div key={i} className="bg-zinc-900/50 rounded-lg p-3 mt-2">
                        <p className="font-medium text-sm">{f.name}</p>
                        <div className="flex flex-wrap gap-3 mt-1">
                          {renderLink(f.platformLinks.spotify, 'Spotify')}
                          {renderLink(f.platformLinks.appleMusic, 'Apple Music')}
                          {renderLink(f.platformLinks.anghami, 'Anghami')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tracklist */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">Tracklist ({tracks.length} tracks)</h3>
              {editing && tracks.length < limits.max && (
                <button onClick={addTrack} className="text-violet-400 text-xs flex items-center gap-1"><Plus className="w-3 h-3" /> Add Track</button>
              )}
            </div>
            <div className="space-y-3">
              {tracks.map((track, i) => (
                <div key={i} className="bg-zinc-900/50 rounded-xl p-4">
                  {editing ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-zinc-600">Track {i + 1}</span>
                        {tracks.length > limits.min && (
                          <button onClick={() => removeTrack(i)} className="text-red-400 text-xs flex items-center gap-1"><Trash2 className="w-3 h-3" /> Remove</button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <input type="text" value={track.title} onChange={e => updateTrack(i, { title: e.target.value })} placeholder="Track title" className="input-dark w-full px-3 py-2 rounded-lg text-sm" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => updateTrack(i, { explicit: false })} className={`flex-1 px-2 py-2 rounded-lg border text-xs ${!track.explicit ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-zinc-800 text-zinc-500'}`}>Clean</button>
                          <button onClick={() => updateTrack(i, { explicit: true })} className={`flex-1 px-2 py-2 rounded-lg border text-xs ${track.explicit ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-zinc-800 text-zinc-500'}`}>Explicit</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-zinc-600 mb-1">TikTok Preview Start</label>
                          <input type="text" value={track.previewStart} onChange={e => updateTrack(i, { previewStart: e.target.value })} className="input-dark w-full px-3 py-2 rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-600 mb-1">TikTok Preview End</label>
                          <input type="text" value={track.previewEnd} onChange={e => updateTrack(i, { previewEnd: e.target.value })} className="input-dark w-full px-3 py-2 rounded-lg text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-600 mb-1">WAV — Google Drive Link</label>
                        <input type="url" value={track.wavDriveLink} onChange={e => updateTrack(i, { wavDriveLink: e.target.value })} className="input-dark w-full px-3 py-2 rounded-lg text-sm" placeholder="https://drive.google.com/..." />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-zinc-600 mb-1">Lyrics Drive Link</label>
                          <input type="url" value={track.lyricsDriveLink || ''} onChange={e => updateTrack(i, { lyricsDriveLink: e.target.value })} className="input-dark w-full px-3 py-2 rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-600 mb-1">Lyrics Google Docs</label>
                          <input type="url" value={track.lyricsGoogleDocsLink || ''} onChange={e => updateTrack(i, { lyricsGoogleDocsLink: e.target.value })} className="input-dark w-full px-3 py-2 rounded-lg text-sm" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input type="text" value={track.producedBy} onChange={e => updateTrack(i, { producedBy: e.target.value })} placeholder="Produced by" className="input-dark px-3 py-2 rounded-lg text-sm" />
                        <input type="text" value={track.lyricsBy} onChange={e => updateTrack(i, { lyricsBy: e.target.value })} placeholder="Lyrics by" className="input-dark px-3 py-2 rounded-lg text-sm" />
                        <input type="text" value={track.mixedBy} onChange={e => updateTrack(i, { mixedBy: e.target.value })} placeholder="Mixed by" className="input-dark px-3 py-2 rounded-lg text-sm" />
                        <input type="text" value={track.masteredBy} onChange={e => updateTrack(i, { masteredBy: e.target.value })} placeholder="Mastered by" className="input-dark px-3 py-2 rounded-lg text-sm" />
                        <input type="text" value={track.isrc || ''} onChange={e => updateTrack(i, { isrc: e.target.value.toUpperCase() })} placeholder="ISRC code" className="input-dark col-span-2 px-3 py-2 rounded-lg text-sm font-mono" />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-zinc-600 w-6">{String(i + 1).padStart(2, '0')}</span>
                          <div>
                            <span className="font-medium text-sm">
                              {track.title}
                              {features.filter(f => f.name.trim()).length > 0 && (
                                <span className="text-zinc-500 font-normal"> (feat. {features.filter(f => f.name.trim()).map(f => f.name).join(', ')})</span>
                              )}
                            </span>
                          </div>
                          {track.explicit && <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded font-bold">E</span>}
                        </div>
                        <span className="text-xs text-zinc-500">{track.previewStart} – {track.previewEnd}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500 mt-2">
                        {track.producedBy && <span>Produced: {track.producedBy}</span>}
                        {track.lyricsBy && <span>Lyrics: {track.lyricsBy}</span>}
                        {track.mixedBy && <span>Mixed: {track.mixedBy}</span>}
                        {track.masteredBy && <span>Mastered: {track.masteredBy}</span>}
                        {track.isrc && <span className="col-span-2 font-mono text-zinc-400">ISRC: {track.isrc}</span>}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-2">
                        {renderLink(track.wavDriveLink, 'WAV File')}
                        {renderLink(track.lyricsDriveLink, 'Lyrics File')}
                        {renderLink(track.lyricsGoogleDocsLink, 'Lyrics Doc')}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Files & Links */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-bold mb-4">Files & Links</h3>
            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Promo Materials — Drive Link</label>
                  <input type="url" value={promoDriveLink} onChange={e => setPromoDriveLink(e.target.value)} className="input-dark w-full px-3 py-2 rounded-lg text-sm" placeholder="https://drive.google.com/..." />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Main Drive Folder Link</label>
                  <input type="url" value={driveFolderLink} onChange={e => setDriveFolderLink(e.target.value)} className="input-dark w-full px-3 py-2 rounded-lg text-sm" placeholder="https://drive.google.com/..." />
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-4">
                {renderLink(coverArtDriveLink, 'Cover Art (3000×3000)')}
                {renderLink(promoDriveLink, 'Promo Materials')}
                {renderLink(driveFolderLink, 'Drive Folder')}
                {!coverArtDriveLink && !promoDriveLink && !driveFolderLink && (
                  <p className="text-zinc-600 text-sm italic">No additional links</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Admin Sidebar */}
        <div className="space-y-6">
          {/* Audio Player */}
          <AudioPlayer tracks={tracks} releaseTitle={formatDisplayTitle(releaseTitle, releaseType, tracks, features)} />
          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-bold mb-4">Admin Controls</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Priority</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([['urgent','🔴','Urgent'],['normal','⚪','Normal'],['low','🔵','Low']] as const).map(([val, icon, lbl]) => (
                    <button key={val} onClick={() => setPriority(val)}
                      className={`py-1.5 rounded-lg border text-xs font-medium transition-all ${priority === val
                        ? val === 'urgent' ? 'border-red-500 bg-red-500/15 text-red-400'
                          : val === 'low' ? 'border-blue-500 bg-blue-500/15 text-blue-400'
                          : 'border-zinc-600 bg-zinc-700 text-white'
                        : 'border-zinc-800 text-zinc-600 hover:border-zinc-600'}`}>
                      {icon} {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">UPC / EAN Barcode</label>
                <input
                  type="text"
                  value={upc}
                  onChange={e => setUpc(e.target.value)}
                  placeholder="e.g. 012345678905"
                  className="input-dark w-full px-3 py-2 rounded-lg text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as ReleaseStatus)}
                  className="input-dark w-full px-3 py-2.5 rounded-lg text-sm"
                >
                  <option value="pending">⏳ Pending</option>
                  <option value="approved">✅ Approved</option>
                  <option value="scheduled">📅 Scheduled</option>
                  <option value="released">🎵 Released</option>
                  <option value="rejected">❌ Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Label Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Internal notes about this release..."
                  className="input-dark w-full px-3 py-2.5 rounded-lg text-sm resize-none"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary w-full py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm disabled:opacity-60"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" />{saved ? '✓ Saved!' : 'Save Changes'}</>}
              </button>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-bold mb-3 text-sm">Quick Info</h3>            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Type</span>
                <span className="uppercase font-medium">{releaseType}</span>
              </div>
              {upc && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">UPC</span>
                  <span className="font-mono text-xs font-medium">{upc}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-zinc-500">Tracks</span>
                <span className="font-medium">{tracks.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Genre</span>
                <span className="font-medium">{genre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Release</span>
                <span className="font-medium">{releaseDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Rights</span>
                <span className={`font-medium ${initialRelease.rightsConfirmed ? 'text-emerald-400' : 'text-red-400'}`}>
                  {initialRelease.rightsConfirmed ? 'Confirmed' : 'Not confirmed'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Submitted</span>
                <span className="font-medium text-xs">{new Date(initialRelease.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Updated</span>
                <span className="font-medium text-xs">{new Date(initialRelease.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Release Checklist */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">Release Checklist</h3>
              <span className="text-xs text-zinc-500">
                {checklist.filter(i => i.done).length}/{checklist.length}
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 bg-zinc-800 rounded-full mb-4 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: checklist.length ? `${(checklist.filter(i => i.done).length / checklist.length) * 100}%` : '0%',
                  background: 'var(--accent)',
                }}
              />
            </div>
            <div className="space-y-2">
              {checklist.map(item => (
                <button
                  key={item.id}
                  onClick={async () => {
                    const updated = checklist.map(i => i.id === item.id ? { ...i, done: !i.done } : i);
                    setChecklist(updated);
                    try { await updateSubmission(initialRelease.id, { checklist: updated }); } catch {}
                  }}
                  className="w-full flex items-center gap-2.5 text-left group"
                >
                  {item.done
                    ? <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    : <Square className="w-4 h-4 text-zinc-600 flex-shrink-0 group-hover:text-zinc-400 transition-colors" />
                  }
                  <span className={`text-xs transition-colors ${item.done ? 'line-through text-zinc-600' : 'text-zinc-300 group-hover:text-white'}`}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
            {/* Add custom item */}
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={newCheckItem}
                onChange={e => setNewCheckItem(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && newCheckItem.trim()) {
                    const newItem: ChecklistItem = { id: Date.now().toString(), label: newCheckItem.trim(), done: false };
                    const updated = [...checklist, newItem];
                    setChecklist(updated);
                    setNewCheckItem('');
                    try { await updateSubmission(initialRelease.id, { checklist: updated }); } catch {}
                  }
                }}
                placeholder="Add task… (Enter)"
                className="input-dark flex-1 px-3 py-1.5 rounded-lg text-xs"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
