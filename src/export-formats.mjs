import { archiveBootstrapSource } from './archive-viewer.mjs';
import { clean, escapeHtml } from './text.mjs';

export function createExportFormats(version, discordLabels, mediaTools) {
  const { normalizeAssetUrl, normalizeEmojiAssetUrl, mediaTypeFromUrl, mediaIdentity,
    preferMedia, mergeMedia, mergeReactions } = mediaTools;

  function reactionText(reaction) {
    if (typeof reaction === 'string') return reaction;
    const symbol = clean(reaction?.emoji || 'reaction');
    return `${symbol} × ${Math.max(1, Number(reaction?.count) || 1)}${reaction?.me ? ' ✓' : ''}`;
  }

  function textExport(messages, tr) {
    return messages.map((message) => {
      const flags = message.edited ? ` · ${tr('edited')}` : '';
      const lines = [
        `${message.timestamp} | ${message.author || '—'} | ${tr('messageId')}: ${message.id}${flags}`,
        message.text || (message.forwarded?.length ? '' : tr('emptyText'))
      ];

      if (message.reply) lines.push(`\n${tr('reply')}:\n${message.reply}`);
      if (message.forwarded?.length) lines.push(`\n${tr('forwarded')}:\n${message.forwarded.join('\n\n')}`);
      if (message.embeds.length) lines.push(`\n${tr('embeds')}:\n${message.embeds.join('\n\n')}`);
      if (message.stickers.length) lines.push(`\n${tr('stickers')}:\n${message.stickers.join('\n')}`);
      if (message.attachments.length) lines.push(`\n${tr('attachments')}:\n${message.attachments.join('\n')}`);
      if (message.reactions.length) lines.push(`\n${tr('reactions')}:\n${message.reactions.map(reactionText).join('\n')}`);
      lines.push(`\n${tr('source')}: ${message.url}`);

      return lines.join('\n');
    }).join('\n\n--------------------\n\n');
  }

  function jsonExport(messages, { route, dateRange, generatedAt, timeZone }) {
    return JSON.stringify({
      exporter: `Discord Chat Exporter ${version}`,
      generatedAt: generatedAt.toISOString(),
      localTimeZone: timeZone,
      dateRange: { start: dateRange.startDate, end: dateRange.endDate },
      channel: route ? {
        guildId: route.guildId,
        channelId: route.channelId,
        label: route.label,
        url: route.url
      } : null,
      count: messages.length,
      messages: messages.map(({ timestampMs, ...message }) => message)
    }, null, 2);
  }

  function csvCell(value) {
    const string = Array.isArray(value) ? value.join('\n') : String(value ?? '');
    return `"${string.replace(/"/g, '""')}"`;
  }

  function csvExport(messages) {
    const header = ['id', 'timestamp', 'author', 'avatar', 'edited', 'text', 'reply', 'embeds', 'stickers', 'attachments', 'media', 'reactions', 'url', 'forwarded'];
    const rows = messages.map((message) => [
      message.id, message.timestamp, message.author, message.avatar, message.edited, message.text,
      message.reply, message.embeds, message.stickers, message.attachments,
      (message.media || []).map((entry) => `[${entry.type}] ${entry.url}`), message.reactions.map(reactionText), message.url, message.forwarded
    ].map(csvCell).join(','));

    return `\uFEFF${header.map(csvCell).join(',')}\n${rows.join('\n')}`;
  }

  function buildArchiveDatabase(messages) {
    const assets = [];
    const assetLookup = new Map();
    const avatarUrls = new Map();
    const emojiUrls = new Map();
    const authors = [];
    const authorLookup = new Map();

    const assetIndex = (entry) => {
      const rawUrl = entry.url || '';
      const type = entry.type || mediaTypeFromUrl(rawUrl, 'file');
      const urlCache = type === 'avatar' ? avatarUrls : type === 'emoji' ? emojiUrls : null;
      const known = urlCache?.get(rawUrl);
      const url = known?.url ?? (type === 'emoji' ? normalizeEmojiAssetUrl(rawUrl) : normalizeAssetUrl(rawUrl));
      if (!url) return -1;
      const identity = known?.identity ?? `${mediaIdentity(url)}:${type}`;
      if (urlCache && !known) urlCache.set(rawUrl, { url, identity });
      if (assetLookup.has(identity)) {
        const existingIndex = assetLookup.get(identity);
        const existing = assets[existingIndex];
        if (existing[0] === url) return existingIndex;
        if (type === 'emoji' && /[?&]animated=true(?:&|$)/.test(url) && !/[?&]animated=true(?:&|$)/.test(existing[0])) {
          existing[0] = url;
        } else if (type !== 'emoji' && preferMedia({ url, type }, { url: existing[0], type })) {
          existing[0] = url;
        }
        return existingIndex;
      }
      const index = assets.length;
      assets.push([url, type, clean(entry.alt), normalizeAssetUrl(entry.poster || '')]);
      assetLookup.set(identity, index);
      return index;
    };

    const authorIndex = (message) => {
      const name = discordLabels.author(message.author || '—');
      const avatar = assetIndex({ url: message.avatar, type: 'avatar', alt: name });
      const identity = `${name}\u0000${avatar}`;
      if (authorLookup.has(identity)) return authorLookup.get(identity);
      const index = authors.length;
      authors.push([name, avatar]);
      authorLookup.set(identity, index);
      return index;
    };

    const rows = messages.map((message) => {
      const media = mergeMedia(
        message.media || [],
        (message.attachments || []).map((url) => ({ url, type: mediaTypeFromUrl(url, 'file'), alt: '', poster: '' }))
      );
      const parts = (message.contentParts || []).map((part) => typeof part === 'string'
        ? part
        : [clean(part.name || ':emoji:'), assetIndex({ url: part.url, type: 'emoji', alt: part.name })]
      );
      const reactions = mergeReactions(message.reactions || [], []).map((reaction) => [
        reaction.emoji,
        reaction.count,
        assetIndex({ url: reaction.url, type: 'emoji', alt: reaction.emoji }),
        reaction.me ? 1 : 0
      ]);

      return [
        message.id,
        message.timestamp,
        authorIndex(message),
        message.text || '',
        parts,
        message.reply || '',
        message.embeds || [],
        media.map(assetIndex),
        message.stickers || [],
        reactions,
        message.edited ? 1 : 0,
        message.url || '',
        message.forwarded || []
      ];
    });

    return { v: 2, a: assets, u: authors, m: rows };
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
  }

  async function encodeArchiveDatabase(database) {
    const raw = new TextEncoder().encode(JSON.stringify(database));
    let bytes = raw;
    let encoding = 'base64';

    if (typeof CompressionStream === 'function') {
      try {
        const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'));
        bytes = new Uint8Array(await new Response(stream).arrayBuffer());
        encoding = 'gzip-base64';
      } catch (_) {
        bytes = raw;
      }
    }

    return { data: bytesToBase64(bytes), encoding };
  }

  async function compactHtmlExport(messages, { route, language, tr, direction, timeZone, generatedAt, dateRange }) {
    const formattedTime = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(generatedAt);
    const payload = await encodeArchiveDatabase(buildArchiveDatabase(messages));
    const labels = JSON.stringify({
      reply: tr('reply'), forwarded: tr('forwarded'), embeds: tr('embeds'), attachments: tr('attachments'), reactions: tr('reactions'), stickers: tr('stickers'),
      emptyText: tr('emptyText'), edited: tr('edited'), source: tr('source'),
      showing: tr('showing', { visible: '__VISIBLE__', total: '__TOTAL__' }),
      loadFailed: tr('loadFailed')
    }).replace(/</g, '\\u003c');

    return `<!doctype html>
<html lang="${escapeHtml(language)}" dir="${direction}" data-labels="${escapeHtml(labels)}">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer">
  <title>${escapeHtml(route?.label || tr('title'))}</title>
  <style>
    :root{color-scheme:light dark;--bg:#f4f5f7;--surface:#fff;--surface-2:#f0f1f4;--text:#24252a;--muted:#656872;--border:#dfe1e6;--accent:#5865f2;--accent-soft:#eef0ff;--reply:#d6d9e0;--shadow:0 8px 28px #1f23290d;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--text)}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{max-width:1040px;margin:0 auto;padding:36px 20px 80px;background:var(--bg);line-height:1.5}a{color:#4752c4;text-underline-offset:2px;overflow-wrap:anywhere}button,input{font:inherit}.archive-hero{padding:28px;border:1px solid var(--border);border-radius:18px;background:linear-gradient(135deg,var(--surface),var(--accent-soft));box-shadow:var(--shadow)}.eyebrow{margin:0 0 6px;color:var(--accent);font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.archive-hero h1{margin:0;font-size:clamp(25px,4vw,38px);line-height:1.18;overflow-wrap:anywhere}.archive-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.meta-pill{padding:6px 10px;border:1px solid var(--border);border-radius:999px;background:color-mix(in srgb,var(--surface) 78%,transparent);color:var(--muted);font-size:12px}.toolbar{position:sticky;top:10px;z-index:20;display:flex;align-items:center;gap:12px;margin:18px 0;padding:10px;border:1px solid var(--border);border-radius:12px;background:color-mix(in srgb,var(--surface) 90%,transparent);box-shadow:var(--shadow);backdrop-filter:blur(12px)}.search{min-width:0;flex:1;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text);padding:9px 11px;outline:none}.search:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 20%,transparent)}.result-count{color:var(--muted);font-size:12px;white-space:nowrap}.archive-loading{padding:28px;text-align:center;color:var(--muted)}.archive-loading.error{color:#c8323d}
    .day-group{margin:24px 0}.day-divider{position:sticky;top:78px;z-index:10;display:flex;align-items:center;gap:8px;width:max-content;max-width:100%;margin:0 auto 10px;padding:5px 10px;border:1px solid var(--border);border-radius:999px;background:color-mix(in srgb,var(--surface) 92%,transparent);box-shadow:0 2px 10px #0000000a;color:var(--muted);font-size:12px;font-weight:750;backdrop-filter:blur(10px)}.day-divider small{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:var(--surface-2);font-size:10px}.day-messages{overflow:hidden;border:1px solid var(--border);border-radius:14px;background:var(--surface);box-shadow:var(--shadow)}.message{content-visibility:auto;contain-intrinsic-size:auto 140px;display:grid;grid-template-columns:40px minmax(0,1fr);gap:12px;padding:14px 16px;border-bottom:1px solid var(--border)}.message:last-child{border-bottom:0}.message:hover{background:color-mix(in srgb,var(--accent) 3%,var(--surface))}.message.compact{padding-top:8px;padding-bottom:8px}.avatar{display:grid;place-items:center;width:40px;height:40px;overflow:hidden;border-radius:50%;background:hsl(var(--author-hue) 55% 36%);color:#fff;font-size:15px;font-weight:800;box-shadow:inset 0 0 0 1px #ffffff26}.avatar-image{width:100%;height:100%;object-fit:cover}.avatar-fallback{display:grid;place-items:center;width:100%;height:100%}.message.compact .avatar{visibility:hidden}.message-content{min-width:0}.message-header{display:flex;align-items:baseline;gap:8px;min-height:22px}.message-author{font-size:14px;font-weight:760;overflow-wrap:anywhere}.message.compact .message-author{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.message-header time,.edited-badge{color:var(--muted);font-size:11px}.edited-badge{font-style:italic}.message-body{margin-top:3px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.62}.message-body.empty{color... (line truncated to 2000 chars)
    .reaction-row{display:flex;gap:5px;flex-wrap:wrap;margin-top:9px}.reaction-chip{display:inline-flex;align-items:center;gap:5px;min-height:28px;padding:3px 8px;border:1px solid var(--border);border-radius:999px;background:var(--surface-2);font-size:12px}.reaction-chip.mine{border-color:var(--accent);background:var(--accent-soft)}.reaction-icon{display:inline-flex;align-items:center}.reaction-emoji{width:18px;height:18px;object-fit:contain}.reaction-symbol{font-size:15px;line-height:1}.reaction-icon .reaction-symbol{max-width:12em;overflow:hidden;color:var(--muted);font:600 11px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;text-overflow:ellipsis;white-space:nowrap}.reaction-chip strong{font-size:11px}.media-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(250px,100%),1fr));gap:10px;margin-top:8px}.media-item{min-width:0;margin:0;padding:7px;border:1px solid var(--border);border-radius:9px;background:var(--surface)}.media-item img,.media-item video{display:block;width:100%;max-height:560px;object-fit:contain;border-radius:6px;background:#111}.media-item audio{display:block;width:100%}.media-item figcaption{margin-top:6px;color:var(--muted);font-size:10px;overflow-wrap:anywhere}.media-link{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.file-item{padding:9px;border:1px solid var(--border);border-radius:7px;background:var(--surface)}.message-footer{display:flex;align-items:center;gap:8px;margin-top:9px;opacity:.58;color:var(--muted);font-size:10px;transition:opacity .15s}.message:hover .message-footer,.message:focus-within .message-footer{opacity:1}.message-footer code{overflow:hidden;text-overflow:ellipsis}.back-top{position:fixed;right:18px;bottom:18px;padding:9px 12px;border:1px solid var(--border);border-radius:999px;background:var(--surface);box-shadow:var(--shadow);font-size:12px;text-decoration:none}[hidden]{display:none!important}
    @media(max-width:620px){body{padding:18px 8px 70px}.archive-hero{padding:20px 16px;border-radius:14px}.toolbar{top:6px}.result-count{display:none}.day-divider{top:70px}.message{grid-template-columns:34px minmax(0,1fr);gap:9px;padding:12px 10px}.avatar{width:34px;height:34px;font-size:13px}.media-grid{grid-template-columns:1fr}.message-footer{opacity:.65}}@media(prefers-color-scheme:dark){:root{--bg:#191a1e;--surface:#24262b;--surface-2:#2d3036;--text:#e4e6eb;--muted:#a7abb4;--border:#3a3d45;--accent:#8ea1e1;--accent-soft:#2b3044;--reply:#5d626d;--shadow:0 10px 34px #0004}a{color:#aab7f0}.meta-pill{background:#24262bd9}}@media print{.toolbar,.back-top{display:none}.day-divider{position:static}.message{content-visibility:visible;break-inside:avoid}.message-footer{opacity:1}body{max-width:none;padding:0}}
  </style>
</head>
<body>
  <header class="archive-hero"><p class="eyebrow">${escapeHtml(tr('archiveTitle'))}</p><h1>${escapeHtml(route?.label || tr('title'))}</h1><div class="archive-meta"><span class="meta-pill">${escapeHtml(dateRange.startDate)} — ${escapeHtml(dateRange.endDate)}</span><span class="meta-pill">${escapeHtml(tr('messageCount', { count: messages.length }))}</span><span class="meta-pill">${escapeHtml(timeZone)}</span><span class="meta-pill">${escapeHtml(formattedTime)}</span></div></header>
  <div class="toolbar" role="search"><input id="archive-search" class="search" type="search" placeholder="${escapeHtml(tr('searchPlaceholder'))}" aria-label="${escapeHtml(tr('searchPlaceholder'))}"><span id="result-count" class="result-count">${escapeHtml(tr('showing', { visible: messages.length, total: messages.length }))}</span></div>
  <main id="timeline" class="timeline"><div id="archive-loading" class="archive-loading">${escapeHtml(tr('archiveLoading'))}</div></main><a class="back-top" href="#" aria-label="${escapeHtml(tr('backToTop'))}">↑ ${escapeHtml(tr('backToTop'))}</a>
  <script id="archive-data" type="application/octet-stream" data-encoding="${payload.encoding}">${payload.data}</script>
  <script>${archiveBootstrapSource()}</script>
</body>
</html>`;
  }

  async function buildExport(format, messages, context) {
    if (format === 'json') return { content: jsonExport(messages, context), mime: 'application/json;charset=utf-8', extension: 'json' };
    if (format === 'csv') return { content: csvExport(messages), mime: 'text/csv;charset=utf-8', extension: 'csv' };
    if (format === 'html') return { content: await compactHtmlExport(messages, context), mime: 'text/html;charset=utf-8', extension: 'html' };
    return { content: textExport(messages, context.tr), mime: 'text/plain;charset=utf-8', extension: 'txt' };
  }

  return { buildExport, textExport };
}
