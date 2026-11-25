# Security Specification — Horror Diary Firestore Rules

## 1. Data Invariants
1. **Strict Account Isolation**: Every document in `/users/{uid}` and its subcollections (`/movies`, `/watchRecords`, `/watchlist`) is strictly owned by `uid`. No signed-in user may read, list, create, update, or delete another user's data.
2. **Identity Integrity**: Every document's `uid` field MUST match `request.auth.uid` and the `{uid}` path variable, and `uid` is immutable after creation.
3. **Path Variable Hardening**: Document IDs (`uid`, `movieId`, `recordId`, `watchlistId`) must match `^[a-zA-Z0-9_-]+$` and be <= 128 characters, and match the embedded ID field (`movie_id`, `record_id`, `watchlist_id`).
4. **Strict Keys & No Ghost Fields**: Both `create` and `update` enforce strict allowlisted keys (`keys().hasOnly(...)`) and required keys (`keys().hasAll(...)`) via standalone `isValid*` helpers.
5. **Bounded Types & Enumerations**: Every string enforces `.size() <= MAX`, arrays enforce `.size() <= MAX` and allowed elements via `.hasOnly(...)`, numeric scores (`rating`, `horror_level`, `watch_count`, `release_year`, `duration`) enforce valid domain bounds, and `server_updated_at == request.time` is enforced on every write.
6. **PII Isolation**: User `email` and `display_name` reside solely inside `/users/{uid}` readable only by `request.auth.uid == uid`.

## 2. The "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read or write on `/users/userA` or `/users/userA/movies/m1`.
2. Cross-user read: `userB` attempts `get` or `list` on `/users/userA/movies`.
3. Cross-user write: `userB` attempts `create` or `delete` on `/users/userA/watchRecords/rec1`.
4. Identity spoofing on create: `userA` writes `/users/userA/movies/m1` with `uid: "userB"`.
5. Shadow / ghost field injection: `userA` writes `/users/userA` with `{ ..., isAdmin: true }`.
6. Oversized ID / Resource poisoning: `userA` writes `/users/userA/movies/../../etc` or 500-char ID.
7. Mismatched path vs payload ID: `userA` writes `/users/userA/movies/m1` with `movie_id: "m2"`.
8. Invalid rating / horror_level out of bounds: `userA` creates `watchRecords/r1` with `rating: 99` or `horror_level: 7`.
9. Unbounded array injection: `userA` creates `movies/m1` with `genres` having 20 elements or unknown genre strings.
10. Oversized string DoS: `userA` creates `watchRecords/r1` with `review` > 10,000 chars.
11. Timestamp spoofing: `userA` writes `server_updated_at` as a client string instead of `request.time`.
12. Immutable field tampering: `userA` updates `/users/userA/movies/m1` changing `created_at` or `uid` or `movie_id`.
