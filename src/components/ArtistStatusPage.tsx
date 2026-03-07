import { useState, useEffect } from 'react';
import { Music2, Clock, CheckCircle, Calendar, XCircle, Loader2, Search, ChevronRight } from 'lucide-react';
import { ReleaseSubmission, AdminSettings, DEFAULT_ADMIN_SETTINGS } from '../types';
import { getSubmissions } from '../store';

interface Props {
  settings: AdminSettings;
}

const STATUS_META: Record<string, { label: string; icon: React.FC<{ className?: string }>; color: string; bg: string; desc: string }> = {
  pending:   { label: 'Under Review',  icon: Clock,        color: 'text-amber-400',  bg: 'bg-amber-500/10',   desc: 'Your submission is being reviewed by our team.' },
  approved:  { label: 'Approved',      icon: CheckCircle,  color: 'text-emerald-400',bg: 'bg-emerald-500/10', desc: 'Your release has been approved and is being prepared.' },
  scheduled: { label: 'Scheduled',     icon: Calendar,     color: 'text-blue-400',   bg: 'bg-blue-500/10',    desc: 'Your release is scheduled and will go live on the release date.' },
  released:  { label: 'Live',          icon: Music2,       color: 'text-violet-400', bg: 'bg-violet-500/10',  desc: 'Your release is now live on streaming platforms.' },
  rejected:  { label: 'Not Approved',  icon: XCircle,      color: 'text-red-400',    bg: 'bg-red-500/10',     desc: 'Your release was not approved. Please check label notes or resubmit.' },
};

function formatDate(s: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return s; }
}

function artworkSrc(r: ReleaseSubmission): string | null {
  if (r.coverArtImageUrl) return r.coverArtImageUrl;
  const m = r.coverArtDriveLink?.match(/\/file\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/);
  const id = m?.[1] || m?.[2];
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w400` : null;
}

function buildTitle(r: ReleaseSubmission) {
  const feats = r.features.map(f => f.name).filter(Boolean);
  const featSuffix = feats.length ? ` (feat. ${feats.join(', ')})` : '';
  if (r.releaseType === 'single' && r.tracks.length === 1 && r.tracks[0]?.title)
    return `${r.tracks[0].title}${featSuffix}`;
  return `${r.releaseTitle}${featSuffix}`;
}

function buildArtists(r: ReleaseSubmission) {
  return [r.mainArtist, ...r.collaborations.map(c => c.name).filter(Boolean)].join(', ');
}

export default function ArtistStatusPage({ settings }: Props) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ReleaseSubmission[]>([]);
  const [searched, setSearched] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSubmitted(false);
    try {
      const all = await getSubmissions();
      const q = query.trim().toLowerCase();
      const found = all.filter(r =>
        r.id.toLowerCase() === q ||
        r.mainArtist.toLowerCase().includes(q) ||
        r.releaseTitle.toLowerCase().includes(q)
      );
      setResults(found);
      setSearched(query.trim());
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          {settings.companyLogo && (
            <img src={settings.companyLogo} alt={settings.companyName} className="h-9 w-9 object-contain rounded-xl" />
          )}
          <div>
            <h1 className="font-bold">{settings.companyName}</h1>
            <p className="text-xs text-zinc-500">Release Status</p>
          </div>
          <a href="/" className="ml-auto text-xs text-zinc-600 hover:text-zinc-400 transition-colors">← Submit a release</a>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold">Track Your Release</h2>
          <p className="text-zinc-400 text-sm">Enter your submission ID, artist name, or release title to check your status.</p>
        </div>

        {/* Search */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Submission ID, artist name, or title…"
                className="input-dark w-full pl-10 pr-4 py-3 rounded-xl"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="btn-primary px-5 py-3 rounded-xl flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Results */}
        {submitted && (
          <div className="space-y-4 fade-in">
            {results.length === 0 ? (
              <div className="text-center py-12 glass-card rounded-2xl">
                <Music2 className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-400 font-medium">No releases found</p>
                <p className="text-zinc-600 text-sm mt-1">Try your submission ID, exact artist name, or release title.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-zinc-500">{results.length} result{results.length !== 1 ? 's' : ''} for "{searched}"</p>
                {results.map(r => {
                  const meta = STATUS_META[r.status] || STATUS_META.pending;
                  const Icon = meta.icon;
                  return (
                    <div key={r.id} className="glass-card rounded-2xl overflow-hidden">
                      {/* Status banner */}
                      <div className={`px-5 py-3 flex items-center gap-3 ${meta.bg}`}>
                        <Icon className={`w-4 h-4 ${meta.color} flex-shrink-0`} />
                        <div>
                          <p className={`font-bold text-sm ${meta.color}`}>{meta.label}</p>
                          <p className="text-xs text-zinc-400">{meta.desc}</p>
                        </div>
                      </div>

                      {/* Release info */}
                      <div className="p-5 flex gap-4">
                        {artworkSrc(r) && (
                          <img src={artworkSrc(r)!} alt="Cover"
                            className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border border-white/10 bg-zinc-900"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="font-bold text-lg leading-tight">{buildTitle(r)}</p>
                          <p className="text-zinc-400 text-sm">{buildArtists(r)}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 pt-1">
                            <span className="font-mono">{r.id}</span>
                            <span className="capitalize">{r.releaseType}</span>
                            {r.genre && <span>{r.genre}</span>}
                            {r.releaseDate && <span>📅 {r.releaseDate}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Tracklist */}
                      {r.tracks.length > 0 && (
                        <div className="px-5 pb-5">
                          <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-bold mb-2">Tracks</p>
                          <div className="space-y-1">
                            {r.tracks.map((t, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm">
                                <span className="text-zinc-600 w-5 text-right text-xs">{i + 1}</span>
                                <span className={t.explicit ? 'text-zinc-300' : 'text-zinc-300'}>{t.title || 'Untitled'}</span>
                                {t.explicit && <span className="text-[10px] border border-red-400/40 text-red-400 px-1 rounded">E</span>}
                                {t.isrc && <span className="ml-auto text-[10px] font-mono text-zinc-600">{t.isrc}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Label notes — only show if approved/rejected */}
                      {r.labelNotes && (r.status === 'approved' || r.status === 'rejected') && (
                        <div className="mx-5 mb-5 bg-zinc-900/60 border border-white/5 rounded-xl px-4 py-3">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1">Label Notes</p>
                          <p className="text-sm text-zinc-300">{r.labelNotes}</p>
                        </div>
                      )}

                      <div className="px-5 pb-4 text-xs text-zinc-600">
                        Submitted {formatDate(r.createdAt)} · Last updated {formatDate(r.updatedAt)}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Footer */}
        {(settings.labelEmail || settings.labelInstagram) && (
          <div className="text-center text-xs text-zinc-600 pt-4 border-t border-white/5 space-y-1">
            <p>Questions? Reach out to {settings.companyName}</p>
            <div className="flex justify-center gap-4">
              {settings.labelEmail && <a href={`mailto:${settings.labelEmail}`} className="hover:text-zinc-400">{settings.labelEmail}</a>}
              {settings.labelInstagram && <a href={`https://instagram.com/${settings.labelInstagram.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400">@{settings.labelInstagram.replace('@','')}</a>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
