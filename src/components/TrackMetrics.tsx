/**
 * TrackMetrics — admin-only streaming metrics panel
 *
 * API access summary (as of 2026):
 *
 * SPOTIFY  — Web API (Client Credentials)
 *   • Token: POST https://accounts.spotify.com/api/token (CORS: allowed)
 *   • Search by ISRC: GET /v1/search?q=isrc:{code}&type=track
 *   • Returns: popularity (0–100), track name, artist, album, Spotify URL
 *   • ❌ Stream counts are NOT public (internal/partner only)
 *   • Needs: Client ID + Client Secret in Settings → AI/Integrations
 *
 * APPLE MUSIC — iTunes Search API (no key required, CORS-friendly)
 *   • GET https://itunes.apple.com/search?term={title+artist}&entity=song
 *   • Returns: track URL, artwork, price, collection name
 *   • ❌ Play counts are NOT public
 *   • ⚠ ISRC lookup not supported — fuzzy match by title+artist
 *
 * YOUTUBE — Data API v3 (key required, CORS-friendly)
 *   • Search: GET /youtube/v3/search?q={title+artist}&type=video
 *   • Stats:  GET /youtube/v3/videos?part=statistics&id={videoId}
 *   • Returns: viewCount, likeCount, commentCount
 *   • ⚠ ISRC/UPC lookup not supported — fuzzy match by title+artist
 *   • Quota: 10,000 units/day free (search=100 units, videos=1 unit)
 *   • Needs: YouTube Data API v3 key in Settings → AI/Integrations
 *
 * YOUTUBE MUSIC — same YouTube Data API, filtered by music category
 *   • videoCategoryId=10 (Music) to prioritise audio tracks over music videos
 *
 * Changed files:
 *   src/components/TrackMetrics.tsx  — this file (new)
 *   src/components/ReleaseDetail.tsx — imports + renders <TrackMetrics>
 *   src/components/AdminSettings.tsx — new "Metrics" section in AI tab
 *   src/types.ts                     — spotifyClientId/Secret, youtubeApiKey
 *   src/store.ts                     — read/write new settings columns
 *
 * Required SQL (run once in Supabase SQL Editor):
 *   ALTER TABLE settings ADD COLUMN IF NOT EXISTS spotify_client_id TEXT;
 *   ALTER TABLE settings ADD COLUMN IF NOT EXISTS spotify_client_secret TEXT;
 *   ALTER TABLE settings ADD COLUMN IF NOT EXISTS youtube_api_key TEXT;
 */

import { useState, useCallback } from 'react';
import {
  BarChart2, RefreshCw, ExternalLink, AlertTriangle,
  Music2, Youtube, Loader2, ChevronDown, ChevronUp, Info
} from 'lucide-react';
import { ReleaseSubmission, Track, AdminSettings } from '../types';

// ── Types ────────────────────────────────────────────────────

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; release_date: string; images: { url: string }[] };
  popularity: number;
  external_urls: { spotify: string };
  duration_ms: number;
  preview_url: string | null;
}

interface YouTubeResult {
  videoId: string;
  title: string;
  channelTitle: string;
  viewCount: number;
  likeCount: number;
  url: string;
  isMusic: boolean;        // true if videoCategoryId = 10
}

interface AppleResult {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  trackViewUrl: string;
  artworkUrl100: string;
}

export interface TrackMetricResult {
  trackIndex: number;
  track: Track;
  spotify: { data: SpotifyTrack | null; error?: string; loading: boolean };
  youtube: { data: YouTubeResult | null; error?: string; loading: boolean };
  apple:   { data: AppleResult  | null; error?: string; loading: boolean };
}

export interface ReleaseMetrics {
  spotifyRelease: { data: SpotifyTrack[] | null; error?: string; loading: boolean };
  tracks: TrackMetricResult[];
}

// ── Spotify token cache ──────────────────────────────────────
let _spotifyToken: string | null = null;
let _spotifyTokenExp = 0;

async function getSpotifyToken(clientId: string, clientSecret: string): Promise<string> {
  if (_spotifyToken && Date.now() < _spotifyTokenExp - 30_000) return _spotifyToken;
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + btoa(`${clientId}:${clientSecret}`),
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`);
  const d = await res.json();
  _spotifyToken = d.access_token;
  _spotifyTokenExp = Date.now() + d.expires_in * 1000;
  return _spotifyToken!;
}

// ── Spotify: search by ISRC (exact), fall back to title+artist ──
async function fetchSpotifyTrack(
  clientId: string,
  clientSecret: string,
  isrc: string | undefined,
  title: string,
  artist: string
): Promise<SpotifyTrack | null> {
  const token = await getSpotifyToken(clientId, clientSecret);

  // 1. Try exact ISRC lookup
  if (isrc) {
    const r = await fetch(
      `https://api.spotify.com/v1/search?q=isrc:${encodeURIComponent(isrc)}&type=track&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const d = await r.json();
    const items: SpotifyTrack[] = d?.tracks?.items ?? [];
    if (items.length) return items[0];
  }

  // 2. Fall back: title + artist text search
  const q = encodeURIComponent(`track:${title} artist:${artist}`);
  const r2 = await fetch(
    `https://api.spotify.com/v1/search?q=${q}&type=track&limit=3`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const d2 = await r2.json();
  const items2: SpotifyTrack[] = d2?.tracks?.items ?? [];
  if (!items2.length) return null;

  // Pick best match — prefer exact title match
  const exact = items2.find(t => t.name.toLowerCase() === title.toLowerCase());
  return exact ?? items2[0];
}

// ── YouTube: search by title+artist, get stats ───────────────
async function fetchYouTubeVideo(
  apiKey: string,
  title: string,
  artist: string,
  musicOnly: boolean
): Promise<YouTubeResult | null> {
  const q = encodeURIComponent(`${title} ${artist}${musicOnly ? ' audio' : ''}`);
  const categoryFilter = musicOnly ? '&videoCategoryId=10' : '';

  // Step 1: search
  const searchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video${categoryFilter}&maxResults=3&key=${apiKey}`
  );
  if (!searchRes.ok) {
    const err = await searchRes.json();
    throw new Error(err?.error?.message ?? `YouTube search failed: ${searchRes.status}`);
  }
  const searchData = await searchRes.json();
  const items = searchData?.items ?? [];
  if (!items.length) return null;

  // Pick first result
  const best = items[0];
  const videoId: string = best.id?.videoId;
  if (!videoId) return null;

  // Step 2: get statistics
  const statsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoId}&key=${apiKey}`
  );
  const statsData = await statsRes.json();
  const video = statsData?.items?.[0];
  if (!video) return null;

  return {
    videoId,
    title: video.snippet?.title ?? best.snippet?.title,
    channelTitle: video.snippet?.channelTitle ?? '',
    viewCount: parseInt(video.statistics?.viewCount ?? '0', 10),
    likeCount: parseInt(video.statistics?.likeCount ?? '0', 10),
    url: `https://www.youtube.com/watch?v=${videoId}`,
    isMusic: video.snippet?.categoryId === '10',
  };
}

// ── Apple Music: iTunes Search API (no key, CORS-friendly) ───
async function fetchAppleTrack(
  title: string,
  artist: string
): Promise<AppleResult | null> {
  const term = encodeURIComponent(`${title} ${artist}`);
  // Use allorigins proxy to avoid occasional CORS issues with itunes.apple.com
  const url = `https://itunes.apple.com/search?term=${term}&entity=song&limit=3`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const results: AppleResult[] = data?.results ?? [];
  if (!results.length) return null;
  // Best match: exact title
  const exact = results.find(r =>
    r.trackName.toLowerCase() === title.toLowerCase()
  );
  return exact ?? results[0];
}

// ── Formatters ───────────────────────────────────────────────
function fmtNum(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function popularityLabel(p: number): string {
  if (p >= 80) return 'Trending';
  if (p >= 60) return 'Popular';
  if (p >= 40) return 'Moderate';
  if (p >= 20) return 'Low';
  return 'Minimal';
}

export { getSpotifyToken, fetchSpotifyTrack };

function PlatformCard({
  icon, label, color, loading, error, children, link, linkLabel,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  loading?: boolean;
  error?: string;
  children?: React.ReactNode;
  link?: string;
  linkLabel?: string;
}) {
  return (
    <div className={`rounded-xl border ${color} bg-white/[0.02] p-3 space-y-2`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-bold text-zinc-300">{label}</span>
        </div>
        {link && (
          <a href={link} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors">
            Open <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
      {loading && (
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <Loader2 className="w-3 h-3 animate-spin" /> Fetching…
        </div>
      )}
      {error && !loading && (
        <div className="flex items-start gap-1.5 text-[11px] text-amber-400/80">
          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {!loading && !error && children}
    </div>
  );
}

function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[11px] text-zinc-500">{label}</span>
      <div className="text-right">
        <span className="text-sm font-bold text-zinc-200">{value}</span>
        {sub && <span className="text-[10px] text-zinc-600 ml-1.5">{sub}</span>}
      </div>
    </div>
  );
}

function PopularityBar({ value }: { value: number }) {
  const color = value >= 60 ? 'bg-emerald-500' : value >= 30 ? 'bg-amber-500' : 'bg-zinc-600';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-zinc-600">
        <span>Popularity</span>
        <span>{value}/100 · {popularityLabel(value)}</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────

interface Props {
  release: ReleaseSubmission;
  settings: AdminSettings;
}

export default function TrackMetrics({ release, settings }: Props) {
  const [open, setOpen] = useState(false);
  const [metrics, setMetrics] = useState<TrackMetricResult[]>([]);
  const [releaseSpotify, setReleaseSpotify] = useState<{ data: SpotifyTrack[] | null; error?: string; loading: boolean }>({ data: null, loading: false });
  const [loaded, setLoaded] = useState(false);
  const [globalError, setGlobalError] = useState('');

  const hasSpotify = !!(settings.spotifyClientId && settings.spotifyClientSecret);
  const hasYouTube = !!settings.youtubeApiKey;
  const hasAny = hasSpotify || hasYouTube;

  const load = useCallback(async () => {
    if (!hasAny) return;
    setLoaded(true);
    setGlobalError('');

    const tracks = release.tracks;
    const artist = release.mainArtist;

    // Init per-track state
    const init: TrackMetricResult[] = tracks.map((t, i) => ({
      trackIndex: i,
      track: t,
      spotify: { data: null, loading: hasSpotify },
      youtube: { data: null, loading: hasYouTube },
      apple:   { data: null, loading: true },
    }));
    setMetrics(init);

    // Fetch all tracks in parallel (per platform)
    await Promise.all(tracks.map(async (track, i) => {
      const title = track.title || release.releaseTitle;
      const isrc = track.isrc;

      // Spotify
      if (hasSpotify) {
        try {
          const data = await fetchSpotifyTrack(
            settings.spotifyClientId, settings.spotifyClientSecret,
            isrc, title, artist
          );
          setMetrics(prev => prev.map((m, idx) =>
            idx === i ? { ...m, spotify: { data, loading: false } } : m
          ));
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setMetrics(prev => prev.map((m, idx) =>
            idx === i ? { ...m, spotify: { data: null, loading: false, error: msg } } : m
          ));
        }
      }

      // YouTube
      if (hasYouTube) {
        try {
          const data = await fetchYouTubeVideo(settings.youtubeApiKey, title, artist, false);
          setMetrics(prev => prev.map((m, idx) =>
            idx === i ? { ...m, youtube: { data, loading: false } } : m
          ));
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setMetrics(prev => prev.map((m, idx) =>
            idx === i ? { ...m, youtube: { data: null, loading: false, error: msg } } : m
          ));
        }
      }

      // Apple Music (always attempt — no key needed)
      try {
        const data = await fetchAppleTrack(title, artist);
        setMetrics(prev => prev.map((m, idx) =>
          idx === i ? { ...m, apple: { data, loading: false } } : m
        ));
      } catch {
        setMetrics(prev => prev.map((m, idx) =>
          idx === i ? { ...m, apple: { data: null, loading: false, error: 'Not found' } } : m
        ));
      }
    }));
  }, [release, settings, hasSpotify, hasYouTube, hasAny]);

  const handleOpen = () => {
    setOpen(o => !o);
    if (!loaded) load();
  };

  const refresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoaded(false);
    setMetrics([]);
    setReleaseSpotify({ data: null, loading: false });
    setTimeout(() => load(), 50);
  };

  if (!hasAny) {
    return (
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart2 className="w-4 h-4 text-zinc-600" />
          <span className="font-bold text-sm text-zinc-500">Streaming Metrics</span>
        </div>
        <p className="text-xs text-zinc-600 leading-relaxed">
          Add a Spotify Client ID/Secret and/or YouTube API key in{' '}
          <span className="text-violet-400">Settings → AI & Integrations</span> to enable metrics.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={handleOpen}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <BarChart2 className="w-4 h-4 accent-text" />
          <span className="font-bold text-sm">Streaming Metrics</span>
          <div className="flex items-center gap-1.5">
            {hasSpotify && <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">Spotify</span>}
            {hasYouTube && <span className="text-[10px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full font-medium">YouTube</span>}
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-medium">Apple Music</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loaded && (
            <button onClick={refresh} className="text-zinc-600 hover:text-zinc-300 transition-colors p-1 rounded">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </div>
      </button>

      {/* Content */}
      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-white/5">
          {/* API disclaimer */}
          <div className="flex items-start gap-2 mt-4 px-3 py-2.5 rounded-xl bg-zinc-900/60 border border-white/5">
            <Info className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-zinc-600 leading-relaxed">
              <span className="text-zinc-400 font-medium">Spotify</span> — popularity score only (0–100, recency-weighted). Stream counts are not publicly available.{' '}
              <span className="text-zinc-400 font-medium">YouTube</span> — view &amp; like counts from Data API v3. Matched by title+artist.{' '}
              <span className="text-zinc-400 font-medium">Apple Music</span> — track link only via iTunes Search. No play counts public.
            </p>
          </div>

          {/* Per-track metrics */}
          {metrics.map((m, i) => (
            <div key={i} className="space-y-2">
              {release.tracks.length > 1 && (
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Track {i + 1} — {m.track.title || release.releaseTitle}
                </p>
              )}

              {/* ISRC badge */}
              {m.track.isrc && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded">
                    ISRC: {m.track.isrc}
                  </span>
                  {m.spotify.data && m.spotify.data.name.toLowerCase() !== (m.track.title || release.releaseTitle).toLowerCase() && (
                    <span className="text-[10px] text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5" /> Fuzzy match: "{m.spotify.data.name}"
                    </span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-2">
                {/* Spotify */}
                {hasSpotify && (
                  <PlatformCard
                    icon={<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>}
                    label="Spotify"
                    color="border-emerald-500/15"
                    loading={m.spotify.loading}
                    error={m.spotify.error}
                    link={m.spotify.data?.external_urls.spotify}
                  >
                    {m.spotify.data ? (
                      <div className="space-y-2">
                        <StatRow
                          label="Match"
                          value={m.spotify.data.name}
                          sub={`by ${m.spotify.data.artists.map(a => a.name).join(', ')}`}
                        />
                        <StatRow
                          label="Album"
                          value={m.spotify.data.album.name}
                          sub={m.spotify.data.album.release_date}
                        />
                        <PopularityBar value={m.spotify.data.popularity} />
                        <p className="text-[10px] text-zinc-700 leading-tight">
                          Popularity is recency-weighted. Stream counts require Spotify for Artists access.
                        </p>
                      </div>
                    ) : !m.spotify.loading && (
                      <p className="text-[11px] text-zinc-600">Not found on Spotify</p>
                    )}
                  </PlatformCard>
                )}

                {/* YouTube */}
                {hasYouTube && (
                  <PlatformCard
                    icon={<Youtube className="w-3.5 h-3.5 text-red-500" />}
                    label="YouTube"
                    color="border-red-500/15"
                    loading={m.youtube.loading}
                    error={m.youtube.error}
                    link={m.youtube.data?.url}
                  >
                    {m.youtube.data ? (
                      <div className="space-y-2">
                        <StatRow label="Video" value={m.youtube.data.title.slice(0, 40) + (m.youtube.data.title.length > 40 ? '…' : '')} />
                        <StatRow label="Channel" value={m.youtube.data.channelTitle} />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-zinc-900/60 rounded-lg p-2 text-center">
                            <p className="text-base font-bold text-zinc-200">{fmtNum(m.youtube.data.viewCount)}</p>
                            <p className="text-[10px] text-zinc-600">Views</p>
                          </div>
                          <div className="bg-zinc-900/60 rounded-lg p-2 text-center">
                            <p className="text-base font-bold text-zinc-200">{fmtNum(m.youtube.data.likeCount)}</p>
                            <p className="text-[10px] text-zinc-600">Likes</p>
                          </div>
                        </div>
                        {!m.youtube.data.isMusic && (
                          <p className="text-[10px] text-zinc-600">
                            ⚠ Not categorised as Music — may not be the official audio/MV
                          </p>
                        )}
                      </div>
                    ) : !m.youtube.loading && (
                      <p className="text-[11px] text-zinc-600">Not found on YouTube</p>
                    )}
                  </PlatformCard>
                )}

                {/* Apple Music */}
                <PlatformCard
                  icon={<Music2 className="w-3.5 h-3.5 text-pink-400" />}
                  label="Apple Music"
                  color="border-pink-500/15"
                  loading={m.apple.loading}
                  error={m.apple.error && m.apple.error !== 'Not found' ? m.apple.error : undefined}
                  link={m.apple.data?.trackViewUrl}
                >
                  {m.apple.data ? (
                    <div className="space-y-1.5">
                      <StatRow
                        label="Match"
                        value={m.apple.data.trackName}
                        sub={`by ${m.apple.data.artistName}`}
                      />
                      <StatRow label="Album" value={m.apple.data.collectionName} />
                      {m.apple.data.artworkUrl100 && (
                        <img
                          src={m.apple.data.artworkUrl100.replace('100x100', '60x60')}
                          alt="artwork"
                          className="w-10 h-10 rounded-lg mt-1"
                        />
                      )}
                      <p className="text-[10px] text-zinc-700">Play counts are not available via public API.</p>
                    </div>
                  ) : !m.apple.loading && (
                    <p className="text-[11px] text-zinc-600">Not found on Apple Music</p>
                  )}
                </PlatformCard>

                {/* YouTube Music label */}
                {hasYouTube && m.youtube.data && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900/40 border border-white/5">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="#FF0000"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
                    <p className="text-[11px] text-zinc-500 flex-1">
                      YouTube Music shares the same video — view count above applies.
                      No separate YouTube Music API exists publicly.
                    </p>
                    <a href={`https://music.youtube.com/search?q=${encodeURIComponent(m.track.title + ' ' + release.mainArtist)}`}
                      target="_blank" rel="noreferrer"
                      className="text-[10px] text-zinc-600 hover:text-zinc-300 flex items-center gap-1 flex-shrink-0">
                      Search <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* UPC release-level note */}
          {release.upc && (
            <div className="px-3 py-2 rounded-xl bg-zinc-900/40 border border-white/5">
              <p className="text-[11px] text-zinc-500">
                <span className="font-mono text-violet-400">UPC {release.upc}</span>
                {' '}— Release-level barcode. Spotify and Apple Music use UPC internally for album matching,
                but their public APIs don't support UPC lookups. Use the Spotify for Artists dashboard
                for album-level stream data.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
