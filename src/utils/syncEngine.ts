import {
  findCatalogMatchForMovie,
  isLegacyGeneratedPosterUrl,
} from '../data/catalog';
import {
  CloudSnapshotData,
  HorrorArchiveState,
  LocalStoreV2,
  MigrationResolution,
  Movie,
  SyncOutboxItem,
  SyncTombstone,
  UserSettings,
  WatchlistItem,
  WatchRecord,
} from '../types/horror';

const LEGACY_V1_KEY = 'horror_diary_archive_v1';
const STORAGE_V2_KEY = 'horror_diary_archive_v2';

const LEGACY_SEED_MOVIE_IDS = new Set([
  'mov-hereditary',
  'mov-shining',
  'mov-ringu',
  'mov-thing',
  'mov-midsommar',
  'mov-substance',
  'mov-cure',
  'mov-wailing',
  'mov-suspiria',
]);
const LEGACY_SEED_RECORD_IDS = new Set([
  'rec-hereditary',
  'rec-shining',
  'rec-ringu',
  'rec-thing',
  'rec-midsommar',
  'rec-substance',
]);
const LEGACY_SEED_WATCHLIST_IDS = new Set([
  'wl-cure',
  'wl-wailing',
  'wl-suspiria',
]);

function isUntouchedLegacySeed(archive: HorrorArchiveState): boolean {
  const hasAny =
    archive.movies.length > 0 ||
    archive.watchRecords.length > 0 ||
    archive.watchlist.length > 0;
  if (!hasAny) return false;

  return (
    archive.movies.every((m) => LEGACY_SEED_MOVIE_IDS.has(m.movie_id)) &&
    archive.watchRecords.every((r) => LEGACY_SEED_RECORD_IDS.has(r.record_id)) &&
    archive.watchlist.every((w) => LEGACY_SEED_WATCHLIST_IDS.has(w.watchlist_id))
  );
}

function isArchiveEmpty(archive: HorrorArchiveState): boolean {
  return (
    archive.movies.length === 0 &&
    archive.watchRecords.length === 0 &&
    archive.watchlist.length === 0
  );
}

function isStoreCompletelyPristine(store: LocalStoreV2): boolean {
  return (
    isArchiveEmpty(store.archive) &&
    store.tombstones.length === 0 &&
    store.outbox.length === 0 &&
    !store.isGuestDirty &&
    !store.lastSyncedAt &&
    !store.lastSyncedUid &&
    !store.settings.display_name &&
    (store.settings.default_watch_method === undefined ||
      store.settings.default_watch_method === '独自')
  );
}

export function upgradeLegacyArchivePosters(archive: HorrorArchiveState): {
  archive: HorrorArchiveState;
  changed: boolean;
} {
  let changed = false;
  const movies = archive.movies.map((m) => {
    const isLegacy = isLegacyGeneratedPosterUrl(m.poster_url);
    const missingPoster = !m.poster_url || m.poster_url.trim() === '';
    const isTmdbPoster = Boolean(
      m.poster_url && /^https:\/\/image\.tmdb\.org\/t\/p\//i.test(m.poster_url.trim())
    );

    const match = findCatalogMatchForMovie(m);
    const needsEnglishUpgrade = Boolean(
      isTmdbPoster && match?.poster_url && m.poster_url !== match.poster_url
    );
    if (!isLegacy && !missingPoster && !needsEnglishUpgrade) return m;

    if (match?.poster_url) {
      changed = true;
      return {
        ...m,
        poster_url: match.poster_url,
        external_source: m.external_source || match.external_source,
        external_id: m.external_id || match.external_id,
      };
    }

    if (isLegacy) {
      changed = true;
      return {
        ...m,
        poster_url: undefined,
      };
    }

    return m;
  });

  if (!changed) return { archive, changed: false };
  return {
    archive: {
      ...archive,
      movies,
    },
    changed: true,
  };
}

function normalizeArchiveTimestamps(archive: HorrorArchiveState): HorrorArchiveState {
  const upgraded = upgradeLegacyArchivePosters(archive).archive;
  return {
    movies: upgraded.movies.map((m) => ({
      ...m,
      updated_at: m.updated_at || m.created_at || new Date().toISOString(),
    })),
    watchRecords: upgraded.watchRecords.map((r) => ({
      ...r,
      updated_at: r.updated_at || r.created_at || new Date().toISOString(),
    })),
    watchlist: upgraded.watchlist.map((w) => ({
      ...w,
      updated_at: w.updated_at || w.added_at || new Date().toISOString(),
    })),
  };
}

export function createEmptyLocalStoreV2(): LocalStoreV2 {
  return {
    version: 2,
    archive: {
      movies: [],
      watchRecords: [],
      watchlist: [],
    },
    tombstones: [],
    outbox: [],
    settings: { default_watch_method: '独自' },
    isGuestDirty: false,
    lastSyncedAt: null,
    lastSyncedUid: null,
  };
}

export function loadLocalStoreV2(): LocalStoreV2 {
  try {
    const rawV2 = localStorage.getItem(STORAGE_V2_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as Partial<LocalStoreV2>;
      if (
        parsed &&
        parsed.version === 2 &&
        parsed.archive &&
        Array.isArray(parsed.archive.movies) &&
        Array.isArray(parsed.archive.watchRecords) &&
        Array.isArray(parsed.archive.watchlist)
      ) {
        const candidateArchive: HorrorArchiveState = {
          movies: parsed.archive.movies,
          watchRecords: parsed.archive.watchRecords,
          watchlist: parsed.archive.watchlist,
        };

        if (
          !parsed.isGuestDirty &&
          !parsed.lastSyncedUid &&
          isUntouchedLegacySeed(candidateArchive)
        ) {
          localStorage.removeItem(STORAGE_V2_KEY);
          localStorage.removeItem(LEGACY_V1_KEY);
          return createEmptyLocalStoreV2();
        }

        const hadLegacy = parsed.archive.movies.some((m) =>
          isLegacyGeneratedPosterUrl(m.poster_url)
        );
        const store: LocalStoreV2 = {
          version: 2,
          archive: normalizeArchiveTimestamps(candidateArchive),
          tombstones: Array.isArray(parsed.tombstones) ? parsed.tombstones : [],
          outbox: Array.isArray(parsed.outbox) ? parsed.outbox : [],
          settings: parsed.settings || { default_watch_method: '独自' },
          isGuestDirty: Boolean(parsed.isGuestDirty),
          lastSyncedAt: parsed.lastSyncedAt || null,
          lastSyncedUid: parsed.lastSyncedUid || null,
        };
        if (hadLegacy) {
          saveLocalStoreV2(store);
        }
        return store;
      }
    }

    // Migrate non-destructively from v1 if present with real user data
    const rawV1 = localStorage.getItem(LEGACY_V1_KEY);
    if (rawV1) {
      const parsedV1 = JSON.parse(rawV1) as Partial<HorrorArchiveState>;
      if (
        parsedV1 &&
        Array.isArray(parsedV1.movies) &&
        Array.isArray(parsedV1.watchRecords) &&
        Array.isArray(parsedV1.watchlist)
      ) {
        const candidateV1: HorrorArchiveState = {
          movies: parsedV1.movies,
          watchRecords: parsedV1.watchRecords,
          watchlist: parsedV1.watchlist,
        };

        if (isUntouchedLegacySeed(candidateV1) || isArchiveEmpty(candidateV1)) {
          localStorage.removeItem(LEGACY_V1_KEY);
          return createEmptyLocalStoreV2();
        }

        const normalized = normalizeArchiveTimestamps(candidateV1);
        const migrated: LocalStoreV2 = {
          version: 2,
          archive: normalized,
          tombstones: [],
          outbox: [],
          settings: { default_watch_method: '独自' },
          isGuestDirty: true,
          lastSyncedAt: null,
          lastSyncedUid: null,
        };
        saveLocalStoreV2(migrated);
        return migrated;
      }
    }

    return createEmptyLocalStoreV2();
  } catch {
    return createEmptyLocalStoreV2();
  }
}

export function saveLocalStoreV2(store: LocalStoreV2): void {
  try {
    if (isStoreCompletelyPristine(store)) {
      localStorage.removeItem(STORAGE_V2_KEY);
      localStorage.removeItem(LEGACY_V1_KEY);
      return;
    }
    localStorage.setItem(STORAGE_V2_KEY, JSON.stringify(store));
    // Mirror archive payload to legacy key so existing backups/tools stay compatible
    localStorage.setItem(LEGACY_V1_KEY, JSON.stringify(store.archive));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

function areRecordsEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function applyArchiveMutationWithTracking(
  prevStore: LocalStoreV2,
  nextArchiveRaw: HorrorArchiveState,
  options?: { queueForCloud?: boolean; markGuestDirty?: boolean }
): LocalStoreV2 {
  const now = new Date().toISOString();
  const queueForCloud = options?.queueForCloud ?? true;

  const prevMoviesMap = new Map(prevStore.archive.movies.map((m) => [m.movie_id, m]));
  const prevRecordsMap = new Map(
    prevStore.archive.watchRecords.map((r) => [r.record_id, r])
  );
  const prevWatchlistMap = new Map(
    prevStore.archive.watchlist.map((w) => [w.watchlist_id, w])
  );

  const nextMovies: Movie[] = nextArchiveRaw.movies.map((m) => {
    const old = prevMoviesMap.get(m.movie_id);
    if (!old || !areRecordsEqual(old, m)) {
      return { ...m, updated_at: now, deleted_at: undefined };
    }
    return m;
  });

  const nextRecords: WatchRecord[] = nextArchiveRaw.watchRecords.map((r) => {
    const old = prevRecordsMap.get(r.record_id);
    if (!old || !areRecordsEqual(old, r)) {
      return { ...r, updated_at: now, deleted_at: undefined };
    }
    return r;
  });

  const nextWatchlist: WatchlistItem[] = nextArchiveRaw.watchlist.map((w) => {
    const old = prevWatchlistMap.get(w.watchlist_id);
    if (!old || !areRecordsEqual(old, w)) {
      return { ...w, updated_at: now, deleted_at: undefined };
    }
    return w;
  });

  const nextMovieIds = new Set(nextMovies.map((m) => m.movie_id));
  const nextRecordIds = new Set(nextRecords.map((r) => r.record_id));
  const nextWatchlistIds = new Set(nextWatchlist.map((w) => w.watchlist_id));

  // Maintain tombstones: keep prior tombstones whose IDs were not resurrected, add newly deleted IDs
  const tombstoneMap = new Map<string, SyncTombstone>();
  for (const t of prevStore.tombstones) {
    if (
      (t.entity === 'movie' && nextMovieIds.has(t.id)) ||
      (t.entity === 'watchRecord' && nextRecordIds.has(t.id)) ||
      (t.entity === 'watchlist' && nextWatchlistIds.has(t.id))
    ) {
      continue;
    }
    tombstoneMap.set(`${t.entity}:${t.id}`, t);
  }

  const outboxMap = new Map<string, SyncOutboxItem>(
    prevStore.outbox.map((item) => [item.key, item])
  );

  const enqueue = (
    entity: SyncOutboxItem['entity'],
    id: string,
    op: SyncOutboxItem['op']
  ) => {
    if (!queueForCloud) return;
    const key = `${entity}:${id}`;
    outboxMap.set(key, { key, entity, id, op, queued_at: now });
  };

  for (const m of nextMovies) {
    const old = prevMoviesMap.get(m.movie_id);
    if (!old || !areRecordsEqual(old, m)) {
      enqueue('movie', m.movie_id, 'upsert');
    }
  }
  for (const old of prevStore.archive.movies) {
    if (!nextMovieIds.has(old.movie_id)) {
      tombstoneMap.set(`movie:${old.movie_id}`, {
        entity: 'movie',
        id: old.movie_id,
        deleted_at: now,
      });
      enqueue('movie', old.movie_id, 'delete');
    }
  }

  for (const r of nextRecords) {
    const old = prevRecordsMap.get(r.record_id);
    if (!old || !areRecordsEqual(old, r)) {
      enqueue('watchRecord', r.record_id, 'upsert');
    }
  }
  for (const old of prevStore.archive.watchRecords) {
    if (!nextRecordIds.has(old.record_id)) {
      tombstoneMap.set(`watchRecord:${old.record_id}`, {
        entity: 'watchRecord',
        id: old.record_id,
        deleted_at: now,
      });
      enqueue('watchRecord', old.record_id, 'delete');
    }
  }

  for (const w of nextWatchlist) {
    const old = prevWatchlistMap.get(w.watchlist_id);
    if (!old || !areRecordsEqual(old, w)) {
      enqueue('watchlist', w.watchlist_id, 'upsert');
    }
  }
  for (const old of prevStore.archive.watchlist) {
    if (!nextWatchlistIds.has(old.watchlist_id)) {
      tombstoneMap.set(`watchlist:${old.watchlist_id}`, {
        entity: 'watchlist',
        id: old.watchlist_id,
        deleted_at: now,
      });
      enqueue('watchlist', old.watchlist_id, 'delete');
    }
  }

  const nextArchive: HorrorArchiveState = {
    movies: nextMovies,
    watchRecords: nextRecords,
    watchlist: nextWatchlist,
  };

  return {
    ...prevStore,
    archive: nextArchive,
    tombstones: Array.from(tombstoneMap.values()),
    outbox: Array.from(outboxMap.values()),
    isGuestDirty:
      options?.markGuestDirty !== undefined
        ? options.markGuestDirty
        : prevStore.isGuestDirty || !isArchiveEmpty(nextArchive),
  };
}

function getMovieIdentityKeys(m: Movie): string[] {
  const keys: string[] = [];
  if (m.external_source && m.external_id?.trim()) {
    keys.push(`ext:${m.external_source}:${m.external_id.trim()}`);
  }
  const yr = m.release_year ? String(m.release_year) : '';
  if (m.title.trim()) {
    keys.push(`t:${m.title.trim().toLowerCase()}::${yr}`);
  }
  if (m.original_title?.trim()) {
    keys.push(`o:${m.original_title.trim().toLowerCase()}::${yr}`);
  }
  return keys;
}

function pickNewerTime(a?: string, b?: string): number {
  const ta = a ? Date.parse(a) || 0 : 0;
  const tb = b ? Date.parse(b) || 0 : 0;
  return ta - tb;
}

export function cloudHasAnyActiveData(cloud: CloudSnapshotData): boolean {
  return (
    cloud.movies.some((m) => !m.deleted_at) ||
    cloud.watchRecords.some((r) => !r.deleted_at) ||
    cloud.watchlist.some((w) => !w.deleted_at)
  );
}

export function resolveGuestCloudMigration(
  localStore: LocalStoreV2,
  cloud: CloudSnapshotData,
  resolution: MigrationResolution
): {
  archive: HorrorArchiveState;
  tombstones: SyncTombstone[];
  outbox: SyncOutboxItem[];
  settings: UserSettings;
  needsFullCloudSync: boolean;
} {
  const now = new Date().toISOString();

  if (resolution === 'prefer_cloud') {
    const activeMovies = cloud.movies.filter((m) => !m.deleted_at);
    const activeRecords = cloud.watchRecords.filter((r) => !r.deleted_at);
    const activeWatchlist = cloud.watchlist.filter((w) => !w.deleted_at);
    const upgraded = upgradeLegacyArchivePosters({
      movies: activeMovies,
      watchRecords: activeRecords,
      watchlist: activeWatchlist,
    });
    return {
      archive: upgraded.archive,
      tombstones: [],
      outbox: [],
      settings: cloud.profile || localStore.settings,
      needsFullCloudSync: false,
    };
  }

  if (resolution === 'prefer_local') {
    const outbox: SyncOutboxItem[] = [
      ...localStore.archive.movies.map((m) => ({
        key: `movie:${m.movie_id}`,
        entity: 'movie' as const,
        id: m.movie_id,
        op: 'upsert' as const,
        queued_at: now,
      })),
      ...localStore.archive.watchRecords.map((r) => ({
        key: `watchRecord:${r.record_id}`,
        entity: 'watchRecord' as const,
        id: r.record_id,
        op: 'upsert' as const,
        queued_at: now,
      })),
      ...localStore.archive.watchlist.map((w) => ({
        key: `watchlist:${w.watchlist_id}`,
        entity: 'watchlist' as const,
        id: w.watchlist_id,
        op: 'upsert' as const,
        queued_at: now,
      })),
      {
        key: 'profile:self',
        entity: 'profile' as const,
        id: 'self',
        op: 'upsert' as const,
        queued_at: now,
      },
    ];

    // Also delete any cloud-only records that are not in local archive
    const localMovieIds = new Set(localStore.archive.movies.map((m) => m.movie_id));
    const localRecordIds = new Set(
      localStore.archive.watchRecords.map((r) => r.record_id)
    );
    const localWatchlistIds = new Set(
      localStore.archive.watchlist.map((w) => w.watchlist_id)
    );
    const tombstones: SyncTombstone[] = [];

    for (const cm of cloud.movies) {
      if (!cm.deleted_at && !localMovieIds.has(cm.movie_id)) {
        tombstones.push({ entity: 'movie', id: cm.movie_id, deleted_at: now });
        outbox.push({
          key: `movie:${cm.movie_id}`,
          entity: 'movie',
          id: cm.movie_id,
          op: 'delete',
          queued_at: now,
        });
      }
    }
    for (const cr of cloud.watchRecords) {
      if (!cr.deleted_at && !localRecordIds.has(cr.record_id)) {
        tombstones.push({ entity: 'watchRecord', id: cr.record_id, deleted_at: now });
        outbox.push({
          key: `watchRecord:${cr.record_id}`,
          entity: 'watchRecord',
          id: cr.record_id,
          op: 'delete',
          queued_at: now,
        });
      }
    }
    for (const cw of cloud.watchlist) {
      if (!cw.deleted_at && !localWatchlistIds.has(cw.watchlist_id)) {
        tombstones.push({ entity: 'watchlist', id: cw.watchlist_id, deleted_at: now });
        outbox.push({
          key: `watchlist:${cw.watchlist_id}`,
          entity: 'watchlist',
          id: cw.watchlist_id,
          op: 'delete',
          queued_at: now,
        });
      }
    }

    return {
      archive: localStore.archive,
      tombstones,
      outbox,
      settings: {
        ...cloud.profile,
        ...localStore.settings,
      },
      needsFullCloudSync: true,
    };
  }

  // 'merge': Smart Deduplicate + Last-Write-Wins + Respect Tombstones
  const localTombstoneMap = new Map(
    localStore.tombstones.map((t) => [`${t.entity}:${t.id}`, t])
  );
  const cloudMovieMap = new Map(cloud.movies.map((m) => [m.movie_id, m]));
  const localMovieMap = new Map(localStore.archive.movies.map((m) => [m.movie_id, m]));

  const mergedMoviesMap = new Map<string, Movie>();
  const movieIdRemap = new Map<string, string>();
  const identityToCanonicalId = new Map<string, string>();
  const mergedTombstonesMap = new Map<string, SyncTombstone>();

  // 1. Seed canonical movies from cloud first (active & deleted tombstones)
  for (const cm of cloud.movies) {
    const localTomb = localTombstoneMap.get(`movie:${cm.movie_id}`);
    const cloudDeletedAt = cm.deleted_at;
    const effectiveDeleted =
      localTomb && (!cloudDeletedAt || pickNewerTime(localTomb.deleted_at, cloudDeletedAt) > 0)
        ? localTomb.deleted_at
        : cloudDeletedAt;

    const lm = localMovieMap.get(cm.movie_id);
    const localUpdated = lm?.updated_at || lm?.created_at;
    const cloudUpdated = cm.updated_at || cm.created_at;

    if (effectiveDeleted) {
      // Check if local item was edited AFTER deletion
      if (lm && pickNewerTime(localUpdated, effectiveDeleted) > 0) {
        mergedMoviesMap.set(lm.movie_id, lm);
        for (const k of getMovieIdentityKeys(lm)) {
          identityToCanonicalId.set(k, lm.movie_id);
        }
      } else {
        mergedTombstonesMap.set(`movie:${cm.movie_id}`, {
          entity: 'movie',
          id: cm.movie_id,
          deleted_at: effectiveDeleted,
        });
      }
      continue;
    }

    const chosen =
      lm && pickNewerTime(localUpdated, cloudUpdated) > 0
        ? { ...cm, ...lm }
        : cm;
    mergedMoviesMap.set(chosen.movie_id, chosen);
    for (const k of getMovieIdentityKeys(chosen)) {
      identityToCanonicalId.set(k, chosen.movie_id);
    }
  }

  // 2. Merge local movies that didn't match by movie_id
  for (const lm of localStore.archive.movies) {
    if (cloudMovieMap.has(lm.movie_id)) continue;

    // Check title+year deduplication against existing canonical movies
    let matchedId: string | undefined;
    for (const k of getMovieIdentityKeys(lm)) {
      const hit = identityToCanonicalId.get(k);
      if (hit) {
        matchedId = hit;
        break;
      }
    }

    if (matchedId) {
      movieIdRemap.set(lm.movie_id, matchedId);
      const existing = mergedMoviesMap.get(matchedId)!;
      if (
        pickNewerTime(lm.updated_at || lm.created_at, existing.updated_at || existing.created_at) >
        0
      ) {
        mergedMoviesMap.set(matchedId, {
          ...existing,
          ...lm,
          movie_id: matchedId,
        });
      }
    } else {
      mergedMoviesMap.set(lm.movie_id, lm);
      for (const k of getMovieIdentityKeys(lm)) {
        identityToCanonicalId.set(k, lm.movie_id);
      }
    }
  }

  // 3. Merge WatchRecords (remapping movie_id if deduplicated, 1 active record per movie)
  const cloudRecordMap = new Map(cloud.watchRecords.map((r) => [r.record_id, r]));
  const localRecordMap = new Map(
    localStore.archive.watchRecords.map((r) => [r.record_id, r])
  );
  const candidateRecords: WatchRecord[] = [];

  for (const cr of cloud.watchRecords) {
    const localTomb = localTombstoneMap.get(`watchRecord:${cr.record_id}`);
    const effDel =
      localTomb && (!cr.deleted_at || pickNewerTime(localTomb.deleted_at, cr.deleted_at) > 0)
        ? localTomb.deleted_at
        : cr.deleted_at;
    const lr = localRecordMap.get(cr.record_id);

    if (effDel) {
      if (lr && pickNewerTime(lr.updated_at, effDel) > 0) {
        candidateRecords.push({
          ...lr,
          movie_id: movieIdRemap.get(lr.movie_id) || lr.movie_id,
        });
      } else {
        mergedTombstonesMap.set(`watchRecord:${cr.record_id}`, {
          entity: 'watchRecord',
          id: cr.record_id,
          deleted_at: effDel,
        });
      }
      continue;
    }

    const chosen =
      lr && pickNewerTime(lr.updated_at, cr.updated_at) > 0 ? lr : cr;
    candidateRecords.push({
      ...chosen,
      movie_id: movieIdRemap.get(chosen.movie_id) || chosen.movie_id,
    });
  }

  for (const lr of localStore.archive.watchRecords) {
    if (cloudRecordMap.has(lr.record_id)) continue;
    candidateRecords.push({
      ...lr,
      movie_id: movieIdRemap.get(lr.movie_id) || lr.movie_id,
    });
  }

  // Deduplicate watchRecords per movie_id keeping newest updated_at
  const recordByMovie = new Map<string, WatchRecord>();
  for (const rec of candidateRecords) {
    if (!mergedMoviesMap.has(rec.movie_id)) continue;
    const existing = recordByMovie.get(rec.movie_id);
    if (!existing || pickNewerTime(rec.updated_at, existing.updated_at) > 0) {
      recordByMovie.set(rec.movie_id, rec);
    }
  }

  // 4. Merge Watchlist (remapping movie_id, omitting movies already marked watched unless watchlist is newer)
  const cloudWlMap = new Map(cloud.watchlist.map((w) => [w.watchlist_id, w]));
  const localWlMap = new Map(
    localStore.archive.watchlist.map((w) => [w.watchlist_id, w])
  );
  const candidateWatchlist: WatchlistItem[] = [];

  for (const cw of cloud.watchlist) {
    const localTomb = localTombstoneMap.get(`watchlist:${cw.watchlist_id}`);
    const effDel =
      localTomb && (!cw.deleted_at || pickNewerTime(localTomb.deleted_at, cw.deleted_at) > 0)
        ? localTomb.deleted_at
        : cw.deleted_at;
    const lw = localWlMap.get(cw.watchlist_id);

    if (effDel) {
      if (lw && pickNewerTime(lw.updated_at || lw.added_at, effDel) > 0) {
        candidateWatchlist.push({
          ...lw,
          movie_id: movieIdRemap.get(lw.movie_id) || lw.movie_id,
        });
      } else {
        mergedTombstonesMap.set(`watchlist:${cw.watchlist_id}`, {
          entity: 'watchlist',
          id: cw.watchlist_id,
          deleted_at: effDel,
        });
      }
      continue;
    }

    const chosen =
      lw &&
      pickNewerTime(lw.updated_at || lw.added_at, cw.updated_at || cw.added_at) > 0
        ? lw
        : cw;
    candidateWatchlist.push({
      ...chosen,
      movie_id: movieIdRemap.get(chosen.movie_id) || chosen.movie_id,
    });
  }

  for (const lw of localStore.archive.watchlist) {
    if (cloudWlMap.has(lw.watchlist_id)) continue;
    candidateWatchlist.push({
      ...lw,
      movie_id: movieIdRemap.get(lw.movie_id) || lw.movie_id,
    });
  }

  const watchlistByMovie = new Map<string, WatchlistItem>();
  for (const item of candidateWatchlist) {
    if (!mergedMoviesMap.has(item.movie_id)) continue;
    // If movie is already watched, omit stale watchlist item
    if (recordByMovie.has(item.movie_id)) continue;
    const existing = watchlistByMovie.get(item.movie_id);
    if (
      !existing ||
      pickNewerTime(item.updated_at || item.added_at, existing.updated_at || existing.added_at) >
        0
    ) {
      watchlistByMovie.set(item.movie_id, item);
    }
  }

  const mergedArchive: HorrorArchiveState = {
    movies: Array.from(mergedMoviesMap.values()).sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    ),
    watchRecords: Array.from(recordByMovie.values()).sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    ),
    watchlist: Array.from(watchlistByMovie.values()).sort((a, b) =>
      b.added_at.localeCompare(a.added_at)
    ),
  };

  // Enqueue any local additions/edits/tombstones not already reflected in cloud
  const outbox: SyncOutboxItem[] = [];
  for (const m of mergedArchive.movies) {
    const cm = cloudMovieMap.get(m.movie_id);
    if (!cm || cm.deleted_at || pickNewerTime(m.updated_at, cm.updated_at) > 0) {
      outbox.push({
        key: `movie:${m.movie_id}`,
        entity: 'movie',
        id: m.movie_id,
        op: 'upsert',
        queued_at: now,
      });
    }
  }
  for (const r of mergedArchive.watchRecords) {
    const cr = cloudRecordMap.get(r.record_id);
    if (!cr || cr.deleted_at || pickNewerTime(r.updated_at, cr.updated_at) > 0) {
      outbox.push({
        key: `watchRecord:${r.record_id}`,
        entity: 'watchRecord',
        id: r.record_id,
        op: 'upsert',
        queued_at: now,
      });
    }
  }
  for (const w of mergedArchive.watchlist) {
    const cw = cloudWlMap.get(w.watchlist_id);
    if (!cw || cw.deleted_at || pickNewerTime(w.updated_at || w.added_at, cw.updated_at || cw.added_at) > 0) {
      outbox.push({
        key: `watchlist:${w.watchlist_id}`,
        entity: 'watchlist',
        id: w.watchlist_id,
        op: 'upsert',
        queued_at: now,
      });
    }
  }
  for (const t of mergedTombstonesMap.values()) {
    outbox.push({
      key: `${t.entity}:${t.id}`,
      entity: t.entity,
      id: t.id,
      op: 'delete',
      queued_at: now,
    });
  }

  const upgradedMerged = upgradeLegacyArchivePosters(mergedArchive);

  return {
    archive: upgradedMerged.archive,
    tombstones: Array.from(mergedTombstonesMap.values()),
    outbox,
    settings: {
      default_watch_method:
        cloud.profile?.default_watch_method || localStore.settings.default_watch_method || '独自',
      display_name: cloud.profile?.display_name || localStore.settings.display_name,
    },
    needsFullCloudSync: outbox.length > 0,
  };
}
