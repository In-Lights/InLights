/**
 * DrivePickerButton
 * ─────────────────
 * Renders a button that opens the Google Picker API so artists can
 * pick an existing Drive file OR upload from their device, without
 * ever leaving the submission form.
 *
 * Requires:
 *  - Google API Client ID  (OAuth 2.0)
 *  - Google API Key        (restricted to Drive + Picker APIs)
 *  - A target folder ID    (where uploads land — owned by the label)
 *
 * The picker returns a shareable Drive link that is stored in state
 * alongside the manual text input (both are always visible).
 */

import { useState, useEffect, useCallback } from 'react';
import { Upload, Link2, CheckCircle2, Loader2, FolderOpen, X } from 'lucide-react';

// ── Google API type declarations ────────────────────────────
declare global {
  interface Window {
    gapi: {
      load: (apis: string, cb: () => void) => void;
      auth2?: unknown;
      client?: unknown;
    };
    google: {
      picker: {
        PickerBuilder: new () => GooglePickerBuilder;
        ViewId: { DOCS: string; FOLDERS: string };
        Feature: { NAV_HIDDEN: string; MULTISELECT_ENABLED: string };
        Action: { PICKED: string; CANCEL: string };
      };
    };
  }
}

interface GooglePickerBuilder {
  addView(view: unknown): GooglePickerBuilder;
  setOAuthToken(token: string): GooglePickerBuilder;
  setDeveloperKey(key: string): GooglePickerBuilder;
  setCallback(cb: (data: GooglePickerData) => void): GooglePickerBuilder;
  setTitle(title: string): GooglePickerBuilder;
  enableFeature(feature: string): GooglePickerBuilder;
  setUploadToAlbumId(folderId: string): GooglePickerBuilder;
  build(): { setVisible(v: boolean): void };
}

interface GooglePickerData {
  action: string;
  docs?: Array<{
    id: string;
    name: string;
    url: string;
    mimeType: string;
    sizeBytes?: number;
  }>;
}

// ── helpers ─────────────────────────────────────────────────
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function driveFileIdToLink(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── OAuth token cache ────────────────────────────────────────
let _cachedToken: string | null = null;
let _tokenExpiry = 0;

async function getOAuthToken(clientId: string): Promise<string> {
  // Return cached token if still valid (5 min buffer)
  if (_cachedToken && Date.now() < _tokenExpiry - 300_000) return _cachedToken;

  return new Promise((resolve, reject) => {
    // Use Google's tokenClient (GIS — Google Identity Services)
    const tokenClient = (window as unknown as {
      google: { accounts: { oauth2: { initTokenClient: (cfg: unknown) => { requestAccessToken: () => void } } } }
    }).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (resp: { access_token?: string; error?: string; expires_in?: number }) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || 'OAuth failed'));
          return;
        }
        _cachedToken = resp.access_token;
        _tokenExpiry = Date.now() + (resp.expires_in ?? 3600) * 1000;
        resolve(resp.access_token);
      },
    });
    tokenClient.requestAccessToken();
  });
}

// ── props ────────────────────────────────────────────────────
interface Props {
  /** Current Drive link value */
  value: string;
  /** Called when user picks/uploads a file */
  onChange: (driveLink: string, fileName?: string) => void;
  /** Field label */
  label: string;
  /** Hint shown below the input */
  hint?: string;
  /** Accept filter description shown in picker (cosmetic only) */
  accept?: string;
  /** Whether this field is required */
  required?: boolean;
  /** Google OAuth Client ID */
  clientId: string;
  /** Restricted Google API Key */
  apiKey: string;
  /** Drive folder ID where uploads land */
  uploadFolderId: string;
  /** Picker dialog title */
  pickerTitle?: string;
  /** Field size variant */
  size?: 'sm' | 'md';
  /** If true, show upload button even when a file is already picked */
  allowReplace?: boolean;
}

export default function DrivePickerButton({
  value, onChange, label, hint, required = false,
  clientId, apiKey, uploadFolderId,
  pickerTitle = 'Select or Upload File',
  size = 'md', allowReplace = true,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pickedName, setPickedName] = useState('');
  const [pickedSize, setPickedSize] = useState('');
  const [apisReady, setApisReady] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const isConfigured = clientId && apiKey && uploadFolderId;

  // ── load Google APIs once ──
  useEffect(() => {
    if (!isConfigured) return;
    Promise.all([
      loadScript('https://apis.google.com/js/api.js'),
      loadScript('https://accounts.google.com/gsi/client'),
    ]).then(() => {
      window.gapi.load('picker', () => setApisReady(true));
    }).catch(() => setError('Failed to load Google APIs'));
  }, [isConfigured]);

  // ── parse existing link to show file name hint ──
  useEffect(() => {
    if (value && !pickedName) {
      const match = value.match(/\/d\/([^/]+)/);
      if (match) setPickedName('Previously uploaded file');
    }
  }, [value, pickedName]);

  const openPicker = useCallback(async () => {
    if (!isConfigured || !apisReady) return;
    setLoading(true);
    setError('');
    try {
      const token = await getOAuthToken(clientId);

      // Build a DocsView that shows all files in the upload folder
      const DocsView = new (window.google.picker as unknown as {
        DocsView: new () => { setParent: (id: string) => unknown; setIncludeFolders: (b: boolean) => unknown };
      }).DocsView();
      DocsView.setParent(uploadFolderId);
      DocsView.setIncludeFolders(false);

      // Build an UploadView targeting the same folder
      const UploadView = new (window.google.picker as unknown as {
        DocsUploadView: new () => { setParent: (id: string) => unknown };
      }).DocsUploadView();
      UploadView.setParent(uploadFolderId);

      const picker = new window.google.picker.PickerBuilder()
        .setTitle(pickerTitle)
        .setOAuthToken(token)
        .setDeveloperKey(apiKey)
        .addView(UploadView)
        .addView(DocsView)
        .setCallback((data: GooglePickerData) => {
          if (data.action === window.google.picker.Action.PICKED && data.docs?.length) {
            const file = data.docs[0];
            const link = driveFileIdToLink(file.id);
            setPickedName(file.name);
            setPickedSize(file.sizeBytes ? formatBytes(file.sizeBytes) : '');
            onChange(link, file.name);
            setShowManual(false);
          }
        })
        .build();
      picker.setVisible(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg.includes('popup') ? 'Popup was blocked. Allow popups for this site and try again.' : `Picker failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [isConfigured, apisReady, clientId, apiKey, uploadFolderId, pickerTitle, onChange]);

  const inputPad = size === 'sm' ? 'px-3 py-2.5 text-sm' : 'px-4 py-3';
  const isPicked = Boolean(value);

  // ── not configured — just show manual input ──
  if (!isConfigured) {
    return (
      <div>
        <label className="block text-sm font-semibold mb-1.5">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
        {hint && <p className="text-xs text-zinc-500 mb-2">{hint}</p>}
        <input type="url" value={value} onChange={e => onChange(e.target.value)}
          placeholder="https://drive.google.com/file/d/..."
          className={`input-dark w-full ${inputPad} rounded-xl`} />
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-semibold mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {hint && <p className="text-xs text-zinc-500 mb-2">{hint}</p>}

      {/* Picked state */}
      {isPicked && !showManual && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center gap-3 mb-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-300 truncate">{pickedName || 'File selected'}</p>
            {pickedSize && <p className="text-xs text-emerald-600">{pickedSize}</p>}
          </div>
          {allowReplace && (
            <button onClick={openPicker} disabled={loading || !apisReady}
              className="text-xs text-emerald-500 hover:text-emerald-300 flex items-center gap-1 flex-shrink-0">
              <Upload className="w-3 h-3" /> Replace
            </button>
          )}
        </div>
      )}

      {/* Main action row */}
      {(!isPicked || showManual) && (
        <div className="flex gap-2">
          {/* Picker button */}
          <button
            type="button"
            onClick={openPicker}
            disabled={loading || !apisReady}
            className="btn-primary flex items-center gap-2 rounded-xl flex-shrink-0"
            style={{ padding: size === 'sm' ? '0.5rem 0.875rem' : '0.75rem 1.25rem' }}
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Opening...</span></>
              : !apisReady
              ? <><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Loading...</span></>
              : <><FolderOpen className="w-4 h-4" /><span className="text-sm font-semibold">Browse / Upload</span></>
            }
          </button>

          {/* Manual link input */}
          <input
            type="url"
            value={value}
            onChange={e => { onChange(e.target.value); if (e.target.value) setPickedName(''); }}
            placeholder="or paste Drive link…"
            className={`input-dark flex-1 ${inputPad} rounded-xl text-sm`}
          />
        </div>
      )}

      {/* Toggle to show/hide manual input when file already picked */}
      {isPicked && !showManual && (
        <button onClick={() => setShowManual(true)}
          className="mt-1.5 flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400">
          <Link2 className="w-3 h-3" /> Paste link manually instead
        </button>
      )}
      {showManual && isPicked && (
        <button onClick={() => setShowManual(false)}
          className="mt-1.5 flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400">
          <X className="w-3 h-3" /> Back to upload view
        </button>
      )}

      {/* Error */}
      {error && (
        <p className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}
    </div>
  );
}
