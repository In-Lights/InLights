import { useState } from 'react';
import { X, Plus, Trash2, Loader2, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { Track, Collaborator, ReleaseType, RELEASE_TYPE_LIMITS, GENRES, ReleaseSubmission } from '../types';
import { addSubmission, updateSubmission } from '../store';

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
  onClose: () => void;
  onSaved: (id: string) => void;
  /** Pass an existing release to edit it instead of creating new */
  existing?: ReleaseSubmission;
}

export default function ManualReleaseModal({ onClose, onSaved, existing }: Props) {
  const isEdit = !!existing;

  // Artist
  const [mainArtist, setMainArtist] = useState(existing?.mainArtist ?? '');
  const [collaborations, setCollaborations] = useState<Collaborator[]>(existing?.collaborations ?? []);
  const [features, setFeatures] = useState<Collaborator[]>(existing?.features ?? []);

  // Release info
  const [releaseType, setReleaseType] = useState<ReleaseType>(existing?.releaseType ?? 'single');
  const [releaseTitle, setReleaseTitle] = useState(existing?.releaseTitle ?? '');
  const [releaseDate, setReleaseDate] = useState(existing?.releaseDate ?? '');
  const [genre, setGenre] = useState(existing?.genre ?? '');
  const [explicitContent, setExplicitContent] = useState(existing?.explicitContent ?? false);
  const [upc, setUpc] = useState(existing?.upc ?? '');
  const [coverArtDriveLink, setCoverArtDriveLink] = useState(existing?.coverArtDriveLink ?? '');
  const [driveFolderLink, setDriveFolderLink] = useState(existing?.driveFolderLink ?? '');
  const [promoDriveLink, setPromoDriveLink] = useState(existing?.promoDriveLink ?? '');

  // Tracks
  const limits = RELEASE_TYPE_LIMITS[releaseType];
  const [tracks, setTracks] = useState<Track[]>(() => {
    if (existing?.tracks.length) return existing.tracks;
    return [emptyTrack()];
  });

  // Status (edit only)
  const [status, setStatus] = useState(existing?.status ?? 'pending');

  // UI
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expandedTrack, setExpandedTrack] = useState<number>(0);

  const updateTrack = (idx: number, patch: Partial<Track>) => {
    setTracks(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t));
  };

  const addTrack = () => {
    if (tracks.length < limits.max) setTracks(prev => [...prev, emptyTrack()]);
  };

  const removeTrack = (idx: number) => {
    if (tracks.length > limits.min) setTracks(prev => prev.filter((_, i) => i !== idx));
  };

  // When release type changes, adjust track count
  const handleTypeChange = (t: ReleaseType) => {
    setReleaseType(t);
    const lim = RELEASE_TYPE_LIMITS[t];
    setTracks(prev => {
      if (prev.length < lim.min) return [...prev, ...Array(lim.min - prev.length).fill(null).map(emptyTrack)];
      if (prev.length > lim.max) return prev.slice(0, lim.max);
      return prev;
    });
  };

  const isValid = mainArtist.trim() && releaseTitle.trim() && releaseDate && genre &&
    tracks.every(t => (releaseType === 'single' ? true : t.title.trim()));

  const handleSave = async () => {
    if (!isValid) { setError('Fill in all required fields and at least one track.'); return; }
    setSaving(true); setError('');
    try {
      const finalTracks = tracks.map((t, i) => ({
        ...t,
        title: releaseType === 'single' && i === 0 && !t.title ? releaseTitle : t.title,
      }));
      if (isEdit && existing) {
        await updateSubmission(existing.id, {
          mainArtist, collaborations, features,
          releaseType, releaseTitle, releaseDate, genre, explicitContent,
          coverArtDriveLink, driveFolderLink, promoDriveLink,
          tracks: finalTracks, upc: upc || undefined, status: status as ReleaseSubmission['status'],
        }, `${mainArtist} — ${releaseTitle}`);
        onSaved(existing.id);
      } else {
        const id = await addSubmission({
          mainArtist, collaborations, features,
          releaseType, releaseTitle, releaseDate, genre, explicitContent,
          coverArtDriveLink, coverArtImageUrl: '',
          driveFolderLink, promoDriveLink,
          tracks: finalTracks, rightsConfirmed: true, upc: upc || undefined,
          status: status as ReleaseSubmission['status'],
        });
        onSaved(id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
          <div>
            <h2 className="font-bold text-lg">{isEdit ? 'Edit Release' : 'Add Release Manually'}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {isEdit ? 'Update release details' : 'Create a release entry without going through the submission form'}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Release Type */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Release Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['single', 'ep', 'album'] as ReleaseType[]).map(t => (
                <button key={t} onClick={() => handleTypeChange(t)}
                  className={`py-2.5 rounded-xl border text-sm font-semibold capitalize transition-all ${
                    releaseType === t ? 'border-violet-500 bg-violet-500/15 text-violet-300' : 'border-white/8 text-zinc-500 hover:text-white hover:bg-white/5'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Artist */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Artist</label>
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">Main Artist <span className="text-red-400">*</span></label>
              <input type="text" value={mainArtist} onChange={e => setMainArtist(e.target.value)}
                placeholder="Artist name" className="input-dark w-full px-3 py-2.5 rounded-xl text-sm" />
            </div>

            {/* Collaborations */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] text-zinc-500">Collaborations</label>
                <button onClick={() => setCollaborations(p => [...p, emptyCollab()])}
                  className="text-[11px] text-violet-400 hover:text-violet-300 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              {collaborations.map((c, i) => (
                <div key={i} className="flex gap-2 mb-1.5">
                  <input type="text" value={c.name}
                    onChange={e => { const u = [...collaborations]; u[i] = { ...u[i], name: e.target.value }; setCollaborations(u); }}
                    placeholder="Collaborator name" className="input-dark flex-1 px-3 py-2 rounded-lg text-sm" />
                  <button onClick={() => setCollaborations(p => p.filter((_, j) => j !== i))}
                    className="text-zinc-600 hover:text-red-400 p-1.5"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>

            {/* Features */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] text-zinc-500">Features</label>
                <button onClick={() => setFeatures(p => [...p, emptyCollab()])}
                  className="text-[11px] text-violet-400 hover:text-violet-300 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              {features.map((f, i) => (
                <div key={i} className="flex gap-2 mb-1.5">
                  <input type="text" value={f.name}
                    onChange={e => { const u = [...features]; u[i] = { ...u[i], name: e.target.value }; setFeatures(u); }}
                    placeholder="Featured artist name" className="input-dark flex-1 px-3 py-2 rounded-lg text-sm" />
                  <button onClick={() => setFeatures(p => p.filter((_, j) => j !== i))}
                    className="text-zinc-600 hover:text-red-400 p-1.5"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Release Details */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Release Details</label>

            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">Release Title <span className="text-red-400">*</span></label>
              <input type="text" value={releaseTitle} onChange={e => setReleaseTitle(e.target.value)}
                placeholder="Title" className="input-dark w-full px-3 py-2.5 rounded-xl text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">Release Date <span className="text-red-400">*</span></label>
                <input type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)}
                  className="input-dark w-full px-3 py-2.5 rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">Genre <span className="text-red-400">*</span></label>
                <select value={genre} onChange={e => setGenre(e.target.value)}
                  className="input-dark w-full px-3 py-2.5 rounded-xl text-sm">
                  <option value="">Select genre</option>
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">UPC / EAN</label>
                <input type="text" value={upc} onChange={e => setUpc(e.target.value)}
                  placeholder="012345678905" className="input-dark w-full px-3 py-2.5 rounded-xl text-sm font-mono" />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">Explicit Content</label>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => setExplicitContent(false)}
                    className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${!explicitContent ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-white/8 text-zinc-600'}`}>
                    Clean
                  </button>
                  <button onClick={() => setExplicitContent(true)}
                    className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${explicitContent ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-white/8 text-zinc-600'}`}>
                    Explicit
                  </button>
                </div>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="input-dark w-full px-3 py-2.5 rounded-xl text-sm">
                <option value="pending">⏳ Pending</option>
                <option value="approved">✅ Approved</option>
                <option value="scheduled">📅 Scheduled</option>
                <option value="released">🎵 Released</option>
                <option value="rejected">❌ Rejected</option>
              </select>
            </div>
          </div>

          {/* Links */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Links</label>
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">Cover Art — Drive Link</label>
              <input type="url" value={coverArtDriveLink} onChange={e => setCoverArtDriveLink(e.target.value)}
                placeholder="https://drive.google.com/file/d/..." className="input-dark w-full px-3 py-2.5 rounded-xl text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">Drive Folder</label>
                <input type="url" value={driveFolderLink} onChange={e => setDriveFolderLink(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..." className="input-dark w-full px-3 py-2.5 rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">Promo Materials</label>
                <input type="url" value={promoDriveLink} onChange={e => setPromoDriveLink(e.target.value)}
                  placeholder="https://drive.google.com/..." className="input-dark w-full px-3 py-2.5 rounded-xl text-sm" />
              </div>
            </div>
          </div>

          {/* Tracks */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Tracks <span className="text-zinc-600 font-normal normal-case">({limits.min}–{limits.max})</span>
              </label>
              {tracks.length < limits.max && (
                <button onClick={addTrack}
                  className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add Track
                </button>
              )}
            </div>

            {tracks.map((track, idx) => (
              <div key={idx} className="border border-white/8 rounded-xl overflow-hidden">
                {/* Track header — click to expand */}
                <button
                  onClick={() => setExpandedTrack(expandedTrack === idx ? -1 : idx)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono text-zinc-600 w-5">{String(idx + 1).padStart(2, '0')}</span>
                    <span className="text-sm font-medium text-zinc-300">
                      {releaseType === 'single' && idx === 0
                        ? (releaseTitle || 'Track 1')
                        : (track.title || `Track ${idx + 1}`)}
                    </span>
                    {track.isrc && (
                      <span className="text-[10px] font-mono text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">
                        {track.isrc}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {tracks.length > limits.min && (
                      <span onClick={e => { e.stopPropagation(); removeTrack(idx); }}
                        className="text-zinc-600 hover:text-red-400 transition-colors p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {expandedTrack === idx ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                  </div>
                </button>

                {/* Track body */}
                {expandedTrack === idx && (
                  <div className="px-4 pb-4 space-y-3 border-t border-white/5">
                    {/* Title — hidden for singles */}
                    {!(releaseType === 'single' && idx === 0) && (
                      <div className="pt-3">
                        <label className="block text-[11px] text-zinc-500 mb-1">Track Title <span className="text-red-400">*</span></label>
                        <input type="text" value={track.title} onChange={e => updateTrack(idx, { title: e.target.value })}
                          placeholder="Track title" className="input-dark w-full px-3 py-2 rounded-lg text-sm" />
                      </div>
                    )}

                    {/* Explicit */}
                    <div className={!(releaseType === 'single' && idx === 0) ? '' : 'pt-3'}>
                      <label className="block text-[11px] text-zinc-500 mb-1">Explicit</label>
                      <div className="flex gap-2">
                        <button onClick={() => updateTrack(idx, { explicit: false })}
                          className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${!track.explicit ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-white/8 text-zinc-600'}`}>
                          Clean
                        </button>
                        <button onClick={() => updateTrack(idx, { explicit: true })}
                          className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${track.explicit ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-white/8 text-zinc-600'}`}>
                          Explicit
                        </button>
                      </div>
                    </div>

                    {/* Credits — 2 per row */}
                    <div>
                      <label className="block text-[11px] text-zinc-500 mb-2">Credits</label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          ['producedBy', 'Produced by'],
                          ['lyricsBy',   'Lyrics by'],
                          ['mixedBy',    'Mixed by'],
                          ['masteredBy', 'Mastered by'],
                        ] as const).map(([key, lbl]) => {
                          const vals = (track as Record<string, string>)[key]
                            ? (track as Record<string, string>)[key].split('|')
                            : [''];
                          return (
                            <div key={key} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-zinc-600">{lbl}</span>
                                <button onClick={() => updateTrack(idx, { [key]: [...vals, ''].join('|') } as Partial<Track>)}
                                  className="text-[10px] text-violet-500 hover:text-violet-300">+ Add</button>
                              </div>
                              {vals.map((v, vi) => (
                                <div key={vi} className="flex gap-1">
                                  <input type="text" value={v}
                                    onChange={e => {
                                      const nv = [...vals]; nv[vi] = e.target.value;
                                      updateTrack(idx, { [key]: nv.join('|') } as Partial<Track>);
                                    }}
                                    placeholder={lbl}
                                    className="input-dark flex-1 px-2.5 py-1.5 rounded-lg text-xs" />
                                  {vals.length > 1 && (
                                    <button onClick={() => {
                                      const nv = vals.filter((_, i) => i !== vi);
                                      updateTrack(idx, { [key]: nv.join('|') } as Partial<Track>);
                                    }} className="text-zinc-700 hover:text-red-400 p-1">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ISRC + WAV */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-zinc-500 mb-1">ISRC</label>
                        <input type="text" value={track.isrc || ''}
                          onChange={e => updateTrack(idx, { isrc: e.target.value.toUpperCase() })}
                          placeholder="USRC17607839"
                          className="input-dark w-full px-2.5 py-2 rounded-lg text-xs font-mono" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-zinc-500 mb-1">WAV File — Drive Link</label>
                        <input type="url" value={track.wavDriveLink || ''}
                          onChange={e => updateTrack(idx, { wavDriveLink: e.target.value })}
                          placeholder="https://drive.google.com/..."
                          className="input-dark w-full px-2.5 py-2 rounded-lg text-xs" />
                      </div>
                    </div>

                    {/* Preview timestamps */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-zinc-500 mb-1">Preview Start</label>
                        <input type="text" value={track.previewStart}
                          onChange={e => updateTrack(idx, { previewStart: e.target.value })}
                          placeholder="0:00" className="input-dark w-full px-2.5 py-2 rounded-lg text-xs" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-zinc-500 mb-1">Preview End</label>
                        <input type="text" value={track.previewEnd}
                          onChange={e => updateTrack(idx, { previewEnd: e.target.value })}
                          placeholder="0:30" className="input-dark w-full px-2.5 py-2 rounded-lg text-xs" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/8 flex-shrink-0">
          {error && <p className="text-xs text-red-400 flex-1 mr-4">{error}</p>}
          {!error && <span />}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white text-sm transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || !isValid}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl btn-primary text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEdit ? 'Save Changes' : 'Add Release'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
