/**
 * Service-worker lifecycle simulation using Node's vm and in-memory CacheStorage.
 * These checks execute the real sw.js handlers and read real project assets.
 * They do not replace HTTPS browser/device testing of installation or eviction.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const projectRoot = new URL('../', import.meta.url);
const source = await readFile(new URL('sw.js', projectRoot), 'utf8');
const siteRoot = 'https://example.github.io/stack-deck/';

function cacheKey(request, ignoreSearch = false) {
  const url = new URL(typeof request === 'string' ? request : request.url);
  if (ignoreSearch) url.search = '';
  url.hash = '';
  return url.href;
}

function makeWorker() {
  const handlers = new Map();
  const stores = new Map();
  const installedURLs = [];
  let claimed = false;
  let networkRequests = 0;

  class MemoryCache {
    entries = new Map();
    async addAll(urls) {
      const downloaded = await Promise.all(urls.map(async url => {
        assert.ok(url.startsWith(siteRoot), `asset escaped the project path: ${url}`);
        const relativePath = url.slice(siteRoot.length) || 'index.html';
        const bytes = await readFile(new URL(relativePath, projectRoot));
        return [url, new Response(bytes)];
      }));
      for (const [url, response] of downloaded) this.entries.set(url, response);
      installedURLs.push(...urls);
    }
    async match(request, {ignoreSearch = false} = {}) {
      const key = cacheKey(request, ignoreSearch);
      const entry = [...this.entries].find(([url]) => cacheKey(url, ignoreSearch) === key);
      return entry?.[1].clone();
    }
  }

  const cacheStorage = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new MemoryCache());
      return stores.get(name);
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };

  vm.runInNewContext(source, {
    URL,
    caches: cacheStorage,
    fetch: async () => {
      networkRequests++;
      throw new TypeError('Simulated offline network');
    },
    self: {
      location: `${siteRoot}sw.js`,
      addEventListener: (name, handler) => handlers.set(name, handler),
      clients: {claim: async () => { claimed = true; }},
    },
  }, {filename: 'sw.js'});

  return {
    cacheStorage,
    installedURLs,
    get networkRequests() { return networkRequests; },
    get claimed() { return claimed; },
    async lifecycle(name) {
      const pending = [];
      assert.ok(handlers.has(name), `missing ${name} handler`);
      handlers.get(name)({waitUntil: promise => pending.push(promise)});
      assert.ok(pending.length > 0, `${name} must keep its async work alive`);
      await Promise.all(pending);
    },
    async request(url, {method = 'GET', mode = 'cors'} = {}) {
      let result;
      let handled = false;
      handlers.get('fetch')({
        request: {url, method, mode},
        respondWith: promise => { handled = true; result = promise; },
      });
      return {handled, response: handled ? await result : undefined};
    },
  };
}

test('installation caches existing assets entirely within the GitHub project subpath', async () => {
  const worker = makeWorker();
  await worker.lifecycle('install');
  const names = await worker.cacheStorage.keys();
  assert.equal(names.length, 1);
  assert.ok(names[0].startsWith('stack-deck:/stack-deck/:'), 'cache must be scoped to this repository');
  assert.equal(new Set(worker.installedURLs).size, worker.installedURLs.length);
  for (const required of ['', 'index.html', 'app.js', 'deck.js', 'styles.css', 'data/cards.json', 'manifest.webmanifest']) {
    assert.ok(worker.installedURLs.includes(`${siteRoot}${required}`), `missing offline asset: ${required}`);
  }
  const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', projectRoot), 'utf8'));
  for (const icon of manifest.icons) {
    assert.ok(worker.installedURLs.includes(new URL(icon.src, siteRoot).href), `manifest icon not cached: ${icon.src}`);
  }
  assert.equal(worker.networkRequests, 0);
});

test('cached navigation, cards and assets work offline under /stack-deck/', async () => {
  const worker = makeWorker();
  await worker.lifecycle('install');
  await worker.lifecycle('activate');
  assert.equal(worker.claimed, true);
  for (const path of ['', 'index.html', '?from=homescreen']) {
    const result = await worker.request(`${siteRoot}${path}`, {mode: 'navigate'});
    assert.equal(result.handled, true);
    assert.match(await result.response.text(), /<title>Stack Deck/);
  }
  const cards = await worker.request(`${siteRoot}data/cards.json`);
  const catalogue = await cards.response.json();
  assert.ok(catalogue.cards.length > 0);
  const app = await worker.request(`${siteRoot}app.js?version=test`);
  assert.match(await app.response.text(), /function advance\(/);
  const stylesheet = await worker.request(`${siteRoot}styles.css`);
  assert.match(await stylesheet.response.text(), /\.category-card/);
  assert.equal(worker.networkRequests, 0, 'cached resources should not require a live connection');
});

test('project-root navigation falls back to cached index when its root entry is absent', async () => {
  const worker = makeWorker();
  await worker.lifecycle('install');
  const [name] = await worker.cacheStorage.keys();
  const cache = await worker.cacheStorage.open(name);
  cache.entries.delete(siteRoot);
  const result = await worker.request(`${siteRoot}?from=shortcut`, {mode: 'navigate'});
  assert.equal(result.handled, true);
  assert.match(await result.response.text(), /<title>Stack Deck/);
  assert.equal(worker.networkRequests, 1, 'the failing network request should use the offline index fallback');
});

test('sibling apps, other origins and non-GET requests are left untouched', async () => {
  const worker = makeWorker();
  await worker.lifecycle('install');
  const cases = [
    ['https://example.github.io/another-app/app.js', {}],
    ['https://example.github.io/stack-deck-other/index.html', {mode: 'navigate'}],
    ['https://example.github.io/', {mode: 'navigate'}],
    ['https://elsewhere.example/stack-deck/index.html', {}],
    [`${siteRoot}data/cards.json`, {method: 'POST'}],
  ];
  for (const [url, options] of cases) {
    const result = await worker.request(url, options);
    assert.equal(result.handled, false, `worker intercepted an unrelated request: ${url}`);
  }
  assert.equal(worker.networkRequests, 0);
});

test('activation deletes old own-scope caches and preserves every other app cache', async () => {
  const worker = makeWorker();
  await worker.lifecycle('install');
  const [current] = await worker.cacheStorage.keys();
  const oldOwn = 'stack-deck:/stack-deck/:older-version';
  const unrelated = [
    'stack-deck:/another-app/:v1',
    'stack-deck:/stack-deck/child/:v1',
    'stack-deck:/stack-deck-other/:v1',
    'another-app-cache',
  ];
  for (const name of [oldOwn, ...unrelated]) await worker.cacheStorage.open(name);
  await worker.lifecycle('activate');
  assert.deepEqual(new Set(await worker.cacheStorage.keys()), new Set([current, ...unrelated]));
  assert.equal(worker.claimed, true);
});
