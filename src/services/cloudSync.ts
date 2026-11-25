import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  encodeNicknameKey,
  looksLikeEmail,
  validateNickname,
} from '../utils/nickname';
import {
  auth,
  db,
  firebaseProjectId,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  CachedMovieMetadata,
  CloudSnapshotData,
  ExternalMovieDetail,
  ExternalMovieSource,
  GoreLevel,
  HORROR_GENRES,
  HorrorArchiveState,
  HorrorGenre,
  HorrorLevel,
  LocalStoreV2,
  Movie,
  SCARE_TYPES,
  ScareType,
  UserSettings,
  WATCH_METHODS,
  WatchlistItem,
  WatchlistPriority,
  WatchMethod,
  WatchRecord,
} from '../types/horror';

const VALID_GENRE_SET = new Set<string>(HORROR_GENRES.map((g) => g.value));
const VALID_SCARE_SET = new Set<string>(SCARE_TYPES);
const VALID_GORE_SET = new Set<string>(['低', '中', '高', '极高']);
const VALID_METHOD_SET = new Set<string>(WATCH_METHODS);
const VALID_PRIORITY_SET = new Set<string>(['high', 'medium', 'low']);

export function mapAuthErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  const rawMessage = error instanceof Error ? error.message : String(error);

  switch (code) {
    case 'auth/operation-not-allowed':
      return `尚未在 Firebase 控制台启用“电子邮件/密码”登录方式。请打开 Firebase Console（项目 ${firebaseProjectId}）→ Authentication → Sign-in method，启用 Email/Password 后即可使用。`;
    case 'auth/email-already-in-use':
      return '该邮箱已被注册，请直接登录或通过“忘记密码”找回。';
    case 'auth/invalid-email':
      return '邮箱格式不正确，请检查后重试。';
    case 'auth/weak-password':
      return '密码强度不足，请至少输入 6 位密码。';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return '邮箱或密码错误，请核对后重试。';
    case 'auth/too-many-requests':
      return '尝试次数过多，请稍后再试。';
    case 'auth/network-request-failed':
      return '网络连接失败，请检查网络状态后重试。';
    case 'auth/requires-recent-login':
      return '出于账户安全保护，请先输入当前登录密码完成身份核验后再删除账户。';
    default:
      return rawMessage || '身份验证失败，请稍后重试。';
  }
}

function clampString(val: string | undefined, maxLen: number): string | undefined {
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

function sanitizeMovieForCloud(movie: Movie, uid: string): Record<string, unknown> {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    uid,
    movie_id: movie.movie_id.slice(0, 128),
    title: (movie.title.trim() || '未命名电影').slice(0, 200),
    genres: (movie.genres || [])
      .filter((g): g is HorrorGenre => VALID_GENRE_SET.has(g))
      .slice(0, 13),
    created_at: (movie.created_at || now).slice(0, 40),
    updated_at: (movie.updated_at || movie.created_at || now).slice(0, 40),
    server_updated_at: serverTimestamp(),
  };

  const originalTitle = clampString(movie.original_title, 200);
  if (originalTitle) payload.original_title = originalTitle;

  if (typeof movie.poster_url === 'string' && movie.poster_url.trim()) {
    const trimmedPoster = movie.poster_url.trim();
    if (trimmedPoster.length <= 250000) {
      payload.poster_url = trimmedPoster;
    }
  }

  if (
    typeof movie.release_year === 'number' &&
    Number.isInteger(movie.release_year) &&
    movie.release_year >= 1880 &&
    movie.release_year <= 2100
  ) {
    payload.release_year = movie.release_year;
  }

  const director = clampString(movie.director, 160);
  if (director) payload.director = director;

  const country = clampString(movie.country, 120);
  if (country) payload.country = country;

  if (
    typeof movie.duration === 'number' &&
    Number.isInteger(movie.duration) &&
    movie.duration >= 1 &&
    movie.duration <= 1200
  ) {
    payload.duration = movie.duration;
  }

  const synopsis = clampString(movie.synopsis, 4000);
  if (synopsis) payload.synopsis = synopsis;

  const releaseDate = clampString(movie.release_date, 20);
  if (releaseDate) payload.release_date = releaseDate;

  if (movie.external_source === 'tmdb') {
    payload.external_source = 'tmdb';
  }

  const externalId = clampString(movie.external_id, 64);
  if (externalId) payload.external_id = externalId;

  if (
    typeof movie.external_rating === 'number' &&
    !Number.isNaN(movie.external_rating) &&
    movie.external_rating >= 0 &&
    movie.external_rating <= 10
  ) {
    payload.external_rating = Number(movie.external_rating.toFixed(1));
  }

  return payload;
}

function sanitizeWatchRecordForCloud(
  record: WatchRecord,
  uid: string
): Record<string, unknown> {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    uid,
    record_id: record.record_id.slice(0, 128),
    movie_id: record.movie_id.slice(0, 128),
    scare_types: (record.scare_types || [])
      .filter((s): s is ScareType => VALID_SCARE_SET.has(s))
      .slice(0, 6),
    watch_count:
      typeof record.watch_count === 'number'
        ? Math.min(999, Math.max(1, Math.round(record.watch_count)))
        : 1,
    created_at: (record.created_at || now).slice(0, 40),
    updated_at: (record.updated_at || record.created_at || now).slice(0, 40),
    server_updated_at: serverTimestamp(),
  };

  const watchDate = clampString(record.watch_date, 40);
  if (watchDate) payload.watch_date = watchDate;

  if (
    typeof record.rating === 'number' &&
    !Number.isNaN(record.rating) &&
    record.rating >= 0 &&
    record.rating <= 10
  ) {
    payload.rating = Number(record.rating.toFixed(1));
  }

  const review = clampString(record.review, 10000);
  if (review) payload.review = review;

  if (
    typeof record.horror_level === 'number' &&
    Number.isInteger(record.horror_level) &&
    record.horror_level >= 1 &&
    record.horror_level <= 5
  ) {
    payload.horror_level = record.horror_level as HorrorLevel;
  }

  if (record.gore_level && VALID_GORE_SET.has(record.gore_level)) {
    payload.gore_level = record.gore_level as GoreLevel;
  }

  if (record.watch_method && VALID_METHOD_SET.has(record.watch_method)) {
    payload.watch_method = record.watch_method as WatchMethod;
  }

  return payload;
}

function sanitizeWatchlistForCloud(
  item: WatchlistItem,
  uid: string
): Record<string, unknown> {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    uid,
    watchlist_id: item.watchlist_id.slice(0, 128),
    movie_id: item.movie_id.slice(0, 128),
    added_at: (item.added_at || now).slice(0, 40),
    updated_at: (item.updated_at || item.added_at || now).slice(0, 40),
    server_updated_at: serverTimestamp(),
  };

  const note = clampString(item.note, 2000);
  if (note) payload.note = note;

  const recommendedBy = clampString(item.recommended_by, 120);
  if (recommendedBy) payload.recommended_by = recommendedBy;

  const plannedDate = clampString(item.planned_date, 40);
  if (plannedDate) payload.planned_date = plannedDate;

  if (item.priority && VALID_PRIORITY_SET.has(item.priority)) {
    payload.priority = item.priority;
  }

  return payload;
}

function docToMovie(data: Record<string, unknown>): Movie {
  return {
    movie_id: String(data.movie_id || ''),
    title: String(data.title || ''),
    original_title:
      typeof data.original_title === 'string' ? data.original_title : undefined,
    poster_url: typeof data.poster_url === 'string' ? data.poster_url : undefined,
    release_date:
      typeof data.release_date === 'string' ? data.release_date : undefined,
    release_year: typeof data.release_year === 'number' ? data.release_year : undefined,
    director: typeof data.director === 'string' ? data.director : undefined,
    country: typeof data.country === 'string' ? data.country : undefined,
    duration: typeof data.duration === 'number' ? data.duration : undefined,
    synopsis: typeof data.synopsis === 'string' ? data.synopsis : undefined,
    genres: Array.isArray(data.genres) ? (data.genres as HorrorGenre[]) : [],
    external_source:
      data.external_source === 'tmdb'
        ? (data.external_source as ExternalMovieSource)
        : undefined,
    external_id:
      typeof data.external_id === 'string' ? data.external_id : undefined,
    external_rating:
      typeof data.external_rating === 'number' ? data.external_rating : undefined,
    created_at: String(data.created_at || new Date().toISOString()),
    updated_at:
      typeof data.updated_at === 'string' ? data.updated_at : undefined,
    deleted_at:
      typeof data.deleted_at === 'string' ? data.deleted_at : undefined,
  };
}

function docToWatchRecord(data: Record<string, unknown>): WatchRecord {
  return {
    record_id: String(data.record_id || ''),
    movie_id: String(data.movie_id || ''),
    watch_date: typeof data.watch_date === 'string' ? data.watch_date : undefined,
    rating: typeof data.rating === 'number' ? data.rating : undefined,
    review: typeof data.review === 'string' ? data.review : undefined,
    horror_level:
      typeof data.horror_level === 'number'
        ? (data.horror_level as HorrorLevel)
        : undefined,
    gore_level:
      typeof data.gore_level === 'string'
        ? (data.gore_level as GoreLevel)
        : undefined,
    scare_types: Array.isArray(data.scare_types)
      ? (data.scare_types as ScareType[])
      : [],
    watch_method:
      typeof data.watch_method === 'string'
        ? (data.watch_method as WatchMethod)
        : undefined,
    watch_count: typeof data.watch_count === 'number' ? data.watch_count : 1,
    created_at: String(data.created_at || new Date().toISOString()),
    updated_at: String(data.updated_at || new Date().toISOString()),
    deleted_at:
      typeof data.deleted_at === 'string' ? data.deleted_at : undefined,
  };
}

function docToWatchlistItem(data: Record<string, unknown>): WatchlistItem {
  return {
    watchlist_id: String(data.watchlist_id || ''),
    movie_id: String(data.movie_id || ''),
    added_at: String(data.added_at || new Date().toISOString()),
    note: typeof data.note === 'string' ? data.note : undefined,
    recommended_by:
      typeof data.recommended_by === 'string' ? data.recommended_by : undefined,
    planned_date:
      typeof data.planned_date === 'string' ? data.planned_date : undefined,
    priority:
      typeof data.priority === 'string' && VALID_PRIORITY_SET.has(data.priority)
        ? (data.priority as WatchlistPriority)
        : undefined,
    updated_at:
      typeof data.updated_at === 'string' ? data.updated_at : undefined,
    deleted_at:
      typeof data.deleted_at === 'string' ? data.deleted_at : undefined,
  };
}

export async function checkNicknameAvailability(
  rawNickname: string,
  currentUid?: string
): Promise<{ available: boolean; message?: string; nickname?: string; key?: string }> {
  const res = validateNickname(rawNickname);
  if (!res.ok) {
    return { available: false, message: res.message };
  }
  const path = `nicknames/${res.key}`;
  try {
    const snap = await getDoc(doc(db, 'nicknames', res.key));
    if (snap.exists()) {
      const ownerUid = (snap.data() as { uid?: string }).uid;
      if (currentUid && ownerUid === currentUid) {
        return { available: true, nickname: res.nickname, key: res.key };
      }
      return {
        available: false,
        message: '该昵称已被其他用户使用，不允许重复昵称。',
      };
    }
    return { available: true, nickname: res.nickname, key: res.key };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function ensureUserProfileDoc(
  user: User,
  settings?: UserSettings
): Promise<UserSettings> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const now = new Date().toISOString();

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const profilePayload: Record<string, unknown> = {
        uid: user.uid,
        created_at: now,
        updated_at: now,
        server_updated_at: serverTimestamp(),
      };
      const email = clampString(user.email || undefined, 254);
      if (email) profilePayload.email = email;
      const rawName = settings?.display_name ?? user.displayName ?? undefined;
      const validatedName =
        rawName && validateNickname(rawName).ok ? rawName.trim() : undefined;
      if (validatedName) profilePayload.display_name = validatedName;
      if (
        settings?.default_watch_method &&
        VALID_METHOD_SET.has(settings.default_watch_method)
      ) {
        profilePayload.default_watch_method = settings.default_watch_method;
      }

      await setDoc(ref, profilePayload);
      return {
        display_name: validatedName,
        default_watch_method: settings?.default_watch_method || '独自',
      };
    }

    const existing = snap.data() as Record<string, unknown>;
    if (settings) {
      const updatePayload: Record<string, unknown> = {
        uid: user.uid,
        created_at: String(existing.created_at || now),
        updated_at: now,
        server_updated_at: serverTimestamp(),
      };
      const email = clampString(
        user.email || (existing.email as string | undefined),
        254
      );
      if (email) updatePayload.email = email;
      const rawName =
        settings.display_name !== undefined
          ? settings.display_name
          : (existing.display_name as string | undefined);
      const validatedName =
        rawName && validateNickname(rawName).ok ? rawName.trim() : undefined;
      if (validatedName) updatePayload.display_name = validatedName;
      const method =
        settings.default_watch_method ||
        (existing.default_watch_method as WatchMethod | undefined);
      if (method && VALID_METHOD_SET.has(method)) {
        updatePayload.default_watch_method = method;
      }
      await setDoc(ref, updatePayload);
      return {
        display_name: validatedName,
        default_watch_method: method || '独自',
      };
    }

    return {
      display_name:
        typeof existing.display_name === 'string'
          ? existing.display_name
          : undefined,
      default_watch_method:
        typeof existing.default_watch_method === 'string'
          ? (existing.default_watch_method as WatchMethod)
          : '独自',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserNickname(
  user: User,
  rawNickname: string,
  defaultWatchMethod?: WatchMethod
): Promise<UserSettings> {
  const res = validateNickname(rawNickname);
  if (!res.ok) {
    throw new Error(res.message);
  }

  const avail = await checkNicknameAvailability(res.nickname, user.uid);
  if (!avail.available) {
    throw new Error(avail.message || '该昵称已被占用。');
  }

  const profileSnap = await getDoc(doc(db, 'users', user.uid));
  const existingData = profileSnap.exists()
    ? (profileSnap.data() as Record<string, unknown>)
    : {};
  const oldNickname =
    (typeof existingData.display_name === 'string'
      ? existingData.display_name
      : user.displayName) || undefined;
  const oldValid = oldNickname ? validateNickname(oldNickname) : null;
  const oldKey = oldValid && oldValid.ok ? oldValid.key : null;

  const now = new Date().toISOString();
  if (res.key !== oldKey) {
    try {
      await setDoc(doc(db, 'nicknames', res.key), {
        uid: user.uid,
        nickname: res.nickname,
        nickname_key: res.key,
        login_email: (user.email || '').trim().slice(0, 254),
        created_at: now,
        server_updated_at: serverTimestamp(),
      });
    } catch {
      throw new Error('该昵称刚刚被其他用户占用，请更换一个昵称。');
    }

    if (oldKey) {
      try {
        await deleteDoc(doc(db, 'nicknames', oldKey));
      } catch {
        // Ignore cleanup failure for non-owned legacy doc
      }
    }
  }

  await updateProfile(user, { displayName: res.nickname });
  return ensureUserProfileDoc(user, {
    display_name: res.nickname,
    default_watch_method: defaultWatchMethod,
  });
}

export async function registerWithEmail(
  email: string,
  password: string,
  rawNickname?: string
): Promise<User> {
  let validatedNick: { nickname: string; key: string } | null = null;
  if (rawNickname?.trim()) {
    const check = await checkNicknameAvailability(rawNickname);
    if (!check.available || !check.nickname || !check.key) {
      throw new Error(check.message || '昵称格式无效或已被占用。');
    }
    validatedNick = { nickname: check.nickname, key: check.key };
  }

  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const now = new Date().toISOString();

  if (validatedNick) {
    try {
      await setDoc(doc(db, 'nicknames', validatedNick.key), {
        uid: cred.user.uid,
        nickname: validatedNick.nickname,
        nickname_key: validatedNick.key,
        login_email: (cred.user.email || email.trim()).slice(0, 254),
        created_at: now,
        server_updated_at: serverTimestamp(),
      });
      await updateProfile(cred.user, { displayName: validatedNick.nickname });
    } catch {
      try {
        await deleteUser(cred.user);
      } catch {
        // Ignore rollback error
      }
      throw new Error('该昵称已被其他用户使用，请更换一个昵称后重试。');
    }
  }

  await ensureUserProfileDoc(cred.user, {
    display_name: validatedNick?.nickname,
    default_watch_method: '独自',
  });
  return cred.user;
}

async function lookupEmailByNickname(rawNickname: string): Promise<string | null> {
  const res = validateNickname(rawNickname);
  if (!res.ok) return null;
  const path = `nicknames/${res.key}`;
  try {
    const snap = await getDoc(doc(db, 'nicknames', res.key));
    if (!snap.exists()) return null;
    const data = snap.data() as { login_email?: string };
    return typeof data.login_email === 'string' ? data.login_email : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function loginWithIdentifier(
  identifier: string,
  password: string
): Promise<User> {
  const trimmed = identifier.trim();
  if (!trimmed) {
    throw new Error('请输入邮箱地址或英文符号昵称。');
  }

  if (looksLikeEmail(trimmed)) {
    try {
      const cred = await signInWithEmailAndPassword(auth, trimmed, password);
      return cred.user;
    } catch (err) {
      const nickCheck = validateNickname(trimmed);
      if (nickCheck.ok) {
        const resolved = await lookupEmailByNickname(trimmed);
        if (resolved && resolved.toLowerCase() !== trimmed.toLowerCase()) {
          const cred = await signInWithEmailAndPassword(auth, resolved, password);
          return cred.user;
        }
      }
      throw err;
    }
  }

  const nickCheck = validateNickname(trimmed);
  if (!nickCheck.ok) {
    throw new Error('请输入有效的邮箱地址，或仅包含英文字母与符号的昵称。');
  }

  const resolvedEmail = await lookupEmailByNickname(nickCheck.nickname);
  if (!resolvedEmail) {
    throw new Error('未找到该昵称对应的账户，请核对昵称或改用邮箱登录。');
  }

  const cred = await signInWithEmailAndPassword(auth, resolvedEmail, password);
  return cred.user;
}

export async function sendPasswordReset(identifier: string): Promise<void> {
  const trimmed = identifier.trim();
  if (!trimmed) {
    throw new Error('请输入注册邮箱或唯一昵称。');
  }

  if (looksLikeEmail(trimmed)) {
    await sendPasswordResetEmail(auth, trimmed);
    return;
  }

  const nickCheck = validateNickname(trimmed);
  if (!nickCheck.ok) {
    throw new Error('请输入有效的邮箱地址或英文符号昵称。');
  }

  const resolvedEmail = await lookupEmailByNickname(nickCheck.nickname);
  if (!resolvedEmail) {
    throw new Error('未找到该昵称对应的账户，请核对昵称或直接输入注册邮箱。');
  }
  await sendPasswordResetEmail(auth, resolvedEmail);
}

export async function logoutAccount(): Promise<void> {
  await signOut(auth);
}

export async function fetchCloudArchive(uid: string): Promise<CloudSnapshotData> {
  const profilePath = `users/${uid}`;
  const moviesPath = `users/${uid}/movies`;
  const recordsPath = `users/${uid}/watchRecords`;
  const watchlistPath = `users/${uid}/watchlist`;

  let profile: UserSettings | null = null;
  try {
    const profileSnap = await getDoc(doc(db, 'users', uid));
    if (profileSnap.exists()) {
      const data = profileSnap.data() as Record<string, unknown>;
      profile = {
        display_name:
          typeof data.display_name === 'string' ? data.display_name : undefined,
        default_watch_method:
          typeof data.default_watch_method === 'string'
            ? (data.default_watch_method as WatchMethod)
            : undefined,
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, profilePath);
  }

  let movies: Movie[] = [];
  try {
    const snap = await getDocs(
      query(collection(db, 'users', uid, 'movies'), where('uid', '==', uid))
    );
    movies = snap.docs.map((d) => docToMovie(d.data() as Record<string, unknown>));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, moviesPath);
  }

  let watchRecords: WatchRecord[] = [];
  try {
    const snap = await getDocs(
      query(collection(db, 'users', uid, 'watchRecords'), where('uid', '==', uid))
    );
    watchRecords = snap.docs.map((d) =>
      docToWatchRecord(d.data() as Record<string, unknown>)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, recordsPath);
  }

  let watchlist: WatchlistItem[] = [];
  try {
    const snap = await getDocs(
      query(collection(db, 'users', uid, 'watchlist'), where('uid', '==', uid))
    );
    watchlist = snap.docs.map((d) =>
      docToWatchlistItem(d.data() as Record<string, unknown>)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, watchlistPath);
  }

  return { profile, movies, watchRecords, watchlist };
}

type BatchOp =
  | { type: 'set'; path: string; ref: ReturnType<typeof doc>; data: Record<string, unknown> }
  | { type: 'delete'; path: string; ref: ReturnType<typeof doc> };

async function commitBatchedOps(ops: BatchOp[]): Promise<void> {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      if (op.type === 'set') {
        batch.set(op.ref, op.data);
      } else {
        batch.delete(op.ref);
      }
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, chunk[0]?.path || 'users');
    }
  }
}

export async function pushOutboxToCloud(
  user: User,
  store: LocalStoreV2
): Promise<void> {
  const uid = user.uid;
  const movieMap = new Map(store.archive.movies.map((m) => [m.movie_id, m]));
  const recordMap = new Map(
    store.archive.watchRecords.map((r) => [r.record_id, r])
  );
  const watchlistMap = new Map(
    store.archive.watchlist.map((w) => [w.watchlist_id, w])
  );

  const ops: BatchOp[] = [];
  let needsProfileSync = false;

  for (const item of store.outbox) {
    if (item.entity === 'profile') {
      needsProfileSync = true;
      continue;
    }

    if (item.entity === 'movie') {
      const ref = doc(db, 'users', uid, 'movies', item.id);
      const path = `users/${uid}/movies/${item.id}`;
      if (item.op === 'delete') {
        ops.push({ type: 'delete', path, ref });
      } else {
        const m = movieMap.get(item.id);
        if (m) {
          ops.push({ type: 'set', path, ref, data: sanitizeMovieForCloud(m, uid) });
        }
      }
    } else if (item.entity === 'watchRecord') {
      const ref = doc(db, 'users', uid, 'watchRecords', item.id);
      const path = `users/${uid}/watchRecords/${item.id}`;
      if (item.op === 'delete') {
        ops.push({ type: 'delete', path, ref });
      } else {
        const r = recordMap.get(item.id);
        if (r) {
          ops.push({
            type: 'set',
            path,
            ref,
            data: sanitizeWatchRecordForCloud(r, uid),
          });
        }
      }
    } else if (item.entity === 'watchlist') {
      const ref = doc(db, 'users', uid, 'watchlist', item.id);
      const path = `users/${uid}/watchlist/${item.id}`;
      if (item.op === 'delete') {
        ops.push({ type: 'delete', path, ref });
      } else {
        const w = watchlistMap.get(item.id);
        if (w) {
          ops.push({
            type: 'set',
            path,
            ref,
            data: sanitizeWatchlistForCloud(w, uid),
          });
        }
      }
    }
  }

  if (needsProfileSync) {
    await ensureUserProfileDoc(user, store.settings);
  }
  if (ops.length > 0) {
    await commitBatchedOps(ops);
  }
}

export async function pushFullArchiveToCloud(
  user: User,
  archive: HorrorArchiveState,
  settings: UserSettings
): Promise<UserSettings> {
  const uid = user.uid;
  const syncedSettings = await ensureUserProfileDoc(user, settings);

  const ops: BatchOp[] = [
    ...archive.movies.map((m) => ({
      type: 'set' as const,
      path: `users/${uid}/movies/${m.movie_id}`,
      ref: doc(db, 'users', uid, 'movies', m.movie_id),
      data: sanitizeMovieForCloud(m, uid),
    })),
    ...archive.watchRecords.map((r) => ({
      type: 'set' as const,
      path: `users/${uid}/watchRecords/${r.record_id}`,
      ref: doc(db, 'users', uid, 'watchRecords', r.record_id),
      data: sanitizeWatchRecordForCloud(r, uid),
    })),
    ...archive.watchlist.map((w) => ({
      type: 'set' as const,
      path: `users/${uid}/watchlist/${w.watchlist_id}`,
      ref: doc(db, 'users', uid, 'watchlist', w.watchlist_id),
      data: sanitizeWatchlistForCloud(w, uid),
    })),
  ];

  if (ops.length > 0) {
    await commitBatchedOps(ops);
  }
  return syncedSettings;
}

export function subscribeToCloudArchive(
  uid: string,
  onUpdate: (partial: Partial<CloudSnapshotData>) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const unsubMovies = onSnapshot(
    query(collection(db, 'users', uid, 'movies'), where('uid', '==', uid)),
    (snap) => {
      const movies = snap.docs.map((d) =>
        docToMovie(d.data() as Record<string, unknown>)
      );
      onUpdate({ movies });
    },
    (error) => {
      onError(error);
      try {
        handleFirestoreError(error, OperationType.LIST, `users/${uid}/movies`);
      } catch {
        // Error info logged and forwarded via onError
      }
    }
  );

  const unsubRecords = onSnapshot(
    query(collection(db, 'users', uid, 'watchRecords'), where('uid', '==', uid)),
    (snap) => {
      const watchRecords = snap.docs.map((d) =>
        docToWatchRecord(d.data() as Record<string, unknown>)
      );
      onUpdate({ watchRecords });
    },
    (error) => {
      onError(error);
      try {
        handleFirestoreError(
          error,
          OperationType.LIST,
          `users/${uid}/watchRecords`
        );
      } catch {
        // Error info logged and forwarded via onError
      }
    }
  );

  const unsubWatchlist = onSnapshot(
    query(collection(db, 'users', uid, 'watchlist'), where('uid', '==', uid)),
    (snap) => {
      const watchlist = snap.docs.map((d) =>
        docToWatchlistItem(d.data() as Record<string, unknown>)
      );
      onUpdate({ watchlist });
    },
    (error) => {
      onError(error);
      try {
        handleFirestoreError(error, OperationType.LIST, `users/${uid}/watchlist`);
      } catch {
        // Error info logged and forwarded via onError
      }
    }
  );

  return () => {
    unsubMovies();
    unsubRecords();
    unsubWatchlist();
  };
}

export async function deleteAccountAndAllCloudData(
  user: User,
  currentPassword?: string
): Promise<void> {
  if (currentPassword && user.email) {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
  } else {
    const lastSignInMs = user.metadata.lastSignInTime
      ? Date.parse(user.metadata.lastSignInTime)
      : 0;
    if (!lastSignInMs || Date.now() - lastSignInMs > 4 * 60 * 1000) {
      const err = new Error('Recent authentication required');
      (err as { code?: string }).code = 'auth/requires-recent-login';
      throw err;
    }
  }

  const uid = user.uid;
  const subcollections = ['movies', 'watchRecords', 'watchlist'] as const;
  const deleteOps: BatchOp[] = [];

  // Release any claimed nickname owned by this user
  try {
    const profileSnap = await getDoc(doc(db, 'users', uid));
    const profileNick = profileSnap.exists()
      ? (profileSnap.data() as { display_name?: string }).display_name
      : undefined;
    const candidateNick = profileNick || user.displayName || undefined;
    if (candidateNick && validateNickname(candidateNick).ok) {
      const nickKey = encodeNicknameKey(candidateNick);
      const nickSnap = await getDoc(doc(db, 'nicknames', nickKey));
      if (
        nickSnap.exists() &&
        (nickSnap.data() as { uid?: string }).uid === uid
      ) {
        deleteOps.push({
          type: 'delete',
          path: `nicknames/${nickKey}`,
          ref: nickSnap.ref,
        });
      }
    }
  } catch {
    // Proceed with user archive deletion even if nickname lookup fails
  }

  for (const sub of subcollections) {
    const path = `users/${uid}/${sub}`;
    try {
      const snap = await getDocs(
        query(collection(db, 'users', uid, sub), where('uid', '==', uid))
      );
      for (const d of snap.docs) {
        deleteOps.push({
          type: 'delete',
          path: `${path}/${d.id}`,
          ref: d.ref,
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  deleteOps.push({
    type: 'delete',
    path: `users/${uid}`,
    ref: doc(db, 'users', uid),
  });

  await commitBatchedOps(deleteOps);
  await deleteUser(user);
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function readCloudMovieMetadataCache(
  source: ExternalMovieSource,
  externalId: string
): Promise<CachedMovieMetadata | null> {
  if (!auth.currentUser) return null;
  const cacheId = `${source}_${externalId}`.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cacheId) return null;

  try {
    const snap = await getDoc(doc(db, 'movieMetadataCache', cacheId));
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, unknown>;
    const cachedAt = typeof data.cached_at === 'string' ? data.cached_at : '';
    const cachedMs = cachedAt ? Date.parse(cachedAt) : 0;
    if (!cachedMs || Date.now() - cachedMs > CACHE_TTL_MS) {
      return null;
    }

    return {
      cache_id: cacheId,
      external_source: 'tmdb',
      external_id: String(data.external_id || externalId),
      title: String(data.title || ''),
      original_title:
        typeof data.original_title === 'string' ? data.original_title : undefined,
      poster_url: typeof data.poster_url === 'string' ? data.poster_url : undefined,
      release_date:
        typeof data.release_date === 'string' ? data.release_date : undefined,
      release_year:
        typeof data.release_year === 'number' ? data.release_year : undefined,
      director: typeof data.director === 'string' ? data.director : undefined,
      country: typeof data.country === 'string' ? data.country : undefined,
      duration: typeof data.duration === 'number' ? data.duration : undefined,
      synopsis: typeof data.synopsis === 'string' ? data.synopsis : undefined,
      genres: Array.isArray(data.genres) ? (data.genres as HorrorGenre[]) : [],
      vote_average:
        typeof data.external_rating === 'number' ? data.external_rating : undefined,
      cached_at: cachedAt,
      expires_at: cachedMs + CACHE_TTL_MS,
    };
  } catch {
    return null;
  }
}

export async function writeCloudMovieMetadataCache(
  detail: ExternalMovieDetail
): Promise<void> {
  if (!auth.currentUser) return;
  const cacheId = `${detail.external_source}_${detail.external_id}`.replace(
    /[^a-zA-Z0-9_-]/g,
    ''
  );
  if (!cacheId) return;

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    cache_id: cacheId,
    external_source: detail.external_source,
    external_id: detail.external_id.slice(0, 64),
    title: (detail.title.trim() || '未命名影片').slice(0, 200),
    genres: (detail.genres || [])
      .filter((g): g is HorrorGenre => VALID_GENRE_SET.has(g))
      .slice(0, 13),
    cached_at: now,
    server_updated_at: serverTimestamp(),
  };

  const originalTitle = clampString(detail.original_title, 200);
  if (originalTitle) payload.original_title = originalTitle;

  const posterUrl = clampString(detail.poster_url, 1000);
  if (posterUrl) payload.poster_url = posterUrl;

  const releaseDate = clampString(detail.release_date, 20);
  if (releaseDate) payload.release_date = releaseDate;

  if (
    typeof detail.release_year === 'number' &&
    Number.isInteger(detail.release_year) &&
    detail.release_year >= 1880 &&
    detail.release_year <= 2100
  ) {
    payload.release_year = detail.release_year;
  }

  const director = clampString(detail.director, 160);
  if (director) payload.director = director;

  const country = clampString(detail.country, 120);
  if (country) payload.country = country;

  if (
    typeof detail.duration === 'number' &&
    Number.isInteger(detail.duration) &&
    detail.duration >= 1 &&
    detail.duration <= 1200
  ) {
    payload.duration = detail.duration;
  }

  const synopsis = clampString(detail.synopsis, 4000);
  if (synopsis) payload.synopsis = synopsis;

  if (
    typeof detail.vote_average === 'number' &&
    !Number.isNaN(detail.vote_average) &&
    detail.vote_average >= 0 &&
    detail.vote_average <= 10
  ) {
    payload.external_rating = Number(detail.vote_average.toFixed(1));
  }

  try {
    await setDoc(doc(db, 'movieMetadataCache', cacheId), payload);
  } catch {
    // Non-critical cache write: local cache still preserves data
  }
}
