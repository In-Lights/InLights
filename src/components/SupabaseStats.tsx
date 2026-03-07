import { useState, useEffect } from 'react';
import { Database, Users, MessageSquare, Activity, RefreshCw, ExternalLink } from 'lucide-react';
import { supabase } from '../store';

interface Stats {
  releases: number;
  pending: number;
  approved: number;
  admins: number;
  comments: number;
  activityLogs: number;
}

export default function SupabaseStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = async () => {
    setLoading(true);
    try {
      const [releases, admins, comments, logs] = await Promise.all([
        supabase.from('releases').select('status', { count: 'exact' }),
        supabase.from('admin_users').select('id', { count: 'exact' }),
        supabase.from('release_comments').select('id', { count: 'exact' }),
        supabase.from('admin_activity_log').select('id', { count: 'exact' }),
      ]);

      const rows = releases.data || [];
      setStats({
        releases: releases.count ?? 0,
        pending: rows.filter(r => r.status === 'pending').length,
        approved: rows.filter(r => r.status === 'approved').length,
        admins: admins.count ?? 0,
        comments: comments.count ?? 0,
        activityLogs: logs.count ?? 0,
      });
      setLastRefresh(new Date());
    } catch {
      // silently fail
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const tiles = stats ? [
    { icon: Database, label: 'Total Releases', value: stats.releases, color: 'text-violet-400' },
    { icon: Activity, label: 'Pending', value: stats.pending, color: 'text-amber-400' },
    { icon: Database, label: 'Approved', value: stats.approved, color: 'text-emerald-400' },
    { icon: Users, label: 'Team Members', value: stats.admins, color: 'text-blue-400' },
    { icon: MessageSquare, label: 'Comments', value: stats.comments, color: 'text-pink-400' },
    { icon: Activity, label: 'Activity Logs', value: stats.activityLogs, color: 'text-zinc-400' },
  ] : [];

  return (
    <div className="space-y-4">
      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white/[0.03] border border-white/8 p-4 animate-pulse">
              <div className="h-3 bg-zinc-800 rounded w-2/3 mb-2" />
              <div className="h-6 bg-zinc-800 rounded w-1/3" />
            </div>
          ))
        ) : tiles.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-xl bg-white/[0.03] border border-white/8 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <p className="text-xs text-zinc-500">{label}</p>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-600">
          Last refreshed {lastRefresh.toLocaleTimeString()}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <a
            href="https://app.supabase.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Open Supabase
          </a>
        </div>
      </div>
    </div>
  );
}
