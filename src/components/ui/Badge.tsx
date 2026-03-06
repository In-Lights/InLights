
import { ReleaseStatus } from '../../types';

const statusStyles: Record<ReleaseStatus, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  released: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const statusLabels: Record<ReleaseStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  scheduled: 'Scheduled',
  released: 'Released',
  rejected: 'Rejected',
};

export function StatusBadge({ status }: { status: ReleaseStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

export function ReleaseTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    single: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    ep: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    album: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border uppercase ${styles[type] || ''}`}>
      {type}
    </span>
  );
}
