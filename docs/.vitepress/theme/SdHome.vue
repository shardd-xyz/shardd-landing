<script setup lang="ts">
import { ref, onMounted } from "vue";

type Region = {
  code: string;
  area: string;
  city: string;
  p50: string;
};

const regions: Region[] = [
  { code: "fra1", area: "eu-central", city: "frankfurt", p50: "9" },
  { code: "lhr1", area: "eu-west", city: "london", p50: "11" },
  { code: "iad1", area: "us-east", city: "virginia", p50: "12" },
  { code: "sfo1", area: "us-west", city: "san francisco", p50: "18" },
  { code: "sin1", area: "ap-southeast", city: "singapore", p50: "24" },
  { code: "nrt1", area: "ap-northeast", city: "tokyo", p50: "31" },
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

const loaded = ref(false);
onMounted(() => {
  requestAnimationFrame(() => {
    loaded.value = true;
  });
});
</script>

<template>
  <div class="sd-home" :class="{ loaded }">
    <div class="sd-grain" aria-hidden="true"></div>

    <!-- HERO ------------------------------------------------------ -->
    <section class="sd-hero">
      <div class="sd-hero-bg" aria-hidden="true"></div>
      <div class="sd-hero-inner">
        <div class="sd-meta" data-delay="0">
          <span class="sd-pulse">
            <span class="sd-pulse-dot"></span>
          </span>
          <span class="sd-meta-text">status · operational · 6 regions</span>
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

          <aside class="sd-regions" data-delay="3" aria-label="Edge mesh status">
            <header class="sd-regions-head">
              <span class="sd-regions-label">edge mesh</span>
              <span class="sd-regions-count">6 / 6</span>
            </header>
            <ul class="sd-regions-list">
              <li v-for="r in regions" :key="r.code" class="sd-region">
                <div class="sd-region-left">
                  <span class="sd-pulse sd-pulse-sm">
                    <span class="sd-pulse-dot"></span>
                  </span>
                  <div class="sd-region-name">
                    <div class="sd-region-code">{{ r.code }}</div>
                    <div class="sd-region-city">{{ r.area }} · {{ r.city }}</div>
                  </div>
                </div>
                <div class="sd-region-lat">
                  <span class="sd-region-num">{{ r.p50 }}</span>
                  <span class="sd-region-unit">ms</span>
                </div>
              </li>
            </ul>
            <footer class="sd-regions-foot">
              p50 · last 60s · client pov
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
