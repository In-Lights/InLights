/**
 * DrivePickerButton — v2
 * Fixes: no premature "File selected", auto-creates organized folder structure,
 * token only requested on click, CANCEL correctly handled.
 *
 * Folder structure created:
 *   /rootFolderId
 *     └── Artist — Release Title (YYYY)
 *           ├── Cover Art
 *           ├── Track 01 — Song Name
 *           └── Promo Materials
 */

import { useState, useEffect, useCallback } from 'react';
import { Link2, CheckCircle2, Loader2, FolderOpen, X, RefreshCw } from 'lucide-react';

declare global {
  interface Window {
    gapi: { load: (api: string, cb: () => void) => void };
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (r: { access_token?: string; error?: string; expires_in?: number }) => void;
            error_callback?: (e: unknown) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      picker: Record<string, any>;
    };
  }
}

interface PickerData {
  action: string;
  docs?: Array<{ id: string; name: string; mimeType: string; sizeBytes?: number }>;
}

// ── script loader ─────────────────────────────────────────────
const _loaded = new Set<string>();
function loadScript(src: string): Promise<void> {
  if (_loaded.has(src)) return Promise.resolve();
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { _loaded.add(src); res(); return; }
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => { _loaded.add(src); res(); };
    s.onerror = () => rej(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

// ── drive REST helpers ────────────────────────────────────────
async function driveApiFetch(path: string, token: string, opts: RequestInit = {}) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Drive API error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function findFolder(name: string, parentId: string, token: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${name.replace(/'/g,"\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`);
  const data = await driveApiFetch(`files?q=${q}&fields=files(id)`, token);
  return data.files?.[0]?.id ?? null;
}

async function createFolder(name: string, parentId: string, token: string): Promise<string> {
  const data = await driveApiFetch('files', token, {
    method: 'POST',
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  // make it readable by anyone (so links work)
  fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  }).catch(() => {});
  return data.id as string;
}

async function findOrCreate(name: string, parentId: string, token: string): Promise<string> {
  return (await findFolder(name, parentId, token)) ?? (await createFolder(name, parentId, token));
}

function fmt(b: number) {
  return b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;
}

// ── token cache (module-level) ────────────────────────────────
let _tok: string | null = null;
let _tokExp = 0;

// ── folder cache (per session) ────────────────────────────────
const _folderCache = new Map<string, string>();

// ── props ─────────────────────────────────────────────────────
export interface DrivePickerProps {
  value: string;
  onChange: (link: string, name?: string) => void;
  label?: string;
  hint?: string;
  required?: boolean;
  clientId: string;
  apiKey: string;
  rootFolderId: string;
  /** Key to identify this release for folder caching (e.g. "artist__title") */
  releaseKey: string;
  /** Human label for the release folder e.g. "Artist — Title (2026)" */
  releaseFolderName: string;
  /** Subfolder inside release folder e.g. "Cover Art" or "Track 01 — Song Name" */
  subFolder: string;
  pickerTitle?: string;
  size?: 'sm' | 'md';
}

export default function DrivePickerButton({
  value, onChange, label, hint, required = false,
  clientId, apiKey, rootFolderId,
  releaseKey, releaseFolderName, subFolder,
  pickerTitle = 'Select or Upload',
  size = 'md',
}: DrivePickerProps) {

  type Phase = 'idle'|'loading'|'auth'|'folder'|'open'|'done'|'error';
  const [phase, setPhase] = useState<Phase>('idle');
  const [err, setErr] = useState('');
  const [pickedName, setPickedName] = useState('');
  const [pickedSize, setPickedSize] = useState('');
  const [apisReady, setApisReady] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const configured = !!(clientId && apiKey && rootFolderId);
  const pad = size === 'sm' ? 'px-3 py-2.5 text-sm' : 'px-4 py-3';
  const btnPad = size === 'sm' ? '0.5rem 0.85rem' : '0.7rem 1.1rem';

  // load APIs on mount (but do NOT request token)
  useEffect(() => {
    if (!configured || apisReady) return;
    setPhase('loading');
    Promise.all([
      loadScript('https://apis.google.com/js/api.js'),
      loadScript('https://accounts.google.com/gsi/client'),
    ])
      .then(() => new Promise<void>(res => window.gapi.load('picker', res)))
      .then(() => { setApisReady(true); setPhase('idle'); })
      .catch(() => { setPhase('error'); setErr('Could not load Google APIs.'); });
  }, [configured, apisReady]);

  const getToken = useCallback((): Promise<string> => {
    if (_tok && Date.now() < _tokExp - 60_000) return Promise.resolve(_tok);
    return new Promise((resolve, reject) => {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: r => {
            if (r.error || !r.access_token) { reject(new Error(r.error ?? 'Auth failed')); return; }
            _tok = r.access_token;
            _tokExp = Date.now() + (r.expires_in ?? 3600) * 1000;
            resolve(_tok);
          },
          error_callback: e => reject(new Error(String(e))),
        });
        client.requestAccessToken({ prompt: _tok ? '' : undefined });
      } catch (e) { reject(e); }
    });
  }, [clientId]);

  const getTargetFolder = useCallback(async (token: string): Promise<string> => {
    const subKey = `${releaseKey}||${subFolder}`;
    if (_folderCache.has(subKey)) return _folderCache.get(subKey)!;

    const releaseRootKey = `${releaseKey}||__root__`;
    let relId = _folderCache.get(releaseRootKey);
    if (!relId) {
      relId = await findOrCreate(releaseFolderName, rootFolderId, token);
      _folderCache.set(releaseRootKey, relId);
    }
    const subId = await findOrCreate(subFolder, relId, token);
    _folderCache.set(subKey, subId);
    return subId;
  }, [releaseKey, releaseFolderName, subFolder, rootFolderId]);

  const openPicker = useCallback(async () => {
    if (!configured || !apisReady) return;
    setErr(''); setPhase('auth');
    try {
      const token = await getToken();
      setPhase('folder');
      const folderId = await getTargetFolder(token);
      setPhase('open');

      // Upload view — user can upload from device
      const UpView = new window.google.picker.DocsUploadView();
      UpView.setParent(folderId);

      // Browse view — see existing files in that subfolder
      const BrowseView = new window.google.picker.DocsView();
      BrowseView.setParent(folderId);
      BrowseView.setIncludeFolders(false);
      BrowseView.setSelectFolderEnabled(false);

      const picker = new window.google.picker.PickerBuilder()
        .setTitle(pickerTitle)
        .setOAuthToken(token)
        .setDeveloperKey(apiKey)
        .addView(UpView)
        .addView(BrowseView)
        .setCallback((data: PickerData) => {
          if (data.action === 'picked' && data.docs?.length) {
            const f = data.docs[0];
            const link = `https://drive.google.com/file/d/${f.id}/view?usp=sharing`;
            setPickedName(f.name);
            setPickedSize(f.sizeBytes ? fmt(f.sizeBytes) : '');
            onChange(link, f.name);
            setShowManual(false);
            setPhase('done');
          } else if (data.action === 'cancel') {
            setPhase('idle');
          }
          // ignore 'loaded' and other actions
        })
        .build();
      picker.setVisible(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPhase('error');
      if (msg.includes('popup') || msg.includes('blocked'))
        setErr('Popup was blocked — allow popups for this site and try again.');
      else if (msg.includes('auth') || msg.includes('access') || msg.includes('400'))
        setErr('Google sign-in failed. Make sure your Client ID is correct and this domain is authorized.');
      else
        setErr(`Upload failed: ${msg}`);
    }
  }, [configured, apisReady, getToken, getTargetFolder, pickerTitle, apiKey, onChange]);

  // Not configured: plain input
  if (!configured) {
    return (
      <div>
        {label && <label className="block text-sm font-semibold mb-1.5">{label} {required && <span className="text-red-400">*</span>}</label>}
        {hint && <p className="text-xs text-zinc-500 mb-2">{hint}</p>}
        <input type="url" value={value} onChange={e => onChange(e.target.value)}
          placeholder="https://drive.google.com/file/d/..." className={`input-dark w-full ${pad} rounded-xl`} />
      </div>
    );
  }

  const busy = phase === 'auth' || phase === 'folder' || phase === 'open' || phase === 'loading';
  const hasLink = Boolean(value);
  // isPicked = we picked it this session (pickedName was set by callback)
  const isPicked = hasLink && Boolean(pickedName);

  return (
    <div>
      {label && <label className="block text-sm font-semibold mb-1.5">{label} {required && <span className="text-red-400">*</span>}</label>}
      {hint && <p className="text-xs text-zinc-500 mb-2">{hint}</p>}

      {/* Picked this session */}
      {isPicked && !showManual && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center gap-3 mb-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-300 truncate">{pickedName}</p>
            <p className="text-xs text-emerald-700 mt-0.5">{pickedSize ? `${pickedSize} · ` : ''}saved to Drive</p>
          </div>
          <button onClick={openPicker} disabled={busy}
            className="text-xs text-emerald-500 hover:text-emerald-300 flex items-center gap-1 flex-shrink-0">
            <RefreshCw className="w-3 h-3" /> Replace
          </button>
        </div>
      )}

      {/* Has link from a previous save, but NOT picked this session */}
      {hasLink && !isPicked && !showManual && (
        <div className="bg-zinc-900/60 border border-white/5 rounded-xl px-4 py-3 flex items-center gap-3 mb-2">
          <CheckCircle2 className="w-4 h-4 text-zinc-500 flex-shrink-0" />
          <p className="text-sm text-zinc-400 flex-1 truncate">Drive link attached</p>
          <button onClick={() => setShowManual(true)} className="text-xs text-zinc-600 hover:text-zinc-300">Change</button>
        </div>
      )}

      {/* Upload/paste row — shown when no link yet, or manual override */}
      {(!hasLink || showManual) && (
        <div className="flex gap-2">
          <button type="button" onClick={openPicker} disabled={busy || !apisReady}
            className="btn-primary flex items-center gap-2 rounded-xl flex-shrink-0 whitespace-nowrap"
            style={{ padding: btnPad }}>
            {phase === 'loading' && <><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Loading…</span></>}
            {phase === 'auth'   && <><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Signing in…</span></>}
            {phase === 'folder' && <><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Creating folder…</span></>}
            {phase === 'open'   && <><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Opening…</span></>}
            {!busy && <><FolderOpen className="w-4 h-4" /><span className="text-sm font-semibold">Upload / Browse</span></>}
          </button>
          <input type="url" value={value} onChange={e => { onChange(e.target.value); setPickedName(''); }}
            placeholder="…or paste Drive link"
            className={`input-dark flex-1 ${pad} rounded-xl`} />
        </div>
      )}

      {/* Toggle manual */}
      {hasLink && !showManual && (
        <button onClick={() => setShowManual(true)}
          className="mt-1.5 flex items-center gap-1 text-xs text-zinc-700 hover:text-zinc-500">
          <Link2 className="w-3 h-3" /> Paste link instead
        </button>
      )}
      {showManual && (
        <button onClick={() => setShowManual(false)}
          className="mt-1.5 flex items-center gap-1 text-xs text-zinc-700 hover:text-zinc-500">
          <X className="w-3 h-3" /> Cancel
        </button>
      )}

      {/* Error */}
      {phase === 'error' && err && (
        <div className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2.5 rounded-lg flex items-start gap-2">
          <span className="flex-1">{err}</span>
          <button onClick={() => { setPhase('idle'); setErr(''); }} className="text-red-700 hover:text-red-400">✕</button>
        </div>
      )}
    </div>
  );
}
