/**
 * SpotifyFetch — admin-only button to grab track metadata + preview URLs
 * from Spotify (via ISRC or title search) and YouTube (view count).
 *
 * Fetches per track:
 *   • Spotify: track name, artists, ISRC confirmation, popularity, preview_url (30s MP3)
 *   • YouTube: video title, view count, video URL
 *
 * All fetched data is shown in a preview panel — admin clicks "Apply" to
 * write it back to the tracks array via onApply callback.
 */

import { useState } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, ExternalLink, RefreshCw, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { Track, AdminSettings } from '../types';
import { fetchSpotifyTrack, SpotifyTrack } from './TrackMetrics';

interface FetchedTrack {
  trackIndex: number;
  original: Track;
  spotify: SpotifyTrack | null;
  spotifyError?: string;
  youtube: { title: string; url: string; viewCount: number; videoId: string } | null;
  youtubeError?: string;
}

interface Props {
  tracks: Track[];
  mainArtist: string;
  releaseTitle: string;
  settings: AdminSettings;
  onApply: (updatedTracks: Track[]) => void;
}

async function fetchYouTubeBasic(
  apiKey: string,
  title: string,
  artist: string
): Promise<{ title: string; url: string; viewCount: number; videoId: string } | null> {
  const q = encodeURIComponent(`${title} ${artist}`);
  const searchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&maxResults=1&key=${apiKey}`
  );
  if (!searchRes.ok) throw new Error(`YouTube search failed: ${searchRes.status}`);
  const searchData = await searchRes.json();
  const videoId = searchData?.items?.[0]?.id?.videoId;
  if (!videoId) return null;

  const statsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoId}&key=${apiKey}`
  );
  const statsData = await statsRes.json();
  const video = statsData?.items?.[0];
  if (!video) return null;

  return {
    videoId,
    title: video.snippet?.title ?? '',
    url: `https://www.youtube.com/watch?v=${videoId}`,
    viewCount: parseInt(video.statistics?.viewCount ?? '0', 10),
  };
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

export default function SpotifyFetch({ tracks, mainArtist, releaseTitle, settings, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [results, setResults] = useState<FetchedTrack[]>([]);
  const [fetched, setFetched] = useState(false);
  const [applied, setApplied] = useState(false);

  const hasSpotify = !!(settings.spotifyClientId && settings.spotifyClientSecret);
  const hasYouTube = !!settings.youtubeApiKey;

  if (!hasSpotify && !hasYouTube) return null;

  const fetch = async () => {
    setFetching(true);
    setFetched(false);
    setApplied(false);

    const out: FetchedTrack[] = await Promise.all(
      tracks.map(async (track, i) => {
        const title = track.title || releaseTitle;
        const result: FetchedTrack = {
          trackIndex: i,
          original: track,
          spotify: null,
          youtube: null,
        };

        if (hasSpotify) {
          try {
            result.spotify = await fetchSpotifyTrack(
              settings.spotifyClientId,
              settings.spotifyClientSecret,
              track.isrc,
              title,
              mainArtist
            );
          } catch (e) {
            result.spotifyError = e instanceof Error ? e.message : 'Failed';
          }
        }

        if (hasYouTube) {
          try {
            result.youtube = await fetchYouTubeBasic(settings.youtubeApiKey, title, mainArtist);
          } catch (e) {
            result.youtubeError = e instanceof Error ? e.message : 'Failed';
          }
        }

        return result;
      })
    );

    setResults(out);
    setFetching(false);
    setFetched(true);
  };

  const handleApply = () => {
    const updated = tracks.map((track, i) => {
      const r = results.find(r => r.trackIndex === i);
      if (!r) return track;
      const patch: Partial<Track> = {};
      if (r.spotify) {
        if (r.spotify.preview_url) patch.spotifyPreviewUrl = r.spotify.preview_url;
        patch.spotifyTrackId = r.spotify.id;
        // Auto-fill ISRC if empty
        if (!track.isrc) {
          // Spotify doesn't return ISRC in search — it's in track.external_ids
          // preview_url presence is enough for playback
        }
      }
      return { ...track, ...patch };
    });
    onApply(updated);
    setApplied(true);
  };

  const anySpotifyPreview = results.some(r => r.spotify?.preview_url);

  return (
    <div className="rounded-xl border border-violet-500/20 overflow-hidden">
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
              {[hasSpotify && 'Spotify', hasYouTube && 'YouTube'].filter(Boolean).join(' + ')} — preview URLs, metadata
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-zinc-600" /> : <ChevronDown className="w-4 h-4 text-zinc-600" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">

          <button
            onClick={fetch}
            disabled={fetching}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 text-sm font-medium hover:bg-violet-600/30 transition-all disabled:opacity-50 w-full justify-center"
          >
            {fetching
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching {tracks.length} track{tracks.length > 1 ? 's' : ''}…</>
              : <><RefreshCw className="w-4 h-4" /> {fetched ? 'Re-fetch' : 'Fetch from Streaming'}</>
            }
          </button>

          {/* Results */}
          {fetched && results.map((r, i) => (
            <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-2">
              <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Track {i + 1} — {r.original.title || releaseTitle}
              </p>

              {/* Spotify result */}
              {hasSpotify && (
                <div className="space-y-1">
                  {r.spotifyError ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
                      <AlertTriangle className="w-3 h-3" /> {r.spotifyError}
                    </div>
                  ) : r.spotify ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="#1DB954">
                          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                        </svg>
                        <span className="text-xs text-zinc-300 font-medium truncate flex-1">{r.spotify.name}</span>
                        <a href={r.spotify.external_urls.spotify} target="_blank" rel="noreferrer"
                          className="text-zinc-600 hover:text-zinc-300 flex-shrink-0">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-zinc-600 pl-5">
                        <span>Popularity: <span className="text-zinc-400">{r.spotify.popularity}/100</span></span>
                        {r.spotify.preview_url
                          ? <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> 30s preview ready</span>
                          : <span className="text-zinc-700">No preview available</span>
                        }
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-zinc-600 pl-5">Not found on Spotify</p>
                  )}
                </div>
              )}

              {/* YouTube result */}
              {hasYouTube && (
                <div>
                  {r.youtubeError ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
                      <AlertTriangle className="w-3 h-3" /> {r.youtubeError}
                    </div>
                  ) : r.youtube ? (
                    <div className="flex items-center gap-2">
                      <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="#FF0000">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                      <span className="text-xs text-zinc-400 truncate flex-1">{fmtNum(r.youtube.viewCount)} views</span>
                      <a href={r.youtube.url} target="_blank" rel="noreferrer"
                        className="text-zinc-600 hover:text-zinc-300 flex-shrink-0">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ) : (
                    <p className="text-[11px] text-zinc-600 pl-5">Not found on YouTube</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Apply button */}
          {fetched && (
            <div className="space-y-2">
              {applied ? (
                <div className="flex items-center gap-2 text-xs text-emerald-400 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4" />
                  Applied — audio player now uses Spotify previews where available
                </div>
              ) : (
                <>
                  <button
                    onClick={handleApply}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-600/30 transition-all w-full justify-center"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Apply to tracks {anySpotifyPreview ? '(enables Spotify preview)' : ''}
                  </button>
                  {!anySpotifyPreview && hasSpotify && (
                    <p className="text-[10px] text-zinc-600 text-center">
                      No Spotify previews found — some tracks may not have them available
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
