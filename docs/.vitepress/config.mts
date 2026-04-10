import { defineConfig } from "vitepress";

export default defineConfig({
  title: "shardd",
  description: "Balance infrastructure with public regional edges, private shard replication, and a hosted control plane.",
  base: "/",
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
      { text: "Login", link: "https://app.shardd.xyz" },
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
