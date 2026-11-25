import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  size?: 'sm' | 'md';
  showNumeric?: boolean;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  size = 'sm',
  showNumeric = false,
}) => {
  const iconClass = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  const rounded = Math.round(rating);

  return (
    <div
      className="inline-flex items-center gap-1"
      aria-label={`${rating.toFixed(1)} / 5 星`}
    >
      <div className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= rounded;
          return (
            <Star
              key={star}
              className={`${iconClass} ${
                filled
                  ? 'text-[#D4A853] fill-[#D4A853]'
                  : 'text-white/20 fill-transparent'
              }`}
              strokeWidth={1.6}
            />
          );
        })}
      </div>
      {showNumeric && (
        <span className="font-mono-num text-xs text-[#D6D1C7] ml-1">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
};
