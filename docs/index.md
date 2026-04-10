---
layout: home

title: shardd
titleTemplate: Edge-routed storage over a private shard mesh

hero:
  name: SHARDED STORAGE
  text: One SDK call. Every region.
  tagline: Named HTTPS edges handle TLS, auth, and routing. A private shard mesh replicates underneath — stateful internals never touch the public internet.
  actions:
    - theme: brand
      text: Log in →
      link: https://app.shardd.xyz
    - theme: alt
      text: Read the docs
      link: /guide/quickstart
    - theme: alt
      text: GitHub
      link: https://github.com/sssemil/shardd

features:
  - title: Regional HTTPS edges
    details: Named endpoints per region handle TLS, auth, and routing. Nothing exotic — just HTTPS your SDK already speaks.
  - title: Live edge discovery
    details: The SDK inspects mesh health and picks the fastest healthy edge on every call. No DNS tricks, no manual failover.
  - title: Private shard mesh
    details: Replication and consensus run behind the edge tier. Stateful internals stay off the public internet.
  - title: Hosted control plane
    details: Keys, scopes, and bucket access live at app.shardd.xyz. Operators manage, developers consume.
---

## How it fits together

```text
  your-app  ──►  edge.<region>.shardd.xyz  ──►  shard mesh (private)
                       │
                       └── TLS · auth · routing · health-aware
```

Public traffic stays on the edge tier. The correctness-critical layer
replicates privately across regions and never terminates a public TLS
connection.

## Start here

- [Quickstart](/guide/quickstart) — first request in a minute
- [Public Edge Clients](/guide/public-edge-clients) — SDK bootstrapping
- [Architecture](/guide/architecture) — control plane, edges, mesh
