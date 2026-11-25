import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  Cloud,
  Copy,
  Download,
  History,
  LogIn,
  RotateCcw,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  HorrorArchiveState,
  HorrorGenre,
  Movie,
  SCARE_METER_LEVELS,
  ScareType,
  SyncStatusState,
} from '../types/horror';
import {
  ArchiveStatistics,
  computeArchiveStatistics,
  WatchedEntry,
} from '../utils/storage';
import { PosterFrame } from './PosterFrame';

type ReportGranularity = 'monthly' | 'quarterly' | 'annual';

interface DetectedPeriod {
  granularity: ReportGranularity;
  eyebrow: string;
  headline: string;
  volumeLabel: string;
  zhSubtitle: string;
  tagline: string;
  shortLabel: string;
  slug: string;
  anchorYear: number;
  entries: WatchedEntry[];
}

interface StatisticsViewProps {
  stats: ArchiveStatistics;
  watchedEntries: WatchedEntry[];
  archiveState: HorrorArchiveState;
  userEmail: string | null;
  syncStatus: SyncStatusState;
  onOpenAccountCenter: () => void;
  onOpenAuth: () => void;
  onSelectMovie: (movie: Movie) => void;
  onImportArchive: (jsonText: string) => { ok: boolean; message: string };
  onResetArchive: () => void;
}

const GENRE_ARCHETYPE: Record<HorrorGenre, { en: string; zh: string }> = {
  '心理恐怖': { en: 'THE PSYCHOLOGICAL SEEKER', zh: '心理恐怖爱好者' },
  '超自然 / 鬼怪': { en: 'THE SPECTRAL CHRONICLER', zh: '超自然怪谈追寻者' },
  '民俗恐怖': { en: 'THE FOLK RITUALIST', zh: '民俗禁忌探索者' },
  '宗教恐怖': { en: 'THE SACRED HERETIC', zh: '宗教异端恐怖爱好者' },
  '血腥暴力': { en: 'THE VISCERAL GOREHOUND', zh: '感官冲击爱好者' },
  '身体恐怖': { en: 'THE BODY METAMORPHIST', zh: '身体异变美学偏好者' },
  '邪典': { en: 'THE CULT REEL DEVOTEE', zh: '邪典午夜场信徒' },
  '丧尸': { en: 'THE APOCALYPSE SURVIVOR', zh: '末日丧尸片藏家' },
  '怪物': { en: 'THE CREATURE HUNTER', zh: '怪物恐怖片收藏家' },
  '生存恐怖': { en: 'THE SURVIVAL WITNESS', zh: '极限生存紧张感爱好者' },
  '伪纪录片': { en: 'THE FOUND FOOTAGE ARCHIVIST', zh: '伪纪录影像收藏家' },
  'Slasher': { en: 'THE MIDNIGHT SLASHER FAN', zh: '经典砍杀片爱好者' },
  '科幻恐怖': { en: 'THE COSMIC SCI-FI SEEKER', zh: '科幻深空恐惧爱好者' },
};

const SCARE_ARCHETYPE: Record<ScareType, { en: string; zh: string }> = {
  'Jump Scare': { en: 'SHARP JUMPSCARES', zh: '对突发声画惊吓反应最强' },
  '心理压迫': { en: 'CREEPING DREAD', zh: '最容易被心理压迫感渗透' },
  '氛围营造': { en: 'SUFFOCATING ATMOSPHERE', zh: '最沉浸于窒息级环境氛围' },
  '生理不适': { en: 'VISCERAL DISCOMFORT', zh: '对生理痛感与异变冲击最敏锐' },
  '真实感 / 代入感': { en: 'UNCANNY REALISM', zh: '最易被拟真代入感击中神经' },
  '余韵 / 后劲': { en: 'LINGERING HAUNTING', zh: '最着迷观影后的绵长余韵' },
};

function parseEntryDate(entry: WatchedEntry): Date | null {
  const raw = entry.record.watch_date || entry.record.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function detectReportPeriod(entries: WatchedEntry[]): DetectedPeriod {
  const now = new Date();
  const dated = entries
    .map((entry) => ({ entry, date: parseEntryDate(entry) }))
    .filter((item): item is { entry: WatchedEntry; date: Date } => item.date !== null);

  if (dated.length === 0) {
    const yr = now.getFullYear();
    return {
      granularity: 'monthly',
      eyebrow: 'HORROR DIARY · MONTHLY REPORT',
      headline: 'MONTH IN HORROR',
      volumeLabel: `VOL. ${yr}.${String(now.getMonth() + 1).padStart(2, '0')}`,
      zhSubtitle: `你的 ${yr} 年 ${now.getMonth() + 1} 月恐怖电影记忆`,
      tagline: 'A month of fear, obsession and unforgettable stories.',
      shortLabel: '月度报告',
      slug: `${yr}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      anchorYear: yr,
      entries: [],
    };
  }

  const timestamps = dated.map((d) => d.date.getTime());
  const minTs = Math.min(...timestamps);
  const maxTs = Math.max(...timestamps);
  const spanDays = Math.max(
    (now.getTime() - minTs) / 86400000,
    (maxTs - minTs) / 86400000
  );

  // Anchor to the latest watched date if current calendar window has 0 entries
  const latestDate = new Date(maxTs);

  if (spanDays < 45) {
    const currentMonthMatches = dated.filter(
      (d) =>
        d.date.getFullYear() === now.getFullYear() &&
        d.date.getMonth() === now.getMonth()
    );
    const anchor = currentMonthMatches.length > 0 ? now : latestDate;
    const yr = anchor.getFullYear();
    const mo = anchor.getMonth();
    const scoped = dated
      .filter((d) => d.date.getFullYear() === yr && d.date.getMonth() === mo)
      .map((d) => d.entry);

    return {
      granularity: 'monthly',
      eyebrow: 'HORROR DIARY · MONTHLY REPORT',
      headline: 'MONTH IN HORROR',
      volumeLabel: `VOL. ${yr}.${String(mo + 1).padStart(2, '0')}`,
      zhSubtitle: `你的 ${yr} 年 ${mo + 1} 月恐怖电影记忆`,
      tagline: 'A month of fear, obsession and unforgettable stories.',
      shortLabel: '月度报告',
      slug: `${yr}-${String(mo + 1).padStart(2, '0')}`,
      anchorYear: yr,
      entries: scoped,
    };
  }

  if (spanDays < 180) {
    const nowQuarter = Math.floor(now.getMonth() / 3);
    const currentQuarterMatches = dated.filter(
      (d) =>
        d.date.getFullYear() === now.getFullYear() &&
        Math.floor(d.date.getMonth() / 3) === nowQuarter
    );
    const anchor = currentQuarterMatches.length > 0 ? now : latestDate;
    const yr = anchor.getFullYear();
    const q = Math.floor(anchor.getMonth() / 3) + 1;
    const scoped = dated
      .filter(
        (d) =>
          d.date.getFullYear() === yr && Math.floor(d.date.getMonth() / 3) + 1 === q
      )
      .map((d) => d.entry);

    return {
      granularity: 'quarterly',
      eyebrow: 'HORROR DIARY · QUARTERLY REPORT',
      headline: 'QUARTER IN HORROR',
      volumeLabel: `VOL. ${yr} · Q${q}`,
      zhSubtitle: `你的 ${yr} 年第 ${q} 季度恐怖电影记忆`,
      tagline: 'A season of fear, obsession and unforgettable stories.',
      shortLabel: '季度报告',
      slug: `${yr}-Q${q}`,
      anchorYear: yr,
      entries: scoped,
    };
  }

  const currentYearMatches = dated.filter(
    (d) => d.date.getFullYear() === now.getFullYear()
  );
  const anchorYear =
    currentYearMatches.length > 0 ? now.getFullYear() : latestDate.getFullYear();
  const scoped = dated
    .filter((d) => d.date.getFullYear() === anchorYear)
    .map((d) => d.entry);

  return {
    granularity: 'annual',
    eyebrow: 'HORROR DIARY · ANNUAL REPORT',
    headline: 'YEAR IN HORROR',
    volumeLabel: `VOL. ${anchorYear}`,
    zhSubtitle: `你的 ${anchorYear} 年恐怖电影记忆`,
    tagline: 'A year of fear, obsession and unforgettable stories.',
    shortLabel: '年度报告',
    slug: `${anchorYear}`,
    anchorYear,
    entries: scoped,
  };
}

function toPercentages<T>(
  items: T[],
  getCount: (item: T) => number
): (T & { pct: number })[] {
  const total = items.reduce((sum, item) => sum + getCount(item), 0);
  if (total <= 0) return items.map((item) => ({ ...item, pct: 0 }));
  return items.map((item) => ({
    ...item,
    pct: Math.max(1, Math.round((getCount(item) / total) * 100)),
  }));
}

export const StatisticsView: React.FC<StatisticsViewProps> = ({
  stats: allTimeStats,
  watchedEntries,
  archiveState,
  userEmail,
  syncStatus,
  onOpenAccountCenter,
  onOpenAuth,
  onSelectMovie,
  onImportArchive,
  onResetArchive,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [viewAllTime, setViewAllTime] = useState(false);
  const [backupNotice, setBackupNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);

  const detectedPeriod = useMemo(
    () => detectReportPeriod(watchedEntries),
    [watchedEntries]
  );

  const activeEntries = viewAllTime ? watchedEntries : detectedPeriod.entries;
  const activeStats = useMemo(
    () =>
      viewAllTime
        ? allTimeStats
        : computeArchiveStatistics(activeEntries, detectedPeriod.anchorYear),
    [viewAllTime, allTimeStats, activeEntries, detectedPeriod.anchorYear]
  );

  const coverMeta = viewAllTime
    ? {
        eyebrow: 'HORROR DIARY · ALL-TIME ARCHIVE',
        headline: 'ARCHIVE IN HORROR',
        volumeLabel: 'ALL TIME',
        zhSubtitle: '你的全部历史恐怖电影观影档案',
        tagline: 'Every midnight screening, preserved in your personal archive.',
        slug: 'all-time',
        periodName: '全部时间',
      }
    : {
        eyebrow: detectedPeriod.eyebrow,
        headline: detectedPeriod.headline,
        volumeLabel: detectedPeriod.volumeLabel,
        zhSubtitle: detectedPeriod.zhSubtitle,
        tagline: detectedPeriod.tagline,
        slug: detectedPeriod.slug,
        periodName: detectedPeriod.shortLabel,
      };

  const avgScareVerdict =
    activeStats.averageHorrorLevel !== null
      ? SCARE_METER_LEVELS.find(
          (l) => l.level === Math.round(activeStats.averageHorrorLevel || 0)
        )
      : undefined;

  // Compute percentage-normalized rankings for the 6 editorial sections
  const genreRows = useMemo(
    () => toPercentages(activeStats.genreStats.slice(0, 4), (g) => g.count),
    [activeStats.genreStats]
  );
  const countryRows = useMemo(
    () => toPercentages(activeStats.countryStats.slice(0, 4), (c) => c.count),
    [activeStats.countryStats]
  );
  const directorRows = useMemo(
    () => toPercentages(activeStats.directorStats.slice(0, 4), (d) => d.count),
    [activeStats.directorStats]
  );
  const scareRows = useMemo(
    () => toPercentages(activeStats.scareStats.slice(0, 4), (s) => s.count),
    [activeStats.scareStats]
  );
  const decadeRows = useMemo(
    () => toPercentages(activeStats.decadeStats.slice(0, 4), (d) => d.count),
    [activeStats.decadeStats]
  );
  const monthRows = useMemo(
    () => toPercentages(activeStats.monthRanking.slice(0, 4), (m) => m.count),
    [activeStats.monthRanking]
  );

  const topGenreMeta = activeStats.favoriteGenre
    ? GENRE_ARCHETYPE[activeStats.favoriteGenre as HorrorGenre] || {
        en: 'HORROR CONNOISSEUR',
        zh: `${activeStats.favoriteGenre}爱好者`,
      }
    : { en: 'AWAITING SCREENINGS', zh: '等待记录你的第一部类型偏好' };

  const topScareMeta = activeStats.topScareType
    ? SCARE_ARCHETYPE[activeStats.topScareType] || {
        en: 'SENSORY SENSITIVITY',
        zh: `对${activeStats.topScareType}最为敏感`,
      }
    : { en: 'UNMAPPED FEARS', zh: '记录惊吓标签以解锁恐惧画像' };

  const featuredEntry =
    activeStats.highestRatedEntries[0] ||
    activeStats.scariestEntries[0] ||
    activeEntries[0] ||
    null;

  const topRatedShowcase = useMemo(() => {
    return [...activeEntries]
      .sort(
        (a, b) =>
          (b.record.rating ?? 0) - (a.record.rating ?? 0) ||
          (b.record.horror_level ?? 0) - (a.record.horror_level ?? 0)
      )
      .slice(0, 4);
  }, [activeEntries]);

  const handleExportJson = () => {
    const payload = JSON.stringify(archiveState, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `horror-diary-backup-${dateStamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setBackupNotice({ type: 'success', text: '已导出个人观影档案 JSON 备份文件。' });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const result = onImportArchive(reader.result);
        setBackupNotice({
          type: result.ok ? 'success' : 'error',
          text: result.message,
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCopyShareText = async () => {
    const topFilmsText = topRatedShowcase
      .slice(0, 3)
      .map(
        ({ movie, record }, idx) =>
          `${idx + 1}. 《${movie.title}》${
            typeof record.rating === 'number' ? ` (${record.rating.toFixed(1)})` : ''
          }`
      )
      .join('\n');

    const lines = [
      `【Horror Diary · ${coverMeta.periodName}电影年鉴】`,
      `累计观影：${activeStats.totalWatched} 部（${activeStats.totalWatchCount} 次）`,
      `平均评分：${
        activeStats.averageRating !== null
          ? `${activeStats.averageRating.toFixed(1)} / 10`
          : '暂无'
      } · 恐惧均值：${
        activeStats.averageHorrorLevel !== null
          ? `${activeStats.averageHorrorLevel.toFixed(1)} / 5`
          : '暂无'
      }`,
      `最爱类型：${activeStats.favoriteGenre || '暂无'} · 偏好国家：${
        activeStats.topCountry || '暂无'
      }`,
      `最常导演：${activeStats.favoriteDirector || '暂无'} · 最喜欢年代：${
        activeStats.favoriteDecade || '暂无'
      }`,
      topFilmsText ? `\n精选推荐片单：\n${topFilmsText}` : '',
      `\n#HorrorDiary #恐怖片片单 #观影年鉴`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(lines);
      setCopiedText(true);
      window.setTimeout(() => setCopiedText(false), 2400);
    } catch {
      setCopiedText(false);
    }
  };

  const handleDownloadAlmanacPng = async () => {
    setExportingImage(true);
    try {
      const width = 1080;
      const height = 1480;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Background
      ctx.fillStyle = '#0D0D10';
      ctx.fillRect(0, 0, width, height);

      // Subtle outer editorial frame
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 2;
      ctx.strokeRect(48, 48, width - 96, height - 96);

      // Top eyebrow & volume
      ctx.fillStyle = '#B98B65';
      ctx.font = '600 22px Inter, system-ui, sans-serif';
      ctx.fillText(`HORROR DIARY · ALMANAC`, 96, 118);

      ctx.fillStyle = '#858585';
      ctx.textAlign = 'right';
      ctx.fillText(coverMeta.volumeLabel, width - 96, 118);
      ctx.textAlign = 'left';

      // Headline
      ctx.fillStyle = '#E8E2D8';
      ctx.font = 'italic 700 62px Georgia, serif';
      ctx.fillText(coverMeta.headline, 96, 202);

      ctx.fillStyle = '#8C8881';
      ctx.font = '400 26px "PingFang SC", Inter, sans-serif';
      ctx.fillText(coverMeta.zhSubtitle, 96, 248);

      // Crimson hairline
      ctx.fillStyle = '#782C35';
      ctx.fillRect(96, 286, width - 192, 2);

      // Featured Poster Area (Attempt CORS image, fallback cleanly to typographic poster)
      const posterX = 96;
      const posterY = 330;
      const posterW = 300;
      const posterH = 450;

      ctx.fillStyle = '#17171B';
      ctx.fillRect(posterX, posterY, posterW, posterH);

      let drewImage = false;
      if (featuredEntry?.movie.poster_url) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Image load failed'));
            img.src = featuredEntry.movie.poster_url!;
          });
          ctx.save();
          ctx.beginPath();
          ctx.rect(posterX, posterY, posterW, posterH);
          ctx.clip();
          const scale = Math.max(posterW / img.width, posterH / img.height);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          ctx.drawImage(
            img,
            posterX + (posterW - drawW) / 2,
            posterY + (posterH - drawH) / 2,
            drawW,
            drawH
          );
          ctx.restore();
          drewImage = true;
        } catch {
          drewImage = false;
        }
      }

      if (!drewImage) {
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.strokeRect(posterX, posterY, posterW, posterH);
        ctx.fillStyle = '#782C35';
        ctx.fillRect(posterX + 28, posterY + 34, 48, 3);
        ctx.fillStyle = '#E8E2D8';
        ctx.font = 'italic 600 32px Georgia, serif';
        const fallbackTitle =
          featuredEntry?.movie.original_title ||
          featuredEntry?.movie.title ||
          'HORROR DIARY';
        ctx.fillText(fallbackTitle.slice(0, 18), posterX + 28, posterY + 95);
        if (featuredEntry?.movie.release_year) {
          ctx.fillStyle = '#8C8881';
          ctx.font = '400 22px Inter, sans-serif';
          ctx.fillText(
            String(featuredEntry.movie.release_year),
            posterX + 28,
            posterY + 135
          );
        }
      }

      // Right column KPI & Featured film summary
      const rightX = 444;
      ctx.fillStyle = '#B98B65';
      ctx.font = '600 20px Inter, sans-serif';
      ctx.fillText('FEATURED SELECTION', rightX, 360);

      ctx.fillStyle = '#E8E2D8';
      ctx.font = '600 38px "PingFang SC", Georgia, serif';
      ctx.fillText(
        (featuredEntry?.movie.title || '暂无观影记录').slice(0, 14),
        rightX,
        412
      );

      ctx.fillStyle = '#8C8881';
      ctx.font = '400 22px Inter, sans-serif';
      ctx.fillText(
        featuredEntry
          ? `${featuredEntry.movie.release_year} · ${
              featuredEntry.movie.director || '未知导演'
            }`
          : '记录你的第一部恐怖电影',
        rightX,
        452
      );

      // 2x2 Key Numbers inside right column
      const statCards = [
        {
          label: 'FILMS WATCHED',
          value: String(activeStats.totalWatched).padStart(2, '0'),
          color: '#E8E2D8',
        },
        {
          label: 'AVG RATING',
          value:
            activeStats.averageRating !== null
              ? activeStats.averageRating.toFixed(1)
              : '—',
          color: '#B89B5E',
        },
        {
          label: 'SCARE METER',
          value:
            activeStats.averageHorrorLevel !== null
              ? `${activeStats.averageHorrorLevel.toFixed(1)}/5`
              : '—',
          color: '#9E2A35',
        },
        {
          label: 'TOTAL VIEWS',
          value: String(activeStats.totalWatchCount).padStart(2, '0'),
          color: '#E8E2D8',
        },
      ];

      statCards.forEach((item, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const bx = rightX + col * 265;
        const by = 528 + row * 130;
        ctx.fillStyle = '#858585';
        ctx.font = '500 18px Inter, sans-serif';
        ctx.fillText(item.label, bx, by);
        ctx.fillStyle = item.color;
        ctx.font = '700 54px Inter, sans-serif';
        ctx.fillText(item.value, bx, by + 56);
      });

      // Divider before 6 traits
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(96, 830, width - 192, 1);

      const traits = [
        { label: '最喜欢的恐怖类型', value: activeStats.favoriteGenre || '—' },
        { label: '最喜欢的国家电影', value: activeStats.topCountry || '—' },
        { label: '最常观看的导演', value: activeStats.favoriteDirector || '—' },
        { label: '最容易被吓到的方式', value: activeStats.topScareType || '—' },
        { label: '最喜欢的电影年代', value: activeStats.favoriteDecade || '—' },
        { label: '最常观影的月份', value: activeStats.topMonth?.month || '—' },
      ];

      traits.forEach((trait, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const tx = 96 + col * 460;
        const ty = 890 + row * 96;
        ctx.fillStyle = '#858585';
        ctx.font = '400 20px "PingFang SC", Inter, sans-serif';
        ctx.fillText(trait.label, tx, ty);
        ctx.fillStyle = '#E8E2D8';
        ctx.font = '600 28px "PingFang SC", Georgia, serif';
        ctx.fillText(trait.value.slice(0, 16), tx, ty + 38);
      });

      // Top films list footer
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(96, 1185, width - 192, 1);

      ctx.fillStyle = '#B98B65';
      ctx.font = '600 18px Inter, sans-serif';
      ctx.fillText('ARCHIVE HIGHLIGHTS', 96, 1230);

      topRatedShowcase.slice(0, 3).forEach(({ movie, record }, idx) => {
        const ly = 1272 + idx * 42;
        ctx.fillStyle = '#E8E2D8';
        ctx.font = '500 22px "PingFang SC", Inter, sans-serif';
        ctx.fillText(
          `0${idx + 1}  ${movie.title} (${movie.release_year})`,
          96,
          ly
        );
        if (typeof record.rating === 'number') {
          ctx.fillStyle = '#B89B5E';
          ctx.textAlign = 'right';
          ctx.fillText(`★ ${record.rating.toFixed(1)}`, width - 96, ly);
          ctx.textAlign = 'left';
        }
      });

      // Signature footer
      ctx.fillStyle = '#6F6C66';
      ctx.font = '400 18px Inter, sans-serif';
      ctx.fillText('HORROR DIARY · PERSONAL CINEMA ARCHIVE', 96, 1408);

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `horror-diary-almanac-${coverMeta.slug}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setExportingImage(false);
    }
  };

  const preferenceCards = [
    {
      index: '01',
      enTitle: topGenreMeta.en,
      zhSubtitle: topGenreMeta.zh,
      sectionLabel: '最喜欢的恐怖类型',
      rows: genreRows.map((g) => ({
        key: g.genre,
        label: g.genre,
        pct: g.pct,
        meta: `${g.count} 部`,
      })),
      emptyText: '暂无类型标签数据',
    },
    {
      index: '02',
      enTitle: activeStats.topCountry
        ? `${activeStats.topCountry.toUpperCase()} CINEMA`
        : 'WORLD HORROR MAP',
      zhSubtitle: activeStats.topCountry
        ? `偏爱 ${activeStats.topCountry} 恐怖片`
        : '暂未统计国家偏好',
      sectionLabel: '最喜欢的国家电影',
      rows: countryRows.map((c) => ({
        key: c.country,
        label: c.country,
        pct: c.pct,
        meta: `${c.count} 部`,
      })),
      emptyText: '暂无国家/地区数据',
    },
    {
      index: '03',
      enTitle: activeStats.favoriteDirector
        ? activeStats.favoriteDirector.toUpperCase()
        : 'AUTEUR ARCHIVE',
      zhSubtitle: activeStats.favoriteDirector
        ? '最常重复凝视的恐怖作者'
        : '暂未统计导演偏好',
      sectionLabel: '最常观看的导演',
      rows: directorRows.map((d) => ({
        key: d.director,
        label: d.director,
        pct: d.pct,
        meta: `${d.count} 部${d.avgRating !== null ? ` · ★${d.avgRating}` : ''}`,
      })),
      emptyText: '暂无导演数据',
    },
    {
      index: '04',
      enTitle: topScareMeta.en,
      zhSubtitle: topScareMeta.zh,
      sectionLabel: '最容易被哪种方式吓到',
      rows: scareRows.map((s) => ({
        key: s.scare,
        label: s.scare,
        pct: s.pct,
        meta: `${s.count} 次`,
      })),
      emptyText: '尚未标记具体惊吓方式',
    },
    {
      index: '05',
      enTitle: activeStats.favoriteDecade
        ? `ERA OF ${activeStats.favoriteDecade.toUpperCase()}`
        : 'TIMELINE PREFERENCE',
      zhSubtitle: activeStats.favoriteDecade
        ? `最钟爱 ${activeStats.favoriteDecade} 年代影像质感`
        : '暂未统计上映年代偏好',
      sectionLabel: '最喜欢的年代',
      rows: decadeRows.map((d) => ({
        key: d.decade,
        label: d.decade,
        pct: d.pct,
        meta: `${d.count} 部`,
      })),
      emptyText: '暂无上映年代数据',
    },
    {
      index: '06',
      enTitle: activeStats.topMonth
        ? `PEAK IN ${activeStats.topMonth.month}`
        : 'SCREENING CADENCE',
      zhSubtitle: activeStats.topMonth
        ? `${activeStats.topMonth.month}观影氛围最浓（${activeStats.topMonth.count} 部）`
        : '暂未统计观影月份分布',
      sectionLabel: '最常观看的月份',
      rows: monthRows.map((m) => ({
        key: m.month,
        label: m.month,
        pct: m.pct,
        meta: `${m.count} 部`,
      })),
      emptyText: '暂无观影月份数据',
    },
  ];

  return (
    <div className="space-y-9">
      {/* Magazine Cover Header */}
      <section
        aria-label="观影周期报告封面"
        className="rounded-2xl bg-[#111114] border border-white/[0.06] px-6 py-7 sm:px-9 sm:py-9 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#B98B65]">
            {coverMeta.eyebrow}
          </span>

          <div className="flex items-center gap-3">
            <span className="font-mono-num text-[11px] tracking-[0.14em] text-[#858585]">
              {coverMeta.volumeLabel}
            </span>
            <button
              type="button"
              onClick={() => setViewAllTime((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                viewAllTime
                  ? 'bg-[#782C35] text-[#F2EFE9]'
                  : 'bg-white/[0.05] text-[#B98B65] hover:bg-white/[0.1]'
              }`}
            >
              <History className="h-3 w-3" />
              <span>
                {viewAllTime ? `返回${detectedPeriod.shortLabel}` : '全部时间'}
              </span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="font-display italic text-3xl sm:text-5xl font-semibold tracking-tight text-[#E8E2D8]">
            {coverMeta.headline}
          </h1>
          <p className="text-sm text-[#8C8881]">{coverMeta.zhSubtitle}</p>
        </div>

        <div className="border-t border-white/[0.08] pt-6 flex items-end justify-between gap-6">
          <div>
            <div className="font-mono-num text-4xl sm:text-5xl font-semibold text-[#E8E2D8] leading-none">
              {String(activeStats.totalWatched).padStart(2, '0')}
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[#858585]">
              FILMS WATCHED
            </div>
          </div>

          <div className="text-right">
            <div className="font-mono-num text-4xl sm:text-5xl font-semibold text-[#E8E2D8] leading-none">
              {String(activeStats.totalWatchCount).padStart(2, '0')}
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[#858585]">
              TOTAL VIEWS
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="h-[1px] w-full bg-[#782C35]/70" />
          <p className="text-xs text-[#8C8881] tracking-wide">{coverMeta.tagline}</p>
        </div>
      </section>

      {activeStats.totalWatched === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-[#111114] py-14 px-6 text-center space-y-3">
          <p className="font-display text-2xl text-[#E8E2D8]">
            当前周期暂无观影记录
          </p>
          <p className="text-xs text-[#858585]">
            记录一部电影或切换至「全部时间」查看你的完整历史观影档案。
          </p>
          {!viewAllTime && watchedEntries.length > 0 && (
            <button
              type="button"
              onClick={() => setViewAllTime(true)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#782C35] hover:bg-[#8E3540] text-[#F2EFE9] text-xs font-medium px-4 py-2 transition-colors cursor-pointer"
            >
              <History className="h-3.5 w-3.5" />
              <span>查看全部时间报告</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* 4 De-emphasized Summary Metrics (No heavy cards; Gold rating & Dark-Crimson Scare Meter) */}
          <section
            aria-label="核心观影指标"
            className="grid grid-cols-2 lg:grid-cols-4 border-y border-white/[0.08] divide-y sm:divide-y-0 lg:divide-x divide-white/[0.06]"
          >
            <div className="py-4 px-2 sm:px-5">
              <div className="text-[11px] text-[#858585]">
                {viewAllTime ? '累计观看电影' : `${detectedPeriod.shortLabel}观影`}
              </div>
              <div className="mt-1.5 font-mono-num text-2xl sm:text-3xl font-semibold text-[#E8E2D8]">
                {activeStats.totalWatched}
                <span className="text-xs font-normal text-[#858585] ml-1.5">部</span>
              </div>
              <div className="mt-1 text-[11px] text-[#6F6C66] font-mono-num">
                共观看 {activeStats.totalWatchCount} 次
              </div>
            </div>

            <div className="py-4 px-2 sm:px-5">
              <div className="text-[11px] text-[#858585]">
                {viewAllTime
                  ? '归档年份跨度'
                  : `${detectedPeriod.anchorYear} 年度累计`}
              </div>
              <div className="mt-1.5 font-mono-num text-2xl sm:text-3xl font-semibold text-[#E8E2D8]">
                {viewAllTime
                  ? Math.max(allTimeStats.yearlyStats.length, 1)
                  : activeStats.thisYearWatched}
                <span className="text-xs font-normal text-[#858585] ml-1.5">
                  {viewAllTime ? '年' : '部'}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-[#6F6C66]">
                {viewAllTime ? '持续记录的年份' : '当年度档案记录'}
              </div>
            </div>

            <div className="py-4 px-2 sm:px-5">
              <div className="text-[11px] text-[#858585]">平均个人评分</div>
              <div className="mt-1.5 font-mono-num text-2xl sm:text-3xl font-semibold text-[#B89B5E]">
                {activeStats.averageRating !== null
                  ? activeStats.averageRating.toFixed(1)
                  : '—'}
                <span className="text-xs font-normal text-[#858585] ml-1.5">/ 10</span>
              </div>
              <div className="mt-1 text-[11px] text-[#6F6C66]">满分 10 分制评价</div>
            </div>

            <div className="py-4 px-2 sm:px-5">
              <div className="text-[11px] text-[#858585]">Scare Meter 均值</div>
              <div className="mt-1.5 font-mono-num text-2xl sm:text-3xl font-semibold text-[#9E2A35]">
                {activeStats.averageHorrorLevel !== null
                  ? activeStats.averageHorrorLevel.toFixed(1)
                  : '—'}
                <span className="text-xs font-normal text-[#858585] ml-1.5">/ 5</span>
              </div>
              <div className="mt-1 text-[11px] text-[#6F6C66] truncate">
                {avgScareVerdict
                  ? `${avgScareVerdict.zh} · ${avgScareVerdict.en}`
                  : '主观恐怖体感均值'}
              </div>
            </div>
          </section>

          {/* 6 Editorial Preference Breakdown Sections */}
          <section
            aria-label="恐怖观影偏好画像"
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
          >
            {preferenceCards.map((card) => (
              <article
                key={card.index}
                className="rounded-2xl bg-[#111114] border border-white/[0.06] p-6 sm:p-7 flex flex-col justify-between space-y-5"
              >
                <div className="space-y-1.5">
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#B98B65]">
                    YOUR HORROR IDENTITY - {card.index}
                  </div>
                  <h2 className="font-display italic text-xl sm:text-2xl font-semibold text-[#E8E2D8] tracking-tight truncate">
                    {card.enTitle}
                  </h2>
                  <p className="text-xs text-[#8C8881]">{card.zhSubtitle}</p>
                </div>

                <div className="border-t border-white/[0.08] pt-5 space-y-4 flex-1">
                  <div className="text-xs font-medium text-[#E8E2D8]">
                    {card.sectionLabel}
                  </div>

                  {card.rows.length === 0 ? (
                    <p className="text-xs text-[#6F6C66] py-3">{card.emptyText}</p>
                  ) : (
                    <div className="space-y-3.5">
                      {card.rows.map((row) => (
                        <div key={row.key} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-[#D6D1C7] truncate">
                              {row.label}
                            </span>
                            <div className="flex items-center gap-2 shrink-0 font-mono-num">
                              <span className="text-[11px] text-[#6F6C66]">
                                {row.meta}
                              </span>
                              <span className="text-[#E8E2D8] font-medium w-9 text-right">
                                {row.pct}%
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-[#232329] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#782C35] transition-all duration-500"
                              style={{ width: `${Math.max(row.pct, 4)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </section>

          {/* Shareable Social Media Movie Almanac */}
          <section
            aria-label="可分享电影年鉴"
            className="rounded-2xl bg-[#111114] border border-white/[0.08] p-6 sm:p-8 space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/[0.08] pb-5">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-[#B98B65]">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>SHAREABLE MOVIE ALMANAC</span>
                </div>
                <h2 className="font-display text-2xl font-semibold text-[#E8E2D8]">
                  我的恐怖电影年鉴
                </h2>
                <p className="text-xs text-[#858585]">
                  生成精简排版年鉴长图或复制文本摘要，随时分享至社交媒体。
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadAlmanacPng}
                  disabled={exportingImage}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#782C35] hover:bg-[#8E3540] disabled:opacity-60 text-[#F2EFE9] text-xs font-medium px-4 py-2.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{exportingImage ? '生成中...' : '保存年鉴图片'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyShareText}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-[#18181D] hover:border-[#B98B65] text-[#E8E2D8] text-xs font-medium px-4 py-2.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {copiedText ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[#B98B65]" />
                      <span className="text-[#B98B65]">已复制文案</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-[#8C8881]" />
                      <span>复制分享文案</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Almanac Visual Card Preview */}
            <div className="rounded-2xl bg-[#0B0B0D] border border-white/[0.06] p-5 sm:p-7 space-y-6">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em]">
                <span className="text-[#B98B65]">HORROR DIARY · ALMANAC</span>
                <span className="font-mono-num text-[#858585]">
                  {coverMeta.volumeLabel}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {featuredEntry && (
                  <button
                    type="button"
                    onClick={() => onSelectMovie(featuredEntry.movie)}
                    className="md:col-span-4 flex items-center md:flex-col md:items-start gap-4 text-left group cursor-pointer"
                  >
                    <PosterFrame
                      src={featuredEntry.movie.poster_url}
                      title={featuredEntry.movie.title}
                      originalTitle={featuredEntry.movie.original_title}
                      year={featuredEntry.movie.release_year}
                      roundedClassName="rounded-xl"
                      className="w-24 md:w-36 shrink-0"
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-[#B98B65]">
                        TOP SELECTION
                      </div>
                      <div className="font-display text-lg font-semibold text-[#E8E2D8] group-hover:text-[#B98B65] transition-colors truncate">
                        {featuredEntry.movie.title}
                      </div>
                      <div className="text-xs text-[#858585] truncate">
                        {[
                          featuredEntry.movie.release_year,
                          featuredEntry.movie.director,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                  </button>
                )}

                <div
                  className={`${
                    featuredEntry ? 'md:col-span-8' : 'md:col-span-12'
                  } space-y-5`}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-white/[0.07] pb-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[#858585]">
                        观影数
                      </div>
                      <div className="mt-1 font-mono-num text-xl font-semibold text-[#E8E2D8]">
                        {activeStats.totalWatched} 部
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[#858585]">
                        平均评分
                      </div>
                      <div className="mt-1 font-mono-num text-xl font-semibold text-[#B89B5E]">
                        {activeStats.averageRating !== null
                          ? activeStats.averageRating.toFixed(1)
                          : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[#858585]">
                        恐怖均值
                      </div>
                      <div className="mt-1 font-mono-num text-xl font-semibold text-[#9E2A35]">
                        {activeStats.averageHorrorLevel !== null
                          ? `${activeStats.averageHorrorLevel.toFixed(1)} / 5`
                          : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[#858585]">
                        最爱年代
                      </div>
                      <div className="mt-1 font-mono-num text-xl font-semibold text-[#E8E2D8]">
                        {activeStats.favoriteDecade || '—'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 text-xs">
                    <div>
                      <span className="text-[#6F6C66]">最爱类型：</span>
                      <span className="text-[#E8E2D8]">
                        {activeStats.favoriteGenre || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#6F6C66]">偏好国家：</span>
                      <span className="text-[#E8E2D8]">
                        {activeStats.topCountry || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#6F6C66]">最常导演：</span>
                      <span className="text-[#E8E2D8]">
                        {activeStats.favoriteDirector || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#6F6C66]">吓点核心：</span>
                      <span className="text-[#E8E2D8]">
                        {activeStats.topScareType || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#6F6C66]">高产月份：</span>
                      <span className="text-[#E8E2D8]">
                        {activeStats.topMonth?.month || '—'}
                      </span>
                    </div>
                  </div>

                  {topRatedShowcase.length > 0 && (
                    <div className="pt-2 space-y-2">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-[#858585]">
                        PERIOD HIGHLIGHTS
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {topRatedShowcase.map(({ movie, record }) => (
                          <button
                            key={movie.movie_id}
                            type="button"
                            onClick={() => onSelectMovie(movie)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] px-3 py-1 text-xs text-[#D6D1C7] transition-colors cursor-pointer"
                          >
                            <span>{movie.title}</span>
                            {typeof record.rating === 'number' && (
                              <span className="font-mono-num text-[#B89B5E]">
                                ★{record.rating.toFixed(1)}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Archive Data Portability & Backup */}
      <section
        aria-label="档案数据备份"
        className="rounded-2xl border border-white/[0.06] bg-[#111114] p-5 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div className="space-y-1">
          <h2 className="font-display text-xl font-semibold text-[#E8E2D8]">
            本地档案持久化与备份
          </h2>
          <p className="text-xs text-[#858585] max-w-xl leading-relaxed">
            所有观影记录自动保存在当前浏览器本地存储中，可随时导出 JSON 备份文件或从备份恢复。
          </p>
          {backupNotice && (
            <p
              className={`text-xs pt-1 ${
                backupNotice.type === 'success'
                  ? 'text-[#E8E2D8]'
                  : 'text-[#9E2A35]'
              }`}
            >
              {backupNotice.text}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-[#18181D] hover:border-[#B98B65] text-[#E8E2D8] text-xs font-medium px-3.5 py-2 min-h-[40px] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5 text-[#B98B65]" />
            <span>导出备份</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-[#18181D] hover:border-[#B98B65] text-[#E8E2D8] text-xs font-medium px-3.5 py-2 min-h-[40px] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Upload className="h-3.5 w-3.5 text-[#9E9A93]" />
            <span>导入恢复</span>
          </button>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#141418] hover:border-white/[0.2] text-[#858585] hover:text-[#E8E2D8] text-xs font-medium px-3.5 py-2 min-h-[40px] transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>恢复示例档案</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-xl border border-[#782C35] bg-[#782C35]/20 px-3 py-1.5 min-h-[40px]">
              <span className="text-xs text-[#E8E2D8]">确认覆盖当前档案？</span>
              <button
                type="button"
                onClick={() => {
                  onResetArchive();
                  setConfirmReset(false);
                  setBackupNotice({
                    type: 'success',
                    text: '已恢复初始示例档案数据。',
                  });
                }}
                className="text-xs font-semibold text-[#B98B65] hover:underline px-1 cursor-pointer"
              >
                确认
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="text-xs text-[#858585] hover:text-[#E8E2D8] px-1 cursor-pointer"
              >
                取消
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Cloud Sync & Account Portal */}
      <section
        aria-label="账户与云端同步"
        className="rounded-2xl border border-white/[0.06] bg-[#111114] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-[#B98B65]" />
            <h2 className="font-display text-xl font-semibold text-[#E8E2D8]">
              {userEmail ? '云端账户同步已连接' : '可选账户与云端同步'}
            </h2>
          </div>
          <p className="text-xs text-[#858585] leading-relaxed">
            {userEmail
              ? `当前登录账户：${userEmail}（${
                  syncStatus === 'synced'
                    ? '云端已同步'
                    : syncStatus === 'syncing'
                      ? '正在同步'
                      : syncStatus === 'offline'
                        ? '离线暂存中'
                        : syncStatus === 'error'
                          ? '同步异常'
                          : '本地模式'
                }）`
              : '当前处于游客模式。如需多设备同步与云端备份，可随时登录或注册账户。'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {!userEmail && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#782C35] hover:bg-[#8E3540] text-white text-xs font-medium px-3.5 py-2 min-h-[40px] transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>登录 / 注册</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenAccountCenter}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-[#18181D] hover:border-[#B98B65] text-[#E8E2D8] text-xs font-medium px-3.5 py-2 min-h-[40px] transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>打开个人中心</span>
          </button>
        </div>
      </section>
    </div>
  );
};
