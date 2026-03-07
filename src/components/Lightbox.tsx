import { useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';

interface Props {
  src: string;
  alt?: string;
  driveLink?: string;
  onClose: () => void;
}

export default function Lightbox({ src, alt = 'Cover art', driveLink, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />

      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        {driveLink && (
          <a
            href={driveLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
            title="Open in Drive"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
        <button
          onClick={onClose}
          className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
          title="Close (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Image */}
      <div
        className="relative z-10 max-w-2xl w-full"
        onClick={e => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="w-full rounded-2xl shadow-2xl object-contain max-h-[85vh]"
          style={{ boxShadow: '0 0 80px rgba(0,0,0,0.8)' }}
        />
        {alt && (
          <p className="text-center text-sm text-zinc-400 mt-3">{alt}</p>
        )}
      </div>
    </div>
  );
}
