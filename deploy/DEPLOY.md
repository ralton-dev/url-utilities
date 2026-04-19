# Deploying url-utilities

## Prerequisites

- Kubernetes cluster with an ingress controller (nginx, traefik, etc.) and cert-manager if you want automatic TLS
- Helm 3+
- A Postgres database reachable from the cluster
- Access to pull `ghcr.io/ralton-dev/url-utilities` (public by default; configure `imagePullSecrets` in values if you've made it private)

## 1. Create a per-instance values file

Copy the base values and tune:

```bash
cp deploy/helm/url-utilities/values.yaml deploy/helm/url-utilities/values-prod.yaml
```

Edit `values-prod.yaml`:

- `image.tag` — pin to a released tag like `v0.1.0` (or `v0.1.0-<sha>`)
- `config.APP_URL` — the public URL used in shortened links
- `secrets.API_KEY` / `secrets.POSTGRES_URL` — real values, OR set `secrets.existingSecret` to a pre-materialized Secret name (see [SECRETS.md](./SECRETS.md))
- `ingress.enabled: true`, fill `ingress.hosts`, `ingress.tls`, and any annotations for your controller

The `values-*.yaml` pattern is already ignored by `.gitignore` — treat these files as secrets even if using `existingSecret`, since they still carry operational config.

## 2. Install

```bash
make helm-install REPO=prod
# → helm upgrade --install url-utilities-prod deploy/helm/url-utilities \
#      --namespace url-utilities-prod --create-namespace \
#      -f deploy/helm/url-utilities/values-prod.yaml
```

On `helm install`/`upgrade` the chart runs a pre-install Job (`node scripts/migrate.mjs`) against `POSTGRES_URL` to apply schema migrations.

## 3. Verify

```bash
kubectl -n url-utilities-prod rollout status deploy/url-utilities-prod
kubectl -n url-utilities-prod port-forward svc/url-utilities-prod 3000:80
curl http://localhost:3000/api/health      # {"status":"ok"}
curl http://localhost:3000/api/ready       # DB-backed readiness
```

## 4. Smoke-test the API

```bash
curl -X POST "https://$APP_URL/api/url" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"url": "https://example.com"}'
```

Follow the returned `url` — should 301 to `https://example.com` and increment `count` in the DB.

## Upgrading

```bash
# bump chart + app version, tag, and push
make bump-version VERSION_ARG=0.2.0
git push origin main --tags
# the Release workflow builds and pushes ghcr.io/ralton-dev/url-utilities:v0.2.0
# then re-install from the new tag
make helm-install REPO=prod
```

## Rollback

```bash
helm -n url-utilities-prod history url-utilities-prod
helm -n url-utilities-prod rollback url-utilities-prod <revision>
```

Note: the migration Job runs on rollback too. For backward-incompatible schema changes, plan a manual data migration — Helm rollback alone is not safe.
