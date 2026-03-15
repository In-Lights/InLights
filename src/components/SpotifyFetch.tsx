/**
 * SpotifyFetch — grab real track data from Spotify + YouTube + MusicBrainz
 *
 * What gets fetched:
 *   Spotify  → track name, artists, album, release date, ISRC, popularity, 30s preview_url
 *              NOTE: producer/mixer/mastering credits are NOT in Spotify public API.
 *              We fall back to MusicBrainz (free, no key) for recording credits.
 *   YouTube  → video title, view count, description (often has producer credits)
 *   MusicBrainz → producer, mixer, mastering engineer via ISRC lookup
 *
 * What gets applied to tracks on "Apply":
 *   - spotifyPreviewUrl  → enables native audio player
 *   - spotifyTrackId     → deep link to Spotify
 *   - isrc               → if track had none
 *   - producedBy         → from MusicBrainz or YouTube description parse
 *   - mixedBy            → from MusicBrainz
 *   - masteredBy         → from MusicBrainz
 *   - lyricsBy           → from MusicBrainz (lyricist relation)
 *   - title              → confirmed title from Spotify
 */

import { useState } from 'react';
import {
  Loader2, CheckCircle2, AlertTriangle, ExternalLink,
  RefreshCw, ChevronDown, ChevronUp, Zap, Music2
} from 'lucide-react';
import { Track, AdminSettings } from '../types';
import { fetchSpotifyTrack, SpotifyTrack } from './TrackMetrics';

// ── MusicBrainz credit types we care about ───────────────────
interface MBRelation {
  type: string;
  artist?: { name: string; 'sort-name': string };
  attributes?: string[];
}
interface MBCredits {
  producedBy: string[];
  mixedBy: string[];
  masteredBy: string[];
  lyricsBy: string[];
  arrangedBy: string[];
}

// ── YouTube description producer credit patterns ──────────────
const CREDIT_PATTERNS: { keys: string[]; field: keyof MBCredits }[] = [
  { keys: ['produced by', 'production by', 'prod by', 'prod.'], field: 'producedBy' },
  { keys: ['mixed by', 'mix by', 'mixing by'],                  field: 'mixedBy' },
  { keys: ['mastered by', 'mastering by'],                      field: 'masteredBy' },
  { keys: ['lyrics by', 'written by', 'words by'],              field: 'lyricsBy' },
  { keys: ['arranged by', 'arrangement by'],                    field: 'arrangedBy' },
];

function parseCreditsFromText(text: string): Partial<MBCredits> {
  const result: Partial<MBCredits> = {};
  const lines = text.toLowerCase().split(/[\n\r|•·]/);
  for (const line of lines) {
    for (const { keys, field } of CREDIT_PATTERNS) {
      for (const key of keys) {
        const idx = line.indexOf(key);
        if (idx !== -1) {
          const raw = line.slice(idx + key.length).replace(/^[\s:–\-]+/, '').trim();
          if (raw.length > 1 && raw.length < 120) {
            // Split on common multi-name separators to get ALL names
            const names = raw
              .split(/,|\s&\s|\sand\s|\s\+\s|feat\.|ft\./)
              .map(n => n.trim().replace(/^[\s:]+|[\s.]+$/g, ''))
              .filter(n => n.length > 1 && n.length < 60)
              .map(n => n.replace(/\b\w/g, c => c.toUpperCase()));
            for (const name of names) {
              if (!result[field]) result[field] = [];
              if (!result[field]!.includes(name)) result[field]!.push(name);
            }
          }
        }
      }
    }
  }
  return result;
}

// ── MusicBrainz: look up recording credits by ISRC ───────────
async function fetchMusicBrainzCredits(isrc: string): Promise<Partial<MBCredits>> {
  try {
    // Step 1: find recording by ISRC
    const recRes = await fetch(
      `https://musicbrainz.org/ws/2/isrc/${encodeURIComponent(isrc)}?inc=recordings&fmt=json`,
      { headers: { 'User-Agent': 'InLightsLabelPortal/1.0 (admin@inlights.com)' } }
    );
    if (!recRes.ok) return {};
    const recData = await recRes.json();
    const recordingId = recData?.recordings?.[0]?.id;
    if (!recordingId) return {};

    // Step 2: get full recording with relations
    const relRes = await fetch(
      `https://musicbrainz.org/ws/2/recording/${recordingId}?inc=artist-rels&fmt=json`,
      { headers: { 'User-Agent': 'InLightsLabelPortal/1.0 (admin@inlights.com)' } }
    );
    if (!relRes.ok) return {};
    const relData = await relRes.json();
    const relations: MBRelation[] = relData?.relations ?? [];

    const credits: Partial<MBCredits> = {};
    for (const rel of relations) {
      const name = rel.artist?.name;
      if (!name) continue;
      const type = rel.type?.toLowerCase() ?? '';
      if (['producer', 'mix', 'mixer', 'production'].some(t => type.includes(t))) {
        if (!credits.producedBy) credits.producedBy = [];
        if (!credits.producedBy.includes(name)) credits.producedBy.push(name);
      }
      if (['mix', 'mixer', 'mixing'].some(t => type.includes(t)) && !type.includes('master')) {
        if (!credits.mixedBy) credits.mixedBy = [];
        if (!credits.mixedBy.includes(name)) credits.mixedBy.push(name);
      }
      if (['mastering', 'mastered'].some(t => type.includes(t))) {
        if (!credits.masteredBy) credits.masteredBy = [];
        if (!credits.masteredBy.includes(name)) credits.masteredBy.push(name);
      }
      if (['lyricist', 'lyrics', 'written-by'].some(t => type.includes(t))) {
        if (!credits.lyricsBy) credits.lyricsBy = [];
        if (!credits.lyricsBy.includes(name)) credits.lyricsBy.push(name);
      }
    }
    return credits;
  } catch {
    return {};
  }
}

// ── Spotify full track fetch (includes ISRC via external_ids) ─
async function fetchSpotifyFull(
  clientId: string,
  clientSecret: string,
  isrc: string | undefined,
  title: string,
  artist: string
): Promise<SpotifyTrack | null> {
  try {
    return await fetchSpotifyTrack(clientId, clientSecret, isrc, title, artist);
  } catch {
    return null;
  }
}

// ── YouTube search + description parse ───────────────────────
async function fetchYouTubeFull(
  apiKey: string,
  title: string,
  artist: string
): Promise<{
  videoId: string; title: string; url: string;
  viewCount: number; description: string; credits: Partial<MBCredits>;
} | null> {
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
    const credits = parseCreditsFromText(description);

    return {
      videoId,
      title: video.snippet?.title ?? '',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      viewCount: parseInt(video.statistics?.viewCount ?? '0', 10),
      description,
      credits,
    };
  } catch {
    return null;
  }
}

// ── Merged credits helper ─────────────────────────────────────
function mergeCredits(mb: Partial<MBCredits>, yt: Partial<MBCredits>): Partial<MBCredits> {
  const merge = (a?: string[], b?: string[]) => {
    const combined = [...(a ?? []), ...(b ?? [])];
    return [...new Set(combined)].filter(Boolean);
  };
  return {
    producedBy: merge(mb.producedBy, yt.producedBy),
    mixedBy:    merge(mb.mixedBy,    yt.mixedBy),
    masteredBy: merge(mb.masteredBy, yt.masteredBy),
    lyricsBy:   merge(mb.lyricsBy,   yt.lyricsBy),
    arrangedBy: merge(mb.arrangedBy, yt.arrangedBy),
  };
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

// ── Types ─────────────────────────────────────────────────────
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
  featuredArtists?: string[];
}

interface Props {
  tracks: Track[];
  mainArtist: string;
  releaseTitle: string;
  settings: AdminSettings;
  onApply: (updatedTracks: Track[]) => void;
}

// ── Component ─────────────────────────────────────────────────
export default function SpotifyFetch({ tracks, mainArtist, releaseTitle, settings, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [results, setResults] = useState<FetchedTrack[]>([]);
  const [fetched, setFetched] = useState(false);
  const [applied, setApplied] = useState(false);
  const [fetchStatus, setFetchStatus] = useState('');

  const hasSpotify = !!(settings.spotifyClientId && settings.spotifyClientSecret);
  const hasYouTube = !!settings.youtubeApiKey;
  if (!hasSpotify && !hasYouTube) return null;

  const doFetch = async () => {
    setFetching(true);
    setFetched(false);
    setApplied(false);
    setFetchStatus('');

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

        setFetchStatus(`Fetching track ${i + 1}/${tracks.length}…`);

        // 1. Spotify
        if (hasSpotify) {
          try {
            result.spotify = await fetchSpotifyFull(
              settings.spotifyClientId,
              settings.spotifyClientSecret,
              track.isrc, title, mainArtist
            );
            const sp = result.spotify as SpotifyTrack & { external_ids?: { isrc?: string } };
            result.resolvedIsrc = track.isrc || sp?.external_ids?.isrc;
            // Extract featured artists (all artists beyond the first = features)
            if (sp?.artists && sp.artists.length > 1) {
              result.featuredArtists = sp.artists.slice(1).map(a => a.name);
            }
          } catch (e) {
            result.spotifyError = e instanceof Error ? e.message : 'Spotify fetch failed';
          }
        }

        // 2. MusicBrainz (uses ISRC — try track ISRC first, then Spotify-resolved)
        const isrcToUse = result.resolvedIsrc || track.isrc;
        if (isrcToUse) {
          setFetchStatus(`Looking up credits for track ${i + 1}…`);
          result.mbCredits = await fetchMusicBrainzCredits(isrcToUse);
        }

        // 3. YouTube (also parses description for credits)
        if (hasYouTube) {
          try {
            result.youtube = await fetchYouTubeFull(settings.youtubeApiKey, title, mainArtist);
          } catch (e) {
            result.youtubeError = e instanceof Error ? e.message : 'YouTube fetch failed';
          }
        }

        // 4. Merge credits from all sources
        result.mergedCredits = mergeCredits(
          result.mbCredits,
          result.youtube?.credits ?? {}
        );

        return result;
      })
    );

    setResults(out);
    setFetching(false);
    setFetched(true);
    setFetchStatus('');
  };

  const handleApply = () => {
    const updated = tracks.map((track, i) => {
      const r = results.find(r => r.trackIndex === i);
      if (!r) return track;

      const patch: Partial<Track> = {};

      // Spotify data
      if (r.spotify) {
        if (r.spotify.preview_url) patch.spotifyPreviewUrl = r.spotify.preview_url;
        patch.spotifyTrackId = r.spotify.id;
        // Fill ISRC if empty
        const sp = r.spotify as SpotifyTrack & { external_ids?: { isrc?: string } };
        if (!track.isrc && sp.external_ids?.isrc) {
          patch.isrc = sp.external_ids.isrc;
        }
      }

      // Credits — merge fetched names with existing, dedup, preserve order
      const c = r.mergedCredits;
      const mergeField = (existing: string, fetched?: string[]) => {
        if (!fetched?.length) return existing;
        const existingList = existing ? existing.split('|').map(s => s.trim()).filter(Boolean) : [];
        const merged = [...existingList];
        for (const name of fetched) {
          const norm = name.trim();
          if (norm && !merged.some(e => e.toLowerCase() === norm.toLowerCase())) {
            merged.push(norm);
          }
        }
        return merged.join('|');
      };
      if (c.producedBy?.length) patch.producedBy = mergeField(track.producedBy || '', c.producedBy);
      if (c.mixedBy?.length)    patch.mixedBy    = mergeField(track.mixedBy    || '', c.mixedBy);
      if (c.masteredBy?.length) patch.masteredBy = mergeField(track.masteredBy || '', c.masteredBy);
      if (c.lyricsBy?.length)   patch.lyricsBy   = mergeField(track.lyricsBy   || '', c.lyricsBy);

      return { ...track, ...patch };
    });
    onApply(updated);
    setApplied(true);
  };

  const anyPreview = results.some(r => r.spotify?.preview_url);
  const anyCredits = results.some(r => Object.values(r.mergedCredits).some(v => v?.length));

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
              Credits, ISRC, preview · {[hasSpotify && 'Spotify', 'MusicBrainz', hasYouTube && 'YouTube'].filter(Boolean).join(' + ')}
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-zinc-600" /> : <ChevronDown className="w-4 h-4 text-zinc-600" />}
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
              : <><RefreshCw className="w-4 h-4" />{fetched ? 'Re-fetch' : 'Fetch Credits & Preview'}</>
            }
          </button>

          {/* Per-track results */}
          {fetched && results.map((r, i) => (
            <div key={i} className="rounded-xl border border-white/8 bg-white/[0.015] overflow-hidden">
              {/* Track header */}
              <div className="px-3 py-2.5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Music2 className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                  <span className="text-xs font-bold text-zinc-300 truncate">
                    {r.original.title || releaseTitle}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {r.resolvedIsrc && (
                    <span className="text-[10px] font-mono text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">
                      {r.resolvedIsrc}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 space-y-3">
                {/* Spotify row */}
                {hasSpotify && (
                  <div className="space-y-1">
                    {r.spotifyError ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-400/90 bg-amber-500/8 px-2.5 py-2 rounded-lg">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                        <span>{r.spotifyError.includes('JSON') || r.spotifyError.includes('token')
                          ? 'Auth failed — check Client ID & Secret in Settings → AI & Integrations'
                          : r.spotifyError}</span>
                      </div>
                    ) : r.spotify ? (
                      <div className="space-y-2">
                        {/* Track match */}
                        <div className="flex items-center gap-2">
                          <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="#1DB954">
                            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                          </svg>
                          <span className="text-xs font-medium text-zinc-300 flex-1 truncate">{r.spotify.name}</span>
                          <a href={r.spotify.external_urls.spotify} target="_blank" rel="noreferrer"
                            className="text-zinc-600 hover:text-emerald-400 flex-shrink-0 transition-colors">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>

                        {/* All artists */}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] pl-0">
                          <div>
                            <span className="text-zinc-600">Main artist</span>
                            <p className="text-zinc-300 font-medium">{r.spotify.artists[0]?.name}</p>
                          </div>
                          {r.featuredArtists && r.featuredArtists.length > 0 && (
                            <div>
                              <span className="text-zinc-600">
                                {r.featuredArtists.length > 1 ? `Features (${r.featuredArtists.length})` : 'Feature'}
                              </span>
                              <p className="text-violet-300 font-medium">{r.featuredArtists.join(', ')}</p>
                            </div>
                          )}
                          <div>
                            <span className="text-zinc-600">Album</span>
                            <p className="text-zinc-400 truncate">{r.spotify.album.name}</p>
                          </div>
                          <div>
                            <span className="text-zinc-600">Popularity</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className="flex-1 h-1 bg-zinc-800 rounded-full max-w-[50px]">
                                <div className="h-1 bg-emerald-500 rounded-full" style={{ width: `${r.spotify.popularity}%` }} />
                              </div>
                              <span className="text-zinc-400">{r.spotify.popularity}/100</span>
                            </div>
                          </div>
                        </div>

                        {/* Preview status */}
                        <div className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg ${r.spotify.preview_url ? 'bg-emerald-500/8 text-emerald-400' : 'bg-zinc-800/60 text-zinc-600'}`}>
                          {r.spotify.preview_url
                            ? <><CheckCircle2 className="w-3 h-3 flex-shrink-0" /> 30s preview available — player will use Spotify</>
                            : <><AlertTriangle className="w-3 h-3 flex-shrink-0" /> No preview (Spotify has disabled preview_url for most tracks since 2023)</>}
                        </div>
                      </div>
                    ) : <p className="text-[11px] text-zinc-600 italic">Not found on Spotify</p>}
                  </div>
                )}

                {/* YouTube row */}
                {hasYouTube && r.youtube && !r.youtubeError && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="#FF0000">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    <span className="text-zinc-400 flex-1 truncate">{fmtNum(r.youtube.viewCount)} views · {r.youtube.title.slice(0, 45)}</span>
                    <a href={r.youtube.url} target="_blank" rel="noreferrer"
                      className="text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* Credits section */}
                {(Object.values(r.mergedCredits).some(v => v?.length)) ? (
                  <div className="rounded-lg bg-white/[0.03] border border-white/5 p-2.5 space-y-2">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      Credits found
                      <span className="ml-1.5 text-zinc-700 font-normal normal-case">
                        (MusicBrainz{r.youtube?.credits && Object.values(r.youtube.credits).some(v => v?.length) ? ' + YouTube desc' : ''})
                      </span>
                    </p>
                    {([
                      ['Produced by',  r.mergedCredits.producedBy],
                      ['Mixed by',     r.mergedCredits.mixedBy],
                      ['Mastered by',  r.mergedCredits.masteredBy],
                      ['Lyrics by',    r.mergedCredits.lyricsBy],
                      ['Arranged by',  r.mergedCredits.arrangedBy],
                    ] as [string, string[] | undefined][]).filter(([, v]) => v?.length).map(([label, values]) => (
                      <div key={label} className="flex items-start gap-2">
                        <span className="text-[11px] text-zinc-600 w-20 flex-shrink-0 pt-0.5">{label}</span>
                        <div className="flex flex-wrap gap-1">
                          {values!.map((name, ni) => (
                            <span key={ni} className="text-[11px] bg-white/5 border border-white/8 text-zinc-300 px-2 py-0.5 rounded-full font-medium">
                              {name}
                            </span>
                          ))}
                          {values!.length > 1 && (
                            <span className="text-[10px] text-zinc-700 self-center">({values!.length})</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-zinc-700 italic">
                    No credits found — ISRC {r.resolvedIsrc ? 'looked up on MusicBrainz, no entries' : 'missing (needed for credit lookup)'}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Apply */}
          {fetched && (
            <div className="space-y-2">
              {applied ? (
                <div className="flex items-center gap-2 text-xs text-emerald-400 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4" />
                  Applied — credits, ISRC{anyPreview ? ', and Spotify preview' : ''} written to tracks. Hit Save Changes to persist.
                </div>
              ) : (
                <button
                  onClick={handleApply}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-600/30 transition-all w-full justify-center"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Apply — fill credits{anyPreview ? ' + enable Spotify preview' : ''}
                  {anyCredits ? '' : ' (no credits found — will still apply ISRC/preview)'}
                </button>
              )}
              <p className="text-[10px] text-zinc-700 text-center leading-relaxed">
                Only fills empty fields. Won't overwrite credits you've already entered.
                {!anyPreview && hasSpotify && ' Spotify has disabled preview_url for most tracks since 2023.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
