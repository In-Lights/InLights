import { useState } from 'react';
import { Sparkles, Copy, Check, Loader2, ExternalLink, Music2 } from 'lucide-react';
import { ReleaseSubmission } from '../types';

interface Props {
  release: ReleaseSubmission;
}

async function fetchLyricsFromDocs(docsUrl: string): Promise<string | null> {
  if (!docsUrl) return null;
  // Convert Google Docs URL to export/plain text URL
  const match = docsUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const docId = match[1];
  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
  try {
    const res = await fetch(exportUrl);
    if (!res.ok) return null;
    const text = await res.text();
    return text.trim().slice(0, 2000); // cap at 2000 chars
  } catch {
    return null;
  }
}

export default function SpotifyPitchGenerator({ release }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pitch, setPitch] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [lyricsStatus, setLyricsStatus] = useState('');

  const generate = async () => {
    setLoading(true);
    setError('');
    setPitch('');
    setLyricsStatus('');

    // Try to grab lyrics from first track with a Google Docs link
    let lyrics = '';
    for (const track of release.tracks) {
      if (track.lyricsGoogleDocsLink) {
        setLyricsStatus('Fetching lyrics from Google Docs…');
        const fetched = await fetchLyricsFromDocs(track.lyricsGoogleDocsLink);
        if (fetched) {
          lyrics = fetched;
          setLyricsStatus('✓ Lyrics loaded');
          break;
        }
      }
    }
    if (!lyrics) setLyricsStatus('No lyrics found — generating from metadata only');

    const features = release.features.map(f => f.name).filter(Boolean).join(', ');
    const collabs = release.collaborations.map(c => c.name).filter(Boolean).join(', ');
    const trackList = release.tracks.map((t, i) => `${i + 1}. ${t.title}${t.explicit ? ' [E]' : ''}`).join('\n');
    const credits = release.tracks[0]
      ? [
          release.tracks[0].producedBy && `Produced by ${release.tracks[0].producedBy}`,
          release.tracks[0].mixedBy && `Mixed by ${release.tracks[0].mixedBy}`,
          release.tracks[0].masteredBy && `Mastered by ${release.tracks[0].masteredBy}`,
        ].filter(Boolean).join(' · ')
      : '';

    const prompt = `You are a music PR expert writing a Spotify playlist pitch for a label submission.

Write a compelling, concise Spotify editorial pitch (max 200 words) for this release. 
The pitch should hook the playlist curator immediately, describe the sound and mood vividly, 
mention key influences if apparent, and end with a clear ask to be added to a relevant playlist.
Use professional but energetic music industry language. No emojis.

RELEASE DETAILS:
Artist: ${release.mainArtist}${collabs ? ` feat. ${collabs}` : ''}${features ? ` (ft. ${features})` : ''}
Title: ${release.releaseTitle}
Type: ${release.releaseType.toUpperCase()}
Genre: ${release.genre}
Release Date: ${release.releaseDate}
Explicit: ${release.explicitContent ? 'Yes' : 'No'}
Tracks:
${trackList}
${credits ? `Credits: ${credits}` : ''}
${lyrics ? `\nLYRICS EXCERPT (first track):\n${lyrics.slice(0, 800)}` : ''}

Write only the pitch text, ready to paste into Spotify for Artists. No headers or labels.`;

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-pitch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error.includes('ANTHROPIC_API_KEY') 
          ? 'Anthropic API key not set. Run: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...'
          : data.error);
      } else if (data.pitch) {
        setPitch(data.pitch);
      } else {
        setError('Failed to generate pitch. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(pitch);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); generate(); }}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-violet-500/30 bg-violet-500/5 text-violet-400 hover:bg-violet-500/10 transition-all text-sm font-medium"
      >
        <Sparkles className="w-4 h-4" />
        Generate Spotify Pitch
      </button>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music2 className="w-4 h-4 text-green-400" />
          <span className="text-sm font-bold">Spotify Playlist Pitch</span>
        </div>
        <button
          onClick={() => { setOpen(false); setPitch(''); setError(''); }}
          className="text-xs text-zinc-600 hover:text-zinc-400"
        >✕ Close</button>
      </div>

      {/* Lyrics status */}
      {lyricsStatus && (
        <p className={`text-xs ${lyricsStatus.startsWith('✓') ? 'text-emerald-400' : 'text-zinc-500'}`}>
          {lyricsStatus}
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 py-6 justify-center">
          <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
          <span className="text-sm text-zinc-400">Writing pitch…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-3">{error}</div>
      )}

      {/* Pitch output */}
      {pitch && !loading && (
        <>
          <div className="bg-zinc-900/60 rounded-xl p-4 border border-white/5">
            <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{pitch}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 text-sm font-medium transition-all"
            >
              {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Pitch</>}
            </button>
            <button
              onClick={generate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-zinc-400 hover:text-white text-sm transition-all"
            >
              <Sparkles className="w-4 h-4" /> Regenerate
            </button>
            <a
              href="https://artists.spotify.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-zinc-400 hover:text-white text-sm transition-all ml-auto"
            >
              <ExternalLink className="w-4 h-4" /> Spotify for Artists
            </a>
          </div>
          <p className="text-[10px] text-zinc-700">
            Paste this into Spotify for Artists → Music → select release → Pitch to Editors
          </p>
        </>
      )}
    </div>
  );
}
