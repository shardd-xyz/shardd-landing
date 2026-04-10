# Quickstart

`shardd`'s public developer path is HTTPS to regional edge gateways.

Start with one or more bootstrap edge URLs:

- `https://use1.api.dev.shardd.xyz`
- `https://ape1.api.dev.shardd.xyz`
- `https://euc1.api.dev.shardd.xyz`

Each request uses a bearer API key:

```bash
curl -sS https://use1.api.dev.shardd.xyz/gateway/health
```

Write an event:

```bash
curl -sS https://use1.api.dev.shardd.xyz/events \
  -H "Authorization: Bearer $SHARDD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "owner": "dev_123",
    "bucket": "orders",
    "account": "alice",
    "amount": 10,
    "note": "credit"
  }'
```

Read balances:

```bash
curl -sS \
  "https://use1.api.dev.shardd.xyz/balances?owner=dev_123&bucket=orders" \
  -H "Authorization: Bearer $SHARDD_API_KEY"
```

## Recommended SDK behavior

SDKs should:

1. accept multiple bootstrap edge URLs
2. fetch `/gateway/edges` from any reachable bootstrap edge
3. probe `/gateway/health` on candidates
4. prefer ready, non-overloaded edges
5. choose the lowest-latency candidate
6. fail over on timeout or `5xx`

That keeps the public edge contract simple without exposing the private mesh.
