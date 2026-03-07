import { createClient } from '@supabase/supabase-js';
import { ReleaseSubmission, AdminSettings, DEFAULT_ADMIN_SETTINGS } from './types';

// ============================================================
// Supabase Client
// ============================================================
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

// ── Password hashing (Web Crypto — no deps, runs in browser) ──
export async function hashPassword(plain: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#09090b;font-family:sans-serif;color:#fff;padding:2rem;text-align:center;">
      <div>
        <h2 style="color:#a78bfa;margin-bottom:1rem">⚠️ Missing Supabase Configuration</h2>
        <p style="color:#a1a1aa;margin-bottom:0.5rem">Add these environment variables to your Vercel project:</p>
        <code style="display:block;background:#18181b;padding:1rem;border-radius:8px;margin-top:1rem;text-align:left;line-height:2">
          VITE_SUPABASE_URL=https://your-project.supabase.co<br/>
          VITE_SUPABASE_ANON_KEY=your-anon-key
        </code>
        <p style="color:#71717a;margin-top:1rem;font-size:0.85rem">Then redeploy the project.</p>
      </div>
    </div>`;
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================
// Generate Release ID: IL-2025-06-001
// ============================================================
async function generateReleaseId(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `${year}-${month}`;

  const { data } = await supabase
    .from('releases')
    .select('id')
    .ilike('id', `${prefix}-%`);

  const count = data ? data.length : 0;
  return `${prefix}-${String(count + 1).padStart(3, '0')}`;
}

// ============================================================
// Settings
// ============================================================
export async function getAdminSettings(): Promise<AdminSettings> {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('settings_id', 1)
    .single();

  if (error || !data) return { ...DEFAULT_ADMIN_SETTINGS };

  return {
    companyName: data.company_name ?? DEFAULT_ADMIN_SETTINGS.companyName,
    companyLogo: data.company_logo ?? DEFAULT_ADMIN_SETTINGS.companyLogo,
    accentColor: data.accent_color ?? DEFAULT_ADMIN_SETTINGS.accentColor,
    adminUsername: data.admin_username ?? DEFAULT_ADMIN_SETTINGS.adminUsername,
    adminPasswordHash: data.admin_password_hash ?? DEFAULT_ADMIN_SETTINGS.adminPasswordHash,
    formWelcomeText: data.form_welcome_text ?? DEFAULT_ADMIN_SETTINGS.formWelcomeText,
    formDescription: data.form_description ?? DEFAULT_ADMIN_SETTINGS.formDescription,
    submissionSuccessMessage: data.submission_success_message ?? DEFAULT_ADMIN_SETTINGS.submissionSuccessMessage,
    rightsAgreementText: data.rights_agreement_text ?? DEFAULT_ADMIN_SETTINGS.rightsAgreementText,
    requireDriveFolder: data.require_drive_folder ?? false,
    requirePromoMaterials: data.require_promo_materials ?? false,
    requireLyrics: data.require_lyrics ?? false,
    minReleaseDaysNotice: data.min_release_days_notice ?? 7,
    maxTracksAlbum: data.max_tracks_album ?? 32,
    allowedReleaseTypes: data.allowed_release_types ?? 'single,ep,album',
    customGenres: data.custom_genres ?? '',
    statusLabelPending: data.status_label_pending ?? 'Pending',
    statusLabelApproved: data.status_label_approved ?? 'Approved',
    statusLabelScheduled: data.status_label_scheduled ?? 'Scheduled',
    statusLabelReleased: data.status_label_released ?? 'Released',
    statusLabelRejected: data.status_label_rejected ?? 'Rejected',
    notificationEmail: data.notification_email ?? '',
    discordWebhook: data.discord_webhook ?? '',
    googleSheetsWebhook: data.google_sheets_webhook ?? '',
    submissionCooldownHours: data.submission_cooldown_hours ?? 0,
    maintenanceMode: data.maintenance_mode ?? false,
    maintenanceModeMessage: data.maintenance_mode_message ?? DEFAULT_ADMIN_SETTINGS.maintenanceModeMessage,
    requireCoverArtSpecs: data.require_cover_art_specs ?? false,
    autoApproveAfterDays: data.auto_approve_after_days ?? 0,
    formAccentButtonLabel: data.form_accent_button_label ?? 'Continue',
    drivePickerEnabled: data.drive_picker_enabled ?? false,
    googleApiClientId: data.google_api_client_id ?? '',
    googleApiKey: data.google_api_key ?? '',
    driveUploadFolderId: data.drive_upload_folder_id ?? '',
    allowCoverArtImageUrl: data.allow_cover_art_image_url ?? true,
    showArtworkPreview: data.show_artwork_preview ?? true,
    requireMixMaster: data.require_mix_master ?? false,
    requireTikTokTimestamp: data.require_tiktok_timestamp ?? false,
    maxCollaborators: data.max_collaborators ?? 0,
    maxFeatures: data.max_features ?? 0,
    formFooterText: data.form_footer_text ?? '',
    labelEmail: data.label_email ?? '',
    labelInstagram: data.label_instagram ?? '',
    labelWebsite: data.label_website ?? '',
  };
}

export async function saveAdminSettings(settings: AdminSettings): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .update({
      company_name: settings.companyName,
      admin_username: settings.adminUsername,
      // adminPasswordHash is saved separately via saveAdminPassword() to allow conditional update
      company_logo: settings.companyLogo,
      accent_color: settings.accentColor,
      form_welcome_text: settings.formWelcomeText,
      form_description: settings.formDescription,
      submission_success_message: settings.submissionSuccessMessage,
      rights_agreement_text: settings.rightsAgreementText,
      require_drive_folder: settings.requireDriveFolder,
      require_promo_materials: settings.requirePromoMaterials,
      require_lyrics: settings.requireLyrics,
      min_release_days_notice: settings.minReleaseDaysNotice,
      max_tracks_album: settings.maxTracksAlbum,
      allowed_release_types: settings.allowedReleaseTypes,
      custom_genres: settings.customGenres,
      status_label_pending: settings.statusLabelPending,
      status_label_approved: settings.statusLabelApproved,
      status_label_scheduled: settings.statusLabelScheduled,
      status_label_released: settings.statusLabelReleased,
      status_label_rejected: settings.statusLabelRejected,
      notification_email: settings.notificationEmail || null,
      discord_webhook: settings.discordWebhook || null,
      google_sheets_webhook: settings.googleSheetsWebhook || null,
      submission_cooldown_hours: settings.submissionCooldownHours ?? 0,
      maintenance_mode: settings.maintenanceMode ?? false,
      maintenance_mode_message: settings.maintenanceModeMessage || null,
      require_cover_art_specs: settings.requireCoverArtSpecs ?? false,
      auto_approve_after_days: settings.autoApproveAfterDays ?? 0,
      form_accent_button_label: settings.formAccentButtonLabel || 'Continue',
      drive_picker_enabled: settings.drivePickerEnabled ?? false,
      google_api_client_id: settings.googleApiClientId || null,
      google_api_key: settings.googleApiKey || null,
      drive_upload_folder_id: settings.driveUploadFolderId || null,
      allow_cover_art_image_url: settings.allowCoverArtImageUrl ?? true,
      show_artwork_preview: settings.showArtworkPreview ?? true,
      require_mix_master: settings.requireMixMaster ?? false,
      require_tiktok_timestamp: settings.requireTikTokTimestamp ?? false,
      max_collaborators: settings.maxCollaborators ?? 0,
      max_features: settings.maxFeatures ?? 0,
      form_footer_text: settings.formFooterText || null,
      label_email: settings.labelEmail || null,
      label_instagram: settings.labelInstagram || null,
      label_website: settings.labelWebsite || null,
    })
    .eq('settings_id', 1);

  if (error) throw new Error(error.message);
}

// Public branding — anyone can read (RLS: public SELECT on settings)
export async function fetchPublicBranding(): Promise<Partial<AdminSettings> | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('company_name, company_logo, form_welcome_text, form_description, accent_color, submission_success_message, rights_agreement_text, require_drive_folder, require_promo_materials, require_lyrics, min_release_days_notice, max_tracks_album, allowed_release_types, custom_genres, maintenance_mode, maintenance_mode_message, require_cover_art_specs, submission_cooldown_hours, form_accent_button_label, drive_picker_enabled, google_api_client_id, google_api_key, drive_upload_folder_id, allow_cover_art_image_url, show_artwork_preview, require_mix_master, require_tiktok_timestamp, max_collaborators, max_features, form_footer_text, label_email, label_instagram, label_website')
    .eq('settings_id', 1)
    .single();

  if (error || !data) return null;

  return {
    companyName: data.company_name ?? DEFAULT_ADMIN_SETTINGS.companyName,
    companyLogo: data.company_logo ?? DEFAULT_ADMIN_SETTINGS.companyLogo,
    formWelcomeText: data.form_welcome_text ?? DEFAULT_ADMIN_SETTINGS.formWelcomeText,
    formDescription: data.form_description ?? DEFAULT_ADMIN_SETTINGS.formDescription,
    accentColor: data.accent_color ?? DEFAULT_ADMIN_SETTINGS.accentColor,
    submissionSuccessMessage: data.submission_success_message ?? DEFAULT_ADMIN_SETTINGS.submissionSuccessMessage,
    rightsAgreementText: data.rights_agreement_text ?? DEFAULT_ADMIN_SETTINGS.rightsAgreementText,
    requireDriveFolder: data.require_drive_folder ?? false,
    requirePromoMaterials: data.require_promo_materials ?? false,
    requireLyrics: data.require_lyrics ?? false,
    minReleaseDaysNotice: data.min_release_days_notice ?? 7,
    maxTracksAlbum: data.max_tracks_album ?? 32,
    allowedReleaseTypes: data.allowed_release_types ?? 'single,ep,album',
    customGenres: data.custom_genres ?? '',
    maintenanceMode: data.maintenance_mode ?? false,
    maintenanceModeMessage: data.maintenance_mode_message ?? DEFAULT_ADMIN_SETTINGS.maintenanceModeMessage,
    requireCoverArtSpecs: data.require_cover_art_specs ?? false,
    submissionCooldownHours: data.submission_cooldown_hours ?? 0,
    formAccentButtonLabel: data.form_accent_button_label ?? 'Continue',
    drivePickerEnabled: data.drive_picker_enabled ?? false,
    googleApiClientId: data.google_api_client_id ?? '',
    googleApiKey: data.google_api_key ?? '',
    driveUploadFolderId: data.drive_upload_folder_id ?? '',
    allowCoverArtImageUrl: data.allow_cover_art_image_url ?? true,
    showArtworkPreview: data.show_artwork_preview ?? true,
    requireMixMaster: data.require_mix_master ?? false,
    requireTikTokTimestamp: data.require_tiktok_timestamp ?? false,
    maxCollaborators: data.max_collaborators ?? 0,
    maxFeatures: data.max_features ?? 0,
    formFooterText: data.form_footer_text ?? '',
    labelEmail: data.label_email ?? '',
    labelInstagram: data.label_instagram ?? '',
    labelWebsite: data.label_website ?? '',
  };
}

async function pushSettingsToSheet(settings: AdminSettings): Promise<void> {
  if (!settings.googleSheetsWebhook) return;
  try {
    await fetch(settings.googleSheetsWebhook, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveSettings',
        companyName: settings.companyName,
        companyLogo: settings.companyLogo,
        formWelcomeText: settings.formWelcomeText,
        formDescription: settings.formDescription,
      }),
    });
  } catch {}
}

// ============================================================
// DB row <-> ReleaseSubmission mappers
// ============================================================
function rowToRelease(row: Record<string, unknown>): ReleaseSubmission {
  return {
    id: row.id as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    status: row.status as ReleaseSubmission['status'],
    mainArtist: row.main_artist as string,
    collaborations: (row.collaborations as ReleaseSubmission['collaborations']) ?? [],
    features: (row.features as ReleaseSubmission['features']) ?? [],
    releaseType: row.release_type as ReleaseSubmission['releaseType'],
    releaseTitle: row.release_title as string,
    releaseDate: row.release_date as string,
    explicitContent: row.explicit_content as boolean,
    genre: row.genre as string,
    coverArtDriveLink: row.cover_art_drive_link as string,
    coverArtImageUrl: (row.cover_art_image_url as string) ?? '',
    tracks: (row.tracks as ReleaseSubmission['tracks']) ?? [],
    promoDriveLink: (row.promo_drive_link as string) ?? undefined,
    driveFolderLink: (row.drive_folder_link as string) ?? undefined,
    rightsConfirmed: row.rights_confirmed as boolean,
    labelNotes: (row.label_notes as string) ?? undefined,
    upc: (row.upc as string) ?? undefined,
    priority: (row.priority as ReleaseSubmission['priority']) ?? 'normal',
    checklist: (row.checklist as ReleaseSubmission['checklist']) ?? [],
  };
}

function releaseToRow(release: Partial<ReleaseSubmission> & { id?: string }) {
  const row: Record<string, unknown> = {};
  if (release.id !== undefined) row.id = release.id;
  if (release.status !== undefined) row.status = release.status;
  if (release.mainArtist !== undefined) row.main_artist = release.mainArtist;
  if (release.collaborations !== undefined) row.collaborations = release.collaborations;
  if (release.features !== undefined) row.features = release.features;
  if (release.releaseType !== undefined) row.release_type = release.releaseType;
  if (release.releaseTitle !== undefined) row.release_title = release.releaseTitle;
  if (release.releaseDate !== undefined) row.release_date = release.releaseDate;
  if (release.explicitContent !== undefined) row.explicit_content = release.explicitContent;
  if (release.genre !== undefined) row.genre = release.genre;
  if (release.coverArtDriveLink !== undefined) row.cover_art_drive_link = release.coverArtDriveLink;
  if (release.coverArtImageUrl !== undefined) row.cover_art_image_url = release.coverArtImageUrl;
  if (release.tracks !== undefined) row.tracks = release.tracks;
  if (release.promoDriveLink !== undefined) row.promo_drive_link = release.promoDriveLink;
  if (release.driveFolderLink !== undefined) row.drive_folder_link = release.driveFolderLink;
  if (release.rightsConfirmed !== undefined) row.rights_confirmed = release.rightsConfirmed;
  if (release.labelNotes !== undefined) row.label_notes = release.labelNotes;
  if (release.upc !== undefined) row.upc = release.upc;
  if (release.priority !== undefined) row.priority = release.priority;
  if (release.checklist !== undefined) row.checklist = release.checklist;
  return row;
}

// ============================================================
// CRUD — Releases
// ============================================================
export async function getSubmissions(): Promise<ReleaseSubmission[]> {
  const { data, error } = await supabase
    .from('releases')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map(rowToRelease);
}

export async function addSubmission(
  submission: Omit<ReleaseSubmission, 'id' | 'createdAt' | 'updatedAt' | 'status'>
): Promise<ReleaseSubmission> {
  const id = await generateReleaseId();
  const now = new Date().toISOString();

  const row = {
    ...releaseToRow({ ...submission, id }),
    status: 'pending',
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('releases')
    .insert(row)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to save submission');

  const newRelease = rowToRelease(data);
  sendToGoogleSheets(newRelease);
  sendDiscordNotification(newRelease);

  return newRelease;
}

export async function updateSubmission(
  id: string,
  updates: Partial<ReleaseSubmission>
): Promise<void> {
  const row = {
    ...releaseToRow(updates),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('releases').update(row).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateSubmissionStatus(
  id: string,
  status: ReleaseSubmission['status']
): Promise<void> {
  return updateSubmission(id, { status });
}

export async function deleteSubmission(id: string): Promise<void> {
  const { error } = await supabase.from('releases').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ============================================================
// Duplicate Detector
// ============================================================
export interface DuplicateWarning {
  id: string;
  mainArtist: string;
  releaseTitle: string;
  status: string;
  createdAt: string;
  similarity: 'exact' | 'similar';
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function isSimilar(a: string, b: string): boolean {
  const na = normalize(a), nb = normalize(b);
  if (na === nb) return true;
  const longer = Math.max(na.length, nb.length);
  if (longer === 0) return true;
  return levenshtein(na, nb) / longer < 0.3;
}

export async function checkForDuplicates(
  artist: string, title: string, excludeId?: string
): Promise<DuplicateWarning[]> {
  const { data } = await supabase.from('releases').select('id, main_artist, release_title, status, created_at');
  if (!data) return [];
  return data
    .filter(r => r.id !== excludeId)
    .filter(r => isSimilar(r.main_artist, artist) && isSimilar(r.release_title, title))
    .map(r => ({
      id: r.id,
      mainArtist: r.main_artist,
      releaseTitle: r.release_title,
      status: r.status,
      createdAt: r.created_at,
      similarity: normalize(r.main_artist) === normalize(artist) && normalize(r.release_title) === normalize(title)
        ? 'exact' : 'similar',
    }));
}

// ============================================================
// Form Auto-save (localStorage keyed by label)
// ============================================================
const AUTOSAVE_KEY = 'release_form_draft';

export function saveFormDraft(data: Record<string, unknown>): void {
  try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ ...data, savedAt: Date.now() })); } catch {}
}

export function loadFormDraft(): (Record<string, unknown> & { savedAt?: number }) | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Expire after 48 hours
    if (parsed.savedAt && Date.now() - parsed.savedAt > 48 * 3600 * 1000) {
      localStorage.removeItem(AUTOSAVE_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

export function clearFormDraft(): void {
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch {}
}

// ============================================================
// Auth — in-memory session (no localStorage)
// ============================================================
let _adminSession: { loggedIn: boolean; expiry: number } = { loggedIn: false, expiry: 0 };

export async function loginAdmin(username: string, password: string): Promise<boolean> {
  const settings = await getAdminSettings();
  if (username !== settings.adminUsername) return false;
  const inputHash = await hashPassword(password);
  return inputHash === settings.adminPasswordHash;
}

// Save only the password hash — called separately so saveAdminSettings doesn't need the raw password
export async function saveAdminPassword(newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword);
  const { error } = await supabase
    .from('settings')
    .update({ admin_password_hash: hash })
    .eq('settings_id', 1);
  if (error) throw new Error(error.message);
}

export function setAdminSession(loggedIn: boolean): void {
  _adminSession = {
    loggedIn,
    expiry: loggedIn ? Date.now() + 24 * 60 * 60 * 1000 : 0,
  };
}

export function isAdminLoggedIn(): boolean {
  return _adminSession.loggedIn && Date.now() < _adminSession.expiry;
}

export function logoutAdmin(): void {
  _adminSession = { loggedIn: false, expiry: 0 };
}

// ============================================================
// Google Sheets — append-only mirror
// ============================================================
async function sendToGoogleSheets(release: ReleaseSubmission): Promise<void> {
  const settings = await getAdminSettings();
  if (!settings.googleSheetsWebhook) return;

  try {
    const trackNames = release.tracks.map(t => t.title).join(', ');
    const collabNames = release.collaborations?.map(c => c.name).join(', ') ?? '';
    const featureNames = release.features?.map(f => f.name).join(', ') ?? '';

    await fetch(settings.googleSheetsWebhook, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'newRelease',
        id: release.id,
        mainArtist: release.mainArtist,
        releaseTitle: release.releaseTitle,
        releaseType: release.releaseType,
        genre: release.genre,
        releaseDate: release.releaseDate,
        explicit: release.explicitContent ? 'Yes' : 'No',
        tracks: trackNames,
        trackCount: release.tracks.length,
        collaborations: collabNames,
        features: featureNames,
        coverArtLink: release.coverArtDriveLink ?? '',
        driveFolderLink: release.driveFolderLink ?? '',
        promoLink: release.promoDriveLink ?? '',
        status: release.status,
        submittedAt: release.createdAt,
      }),
    });
  } catch {}
}

// ============================================================
// Discord Webhook
// ============================================================
async function sendDiscordNotification(release: ReleaseSubmission): Promise<void> {
  const settings = await getAdminSettings();
  if (!settings.discordWebhook) return;

  try {
    const trackList = release.tracks
      .map((t, i) => `${i + 1}. ${t.title}${t.explicit ? ' 🔞' : ''}`)
      .join('\n');

    const fields: Array<{ name: string; value: string; inline: boolean }> = [
      { name: '🆔 Release ID', value: release.id, inline: true },
      { name: '🎤 Main Artist', value: release.mainArtist, inline: true },
      { name: '💿 Title', value: release.releaseTitle, inline: true },
      { name: '📀 Type', value: release.releaseType.toUpperCase(), inline: true },
      { name: '🎸 Genre', value: release.genre || 'N/A', inline: true },
      { name: '📅 Release Date', value: release.releaseDate || 'TBD', inline: true },
      { name: '🔞 Explicit', value: release.explicitContent ? 'Yes' : 'No', inline: true },
      { name: `🎵 Tracks (${release.tracks.length})`, value: trackList || 'None', inline: false },
    ];

    if (release.collaborations?.length) {
      fields.push({ name: '🤝 Collaborations', value: release.collaborations.map(c => c.name).join(', '), inline: true });
    }
    if (release.features?.length) {
      fields.push({ name: '⭐ Features', value: release.features.map(f => f.name).join(', '), inline: true });
    }
    if (release.coverArtDriveLink) {
      fields.push({ name: '🖼️ Cover Art', value: `[View on Drive](${release.coverArtDriveLink})`, inline: true });
    }
    if (release.driveFolderLink) {
      fields.push({ name: '📁 Drive Folder', value: `[Open Folder](${release.driveFolderLink})`, inline: true });
    }

    await fetch(settings.discordWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: settings.companyName || 'In Lights',
        avatar_url: settings.companyLogo || '',
        embeds: [{
          title: '🎵 New Release Submission',
          description: `**${release.mainArtist}** submitted a new **${release.releaseType.toUpperCase()}**: **${release.releaseTitle}**`,
          color: 0x8B5CF6,
          fields,
          footer: {
            text: `${settings.companyName || 'In Lights'} • Release Management`,
            icon_url: settings.companyLogo || undefined,
          },
          timestamp: new Date().toISOString(),
        }],
      }),
    });
  } catch (err) {
    console.error('Discord notification failed:', err);
  }
}

export async function testDiscordWebhook(webhookUrl: string): Promise<boolean> {
  try {
    const settings = await getAdminSettings();
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: settings.companyName || 'In Lights',
        avatar_url: settings.companyLogo || '',
        embeds: [{
          title: '✅ Webhook Connected!',
          description: 'Discord notifications are working. You will receive a notification here every time someone submits a new release.',
          color: 0x10B981,
          footer: { text: `${settings.companyName || 'In Lights'} • Release Management` },
          timestamp: new Date().toISOString(),
        }],
      }),
    });
    return response.ok || response.status === 204;
  } catch {
    return false;
  }
}

// ============================================================
// CSV Export (client-side, no DB needed)
// ============================================================
export function exportToCSV(releases: ReleaseSubmission[]): void {
  const headers = ['ID', 'Main Artist', 'Title', 'Type', 'Genre', 'Release Date', 'Explicit', 'Tracks', 'Status', 'Submitted'];
  const rows = releases.map(r => [
    r.id,
    r.mainArtist,
    r.releaseTitle,
    r.releaseType,
    r.genre,
    r.releaseDate,
    r.explicitContent ? 'Yes' : 'No',
    r.tracks.map(t => t.title).join(' | '),
    r.status,
    new Date(r.createdAt).toLocaleDateString(),
  ]);

  const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `releases-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
