export type ExternalMovieSource = 'tmdb';

export type ExploreCategory = 'popular' | 'top_rated' | 'classic';

export type HorrorGenreLabel =
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
  genres: HorrorGenreLabel[];
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

export interface MovieSearchParams {
  query: string;
  page: number;
  horrorOnly?: boolean;
}

export interface MovieExploreParams {
  category: ExploreCategory;
  country?: string;
  yearFilter?: string;
  genre?: HorrorGenreLabel;
  page: number;
}

export interface ProviderStatus {
  provider: ExternalMovieSource;
  configured: boolean;
  attributionText: string;
}

export interface MovieDatabaseProvider {
  readonly providerId: ExternalMovieSource;
  getStatus(): ProviderStatus;
  searchMovies(params: MovieSearchParams): Promise<PaginatedMovieResults>;
  exploreMovies(params: MovieExploreParams): Promise<PaginatedMovieResults>;
  getMovieDetail(externalId: string): Promise<{ detail: ExternalMovieDetail; cached: boolean }>;
}
