# Public Edge Clients

External developers do not join the private libp2p node mesh.

Instead, they use plain HTTPS against public edge gateways. The edges expose two
bootstrap endpoints:

- `GET /gateway/health`
- `GET /gateway/edges`

## `GET /gateway/health`

This is the cheap liveness and routing-hints endpoint for one edge.

Example fields:

- `edge_id`
- `region`
- `base_url`
- `ready`
- `healthy_nodes`
- `best_node_rtt_ms`
- `sync_gap`
- `overloaded`

## `GET /gateway/edges`

This returns the public regional edge directory only. It does not expose private
full-node addresses or internal mesh identities.

Example response:

```json
{
  "observed_at_unix_ms": 1775770123456,
  "edges": [
    {
      "edge_id": "use1",
      "region": "us-east-1",
      "base_url": "https://use1.api.dev.shardd.xyz",
      "health_url": "https://use1.api.dev.shardd.xyz/gateway/health",
      "reachable": true,
      "ready": true,
      "healthy_nodes": 3,
      "best_node_rtt_ms": 18,
      "sync_gap": 0,
      "overloaded": false
    }
  ]
}
```

## Official example clients

The core repo contains working examples in:

- Python
- TypeScript
- Rust

Each example bootstraps from multiple edges, uses `/gateway/edges` to discover
others, probes health locally, and then performs the request over HTTPS with a
bearer API key.
