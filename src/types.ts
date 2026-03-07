export type ReleaseType = 'single' | 'ep' | 'album';
export type ReleaseStatus = 'pending' | 'approved' | 'scheduled' | 'released' | 'rejected';

export interface PlatformLinks {
  spotify?: string;
  appleMusic?: string;
  anghami?: string;
}

export interface Collaborator {
  name: string;
  role: string;
  platformLinks: PlatformLinks;
}

export interface Track {
  title: string;
  previewStart: string; // TikTok preview start time
  previewEnd: string;   // TikTok preview end time
  explicit: boolean;
  wavDriveLink: string;
  lyricsDriveLink?: string;
  lyricsGoogleDocsLink?: string;
  producedBy: string;
  lyricsBy: string;
  mixedBy: string;
  masteredBy: string;
}

export interface ReleaseSubmission {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ReleaseStatus;

  // Artist Info (Step 1)
  mainArtist: string;
  collaborations: Collaborator[];
  features: Collaborator[];

  // Release Info (Step 2)
  releaseType: ReleaseType;
  releaseTitle: string;
  releaseDate: string;
  explicitContent: boolean;
  genre: string;

  // Cover Art (Step 2)
  coverArtDriveLink: string;

  // Tracks (Step 3)
  tracks: Track[];

  // Files & Links (Step 4)
  promoDriveLink?: string;
  driveFolderLink?: string;

  // Agreement
  rightsConfirmed: boolean;

  // Admin
  labelNotes?: string;
}

export interface AdminSettings {
  companyName: string;
  companyLogo: string;
  adminUsername: string;
  adminPassword: string;
  formWelcomeText: string;
  formDescription: string;
  notificationEmail?: string;
  discordWebhook?: string;
  googleSheetsWebhook?: string;
}

export const RELEASE_TYPE_LIMITS: Record<ReleaseType, { min: number; max: number; label: string }> = {
  single: { min: 1, max: 1, label: 'Single' },
  ep: { min: 3, max: 6, label: 'EP' },
  album: { min: 7, max: 32, label: 'Album' },
};

export const GENRES = [
  'Pop', 'Hip-Hop/Rap', 'R&B/Soul', 'Electronic/Dance', 'Rock', 'Alternative',
  'Indie', 'Jazz', 'Classical', 'Country', 'Latin', 'Afrobeats', 'Reggaeton',
  'K-Pop', 'Metal', 'Punk', 'Folk', 'Blues', 'Gospel', 'Soundtrack', 'Other'
];

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  companyName: 'In Lights',
  companyLogo: 'https://i.ibb.co/1fPkzkSD/IMG-1647-1.png',
  adminUsername: 'admin',
  adminPassword: 'inlights2025',
  formWelcomeText: 'Submit Your Release',
  formDescription: 'Fill out the form below to submit your music release to In Lights.',
  notificationEmail: '',
  discordWebhook: '',
  googleSheetsWebhook: '',
};
