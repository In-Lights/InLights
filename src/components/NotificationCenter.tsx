import { useState, useEffect, useRef } from 'react';
import { Bell, X, Music2, CheckCircle, Clock, Calendar, XCircle, Trash2 } from 'lucide-react';
import { supabase } from '../store';
import { ReleaseStatus } from '../types';

interface Notification {
  id: string;
  type: 'new_submission' | 'status_change';
  title: string;
  body: string;
  releaseId: string;
  status?: ReleaseStatus;
  read: boolean;
  createdAt: string;
}

const STORAGE_KEY = 'inlights_notifications';

function loadNotifications(): Notification[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveNotifications(n: Notification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(n.slice(0, 50)));
}

const STATUS_ICON: Record<ReleaseStatus, React.FC<{ className?: string }>> = {
  pending: Clock,
  approved: CheckCircle,
  scheduled: Calendar,
  released: Music2,
  rejected: XCircle,
};

const STATUS_COLOR: Record<ReleaseStatus, string> = {
  pending: 'text-amber-400',
  approved: 'text-emerald-400',
  scheduled: 'text-blue-400',
  released: 'text-violet-400',
  rejected: 'text-red-400',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Props {
  onNavigateToRelease?: (id: string) => void;
}

export default function NotificationCenter({ onNavigateToRelease }: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(loadNotifications);
  const [animating, setAnimating] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter(n => !n.read).length;

  // Persist on change
  useEffect(() => { saveNotifications(notifications); }, [notifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Supabase realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'releases' }, payload => {
        const row = payload.new as Record<string, unknown>;
        const notif: Notification = {
          id: crypto.randomUUID(),
          type: 'new_submission',
          title: 'New Submission',
          body: `${row.main_artist as string} — ${row.release_title as string}`,
          releaseId: row.id as string,
          read: false,
          createdAt: new Date().toISOString(),
        };
        setNotifications(prev => [notif, ...prev]);
        setAnimating(true);
        setTimeout(() => setAnimating(false), 1000);

        // Browser notification if permitted
        if (Notification.permission === 'granted') {
          new Notification('New Release Submission', { body: notif.body, icon: '/favicon.ico' });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'releases' }, payload => {
        const row = payload.new as Record<string, unknown>;
        const old = payload.old as Record<string, unknown>;
        if (row.status === old.status) return;
        const notif: Notification = {
          id: crypto.randomUUID(),
          type: 'status_change',
          title: 'Status Updated',
          body: `${row.main_artist as string} — ${row.release_title as string}`,
          releaseId: row.id as string,
          status: row.status as ReleaseStatus,
          read: false,
          createdAt: new Date().toISOString(),
        };
        setNotifications(prev => [notif, ...prev]);
        setAnimating(true);
        setTimeout(() => setAnimating(false), 1000);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  const dismiss = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));
  const clearAll = () => setNotifications([]);

  const handleClick = (notif: Notification) => {
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    onNavigateToRelease?.(notif.releaseId);
    setOpen(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open && unread > 0) markAllRead(); }}
        className="relative p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
        title="Notifications"
      >
        <Bell className={`w-5 h-5 ${animating ? 'animate-bounce' : ''}`} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1"
            style={{ background: 'var(--accent)' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 glass-card rounded-2xl shadow-2xl z-50 overflow-hidden border border-white/10 fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Bell className="w-4 h-4 accent-text" /> Notifications
              {unread > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold text-white" style={{ background: 'var(--accent)' }}>
                  {unread} new
                </span>
              )}
            </h3>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <button onClick={clearAll} className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10">
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-96">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-zinc-600">
                <Bell className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">No notifications yet</p>
                <p className="text-xs mt-1 opacity-60">New submissions will appear here</p>
              </div>
            ) : (
              notifications.map(notif => {
                const StatusIcon = notif.status ? STATUS_ICON[notif.status] : Music2;
                const statusColor = notif.status ? STATUS_COLOR[notif.status] : 'text-violet-400';
                return (
                  <div key={notif.id}
                    className={`group flex items-start gap-3 px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.03] transition-all cursor-pointer ${!notif.read ? 'bg-white/[0.02]' : ''}`}
                    onClick={() => handleClick(notif)}
                  >
                    {/* Icon */}
                    <div className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${notif.type === 'new_submission' ? 'bg-violet-500/15' : 'bg-zinc-800'}`}>
                      <StatusIcon className={`w-3.5 h-3.5 ${notif.type === 'new_submission' ? 'text-violet-400' : statusColor}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold">{notif.title}</p>
                        {!notif.read && (
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--accent)' }} />
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 truncate mt-0.5">{notif.body}</p>
                      {notif.status && (
                        <p className={`text-[10px] mt-0.5 capitalize font-medium ${statusColor}`}>→ {notif.status}</p>
                      )}
                      <p className="text-[10px] text-zinc-600 mt-1">{timeAgo(notif.createdAt)}</p>
                    </div>

                    {/* Dismiss */}
                    <button
                      onClick={e => { e.stopPropagation(); dismiss(notif.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-zinc-600 hover:text-white transition-all flex-shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-white/5 text-center">
              <p className="text-[10px] text-zinc-600">{notifications.length} notification{notifications.length !== 1 ? 's' : ''} · stored locally</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
