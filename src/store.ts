import { createClient } from '@supabase/supabase-js';
import { ReleaseSubmission, AdminSettings, DEFAULT_ADMIN_SETTINGS, AdminRole } from './types';

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
// Generate Release ID: 2025-06-001
// Uses MAX id for the month to avoid race conditions from COUNT
// ============================================================
async function generateReleaseId(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `${year}-${month}`;

  // Use max instead of count to avoid duplicate IDs if any were deleted
  const { data } = await supabase
    .from('releases')
    .select('id')
    .ilike('id', `${prefix}-%`)
    .order('id', { ascending: false })
    .limit(1);

  let next = 1;
  if (data && data.length > 0) {
    const last = data[0].id as string;
    const parts = last.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) next = lastNum + 1;
  }
  return `${prefix}-${String(next).padStart(3, '0')}`;
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
    pendingReminderDays: data.pending_reminder_days ?? 2,
    internalCommentsEnabled: data.internal_comments_enabled ?? true,
    releaseReminderDays: data.release_reminder_days ?? 7,
    formAccentButtonLabel: data.form_accent_button_label ?? 'Continue',
    drivePickerEnabled: data.drive_picker_enabled ?? false,
    googleApiClientId: data.google_api_client_id ?? '',
    googleApiKey: data.google_api_key ?? '',
    driveUploadFolderId: data.drive_upload_folder_id ?? '',
    allowCoverArtImageUrl: data.allow_cover_art_image_url ?? true,
    showArtworkPreview: data.show_artwork_preview ?? true,
    requireMixMaster: data.require_mix_master ?? false,
    requireCredits: data.require_credits ?? false,
    requireTikTokTimestamp: data.require_tiktok_timestamp ?? false,
    maxCollaborators: data.max_collaborators ?? 0,
    showArtistEmail: data.show_artist_email ?? true,
    maxFeatures: data.max_features ?? 0,
    formFooterText: data.form_footer_text ?? '',
    labelEmail: data.label_email ?? '',
    labelInstagram: data.label_instagram ?? '',
    labelWebsite: data.label_website ?? '',
    gmailUser: data.gmail_user ?? '',
    gmailAppPassword: data.gmail_app_password ?? '',
    resendApiKey: data.resend_api_key ?? '',
    gmailWebhookUrl: data.gmail_webhook_url ?? '',
    emailFromName: data.email_from_name ?? DEFAULT_ADMIN_SETTINGS.emailFromName,
    emailFromAddress: data.email_from_address ?? '',
    emailNotifyOnSubmission: data.email_notify_on_submission ?? false,
    emailNotifyArtistOnStatus: data.email_notify_artist_on_status ?? false,
    noteTemplates: data.note_templates ?? DEFAULT_ADMIN_SETTINGS.noteTemplates,
    geminiApiKey: data.gemini_api_key ?? '',
    spotifyClientId: data.spotify_client_id ?? '',
    spotifyClientSecret: data.spotify_client_secret ?? '',
    youtubeApiKey: data.youtube_api_key ?? '',
  };
}

export async function saveAdminSettings(settings: AdminSettings): Promise<void> {
  // ── CORE: columns guaranteed to exist in every install ──────────────────────
  const { error } = await supabase
    .from('settings')
    .update({
      company_name: settings.companyName,
      admin_username: settings.adminUsername,
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
      require_credits: settings.requireCredits ?? false,
      require_tiktok_timestamp: settings.requireTikTokTimestamp ?? false,
      show_artist_email: settings.showArtistEmail ?? true,
      max_collaborators: settings.maxCollaborators ?? 0,
      max_features: settings.maxFeatures ?? 0,
      form_footer_text: settings.formFooterText || null,
      label_email: settings.labelEmail || null,
      label_instagram: settings.labelInstagram || null,
      label_website: settings.labelWebsite || null,
    })
    .eq('settings_id', 1);

  if (error) throw new Error(error.message);

  // ── EXTENDED: newer columns — saved silently so missing columns never break the core save.
  // Run add_columns.sql in Supabase SQL Editor once to unlock these fully.
  await supabase.from('settings').update({
    pending_reminder_days: settings.pendingReminderDays ?? 2,
    internal_comments_enabled: settings.internalCommentsEnabled ?? true,
    release_reminder_days: settings.releaseReminderDays ?? 7,
    gmail_user: settings.gmailUser || null,
    gmail_app_password: settings.gmailAppPassword || null,
    resend_api_key: settings.resendApiKey || null,
    email_from_address: settings.emailFromAddress || null,
    note_templates: settings.noteTemplates || null,
    gemini_api_key: settings.geminiApiKey || null,
    show_artist_email: settings.showArtistEmail ?? true,
    gmail_webhook_url: settings.gmailWebhookUrl || null,
    email_from_name: settings.emailFromName || null,
    email_notify_on_submission: settings.emailNotifyOnSubmission ?? false,
    email_notify_artist_on_status: settings.emailNotifyArtistOnStatus ?? false,
    spotify_client_id: settings.spotifyClientId || null,
    spotify_client_secret: settings.spotifyClientSecret || null,
    youtube_api_key: settings.youtubeApiKey || null,
  }).eq('settings_id', 1).then(() => {}); // intentionally silent — missing columns won't break core save
}

// Public branding — anyone can read (RLS: public SELECT on settings)
export async function fetchPublicBranding(): Promise<Partial<AdminSettings> | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('company_name, company_logo, form_welcome_text, form_description, accent_color, submission_success_message, rights_agreement_text, require_drive_folder, require_promo_materials, require_lyrics, min_release_days_notice, max_tracks_album, allowed_release_types, custom_genres, maintenance_mode, maintenance_mode_message, require_cover_art_specs, submission_cooldown_hours, form_accent_button_label, drive_picker_enabled, google_api_client_id, google_api_key, drive_upload_folder_id, allow_cover_art_image_url, show_artwork_preview, require_mix_master, require_credits, require_tiktok_timestamp, show_artist_email, max_collaborators, max_features, form_footer_text, label_email, label_instagram, label_website')
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
    requireCredits: data.require_credits ?? false,
    requireTikTokTimestamp: data.require_tiktok_timestamp ?? false,
    showArtistEmail: data.show_artist_email ?? true,
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
    artistEmail: (row.artist_email as string) ?? undefined,
    upc: (row.upc as string) ?? undefined,
    priority: (row.priority as ReleaseSubmission['priority']) ?? 'normal',
    checklist: (row.checklist as ReleaseSubmission['checklist']) ?? [],
    deliveryPipeline: (row.delivery_pipeline as ReleaseSubmission['deliveryPipeline']) ?? [],
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
  if (release.artistEmail !== undefined) row.artist_email = release.artistEmail;
  if (release.upc !== undefined) row.upc = release.upc;
  if (release.priority !== undefined) row.priority = release.priority;
  if (release.checklist !== undefined) row.checklist = release.checklist;
  if (release.deliveryPipeline !== undefined) row.delivery_pipeline = release.deliveryPipeline;
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
  release: Omit<ReleaseSubmission, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = await generateReleaseId();
  const now = new Date().toISOString();
  const row = {
    ...releaseToRow({ ...release, id }),
    id,
    status: 'pending',
    created_at: now,
    updated_at: now,
  };
  const { error } = await supabase.from('releases').insert(row);
  if (error) throw new Error(error.message);
  const { data } = await supabase.from('releases').select().eq('id', id).single();
  if (data) { const r = rowToRelease(data); sendToGoogleSheets(r); sendDiscordNotification(r); sendSubmissionNotification(r); }
  await logActivity('Submitted release', `${release.mainArtist} — ${release.releaseTitle}`, id, { genre: release.genre, type: release.releaseType });
  return id;
}

export async function updateSubmission(
  id: string,
  updates: Partial<ReleaseSubmission>,
  label?: string
): Promise<void> {
  const row = { ...releaseToRow(updates), updated_at: new Date().toISOString() };
  const { error } = await supabase.from('releases').update(row).eq('id', id);
  if (error) throw new Error(error.message);
  if (label) await logActivity('Edited release', label, id, { fields: Object.keys(updates) });
  // Live sync to Google Sheets on every edit
  try {
    const { data } = await supabase.from('releases').select('*').eq('id', id).single();
    if (data) syncStatusToSheets(rowToRelease(data)); // non-blocking
  } catch {}
}

export async function updateSubmissionStatus(
  id: string,
  status: ReleaseSubmission['status'],
  label?: string
): Promise<void> {
  await updateSubmission(id, { status });
  await logActivity(`Status → ${status}`, label || id, id, { status });
  // Fire post-status actions non-blocking
  try {
    const { data } = await supabase.from('releases').select('*').eq('id', id).single();
    if (data) {
      const release = rowToRelease(data);
      if (data.artist_email) await sendStatusNotification(release, data.artist_email as string);
      syncStatusToSheets(release); // non-blocking sheets update
    }
  } catch { /* non-blocking */ }
}

export async function deleteSubmission(id: string, label?: string): Promise<void> {
  await logActivity('Deleted release', label || id, id);
  const { error } = await supabase.from('releases').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ============================================================
// Activity Log
// ============================================================
export interface ActivityLogEntry {
  id: string;
  createdAt: string;
  adminUsername: string;
  adminRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityLabel?: string;
  meta?: Record<string, unknown>;
}

export async function logActivity(
  action: string,
  entityLabel: string,
  entityId?: string,
  meta?: Record<string, unknown>,
  entityType = 'release'
): Promise<void> {
  const session = getAdminSession();
  if (!session.loggedIn) return;
  try {
    await supabase.from('admin_activity_log').insert({
      admin_username: session.username || 'unknown',
      admin_role: session.role,
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_label: entityLabel,
      meta: meta || {},
    });
  } catch { /* non-blocking — log errors should never break the app */ }
}

export async function getActivityLog(limit = 100): Promise<ActivityLogEntry[]> {
  const { data, error } = await supabase
    .from('admin_activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id as string,
    createdAt: r.created_at as string,
    adminUsername: r.admin_username as string,
    adminRole: r.admin_role as string | undefined,
    action: r.action as string,
    entityType: r.entity_type as string,
    entityId: r.entity_id as string | undefined,
    entityLabel: r.entity_label as string | undefined,
    meta: r.meta as Record<string, unknown> | undefined,
  }));
}

export async function clearActivityLog(): Promise<void> {
  const { error } = await supabase
    .from('admin_activity_log')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all
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
    .filter(r => isSimilar(r.main_artist, artist)) // same artist first
    .filter(r => isSimilar(r.release_title, title)) // then same title under that artist
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
// Auth — multi-admin session
// ============================================================

interface AdminSession {
  loggedIn: boolean;
  expiry: number;
  userId?: string;
  username?: string;
  role?: AdminRole;
}

const SESSION_KEY = 'inlights_admin_session';

function saveSessionToStorage(session: AdminSession) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch {}
}

function loadSessionFromStorage(): AdminSession {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return { loggedIn: false, expiry: 0 };
    const s = JSON.parse(raw) as AdminSession;
    if (!s.loggedIn || Date.now() >= s.expiry) {
      localStorage.removeItem(SESSION_KEY);
      return { loggedIn: false, expiry: 0 };
    }
    return s;
  } catch { return { loggedIn: false, expiry: 0 }; }
}

let _adminSession: AdminSession = loadSessionFromStorage();

export async function loginAdmin(username: string, password: string): Promise<boolean> {
  const inputHash = await hashPassword(password);

  // Try multi-admin table first
  const { data: users } = await supabase
    .from('admin_users')
    .select('*')
    .eq('username', username.trim().toLowerCase())
    .eq('password_hash', inputHash)
    .single();

  if (users) {
    _adminSession = {
      loggedIn: true,
      expiry: Date.now() + 24 * 60 * 60 * 1000,
      userId: users.id,
      username: users.username,
      role: users.role as AdminRole,
    };
    saveSessionToStorage(_adminSession);
    await supabase.from('admin_users').update({ last_login: new Date().toISOString() }).eq('id', users.id);
    return true;
  }

  // Fallback: legacy single-admin from settings table
  const settings = await getAdminSettings();
  if (username === settings.adminUsername) {
    if (inputHash === settings.adminPasswordHash) {
      _adminSession = {
        loggedIn: true,
        expiry: Date.now() + 24 * 60 * 60 * 1000,
        username,
        role: 'owner',
      };
      saveSessionToStorage(_adminSession);
      return true;
    }
  }
  return false;
}

// ============================================================
// Custom Roles
// ============================================================

export async function getCustomRoles(): Promise<import('./types').CustomRole[]> {
  const { data } = await supabase.from('custom_roles').select('*').order('created_at');
  return (data || []).map(r => ({
    id: r.id as string,
    name: r.name as string,
    permissions: r.permissions as import('./types').CustomRole['permissions'],
  }));
}

export async function saveCustomRole(role: Omit<import('./types').CustomRole, 'id'> & { id?: string }): Promise<void> {
  if (role.id) {
    await supabase.from('custom_roles').update({ name: role.name, permissions: role.permissions }).eq('id', role.id);
  } else {
    await supabase.from('custom_roles').insert({ name: role.name, permissions: role.permissions });
  }
}

export async function deleteCustomRole(id: string): Promise<void> {
  await supabase.from('custom_roles').delete().eq('id', id);
}

export async function getAdminUsers() {
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id as string,
    username: r.username as string,
    passwordHash: r.password_hash as string,
    role: r.role as AdminRole,
    createdAt: r.created_at as string,
    lastLogin: r.last_login as string | undefined,
  }));
}

export async function createAdminUser(username: string, password: string, role: AdminRole): Promise<void> {
  const passwordHash = await hashPassword(password);
  const { error } = await supabase.from('admin_users').insert({
    username: username.trim().toLowerCase(),
    password_hash: passwordHash,
    role,
  });
  if (error) throw new Error(error.message);
}

export async function updateAdminUser(id: string, updates: { username?: string; password?: string; role?: AdminRole }): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.username) row.username = updates.username.trim().toLowerCase();
  if (updates.role) row.role = updates.role;
  if (updates.password) row.password_hash = await hashPassword(updates.password);
  const { error } = await supabase.from('admin_users').update(row).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteAdminUser(id: string): Promise<void> {
  const { error } = await supabase.from('admin_users').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export function getAdminSession(): AdminSession { return _adminSession; }

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
  if (loggedIn) saveSessionToStorage(_adminSession);
  else try { localStorage.removeItem(SESSION_KEY); } catch {}
}

export function isAdminLoggedIn(): boolean {
  return _adminSession.loggedIn && Date.now() < _adminSession.expiry;
}

export function logoutAdmin(): void {
  _adminSession = { loggedIn: false, expiry: 0 };
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

// ============================================================
// Google Sheets — full sync mirror
// ============================================================
// ── Google Sheets sync — 6 columns only: ID, Title, Artist, UPC, ISRC, Release Date
function buildSheetsPayload(action: string, release: ReleaseSubmission) {
  const isrcList = release.tracks
    .map(t => t.isrc?.trim())
    .filter(Boolean)
    .join(', ');

  return {
    action,
    id: release.id,
    title: release.releaseTitle,
    artist: release.mainArtist,
    upc: release.upc ?? '',
    isrc: isrcList,
    releaseDate: release.releaseDate ?? '',
  };
}

// Single upsert function — used for new submissions AND every edit
async function sendToGoogleSheets(release: ReleaseSubmission): Promise<void> {
  const settings = await getAdminSettings();
  if (!settings.googleSheetsWebhook) return;
  try {
    await fetch(settings.googleSheetsWebhook, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildSheetsPayload('upsertRelease', release)),
    });
  } catch {}
}

// Called on every save/edit from dashboard — keeps sheet live
export async function syncStatusToSheets(release: ReleaseSubmission): Promise<void> {
  await sendToGoogleSheets(release);
}

export async function syncAllToSheets(): Promise<{ sent: number }> {
  const settings = await getAdminSettings();
  if (!settings.googleSheetsWebhook) return { sent: 0 };
  const releases = await getSubmissions();
  for (const r of releases) {
    await sendToGoogleSheets(r);
    await new Promise(res => setTimeout(res, 150)); // rate limit
  }
  return { sent: releases.length };
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
// Email (Resend API)
// ============================================================

function buildSubmissionEmailHtml(release: ReleaseSubmission, settings: AdminSettings): string {
  const rows = [
    ['Artist', release.mainArtist],
    ['Type', release.releaseType.toUpperCase()],
    ['Genre', release.genre || '—'],
    ['Release Date', release.releaseDate || 'TBD'],
    ['Tracks', String(release.tracks.length)],
    ['Submission ID', release.id],
  ].map(([k, v]) => `
    <tr style="border-bottom:1px solid #27272a;">
      <td style="padding:12px 16px;font-size:12px;color:#71717a;width:40%;">${k}</td>
      <td style="padding:12px 16px;font-size:13px;color:#e4e4e7;font-weight:500;">${v}</td>
    </tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e4e4e7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 20px;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="background:#18181b;border-radius:16px 16px 0 0;padding:32px;border-bottom:1px solid #27272a;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td><img src="${settings.companyLogo}" width="40" height="40" style="border-radius:8px;" alt="${settings.companyName}"></td>
          <td style="padding-left:12px;"><span style="font-size:18px;font-weight:700;color:#fff;">${settings.companyName}</span><br><span style="font-size:12px;color:#71717a;">Release Management</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#18181b;padding:32px;">
        <p style="margin:0 0 8px;font-size:12px;color:#a1a1aa;text-transform:uppercase;letter-spacing:1px;">New Submission</p>
        <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#fff;">${release.releaseTitle}</h1>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;border-radius:12px;overflow:hidden;margin-bottom:24px;">${rows}</table>
        <a href="#admin" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600;">View in Admin Panel →</a>
      </td></tr>
      <tr><td style="background:#09090b;border-radius:0 0 16px 16px;padding:20px 32px;border-top:1px solid #27272a;">
        <p style="margin:0;font-size:12px;color:#52525b;">Automated notification from ${settings.companyName}.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function buildStatusEmailHtml(release: ReleaseSubmission, settings: AdminSettings): string {
  const cfg: Record<string, { color: string; bg: string; icon: string; headline: string; body: string }> = {
    approved:  { color:'#10b981', bg:'#052e16', icon:'✅', headline:'Your release has been approved!',
      body:`Great news! <strong>${release.releaseTitle}</strong> has been approved by our team. We'll be in touch with next steps.` },
    rejected:  { color:'#ef4444', bg:'#2d0a0a', icon:'❌', headline:'Update on your submission',
      body:`Thank you for submitting <strong>${release.releaseTitle}</strong>. After careful review, we're unable to move forward with this release at this time.${release.labelNotes ? `<br><br><strong>Label notes:</strong> ${release.labelNotes}` : ''}` },
    scheduled: { color:'#3b82f6', bg:'#0c1a2e', icon:'📅', headline:'Your release is scheduled!',
      body:`<strong>${release.releaseTitle}</strong> is scheduled for <strong>${release.releaseDate || 'a date TBC'}</strong>. We'll keep you updated as the date approaches.` },
    released:  { color:'#8b5cf6', bg:'#1a0a2e', icon:'🎵', headline:"Your release is live!",
      body:`Congratulations! <strong>${release.releaseTitle}</strong> is now live. Thank you for being part of ${settings.companyName}.` },
    pending:   { color:'#f59e0b', bg:'#1c1004', icon:'⏳', headline:'Submission received',
      body:`We've received <strong>${release.releaseTitle}</strong> and it's currently under review. We'll notify you once a decision has been made.` },
  };
  const s = cfg[release.status] || cfg.pending;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e4e4e7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 20px;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="background:#18181b;border-radius:16px 16px 0 0;padding:32px;border-bottom:1px solid #27272a;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td><img src="${settings.companyLogo}" width="40" height="40" style="border-radius:8px;" alt="${settings.companyName}"></td>
          <td style="padding-left:12px;"><span style="font-size:18px;font-weight:700;color:#fff;">${settings.companyName}</span><br><span style="font-size:12px;color:#71717a;">Release Management</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="background:${s.bg};padding:24px 32px;border-bottom:1px solid #27272a;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:32px;width:48px;">${s.icon}</td>
          <td style="padding-left:16px;">
            <p style="margin:0 0 4px;font-size:18px;font-weight:700;color:${s.color};">${s.headline}</p>
            <p style="margin:0;font-size:12px;color:#71717a;">Submission ID: ${release.id}</p>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#18181b;padding:32px;">
        <p style="margin:0 0 24px;font-size:15px;color:#a1a1aa;line-height:1.7;">Hi <strong style="color:#fff;">${release.mainArtist}</strong>,<br><br>${s.body}</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;border-radius:12px;overflow:hidden;margin-bottom:24px;">
          <tr style="border-bottom:1px solid #27272a;"><td style="padding:12px 16px;font-size:12px;color:#71717a;">Release</td><td style="padding:12px 16px;font-size:13px;color:#e4e4e7;font-weight:600;">${release.releaseTitle}</td></tr>
          <tr style="border-bottom:1px solid #27272a;"><td style="padding:12px 16px;font-size:12px;color:#71717a;">Type</td><td style="padding:12px 16px;font-size:13px;color:#e4e4e7;">${release.releaseType.toUpperCase()}</td></tr>
          <tr><td style="padding:12px 16px;font-size:12px;color:#71717a;">Status</td><td style="padding:12px 16px;font-size:13px;font-weight:700;color:${s.color};">${release.status.charAt(0).toUpperCase()+release.status.slice(1)}</td></tr>
        </table>
        <a href="/#status" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600;">Track Your Release →</a>
      </td></tr>
      <tr><td style="background:#09090b;border-radius:0 0 16px 16px;padding:20px 32px;border-top:1px solid #27272a;">
        <p style="margin:0;font-size:12px;color:#52525b;">${settings.companyName}${settings.labelEmail ? ` • <a href="mailto:${settings.labelEmail}" style="color:#52525b;">${settings.labelEmail}</a>` : ''}${settings.labelWebsite ? ` • <a href="${settings.labelWebsite}" style="color:#52525b;">${settings.labelWebsite}</a>` : ''}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

// ── sendEmail via Gmail (Google Apps Script relay) ───────────────────────────
// Gmail SMTP can't be called from the browser directly (CORS blocked).
// Solution: a tiny Google Apps Script acts as a relay — same pattern as the
// Sheets webhook you already use. Deploy it once, paste the URL in Settings → Email.
// The script runs as YOU (your Gmail), so emails come from your own address.
async function sendEmail(to: string, subject: string, html: string, settings: AdminSettings): Promise<boolean> {
  if (!settings.gmailWebhookUrl) return false;
  try {
    // Apps Script requires no-cors for POST — it processes and sends via Gmail.doSend()
    await fetch(settings.gmailWebhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sendEmail',
        to,
        subject,
        html,
        fromName: settings.emailFromName || settings.companyName || 'In Lights',
      }),
    });
    // no-cors means we can't read the response status — assume success if no throw
    return true;
  } catch (e) {
    console.error('Email send failed:', e);
    return false;
  }
}

export async function sendSubmissionNotification(release: ReleaseSubmission): Promise<void> {
  const settings = await getAdminSettings();
  if (!settings.emailNotifyOnSubmission || !settings.notificationEmail) return;
  await sendEmail(
    settings.notificationEmail,
    `🎵 New Submission: ${release.mainArtist} — ${release.releaseTitle}`,
    buildSubmissionEmailHtml(release, settings),
    settings
  );
}

export async function sendStatusNotification(release: ReleaseSubmission, artistEmail: string): Promise<void> {
  const settings = await getAdminSettings();
  if (!settings.emailNotifyArtistOnStatus || !artistEmail) return;
  const subjects: Record<string, string> = {
    approved:  `✅ Your release "${release.releaseTitle}" has been approved`,
    rejected:  `Update on your submission: "${release.releaseTitle}"`,
    scheduled: `📅 "${release.releaseTitle}" is scheduled!`,
    released:  `🎵 "${release.releaseTitle}" is now live!`,
    pending:   `We've received "${release.releaseTitle}"`,
  };
  await sendEmail(artistEmail, subjects[release.status] || `Update on "${release.releaseTitle}"`, buildStatusEmailHtml(release, settings), settings);
}

export async function testEmailConfig(toEmail: string): Promise<boolean> {
  const settings = await getAdminSettings();
  const html = `<!DOCTYPE html><html><body style="background:#09090b;font-family:sans-serif;padding:40px;color:#e4e4e7;">
    <div style="max-width:480px;margin:0 auto;background:#18181b;border-radius:16px;padding:40px;text-align:center;">
      <div style="font-size:52px;margin-bottom:16px;">✅</div>
      <h2 style="color:#10b981;margin:0 0 8px;font-size:22px;">Email is working!</h2>
      <p style="color:#71717a;margin:0;">Your ${settings.companyName} email notifications via Resend are configured correctly.</p>
    </div></body></html>`;
  return sendEmail(toEmail, `✅ ${settings.companyName} — Email test successful`, html, settings);
}

// ============================================================
// Internal Comments (per release)
// ============================================================

export interface ReleaseComment {
  id: string;
  releaseId: string;
  authorUsername: string;
  body: string;
  mentions: string[]; // usernames mentioned with @
  createdAt: string;
}

export async function getComments(releaseId: string): Promise<ReleaseComment[]> {
  const { data, error } = await supabase
    .from('release_comments')
    .select('*')
    .eq('release_id', releaseId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data || []).map(r => ({
    id: r.id as string,
    releaseId: r.release_id as string,
    authorUsername: r.author_username as string,
    body: r.body as string,
    mentions: (r.mentions as string[]) || [],
    createdAt: r.created_at as string,
  }));
}

export async function addComment(releaseId: string, body: string): Promise<ReleaseComment | null> {
  const session = getAdminSession();
  const mentions = [...body.matchAll(/@(\w+)/g)].map(m => m[1]);
  const { data, error } = await supabase
    .from('release_comments')
    .insert({ release_id: releaseId, author_username: session.username || 'Admin', body, mentions })
    .select()
    .single();
  if (error || !data) return null;
  return {
    id: data.id as string,
    releaseId: data.release_id as string,
    authorUsername: data.author_username as string,
    body: data.body as string,
    mentions: (data.mentions as string[]) || [],
    createdAt: data.created_at as string,
  };
}

export async function deleteComment(id: string): Promise<void> {
  await supabase.from('release_comments').delete().eq('id', id);
}

// ============================================================
// Pending Reminders (releases pending > N days)
// ============================================================

export async function getPendingReminders(days = 2): Promise<ReleaseSubmission[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const { data } = await supabase
    .from('releases')
    .select('*')
    .eq('status', 'pending')
    .lt('created_at', cutoff.toISOString())
    .order('created_at', { ascending: true });
  return (data || []).map(rowToRelease);
}

export async function getUpcomingReleaseReminders(days = 7): Promise<ReleaseSubmission[]> {
  if (days === 0) return [];
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  const { data } = await supabase
    .from('releases')
    .select('*')
    .in('status', ['approved', 'scheduled'])
    .gte('release_date', now.toISOString().split('T')[0])
    .lte('release_date', cutoff.toISOString().split('T')[0])
    .order('release_date', { ascending: true });
  return (data || []).map(rowToRelease);
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

// ============================================================
// Offline Queue — submissions made while offline are stored
// locally and synced automatically when connection restores.
// ============================================================
const OFFLINE_QUEUE_KEY = 'inlights_offline_queue';

export interface QueuedSubmission {
  queuedAt: string;
  data: Omit<ReleaseSubmission, 'id' | 'createdAt' | 'updatedAt'>;
}

export function getOfflineQueue(): QueuedSubmission[] {
  try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]'); }
  catch { return []; }
}

function saveOfflineQueue(q: QueuedSubmission[]) {
  try { localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q)); } catch {}
}

export function queueSubmissionOffline(
  data: Omit<ReleaseSubmission, 'id' | 'createdAt' | 'updatedAt'>
): void {
  const q = getOfflineQueue();
  q.push({ queuedAt: new Date().toISOString(), data });
  saveOfflineQueue(q);
}

export async function flushOfflineQueue(): Promise<number> {
  const q = getOfflineQueue();
  if (q.length === 0) return 0;
  let flushed = 0;
  const remaining: QueuedSubmission[] = [];
  for (const item of q) {
    try {
      await addSubmission(item.data);
      flushed++;
    } catch {
      remaining.push(item); // keep failed ones
    }
  }
  saveOfflineQueue(remaining);
  return flushed;
}

// ── NOTE: run these migrations in Supabase SQL Editor ──────────────────────
// ALTER TABLE settings ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;
// ALTER TABLE settings ADD COLUMN IF NOT EXISTS gmail_webhook_url TEXT;
// ALTER TABLE settings ADD COLUMN IF NOT EXISTS show_artist_email BOOLEAN DEFAULT true;
