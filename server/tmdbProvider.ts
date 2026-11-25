import type {
  ExploreCategory,
  ExternalMovieDetail,
  ExternalMovieSummary,
  HorrorGenreLabel,
  MovieDatabaseProvider,
  MovieExploreParams,
  MovieSearchParams,
  PaginatedMovieResults,
  ProviderStatus,
} from './movieProvider.ts';

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/w780';
const TMDB_HORROR_GENRE_ID = 27;

const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;
const EXPLORE_CACHE_TTL_MS = 20 * 60 * 1000;
const DETAIL_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 450;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const COUNTRY_NAME_MAP: Record<string, string> = {
  US: '美国',
  GB: '英国',
  UK: '英国',
  JP: '日本',
  KR: '韩国',
  CN: '中国大陆',
  HK: '中国香港',
  TW: '中国台湾',
  FR: '法国',
  DE: '德国',
  IT: '意大利',
  ES: '西班牙',
  CA: '加拿大',
  AU: '澳大利亚',
  NZ: '新西兰',
  TH: '泰国',
  ID: '印度尼西亚',
  IN: '印度',
  SE: '瑞典',
  NO: '挪威',
  DK: '丹麦',
  FI: '芬兰',
  MX: '墨西哥',
  AR: '阿根廷',
  BR: '巴西',
  IE: '爱尔兰',
  AT: '奥地利',
  BE: '比利时',
  NL: '荷兰',
  RU: '俄罗斯',
  PL: '波兰',
  TR: '土耳其',
  MY: '马来西亚',
  SG: '新加坡',
  VN: '越南',
  PH: '菲律宾',
};

const TMDB_GENRE_NAME_MAP: Record<number, string> = {
  27: '恐怖',
  53: '惊悚',
  9648: '悬疑',
  878: '科幻',
  14: '奇幻',
  18: '剧情',
  28: '动作',
  35: '喜剧',
  80: '犯罪',
  12: '冒险',
  16: '动画',
  99: '纪录片',
};

// Mapping from Horror Diary's 13 sub-genres to TMDB discover parameters
const HORROR_SUBGENRE_QUERY_MAP: Record<
  HorrorGenreLabel,
  { extraGenreIds?: number[]; keywordQuery?: string }
> = {
  心理恐怖: { extraGenreIds: [53, 9648] },
  '超自然 / 鬼怪': { extraGenreIds: [14], keywordQuery: '9725|162846|6152' },
  民俗恐怖: { keywordQuery: '256183|6158|4344' },
  宗教恐怖: { keywordQuery: '9712|2983|10092|1562' },
  血腥暴力: { keywordQuery: '10292|11612|9826' },
  身体恐怖: { keywordQuery: '210024|191751|10292' },
  邪典: { keywordQuery: '34079|157758|10183' },
  丧尸: { keywordQuery: '12377|186565' },
  怪物: { keywordQuery: '1299|11134|9748' },
  生存恐怖: { extraGenreIds: [28, 53], keywordQuery: '10349|12339' },
  伪纪录片: { keywordQuery: '163053|11920' },
  Slasher: { keywordQuery: '12339|9826|10714' },
  科幻恐怖: { extraGenreIds: [878] },
};

interface TmdbMovieListItem {
  id: number;
  title?: string;
  original_title?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  overview?: string;
  genre_ids?: number[];
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  original_language?: string;
}

interface TmdbPaginatedResponse {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbMovieListItem[];
}

interface TmdbMovieDetailResponse {
  id: number;
  title?: string;
  original_title?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  overview?: string;
  runtime?: number | null;
  tagline?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  original_language?: string;
  genres?: { id: number; name: string }[];
  production_countries?: { iso_3166_1: string; name: string }[];
  origin_country?: string[];
  credits?: {
    crew?: { job?: string; name?: string }[];
  };
  keywords?: {
    keywords?: { id: number; name: string }[];
  };
  images?: {
    posters?: { file_path: string; iso_639_1?: string | null; vote_average?: number }[];
    backdrops?: { file_path: string; iso_639_1?: string | null; vote_average?: number }[];
  };
}

export class TmdbProviderError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(code: string, message: string, statusCode = 500) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

function parseReleaseYear(releaseDate?: string): number | undefined {
  if (!releaseDate || releaseDate.length < 4) return undefined;
  const yr = Number(releaseDate.slice(0, 4));
  if (!Number.isInteger(yr) || yr < 1880 || yr > 2100) return undefined;
  return yr;
}

function mapSignalsToHorrorGenres(params: {
  genreIds?: number[];
  title?: string;
  originalTitle?: string;
  overview?: string;
  keywordNames?: string[];
}): HorrorGenreLabel[] {
  const genreIds = params.genreIds || [];
  const text = [
    params.title || '',
    params.originalTitle || '',
    params.overview || '',
    ...(params.keywordNames || []),
  ]
    .join(' ')
    .toLowerCase();

  const out = new Set<HorrorGenreLabel>();

  if (genreIds.includes(878) || /sci-fi|alien|space|外星|太空|科幻|实验/.test(text)) {
    out.add('科幻恐怖');
  }
  if (/zombie|undead|丧尸|僵尸|尸变|感染者/.test(text)) {
    out.add('丧尸');
  }
  if (/slasher|serial killer|masked killer|连环杀手|杀手|狂魔|惊声尖叫|月光光/.test(text)) {
    out.add('Slasher');
  }
  if (/found footage|camcorder|mockumentary|伪纪录|录像带|手持摄影/.test(text)) {
    out.add('伪纪录片');
  }
  if (/folk|pagan|ritual|witch|shaman|village|民俗|祭祀|巫|村落|邪神|萨满/.test(text)) {
    out.add('民俗恐怖');
  }
  if (/exorcis|demon|priest|nun|church|satan|devil|驱魔|修女|恶魔|宗教|撒旦|教/.test(text)) {
    out.add('宗教恐怖');
  }
  if (/body horror|mutation|flesh|parasite|变形|变异|寄生|肉体|异化/.test(text)) {
    out.add('身体恐怖');
  }
  if (/gore|splatter|torture|bloodbath|saw|血腥|残酷|虐杀|肢解/.test(text)) {
    out.add('血腥暴力');
  }
  if (/monster|creature|beast|shark|spider|怪物|怪兽|异形|巨兽/.test(text)) {
    out.add('怪物');
  }
  if (/survival|trapped|escape|hunt|孤岛|密室|逃生|猎杀|生存/.test(text)) {
    out.add('生存恐怖');
  }
  if (/cult|surreal|bizarre|arthouse|邪典|迷幻|怪诞/.test(text)) {
    out.add('邪典');
  }
  if (
    genreIds.includes(14) ||
    /ghost|haunted|spirit|curse|supernatural|possession|鬼|灵异|凶宅|咒怨|幽灵|附身/.test(text)
  ) {
    out.add('超自然 / 鬼怪');
  }
  if (
    genreIds.includes(53) ||
    genreIds.includes(9648) ||
    /psychological|trauma|paranoia|insanity|hallucination|心理|幻觉|精神|记忆|创伤|压抑/.test(text)
  ) {
    out.add('心理恐怖');
  }

  if (out.size === 0 && genreIds.includes(TMDB_HORROR_GENRE_ID)) {
    out.add('心理恐怖');
  }

  return Array.from(out).slice(0, 4);
}

function mapCountryList(
  productionCountries?: { iso_3166_1: string; name: string }[],
  originCountries?: string[]
): string | undefined {
  const names: string[] = [];
  if (productionCountries && productionCountries.length > 0) {
    for (const item of productionCountries) {
      const code = item.iso_3166_1?.toUpperCase();
      const mapped = (code && COUNTRY_NAME_MAP[code]) || item.name?.trim();
      if (mapped && !names.includes(mapped)) {
        names.push(mapped);
      }
    }
  } else if (originCountries && originCountries.length > 0) {
    for (const codeRaw of originCountries) {
      const code = codeRaw.toUpperCase();
      const mapped = COUNTRY_NAME_MAP[code] || code;
      if (!names.includes(mapped)) {
        names.push(mapped);
      }
    }
  }
  if (names.length === 0) return undefined;
  return names.slice(0, 3).join(' / ');
}

export class TmdbMovieProvider implements MovieDatabaseProvider {
  readonly providerId = 'tmdb' as const;
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  private getCredentials(): { apiKey?: string; accessToken?: string } {
    const apiKey = process.env.TMDB_API_KEY?.trim() || undefined;
    const accessToken = process.env.TMDB_ACCESS_TOKEN?.trim() || undefined;
    return {
      apiKey: apiKey && apiKey !== 'MY_TMDB_API_KEY' ? apiKey : undefined,
      accessToken: accessToken || undefined,
    };
  }

  getStatus(): ProviderStatus {
    const { apiKey, accessToken } = this.getCredentials();
    return {
      provider: 'tmdb',
      configured: Boolean(apiKey || accessToken),
      attributionText:
        '本功能使用 TMDB 官方 API 提供电影检索与资料数据（This product uses the TMDB API but is not endorsed or certified by TMDB.）',
    };
  }

  private getCached<T>(key: string): T | null {
    const hit = this.cache.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return hit.value as T;
  }

  private setCached<T>(key: string, value: T, ttlMs: number): void {
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  private async requestTmdb<T>(
    path: string,
    queryParams: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    const { apiKey, accessToken } = this.getCredentials();
    if (!apiKey && !accessToken) {
      throw new TmdbProviderError(
        'TMDB_NOT_CONFIGURED',
        '服务端尚未配置 TMDB API 密钥，请在系统密钥（Secrets）或环境变量中设置 TMDB_API_KEY 后重试。',
        503
      );
    }

    const url = new URL(`${TMDB_API_BASE}${path}`);
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined && v !== '') {
        url.searchParams.set(k, String(v));
      }
    }
    if (apiKey && !accessToken) {
      url.searchParams.set('api_key', apiKey);
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        throw new TmdbProviderError(
          'TMDB_AUTH_FAILED',
          'TMDB API 凭证无效或已过期，请检查 TMDB_API_KEY 配置。',
          502
        );
      }
      if (response.status === 404) {
        throw new TmdbProviderError(
          'TMDB_NOT_FOUND',
          'TMDB 未找到对应的影片资料。',
          404
        );
      }
      if (response.status === 429) {
        throw new TmdbProviderError(
          'TMDB_RATE_LIMITED',
          'TMDB 接口请求过于频繁，请稍候几秒再试。',
          429
        );
      }
      if (!response.ok) {
        throw new TmdbProviderError(
          'TMDB_UPSTREAM_ERROR',
          `TMDB 数据服务暂时异常（HTTP ${response.status}）。`,
          502
        );
      }

      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof TmdbProviderError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new TmdbProviderError(
          'TMDB_TIMEOUT',
          '连接 TMDB 服务器超时，请检查网络或稍后重试。',
          504
        );
      }
      throw new TmdbProviderError(
        'TMDB_NETWORK_ERROR',
        '无法连接到 TMDB 官方接口，请稍后重试。',
        502
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private mapSummary(item: TmdbMovieListItem): ExternalMovieSummary {
    const genreIds = Array.isArray(item.genre_ids) ? item.genre_ids : [];
    const title = (item.title || item.original_title || '未命名影片').trim();
    const originalTitle = item.original_title?.trim();
    const releaseYear = parseReleaseYear(item.release_date);

    return {
      external_source: 'tmdb',
      external_id: String(item.id),
      title,
      original_title:
        originalTitle && originalTitle !== title ? originalTitle : originalTitle,
      poster_url: item.poster_path
        ? `${TMDB_POSTER_BASE}${item.poster_path}`
        : undefined,
      backdrop_url: item.backdrop_path
        ? `${TMDB_BACKDROP_BASE}${item.backdrop_path}`
        : undefined,
      release_date: item.release_date || undefined,
      release_year: releaseYear,
      synopsis: item.overview?.trim() || undefined,
      genres: mapSignalsToHorrorGenres({
        genreIds,
        title,
        originalTitle,
        overview: item.overview,
      }),
      external_genres: genreIds
        .map((id) => TMDB_GENRE_NAME_MAP[id])
        .filter((name): name is string => Boolean(name)),
      vote_average:
        typeof item.vote_average === 'number'
          ? Number(item.vote_average.toFixed(1))
          : undefined,
      vote_count: typeof item.vote_count === 'number' ? item.vote_count : undefined,
      popularity: typeof item.popularity === 'number' ? item.popularity : undefined,
      original_language: item.original_language || undefined,
      is_horror: genreIds.includes(TMDB_HORROR_GENRE_ID),
    };
  }

  async searchMovies(params: MovieSearchParams): Promise<PaginatedMovieResults> {
    const trimmedQuery = params.query.trim().slice(0, 120);
    const page = Math.min(500, Math.max(1, Math.floor(params.page || 1)));
    const horrorOnly = Boolean(params.horrorOnly);

    const cacheKey = `search:${trimmedQuery.toLowerCase()}:p${page}:h${horrorOnly ? 1 : 0}`;
    const cached = this.getCached<PaginatedMovieResults>(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    const [zhResult, enResult] = await Promise.allSettled([
      this.requestTmdb<TmdbPaginatedResponse>('/search/movie', {
        query: trimmedQuery,
        page,
        language: 'zh-CN',
        include_adult: false,
      }),
      this.requestTmdb<TmdbPaginatedResponse>('/search/movie', {
        query: trimmedQuery,
        page,
        language: 'en-US',
        include_adult: false,
      }),
    ]);

    if (zhResult.status === 'rejected') {
      throw zhResult.reason;
    }

    const data = zhResult.value;
    const enPosterMap = new Map<number, { poster_path?: string | null; backdrop_path?: string | null }>();
    if (enResult.status === 'fulfilled') {
      for (const item of enResult.value.results || []) {
        enPosterMap.set(item.id, {
          poster_path: item.poster_path,
          backdrop_path: item.backdrop_path,
        });
      }
    }

    let mapped = (data.results || []).map((item) => {
      const enMedia = enPosterMap.get(item.id);
      return this.mapSummary({
        ...item,
        poster_path: enMedia?.poster_path || item.poster_path,
        backdrop_path: enMedia?.backdrop_path || item.backdrop_path,
      });
    });
    if (horrorOnly) {
      const horrorFiltered = mapped.filter((m) => m.is_horror);
      if (horrorFiltered.length > 0) {
        mapped = horrorFiltered;
      }
    } else {
      // Keep TMDB order but gently prioritize horror titles when tied
      mapped.sort((a, b) => Number(Boolean(b.is_horror)) - Number(Boolean(a.is_horror)));
    }

    const result: PaginatedMovieResults = {
      provider: 'tmdb',
      page: data.page || page,
      total_pages: Math.min(500, Math.max(1, data.total_pages || 1)),
      total_results: data.total_results || mapped.length,
      cached: false,
      results: mapped,
    };

    this.setCached(cacheKey, result, SEARCH_CACHE_TTL_MS);
    return result;
  }

  async exploreMovies(params: MovieExploreParams): Promise<PaginatedMovieResults> {
    const category: ExploreCategory = params.category || 'popular';
    const country = params.country?.trim().toUpperCase() || '';
    const yearFilter = params.yearFilter?.trim() || '';
    const genre = params.genre;
    const page = Math.min(500, Math.max(1, Math.floor(params.page || 1)));

    const cacheKey = `explore:${category}:${country}:${yearFilter}:${genre || ''}:p${page}`;
    const cached = this.getCached<PaginatedMovieResults>(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    const queryParams: Record<string, string | number | boolean | undefined> = {
      language: 'zh-CN',
      include_adult: false,
      include_video: false,
      page,
    };

    const genreIds = [TMDB_HORROR_GENRE_ID];
    if (genre && HORROR_SUBGENRE_QUERY_MAP[genre]) {
      const mapping = HORROR_SUBGENRE_QUERY_MAP[genre];
      if (mapping.extraGenreIds && mapping.extraGenreIds.length > 0) {
        // Combine Horror (27) with secondary TMDB genre for Sci-Fi Horror, Psychological, etc.
        queryParams.with_genres = `${TMDB_HORROR_GENRE_ID},${mapping.extraGenreIds[0]}`;
      } else {
        queryParams.with_genres = String(TMDB_HORROR_GENRE_ID);
      }
      if (mapping.keywordQuery) {
        queryParams.with_keywords = mapping.keywordQuery;
      }
    } else {
      queryParams.with_genres = genreIds.join(',');
    }

    if (country && /^[A-Z]{2}$/.test(country)) {
      queryParams.with_origin_country = country;
    }

    if (yearFilter) {
      if (/^\d{4}$/.test(yearFilter)) {
        queryParams.primary_release_year = Number(yearFilter);
      } else if (/^\d{4}s$/.test(yearFilter)) {
        const startYear = Number(yearFilter.slice(0, 4));
        const endYear = startYear + 9;
        queryParams['primary_release_date.gte'] = `${startYear}-01-01`;
        queryParams['primary_release_date.lte'] = `${endYear}-12-31`;
      } else if (yearFilter === 'pre1970') {
        queryParams['primary_release_date.lte'] = '1969-12-31';
      }
    }

    if (category === 'top_rated') {
      queryParams.sort_by = 'vote_average.desc';
      queryParams['vote_count.gte'] = country || genre || yearFilter ? 80 : 300;
    } else if (category === 'classic') {
      queryParams.sort_by = 'vote_average.desc';
      queryParams['vote_count.gte'] = country || genre ? 60 : 220;
      if (!yearFilter) {
        queryParams['primary_release_date.lte'] = '1999-12-31';
      }
    } else {
      queryParams.sort_by = 'popularity.desc';
      queryParams['vote_count.gte'] = country || genre || yearFilter ? 20 : 50;
    }

    const fetchDiscoverPair = async (
      paramsObj: Record<string, string | number | boolean | undefined>
    ) => {
      const [zhRes, enRes] = await Promise.allSettled([
        this.requestTmdb<TmdbPaginatedResponse>('/discover/movie', paramsObj),
        this.requestTmdb<TmdbPaginatedResponse>('/discover/movie', {
          ...paramsObj,
          language: 'en-US',
        }),
      ]);
      if (zhRes.status === 'rejected') throw zhRes.reason;
      return {
        zhData: zhRes.value,
        enData: enRes.status === 'fulfilled' ? enRes.value : null,
      };
    };

    let { zhData: data, enData } = await fetchDiscoverPair(queryParams);

    // Fallback: if strict keyword + country + year returns 0, relax keyword filter while keeping horror genre
    if ((data.results?.length || 0) === 0 && queryParams.with_keywords) {
      const relaxedParams = { ...queryParams };
      delete relaxedParams.with_keywords;
      ({ zhData: data, enData } = await fetchDiscoverPair(relaxedParams));
    }

    const enPosterMap = new Map<number, { poster_path?: string | null; backdrop_path?: string | null }>();
    if (enData) {
      for (const item of enData.results || []) {
        enPosterMap.set(item.id, {
          poster_path: item.poster_path,
          backdrop_path: item.backdrop_path,
        });
      }
    }

    const mapped = (data.results || []).map((item) => {
      const enMedia = enPosterMap.get(item.id);
      return this.mapSummary({
        ...item,
        poster_path: enMedia?.poster_path || item.poster_path,
        backdrop_path: enMedia?.backdrop_path || item.backdrop_path,
      });
    });
    const result: PaginatedMovieResults = {
      provider: 'tmdb',
      page: data.page || page,
      total_pages: Math.min(500, Math.max(1, data.total_pages || 1)),
      total_results: data.total_results || mapped.length,
      cached: false,
      results: mapped,
    };

    this.setCached(cacheKey, result, EXPLORE_CACHE_TTL_MS);
    return result;
  }

  async getMovieDetail(
    externalId: string
  ): Promise<{ detail: ExternalMovieDetail; cached: boolean }> {
    const cleanId = externalId.trim();
    if (!/^\d{1,12}$/.test(cleanId)) {
      throw new TmdbProviderError(
        'INVALID_MOVIE_ID',
        '无效的 TMDB 电影 ID。',
        400
      );
    }

    const cacheKey = `detail:${cleanId}`;
    const cached = this.getCached<ExternalMovieDetail>(cacheKey);
    if (cached) {
      return { detail: cached, cached: true };
    }

    const zhData = await this.requestTmdb<TmdbMovieDetailResponse>(
      `/movie/${cleanId}`,
      {
        language: 'zh-CN',
        append_to_response: 'credits,keywords,images',
        include_image_language: 'en,null',
      }
    );

    let fallbackOverview = zhData.overview?.trim() || '';
    if (!fallbackOverview) {
      try {
        const enData = await this.requestTmdb<TmdbMovieDetailResponse>(
          `/movie/${cleanId}`,
          { language: 'en-US' }
        );
        fallbackOverview = enData.overview?.trim() || '';
      } catch {
        // Ignore optional fallback error
      }
    }

    const englishPosterPath =
      zhData.images?.posters?.find((p) => p.iso_639_1 === 'en')?.file_path ||
      zhData.images?.posters?.find((p) => !p.iso_639_1)?.file_path ||
      zhData.poster_path;
    const englishBackdropPath =
      zhData.images?.backdrops?.find((b) => !b.iso_639_1 || b.iso_639_1 === 'en')?.file_path ||
      zhData.backdrop_path;

    const directors = (zhData.credits?.crew || [])
      .filter((member) => member.job === 'Director' && member.name?.trim())
      .map((member) => member.name!.trim());
    const uniqueDirectors = Array.from(new Set(directors)).slice(0, 2);

    const genreIds = (zhData.genres || []).map((g) => g.id);
    const keywordNames = (zhData.keywords?.keywords || []).map((k) => k.name);
    const title = (zhData.title || zhData.original_title || '未命名影片').trim();
    const originalTitle = zhData.original_title?.trim();

    const detail: ExternalMovieDetail = {
      external_source: 'tmdb',
      external_id: String(zhData.id),
      title,
      original_title: originalTitle,
      poster_url: englishPosterPath
        ? `${TMDB_POSTER_BASE}${englishPosterPath}`
        : undefined,
      backdrop_url: englishBackdropPath
        ? `${TMDB_BACKDROP_BASE}${englishBackdropPath}`
        : undefined,
      release_date: zhData.release_date || undefined,
      release_year: parseReleaseYear(zhData.release_date),
      director: uniqueDirectors.length > 0 ? uniqueDirectors.join(' / ') : undefined,
      country: mapCountryList(zhData.production_countries, zhData.origin_country),
      duration:
        typeof zhData.runtime === 'number' && zhData.runtime > 0
          ? Math.round(zhData.runtime)
          : undefined,
      synopsis: fallbackOverview || undefined,
      tagline: zhData.tagline?.trim() || undefined,
      genres: mapSignalsToHorrorGenres({
        genreIds,
        title,
        originalTitle,
        overview: fallbackOverview,
        keywordNames,
      }),
      external_genres: (zhData.genres || []).map((g) => g.name).filter(Boolean),
      vote_average:
        typeof zhData.vote_average === 'number'
          ? Number(zhData.vote_average.toFixed(1))
          : undefined,
      vote_count:
        typeof zhData.vote_count === 'number' ? zhData.vote_count : undefined,
      popularity:
        typeof zhData.popularity === 'number' ? zhData.popularity : undefined,
      original_language: zhData.original_language || undefined,
      is_horror: genreIds.includes(TMDB_HORROR_GENRE_ID),
    };

    this.setCached(cacheKey, detail, DETAIL_CACHE_TTL_MS);
    return { detail, cached: false };
  }
}
