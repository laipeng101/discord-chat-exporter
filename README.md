# Discord Chat Exporter

Export Discord messages you can already view by date range to TXT, JSON, CSV, or a portable HTML archive.

按日期范围导出当前账号可见的 Discord 消息，支持 TXT、JSON、CSV 和可阅读的单文件 HTML 归档。

- [Install from Greasy Fork](https://greasyfork.org/scripts/592901-discord-chat-exporter-date-range-multi-language)
- [Latest GitHub Release](https://github.com/laipeng101/discord-chat-exporter/releases/latest)
- [discord-chat-exporter.user.js](discord-chat-exporter.user.js)
- License: MIT (declared in the script metadata)

## Features

- Automatic date-range collection that picks the cheaper scroll direction (up or down) based on the current viewport.
- Exports TXT, JSON, CSV, and a readable single-file HTML archive.
- Preserves available authors, avatars, message text, replies, forwarded text, embeds, attachments, stickers, emoji, and structured reactions.
- HTML archives: local-date grouping, compact consecutive posts, text/author search, and media preview.
- Reuses author/media/emoji dictionaries and compresses the embedded archive database with native gzip when supported.
- Standard emoji stored as Unicode; custom Discord emoji deduplicated by stable emoji ID with a `:name:` fallback.
- 11 interface languages.
- Works on Discord stable, PTB, and Canary.
- All chat data is processed locally in the current browser tab and never uploaded.

## Install

1. Install Tampermonkey, Violentmonkey, or a compatible userscript manager.
2. Open the script on Greasy Fork and click **Install this script**:

   <https://greasyfork.org/scripts/592901-discord-chat-exporter-date-range-multi-language>

3. Open or refresh `https://discord.com/channels/...`.

If the panel is hidden, press `Alt/Option + Shift + D` to show it again.

## Quick start

1. Open the target channel, thread, or DM in Discord Web.
2. Choose a start date, an end date, and an export format.
3. Click **Collect date range**.
4. Do not manually scroll or switch channels while automatic collection runs.
5. When it finishes, copy or download the result.
6. Press `Alt/Option + Shift + D` to show or hide the panel.

Dates use your browser's local time zone; the end date includes the whole selected day.

The exporter follows the channel in the browser address. To export a thread, open the thread as its own channel page. If Discord stops providing enough history to verify the selected range, the panel warns you and keeps the messages it has already collected available for manual export.

## Export formats

| Format | Best for |
| ------ | -------- |
| TXT | Reading / text analysis |
| JSON | Structured processing |
| CSV | Spreadsheets / data analysis |
| HTML | Browsing conversations and media |

HTML exports are single-file archives with the message data embedded. Images, avatars, and custom emoji are still loaded from remote URLs, so remote resources may become unavailable later. Standard Unicode emoji do not depend on remote images.

Forwarded text appears inside the forwarding message. In JSON, `forwarded` is an optional array of strings; CSV adds a `forwarded` column at the end.

## Languages

`English · 简体中文 · 繁體中文 · 日本語 · 한국어 · Español · Français · Deutsch · Português (Brasil) · Русский · العربية`

## Privacy & limitations

- Reads only messages the current account is allowed to see and that Discord has actually loaded.
- Does not bypass permissions or recover deleted messages.
- Automatic collection relies on Discord's current web DOM/virtual list; Discord updates may affect it.
- Does not call Discord private APIs or upload chat content.
- Remote media URLs in HTML exports may expire, be removed, or require login.

## Development / Documentation

- Run `node --check discord-chat-exporter.user.js`, `node scripts/check-locales.mjs`, and `node --test scripts/check-collection.mjs` for syntax, localization, and date traversal checks.
- With Node.js 22+ and `jsdom`, run `node scripts/check-current-dom.mjs` for the message and export fixtures. The script accepts a directory containing `jsdom` in `node_modules` as an optional argument.
- [GitHub Releases](https://github.com/laipeng101/discord-chat-exporter/releases) — version history
- [Publishing guide](docs/greasyfork/PUBLISHING_GUIDE.md) — maintainer release workflow
- [Greasy Fork localized additional info](docs/greasyfork/locales/) — multilingual description sources
- [Issues](https://github.com/laipeng101/discord-chat-exporter/issues) — bug reports and feedback

## License

MIT — see the `@license` key in [discord-chat-exporter.user.js](discord-chat-exporter.user.js).
