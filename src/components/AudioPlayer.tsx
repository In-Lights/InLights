import { useState } from 'react';
import { Music, ExternalLink, ChevronRight } from 'lucide-react';
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

  if (playableTracks.length === 0) return null;

  const currentTrack = playableTracks[currentIdx];
  const previewUrl = drivePreviewUrl(currentTrack?.wavDriveLink || '');

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Music className="w-4 h-4 accent-text" /> Audio Preview
        </h3>
        {currentTrack?.wavDriveLink && (
          <a href={currentTrack.wavDriveLink} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-violet-400 transition-colors">
            <ExternalLink className="w-3 h-3" /> Open in Drive
          </a>
        )}
      </div>

      <div className="px-5 pb-3">
        <p className="font-semibold text-sm truncate">{currentTrack?.title || 'Untitled'}</p>
        <p className="text-xs text-zinc-500 truncate">{releaseTitle}</p>
      </div>

      {previewUrl ? (
        <div className="mx-4 mb-4 rounded-xl overflow-hidden bg-zinc-900 border border-white/5">
          <iframe
            key={previewUrl}
            src={previewUrl}
            width="100%"
            height="60"
            allow="autoplay"
            className="block"
            style={{ border: 'none' }}
            title={`Preview: ${currentTrack?.title}`}
          />
        </div>
      ) : (
        <div className="mx-4 mb-4 text-xs text-zinc-600 italic px-2">No preview available</div>
      )}

      {playableTracks.length > 1 && (
        <div className="border-t border-white/5 px-4 pb-4 pt-3 space-y-1">
          {playableTracks.map((t, i) => (
            <button key={i} onClick={() => setCurrentIdx(i)}
              className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-left transition-all ${
                i === currentIdx ? 'bg-white/5 accent-text' : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
              }`}>
              <span className="text-[10px] font-mono w-4 text-right flex-shrink-0 text-zinc-600">{i + 1}</span>
              {i === currentIdx ? (
                <span className="flex gap-0.5 items-end h-3 flex-shrink-0">
                  {[8, 12, 6].map((h, b) => (
                    <span key={b} className="w-0.5 rounded-full animate-bounce"
                      style={{ height: `${h}px`, background: 'var(--accent)', animationDelay: `${b * 0.15}s` }} />
                  ))}
                </span>
              ) : (
                <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-30" />
              )}
              <span className="text-xs truncate">{t.title || 'Untitled'}</span>
              {t.explicit && <span className="text-[10px] bg-red-500/20 text-red-400 px-1 rounded flex-shrink-0">E</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
