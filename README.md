# URL Utilities

A lightweight URL shortener with QR code generation, built on Next.js 14 (App Router), Drizzle ORM, and Postgres.

- `POST /api/url` — shorten a URL and return an alias
- `POST /api/qr` — shorten a URL and return a data-URL QR code
- `GET /r/:alias` — redirect to the original URL and increment the visit counter

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

| Variable       | Description                                                                        |
| -------------- | ---------------------------------------------------------------------------------- |
| `POSTGRES_URL` | Postgres connection string (e.g. `postgres://user:pass@host:5432/db`)              |
| `API_KEY`      | Shared secret required in the `x-api-key` header for `/api/url` and `/api/qr`      |
| `APP_URL`      | Public URL of this app (no trailing slash), used to build returned shortened links |

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

All write endpoints require the `x-api-key` header to match `API_KEY`.

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

| Script                          | What it does                 |
| ------------------------------- | ---------------------------- |
| `npm run dev`                   | Start the Next.js dev server |
| `npm run build` / `npm start`   | Production build and serve   |
| `npm run lint`                  | Next.js ESLint               |
| `npm run format` / `format:fix` | Prettier check / write       |

## License

MIT — see [LICENSE](./LICENSE).
