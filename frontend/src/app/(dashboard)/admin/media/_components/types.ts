interface MediaItem {
  filename: string;
  category: string;
  url: string;
  sizeBytes: number;
  formattedSize: string;
  mimeType: string;
  createdAt: string;
  modifiedAt: string;
  anilistId?: number | null;
  malId?: number | null;
  titleEnglish?: string | null;
  titleRomaji?: string | null;
  plexTitles?: string[];
  usageCount?: number;
  isOrphan?: boolean;
}

export type { MediaItem };
