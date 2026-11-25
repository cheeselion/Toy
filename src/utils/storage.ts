import { INITIAL_ARCHIVE_STATE } from '../data/catalog';
import {
  CatalogFilm,
  GoreLevel,
  HorrorArchiveState,
  HorrorGenre,
  HorrorLevel,
  Movie,
  ScareType,
  WatchlistItem,
  WatchRecord,
} from '../types/horror';

const STORAGE_KEY = 'horror_diary_archive_v1';

export function loadArchiveState(): HorrorArchiveState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_ARCHIVE_STATE));
      return INITIAL_ARCHIVE_STATE;
    }
    const parsed = JSON.parse(raw) as HorrorArchiveState;
    if (
      parsed &&
      Array.isArray(parsed.movies) &&
      Array.isArray(parsed.watchRecords) &&
      Array.isArray(parsed.watchlist)
    ) {
      return parsed;
    }
    return INITIAL_ARCHIVE_STATE;
  } catch {
    return INITIAL_ARCHIVE_STATE;
  }
}

export function saveArchiveState(state: HorrorArchiveState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function resetArchiveState(): HorrorArchiveState {
  saveArchiveState(INITIAL_ARCHIVE_STATE);
  return INITIAL_ARCHIVE_STATE;
}

export function parseArchiveBackup(jsonText: string): HorrorArchiveState | null {
  try {
    const parsed = JSON.parse(jsonText) as Partial<HorrorArchiveState>;
    if (
      !parsed ||
      !Array.isArray(parsed.movies) ||
      !Array.isArray(parsed.watchRecords) ||
      !Array.isArray(parsed.watchlist)
    ) {
      return null;
    }
    return {
      movies: parsed.movies,
      watchRecords: parsed.watchRecords,
      watchlist: parsed.watchlist,
    };
  } catch {
    return null;
  }
}

export function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export interface WatchedEntry {
  movie: Movie;
  record: WatchRecord;
}

export interface WatchlistEntry {
  movie: Movie;
  item: WatchlistItem;
}

export interface ArchiveStatistics {
  totalWatched: number;
  thisYearWatched: number;
  totalWatchCount: number;
  averageRating: number | null;
  highestRatedEntries: WatchedEntry[];
  averageHorrorLevel: number | null;
  scareMeterRatedCount: number;
  scariestEntries: WatchedEntry[];
  scariestGenre: { genre: HorrorGenre; avgHorror: number; count: number } | null;
  genreStats: {
    genre: HorrorGenre;
    count: number;
    avgRating: number | null;
    avgHorror: number | null;
  }[];
  favoriteGenre: string | null;
  countryStats: { country: string; count: number }[];
  topCountry: string | null;
  directorStats: { director: string; count: number; avgRating: number | null }[];
  favoriteDirector: string | null;
  scareStats: { scare: ScareType; count: number }[];
  topScareType: ScareType | null;
  goreStats: { level: GoreLevel; count: number }[];
  yearlyStats: { year: string; count: number }[];
  monthlyStats: { month: string; monthIndex: number; count: number }[];
  monthRanking: { month: string; monthIndex: number; count: number }[];
  topMonth: { month: string; count: number } | null;
  decadeStats: { decade: string; count: number }[];
  favoriteDecade: string | null;
  ratingDistribution: { score: number; count: number }[];
  horrorLevelDistribution: {
    level: HorrorLevel;
    count: number;
    percentage: number;
    avgRating: number | null;
  }[];
}

export function computeArchiveStatistics(
  entries: WatchedEntry[],
  currentYear: number = new Date().getFullYear()
): ArchiveStatistics {
  const totalWatched = entries.length;
  const thisYearWatched = entries.filter((e) => {
    const dateStr = e.record.watch_date || e.record.created_at;
    return dateStr ? new Date(dateStr).getFullYear() === currentYear : false;
  }).length;

  const totalWatchCount = entries.reduce((sum, e) => sum + (e.record.watch_count || 1), 0);

  const ratedEntries = entries.filter((e) => typeof e.record.rating === 'number');
  const averageRating =
    ratedEntries.length > 0
      ? Number(
          (
            ratedEntries.reduce((sum, e) => sum + (e.record.rating || 0), 0) /
            ratedEntries.length
          ).toFixed(1)
        )
      : null;

  const maxRating = ratedEntries.reduce(
    (max, e) => Math.max(max, e.record.rating || 0),
    0
  );
  const highestRatedEntries =
    maxRating > 0
      ? ratedEntries.filter((e) => e.record.rating === maxRating)
      : [];

  const horrorRated = entries.filter((e) => typeof e.record.horror_level === 'number');
  const scareMeterRatedCount = horrorRated.length;
  const averageHorrorLevel =
    horrorRated.length > 0
      ? Number(
          (
            horrorRated.reduce((sum, e) => sum + (e.record.horror_level || 0), 0) /
            horrorRated.length
          ).toFixed(1)
        )
      : null;

  const maxHorrorLevel = horrorRated.reduce(
    (max, e) => Math.max(max, e.record.horror_level || 0),
    0
  );
  const scariestEntries =
    maxHorrorLevel > 0
      ? horrorRated
          .filter((e) => e.record.horror_level === maxHorrorLevel)
          .sort((a, b) => (b.record.rating ?? 0) - (a.record.rating ?? 0))
      : [];

  // Genre stats
  const genreMap = new Map<
    HorrorGenre,
    {
      count: number;
      ratingSum: number;
      ratingCount: number;
      horrorSum: number;
      horrorCount: number;
    }
  >();
  for (const e of entries) {
    for (const g of e.movie.genres) {
      const prev = genreMap.get(g) || {
        count: 0,
        ratingSum: 0,
        ratingCount: 0,
        horrorSum: 0,
        horrorCount: 0,
      };
      prev.count += 1;
      if (typeof e.record.rating === 'number') {
        prev.ratingSum += e.record.rating;
        prev.ratingCount += 1;
      }
      if (typeof e.record.horror_level === 'number') {
        prev.horrorSum += e.record.horror_level;
        prev.horrorCount += 1;
      }
      genreMap.set(g, prev);
    }
  }
  const genreStats = Array.from(genreMap.entries())
    .map(([genre, data]) => ({
      genre,
      count: data.count,
      avgRating:
        data.ratingCount > 0 ? Number((data.ratingSum / data.ratingCount).toFixed(1)) : null,
      avgHorror:
        data.horrorCount > 0 ? Number((data.horrorSum / data.horrorCount).toFixed(1)) : null,
    }))
    .sort((a, b) => b.count - a.count || (b.avgRating ?? 0) - (a.avgRating ?? 0));

  const favoriteGenre = genreStats[0]?.genre ?? null;
  const scariestGenreCandidate = [...genreStats]
    .filter((g) => g.avgHorror !== null)
    .sort((a, b) => (b.avgHorror ?? 0) - (a.avgHorror ?? 0) || b.count - a.count)[0];
  const scariestGenre =
    scariestGenreCandidate && scariestGenreCandidate.avgHorror !== null
      ? {
          genre: scariestGenreCandidate.genre,
          avgHorror: scariestGenreCandidate.avgHorror,
          count: scariestGenreCandidate.count,
        }
      : null;

  // Country stats (split multi-country strings like "英国 / 美国" if needed, or keep normalized tokens)
  const countryMap = new Map<string, number>();
  for (const e of entries) {
    if (!e.movie.country) continue;
    const parts = e.movie.country
      .split(/[/,，、]/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const part of parts) {
      countryMap.set(part, (countryMap.get(part) || 0) + 1);
    }
  }
  const countryStats = Array.from(countryMap.entries())
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);
  const topCountry = countryStats[0]?.country ?? null;

  // Director stats
  const directorMap = new Map<string, { count: number; ratingSum: number; ratingCount: number }>();
  for (const e of entries) {
    if (!e.movie.director) continue;
    const dir = e.movie.director.trim();
    const prev = directorMap.get(dir) || { count: 0, ratingSum: 0, ratingCount: 0 };
    prev.count += 1;
    if (typeof e.record.rating === 'number') {
      prev.ratingSum += e.record.rating;
      prev.ratingCount += 1;
    }
    directorMap.set(dir, prev);
  }
  const directorStats = Array.from(directorMap.entries())
    .map(([director, data]) => ({
      director,
      count: data.count,
      avgRating:
        data.ratingCount > 0 ? Number((data.ratingSum / data.ratingCount).toFixed(1)) : null,
    }))
    .sort((a, b) => b.count - a.count || (b.avgRating ?? 0) - (a.avgRating ?? 0));
  const favoriteDirector = directorStats[0]?.director ?? null;

  // Scare stats
  const scareMap = new Map<ScareType, number>();
  for (const e of entries) {
    for (const s of e.record.scare_types || []) {
      scareMap.set(s, (scareMap.get(s) || 0) + 1);
    }
  }
  const scareStats = Array.from(scareMap.entries())
    .map(([scare, count]) => ({ scare, count }))
    .sort((a, b) => b.count - a.count);
  const topScareType = scareStats[0]?.scare ?? null;

  // Gore stats
  const goreLevels: GoreLevel[] = ['低', '中', '高', '极高'];
  const goreMap = new Map<GoreLevel, number>(goreLevels.map((l) => [l, 0]));
  for (const e of entries) {
    if (e.record.gore_level) {
      goreMap.set(e.record.gore_level, (goreMap.get(e.record.gore_level) || 0) + 1);
    }
  }
  const goreStats = goreLevels.map((level) => ({ level, count: goreMap.get(level) || 0 }));

  // Yearly stats
  const yearMap = new Map<string, number>();
  for (const e of entries) {
    const dateStr = e.record.watch_date || e.record.created_at;
    if (!dateStr) continue;
    const yr = String(new Date(dateStr).getFullYear());
    yearMap.set(yr, (yearMap.get(yr) || 0) + 1);
  }
  const yearlyStats = Array.from(yearMap.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year.localeCompare(b.year));

  // Monthly stats for currentYear and overall watch-month ranking across scoped entries
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const monthCounts = Array(12).fill(0);
  const overallMonthCounts = Array(12).fill(0);
  for (const e of entries) {
    const dateStr = e.record.watch_date || e.record.created_at;
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) continue;
    overallMonthCounts[d.getMonth()] += 1;
    if (d.getFullYear() === currentYear) {
      monthCounts[d.getMonth()] += 1;
    }
  }
  const monthlyStats = monthNames.map((month, idx) => ({
    month,
    monthIndex: idx + 1,
    count: monthCounts[idx],
  }));

  const monthRanking = monthNames
    .map((month, idx) => ({
      month,
      monthIndex: idx + 1,
      count: overallMonthCounts[idx],
    }))
    .filter((m) => m.count > 0)
    .sort((a, b) => b.count - a.count || a.monthIndex - b.monthIndex);

  const topMonth = monthRanking[0]
    ? { month: monthRanking[0].month, count: monthRanking[0].count }
    : null;

  // Release decade stats
  const decadeMap = new Map<string, number>();
  for (const e of entries) {
    const yr = e.movie.release_year;
    if (!yr || Number.isNaN(yr)) continue;
    const label = yr < 1970 ? '1970前' : `${Math.floor(yr / 10) * 10}s`;
    decadeMap.set(label, (decadeMap.get(label) || 0) + 1);
  }
  const decadeStats = Array.from(decadeMap.entries())
    .map(([decade, count]) => ({ decade, count }))
    .sort((a, b) => b.count - a.count);
  const favoriteDecade = decadeStats[0]?.decade ?? null;

  // Rating distribution (1-10)
  const ratingMap = new Map<number, number>();
  for (let s = 1; s <= 10; s++) ratingMap.set(s, 0);
  for (const e of ratedEntries) {
    const r = Math.round(e.record.rating || 0);
    if (r >= 1 && r <= 10) {
      ratingMap.set(r, (ratingMap.get(r) || 0) + 1);
    }
  }
  const ratingDistribution = Array.from(ratingMap.entries()).map(([score, count]) => ({
    score,
    count,
  }));

  // Horror level distribution (1-5) with % and avg rating correlation
  const horrorLevels: HorrorLevel[] = [1, 2, 3, 4, 5];
  const horrorDistMap = new Map<
    HorrorLevel,
    { count: number; ratingSum: number; ratingCount: number }
  >(horrorLevels.map((l) => [l, { count: 0, ratingSum: 0, ratingCount: 0 }]));

  for (const e of entries) {
    if (e.record.horror_level) {
      const bucket = horrorDistMap.get(e.record.horror_level)!;
      bucket.count += 1;
      if (typeof e.record.rating === 'number') {
        bucket.ratingSum += e.record.rating;
        bucket.ratingCount += 1;
      }
    }
  }
  const horrorLevelDistribution = horrorLevels.map((level) => {
    const bucket = horrorDistMap.get(level)!;
    return {
      level,
      count: bucket.count,
      percentage:
        scareMeterRatedCount > 0
          ? Math.round((bucket.count / scareMeterRatedCount) * 100)
          : 0,
      avgRating:
        bucket.ratingCount > 0
          ? Number((bucket.ratingSum / bucket.ratingCount).toFixed(1))
          : null,
    };
  });

  return {
    totalWatched,
    thisYearWatched,
    totalWatchCount,
    averageRating,
    highestRatedEntries,
    averageHorrorLevel,
    scareMeterRatedCount,
    scariestEntries,
    scariestGenre,
    genreStats,
    favoriteGenre,
    countryStats,
    topCountry,
    directorStats,
    favoriteDirector,
    scareStats,
    topScareType,
    goreStats,
    yearlyStats,
    monthlyStats,
    monthRanking,
    topMonth,
    decadeStats,
    favoriteDecade,
    ratingDistribution,
    horrorLevelDistribution,
  };
}

export interface RecommendedFilm {
  film: CatalogFilm;
  score: number;
  reasons: string[];
}

export function computeRecommendedFilms(
  watchedEntries: WatchedEntry[],
  catalog: CatalogFilm[],
  maxCount: number = 10
): RecommendedFilm[] {
  const watchedTitleKeys = new Set(
    watchedEntries.flatMap((e) =>
      [e.movie.title, e.movie.original_title]
        .filter(Boolean)
        .map((t) => t!.trim().toLowerCase())
    )
  );

  // Build user taste profile from watched movies
  const genreWeights = new Map<HorrorGenre, number>();
  const directorWeights = new Map<string, number>();
  const countryWeights = new Map<string, number>();

  for (const { movie, record } of watchedEntries) {
    const ratingFactor =
      typeof record.rating === 'number' ? Math.max(0.5, record.rating / 7) : 1;
    const horrorFactor =
      typeof record.horror_level === 'number' && record.horror_level >= 4 ? 1.2 : 1;
    const weight = ratingFactor * horrorFactor;

    for (const g of movie.genres) {
      genreWeights.set(g, (genreWeights.get(g) || 0) + weight * 3);
    }
    if (movie.director) {
      const dir = movie.director.trim().toLowerCase();
      directorWeights.set(dir, (directorWeights.get(dir) || 0) + weight * 4);
    }
    if (movie.country) {
      movie.country
        .split(/[/,，、]/)
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean)
        .forEach((c) => {
          countryWeights.set(c, (countryWeights.get(c) || 0) + weight * 1.5);
        });
    }
  }

  const unwatched = catalog.filter((film) => {
    const t1 = film.title.trim().toLowerCase();
    const t2 = film.original_title.trim().toLowerCase();
    return !watchedTitleKeys.has(t1) && !watchedTitleKeys.has(t2);
  });

  const scored: RecommendedFilm[] = unwatched.map((film) => {
    let score = 0;
    const matchedGenres: string[] = [];
    let matchedDirector = false;

    for (const g of film.genres) {
      const gw = genreWeights.get(g) || 0;
      if (gw > 0) {
        score += gw;
        matchedGenres.push(g);
      }
    }

    const dirKey = film.director.trim().toLowerCase();
    const dw = directorWeights.get(dirKey) || 0;
    if (dw > 0) {
      score += dw;
      matchedDirector = true;
    }

    film.country
      .split(/[/,，、]/)
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean)
      .forEach((c) => {
        score += countryWeights.get(c) || 0;
      });

    if (film.poster_url) {
      score += 0.4;
    }

    const reasons: string[] = [];
    if (matchedDirector) {
      reasons.push(`同导演 · ${film.director}`);
    }
    if (matchedGenres.length > 0) {
      reasons.push(`偏好类型 · ${matchedGenres.slice(0, 2).join(' / ')}`);
    }
    if (reasons.length === 0) {
      reasons.push('精选恐怖佳作推荐');
    }

    return { film, score, reasons };
  });

  return scored
    .sort((a, b) => b.score - a.score || b.film.release_year - a.film.release_year)
    .slice(0, maxCount);
}
