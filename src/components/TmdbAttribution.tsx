import React from 'react';

interface TmdbAttributionProps {
  variant?: 'compact' | 'banner';
  className?: string;
}

export const TmdbLogoSvg: React.FC<{ className?: string }> = ({
  className = 'h-3.5 w-auto',
}) => (
  <svg
    viewBox="0 0 190 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="TMDB"
    className={className}
  >
    <defs>
      <linearGradient id="tmdbBrandGrad" x1="0" y1="0" x2="190" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#90CEA1" />
        <stop offset="55%" stopColor="#3CBEC9" />
        <stop offset="100%" stopColor="#00B3E5" />
      </linearGradient>
    </defs>
    <rect x="0" y="6" width="38" height="16" rx="8" fill="url(#tmdbBrandGrad)" />
    <text
      x="46"
      y="20"
      fill="url(#tmdbBrandGrad)"
      fontFamily="system-ui, -apple-system, sans-serif"
      fontWeight="800"
      fontSize="17"
      letterSpacing="1.6"
    >
      TMDB
    </text>
  </svg>
);

export const TmdbAttribution: React.FC<TmdbAttributionProps> = ({
  variant = 'compact',
  className = '',
}) => {
  if (variant === 'banner') {
    return (
      <div
        className={`rounded-2xl border border-white/[0.08] bg-[#121216] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${className}`}
      >
        <div className="flex items-center gap-3">
          <TmdbLogoSvg className="h-4 w-auto shrink-0" />
          <span className="text-xs text-[#C7C3BB]">
            电影资料与检索由 TMDB 官方 API 提供支持
          </span>
        </div>
        <span className="text-[11px] text-[#76726B]">
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-2 text-[11px] text-[#8C8881] ${className}`}
    >
      <TmdbLogoSvg className="h-3 w-auto shrink-0" />
      <span>数据来源：TMDB API（未受 TMDB 官方背书或认证）</span>
    </div>
  );
};
