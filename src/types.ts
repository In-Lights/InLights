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
  previewStart: string;
  previewEnd: string;
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
  mainArtist: string;
  collaborations: Collaborator[];
  features: Collaborator[];
  releaseType: ReleaseType;
  releaseTitle: string;
  releaseDate: string;
  explicitContent: boolean;
  genre: string;
  coverArtDriveLink: string;
  tracks: Track[];
  promoDriveLink?: string;
  driveFolderLink?: string;
  rightsConfirmed: boolean;
  labelNotes?: string;
}

export interface AdminSettings {
  // Branding
  companyName: string;
  companyLogo: string;
  accentColor: string;

  // Auth
  adminUsername: string;
  adminPassword: string;

  // Form — text
  formWelcomeText: string;
  formDescription: string;
  submissionSuccessMessage: string;
  rightsAgreementText: string;

  // Form — rules
  requireDriveFolder: boolean;
  requirePromoMaterials: boolean;
  requireLyrics: boolean;
  minReleaseDaysNotice: number;
  maxTracksAlbum: number;
  allowedReleaseTypes: string; // comma-separated: "single,ep,album"

  // Genres
  customGenres: string; // newline-separated extra genres to add

  // Status labels
  statusLabelPending: string;
  statusLabelApproved: string;
  statusLabelScheduled: string;
  statusLabelReleased: string;
  statusLabelRejected: string;

  // Integrations
  notificationEmail: string;
  discordWebhook: string;
  googleSheetsWebhook: string;

  // Advanced / Creative
  submissionCooldownHours: number;   // How many hours between submissions per artist name
  maintenanceMode: boolean;           // Temporarily disable form submissions
  maintenanceModeMessage: string;     // Message shown when form is in maintenance
  requireCoverArtSpecs: boolean;      // Show cover art specs checklist before upload
  autoApproveAfterDays: number;       // 0 = never auto-approve
  formAccentButtonLabel: string;      // Custom label for next/continue buttons

  // Google Drive Picker
  drivePickerEnabled: boolean;        // Master toggle for the Drive Picker UI
  googleApiClientId: string;          // OAuth 2.0 Client ID (from Google Cloud Console)
  googleApiKey: string;               // Restricted API key (Drive + Picker APIs)
  driveUploadFolderId: string;        // Folder ID where artist uploads land
}

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  companyName: 'In Lights',
  companyLogo: 'https://i.ibb.co/1fPkzkSD/IMG-1647-1.png',
  accentColor: '#7c3aed',
  adminUsername: 'admin',
  adminPassword: 'inlights2025',
  formWelcomeText: 'Submit Your Release',
  formDescription: 'Fill out the form below to submit your music release to In Lights.',
  submissionSuccessMessage: 'Your submission has been received and is under review.',
  rightsAgreementText: 'I confirm all information is accurate and I own the rights to submit this release. I understand that submitting false or unauthorized content may result in removal and legal action.',
  requireDriveFolder: false,
  requirePromoMaterials: false,
  requireLyrics: false,
  minReleaseDaysNotice: 7,
  maxTracksAlbum: 32,
  allowedReleaseTypes: 'single,ep,album',
  customGenres: '',
  statusLabelPending: 'Pending',
  statusLabelApproved: 'Approved',
  statusLabelScheduled: 'Scheduled',
  statusLabelReleased: 'Released',
  statusLabelRejected: 'Rejected',
  notificationEmail: '',
  discordWebhook: '',
  googleSheetsWebhook: '',
  submissionCooldownHours: 0,
  maintenanceMode: false,
  maintenanceModeMessage: 'The submission portal is temporarily unavailable. Please check back soon.',
  requireCoverArtSpecs: false,
  autoApproveAfterDays: 0,
  formAccentButtonLabel: 'Continue',
  drivePickerEnabled: false,
  googleApiClientId: '',
  googleApiKey: '',
  driveUploadFolderId: '',
};

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


// ── Drive Picker integration ─────────────────────────────────
// Added to AdminSettings:
// googleApiClientId   — OAuth 2.0 Client ID from Google Cloud Console
// googleApiKey        — Restricted API key (Drive + Picker APIs enabled)
// driveUploadFolderId — Folder ID where uploaded files land (so the label owns them)
// drivePickerEnabled  — master toggle; if false, only manual links shown
