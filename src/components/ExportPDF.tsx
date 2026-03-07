import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { ReleaseSubmission } from '../types';

interface Props {
  releases: ReleaseSubmission[];
  companyName?: string;
  companyLogo?: string;
}

function statusColor(status: string): string {
  return ({ pending: '#f59e0b', approved: '#10b981', scheduled: '#3b82f6', released: '#8b5cf6', rejected: '#ef4444' })[status] || '#71717a';
}

function formatDate(s: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return s; }
}

function buildArtistLine(r: ReleaseSubmission) {
  return [r.mainArtist, ...r.collaborations.map(c => c.name).filter(Boolean)].join(', ');
}

function buildTitle(r: ReleaseSubmission) {
  const feats = r.features.map(f => f.name).filter(Boolean);
  const featSuffix = feats.length ? ` (feat. ${feats.join(', ')})` : '';
  if (r.releaseType === 'single' && r.tracks.length === 1 && r.tracks[0]?.title)
    return `${r.tracks[0].title}${featSuffix}`;
  return `${r.releaseTitle}${featSuffix}`;
}

export default function ExportPDFButton({ releases, companyName = 'In Lights', companyLogo }: Props) {
  const [loading, setLoading] = useState(false);

  const handleExport = () => {
    setLoading(true);
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { setLoading(false); return; }

    const generatedAt = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${companyName} — Releases Export</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #18181b; font-size: 13px; }
    .page { max-width: 860px; margin: 0 auto; padding: 40px 40px 60px; }
    .header { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #18181b; padding-bottom: 18px; margin-bottom: 28px; }
    .header img { width: 44px; height: 44px; object-fit: contain; border-radius: 8px; }
    .header-text h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .header-text p { font-size: 11px; color: #71717a; margin-top: 2px; }
    .stats { display: flex; gap: 10px; margin-bottom: 28px; flex-wrap: wrap; }
    .stat { background: #f4f4f5; border-radius: 8px; padding: 10px 16px; }
    .stat-val { font-size: 20px; font-weight: 800; }
    .stat-lbl { font-size: 10px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
    .release { border: 1px solid #e4e4e7; border-radius: 10px; padding: 16px 18px; margin-bottom: 14px; page-break-inside: avoid; }
    .rel-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
    .rel-title { font-size: 15px; font-weight: 700; }
    .rel-artist { font-size: 12px; color: #52525b; margin-top: 2px; }
    .rel-id { font-family: monospace; font-size: 10px; color: #a1a1aa; margin-top: 3px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #fff; margin-right: 6px; }
    .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: #fafafa; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; }
    .meta-item label { font-size: 9px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px; }
    .meta-item span { font-size: 12px; font-weight: 600; }
    .tracks-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #71717a; margin-bottom: 6px; }
    .track { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid #f4f4f5; }
    .track:last-child { border-bottom: none; }
    .track-num { font-size: 10px; color: #a1a1aa; width: 18px; text-align: right; flex-shrink: 0; }
    .track-name { flex: 1; font-size: 12px; }
    .track-isrc { font-family: monospace; font-size: 10px; color: #71717a; }
    .e-badge { font-size: 9px; background: #fee2e2; color: #b91c1c; padding: 1px 5px; border-radius: 3px; font-weight: 700; flex-shrink: 0; }
    .upc { font-family: monospace; font-size: 10px; color: #71717a; margin-top: 6px; }
    .notes { margin-top: 8px; background: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 0 6px 6px 0; padding: 8px 10px; font-size: 11px; color: #78350f; }
    .footer { margin-top: 40px; border-top: 1px solid #e4e4e7; padding-top: 16px; text-align: center; font-size: 10px; color: #a1a1aa; }
    @media print {
      body { font-size: 11px; }
      .page { padding: 20px; }
      .release { break-inside: avoid; }
    }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    ${companyLogo ? `<img src="${companyLogo}" alt="${companyName}" onerror="this.style.display='none'"/>` : ''}
    <div class="header-text">
      <h1>${companyName}</h1>
      <p>Releases Export — Generated ${generatedAt} · ${releases.length} release${releases.length !== 1 ? 's' : ''}</p>
    </div>
  </div>

  <div class="stats">
    ${(['pending','approved','scheduled','released','rejected'] as const).map(s => {
      const count = releases.filter(r => r.status === s).length;
      return count > 0 ? `<div class="stat"><div class="stat-val" style="color:${statusColor(s)}">${count}</div><div class="stat-lbl">${s}</div></div>` : '';
    }).join('')}
  </div>

  ${releases.map(r => `
  <div class="release">
    <div class="rel-header">
      <div>
        <div class="rel-title">${buildTitle(r)}</div>
        <div class="rel-artist">${buildArtistLine(r)}</div>
        <div class="rel-id">${r.id}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <span class="badge" style="background:${statusColor(r.status)}">${r.status}</span>
        <span class="badge" style="background:#6366f1">${r.releaseType}</span>
        ${r.explicitContent ? '<span class="badge" style="background:#b91c1c">E</span>' : ''}
      </div>
    </div>
    <div class="meta">
      <div class="meta-item"><label>Genre</label><span>${r.genre || '—'}</span></div>
      <div class="meta-item"><label>Release Date</label><span>${r.releaseDate || '—'}</span></div>
      <div class="meta-item"><label>Submitted</label><span>${formatDate(r.createdAt)}</span></div>
      <div class="meta-item"><label>Tracks</label><span>${r.tracks.length}</span></div>
    </div>
    ${r.tracks.length > 0 ? `
    <div class="tracks-title">Tracklist</div>
    ${r.tracks.map((t, i) => `
    <div class="track">
      <span class="track-num">${i + 1}</span>
      <span class="track-name">${t.title || 'Untitled'}${r.features.length ? ` <span style="color:#71717a">(feat. ${r.features.map(f=>f.name).filter(Boolean).join(', ')})</span>` : ''}</span>
      ${t.isrc ? `<span class="track-isrc">${t.isrc}</span>` : ''}
      ${t.explicit ? '<span class="e-badge">E</span>' : ''}
    </div>`).join('')}` : ''}
    ${r.upc ? `<div class="upc">UPC: ${r.upc}</div>` : ''}
    ${r.labelNotes ? `<div class="notes">📝 ${r.labelNotes}</div>` : ''}
  </div>`).join('')}

  <div class="footer">${companyName} · Confidential · ${generatedAt}</div>
</div>
<script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

    win.document.write(html);
    win.document.close();
    setLoading(false);
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading || releases.length === 0}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 text-sm transition-all disabled:opacity-40"
      title="Export all releases as PDF"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
      <span className="hidden sm:inline">PDF</span>
    </button>
  );
}
