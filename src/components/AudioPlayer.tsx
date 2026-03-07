import { useState, useRef } from 'react';
import { Music, ExternalLink, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';
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

export default function AudioPlayer({ tracks, releaseTitle }: Props) {
  const playableTracks = tracks.filter(t => t.wavDriveLink?.trim());
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  if (playableTracks.length === 0) return null;

  const currentTrack = playableTracks[currentIdx];
  const previewUrl = drivePreviewUrl(currentTrack?.wavDriveLink || '');

  const handleTrackChange = (idx: number) => {
    setCurrentIdx(idx);
    setLoading(true);
    setFailed(false);
  };

  const handleLoad = () => {
    // Give Drive's iframe a moment to render before hiding spinner
    setTimeout(() => setLoading(false), 600);
  };

  const handleError = () => {
    setLoading(false);
    setFailed(true);
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-white/8" style={{ background: 'rgba(255,255,255,0.03)' }}>

      {/* Header row */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
            <Music className="w-3.5 h-3.5 accent-text" />
          </div>
          <div>
            <p className="text-xs font-bold">Audio Preview</p>
            <p className="text-[10px] text-zinc-600">WAV via Google Drive</p>
          </div>
        </div>
        {currentTrack?.wavDriveLink && (
          <a
            href={currentTrack.wavDriveLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
          >
            <ExternalLink className="w-3 h-3" />
            Drive
          </a>
        )}
      </div>

      {/* Current track name */}
      <div className="px-4 pb-3">
        <p className="font-semibold text-sm truncate leading-tight">{currentTrack?.title || 'Untitled'}</p>
        <p className="text-[11px] text-zinc-500 truncate mt-0.5">{releaseTitle}</p>
      </div>

      {/* Player area */}
      <div className="mx-4 mb-4 rounded-xl overflow-hidden border border-white/8 bg-black/40 relative" style={{ height: 68 }}>
        {/* Loading shimmer */}
        {loading && !failed && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 z-10 bg-black/60 backdrop-blur-sm">
            <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
            <span className="text-xs text-zinc-500">Loading player…</span>
          </div>
        )}

        {/* Error state */}
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 z-10 bg-black/60">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-zinc-400">
              Sign in to Drive required —{' '}
              <a href={currentTrack?.wavDriveLink} target="_blank" rel="noopener noreferrer" className="underline accent-text">
                open file
              </a>
            </span>
          </div>
        )}

        {previewUrl && (
          <iframe
            ref={iframeRef}
            key={previewUrl}
            src={previewUrl}
            width="100%"
            height="68"
            allow="autoplay"
            onLoad={handleLoad}
            onError={handleError}
            className="block"
            style={{ border: 'none', opacity: loading ? 0 : 1, transition: 'opacity 0.3s' }}
            title={`Preview: ${currentTrack?.title}`}
          />
        )}
      </div>

      {/* Multi-track list */}
      {playableTracks.length > 1 && (
        <div className="border-t border-white/5 mx-0 px-3 pb-3 pt-2.5 space-y-0.5">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-bold px-1 mb-2">Tracks</p>
          {playableTracks.map((t, i) => (
            <button
              key={i}
              onClick={() => handleTrackChange(i)}
              className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-left transition-all ${
                i === currentIdx
                  ? 'text-white'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
              }`}
              style={i === currentIdx ? { background: 'var(--accent-subtle)' } : {}}
            >
              {/* Track number / playing indicator */}
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                {i === currentIdx ? (
                  <span className="flex gap-px items-end h-3">
                    {[4, 7, 5].map((h, b) => (
                      <span
                        key={b}
                        className="w-[3px] rounded-full animate-bounce"
                        style={{ height: `${h}px`, background: 'var(--accent)', animationDelay: `${b * 0.18}s` }}
                      />
                    ))}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-zinc-600">{i + 1}</span>
                )}
              </div>

              <span className="text-xs truncate flex-1 font-medium">{t.title || 'Untitled'}</span>

              {t.explicit && (
                <span className="text-[9px] border border-current opacity-60 px-1 rounded flex-shrink-0">E</span>
              )}

              {i !== currentIdx && (
                <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-20" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
