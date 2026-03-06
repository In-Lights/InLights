export type ReleaseType = 'single' | 'ep' | 'album';
export type ReleaseStatus = 'pending' | 'approved' | 'scheduled' | 'released' | 'rejected';

export interface PlatformLinks {
  spotify: string;
  appleMusic: string;
  anghami: string;
}

export interface Collaborator {
  name: string;
  platforms: PlatformLinks;
}

export interface TrackCredits {
  producedBy: string;
  lyricsBy: string;
  mixedBy: string;
  masteredBy: string;
}

export interface Track {
  title: string;
  explicit: boolean;
  tiktokPreview: string;
  wavDriveLink: string;
  lyricsDocsLink: string;
  credits: TrackCredits;
}

export interface ReleaseSubmission {
  id: string;
  status: ReleaseStatus;
  submittedAt: string;
  mainArtist: string;
  collaborations: Collaborator[];
  features: Collaborator[];
  releaseType: ReleaseType;
  releaseTitle: string;
  releaseDate: string;
  genre: string;
  explicit: boolean;
  coverArtDriveLink: string;
  tracks: Track[];
  promoDriveLink: string;
  driveFolderLink: string;
  useAllInOneDrive: boolean;
  agreement: boolean;
  labelNotes: string;
}

export interface AdminSettings {
  companyName: string;
  companyLogo: string;
  welcomeText: string;
  welcomeDescription: string;
  adminUsername: string;
  adminPassword: string;
  discordWebhookUrl: string;
  googleSheetsWebhook: string;
}
