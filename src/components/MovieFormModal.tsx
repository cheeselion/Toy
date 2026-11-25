import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Globe,
  ImagePlus,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { CURATED_CATALOG } from '../data/catalog';
import {
  fetchMovieDatabaseStatus,
  findExistingMovieInArchive,
  getExternalMovieDetail,
  MovieDatabaseClientError,
  searchExternalMovies,
} from '../services/movieDatabase';
import {
  CatalogFilm,
  ExternalMovieDetail,
  ExternalMovieSource,
  ExternalMovieSummary,
  GORE_LEVELS,
  GoreLevel,
  HORROR_GENRES,
  HorrorGenre,
  HorrorLevel,
  Movie,
  MovieFormPayload,
  SCARE_TYPES,
  ScareType,
  WATCH_METHODS,
  WatchlistItem,
  WatchlistPriority,
  WatchMethod,
  WatchRecord,
  WatchStatus,
} from '../types/horror';
import { PosterFrame } from './PosterFrame';
import { ScareMeter } from './ScareMeter';
import { TmdbAttribution } from './TmdbAttribution';

interface MovieFormModalProps {
  isOpen: boolean;
  editingMovie: Movie | null;
  editingRecord?: WatchRecord;
  editingWatchlist?: WatchlistItem;
  existingMovies?: Movie[];
  initialStatus?: WatchStatus;
  defaultWatchMethod?: WatchMethod;
  onClose: () => void;
  onSave: (payload: MovieFormPayload) => void;
}

type MetadataMode = 'search' | 'matched' | 'manual';
type SearchSourceMode = 'tmdb' | 'local';

export const MovieFormModal: React.FC<MovieFormModalProps> = ({
  isOpen,
  editingMovie,
  editingRecord,
  editingWatchlist,
  existingMovies = [],
  initialStatus = 'watched',
  defaultWatchMethod = '独自',
  onClose,
  onSave,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [metadataMode, setMetadataMode] = useState<MetadataMode>('search');
  const [searchSource, setSearchSource] = useState<SearchSourceMode>('tmdb');

  // TMDB live search state
  const [tmdbConfigured, setTmdbConfigured] = useState<boolean | null>(null);
  const [tmdbResults, setTmdbResults] = useState<ExternalMovieSummary[]>([]);
  const [tmdbPage, setTmdbPage] = useState(1);
  const [tmdbTotalPages, setTmdbTotalPages] = useState(1);
  const [tmdbTotalResults, setTmdbTotalResults] = useState(0);
  const [tmdbLoading, setTmdbLoading] = useState(false);
  const [tmdbError, setTmdbError] = useState<string | null>(null);
  const [importingExternalId, setImportingExternalId] = useState<string | null>(null);
  const [previewDetail, setPreviewDetail] = useState<ExternalMovieDetail | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const searchReqIdRef = useRef(0);

  const [title, setTitle] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [releaseYear, setReleaseYear] = useState('');
  const [director, setDirector] = useState('');
  const [country, setCountry] = useState('');
  const [duration, setDuration] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [genres, setGenres] = useState<HorrorGenre[]>([]);
  const [externalSource, setExternalSource] = useState<ExternalMovieSource | undefined>(
    undefined
  );
  const [externalId, setExternalId] = useState<string | undefined>(undefined);
  const [externalRating, setExternalRating] = useState<number | undefined>(undefined);

  const [status, setStatus] = useState<WatchStatus>(initialStatus);
  const [watchDate, setWatchDate] = useState('');
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [horrorLevel, setHorrorLevel] = useState<HorrorLevel | undefined>(undefined);
  const [goreLevel, setGoreLevel] = useState<GoreLevel | undefined>(undefined);
  const [scareTypes, setScareTypes] = useState<ScareType[]>([]);
  const [watchMethod, setWatchMethod] = useState<WatchMethod>('独自');
  const [watchCount, setWatchCount] = useState(1);
  const [review, setReview] = useState('');
  const [note, setNote] = useState('');
  const [recommendedBy, setRecommendedBy] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [priority, setPriority] = useState<WatchlistPriority | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setCatalogQuery('');
    setTmdbResults([]);
    setTmdbPage(1);
    setTmdbTotalPages(1);
    setTmdbTotalResults(0);
    setTmdbError(null);
    setPreviewDetail(null);
    setImportingExternalId(null);
    setPreviewLoadingId(null);
    setMetadataMode(editingMovie ? 'matched' : 'search');

    void fetchMovieDatabaseStatus().then((st) => {
      setTmdbConfigured(st.configured);
      if (!st.configured) {
        setSearchSource('local');
      } else {
        setSearchSource('tmdb');
      }
    });

    if (editingMovie) {
      setTitle(editingMovie.title);
      setOriginalTitle(editingMovie.original_title || '');
      setPosterUrl(editingMovie.poster_url || '');
      setReleaseDate(editingMovie.release_date || '');
      setReleaseYear(
        editingMovie.release_year ? String(editingMovie.release_year) : ''
      );
      setDirector(editingMovie.director || '');
      setCountry(editingMovie.country || '');
      setDuration(editingMovie.duration ? String(editingMovie.duration) : '');
      setSynopsis(editingMovie.synopsis || '');
      setGenres(editingMovie.genres || []);
      setExternalSource(editingMovie.external_source);
      setExternalId(editingMovie.external_id);
      setExternalRating(editingMovie.external_rating);

      const resolvedStatus: WatchStatus =
        initialStatus === 'watched' && !editingRecord
          ? 'watched'
          : editingRecord
            ? 'watched'
            : editingWatchlist
              ? 'watchlist'
              : initialStatus;
      setStatus(resolvedStatus);

      setWatchDate(
        editingRecord?.watch_date || new Date().toISOString().slice(0, 10)
      );
      setRating(editingRecord?.rating);
      setHorrorLevel(editingRecord?.horror_level);
      setGoreLevel(editingRecord?.gore_level);
      setScareTypes(editingRecord?.scare_types || []);
      setWatchMethod(editingRecord?.watch_method || defaultWatchMethod);
      setWatchCount(editingRecord?.watch_count || 1);
      setReview(editingRecord?.review || '');
      setNote(editingWatchlist?.note || '');
      setRecommendedBy(editingWatchlist?.recommended_by || '');
      setPlannedDate(editingWatchlist?.planned_date || '');
      setPriority(editingWatchlist?.priority);
    } else {
      setTitle('');
      setOriginalTitle('');
      setPosterUrl('');
      setReleaseDate('');
      setReleaseYear('');
      setDirector('');
      setCountry('');
      setDuration('');
      setSynopsis('');
      setGenres([]);
      setExternalSource(undefined);
      setExternalId(undefined);
      setExternalRating(undefined);
      setStatus(initialStatus);
      setWatchDate(new Date().toISOString().slice(0, 10));
      setRating(undefined);
      setHorrorLevel(undefined);
      setGoreLevel(undefined);
      setScareTypes([]);
      setWatchMethod(defaultWatchMethod);
      setWatchCount(1);
      setReview('');
      setNote('');
      setRecommendedBy('');
      setPlannedDate('');
      setPriority(undefined);
    }
  }, [isOpen, editingMovie, editingRecord, editingWatchlist, initialStatus, defaultWatchMethod]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const executeTmdbSearch = async (queryText: string, pageNum: number) => {
    const trimmed = queryText.trim();
    if (!trimmed) {
      setTmdbResults([]);
      setTmdbTotalPages(1);
      setTmdbTotalResults(0);
      setTmdbError(null);
      return;
    }

    const reqId = ++searchReqIdRef.current;
    setTmdbLoading(true);
    setTmdbError(null);
    setPreviewDetail(null);

    try {
      const res = await searchExternalMovies({
        query: trimmed,
        page: pageNum,
        horrorOnly: false,
      });
      if (reqId !== searchReqIdRef.current) return;
      setTmdbResults(res.results);
      setTmdbPage(res.page);
      setTmdbTotalPages(res.total_pages);
      setTmdbTotalResults(res.total_results);
    } catch (err) {
      if (reqId !== searchReqIdRef.current) return;
      if (err instanceof MovieDatabaseClientError && err.code === 'TMDB_NOT_CONFIGURED') {
        setTmdbConfigured(false);
        setSearchSource('local');
        setTmdbError(null);
      } else {
        setTmdbError(
          err instanceof Error ? err.message : '检索 TMDB 电影资料失败，请稍后重试。'
        );
      }
    } finally {
      if (reqId === searchReqIdRef.current) {
        setTmdbLoading(false);
      }
    }
  };

  // Debounced live search when user types in TMDB mode
  useEffect(() => {
    if (!isOpen || metadataMode !== 'search' || searchSource !== 'tmdb') return;
    if (tmdbConfigured !== true) return;
    const trimmed = catalogQuery.trim();
    if (!trimmed) {
      setTmdbResults([]);
      setTmdbError(null);
      setTmdbTotalResults(0);
      setTmdbTotalPages(1);
      return;
    }
    const timer = window.setTimeout(() => {
      void executeTmdbSearch(trimmed, 1);
    }, 380);
    return () => window.clearTimeout(timer);
  }, [catalogQuery, isOpen, metadataMode, searchSource, tmdbConfigured]);

  const catalogMatches = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    if (!q) return CURATED_CATALOG.slice(0, 8);
    return CURATED_CATALOG.filter((film) => {
      const hay = [
        film.title,
        film.original_title,
        film.director,
        film.country,
        String(film.release_year),
        film.genres.join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    }).slice(0, 12);
  }, [catalogQuery]);

  const matchedExistingMovie = useMemo(() => {
    if (editingMovie) return undefined;
    if (!title.trim() && !externalId) return undefined;
    const parsedYear = releaseYear.trim() ? Number(releaseYear.trim()) : undefined;
    return findExistingMovieInArchive(existingMovies, {
      external_source: externalSource,
      external_id: externalId,
      title,
      original_title: originalTitle,
      release_year:
        parsedYear && !Number.isNaN(parsedYear) ? parsedYear : undefined,
    });
  }, [editingMovie, existingMovies, externalSource, externalId, title, originalTitle, releaseYear]);

  if (!isOpen) return null;

  const applyCatalogFilm = (film: CatalogFilm) => {
    setTitle(film.title);
    setOriginalTitle(film.original_title);
    setPosterUrl(film.poster_url || '');
    setReleaseDate('');
    setReleaseYear(String(film.release_year));
    setDirector(film.director);
    setCountry(film.country);
    setDuration(String(film.duration));
    setSynopsis(film.synopsis);
    setGenres(film.genres);
    setExternalSource(undefined);
    setExternalId(undefined);
    setExternalRating(undefined);
    setCatalogQuery('');
    setPreviewDetail(null);
    setMetadataMode('matched');
    setErrorMsg('');
  };

  const applyExternalDetail = (detail: ExternalMovieDetail) => {
    setTitle(detail.title);
    setOriginalTitle(detail.original_title || '');
    setPosterUrl(detail.poster_url || '');
    setReleaseDate(detail.release_date || '');
    setReleaseYear(detail.release_year ? String(detail.release_year) : '');
    setDirector(detail.director || '');
    setCountry(detail.country || '');
    setDuration(detail.duration ? String(detail.duration) : '');
    setSynopsis(detail.synopsis || '');
    setGenres(detail.genres || []);
    setExternalSource(detail.external_source);
    setExternalId(detail.external_id);
    setExternalRating(detail.vote_average);
    setPreviewDetail(null);
    setMetadataMode('matched');
    setErrorMsg('');
  };

  const handlePreviewTmdbResult = async (item: ExternalMovieSummary) => {
    setPreviewLoadingId(item.external_id);
    setTmdbError(null);
    try {
      const { detail } = await getExternalMovieDetail(
        item.external_source,
        item.external_id
      );
      setPreviewDetail(detail);
    } catch (err) {
      setTmdbError(
        err instanceof Error ? err.message : '获取电影详情预览失败，请重试。'
      );
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const handleImportTmdbResult = async (item: ExternalMovieSummary) => {
    setImportingExternalId(item.external_id);
    setTmdbError(null);
    try {
      const { detail } = await getExternalMovieDetail(
        item.external_source,
        item.external_id
      );
      applyExternalDetail(detail);
    } catch (err) {
      setTmdbError(
        err instanceof Error ? err.message : '导入电影资料失败，请重试或尝试手动录入。'
      );
    } finally {
      setImportingExternalId(null);
    }
  };

  const enterManualUpload = (prefillTitle?: string) => {
    if (prefillTitle && !title.trim()) {
      setTitle(prefillTitle.trim());
    }
    setMetadataMode('manual');
    setErrorMsg('');
  };

  const toggleGenre = (genre: HorrorGenre) => {
    setGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const toggleScareType = (scare: ScareType) => {
    setScareTypes((prev) =>
      prev.includes(scare) ? prev.filter((s) => s !== scare) : [...prev, scare]
    );
  };

  const handlePosterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const rawDataUrl = reader.result;
      const img = new Image();
      img.onload = () => {
        const maxWidth = 420;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const targetW = Math.max(1, Math.round(img.width * scale));
        const targetH = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, targetW, targetH);
          const compressed = canvas.toDataURL('image/jpeg', 0.78);
          setPosterUrl(
            compressed.length <= 240000
              ? compressed
              : canvas.toDataURL('image/jpeg', 0.55)
          );
        } else {
          setPosterUrl(rawDataUrl);
        }
      };
      img.onerror = () => setPosterUrl(rawDataUrl);
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg(
        metadataMode === 'search'
          ? '请先检索并导入电影，或点击“手动上传电影信息”。'
          : '请填写电影名称。'
      );
      return;
    }

    const parsedYear = releaseYear.trim() ? Number(releaseYear.trim()) : undefined;
    const parsedDuration = duration.trim() ? Number(duration.trim()) : undefined;

    onSave({
      movie_id: editingMovie?.movie_id || matchedExistingMovie?.movie_id,
      title: title.trim(),
      original_title: originalTitle.trim() || undefined,
      poster_url: posterUrl.trim() || undefined,
      release_date: releaseDate.trim() || undefined,
      release_year:
        parsedYear && !Number.isNaN(parsedYear) ? parsedYear : undefined,
      director: director.trim() || undefined,
      country: country.trim() || undefined,
      duration:
        parsedDuration && !Number.isNaN(parsedDuration)
          ? parsedDuration
          : undefined,
      synopsis: synopsis.trim() || undefined,
      genres,
      external_source: externalSource,
      external_id: externalId,
      external_rating: externalRating,
      status,
      watch_date: status === 'watched' ? watchDate || undefined : undefined,
      rating: status === 'watched' ? rating : undefined,
      review: status === 'watched' ? review.trim() || undefined : undefined,
      horror_level: status === 'watched' ? horrorLevel : undefined,
      gore_level: status === 'watched' ? goreLevel : undefined,
      scare_types: status === 'watched' ? scareTypes : [],
      watch_method: status === 'watched' ? watchMethod : undefined,
      watch_count: status === 'watched' ? Math.max(1, watchCount) : 1,
      note: status === 'watchlist' ? note.trim() || undefined : undefined,
      recommended_by:
        status === 'watchlist' ? recommendedBy.trim() || undefined : undefined,
      planned_date:
        status === 'watchlist' ? plannedDate.trim() || undefined : undefined,
      priority: status === 'watchlist' ? priority : undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-0 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={editingMovie ? `编辑档案：${editingMovie.title}` : '已观看或加入待看'}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-t-2xl md:rounded-2xl overflow-hidden bg-[#0E0E11] border border-white/[0.12] text-[#F2EFE9] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-3.5 border-b border-white/[0.08] bg-[#0E0E11] shrink-0">
          {editingMovie ? (
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#F2EFE9] truncate">
              {`编辑档案：${editingMovie.title}`}
            </h2>
          ) : (
            <div
              className="grid grid-cols-2 gap-2 w-56 sm:w-64"
              role="group"
              aria-label="观看状态"
            >
              <button
                type="button"
                onClick={() => setStatus('watched')}
                className={`py-2 rounded-xl text-xs sm:text-sm font-medium border min-h-[40px] transition-colors cursor-pointer ${
                  status === 'watched'
                    ? 'bg-[#A31C24] border-[#C9303A] text-white'
                    : 'bg-[#141417] border-white/[0.08] text-[#8C8881] hover:text-white'
                }`}
              >
                已观看
              </button>
              <button
                type="button"
                onClick={() => setStatus('watchlist')}
                className={`py-2 rounded-xl text-xs sm:text-sm font-medium border min-h-[40px] transition-colors cursor-pointer ${
                  status === 'watchlist'
                    ? 'bg-[#A31C24] border-[#C9303A] text-white'
                    : 'bg-[#141417] border-white/[0.08] text-[#8C8881] hover:text-white'
                }`}
              >
                加入待看
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭表单"
            className="inline-flex items-center justify-center h-9 w-9 rounded-xl text-[#8C8881] hover:text-white hover:bg-white/[0.06] transition-colors shrink-0 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="overflow-y-auto p-5 sm:p-7 space-y-7 flex-1"
        >
          {editingMovie && (
            <section>
              <div className="grid grid-cols-2 gap-2 max-w-sm">
                <button
                  type="button"
                  onClick={() => setStatus('watched')}
                  className={`py-2.5 rounded-xl text-sm font-medium border min-h-[44px] transition-colors cursor-pointer ${
                    status === 'watched'
                      ? 'bg-[#A31C24] border-[#C9303A] text-white'
                      : 'bg-[#141417] border-white/[0.08] text-[#8C8881] hover:text-white'
                  }`}
                >
                  已观看
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('watchlist')}
                  className={`py-2.5 rounded-xl text-sm font-medium border min-h-[44px] transition-colors cursor-pointer ${
                    status === 'watchlist'
                      ? 'bg-[#A31C24] border-[#C9303A] text-white'
                      : 'bg-[#141417] border-white/[0.08] text-[#8C8881] hover:text-white'
                  }`}
                >
                  加入待看
                </button>
              </div>
            </section>
          )}

          {/* Movie Info: Live TMDB Search + Local Catalog + Preview + Auto-Import OR Manual Edit */}
          {metadataMode === 'search' && !editingMovie && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div
                  className="inline-flex items-center rounded-xl border border-white/[0.08] bg-[#141417] p-1 gap-1"
                  role="group"
                  aria-label="检索来源"
                >
                  <button
                    type="button"
                    onClick={() => setSearchSource('tmdb')}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      searchSource === 'tmdb'
                        ? 'bg-[#A31C24] text-white'
                        : 'text-[#8C8881] hover:text-white'
                    }`}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span>TMDB 全球片库</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchSource('local')}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      searchSource === 'local'
                        ? 'bg-[#A31C24] text-white'
                        : 'text-[#8C8881] hover:text-white'
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>内置精选（{CURATED_CATALOG.length}）</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => enterManualUpload(catalogQuery)}
                  className="text-xs text-[#E24B55] hover:text-white hover:underline whitespace-nowrap transition-colors cursor-pointer"
                >
                  找不到？手动录入电影信息
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 text-[#6F6C66] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={catalogQuery}
                    onChange={(e) => {
                      setCatalogQuery(e.target.value);
                      if (errorMsg) setErrorMsg('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchSource === 'tmdb') {
                        e.preventDefault();
                        void executeTmdbSearch(catalogQuery, 1);
                      }
                    }}
                    placeholder={
                      searchSource === 'tmdb'
                        ? '输入中文片名、英文名、原名或关键词（如：遗传厄运 / Hereditary / 파묘）...'
                        : `搜索 ${CURATED_CATALOG.length} 部内置片库（如：招魂、咒怨、破墓、电锯惊魂）...`
                    }
                    className="w-full h-11 rounded-xl bg-[#141417] border border-white/[0.1] focus:border-[#C9303A] focus:outline-none pl-10 pr-3.5 text-sm text-[#F2EFE9] placeholder:text-[#6F6C66]"
                  />
                </div>
                {searchSource === 'tmdb' && tmdbConfigured === true && (
                  <button
                    type="button"
                    onClick={() => void executeTmdbSearch(catalogQuery, 1)}
                    disabled={!catalogQuery.trim() || tmdbLoading}
                    className="h-11 px-4 rounded-xl bg-[#1C1C22] hover:bg-[#25252D] border border-white/[0.1] text-xs font-medium text-[#F2EFE9] whitespace-nowrap shrink-0 disabled:opacity-45 transition-colors cursor-pointer"
                  >
                    搜索
                  </button>
                )}
              </div>

              {/* TMDB Mode Body */}
              {searchSource === 'tmdb' && (
                <div className="space-y-3">
                  {tmdbConfigured === false && (
                    <div className="rounded-xl border border-[#C9303A]/40 bg-[#151114] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5 text-xs">
                        <AlertCircle className="h-4 w-4 text-[#E24B55] shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-[#F2EFE9] font-medium">
                            服务端尚未配置 TMDB_API_KEY
                          </p>
                          <p className="text-[#8C8881]">
                            配置后可实时检索并自动导入全球恐怖片资料；目前可切换“内置精选”或点击手动录入。
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSearchSource('local')}
                        className="px-3 py-1.5 rounded-lg bg-[#1A1A20] border border-white/[0.1] text-xs text-[#F2EFE9] hover:border-[#C9303A] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                      >
                        使用内置片库
                      </button>
                    </div>
                  )}

                  {tmdbConfigured === true && !catalogQuery.trim() && (
                    <div className="rounded-xl border border-white/[0.06] bg-[#121216] p-4 text-xs text-[#8C8881] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span>输入任意恐怖片中文名、英文名、原名或关键词即可检索 TMDB 资料并一键填充。</span>
                      <TmdbAttribution variant="compact" />
                    </div>
                  )}

                  {tmdbLoading && (
                    <div className="rounded-xl border border-white/[0.06] bg-[#121216] py-8 flex items-center justify-center gap-2.5 text-xs text-[#9E9A93]">
                      <Loader2 className="h-4 w-4 animate-spin text-[#E24B55]" />
                      <span>正在从 TMDB 电影数据库检索影片...</span>
                    </div>
                  )}

                  {!tmdbLoading && tmdbError && (
                    <div className="rounded-xl border border-[#C9303A]/45 bg-[#151114] p-4 flex items-center justify-between gap-3">
                      <span className="text-xs text-[#E24B55]">{tmdbError}</span>
                      <button
                        type="button"
                        onClick={() => void executeTmdbSearch(catalogQuery, tmdbPage)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#1C1C22] border border-white/[0.1] px-3 py-1.5 text-xs text-[#F2EFE9] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>重试</span>
                      </button>
                    </div>
                  )}

                  {/* Inline Detail Preview Card */}
                  {previewDetail && (
                    <div className="rounded-2xl border border-[#C9303A]/50 bg-[#141419] p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3.5 min-w-0">
                          <PosterFrame
                            src={previewDetail.poster_url}
                            title={previewDetail.title}
                            originalTitle={previewDetail.original_title}
                            year={previewDetail.release_year}
                            roundedClassName="rounded-lg"
                            className="w-16 shrink-0"
                          />
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <h4 className="font-display text-lg font-semibold text-[#F2EFE9]">
                                {previewDetail.title}
                              </h4>
                              {previewDetail.original_title && (
                                <span className="text-xs italic text-[#8C8881]">
                                  {previewDetail.original_title}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#9E9A93] flex flex-wrap gap-x-2 gap-y-0.5">
                              {previewDetail.release_date && (
                                <span className="font-mono-num">
                                  上映：{previewDetail.release_date}
                                </span>
                              )}
                              {previewDetail.country && <span>{previewDetail.country}</span>}
                              {previewDetail.duration && (
                                <span className="font-mono-num">
                                  {previewDetail.duration} 分钟
                                </span>
                              )}
                              {previewDetail.director && (
                                <span>导演：{previewDetail.director}</span>
                              )}
                              {typeof previewDetail.vote_average === 'number' &&
                                previewDetail.vote_average > 0 && (
                                  <span className="text-[#D4A853] font-mono-num">
                                    TMDB {previewDetail.vote_average.toFixed(1)}
                                  </span>
                                )}
                            </div>
                            {previewDetail.genres.length > 0 && (
                              <div className="text-[11px] text-[#E24B55]">
                                {previewDetail.genres.join(' · ')}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPreviewDetail(null)}
                          aria-label="收起预览"
                          className="p-1 rounded-lg text-[#8C8881] hover:text-white cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {previewDetail.synopsis && (
                        <p className="text-xs text-[#C7C3BB] leading-relaxed line-clamp-3">
                          {previewDetail.synopsis}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <TmdbAttribution variant="compact" />
                        <button
                          type="button"
                          onClick={() => applyExternalDetail(previewDetail)}
                          className="px-4 py-2 rounded-xl bg-[#A31C24] hover:bg-[#BE222C] text-white text-xs font-medium transition-colors cursor-pointer"
                        >
                          确认导入并填充资料
                        </button>
                      </div>
                    </div>
                  )}

                  {!tmdbLoading &&
                    !tmdbError &&
                    tmdbConfigured === true &&
                    catalogQuery.trim() &&
                    tmdbResults.length === 0 && (
                      <div className="rounded-xl border border-white/[0.08] bg-[#141417] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-xs text-[#9E9A93]">
                          TMDB 暂未搜到「<span className="text-[#F2EFE9] font-medium">{catalogQuery.trim()}</span>」，可尝试英文原名或手动录入。
                        </div>
                        <button
                          type="button"
                          onClick={() => enterManualUpload(catalogQuery)}
                          className="px-3.5 py-2 rounded-xl text-xs font-medium bg-[#A31C24] hover:bg-[#BE222C] text-white whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                        >
                          手动录入这部电影
                        </button>
                      </div>
                    )}

                  {!tmdbLoading && tmdbResults.length > 0 && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                        {tmdbResults.map((item) => {
                          const isImporting = importingExternalId === item.external_id;
                          const isPreviewing = previewLoadingId === item.external_id;
                          const alreadySaved = findExistingMovieInArchive(existingMovies, {
                            external_source: item.external_source,
                            external_id: item.external_id,
                            title: item.title,
                            original_title: item.original_title,
                            release_year: item.release_year,
                          });

                          return (
                            <div
                              key={`${item.external_source}_${item.external_id}`}
                              className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#141417] border border-white/[0.07] hover:border-[#9E1B24]/60 transition-colors"
                            >
                              <button
                                type="button"
                                disabled={isImporting}
                                onClick={() => void handleImportTmdbResult(item)}
                                className="flex items-center gap-3 text-left min-w-0 flex-1 cursor-pointer"
                              >
                                <PosterFrame
                                  src={item.poster_url}
                                  title={item.title}
                                  originalTitle={item.original_title}
                                  year={item.release_year}
                                  roundedClassName="rounded-lg"
                                  className="w-10 shrink-0"
                                />
                                <div className="min-w-0 flex-1 space-y-0.5">
                                  <div className="text-xs font-semibold text-[#F2EFE9] truncate">
                                    {item.title}
                                  </div>
                                  {item.original_title &&
                                    item.original_title !== item.title && (
                                      <div className="text-[11px] text-[#8C8881] truncate">
                                        {item.original_title}
                                      </div>
                                    )}
                                  <div className="text-[11px] text-[#6F6C66] truncate font-mono-num">
                                    {item.release_year || '年份未知'}
                                    {alreadySaved ? ' · 已在个人档案中' : ''}
                                  </div>
                                </div>
                              </button>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={isPreviewing || isImporting}
                                  onClick={() => void handlePreviewTmdbResult(item)}
                                  title="预览详情"
                                  aria-label={`预览 ${item.title}`}
                                  className="p-2 rounded-lg bg-[#1B1B20] hover:bg-[#25252D] text-[#8C8881] hover:text-white transition-colors cursor-pointer"
                                >
                                  {isPreviewing ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Eye className="h-3.5 w-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  disabled={isImporting}
                                  onClick={() => void handleImportTmdbResult(item)}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#A31C24] hover:bg-[#BE222C] text-white text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer"
                                >
                                  {isImporting ? '导入中' : '导入'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[#8C8881]">
                        <TmdbAttribution variant="compact" />
                        {tmdbTotalPages > 1 && (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              disabled={tmdbPage <= 1 || tmdbLoading}
                              onClick={() =>
                                void executeTmdbSearch(catalogQuery, tmdbPage - 1)
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#141417] border border-white/[0.08] text-[#F2EFE9] disabled:opacity-40 cursor-pointer"
                            >
                              <ChevronLeft className="h-3 w-3" />
                              <span>上一页</span>
                            </button>
                            <span className="font-mono-num">
                              {tmdbPage} / {tmdbTotalPages}（共 {tmdbTotalResults} 条）
                            </span>
                            <button
                              type="button"
                              disabled={tmdbPage >= tmdbTotalPages || tmdbLoading}
                              onClick={() =>
                                void executeTmdbSearch(catalogQuery, tmdbPage + 1)
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#141417] border border-white/[0.08] text-[#F2EFE9] disabled:opacity-40 cursor-pointer"
                            >
                              <span>下一页</span>
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Local Curated Catalog Fallback Mode */}
              {searchSource === 'local' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {catalogMatches.map((film) => (
                    <button
                      key={film.catalog_id}
                      type="button"
                      onClick={() => applyCatalogFilm(film)}
                      className="flex items-center gap-3 text-left p-2.5 rounded-xl bg-[#141417] hover:bg-[#1C1C22] border border-white/[0.07] hover:border-[#9E1B24]/60 transition-colors cursor-pointer"
                    >
                      <PosterFrame
                        src={film.poster_url}
                        title={film.title}
                        originalTitle={film.original_title}
                        year={film.release_year}
                        roundedClassName="rounded-lg"
                        className="w-10 shrink-0"
                      />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="text-xs font-semibold text-[#F2EFE9] truncate">
                          {film.title}
                        </div>
                        <div className="text-[11px] text-[#8C8881] truncate">
                          {film.release_year} · {film.country} · {film.director}
                        </div>
                        <div className="text-[10px] text-[#6F6C66] truncate">
                          {film.genres.join(' / ')}
                        </div>
                      </div>
                    </button>
                  ))}
                  {catalogMatches.length === 0 && (
                    <div className="col-span-full rounded-xl border border-white/[0.08] bg-[#141417] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-xs text-[#9E9A93]">
                        内置片库暂未收录「<span className="text-[#F2EFE9] font-medium">{catalogQuery.trim()}</span>」，可切换 TMDB 全球检索或手动录入。
                      </div>
                      <button
                        type="button"
                        onClick={() => enterManualUpload(catalogQuery)}
                        className="px-3.5 py-2 rounded-xl text-xs font-medium bg-[#A31C24] hover:bg-[#BE222C] text-white whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                      >
                        手动录入这部电影
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {metadataMode === 'matched' && (
            <section className="border-t border-white/[0.08] pt-6 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-xl font-semibold text-[#F2EFE9]">
                  电影基础信息
                </h3>
                <div className="flex items-center gap-3 text-xs">
                  {!editingMovie && (
                    <button
                      type="button"
                      onClick={() => setMetadataMode('search')}
                      className="text-[#8C8881] hover:text-white transition-colors cursor-pointer"
                    >
                      更换影片
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMetadataMode('manual')}
                    className="text-[#E24B55] hover:text-white hover:underline transition-colors cursor-pointer"
                  >
                    修改基础信息
                  </button>
                </div>
              </div>

              {matchedExistingMovie && (
                <div className="rounded-xl border border-[#D4A853]/35 bg-[#1B1710] px-3.5 py-2.5 text-xs text-[#E7C983]">
                  检测到你的片库中已存在《{matchedExistingMovie.title}》，保存后将安全关联同一电影档案并保留已有观影记录，不会产生重复条目。
                </div>
              )}

              <div className="rounded-2xl border border-white/[0.08] bg-[#141417] p-4 flex items-start gap-4">
                <PosterFrame
                  src={posterUrl || undefined}
                  title={title || 'Untitled Film'}
                  originalTitle={originalTitle || undefined}
                  year={releaseYear ? Number(releaseYear) : undefined}
                  director={director || undefined}
                  roundedClassName="rounded-lg"
                  className="w-16 sm:w-20 shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <div className="font-display text-lg font-semibold text-[#F2EFE9]">
                      {title}
                    </div>
                    {originalTitle && (
                      <div className="text-xs italic text-[#8C8881]">
                        {originalTitle}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-[#9E9A93]">
                    {[
                      releaseDate || (releaseYear ? `${releaseYear} 年` : ''),
                      country,
                      duration ? `${duration} 分钟` : '',
                      director ? `导演：${director}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ') || '已选定影片基础信息'}
                  </div>
                  {genres.length > 0 && (
                    <div className="text-xs text-[#E24B55]">
                      {genres.join(' · ')}
                    </div>
                  )}
                  {synopsis && (
                    <p className="text-xs text-[#B8B4AC] line-clamp-2 leading-relaxed pt-0.5">
                      {synopsis}
                    </p>
                  )}
                  {externalSource === 'tmdb' && (
                    <div className="pt-1">
                      <TmdbAttribution variant="compact" />
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {metadataMode === 'manual' && (
            <section className="space-y-4 border-t border-white/[0.08] pt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl font-semibold text-[#F2EFE9]">
                    {editingMovie ? '修改电影基础信息' : '编辑 / 自行上传电影信息'}
                  </h3>
                  {!editingMovie && (
                    <p className="text-[11px] text-[#8C8881] mt-0.5">
                      支持编辑从数据库导入的全部字段，仅电影名称为必填
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setMetadataMode(editingMovie || title.trim() ? 'matched' : 'search')
                  }
                  className="text-xs text-[#E24B55] hover:text-white hover:underline whitespace-nowrap transition-colors cursor-pointer"
                >
                  {editingMovie
                    ? '收起基础信息'
                    : title.trim()
                      ? '完成并收起'
                      : '返回检索'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs text-[#9E9A93]">
                    电影名称 <span className="text-[#E24B55]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (errorMsg) setErrorMsg('');
                    }}
                    placeholder="例如：遗传厄运"
                    className="w-full h-11 rounded-xl bg-[#141417] border border-white/[0.1] focus:border-[#C9303A] focus:outline-none px-3.5 text-sm text-[#F2EFE9] placeholder:text-[#6F6C66]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-[#9E9A93]">外文原名</label>
                  <input
                    type="text"
                    value={originalTitle}
                    onChange={(e) => setOriginalTitle(e.target.value)}
                    placeholder="例如：Hereditary"
                    className="w-full h-11 rounded-xl bg-[#141417] border border-white/[0.1] focus:border-[#C9303A] focus:outline-none px-3.5 text-sm text-[#F2EFE9] placeholder:text-[#6F6C66]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-[#9E9A93]">导演</label>
                  <input
                    type="text"
                    value={director}
                    onChange={(e) => setDirector(e.target.value)}
                    placeholder="例如：阿里·艾斯特"
                    className="w-full h-11 rounded-xl bg-[#141417] border border-white/[0.1] focus:border-[#C9303A] focus:outline-none px-3.5 text-sm text-[#F2EFE9] placeholder:text-[#6F6C66]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-[#9E9A93]">国家 / 地区</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="例如：美国 / 日本"
                    className="w-full h-11 rounded-xl bg-[#141417] border border-white/[0.1] focus:border-[#C9303A] focus:outline-none px-3.5 text-sm text-[#F2EFE9] placeholder:text-[#6F6C66]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-[#9E9A93]">上映日期</label>
                  <input
                    type="date"
                    value={releaseDate}
                    onChange={(e) => {
                      const nextDate = e.target.value;
                      setReleaseDate(nextDate);
                      if (nextDate.length >= 4 && /^\d{4}/.test(nextDate)) {
                        setReleaseYear(nextDate.slice(0, 4));
                      }
                    }}
                    className="w-full h-11 rounded-xl bg-[#141417] border border-white/[0.1] focus:border-[#C9303A] focus:outline-none px-3.5 text-sm font-mono-num text-[#F2EFE9]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs text-[#9E9A93]">上映年份</label>
                    <input
                      type="number"
                      min={1895}
                      max={2035}
                      value={releaseYear}
                      onChange={(e) => setReleaseYear(e.target.value)}
                      placeholder="2018"
                      className="w-full h-11 rounded-xl bg-[#141417] border border-white/[0.1] focus:border-[#C9303A] focus:outline-none px-3 text-sm font-mono-num text-[#F2EFE9] placeholder:text-[#6F6C66]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs text-[#9E9A93]">时长（分钟）</label>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="127"
                      className="w-full h-11 rounded-xl bg-[#141417] border border-white/[0.1] focus:border-[#C9303A] focus:outline-none px-3 text-sm font-mono-num text-[#F2EFE9] placeholder:text-[#6F6C66]"
                    />
                  </div>
                </div>
              </div>

              {/* Poster URL & Preset Picker */}
              <div className="space-y-2.5">
                <label className="block text-xs text-[#9E9A93]">
                  电影海报（输入图片链接、上传本地图片或选用馆藏艺术海报）
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={posterUrl}
                    onChange={(e) => setPosterUrl(e.target.value)}
                    placeholder="粘贴海报图片 URL，或留空使用默认档案封面"
                    className="flex-1 h-11 rounded-xl bg-[#141417] border border-white/[0.1] focus:border-[#C9303A] focus:outline-none px-3.5 text-sm text-[#F2EFE9] placeholder:text-[#6F6C66]"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePosterUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-1.5 px-4 h-11 rounded-xl bg-[#18181D] hover:bg-[#222229] border border-white/[0.1] text-xs font-medium text-[#F2EFE9] transition-colors shrink-0 cursor-pointer"
                  >
                    <ImagePlus className="h-4 w-4 text-[#E24B55]" />
                    <span>上传本地海报</span>
                  </button>
                </div>

                {posterUrl && (
                  <div className="flex items-center justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setPosterUrl('')}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] text-[#8C8881] hover:text-[#E24B55] whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      清除海报
                    </button>
                  </div>
                )}
              </div>

              {/* Horror Genres Multi-Select */}
              <div className="space-y-2">
                <label className="block text-xs text-[#9E9A93]">
                  恐怖片类型标签（可多选）
                </label>
                <div className="flex flex-wrap gap-2">
                  {HORROR_GENRES.map((g) => {
                    const active = genres.includes(g.value);
                    return (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => toggleGenre(g.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs border min-h-[36px] transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#A31C24] border-[#C9303A] text-white font-medium'
                            : 'bg-[#141417] border-white/[0.08] text-[#8C8881] hover:text-white'
                        }`}
                      >
                        {g.value}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs text-[#9E9A93]">电影简介</label>
                <textarea
                  rows={2}
                  value={synopsis}
                  onChange={(e) => setSynopsis(e.target.value)}
                  placeholder="简述剧情背景或核心设定..."
                  className="w-full rounded-xl bg-[#141417] border border-white/[0.1] focus:border-[#C9303A] focus:outline-none p-3.5 text-sm text-[#F2EFE9] placeholder:text-[#6F6C66]"
                />
              </div>
            </section>
          )}

          {/* Conditional Watch Record OR Watchlist Note */}
          {status === 'watched' ? (
            <section className="space-y-5 border-t border-white/[0.08] pt-6">
              <h3 className="font-display text-xl font-semibold text-[#F2EFE9]">
                观影体验及评价
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs text-[#9E9A93]">观看日期</label>
                  <input
                    type="date"
                    value={watchDate}
                    onChange={(e) => setWatchDate(e.target.value)}
                    className="w-full h-11 rounded-xl bg-[#141417] border border-white/[0.1] focus:border-[#C9303A] focus:outline-none px-3.5 text-sm font-mono-num text-[#F2EFE9]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-[#9E9A93]">观影方式</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {WATCH_METHODS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setWatchMethod(m)}
                        className={`h-11 rounded-xl text-xs border transition-colors cursor-pointer ${
                          watchMethod === m
                            ? 'bg-[#A31C24] border-[#C9303A] text-white font-medium'
                            : 'bg-[#141417] border-white/[0.08] text-[#8C8881] hover:text-white'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-[#9E9A93]">观看次数</label>
                  <div className="flex items-center h-11 rounded-xl overflow-hidden border border-white/[0.1] bg-[#141417]">
                    <button
                      type="button"
                      onClick={() => setWatchCount((c) => Math.max(1, c - 1))}
                      className="w-11 h-full text-sm text-[#8C8881] hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                    >
                      −
                    </button>
                    <span className="flex-1 text-center font-mono-num text-sm text-[#F2EFE9]">
                      {watchCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setWatchCount((c) => c + 1)}
                      className="w-11 h-full text-sm text-[#8C8881] hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Rating 1-10 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-[#9E9A93]">个人评分（1–10 分）</label>
                  {typeof rating === 'number' && (
                    <button
                      type="button"
                      onClick={() => setRating(undefined)}
                      className="text-[11px] text-[#8C8881] hover:text-white cursor-pointer"
                    >
                      清除评分
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setRating(score)}
                      className={`h-10 rounded-lg font-mono-num text-sm border transition-colors cursor-pointer ${
                        rating === score
                          ? 'bg-[#A31C24] border-[#C9303A] text-white font-semibold'
                          : 'bg-[#141417] border-white/[0.08] text-[#8C8881] hover:text-white'
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scare Meter 1-5 */}
              <ScareMeter
                mode="input"
                value={horrorLevel}
                onChange={setHorrorLevel}
              />

              {/* Gore Level */}
              <div className="space-y-2">
                <label className="block text-xs text-[#9E9A93]">血腥程度</label>
                <div className="grid grid-cols-4 gap-2 max-w-md">
                  {GORE_LEVELS.map((lv) => (
                    <button
                      key={lv}
                      type="button"
                      onClick={() => setGoreLevel(goreLevel === lv ? undefined : lv)}
                      className={`h-10 rounded-xl text-xs border transition-colors cursor-pointer ${
                        goreLevel === lv
                          ? 'bg-[#A31C24] border-[#C9303A] text-white font-medium'
                          : 'bg-[#141417] border-white/[0.08] text-[#8C8881] hover:text-white'
                      }`}
                    >
                      {lv}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scare Types */}
              <div className="space-y-2">
                <label className="block text-xs text-[#9E9A93]">
                  主要吓人方式（可多选）
                </label>
                <div className="flex flex-wrap gap-2">
                  {SCARE_TYPES.map((scare) => {
                    const active = scareTypes.includes(scare);
                    return (
                      <button
                        key={scare}
                        type="button"
                        onClick={() => toggleScareType(scare)}
                        className={`px-3 py-1.5 rounded-lg text-xs border min-h-[36px] transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#A31C24] border-[#C9303A] text-white font-medium'
                            : 'bg-[#141417] border-white/[0.08] text-[#8C8881] hover:text-white'
                        }`}
                      >
                        {scare}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Review */}
              <div className="space-y-1.5">
                <label className="block text-xs text-[#9E9A93]">个人观后感</label>
                <textarea
                  rows={4}
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder="记录这部影片最令你印象深刻的画面、声音设计、心理压迫感或观影体验..."
                  className="w-full rounded-xl bg-[#141417] border border-white/[0.1] focus:border-[#C9303A] focus:outline-none p-3.5 text-sm text-[#F2EFE9] placeholder:text-[#6F6C66] leading-relaxed"
                />
              </div>
            </section>
          ) : (
            <section className="space-y-4 border-t border-white/[0.08] pt-6">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[#B98B65]">
                  MY WATCH NOTES
                </div>
                <h3 className="font-display text-xl font-semibold text-[#F2EFE9] mt-0.5">
                  为什么想看
                </h3>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs text-[#9E9A93]">
                  想看的原因 / 当时记录
                </label>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="记录为什么想看这部电影（例如：朋友强推、氛围极佳、某位导演的代表作）..."
                  className="w-full rounded-xl bg-[#141417] border border-white/[0.1] focus:border-[#C9303A] focus:outline-none p-3.5 text-sm text-[#F2EFE9] placeholder:text-[#6F6C66] leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs text-[#9E9A93]">谁推荐的</label>
                  <input
                    type="text"
                    value={recommendedBy}
                    onChange={(e) => setRecommendedBy(e.target.value)}
                    placeholder="例如：朋友推荐 / 某档播客 / 影评榜单"
                    className="w-full h-11 rounded-xl bg-[#141417] border border-white/[0.1] focus:border-[#C9303A] focus:outline-none px-3.5 text-sm text-[#F2EFE9] placeholder:text-[#6F6C66]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-[#9E9A93]">
                    计划观看日期（可选）
                  </label>
                  <input
                    type="date"
                    value={plannedDate}
                    onChange={(e) => setPlannedDate(e.target.value)}
                    className="w-full h-11 rounded-xl bg-[#141417] border border-white/[0.1] focus:border-[#C9303A] focus:outline-none px-3.5 text-sm font-mono-num text-[#F2EFE9]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-[#9E9A93]">
                    观看优先级（可与其他日期叠加）
                  </label>
                  {priority && (
                    <button
                      type="button"
                      onClick={() => setPriority(undefined)}
                      className="text-[11px] text-[#8C8881] hover:text-white cursor-pointer"
                    >
                      取消标记
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: 'high', label: '优先观看 · High' },
                      { value: 'medium', label: '一般 · Medium' },
                      { value: 'low', label: '暂缓 · Low' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setPriority(priority === opt.value ? undefined : opt.value)
                      }
                      className={`h-10 rounded-xl text-xs border transition-colors cursor-pointer ${
                        priority === opt.value
                          ? 'bg-[#782C35] border-[#A3424E] text-white font-medium'
                          : 'bg-[#141417] border-white/[0.08] text-[#8C8881] hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {errorMsg && (
            <p className="text-xs text-[#E24B55] font-medium">{errorMsg}</p>
          )}

          {/* Submit Footer */}
          <div className="border-t border-white/[0.08] pt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium border border-white/[0.1] bg-[#141417] text-[#9E9A93] hover:text-white min-h-[44px] transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl text-sm font-medium bg-[#A31C24] hover:bg-[#BE222C] text-white min-h-[44px] transition-colors cursor-pointer"
            >
              {editingMovie ? '保存修改' : '保存档案'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
