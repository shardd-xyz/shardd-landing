<script setup lang="ts">
import { useRoute } from "vitepress";
import { computed, ref } from "vue";

const route = useRoute();

// Only show on /guide/* pages — the homepage uses its own SdHome layout.
const showActions = computed(() => route.path.startsWith("/guide/"));

// /guide/quickstart   → /guide/quickstart.md
// /guide/quickstart/  → /guide/quickstart.md
const mdUrl = computed(() => `${route.path.replace(/\/$/, "")}.md`);

const copied = ref(false);
const failed = ref(false);

async function copyMarkdown() {
  failed.value = false;
  try {
    const res = await fetch(mdUrl.value);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    await navigator.clipboard.writeText(text);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch (err) {
    console.error("copy markdown failed:", err);
    failed.value = true;
    setTimeout(() => { failed.value = false; }, 3000);
  }
}
</script>

<template>
  <div v-if="showActions" class="sd-doc-actions">
    <button
      type="button"
      class="sd-doc-action"
      :data-state="copied ? 'copied' : (failed ? 'failed' : 'idle')"
      @click="copyMarkdown"
    >
      <span v-if="copied">✓ copied</span>
      <span v-else-if="failed">copy failed</span>
      <span v-else>copy as markdown</span>
    </button>
    <a class="sd-doc-action" :href="mdUrl" target="_blank" rel="noopener">view .md</a>
    <a class="sd-doc-action" href="/llms.txt" target="_blank" rel="noopener">llms.txt</a>
    <a class="sd-doc-action" href="/llms-full.txt" target="_blank" rel="noopener">llms-full.txt</a>
  </div>
</template>

<style scoped>
.sd-doc-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 24px;
  font-family: var(--vp-font-family-mono, ui-monospace, monospace);
  font-size: 12px;
  line-height: 1;
}
.sd-doc-action {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  color: var(--vp-c-text-2);
  text-decoration: none;
  background: transparent;
  cursor: pointer;
  transition: color .15s, border-color .15s, background .15s;
}
.sd-doc-action:hover {
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-brand-1);
}
.sd-doc-action[data-state="copied"] {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}
.sd-doc-action[data-state="failed"] {
  color: #d36363;
  border-color: #d36363;
}
</style>
