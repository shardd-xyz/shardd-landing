---
layout: home

hero:
  name: shardd
  text: Global edge routing for a private shard mesh.
  tagline: Keep stateful full nodes private, route developers through named public edges, and let the edge choose the best full node in real time.
  image:
    src: /logo-mark.svg
    alt: shardd mark
  actions:
    - theme: brand
      text: Read the docs
      link: /guide/quickstart
    - theme: alt
      text: View core repo
      link: https://github.com/sssemil/shardd

features:
  - title: Private full-node mesh
    details: Full nodes stay on a private libp2p cluster key and never become a public developer surface.
  - title: Public regional edges
    details: Developers hit named HTTPS edges such as use1.api.dev.shardd.xyz and can discover healthier peers from there.
  - title: Smart edge routing
    details: Each edge keeps a live view of mesh health and chooses the best matching full node by readiness, sync state, and latency.
  - title: Plain client transport
    details: Curl, bash, Python, TypeScript, and Rust all work over standard HTTPS with the same public edge contract.
---

## Why this shape

`shardd` splits ingress from state:

- public traffic terminates on edge gateways
- the edge authenticates the request
- the edge inspects the live mesh and forwards to the best full node
- full nodes replicate privately across regions

That keeps the correctness-critical layer small and private while giving
developers a normal HTTPS product surface.
