import assert from 'node:assert/strict';
import test from 'node:test';
import { readCatalog } from './build.mjs';
import { createI18n } from '../src/i18n/runtime.mjs';

const { resolveLanguage, translate } = createI18n(readCatalog());

test('keeps a manually chosen locale and skips unsupported browser languages', () => {
  assert.equal(resolveLanguage('id', ['es-MX', 'hi-IN']), 'id');
  assert.equal(resolveLanguage('auto', ['xx', 'hi-IN', 'en']), 'hi');
  assert.equal(resolveLanguage('auto', ['in-ID']), 'id');
  assert.equal(resolveLanguage('old-preference', ['not a tag', 'xx']), 'en');
});

test('maps Spanish and Chinese variants and preserves the Brazilian Portuguese default', () => {
  for (const [tag, expected] of [
    ['es-MX', 'es-419'], ['es-AR', 'es-419'], ['es-419', 'es-419'], ['es-ES', 'es'], ['es', 'es'],
    ['zh_HK', 'zh-TW'], ['zh-Hant', 'zh-TW'], ['zh-Hans-HK', 'zh-CN'], ['zh-CN', 'zh-CN'], ['pt-PT', 'pt-BR']
  ]) {
    assert.equal(resolveLanguage('auto', [tag]), expected, tag);
  }
});

test('uses regional wording when present and inherits Spanish rather than English', () => {
  assert.match(translate('es-419', 'shortcut'), /Shift/);
  assert.match(translate('es', 'shortcut'), /Mayús/);
  assert.equal(translate('es-419', 'fetch'), 'Recopilar mensajes por fecha');
  assert.equal(translate('pl', 'messageCount', { count: 1 }), 'Liczba wiadomości: 1');
});
