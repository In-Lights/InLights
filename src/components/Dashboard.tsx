import { useState, useEffect, useMemo } from 'react';
import { Search, Download, Trash2, Eye, Filter, Music2, Clock, CheckCircle, Calendar, XCircle, BarChart3, Loader2, RefreshCw, Flag, CheckSquare, Square, ChevronDown } from 'lucide-react';
import { ReleaseSubmission, ReleaseStatus } from '../types';
import { getSubmissions, updateSubmissionStatus, deleteSubmission, exportToCSV, updateSubmission } from '../store';
import { ReleaseTypeBadge } from './ui/Badge';
import ExportPDFButton from './ExportPDF';

interface Props {
  onViewRelease: (release: ReleaseSubmission) => void;
  refreshKey: number;
  onRefresh: () => void;
}


// Extract Drive file ID and return thumbnail URL
function driveThumbnail(url: string, size = 300): string | null {
  const m = url?.match(/\/file\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/);
  const id = m?.[1] || m?.[2];
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${size}` : null;
}

// Best available thumbnail: direct image URL → Drive thumbnail → null
function artworkSrc(release: ReleaseSubmission): string | null {
  if (release.coverArtImageUrl) return release.coverArtImageUrl;
  return driveThumbnail(release.coverArtDriveLink);
}

// "Artist1, Artist2" — main artist + collaborators
function formatArtists(release: ReleaseSubmission): string {
  const names = [release.mainArtist, ...release.collaborations.map(c => c.name).filter(Boolean)];
  return names.join(', ');
}

// "Track Title (feat. X, Y)" for single tracks, or just the release title for multi-track
function formatTitle(release: ReleaseSubmission): string {
  const featureNames = release.features.map(f => f.name).filter(Boolean);
  const featSuffix = featureNames.length > 0 ? ` (feat. ${featureNames.join(', ')})` : '';

  if (release.releaseType === 'single' && release.tracks.length === 1) {
    return release.tracks[0]?.title
      ? `${release.tracks[0].title}${featSuffix}`
      : `${release.releaseTitle}${featSuffix}`;
  }
  return `${release.releaseTitle}${featSuffix}`;
}

export default function Dashboard({ onViewRelease, refreshKey, onRefresh }: Props) {
  const [statusFilter, setStatusFilter] = useState<ReleaseStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest');
  const [submissions, setSubmissions] = useState<ReleaseSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleBulkStatus = async (status: ReleaseStatus) => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      await Promise.all([...selected].map(id => updateSubmissionStatus(id, status)));
      setSubmissions(prev => prev.map(r => selected.has(r.id) ? { ...r, status } : r));
      setSelected(new Set());
    } catch { alert('Some updates failed. Please retry.'); }
    finally { setBulkLoading(false); }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} release${selected.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkLoading(true);
    try {
      await Promise.all([...selected].map(id => deleteSubmission(id)));
      setSubmissions(prev => prev.filter(r => !selected.has(r.id)));
      setSelected(new Set());
    } catch { alert('Some deletions failed. Please retry.'); }
    finally { setBulkLoading(false); }
  };

  useEffect(() => {
    setLoading(true);
    getSubmissions()
      .then(setSubmissions)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const stats = useMemo(() => {
    const s = { total: submissions.length, pending: 0, approved: 0, scheduled: 0, released: 0, rejected: 0 };
    submissions.forEach(r => { s[r.status]++; });
    return s;
  }, [submissions]);

  const filtered = useMemo(() => {
    let result = [...submissions];
    if (statusFilter !== 'all') result = result.filter(r => r.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.releaseTitle.toLowerCase().includes(q) ||
        r.mainArtist.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    }
    if (sortBy === 'newest') result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else if (sortBy === 'oldest') result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    else result.sort((a, b) => a.releaseTitle.localeCompare(b.releaseTitle));
    return result;
  }, [submissions, statusFilter, search, sortBy]);

  const allSelected = selected.size > 0 && filtered.length > 0 && filtered.every(r => selected.has(r.id));
  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map(r => r.id)));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this submission?')) return;
    setActionLoading(id);
    try {
      await deleteSubmission(id);
      setSubmissions(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      alert('Failed to delete. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusChange = async (id: string, status: ReleaseStatus) => {
    setActionLoading(id + status);
    try {
      await updateSubmissionStatus(id, status);
      setSubmissions(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch {
      alert('Failed to update status. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const statCards = [
    { label: 'Total', value: stats.total, icon: BarChart3, color: 'text-white', bg: 'bg-zinc-800/50' },
    { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Scheduled', value: stats.scheduled, icon: Calendar, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Released', value: stats.released, icon: Music2, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  ];

  return (
    <div className="space-y-6 fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map(s => (
          <div key={s.label} className={`glass-card rounded-xl p-4 ${s.bg}`}>
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-zinc-500">{s.label}</span>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, artist, or ID..."
            className="input-dark w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as ReleaseStatus | 'all')}
              className="input-dark pl-10 pr-8 py-2.5 rounded-xl text-sm appearance-none"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="scheduled">Scheduled</option>
              <option value="released">Released</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'newest' | 'oldest' | 'title')}
            className="input-dark px-3 py-2.5 rounded-xl text-sm appearance-none"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="title">Title A–Z</option>
          </select>
          <button
            onClick={() => exportToCSV(filtered)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white text-sm transition-all"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <ExportPDFButton releases={filtered} />
          <button
            onClick={onRefresh}
            className="p-2.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white transition-all"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-500/10 border border-violet-500/25 fade-in flex-wrap">
          <span className="text-sm font-medium text-violet-300">{selected.size} selected</span>
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {(['approved','scheduled','released','rejected','pending'] as ReleaseStatus[]).map(s => (
              <button key={s} onClick={() => handleBulkStatus(s)} disabled={bulkLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-zinc-300 hover:bg-white/10 transition-all disabled:opacity-50 capitalize">
                → {s}
              </button>
            ))}
            <button onClick={handleBulkDelete} disabled={bulkLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50 ml-auto">
              {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : <Trash2 className="w-3 h-3 inline mr-1" />}
              Delete all
            </button>
          </div>
          <button onClick={() => setSelected(new Set())} className="text-zinc-500 hover:text-white text-xs">✕ Clear</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Music2 className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500">No submissions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Select all row */}
          <div className="flex items-center gap-3 px-1">
            <button onClick={toggleSelectAll} className="p-1 text-zinc-500 hover:text-white transition-colors">
              {allSelected ? <CheckSquare className="w-4 h-4 accent-text" /> : <Square className="w-4 h-4" />}
            </button>
            <span className="text-xs text-zinc-600">{allSelected ? 'Deselect all' : `Select all (${filtered.length})`}</span>
          </div>

          {filtered.map(release => (
            <div key={release.id} className={`glass-card rounded-xl p-4 flex items-center gap-3 hover:bg-white/[0.03] transition-all ${selected.has(release.id) ? 'border border-violet-500/30 bg-violet-500/[0.04]' : ''}`}>
              {/* Checkbox */}
              <button onClick={() => toggleSelect(release.id)} className="p-1 text-zinc-600 hover:text-white transition-colors flex-shrink-0">
                {selected.has(release.id) ? <CheckSquare className="w-4 h-4 accent-text" /> : <Square className="w-4 h-4" />}
              </button>
              {/* Artwork thumbnail */}
              <div className="w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden bg-zinc-900 border border-white/5">
                {artworkSrc(release) ? (
                  <img src={artworkSrc(release)!} alt="" className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music2 className="w-5 h-5 text-zinc-700" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-xs text-zinc-500">{release.id}</span>
                  <ReleaseTypeBadge type={release.releaseType} />
                  {release.explicitContent && (
                    <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded">E</span>
                  )}
                  {release.priority === 'urgent' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                      <Flag className="w-2.5 h-2.5" /> URGENT
                    </span>
                  )}
                </div>
                <p className="font-semibold truncate">{formatTitle(release)}</p>
                <p className="text-sm text-zinc-400 truncate">{formatArtists(release)}</p>
                <p className="text-xs text-zinc-600 mt-1">{release.genre} • {release.releaseDate} • {release.tracks.length} track{release.tracks.length !== 1 ? 's' : ''}</p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <select
                  value={release.status}
                  onChange={e => handleStatusChange(release.id, e.target.value as ReleaseStatus)}
                  disabled={actionLoading === release.id + release.status}
                  className="input-dark px-2 py-1.5 rounded-lg text-xs appearance-none"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="released">Released</option>
                  <option value="rejected">Rejected</option>
                </select>

                <button
                  onClick={() => onViewRelease(release)}
                  className="p-2 rounded-lg text-zinc-400 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
                  title="View details"
                >
                  <Eye className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDelete(release.id)}
                  disabled={actionLoading === release.id}
                  className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                  title="Delete"
                >
                  {actionLoading === release.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
