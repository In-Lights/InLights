import { useState, useEffect, useRef } from 'react';
import { Bell, X, Music2, CheckCircle, Clock, Calendar, XCircle } from 'lucide-react';
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
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
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

const STATUS_BG: Record<ReleaseStatus, string> = {
  pending: 'bg-amber-500/10',
  approved: 'bg-emerald-500/10',
  scheduled: 'bg-blue-500/10',
  released: 'bg-violet-500/10',
  rejected: 'bg-red-500/10',
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
  const [ringing, setRinging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter(n => !n.read).length;

  // Persist whenever notifications change
  useEffect(() => { saveNotifications(notifications); }, [notifications]);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Ring animation helper
  const ring = () => {
    setRinging(true);
    setTimeout(() => setRinging(false), 1200);
  };

  // Supabase realtime
  useEffect(() => {
    const channel = supabase
      .channel('notif-center')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'releases' }, payload => {
        const row = payload.new as Record<string, unknown>;
        const notif: Notification = {
          id: crypto.randomUUID(),
          type: 'new_submission',
          title: 'New Submission',
          body: `${row.main_artist} — ${row.release_title}`,
          releaseId: row.id as string,
          read: false,
          createdAt: new Date().toISOString(),
        };
        setNotifications(prev => [notif, ...prev]);
        ring();
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
          body: `${row.main_artist} — ${row.release_title}`,
          releaseId: row.id as string,
          status: row.status as ReleaseStatus,
          read: false,
          createdAt: new Date().toISOString(),
        };
        setNotifications(prev => [notif, ...prev]);
        ring();
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
  const dismiss = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
  };
  const clearAll = () => { setNotifications([]); };

  const handleOpen = () => {
    setOpen(o => !o);
    // Only mark read after a short delay so badge doesn't vanish instantly
    if (!open && unread > 0) {
      setTimeout(markAllRead, 1500);
    }
  };

  const handleClick = (notif: Notification) => {
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    onNavigateToRelease?.(notif.releaseId);
    setOpen(false);
  };

  return (
    <div className="relative" ref={panelRef}>

      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
        title="Notifications"
      >
        <Bell className={`w-5 h-5 transition-transform ${ringing ? 'animate-[wiggle_0.4s_ease-in-out_2]' : ''}`} />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1 shadow-lg"
            style={{ background: 'var(--accent)' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel — uses fixed positioning to avoid sidebar clipping */}
      {open && (
        <div
          className="fixed top-16 right-4 w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl z-[200] overflow-hidden border border-white/10 fade-in lg:absolute lg:top-full lg:right-0 lg:mt-2 lg:fixed-none"
          style={{ background: 'rgba(10,10,12,0.97)', backdropFilter: 'blur(20px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 accent-text" />
              <span className="font-bold text-sm">Notifications</span>
              {unread > 0 && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-bold text-white"
                  style={{ background: 'var(--accent)' }}
                >
                  {unread} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-[11px] text-zinc-600 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto" style={{ maxHeight: '380px' }}>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <Bell className="w-5 h-5 opacity-40" />
                </div>
                <p className="text-sm font-medium text-zinc-500">All caught up</p>
                <p className="text-xs mt-1 text-zinc-700">New submissions will appear here</p>
              </div>
            ) : (
              <div>
                {notifications.map((notif, i) => {
                  const StatusIcon = notif.status ? STATUS_ICON[notif.status] : Music2;
                  const statusColor = notif.status ? STATUS_COLOR[notif.status] : 'text-violet-400';
                  const statusBg = notif.status ? STATUS_BG[notif.status] : 'bg-violet-500/10';
                  const isNew = notif.type === 'new_submission';

                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleClick(notif)}
                      className={`group relative flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-all hover:bg-white/[0.04] ${
                        i < notifications.length - 1 ? 'border-b border-white/[0.04]' : ''
                      } ${!notif.read ? 'bg-white/[0.025]' : ''}`}
                    >
                      {/* Unread dot */}
                      {!notif.read && (
                        <span
                          className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full"
                          style={{ background: 'var(--accent)' }}
                        />
                      )}

                      {/* Icon */}
                      <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${isNew ? 'bg-violet-500/15' : statusBg}`}>
                        <StatusIcon className={`w-4 h-4 ${isNew ? 'text-violet-400' : statusColor}`} />
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-xs font-semibold ${!notif.read ? 'text-white' : 'text-zinc-300'}`}>
                            {notif.title}
                          </p>
                          <span className="text-[10px] text-zinc-600 flex-shrink-0">{timeAgo(notif.createdAt)}</span>
                        </div>
                        <p className="text-xs text-zinc-400 truncate mt-0.5">{notif.body}</p>
                        {notif.status && (
                          <p className={`text-[11px] mt-1 capitalize font-medium flex items-center gap-1 ${statusColor}`}>
                            <span>→</span> {notif.status}
                          </p>
                        )}
                      </div>

                      {/* Dismiss on hover */}
                      <button
                        onClick={e => dismiss(e, notif.id)}
                        className="opacity-0 group-hover:opacity-100 absolute top-3 right-3 p-1 rounded-lg text-zinc-600 hover:text-white hover:bg-white/10 transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-white/5 flex items-center justify-between">
              <p className="text-[10px] text-zinc-700">
                {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
              </p>
              <button onClick={markAllRead} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
                Mark all read
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
