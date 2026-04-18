<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from "vue";

// Shape matches libs/types::PublicEdgeSummary plus browser-measured RTT.
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
  client_rtt_ms?: number | null;
};

type EdgeHealth = {
  observed_at_unix_ms: number;
  edge_id?: string | null;
  region?: string | null;
  base_url?: string | null;
  ready: boolean;
  discovered_nodes: number;
  healthy_nodes: number;
  best_node_rtt_ms?: number | null;
  sync_gap?: number | null;
  overloaded?: boolean | null;
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
    title: "Credit, debit, hold",
    body: "Atomic writes with idempotency. Holds reserve balance up front with automatic expiry.",
  },
  {
    num: "02",
    title: "Write from any region",
    body: "POST to the nearest edge. Events replicate asynchronously — latency stays local.",
  },
  {
    num: "03",
    title: "No leader, no consensus",
    body: "Every node holds a full replica. Regions converge asynchronously with no coordination overhead.",
  },
  {
    num: "04",
    title: "Built for metered billing",
    body: "LLM tokens, API credits, prepaid accounts. Append-only event stream, auditable forever.",
  },
];

// Reactive state
const loaded = ref(false);
const edges = ref<EdgeSummary[]>(fallbackEdges);
const latencyHistory = ref<Record<string, number[]>>({});
const meshState = ref<"loading" | "live" | "offline">("loading");
let refetchTimer: number | undefined;
let currentAbort: AbortController | undefined;

const FETCH_TIMEOUT_MS = 3500;
const REFETCH_INTERVAL_MS = 2500;
const MAX_LATENCY_SAMPLES = 24;
const SPARKLINE_WIDTH = 56;
const SPARKLINE_HEIGHT = 16;

async function fetchEdgeHealth(
  edge: EdgeSummary,
  signal: AbortSignal,
): Promise<EdgeSummary> {
  const startedAt = window.performance.now();
  const res = await fetch(`${edge.base_url}/gateway/health`, {
    method: "GET",
    signal,
    mode: "cors",
    cache: "no-store",
    credentials: "omit",
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${edge.base_url}: ${res.status}`);
  const health = (await res.json()) as EdgeHealth;
  const finishedAt = window.performance.now();
  return {
    edge_id: health.edge_id || edge.edge_id,
    region: health.region || edge.region,
    base_url: health.base_url || edge.base_url,
    reachable: true,
    ready: health.ready,
    healthy_nodes: health.healthy_nodes,
    best_node_rtt_ms: health.best_node_rtt_ms,
    sync_gap: health.sync_gap,
    overloaded: health.overloaded,
    client_rtt_ms: Math.max(finishedAt - startedAt, 0),
  };
}

function offlineEdge(edge: EdgeSummary): EdgeSummary {
  return {
    ...edge,
    reachable: false,
    ready: false,
    healthy_nodes: null,
    best_node_rtt_ms: null,
    sync_gap: null,
    overloaded: null,
    client_rtt_ms: null,
  };
}

function recordLatencySamples(nextEdges: EdgeSummary[]) {
  const nextHistory = { ...latencyHistory.value };
  for (const edge of nextEdges) {
    if (edge.client_rtt_ms === null || edge.client_rtt_ms === undefined) continue;
    const samples = [...(nextHistory[edge.edge_id] || []), edge.client_rtt_ms];
    nextHistory[edge.edge_id] = samples.slice(-MAX_LATENCY_SAMPLES);
  }
  latencyHistory.value = nextHistory;
}

async function refreshEdges() {
  currentAbort?.abort();
  const ctrl = new AbortController();
  currentAbort = ctrl;
  const timer = window.setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const results = await Promise.all(
      fallbackEdges.map(async (edge) => {
        try {
          return await fetchEdgeHealth(edge, ctrl.signal);
        } catch {
          return offlineEdge(edge);
        }
      }),
    );
    const nextEdges = [...results].sort((a, b) =>
      a.edge_id.localeCompare(b.edge_id),
    );
    edges.value = nextEdges;
    recordLatencySamples(nextEdges);
    meshState.value = nextEdges.some((edge) => edge.reachable) ? "live" : "offline";
  } catch {
    edges.value = fallbackEdges.map((edge) => offlineEdge(edge));
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
  if (e.client_rtt_ms === null || e.client_rtt_ms === undefined) {
    return "—";
  }
  if (e.client_rtt_ms > 0 && e.client_rtt_ms < 1) {
    return "<1";
  }
  return String(Math.round(e.client_rtt_ms));
}

function regionLatencyUnit(e: EdgeSummary): string {
  return e.client_rtt_ms === null || e.client_rtt_ms === undefined ? "" : "ms";
}

function regionMeshLatency(e: EdgeSummary): string | null {
  if (e.best_node_rtt_ms === null || e.best_node_rtt_ms === undefined) {
    return null;
  }
  if (e.best_node_rtt_ms === 0) {
    return "mesh <1 ms";
  }
  return `mesh ${Math.round(e.best_node_rtt_ms)} ms`;
}

function regionLatencySparkline(edge: EdgeSummary): string {
  const samples = latencyHistory.value[edge.edge_id] || [];
  if (samples.length === 0) return "";
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const range = Math.max(max - min, 1);
  if (samples.length === 1) {
    const y = SPARKLINE_HEIGHT / 2;
    return `0,${y.toFixed(1)} ${SPARKLINE_WIDTH},${y.toFixed(1)}`;
  }
  return samples
    .map((sample, index) => {
      const x = (index / (samples.length - 1)) * SPARKLINE_WIDTH;
      const normalized = range === 1 ? 0.5 : (sample - min) / range;
      const y = SPARKLINE_HEIGHT - normalized * SPARKLINE_HEIGHT;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
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
          Balances<br />at the edge.
        </h1>

        <div class="sd-hero-row">
          <div class="sd-hero-col" data-delay="2">
            <p class="sd-tagline">
              A distributed ledger for metered billing. Post credits,
              debits, and holds at any edge — writes replicate
              asynchronously across regions.
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
                    <div class="sd-region-city">
                      {{ e.region }}
                      <span v-if="regionMeshLatency(e)">
                        · {{ regionMeshLatency(e) }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="sd-region-right">
                  <svg
                    class="sd-region-spark"
                    :viewBox="`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`"
                    aria-hidden="true"
                  >
                    <polyline
                      v-if="regionLatencySparkline(e)"
                      :points="regionLatencySparkline(e)"
                    />
                  </svg>
                  <div class="sd-region-lat">
                    <span class="sd-region-num">{{ regionLatency(e) }}</span>
                    <span class="sd-region-unit">{{ regionLatencyUnit(e) }}</span>
                  </div>
                </div>
              </li>
            </ul>
            <footer class="sd-regions-foot">
              <span v-if="meshState === 'live'">
                live · browser ping /gateway/health · refresh 2.5s
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
          <span class="sd-section-label">// the shape</span>
          <h2 class="sd-section-title">
            Write from any region. Read from any region.
          </h2>
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
            <h2 class="sd-cta-title">POST /events.</h2>
            <p class="sd-cta-sub">
              Credit or debit any account at any edge. Read balances
              from anywhere. The mesh handles the rest.
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
