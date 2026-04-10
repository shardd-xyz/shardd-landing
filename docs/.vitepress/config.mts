import { defineConfig } from "vitepress";

export default defineConfig({
  title: "shardd",
  description: "Edge-routed storage over a private shard replication mesh.",
  base: "/",
  cleanUrls: true,
  appearance: "force-dark",
  head: [
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    ["link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" }],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
    ["meta", { name: "theme-color", content: "#0a0a0a" }],
    ["meta", { property: "og:title", content: "shardd — edge-routed storage" }],
    [
      "meta",
      {
        property: "og:description",
        content: "Named HTTPS edges in every region over a private shard replication mesh.",
      },
    ],
  ],
  themeConfig: {
    logo: "/logo-mark.svg",
    nav: [
      { text: "Docs", link: "/guide/quickstart" },
      { text: "Architecture", link: "/guide/architecture" },
      { text: "GitHub", link: "https://github.com/sssemil/shardd" },
      { text: "Login", link: "https://app.shardd.xyz" },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/sssemil/shardd" }],
    footer: {
      message: "Edge-routed storage over a private shard mesh.",
      copyright: "© 2026 shardd",
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
