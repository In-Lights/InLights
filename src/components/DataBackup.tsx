import { useState } from 'react';
import { Download, Upload, AlertTriangle, CheckCircle, Loader2, Database, Shield } from 'lucide-react';
import { supabase } from '../store';

function formatDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function DataBackup() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; skipped: number } | null>(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // ── Export ──────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true); setError('');
    try {
      const { data: releases, error: rErr } = await supabase.from('releases').select('*').order('created_at');
      if (rErr) throw new Error(rErr.message);

      const backup = {
        exportedAt: new Date().toISOString(),
        version: 1,
        tables: { releases: releases || [] },
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inlights-backup-${formatDate()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  // ── Import ──────────────────────────────────────────────
  const processFile = async (file: File) => {
    if (!file.name.endsWith('.json')) { setError('Please select a .json backup file'); return; }
    setImporting(true); setError(''); setImportResult(null);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.tables?.releases) throw new Error('Invalid backup file — missing releases data');

      const releases = backup.tables.releases as Record<string, unknown>[];
      if (!Array.isArray(releases)) throw new Error('Invalid backup file format');

      // Get existing IDs to skip duplicates
      const { data: existing } = await supabase.from('releases').select('id');
      const existingIds = new Set((existing || []).map((r: { id: string }) => r.id));

      const toInsert = releases.filter(r => !existingIds.has(r.id as string));
      const skipped = releases.length - toInsert.length;

      if (toInsert.length > 0) {
        // Insert in batches of 50
        for (let i = 0; i < toInsert.length; i += 50) {
          const batch = toInsert.slice(i, i + 50);
          const { error: insErr } = await supabase.from('releases').insert(batch);
          if (insErr) throw new Error(`Batch insert failed: ${insErr.message}`);
        }
      }

      setImportResult({ added: toInsert.length, skipped });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="font-bold flex items-center gap-2">
          <Database className="w-4 h-4 accent-text" /> Data Backup & Restore
        </h3>
        <p className="text-xs text-zinc-500 mt-0.5">Export your releases to a JSON file you can keep safe, and restore from it any time</p>
      </div>

      {/* Safety notice */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
        <Shield className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-amber-300">Before running new SQL migrations</p>
          <p className="text-xs text-zinc-400 mt-0.5">Always export a backup first. Then run <code className="bg-black/30 px-1 rounded">02_migrations.sql</code> — never <code className="bg-black/30 px-1 rounded">01_setup.sql</code> on an existing database.</p>
        </div>
      </div>

      {/* Export */}
      <div className="glass-card rounded-2xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-sm flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-400" /> Export Releases
            </p>
            <p className="text-xs text-zinc-500 mt-1">Downloads all your releases as a <code className="bg-white/5 px-1 rounded">.json</code> file. Includes all fields, tracks, metadata, checklists.</p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all disabled:opacity-50 flex-shrink-0"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>

      {/* Import */}
      <div className="glass-card rounded-2xl p-5 space-y-3">
        <div>
          <p className="font-semibold text-sm flex items-center gap-2">
            <Upload className="w-4 h-4 text-blue-400" /> Restore from Backup
          </p>
          <p className="text-xs text-zinc-500 mt-1">Imports releases from a backup file. Existing releases (matched by ID) are <strong className="text-zinc-300">never overwritten</strong> — only missing ones are added.</p>
        </div>

        {/* Drop zone */}
        <label
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-2 w-full py-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
            dragOver
              ? 'border-blue-400 bg-blue-500/10'
              : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
          }`}
        >
          <input type="file" accept=".json" onChange={handleFileInput} className="hidden" disabled={importing} />
          {importing ? (
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          ) : (
            <Upload className="w-6 h-6 text-zinc-600" />
          )}
          <p className="text-sm text-zinc-400">{importing ? 'Importing…' : 'Drop backup file here or click to browse'}</p>
          <p className="text-xs text-zinc-600">inlights-backup-YYYY-MM-DD.json</p>
        </label>

        {/* Result */}
        {importResult && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-300">Restore complete</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                {importResult.added} release{importResult.added !== 1 ? 's' : ''} restored
                {importResult.skipped > 0 && ` · ${importResult.skipped} already existed (skipped)`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* SQL file reference */}
      <div className="rounded-xl border border-white/8 overflow-hidden">
        <div className="px-4 py-3 bg-white/[0.02] border-b border-white/8">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">SQL Files — in the <code>sql/</code> folder</p>
        </div>
        <div className="divide-y divide-white/5">
          {[
            { file: 'sql/01_setup.sql', badge: 'First time only', badgeColor: 'bg-red-500/15 text-red-400', desc: 'Creates all tables from scratch. Only run on a brand new project.' },
            { file: 'sql/02_migrations.sql', badge: 'Safe always', badgeColor: 'bg-emerald-500/15 text-emerald-400', desc: 'Adds missing columns & tables. 100% safe to run on existing data, any time.' },
          ].map(({ file, badge, badgeColor, desc }) => (
            <div key={file} className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs text-violet-300">{file}</code>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badgeColor}`}>{badge}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
