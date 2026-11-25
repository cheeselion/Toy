import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Check, ChevronLeft, Edit3, Lock, Star, Trash2 } from 'lucide-react';
import {
  computeAudienceSummary,
  getAudienceReviewsForMovie,
} from '../data/reviews';
import { HorrorGenre, Movie, WatchlistItem, WatchRecord } from '../types/horror';
import { ScareMeter } from './ScareMeter';
import { StarRating } from './StarRating';
import { TmdbAttribution } from './TmdbAttribution';

type PositiveFilter = 'all_positive' | '5_stars' | '4_stars';
type FullReviewFilter = 'all' | 'positive' | 'neutral' | 'negative';

interface MovieDetailModalProps {
  movie: Movie | null;
  watchRecord?: WatchRecord;
  watchlistItem?: WatchlistItem;
  recommendationReasons?: string[];
  isSavedMovie?: boolean;
  reviewAccessMode?: 'positiveOnly' | 'full';
  onClose: () => void;
  onEdit: (movie: Movie) => void;
  onDelete: (movieId: string) => void;
  onToggleWatchlist: (movie: Movie) => void;
  onMarkAsWatched: (movie: Movie) => void;
  onSelectGenre?: (genre: HorrorGenre) => void;
}

export const MovieDetailModal: React.FC<MovieDetailModalProps> = ({
  movie,
  watchRecord,
  watchlistItem,
  recommendationReasons,
  isSavedMovie = true,
  reviewAccessMode = 'positiveOnly',
  onClose,
  onEdit,
  onDelete,
  onToggleWatchlist,
  onMarkAsWatched,
  onSelectGenre,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const reviewsSectionRef = useRef<HTMLElement | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [positiveFilter, setPositiveFilter] =
    useState<PositiveFilter>('all_positive');
  const [fullFilter, setFullFilter] = useState<FullReviewFilter>('all');
  const [isActionBarPinned, setIsActionBarPinned] = useState(false);

  const updatePinnedState = useCallback(() => {
    const container = scrollContainerRef.current;
    const reviewsEl = reviewsSectionRef.current;
    if (!container || !reviewsEl) return;

    const hasOverflow = container.scrollHeight > container.clientHeight + 8;
    const containerRect = container.getBoundingClientRect();
    const reviewsRect = reviewsEl.getBoundingClientRect();
    const reachedReviews =
      container.scrollTop > 16 && reviewsRect.top <= containerRect.bottom - 100;

    setIsActionBarPinned(hasOverflow && reachedReviews);
  }, []);

  useEffect(() => {
    setConfirmDelete(false);
    setPositiveFilter('all_positive');
    setFullFilter('all');
    setIsActionBarPinned(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [movie?.movie_id, reviewAccessMode]);

  useEffect(() => {
    if (!movie) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('resize', updatePinnedState);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', updatePinnedState);
    };
  }, [movie, onClose, updatePinnedState]);

  const allReviews = useMemo(
    () => (movie ? getAudienceReviewsForMovie(movie) : []),
    [movie]
  );

  const summary = useMemo(
    () => computeAudienceSummary(allReviews),
    [allReviews]
  );

  const visibleReviews = useMemo(() => {
    if (reviewAccessMode === 'positiveOnly') {
      const positives = allReviews.filter((r) => r.stars >= 4);
      if (positiveFilter === '5_stars') {
        return positives.filter((r) => r.stars === 5);
      }
      if (positiveFilter === '4_stars') {
        return positives.filter((r) => r.stars === 4);
      }
      return positives;
    }

    // Full mode (unlocked via Library search)
    if (fullFilter === 'positive') {
      return allReviews.filter((r) => r.stars >= 4);
    }
    if (fullFilter === 'neutral') {
      return allReviews.filter((r) => r.stars === 3);
    }
    if (fullFilter === 'negative') {
      return allReviews.filter((r) => r.stars <= 2);
    }
    return allReviews;
  }, [allReviews, reviewAccessMode, positiveFilter, fullFilter]);

  if (!movie) return null;

  const positive5Count = allReviews.filter((r) => r.stars === 5).length;
  const positive4Count = allReviews.filter((r) => r.stars === 4).length;
  const totalPositiveCount = positive5Count + positive4Count;
  const neutralCount = allReviews.filter((r) => r.stars === 3).length;
  const negativeCount = allReviews.filter((r) => r.stars <= 2).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-0 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="movie-detail-title"
      onClick={onClose}
    >
      <div
        ref={scrollContainerRef}
        onScroll={updatePinnedState}
        className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-[#0E0E11] border border-white/[0.12] text-[#F2EFE9] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Full-Bleed Hero Poster with Bottom Gradient Fade */}
        <div className="relative w-full h-[390px] sm:h-[460px] md:h-[500px] overflow-hidden bg-[#121216] rounded-t-2xl">
          {movie.poster_url ? (
            <img
              src={movie.poster_url}
              alt={`${movie.original_title || movie.title} Poster`}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-gradient-to-b from-[#241318] via-[#131116] to-[#0E0E11]">
              <div className="text-center space-y-2 px-6">
                <div className="h-px w-10 bg-[#A31C24] mx-auto" />
                <div className="text-[11px] tracking-[0.22em] uppercase text-[#8C8881]">
                  Horror Archive
                </div>
              </div>
            </div>
          )}

          {/* Subtle top scrim for button legibility */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 via-black/20 to-transparent"
          />

          {/* Smooth bottom gradient fade into #0E0E11 */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#0E0E11] via-[#0E0E11]/80 to-transparent"
          />

          {/* Floating Back & Watchlist Controls */}
          <div className="absolute top-4 inset-x-4 sm:top-5 sm:inset-x-6 z-10 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭详情"
              className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-md border border-white/15 text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => onToggleWatchlist(movie)}
              aria-label={watchlistItem ? '移出待看列表' : '加入待看列表'}
              className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-md border border-white/15 text-white transition-colors cursor-pointer"
            >
              <Bookmark
                className={`h-4 w-4 ${
                  watchlistItem ? 'text-[#E24B55] fill-[#E24B55]' : 'text-white'
                }`}
              />
            </button>
          </div>

          {/* Centered Title & Year inside Bottom Gradient */}
          <div className="absolute inset-x-0 bottom-4 z-10 px-6 text-center space-y-1">
            <h2
              id="movie-detail-title"
              className="font-display text-3xl sm:text-4xl md:text-[42px] font-semibold text-[#F2EFE9] leading-tight drop-shadow-[0_4px_18px_rgba(0,0,0,0.9)]"
            >
              {movie.title}
            </h2>
            {movie.original_title && movie.original_title !== movie.title && (
              <p className="font-display italic text-sm sm:text-base text-[#C7C3BB] drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]">
                {movie.original_title}
              </p>
            )}
            {(movie.release_date || movie.release_year) && (
              <div className="font-mono-num text-xs sm:text-sm text-[#D6D1C7] pt-0.5">
                {movie.release_year || movie.release_date}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 sm:px-8 pb-8 pt-2 space-y-7">
          {/* Centered Genre & Rating Pills + Metadata */}
          <div className="space-y-4 text-center">
            {(movie.genres.length > 0 ||
              (typeof movie.external_rating === 'number' && movie.external_rating > 0) ||
              typeof watchRecord?.rating === 'number') && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {movie.genres.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => onSelectGenre?.(genre)}
                    className="rounded-full px-3.5 py-1 text-xs font-medium bg-[#18181D] border border-white/[0.1] text-[#E6E1D8] hover:border-[#C9303A] hover:text-white transition-colors cursor-pointer"
                  >
                    {genre}
                  </button>
                ))}
                {typeof movie.external_rating === 'number' && movie.external_rating > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full px-3.5 py-1 text-xs font-medium font-mono-num bg-[#18181D] border border-white/[0.1] text-[#F2EFE9]">
                    <Star className="h-3 w-3 text-[#D4A853] fill-[#D4A853]" />
                    <span>{movie.external_rating.toFixed(1)}</span>
                  </span>
                )}
                {typeof watchRecord?.rating === 'number' && (
                  <span className="inline-flex items-center gap-1 rounded-full px-3.5 py-1 text-xs font-medium font-mono-num bg-[#A31C24]/25 border border-[#C9303A]/50 text-[#F2EFE9]">
                    <Star className="h-3 w-3 text-[#E24B55] fill-[#E24B55]" />
                    <span>个人 {watchRecord.rating}</span>
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs text-[#8C8881]">
              {movie.director && <span>导演：{movie.director}</span>}
              {movie.country && (
                <>
                  {movie.director && <span aria-hidden="true">·</span>}
                  <span>{movie.country}</span>
                </>
              )}
              {movie.duration && (
                <>
                  {(movie.director || movie.country) && <span aria-hidden="true">·</span>}
                  <span className="font-mono-num">{movie.duration} 分钟</span>
                </>
              )}
              {movie.release_date && (
                <>
                  {(movie.director || movie.country || movie.duration) && (
                    <span aria-hidden="true">·</span>
                  )}
                  <span className="font-mono-num">{movie.release_date}</span>
                </>
              )}
            </div>
          </div>

          {movie.synopsis && (
            <div className="space-y-2 max-w-2xl mx-auto">
              <p className="text-sm text-[#D6D1C7] leading-relaxed">
                {movie.synopsis}
              </p>
              {movie.external_source === 'tmdb' && (
                <div className="pt-1">
                  <TmdbAttribution variant="compact" />
                </div>
              )}
            </div>
          )}

          {!movie.synopsis && movie.external_source === 'tmdb' && (
            <div className="max-w-2xl mx-auto">
              <TmdbAttribution variant="compact" />
            </div>
          )}

          {/* Personal Watch Record Section */}
          {watchRecord && (
            <section className="border-t border-white/[0.08] pt-6 space-y-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-2xl font-semibold text-[#F2EFE9]">
                  个人观影记录
                </h3>
                <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#8C8881]">
                  <span className="font-mono-num">
                    观看日期：{watchRecord.watch_date || '未标注'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>方式：{watchRecord.watch_method || '未标注'}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num">
                    第 {watchRecord.watch_count} 次观看
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-[#141417] border border-white/[0.08] p-4">
                  <div className="text-xs text-[#8C8881]">个人评分</div>
                  <div className="mt-1.5 font-mono-num text-2xl font-semibold text-[#E24B55]">
                    {typeof watchRecord.rating === 'number'
                      ? watchRecord.rating
                      : '未评分'}
                    {typeof watchRecord.rating === 'number' && (
                      <span className="text-xs font-normal text-[#8C8881] ml-1">
                        / 10
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl bg-[#141417] border border-white/[0.08] p-4 space-y-2">
                  <div className="text-xs text-[#8C8881]">Scare Meter · 恐怖指数</div>
                  <ScareMeter mode="display" value={watchRecord.horror_level} />
                </div>

                <div className="rounded-2xl bg-[#141417] border border-white/[0.08] p-4">
                  <div className="text-xs text-[#8C8881]">血腥程度</div>
                  <div className="mt-1.5 text-lg font-semibold text-[#F2EFE9]">
                    {watchRecord.gore_level || '未评估'}
                  </div>
                </div>
              </div>

              {watchRecord.scare_types.length > 0 && (
                <div className="text-sm">
                  <span className="text-[#8C8881] mr-2">个人惊吓标签：</span>
                  <span className="text-[#F2EFE9]">
                    {watchRecord.scare_types.join(' · ')}
                  </span>
                </div>
              )}

              <div className="rounded-2xl bg-[#141417] border border-white/[0.08] p-5 space-y-2">
                <div className="text-xs font-medium text-[#8C8881]">个人观后感</div>
                <p className="text-sm leading-relaxed text-[#D6D1C7] whitespace-pre-line max-w-prose">
                  {watchRecord.review?.trim()
                    ? watchRecord.review
                    : '暂未撰写观后感，点击下方“编辑记录”随时记下此刻感受。'}
                </p>
              </div>
            </section>
          )}

          {/* Watchlist Note Section (MY WATCH NOTES) */}
          {!watchRecord && watchlistItem && (
            <section className="border-t border-white/[0.08] pt-6">
              <div className="rounded-2xl border border-white/[0.08] bg-[#141417] p-5 sm:p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[#B98B65]">
                      MY WATCH NOTES
                    </div>
                    <h3 className="font-display text-xl sm:text-2xl font-semibold text-[#F2EFE9] mt-0.5">
                      Why I want to watch it
                    </h3>
                  </div>
                  <span className="font-mono-num text-[11px] text-[#8C8881]">
                    加入于 {watchlistItem.added_at.slice(0, 10)}
                  </span>
                </div>

                <p className="text-sm leading-relaxed text-[#D6D1C7] max-w-prose">
                  {watchlistItem.note?.trim() || '暂无想看原因记录，点击下方“编辑记录”随时补充。'}
                </p>

                <div className="border-t border-white/[0.08] pt-4 space-y-2.5 text-xs">
                  {watchlistItem.recommended_by && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="uppercase tracking-[0.14em] text-[#858585]">
                        RECOMMENDED BY
                      </span>
                      <span className="text-[#E8E2D8] font-medium">
                        {watchlistItem.recommended_by}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-4">
                    <span className="uppercase tracking-[0.14em] text-[#858585]">
                      PRIORITY
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        watchlistItem.priority === 'high'
                          ? 'bg-[#782C35]/40 text-[#E68A92]'
                          : watchlistItem.priority === 'medium'
                            ? 'bg-[#B98B65]/20 text-[#B98B65]'
                            : watchlistItem.priority === 'low'
                              ? 'bg-white/[0.06] text-[#9E9A93]'
                              : 'bg-white/[0.04] text-[#76726B]'
                      }`}
                    >
                      {watchlistItem.priority === 'high'
                        ? 'High · 优先观看'
                        : watchlistItem.priority === 'medium'
                          ? 'Medium · 一般'
                          : watchlistItem.priority === 'low'
                            ? 'Low · 暂缓'
                            : '未设定'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="uppercase tracking-[0.14em] text-[#858585]">
                      PLANNED DATE
                    </span>
                    <span className="font-mono-num text-[#E8E2D8]">
                      {watchlistItem.planned_date
                        ? watchlistItem.planned_date.replace(/-/g, '.')
                        : '未定'}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Audience Reviews Section (5-Star System) */}
          <section
            ref={reviewsSectionRef}
            aria-label="观众评价"
            className="border-t border-white/[0.08] pt-6 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl font-semibold text-[#F2EFE9]">
                  {allReviews.length === 0
                    ? '观众评价'
                    : reviewAccessMode === 'full'
                      ? '观众总评'
                      : '精选评价'}
                </h3>
                {allReviews.length > 0 && (
                  reviewAccessMode === 'positiveOnly' ? (
                    <p className="mt-1 text-xs text-[#8C8881] flex items-center gap-1.5">
                      <Lock className="h-3 w-3 text-[#8C8881] shrink-0" />
                      <span>
                        当前仅可筛选好评（4–5 星）；完整总评需在「片库」搜索后查看
                      </span>
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-[#8C8881]">
                      已通过片库检索解锁完整星级分布与全部正反评价
                    </p>
                  )
                )}
              </div>
            </div>

            {allReviews.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.08] bg-[#141417] p-5 text-xs text-[#8C8881]">
                暂无该影片的观众评价数据。
              </div>
            ) : (
              <>
                {/* Overall Summary Panel: ONLY rendered in 'full' mode */}
                {reviewAccessMode === 'full' && summary && (
                  <div className="rounded-2xl border border-white/[0.08] bg-[#141417] p-5 grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
                    <div className="sm:col-span-4 sm:border-r sm:border-white/[0.08] sm:pr-6 space-y-2">
                      <div className="text-xs text-[#8C8881]">观众总评分</div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono-num text-4xl font-semibold text-[#F2EFE9]">
                          {summary.averageStars.toFixed(1)}
                        </span>
                        <span className="font-mono-num text-xs text-[#8C8881]">
                          / 5.0
                        </span>
                      </div>
                      <StarRating rating={summary.averageStars} size="md" />
                      <div className="text-xs text-[#8C8881] font-mono-num pt-0.5">
                        共 {summary.totalCount} 条评价 · 好评{' '}
                        {Math.round(
                          (summary.positiveCount / summary.totalCount) * 100
                        )}
                        %
                      </div>
                    </div>

                    <div className="sm:col-span-8 space-y-2">
                      {summary.distribution.map((row) => (
                        <div
                          key={row.stars}
                          className="flex items-center gap-3 text-xs"
                        >
                          <span className="font-mono-num text-[#9E9A93] w-8 shrink-0">
                            {row.stars} 星
                          </span>
                          <div className="flex-1 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                row.stars >= 4
                                  ? 'bg-[#D4A853]'
                                  : row.stars === 3
                                    ? 'bg-[#8C8881]'
                                    : 'bg-[#C9303A]'
                              }`}
                              style={{ width: `${row.pct}%` }}
                            />
                          </div>
                          <span className="font-mono-num text-[#8C8881] w-14 text-right shrink-0">
                            {row.pct}% ({row.count})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Filter Controls */}
                {reviewAccessMode === 'positiveOnly' ? (
                  <div
                    className="flex flex-wrap items-center gap-2"
                    role="group"
                    aria-label="好评星级筛选"
                  >
                    <button
                      type="button"
                      onClick={() => setPositiveFilter('all_positive')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border min-h-[36px] transition-colors cursor-pointer ${
                        positiveFilter === 'all_positive'
                          ? 'bg-[#A31C24] border-[#C9303A] text-white'
                          : 'bg-[#141417] border-white/[0.08] text-[#9E9A93] hover:text-white'
                      }`}
                    >
                      全部好评（{totalPositiveCount}）
                    </button>
                    <button
                      type="button"
                      onClick={() => setPositiveFilter('5_stars')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border min-h-[36px] transition-colors cursor-pointer ${
                        positiveFilter === '5_stars'
                          ? 'bg-[#A31C24] border-[#C9303A] text-white'
                          : 'bg-[#141417] border-white/[0.08] text-[#9E9A93] hover:text-white'
                      }`}
                    >
                      5 星力荐（{positive5Count}）
                    </button>
                    <button
                      type="button"
                      onClick={() => setPositiveFilter('4_stars')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border min-h-[36px] transition-colors cursor-pointer ${
                        positiveFilter === '4_stars'
                          ? 'bg-[#A31C24] border-[#C9303A] text-white'
                          : 'bg-[#141417] border-white/[0.08] text-[#9E9A93] hover:text-white'
                      }`}
                    >
                      4 星好评（{positive4Count}）
                    </button>
                  </div>
                ) : (
                  <div
                    className="flex flex-wrap items-center gap-2"
                    role="group"
                    aria-label="全部评价筛选"
                  >
                    <button
                      type="button"
                      onClick={() => setFullFilter('all')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border min-h-[36px] transition-colors cursor-pointer ${
                        fullFilter === 'all'
                          ? 'bg-[#A31C24] border-[#C9303A] text-white'
                          : 'bg-[#141417] border-white/[0.08] text-[#9E9A93] hover:text-white'
                      }`}
                    >
                      全部（{allReviews.length}）
                    </button>
                    <button
                      type="button"
                      onClick={() => setFullFilter('positive')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border min-h-[36px] transition-colors cursor-pointer ${
                        fullFilter === 'positive'
                          ? 'bg-[#A31C24] border-[#C9303A] text-white'
                          : 'bg-[#141417] border-white/[0.08] text-[#9E9A93] hover:text-white'
                      }`}
                    >
                      好评 4–5 星（{totalPositiveCount}）
                    </button>
                    <button
                      type="button"
                      onClick={() => setFullFilter('neutral')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border min-h-[36px] transition-colors cursor-pointer ${
                        fullFilter === 'neutral'
                          ? 'bg-[#A31C24] border-[#C9303A] text-white'
                          : 'bg-[#141417] border-white/[0.08] text-[#9E9A93] hover:text-white'
                      }`}
                    >
                      中评 3 星（{neutralCount}）
                    </button>
                    <button
                      type="button"
                      onClick={() => setFullFilter('negative')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border min-h-[36px] transition-colors cursor-pointer ${
                        fullFilter === 'negative'
                          ? 'bg-[#A31C24] border-[#C9303A] text-white'
                          : 'bg-[#141417] border-white/[0.08] text-[#9E9A93] hover:text-white'
                      }`}
                    >
                      差评 1–2 星（{negativeCount}）
                    </button>
                  </div>
                )}

                {/* Review List */}
                {visibleReviews.length === 0 ? (
                  <div className="rounded-2xl border border-white/[0.08] bg-[#141417] p-4 text-xs text-[#8C8881]">
                    当前筛选星级下暂无评价。
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleReviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="rounded-2xl border border-white/[0.08] bg-[#141417] p-4 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-[#F2EFE9]">
                              {rev.author}
                            </span>
                            <StarRating rating={rev.stars} showNumeric />
                          </div>
                          <span className="font-mono-num text-[11px] text-[#6F6C66]">
                            {rev.date}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-[#D6D1C7] max-w-prose">
                          {rev.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        {/* Action Bar: pins at bottom once user scrolls into reviews */}
        <div
          className={`px-5 sm:px-8 py-4 border-t md:rounded-b-2xl flex flex-wrap items-center justify-between gap-3 transition-colors duration-200 ${
            isActionBarPinned
              ? 'sticky bottom-0 z-20 bg-[#0E0E11]/95 backdrop-blur-md border-white/[0.14] shadow-[0_-12px_32px_rgba(0,0,0,0.65)]'
              : 'bg-[#0E0E11] border-white/[0.08]'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2.5">
            {isSavedMovie && (
              <button
                type="button"
                onClick={() => onEdit(movie)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#18181D] hover:bg-[#222229] border border-white/[0.1] text-[#F2EFE9] text-xs font-medium px-4 py-2.5 min-h-[42px] transition-colors cursor-pointer"
              >
                <Edit3 className="h-3.5 w-3.5 text-[#E24B55]" />
                <span>编辑记录</span>
              </button>
            )}

            {!watchRecord && (
              <button
                type="button"
                onClick={() => onMarkAsWatched(movie)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#A31C24] hover:bg-[#BE222C] text-white text-xs font-medium px-4 py-2.5 min-h-[42px] transition-colors cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                <span>标记为已看</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onToggleWatchlist(movie)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#18181D] hover:bg-[#222229] border border-white/[0.1] text-[#F2EFE9] text-xs font-medium px-4 py-2.5 min-h-[42px] transition-colors cursor-pointer"
            >
              <Bookmark
                className={`h-3.5 w-3.5 ${
                  watchlistItem ? 'text-[#E24B55] fill-[#E24B55]' : 'text-[#8C8881]'
                }`}
              />
              <span>{watchlistItem ? '移出待看列表' : '加入待看列表'}</span>
            </button>
          </div>

          {isSavedMovie && (
            <div>
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#141417] hover:border-[#C9303A]/60 text-[#8C8881] hover:text-[#E24B55] text-xs font-medium px-3.5 py-2.5 min-h-[42px] transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>删除记录</span>
                </button>
              ) : (
                <div className="inline-flex items-center gap-2.5 rounded-xl border border-[#C9303A] bg-[#A31C24]/15 px-3.5 py-2 min-h-[42px]">
                  <span className="text-xs text-[#F2EFE9]">确认永久删除该影片记录？</span>
                  <button
                    type="button"
                    onClick={() => onDelete(movie.movie_id)}
                    className="text-xs font-semibold text-[#E24B55] hover:underline cursor-pointer"
                  >
                    确认删除
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-[#8C8881] hover:text-white cursor-pointer"
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
