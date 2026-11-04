import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { readCatalog } from './build.mjs';

const source = readFileSync(new URL('../discord-chat-exporter.user.js', import.meta.url), 'utf8');
const baselineSource = process.env.DCE_BASELINE_PATH && readFileSync(process.env.DCE_BASELINE_PATH, 'utf8');

const date = '2026-11-04';
const guildId = '1000000000000000001';
const channelId = '1000000000000000002';
const otherChannelId = '1000000000000000003';
const firstSnowflake = BigInt(new Date(2026, 10, 4, 12).getTime() - 1420070400000) << 22n;
const ids = Object.fromEntries([
  'head', 'continuation', 'sameName', 'orphan', 'attachment', 'reply', 'forward',
  'forwardOnly', 'reactions', 'otherChannel', 'quoted', 'missingHead'
].map((name, index) => [name, String(firstSnowflake + BigInt(index))]));

const firstAvatar = 'https://cdn.discordapp.com/avatars/1000000000000000004/first.png';
const secondAvatar = 'https://cdn.discordapp.com/avatars/1000000000000000005/second.png';
const quotedAvatar = 'https://cdn.discordapp.com/avatars/1000000000000000006/quoted.png';
const filePath = `/attachments/${channelId}/1000000000000000007/picture.png`;
const originalUrl = `https://cdn.discordapp.com${filePath}?ex=7fffffff&is=60000000&hm=old-signature`;
const renewedUrl = `https://cdn.discordapp.com${filePath}?ex=8fffffff&is=70000000&hm=new-signature`;
const thumbnailUrl = `https://media.discordapp.net${filePath}?ex=7fffffff&is=60000000&hm=old-signature&width=640`;
const forwardedText = 'Forwarded fixture body';

function content(id, body) {
  return `<div id="message-content-${id}" class="markup_x">${body}</div>`;
}

function username(id, name, avatar) {
  return `<img class="avatar_x" src="${avatar}" alt=""><h3><span id="message-username-${id}" class="username_x">${name}</span></h3>`;
}

function row(id, body, { channel = channelId, group = id } = {}) {
  return `<li id="chat-messages-${channel}-${id}">
    <div role="article" aria-labelledby="message-username-${group} message-content-${id}">${body}</div>
  </li>`;
}

function accessories(id, body) {
  return `<div id="message-accessories-${id}">${body}</div>`;
}

function forwardedCard(id, body) {
  return accessories(id, `<div class="forwardedContainer_x"><div class="headerContainer_x">Forwarded</div>${content(id, body)}</div>`);
}

function messageList(rows) {
  return `<div class="scroller_x" style="overflow-y:auto"><ol role="list" data-list-id="chat-messages">${rows}</ol></div>`;
}

function fixture({ withOtherList, rows }) {
  const targetRows = rows ?? [
    row(ids.head, username(ids.head, 'Same Name', firstAvatar) + content(ids.head, 'First group')),
    row(ids.continuation, content(ids.continuation, 'Grouped continuation'), { group: ids.head }),
    row(ids.sameName, username(ids.sameName, 'Same Name', secondAvatar) + content(ids.sameName, 'Second group')),
    row(ids.orphan, content(ids.orphan, 'Group head outside the loaded window'), { group: ids.missingHead }),
    row(ids.attachment, accessories(ids.attachment,
      `<a id="original-file" href="${originalUrl}"><img src="${thumbnailUrl}" alt="Test attachment"></a>`)),
    row(ids.reply, `<div class="repliedMessage_x"><img class="avatar_x" src="${quotedAvatar}" alt="">
      ${content(ids.quoted, 'Quoted fixture body')}</div>${content(ids.reply, 'Reply fixture body')}`),
    row(ids.forward, content(ids.forward, 'My own note') + forwardedCard(ids.forward, forwardedText)),
    row(ids.forwardOnly, forwardedCard(ids.forwardOnly, 'Snapshot without a separate body')),
    row(ids.reactions, content(ids.reactions, 'Reaction fixture body') + accessories(ids.reactions,
      `<div id="message-reactions-${ids.reactions}" class="reactions_x">
        <div class="reactionInner_x" role="button" aria-pressed="true">
          <img class="emoji" alt="👍"><span class="reactionCount_x">3</span>
        </div>
        <div class="reactionInner_x" role="checkbox" aria-checked="true">
          <img class="emoji" alt="🎉"><span class="reactionCount_x">5</span>
        </div>
        <div class="reaction__x reactionInner_x">
          <img class="emoji" alt="🔥"><span class="reactionCount_x">2</span>
        </div>
        <button class="reaction_x" aria-label="Add Reaction"></button>
      </div>`))
  ].join('');

  const foreignRows = row(ids.otherChannel, content(ids.otherChannel, 'Unrelated channel'), { channel: otherChannelId });
  return `<!doctype html><html lang="en"><title>Discord | #fixture</title><body><main>
    ${withOtherList ? messageList(foreignRows) : ''}${messageList(targetRows)}
  </main></body></html>`;
}

function installBlobApis(window) {
  Object.assign(window, { Blob, CompressionStream, DecompressionStream, Response, TextDecoder, TextEncoder });
}

function openFixture(t, { withOtherList = false, rows, startDate = date, script = source, freezeClock = false } = {}) {
  const dom = new JSDOM(fixture({ withOtherList, rows }), {
    url: `https://discord.com/channels/${guildId}/${channelId}`,
    runScripts: 'outside-only',
    beforeParse(window) {
      installBlobApis(window);
      if (freezeClock) {
        window.Date = class extends window.Date {
          constructor(...args) {
            super(...(args.length ? args : ['2026-11-04T12:00:00.000Z']));
          }
        };
      }
    }
  });
  const { window } = dom;
  t.after(() => {
    window.__discordChatExporter?.destroy();
    window.close();
  });

  window.localStorage.setItem('discord-chat-exporter:settings:v1', JSON.stringify({
    language: 'en', startDate, endDate: date
  }));
  window.eval(script);

  const api = window.__discordChatExporter;
  const getRecord = (id) => api.messages().find((record) => record.id === id);
  return { window, api, getRecord };
}

test('isolates the active channel and uses message rows even when they have no text', (t) => {
  const { api, getRecord } = openFixture(t, { withOtherList: true });

  assert.deepEqual(Array.from(api.messages(), (record) => record.id), [
    ids.head, ids.continuation, ids.sameName, ids.orphan, ids.attachment, ids.reply, ids.forward, ids.forwardOnly, ids.reactions
  ]);
  const attachment = getRecord(ids.attachment);
  assert.equal(attachment.text, '');
  assert.deepEqual(Array.from(attachment.attachments), [originalUrl]);
  assert.equal(getRecord(ids.reply).text, 'Reply fixture body');
  assert.match(getRecord(ids.reply).reply, /Quoted fixture body/);
});

test('excludes the channel welcome card while retaining the list and system messages', (t) => {
  const welcomeCard = `<div id="chat-messages-${channelId}-${channelId}">
    <div class="emptyChannelIcon__00de6 emptyChannelIconComponent__00de6"></div><h3>Welcome to #fixture</h3>
  </div>`;
  const { api } = openFixture(t, { withOtherList: true, rows: welcomeCard, startDate: '2020-01-01' });
  const { root, ids: welcomeIds } = api.scan();
  assert.equal(root.firstElementChild.id, `chat-messages-${channelId}-${channelId}`);
  assert.equal(welcomeIds.length, 0);
  assert.equal(api.count(), 0);

  // A real system message may use a canonical row without an article wrapper.
  root.insertAdjacentHTML('beforeend', `<li id="chat-messages-${channelId}-${ids.head}">
    ${content(ids.head, 'A message was pinned')}
  </li>`);
  assert.deepEqual(Array.from(api.scan().ids), [ids.head]);
  assert.equal(api.messages()[0].text, 'A message was pinned');

  // In a thread the starter's real message ID can equal the thread ID.
  root.firstElementChild.outerHTML = row(channelId, content(channelId, 'Thread starter'));
  assert.deepEqual(Array.from(api.scan().ids), [channelId, ids.head]);
  assert.equal(api.messages()[0].text, 'Thread starter');
});

test('keeps authors tied to their group and ignores an avatar in a quoted reply', (t) => {
  const { getRecord } = openFixture(t);
  assert.equal(getRecord(ids.head).avatar, firstAvatar);
  assert.equal(getRecord(ids.continuation).author, 'Same Name');
  assert.equal(getRecord(ids.continuation).avatar, firstAvatar);
  assert.equal(getRecord(ids.sameName).avatar, secondAvatar);
  assert.equal(getRecord(ids.orphan).author, '');
  assert.equal(getRecord(ids.orphan).avatar, '');
  assert.equal(getRecord(ids.reply).avatar, '');
});

test('combines role-based and plain reaction widgets without the add control', (t) => {
  const { getRecord } = openFixture(t);
  const reactions = Array.from(getRecord(ids.reactions).reactions, ({ emoji, count, me }) => [emoji, count, me]);
  assert.deepEqual(reactions, [['👍', 3, true], ['🎉', 5, true], ['🔥', 2, false]]);
});

test('keeps the renewed original attachment URL and its signature', (t) => {
  const { window, api, getRecord } = openFixture(t);
  assert.equal(getRecord(ids.attachment)?.attachments[0], originalUrl);
  const link = window.document.getElementById('original-file');
  link.href = renewedUrl;
  api.scan();
  assert.deepEqual(Array.from(getRecord(ids.attachment).attachments), [renewedUrl]);
  assert.deepEqual(Array.from(getRecord(ids.attachment).media, (entry) => entry.url), [renewedUrl]);

  // A stale DOM update must not replace a previously observed newer signature.
  link.href = originalUrl;
  api.scan();
  assert.equal(getRecord(ids.attachment).attachments[0], renewedUrl);
});

test('scans message changes and replacement lists while ignoring unrelated DOM churn', async (t) => {
  const { window, api, getRecord } = openFixture(t);
  const { document } = window;
  const timers = new Map();
  let timerId = 0;
  window.setTimeout = (callback) => {
    timers.set(++timerId, callback);
    return timerId;
  };
  window.clearTimeout = (id) => timers.delete(id);
  const flushScans = async (count) => {
    await Promise.resolve();
    assert.equal(timers.size, count);
    for (const callback of [...timers.values()]) callback();
  };

  document.body.appendChild(document.createElement('aside'));
  await flushScans(0);
  document.getElementById(`message-content-${ids.head}`).textContent = 'New message text';
  await flushScans(1);
  assert.equal(getRecord(ids.head).text, 'New message text');

  document.getElementById(`message-content-${ids.head}`).firstChild.data = 'Edited in place';
  document.getElementById('original-file').href = renewedUrl;
  document.querySelector('[aria-checked="true"]').setAttribute('aria-checked', 'false');
  await flushScans(1);
  assert.equal(getRecord(ids.head).text, 'Edited in place');
  assert.equal(getRecord(ids.attachment).attachments[0], renewedUrl);
  assert.equal(getRecord(ids.reactions).reactions.find(({ emoji }) => emoji === '🎉').me, false);

  const image = document.querySelector('#original-file img');
  image.srcset = thumbnailUrl;
  api.scan();
  image.dispatchEvent(new window.Event('load'));
  await flushScans(1);

  const root = document.querySelector('[data-list-id="chat-messages"]');
  root.outerHTML = `<ol role="list" data-list-id="chat-messages">${row(ids.head, content(ids.head, 'Remounted'))}</ol>`;
  await flushScans(1);
  assert.equal(getRecord(ids.head).text, 'Remounted');

  document.getElementById(`message-content-${ids.head}`).textContent = 'Scanned explicitly';
  api.scan();
  await flushScans(0);
  assert.equal(getRecord(ids.head).text, 'Scanned explicitly');
});

test('keeps range counts and grouped authors across rescans, date changes, and clear', (t) => {
  const before = String(firstSnowflake - (86400000n << 22n));
  const { window, api, getRecord } = openFixture(t, {
    rows: row(before, username(before, 'Earlier author', firstAvatar) + content(before, 'Older')) +
      row(ids.continuation, content(ids.continuation, 'Continuation'), { group: before })
  });
  assert.equal(api.count(), 1);
  assert.equal(getRecord(ids.continuation).author, 'Earlier author');

  const root = window.document.querySelector('[data-list-id="chat-messages"]');
  root.insertAdjacentHTML('beforeend', row(ids.head, content(ids.head, 'New row')));
  api.scan();
  api.scan();
  assert.equal(api.count(), 2);

  const panel = window.document.getElementById('discord-chat-exporter-host').shadowRoot;
  const start = panel.querySelector('.start-date');
  start.value = '2026-11-03';
  start.dispatchEvent(new window.Event('change'));
  assert.equal(api.count(), 3);
  window.confirm = () => true;
  panel.querySelector('.clear').click();
  assert.equal(api.count(), 0);
});

async function exportFormat({ window, api }, format) {
  const selector = window.document.getElementById('discord-chat-exporter-host').shadowRoot.querySelector('.format');
  selector.value = format;
  selector.dispatchEvent(new window.Event('change'));
  let blob;
  window.URL.createObjectURL = (file) => {
    blob = file;
    return 'blob:https://discord.com/test-download';
  };
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () {
    assert.equal(this.download, `discord-chat-#fixture-${date}_${date}.${format}`);
  };
  assert.equal(await api.download(), true);
  assert.ok(blob, `Expected a ${format} download`);
  return blob.text();
}

test('matches the baseline in all four formats and both HTML encodings', { skip: !baselineSource }, async (t) => {
  const baseline = openFixture(t, { script: baselineSource, freezeClock: true });
  const candidate = openFixture(t, { freezeClock: true });
  assert.deepEqual(Object.keys(candidate.api), Object.keys(baseline.api));
  assert.equal(JSON.stringify(candidate.api.messages()), JSON.stringify(baseline.api.messages()));

  for (const format of ['txt', 'csv', 'json', 'html']) {
    const actual = await exportFormat(candidate, format);
    let expected = await exportFormat(baseline, format);
    if (format === 'json') {
      const baselineExporter = `Discord Chat Exporter ${baseline.api.version}`;
      const candidateExporter = `Discord Chat Exporter ${candidate.api.version}`;
      assert.equal(JSON.parse(expected).exporter, baselineExporter);
      assert.equal(JSON.parse(actual).exporter, candidateExporter);
      expected = expected.replace(
        `"exporter": ${JSON.stringify(baselineExporter)}`,
        () => `"exporter": ${JSON.stringify(candidateExporter)}`
      );
    }
    assert.equal(actual, expected);
  }
  candidate.window.CompressionStream = undefined;
  baseline.window.CompressionStream = undefined;
  assert.equal(await exportFormat(candidate, 'html'), await exportFormat(baseline, 'html'));
});

test('cancelling automatic HTML export before the archive is ready prevents the download', async (t) => {
  const before = String(firstSnowflake - (86400000n << 22n));
  const after = String(firstSnowflake + (86400000n << 22n));
  const app = openFixture(t, {
    rows: row(before, content(before, 'Older boundary')) +
      row(ids.head, content(ids.head, 'In range')) + row(after, content(after, 'Newer boundary'))
  });
  const { api, window } = app;
  const scroller = window.document.querySelector('.scroller_x');
  Object.defineProperties(scroller, { clientHeight: { value: 500 }, scrollHeight: { value: 1000 } });
  const panel = window.document.getElementById('discord-chat-exporter-host').shadowRoot;
  for (const [selector, property, value] of [['.format', 'value', 'html'], ['.auto-download', 'checked', true]]) {
    const input = panel.querySelector(selector);
    input[property] = value;
    input.dispatchEvent(new window.Event('change'));
  }
  let compressed = false;
  window.CompressionStream = class extends CompressionStream {
    constructor(format) {
      super(format);
      compressed = true;
      api.cancel();
    }
  };
  window.HTMLAnchorElement.prototype.click = () => assert.fail('cancelled run downloaded a file');
  await api.start();
  assert.ok(compressed);
  assert.equal(panel.querySelector('.status').dataset.tone, 'warning');
  assert.equal(panel.querySelector('.status').textContent, readCatalog().en.messages.cancelled);
});

test('selects every locale in the installed panel and uses it in the exported archive', async (t) => {
  const app = openFixture(t);
  const { window } = app;
  const panel = window.document.getElementById('discord-chat-exporter-host').shadowRoot;
  const catalog = readCatalog();
  const selectLanguage = (code) => {
    const select = panel.querySelector('.language');
    select.value = code;
    select.dispatchEvent(new window.Event('change'));
  };
  assert.deepEqual(Array.from(panel.querySelectorAll('.language option'), ({ value }) => value), ['auto', ...Object.keys(catalog)]);
  for (const [code, entry] of Object.entries(catalog)) {
    selectLanguage(code);
    assert.equal(panel.querySelector('.panel').lang, code);
    assert.equal(panel.querySelector('.panel').dir, entry.direction ?? 'ltr');
    assert.equal(panel.querySelector('.fetch').textContent, entry.messages.fetch ?? catalog[entry.inherits].messages.fetch);
  }
  for (const code of ['es-419', 'ar', 'hi']) {
    selectLanguage(code);
    const archive = new JSDOM(await exportFormat(app, 'html'));
    t.after(() => archive.window.close());
    const { document } = archive.window;
    const { lang, dir, dataset } = document.documentElement;
    assert.equal(lang, code);
    assert.equal(dir, catalog[code].direction ?? 'ltr');
    assert.equal(JSON.parse(dataset.labels).forwarded, (catalog[code].inherits ? catalog.es : catalog[code]).messages.forwarded);
    assert.match(document.getElementById('result-count').textContent, /\d/);
  }
  assert.match(await exportFormat(app, 'txt'), /फ़ॉरवर्ड किया गया मैसेज/);
});

test('exports forwarded text in TXT, CSV, JSON and the rendered HTML archive', async (t) => {
  const app = openFixture(t);
  const { getRecord } = app;
  assert.deepEqual(Array.from(getRecord(ids.forward).forwarded), [forwardedText]);
  assert.equal(getRecord(ids.forward).text, 'My own note');
  assert.deepEqual(Array.from(getRecord(ids.forwardOnly).forwarded), ['Snapshot without a separate body']);
  assert.equal(getRecord(ids.forwardOnly).text, '');

  const txt = await exportFormat(app, 'txt');
  assert.match(txt, /My own note/);
  assert.match(txt, /Forwarded fixture body/);
  const csv = await exportFormat(app, 'csv');
  const [header] = csv.split('\n');
  assert.ok(header.includes('"forwarded"'));
  assert.match(csv, /Forwarded fixture body/);
  const json = JSON.parse(await exportFormat(app, 'json'));
  assert.equal(json.exporter, `Discord Chat Exporter ${app.api.version}`);
  assert.deepEqual(json.messages.find((record) => record.id === ids.forward).forwarded, [forwardedText]);

  const html = await exportFormat(app, 'html');
  const archive = new JSDOM(html, { runScripts: 'dangerously', beforeParse: installBlobApis });
  t.after(() => archive.window.close());
  const timeline = archive.window.document.getElementById('timeline');
  await new Promise((resolve) => {
    if (!timeline.querySelector('#archive-loading:not(.error)')) {
      resolve();
      return;
    }
    const observer = new archive.window.MutationObserver(() => {
      if (timeline.querySelector('#archive-loading:not(.error)')) return;
      observer.disconnect();
      clearTimeout(timeout);
      resolve();
    });
    const timeout = setTimeout(() => {
      observer.disconnect();
      resolve();
    }, 1500);
    observer.observe(timeline, { childList: true, subtree: true, attributes: true });
  });
  const renderedMessage = Array.from(timeline.querySelectorAll('article')).find((article) => article.textContent.includes(ids.forward));
  assert.ok(renderedMessage, timeline.textContent);
  assert.match(renderedMessage.textContent, /My own note/);
  assert.match(renderedMessage.textContent, /Forwarded fixture body/);
});
