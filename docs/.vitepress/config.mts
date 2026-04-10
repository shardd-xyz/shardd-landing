import { defineConfig } from "vitepress";

const base = process.env.SHARDD_SITE_BASE || "/";

export default defineConfig({
  title: "shardd",
  description: "Geo-aware edge-routed CRDT ledger infrastructure.",
  base,
  cleanUrls: true,
  head: [
    ["meta", { name: "theme-color", content: "#12202c" }],
    ["meta", { property: "og:title", content: "shardd" }],
    [
      "meta",
      {
        property: "og:description",
        content: "Globally distributed ledger infrastructure with public edge routing.",
      },
    ],
  ],
  themeConfig: {
    logo: "/logo-mark.svg",
    nav: [
      { text: "Docs", link: "/guide/quickstart" },
      { text: "Architecture", link: "/guide/architecture" },
      { text: "GitHub", link: "https://github.com/sssemil/shardd" },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/sssemil/shardd" }],
    footer: {
      message: "Built for global edge routing over a private shard mesh.",
      copyright: "Copyright © 2026 shardd",
    },
    sidebar: [
      {
        text: "Get Started",
        items: [
          { text: "Quickstart", link: "/guide/quickstart" },
          { text: "Public Edge Clients", link: "/guide/public-edge-clients" },
          { text: "Architecture", link: "/guide/architecture" },
        ],
      },
    ],
  },
});
