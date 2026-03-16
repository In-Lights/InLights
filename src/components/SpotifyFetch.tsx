/**
 * SpotifyFetch — comprehensive streaming data grab
 *
 * Sources:
 *   Spotify   → track name, all artists, album artists, ISRC, explicit,
 *               cover art, release date, popularity, 30s preview
 *   MusicBrainz → producer, mixer, mastering, lyricist (by ISRC)
 *   YouTube   → view count + description credit parsing
 *   iTunes    → genre (primary), artwork fallback, release date fallback
 *
 * Artist logic:
 *   track.artists[0]         → main artist (already known)
 *   track.artists[1+]        → featured artists on THIS track → features[]
 *   album.artists (distinct) → collaborative release artists → collaborations[]
 *   e.g. joint EP "A & B": album.artists = [A, B], both are collaborators
 *
 * EP/Album awareness:
 *   - Searches each track by its own title + artists for accurate YouTube match
 *   - Collects all unique featured artists across all tracks
 *   - Collects album-level collaborators once from any track's album.artists
 *   - Release date / art / genre taken from first track's album (consistent)
 *
 * Casing: exact as returned — "DROWN" stays "DROWN"
 * Merges: never overwrites existing values, dedupes case-insensitively
 * Auto-saves via updateSubmission when releaseId provided
 */

import { useState } from 'react';
import {
  Loader2, CheckCircle2, AlertTriangle, ExternalLink,
  RefreshCw, ChevronDown, ChevronUp, Zap, Save, Users, Music2
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
  { keys: ['produced by', 'production by', 'prod by', 'prod.', 'produced:', 'beats by'], field: 'producedBy' },
  { keys: ['mixed by', 'mix by', 'mixing by', 'mixed:'],                                  field: 'mixedBy' },
  { keys: ['mastered by', 'mastering by', 'mastered:', 'mastering:'],                     field: 'masteredBy' },
  { keys: ['lyrics by', 'written by', 'words by', 'lyrics:', 'written:'],                 field: 'lyricsBy' },
  { keys: ['arranged by', 'arrangement by', 'arranged:'],                                 field: 'arrangedBy' },
];

// Preserve exact casing from source text
function parseCreditsFromText(text: string): Partial<MBCredits> {
  const result: Partial<MBCredits> = {};
  const lines = text.split(/[\n\r|•·]/);
  for (const line of lines) {
    const lineLow = line.toLowerCase();
    for (const { keys, field } of CREDIT_PATTERNS) {
      for (const key of keys) {
        const idx = lineLow.indexOf(key);
        if (idx !== -1) {
          const raw = line.slice(idx + key.length).replace(/^[\s:–\-]+/, '').trim();
          if (raw.length > 1 && raw.length < 120) {
            const names = raw
              .split(/,|\s&\s|\sand\s|\s\+\s|feat\.|ft\./i)
              .map(n => n.trim().replace(/^[\s:]+|[\s.()\[\]]+$/g, ''))
              .filter(n => n.length > 1 && n.length < 60);
            for (const name of names) {
              if (!result[field]) result[field] = [];
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

function mergeCredits(a: Partial<MBCredits>, b: Partial<MBCredits>): Partial<MBCredits> {
  const merge = (x?: string[], y?: string[]) => {
    const out = [...(x ?? [])];
    for (const n of (y ?? [])) {
      if (!out.some(e => e.toLowerCase() === n.toLowerCase())) out.push(n);
    }
    return out.filter(Boolean);
  };
  return {
    producedBy: merge(a.producedBy, b.producedBy),
    mixedBy:    merge(a.mixedBy,    b.mixedBy),
    masteredBy: merge(a.masteredBy, b.masteredBy),
    lyricsBy:   merge(a.lyricsBy,   b.lyricsBy),
    arrangedBy: merge(a.arrangedBy, b.arrangedBy),
  };
}

function mergeStringField(existing: string, incoming?: string[]): string {
  if (!incoming?.length) return existing;
  const list = existing ? existing.split('|').map(s => s.trim()).filter(Boolean) : [];
  for (const name of incoming) {
    if (name && !list.some(e => e.toLowerCase() === name.toLowerCase())) list.push(name);
  }
  return list.join('|');
}

function mergeCollabs(existing: Collaborator[], incoming: string[], role = 'artist'): Collaborator[] {
  const out = [...existing];
  for (const name of incoming) {
    if (name && !out.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      out.push({ name, role, platformLinks: { spotify: '', appleMusic: '', anghami: '' } });
    }
  }
  return out;
}

function mapGenre(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('hip') || r.includes('rap'))                           return 'Hip-Hop/Rap';
  if (r.includes('r&b') || r.includes('soul') || r.includes('rhythm')) return 'R&B/Soul';
  if (r.includes('electronic') || r.includes('dance') || r.includes('edm')) return 'Electronic/Dance';
  if (r.includes('afro'))                                               return 'Afrobeats';
  if (r.includes('reggaeton'))                                          return 'Reggaeton';
  if (r.includes('latin'))                                              return 'Latin';
  if (r.includes('k-pop') || r.includes('kpop'))                       return 'K-Pop';
  if (r.includes('classical') || r.includes('orchestral'))             return 'Classical';
  if (r.includes('jazz'))                                               return 'Jazz';
  if (r.includes('country'))                                            return 'Country';
  if (r.includes('folk'))                                               return 'Folk';
  if (r.includes('gospel') || r.includes('christian'))                 return 'Gospel';
  if (r.includes('blues'))                                              return 'Blues';
  if (r.includes('metal') || r.includes('heavy'))                      return 'Metal';
  if (r.includes('punk'))                                               return 'Punk';
  if (r.includes('rock'))                                               return 'Rock';
  if (r.includes('indie'))                                              return 'Indie';
  if (r.includes('alternative') || r.includes('alt'))                  return 'Alternative';
  if (r.includes('pop'))                                                return 'Pop';
  const direct = GENRES.find(g => g.toLowerCase() === r);
  if (direct) return direct;
  return raw;
}

// ── MusicBrainz ───────────────────────────────────────────────
async function fetchMusicBrainzCredits(isrc: string): Promise<Partial<MBCredits>> {
  try {
    await new Promise(r => setTimeout(r, 300));
    const recRes = await fetch(
      `https://musicbrainz.org/ws/2/isrc/${encodeURIComponent(isrc)}?inc=recordings&fmt=json`,
      { headers: { 'User-Agent': 'InLightsLabelPortal/1.0 (admin@inlights.com)' } }
    );
    if (!recRes.ok) return {};
    const recData = await recRes.json();
    const recordingId = recData?.recordings?.[0]?.id;
    if (!recordingId) return {};

    await new Promise(r => setTimeout(r, 300));
    const relRes = await fetch(
      `https://musicbrainz.org/ws/2/recording/${recordingId}?inc=artist-rels&fmt=json`,
      { headers: { 'User-Agent': 'InLightsLabelPortal/1.0 (admin@inlights.com)' } }
    );
    if (!relRes.ok) return {};
    const relData = await relRes.json();
    const relations: { type: string; artist?: { name: string } }[] = relData?.relations ?? [];

    const credits: Partial<MBCredits> = {};
    for (const rel of relations) {
      const name = rel.artist?.name;
      if (!name) continue;
      const type = (rel.type ?? '').toLowerCase();
      const add = (field: keyof MBCredits) => {
        if (!credits[field]) credits[field] = [];
        if (!credits[field]!.includes(name)) credits[field]!.push(name);
      };
      if (type.includes('producer') || type === 'production') add('producedBy');
      if (type.includes('mix') && !type.includes('master'))   add('mixedBy');
      if (type.includes('master'))                            add('masteredBy');
      if (type.includes('lyricist') || type.includes('written-by')) add('lyricsBy');
      if (type.includes('arrang'))                            add('arrangedBy');
    }
    return credits;
  } catch { return {}; }
}

// ── YouTube ───────────────────────────────────────────────────
async function fetchYouTubeFull(
  apiKey: string,
  title: string,
  artists: string   // e.g. "L'ASTRO feat. DROWN" — use full artist string for better match
) {
  try {
    const q = encodeURIComponent(`${title} ${artists}`);
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
      title: (video.snippet?.title ?? '') as string,
      channelTitle: (video.snippet?.channelTitle ?? '') as string,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      viewCount: parseInt(video.statistics?.viewCount ?? '0', 10),
      description,
      credits: parseCreditsFromText(description),
    };
  } catch { return null; }
}

// ── iTunes ────────────────────────────────────────────────────
async function fetchItunes(title: string, artist: string) {
  try {
    const term = encodeURIComponent(`${title} ${artist}`);
    const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=3`);
    if (!res.ok) return null;
    const data = await res.json();
    // Find best match
    const results = data?.results ?? [];
    const best = results.find((r: Record<string, unknown>) =>
      (r.trackName as string)?.toLowerCase() === title.toLowerCase()
    ) ?? results[0];
    if (!best) return null;
    return {
      genre: best.primaryGenreName as string ?? null,
      artworkUrl: ((best.artworkUrl100 as string) ?? '').replace('100x100', '600x600'),
      releaseDate: ((best.releaseDate as string) ?? '').slice(0, 10),
      trackName: best.trackName as string,
      artistName: best.artistName as string,
    };
  } catch { return null; }
}

// ── Per-track result type ─────────────────────────────────────
interface FetchedTrack {
  trackIndex: number;
  original: Track;
  trackTitle: string;               // effective title used for search
  spotify: (SpotifyTrack & { external_ids?: { isrc?: string } }) | null;
  spotifyError?: string;
  youtube: ReturnType<typeof parseCreditsFromText> extends infer C ? {
    videoId: string; title: string; channelTitle: string;
    url: string; viewCount: number; description: string; credits: C;
  } | null : null;
  youtubeError?: string;
  mbCredits: Partial<MBCredits>;
  mergedCredits: Partial<MBCredits>;
  resolvedIsrc?: string;
  trackFeatures: string[];     // artists[1+] on this specific track
  albumCollabs: string[];      // album.artists that differ from mainArtist
  albumArtUrl?: string;
  releaseDate?: string;
  trackExplicit?: boolean;
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
  releaseId?: string;
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
  const [releasePatch, setReleasePatch] = useState<ReleaseFieldPatch & { _itunesSource?: boolean }>({});
  const [fetched, setFetched] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'saved'|'error'>('idle');
  const [fetchStatus, setFetchStatus] = useState('');

  const hasSpotify = !!(settings.spotifyClientId && settings.spotifyClientSecret);
  const hasYouTube = !!settings.youtubeApiKey;
  if (!hasSpotify && !hasYouTube) return null;

  const doFetch = async () => {
    setFetching(true); setFetched(false); setApplied(false);
    setSaveStatus('idle'); setFetchStatus('');

    const rPatch: typeof releasePatch = {};

    // Track all featured artists and collaborators found across all tracks
    const allTrackFeatures: string[] = [];
    const allAlbumCollabs: string[] = [];

    // Fetch tracks sequentially to avoid rate limits (MusicBrainz is strict)
    const out: FetchedTrack[] = [];
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const trackTitle = track.title || (tracks.length === 1 ? releaseTitle : `Track ${i + 1}`);

      const result: FetchedTrack = {
        trackIndex: i,
        original: track,
        trackTitle,
        spotify: null,
        youtube: null,
        mbCredits: {},
        mergedCredits: {},
        trackFeatures: [],
        albumCollabs: [],
      };

      setFetchStatus(`Track ${i + 1}/${tracks.length}: ${trackTitle} — Spotify…`);

      // ── 1. Spotify ──────────────────────────────────────────
      if (hasSpotify) {
        try {
          result.spotify = await fetchSpotifyTrack(
            settings.spotifyClientId,
            settings.spotifyClientSecret,
            track.isrc, trackTitle, mainArtist
          ) as typeof result.spotify;

          if (result.spotify) {
            const sp = result.spotify;
            result.resolvedIsrc = track.isrc || sp.external_ids?.isrc;

            // Track-level featured artists = artists[1+] (exact casing)
            if (sp.artists.length > 1) {
              result.trackFeatures = sp.artists
                .slice(1)
                .map(a => a.name)
                .filter(n => n.toLowerCase() !== mainArtist.toLowerCase());
            }

            // Album-level collaborators = album.artists that aren't the main artist
            // This catches joint releases: "A & B" EP where both share album credit
            const albumArtists: { name: string }[] = (sp.album as unknown as { artists?: { name: string }[] }).artists ?? [];
            result.albumCollabs = albumArtists
              .map(a => a.name)
              .filter(n => n.toLowerCase() !== mainArtist.toLowerCase()
                        && !result.trackFeatures.some(f => f.toLowerCase() === n.toLowerCase()));

            // Accumulate across tracks (dedup)
            for (const n of result.trackFeatures) {
              if (!allTrackFeatures.some(e => e.toLowerCase() === n.toLowerCase())) allTrackFeatures.push(n);
            }
            for (const n of result.albumCollabs) {
              if (!allAlbumCollabs.some(e => e.toLowerCase() === n.toLowerCase())) allAlbumCollabs.push(n);
            }

            // Album art (highest res) — use first track's album
            if (i === 0 && sp.album?.images?.length) {
              result.albumArtUrl = sp.album.images[0].url;
              if (!currentRelease?.coverArtImageUrl) {
                rPatch.coverArtImageUrl = sp.album.images[0].url;
              }
            }
            // Release date
            if (i === 0 && sp.album?.release_date && !currentRelease?.releaseDate) {
              result.releaseDate = sp.album.release_date;
              rPatch.releaseDate = sp.album.release_date.slice(0, 10);
            }
            // Explicit
            result.trackExplicit = sp.explicit;
            if (i === 0 && typeof sp.explicit === 'boolean' && currentRelease?.explicitContent === undefined) {
              rPatch.explicitContent = sp.explicit;
            }
          }
        } catch (e) {
          result.spotifyError = e instanceof Error ? e.message : 'Spotify failed';
        }
      }

      // ── 2. MusicBrainz credits ──────────────────────────────
      const isrcToUse = result.resolvedIsrc || track.isrc;
      if (isrcToUse) {
        setFetchStatus(`Track ${i + 1}/${tracks.length}: ${trackTitle} — MusicBrainz…`);
        result.mbCredits = await fetchMusicBrainzCredits(isrcToUse);
      }

      // ── 3. YouTube — use full artist string for better match ─
      if (hasYouTube) {
        setFetchStatus(`Track ${i + 1}/${tracks.length}: ${trackTitle} — YouTube…`);
        try {
          const featStr = result.trackFeatures.length
            ? ` feat. ${result.trackFeatures.join(', ')}`
            : '';
          result.youtube = await fetchYouTubeFull(
            settings.youtubeApiKey,
            trackTitle,
            mainArtist + featStr
          );
        } catch (e) {
          result.youtubeError = e instanceof Error ? e.message : 'YouTube failed';
        }
      }

      // ── 3b. Spotify retry using Latin name from YouTube title ─
      // Arabic/non-Latin tracks are often on Spotify under their Latin transliteration.
      // e.g. "بصحى" → YouTube title shows "BAS7A" → search Spotify for "BAS7A L'ASTRO"
      if (!result.spotify && hasSpotify && result.youtube?.title && /[^\u0000-\u007F]/.test(trackTitle)) {
        try {
          // Extract the Latin segment from the YouTube title
          // YouTube titles for Arabic tracks often look like: "آسترو - بصحى | L'ASTRO - BAS7A"
          // Split on | or - and find the all-Latin segment
          const ytTitle = result.youtube.title;
          const segments = ytTitle.split(/[|\u2013\u2014]/).map((s: string) => s.trim());
          const latinSegment = segments.find((s: string) =>
            /^[a-zA-Z0-9\s'"\-&!?.,()[\]]+$/.test(s.trim()) && s.trim().length > 1
          );
          // Also try stripping the artist name to get just the track name
          const latinTitle = latinSegment
            ? latinSegment.replace(new RegExp(mainArtist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim().replace(/^[-\s]+|[-\s]+$/g, '').trim()
            : null;

          if (latinTitle && latinTitle.length > 0) {
            setFetchStatus(`Track ${i + 1}/${tracks.length}: retrying Spotify as "${latinTitle}"…`);
            result.spotify = await fetchSpotifyTrack(
              settings.spotifyClientId,
              settings.spotifyClientSecret,
              track.isrc, latinTitle, mainArtist
            ) as typeof result.spotify;

            if (result.spotify) {
              const sp = result.spotify;
              result.resolvedIsrc = track.isrc || sp.external_ids?.isrc;
              if (sp.artists.length > 1) {
                result.trackFeatures = sp.artists.slice(1).map((a: { name: string }) => a.name)
                  .filter((n: string) => n.toLowerCase() !== mainArtist.toLowerCase());
              }
              if (i === 0 && sp.album?.images?.length && !currentRelease?.coverArtImageUrl) {
                rPatch.coverArtImageUrl = sp.album.images[0].url;
              }
              if (i === 0 && sp.album?.release_date && !currentRelease?.releaseDate) {
                rPatch.releaseDate = sp.album.release_date.slice(0, 10);
              }
              result.trackExplicit = sp.explicit;
            }
          }
        } catch { /* silent — keep YouTube result */ }
      }

      // ── 4. Merge credits ─────────────────────────────────────
      result.mergedCredits = mergeCredits(result.mbCredits, result.youtube?.credits ?? {});

      out.push(result);
    }

    // ── 5. iTunes — genre + artwork fallback ──────────────────
    setFetchStatus('Fetching genre from iTunes…');
    const itunesTitle = tracks.length === 1 ? (tracks[0].title || releaseTitle) : releaseTitle;
    const itunes = await fetchItunes(itunesTitle, mainArtist);
    if (itunes?.genre && !currentRelease?.genre) {
      rPatch.genre = mapGenre(itunes.genre);
    }
    if (itunes?.artworkUrl && !rPatch.coverArtImageUrl && !currentRelease?.coverArtImageUrl) {
      rPatch.coverArtImageUrl = itunes.artworkUrl;
      rPatch._itunesSource = true;
    }
    if (itunes?.releaseDate && !rPatch.releaseDate && !currentRelease?.releaseDate) {
      rPatch.releaseDate = itunes.releaseDate;
    }

    // ── 6. Build features (track-level featured artists) ──────
    if (allTrackFeatures.length > 0) {
      const existing = currentRelease?.features ?? [];
      const merged = mergeCollabs(existing, allTrackFeatures, 'artist');
      if (merged.length > existing.length || merged.some((m, i) => m.name !== existing[i]?.name)) {
        rPatch.features = merged;
      }
    }

    // ── 7. Build collaborations (album-level joint artists) ───
    if (allAlbumCollabs.length > 0) {
      const existing = currentRelease?.collaborations ?? [];
      const merged = mergeCollabs(existing, allAlbumCollabs, 'artist');
      if (merged.length > existing.length || merged.some((m, i) => m.name !== existing[i]?.name)) {
        rPatch.collaborations = merged;
      }
    }

    setResults(out);
    setReleasePatch(rPatch);
    setFetching(false);
    setFetched(true);
    setFetchStatus('');
  };

  const handleApplyAndSave = async () => {
    setApplying(true);

    // Build updated tracks
    const updatedTracks = tracks.map((track, i) => {
      const r = results.find(r => r.trackIndex === i);
      if (!r) return track;
      const patch: Partial<Track> = {};

      if (r.spotify) {
        if (r.spotify.preview_url)    patch.spotifyPreviewUrl = r.spotify.preview_url;
        if (r.spotify.id)             patch.spotifyTrackId    = r.spotify.id;
        if (!track.isrc && r.spotify.external_ids?.isrc) patch.isrc = r.spotify.external_ids.isrc;
        // Fill explicit per track
        if (r.trackExplicit !== undefined && track.explicit === false) {
          patch.explicit = r.trackExplicit;
        }
        // Fill track title if empty (EP/album tracks sometimes lack titles)
        if (!track.title && r.trackTitle && r.trackTitle !== releaseTitle) {
          patch.title = r.spotify.name; // use exact Spotify casing
        }
      }

      const c = r.mergedCredits;
      if (c.producedBy?.length) patch.producedBy = mergeStringField(track.producedBy || '', c.producedBy);
      if (c.mixedBy?.length)    patch.mixedBy    = mergeStringField(track.mixedBy    || '', c.mixedBy);
      if (c.masteredBy?.length) patch.masteredBy = mergeStringField(track.masteredBy || '', c.masteredBy);
      if (c.lyricsBy?.length)   patch.lyricsBy   = mergeStringField(track.lyricsBy   || '', c.lyricsBy);
      if (c.arrangedBy?.length) {
        const existing = track.additionalCredits ?? [];
        const updated = [...existing];
        for (const name of c.arrangedBy) {
          if (!updated.some(e => e.role === 'Arranged by' && e.name.toLowerCase() === name.toLowerCase())) {
            updated.push({ role: 'Arranged by', name });
          }
        }
        if (updated.length > existing.length) patch.additionalCredits = updated;
      }

      return { ...track, ...patch };
    });

    // Build release patch
    const rp: ReleaseFieldPatch = {};
    if (releasePatch.coverArtImageUrl)                    rp.coverArtImageUrl = releasePatch.coverArtImageUrl;
    if (releasePatch.releaseDate)                         rp.releaseDate      = releasePatch.releaseDate;
    if (releasePatch.genre)                               rp.genre            = releasePatch.genre;
    if (releasePatch.explicitContent !== undefined)       rp.explicitContent  = releasePatch.explicitContent;
    if (releasePatch.features?.length)                    rp.features         = releasePatch.features;
    if (releasePatch.collaborations?.length)              rp.collaborations   = releasePatch.collaborations;

    // Update UI
    onApply(updatedTracks);
    if (onApplyRelease) onApplyRelease(rp);

    // Auto-save
    if (releaseId) {
      setSaveStatus('saving');
      try {
        await updateSubmission(releaseId, {
          tracks: updatedTracks,
          ...(rp.coverArtImageUrl   ? { coverArtImageUrl: rp.coverArtImageUrl }                 : {}),
          ...(rp.releaseDate        ? { releaseDate:      rp.releaseDate }                       : {}),
          ...(rp.genre              ? { genre:            rp.genre }                             : {}),
          ...(rp.explicitContent !== undefined ? { explicitContent: rp.explicitContent }         : {}),
          ...(rp.features           ? { features:         rp.features }                          : {}),
          ...(rp.collaborations     ? { collaborations:   rp.collaborations }                    : {}),
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

  const anyPreview  = results.some(r => r.spotify?.preview_url);
  const anyCredits  = results.some(r => Object.values(r.mergedCredits).some(v => v?.length));
  const hasRPatch   = !!(
    releasePatch.coverArtImageUrl || releasePatch.releaseDate ||
    releasePatch.genre || releasePatch.features?.length ||
    releasePatch.collaborations?.length || releasePatch.explicitContent !== undefined
  );

  // Collect all unique features + collabs for summary display
  const allFoundFeatures  = results.flatMap(r => r.trackFeatures);
  const uniqueFeatures    = [...new Set(allFoundFeatures.map(n => n.toLowerCase()))].map(low =>
    allFoundFeatures.find(n => n.toLowerCase() === low)!
  );
  const allFoundCollabs   = results.flatMap(r => r.albumCollabs);
  const uniqueCollabs     = [...new Set(allFoundCollabs.map(n => n.toLowerCase()))].map(low =>
    allFoundCollabs.find(n => n.toLowerCase() === low)!
  );

  return (
    <div className="rounded-xl border border-violet-500/20 overflow-hidden">
      {/* Header */}
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-violet-500/15 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-zinc-300">Grab from Streaming</p>
            <p className="text-[10px] text-zinc-600">Credits · Preview · Art · Date · Genre · Features · Collabs</p>
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
          <button onClick={doFetch} disabled={fetching}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 text-sm font-medium hover:bg-violet-600/30 transition-all disabled:opacity-50 w-full justify-center">
            {fetching
              ? <><Loader2 className="w-4 h-4 animate-spin" /><span className="truncate max-w-[220px]">{fetchStatus || 'Fetching…'}</span></>
              : <><RefreshCw className="w-4 h-4" />{fetched ? 'Re-fetch' : 'Fetch Everything'}</>}
          </button>

          {/* Release-level summary */}
          {fetched && hasRPatch && (
            <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 p-3 space-y-2.5">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Release — fields to fill</p>

              {/* Cover art */}
              {releasePatch.coverArtImageUrl && (
                <div className="flex items-center gap-3">
                  <img src={releasePatch.coverArtImageUrl} alt="cover" className="w-14 h-14 rounded-xl object-cover border border-white/10 flex-shrink-0" />
                  <div>
                    <p className="text-[11px] text-zinc-300 font-medium">Cover Art</p>
                    <p className="text-[10px] text-zinc-600">from {releasePatch._itunesSource ? 'iTunes' : 'Spotify'} · will set as preview image</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                {releasePatch.releaseDate && (
                  <div><span className="text-zinc-600">Release date </span><span className="text-zinc-300 font-medium">{releasePatch.releaseDate}</span></div>
                )}
                {releasePatch.genre && (
                  <div><span className="text-zinc-600">Genre </span><span className="text-zinc-300 font-medium">{releasePatch.genre}</span></div>
                )}
                {releasePatch.explicitContent !== undefined && (
                  <div><span className="text-zinc-600">Explicit </span><span className={`font-medium ${releasePatch.explicitContent ? 'text-red-400' : 'text-emerald-400'}`}>{releasePatch.explicitContent ? 'Yes' : 'No'}</span></div>
                )}
              </div>

              {/* Features */}
              {uniqueFeatures.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                    <Music2 className="w-3 h-3" />
                    <span className="font-bold uppercase tracking-wider">Featured Artists ({uniqueFeatures.length})</span>
                    <span className="text-zinc-700">→ features[ ]</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {uniqueFeatures.map((name, i) => (
                      <span key={i} className="text-[11px] bg-violet-500/10 border border-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full font-medium">{name}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Collaborators */}
              {uniqueCollabs.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                    <Users className="w-3 h-3" />
                    <span className="font-bold uppercase tracking-wider">Collaborators ({uniqueCollabs.length})</span>
                    <span className="text-zinc-700">→ collaborations[ ]</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {uniqueCollabs.map((name, i) => (
                      <span key={i} className="text-[11px] bg-blue-500/10 border border-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-medium">{name}</span>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-700">Album-level artists (joint releases, e.g. A &amp; B EP)</p>
                </div>
              )}
            </div>
          )}

          {/* Per-track results */}
          {fetched && results.map((r, i) => (
            <div key={i} className="rounded-xl border border-white/8 bg-white/[0.015] overflow-hidden">
              <div className="px-3 py-2.5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {tracks.length > 1 && (
                    <span className="text-[10px] font-mono text-zinc-600 flex-shrink-0">{String(i+1).padStart(2,'0')}</span>
                  )}
                  <span className="text-xs font-bold text-zinc-300 truncate">{r.trackTitle}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  {r.resolvedIsrc && (
                    <span className="text-[10px] font-mono text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">{r.resolvedIsrc}</span>
                  )}
                  {r.trackExplicit && (
                    <span className="text-[10px] border border-red-500/40 text-red-400 px-1 rounded font-bold">E</span>
                  )}
                </div>
              </div>

              <div className="p-3 space-y-2.5">
                {/* Spotify result */}
                {hasSpotify && (
                  r.spotifyError ? (
                    <div className="flex items-start gap-1.5 text-[11px] text-amber-400/90 bg-amber-500/8 px-2.5 py-2 rounded-lg">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      {r.spotifyError.toLowerCase().includes('auth') || r.spotifyError.includes('active pre') || r.spotifyError.includes('Invalid Client')
                        ? 'Auth failed — check Client ID & Secret in Settings → AI & Integrations'
                        : r.spotifyError}
                    </div>
                  ) : r.spotify ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                        <span className="text-xs font-medium text-zinc-300 flex-1 truncate">{r.spotify.name}</span>
                        <a href={r.spotify.external_urls.spotify} target="_blank" rel="noreferrer"
                          className="text-zinc-600 hover:text-emerald-400 transition-colors flex-shrink-0"><ExternalLink className="w-3 h-3" /></a>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                        <div><span className="text-zinc-600">By </span><span className="text-zinc-300">{r.spotify.artists.map(a => a.name).join(', ')}</span></div>
                        <div><span className="text-zinc-600">Album </span><span className="text-zinc-400 truncate">{r.spotify.album.name}</span></div>
                        <div>
                          <span className="text-zinc-600">Pop </span>
                          <span className="text-zinc-400">{r.spotify.popularity}/100</span>
                        </div>
                        <div>
                          {r.spotify.preview_url
                            ? <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />30s preview</span>
                            : <span className="text-zinc-700">No preview</span>}
                        </div>
                        {r.trackFeatures.length > 0 && (
                          <div className="col-span-2">
                            <span className="text-zinc-600">feat. </span>
                            <span className="text-violet-300 font-medium">{r.trackFeatures.join(', ')}</span>
                          </div>
                        )}
                        {r.albumCollabs.length > 0 && (
                          <div className="col-span-2">
                            <span className="text-zinc-600">collab </span>
                            <span className="text-blue-300 font-medium">{r.albumCollabs.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : <p className="text-[11px] text-zinc-600 italic">Not found on Spotify</p>
                )}

                {/* YouTube */}
                {hasYouTube && r.youtube && !r.youtubeError && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                    <span className="text-zinc-400 flex-1 truncate">{fmtNum(r.youtube.viewCount)} views · {r.youtube.title.slice(0, 38)}</span>
                    <a href={r.youtube.url} target="_blank" rel="noreferrer"
                      className="text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0"><ExternalLink className="w-3 h-3" /></a>
                  </div>
                )}

                {/* Credits */}
                {Object.values(r.mergedCredits).some(v => v?.length) ? (
                  <div className="rounded-lg bg-white/[0.03] border border-white/5 p-2.5 space-y-1.5">
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
                            <span key={ni} className="text-[11px] bg-white/5 border border-white/8 text-zinc-200 px-2 py-0.5 rounded-full font-medium">{name}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-700 italic">
                    No credits found{!r.resolvedIsrc ? ' — add ISRC for better results' : ''}
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Apply & Save */}
          {fetched && (
            applied ? (
              <div className={`flex items-center gap-2 text-xs px-3 py-2.5 rounded-xl border ${
                saveStatus === 'saving' ? 'text-zinc-400 bg-zinc-800/60 border-white/5'
                : saveStatus === 'error' ? 'text-red-400 bg-red-500/10 border-red-500/20'
                : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              }`}>
                {saveStatus === 'saving'
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                  : saveStatus === 'error'
                    ? <><AlertTriangle className="w-4 h-4" />Applied but save failed — press Save Changes manually</>
                    : <><CheckCircle2 className="w-4 h-4" />Applied {releaseId ? '& saved automatically' : '— press Save Changes to persist'}</>
                }
              </div>
            ) : (
              <button onClick={handleApplyAndSave} disabled={applying}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-sm font-semibold hover:bg-emerald-600/30 transition-all w-full justify-center disabled:opacity-50">
                {applying
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Applying…</>
                  : <>
                      {releaseId ? <Save className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      Apply{anyCredits ? ' credits' : ''}{anyPreview ? ' + preview' : ''}{hasRPatch ? ' + release info' : ''}
                      {releaseId ? ' & save' : ''}
                    </>
                }
              </button>
            )
          )}
          {fetched && !applied && (
            <p className="text-[10px] text-zinc-700 text-center leading-relaxed">
              Merges with existing — never overwrites · Exact casing preserved
              {!anyPreview && hasSpotify ? ' · Spotify disabled preview_url for most tracks' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
