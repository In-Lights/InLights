// ═══════════════════════════════════════════
// In Lights — Types, Store & Utilities
// ═══════════════════════════════════════════

export interface Collaborator {
  id: string;
  name: string;
  spotifyUrl: string;
  appleMusicUrl: string;
  anghamiUrl: string;
}

export interface TrackData {
  id: string;
  title: string;
  previewTime: string;
  explicit: boolean;
  producedBy: string;
  lyricsBy: string;
  mixedBy: string;
  masteredBy: string;
  wavFileName: string;
  lyricsDocLink: string;
}

export type ReleaseType = 'single' | 'ep' | 'album';
export type ReleaseStatus = 'pending' | 'approved' | 'scheduled' | 'released';

export interface Release {
  id: string;
  artistName: string;
  collaborations: Collaborator[];
  features: Collaborator[];
  coverArtFileName: string;
  coverArtPreview?: string;
  releaseType: ReleaseType;
  releaseTitle: string;
  releaseDate: string;
  tracks: TrackData[];
  promoFolderLink: string;
  fullDriveFolderLink: string;
  agreement: boolean;
  status: ReleaseStatus;
  createdAt: string;
  driveFolderLink: string;
}

export interface FormState {
  artistName: string;
  collaborations: Collaborator[];
  features: Collaborator[];
  coverArtFileName: string;
  coverArtPreview: string;
  fullDriveFolderLink: string;
  releaseType: ReleaseType | '';
  releaseTitle: string;
  releaseDate: string;
  tracks: TrackData[];
  promoFolderLink: string;
  agreement: boolean;
}

export interface Settings {
  companyName: string;
  logoUrl: string;
  discordWebhookUrl: string;
  adminEmail: string;
  googleSheetId: string;
}

// ─── Keys ──────────────────────────────────
const RELEASES_KEY = 'inlights_releases';
const SETTINGS_KEY = 'inlights_settings';
const AUTH_KEY = 'inlights_auth';
const SEEDED_KEY = 'inlights_seeded';

// ─── Utilities ─────────────────────────────
export const generateId = (): string =>
  Math.random().toString(36).substring(2, 8) + Date.now().toString(36);

export function isValidUrl(str: string): boolean {
  if (!str || !str.trim()) return true;
  try { new URL(str); return true; } catch { return false; }
}

export function createTrack(): TrackData {
  return {
    id: generateId(),
    title: '',
    previewTime: '',
    explicit: false,
    producedBy: '',
    lyricsBy: '',
    mixedBy: '',
    masteredBy: '',
    wavFileName: '',
    lyricsDocLink: '',
  };
}

export function createCollaborator(): Collaborator {
  return { id: generateId(), name: '', spotifyUrl: '', appleMusicUrl: '', anghamiUrl: '' };
}

export const initialFormState: FormState = {
  artistName: '',
  collaborations: [],
  features: [],
  coverArtFileName: '',
  coverArtPreview: '',
  fullDriveFolderLink: '',
  releaseType: '',
  releaseTitle: '',
  releaseDate: '',
  tracks: [],
  promoFolderLink: '',
  agreement: false,
};

export function getTrackLimits(type: ReleaseType | ''): { min: number; max: number } {
  switch (type) {
    case 'single': return { min: 1, max: 1 };
    case 'ep': return { min: 3, max: 6 };
    case 'album': return { min: 1, max: 32 };
    default: return { min: 0, max: 0 };
  }
}

// ─── Store: Releases ───────────────────────
export function getReleases(): Release[] {
  try {
    if (!localStorage.getItem(SEEDED_KEY)) {
      seedDemoData();
      localStorage.setItem(SEEDED_KEY, '1');
    }
    const data = localStorage.getItem(RELEASES_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

export function saveRelease(release: Release): void {
  const releases = getReleases();
  releases.unshift(release);
  localStorage.setItem(RELEASES_KEY, JSON.stringify(releases));
}

export function updateRelease(id: string, updates: Partial<Release>): void {
  const releases = getReleases();
  const idx = releases.findIndex(r => r.id === id);
  if (idx !== -1) {
    releases[idx] = { ...releases[idx], ...updates };
    localStorage.setItem(RELEASES_KEY, JSON.stringify(releases));
  }
}

export function deleteReleaseById(id: string): void {
  const releases = getReleases().filter(r => r.id !== id);
  localStorage.setItem(RELEASES_KEY, JSON.stringify(releases));
}

// ─── Store: Settings ───────────────────────
const defaultSettings = (): Settings => ({
  companyName: 'In Lights',
  logoUrl: '',
  discordWebhookUrl: '',
  adminEmail: '',
  googleSheetId: '',
});

export function getSettings(): Settings {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? { ...defaultSettings(), ...JSON.parse(data) } : defaultSettings();
  } catch { return defaultSettings(); }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ─── Store: Auth ───────────────────────────
export function isAuthenticated(): boolean {
  return localStorage.getItem(AUTH_KEY) === 'authenticated';
}

export function login(email: string, password: string): boolean {
  if (email === 'admin@inlights.com' && password === 'admin123') {
    localStorage.setItem(AUTH_KEY, 'authenticated');
    return true;
  }
  return false;
}

export function logout(): void {
  localStorage.removeItem(AUTH_KEY);
}

// ─── CSV Export ────────────────────────────
export function exportToCSV(releases: Release[]): void {
  const headers = [
    'Submission ID', 'Artist Name', 'Release Type', 'Release Title',
    'Release Date', 'Status', 'Drive Folder Link', 'Track Count', 'Submitted At'
  ];
  const rows = releases.map(r => [
    r.id, r.artistName, r.releaseType, r.releaseTitle, r.releaseDate,
    r.status, r.driveFolderLink || r.fullDriveFolderLink || '',
    String(r.tracks.length), new Date(r.createdAt).toLocaleString(),
  ]);
  const csv = [
    headers.join(','),
    ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `in-lights-releases-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Status Helpers (PURPLE THEMED) ────────
export const statusColors: Record<ReleaseStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  approved: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  scheduled: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  released: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20',
};

export const statusLabels: Record<ReleaseStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  scheduled: 'Scheduled',
  released: 'Released',
};

export const releaseTypeLabels: Record<ReleaseType, string> = {
  single: 'Single',
  ep: 'EP',
  album: 'Album',
};

// ─── Demo Data ─────────────────────────────
function seedDemoData(): void {
  const mkTrack = (title: string, explicit: boolean = false): TrackData => ({
    id: generateId(), title, previewTime: '0:15 – 0:30', explicit,
    producedBy: 'Studio X', lyricsBy: 'Artist', mixedBy: 'Mix Engineer',
    masteredBy: 'Master Labs', wavFileName: `${title.toLowerCase().replace(/\s+/g, '-')}.wav`,
    lyricsDocLink: '',
  });

  const demos: Release[] = [
    {
      id: 'rl_001', artistName: 'Luna Veil', collaborations: [],
      features: [{ id: 'f1', name: 'Kai Storm', spotifyUrl: 'https://open.spotify.com/artist/example', appleMusicUrl: '', anghamiUrl: '' }],
      coverArtFileName: 'midnight-echoes-cover.jpg', releaseType: 'single',
      releaseTitle: 'Midnight Echoes', releaseDate: '2025-02-15',
      tracks: [mkTrack('Midnight Echoes')],
      promoFolderLink: '', fullDriveFolderLink: 'https://drive.google.com/drive/folders/example1',
      agreement: true, status: 'approved', createdAt: '2025-01-20T10:30:00Z',
      driveFolderLink: 'https://drive.google.com/drive/folders/example1',
    },
    {
      id: 'rl_002', artistName: 'Neon Atlas',
      collaborations: [{ id: 'c1', name: 'Zara Night', spotifyUrl: 'https://open.spotify.com/artist/example2', appleMusicUrl: '', anghamiUrl: '' }],
      features: [], coverArtFileName: 'electric-dreams-cover.jpg', releaseType: 'ep',
      releaseTitle: 'Electric Dreams', releaseDate: '2025-03-01',
      tracks: [mkTrack('Voltage'), mkTrack('Circuitry', true), mkTrack('Afterglow'), mkTrack('Pulse')],
      promoFolderLink: 'https://drive.google.com/drive/folders/promo1',
      fullDriveFolderLink: '', agreement: true, status: 'pending',
      createdAt: '2025-01-25T14:15:00Z', driveFolderLink: '',
    },
    {
      id: 'rl_003', artistName: 'Ivory Keys', collaborations: [], features: [],
      coverArtFileName: 'silence-speaks-cover.jpg', releaseType: 'single',
      releaseTitle: 'Silence Speaks', releaseDate: '2025-01-10',
      tracks: [mkTrack('Silence Speaks')],
      promoFolderLink: '', fullDriveFolderLink: 'https://drive.google.com/drive/folders/example3',
      agreement: true, status: 'released', createdAt: '2024-12-20T09:00:00Z',
      driveFolderLink: 'https://drive.google.com/drive/folders/example3',
    },
    {
      id: 'rl_004', artistName: 'Shadow Collective', collaborations: [],
      features: [{ id: 'f2', name: 'Maya Chen', spotifyUrl: '', appleMusicUrl: 'https://music.apple.com/artist/example', anghamiUrl: '' }],
      coverArtFileName: 'after-dark-cover.jpg', releaseType: 'album',
      releaseTitle: 'After Dark', releaseDate: '2025-04-15',
      tracks: Array.from({ length: 10 }, (_, i) => mkTrack(`Chapter ${i + 1}`, i % 4 === 0)),
      promoFolderLink: '', fullDriveFolderLink: 'https://drive.google.com/drive/folders/example4',
      agreement: true, status: 'scheduled', createdAt: '2025-01-28T16:45:00Z',
      driveFolderLink: 'https://drive.google.com/drive/folders/example4',
    },
    {
      id: 'rl_005', artistName: 'Velvet Dusk', collaborations: [], features: [],
      coverArtFileName: 'golden-hour-cover.jpg', releaseType: 'single',
      releaseTitle: 'Golden Hour', releaseDate: '2025-05-01',
      tracks: [mkTrack('Golden Hour')],
      promoFolderLink: '', fullDriveFolderLink: '',
      agreement: true, status: 'pending', createdAt: '2025-02-01T08:20:00Z',
      driveFolderLink: '',
    },
  ];
  localStorage.setItem(RELEASES_KEY, JSON.stringify(demos));
}
