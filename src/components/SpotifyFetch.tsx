/**
 * SpotifyFetch — grab everything possible from Spotify + YouTube + MusicBrainz + iTunes
 * then auto-save to DB. No extra button press needed.
 *
 * Fills (only if empty unless flagged as "always update"):
 *   TRACK LEVEL:  title, explicit, isrc, producedBy, mixedBy, masteredBy, lyricsBy,
 *                 spotifyPreviewUrl, spotifyTrackId, additionalCredits
 *   RELEASE LEVEL: releaseDate, genre, explicitContent, coverArtImageUrl (Spotify art),
 *                  upc, features (featured artists), collaborations
 *
 * Credit casing: preserved exactly as returned — "DROWN" stays "DROWN", "DrowN" stays "DrowN"
 * Merges with existing values — never overwrites non-empty fields
 * Auto-saves via updateSubmission after apply
 */

import { useState } from 'react';
import {
  Loader2, CheckCircle2, AlertTriangle, ExternalLink,
  RefreshCw, ChevronDown, ChevronUp, Zap, Save
} from 'lucide-react';
import { Track, AdminSettings, Collaborator, GENRES } from '../types';
import { fetchSpotifyTrack, SpotifyTrack } from './TrackMetrics';
import { updateSubmission } from '../store';

// ── Types ─────────────────────────────────────────────────────
interface MBCredits {
  producedBy: string[];
  mixedBy: string[];
  masteredBy: string[];
  lyricsBy: string[];
  arrangedBy: string[];
}

const CREDIT_PATTERNS: { keys: string[]; field: keyof MBCredits }[] = [
  { keys: ['produced by', 'production by', 'prod by', 'prod.', 'produced:'],   field: 'producedBy' },
  { keys: ['mixed by', 'mix by', 'mixing by', 'mixed:'],                        field: 'mixedBy' },
  { keys: ['mastered by', 'mastering by', 'mastered:'],                         field: 'masteredBy' },
  { keys: ['lyrics by', 'written by', 'words by', 'lyrics:'],                   field: 'lyricsBy' },
  { keys: ['arranged by', 'arrangement by'],                                    field: 'arrangedBy' },
];

// Preserve exact casing from source — do NOT lowercase or title-case
function parseCreditsFromText(text: string): Partial<MBCredits> {
  const result: Partial<MBCredits> = {};
  // Split on newlines and bullet chars but keep original casing
  const lines = text.split(/[\n\r|•·]/);
  for (const line of lines) {
    const lineLow = line.toLowerCase();
    for (const { keys, field } of CREDIT_PATTERNS) {
      for (const key of keys) {
        const idx = lineLow.indexOf(key);
        if (idx !== -1) {
          // Extract from ORIGINAL line to preserve casing
          const raw = line.slice(idx + key.length).replace(/^[\s:–\-]+/, '').trim();
          if (raw.length > 1 && raw.length < 120) {
            // Split on commas/ampersands/and/plus/feat to get all names — preserve casing
            const names = raw
              .split(/,|\s&\s|\sand\s|\s\+\s|feat\.|ft\./i)
              .map(n => n.trim().replace(/^[\s:]+|[\s.()\[\]]+$/g, ''))
              .filter(n => n.length > 1 && n.length < 60);
            for (const name of names) {
              if (!result[field]) result[field] = [];
              // Dedup case-insensitively but keep first-seen casing
              if (!result[field]!.some(e => e.toLowerCase() === name.toLowerCase())) {
                result[field]!.push(name);
              }
            }
          }
        }
      }
    }
  }
  return result;
}

function mergeCredits(mb: Partial<MBCredits>, yt: Partial<MBCredits>): Partial<MBCredits> {
  const merge = (a?: string[], b?: string[]) => {
    const out = [...(a ?? [])];
    for (const name of (b ?? [])) {
      if (!out.some(e => e.toLowerCase() === name.toLowerCase())) out.push(name);
    }
    return out.filter(Boolean);
  };
  return {
    producedBy: merge(mb.producedBy, yt.producedBy),
    mixedBy:    merge(mb.mixedBy,    yt.mixedBy),
    masteredBy: merge(mb.masteredBy, yt.masteredBy),
    lyricsBy:   merge(mb.lyricsBy,   yt.lyricsBy),
    arrangedBy: merge(mb.arrangedBy, yt.arrangedBy),
  };
}

// Merge string pipe-list with new names, preserving exact casing, deduping case-insensitively
function mergeStringField(existing: string, incoming?: string[]): string {
  if (!incoming?.length) return existing;
  const list = existing ? existing.split('|').map(s => s.trim()).filter(Boolean) : [];
  for (const name of incoming) {
    if (name && !list.some(e => e.toLowerCase() === name.toLowerCase())) list.push(name);
  }
  return list.join('|');
}

// Map iTunes / Spotify genre strings to our GENRES list
function mapGenre(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('hip') || r.includes('rap'))      return 'Hip-Hop/Rap';
  if (r.includes('r&b') || r.includes('soul'))     return 'R&B/Soul';
  if (r.includes('electronic') || r.includes('dance') || r.includes('edm')) return 'Electronic/Dance';
  if (r.includes('afro'))                          return 'Afrobeats';
  if (r.includes('reggaeton'))                     return 'Reggaeton';
  if (r.includes('latin'))                         return 'Latin';
  if (r.includes('k-pop') || r.includes('kpop'))  return 'K-Pop';
  if (r.includes('classical'))                     return 'Classical';
  if (r.includes('jazz'))                          return 'Jazz';
  if (r.includes('country'))                       return 'Country';
  if (r.includes('folk'))                          return 'Folk';
  if (r.includes('gospel'))                        return 'Gospel';
  if (r.includes('blues'))                         return 'Blues';
  if (r.includes('metal'))                         return 'Metal';
  if (r.includes('punk'))                          return 'Punk';
  if (r.includes('rock'))                          return 'Rock';
  if (r.includes('indie'))                         return 'Indie';
  if (r.includes('alternative') || r.includes('alt')) return 'Alternative';
  if (r.includes('pop'))                           return 'Pop';
  // Check direct match in GENRES
  const direct = GENRES.find(g => g.toLowerCase() === r);
  if (direct) return direct;
  return raw; // keep original if no match
}

// ── MusicBrainz credit lookup by ISRC ────────────────────────
async function fetchMusicBrainzCredits(isrc: string): Promise<Partial<MBCredits>> {
  try {
    await new Promise(r => setTimeout(r, 200)); // respect rate limit
    const recRes = await fetch(
      `https://musicbrainz.org/ws/2/isrc/${encodeURIComponent(isrc)}?inc=recordings&fmt=json`,
      { headers: { 'User-Agent': 'InLightsLabelPortal/1.0 (admin@inlights.com)' } }
    );
    if (!recRes.ok) return {};
    const recData = await recRes.json();
    const recordingId = recData?.recordings?.[0]?.id;
    if (!recordingId) return {};

    await new Promise(r => setTimeout(r, 200));
    const relRes = await fetch(
      `https://musicbrainz.org/ws/2/recording/${recordingId}?inc=artist-rels&fmt=json`,
      { headers: { 'User-Agent': 'InLightsLabelPortal/1.0 (admin@inlights.com)' } }
    );
    if (!relRes.ok) return {};
    const relData = await relRes.json();
    const relations: { type: string; artist?: { name: string } }[] = relData?.relations ?? [];

    const credits: Partial<MBCredits> = {};
    for (const rel of relations) {
      const name = rel.artist?.name; // exact casing from MusicBrainz
      if (!name) continue;
      const type = rel.type?.toLowerCase() ?? '';
      if (type.includes('producer') || type === 'production')         { if (!credits.producedBy) credits.producedBy = []; if (!credits.producedBy.includes(name)) credits.producedBy.push(name); }
      if (type.includes('mix') && !type.includes('master'))           { if (!credits.mixedBy)    credits.mixedBy    = []; if (!credits.mixedBy.includes(name))    credits.mixedBy.push(name);    }
      if (type.includes('master'))                                    { if (!credits.masteredBy) credits.masteredBy = []; if (!credits.masteredBy.includes(name)) credits.masteredBy.push(name); }
      if (type.includes('lyricist') || type.includes('written-by'))   { if (!credits.lyricsBy)   credits.lyricsBy   = []; if (!credits.lyricsBy.includes(name))   credits.lyricsBy.push(name);   }
      if (type.includes('arrang'))                                    { if (!credits.arrangedBy) credits.arrangedBy = []; if (!credits.arrangedBy.includes(name)) credits.arrangedBy.push(name); }
    }
    return credits;
  } catch { return {}; }
}

// ── YouTube search + description parse ───────────────────────
async function fetchYouTubeFull(apiKey: string, title: string, artist: string) {
  try {
    const q = encodeURIComponent(`${title} ${artist}`);
    const sRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&maxResults=3&key=${apiKey}`
    );
    if (!sRes.ok) return null;
    const sData = await sRes.json();
    const videoId = sData?.items?.[0]?.id?.videoId;
    if (!videoId) return null;

    const vRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoId}&key=${apiKey}`
    );
    const vData = await vRes.json();
    const video = vData?.items?.[0];
    if (!video) return null;

    const description: string = video.snippet?.description ?? '';
    return {
      videoId,
      title: video.snippet?.title ?? '',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      viewCount: parseInt(video.statistics?.viewCount ?? '0', 10),
      description,
      credits: parseCreditsFromText(description),
    };
  } catch { return null; }
}

// ── iTunes Search — genre + artwork fallback ──────────────────
async function fetchItunes(title: string, artist: string) {
  try {
    const term = encodeURIComponent(`${title} ${artist}`);
    const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=1`);
    if (!res.ok) return null;
    const data = await res.json();
    const track = data?.results?.[0];
    if (!track) return null;
    return {
      genre: track.primaryGenreName as string ?? null,
      artworkUrl: (track.artworkUrl100 as string ?? '').replace('100x100', '600x600'),
      collectionName: track.collectionName as string ?? null,
      releaseDate: (track.releaseDate as string ?? '').slice(0, 10),
    };
  } catch { return null; }
}

// ── FetchedTrack result ───────────────────────────────────────
interface FetchedTrack {
  trackIndex: number;
  original: Track;
  spotify: SpotifyTrack | null;
  spotifyError?: string;
  youtube: { title: string; url: string; viewCount: number; description: string; credits: Partial<MBCredits> } | null;
  youtubeError?: string;
  mbCredits: Partial<MBCredits>;
  mergedCredits: Partial<MBCredits>;
  resolvedIsrc?: string;
  featuredArtists?: string[];      // from Spotify track.artists[1+]
  albumArtUrl?: string;            // highest-res Spotify album image
  releaseDate?: string;
}

interface ReleaseFieldPatch {
  coverArtImageUrl?: string;
  releaseDate?: string;
  genre?: string;
  explicitContent?: boolean;
  upc?: string;
  features?: Collaborator[];
  collaborations?: Collaborator[];
}

interface Props {
  tracks: Track[];
  mainArtist: string;
  releaseTitle: string;
  settings: AdminSettings;
  releaseId?: string;                // if present → auto-save after apply
  currentRelease?: {
    releaseDate?: string;
    genre?: string;
    coverArtImageUrl?: string;
    coverArtDriveLink?: string;
    explicitContent?: boolean;
    upc?: string;
    features?: Collaborator[];
    collaborations?: Collaborator[];
  };
  onApply: (updatedTracks: Track[]) => void;
  onApplyRelease?: (patch: ReleaseFieldPatch) => void;
}

const emptyCollab = (name: string, role = 'artist'): Collaborator => ({
  name,
  role,
  platformLinks: { spotify: '', appleMusic: '', anghami: '' },
});

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

// ── Component ─────────────────────────────────────────────────
export default function SpotifyFetch({
  tracks, mainArtist, releaseTitle, settings,
  releaseId, currentRelease, onApply, onApplyRelease,
}: Props) {
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [results, setResults] = useState<FetchedTrack[]>([]);
  const [releasePatch, setReleasePatch] = useState<ReleaseFieldPatch & { itunesGenre?: string; itunesArt?: string }>({});
  const [fetched, setFetched] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [fetchStatus, setFetchStatus] = useState('');

  const hasSpotify = !!(settings.spotifyClientId && settings.spotifyClientSecret);
  const hasYouTube = !!settings.youtubeApiKey;
  if (!hasSpotify && !hasYouTube) return null;

  const doFetch = async () => {
    setFetching(true);
    setFetched(false);
    setApplied(false);
    setSaveStatus('idle');
    setFetchStatus('');

    // Collect release-level data from first track
    const rPatch: typeof releasePatch = {};

    const out: FetchedTrack[] = await Promise.all(
      tracks.map(async (track, i) => {
        const title = track.title || releaseTitle;
        const result: FetchedTrack = {
          trackIndex: i,
          original: track,
          spotify: null,
          youtube: null,
          mbCredits: {},
          mergedCredits: {},
          featuredArtists: [],
        };

        setFetchStatus(`Track ${i + 1}/${tracks.length} — Spotify…`);

        // 1. Spotify
        if (hasSpotify) {
          try {
            result.spotify = await fetchSpotifyTrack(
              settings.spotifyClientId,
              settings.spotifyClientSecret,
              track.isrc, title, mainArtist
            );
            const sp = result.spotify as SpotifyTrack & { external_ids?: { isrc?: string } };
            result.resolvedIsrc = track.isrc || sp?.external_ids?.isrc;

            // Featured artists — exact casing from Spotify
            if (sp?.artists && sp.artists.length > 1) {
              result.featuredArtists = sp.artists.slice(1).map(a => a.name);
            }

            // Album art — highest res
            if (sp?.album?.images?.length) {
              result.albumArtUrl = sp.album.images[0].url;
              if (i === 0 && !currentRelease?.coverArtImageUrl) {
                rPatch.coverArtImageUrl = sp.album.images[0].url;
              }
            }
            // Release date
            if (sp?.album?.release_date) {
              result.releaseDate = sp.album.release_date;
              if (i === 0 && !currentRelease?.releaseDate) {
                rPatch.releaseDate = sp.album.release_date.slice(0, 10);
              }
            }
            // Explicit
            if (i === 0 && typeof sp?.explicit === 'boolean' && currentRelease?.explicitContent === undefined) {
              rPatch.explicitContent = sp.explicit;
            }
          } catch (e) {
            result.spotifyError = e instanceof Error ? e.message : 'Spotify fetch failed';
          }
        }

        // 2. MusicBrainz credits
        const isrcToUse = result.resolvedIsrc || track.isrc;
        if (isrcToUse) {
          setFetchStatus(`Track ${i + 1}/${tracks.length} — MusicBrainz credits…`);
          result.mbCredits = await fetchMusicBrainzCredits(isrcToUse);
        }

        // 3. YouTube
        if (hasYouTube) {
          setFetchStatus(`Track ${i + 1}/${tracks.length} — YouTube…`);
          try {
            result.youtube = await fetchYouTubeFull(settings.youtubeApiKey, title, mainArtist);
          } catch (e) {
            result.youtubeError = e instanceof Error ? e.message : 'YouTube fetch failed';
          }
        }

        // 4. Merge credits
        result.mergedCredits = mergeCredits(result.mbCredits, result.youtube?.credits ?? {});

        return result;
      })
    );

    // iTunes — genre + art fallback
    setFetchStatus('Fetching genre from iTunes…');
    const itunes = await fetchItunes(releaseTitle || tracks[0]?.title || '', mainArtist);
    if (itunes?.genre && !currentRelease?.genre) {
      rPatch.itunesGenre = mapGenre(itunes.genre);
      if (!rPatch.genre) rPatch.genre = rPatch.itunesGenre;
    }
    if (itunes?.artworkUrl && !rPatch.coverArtImageUrl && !currentRelease?.coverArtImageUrl) {
      rPatch.itunesArt = itunes.artworkUrl;
      rPatch.coverArtImageUrl = rPatch.coverArtImageUrl || itunes.artworkUrl;
    }
    if (itunes?.releaseDate && !rPatch.releaseDate && !currentRelease?.releaseDate) {
      rPatch.releaseDate = itunes.releaseDate;
    }

    // Build features list from all tracks' featuredArtists
    const allFeatured = out.flatMap(r => r.featuredArtists ?? []);
    if (allFeatured.length > 0) {
      const existing = currentRelease?.features ?? [];
      const merged: Collaborator[] = [...existing];
      for (const name of allFeatured) {
        if (!merged.some(c => c.name.toLowerCase() === name.toLowerCase())) {
          merged.push(emptyCollab(name, 'artist'));
        }
      }
      if (merged.length !== existing.length) rPatch.features = merged;
    }

    setResults(out);
    setReleasePatch(rPatch);
    setFetching(false);
    setFetched(true);
    setFetchStatus('');
  };

  const handleApplyAndSave = async () => {
    setApplying(true);

    // 1. Build updated tracks
    const updatedTracks = tracks.map((track, i) => {
      const r = results.find(r => r.trackIndex === i);
      if (!r) return track;
      const patch: Partial<Track> = {};

      if (r.spotify) {
        if (r.spotify.preview_url) patch.spotifyPreviewUrl = r.spotify.preview_url;
        patch.spotifyTrackId = r.spotify.id;
        const sp = r.spotify as SpotifyTrack & { external_ids?: { isrc?: string } };
        if (!track.isrc && sp.external_ids?.isrc) patch.isrc = sp.external_ids.isrc;
      }

      const c = r.mergedCredits;
      if (c.producedBy?.length) patch.producedBy = mergeStringField(track.producedBy || '', c.producedBy);
      if (c.mixedBy?.length)    patch.mixedBy    = mergeStringField(track.mixedBy    || '', c.mixedBy);
      if (c.masteredBy?.length) patch.masteredBy = mergeStringField(track.masteredBy || '', c.masteredBy);
      if (c.lyricsBy?.length)   patch.lyricsBy   = mergeStringField(track.lyricsBy   || '', c.lyricsBy);

      // Additional credits
      if (c.arrangedBy?.length) {
        const existing = track.additionalCredits ?? [];
        const updated = [...existing];
        for (const name of c.arrangedBy) {
          if (!updated.some(e => e.role === 'Arranged by' && e.name.toLowerCase() === name.toLowerCase())) {
            updated.push({ role: 'Arranged by', name });
          }
        }
        if (updated.length !== existing.length) patch.additionalCredits = updated;
      }

      return { ...track, ...patch };
    });

    // 2. Build release-level patch (only non-empty sources)
    const rp: ReleaseFieldPatch = {};
    if (releasePatch.coverArtImageUrl) rp.coverArtImageUrl = releasePatch.coverArtImageUrl;
    if (releasePatch.releaseDate)      rp.releaseDate      = releasePatch.releaseDate;
    if (releasePatch.genre)            rp.genre            = releasePatch.genre;
    if (releasePatch.explicitContent !== undefined) rp.explicitContent = releasePatch.explicitContent;
    if (releasePatch.features?.length) rp.features = releasePatch.features;

    // 3. Update UI state immediately
    onApply(updatedTracks);
    if (onApplyRelease) onApplyRelease(rp);

    // 4. Auto-save to DB if releaseId provided
    if (releaseId) {
      setSaveStatus('saving');
      try {
        await updateSubmission(releaseId, {
          tracks: updatedTracks,
          ...(rp.coverArtImageUrl ? { coverArtImageUrl: rp.coverArtImageUrl } : {}),
          ...(rp.releaseDate      ? { releaseDate:      rp.releaseDate }       : {}),
          ...(rp.genre            ? { genre:            rp.genre }             : {}),
          ...(rp.explicitContent !== undefined ? { explicitContent: rp.explicitContent } : {}),
          ...(rp.features         ? { features: rp.features }                  : {}),
        });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } catch {
        setSaveStatus('error');
      }
    }

    setApplying(false);
    setApplied(true);
  };

  const anyPreview = results.some(r => r.spotify?.preview_url);
  const anyCredits = results.some(r => Object.values(r.mergedCredits).some(v => v?.length));
  const hasReleasePatch = !!(
    releasePatch.coverArtImageUrl || releasePatch.releaseDate ||
    releasePatch.genre || releasePatch.features?.length ||
    releasePatch.explicitContent !== undefined
  );

  return (
    <div className="rounded-xl border border-violet-500/20 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-violet-500/15 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-zinc-300">Grab from Streaming</p>
            <p className="text-[10px] text-zinc-600">
              Credits · Preview · Art · Date · Genre · Features
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === 'saved' && <span className="text-[10px] text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Saved</span>}
          {saveStatus === 'error' && <span className="text-[10px] text-red-400">Save failed</span>}
          {open ? <ChevronUp className="w-4 h-4 text-zinc-600" /> : <ChevronDown className="w-4 h-4 text-zinc-600" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">

          {/* Fetch button */}
          <button
            onClick={doFetch}
            disabled={fetching}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 text-sm font-medium hover:bg-violet-600/30 transition-all disabled:opacity-50 w-full justify-center"
          >
            {fetching
              ? <><Loader2 className="w-4 h-4 animate-spin" />{fetchStatus || 'Fetching…'}</>
              : <><RefreshCw className="w-4 h-4" />{fetched ? 'Re-fetch' : 'Fetch Everything'}</>
            }
          </button>

          {/* Release-level patch preview */}
          {fetched && hasReleasePatch && (
            <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 p-3 space-y-2">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Release fields to fill</p>
              {releasePatch.coverArtImageUrl && (
                <div className="flex items-center gap-3">
                  <img src={releasePatch.coverArtImageUrl} alt="cover" className="w-12 h-12 rounded-lg object-cover border border-white/10" />
                  <div>
                    <p className="text-[11px] text-zinc-400 font-medium">Cover Art</p>
                    <p className="text-[10px] text-zinc-600">from {releasePatch.itunesArt && !releasePatch.coverArtImageUrl?.includes('scdn') ? 'iTunes' : 'Spotify'}</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                {releasePatch.releaseDate && <div><span className="text-zinc-600">Release date </span><span className="text-zinc-300 font-medium">{releasePatch.releaseDate}</span></div>}
                {releasePatch.genre && <div><span className="text-zinc-600">Genre </span><span className="text-zinc-300 font-medium">{releasePatch.genre}</span></div>}
                {releasePatch.explicitContent !== undefined && <div><span className="text-zinc-600">Explicit </span><span className={`font-medium ${releasePatch.explicitContent ? 'text-red-400' : 'text-emerald-400'}`}>{releasePatch.explicitContent ? 'Yes' : 'No'}</span></div>}
                {releasePatch.features?.length && (
                  <div className="col-span-2">
                    <span className="text-zinc-600">Features </span>
                    <span className="text-violet-300 font-medium">{releasePatch.features.map(f => f.name).join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Per-track results */}
          {fetched && results.map((r, i) => (
            <div key={i} className="rounded-xl border border-white/8 bg-white/[0.015] overflow-hidden">
              <div className="px-3 py-2.5 border-b border-white/5 flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300 truncate">
                  {r.original.title || releaseTitle}
                  {tracks.length === 1 && ''}
                </span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {r.resolvedIsrc && (
                    <span className="text-[10px] font-mono text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">{r.resolvedIsrc}</span>
                  )}
                </div>
              </div>

              <div className="p-3 space-y-2.5">
                {/* Spotify */}
                {hasSpotify && (
                  r.spotifyError ? (
                    <div className="flex items-start gap-1.5 text-[11px] text-amber-400/90 bg-amber-500/8 px-2.5 py-2 rounded-lg">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      {r.spotifyError.includes('JSON') || r.spotifyError.toLowerCase().includes('auth') || r.spotifyError.includes('active pre')
                        ? 'Auth failed — check Client ID & Secret in Settings → AI & Integrations'
                        : r.spotifyError}
                    </div>
                  ) : r.spotify ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                        <span className="text-xs font-medium text-zinc-300 flex-1 truncate">{r.spotify.name}</span>
                        <a href={r.spotify.external_urls.spotify} target="_blank" rel="noreferrer" className="text-zinc-600 hover:text-emerald-400 transition-colors flex-shrink-0"><ExternalLink className="w-3 h-3" /></a>
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                        <div><span className="text-zinc-600">Artist </span><span className="text-zinc-300">{r.spotify.artists[0]?.name}</span></div>
                        <div><span className="text-zinc-600">Album </span><span className="text-zinc-400 truncate">{r.spotify.album.name}</span></div>
                        {r.featuredArtists?.length ? (
                          <div className="col-span-2">
                            <span className="text-zinc-600">Features </span>
                            <span className="text-violet-300 font-medium">{r.featuredArtists.join(', ')}</span>
                          </div>
                        ) : null}
                        <div>
                          <span className="text-zinc-600">Pop </span>
                          <span className="text-zinc-400">{r.spotify.popularity}/100</span>
                        </div>
                        <div>
                          {r.spotify.preview_url
                            ? <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />30s preview</span>
                            : <span className="text-zinc-700">No preview</span>}
                        </div>
                      </div>
                    </div>
                  ) : <p className="text-[11px] text-zinc-600 italic">Not found on Spotify</p>
                )}

                {/* YouTube */}
                {hasYouTube && r.youtube && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                    <span className="text-zinc-400 flex-1 truncate">{fmtNum(r.youtube.viewCount)} views · {r.youtube.title.slice(0, 40)}</span>
                    <a href={r.youtube.url} target="_blank" rel="noreferrer" className="text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0"><ExternalLink className="w-3 h-3" /></a>
                  </div>
                )}

                {/* Credits */}
                {Object.values(r.mergedCredits).some(v => v?.length) ? (
                  <div className="rounded-lg bg-white/[0.03] border border-white/5 p-2.5 space-y-2">
                    <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Credits</p>
                    {([
                      ['Produced by', r.mergedCredits.producedBy],
                      ['Mixed by',    r.mergedCredits.mixedBy],
                      ['Mastered by', r.mergedCredits.masteredBy],
                      ['Lyrics by',   r.mergedCredits.lyricsBy],
                      ['Arranged by', r.mergedCredits.arrangedBy],
                    ] as [string, string[] | undefined][]).filter(([, v]) => v?.length).map(([label, values]) => (
                      <div key={label} className="flex items-start gap-2">
                        <span className="text-[11px] text-zinc-600 w-20 flex-shrink-0 pt-0.5">{label}</span>
                        <div className="flex flex-wrap gap-1">
                          {values!.map((name, ni) => (
                            <span key={ni} className="text-[11px] bg-white/5 border border-white/8 text-zinc-200 px-2 py-0.5 rounded-full font-medium">
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-700 italic">
                    No credits found {!r.resolvedIsrc ? '— add ISRC for better results' : ''}
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Apply + Auto-save button */}
          {fetched && (
            applied ? (
              <div className={`flex items-center gap-2 text-xs px-3 py-2.5 rounded-xl border ${
                saveStatus === 'saved' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : saveStatus === 'saving' ? 'text-zinc-400 bg-zinc-800/60 border-white/5'
                : saveStatus === 'error' ? 'text-red-400 bg-red-500/10 border-red-500/20'
                : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              }`}>
                {saveStatus === 'saving'
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Saving to database…</>
                  : saveStatus === 'error'
                    ? <><AlertTriangle className="w-4 h-4" />Applied but save failed — hit Save Changes manually</>
                    : <><CheckCircle2 className="w-4 h-4" />Applied {releaseId ? '& saved automatically' : '— hit Save Changes to persist'}</>
                }
              </div>
            ) : (
              <button
                onClick={handleApplyAndSave}
                disabled={applying}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-sm font-semibold hover:bg-emerald-600/30 transition-all w-full justify-center disabled:opacity-50"
              >
                {applying
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Applying…</>
                  : <>
                      {releaseId ? <Save className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      Apply {anyCredits ? 'credits' : ''}{anyPreview ? ' + preview' : ''}{hasReleasePatch ? ' + release info' : ''}
                      {releaseId ? ' & save' : ''}
                    </>
                }
              </button>
            )
          )}

          {fetched && !applied && (
            <p className="text-[10px] text-zinc-700 text-center leading-relaxed">
              Only fills empty fields · Preserves exact casing (DROWN stays DROWN)
              {!anyPreview && hasSpotify ? ' · Spotify disabled preview_url for most tracks in 2023' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
