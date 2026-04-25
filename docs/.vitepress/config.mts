import { defineConfig } from "vitepress";
import { execSync } from "node:child_process";
import { readFile, writeFile, copyFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";

// Resolve the commit hash at build time so the footer can link to the
// exact deployed version. Prefer GITHUB_SHA (set by the Pages workflow);
// fall back to `git rev-parse` for local builds. "unknown" on failure.
const commitSha = (() => {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync("git rev-parse HEAD").toString().trim();
  } catch {
    return "unknown";
  }
})();
const commitShort = commitSha.slice(0, 7);

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
      { text: "GitHub", link: "https://github.com/shardd-xyz" },
      { text: "Login", link: "https://app.shardd.xyz" },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/shardd-xyz" }],
    footer: {
      message: `<a href="https://app.shardd.xyz/tos" style="color:inherit">Terms</a> · <a href="https://app.shardd.xyz/privacy" style="color:inherit">Privacy</a> · <a href="mailto:contact@tqdm.org" style="color:inherit">Contact</a> · <a href="https://esnx.xyz" target="_blank" rel="noopener" style="color:inherit">Me</a> · <a href="/llms.txt" style="color:inherit" title="docs index for LLMs">llms.txt</a> · <a href="https://github.com/shardd-xyz/shardd-landing/commit/${commitSha}" target="_blank" rel="noopener" style="color:inherit;opacity:0.7" title="${commitSha}">build ${commitShort}</a>`,
      copyright: "© 2026 TQDM Inc.",
    },
    sidebar: [
      {
        text: "Get Started",
        items: [
          { text: "Quickstart", link: "/guide/quickstart" },
          { text: "SDKs", link: "/guide/sdks" },
          { text: "AI Agent Prompt", link: "/guide/ai-agent-setup" },
          { text: "Public Edge Clients", link: "/guide/public-edge-clients" },
        ],
      },
    ],
  },
  // Sidebar order; files not listed here go to the end alphabetically.
  // Used by buildEnd below for llms.txt / llms-full.txt.
  async buildEnd(siteConfig) {
    const order = [
      "quickstart",
      "sdks",
      "ai-agent-setup",
      "public-edge-clients",
      "architecture",
    ];
    const guideSrc = join(siteConfig.srcDir, "guide");
    const guideOut = join(siteConfig.outDir, "guide");
    await mkdir(guideOut, { recursive: true });

    const files = (await readdir(guideSrc))
      .filter((f) => f.endsWith(".md"))
      .sort((a, b) => {
        const ai = order.indexOf(a.replace(/\.md$/, ""));
        const bi = order.indexOf(b.replace(/\.md$/, ""));
        return (
          (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.localeCompare(b)
        );
      });

    // 1) Mirror each guide *.md alongside its built HTML so
    //    https://shardd.xyz/guide/<slug>.md returns the raw source.
    for (const f of files) {
      await copyFile(join(guideSrc, f), join(guideOut, f));
    }

    // 2) Emit llms.txt (index, llmstxt.org-style) and llms-full.txt
    //    (full concatenated docs) at the site root.
    const indexLines: string[] = [
      "# shardd",
      "",
      "> A globally distributed credit ledger for metered billing. Credit, debit, and hold accounts from any region — no central database. First-party SDKs for Rust, Python, TypeScript, and Kotlin/JVM.",
      "",
      "## Docs",
      "",
    ];
    const fullParts: string[] = [
      "# shardd — full documentation",
      "",
      "Concatenated source of every guide on shardd.xyz, in sidebar order. Generated at build time; this file is the same markdown the site renders. Drop into an LLM context window for one-shot integration help.",
      "",
    ];
    for (const f of files) {
      const slug = f.replace(/\.md$/, "");
      const md = await readFile(join(guideSrc, f), "utf8");
      const title = (md.match(/^#\s+(.+)$/m)?.[1] ?? slug).trim();
      indexLines.push(
        `- [${title}](https://shardd.xyz/guide/${slug}.md)`,
      );
      fullParts.push(
        `---`,
        ``,
        `# ${title}`,
        ``,
        `Source: https://shardd.xyz/guide/${slug}`,
        ``,
        md.replace(/^#\s+.+\n+/, "").trim(),
        ``,
      );
    }
    await writeFile(
      join(siteConfig.outDir, "llms.txt"),
      indexLines.join("\n") + "\n",
    );
    await writeFile(
      join(siteConfig.outDir, "llms-full.txt"),
      fullParts.join("\n") + "\n",
    );
  },
});
