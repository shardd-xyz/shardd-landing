import { defineConfig } from "vitepress";

export default defineConfig({
  title: "shardd",
  description: "A distributed balance ledger for per-request billing. Credit, debit, and hold accounts from any region — no central database.",
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
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap",
      },
    ],
    ["script", { defer: "", src: "https://cloud.umami.is/script.js", "data-website-id": "81c87671-2492-478d-9e60-12c3b0696fad" }],
    ["meta", { name: "theme-color", content: "#0a0a0a" }],
    ["meta", { property: "og:title", content: "shardd — balances at the edge" }],
    [
      "meta",
      {
        property: "og:description",
        content: "A distributed balance ledger for per-request billing. Credit, debit, and hold accounts from any region — no central database.",
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
      message: '<a href="https://app.shardd.xyz/tos" style="color:inherit">Terms</a> · <a href="https://app.shardd.xyz/privacy" style="color:inherit">Privacy</a> · <a href="mailto:contact@tqdm.org" style="color:inherit">Contact</a>',
      copyright: "© 2026 TQDM Inc.",
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
