#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildUserscript, readCatalog } from './build.mjs';

const root = new URL('../', import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8').replaceAll('\r\n', '\n');
const catalog = readCatalog();
const codes = Object.keys(catalog);
const base = catalog.en.messages;
const keys = Object.keys(base).sort();
const localeDocs = 'docs/greasyfork/locales/';
const repo = 'https://github.com/laipeng101/discord-chat-exporter';
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
// Same spelling in both languages; keep these exceptions specific to the locale and key.
const sharedWords = new Set([
  'de:format', 'fr:format', 'fr:stickers', 'es:stickers', 'es-419:stickers',
  ...['de', 'es', 'es-419', 'fr', 'id', 'pt-BR', 'tr'].map((code) => code + ':delayNormal')
]);

assert.equal(catalog.en.name, 'Discord Chat Exporter - Date Range & Multi-language');
assert.equal(new Set(codes.map((code) => catalog[code].label)).size, codes.length, 'Duplicate language labels');
assert.deepEqual(
  fs.readdirSync(new URL(localeDocs, root)).filter((file) => file.endsWith('.md')).sort(),
  codes.map((code) => `ADDITIONAL_INFO.${code}.md`).sort(),
  'Each catalog needs a Greasy Fork listing'
);

for (const code of codes) {
  const entry = catalog[code];
  const locale = new Intl.Locale(code);
  assert.equal(locale.baseName, code, 'Use canonical locale tags');
  assert.ok(typeof entry.label === 'string' && entry.label.trim(), `${code}: missing display label`);
  assert.ok([undefined, 'ltr', 'rtl'].includes(entry.direction), `${code}: invalid text direction`);
  if (entry.inherits) {
    assert.equal(entry.inherits, locale.language, `${code}: only the base language can be inherited`);
    assert.notEqual(entry.inherits, code, `${code}: cannot inherit itself`);
    assert.ok(catalog[entry.inherits] && !catalog[entry.inherits].inherits, `${code}: invalid parent locale`);
  }
  const effective = { ...catalog[entry.inherits]?.messages, ...entry.messages };
  assert.deepEqual(Object.keys(effective).sort(), keys, `${code}: message keys differ from English`);
  for (const [key, text] of Object.entries(effective)) {
    const id = `${code}:${key}`;
    assert.ok(typeof text === 'string' && text.trim(), `${id}: missing text`);
    assert.deepEqual(placeholders(text), placeholders(base[key]), `${id}: placeholder mismatch`);
    if (code !== 'en' && !sharedWords.has(id)) {
      assert.notEqual(text, base[key], `${id}: untranslated English text`);
    }
  }
  const listing = read(localeDocs + `ADDITIONAL_INFO.${code}.md`);
  assert.ok(listing.includes('**' + effective.fetch + '**'), `${code}: listing must use the exact collection button label`);
  for (const url of [repo, repo + '/issues']) {
    assert.ok(listing.includes('](' + url + ')'), `${code}: listing missing ${url}`);
  }
}

const script = read('discord-chat-exporter.user.js');
assert.equal(script, buildUserscript(catalog), 'The installable script is out of date. Run node scripts/build.mjs.');
for (const [key, value] of Object.entries({
  namespace: 'https://greasyfork.org/scripts/discord-chat-exporter',
  homepageURL: repo,
  supportURL: repo + '/issues'
})) {
  assert.equal(script.match(new RegExp('^// @' + key + '\\s+(\\S+)$', 'm'))?.[1], value);
}
console.log(`Checked ${codes.length} locales, ${keys.length} messages per locale, Greasy Fork listings, and the standalone build.`);
