<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from "vue";

// Shape matches libs/types::PublicEdgeSummary
type EdgeSummary = {
  edge_id: string;
  region: string;
  base_url: string;
  health_url?: string;
  reachable: boolean;
  ready: boolean;
  healthy_nodes?: number | null;
  best_node_rtt_ms?: number | null;
  sync_gap?: number | null;
  overloaded?: boolean | null;
};

type EdgeDirectory = {
  observed_at_unix_ms: number;
  edges: EdgeSummary[];
};

// Static fallback matches the deployed topology so the SSR HTML looks
// sensible before hydration and when the live fetch fails.
const fallbackEdges: EdgeSummary[] = [
  {
    edge_id: "use1",
    region: "us-east-1",
    base_url: "https://use1.api.shardd.xyz",
    reachable: false,
    ready: false,
  },
  {
    edge_id: "euc1",
    region: "eu-central-1",
    base_url: "https://euc1.api.shardd.xyz",
    reachable: false,
    ready: false,
  },
  {
    edge_id: "ape1",
    region: "ap-east-1",
    base_url: "https://ape1.api.shardd.xyz",
    reachable: false,
    ready: false,
  },
];

const features = [
  {
    num: "01",
    title: "Regional HTTPS edges",
    body: "Named endpoints per region handle TLS, auth, and routing. Just HTTPS your SDK already speaks.",
  },
  {
    num: "02",
    title: "Live edge discovery",
    body: "The SDK inspects mesh health and picks the fastest edge on every call. No DNS tricks.",
  },
  {
    num: "03",
    title: "Private shard mesh",
    body: "Replication and consensus run behind the edges. Stateful internals stay off the public internet.",
  },
  {
    num: "04",
    title: "Hosted control plane",
    body: "Keys, scopes, and bucket access at app.shardd.xyz. Operators manage, developers consume.",
  },
];

// Reactive state
const loaded = ref(false);
const edges = ref<EdgeSummary[]>(fallbackEdges);
const meshState = ref<"loading" | "live" | "offline">("loading");
let refetchTimer: number | undefined;
let currentAbort: AbortController | undefined;

// No central api.shardd.xyz — the landing demos the same behavior the SDK
// uses: race every known regional edge, keep the directory from whichever
// responds first.
const BOOTSTRAP_URLS = [
  "https://use1.api.shardd.xyz/gateway/edges",
  "https://euc1.api.shardd.xyz/gateway/edges",
  "https://ape1.api.shardd.xyz/gateway/edges",
];
const FETCH_TIMEOUT_MS = 3500;
const REFETCH_INTERVAL_MS = 15000;

async function fetchDirectory(
  url: string,
  signal: AbortSignal,
): Promise<EdgeDirectory> {
  const res = await fetch(url, {
    method: "GET",
    signal,
    mode: "cors",
    cache: "no-store",
    credentials: "omit",
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const data = (await res.json()) as EdgeDirectory;
  if (!Array.isArray(data.edges) || data.edges.length === 0) {
    throw new Error(`${url}: empty directory`);
  }
  return data;
}

async function refreshEdges() {
  currentAbort?.abort();
  const ctrl = new AbortController();
  currentAbort = ctrl;
  const timer = window.setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const data = await Promise.any(
      BOOTSTRAP_URLS.map((u) => fetchDirectory(u, ctrl.signal)),
    );
    edges.value = [...data.edges].sort((a, b) =>
      a.edge_id.localeCompare(b.edge_id),
    );
    meshState.value = "live";
  } catch {
    meshState.value = "offline";
  } finally {
    window.clearTimeout(timer);
  }
}

onMounted(() => {
  requestAnimationFrame(() => {
    loaded.value = true;
  });
  refreshEdges();
  refetchTimer = window.setInterval(refreshEdges, REFETCH_INTERVAL_MS);
});

onBeforeUnmount(() => {
  if (refetchTimer !== undefined) window.clearInterval(refetchTimer);
  currentAbort?.abort();
});

// Derived UI state
const healthyCount = computed(
  () =>
    edges.value.filter((e) => e.reachable && e.ready && !e.overloaded).length,
);
const totalCount = computed(() => edges.value.length);

const meshLabel = computed(() => {
  switch (meshState.value) {
    case "live":
      return "live";
    case "offline":
      return "offline";
    default:
      return "resolving";
  }
});

const meshStatusText = computed(() => {
  switch (meshState.value) {
    case "live":
      return "mesh · live";
    case "offline":
      return "mesh · offline";
    default:
      return "mesh · resolving";
  }
});

function regionStatus(e: EdgeSummary): "healthy" | "degraded" | "offline" {
  if (!e.reachable || !e.ready) return "offline";
  if (e.overloaded) return "degraded";
  return "healthy";
}

function regionLatency(e: EdgeSummary): string {
  if (e.best_node_rtt_ms === null || e.best_node_rtt_ms === undefined) {
    return "—";
  }
  return String(Math.round(e.best_node_rtt_ms));
}
</script>

<template>
  <div class="sd-home" :class="{ loaded }">
    <div class="sd-grain" aria-hidden="true"></div>

    <!-- HERO ------------------------------------------------------ -->
    <section class="sd-hero">
      <div class="sd-hero-bg" aria-hidden="true"></div>
      <div class="sd-hero-inner">
        <div class="sd-meta" data-delay="0" :data-state="meshState">
          <span class="sd-pulse">
            <span class="sd-pulse-dot"></span>
          </span>
          <span class="sd-meta-text">{{ meshStatusText }}</span>
        </div>

        <h1 class="sd-title" data-delay="1">
          Storage that<br />routes itself.
        </h1>

        <div class="sd-hero-row">
          <div class="sd-hero-col" data-delay="2">
            <p class="sd-tagline">
              Regional HTTPS edges, a private shard mesh, and one SDK call
              that picks the fastest live edge.
            </p>
            <div class="sd-actions">
              <a class="sd-btn sd-btn-primary" href="https://app.shardd.xyz">
                <span>Log in</span>
                <span class="sd-btn-arrow">→</span>
              </a>
              <a class="sd-btn sd-btn-ghost" href="/guide/quickstart">
                Read the docs
              </a>
            </div>
          </div>

          <aside
            class="sd-regions"
            data-delay="3"
            :data-state="meshState"
            aria-label="Edge mesh status"
          >
            <header class="sd-regions-head">
              <span class="sd-regions-label">edge mesh</span>
              <span class="sd-regions-count">
                <span class="sd-regions-num">{{ healthyCount }}</span>
                /
                <span class="sd-regions-num">{{ totalCount }}</span>
                <span class="sd-regions-state">· {{ meshLabel }}</span>
              </span>
            </header>
            <ul class="sd-regions-list">
              <li
                v-for="e in edges"
                :key="e.edge_id"
                class="sd-region"
                :data-status="regionStatus(e)"
              >
                <div class="sd-region-left">
                  <span class="sd-pulse sd-pulse-sm">
                    <span class="sd-pulse-dot"></span>
                  </span>
                  <div class="sd-region-name">
                    <div class="sd-region-code">{{ e.edge_id }}</div>
                    <div class="sd-region-city">{{ e.region }}</div>
                  </div>
                </div>
                <div class="sd-region-lat">
                  <span class="sd-region-num">{{ regionLatency(e) }}</span>
                  <span class="sd-region-unit">ms</span>
                </div>
              </li>
            </ul>
            <footer class="sd-regions-foot">
              <span v-if="meshState === 'live'">
                live · racing /gateway/edges · refresh 15s
              </span>
              <span v-else-if="meshState === 'offline'">
                mesh unreachable · retrying
              </span>
              <span v-else>resolving · racing regional edges</span>
            </footer>
          </aside>
        </div>
      </div>
    </section>

    <!-- FEATURES -------------------------------------------------- -->
    <section class="sd-bento">
      <div class="sd-section-inner">
        <div class="sd-section-head">
          <span class="sd-section-label">// what you get</span>
          <h2 class="sd-section-title">Four pieces. Zero glue code.</h2>
        </div>
        <div class="sd-bento-grid">
          <article
            v-for="(f, i) in features"
            :key="f.num"
            class="sd-card"
            :class="{
              'sd-card-lg': i === 0,
              'sd-card-wide': i === 3,
            }"
          >
            <div class="sd-card-num">{{ f.num }}</div>
            <h3 class="sd-card-title">{{ f.title }}</h3>
            <p class="sd-card-body">{{ f.body }}</p>
          </article>
        </div>
      </div>
    </section>

    <!-- CTA ------------------------------------------------------- -->
    <section class="sd-cta">
      <div class="sd-section-inner">
        <div class="sd-cta-inner">
          <div class="sd-cta-text">
            <span class="sd-section-label">// start here</span>
            <h2 class="sd-cta-title">Ship in a minute.</h2>
            <p class="sd-cta-sub">
              Bootstrap against a public edge. No credit card.
            </p>
          </div>
          <div class="sd-cta-actions">
            <a class="sd-btn sd-btn-primary" href="/guide/quickstart">
              <span>Quickstart</span>
              <span class="sd-btn-arrow">→</span>
            </a>
            <a
              class="sd-btn sd-btn-ghost"
              href="https://github.com/sssemil/shardd"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
