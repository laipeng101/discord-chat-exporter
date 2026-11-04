#!/usr/bin/env node
// Exercise automatic collection with synthetic viewports and a virtual clock.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const src = readFileSync(new URL('../discord-chat-exporter.user.js', import.meta.url), 'utf8');
const collection = src.slice(src.indexOf('  function exportFileStem('), src.indexOf('  function clearCurrentChannel('));

function viewport({
  top = 0, height = 100, scrollHeight = 200, beginning = false, busy = false, jumpBar = false,
  firstMessageTop = 0, lastMessageBottom = 0
} = {}) {
  const moves = [];
  const scroller = {
    scrollTop: top,
    clientHeight: height,
    scrollHeight,
    getBoundingClientRect: () => ({ top: 50 }),
    getAttribute: () => null,
    parentElement: { querySelector: () => jumpBar ? {} : null },
    scrollBy({ top: distance }) {
      moves.push(distance);
      this.scrollTop = Math.max(0, Math.min(this.scrollHeight - this.clientHeight, this.scrollTop + distance));
    }
  };
  const placeholderQuery = (selector) => selector.includes('wrapper_') ? {} : null;
  const root = {
    scroller,
    firstElementChild: firstMessageTop ? {
      id: '',
      querySelector: placeholderQuery,
      nextElementSibling: {
        id: 'chat-messages-channel-selected',
        getBoundingClientRect: () => ({ top: 50 + firstMessageTop - scroller.scrollTop })
      }
    } : null,
    lastElementChild: lastMessageBottom ? {
      id: '',
      matches: () => false,
      querySelector: () => null,
      previousElementSibling: {
        id: '',
        matches: () => false,
        querySelector: placeholderQuery,
        previousElementSibling: {
          id: 'chat-messages-channel-selected',
          getBoundingClientRect: () => ({ bottom: 50 + lastMessageBottom - scroller.scrollTop })
        }
      }
    } : null,
    getAttribute: () => busy ? 'true' : null,
    querySelector: (selector) => beginning && selector.includes(':scope > div:has(> [class*="emptyChannelIcon_"])') ? {} : null
  };
  return { root, moves };
}

function harness({ bounds = { startMs: 10, endExclusiveMs: 20 }, scan, onWait, onBuild } = {}) {
  let now = 0;
  const route = { key: 'guild:channel', label: 'Test Channel', channelId: 'channel' };
  const settings = { startDate: '2026-11-01', endDate: '2026-11-02', delay: 400, format: 'html', autoDownload: true };
  const statuses = [];
  const downloads = [];
  const seen = new Map();
  let scans = 0;
  const api = {
    route,
    settings,
    statuses,
    downloads,
    get now() { return now; },
    get scans() { return scans; },
    get state() { return statuses.at(-1)?.key; }
  };
  const context = vm.createContext({
    Blob,
    URL,
    document: {
      createElement: () => ({ click() { downloads.push(this.download); }, remove() {} }),
      body: { appendChild() {} }
    },
    activeJob: null,
    elements: {},
    settings,
    clean: (text) => text,
    getRoute: () => api.route,
    getDateBounds: () => bounds,
    findScroller: (root) => root.scroller,
    performance: { now: () => now },
    setTimeout: (callback, delay) => {
      if (delay === settings.delay) {
        now += delay;
        assert.ok(now < 120000, 'collector should stop after a bounded wait');
        onWait?.(api);
      }
      callback();
    },
    setStatus: (key, values, tone) => statuses.push({ key, values, tone }),
    updateCount() {},
    scanVisible: () => {
      scans++;
      const { root, rows } = scan(api);
      for (const [id, time] of rows) seen.set(id, time);
      return {
        root,
        ids: rows.map(([id]) => id),
        minMs: rows.length ? Math.min(...rows.map(([, time]) => time)) : NaN,
        maxMs: rows.length ? Math.max(...rows.map(([, time]) => time)) : NaN
      };
    },
    selectedRecords: () => [...seen].filter(([, time]) => time >= bounds.startMs && time < bounds.endExclusiveMs),
    buildExport: async (format, messages) => {
      await onBuild?.(api);
      return { extension: format, mime: 'text/html', content: JSON.stringify(messages) };
    }
  });
  const collect = vm.runInContext(`${collection}\n({ start: startAutomaticCollection, cancel: cancelAutomaticCollection })`, context);
  return Object.assign(api, collect);
}

test('small viewports overlap and an exact start timestamp still needs an older row', async () => {
  const { root, moves } = viewport({ top: 80 });
  const app = harness({
    scan: () => ({
      root,
      rows: root.scroller.scrollTop < 80
        ? [['older', 9], ['midnight-a', 10], ['midnight-b', 10]]
        : [['midnight-b', 10], ['after', 20]]
    })
  });
  await app.start();
  assert.deepEqual(moves, [-72]);
  assert.equal(app.statuses.find(({ key }) => key === 'done').values.count, 2);
  assert.equal(app.downloads.length, 1);
});

test('pending newer history can arrive after the old edge retry window', async () => {
  const { root } = viewport({ top: 100, busy: true });
  const app = harness({
    scan: ({ now }) => ({
      root,
      rows: [['older', 9], ['selected', 15], ...(now >= 7200 ? [['after', 20]] : [])]
    })
  });
  await app.start();
  assert.equal(app.now, 7200);
  assert.equal(app.state, 'downloaded');
});

test('an unverified older edge keeps partial results without automatic download', async () => {
  const { root } = viewport();
  const app = harness({ scan: () => ({ root, rows: [['selected', 15], ['after', 20]] }) });
  await app.start();
  assert.equal(app.state, 'stalled');
  assert.equal(app.statuses.at(-1).tone, 'warning');
  assert.ok(app.now >= 12000);
  assert.deepEqual(app.downloads, []);
});

test('rearms a stalled older-page trigger with an exact pivot and reentry', async () => {
  const { root, moves } = viewport({ scrollHeight: 400, firstMessageTop: 150 });
  const positions = [];
  let loaded = false;
  const app = harness({
    scan: () => ({
      root,
      rows: [...(loaded ? [['older-page', 9]] : []), ['selected', 15], ['after', 20]]
    }),
    onWait: () => {
      positions.push(root.scroller.scrollTop);
      if (positions[0] === 250 && positions[2] === 85) loaded = true;
    }
  });
  await app.start();
  assert.deepEqual(positions, [250, 250, 85]);
  assert.deepEqual(moves, []);
  assert.equal(app.state, 'downloaded');
});

test('an unchanged boundary varies depth and holds both stages through bounded cooldowns', async () => {
  const { root, moves } = viewport({ scrollHeight: 400, firstMessageTop: 150 });
  const transitions = [];
  const app = harness({
    scan: () => ({ root, rows: [['selected', 15], ['after', 20]] }),
    onWait: ({ now }) => {
      const position = root.scroller.scrollTop;
      if (transitions.at(-1)?.position !== position) transitions.push({ position, now });
    }
  });
  await app.start();
  assert.deepEqual(transitions.map(({ position }) => position),
    [250, 85, 250, 118, 250, 70, 250, 60, 250, 54, 250, 100, 250, 85]);
  const pivotWaits = transitions.filter((_, index) => index % 2 === 0)
    .map(({ now }, index) => transitions[2 * index + 1].now - now);
  assert.deepEqual(pivotWaits, [800, 1200, 2000, 3200, 4800, 12000, 24000]);
  const approachWaits = transitions.filter((_, index) => index % 2 === 1).map(({ now }, index) => {
    const nextPivot = transitions[2 * (index + 1)];
    return nextPivot ? nextPivot.now - now : app.now - now + 400;
  });
  assert.deepEqual(approachWaits, [800, 1600, 3200, 6400, 12000, 12000, 12000]);
  assert.equal(app.now, 96000);
  assert.deepEqual(moves, []);
  assert.equal(app.state, 'stalled');
  assert.deepEqual(app.downloads, []);
});

test('reenters the exact newer-page trigger and holds while the batch loads', async () => {
  const { root, moves } = viewport({ top: 300, scrollHeight: 400, lastMessageBottom: 250, jumpBar: true });
  const positions = [];
  let loaded = false;
  const app = harness({
    scan: () => ({
      root,
      rows: [['older', 9], ['selected', 15], ...(loaded ? [['newer-page', 20]] : [])]
    }),
    onWait: () => {
      positions.push(root.scroller.scrollTop);
      if (positions[0] === 50 && positions[2] === 215 && positions[3] === 215) loaded = true;
    }
  });
  await app.start();
  assert.deepEqual(positions, [50, 50, 215, 215]);
  assert.deepEqual(moves, []);
  assert.equal(app.state, 'downloaded');
});

test('approaches the mounted oldest row directly across a long message window', async () => {
  const { root, moves } = viewport({ top: 820, scrollHeight: 1000, firstMessageTop: 150 });
  let approached = false;
  const app = harness({
    scan: () => ({
      root,
      rows: [...(approached ? [['older-page', 9]] : []), ['selected', 15], ['after', 20]]
    }),
    onWait: () => { approached = root.scroller.scrollTop === 85; }
  });
  await app.start();
  assert.equal(approached, true);
  assert.equal(app.now, 400);
  assert.deepEqual(moves, []);
  assert.equal(app.state, 'downloaded');
});

test('approaches the mounted newest row directly across a long message window', async () => {
  const { root, moves } = viewport({ top: 20, scrollHeight: 900, lastMessageBottom: 550 });
  let approached = false;
  const app = harness({
    scan: () => ({
      root,
      rows: [['older', 9], ['selected', 15], ...(approached ? [['newer-page', 20]] : [])]
    }),
    onWait: () => { approached = root.scroller.scrollTop === 515; }
  });
  await app.start();
  assert.equal(approached, true);
  assert.equal(app.now, 400);
  assert.deepEqual(moves, []);
  assert.equal(app.state, 'downloaded');
});

test('a direct edge approach still stops if the next viewport has no shared rows', async () => {
  const { root } = viewport({ top: 820, scrollHeight: 1000, firstMessageTop: 150 });
  const app = harness({
    scan: ({ now }) => ({
      root,
      rows: now ? [['older-page', 9]] : [['selected', 15], ['after', 20]]
    })
  });
  await app.start();
  assert.equal(root.scroller.scrollTop, 85);
  assert.equal(app.state, 'stalled');
  assert.deepEqual(app.downloads, []);
});

test('a channel beginning and a stable latest viewport allow automatic download', async () => {
  const { root } = viewport({ scrollHeight: 100, beginning: true });
  const app = harness({ scan: () => ({ root, rows: [['selected', 12]] }) });
  await app.start();
  assert.ok(app.now >= 4500);
  assert.deepEqual(app.downloads, ['discord-chat-Test-Channel-2026-11-01_2026-11-02.html']);
});

test('a jump-to-present marker prevents a loaded viewport from counting as latest', async () => {
  const { root } = viewport({ top: 100, jumpBar: true });
  const app = harness({ scan: () => ({ root, rows: [['older', 9], ['selected', 15]] }) });
  await app.start();
  assert.equal(app.state, 'stalled');
  assert.deepEqual(app.downloads, []);
});

test('empty mounted list gives a bounded no-messages warning', async () => {
  const { root } = viewport();
  const app = harness({ scan: () => ({ root, rows: [] }) });
  await app.start();
  assert.equal(app.state, 'noMessages');
  assert.ok(app.scans < 50);
});

test('a channel switch during an edge wait stops before the next scan', async () => {
  const { root } = viewport();
  const app = harness({
    scan: () => ({ root, rows: [['selected', 15], ['after', 20]] }),
    onWait: (api) => { api.route = { key: 'guild:other' }; }
  });
  await app.start();
  assert.equal(app.state, 'routeChanged');
  assert.equal(app.scans, 1);
  assert.deepEqual(app.downloads, []);
});

test('remount can continue when there is overlapping history', async () => {
  const first = viewport({ top: 100 });
  const second = viewport();
  const app = harness({
    scan: ({ now }) => now
      ? { root: second.root, rows: [['older', 9], ['selected', 15]] }
      : { root: first.root, rows: [['selected', 15], ['after', 20]] }
  });
  await app.start();
  assert.equal(app.state, 'downloaded');
});

test('disjoint remount cannot combine date bounds into a false completion', async () => {
  const first = viewport({ top: 100 });
  const second = viewport();
  const app = harness({
    scan: ({ now }) => now
      ? { root: second.root, rows: [['older', 9]] }
      : { root: first.root, rows: [['selected', 15], ['after', 20]] }
  });
  await app.start();
  assert.equal(app.state, 'stalled');
  assert.deepEqual(app.downloads, []);
});

test('a jump within the same list cannot combine disjoint date bounds', async () => {
  const { root } = viewport({ top: 100 });
  const app = harness({
    scan: ({ now }) => ({
      root,
      rows: now ? [['older', 9]] : [['selected', 15], ['after', 20]]
    })
  });
  await app.start();
  assert.equal(app.state, 'stalled');
  assert.equal(app.statuses.at(-1).tone, 'warning');
  assert.deepEqual(app.downloads, []);
});

test('cancellation during HTML generation prevents the pending download', async () => {
  const { root } = viewport();
  const app = harness({
    scan: () => ({ root, rows: [['older', 9], ['selected', 15], ['after', 20]] }),
    onBuild: (api) => api.cancel()
  });
  await app.start();
  assert.equal(app.state, 'cancelled');
  assert.deepEqual(app.downloads, []);
});
