import { useState, useRef } from 'react';
import { Music, ExternalLink, ChevronRight, Loader2, AlertTriangle, Play, Pause, Volume2 } from 'lucide-react';
import { Track } from '../types';

interface Props {
  tracks: Track[];
  releaseTitle: string;
}

function driveFileId(link: string): string | null {
  const m = link?.match(/\/file\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/);
  return m?.[1] || m?.[2] || null;
}

function drivePreviewUrl(link: string): string | null {
  const id = driveFileId(link);
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function AudioPlayer({ tracks, releaseTitle }: Props) {
  const playableTracks = tracks.filter(t =>
    t.spotifyPreviewUrl?.trim() || t.wavDriveLink?.trim()
  );

  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeFailed, setIframeFailed] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  if (playableTracks.length === 0) return null;

  const currentTrack = playableTracks[currentIdx];
  const spotifyPreview = currentTrack?.spotifyPreviewUrl?.trim() || null;
  const driveUrl = drivePreviewUrl(currentTrack?.wavDriveLink || '');
  const sourceLabel = spotifyPreview ? 'Spotify 30s preview' : 'WAV via Drive';

  const handleTrackChange = (idx: number) => {
    if (audioRef.current) audioRef.current.pause();
    setCurrentIdx(idx);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setAudioFailed(false);
    setAudioLoading(false);
    setIframeLoading(true);
    setIframeFailed(false);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      setAudioLoading(true);
      audio.play()
        .then(() => { setPlaying(true); setAudioLoading(false); })
        .catch(() => { setAudioFailed(true); setAudioLoading(false); });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = parseFloat(e.target.value);
    audio.currentTime = t;
    setCurrentTime(t);
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-white/8" style={{ background: 'rgba(255,255,255,0.03)' }}>

      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
            {spotifyPreview ? (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="#1DB954">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
            ) : (
              <Music className="w-3.5 h-3.5 accent-text" />
            )}
          </div>
          <div>
            <p className="text-xs font-bold">Audio Preview</p>
            <p className="text-[10px] text-zinc-600">{sourceLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {spotifyPreview && currentTrack?.spotifyTrackId && (
            <a href={`https://open.spotify.com/track/${currentTrack.spotifyTrackId}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-emerald-400 transition-colors px-2 py-1 rounded-lg hover:bg-white/5">
              <ExternalLink className="w-3 h-3" /> Spotify
            </a>
          )}
          {!spotifyPreview && currentTrack?.wavDriveLink && (
            <a href={currentTrack.wavDriveLink} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5">
              <ExternalLink className="w-3 h-3" /> Drive
            </a>
          )}
        </div>
      </div>

      {/* Track name */}
      <div className="px-4 pb-3">
        <p className="font-semibold text-sm truncate leading-tight">{currentTrack?.title || 'Untitled'}</p>
        <p className="text-[11px] text-zinc-500 truncate mt-0.5">{releaseTitle}</p>
      </div>

      {/* Native audio — Spotify preview */}
      {spotifyPreview && (
        <div className="mx-4 mb-4">
          <audio ref={audioRef} src={spotifyPreview}
            onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
            onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 30)}
            onEnded={() => { setPlaying(false); setCurrentTime(0); }}
            onError={() => { setAudioFailed(true); setPlaying(false); }}
            preload="none" />

          {audioFailed ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="text-xs text-zinc-400">Preview unavailable</span>
            </div>
          ) : (
            <div className="space-y-2">
              <input type="range" min={0} max={duration || 30} step={0.1} value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(to right, var(--accent) ${(currentTime / (duration || 30)) * 100}%, rgba(255,255,255,0.1) 0%)` }} />
              <div className="flex items-center gap-3">
                <button onClick={togglePlay}
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 hover:scale-105 transition-transform"
                  style={{ background: 'var(--accent)' }}>
                  {audioLoading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    : playing
                      ? <Pause className="w-3.5 h-3.5 text-white" fill="white" />
                      : <Play className="w-3.5 h-3.5 text-white ml-0.5" fill="white" />}
                </button>
                <div className="flex-1 flex items-center justify-between text-[10px] text-zinc-500">
                  <span>{fmtTime(currentTime)}</span>
                  <div className="flex items-center gap-1 text-emerald-500">
                    <Volume2 className="w-3 h-3" />
                    <span className="font-medium">30s preview</span>
                  </div>
                  <span>{fmtTime(duration || 30)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drive iframe — WAV fallback */}
      {!spotifyPreview && driveUrl && (
        <div className="mx-4 mb-4 rounded-xl overflow-hidden border border-white/8 bg-black/40 relative" style={{ height: 68 }}>
          {iframeLoading && !iframeFailed && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 z-10 bg-black/60 backdrop-blur-sm">
              <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
              <span className="text-xs text-zinc-500">Loading…</span>
            </div>
          )}
          {iframeFailed && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 z-10 bg-black/60">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-zinc-400">
                Sign-in required —{' '}
                <a href={currentTrack?.wavDriveLink} target="_blank" rel="noreferrer" className="underline accent-text">open file</a>
              </span>
            </div>
          )}
          <iframe key={driveUrl} src={driveUrl} width="100%" height="68" allow="autoplay"
            onLoad={() => setTimeout(() => setIframeLoading(false), 600)}
            onError={() => { setIframeLoading(false); setIframeFailed(true); }}
            className="block" style={{ border: 'none', opacity: iframeLoading ? 0 : 1, transition: 'opacity 0.3s' }}
            title={`Preview: ${currentTrack?.title}`} />
        </div>
      )}

      {/* Track list */}
      {playableTracks.length > 1 && (
        <div className="border-t border-white/5 px-3 pb-3 pt-2.5 space-y-0.5">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-bold px-1 mb-2">Tracks</p>
          {playableTracks.map((t, i) => (
            <button key={i} onClick={() => handleTrackChange(i)}
              className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-left transition-all ${
                i === currentIdx ? 'text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
              }`}
              style={i === currentIdx ? { background: 'var(--accent-subtle)' } : {}}>
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                {i === currentIdx && playing ? (
                  <span className="flex gap-px items-end h-3">
                    {[4, 7, 5].map((h, b) => (
                      <span key={b} className="w-[3px] rounded-full animate-bounce"
                        style={{ height: `${h}px`, background: 'var(--accent)', animationDelay: `${b * 0.18}s` }} />
                    ))}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-zinc-600">{i + 1}</span>
                )}
              </div>
              <span className="text-xs truncate flex-1 font-medium">{t.title || 'Untitled'}</span>
              {t.spotifyPreviewUrl && (
                <svg className="w-3 h-3 flex-shrink-0 opacity-50" viewBox="0 0 24 24" fill="#1DB954">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
              )}
              {t.explicit && <span className="text-[9px] border border-current opacity-60 px-1 rounded flex-shrink-0">E</span>}
              {i !== currentIdx && <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-20" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
