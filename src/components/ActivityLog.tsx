import { useState, useEffect } from 'react';
import { Activity, Trash2, RefreshCw, Loader2, CheckCircle, XCircle, Clock, Calendar, Music2, Edit2, Shield, User, AlertTriangle } from 'lucide-react';
import { getActivityLog, clearActivityLog, ActivityLogEntry } from '../store';

const ACTION_META: Record<string, { icon: React.FC<{ className?: string }>; color: string; bg: string }> = {
  'Submitted release':  { icon: Music2,       color: 'text-violet-400',  bg: 'bg-violet-500/10' },
  'Status → approved':  { icon: CheckCircle,  color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  'Status → rejected':  { icon: XCircle,      color: 'text-red-400',     bg: 'bg-red-500/10' },
  'Status → pending':   { icon: Clock,        color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  'Status → scheduled': { icon: Calendar,     color: 'text-blue-400',    bg: 'bg-blue-500/10' },
  'Status → released':  { icon: Music2,       color: 'text-violet-400',  bg: 'bg-violet-500/10' },
  'Edited release':     { icon: Edit2,        color: 'text-zinc-300',    bg: 'bg-zinc-800' },
  'Deleted release':    { icon: Trash2,       color: 'text-red-400',     bg: 'bg-red-500/10' },
};

const ROLE_COLOR: Record<string, string> = {
  owner:    'text-amber-400',
  admin:    'text-violet-400',
  reviewer: 'text-blue-400',
};

function getMeta(action: string) {
  return ACTION_META[action] || { icon: Activity, color: 'text-zinc-400', bg: 'bg-zinc-800' };
}

function formatTime(iso: string): { relative: string; absolute: string } {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  let relative: string;
  if (m < 1) relative = 'just now';
  else if (m < 60) relative = `${m}m ago`;
  else if (m < 1440) relative = `${Math.floor(m / 60)}h ago`;
  else if (m < 10080) relative = `${Math.floor(m / 1440)}d ago`;
  else relative = date.toLocaleDateString();
  const absolute = date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return { relative, absolute };
}

function groupByDate(entries: ActivityLogEntry[]): { label: string; entries: ActivityLogEntry[] }[] {
  const groups: Record<string, ActivityLogEntry[]> = {};
  entries.forEach(e => {
    const d = new Date(e.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    let label: string;
    if (d.toDateString() === today.toDateString()) label = 'Today';
    else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
    else label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(e);
  });
  return Object.entries(groups).map(([label, entries]) => ({ label, entries }));
}

export default function ActivityLog() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'status' | 'edits' | 'deletes'>('all');
  const [clearing, setClearing] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try { setEntries(await getActivityLog(200)); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load log'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleClear = async () => {
    if (!confirm('Clear all activity log entries? This cannot be undone.')) return;
    setClearing(true);
    try { await clearActivityLog(); setEntries([]); }
    catch { alert('Failed to clear log.'); }
    finally { setClearing(false); }
  };

  const filtered = entries.filter(e => {
    if (filter === 'status') return e.action.startsWith('Status →');
    if (filter === 'edits') return e.action === 'Edited release';
    if (filter === 'deletes') return e.action === 'Deleted release';
    return true;
  });

  const grouped = groupByDate(filtered);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-bold flex items-center gap-2">
            <Activity className="w-4 h-4 accent-text" /> Activity Log
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">Every admin action, timestamped</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="p-2 rounded-xl text-zinc-500 hover:text-white border border-white/8 hover:bg-white/5 transition-all">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {entries.length > 0 && (
            <button onClick={handleClear} disabled={clearing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-zinc-500 hover:text-red-400 border border-white/8 hover:border-red-500/30 hover:bg-red-500/5 transition-all">
              {clearing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Clear log
            </button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {([
          ['all', 'All', entries.length],
          ['status', 'Status changes', entries.filter(e => e.action.startsWith('Status →')).length],
          ['edits', 'Edits', entries.filter(e => e.action === 'Edited release').length],
          ['deletes', 'Deletions', entries.filter(e => e.action === 'Deleted release').length],
        ] as [typeof filter, string, number][]).map(([val, label, count]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              filter === val
                ? 'border-current text-white'
                : 'border-white/8 text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
            }`}
            style={filter === val ? { borderColor: 'var(--accent)', background: 'var(--accent-subtle)', color: 'var(--accent)' } : {}}>
            {label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filter === val ? 'bg-white/20' : 'bg-white/5'}`}>{count}</span>
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Log */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-zinc-600">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm text-zinc-500">No activity yet</p>
          <p className="text-xs mt-1">Actions will appear here as admins use the portal</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ label, entries: dayEntries }) => (
            <div key={label}>
              {/* Day divider */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider">{label}</span>
                <div className="flex-1 h-px bg-white/[0.05]" />
                <span className="text-[10px] text-zinc-700">{dayEntries.length} action{dayEntries.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Entries */}
              <div className="space-y-1.5">
                {dayEntries.map(entry => {
                  const meta = getMeta(entry.action);
                  const Icon = meta.icon;
                  const time = formatTime(entry.createdAt);
                  const roleColor = ROLE_COLOR[entry.adminRole || ''] || 'text-zinc-500';

                  return (
                    <div key={entry.id}
                      className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] transition-all group">
                      {/* Icon */}
                      <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold ${meta.color}`}>{entry.action}</span>
                          {entry.entityLabel && (
                            <span className="text-xs text-zinc-300 truncate max-w-[200px]">{entry.entityLabel}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                            <User className="w-3 h-3" />
                            <span className="font-medium">@{entry.adminUsername}</span>
                          </span>
                          {entry.adminRole && (
                            <span className={`flex items-center gap-1 text-[11px] font-medium ${roleColor}`}>
                              <Shield className="w-2.5 h-2.5" />
                              {entry.adminRole}
                            </span>
                          )}
                          {entry.meta && Object.keys(entry.meta).length > 0 && entry.action === 'Edited release' && (
                            <span className="text-[10px] text-zinc-600">
                              {(entry.meta.fields as string[])?.slice(0, 3).join(', ')}
                              {((entry.meta.fields as string[])?.length || 0) > 3 && ` +${(entry.meta.fields as string[]).length - 3} more`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Time */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-[11px] text-zinc-500" title={time.absolute}>{time.relative}</p>
                        <p className="text-[10px] text-zinc-700 mt-0.5">{time.absolute}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
