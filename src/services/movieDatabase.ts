import {
  CachedMovieMetadata,
  ExploreCategory,
  ExternalMovieDetail,
  ExternalMovieSource,
  ExternalMovieSummary,
  HorrorGenre,
  Movie,
  MovieDatabaseStatus,
  PaginatedMovieResults,
} from '../types/horror';
import {
  readCloudMovieMetadataCache,
  writeCloudMovieMetadataCache,
} from './cloudSync';

const METADATA_STORAGE_KEY = 'horror_diary_movie_metadata_v2';
const METADATA_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LIST_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_LOCAL_METADATA_ENTRIES = 300;

interface ListCacheEntry {
  value: PaginatedMovieResults;
  expiresAt: number;
}

const sessionListCache = new Map<string, ListCacheEntry>();

export class MovieDatabaseClientError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 500) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

function makeCacheId(source: ExternalMovieSource, externalId: string): string {
  return `${source}_${externalId}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function loadLocalMovieMetadataTable(): Record<string, CachedMovieMetadata> {
  try {
    const raw = localStorage.getItem(METADATA_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CachedMovieMetadata>;
    if (!parsed || typeof parsed !== 'object') return {};

    const now = Date.now();
    const cleaned: Record<string, CachedMovieMetadata> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v === 'object' && typeof v.expires_at === 'number' && v.expires_at > now) {
        cleaned[k] = v;
      }
    }
    return cleaned;
  } catch {
    return {};
  }
}

function saveLocalMovieMetadataEntry(detail: ExternalMovieDetail): CachedMovieMetadata {
  const cacheId = makeCacheId(detail.external_source, detail.external_id);
  const nowIso = new Date().toISOString();
  const entry: CachedMovieMetadata = {
    ...detail,
    cache_id: cacheId,
    cached_at: nowIso,
    expires_at: Date.now() + METADATA_TTL_MS,
  };

  try {
    const table = loadLocalMovieMetadataTable();
    table[cacheId] = entry;

    const entries = Object.entries(table);
    if (entries.length > MAX_LOCAL_METADATA_ENTRIES) {
      entries
        .sort((a, b) => a[1].cached_at.localeCompare(b[1].cached_at))
        .slice(0, entries.length - MAX_LOCAL_METADATA_ENTRIES)
        .forEach(([oldKey]) => {
          delete table[oldKey];
        });
    }

    localStorage.setItem(METADATA_STORAGE_KEY, JSON.stringify(table));
  } catch {
    // Ignore localStorage quota failures gracefully
  }

  return entry;
}

export function getLocalCachedMovieMetadata(
  source: ExternalMovieSource,
  externalId: string
): CachedMovieMetadata | null {
  const cacheId = makeCacheId(source, externalId);
  const table = loadLocalMovieMetadataTable();
  const hit = table[cacheId];
  if (!hit || Date.now() > hit.expires_at) return null;
  return hit;
}

async function fetchJson<T>(url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new MovieDatabaseClientError(
      'NETWORK_ERROR',
      '网络连接异常，无法请求电影数据库服务。',
      0
    );
  }

  let data: Record<string, unknown> | null = null;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new MovieDatabaseClientError(
      'INVALID_RESPONSE',
      '电影数据库返回格式异常，请稍后重试。',
      response.status
    );
  }

  if (!response.ok || data?.ok === false) {
    const code =
      typeof data?.code === 'string' ? data.code : `HTTP_${response.status}`;
    const message =
      typeof data?.message === 'string'
        ? data.message
        : '电影数据库请求失败，请稍后重试。';
    throw new MovieDatabaseClientError(code, message, response.status);
  }

  return data as unknown as T;
}

export async function fetchMovieDatabaseStatus(): Promise<MovieDatabaseStatus> {
  try {
    const res = await fetchJson<MovieDatabaseStatus & { ok: boolean }>(
      '/api/movies/status'
    );
    return {
      provider: res.provider || 'tmdb',
      configured: Boolean(res.configured),
      attributionText:
        res.attributionText ||
        '本功能使用 TMDB 官方 API 提供电影检索与资料数据（This product uses the TMDB API but is not endorsed or certified by TMDB.）',
    };
  } catch {
    return {
      provider: 'tmdb',
      configured: false,
      attributionText:
        '本功能使用 TMDB 官方 API 提供电影检索与资料数据（This product uses the TMDB API but is not endorsed or certified by TMDB.）',
    };
  }
}

export async function searchExternalMovies(params: {
  query: string;
  page?: number;
  horrorOnly?: boolean;
  source?: ExternalMovieSource;
}): Promise<PaginatedMovieResults> {
  const q = params.query.trim();
  const page = Math.max(1, params.page || 1);
  const horrorOnly = Boolean(params.horrorOnly);
  const source = params.source || 'tmdb';

  const cacheKey = `search:${source}:${q.toLowerCase()}:p${page}:h${horrorOnly ? 1 : 0}`;
  const hit = sessionListCache.get(cacheKey);
  if (hit && Date.now() < hit.expiresAt) {
    return { ...hit.value, cached: true };
  }

  const sp = new URLSearchParams({
    q,
    page: String(page),
    source,
  });
  if (horrorOnly) sp.set('horrorOnly', 'true');

  const res = await fetchJson<PaginatedMovieResults & { ok: boolean }>(
    `/api/movies/search?${sp.toString()}`
  );

  const payload: PaginatedMovieResults = {
    provider: res.provider,
    page: res.page,
    total_pages: res.total_pages,
    total_results: res.total_results,
    cached: res.cached,
    results: res.results,
  };

  sessionListCache.set(cacheKey, {
    value: payload,
    expiresAt: Date.now() + LIST_CACHE_TTL_MS,
  });

  return payload;
}

export async function exploreExternalMovies(params: {
  category: ExploreCategory;
  country?: string;
  yearFilter?: string;
  genre?: HorrorGenre;
  page?: number;
  source?: ExternalMovieSource;
}): Promise<PaginatedMovieResults> {
  const page = Math.max(1, params.page || 1);
  const source = params.source || 'tmdb';
  const cacheKey = `explore:${source}:${params.category}:${params.country || ''}:${params.yearFilter || ''}:${params.genre || ''}:p${page}`;

  const hit = sessionListCache.get(cacheKey);
  if (hit && Date.now() < hit.expiresAt) {
    return { ...hit.value, cached: true };
  }

  const sp = new URLSearchParams({
    category: params.category,
    page: String(page),
    source,
  });
  if (params.country) sp.set('country', params.country);
  if (params.yearFilter) sp.set('year', params.yearFilter);
  if (params.genre) sp.set('genre', params.genre);

  const res = await fetchJson<PaginatedMovieResults & { ok: boolean }>(
    `/api/movies/explore?${sp.toString()}`
  );

  const payload: PaginatedMovieResults = {
    provider: res.provider,
    page: res.page,
    total_pages: res.total_pages,
    total_results: res.total_results,
    cached: res.cached,
    results: res.results,
  };

  sessionListCache.set(cacheKey, {
    value: payload,
    expiresAt: Date.now() + LIST_CACHE_TTL_MS,
  });

  return payload;
}

export async function getExternalMovieDetail(
  source: ExternalMovieSource,
  externalId: string,
  options?: { forceRefresh?: boolean }
): Promise<{ detail: ExternalMovieDetail; cached: boolean }> {
  if (!options?.forceRefresh) {
    // 1. Check independent local metadata cache
    const localHit = getLocalCachedMovieMetadata(source, externalId);
    if (localHit) {
      return { detail: localHit, cached: true };
    }

    // 2. Check shared Firestore metadata cache (if signed in)
    const cloudHit = await readCloudMovieMetadataCache(source, externalId);
    if (cloudHit) {
      saveLocalMovieMetadataEntry(cloudHit);
      return { detail: cloudHit, cached: true };
    }
  }

  // 3. Request server proxy (with server in-memory TTL cache + TMDB API)
  const res = await fetchJson<{
    ok: boolean;
    cached: boolean;
    detail: ExternalMovieDetail;
  }>(`/api/movies/${encodeURIComponent(source)}/${encodeURIComponent(externalId)}`);

  saveLocalMovieMetadataEntry(res.detail);
  void writeCloudMovieMetadataCache(res.detail);

  return { detail: res.detail, cached: Boolean(res.cached) };
}

export function findExistingMovieInArchive(
  movies: Movie[],
  candidate: {
    external_source?: ExternalMovieSource;
    external_id?: string;
    title?: string;
    original_title?: string;
    release_year?: number;
  }
): Movie | undefined {
  if (candidate.external_source && candidate.external_id) {
    const byExternal = movies.find(
      (m) =>
        m.external_source === candidate.external_source &&
        m.external_id === candidate.external_id
    );
    if (byExternal) return byExternal;
  }

  const candTitle = candidate.title?.trim().toLowerCase();
  const candOrig = candidate.original_title?.trim().toLowerCase();
  const candYear = candidate.release_year;

  return movies.find((m) => {
    const sameYear =
      !candYear || !m.release_year || m.release_year === candYear;
    if (!sameYear) return false;
    const mTitle = m.title.trim().toLowerCase();
    const mOrig = m.original_title?.trim().toLowerCase();
    if (candTitle && (mTitle === candTitle || mOrig === candTitle)) return true;
    if (candOrig && (mTitle === candOrig || mOrig === candOrig)) return true;
    return false;
  });
}

export function externalMovieToDraftMovie(
  detail: ExternalMovieSummary | ExternalMovieDetail,
  existingSaved?: Movie
): Movie {
  const now = new Date().toISOString();
  const full = detail as Partial<ExternalMovieDetail>;

  return {
    movie_id:
      existingSaved?.movie_id ||
      `ext-${detail.external_source}-${detail.external_id}`,
    title: detail.title,
    original_title: detail.original_title || existingSaved?.original_title,
    poster_url: detail.poster_url || existingSaved?.poster_url,
    release_date: detail.release_date || existingSaved?.release_date,
    release_year: detail.release_year || existingSaved?.release_year,
    director: full.director || existingSaved?.director,
    country: full.country || existingSaved?.country,
    duration: full.duration || existingSaved?.duration,
    synopsis: detail.synopsis || existingSaved?.synopsis,
    genres:
      detail.genres && detail.genres.length > 0
        ? detail.genres
        : existingSaved?.genres || [],
    external_source: detail.external_source,
    external_id: detail.external_id,
    external_rating: detail.vote_average ?? existingSaved?.external_rating,
    created_at: existingSaved?.created_at || now,
    updated_at: now,
  };
}
