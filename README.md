# URL Utilities

A lightweight, headless URL shortener with QR code generation, built on Fastify, Drizzle ORM, and Postgres. Ships as a minimal container — an operator UI is available as a separate microservice that talks to the admin API below.

### Public (unauthenticated)

- `GET /r/:alias` — 301 redirect to the original URL and increment the visit counter

### Authenticated (`x-api-key` required)

Everything under `/api/*` — the write endpoints and all admin routes share the same shared secret.

**Write endpoints**

- `POST /api/url` — shorten a URL and return an alias
- `POST /api/qr` — shorten a URL and return a data-URL QR code

**Admin endpoints** — intended for an operator UI (separate repo)

- `GET    /api/admin/urls` — list, search, sort, paginate
- `GET    /api/admin/urls/:alias` — detail (lazy-populates QR on first read)
- `PATCH  /api/admin/urls/:alias` — update the destination URL
- `DELETE /api/admin/urls/:alias` — remove the URL and its QR row
- `POST   /api/admin/urls/:alias/qr/regenerate` — re-render and persist the QR
- `GET    /api/admin/stats` — totals + top 10 by click count

## Requirements

- Node.js 18+
- Postgres (local, Supabase, Neon, or any hosted Postgres)
- A stable hostname for deployment — shortened links embed `APP_URL`, so it shouldn't change

## Quick Start

```bash
git clone https://github.com/ralton-dev/url-utilities.git
cd url-utilities
npm install
cp .env.example .env.local
# edit .env.local and fill in the three variables below
npm run drizzle-kit:push   # apply schema to your database
npm run dev                # http://localhost:3000
```

## Environment Variables

Copy `.env.example` to `.env.local` and set:

| Variable       | Description                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| `POSTGRES_URL` | Postgres connection string (e.g. `postgres://user:pass@host:5432/db`)                                     |
| `API_KEY`      | Shared secret required in the `x-api-key` header for `/api/url`, `/api/qr`, and all `/api/admin/*` routes |
| `APP_URL`      | Public URL of this app (no trailing slash), used to build returned shortened links                        |

## Database

Schema lives in `src/db/schema.ts`. Drizzle manages migrations under `src/db/migrations/`.

```bash
npm run drizzle-kit:push      # push schema changes to the DB
npm run drizzle-kit:migrate   # introspect existing DB into schema
npm run drizzle-kit:studio    # open Drizzle Studio
```

### Supabase users

If your Postgres provider requires a custom CA (e.g. Supabase), drop the cert into `.supabase/` and prefix the drizzle commands with `NODE_EXTRA_CA_CERTS`:

```bash
NODE_EXTRA_CA_CERTS=./.supabase/prod-ca-2021.crt npm run drizzle-kit:push
```

## API

All write endpoints and all `/api/admin/*` endpoints require the `x-api-key` header to match `API_KEY`. Failure returns `401 { success: false, errors: ["Unauthorized"] }`.

### Shorten a URL

```bash
curl -X POST "$APP_URL/api/url" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"url": "https://example.com/some/very/long/path"}'
```

Response:

```json
{ "success": true, "url": "https://your-app.example/r/abc123" }
```

### Shorten a URL and get a QR code

```bash
curl -X POST "$APP_URL/api/qr" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"url": "https://example.com"}'
```

Response includes a base64 `qrCode` data URL (high error-correction, PNG).

### Follow a short link

`GET /r/:alias` → 301 redirect to the original URL. Each hit increments `count` in the database.

### Admin API

Intended for an operator UI. All routes return `{ "success": true, "data": ... }` on success and `{ "success": false, "errors": [...] | {field: [...]} }` on failure. Aliases are 10-char alphanumeric (`[0-9A-Za-z]{10}`).

#### `GET /api/admin/urls`

List, search, sort, paginate.

Query params (all optional):

| Param      | Type    | Default      | Notes                                                                          |
| ---------- | ------- | ------------ | ------------------------------------------------------------------------------ |
| `q`        | string  | —            | ILIKE match against both `alias` and `url`                                     |
| `page`     | integer | `1`          | 1-indexed                                                                      |
| `pageSize` | integer | `20`         | Capped at 100                                                                  |
| `sort`     | enum    | `-createdAt` | `createdAt`, `-createdAt`, `alias`, `-alias`, `count`, `-count`, `url`, `-url` |
| `minCount` | integer | —            | Inclusive lower bound on `count`                                               |
| `maxCount` | integer | —            | Inclusive upper bound on `count`                                               |

```bash
curl -H "x-api-key: $API_KEY" \
  "$APP_URL/api/admin/urls?q=example&sort=-count&page=1&pageSize=20"
```

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 42,
        "alias": "aZ9xK2pQ0b",
        "url": "https://example.com/path",
        "count": 137,
        "createdAt": "2026-04-19T10:15:30.000Z"
      }
    ],
    "total": 421,
    "page": 1,
    "pageSize": 20
  }
}
```

List items do not include `qrCode` (too bulky); fetch detail for that.

#### `GET /api/admin/urls/:alias`

Detail view. First read lazily renders and persists the QR; subsequent reads return the stored one.

```json
{
  "success": true,
  "data": {
    "id": 42,
    "alias": "aZ9xK2pQ0b",
    "url": "https://example.com/path",
    "count": 137,
    "createdAt": "2026-04-19T10:15:30.000Z",
    "qrCode": "data:image/png;base64,iVBORw0KGgo..."
  }
}
```

Returns `404 { success: false, errors: ["Not found"] }` for missing or malformed aliases.

#### `PATCH /api/admin/urls/:alias`

Update the destination URL. Alias renames are intentionally not supported — that would invalidate every existing short link.

```bash
curl -X PATCH -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"url": "https://new-destination.example.com"}' \
  "$APP_URL/api/admin/urls/aZ9xK2pQ0b"
```

Returns the updated detail payload. Returns `400` on validation failure, `404` if the alias doesn't exist.

#### `DELETE /api/admin/urls/:alias`

Removes the URL and any associated QR row in a single transaction. Returns `204` with empty body, or `404` if missing.

#### `POST /api/admin/urls/:alias/qr/regenerate`

Re-renders the QR and upserts it.

```json
{ "success": true, "data": { "qrCode": "data:image/png;base64,..." } }
```

#### `GET /api/admin/stats`

Dashboard aggregates.

```json
{
  "success": true,
  "data": {
    "totalUrls": 421,
    "totalClicks": 15234,
    "topUrls": [
      {
        "alias": "aZ9xK2pQ0b",
        "url": "https://...",
        "count": 2111,
        "createdAt": "2026-03-15T09:02:11.000Z"
      }
    ]
  }
}
```

`topUrls` is the top 10 by click count.

## Deployment

### Docker image

A `linux/amd64` image is published to GHCR on every `v*` tag:

```
ghcr.io/ralton-dev/url-utilities:v<version>
ghcr.io/ralton-dev/url-utilities:v<version>-<short-sha>
```

Run locally:

```bash
docker run --rm -p 3000:3000 \
  -e APP_URL=http://localhost:3000 \
  -e API_KEY=change-me \
  -e POSTGRES_URL=postgres://user:pass@host:5432/db \
  ghcr.io/ralton-dev/url-utilities:v0.1.0
```

### Kubernetes (Helm)

The repo ships a Helm chart at [`deploy/helm/url-utilities/`](./deploy/helm/url-utilities) with:

- Non-root pod security context, read-only root FS
- Liveness (`/api/health`) and readiness (`/api/ready`, DB-backed) probes
- Pre-install/pre-upgrade Job that applies Drizzle SQL migrations
- Optional Ingress and HPA
- Two secret modes: inline plaintext for bootstrap or `existingSecret` for sealed-secrets

See [`deploy/DEPLOY.md`](./deploy/DEPLOY.md) for the full first-deploy walkthrough and [`deploy/SECRETS.md`](./deploy/SECRETS.md) for secret-handling options.

Quick install:

```bash
cp deploy/helm/url-utilities/values.yaml deploy/helm/url-utilities/values-prod.yaml
# edit values-prod.yaml (image.tag, config.APP_URL, secrets.*, ingress)
make helm-install REPO=prod
```

### Vercel (alternative)

Set `APP_URL`, `API_KEY`, `POSTGRES_URL` in project settings and deploy. Run migrations separately (`node scripts/migrate.mjs`) against the Postgres instance, or use your platform's migration hook.

## Scripts

| Script                          | What it does                                                    |
| ------------------------------- | --------------------------------------------------------------- |
| `npm run dev`                   | Start the Fastify server with tsx watch mode                    |
| `npm run build` / `npm start`   | Compile to `dist/` and run with Node                            |
| `npm test`                      | Run the vitest e2e suite (spins up Postgres via testcontainers) |
| `npm run lint`                  | ESLint (flat config)                                            |
| `npm run format` / `format:fix` | Prettier check / write                                          |

## License

MIT — see [LICENSE](./LICENSE).
