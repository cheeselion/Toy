import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Edit3,
  Flame,
  Plus,
  Shuffle,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import {
  HORROR_GENRES,
  HorrorGenre,
  Movie,
  WatchlistPriority,
} from '../types/horror';
import { WatchlistEntry } from '../utils/storage';
import { PosterFrame } from './PosterFrame';

type WatchlistCategory = 'all' | 'priority' | 'planned' | 'uncategorized';

interface WatchlistViewProps {
  watchlistEntries: WatchlistEntry[];
  onSelectMovie: (movie: Movie) => void;
  onEditMovie: (movie: Movie) => void;
  onUpdateWatchlistItem: (
    watchlistId: string,
    patch: {
      note?: string;
      recommended_by?: string;
      planned_date?: string;
      priority?: WatchlistPriority;
    }
  ) => void;
  onMarkAsWatched: (movie: Movie) => void;
  onRemoveFromWatchlist: (movieId: string) => void;
  onOpenAddWatchlistModal: () => void;
}

const PRIORITY_BADGE: Record<
  WatchlistPriority,
  { zh: string; en: string; className: string }
> = {
  high: {
    zh: '优先观看',
    en: 'High',
    className: 'bg-[#782C35]/40 text-[#E08189]',
  },
  medium: {
    zh: '一般',
    en: 'Medium',
    className: 'bg-[#B98B65]/20 text-[#B98B65]',
  },
  low: {
    zh: '暂缓',
    en: 'Low',
    className: 'bg-white/[0.06] text-[#9E9A93]',
  },
};

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  watchlistEntries,
  onSelectMovie,
  onEditMovie,
  onUpdateWatchlistItem,
  onMarkAsWatched,
  onRemoveFromWatchlist,
  onOpenAddWatchlistModal,
}) => {
  const [activeCategory, setActiveCategory] = useState<WatchlistCategory>('all');
  const [selectedPriority, setSelectedPriority] = useState<
    WatchlistPriority | 'all'
  >('all');
  const [selectedGenres, setSelectedGenres] = useState<HorrorGenre[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const [manageMode, setManageMode] = useState(false);
  const [expandedNoteIds, setExpandedNoteIds] = useState<string[]>([]);
  const [pickedMovieId, setPickedMovieId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!filterSheetOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFilterSheetOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filterSheetOpen]);

  // Non-mutually-exclusive counts for MY LISTS
  const listCounts = useMemo(() => {
    const all = watchlistEntries.length;
    const priority = watchlistEntries.filter(
      ({ item }) => item.priority === 'high'
    ).length;
    const planned = watchlistEntries.filter(({ item }) =>
      Boolean(item.planned_date?.trim())
    ).length;
    const uncategorized = watchlistEntries.filter(
      ({ item }) => item.priority !== 'high' && !item.planned_date?.trim()
    ).length;

    return { all, priority, planned, uncategorized };
  }, [watchlistEntries]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    watchlistEntries.forEach(({ movie }) => {
      if (movie.release_year) years.add(movie.release_year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [watchlistEntries]);

  const availableCountries = useMemo(() => {
    const countries = new Set<string>();
    watchlistEntries.forEach(({ movie }) => {
      if (!movie.country) return;
      movie.country
        .split(/[/,，、]/)
        .map((c) => c.trim())
        .filter(Boolean)
        .forEach((c) => countries.add(c));
    });
    return Array.from(countries).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [watchlistEntries]);

  const filtered = useMemo(() => {
    return watchlistEntries.filter(({ movie, item }) => {
      if (activeCategory === 'priority' && item.priority !== 'high') {
        return false;
      }
      if (activeCategory === 'planned' && !item.planned_date?.trim()) {
        return false;
      }
      if (
        activeCategory === 'uncategorized' &&
        (item.priority === 'high' || Boolean(item.planned_date?.trim()))
      ) {
        return false;
      }

      if (selectedPriority !== 'all' && item.priority !== selectedPriority) {
        return false;
      }
      if (
        selectedGenres.length > 0 &&
        !movie.genres.some((g) => selectedGenres.includes(g))
      ) {
        return false;
      }
      if (selectedCountry !== 'all') {
        const parts = (movie.country || '')
          .split(/[/,，、]/)
          .map((c) => c.trim());
        if (!parts.includes(selectedCountry)) return false;
      }
      if (selectedYear !== 'all' && String(movie.release_year) !== selectedYear) {
        return false;
      }

      return true;
    });
  }, [
    watchlistEntries,
    activeCategory,
    selectedPriority,
    selectedGenres,
    selectedCountry,
    selectedYear,
  ]);

  const activeSheetFilterCount =
    (selectedPriority !== 'all' ? 1 : 0) +
    (selectedGenres.length > 0 ? 1 : 0) +
    (selectedCountry !== 'all' ? 1 : 0) +
    (selectedYear !== 'all' ? 1 : 0);

  const hasAnyFilter =
    activeCategory !== 'all' || activeSheetFilterCount > 0;

  const pickedEntry = useMemo(
    () =>
      watchlistEntries.find((e) => e.movie.movie_id === pickedMovieId) || null,
    [watchlistEntries, pickedMovieId]
  );

  const handleRandomPick = () => {
    const pool = filtered.length > 0 ? filtered : watchlistEntries;
    if (pool.length === 0) return;
    if (pool.length === 1) {
      setPickedMovieId(pool[0].movie.movie_id);
      return;
    }
    const candidates = pool.filter((e) => e.movie.movie_id !== pickedMovieId);
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    setPickedMovieId(chosen.movie.movie_id);
  };

  const toggleNoteExpand = (watchlistId: string) => {
    setExpandedNoteIds((prev) =>
      prev.includes(watchlistId)
        ? prev.filter((id) => id !== watchlistId)
        : [...prev, watchlistId]
    );
  };

  const toggleGenre = (genre: HorrorGenre) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const resetAllFilters = () => {
    setActiveCategory('all');
    setSelectedPriority('all');
    setSelectedGenres([]);
    setSelectedCountry('all');
    setSelectedYear('all');
  };

  const myListsTiles: {
    id: WatchlistCategory;
    label: string;
    count: number;
    icon: typeof Bookmark;
    iconColor: string;
  }[] = [
    {
      id: 'all',
      label: '全部待看',
      count: listCounts.all,
      icon: Bookmark,
      iconColor: 'text-[#B98B65]',
    },
    {
      id: 'priority',
      label: '优先观看',
      count: listCounts.priority,
      icon: Flame,
      iconColor: 'text-[#C95A62]',
    },
    {
      id: 'planned',
      label: '计划观看',
      count: listCounts.planned,
      icon: Calendar,
      iconColor: 'text-[#B98B65]',
    },
    {
      id: 'uncategorized',
      label: '未分类',
      count: listCounts.uncategorized,
      icon: Clapperboard,
      iconColor: 'text-[#858585]',
    },
  ];

  return (
    <div className="space-y-6">
      {/* MY LISTS 4-Quadrant Overview (Non-Mutually Exclusive Categories) */}
      <section aria-label="待看片单概览" className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-medium uppercase tracking-[0.16em] text-[#E8E2D8]">
            MY LISTS
          </h1>
          <button
            type="button"
            onClick={() => {
              setManageMode((v) => !v);
              setConfirmDeleteId(null);
            }}
            className={`text-xs uppercase tracking-[0.14em] font-medium transition-colors cursor-pointer ${
              manageMode
                ? 'text-[#B98B65]'
                : 'text-[#858585] hover:text-[#E8E2D8]'
            }`}
          >
            {manageMode ? 'DONE' : 'MANAGE'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {myListsTiles.map((tile) => {
            const Icon = tile.icon;
            const active = activeCategory === tile.id;
            return (
              <button
                key={tile.id}
                type="button"
                onClick={() =>
                  setActiveCategory((prev) =>
                    prev === tile.id && tile.id !== 'all' ? 'all' : tile.id
                  )
                }
                className={`text-left rounded-2xl border p-4 sm:p-5 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1A181B] border-[#B98B65]/55'
                    : 'bg-[#141418] border-white/[0.06] hover:border-white/[0.14]'
                }`}
              >
                <Icon className={`h-4 w-4 ${tile.iconColor}`} strokeWidth={1.7} />
                <div className="mt-2.5 font-mono-num text-2xl sm:text-3xl font-semibold text-[#E8E2D8] leading-none">
                  {String(tile.count).padStart(2, '0')}
                </div>
                <div className="mt-1.5 text-xs text-[#8C8881]">{tile.label}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Filter Trigger (Library-style) + Tonight's Pick */}
      {watchlistEntries.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterSheetOpen(true)}
              aria-label="打开待看筛选面板"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#782C35] hover:bg-[#8D3540] text-[#F2EFE9] px-4 py-2 text-xs font-medium min-h-[38px] transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>筛选</span>
              {activeSheetFilterCount > 0 && (
                <span className="ml-0.5 rounded-full bg-black/30 px-1.5 py-0.5 text-[10px] font-mono-num">
                  {activeSheetFilterCount}
                </span>
              )}
            </button>

            {hasAnyFilter && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-xs text-[#858585] hover:text-[#E8E2D8] px-2 py-1.5 transition-colors cursor-pointer"
              >
                重置
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleRandomPick}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#141418] hover:border-[#B98B65]/60 text-[#D6D1C7] hover:text-[#F2EFE9] text-xs font-medium px-3.5 py-2 min-h-[38px] transition-colors cursor-pointer"
          >
            <Shuffle className="h-3.5 w-3.5 text-[#B98B65]" />
            <span>今晚看哪部</span>
          </button>
        </div>
      )}

      {/* Random Pick Spotlight */}
      {pickedEntry && (
        <div className="rounded-2xl border border-[#782C35]/70 bg-[#171214] p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <button
            type="button"
            onClick={() => onSelectMovie(pickedEntry.movie)}
            className="w-16 sm:w-20 shrink-0 rounded-xl cursor-pointer"
          >
            <PosterFrame
              src={pickedEntry.movie.poster_url}
              title={pickedEntry.movie.title}
              originalTitle={pickedEntry.movie.original_title}
              year={pickedEntry.movie.release_year}
              roundedClassName="rounded-xl"
            />
          </button>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="text-[10px] uppercase tracking-[0.16em] text-[#B98B65]">
              TONIGHT&apos;S PICK · 今晚片目建议
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#F2EFE9] truncate">
              {pickedEntry.movie.title}
            </h2>
            <div className="text-xs text-[#8C8881]">
              {[
                pickedEntry.movie.release_year,
                pickedEntry.movie.genres[0],
                pickedEntry.movie.country,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
            {pickedEntry.item.note && (
              <p className="text-xs text-[#D6D1C7] pt-0.5 line-clamp-2">
                为什么想看：{pickedEntry.item.note}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={() => onMarkAsWatched(pickedEntry.movie)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#782C35] hover:bg-[#8E3540] text-white text-xs font-medium px-3.5 py-2 min-h-[38px] cursor-pointer whitespace-nowrap"
            >
              <Check className="h-3.5 w-3.5" />
              <span>转为已看</span>
            </button>
            <button
              type="button"
              onClick={() => setPickedMovieId(null)}
              aria-label="关闭推荐"
              className="rounded-xl p-2 text-[#8C8881] hover:text-[#F2EFE9] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Single-Row-Per-Movie List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-[#111114] py-16 px-6 text-center space-y-4">
          <p className="font-display text-2xl text-[#E8E2D8]">
            {watchlistEntries.length === 0
              ? '待看列表目前为空'
              : '该分类下暂无符合条件的电影'}
          </p>
          <p className="text-xs text-[#858585]">
            {watchlistEntries.length === 0
              ? '将想看的恐怖片加入待看，随时记下推荐人与想看的原因。'
              : '尝试切换上方列表分类或调整筛选条件。'}
          </p>
          {watchlistEntries.length === 0 && (
            <button
              type="button"
              onClick={onOpenAddWatchlistModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#782C35] hover:bg-[#8E3540] text-white text-xs font-medium px-4 py-2.5 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>添加第一部待看电影</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(({ movie, item }) => {
            const isExpanded = expandedNoteIds.includes(item.watchlist_id);
            const priorityMeta = item.priority
              ? PRIORITY_BADGE[item.priority]
              : null;
            const metaLine = [
              movie.release_year,
              movie.genres[0] || 'Horror',
              movie.country,
            ]
              .filter(Boolean)
              .join(' · ');

            return (
              <article
                key={item.watchlist_id}
                className="rounded-2xl bg-[#111114] border border-white/[0.06] hover:border-white/[0.14] p-4 sm:p-5 space-y-4 transition-colors"
              >
                {/* One Movie Per Row */}
                <div className="flex items-start gap-4 sm:gap-5">
                  <button
                    type="button"
                    onClick={() => onSelectMovie(movie)}
                    className="w-20 sm:w-24 shrink-0 cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B98B65]"
                  >
                    <PosterFrame
                      src={movie.poster_url}
                      title={movie.title}
                      originalTitle={movie.original_title}
                      year={movie.release_year}
                      director={movie.director}
                      aspectClassName="aspect-[2/3]"
                      roundedClassName="rounded-xl"
                    />
                  </button>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectMovie(movie)}
                        className="text-left min-w-0 group cursor-pointer"
                      >
                        <h2 className="font-display text-lg sm:text-xl font-semibold text-[#F2EFE9] group-hover:text-[#B98B65] transition-colors truncate">
                          {movie.title}
                        </h2>
                        {movie.original_title &&
                          movie.original_title !== movie.title && (
                            <p className="text-xs italic text-[#76726B] truncate">
                              {movie.original_title}
                            </p>
                          )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onMarkAsWatched(movie)}
                        className="hidden sm:inline-flex items-center gap-1 shrink-0 rounded-full border border-white/[0.1] bg-[#18181D] hover:border-[#782C35] hover:bg-[#782C35] text-[#D6D1C7] hover:text-white text-[11px] font-medium px-3 py-1.5 transition-colors cursor-pointer"
                      >
                        <Check className="h-3 w-3" />
                        <span>转为已看</span>
                      </button>
                    </div>

                    <div className="text-xs text-[#858585] font-mono-num truncate">
                      {metaLine || '—'}
                    </div>

                    {/* Priority & Planned Date Pills (Overlapping Allowed) */}
                    {(priorityMeta || item.planned_date) && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {priorityMeta && (
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${priorityMeta.className}`}
                          >
                            {priorityMeta.zh}
                          </span>
                        )}
                        {item.planned_date && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2.5 py-0.5 text-[11px] font-mono-num text-[#D6D1C7]">
                            <Calendar className="h-3 w-3 text-[#B98B65]" />
                            <span>{item.planned_date.replace(/-/g, '.')}</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Status + "为什么想看" Expand Trigger */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span className="text-xs text-[#76726B]">
                        已加入待看清单
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleNoteExpand(item.watchlist_id)}
                          aria-expanded={isExpanded}
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                            isExpanded
                              ? 'bg-[#B98B65]/20 text-[#B98B65]'
                              : 'bg-white/[0.05] text-[#D6D1C7] hover:text-[#B98B65]'
                          }`}
                        >
                          <span>为什么想看</span>
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onMarkAsWatched(movie)}
                          className="sm:hidden inline-flex items-center gap-1 rounded-full bg-[#782C35] text-white px-2.5 py-1 text-[11px] font-medium cursor-pointer"
                        >
                          <Check className="h-3 w-3" />
                          <span>已看</span>
                        </button>
                      </div>
                    </div>

                    {/* Quick Inline Controls in MANAGE Mode */}
                    {manageMode && (
                      <div className="mt-2 pt-2.5 border-t border-white/[0.06] flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateWatchlistItem(item.watchlist_id, {
                              priority:
                                item.priority === 'high' ? undefined : 'high',
                            })
                          }
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] border transition-colors cursor-pointer ${
                            item.priority === 'high'
                              ? 'bg-[#782C35] border-[#A3424E] text-white'
                              : 'bg-[#18181D] border-white/[0.08] text-[#9E9A93] hover:text-white'
                          }`}
                        >
                          <Flame className="h-3 w-3" />
                          <span>
                            {item.priority === 'high' ? '取消优先' : '设为优先'}
                          </span>
                        </button>

                        <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#18181D] border border-white/[0.08] px-2.5 py-1 text-[11px] text-[#9E9A93]">
                          <Calendar className="h-3 w-3 text-[#B98B65]" />
                          <input
                            type="date"
                            value={item.planned_date || ''}
                            onChange={(e) =>
                              onUpdateWatchlistItem(item.watchlist_id, {
                                planned_date: e.target.value || undefined,
                              })
                            }
                            aria-label={`设置 ${movie.title} 计划观看日期`}
                            className="bg-transparent text-[#E8E2D8] font-mono-num focus:outline-none text-[11px]"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => onEditMovie(movie)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#18181D] border border-white/[0.08] hover:border-[#B98B65] px-2.5 py-1 text-[11px] text-[#D6D1C7] cursor-pointer"
                        >
                          <Edit3 className="h-3 w-3" />
                          <span>编辑</span>
                        </button>

                        {confirmDeleteId === movie.movie_id ? (
                          <div className="inline-flex items-center gap-2 rounded-lg border border-[#782C35] bg-[#782C35]/20 px-2.5 py-1 text-[11px]">
                            <button
                              type="button"
                              onClick={() => {
                                onRemoveFromWatchlist(movie.movie_id);
                                setConfirmDeleteId(null);
                              }}
                              className="text-[#E08189] font-medium hover:underline cursor-pointer"
                            >
                              确认移除
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[#858585] hover:text-white cursor-pointer"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(movie.movie_id)}
                            aria-label={`从待看移除 ${movie.title}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#18181D] border border-white/[0.08] hover:border-[#782C35] px-2.5 py-1 text-[11px] text-[#858585] hover:text-[#E08189] cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>移除</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expandable [为什么想看] Block (Image 3 Format inside Image 2 Row) */}
                {isExpanded && (
                  <div className="rounded-2xl bg-[#16161B] border border-white/[0.06] p-4 sm:p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[#B98B65]">
                          MY WATCH NOTES
                        </div>
                        <h3 className="font-display text-lg sm:text-xl font-semibold text-[#F2EFE9] mt-0.5">
                          Why I want to watch it
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => onEditMovie(movie)}
                        className="inline-flex items-center gap-1 text-xs text-[#B98B65] hover:text-[#E8E2D8] transition-colors cursor-pointer shrink-0"
                      >
                        <Edit3 className="h-3 w-3" />
                        <span>编辑记录</span>
                      </button>
                    </div>

                    <p className="text-sm text-[#D6D1C7] leading-relaxed">
                      {item.note?.trim() ||
                        '暂未记录想看原因，点击右上角「编辑记录」可补充为什么想看或推荐人。'}
                    </p>

                    <div className="border-t border-white/[0.08] pt-3.5 space-y-2.5 text-xs">
                      {item.recommended_by && (
                        <div className="flex items-center justify-between gap-4">
                          <span className="uppercase tracking-[0.14em] text-[#858585]">
                            RECOMMENDED BY
                          </span>
                          <span className="text-[#E8E2D8] font-medium">
                            {item.recommended_by}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-4">
                        <span className="uppercase tracking-[0.14em] text-[#858585]">
                          PRIORITY
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                            priorityMeta
                              ? priorityMeta.className
                              : 'bg-white/[0.05] text-[#858585]'
                          }`}
                        >
                          {priorityMeta ? priorityMeta.en : 'Unset'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <span className="uppercase tracking-[0.14em] text-[#858585]">
                          PLANNED DATE
                        </span>
                        <span className="font-mono-num text-[#E8E2D8]">
                          {item.planned_date
                            ? item.planned_date.replace(/-/g, '.')
                            : '未定'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Bottom Sheet Filter Panel (Matching LibraryView) */}
      {filterSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="筛选待看清单面板"
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
                  筛选待看清单
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

            {/* 1. List Category */}
            <div className="space-y-2.5">
              <div className="text-xs font-medium text-[#9E9A93]">清单分类</div>
              <div className="flex flex-wrap gap-2">
                {myListsTiles.map((tile) => (
                  <button
                    key={tile.id}
                    type="button"
                    onClick={() => setActiveCategory(tile.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs border transition-colors cursor-pointer ${
                      activeCategory === tile.id
                        ? 'bg-[#782C35] border-[#A3424E] text-white'
                        : 'bg-[#18181D] border-white/[0.08] text-[#9E9A93] hover:text-[#F2EFE9]'
                    }`}
                  >
                    {tile.label}（{tile.count}）
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Priority */}
            <div className="space-y-2.5">
              <div className="text-xs font-medium text-[#9E9A93]">观看优先级</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPriority('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs border transition-colors cursor-pointer ${
                    selectedPriority === 'all'
                      ? 'bg-[#782C35] border-[#A3424E] text-white'
                      : 'bg-[#18181D] border-white/[0.08] text-[#9E9A93] hover:text-[#F2EFE9]'
                  }`}
                >
                  全部优先级
                </button>
                {(
                  [
                    { id: 'high', label: '优先观看 · High' },
                    { id: 'medium', label: '一般 · Medium' },
                    { id: 'low', label: '暂缓 · Low' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setSelectedPriority(selectedPriority === p.id ? 'all' : p.id)
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs border transition-colors cursor-pointer ${
                      selectedPriority === p.id
                        ? 'bg-[#782C35] border-[#A3424E] text-white'
                        : 'bg-[#18181D] border-white/[0.08] text-[#9E9A93] hover:text-[#F2EFE9]'
                    }`}
                  >
                    {p.label}
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
                  onClick={() => setSelectedGenres([])}
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

            {/* 4. Country / Region */}
            {availableCountries.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-xs font-medium text-[#9E9A93]">
                  国家 / 地区
                </div>
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
            )}

            {/* 5. Release Year */}
            {availableYears.length > 0 && (
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
            )}

            {/* Sheet Bottom Actions */}
            <div className="pt-2 border-t border-white/[0.08] flex items-center gap-3">
              <button
                type="button"
                onClick={resetAllFilters}
                className="flex-1 h-11 rounded-2xl border border-white/[0.1] bg-[#18181D] text-xs font-medium text-[#D6D1C7] hover:text-white transition-colors cursor-pointer"
              >
                重置筛选
              </button>
              <button
                type="button"
                onClick={() => setFilterSheetOpen(false)}
                className="flex-[2] h-11 rounded-2xl bg-[#782C35] hover:bg-[#8D3540] text-xs font-medium text-white transition-colors cursor-pointer"
              >
                确认筛选（{filtered.length} 部）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
