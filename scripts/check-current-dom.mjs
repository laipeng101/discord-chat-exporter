// Run with Node.js and jsdom. To keep dependencies outside the repository:
// npm install --prefix <temp-directory> --no-package-lock jsdom
// node scripts/check-current-dom.mjs <temp-directory>
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';

const require = createRequire(process.argv[2] ? resolve(process.argv[2], 'package.json') : import.meta.url);
const { JSDOM } = require('jsdom');
const source = readFileSync(new URL('../discord-chat-exporter.user.js', import.meta.url), 'utf8');

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

function fixture({ withOtherList }) {
  const targetRows = [
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

function openFixture(t, { withOtherList = false } = {}) {
  const dom = new JSDOM(fixture({ withOtherList }), {
    url: `https://discord.com/channels/${guildId}/${channelId}`,
    runScripts: 'outside-only',
    beforeParse: installBlobApis
  });
  const { window } = dom;
  t.after(() => window.close());

  window.localStorage.setItem('discord-chat-exporter:settings:v1', JSON.stringify({
    language: 'en', startDate: date, endDate: date
  }));
  window.eval(source);

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
  window.HTMLAnchorElement.prototype.click = () => {};
  assert.equal(await api.download(), true);
  assert.ok(blob, `Expected a ${format} download`);
  return blob.text();
}

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
