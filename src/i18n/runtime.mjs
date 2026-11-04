// Kept self-contained so the build can embed it in the standalone userscript.
export function createI18n(catalog) {
  const locales = Object.keys(catalog);
  const latinAmericanRegions = new Set('419 AR BO BR BZ CL CO CR CU DO EC GT HN HT MX NI PA PE PR PY SV US UY VE'.split(' '));

  function matchLocale(tag) {
    let locale;
    try {
      locale = new Intl.Locale(tag.replaceAll('_', '-'));
    } catch {
      return undefined;
    }

    const { language, script, region, baseName } = locale;
    if (language === 'zh') {
      if (script === 'Hant') return 'zh-TW';
      if (script === 'Hans') return 'zh-CN';
      return ['TW', 'HK', 'MO'].includes(region) ? 'zh-TW' : 'zh-CN';
    }
    if (language === 'pt') return 'pt-BR';
    if (language === 'es' && latinAmericanRegions.has(region)) return 'es-419';
    return [baseName, language].find((code) => locales.includes(code));
  }

  function resolveLanguage(preference, browserLanguages) {
    if (locales.includes(preference)) return preference;
    for (const tag of browserLanguages) {
      const match = matchLocale(tag);
      if (locales.includes(match)) return match;
    }
    return 'en';
  }

  function translate(locale, key, values = {}) {
    const entry = catalog[locale];
    const inherited = catalog[entry?.inherits]?.messages[key];
    const template = entry?.messages[key] ?? inherited ?? catalog.en.messages[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
  }

  return {
    locales,
    label: (locale) => catalog[locale].label,
    direction: (locale) => catalog[locale].direction ?? 'ltr',
    resolveLanguage,
    translate
  };
}
