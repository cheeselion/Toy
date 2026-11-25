import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bookmark,
  Cloud,
  Film,
  Home,
  Loader2,
  Plus,
  User as UserIcon,
  WifiOff,
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { AccountCenterModal } from './components/AccountCenterModal';
import { AuthModal } from './components/AuthModal';
import { HomeView } from './components/HomeView';
import { LibraryView } from './components/LibraryView';
import { MigrationConflictModal } from './components/MigrationConflictModal';
import { MovieDetailModal } from './components/MovieDetailModal';
import { MovieFormModal } from './components/MovieFormModal';
import { PrivacyTermsModal } from './components/PrivacyTermsModal';
import { StatisticsView } from './components/StatisticsView';
import { WatchlistView } from './components/WatchlistView';
import { CURATED_CATALOG } from './data/catalog';
import { auth } from './lib/firebase';
import { findExistingMovieInArchive } from './services/movieDatabase';
import {
  deleteAccountAndAllCloudData,
  ensureUserProfileDoc,
  fetchCloudArchive,
  logoutAccount,
  mapAuthErrorMessage,
  pushFullArchiveToCloud,
  pushOutboxToCloud,
  subscribeToCloudArchive,
  updateUserNickname,
} from './services/cloudSync';
import {
  AppTab,
  CatalogFilm,
  CloudSnapshotData,
  HorrorArchiveState,
  HorrorGenre,
  LocalStoreV2,
  MigrationResolution,
  Movie,
  MovieFormPayload,
  SyncStatusState,
  UserSettings,
  WatchStatus,
} from './types/horror';
import {
  computeArchiveStatistics,
  computeRecommendedFilms,
  generateId,
  parseArchiveBackup,
  RecommendedFilm,
  resetArchiveState,
  WatchedEntry,
  WatchlistEntry,
} from './utils/storage';
import {
  applyArchiveMutationWithTracking,
  cloudHasAnyActiveData,
  createEmptyLocalStoreV2,
  loadLocalStoreV2,
  resolveGuestCloudMigration,
  saveLocalStoreV2,
} from './utils/syncEngine';

const NAV_ITEMS: { id: AppTab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: '首页', icon: Home },
  { id: 'library', label: '片库', icon: Film },
  { id: 'statistics', label: '报告', icon: BarChart3 },
  { id: 'watchlist', label: '待看', icon: Bookmark },
];

export default function App() {
  const [localStore, setLocalStore] = useState<LocalStoreV2>(() =>
    loadLocalStoreV2()
  );
  const localStoreRef = useRef<LocalStoreV2>(localStore);
  localStoreRef.current = localStore;

  const archiveState = localStore.archive;

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatusState>('local_only');
  const [syncError, setSyncError] = useState<string | null>(null);

  const [pendingMigration, setPendingMigration] = useState<{
    user: User;
    cloud: CloudSnapshotData;
  } | null>(null);

  const [accountCenterOpen, setAccountCenterOpen] = useState(false);
  const [authModalState, setAuthModalState] = useState<{
    isOpen: boolean;
    mode: 'login' | 'register';
  }>({ isOpen: false, mode: 'login' });
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);

  const remoteCacheRef = useRef<CloudSnapshotData>({
    profile: null,
    movies: [],
    watchRecords: [],
    watchlist: [],
  });
  const isFlushingRef = useRef(false);

  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null);
  const [selectedRecommendation, setSelectedRecommendation] =
    useState<RecommendedFilm | null>(null);
  const [selectedCatalogFilm, setSelectedCatalogFilm] =
    useState<CatalogFilm | null>(null);
  const [selectedExternalMovie, setSelectedExternalMovie] =
    useState<Movie | null>(null);
  const [detailReviewMode, setDetailReviewMode] =
    useState<'positiveOnly' | 'full'>('positiveOnly');
  const [libraryGenres, setLibraryGenres] = useState<HorrorGenre[]>([]);
  const [genreJumpVersion, setGenreJumpVersion] = useState(0);

  const [formModalState, setFormModalState] = useState<{
    isOpen: boolean;
    editingMovie: Movie | null;
    initialStatus: WatchStatus;
  }>({
    isOpen: false,
    editingMovie: null,
    initialStatus: 'watched',
  });

  useEffect(() => {
    saveLocalStoreV2(localStore);
  }, [localStore]);

  const mutateArchive = useCallback(
    (
      updater: (prev: HorrorArchiveState) => HorrorArchiveState,
      options?: { queueForCloud?: boolean; markGuestDirty?: boolean }
    ) => {
      setLocalStore((prev) =>
        applyArchiveMutationWithTracking(prev, updater(prev.archive), options)
      );
    },
    []
  );

  // Track online / offline network transitions
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      if (auth.currentUser) {
        setSyncStatus('offline');
      }
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const reconcileSignedInUser = useCallback(async (user: User) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    setSyncStatus('syncing');
    setSyncError(null);

    try {
      const store = localStoreRef.current;
      const isReturningSameUser = store.lastSyncedUid === user.uid;

      if (isReturningSameUser && store.outbox.length > 0) {
        isFlushingRef.current = true;
        try {
          await pushOutboxToCloud(user, store);
        } finally {
          isFlushingRef.current = false;
        }
      }

      const cloud = await fetchCloudArchive(user.uid);
      remoteCacheRef.current = cloud;
      const now = new Date().toISOString();

      if (isReturningSameUser) {
        // Reconcile cloud snapshot with local cache (cloud deletions apply to non-outbox items)
        const pendingMovieIds = new Set(
          store.outbox.filter((o) => o.entity === 'movie').map((o) => o.id)
        );
        const pendingRecordIds = new Set(
          store.outbox.filter((o) => o.entity === 'watchRecord').map((o) => o.id)
        );
        const pendingWatchlistIds = new Set(
          store.outbox.filter((o) => o.entity === 'watchlist').map((o) => o.id)
        );

        const cloudMovieIds = new Set(cloud.movies.map((m) => m.movie_id));
        const cloudRecordIds = new Set(cloud.watchRecords.map((r) => r.record_id));
        const cloudWlIds = new Set(cloud.watchlist.map((w) => w.watchlist_id));

        const baseForMerge: LocalStoreV2 = {
          ...store,
          archive: {
            movies: store.archive.movies.filter(
              (m) => cloudMovieIds.has(m.movie_id) || pendingMovieIds.has(m.movie_id)
            ),
            watchRecords: store.archive.watchRecords.filter(
              (r) => cloudRecordIds.has(r.record_id) || pendingRecordIds.has(r.record_id)
            ),
            watchlist: store.archive.watchlist.filter(
              (w) => cloudWlIds.has(w.watchlist_id) || pendingWatchlistIds.has(w.watchlist_id)
            ),
          },
          outbox: [],
        };

        const resolved = resolveGuestCloudMigration(baseForMerge, cloud, 'merge');
        if (resolved.needsFullCloudSync) {
          await pushOutboxToCloud(user, {
            ...baseForMerge,
            archive: resolved.archive,
            outbox: resolved.outbox,
            settings: resolved.settings,
          });
        } else {
          await ensureUserProfileDoc(user, resolved.settings);
        }

        setLocalStore((prev) => ({
          ...prev,
          archive: resolved.archive,
          tombstones: [],
          outbox: [],
          settings: resolved.settings,
          isGuestDirty: false,
          lastSyncedAt: now,
          lastSyncedUid: user.uid,
        }));
        setSyncStatus('synced');
        return;
      }

      // First login / Guest-to-Account migration check
      const hasCloudData = cloudHasAnyActiveData(cloud);
      const hasLocalEdits = store.isGuestDirty;

      if (!hasCloudData) {
        const syncedSettings = await pushFullArchiveToCloud(
          user,
          store.archive,
          store.settings
        );
        setLocalStore((prev) => ({
          ...prev,
          settings: syncedSettings,
          tombstones: [],
          outbox: [],
          isGuestDirty: false,
          lastSyncedAt: now,
          lastSyncedUid: user.uid,
        }));
        setSyncStatus('synced');
        return;
      }

      if (!hasLocalEdits) {
        const adopted = resolveGuestCloudMigration(store, cloud, 'prefer_cloud');
        await ensureUserProfileDoc(user, adopted.settings);
        setLocalStore((prev) => ({
          ...prev,
          archive: adopted.archive,
          tombstones: [],
          outbox: [],
          settings: adopted.settings,
          isGuestDirty: false,
          lastSyncedAt: now,
          lastSyncedUid: user.uid,
        }));
        setSyncStatus('synced');
        return;
      }

      // Both local guest edits and existing cloud archive exist -> require explicit user confirmation
      setPendingMigration({ user, cloud });
      setSyncStatus('synced');
    } catch (err) {
      const offlineNow = typeof navigator !== 'undefined' && !navigator.onLine;
      setSyncStatus(offlineNow ? 'offline' : 'error');
      setSyncError(
        err instanceof Error ? err.message : '连接云端同步服务失败，请稍后重试。'
      );
    }
  }, []);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        setPendingMigration(null);
        setSyncStatus('local_only');
        setSyncError(null);
        return;
      }
      void reconcileSignedInUser(user);
    });
    return () => unsub();
  }, [reconcileSignedInUser]);

  // Auto-flush outbox whenever online, signed in, and migration is settled
  useEffect(() => {
    if (!currentUser || pendingMigration) return;
    if (!isOnline) {
      setSyncStatus('offline');
      return;
    }
    if (localStore.lastSyncedUid !== currentUser.uid) return;
    if (localStore.outbox.length === 0) return;

    const timer = window.setTimeout(async () => {
      if (isFlushingRef.current) return;
      isFlushingRef.current = true;
      setSyncStatus('syncing');
      setSyncError(null);
      try {
        const snapshot = localStoreRef.current;
        await pushOutboxToCloud(currentUser, snapshot);
        const now = new Date().toISOString();
        setLocalStore((prev) => ({
          ...prev,
          outbox: prev.outbox.filter(
            (item) => !snapshot.outbox.some((flushed) => flushed.key === item.key && flushed.queued_at === item.queued_at)
          ),
          tombstones: [],
          lastSyncedAt: now,
          lastSyncedUid: currentUser.uid,
        }));
        setSyncStatus('synced');
      } catch (err) {
        const offlineNow = typeof navigator !== 'undefined' && !navigator.onLine;
        setSyncStatus(offlineNow ? 'offline' : 'error');
        setSyncError(err instanceof Error ? err.message : '自动同步失败，请重试。');
      } finally {
        isFlushingRef.current = false;
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [
    currentUser,
    isOnline,
    pendingMigration,
    localStore.outbox,
    localStore.lastSyncedUid,
  ]);

  // Real-time multi-device cloud listener
  useEffect(() => {
    if (
      !currentUser ||
      !isOnline ||
      pendingMigration ||
      localStore.lastSyncedUid !== currentUser.uid
    ) {
      return;
    }

    const unsub = subscribeToCloudArchive(
      currentUser.uid,
      (partial) => {
        if (isFlushingRef.current || localStoreRef.current.outbox.length > 0) {
          return;
        }
        const nextRemote: CloudSnapshotData = {
          ...remoteCacheRef.current,
          ...partial,
        };
        remoteCacheRef.current = nextRemote;

        const nextArchive: HorrorArchiveState = {
          movies: nextRemote.movies.filter((m) => !m.deleted_at),
          watchRecords: nextRemote.watchRecords.filter((r) => !r.deleted_at),
          watchlist: nextRemote.watchlist.filter((w) => !w.deleted_at),
        };

        const currentArchive = localStoreRef.current.archive;
        if (JSON.stringify(currentArchive) !== JSON.stringify(nextArchive)) {
          setLocalStore((prev) => ({
            ...prev,
            archive: nextArchive,
            lastSyncedAt: new Date().toISOString(),
          }));
        }
      },
      (error) => {
        const offlineNow = typeof navigator !== 'undefined' && !navigator.onLine;
        setSyncStatus(offlineNow ? 'offline' : 'error');
        setSyncError(
          error instanceof Error ? error.message : '实时同步监听异常。'
        );
      }
    );

    return () => unsub();
  }, [currentUser, isOnline, pendingMigration, localStore.lastSyncedUid]);

  const handleResolveMigration = async (resolution: MigrationResolution) => {
    if (!pendingMigration) return;
    const { user, cloud } = pendingMigration;
    const store = localStoreRef.current;

    setSyncStatus('syncing');
    setSyncError(null);
    try {
      const resolved = resolveGuestCloudMigration(store, cloud, resolution);
      if (resolution === 'prefer_local') {
        // Delete extra cloud docs & upload local archive
        await pushOutboxToCloud(user, {
          ...store,
          archive: resolved.archive,
          outbox: resolved.outbox,
          settings: resolved.settings,
        });
      } else if (resolved.needsFullCloudSync) {
        await pushOutboxToCloud(user, {
          ...store,
          archive: resolved.archive,
          outbox: resolved.outbox,
          settings: resolved.settings,
        });
      } else {
        await ensureUserProfileDoc(user, resolved.settings);
      }

      const freshCloud = await fetchCloudArchive(user.uid);
      remoteCacheRef.current = freshCloud;

      setLocalStore((prev) => ({
        ...prev,
        archive: resolved.archive,
        tombstones: [],
        outbox: [],
        settings: resolved.settings,
        isGuestDirty: false,
        lastSyncedAt: new Date().toISOString(),
        lastSyncedUid: user.uid,
      }));
      setPendingMigration(null);
      setSyncStatus('synced');
    } catch (err) {
      setSyncStatus(navigator.onLine ? 'error' : 'offline');
      setSyncError(err instanceof Error ? err.message : '迁移合并失败，请重试。');
    }
  };

  const handleManualSync = async () => {
    if (!currentUser) return;
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }
    await reconcileSignedInUser(currentUser);
  };

  const handleUpdateSettings = async (
    nextSettings: UserSettings
  ): Promise<{ ok: boolean; message?: string }> => {
    const trimmedNextNick = nextSettings.display_name?.trim() || undefined;
    const currentNick =
      localStoreRef.current.settings.display_name?.trim() || undefined;
    const nicknameChanged = Boolean(
      trimmedNextNick && trimmedNextNick !== currentNick
    );

    if (currentUser && nicknameChanged && trimmedNextNick) {
      if (!navigator.onLine) {
        return {
          ok: false,
          message: '当前处于离线状态，无法校验昵称唯一性并保存到云端，请联网后重试。',
        };
      }
      try {
        const synced = await updateUserNickname(
          currentUser,
          trimmedNextNick,
          nextSettings.default_watch_method
        );
        setLocalStore((prev) => ({
          ...prev,
          settings: synced,
          outbox: prev.outbox.filter((o) => o.key !== 'profile:self'),
          lastSyncedAt: new Date().toISOString(),
        }));
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          message: mapAuthErrorMessage(err),
        };
      }
    }

    const now = new Date().toISOString();
    setLocalStore((prev) => ({
      ...prev,
      settings: nextSettings,
      outbox: currentUser
        ? [
            ...prev.outbox.filter((o) => o.key !== 'profile:self'),
            {
              key: 'profile:self',
              entity: 'profile',
              id: 'self',
              op: 'upsert',
              queued_at: now,
            },
          ]
        : prev.outbox,
    }));

    if (currentUser && navigator.onLine) {
      try {
        await ensureUserProfileDoc(currentUser, nextSettings);
        setLocalStore((prev) => ({
          ...prev,
          outbox: prev.outbox.filter((o) => o.key !== 'profile:self'),
          lastSyncedAt: new Date().toISOString(),
        }));
      } catch {
        // Kept in outbox for retry
      }
    }

    return { ok: true };
  };

  const handleLogout = async (clearLocalCache: boolean) => {
    await logoutAccount();
    setPendingMigration(null);
    setSyncStatus('local_only');
    setSyncError(null);

    if (clearLocalCache) {
      const emptyStore = createEmptyLocalStoreV2();
      setLocalStore(emptyStore);
    } else {
      setLocalStore((prev) => ({
        ...prev,
        outbox: [],
        tombstones: [],
        lastSyncedUid: null,
        lastSyncedAt: null,
      }));
    }
  };

  const handleDeleteAccount = async (
    currentPassword?: string
  ): Promise<{ ok: boolean; message?: string }> => {
    if (!currentUser) return { ok: false, message: '当前未登录任何账户。' };
    try {
      await deleteAccountAndAllCloudData(currentUser, currentPassword);
      setPendingMigration(null);
      setSyncStatus('local_only');
      setSyncError(null);
      setLocalStore((prev) => ({
        ...prev,
        outbox: [],
        tombstones: [],
        lastSyncedUid: null,
        lastSyncedAt: null,
      }));
      return { ok: true };
    } catch (err) {
      return { ok: false, message: mapAuthErrorMessage(err) };
    }
  };

  const movieMap = useMemo(() => {
    const map = new Map<string, Movie>();
    archiveState.movies.forEach((m) => map.set(m.movie_id, m));
    return map;
  }, [archiveState.movies]);

  const watchedEntries: WatchedEntry[] = useMemo(() => {
    const list: WatchedEntry[] = [];
    for (const record of archiveState.watchRecords) {
      const movie = movieMap.get(record.movie_id);
      if (movie) list.push({ movie, record });
    }
    return list.sort((a, b) =>
      b.record.created_at.localeCompare(a.record.created_at)
    );
  }, [archiveState.watchRecords, movieMap]);

  const watchlistEntries: WatchlistEntry[] = useMemo(() => {
    const list: WatchlistEntry[] = [];
    for (const item of archiveState.watchlist) {
      const movie = movieMap.get(item.movie_id);
      if (movie) list.push({ movie, item });
    }
    return list.sort((a, b) => b.item.added_at.localeCompare(a.item.added_at));
  }, [archiveState.watchlist, movieMap]);

  const stats = useMemo(
    () => computeArchiveStatistics(watchedEntries),
    [watchedEntries]
  );

  const recommendations = useMemo(
    () => computeRecommendedFilms(watchedEntries, CURATED_CATALOG, 10),
    [watchedEntries]
  );

  const activeCatalogFilm = selectedRecommendation?.film || selectedCatalogFilm;
  const resolvedCatalogMovie: Movie | null = useMemo(() => {
    if (!activeCatalogFilm) return null;
    const existingSaved = archiveState.movies.find(
      (m) =>
        m.title.trim().toLowerCase() === activeCatalogFilm.title.trim().toLowerCase() ||
        (m.original_title &&
          m.original_title.trim().toLowerCase() ===
            activeCatalogFilm.original_title.trim().toLowerCase())
    );
    if (existingSaved) return existingSaved;

    return {
      movie_id: activeCatalogFilm.catalog_id,
      title: activeCatalogFilm.title,
      original_title: activeCatalogFilm.original_title,
      poster_url: activeCatalogFilm.poster_url,
      release_year: activeCatalogFilm.release_year,
      director: activeCatalogFilm.director,
      country: activeCatalogFilm.country,
      duration: activeCatalogFilm.duration,
      synopsis: activeCatalogFilm.synopsis,
      genres: activeCatalogFilm.genres,
      created_at: new Date().toISOString(),
    };
  }, [activeCatalogFilm, archiveState.movies]);

  const resolvedExternalPreviewMovie: Movie | null = useMemo(() => {
    if (!selectedExternalMovie) return null;
    const existingSaved = findExistingMovieInArchive(archiveState.movies, {
      external_source: selectedExternalMovie.external_source,
      external_id: selectedExternalMovie.external_id,
      title: selectedExternalMovie.title,
      original_title: selectedExternalMovie.original_title,
      release_year: selectedExternalMovie.release_year,
    });
    return existingSaved || selectedExternalMovie;
  }, [selectedExternalMovie, archiveState.movies]);

  const selectedSavedMovie = selectedMovieId
    ? movieMap.get(selectedMovieId) || null
    : null;
  const detailMovie =
    selectedSavedMovie || resolvedCatalogMovie || resolvedExternalPreviewMovie;
  const isDetailSavedMovie = Boolean(
    detailMovie && movieMap.has(detailMovie.movie_id)
  );

  const selectedWatchRecord = detailMovie
    ? archiveState.watchRecords.find((r) => r.movie_id === detailMovie.movie_id)
    : undefined;
  const selectedWatchlistItem = detailMovie
    ? archiveState.watchlist.find((w) => w.movie_id === detailMovie.movie_id)
    : undefined;

  const editingWatchRecord = formModalState.editingMovie
    ? archiveState.watchRecords.find(
        (r) => r.movie_id === formModalState.editingMovie?.movie_id
      )
    : undefined;
  const editingWatchlistItem = formModalState.editingMovie
    ? archiveState.watchlist.find(
        (w) => w.movie_id === formModalState.editingMovie?.movie_id
      )
    : undefined;

  const closeDetailModal = () => {
    setSelectedMovieId(null);
    setSelectedRecommendation(null);
    setSelectedCatalogFilm(null);
    setSelectedExternalMovie(null);
    setDetailReviewMode('positiveOnly');
  };

  const handleOpenAddModal = (initialStatus: WatchStatus = 'watched') => {
    setFormModalState({
      isOpen: true,
      editingMovie: null,
      initialStatus,
    });
  };

  const handleEditMovie = (movie: Movie) => {
    closeDetailModal();
    setFormModalState({
      isOpen: true,
      editingMovie: movie,
      initialStatus: archiveState.watchRecords.some(
        (r) => r.movie_id === movie.movie_id
      )
        ? 'watched'
        : 'watchlist',
    });
  };

  const handleMarkAsWatched = (movie: Movie) => {
    closeDetailModal();
    const existingSaved = findExistingMovieInArchive(archiveState.movies, {
      external_source: movie.external_source,
      external_id: movie.external_id,
      title: movie.title,
      original_title: movie.original_title,
      release_year: movie.release_year,
    });
    const targetMovie = existingSaved
      ? {
          ...existingSaved,
          poster_url: existingSaved.poster_url || movie.poster_url,
          release_date: existingSaved.release_date || movie.release_date,
          director: existingSaved.director || movie.director,
          country: existingSaved.country || movie.country,
          duration: existingSaved.duration || movie.duration,
          synopsis: existingSaved.synopsis || movie.synopsis,
          external_source: existingSaved.external_source || movie.external_source,
          external_id: existingSaved.external_id || movie.external_id,
          external_rating: existingSaved.external_rating ?? movie.external_rating,
        }
      : movie;

    setFormModalState({
      isOpen: true,
      editingMovie: targetMovie,
      initialStatus: 'watched',
    });
  };

  const handleSaveMovie = (payload: MovieFormPayload) => {
    const now = new Date().toISOString();
    const isTempId =
      payload.movie_id?.startsWith('cat-') || payload.movie_id?.startsWith('ext-');

    let savedMovieId =
      payload.movie_id && !isTempId ? payload.movie_id : generateId('mov');

    mutateArchive((prev) => {
      const matchedExisting =
        prev.movies.find((m) => m.movie_id === savedMovieId) ||
        findExistingMovieInArchive(prev.movies, {
          external_source: payload.external_source,
          external_id: payload.external_id,
          title: payload.title,
          original_title: payload.original_title,
          release_year: payload.release_year,
        });

      const movieId = matchedExisting ? matchedExisting.movie_id : savedMovieId;
      savedMovieId = movieId;

      const nextMovie: Movie = {
        movie_id: movieId,
        title: payload.title,
        original_title: payload.original_title,
        poster_url: payload.poster_url,
        release_date: payload.release_date ?? matchedExisting?.release_date,
        release_year: payload.release_year,
        director: payload.director,
        country: payload.country,
        duration: payload.duration,
        synopsis: payload.synopsis,
        genres: payload.genres,
        external_source: payload.external_source ?? matchedExisting?.external_source,
        external_id: payload.external_id ?? matchedExisting?.external_id,
        external_rating: payload.external_rating ?? matchedExisting?.external_rating,
        created_at: matchedExisting?.created_at || now,
        updated_at: now,
      };

      const movies = matchedExisting
        ? prev.movies.map((m) => (m.movie_id === movieId ? nextMovie : m))
        : [nextMovie, ...prev.movies];

      let watchRecords = [...prev.watchRecords];
      let watchlist = [...prev.watchlist];

      if (payload.status === 'watched') {
        const existingRecord = watchRecords.find((r) => r.movie_id === movieId);
        const nextRecord = {
          record_id: existingRecord?.record_id || generateId('rec'),
          movie_id: movieId,
          watch_date: payload.watch_date,
          rating: payload.rating,
          review: payload.review,
          horror_level: payload.horror_level,
          gore_level: payload.gore_level,
          scare_types: payload.scare_types,
          watch_method: payload.watch_method,
          watch_count: payload.watch_count,
          created_at: existingRecord?.created_at || now,
          updated_at: now,
        };
        watchRecords = existingRecord
          ? watchRecords.map((r) => (r.movie_id === movieId ? nextRecord : r))
          : [nextRecord, ...watchRecords];

        watchlist = watchlist.filter((w) => w.movie_id !== movieId);
      } else {
        const existingWl = watchlist.find((w) => w.movie_id === movieId);
        const nextWl = {
          watchlist_id: existingWl?.watchlist_id || generateId('wl'),
          movie_id: movieId,
          added_at: existingWl?.added_at || now,
          note: payload.note,
          recommended_by: payload.recommended_by,
          planned_date: payload.planned_date,
          priority: payload.priority,
          updated_at: now,
        };
        watchlist = existingWl
          ? watchlist.map((w) => (w.movie_id === movieId ? nextWl : w))
          : [nextWl, ...watchlist];

        watchRecords = watchRecords.filter((r) => r.movie_id !== movieId);
      }

      return { movies, watchRecords, watchlist };
    });

    setFormModalState((prev) => ({ ...prev, isOpen: false, editingMovie: null }));
    setSelectedRecommendation(null);
    setSelectedCatalogFilm(null);
    setSelectedExternalMovie(null);
    setDetailReviewMode('positiveOnly');
    setSelectedMovieId(savedMovieId);
  };

  const handleDeleteMovie = (movieId: string) => {
    mutateArchive((prev) => ({
      movies: prev.movies.filter((m) => m.movie_id !== movieId),
      watchRecords: prev.watchRecords.filter((r) => r.movie_id !== movieId),
      watchlist: prev.watchlist.filter((w) => w.movie_id !== movieId),
    }));
    closeDetailModal();
  };

  const handleRemoveFromWatchlist = (movieId: string) => {
    mutateArchive((prev) => {
      const hasWatchRecord = prev.watchRecords.some((r) => r.movie_id === movieId);
      return {
        movies: hasWatchRecord
          ? prev.movies
          : prev.movies.filter((m) => m.movie_id !== movieId),
        watchRecords: prev.watchRecords,
        watchlist: prev.watchlist.filter((w) => w.movie_id !== movieId),
      };
    });
  };

  const handleUpdateWatchlistItem = (
    watchlistId: string,
    patch: {
      note?: string;
      recommended_by?: string;
      planned_date?: string;
      priority?: 'high' | 'medium' | 'low';
    }
  ) => {
    const now = new Date().toISOString();
    mutateArchive((prev) => ({
      ...prev,
      watchlist: prev.watchlist.map((w) =>
        w.watchlist_id === watchlistId
          ? {
              ...w,
              ...patch,
              updated_at: now,
            }
          : w
      ),
    }));
  };

  const handleToggleWatchlist = (movie: Movie) => {
    mutateArchive((prev) => {
      const existingMovie =
        prev.movies.find((m) => m.movie_id === movie.movie_id) ||
        findExistingMovieInArchive(prev.movies, {
          external_source: movie.external_source,
          external_id: movie.external_id,
          title: movie.title,
          original_title: movie.original_title,
          release_year: movie.release_year,
        });

      const targetMovieId = existingMovie
        ? existingMovie.movie_id
        : generateId('mov');

      const existsInWatchlist = prev.watchlist.some(
        (w) => w.movie_id === targetMovieId
      );

      if (existsInWatchlist) {
        const hasWatchRecord = prev.watchRecords.some(
          (r) => r.movie_id === targetMovieId
        );
        return {
          movies: hasWatchRecord
            ? prev.movies
            : prev.movies.filter((m) => m.movie_id !== targetMovieId),
          watchRecords: prev.watchRecords,
          watchlist: prev.watchlist.filter((w) => w.movie_id !== targetMovieId),
        };
      }

      const now = new Date().toISOString();
      const movies = existingMovie
        ? prev.movies
        : [
            {
              ...movie,
              movie_id: targetMovieId,
              created_at: now,
              updated_at: now,
            },
            ...prev.movies,
          ];

      return {
        movies,
        watchRecords: prev.watchRecords,
        watchlist: [
          {
            watchlist_id: generateId('wl'),
            movie_id: targetMovieId,
            added_at: now,
            updated_at: now,
          },
          ...prev.watchlist,
        ],
      };
    });
  };

  const handleImportArchive = (jsonText: string) => {
    const parsed = parseArchiveBackup(jsonText);
    if (!parsed) {
      return {
        ok: false,
        message: '备份文件格式无效，请确认导入的是 Horror Diary 导出的 JSON 文件。',
      };
    }
    mutateArchive(() => parsed, { markGuestDirty: true });
    return {
      ok: true,
      message: `已成功导入 ${parsed.movies.length} 部电影档案。`,
    };
  };

  const handleResetArchive = () => {
    if (!currentUser) {
      resetArchiveState();
      setLocalStore(createEmptyLocalStoreV2());
      return;
    }
    mutateArchive(() => resetArchiveState(), { markGuestDirty: false });
  };

  const handleSelectTab = (tab: AppTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectGenreFromDetail = (genre: HorrorGenre) => {
    closeDetailModal();
    setLibraryGenres([genre]);
    setGenreJumpVersion((v) => v + 1);
    setActiveTab('library');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderHeaderAccountButton = (compact = false) => {
    const resolvedNickname = currentUser
      ? localStore.settings.display_name ||
        currentUser.displayName ||
        currentUser.email?.split('@')[0] ||
        '用户'
      : '';
    const displayLabel = currentUser ? `Hi，${resolvedNickname}` : 'Log in';

    const renderIcon = () => {
      if (!currentUser) {
        return <UserIcon className="h-3.5 w-3.5 text-[#8C8881] shrink-0" />;
      }
      if (syncStatus === 'syncing') {
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-[#E24B55] shrink-0" />;
      }
      if (syncStatus === 'offline') {
        return <WifiOff className="h-3.5 w-3.5 text-[#9E9A93] shrink-0" />;
      }
      if (syncStatus === 'error') {
        return <AlertTriangle className="h-3.5 w-3.5 text-[#E24B55] shrink-0" />;
      }
      return <Cloud className="h-3.5 w-3.5 text-[#E24B55] shrink-0" />;
    };

    return (
      <button
        type="button"
        onClick={() => {
          if (currentUser) {
            setAccountCenterOpen(true);
          } else {
            setAuthModalState({ isOpen: true, mode: 'login' });
          }
        }}
        aria-label={currentUser ? '打开个人中心与同步状态' : '登录或注册账户'}
        className={`inline-flex items-center gap-1.5 bg-transparent border-0 text-xs sm:text-sm font-medium text-[#D6D1C7] hover:text-[#F2EFE9] transition-colors cursor-pointer whitespace-nowrap ${
          compact ? 'py-1.5 min-h-[34px] max-w-[155px]' : 'py-1.5 min-h-[36px] max-w-[200px]'
        }`}
      >
        {renderIcon()}
        <span className="truncate">{displayLabel}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-[#F2EFE9] flex flex-col">
      {/* Desktop Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="hidden md:block sticky top-0 z-30 bg-[#0A0A0C]/95 backdrop-blur-md border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => handleSelectTab('home')}
            className="font-display text-2xl font-semibold tracking-tight text-[#F2EFE9] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Horror Diary
          </button>

          <nav className="flex items-center gap-8" aria-label="主导航">
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectTab(item.id)}
                  className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'text-[#B98B65]'
                      : 'text-[#8C8881] hover:text-[#D6D1C7]'
                  }`}
                >
                  <span>{item.label}</span>
                  {active && (
                    <span className="absolute left-0 right-0 -bottom-[1px] h-[2px] rounded-full bg-[#B98B65]" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="shrink-0 flex items-center justify-end min-w-[110px]">
            {renderHeaderAccountButton(false)}
          </div>
        </div>
      </header>

      {/* Mobile Compact Top App Bar (52px) */}
      <header className="md:hidden sticky top-0 z-30 h-[52px] bg-[#0A0A0C]/95 backdrop-blur-md border-b border-white/[0.08] px-4 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => handleSelectTab('home')}
          className="font-display text-xl font-semibold tracking-tight text-[#F2EFE9] whitespace-nowrap shrink-0 cursor-pointer"
        >
          Horror Diary
        </button>

        {renderHeaderAccountButton(true)}
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-5 md:pt-8 pb-24">
        {activeTab === 'home' && (
          <HomeView
            recommendations={recommendations}
            onSelectRecommendation={(rec) => {
              setSelectedMovieId(null);
              setSelectedCatalogFilm(null);
              setSelectedExternalMovie(null);
              setSelectedRecommendation(rec);
              setDetailReviewMode('positiveOnly');
            }}
          />
        )}

        {activeTab === 'library' && (
          <LibraryView
            archiveState={archiveState}
            watchedEntries={watchedEntries}
            selectedGenres={libraryGenres}
            genreJumpVersion={genreJumpVersion}
            onGenresChange={setLibraryGenres}
            onSelectMovie={(m, fromSearch) => {
              setSelectedRecommendation(null);
              setSelectedCatalogFilm(null);
              setSelectedExternalMovie(null);
              setSelectedMovieId(m.movie_id);
              setDetailReviewMode(fromSearch ? 'full' : 'positiveOnly');
            }}
            onSelectCatalogFilm={(film, fromSearch) => {
              setSelectedMovieId(null);
              setSelectedRecommendation(null);
              setSelectedExternalMovie(null);
              setSelectedCatalogFilm(film);
              setDetailReviewMode(fromSearch ? 'full' : 'positiveOnly');
            }}
            onPreviewExternalMovie={(m, fromSearch) => {
              setSelectedRecommendation(null);
              setSelectedCatalogFilm(null);
              if (movieMap.has(m.movie_id)) {
                setSelectedExternalMovie(null);
                setSelectedMovieId(m.movie_id);
              } else {
                setSelectedMovieId(null);
                setSelectedExternalMovie(m);
              }
              setDetailReviewMode(fromSearch ? 'full' : 'positiveOnly');
            }}
            onMarkAsWatched={handleMarkAsWatched}
            onToggleWatchlist={handleToggleWatchlist}
            onOpenAddModal={() => handleOpenAddModal('watched')}
          />
        )}

        {activeTab === 'statistics' && (
          <StatisticsView
            stats={stats}
            watchedEntries={watchedEntries}
            archiveState={archiveState}
            userEmail={currentUser?.email || null}
            syncStatus={syncStatus}
            onOpenAccountCenter={() => setAccountCenterOpen(true)}
            onOpenAuth={() => setAuthModalState({ isOpen: true, mode: 'login' })}
            onSelectMovie={(m) => {
              setSelectedRecommendation(null);
              setSelectedCatalogFilm(null);
              setSelectedExternalMovie(null);
              setSelectedMovieId(m.movie_id);
              setDetailReviewMode('positiveOnly');
            }}
            onImportArchive={handleImportArchive}
            onResetArchive={handleResetArchive}
          />
        )}

        {activeTab === 'watchlist' && (
          <WatchlistView
            watchlistEntries={watchlistEntries}
            onSelectMovie={(m) => {
              setSelectedRecommendation(null);
              setSelectedCatalogFilm(null);
              setSelectedExternalMovie(null);
              setSelectedMovieId(m.movie_id);
              setDetailReviewMode('positiveOnly');
            }}
            onEditMovie={handleEditMovie}
            onUpdateWatchlistItem={handleUpdateWatchlistItem}
            onMarkAsWatched={handleMarkAsWatched}
            onRemoveFromWatchlist={handleRemoveFromWatchlist}
            onOpenAddWatchlistModal={() => handleOpenAddModal('watchlist')}
          />
        )}
      </main>

      {/* Desktop Quiet Footer */}
      <footer className="hidden md:block border-t border-white/[0.06] py-6">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 flex items-center justify-between text-xs text-[#6F6C66]">
          <span>Horror Diary · 个人恐怖片观影档案馆</span>
          <span>
            {currentUser
              ? `云端同步账户：${currentUser.email}`
              : '游客模式 · 数据存储于本地浏览器'}
          </span>
        </div>
      </footer>

      {/* Desktop Centered Bottom "+" Action */}
      <button
        type="button"
        onClick={() =>
          handleOpenAddModal(activeTab === 'watchlist' ? 'watchlist' : 'watched')
        }
        aria-label="记录电影"
        className="hidden md:flex fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-11 h-11 rounded-full items-center justify-center bg-[#782C35] hover:bg-[#8E3540] hover:scale-105 active:scale-95 text-white border border-white/[0.12] shadow-[0_10px_24px_rgba(120,44,53,0.42)] transition-all cursor-pointer"
      >
        <Plus className="h-[18px] w-[18px]" strokeWidth={2.1} />
      </button>

      {/* Mobile Floating Minimalist Pill Bottom Navigation */}
      <nav
        aria-label="移动端底部导航"
        className="md:hidden fixed bottom-4 left-4 right-4 max-w-md mx-auto z-40 h-14 bg-[#111114]/92 backdrop-blur-xl border border-white/[0.08] rounded-full shadow-[0_14px_36px_rgba(0,0,0,0.65)] grid grid-cols-5 items-center px-2"
      >
        {NAV_ITEMS.slice(0, 2).map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectTab(item.id)}
              className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                active ? 'text-[#B98B65]' : 'text-[#858585] hover:text-[#D6D1C7]'
              }`}
            >
              <Icon className="h-[17px] w-[17px]" strokeWidth={active ? 2 : 1.5} />
              <span className="text-[10px] font-medium tracking-tight">
                {item.label}
              </span>
            </button>
          );
        })}

        <div className="h-full flex items-center justify-center">
          <button
            type="button"
            onClick={() =>
              handleOpenAddModal(activeTab === 'watchlist' ? 'watchlist' : 'watched')
            }
            aria-label="记录电影"
            className="w-[42px] h-[42px] rounded-full flex items-center justify-center bg-[#782C35] hover:bg-[#8E3540] active:scale-95 text-white border border-white/[0.12] shadow-[0_6px_16px_rgba(120,44,53,0.45)] transition-all cursor-pointer"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.1} />
          </button>
        </div>

        {NAV_ITEMS.slice(2).map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectTab(item.id)}
              className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                active ? 'text-[#B98B65]' : 'text-[#858585] hover:text-[#D6D1C7]'
              }`}
            >
              <Icon className="h-[17px] w-[17px]" strokeWidth={active ? 2 : 1.5} />
              <span className="text-[10px] font-medium tracking-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Detail Modal */}
      <MovieDetailModal
        movie={detailMovie}
        watchRecord={selectedWatchRecord}
        watchlistItem={selectedWatchlistItem}
        recommendationReasons={selectedRecommendation?.reasons}
        isSavedMovie={isDetailSavedMovie}
        reviewAccessMode={detailReviewMode}
        onClose={closeDetailModal}
        onEdit={handleEditMovie}
        onDelete={handleDeleteMovie}
        onToggleWatchlist={handleToggleWatchlist}
        onMarkAsWatched={handleMarkAsWatched}
        onSelectGenre={handleSelectGenreFromDetail}
      />

      {/* Add / Edit Movie Modal */}
      <MovieFormModal
        isOpen={formModalState.isOpen}
        editingMovie={formModalState.editingMovie}
        editingRecord={editingWatchRecord}
        editingWatchlist={editingWatchlistItem}
        existingMovies={archiveState.movies}
        initialStatus={formModalState.initialStatus}
        defaultWatchMethod={localStore.settings.default_watch_method || '独自'}
        onClose={() =>
          setFormModalState((prev) => ({
            ...prev,
            isOpen: false,
            editingMovie: null,
          }))
        }
        onSave={handleSaveMovie}
      />

      {/* Account Center & Sync Settings Modal */}
      <AccountCenterModal
        isOpen={accountCenterOpen}
        user={currentUser}
        syncStatus={syncStatus}
        syncError={syncError}
        lastSyncedAt={localStore.lastSyncedAt}
        pendingCount={localStore.outbox.length}
        settings={localStore.settings}
        archiveState={archiveState}
        onClose={() => setAccountCenterOpen(false)}
        onOpenAuth={(mode) => {
          setAccountCenterOpen(false);
          setAuthModalState({ isOpen: true, mode });
        }}
        onOpenPrivacy={() => setPrivacyModalOpen(true)}
        onManualSync={handleManualSync}
        onUpdateSettings={handleUpdateSettings}
        onImportArchive={handleImportArchive}
        onLogout={handleLogout}
        onDeleteAccount={handleDeleteAccount}
      />

      {/* Optional Login / Register / Reset Modal */}
      <AuthModal
        isOpen={authModalState.isOpen}
        initialMode={authModalState.mode}
        onClose={() => setAuthModalState((prev) => ({ ...prev, isOpen: false }))}
        onOpenPrivacy={() => setPrivacyModalOpen(true)}
        onAuthSuccess={() => {
          setAccountCenterOpen(true);
        }}
      />

      {/* Guest vs Cloud Data Conflict Resolution Modal */}
      <MigrationConflictModal
        isOpen={Boolean(pendingMigration)}
        userEmail={pendingMigration?.user.email || null}
        localMovieCount={archiveState.movies.length}
        localRecordCount={archiveState.watchRecords.length}
        localWatchlistCount={archiveState.watchlist.length}
        cloudMovieCount={
          pendingMigration?.cloud.movies.filter((m) => !m.deleted_at).length || 0
        }
        cloudRecordCount={
          pendingMigration?.cloud.watchRecords.filter((r) => !r.deleted_at).length || 0
        }
        cloudWatchlistCount={
          pendingMigration?.cloud.watchlist.filter((w) => !w.deleted_at).length || 0
        }
        onResolve={handleResolveMigration}
      />

      {/* Privacy Policy & User Terms Modal */}
      <PrivacyTermsModal
        isOpen={privacyModalOpen}
        onClose={() => setPrivacyModalOpen(false)}
      />
    </div>
  );
}
