import { useState } from 'react';
import { ReleaseSubmission, ReleaseStatus, Track, Collaborator } from '../types';
import { GENRES, RELEASE_TYPE_LIMITS, updateRelease } from '../store';
import { ArrowLeft, Edit3, Save, X, ExternalLink, Plus, Trash2 } from 'lucide-react';

interface Props {
  release: ReleaseSubmission;
  onBack: () => void;
  onUpdated: () => void;
}

const emptyTrack: Track = {
  title: '', explicit: false, tiktokPreview: '', wavDriveLink: '', lyricsDocsLink: '',
  credits: { producedBy: '', lyricsBy: '', mixedBy: '', masteredBy: '' }
};

const emptyCollab: Collaborator = {
  name: '', platforms: { spotify: '', appleMusic: '', anghami: '' }
};

export default function ReleaseDetail({ release, onBack, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ReleaseSubmission>({ ...release });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await updateRelease(form.id, form);
    setSaving(false);
    setEditing(false);
    onUpdated();
  };

  const updateField = <K extends keyof ReleaseSubmission>(key: K, value: ReleaseSubmission[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const updateTrack = (index: number, updates: Partial<Track>) => {
    const tracks = [...form.tracks];
    tracks[index] = { ...tracks[index], ...updates };
    updateField('tracks', tracks);
  };

  const updateTrackCredits = (index: number, field: keyof Track['credits'], value: string) => {
    const tracks = [...form.tracks];
    tracks[index] = { ...tracks[index], credits: { ...tracks[index].credits, [field]: value } };
    updateField('tracks', tracks);
  };

  const addTrack = () => {
    const limit = RELEASE_TYPE_LIMITS[form.releaseType].max;
    if (form.tracks.length < limit) {
      updateField('tracks', [...form.tracks, { ...emptyTrack }]);
    }
  };

  const removeTrack = (index: number) => {
    if (form.tracks.length > RELEASE_TYPE_LIMITS[form.releaseType].min) {
      updateField('tracks', form.tracks.filter((_, i) => i !== index));
    }
  };

  const updateCollab = (type: 'collaborations' | 'features', index: number, updates: Partial<Collaborator>) => {
    const list = [...form[type]];
    list[index] = { ...list[index], ...updates };
    updateField(type, list);
  };

  const updateCollabPlatform = (type: 'collaborations' | 'features', index: number, platform: keyof Collaborator['platforms'], value: string) => {
    const list = [...form[type]];
    list[index] = { ...list[index], platforms: { ...list[index].platforms, [platform]: value } };
    updateField(type, list);
  };

  const addCollab = (type: 'collaborations' | 'features') => {
    updateField(type, [...form[type], { ...emptyCollab }]);
  };

  const removeCollab = (type: 'collaborations' | 'features', index: number) => {
    updateField(type, form[type].filter((_, i) => i !== index));
  };

  const r = editing ? form : release;

  const LinkDisplay = ({ url, label }: { url: string; label: string }) => (
    url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 flex items-center gap-1 text-sm break-all">
        <ExternalLink className="w-3 h-3 flex-shrink-0" /> {label}
      </a>
    ) : <span className="text-zinc-500 text-sm">Not provided</span>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" /> Back to Dashboard
        </button>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={() => { setForm({ ...release }); setEditing(false); }}
                className="flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-lg text-sm">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save All Changes'}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm">
              <Edit3 className="w-4 h-4" /> Edit Release
            </button>
          )}
        </div>
      </div>

      {/* ID & Status */}
      <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-3 py-1 rounded">{r.id}</span>
            <h2 className="text-2xl font-bold text-white mt-2">{editing ?
              <input type="text" value={form.releaseTitle} onChange={e => updateField('releaseTitle', e.target.value)}
                className="bg-zinc-900 border border-zinc-600 rounded-lg px-3 py-1 text-white w-full focus:border-purple-500 focus:outline-none" />
              : r.releaseTitle}</h2>
            <p className="text-zinc-400 mt-1">by {editing ?
              <input type="text" value={form.mainArtist} onChange={e => updateField('mainArtist', e.target.value)}
                className="bg-zinc-900 border border-zinc-600 rounded px-2 py-0.5 text-white focus:border-purple-500 focus:outline-none" />
              : r.mainArtist}</p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <label className="text-xs text-zinc-400">Status</label>
            {editing ? (
              <select value={form.status} onChange={e => updateField('status', e.target.value as ReleaseStatus)}
                className="bg-zinc-900 border border-zinc-600 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none">
                <option value="pending">⏳ Pending</option>
                <option value="approved">✅ Approved</option>
                <option value="scheduled">📅 Scheduled</option>
                <option value="released">🎵 Released</option>
                <option value="rejected">❌ Rejected</option>
              </select>
            ) : (
              <span className={`text-sm font-medium px-3 py-1 rounded border ${
                r.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                r.status === 'approved' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                r.status === 'scheduled' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                r.status === 'released' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                'bg-red-500/20 text-red-300 border-red-500/30'
              }`}>{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Release Info */}
      <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700">
        <h3 className="text-lg font-semibold text-white mb-4">Release Info</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Type</label>
            {editing ? (
              <select value={form.releaseType} onChange={e => updateField('releaseType', e.target.value as ReleaseSubmission['releaseType'])}
                className="w-full bg-zinc-900 border border-zinc-600 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none">
                <option value="single">Single</option><option value="ep">EP</option><option value="album">Album</option>
              </select>
            ) : <p className="text-white uppercase font-medium">{r.releaseType}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Release Date</label>
            {editing ? (
              <input type="date" value={form.releaseDate} onChange={e => updateField('releaseDate', e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-600 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none" />
            ) : <p className="text-white">{r.releaseDate || 'TBD'}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Genre</label>
            {editing ? (
              <select value={form.genre} onChange={e => updateField('genre', e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-600 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none">
                <option value="">Select...</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            ) : <p className="text-white">{r.genre || 'N/A'}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Explicit</label>
            {editing ? (
              <button onClick={() => updateField('explicit', !form.explicit)}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${form.explicit ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
                {form.explicit ? 'Yes' : 'No'}
              </button>
            ) : <p className="text-white">{r.explicit ? '🔞 Yes' : '✅ No'}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Cover Art</label>
            {editing ? (
              <input type="url" value={form.coverArtDriveLink} onChange={e => updateField('coverArtDriveLink', e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-600 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none" placeholder="Google Drive URL" />
            ) : <LinkDisplay url={r.coverArtDriveLink} label="View Cover Art" />}
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Submitted</label>
            <p className="text-white">{new Date(r.submittedAt).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Collaborations & Features */}
      {(r.collaborations.length > 0 || r.features.length > 0 || editing) && (
        <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700">
          <h3 className="text-lg font-semibold text-white mb-4">Collaborations & Features</h3>
          
          {/* Collaborations */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-zinc-300">Collaborations</h4>
              {editing && <button onClick={() => addCollab('collaborations')} className="text-purple-400 hover:text-purple-300 text-xs flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>}
            </div>
            {r.collaborations.length === 0 && !editing && <p className="text-zinc-500 text-sm">None</p>}
            <div className="space-y-3">
              {(editing ? form.collaborations : r.collaborations).map((c, i) => (
                <div key={i} className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-700">
                  {editing ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input type="text" value={c.name} onChange={e => updateCollab('collaborations', i, { name: e.target.value })}
                          placeholder="Artist name" className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-3 py-1.5 text-white text-sm focus:border-purple-500 focus:outline-none" />
                        <button onClick={() => removeCollab('collaborations', i)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <input type="url" value={c.platforms.spotify} onChange={e => updateCollabPlatform('collaborations', i, 'spotify', e.target.value)}
                          placeholder="Spotify URL" className="bg-zinc-800 border border-zinc-600 rounded px-3 py-1.5 text-white text-xs focus:border-purple-500 focus:outline-none" />
                        <input type="url" value={c.platforms.appleMusic} onChange={e => updateCollabPlatform('collaborations', i, 'appleMusic', e.target.value)}
                          placeholder="Apple Music URL" className="bg-zinc-800 border border-zinc-600 rounded px-3 py-1.5 text-white text-xs focus:border-purple-500 focus:outline-none" />
                        <input type="url" value={c.platforms.anghami} onChange={e => updateCollabPlatform('collaborations', i, 'anghami', e.target.value)}
                          placeholder="Anghami URL" className="bg-zinc-800 border border-zinc-600 rounded px-3 py-1.5 text-white text-xs focus:border-purple-500 focus:outline-none" />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-white font-medium text-sm">{c.name}</p>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {c.platforms.spotify && <LinkDisplay url={c.platforms.spotify} label="Spotify" />}
                        {c.platforms.appleMusic && <LinkDisplay url={c.platforms.appleMusic} label="Apple Music" />}
                        {c.platforms.anghami && <LinkDisplay url={c.platforms.anghami} label="Anghami" />}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Features */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-zinc-300">Features</h4>
              {editing && <button onClick={() => addCollab('features')} className="text-purple-400 hover:text-purple-300 text-xs flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>}
            </div>
            {r.features.length === 0 && !editing && <p className="text-zinc-500 text-sm">None</p>}
            <div className="space-y-3">
              {(editing ? form.features : r.features).map((f, i) => (
                <div key={i} className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-700">
                  {editing ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input type="text" value={f.name} onChange={e => updateCollab('features', i, { name: e.target.value })}
                          placeholder="Artist name" className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-3 py-1.5 text-white text-sm focus:border-purple-500 focus:outline-none" />
                        <button onClick={() => removeCollab('features', i)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <input type="url" value={f.platforms.spotify} onChange={e => updateCollabPlatform('features', i, 'spotify', e.target.value)}
                          placeholder="Spotify URL" className="bg-zinc-800 border border-zinc-600 rounded px-3 py-1.5 text-white text-xs focus:border-purple-500 focus:outline-none" />
                        <input type="url" value={f.platforms.appleMusic} onChange={e => updateCollabPlatform('features', i, 'appleMusic', e.target.value)}
                          placeholder="Apple Music URL" className="bg-zinc-800 border border-zinc-600 rounded px-3 py-1.5 text-white text-xs focus:border-purple-500 focus:outline-none" />
                        <input type="url" value={f.platforms.anghami} onChange={e => updateCollabPlatform('features', i, 'anghami', e.target.value)}
                          placeholder="Anghami URL" className="bg-zinc-800 border border-zinc-600 rounded px-3 py-1.5 text-white text-xs focus:border-purple-500 focus:outline-none" />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-white font-medium text-sm">{f.name}</p>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {f.platforms.spotify && <LinkDisplay url={f.platforms.spotify} label="Spotify" />}
                        {f.platforms.appleMusic && <LinkDisplay url={f.platforms.appleMusic} label="Apple Music" />}
                        {f.platforms.anghami && <LinkDisplay url={f.platforms.anghami} label="Anghami" />}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tracklist */}
      <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Tracklist ({r.tracks.length} tracks)</h3>
          {editing && form.tracks.length < RELEASE_TYPE_LIMITS[form.releaseType].max && (
            <button onClick={addTrack} className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add Track
            </button>
          )}
        </div>
        <div className="space-y-4">
          {(editing ? form.tracks : r.tracks).map((track, i) => (
            <div key={i} className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-700">
              <div className="flex items-center justify-between mb-3">
                <span className="text-purple-400 font-mono text-sm">Track {i + 1}</span>
                {editing && form.tracks.length > RELEASE_TYPE_LIMITS[form.releaseType].min && (
                  <button onClick={() => removeTrack(i)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
              {editing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Title</label>
                      <input type="text" value={track.title} onChange={e => updateTrack(i, { title: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">TikTok Preview Time</label>
                      <input type="text" value={track.tiktokPreview} onChange={e => updateTrack(i, { tiktokPreview: e.target.value })}
                        placeholder="e.g. 0:30 - 1:00"
                        className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-zinc-400">Explicit:</label>
                    <button onClick={() => updateTrack(i, { explicit: !track.explicit })}
                      className={`px-2 py-0.5 rounded text-xs font-medium ${track.explicit ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
                      {track.explicit ? 'Yes' : 'No'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">WAV Google Drive Link</label>
                      <input type="url" value={track.wavDriveLink} onChange={e => updateTrack(i, { wavDriveLink: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Lyrics Google Docs Link</label>
                      <input type="url" value={track.lyricsDocsLink} onChange={e => updateTrack(i, { lyricsDocsLink: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Produced by</label>
                      <input type="text" value={track.credits.producedBy} onChange={e => updateTrackCredits(i, 'producedBy', e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Lyrics by</label>
                      <input type="text" value={track.credits.lyricsBy} onChange={e => updateTrackCredits(i, 'lyricsBy', e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Mixed by</label>
                      <input type="text" value={track.credits.mixedBy} onChange={e => updateTrackCredits(i, 'mixedBy', e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Mastered by</label>
                      <input type="text" value={track.credits.masteredBy} onChange={e => updateTrackCredits(i, 'masteredBy', e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none" />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-white font-medium">{track.title || 'Untitled'}</span>
                    {track.explicit && <span className="text-xs bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded">E</span>}
                  </div>
                  {track.tiktokPreview && <p className="text-zinc-400 text-xs mb-2">🎵 TikTok Preview: {track.tiktokPreview}</p>}
                  <div className="flex flex-wrap gap-3 mb-2">
                    {track.wavDriveLink && <LinkDisplay url={track.wavDriveLink} label="WAV File" />}
                    {track.lyricsDocsLink && <LinkDisplay url={track.lyricsDocsLink} label="Lyrics Doc" />}
                  </div>
                  {(track.credits.producedBy || track.credits.lyricsBy || track.credits.mixedBy || track.credits.masteredBy) && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 pt-2 border-t border-zinc-700">
                      {track.credits.producedBy && <div className="text-xs"><span className="text-zinc-500">Produced:</span> <span className="text-zinc-300">{track.credits.producedBy}</span></div>}
                      {track.credits.lyricsBy && <div className="text-xs"><span className="text-zinc-500">Lyrics:</span> <span className="text-zinc-300">{track.credits.lyricsBy}</span></div>}
                      {track.credits.mixedBy && <div className="text-xs"><span className="text-zinc-500">Mixed:</span> <span className="text-zinc-300">{track.credits.mixedBy}</span></div>}
                      {track.credits.masteredBy && <div className="text-xs"><span className="text-zinc-500">Mastered:</span> <span className="text-zinc-300">{track.credits.masteredBy}</span></div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Links */}
      <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700">
        <h3 className="text-lg font-semibold text-white mb-4">Links & Files</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Promo Drive Link</label>
            {editing ? (
              <input type="url" value={form.promoDriveLink} onChange={e => updateField('promoDriveLink', e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none" />
            ) : <LinkDisplay url={r.promoDriveLink} label="Promo Materials" />}
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">All-in-One Drive Folder</label>
            {editing ? (
              <input type="url" value={form.driveFolderLink} onChange={e => updateField('driveFolderLink', e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none" />
            ) : <LinkDisplay url={r.driveFolderLink} label="Drive Folder" />}
          </div>
        </div>
      </div>

      {/* Label Notes */}
      <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700">
        <h3 className="text-lg font-semibold text-white mb-4">Label Notes</h3>
        {editing ? (
          <textarea value={form.labelNotes} onChange={e => updateField('labelNotes', e.target.value)}
            rows={4} placeholder="Add notes about this release..."
            className="w-full bg-zinc-900 border border-zinc-600 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none resize-none" />
        ) : (
          <p className="text-zinc-300 whitespace-pre-wrap">{r.labelNotes || 'No notes yet.'}</p>
        )}
      </div>
    </div>
  );
}
