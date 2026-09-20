export interface SearchResult {
    anilistId: number;
    titleEnglish: string | null;
    titleRomanji: string | null;
    titleNative: string | null;
    format?: string | null;
    season?: string | null;
    seasonYear?: number | null;
    thumbnailUrl?: string | null;
    isBookmarked?: boolean;
}
