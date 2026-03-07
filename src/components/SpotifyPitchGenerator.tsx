import { useState } from 'react';
import { Sparkles, Copy, Check, Loader2, ExternalLink, Music2, AlertTriangle } from 'lucide-react';
import { ReleaseSubmission } from '../types';
import { getAdminSettings } from '../store';

interface Props {
  release: ReleaseSubmission;
}

async function fetchLyricsFromDocs(docsUrl: string): Promise<string | null> {
  if (!docsUrl) return null;
  const match = docsUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const exportUrl = `https://docs.google.com/document/d/${match[1]}/export?format=txt`;
  try {
    const res = await fetch(exportUrl);
    if (!res.ok) return null;
    return (await res.text()).trim().slice(0, 2000);
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

    const settings = await getAdminSettings();
    if (!settings.geminiApiKey) {
      setError('No Gemini API key set. Go to Settings → AI to add your free key.');
      setLoading(false);
      return;
    }

    // Try to grab lyrics
    let lyrics = '';
    for (const track of release.tracks) {
      if (track.lyricsGoogleDocsLink) {
        setLyricsStatus('Fetching lyrics from Google Docs…');
        const fetched = await fetchLyricsFromDocs(track.lyricsGoogleDocsLink);
        if (fetched) { lyrics = fetched; setLyricsStatus('✓ Lyrics loaded'); break; }
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
Hook the curator immediately, describe the sound and mood vividly, mention key influences if apparent,
and end with a clear ask to be added to a relevant playlist.
Use professional but energetic music industry language. No emojis. No headers. Just the pitch text.

RELEASE DETAILS:
Artist: ${release.mainArtist}${collabs ? ` feat. ${collabs}` : ''}${features ? ` (ft. ${features})` : ''}
Title: ${release.releaseTitle}
Type: ${release.releaseType.toUpperCase()}
Genre: ${release.genre}
Release Date: ${release.releaseDate || 'TBD'}
Explicit: ${release.explicitContent ? 'Yes' : 'No'}
Tracks:
${trackList}
${credits ? `Credits: ${credits}` : ''}
${lyrics ? `\nLYRICS EXCERPT:\n${lyrics.slice(0, 800)}` : ''}`;

    try {
      // Gemini 1.5 Flash — free tier: 15 RPM, 1M TPM, no credit card needed
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${settings.geminiApiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 512, temperature: 0.85 },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.error?.message || `HTTP ${res.status}`;
        if (msg.toLowerCase().includes('api key') || res.status === 400 || res.status === 403) {
          setError('Invalid API key. Get a free key at aistudio.google.com/apikey → paste in Settings → AI.');
        } else {
          setError(`Gemini error: ${msg}`);
        }
        return;
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        setPitch(text.trim());
      } else {
        setError('Empty response from Gemini. Please try again.');
      }
    } catch (e) {
      setError(`Network error: ${e instanceof Error ? e.message : 'Please try again.'}`);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music2 className="w-4 h-4 text-green-400" />
          <span className="text-sm font-bold">Spotify Playlist Pitch</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">Gemini AI</span>
        </div>
        <button onClick={() => { setOpen(false); setPitch(''); setError(''); }} className="text-xs text-zinc-600 hover:text-zinc-400">✕ Close</button>
      </div>

      {lyricsStatus && (
        <p className={`text-xs ${lyricsStatus.startsWith('✓') ? 'text-emerald-400' : 'text-zinc-500'}`}>{lyricsStatus}</p>
      )}

      {loading && (
        <div className="flex items-center gap-3 py-6 justify-center">
          <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
          <span className="text-sm text-zinc-400">Writing pitch with Gemini…</span>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {pitch && !loading && (
        <>
          <div className="bg-zinc-900/60 rounded-xl p-4 border border-white/5">
            <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{pitch}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleCopy} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 text-sm font-medium transition-all">
              {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Pitch</>}
            </button>
            <button onClick={generate} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-zinc-400 hover:text-white text-sm transition-all">
              <Sparkles className="w-4 h-4" /> Regenerate
            </button>
            <a href="https://artists.spotify.com" target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-zinc-400 hover:text-white text-sm transition-all ml-auto">
              <ExternalLink className="w-4 h-4" /> Spotify for Artists
            </a>
          </div>
          <p className="text-[10px] text-zinc-700">Paste into Spotify for Artists → Music → select release → Pitch to Editors</p>
        </>
      )}
    </div>
  );
}
