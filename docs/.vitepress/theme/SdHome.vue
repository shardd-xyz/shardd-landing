<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from "vue";

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
  // One-shot IP geolocation for the "you" dot on the minimap.
  resolveIpLocation();
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

// ── Minimap: show the visitor's rough location and connect it to the three
// public edges. Communicates "this is a ping from YOUR browser to these
// boxes" without an IP-geo API — just the browser's timezone, rounded to
// a handful of hubs that cover most traffic. Unknown timezones hide the
// client dot so we never pretend to know where someone is.

const EDGE_COORDS: Record<string, { lat: number; lon: number; label: string }> = {
  use1: { lat: 37.4, lon: -79.1, label: "Virginia" },
  euc1: { lat: 50.1, lon: 8.6, label: "Frankfurt" },
  ape1: { lat: 22.3, lon: 114.2, label: "Hong Kong" },
};

// Rough city → lat/lon table keyed by IANA timezone. Covers the majority
// of real-world traffic; anything else falls through to null.
const TZ_COORDS: Record<string, { lat: number; lon: number; city: string }> = {
  "America/New_York": { lat: 40.7, lon: -74.0, city: "New York" },
  "America/Chicago": { lat: 41.9, lon: -87.6, city: "Chicago" },
  "America/Denver": { lat: 39.7, lon: -105.0, city: "Denver" },
  "America/Los_Angeles": { lat: 34.0, lon: -118.2, city: "Los Angeles" },
  "America/Toronto": { lat: 43.7, lon: -79.4, city: "Toronto" },
  "America/Vancouver": { lat: 49.3, lon: -123.1, city: "Vancouver" },
  "America/Mexico_City": { lat: 19.4, lon: -99.1, city: "Mexico City" },
  "America/Sao_Paulo": { lat: -23.5, lon: -46.6, city: "São Paulo" },
  "America/Argentina/Buenos_Aires": { lat: -34.6, lon: -58.4, city: "Buenos Aires" },
  "Europe/London": { lat: 51.5, lon: -0.1, city: "London" },
  "Europe/Dublin": { lat: 53.3, lon: -6.3, city: "Dublin" },
  "Europe/Paris": { lat: 48.9, lon: 2.3, city: "Paris" },
  "Europe/Berlin": { lat: 52.5, lon: 13.4, city: "Berlin" },
  "Europe/Madrid": { lat: 40.4, lon: -3.7, city: "Madrid" },
  "Europe/Amsterdam": { lat: 52.4, lon: 4.9, city: "Amsterdam" },
  "Europe/Stockholm": { lat: 59.3, lon: 18.1, city: "Stockholm" },
  "Europe/Warsaw": { lat: 52.2, lon: 21.0, city: "Warsaw" },
  "Europe/Moscow": { lat: 55.8, lon: 37.6, city: "Moscow" },
  "Europe/Istanbul": { lat: 41.0, lon: 28.9, city: "Istanbul" },
  "Africa/Cairo": { lat: 30.0, lon: 31.2, city: "Cairo" },
  "Africa/Lagos": { lat: 6.5, lon: 3.4, city: "Lagos" },
  "Africa/Johannesburg": { lat: -26.2, lon: 28.0, city: "Johannesburg" },
  "Asia/Dubai": { lat: 25.2, lon: 55.3, city: "Dubai" },
  "Asia/Kolkata": { lat: 28.6, lon: 77.2, city: "Delhi" },
  "Asia/Bangkok": { lat: 13.8, lon: 100.5, city: "Bangkok" },
  "Asia/Singapore": { lat: 1.4, lon: 103.8, city: "Singapore" },
  "Asia/Hong_Kong": { lat: 22.3, lon: 114.2, city: "Hong Kong" },
  "Asia/Shanghai": { lat: 31.2, lon: 121.5, city: "Shanghai" },
  "Asia/Tokyo": { lat: 35.7, lon: 139.7, city: "Tokyo" },
  "Asia/Seoul": { lat: 37.6, lon: 127.0, city: "Seoul" },
  "Australia/Sydney": { lat: -33.9, lon: 151.2, city: "Sydney" },
  "Australia/Melbourne": { lat: -37.8, lon: 145.0, city: "Melbourne" },
  "Pacific/Auckland": { lat: -36.8, lon: 174.8, city: "Auckland" },
};

// IP geolocation (via ipapi.co, free + CORS-friendly). Falls back to the
// timezone heuristic if the request fails (ad-blocker, rate limit,
// offline) so the map still shows a dot in the most-likely-correct city.
const ipCoords = ref<{ lat: number; lon: number; city: string } | null>(null);

async function resolveIpLocation() {
  try {
    const res = await fetch("https://ipapi.co/json/", { cache: "force-cache" });
    if (!res.ok) return;
    const body = (await res.json()) as {
      latitude?: number;
      longitude?: number;
      city?: string;
      country_name?: string;
    };
    if (typeof body.latitude === "number" && typeof body.longitude === "number") {
      const city = body.city?.trim() || body.country_name?.trim() || "your IP";
      ipCoords.value = { lat: body.latitude, lon: body.longitude, city };
    }
  } catch {
    // Swallow: the timezone fallback handles it.
  }
}

const clientCoords = computed(() => {
  if (ipCoords.value) return ipCoords.value;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TZ_COORDS[tz] ?? null;
  } catch {
    return null;
  }
});

// Equirectangular projection matching the pre-rendered world-land.svg
// (viewBox 0 0 360 180, same as d3.geoEquirectangular at scale 180/π).
// That way continents, dots, lines, and labels all share a coord system.
function project(lat: number, lon: number): { x: number; y: number } {
  const x = 180 + lon;
  const y = 90 - lat;
  return { x, y };
}

type MapEdge = {
  edge_id: string;
  label: string;
  x: number;
  y: number;
  lx: number; // label position after collision-avoidance
  ly: number;
  status: "healthy" | "degraded" | "offline";
  rtt: string;
  rtt_unit: string;
};

// Raw edge positions (before label nudging).
const rawMapEdges = computed(() =>
  edges.value.map((e) => {
    const geo = EDGE_COORDS[e.edge_id] ?? { lat: 0, lon: 0, label: e.region };
    const { x, y } = project(geo.lat, geo.lon);
    return {
      edge_id: e.edge_id,
      label: geo.label,
      x,
      y,
      status: regionStatus(e),
      rtt: regionLatency(e),
      rtt_unit: regionLatencyUnit(e),
    };
  })
);

const clientPointRaw = computed(() => {
  const c = clientCoords.value;
  if (!c) return null;
  const { x, y } = project(c.lat, c.lon);
  return { ...c, x, y };
});

// Continuous physics for label orbits and line bends. Every frame the RAF
// step integrates forces on each label (repulsion from other labels, dots
// and connector lines; angular spring back to a bias direction; radial
// spring to rest radius) and each line (bend springs back to zero). The
// user can grab a label and pull it around — drag overrides physics and
// the velocity built up during drag carries through on release, so the
// label wobbles back like a pendulum. Lines are quadratic Béziers with a
// draggable midpoint that springs back the same way.
const LABEL_RADIUS = 9;       // rest distance from dot to label center
const MIN_DX = 30;            // label-label overlap threshold (x, of 360)
const MIN_DY = 13;            // label-label overlap threshold (y, of 180)
const DOT_CLEAR = 8;          // keep labels this far from non-anchor dots
const LINE_CLEAR = 6;         // keep labels this far from connector lines

const DAMP_PER_SEC = 3.8;     // v *= exp(-DAMP_PER_SEC·dt) — wobble decay
const ANGLE_SPRING = 6.0;     // rad/s² per rad offset from bias
const RADIUS_SPRING = 60.0;   // u/s² per unit offset from rest radius
const BEND_SPRING = 36.0;     // u/s² per unit of line bend
const TORQUE_GAIN = 75.0;     // force→angular-accel multiplier
const MAX_DT = 0.05;

const EDGE_BIAS = Math.PI / 2;   // edge labels prefer sitting below dot
const YOU_BIAS = -Math.PI / 2;   // viewer label prefers sitting above

type LabelBody = {
  key: string;
  ax: number;         // anchor (dot) x
  ay: number;         // anchor (dot) y
  dotX: number;
  dotY: number;
  angle: number;
  radius: number;
  angleBias: number;
  angleV: number;
  radiusV: number;
};

type LineBody = {
  edgeId: string;
  bendX: number;
  bendY: number;
  bendVX: number;
  bendVY: number;
};

type Drag =
  | { kind: "label"; key: string; vbX: number; vbY: number }
  | { kind: "line"; key: string; vbX: number; vbY: number }
  | null;

const labelBodies = ref<Record<string, LabelBody>>({});
const lineBodies = ref<Record<string, LineBody>>({});
const dragState = ref<Drag>(null);
const mapInnerEl = ref<HTMLElement | null>(null);
let rafId = 0;
let lastStepTs = 0;

/// Shortest distance from (px,py) to segment [(ax,ay)-(bx,by)], plus the
/// normalized push direction (from nearest segment point toward the input
/// point). Returns null when the perpendicular foot lies near an endpoint
/// — the dot-repulsion pass handles those cases.
function perpRepel(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): { dist: number; nx: number; ny: number } | null {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return null;
  const t = ((px - ax) * dx + (py - ay) * dy) / len2;
  if (t <= 0.05 || t >= 0.95) return null;
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const vx = px - cx;
  const vy = py - cy;
  const dist = Math.hypot(vx, vy);
  if (dist === 0) {
    const ln = Math.hypot(dx, dy);
    return { dist: 0, nx: -dy / ln, ny: dx / ln };
  }
  return { dist, nx: vx / dist, ny: vy / dist };
}

function labelPos(l: LabelBody): { x: number; y: number } {
  return { x: l.ax + l.radius * Math.cos(l.angle), y: l.ay + l.radius * Math.sin(l.angle) };
}

function syncBodies(): void {
  const nextLabels: Record<string, LabelBody> = {};
  for (const e of rawMapEdges.value) {
    const prev = labelBodies.value[e.edge_id];
    nextLabels[e.edge_id] = prev
      ? { ...prev, ax: e.x, ay: e.y, dotX: e.x, dotY: e.y }
      : {
          key: e.edge_id,
          ax: e.x, ay: e.y, dotX: e.x, dotY: e.y,
          angle: EDGE_BIAS, angleBias: EDGE_BIAS,
          radius: LABEL_RADIUS, angleV: 0, radiusV: 0,
        };
  }
  if (clientPointRaw.value) {
    const prev = labelBodies.value["__you"];
    nextLabels["__you"] = prev
      ? { ...prev,
          ax: clientPointRaw.value.x, ay: clientPointRaw.value.y,
          dotX: clientPointRaw.value.x, dotY: clientPointRaw.value.y }
      : {
          key: "__you",
          ax: clientPointRaw.value.x, ay: clientPointRaw.value.y,
          dotX: clientPointRaw.value.x, dotY: clientPointRaw.value.y,
          angle: YOU_BIAS, angleBias: YOU_BIAS,
          radius: LABEL_RADIUS, angleV: 0, radiusV: 0,
        };
  }
  labelBodies.value = nextLabels;

  const nextLines: Record<string, LineBody> = {};
  for (const e of rawMapEdges.value) {
    nextLines[e.edge_id] = lineBodies.value[e.edge_id] ?? {
      edgeId: e.edge_id,
      bendX: 0, bendY: 0, bendVX: 0, bendVY: 0,
    };
  }
  lineBodies.value = nextLines;
}

watch([rawMapEdges, clientPointRaw], () => syncBodies(), { immediate: true });

function vbFromEvent(ev: PointerEvent): { x: number; y: number } {
  const el = mapInnerEl.value;
  if (!el) return { x: 0, y: 0 };
  const r = el.getBoundingClientRect();
  return {
    x: ((ev.clientX - r.left) / r.width) * 360,
    y: ((ev.clientY - r.top) / r.height) * 180,
  };
}

function startLabelDrag(ev: PointerEvent, key: string): void {
  ev.preventDefault();
  const t = ev.currentTarget as HTMLElement | null;
  t?.setPointerCapture?.(ev.pointerId);
  const pt = vbFromEvent(ev);
  dragState.value = { kind: "label", key, vbX: pt.x, vbY: pt.y };
}

function startLineDrag(ev: PointerEvent, edgeId: string): void {
  ev.preventDefault();
  const t = ev.currentTarget as SVGElement | null;
  t?.setPointerCapture?.(ev.pointerId);
  const pt = vbFromEvent(ev);
  dragState.value = { kind: "line", key: edgeId, vbX: pt.x, vbY: pt.y };
}

function onWindowPointerMove(ev: PointerEvent): void {
  if (!dragState.value) return;
  const pt = vbFromEvent(ev);
  dragState.value = { ...dragState.value, vbX: pt.x, vbY: pt.y };
}

function onWindowPointerUp(): void {
  dragState.value = null;
}

function step(ts: number): void {
  const dt = lastStepTs ? Math.min((ts - lastStepTs) / 1000, MAX_DT) : 0;
  lastStepTs = ts;
  const damp = Math.exp(-DAMP_PER_SEC * dt);
  const labels = Object.values(labelBodies.value);
  const drag = dragState.value;

  // 1. Dragged label follows cursor; derive velocity for release wobble.
  for (const l of labels) {
    if (drag?.kind === "label" && drag.key === l.key) {
      const dx = drag.vbX - l.ax;
      const dy = drag.vbY - l.ay;
      const r = Math.hypot(dx, dy);
      const a = r === 0 ? l.angle : Math.atan2(dy, dx);
      let diff = a - l.angle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      if (dt > 0) {
        l.angleV = diff / dt;
        l.radiusV = (r - l.radius) / dt;
      }
      l.angle += diff;
      l.radius = Math.max(2, Math.min(60, r));
    }
  }

  // 2. Free labels: forces → torque + radial spring; integrate with damping.
  for (const a of labels) {
    if (drag?.kind === "label" && drag.key === a.key) continue;
    const apos = labelPos(a);
    let fx = 0, fy = 0;

    for (const b of labels) {
      if (a.key === b.key) continue;
      const bpos = labelPos(b);
      const ex = apos.x - bpos.x, ey = apos.y - bpos.y;
      if (Math.abs(ex) < MIN_DX && Math.abs(ey) < MIN_DY) {
        const sx = ex === 0 ? -1 : Math.sign(ex);
        const sy = ey === 0 ? -1 : Math.sign(ey);
        fx += sx * (MIN_DX - Math.abs(ex)) * 0.30;
        fy += sy * (MIN_DY - Math.abs(ey)) * 0.50;
      }
      const dex = apos.x - b.dotX, dey = apos.y - b.dotY;
      const dd = Math.hypot(dex, dey);
      if (dd < DOT_CLEAR && dd > 0) {
        const push = DOT_CLEAR - dd;
        fx += (dex / dd) * push * 1.0;
        fy += (dey / dd) * push * 1.0;
      }
    }

    const cli = labelBodies.value["__you"];
    if (cli) {
      for (const b of labels) {
        if (b.key === "__you" || b.key === a.key) continue;
        const r = perpRepel(apos.x, apos.y, cli.dotX, cli.dotY, b.dotX, b.dotY);
        if (r && r.dist < LINE_CLEAR) {
          const push = LINE_CLEAR - r.dist;
          fx += r.nx * push * 0.6;
          fy += r.ny * push * 0.6;
        }
      }
    }

    const ox = a.radius * Math.cos(a.angle);
    const oy = a.radius * Math.sin(a.angle);
    const torque = (ox * fy - oy * fx) / Math.max(a.radius * a.radius, 1);

    let angleDiff = a.angleBias - a.angle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    const angleAccel = torque * TORQUE_GAIN + angleDiff * ANGLE_SPRING;
    const radiusAccel = (LABEL_RADIUS - a.radius) * RADIUS_SPRING;

    a.angleV = (a.angleV + angleAccel * dt) * damp;
    a.radiusV = (a.radiusV + radiusAccel * dt) * damp;
    a.angle += a.angleV * dt;
    a.radius += a.radiusV * dt;
    a.radius = Math.max(4, Math.min(40, a.radius));
  }

  // 3. Lines: dragged → bend follows cursor; free → bend springs back.
  const cli = labelBodies.value["__you"];
  for (const ln of Object.values(lineBodies.value)) {
    const edge = labelBodies.value[ln.edgeId];
    if (!edge || !cli) { ln.bendX = 0; ln.bendY = 0; ln.bendVX = 0; ln.bendVY = 0; continue; }
    const mx = 0.5 * (cli.dotX + edge.dotX);
    const my = 0.5 * (cli.dotY + edge.dotY);
    if (drag?.kind === "line" && drag.key === ln.edgeId) {
      const newBx = drag.vbX - mx;
      const newBy = drag.vbY - my;
      if (dt > 0) {
        ln.bendVX = (newBx - ln.bendX) / dt;
        ln.bendVY = (newBy - ln.bendY) / dt;
      }
      ln.bendX = newBx;
      ln.bendY = newBy;
    } else {
      const aX = -ln.bendX * BEND_SPRING;
      const aY = -ln.bendY * BEND_SPRING;
      ln.bendVX = (ln.bendVX + aX * dt) * damp;
      ln.bendVY = (ln.bendVY + aY * dt) * damp;
      ln.bendX += ln.bendVX * dt;
      ln.bendY += ln.bendVY * dt;
    }
  }

  rafId = requestAnimationFrame(step);
}

onMounted(() => {
  window.addEventListener("pointermove", onWindowPointerMove);
  window.addEventListener("pointerup", onWindowPointerUp);
  window.addEventListener("pointercancel", onWindowPointerUp);
  rafId = requestAnimationFrame(step);
});

onBeforeUnmount(() => {
  window.removeEventListener("pointermove", onWindowPointerMove);
  window.removeEventListener("pointerup", onWindowPointerUp);
  window.removeEventListener("pointercancel", onWindowPointerUp);
  if (rafId) cancelAnimationFrame(rafId);
});

const mapEdges = computed<MapEdge[]>(() =>
  rawMapEdges.value.map((e) => {
    const body = labelBodies.value[e.edge_id];
    const p = body ? labelPos(body) : { x: e.x, y: e.y + LABEL_RADIUS };
    return { ...e, lx: p.x, ly: p.y };
  })
);

const clientPoint = computed(() => {
  if (!clientPointRaw.value) return null;
  const body = labelBodies.value["__you"];
  const p = body ? labelPos(body) : { x: clientPointRaw.value.x, y: clientPointRaw.value.y - LABEL_RADIUS };
  return { ...clientPointRaw.value, lx: p.x, ly: p.y };
});

type MapLine = { edge_id: string; status: "healthy" | "degraded" | "offline"; d: string };

const mapLines = computed<MapLine[]>(() => {
  const cli = clientPointRaw.value;
  if (!cli) return [];
  return rawMapEdges.value.map((e) => {
    const bend = lineBodies.value[e.edge_id];
    const mx = 0.5 * (cli.x + e.x);
    const my = 0.5 * (cli.y + e.y);
    const bx = bend?.bendX ?? 0;
    const by = bend?.bendY ?? 0;
    // For a quadratic Bézier P0–P1–P2, the point at t=0.5 is
    // (P0 + 2·P1 + P2) / 4. To place that midpoint at M + bend, we
    // set the control point P1 = M + 2·bend.
    const cx = mx + 2 * bx;
    const cy = my + 2 * by;
    return { edge_id: e.edge_id, status: e.status, d: `M ${cli.x} ${cli.y} Q ${cx} ${cy} ${e.x} ${e.y}` };
  });
});

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
                <div class="sd-btn-stripe"></div>
                <span>Log in</span>
                <svg class="sd-btn-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
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

            <div class="sd-regions-body">
            <div class="sd-regions-body-left">
            <!-- Minimap: pre-rendered world-land.svg is the background;
                 dots + lines + labels overlay it in the same 360x180 coord
                 system so continents, edges and the viewer's dot agree.
                 Inner wrapper holds the aspect-ratio so labels and SVG
                 share a single coordinate system. -->
            <div class="sd-map" aria-hidden="true">
              <div class="sd-map-inner" ref="mapInnerEl">
                <img src="/world-land.svg" class="sd-map-bg" alt="" decoding="async" />
                <svg class="sd-map-svg" viewBox="0 0 360 180" preserveAspectRatio="none">
                  <template v-if="clientPoint">
                    <!-- Fat transparent hit path behind each visible line so
                         users can grab anywhere along it and pull. -->
                    <path
                      v-for="line in mapLines"
                      :key="`hit-${line.edge_id}`"
                      :d="line.d"
                      class="sd-map-link-hit"
                      @pointerdown="(ev) => startLineDrag(ev, line.edge_id)"
                    />
                    <path
                      v-for="line in mapLines"
                      :key="`line-${line.edge_id}`"
                      :d="line.d"
                      class="sd-map-link"
                      :class="[`sd-map-link-${line.status}`]"
                    />
                  </template>
                  <g v-for="e in mapEdges" :key="`edge-${e.edge_id}`">
                    <circle :cx="e.x" :cy="e.y" r="5" class="sd-map-edge-halo" :class="[`sd-map-edge-halo-${e.status}`]"/>
                    <circle :cx="e.x" :cy="e.y" r="2.2" class="sd-map-edge" :class="[`sd-map-edge-${e.status}`]"/>
                  </g>
                  <g v-if="clientPoint">
                    <circle :cx="clientPoint.x" :cy="clientPoint.y" r="6" class="sd-map-you-halo"/>
                    <circle :cx="clientPoint.x" :cy="clientPoint.y" r="2" class="sd-map-you"/>
                  </g>
                </svg>
                <div
                  v-for="e in mapEdges"
                  :key="`label-${e.edge_id}`"
                  class="sd-map-label"
                  :class="[`sd-map-label-${e.status}`, { 'sd-map-label-drag': dragState?.kind === 'label' && dragState.key === e.edge_id }]"
                  :style="{ left: `${e.lx / 3.6}%`, top: `${e.ly / 1.8}%` }"
                  @pointerdown="(ev) => startLabelDrag(ev, e.edge_id)"
                >
                  <span class="sd-map-label-code">{{ e.edge_id }}</span>
                  <span class="sd-map-label-rtt">{{ e.rtt }}<span class="sd-map-label-unit"> {{ e.rtt_unit }}</span></span>
                </div>
                <div
                  v-if="clientPoint"
                  class="sd-map-you-label"
                  :class="{ 'sd-map-label-drag': dragState?.kind === 'label' && dragState.key === '__you' }"
                  :style="{ left: `${clientPoint.lx / 3.6}%`, top: `${clientPoint.ly / 1.8}%` }"
                  @pointerdown="(ev) => startLabelDrag(ev, '__you')"
                >
                  you · {{ clientPoint.city }}
                </div>
              </div>
            </div>
            <p class="sd-map-caption">
              <span v-if="clientPoint">Ping from your browser ({{ clientPoint.city }}) to each edge · refreshes every 2.5s.</span>
              <span v-else>Ping from your browser to each public edge · refreshes every 2.5s.</span>
              <span class="sd-map-contact">Need a region added? <a href="mailto:emil@tqdm.org?subject=shardd%20region%20request">emil@tqdm.org</a></span>
            </p>
            </div>

            <div class="sd-regions-body-right">
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
            </div>
            </div>
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
              <div class="sd-btn-stripe"></div>
              <span>Quickstart</span>
              <svg class="sd-btn-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
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
