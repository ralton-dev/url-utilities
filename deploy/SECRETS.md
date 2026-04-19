# Secrets handling

The chart supports two modes for providing `API_KEY` and `POSTGRES_URL`.

## Mode A: bootstrap (plaintext in values)

Set `secrets.API_KEY` and `secrets.POSTGRES_URL` directly in your `values-<slug>.yaml`. The chart renders an Opaque `Secret` named after the release.

Fastest path for a first deploy, but the values file now contains real credentials — do not commit it.

## Mode B: existing secret (recommended for production)

Create the Secret out-of-band (via sealed-secrets, external-secrets, SOPS, or `kubectl create secret` from a vault-fetched file), then point the chart at it:

```yaml
secrets:
  existingSecret: url-utilities-prod-secrets
  # API_KEY / POSTGRES_URL ignored when existingSecret is set
```

The Secret must expose keys `API_KEY` and `POSTGRES_URL`.

### Example: sealed-secrets

```bash
kubectl create secret generic url-utilities-prod-secrets \
  --namespace url-utilities-prod \
  --from-literal=API_KEY="$(openssl rand -hex 32)" \
  --from-literal=POSTGRES_URL="postgres://user:pass@host:5432/db" \
  --dry-run=client -o yaml \
  | kubeseal --controller-namespace sealed-secrets --format yaml \
  > deploy/helm/url-utilities/sealed/url-utilities-prod-secrets.yaml

kubectl apply -f deploy/helm/url-utilities/sealed/url-utilities-prod-secrets.yaml
# Then install with secrets.existingSecret=url-utilities-prod-secrets
```

## Rotating the API_KEY

Rolling keys is a two-step because clients using the old key must keep working until they're updated:

1. Change the Secret to the new key (clients still using old key now fail with 401)
2. Update clients to the new key

If you need a zero-downtime rotation, add a second accepted key to the app before rotating — the current code supports only one key via `API_KEY`, so that's an app change, not a k8s one.
