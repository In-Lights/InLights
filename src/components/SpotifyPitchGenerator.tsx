import { useState, useEffect } from 'react';
import { Sparkles, Copy, Check, Loader2, ExternalLink, Music2, AlertTriangle, RefreshCw } from 'lucide-react';
import { ReleaseSubmission } from '../types';
import { getAdminSettings } from '../store';

interface Props {
  release: ReleaseSubmission;
}

// Models to try in order
const MODELS = [
  'gemini-flash-latest',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

async function fetchLyricsFromDocs(docsUrl: string): Promise<string | null> {
  if (!docsUrl) return null;
  const match = docsUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const exportUrl = `https://docs.google.com/document/d/${match[1]}/export?format=txt`;
  try {
    const res = await fetch(exportUrl);
    if (!res.ok) return null;
    return (await res.text()).trim().slice(0, 3000);
  } catch { return null; }
}

async function callGemini(model: string, prompt: string, apiKey: string): Promise<{ text?: string; error?: string; quota?: boolean; retryAfter?: number }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.85 },
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      const msg: string = data?.error?.message || `HTTP ${res.status}`;
      const isQuota = msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || res.status === 429;
      const retryMatch = msg.match(/retry in ([\d.]+)s/i);
      const retryAfter = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : undefined;
      return { error: msg, quota: isQuota, retryAfter };
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? { text: text.trim() } : { error: 'Empty response from Gemini.' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Network error' };
  }
}

export default function SpotifyPitchGenerator({ release }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pitch, setPitch] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [errorType, setErrorType] = useState<'quota' | 'auth' | 'generic'>('generic');
  const [retryIn, setRetryIn] = useState(0);
  const [lyricsStatus, setLyricsStatus] = useState('');
  const [usedModel, setUsedModel] = useState('');

  useEffect(() => {
    if (retryIn <= 0) return;
    const t = setTimeout(() => setRetryIn(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [retryIn]);

  const generate = async () => {
    setLoading(true);
    setError('');
    setPitch('');
    setLyricsStatus('');
    setUsedModel('');
    setRetryIn(0);

    const settings = await getAdminSettings();
    if (!settings.geminiApiKey) {
      setError('No Gemini API key set. Go to Settings → AI to add your free key.');
      setErrorType('auth');
      setLoading(false);
      return;
    }

    // Fetch lyrics from all tracks
    let lyrics = '';
    for (const track of release.tracks) {
      if (track.lyricsGoogleDocsLink) {
        setLyricsStatus('Fetching lyrics…');
        const fetched = await fetchLyricsFromDocs(track.lyricsGoogleDocsLink);
        if (fetched) { lyrics = fetched; setLyricsStatus('✓ Lyrics loaded'); break; }
      }
    }
    if (!lyrics) setLyricsStatus('');

    const features = release.features.map(f => f.name).filter(Boolean).join(', ');
    const collabs = release.collaborations.map(c => c.name).filter(Boolean).join(', ');
    const trackList = release.tracks.map((t, i) =>
      `Track ${i + 1}: "${t.title}"${t.explicit ? ' [Explicit]' : ''}${t.producedBy ? ` — Prod. ${t.producedBy}` : ''}`
    ).join('\n');

    // Pick the best candidate single (first track or most prominent)
    const keySong = release.tracks[0]?.title || release.releaseTitle;
    const keySongIndex = 1;

    const prompt = `You are a senior music PR strategist writing a full press release and Spotify pitch document for a label.

Generate a COMPLETE, detailed press release using EXACTLY this structure and format:

---

[RELEASE TITLE IN CAPS]
[ARTIST NAME IN CAPS]
PRESS RELEASE

[ARTIST]: "[KEY SONG]" Pitch Summary for [Genre] Genre

1. Short Description of ${release.releaseType === 'single' ? 'Single' : release.releaseType === 'ep' ? 'EP' : 'Album'}: [RELEASE TITLE IN CAPS AND BOLD]

Write 3-4 sentences describing: the artistic vision and narrative of the release, the emotional themes (be specific), the production soundscape (trap/R&B/pop etc), and the cultural or personal statement the artist is making. Be vivid and specific.

2. Choice of Key Song (Breakout Single) [KEY SONG NAME IN CAPS]

(Track ${keySongIndex} / genre is [genre])

3. Short Description of Key Song

Write 4-5 sentences covering: the BPM and production style, the core lyrical theme in one sentence, WHY this track is perfect for playlists (be specific about mood/energy), quote ONE key lyric if lyrics are provided (with translation if not in English), and what makes this track redefine the genre.

---

Key Campaign Point to Include in the Full Email:

• Content Asset: Write a detailed recommendation for the content/visual strategy — music video concept, which other track to pair it with for contrast, release timing strategy, and how this builds the artist narrative.

---

Write a 2-sentence closing that ties the pitch together, mentions the genre positioning, and makes a direct ask to playlist curators.

---

IMPORTANT RULES:
- Write the FULL document — do not cut it short under any circumstances
- Be specific and detailed — no generic filler phrases
- Use bold formatting with ** for key phrases
- If lyrics are provided, quote the most powerful line
- The document should be 400-600 words minimum

RELEASE DATA:
Artist: ${release.mainArtist}${collabs ? ` with ${collabs}` : ''}${features ? ` feat. ${features}` : ''}
Release Title: ${release.releaseTitle}
Type: ${release.releaseType.toUpperCase()}
Genre: ${release.genre || 'not specified'}
Release Date: ${release.releaseDate || 'TBD'}
Explicit: ${release.explicitContent ? 'Yes' : 'No'}

TRACKLIST:
${trackList}

${lyrics ? `LYRICS (use to identify key themes and quote the best line):\n${lyrics.slice(0, 2000)}` : 'No lyrics provided — infer themes from title and genre.'}`;

    // Try each model in order
    let lastError = '';
    let lastRetry: number | undefined;
    for (const model of MODELS) {
      const result = await callGemini(model, prompt, settings.geminiApiKey);

      if (result.text) {
        setPitch(result.text);
        setUsedModel(model);
        setLyricsStatus(lyrics ? '✓ Lyrics loaded' : '');
        setLoading(false);
        return;
      }

      lastError = result.error || 'Unknown error';
      lastRetry = result.retryAfter;

      if (!result.quota && !lastError.includes('not found') && !lastError.includes('not supported')) break;
    }

    setLoading(false);
    setLyricsStatus('');

    if (lastError.includes('quota') || lastError.includes('RESOURCE_EXHAUSTED')) {
      setErrorType('quota');
      setError('quota');
      if (lastRetry) setRetryIn(lastRetry);
    } else if (lastError.toLowerCase().includes('api key') || lastError.includes('403')) {
      setErrorType('auth');
      setError('Invalid API key. Check Settings → AI.');
    } else {
      setErrorType('generic');
      setError(lastError);
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
        <Sparkles className="w-4 h-4" /> Generate Press Release & Pitch
      </button>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Music2 className="w-4 h-4 text-green-400" />
          <span className="text-sm font-bold">Press Release & Spotify Pitch</span>
          {usedModel && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">{usedModel}</span>
          )}
        </div>
        <button onClick={() => { setOpen(false); setPitch(''); setError(''); setRetryIn(0); }} className="text-xs text-zinc-600 hover:text-zinc-400 flex-shrink-0">✕ Close</button>
      </div>

      {lyricsStatus && (
        <p className={`text-xs ${lyricsStatus.startsWith('✓') ? 'text-emerald-400' : 'text-zinc-500'}`}>{lyricsStatus}</p>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-8 justify-center">
          <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          <span className="text-sm text-zinc-400">Writing full press release…</span>
          <span className="text-xs text-zinc-600">This takes 10–20 seconds for a complete document</span>
        </div>
      )}

      {/* Quota error */}
      {error === 'quota' && !loading && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-300">Free tier quota reached</p>
              <p className="text-xs text-amber-400/80 mt-1">{retryIn > 0 ? `Try again in ${retryIn}s.` : 'Try again in a moment.'}</p>
            </div>
          </div>
          <button onClick={generate} disabled={retryIn > 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-all">
            <RefreshCw className="w-3.5 h-3.5" />
            {retryIn > 0 ? `Retry in ${retryIn}s` : 'Retry now'}
          </button>
        </div>
      )}

      {/* Generic/auth error */}
      {error && error !== 'quota' && !loading && (
        <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Output */}
      {pitch && !loading && (
        <>
          <div className="bg-zinc-900/60 rounded-xl p-4 border border-white/5 max-h-[500px] overflow-y-auto">
            <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{pitch}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleCopy} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 text-sm font-medium transition-all">
              {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Full Release</>}
            </button>
            <button onClick={generate} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-zinc-400 hover:text-white text-sm transition-all">
              <Sparkles className="w-4 h-4" /> Regenerate
            </button>
            <a href="https://artists.spotify.com" target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-zinc-400 hover:text-white text-sm transition-all ml-auto">
              <ExternalLink className="w-4 h-4" /> Spotify for Artists
            </a>
          </div>
          <p className="text-[10px] text-zinc-700">Paste pitch section into Spotify for Artists → Music → select release → Pitch to Editors</p>
        </>
      )}
    </div>
  );
}
