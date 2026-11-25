import React, { useEffect, useState } from 'react';
import { Film } from 'lucide-react';

interface PosterFrameProps {
  src?: string;
  title: string;
  originalTitle?: string;
  year?: number;
  director?: string;
  className?: string;
  aspectClassName?: string;
  roundedClassName?: string;
  priority?: boolean;
}

function isPureAsciiEnglish(text?: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  return /[A-Za-z]/.test(trimmed) && /^[\x20-\x7E’'–—·:!?.,&()[\]-]+$/.test(trimmed);
}

export const PosterFrame: React.FC<PosterFrameProps> = ({
  src,
  title,
  originalTitle,
  year,
  director,
  className = '',
  aspectClassName = 'aspect-[3/4]',
  roundedClassName = 'rounded-xl',
  priority = false,
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const showImage = Boolean(src && src.trim() !== '' && !hasError);
  const englishPosterTitle = isPureAsciiEnglish(originalTitle)
    ? originalTitle!.trim()
    : isPureAsciiEnglish(title)
      ? title.trim()
      : 'HORROR ARCHIVE';
  const englishDirector = isPureAsciiEnglish(director)
    ? director!.trim()
    : undefined;

  return (
    <div
      className={`relative overflow-hidden bg-[#121216] border border-white/[0.08] ${roundedClassName} ${aspectClassName} ${className}`}
    >
      {showImage ? (
        <img
          src={src}
          alt={`${englishPosterTitle} Poster`}
          referrerPolicy="no-referrer"
          loading={priority ? 'eager' : 'lazy'}
          onError={() => setHasError(true)}
          className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex h-full w-full flex-col justify-between bg-gradient-to-b from-[#1F1518] via-[#121216] to-[#0B0B0E] p-4 select-none">
          <div className="flex items-center justify-between text-[#8C8881]">
            <Film className="h-4 w-4 text-[#C9303A]" strokeWidth={1.5} />
            {year && (
              <span className="font-mono-num text-[11px] tracking-wider text-[#9E9A93]">
                {year}
              </span>
            )}
          </div>
          <div className="my-auto py-3">
            <div className="h-px w-8 bg-[#A31C24] mb-3" />
            <p className="font-display text-lg font-semibold leading-snug text-[#F2EFE9] line-clamp-3">
              {englishPosterTitle}
            </p>
            {englishDirector && (
              <p className="mt-1.5 text-xs text-[#8C8881] truncate">
                {englishDirector}
              </p>
            )}
          </div>
          <div className="text-[10px] tracking-[0.18em] uppercase text-[#6F6C66]">
            Horror Archive
          </div>
        </div>
      )}
    </div>
  );
};
