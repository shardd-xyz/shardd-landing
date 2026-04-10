---
layout: home

hero:
  name: shardd
  text: Balance infrastructure for a globally routed product.
  tagline: Market on the root domain, send operators to the app, and route developer traffic through smart regional edges while the stateful shard mesh stays private.
  image:
    src: /logo-mark.svg
    alt: shardd mark
  actions:
    - theme: brand
      text: Log in
      link: https://app.shardd.xyz
    - theme: alt
      text: Read the docs
      link: /guide/quickstart
    - theme: alt
      text: View GitHub
      link: https://github.com/sssemil/shardd

features:
  - title: Product on the root domain
    details: "shardd.xyz is the public product surface, with docs, onboarding, and entry points into the hosted control plane."
  - title: Operators on app.shardd.xyz
    details: "The dashboard, API keys, bucket scopes, and account controls live behind a dedicated app subdomain."
  - title: Smart public edges
    details: "Developers can start from named regional HTTPS edges and let the SDK discover and choose the best live edge automatically."
  - title: Private shard mesh
    details: "Full nodes replicate and converge privately, while public traffic stays on the edge tier instead of touching stateful internals."
---

## The shape

`shardd` keeps product, control plane, and state separation clean:

- `shardd.xyz` explains the product and hosts the docs
- `app.shardd.xyz` is where operators log in and manage access
- public API traffic goes to regional edges
- each edge authenticates, inspects live mesh health, and forwards to the best full node
- full nodes replicate privately across regions

That gives developers a normal HTTPS product surface without exposing the
correctness-critical layer directly.

## Start here

- Read the docs: [Quickstart](/guide/quickstart)
- Explore public client bootstrapping: [Public Edge Clients](/guide/public-edge-clients)
- Log in to the control plane: `https://app.shardd.xyz`
