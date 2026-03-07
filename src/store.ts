import { createClient } from '@supabase/supabase-js';
import { ReleaseSubmission, AdminSettings, DEFAULT_ADMIN_SETTINGS } from './types';

// ============================================================
// Supabase Client
// ============================================================
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
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
  const prefix = `IL-${year}-${month}`;

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
    adminUsername: data.admin_username ?? DEFAULT_ADMIN_SETTINGS.adminUsername,
    adminPassword: data.admin_password ?? DEFAULT_ADMIN_SETTINGS.adminPassword,
    formWelcomeText: data.form_welcome_text ?? DEFAULT_ADMIN_SETTINGS.formWelcomeText,
    formDescription: data.form_description ?? DEFAULT_ADMIN_SETTINGS.formDescription,
    notificationEmail: data.notification_email ?? '',
    discordWebhook: data.discord_webhook ?? '',
    googleSheetsWebhook: data.google_sheets_webhook ?? '',
  };
}

export async function saveAdminSettings(settings: AdminSettings): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .update({
      company_name: settings.companyName,
      company_logo: settings.companyLogo,
      admin_username: settings.adminUsername,
      admin_password: settings.adminPassword,
      form_welcome_text: settings.formWelcomeText,
      form_description: settings.formDescription,
      notification_email: settings.notificationEmail ?? null,
      discord_webhook: settings.discordWebhook ?? null,
      google_sheets_webhook: settings.googleSheetsWebhook ?? null,
    })
    .eq('settings_id', 1);

  if (error) throw new Error(error.message);

  if (settings.googleSheetsWebhook) {
    pushSettingsToSheet(settings);
  }
}

// Public branding — anyone can read (RLS: public SELECT on settings)
export async function fetchPublicBranding(): Promise<{
  companyName: string;
  companyLogo: string;
  formWelcomeText: string;
  formDescription: string;
} | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('company_name, company_logo, form_welcome_text, form_description')
    .eq('settings_id', 1)
    .single();

  if (error || !data) return null;

  return {
    companyName: data.company_name ?? DEFAULT_ADMIN_SETTINGS.companyName,
    companyLogo: data.company_logo ?? DEFAULT_ADMIN_SETTINGS.companyLogo,
    formWelcomeText: data.form_welcome_text ?? DEFAULT_ADMIN_SETTINGS.formWelcomeText,
    formDescription: data.form_description ?? DEFAULT_ADMIN_SETTINGS.formDescription,
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
    tracks: (row.tracks as ReleaseSubmission['tracks']) ?? [],
    promoDriveLink: (row.promo_drive_link as string) ?? undefined,
    driveFolderLink: (row.drive_folder_link as string) ?? undefined,
    rightsConfirmed: row.rights_confirmed as boolean,
    labelNotes: (row.label_notes as string) ?? undefined,
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
  if (release.tracks !== undefined) row.tracks = release.tracks;
  if (release.promoDriveLink !== undefined) row.promo_drive_link = release.promoDriveLink;
  if (release.driveFolderLink !== undefined) row.drive_folder_link = release.driveFolderLink;
  if (release.rightsConfirmed !== undefined) row.rights_confirmed = release.rightsConfirmed;
  if (release.labelNotes !== undefined) row.label_notes = release.labelNotes;
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
// Auth — in-memory session (no localStorage)
// ============================================================
let _adminSession: { loggedIn: boolean; expiry: number } = { loggedIn: false, expiry: 0 };

export async function loginAdmin(username: string, password: string): Promise<boolean> {
  const settings = await getAdminSettings();
  return username === settings.adminUsername && password === settings.adminPassword;
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
