export type AppTab = 'home' | 'library' | 'statistics' | 'watchlist';

export type ExternalMovieSource = 'tmdb';

export type ExploreCategory = 'popular' | 'top_rated' | 'classic';

export type HorrorGenre =
  | '心理恐怖'
  | '超自然 / 鬼怪'
  | '民俗恐怖'
  | '宗教恐怖'
  | '血腥暴力'
  | '身体恐怖'
  | '邪典'
  | '丧尸'
  | '怪物'
  | '生存恐怖'
  | '伪纪录片'
  | 'Slasher'
  | '科幻恐怖';

export const HORROR_GENRES: { value: HorrorGenre; en: string }[] = [
  { value: '心理恐怖', en: 'Psychological' },
  { value: '超自然 / 鬼怪', en: 'Supernatural' },
  { value: '民俗恐怖', en: 'Folk Horror' },
  { value: '宗教恐怖', en: 'Religious' },
  { value: '血腥暴力', en: 'Gore' },
  { value: '身体恐怖', en: 'Body Horror' },
  { value: '邪典', en: 'Cult' },
  { value: '丧尸', en: 'Zombie' },
  { value: '怪物', en: 'Monster' },
  { value: '生存恐怖', en: 'Survival' },
  { value: '伪纪录片', en: 'Found Footage' },
  { value: 'Slasher', en: 'Slasher' },
  { value: '科幻恐怖', en: 'Sci-Fi Horror' },
];

export type GoreLevel = '低' | '中' | '高' | '极高';

export const GORE_LEVELS: GoreLevel[] = ['低', '中', '高', '极高'];

export type HorrorLevel = 1 | 2 | 3 | 4 | 5;

export const HORROR_LEVEL_LABELS: Record<HorrorLevel, string> = {
  1: '几乎不恐怖',
  2: '轻微恐怖',
  3: '中等恐怖',
  4: '比较恐怖',
  5: '极度恐怖',
};

export const SCARE_METER_LEVELS: {
  level: HorrorLevel;
  zh: string;
  en: string;
}[] = [
  { level: 1, zh: '几乎不恐怖', en: 'Barely Scary' },
  { level: 2, zh: '轻微恐怖', en: 'Mildly Unsettling' },
  { level: 3, zh: '中等恐怖', en: 'Moderately Frightening' },
  { level: 4, zh: '比较恐怖', en: 'Very Scary' },
  { level: 5, zh: '极度恐怖', en: 'Absolutely Terrifying' },
];

export type ScareType =
  | 'Jump Scare'
  | '心理压迫'
  | '氛围营造'
  | '生理不适'
  | '真实感 / 代入感'
  | '余韵 / 后劲';

export const SCARE_TYPES: ScareType[] = [
  'Jump Scare',
  '心理压迫',
  '氛围营造',
  '生理不适',
  '真实感 / 代入感',
  '余韵 / 后劲',
];

export type WatchMethod = '独自' | '与朋友' | '其他';

export const WATCH_METHODS: WatchMethod[] = ['独自', '与朋友', '其他'];

export interface Movie {
  movie_id: string;
  title: string;
  original_title?: string;
  poster_url?: string;
  release_date?: string;
  release_year?: number;
  director?: string;
  country?: string;
  duration?: number;
  synopsis?: string;
  genres: HorrorGenre[];
  external_source?: ExternalMovieSource;
  external_id?: string;
  external_rating?: number;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface WatchRecord {
  record_id: string;
  movie_id: string;
  watch_date?: string;
  rating?: number;
  review?: string;
  horror_level?: HorrorLevel;
  gore_level?: GoreLevel;
  scare_types: ScareType[];
  watch_method?: WatchMethod;
  watch_count: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export type WatchlistPriority = 'high' | 'medium' | 'low';

export interface WatchlistItem {
  watchlist_id: string;
  movie_id: string;
  added_at: string;
  note?: string;
  recommended_by?: string;
  planned_date?: string;
  priority?: WatchlistPriority;
  updated_at?: string;
  deleted_at?: string;
}

export interface HorrorArchiveState {
  movies: Movie[];
  watchRecords: WatchRecord[];
  watchlist: WatchlistItem[];
}

export interface CatalogFilm {
  catalog_id: string;
  title: string;
  original_title: string;
  poster_url?: string;
  release_year: number;
  director: string;
  country: string;
  duration: number;
  synopsis: string;
  genres: HorrorGenre[];
  external_source?: ExternalMovieSource;
  external_id?: string;
}

export interface ExternalMovieSummary {
  external_source: ExternalMovieSource;
  external_id: string;
  title: string;
  original_title?: string;
  poster_url?: string;
  backdrop_url?: string;
  release_date?: string;
  release_year?: number;
  synopsis?: string;
  genres: HorrorGenre[];
  external_genres?: string[];
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  original_language?: string;
  is_horror?: boolean;
}

export interface ExternalMovieDetail extends ExternalMovieSummary {
  director?: string;
  country?: string;
  duration?: number;
  tagline?: string;
}

export interface PaginatedMovieResults {
  provider: ExternalMovieSource;
  page: number;
  total_pages: number;
  total_results: number;
  cached?: boolean;
  results: ExternalMovieSummary[];
}

export interface MovieDatabaseStatus {
  provider: ExternalMovieSource;
  configured: boolean;
  attributionText: string;
}

export interface CachedMovieMetadata extends ExternalMovieDetail {
  cache_id: string;
  cached_at: string;
  expires_at: number;
}

export type WatchStatus = 'watched' | 'watchlist';

export interface MovieFormPayload {
  movie_id?: string;
  title: string;
  original_title?: string;
  poster_url?: string;
  release_date?: string;
  release_year?: number;
  director?: string;
  country?: string;
  duration?: number;
  synopsis?: string;
  genres: HorrorGenre[];
  external_source?: ExternalMovieSource;
  external_id?: string;
  external_rating?: number;
  status: WatchStatus;
  watch_date?: string;
  rating?: number;
  review?: string;
  horror_level?: HorrorLevel;
  gore_level?: GoreLevel;
  scare_types: ScareType[];
  watch_method?: WatchMethod;
  watch_count: number;
  note?: string;
  recommended_by?: string;
  planned_date?: string;
  priority?: WatchlistPriority;
}

export interface AudienceReview {
  id: string;
  author: string;
  stars: 1 | 2 | 3 | 4 | 5;
  content: string;
  date: string;
}

export type SyncStatusState =
  | 'local_only'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'offline';

export interface UserSettings {
  display_name?: string;
  default_watch_method?: WatchMethod;
}

export interface SyncTombstone {
  entity: 'movie' | 'watchRecord' | 'watchlist';
  id: string;
  deleted_at: string;
}

export interface SyncOutboxItem {
  key: string;
  entity: 'movie' | 'watchRecord' | 'watchlist' | 'profile';
  id: string;
  op: 'upsert' | 'delete';
  queued_at: string;
}

export interface LocalStoreV2 {
  version: 2;
  archive: HorrorArchiveState;
  tombstones: SyncTombstone[];
  outbox: SyncOutboxItem[];
  settings: UserSettings;
  isGuestDirty: boolean;
  lastSyncedAt: string | null;
  lastSyncedUid: string | null;
}

export type MigrationResolution = 'merge' | 'prefer_cloud' | 'prefer_local';

export interface CloudSnapshotData {
  profile: UserSettings | null;
  movies: Movie[];
  watchRecords: WatchRecord[];
  watchlist: WatchlistItem[];
}

