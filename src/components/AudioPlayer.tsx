import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Music, ExternalLink } from 'lucide-react';
import { Track } from '../types';

interface Props {
  tracks: Track[];
  releaseTitle: string;
}

function driveDirectUrl(link: string): string | null {
  const m = link?.match(/\/file\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/);
  const id = m?.[1] || m?.[2];
  // Use Google Drive's direct stream URL
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : null;
}

function formatTime(s: number): string {
  if (isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function AudioPlayer({ tracks, releaseTitle }: Props) {
  const playableTracks = tracks.filter(t => t.wavDriveLink?.trim());
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const currentTrack = playableTracks[currentIdx];

  // Reset on track change
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setError(false);
    setPlaying(false);
    setLoading(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.load();
    }
  }, [currentIdx]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      setLoading(true);
      audio.play().then(() => {
        setPlaying(true);
        setLoading(false);
      }).catch(() => {
        setError(true);
        setLoading(false);
        setPlaying(false);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const selectTrack = (idx: number) => {
    setCurrentIdx(idx);
    setTimeout(() => {
      if (audioRef.current) {
        setLoading(true);
        audioRef.current.play().then(() => {
          setPlaying(true);
          setLoading(false);
        }).catch(() => {
          setError(true);
          setLoading(false);
        });
      }
    }, 100);
  };

  if (playableTracks.length === 0) return null;

  const src = driveDirectUrl(currentTrack?.wavDriveLink || '');
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <h3 className="font-bold text-sm flex items-center gap-2">
        <Music className="w-4 h-4 accent-text" /> Audio Preview
        <span className="text-zinc-600 font-normal text-xs ml-auto">WAV via Drive</span>
      </h3>

      {/* Current track display */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          disabled={!src || loading}
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 btn-primary disabled:opacity-50 transition-all"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : playing ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{currentTrack?.title || 'Untitled'}</p>
          <p className="text-xs text-zinc-500">{releaseTitle}</p>
        </div>

        <div className="flex items-center gap-1.5">
          <button onClick={() => { setMuted(m => !m); if (audioRef.current) audioRef.current.muted = !muted; }}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white transition-colors">
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          {currentTrack?.wavDriveLink && (
            <a href={currentTrack.wavDriveLink} target="_blank" rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-violet-400 transition-colors" title="Open in Drive">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Seek bar */}
      <div className="space-y-1">
        <div className="relative h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className="absolute left-0 top-0 h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
        </div>
        <input
          type="range" min={0} max={duration || 0} step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="absolute opacity-0 w-full cursor-pointer"
          style={{ marginTop: '-14px', height: '14px', position: 'relative' }}
        />
        <div className="flex justify-between text-[10px] text-zinc-600">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {error && (
        <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          ⚠️ Can't stream directly — Drive may require sign-in.{' '}
          <a href={currentTrack?.wavDriveLink} target="_blank" rel="noopener noreferrer" className="underline">Open in Drive</a>
        </div>
      )}

      {/* Track list */}
      {playableTracks.length > 1 && (
        <div className="space-y-1 pt-1 border-t border-white/5">
          {playableTracks.map((t, i) => (
            <button key={i} onClick={() => selectTrack(i)}
              className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-left transition-all ${
                i === currentIdx ? 'bg-white/5 accent-text' : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
              }`}>
              <span className="text-[10px] font-mono w-4 text-right flex-shrink-0">{i + 1}</span>
              {i === currentIdx && playing
                ? <span className="flex gap-0.5 items-end h-3 flex-shrink-0">
                    {[0,1,2].map(b => <span key={b} className="w-0.5 rounded-full animate-bounce" style={{ height: `${[8,12,6][b]}px`, background: 'var(--accent)', animationDelay: `${b * 0.15}s` }} />)}
                  </span>
                : <Music className="w-3 h-3 flex-shrink-0 opacity-40" />
              }
              <span className="text-xs truncate">{t.title || 'Untitled'}</span>
              {t.explicit && <span className="text-[10px] bg-red-500/20 text-red-400 px-1 rounded flex-shrink-0">E</span>}
            </button>
          ))}
        </div>
      )}

      {/* Hidden audio element */}
      {src && (
        <audio
          ref={audioRef}
          src={src}
          muted={muted}
          onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
          onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
          onEnded={() => {
            setPlaying(false);
            if (currentIdx < playableTracks.length - 1) selectTrack(currentIdx + 1);
          }}
          onError={() => { setError(true); setPlaying(false); setLoading(false); }}
          preload="metadata"
        />
      )}
    </div>
  );
}
