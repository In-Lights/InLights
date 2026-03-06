import { ReleaseSubmission, AdminSettings } from './types';

const SETTINGS_KEY = 'inlights_admin_settings';
const AUTH_KEY = 'inlights_admin_auth';
const RELEASES_KEY = 'inlights_releases';

export const GENRES = [
  'Pop', 'Hip-Hop/Rap', 'R&B/Soul', 'Electronic/Dance', 'Rock',
  'Alternative', 'Country', 'Jazz', 'Classical', 'Latin',
  'Reggaeton', 'Afrobeat', 'K-Pop', 'Metal', 'Folk',
  'Indie', 'Blues', 'Punk', 'Funk', 'Gospel', 'Other'
];

export const RELEASE_TYPE_LIMITS = {
  single: { min: 1, max: 1 },
  ep: { min: 3, max: 6 },
  album: { min: 7, max: 32 }
};

export const DEFAULT_SETTINGS: AdminSettings = {
  companyName: 'In Lights',
  companyLogo: 'https://i.ibb.co/1fPkzkSD/IMG-1647-1.png',
  welcomeText: 'Submit Your Release',
  welcomeDescription: 'Fill out the form below to submit your music release for review.',
  adminUsername: 'admin',
  adminPassword: 'inlights2025',
  discordWebhookUrl: '',
  googleSheetsWebhook: ''
};

// ========== ADMIN SETTINGS (localStorage — admin browser only) ==========

export function getAdminSettings(): AdminSettings {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (stored) {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  }
  return DEFAULT_SETTINGS;
}

export function saveAdminSettings(settings: AdminSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  if (settings.googleSheetsWebhook) {
    pushSettingsToSheet(settings);
  }
}

// ========== AUTH ==========

export function isAdminLoggedIn(): boolean {
  return sessionStorage.getItem(AUTH_KEY) === 'true';
}

export function loginAdmin(username: string, password: string): boolean {
  const settings = getAdminSettings();
  if (username === settings.adminUsername && password === settings.adminPassword) {
    sessionStorage.setItem(AUTH_KEY, 'true');
    return true;
  }
  return false;
}

export function logoutAdmin(): void {
  sessionStorage.removeItem(AUTH_KEY);
}

// ========== RELEASE ID GENERATION ==========

function generateReleaseId(existingIds: string[]): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `IL-${year}-${month}`;
  
  const thisMonthCount = existingIds.filter(id => id.startsWith(prefix)).length;
  const num = String(thisMonthCount + 1).padStart(3, '0');
  
  return `${prefix}-${num}`;
}

// ========== GOOGLE SHEETS API ==========

// Helper: POST to Google Apps Script
// Google Apps Script redirects POST requests (302), so we need redirect: 'follow'
// and use 'text/plain' content type to avoid CORS preflight
async function postToSheet(url: string, data: Record<string, unknown>): Promise<boolean> {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data),
      redirect: 'follow'
    });
    return true;
  } catch (e) {
    console.error('Google Sheets POST failed:', e);
    return false;
  }
}

// Helper: GET from Google Apps Script
async function getFromSheet<T>(url: string, params: Record<string, string>): Promise<T | null> {
  try {
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = `${url}?${queryString}`;
    const response = await fetch(fullUrl, { redirect: 'follow' });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch (e) {
    console.error('Google Sheets GET failed:', e);
    return null;
  }
}

// ========== PUBLIC BRANDING (fetched from Google Sheets for ALL visitors) ==========

export async function fetchPublicBranding(): Promise<{
  companyName: string;
  companyLogo: string;
  welcomeText: string;
  welcomeDescription: string;
} | null> {
  // Try to get the webhook URL from localStorage (admin browser) or from URL params
  const settings = getAdminSettings();
  const webhookUrl = settings.googleSheetsWebhook;
  if (!webhookUrl) return null;

  return getFromSheet(webhookUrl, { action: 'getSettings' });
}

// For public visitors who don't have admin settings in their localStorage,
// we need a way to know the Google Sheets URL. We'll store it as a simple
// config that gets embedded. For now, we try localStorage first.
export async function fetchPublicBrandingWithUrl(webhookUrl: string): Promise<{
  companyName: string;
  companyLogo: string;
  welcomeText: string;
  welcomeDescription: string;
} | null> {
  if (!webhookUrl) return null;
  return getFromSheet(webhookUrl, { action: 'getSettings' });
}

// Push branding settings to Google Sheets
async function pushSettingsToSheet(settings: AdminSettings): Promise<void> {
  if (!settings.googleSheetsWebhook) return;
  await postToSheet(settings.googleSheetsWebhook, {
    action: 'saveSettings',
    companyName: settings.companyName,
    companyLogo: settings.companyLogo,
    welcomeText: settings.welcomeText,
    welcomeDescription: settings.welcomeDescription
  });
}

// ========== RELEASES — THE GLOBAL DATABASE ==========

// Fetch ALL releases from Google Sheets (the single source of truth)
export async function fetchReleasesFromSheet(): Promise<ReleaseSubmission[]> {
  const settings = getAdminSettings();
  if (!settings.googleSheetsWebhook) return [];

  const data = await getFromSheet<{ releases: ReleaseSubmission[] }>(
    settings.googleSheetsWebhook,
    { action: 'getReleases' }
  );
  
  if (data && data.releases && data.releases.length > 0) {
    // Cache in localStorage as backup
    localStorage.setItem(RELEASES_KEY, JSON.stringify(data.releases));
    return data.releases;
  }
  return [];
}

// Get all releases — Google Sheets first, localStorage fallback
export async function getAllReleases(): Promise<ReleaseSubmission[]> {
  const settings = getAdminSettings();
  
  // If Google Sheets is configured, use it as the primary database
  if (settings.googleSheetsWebhook) {
    const sheetReleases = await fetchReleasesFromSheet();
    if (sheetReleases.length > 0) return sheetReleases;
  }
  
  // Fallback to localStorage
  return getLocalReleases();
}

// Submit a new release
export async function submitRelease(
  release: Omit<ReleaseSubmission, 'id' | 'status' | 'submittedAt' | 'labelNotes'>
): Promise<{ success: boolean; id: string }> {
  const settings = getAdminSettings();

  // Get existing IDs from both sources to avoid duplicates
  const existingReleases = await getAllReleases();
  const existingIds = existingReleases.map(r => r.id);
  const id = generateReleaseId(existingIds);

  const fullRelease: ReleaseSubmission = {
    ...release,
    id,
    status: 'pending',
    submittedAt: new Date().toISOString(),
    labelNotes: ''
  };

  // Always save to localStorage as immediate backup
  saveReleaseLocally(fullRelease);

  // Save to Google Sheets (the global database)
  if (settings.googleSheetsWebhook) {
    await postToSheet(settings.googleSheetsWebhook, {
      action: 'saveRelease',
      release: fullRelease
    });
  }

  // Send Discord notification
  if (settings.discordWebhookUrl) {
    sendDiscordNotification(fullRelease, settings);
  }

  return { success: true, id };
}

// Update a release (admin edit)
export async function updateRelease(id: string, updates: Partial<ReleaseSubmission>): Promise<boolean> {
  const settings = getAdminSettings();

  // Always update localStorage
  updateReleaseLocally(id, updates);

  // Update in Google Sheets
  if (settings.googleSheetsWebhook) {
    await postToSheet(settings.googleSheetsWebhook, {
      action: 'updateRelease',
      id,
      updates
    });
  }

  return true;
}

// ========== LOCAL STORAGE (backup / fallback) ==========

function saveReleaseLocally(release: ReleaseSubmission): void {
  const releases = getLocalReleases();
  releases.push(release);
  localStorage.setItem(RELEASES_KEY, JSON.stringify(releases));
}

function updateReleaseLocally(id: string, updates: Partial<ReleaseSubmission>): void {
  const releases = getLocalReleases();
  const idx = releases.findIndex(r => r.id === id);
  if (idx >= 0) {
    releases[idx] = { ...releases[idx], ...updates };
    localStorage.setItem(RELEASES_KEY, JSON.stringify(releases));
  }
}

export function getLocalReleases(): ReleaseSubmission[] {
  const stored = localStorage.getItem(RELEASES_KEY);
  return stored ? JSON.parse(stored) : [];
}

// ========== DISCORD NOTIFICATIONS ==========

async function sendDiscordNotification(release: ReleaseSubmission, settings: AdminSettings): Promise<void> {
  if (!settings.discordWebhookUrl) return;

  const trackList = release.tracks
    .map((t, i) => `${i + 1}. ${t.title}${t.explicit ? ' 🔞' : ''}`)
    .join('\n');

  const fields = [
    { name: '🎤 Artist', value: release.mainArtist, inline: true },
    { name: '📀 Type', value: release.releaseType.toUpperCase(), inline: true },
    { name: '🆔 ID', value: release.id, inline: true },
    { name: '📅 Release Date', value: release.releaseDate || 'TBD', inline: true },
    { name: '🎭 Genre', value: release.genre || 'N/A', inline: true },
    { name: '🔞 Explicit', value: release.explicit ? 'Yes' : 'No', inline: true },
    { name: '🎵 Tracklist', value: trackList || 'N/A', inline: false },
  ];

  if (release.coverArtDriveLink) {
    fields.push({ name: '🖼️ Cover Art', value: release.coverArtDriveLink, inline: false });
  }
  if (release.driveFolderLink) {
    fields.push({ name: '📁 Drive Folder', value: release.driveFolderLink, inline: false });
  }
  if (release.collaborations.length > 0) {
    fields.push({ name: '🤝 Collaborations', value: release.collaborations.map(c => c.name).join(', '), inline: false });
  }
  if (release.features.length > 0) {
    fields.push({ name: '✨ Features', value: release.features.map(f => f.name).join(', '), inline: false });
  }

  try {
    await fetch(settings.discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: settings.companyName || 'In Lights',
        avatar_url: settings.companyLogo,
        embeds: [{
          title: `🎵 New Release Submission: ${release.releaseTitle}`,
          color: 0x9333ea,
          fields,
          thumbnail: settings.companyLogo ? { url: settings.companyLogo } : undefined,
          footer: { text: `${settings.companyName} Release System` },
          timestamp: new Date().toISOString()
        }]
      })
    });
  } catch (e) {
    console.error('Discord notification failed:', e);
  }
}

// Send test Discord message
export async function sendTestDiscord(webhookUrl: string): Promise<boolean> {
  try {
    const settings = getAdminSettings();
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: settings.companyName || 'In Lights',
        avatar_url: settings.companyLogo,
        embeds: [{
          title: '✅ Test Notification',
          description: 'Your Discord webhook is working correctly! Release notifications will appear here.',
          color: 0x22c55e,
          footer: { text: `${settings.companyName} Release System` },
          timestamp: new Date().toISOString()
        }]
      })
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ========== CSV EXPORT ==========

export function exportReleasesToCSV(releases: ReleaseSubmission[]): void {
  const headers = ['ID', 'Status', 'Submitted', 'Artist', 'Title', 'Type', 'Genre', 'Release Date', 'Explicit', 'Tracks', 'Cover Art', 'Drive Folder', 'Promo Link', 'Label Notes'];
  const rows = releases.map(r => [
    r.id, r.status, r.submittedAt, r.mainArtist, r.releaseTitle,
    r.releaseType, r.genre, r.releaseDate, r.explicit ? 'Yes' : 'No',
    r.tracks.map(t => t.title).join(' | '),
    r.coverArtDriveLink, r.driveFolderLink, r.promoDriveLink, r.labelNotes
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `releases-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
