import { AudienceReview } from '../types/horror';

export const AUDIENCE_REVIEWS: AudienceReview[] = [];

export function getAudienceReviewsForMovie(_movie: {
  title: string;
  original_title?: string;
}): AudienceReview[] {
  return AUDIENCE_REVIEWS;
}

export interface AudienceReviewSummary {
  totalCount: number;
  averageStars: number;
  positiveCount: number;
  distribution: {
    stars: 5 | 4 | 3 | 2 | 1;
    count: number;
    pct: number;
  }[];
}

export function computeAudienceSummary(
  reviews: AudienceReview[]
): AudienceReviewSummary | null {
  if (reviews.length === 0) return null;
  const totalCount = reviews.length;
  const sum = reviews.reduce((acc, r) => acc + r.stars, 0);
  const averageStars = Number((sum / totalCount).toFixed(1));
  const positiveCount = reviews.filter((r) => r.stars >= 4).length;

  const tiers: (5 | 4 | 3 | 2 | 1)[] = [5, 4, 3, 2, 1];
  const distribution = tiers.map((stars) => {
    const count = reviews.filter((r) => r.stars === stars).length;
    return {
      stars,
      count,
      pct: Math.round((count / totalCount) * 100),
    };
  });

  return {
    totalCount,
    averageStars,
    positiveCount,
    distribution,
  };
}
