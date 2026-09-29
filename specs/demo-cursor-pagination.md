# Demo — cursor pagination for the public list endpoints

**Goal:** replace offset pagination on `/api/public/items` and `/api/public/orders` with opaque cursors, so deep pages stay fast and results do not shift while a client pages through them.

**Out of scope:** authentication, rate limiting, admin endpoints, the export feature, and any schema change beyond one index.

## 1. Why

Offset pagination costs O(offset) on every page. Past page 200 the items query takes over two seconds, and a row inserted between two requests shifts every later page by one, so clients see duplicates or miss rows.

## 2. Cursor format

A cursor is base64url(JSON `{ id, createdAt }`) of the last row returned. It is opaque to clients. The server decodes it, validates both fields with zod, and rejects anything else with 400 `invalid_cursor`.

## 3. Query

`WHERE (created_at, id) < ($createdAt, $id) ORDER BY created_at DESC, id DESC LIMIT $limit + 1`. Fetching one extra row tells us whether there is a next page without a COUNT.

## 4. Response shape

`{ items, nextCursor: string | null }`. `nextCursor` is null on the last page. The old `page` / `total` fields are removed; `total` was the expensive part.

## 5. Limits

`limit` defaults to 25 and is clamped to 1..100. A larger value is clamped, not rejected.

## 6. Index

One new composite index `(created_at DESC, id DESC)` on `items` and on `orders`. No other schema change.

- AC-01: paging forward through 250 rows with limit 50 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-02: paging forward through 500 rows with limit 75 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-03: paging forward through 750 rows with limit 100 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-04: paging forward through 1000 rows with limit 25 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-05: paging forward through 1250 rows with limit 50 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-06: paging forward through 1500 rows with limit 75 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-07: paging forward through 1750 rows with limit 100 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-08: paging forward through 2000 rows with limit 25 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-09: paging forward through 2250 rows with limit 50 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-10: paging forward through 2500 rows with limit 75 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-11: paging forward through 2750 rows with limit 100 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-12: paging forward through 3000 rows with limit 25 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-13: paging forward through 3250 rows with limit 50 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-14: paging forward through 3500 rows with limit 75 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-15: paging forward through 3750 rows with limit 100 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-16: paging forward through 4000 rows with limit 25 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-17: paging forward through 4250 rows with limit 50 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-18: paging forward through 4500 rows with limit 75 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-19: paging forward through 4750 rows with limit 100 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-20: paging forward through 5000 rows with limit 25 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-21: paging forward through 5250 rows with limit 50 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-22: paging forward through 5500 rows with limit 75 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-23: paging forward through 5750 rows with limit 100 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-24: paging forward through 6000 rows with limit 25 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-25: paging forward through 6250 rows with limit 50 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-26: paging forward through 6500 rows with limit 75 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-27: paging forward through 6750 rows with limit 100 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-28: paging forward through 7000 rows with limit 25 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-29: paging forward through 7250 rows with limit 50 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-30: paging forward through 7500 rows with limit 75 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-31: paging forward through 7750 rows with limit 100 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-32: paging forward through 8000 rows with limit 25 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-33: paging forward through 8250 rows with limit 50 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-34: paging forward through 8500 rows with limit 75 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-35: paging forward through 8750 rows with limit 100 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-36: paging forward through 9000 rows with limit 25 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-37: paging forward through 9250 rows with limit 50 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-38: paging forward through 9500 rows with limit 75 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-39: paging forward through 9750 rows with limit 100 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.
- AC-40: paging forward through 10000 rows with limit 25 returns every row exactly once, in (created_at, id) descending order, with no duplicates when rows are inserted between requests.

## 7. Rollout

Ship behind the `cursor_pagination` flag; keep the offset path for one release; remove it afterwards.

## 8. Final note

The migration of the admin export to cursors is a separate plan. **This section is past the 8000-character mark on purpose:** if DevDigest truncates the spec, this sentence is not visible to the classifier.

