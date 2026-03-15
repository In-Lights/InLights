/**
 * DeliveryTracker — admin-only release pipeline tracker
 *
 * Stages: Submitted → Approved → Assets Collected → Sent to Distributor → Distributed → Live
 *
 * Each stage:
 *  - Shows date when completed
 *  - Admin can mark done / undo with one click
 *  - Admin can add a short note per stage
 *  - Auto-completes "Submitted" from createdAt and "Approved" when status = approved/scheduled/released
 *
 * Saves via updateSubmission (delivery_pipeline JSONB column)
 * SQL: ALTER TABLE releases ADD COLUMN IF NOT EXISTS delivery_pipeline JSONB;
 */

import { useState, useCallback } from 'react';
import { Check, ChevronDown, ChevronUp, Circle, Loader2, Pencil, X } from 'lucide-react';
import { DeliveryStage, DeliveryStageId, ReleaseSubmission } from '../types';
import { updateSubmission } from '../store';

// ── Stage definitions ─────────────────────────────────────────
interface StageDef {
  id: DeliveryStageId;
  label: string;
  desc: string;
  icon: string;
  autoFrom?: (release: ReleaseSubmission) => string | undefined; // auto-fill completedAt
}

const STAGES: StageDef[] = [
  {
    id: 'submitted',
    label: 'Submitted',
    desc: 'Artist submitted the release',
    icon: '📥',
    autoFrom: (r) => r.createdAt,
  },
  {
    id: 'approved',
    label: 'Approved',
    desc: 'Label reviewed and approved',
    icon: '✅',
    autoFrom: (r) =>
      ['approved', 'scheduled', 'released'].includes(r.status) ? r.updatedAt : undefined,
  },
  {
    id: 'assets_collected',
    label: 'Assets collected',
    desc: 'WAV, art, metadata all confirmed',
    icon: '🗂',
  },
  {
    id: 'sent_to_distributor',
    label: 'Sent to distributor',
    desc: 'Delivered to EMPIRE',
    icon: '📤',
  },
  {
    id: 'distributed',
    label: 'Distributed',
    desc: 'Confirmed by EMPIRE / in processing',
    icon: '🔄',
  },
  {
    id: 'live',
    label: 'Live on platforms',
    desc: 'Available on Spotify, Apple Music, etc.',
    icon: '🎵',
  },
];

function fmtDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso.slice(0, 10); }
}

function buildInitialPipeline(
  release: ReleaseSubmission
): DeliveryStage[] {
  return STAGES.map(s => {
    const existing = release.deliveryPipeline?.find(p => p.id === s.id);
    // Auto-fill from release data if not already set
    const autoDate = s.autoFrom?.(release);
    return {
      id: s.id,
      completedAt: existing?.completedAt ?? autoDate,
      note: existing?.note,
    };
  });
}

interface Props {
  release: ReleaseSubmission;
  canEdit: boolean;
}

export default function DeliveryTracker({ release, canEdit }: Props) {
  const [open, setOpen] = useState(true);
  const [pipeline, setPipeline] = useState<DeliveryStage[]>(() =>
    buildInitialPipeline(release)
  );
  const [saving, setSaving] = useState<DeliveryStageId | null>(null);
  const [editingNote, setEditingNote] = useState<DeliveryStageId | null>(null);
  const [noteInput, setNoteInput] = useState('');

  const save = useCallback(async (updated: DeliveryStage[]) => {
    try {
      await updateSubmission(release.id, { deliveryPipeline: updated });
    } catch { /* silent — UI already updated */ }
  }, [release.id]);

  const toggleStage = async (id: DeliveryStageId) => {
    if (!canEdit) return;
    setSaving(id);
    const stage = pipeline.find(s => s.id === id)!;
    const isAuto = STAGES.find(s => s.id === id)?.autoFrom?.(release);

    // Don't allow un-completing auto stages (submitted/approved)
    if (stage.completedAt && isAuto) { setSaving(null); return; }

    const updated = pipeline.map(s =>
      s.id === id
        ? { ...s, completedAt: s.completedAt ? undefined : new Date().toISOString() }
        : s
    );
    setPipeline(updated);
    await save(updated);
    setSaving(null);
  };

  const saveNote = async (id: DeliveryStageId) => {
    const updated = pipeline.map(s =>
      s.id === id ? { ...s, note: noteInput.trim() || undefined } : s
    );
    setPipeline(updated);
    setEditingNote(null);
    await save(updated);
  };

  const completedCount = pipeline.filter(s => s.completedAt).length;
  const pct = Math.round((completedCount / STAGES.length) * 100);
  const currentStageIdx = pipeline.reduce((acc, s, i) => s.completedAt ? i : acc, -1);
  const isLive = pipeline.find(s => s.id === 'live')?.completedAt;

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">Delivery Pipeline</span>
            {isLive && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                LIVE
              </span>
            )}
          </div>
          <span className="text-xs text-zinc-500">{completedCount}/{STAGES.length}</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Mini progress bar */}
          <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: isLive ? '#10b981' : 'var(--accent)',
              }}
            />
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-white/5">
          {/* Timeline */}
          <div className="mt-4 relative">
            {/* Vertical connector line */}
            <div className="absolute left-[18px] top-6 bottom-6 w-px bg-zinc-800" />

            <div className="space-y-1">
              {STAGES.map((stageDef, idx) => {
                const stage = pipeline.find(s => s.id === stageDef.id)!;
                const done = !!stage.completedAt;
                const isActive = idx === currentStageIdx + 1 && !done;
                const isAuto = !!stageDef.autoFrom?.(release);
                const isSaving = saving === stageDef.id;

                return (
                  <div key={stageDef.id} className="relative flex items-start gap-3 py-2">
                    {/* Stage dot */}
                    <div className="flex-shrink-0 z-10 mt-0.5">
                      {isSaving ? (
                        <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                          <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin" />
                        </div>
                      ) : done ? (
                        <button
                          onClick={() => toggleStage(stageDef.id)}
                          disabled={!canEdit || isAuto}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                            isAuto
                              ? 'bg-emerald-500/20 border border-emerald-500/30 cursor-default'
                              : 'bg-emerald-500/20 border border-emerald-500/30 hover:bg-red-500/15 hover:border-red-500/30 group'
                          }`}
                        >
                          <Check className="w-4 h-4 text-emerald-400 group-hover:hidden" />
                          <X className="w-4 h-4 text-red-400 hidden group-hover:block" />
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleStage(stageDef.id)}
                          disabled={!canEdit}
                          className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all ${
                            isActive
                              ? 'border-dashed hover:bg-white/5 hover:border-violet-500/50'
                              : 'hover:bg-white/5 hover:border-white/20'
                          } ${
                            canEdit ? 'cursor-pointer' : 'cursor-default opacity-50'
                          } ${
                            isActive ? 'border-violet-500/30 bg-violet-500/5' : 'border-zinc-800 bg-zinc-900/50'
                          }`}
                        >
                          <Circle className={`w-3 h-3 ${isActive ? 'text-violet-500/50' : 'text-zinc-700'}`} />
                        </button>
                      )}
                    </div>

                    {/* Stage content */}
                    <div className="flex-1 min-w-0 pt-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-sm font-semibold truncate ${done ? 'text-zinc-200' : isActive ? 'text-zinc-300' : 'text-zinc-600'}`}>
                            {stageDef.label}
                          </span>
                          {isActive && !done && (
                            <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-full border border-violet-500/20 flex-shrink-0">
                              NEXT
                            </span>
                          )}
                        </div>
                        {/* Note edit button */}
                        {done && canEdit && editingNote !== stageDef.id && (
                          <button
                            onClick={() => { setEditingNote(stageDef.id); setNoteInput(stage.note ?? ''); }}
                            className="text-zinc-700 hover:text-zinc-400 transition-colors flex-shrink-0 p-1"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Date */}
                      {done && stage.completedAt && (
                        <p className="text-[11px] text-zinc-500 mt-0.5">{fmtDate(stage.completedAt)}</p>
                      )}

                      {/* Description for upcoming */}
                      {!done && (
                        <p className="text-[11px] text-zinc-700 mt-0.5">{stageDef.desc}</p>
                      )}

                      {/* Note display */}
                      {stage.note && editingNote !== stageDef.id && (
                        <p className="text-[11px] text-zinc-400 mt-1 bg-white/[0.03] px-2 py-1 rounded-lg border border-white/5 italic">
                          {stage.note}
                        </p>
                      )}

                      {/* Note editor */}
                      {editingNote === stageDef.id && (
                        <div className="mt-2 space-y-1.5">
                          <input
                            type="text"
                            value={noteInput}
                            onChange={e => setNoteInput(e.target.value)}
                            placeholder="Add a note (e.g. tracking link, distributor ref)"
                            className="input-dark w-full px-3 py-1.5 rounded-lg text-xs"
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') saveNote(stageDef.id); if (e.key === 'Escape') setEditingNote(null); }}
                          />
                          <div className="flex gap-2">
                            <button onClick={() => saveNote(stageDef.id)}
                              className="text-[11px] text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded hover:bg-emerald-500/10 transition-colors">
                              Save
                            </button>
                            <button onClick={() => setEditingNote(null)}
                              className="text-[11px] text-zinc-600 hover:text-zinc-400 px-2 py-1 rounded hover:bg-white/5 transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SQL reminder */}
          {!release.deliveryPipeline && (
            <div className="mt-3 px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20 text-[11px] text-amber-400/80">
              Run in Supabase SQL Editor:{' '}
              <code className="font-mono text-amber-300 select-all">
                ALTER TABLE releases ADD COLUMN IF NOT EXISTS delivery_pipeline JSONB;
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
