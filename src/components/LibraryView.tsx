import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from 'lucide-react';
import { CURATED_CATALOG } from '../data/catalog';
import {
  externalMovieToDraftMovie,
  fetchMovieDatabaseStatus,
  findExistingMovieInArchive,
  getExternalMovieDetail,
  MovieDatabaseClientError,
  searchExternalMovies,
} from '../services/movieDatabase';
import {
  CatalogFilm,
  ExternalMovieDetail,
  ExternalMovieSummary,
  HORROR_GENRES,
  HORROR_LEVEL_LABELS,
  HorrorArchiveState,
  HorrorGenre,
  HorrorLevel,
  Movie,
} from '../types/horror';
import { WatchedEntry } from '../utils/storage';
import { PosterFrame } from './PosterFrame';
import { TmdbAttribution } from './TmdbAttribution';

type RatingFilter = 'all' | '9plus' | '8plus' | '7plus' | 'under7' | 'unrated';

const RATING_FILTER_OPTIONS: { id: RatingFilter; label: string }[] = [
  { id: 'all', label: '全部评分' },
  { id: '9plus', label: '9 分及以上' },
  { id: '8plus', label: '8 分及以上' },
  { id: '7plus', label: '7 分及以上' },
  { id: 'under7', label: '7 分以下' },
  { id: 'unrated', label: '未评分' },
];

const HORROR_LEVEL_OPTIONS: HorrorLevel[] = [1, 2, 3, 4, 5];

interface LibraryViewProps {
  archiveState: HorrorArchiveState;
  watchedEntries: WatchedEntry[];
  selectedGenres: HorrorGenre[];
  genreJumpVersion: number;
  onGenresChange: (genres: HorrorGenre[]) => void;
  onSelectMovie: (movie: Movie, fromSearch: boolean) => void;
  onSelectCatalogFilm: (film: CatalogFilm, fromSearch: boolean) => void;
  onPreviewExternalMovie: (movie: Movie, fromSearch: boolean) => void;
  onMarkAsWatched?: (movie: Movie) => void;
  onToggleWatchlist?: (movie: Movie) => void;
  onOpenAddModal: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  archiveState,
  watchedEntries,
  selectedGenres,
  genreJumpVersion,
  onGenresChange,
  onSelectMovie,
  onSelectCatalogFilm,
  onPreviewExternalMovie,
  onOpenAddModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');
  const [selectedHorrorLevels, setSelectedHorrorLevels] = useState<HorrorLevel[]>([]);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // Integrated TMDB online search state
  const [tmdbConfigured, setTmdbConfigured] = useState<boolean | null>(null);
  const [externalResults, setExternalResults] = useState<ExternalMovieSummary[]>([]);
  const [externalPage, setExternalPage] = useState(1);
  const [externalTotalPages, setExternalTotalPages] = useState(1);
  const [isExternalLoading, setIsExternalLoading] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);
  const [loadingMovieKey, setLoadingMovieKey] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const requestIdRef = useRef(0);

  const trimmedSearch = searchQuery.trim();
  const isSearching = trimmedSearch.length > 0;
  const activeSearchTerm = debouncedQuery.trim();

  // Check TMDB service configuration status once
  useEffect(() => {
    let active = true;
    void fetchMovieDatabaseStatus().then((st) => {
      if (active) setTmdbConfigured(st.configured);
    });
    return () => {
      active = false;
    };
  }, []);

  // Debounce search input for smooth TMDB API lookup inside Library search
  useEffect(() => {
    const next = searchQuery.trim();
    if (!next) {
      setDebouncedQuery('');
      setExternalPage(1);
      return;
    }
    const timer = window.setTimeout(() => {
      setDebouncedQuery(next);
      setExternalPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Reset filters on external genre jump from detail modal
  useEffect(() => {
    if (genreJumpVersion > 0) {
      setSearchQuery('');
      setDebouncedQuery('');
      setSelectedYear('all');
      setSelectedCountry('all');
      setRatingFilter('all');
      setSelectedHorrorLevels([]);
    }
  }, [genreJumpVersion]);

  // Close bottom sheet on Escape
  useEffect(() => {
    if (!filterSheetOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFilterSheetOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filterSheetOpen]);

  // Fetch TMDB results when searching inside Library
  useEffect(() => {
    if (!activeSearchTerm) {
      setExternalResults([]);
      setExternalTotalPages(1);
      setExternalError(null);
      setIsExternalLoading(false);
      return;
    }

    if (tmdbConfigured === false) {
      setExternalResults([]);
      setIsExternalLoading(false);
      return;
    }
    if (tmdbConfigured === null) return;

    const currentReqId = ++requestIdRef.current;
    setIsExternalLoading(true);
    setExternalError(null);

    const run = async () => {
      try {
        const res = await searchExternalMovies({
          query: activeSearchTerm,
          page: externalPage,
          horrorOnly: false,
        });

        if (currentReqId !== requestIdRef.current) return;
        setExternalResults(res.results);
        setExternalTotalPages(res.total_pages);
      } catch (err) {
        if (currentReqId !== requestIdRef.current) return;
        if (
          err instanceof MovieDatabaseClientError &&
          err.code === 'TMDB_NOT_CONFIGURED'
        ) {
          setTmdbConfigured(false);
          setExternalError(null);
        } else {
          setExternalError(
            err instanceof Error
              ? err.message
              : '电影数据库检索失败，请稍后重试。'
          );
        }
      } finally {
        if (currentReqId === requestIdRef.current) {
          setIsExternalLoading(false);
        }
      }
    };

    void run();
  }, [activeSearchTerm, tmdbConfigured, externalPage, reloadNonce]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    watchedEntries.forEach((e) => {
      if (e.movie.release_year) years.add(e.movie.release_year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [watchedEntries]);

  const availableCountries = useMemo(() => {
    const countries = new Set<string>();
    watchedEntries.forEach((e) => {
      if (!e.movie.country) return;
      e.movie.country
        .split(/[/,，、]/)
        .map((c) => c.trim())
        .filter(Boolean)
        .forEach((c) => countries.add(c));
    });
    return Array.from(countries).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [watchedEntries]);

  const filteredEntries = useMemo(() => {
    const q = trimmedSearch.toLowerCase();
    const list = watchedEntries.filter(({ movie, record }) => {
      if (q) {
        const hay = [
          movie.title,
          movie.original_title,
          movie.director,
          movie.country,
          movie.release_year ? String(movie.release_year) : '',
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (selectedYear !== 'all' && String(movie.release_year) !== selectedYear) {
        return false;
      }
      if (selectedCountry !== 'all') {
        const parts = (movie.country || '')
          .split(/[/,，、]/)
          .map((c) => c.trim());
        if (!parts.includes(selectedCountry)) return false;
      }
      if (
        selectedGenres.length > 0 &&
        !movie.genres.some((g) => selectedGenres.includes(g))
      ) {
        return false;
      }
      if (ratingFilter !== 'all') {
        const score = record.rating;
        if (ratingFilter === 'unrated' && typeof score === 'number') return false;
        if (ratingFilter === '9plus' && (typeof score !== 'number' || score < 9)) {
          return false;
        }
        if (ratingFilter === '8plus' && (typeof score !== 'number' || score < 8)) {
          return false;
        }
        if (ratingFilter === '7plus' && (typeof score !== 'number' || score < 7)) {
          return false;
        }
        if (ratingFilter === 'under7' && (typeof score !== 'number' || score >= 7)) {
          return false;
        }
      }
      if (selectedHorrorLevels.length > 0) {
        if (
          !record.horror_level ||
          !selectedHorrorLevels.includes(record.horror_level)
        ) {
          return false;
        }
      }
      return true;
    });

    return [...list].sort((a, b) =>
      b.record.created_at.localeCompare(a.record.created_at)
    );
  }, [
    watchedEntries,
    trimmedSearch,
    selectedYear,
    selectedCountry,
    selectedGenres,
    ratingFilter,
    selectedHorrorLevels,
  ]);

  // Curated catalog matches when searching offline (no TMDB) or filtering by genre/year/country
  const catalogMatches = useMemo(() => {
    const q = trimmedSearch.toLowerCase();
    const shouldShowCurated =
      (q.length > 0 && tmdbConfigured === false) ||
      (!q && selectedGenres.length > 0);

    if (!shouldShowCurated) return [];

    const watchedKeys = new Set(
      watchedEntries.flatMap((e) =>
        [e.movie.title, e.movie.original_title]
          .filter(Boolean)
          .map((t) => t!.trim().toLowerCase())
      )
    );

    return CURATED_CATALOG.filter((film) => {
      if (
        watchedKeys.has(film.title.trim().toLowerCase()) ||
        watchedKeys.has(film.original_title.trim().toLowerCase())
      ) {
        return false;
      }
      if (selectedYear !== 'all' && String(film.release_year) !== selectedYear) {
        return false;
      }
      if (selectedCountry !== 'all') {
        const parts = film.country.split(/[/,，、]/).map((c) => c.trim());
        if (!parts.includes(selectedCountry)) return false;
      }
      if (
        selectedGenres.length > 0 &&
        !film.genres.some((g) => selectedGenres.includes(g))
      ) {
        return false;
      }
      if (q) {
        const hay =
          `${film.title} ${film.original_title} ${film.director} ${film.country} ${film.release_year}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    trimmedSearch,
    tmdbConfigured,
    watchedEntries,
    selectedYear,
    selectedCountry,
    selectedGenres,
  ]);

  const activeFilterCount =
    (selectedYear !== 'all' ? 1 : 0) +
    (selectedCountry !== 'all' ? 1 : 0) +
    (selectedGenres.length > 0 ? 1 : 0) +
    (ratingFilter !== 'all' ? 1 : 0) +
    (selectedHorrorLevels.length > 0 ? 1 : 0);

  const hasActiveFilters = isSearching || activeFilterCount > 0;

  const toggleGenre = (genre: HorrorGenre) => {
    if (selectedGenres.includes(genre)) {
      onGenresChange(selectedGenres.filter((g) => g !== genre));
    } else {
      onGenresChange([...selectedGenres, genre]);
    }
  };

  const toggleHorrorLevel = (level: HorrorLevel) => {
    if (selectedHorrorLevels.includes(level)) {
      setSelectedHorrorLevels(selectedHorrorLevels.filter((l) => l !== level));
    } else {
      setSelectedHorrorLevels([...selectedHorrorLevels, level]);
    }
  };

  const resetSheetFilters = () => {
    setSelectedYear('all');
    setSelectedCountry('all');
    onGenresChange([]);
    setRatingFilter('all');
    setSelectedHorrorLevels([]);
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setDebouncedQuery('');
    setExternalPage(1);
    resetSheetFilters();
  };

  const handleOpenExternalPreview = async (item: ExternalMovieSummary) => {
    const key = `${item.external_source}_${item.external_id}`;
    const existingSaved = findExistingMovieInArchive(archiveState.movies, {
      external_source: item.external_source,
      external_id: item.external_id,
      title: item.title,
      original_title: item.original_title,
      release_year: item.release_year,
    });

    setLoadingMovieKey(key);
    try {
      const { detail } = await getExternalMovieDetail(
        item.external_source,
        item.external_id
      );
      const draft = externalMovieToDraftMovie(detail, existingSaved);
      onPreviewExternalMovie(draft, isSearching);
    } catch {
      const fallbackDraft = externalMovieToDraftMovie(
        item as ExternalMovieDetail,
        existingSaved
      );
      onPreviewExternalMovie(fallbackDraft, isSearching);
    } finally {
      setLoadingMovieKey(null);
    }
  };

  const paddedCount = String(watchedEntries.length).padStart(3, '0');

  return (
    <div className="space-y-6">
      {/* Editorial Header (My Collection + 007 FILMS) */}
      <div className="flex items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <h1 className="font-display italic text-3xl md:text-4xl font-semibold text-[#F2EFE9] tracking-tight leading-none">
            My Collection
          </h1>
          <p className="mt-1.5 text-xs text-[#8C8881]">我的恐怖片档案</p>
        </div>

        <div className="text-right shrink-0">
          <div className="font-mono-num text-3xl md:text-4xl font-semibold text-[#F2EFE9] leading-none">
            {paddedCount}
          </div>
          <div className="mt-1.5 text-[10px] tracking-[0.22em] uppercase text-[#8C8881]">
            FILMS
          </div>
        </div>
      </div>

      {/* Compact Search + Filter Trigger Only */}
      <div className="space-y-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setDebouncedQuery(searchQuery.trim());
            setExternalPage(1);
          }}
          className="relative"
        >
          <Search className="h-4 w-4 text-[#8C8881] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索片名、导演、年份..."
            aria-label="搜索片库与电影数据库"
            className="w-full h-11 rounded-2xl bg-[#16161A] border border-white/[0.08] focus:border-[#C9303A] focus:outline-none pl-11 pr-10 text-sm text-[#F2EFE9] placeholder:text-[#76726B]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setDebouncedQuery('');
                setExternalPage(1);
              }}
              aria-label="清空搜索"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#8C8881] hover:text-[#F2EFE9] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>

        <div>
          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            aria-label="打开筛选面板"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#782C35] hover:bg-[#8D3540] text-[#F2EFE9] px-4 py-2 text-xs font-medium min-h-[38px] transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>筛选</span>
          </button>
        </div>
      </div>

      {/* Empty Library State */}
      {filteredEntries.length === 0 &&
      catalogMatches.length === 0 &&
      !isSearching ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#141417] py-16 px-6 text-center space-y-4">
          <p className="font-display text-2xl text-[#F2EFE9]">
            {watchedEntries.length === 0
              ? '片库暂无已看记录'
              : '没有符合条件的恐怖电影'}
          </p>
          <p className="text-xs text-[#8C8881]">
            {watchedEntries.length === 0
              ? '点击底部“+”，开始构建你的恐怖片档案。'
              : '尝试调整筛选条件或更换搜索关键词。'}
          </p>
          <div className="pt-2 flex justify-center gap-3">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="rounded-xl px-4 py-2 text-xs font-medium bg-[#18181D] border border-white/[0.1] text-[#F2EFE9] hover:border-[#C9303A] min-h-[40px] transition-colors cursor-pointer"
              >
                清除全部筛选
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAddModal}
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium bg-[#A31C24] hover:bg-[#BE222C] text-white min-h-[40px] transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>添加第一部电影</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-9">
          {/* 1. User's Watched Library (Cardless 2:3 Poster Grid, 2 columns on mobile) */}
          {filteredEntries.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-3.5 gap-y-6 sm:gap-x-5 sm:gap-y-7">
              {filteredEntries.map(({ movie, record }) => {
                const yearAndCountry = [movie.release_year, movie.country]
                  .filter(Boolean)
                  .join(' · ');
                const hoverMeta = [
                  movie.director,
                  movie.genres.slice(0, 2).join(' / '),
                  record.horror_level ? `恐怖度 ${record.horror_level}/5` : '',
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <button
                    key={movie.movie_id}
                    type="button"
                    onClick={() => onSelectMovie(movie, isSearching)}
                    className="group text-left cursor-pointer focus-visible:outline-none"
                  >
                    <div className="relative">
                      <PosterFrame
                        src={movie.poster_url}
                        title={movie.title}
                        originalTitle={movie.original_title}
                        year={movie.release_year}
                        director={movie.director}
                        aspectClassName="aspect-[2/3]"
                        roundedClassName="rounded-xl"
                        className="border-white/[0.06] group-hover:border-white/[0.2] transition-colors"
                      />

                      {/* Hover Overlay: reveals extra details */}
                      {(movie.original_title || hoverMeta || record.watch_date) && (
                        <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-t from-black/90 via-black/45 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-3 flex flex-col justify-end space-y-1">
                          {movie.original_title && (
                            <p className="font-display italic text-xs text-[#F2EFE9] line-clamp-1">
                              {movie.original_title}
                            </p>
                          )}
                          {hoverMeta && (
                            <p className="text-[11px] text-[#C7C3BB] line-clamp-2 leading-snug">
                              {hoverMeta}
                            </p>
                          )}
                          {record.watch_date && (
                            <p className="font-mono-num text-[10px] text-[#9E9A93]">
                              观看于 {record.watch_date}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Below Poster: Only Chinese Name, Year · Country, Low-Saturation Gold Score */}
                    <div className="mt-2.5 space-y-0.5">
                      <h2 className="text-sm sm:text-[15px] font-medium text-[#F2EFE9] group-hover:text-white transition-colors truncate">
                        {movie.title}
                      </h2>
                      <div className="flex items-center justify-between gap-2 text-xs text-[#858585]">
                        <span className="truncate font-mono-num">
                          {yearAndCountry || '—'}
                        </span>
                        {typeof record.rating === 'number' && (
                          <span className="inline-flex items-center gap-1 shrink-0 font-mono-num text-[#B89B5E]">
                            <Star className="h-3 w-3 fill-[#B89B5E] text-[#B89B5E]" />
                            <span>{record.rating.toFixed(1)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* 2. Integrated Online TMDB Search Results (when user searches in Library) */}
          {isSearching && tmdbConfigured !== false && (
            <section aria-label="在线片库检索结果" className="space-y-4">
              <div className="border-b border-white/[0.08] pb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg font-medium text-[#D6D1C7]">
                  在线电影库检索 · 「{trimmedSearch}」
                </h2>
                <TmdbAttribution variant="compact" />
              </div>

              {isExternalLoading && (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-[#C9303A]" />
                  <p className="text-xs text-[#8C8881]">正在从电影数据库检索...</p>
                </div>
              )}

              {!isExternalLoading && externalError && (
                <div className="rounded-2xl border border-[#C9303A]/40 bg-[#171214] py-8 px-6 text-center space-y-3">
                  <AlertCircle className="h-6 w-6 text-[#E24B55] mx-auto" />
                  <p className="text-xs text-[#F2EFE9]">{externalError}</p>
                  <button
                    type="button"
                    onClick={() => setReloadNonce((n) => n + 1)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#A31C24] hover:bg-[#BE222C] text-white text-xs font-medium px-4 py-2 cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>重试</span>
                  </button>
                </div>
              )}

              {!isExternalLoading &&
                !externalError &&
                tmdbConfigured === true &&
                externalResults.length === 0 && (
                  <p className="text-xs text-[#8C8881] py-6 text-center">
                    在线电影库暂无更多匹配结果。
                  </p>
                )}

              {!isExternalLoading &&
                !externalError &&
                externalResults.length > 0 && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-3.5 gap-y-6 sm:gap-x-5 sm:gap-y-7">
                      {externalResults.map((item) => {
                        const itemKey = `${item.external_source}_${item.external_id}`;
                        const isFetchingDetail = loadingMovieKey === itemKey;
                        const existing = findExistingMovieInArchive(
                          archiveState.movies,
                          {
                            external_source: item.external_source,
                            external_id: item.external_id,
                            title: item.title,
                            original_title: item.original_title,
                            release_year: item.release_year,
                          }
                        );

                        return (
                          <button
                            key={itemKey}
                            type="button"
                            disabled={isFetchingDetail}
                            onClick={() => void handleOpenExternalPreview(item)}
                            className="group text-left cursor-pointer focus-visible:outline-none"
                          >
                            <div className="relative">
                              <PosterFrame
                                src={item.poster_url}
                                title={item.title}
                                originalTitle={item.original_title}
                                year={item.release_year}
                                aspectClassName="aspect-[2/3]"
                                roundedClassName="rounded-xl"
                                className="border-white/[0.06] group-hover:border-white/[0.2] transition-colors"
                              />
                              {isFetchingDetail && (
                                <div className="absolute inset-0 rounded-xl bg-black/60 flex items-center justify-center">
                                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                                </div>
                              )}
                              {!isFetchingDetail &&
                                (item.original_title || item.genres.length > 0) && (
                                  <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-t from-black/90 via-black/45 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-3 flex flex-col justify-end space-y-1">
                                    {item.original_title && (
                                      <p className="font-display italic text-xs text-[#F2EFE9] line-clamp-1">
                                        {item.original_title}
                                      </p>
                                    )}
                                    {item.genres.length > 0 && (
                                      <p className="text-[11px] text-[#C7C3BB] line-clamp-1">
                                        {item.genres.slice(0, 2).join(' · ')}
                                      </p>
                                    )}
                                  </div>
                                )}
                            </div>

                            <div className="mt-2.5 space-y-0.5">
                              <h3 className="text-sm sm:text-[15px] font-medium text-[#F2EFE9] group-hover:text-white transition-colors truncate">
                                {item.title}
                              </h3>
                              <div className="flex items-center justify-between gap-2 text-xs text-[#858585]">
                                <span className="truncate font-mono-num">
                                  {[item.release_year, existing?.country]
                                    .filter(Boolean)
                                    .join(' · ') || '—'}
                                </span>
                                {typeof item.vote_average === 'number' &&
                                  item.vote_average > 0 && (
                                    <span className="inline-flex items-center gap-1 shrink-0 font-mono-num text-[#B89B5E]">
                                      <Star className="h-3 w-3 fill-[#B89B5E] text-[#B89B5E]" />
                                      <span>{item.vote_average.toFixed(1)}</span>
                                    </span>
                                  )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {externalTotalPages > 1 && (
                      <div className="flex items-center justify-between gap-4 pt-1">
                        <button
                          type="button"
                          disabled={externalPage <= 1}
                          onClick={() => {
                            setExternalPage((p) => Math.max(1, p - 1));
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#141417] border border-white/[0.08] hover:border-[#C9303A] px-4 py-2 text-xs font-medium text-[#F2EFE9] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                          <span>上一页</span>
                        </button>

                        <span className="font-mono-num text-xs text-[#8C8881]">
                          第 {externalPage} / {externalTotalPages} 页
                        </span>

                        <button
                          type="button"
                          disabled={externalPage >= externalTotalPages}
                          onClick={() => {
                            setExternalPage((p) =>
                              Math.min(externalTotalPages, p + 1)
                            );
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#141417] border border-white/[0.08] hover:border-[#C9303A] px-4 py-2 text-xs font-medium text-[#F2EFE9] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <span>下一页</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    <TmdbAttribution variant="banner" />
                  </div>
                )}
            </section>
          )}

          {/* 3. Curated Catalog Matches (Genre Drill-Down or Offline Search Fallback) */}
          {catalogMatches.length > 0 && (
            <section aria-label="精选资料库检索" className="space-y-4">
              <div className="border-b border-white/[0.08] pb-2 flex items-baseline justify-between">
                <h2 className="font-display text-lg font-medium text-[#D6D1C7]">
                  {isSearching
                    ? '资料库延伸检索'
                    : `更多「${selectedGenres.join(' / ')}」影片`}
                </h2>
                <span className="text-xs text-[#8C8881]">
                  共 {catalogMatches.length} 部
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-3.5 gap-y-6 sm:gap-x-5 sm:gap-y-7">
                {catalogMatches.map((film) => {
                  const yearAndCountry = [film.release_year, film.country]
                    .filter(Boolean)
                    .join(' · ');

                  return (
                    <button
                      key={film.catalog_id}
                      type="button"
                      onClick={() => onSelectCatalogFilm(film, isSearching)}
                      className="group text-left cursor-pointer focus-visible:outline-none"
                    >
                      <div className="relative">
                        <PosterFrame
                          src={film.poster_url}
                          title={film.title}
                          originalTitle={film.original_title}
                          year={film.release_year}
                          director={film.director}
                          aspectClassName="aspect-[2/3]"
                          roundedClassName="rounded-xl"
                          className="border-white/[0.06] group-hover:border-white/[0.2] transition-colors"
                        />
                        <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-t from-black/90 via-black/45 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-3 flex flex-col justify-end space-y-1">
                          {film.original_title && (
                            <p className="font-display italic text-xs text-[#F2EFE9] line-clamp-1">
                              {film.original_title}
                            </p>
                          )}
                          <p className="text-[11px] text-[#C7C3BB] line-clamp-2 leading-snug">
                            {[film.director, film.genres.slice(0, 2).join(' / ')]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2.5 space-y-0.5">
                        <h3 className="text-sm sm:text-[15px] font-medium text-[#F2EFE9] group-hover:text-white transition-colors truncate">
                          {film.title}
                        </h3>
                        <div className="text-xs text-[#858585] truncate font-mono-num">
                          {yearAndCountry || '—'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Bottom Sheet Filter Panel */}
      {filterSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="筛选条件面板"
          onClick={() => setFilterSheetOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-t-3xl bg-[#111114] border-t border-x border-white/[0.1] px-5 pt-3 pb-6 sm:px-6 space-y-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab Handle & Header */}
            <div className="space-y-3">
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto" />
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold text-[#F2EFE9]">
                  筛选片库
                </h2>
                <button
                  type="button"
                  onClick={() => setFilterSheetOpen(false)}
                  aria-label="关闭筛选面板"
                  className="h-9 w-9 rounded-full flex items-center justify-center text-[#8C8881] hover:text-white hover:bg-white/[0.06] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 1. Release Year */}
            <div className="space-y-2.5">
              <div className="text-xs font-medium text-[#9E9A93]">上映年份</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedYear('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs border transition-colors cursor-pointer ${
                    selectedYear === 'all'
                      ? 'bg-[#782C35] border-[#A3424E] text-white'
                      : 'bg-[#18181D] border-white/[0.08] text-[#9E9A93] hover:text-[#F2EFE9]'
                  }`}
                >
                  全部年份
                </button>
                {availableYears.map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() =>
                      setSelectedYear(
                        selectedYear === String(yr) ? 'all' : String(yr)
                      )
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono-num border transition-colors cursor-pointer ${
                      selectedYear === String(yr)
                        ? 'bg-[#782C35] border-[#A3424E] text-white'
                        : 'bg-[#18181D] border-white/[0.08] text-[#9E9A93] hover:text-[#F2EFE9]'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Country / Region */}
            <div className="space-y-2.5">
              <div className="text-xs font-medium text-[#9E9A93]">国家/地区</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCountry('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs border transition-colors cursor-pointer ${
                    selectedCountry === 'all'
                      ? 'bg-[#782C35] border-[#A3424E] text-white'
                      : 'bg-[#18181D] border-white/[0.08] text-[#9E9A93] hover:text-[#F2EFE9]'
                  }`}
                >
                  全部国家/地区
                </button>
                {availableCountries.map((country) => (
                  <button
                    key={country}
                    type="button"
                    onClick={() =>
                      setSelectedCountry(
                        selectedCountry === country ? 'all' : country
                      )
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs border transition-colors cursor-pointer ${
                      selectedCountry === country
                        ? 'bg-[#782C35] border-[#A3424E] text-white'
                        : 'bg-[#18181D] border-white/[0.08] text-[#9E9A93] hover:text-[#F2EFE9]'
                    }`}
                  >
                    {country}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Horror Genres */}
            <div className="space-y-2.5">
              <div className="text-xs font-medium text-[#9E9A93]">
                恐怖片类型（可多选）
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onGenresChange([])}
                  className={`px-3 py-1.5 rounded-xl text-xs border transition-colors cursor-pointer ${
                    selectedGenres.length === 0
                      ? 'bg-[#782C35] border-[#A3424E] text-white'
                      : 'bg-[#18181D] border-white/[0.08] text-[#9E9A93] hover:text-[#F2EFE9]'
                  }`}
                >
                  全部类型
                </button>
                {HORROR_GENRES.map((g) => {
                  const active = selectedGenres.includes(g.value);
                  return (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => toggleGenre(g.value)}
                      className={`px-3 py-1.5 rounded-xl text-xs border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#782C35] border-[#A3424E] text-white'
                          : 'bg-[#18181D] border-white/[0.08] text-[#9E9A93] hover:text-[#F2EFE9]'
                      }`}
                    >
                      {g.value}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Personal Rating */}
            <div className="space-y-2.5">
              <div className="text-xs font-medium text-[#9E9A93]">个人评分</div>
              <div className="flex flex-wrap gap-2">
                {RATING_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRatingFilter(opt.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs border transition-colors cursor-pointer ${
                      ratingFilter === opt.id
                        ? 'bg-[#782C35] border-[#A3424E] text-white'
                        : 'bg-[#18181D] border-white/[0.08] text-[#9E9A93] hover:text-[#F2EFE9]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Horror Level */}
            <div className="space-y-2.5">
              <div className="text-xs font-medium text-[#9E9A93]">
                恐怖程度（可多选）
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedHorrorLevels([])}
                  className={`px-3 py-1.5 rounded-xl text-xs border transition-colors cursor-pointer ${
                    selectedHorrorLevels.length === 0
                      ? 'bg-[#782C35] border-[#A3424E] text-white'
                      : 'bg-[#18181D] border-white/[0.08] text-[#9E9A93] hover:text-[#F2EFE9]'
                  }`}
                >
                  全部等级
                </button>
                {HORROR_LEVEL_OPTIONS.map((lvl) => {
                  const active = selectedHorrorLevels.includes(lvl);
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => toggleHorrorLevel(lvl)}
                      className={`px-3 py-1.5 rounded-xl text-xs border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#782C35] border-[#A3424E] text-white'
                          : 'bg-[#18181D] border-white/[0.08] text-[#9E9A93] hover:text-[#F2EFE9]'
                      }`}
                    >
                      {lvl} 级 · {HORROR_LEVEL_LABELS[lvl]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sheet Bottom Actions */}
            <div className="pt-2 border-t border-white/[0.08] flex items-center gap-3">
              <button
                type="button"
                onClick={resetSheetFilters}
                className="flex-1 h-11 rounded-2xl border border-white/[0.1] bg-[#18181D] text-xs font-medium text-[#D6D1C7] hover:text-white transition-colors cursor-pointer"
              >
                重置筛选
              </button>
              <button
                type="button"
                onClick={() => setFilterSheetOpen(false)}
                className="flex-[2] h-11 rounded-2xl bg-[#782C35] hover:bg-[#8D3540] text-xs font-medium text-white transition-colors cursor-pointer"
              >
                确认筛选（{filteredEntries.length} 部）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
