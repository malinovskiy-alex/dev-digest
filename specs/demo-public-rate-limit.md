# Demo — rate-limit the public API

**Goal:** stop unauthenticated clients from hammering `/api/public/*`.

## In scope
- a per-IP fixed-window limiter for `/api/public/*` routes
- a `429 Too Many Requests` response with a `Retry-After` header

## Out of scope
- authentication changes
- adding new endpoints
- logging / observability for the limiter
