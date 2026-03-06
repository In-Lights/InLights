import { useState, useEffect } from 'react';
import { ReleaseSubmission, ReleaseStatus } from '../types';
import { getAllReleases, updateRelease, exportReleasesToCSV } from '../store';
import { Search, Filter, Download, Eye, Disc3, RefreshCw } from 'lucide-react';

interface Props {
  onViewRelease: (release: ReleaseSubmission) => void;
}

const STATUS_CONFIG: Record<ReleaseStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  approved: { label: 'Approved', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  scheduled: { label: 'Scheduled', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  released: { label: 'Released', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

export default function Dashboard({ onViewRelease }: Props) {
  const [releases, setReleases] = useState<ReleaseSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReleaseStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest');

  const loadReleases = async () => {
    setLoading(true);
    const data = await getAllReleases();
    setReleases(data);
    setLoading(false);
  };

  useEffect(() => { loadReleases(); }, []);

  const filtered = releases
    .filter(r => statusFilter === 'all' || r.status === statusFilter)
    .filter(r => {
      if (!search) return true;
      const q = search.toLowerCase();
      return r.mainArtist.toLowerCase().includes(q) ||
        r.releaseTitle.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      if (sortBy === 'oldest') return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      return a.releaseTitle.localeCompare(b.releaseTitle);
    });

  const counts = {
    all: releases.length,
    pending: releases.filter(r => r.status === 'pending').length,
    approved: releases.filter(r => r.status === 'approved').length,
    scheduled: releases.filter(r => r.status === 'scheduled').length,
    released: releases.filter(r => r.status === 'released').length,
    rejected: releases.filter(r => r.status === 'rejected').length,
  };

  const handleQuickStatus = async (id: string, status: ReleaseStatus) => {
    await updateRelease(id, { status });
    loadReleases();
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {([['all', 'Total', 'bg-zinc-700/50', 'text-zinc-300'], ['pending', 'Pending', 'bg-yellow-500/10', 'text-yellow-300'], ['approved', 'Approved', 'bg-green-500/10', 'text-green-300'], ['scheduled', 'Scheduled', 'bg-blue-500/10', 'text-blue-300'], ['released', 'Released', 'bg-purple-500/10', 'text-purple-300'], ['rejected', 'Rejected', 'bg-red-500/10', 'text-red-300']] as const).map(([key, label, bg, text]) => (
          <button key={key} onClick={() => setStatusFilter(key)}
            className={`${bg} rounded-xl p-4 text-center transition-all border ${statusFilter === key ? 'border-purple-500 ring-1 ring-purple-500/50' : 'border-transparent hover:border-zinc-600'}`}>
            <div className={`text-2xl font-bold ${text}`}>{counts[key]}</div>
            <div className="text-xs text-zinc-400 mt-1">{label}</div>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input type="text" placeholder="Search by artist, title, or ID..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm focus:border-purple-500 focus:outline-none" />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-8 py-2.5 text-white text-sm focus:border-purple-500 focus:outline-none appearance-none cursor-pointer">
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="title">By Title</option>
            </select>
          </div>
          <button onClick={loadReleases} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => exportReleasesToCSV(releases)}
            className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors text-sm">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-20">
          <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading releases...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-zinc-800/30 rounded-xl border border-zinc-700">
          <Disc3 className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400 text-lg">No releases found</p>
          <p className="text-zinc-500 text-sm mt-1">
            {releases.length === 0 ? 'Waiting for submissions...' : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
        <div className="bg-zinc-800/30 rounded-xl border border-zinc-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-4 py-3">ID</th>
                  <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-4 py-3">Artist / Title</th>
                  <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-4 py-3">Type</th>
                  <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-4 py-3">Date</th>
                  <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700/50">
                {filtered.map(r => {
                  const st = STATUS_CONFIG[r.status];
                  return (
                    <tr key={r.id} className="hover:bg-zinc-700/20 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-1 rounded">{r.id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white font-medium text-sm">{r.releaseTitle}</div>
                        <div className="text-zinc-400 text-xs">{r.mainArtist}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-zinc-300 bg-zinc-700 px-2 py-1 rounded uppercase">{r.releaseType}</span>
                      </td>
                      <td className="px-4 py-3">
                        <select value={r.status} onChange={e => handleQuickStatus(r.id, e.target.value as ReleaseStatus)}
                          className={`text-xs font-medium px-2 py-1 rounded border ${st.color} bg-transparent cursor-pointer focus:outline-none`}>
                          <option value="pending" className="bg-zinc-900 text-white">⏳ Pending</option>
                          <option value="approved" className="bg-zinc-900 text-white">✅ Approved</option>
                          <option value="scheduled" className="bg-zinc-900 text-white">📅 Scheduled</option>
                          <option value="released" className="bg-zinc-900 text-white">🎵 Released</option>
                          <option value="rejected" className="bg-zinc-900 text-white">❌ Rejected</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-zinc-400">{new Date(r.submittedAt).toLocaleDateString()}</div>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => onViewRelease(r)}
                          className="flex items-center gap-1 text-purple-400 hover:text-purple-300 text-sm transition-colors">
                          <Eye className="w-4 h-4" /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
