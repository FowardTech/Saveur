import type {i18n as I18n} from 'i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Runtime auto-translation (product request: "auto-translate the whole web
// + mobile app; no untranslated content left"). Mirrors Saveur-Web's
// lib/runtimeTranslation.ts. Bundled locale JSON only covers part of the UI
// -- many strings exist solely as English `defaultValue`s in code. This
// layer fills the gaps on demand:
//   1. a key missing from every bundle -> missingKeyHandler fires with the
//      English defaultValue
//   2. a key in en but not in the active language -> diffed on language change
// Batched to POST /api/v1/i18n/translate (server caches each
// (language, text) pair forever), injected back with addResource so
// react-i18next re-renders, and cached in AsyncStorage.
const CACHE_PREFIX = 'saveur.i18n.rt.v1.';
const BATCH = 60;
const RETRY_AFTER_MS = 60_000;

type Entry = [string, string]; // [sourceHash, translated]
const caches: Record<string, Record<string, Entry>> = {};
const cacheReady: Record<string, Promise<void>> = {};
const pending = new Map<string, {lang: string; ns: string; key: string; text: string}>();
const inflight = new Set<string>();
const failedAt = new Map<string, number>();
let timer: ReturnType<typeof setTimeout> | null = null;
let i18nRef: I18n | null = null;

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function loadCache(lang: string): Promise<void> {
  if (lang in cacheReady) return cacheReady[lang];
  caches[lang] = {};
  cacheReady[lang] = AsyncStorage.getItem(CACHE_PREFIX + lang)
    .then(raw => {
      if (raw) caches[lang] = {...JSON.parse(raw), ...caches[lang]};
    })
    .catch(() => {});
  return cacheReady[lang];
}

function persist(lang: string) {
  AsyncStorage.setItem(CACHE_PREFIX + lang, JSON.stringify(caches[lang] ?? {})).catch(() => {});
}

function apply(lang: string, ns: string, key: string, text: string) {
  i18nRef?.addResource(lang, ns, key, text);
}

function enqueue(lang: string, ns: string, key: string, text: string) {
  if (!text || lang === 'en') return;
  const id = `${lang}|${ns}|${key}`;
  if (pending.has(id) || inflight.has(id)) return;
  const failed = failedAt.get(id);
  if (failed && Date.now() - failed < RETRY_AFTER_MS) return;
  pending.set(id, {lang, ns, key, text});
  if (!timer) timer = setTimeout(flush, 250);
}

async function flush() {
  timer = null;
  const lang = i18nRef?.language?.split('-')[0] ?? 'en';
  await loadCache(lang);
  const cache = caches[lang];
  const batch: [string, {lang: string; ns: string; key: string; text: string}][] = [];
  for (const [id, v] of Array.from(pending.entries())) {
    if (v.lang !== lang) {
      pending.delete(id);
      continue;
    }
    const hit = cache[`${v.ns}|${v.key}`];
    if (hit && hit[0] === hash(v.text)) {
      pending.delete(id);
      apply(lang, v.ns, v.key, hit[1]);
      continue;
    }
    if (batch.length < BATCH) batch.push([id, v]);
  }
  if (!batch.length) return;
  const strings: Record<string, string> = {};
  for (const [id, v] of batch) {
    pending.delete(id);
    inflight.add(id);
    strings[id] = v.text;
  }
  try {
    const apiClient = require('services/apiClient').default;
    const {data} = await apiClient.post('/api/v1/i18n/translate', {lang, strings});
    for (const [id, v] of batch) {
      const out = data?.translations?.[id];
      if (out) {
        apply(lang, v.ns, v.key, out);
        cache[`${v.ns}|${v.key}`] = [hash(v.text), out];
      } else {
        failedAt.set(id, Date.now());
      }
    }
    persist(lang);
  } catch {
    for (const [id] of batch) failedAt.set(id, Date.now());
  } finally {
    for (const [id] of batch) inflight.delete(id);
    if (pending.size && !timer) timer = setTimeout(flush, 250);
  }
}

function flatten(obj: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'string') out[p] = v;
      else flatten(v, p, out);
    }
  }
  return out;
}

function enqueueBundleGaps(lang: string) {
  if (!i18nRef || lang === 'en') return;
  const namespaces = Object.keys((i18nRef.options.resources?.en as object) ?? {});
  for (const ns of namespaces) {
    const en = flatten(i18nRef.getResourceBundle('en', ns));
    const cur = flatten(i18nRef.getResourceBundle(lang, ns));
    for (const [key, text] of Object.entries(en)) {
      if (!(key in cur)) enqueue(lang, ns, key, text);
    }
  }
}

export function runtimeTranslationInitOptions() {
  return {
    saveMissing: true,
    saveMissingTo: 'current' as const,
    missingKeyHandler: (lngs: readonly string[], ns: string, key: string, fallbackValue: string) => {
      const lang = (lngs[0] || 'en').split('-')[0];
      if (lang === 'en') return;
      enqueue(lang, ns, key, fallbackValue);
    },
  };
}

export function installRuntimeTranslation(instance: I18n) {
  if (i18nRef) return;
  i18nRef = instance;
  const run = (lng: string) => {
    const lang = (lng || 'en').split('-')[0];
    loadCache(lang).then(() => enqueueBundleGaps(lang));
  };
  instance.on('languageChanged', run);
}
