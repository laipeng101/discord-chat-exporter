#!/usr/bin/env node
// Static locale consistency check for discord-chat-exporter.user.js.
// No runtime dependencies: Node.js >= 18 is enough.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = path.join(root, 'discord-chat-exporter.user.js');
const localesDir = path.join(root, 'docs', 'greasyfork', 'locales');
const expectedLocales = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'es', 'fr', 'de', 'pt-BR', 'ru', 'ar'];

let errors = 0;
const fail = (message) => { console.error('FAIL: ' + message); errors += 1; };
const pass = (message) => console.log('PASS: ' + message);

const placeholders = (value) => [...String(value).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

const src = fs.readFileSync(scriptPath, 'utf8');

// --- 1. Parse the translations object without executing the userscript ---
const start = src.indexOf('  const translations = {');
const end = src.indexOf('\n  };', start);
if (start < 0 || end < 0) {
  fail('translations block not found');
  process.exit(1);
}
const body = src.slice(src.indexOf('{', start) + 1, end);
let translations;
try {
  translations = new Function('"use strict"; return ({' + body + '});')();
} catch (error) {
  fail('could not parse translations: ' + error.message);
  process.exit(1);
}

// --- 2. Locale set must be exactly the 11 supported locales ---
const locales = Object.keys(translations);
const missingLocales = expectedLocales.filter((l) => !locales.includes(l));
const extraLocales = locales.filter((l) => !expectedLocales.includes(l));
if (missingLocales.length || extraLocales.length) {
  fail('locale set mismatch; missing=' + missingLocales.join(',') + ' extra=' + extraLocales.join(','));
} else {
  pass('locale set is exactly the 11 supported locales');
}

// --- 3. Key set, empty values and placeholders must match en ---
const enKeys = Object.keys(translations.en);
const enPlaceholders = Object.fromEntries(enKeys.map((k) => [k, placeholders(translations.en[k])]));

for (const locale of locales) {
  const keys = Object.keys(translations[locale]);
  const missing = enKeys.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !enKeys.includes(k));
  if (missing.length || extra.length) {
    fail(locale + ' key set mismatch; missing=' + missing.join(',') + ' extra=' + extra.join(','));
  } else {
    pass(locale + ' has all ' + enKeys.length + ' en keys');
  }

  const empty = enKeys.filter((k) => !String(translations[locale][k]).trim());
  if (empty.length) fail(locale + ' has empty values: ' + empty.join(', '));

  const phMismatch = enKeys.filter((k) => placeholders(translations[locale][k]) !== enPlaceholders[k]);
  if (phMismatch.length) fail(locale + ' placeholder mismatch: ' + phMismatch.join(', '));
}

// --- 4. No untranslated English leakage (allowed borrowed terms excepted) ---
// Cognates/borrowings that are intentionally identical to en in some locales.
const borrowedKeys = new Set(['embeds', 'stickers', 'messages', 'format', 'source', 'delayNormal']);
for (const locale of locales) {
  if (locale === 'en') continue;
  const leaks = enKeys.filter((k) => translations[locale][k] === translations.en[k] && !borrowedKeys.has(k));
  if (leaks.length) {
    fail(locale + ' has untranslated en values: ' + leaks.join(', '));
  } else {
    pass(locale + ' has no untranslated en values');
  }
}

// --- 5. Metadata locale names/descriptions ---
const metadataLocales = new Set();
for (const line of src.split('\n')) {
  const match = line.match(/^\/\/ @(?:name|description):([\w-]+)\s/);
  if (match) metadataLocales.add(match[1]);
}
const missingMeta = expectedLocales.filter((l) => l !== 'en' && !metadataLocales.has(l));
const extraMeta = [...metadataLocales].filter((l) => !expectedLocales.includes(l));
if (missingMeta.length || extraMeta.length) {
  fail('metadata locale mismatch; missing=' + missingMeta.join(',') + ' extra=' + extraMeta.join(','));
} else {
  pass('metadata has localized @name/@description for all locales');
}

// --- 6. @version must equal the VERSION constant ---
const versionMeta = src.match(/^\/\/ @version\s+([0-9]+\.[0-9]+\.[0-9]+)/m);
const versionConst = src.match(/const VERSION = '([0-9]+\.[0-9]+\.[0-9]+)'/);
if (versionMeta && versionConst && versionMeta[1] === versionConst[1]) {
  pass('@version and VERSION match (' + versionMeta[1] + ')');
} else {
  fail('@version and VERSION do not match');
}

// --- 7. Identity invariants ---
const namespace = src.match(/^\/\/ @namespace\s+(\S+)/m);
if (namespace && namespace[1] === 'https://greasyfork.org/scripts/discord-chat-exporter') {
  pass('@namespace unchanged');
} else {
  fail('@namespace changed or missing');
}

const homepage = src.match(/^\/\/ @homepageURL\s+(\S+)/m);
const support = src.match(/^\/\/ @supportURL\s+(\S+)/m);
if (homepage && homepage[1] === 'https://github.com/laipeng101/discord-chat-exporter') pass('@homepageURL correct');
else fail('@homepageURL missing or incorrect');
if (support && support[1] === 'https://github.com/laipeng101/discord-chat-exporter/issues') pass('@supportURL correct');
else fail('@supportURL missing or incorrect');

// --- 8. Additional-info file names must match the locale set ---
const files = fs.readdirSync(localesDir).filter((f) => f.endsWith('.md'));
const fileLocales = files.map((f) => f.replace(/^ADDITIONAL_INFO\./, '').replace(/\.md$/, '')).sort();
const expectedSorted = [...expectedLocales].sort();
if (fileLocales.join(',') === expectedSorted.join(',')) {
  pass('additional-info file names match the locale set');
} else {
  fail('additional-info file name mismatch; files=' + fileLocales.join(','));
}

// --- 9. Every additional-info file links the GitHub repo and issues page ---
for (const locale of expectedLocales) {
  const content = fs.readFileSync(path.join(localesDir, 'ADDITIONAL_INFO.' + locale + '.md'), 'utf8');
  if (!content.includes('https://github.com/laipeng101/discord-chat-exporter')) fail(locale + ' missing repo link');
  if (!content.includes('https://github.com/laipeng101/discord-chat-exporter/issues')) fail(locale + ' missing issues link');
}
if (errors === 0) pass('all additional-info files link the GitHub repo and issues page');

if (errors === 0) {
  console.log('\nALL CHECKS PASSED');
  process.exit(0);
}
console.error('\n' + errors + ' check(s) failed');
process.exit(1);
