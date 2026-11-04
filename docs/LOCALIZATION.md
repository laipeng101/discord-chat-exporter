# Localizing Discord Chat Exporter

- `src/i18n/locales/<tag>.json` is the source for each locale. It contains the language's own name (`label`), Greasy Fork metadata (`name`, `description`), and interface, TXT and HTML labels (`messages`). English defines the required message keys. A regional variant can inherit its base language and provide only the wording that differs.
- `src/i18n/runtime.mjs` handles language selection and placeholders. Prefer canonical language tags. Regional matching is needed only where the same language has separate supported variants.
- `docs/greasyfork/locales/ADDITIONAL_INFO.<tag>.md` holds the public listing. Use the exact translated label of the collection button in the usage steps. New languages need a corresponding Markdown sync URL in [the Greasy Fork publishing guide](greasyfork/PUBLISHING_GUIDE.md).
- `src/discord-dom-labels.mjs` deals with accessibility labels emitted by Discord. Add patterns only when backed by observed Discord markup. It is independent of the language that the user chooses for the exporter.

Write for the place where each line appears. Use short action labels, tell the reader what happened and what they can do next, and look up Discord's own terminology for features such as channels, replies, and forwarding. A technical term such as “embed” can be described as “link previews and cards” when the UI shows those items. Avoid exposing scrolling internals or browser errors in status text. Keep placeholders such as `{count}` intact and check wording at 0, 1, and more than 1; a label with a count works well where an inflected noun would otherwise be needed.

Run `node scripts/build.mjs` and `node scripts/check-locales.mjs` before publishing. Include the regenerated `discord-chat-exporter.user.js` with its source changes. It installs as a single file and does not load translation files at runtime.
