import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Film } from 'lucide-react';
import { CatalogFilm } from '../types/horror';
import { RecommendedFilm } from '../utils/storage';
import { PosterFrame } from './PosterFrame';

interface HomeViewProps {
  recommendations: RecommendedFilm[];
  onSelectRecommendation: (rec: RecommendedFilm) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  recommendations,
  onSelectRecommendation,
}) => {
  const deckRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const titleBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const dragStartRef = useRef<{
    x: number;
    scrollLeft: number;
    active: boolean;
    moved: boolean;
  }>({
    x: 0,
    scrollLeft: 0,
    active: false,
    moved: false,
  });

  const [activeIndex, setActiveIndex] = useState(0);

  const totalSlides = recommendations.length;
  const clampedIndex = totalSlides > 0 ? Math.min(activeIndex, totalSlides - 1) : 0;

  const goToSlide = useCallback(
    (index: number) => {
      if (totalSlides === 0) return;
      const target = Math.max(0, Math.min(index, totalSlides - 1));
      setActiveIndex(target);
      const container = deckRef.current;
      if (container) {
        container.scrollTo({
          left: target * container.clientWidth,
          behavior: 'smooth',
        });
      }
    },
    [totalSlides]
  );

  // Center the active title on the horizontal film-title rail
  useEffect(() => {
    const activeBtn = titleBtnRefs.current[clampedIndex];
    const rail = railRef.current;
    if (!activeBtn || !rail) return;

    const targetLeft =
      activeBtn.offsetLeft - rail.clientWidth / 2 + activeBtn.clientWidth / 2;
    rail.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: 'smooth',
    });
  }, [clampedIndex, totalSlides]);

  const handleDeckScroll = () => {
    const container = deckRef.current;
    if (!container || container.clientWidth === 0) return;
    const nextIdx = Math.round(container.scrollLeft / container.clientWidth);
    if (nextIdx !== activeIndex && nextIdx >= 0 && nextIdx < totalSlides) {
      setActiveIndex(nextIdx);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      const container = deckRef.current;
      if (!container) return;
      container.scrollTo({
        left: clampedIndex * container.clientWidth,
        behavior: 'auto',
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampedIndex]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = deckRef.current;
    if (!container) return;
    container.style.scrollSnapType = 'none';
    container.style.scrollBehavior = 'auto';
    dragStartRef.current = {
      x: e.pageX,
      scrollLeft: container.scrollLeft,
      active: true,
      moved: false,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStartRef.current.active) return;
    const container = deckRef.current;
    if (!container) return;
    const dx = e.pageX - dragStartRef.current.x;
    if (Math.abs(dx) > 6) {
      dragStartRef.current.moved = true;
    }
    container.scrollLeft = dragStartRef.current.scrollLeft - dx;
  };

  const handleMouseUpOrLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStartRef.current.active) return;
    const wasMoved = dragStartRef.current.moved;
    dragStartRef.current.active = false;
    const container = deckRef.current;
    if (container) {
      container.style.scrollSnapType = '';
      container.style.scrollBehavior = '';
    }
    const dx = e.pageX - dragStartRef.current.x;
    if (wasMoved && Math.abs(dx) > 55) {
      goToSlide(dx < 0 ? clampedIndex + 1 : clampedIndex - 1);
    } else if (wasMoved) {
      goToSlide(clampedIndex);
    }
  };

  const handlePosterClick = (rec: RecommendedFilm, idx: number) => {
    if (dragStartRef.current.moved) return;
    if (idx !== clampedIndex) {
      goToSlide(idx);
      return;
    }
    onSelectRecommendation(rec);
  };

  if (recommendations.length === 0) {
    return (
      <section className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <div className="rounded-2xl border border-white/[0.08] bg-[#141417] p-8 sm:p-10 max-w-md space-y-3">
          <Film className="h-7 w-7 text-[#C9303A] mx-auto" />
          <h1 className="font-display text-2xl font-semibold text-[#F2EFE9]">
            精选推荐片单已全部看毕
          </h1>
          <p className="text-xs text-[#8C8881] leading-relaxed">
            你已将本馆所有精选推荐恐怖片记录在案。可前往「探索」页发掘更多全球恐怖片，或点击下方“+”随时录入新片。
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="午夜选映推荐"
      className="min-h-[calc(100vh-11rem)] flex flex-col items-center justify-center py-2 sm:py-6 space-y-7"
    >
      {/* Film Title Selector Rail */}
      <div className="w-full max-w-3xl mx-auto">
        <div
          ref={railRef}
          className="flex items-center gap-6 sm:gap-8 overflow-x-auto no-scrollbar border-b border-white/[0.08] px-[22%] sm:px-[28%]"
          role="tablist"
          aria-label="推荐电影片名滑轨"
        >
          {recommendations.map((rec: { film: CatalogFilm }, idx) => {
            const isActive = idx === clampedIndex;
            return (
              <button
                key={rec.film.catalog_id}
                ref={(el) => {
                  titleBtnRefs.current[idx] = el;
                }}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => goToSlide(idx)}
                className={`relative pb-3 pt-1 font-display text-lg sm:text-2xl transition-colors whitespace-nowrap shrink-0 min-h-[44px] cursor-pointer ${
                  isActive
                    ? 'text-[#F2EFE9] font-semibold'
                    : 'text-[#8C8881] hover:text-[#D6D1C7] font-medium'
                }`}
              >
                <span>{rec.film.title}</span>
                {isActive && (
                  <span className="absolute left-0 right-0 bottom-0 h-[2px] rounded-full bg-[#C9303A]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Horizontal Snap Carousel */}
      <div
        ref={deckRef}
        onScroll={handleDeckScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className="relative w-full flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar select-none cursor-grab active:cursor-grabbing py-2"
        role="region"
        aria-roledescription="carousel"
        aria-label="推荐电影封面滑动翻页"
      >
        {recommendations.map((rec, idx) => {
          const isActive = idx === clampedIndex;
          return (
            <div
              key={rec.film.catalog_id}
              className="relative w-full shrink-0 snap-center snap-always flex flex-col items-center px-4"
              aria-hidden={!isActive}
            >
              <div className="relative w-full max-w-[280px] sm:max-w-[330px] md:max-w-[360px]">
                {isActive && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-6 rounded-3xl bg-[#A31C24]/20 blur-3xl opacity-80"
                  />
                )}
                <button
                  type="button"
                  onClick={() => handlePosterClick(rec, idx)}
                  aria-label={`查看 ${rec.film.title} 电影详情`}
                  className="relative group w-full rounded-2xl text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9303A]"
                >
                  <PosterFrame
                    src={rec.film.poster_url}
                    title={rec.film.title}
                    originalTitle={rec.film.original_title}
                    year={rec.film.release_year}
                    director={rec.film.director}
                    roundedClassName="rounded-2xl"
                    className="w-full shadow-[0_24px_60px_rgba(0,0,0,0.75)]"
                    priority={idx <= 1}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
