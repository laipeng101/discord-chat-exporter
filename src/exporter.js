/*
 * Discord Chat Exporter
 *
 * Privacy model:
 * - Reads only message elements already rendered in the current Discord tab.
 * - Does not call Discord's private API and does not send data anywhere.
 * - Automatic collection scrolls the current channel, so avoid interacting with
 *   the message list until the run finishes or is cancelled.
 *
 * Shortcut: Alt/Option + Shift + D toggles the panel.
 */

(() => {
  'use strict';

  const GLOBAL_KEY = '__discordChatExporter';
  const STORAGE_KEY = 'discord-chat-exporter:settings:v1';
  const DISCORD_EPOCH = 1420070400000n;
  const PANEL_ID = 'discord-chat-exporter-host';
  const CHANNEL_WELCOME_SELECTOR = 'div:has(> [class*="emptyChannelIcon_"])';

  if (window[GLOBAL_KEY]?.destroy) {
    window[GLOBAL_KEY].destroy();
  }

  /* @bundle */
  const discordLabels = createDiscordLabelParser(clean);
  const records = new Map();
  let settings = loadSettings();
  let host = null;
  let shadow = null;
  let elements = {};
  let observer = null;
  let scanTimer = null;
  let activeJob = null;
  let lastStatus = { key: 'idle', values: {} };
  let isMinimized = false;

  function todayString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function loadSettings() {
    const defaults = {
      language: 'auto', startDate: todayString(), endDate: todayString(),
      format: 'txt', delay: 700, autoDownload: false
    };

    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { ...defaults, ...parsed };
    } catch (_) {
      return defaults;
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (_) {
      // Discord may block storage in hardened browser configurations.
    }
  }

  function resolveLanguage() {
    return i18n.resolveLanguage(settings.language, [...(navigator.languages || []), navigator.language]);
  }

  function t(key, values) {
    return i18n.translate(resolveLanguage(), key, values);
  }

  function translator(language) {
    return (key, values) => i18n.translate(language, key, values);
  }

  function clean(value) {
    return String(value || '')
      .replace(/\u200B/g, '')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function uniqueStrings(values) {
    return [...new Set(values.map(clean).filter(Boolean))];
  }

  function getRoute() {
    const match = location.pathname.match(/^\/channels\/(@me|\d{15,25})\/(\d{15,25})(?:\/|$)/);
    if (!match) return null;

    const title = clean(document.title)
      .replace(/^\(\d+\)\s*/, '')
      .replace(/\s*[–-]\s*Discord\s*$/i, '');
    const titleParts = title.split(/\s*[|｜]\s*/).map(clean).filter(Boolean);
    if (/^discord$/i.test(titleParts[0] || '')) titleParts.shift();

    return {
      guildId: match[1],
      channelId: match[2],
      key: `${match[1]}:${match[2]}`,
      url: `${location.origin}/channels/${match[1]}/${match[2]}`,
      label: titleParts.join(' · ') || title || match[2]
    };
  }

  function snowflakeToMilliseconds(id) {
    try {
      return Number((BigInt(id) >> 22n) + DISCORD_EPOCH);
    } catch (_) {
      return NaN;
    }
  }

  function getMessageRows(root) {
    return [...root.querySelectorAll('[id^="chat-messages-"]')].flatMap((row) => {
      const match = row.id.match(/^chat-messages-(\d{15,25})-(\d{15,25})$/);
      if (!match || row.parentElement.closest('[id^="chat-messages-"]')) return [];
      const [, channelId, id] = match;
      const article = row.querySelector('[role="article"]');
      // A welcome card can identify its list and mark the start of history,
      // but its synthetic message ID is just the channel ID.
      const isWelcome = id === channelId && row.parentElement === root && !article && row.matches(CHANNEL_WELCOME_SELECTOR);
      return [{ channelId, id, item: article || row, isWelcome }];
    });
  }

  function getLegacyRows(root) {
    return [...root.querySelectorAll('[role="article"]')].flatMap((item) => {
      if (item.parentElement.closest('[role="article"]')) return [];
      const content = [...item.querySelectorAll('[id^="message-content-"]')]
        .find((node) => !node.closest('[id^="message-reply-context-"], [id^="message-accessories-"]'));
      const id = item.getAttribute('aria-labelledby')?.match(/\bmessage-timestamp-(\d{15,25})\b/)?.[1] ||
        content?.id.match(/^message-content-(\d{15,25})$/)?.[1];
      return id ? [{ id, item }] : [];
    });
  }

  function getAuthor(item, id) {
    if (!item) return '';

    const header = item.querySelector(`[id="message-username-${id}"]`);
    const username = header?.querySelector('[class*="username"]') || header ||
      item.querySelector('h3 [class*="username"]');

    if (username) {
      const clone = username.cloneNode(true);
      clone.querySelectorAll(
        '[class*="clanTag"], [class*="guildTag"], [class*="chiplet"], [class*="roleIcon"], [class*="botTag"]'
      ).forEach((node) => node.remove());
      clone.querySelectorAll('[aria-label]').forEach((node) => {
        if (discordLabels.isServerTag(node.getAttribute('aria-label'))) node.remove();
      });

      const directText = [...clone.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join(' ');
      const author = discordLabels.author(directText || clone.textContent);
      if (author) return author;
    }

    const avatar = findAvatar(item);
    return avatar ? discordLabels.avatarAuthor(avatar.alt) : '';
  }

  function normalizeAssetUrl(value) {
    if (!/^https?:\/\//i.test(value || '')) return '';

    try {
      const parsed = new URL(value, location.href);
      if (/(?:^|\.)discordapp\.(?:com|net)$/i.test(parsed.hostname) &&
          !/\/(?:ephemeral-)?attachments\//i.test(parsed.pathname)) {
        ['size', 'width', 'height', 'quality'].forEach((key) => {
          if (parsed.searchParams.has(key)) parsed.searchParams.delete(key);
        });
      }
      return parsed.href;
    } catch (_) {
      return String(value);
    }
  }

  function customEmojiIdFromUrl(value) {
    if (!/^https?:\/\//i.test(value || '')) return '';

    try {
      const parsed = new URL(value, location.href);
      if (!/(?:^|\.)discordapp\.(?:com|net)$/i.test(parsed.hostname)) return '';
      return parsed.pathname.match(/^\/emojis\/(\d{15,25})(?:\.[a-z0-9]+)?$/i)?.[1] || '';
    } catch (_) {
      return '';
    }
  }

  function normalizeEmojiAssetUrl(value) {
    const id = customEmojiIdFromUrl(value);
    if (!id) return '';

    try {
      const source = new URL(value, location.href);
      const animated = source.searchParams.get('animated') === 'true' || /\.gif$/i.test(source.pathname);
      const parsed = new URL(`https://cdn.discordapp.com/emojis/${id}.webp`);
      if (animated) parsed.searchParams.set('animated', 'true');
      return parsed.href;
    } catch (_) {
      return '';
    }
  }

  function findAvatar(item) {
    return [...item.querySelectorAll('img[class*="avatar"], img[src*="cdn.discordapp.com/avatars/"], img[src*="cdn.discordapp.com/embed/avatars/"]')]
      .find((image) => !image.closest('[id^="message-reply-context-"], [class*="repliedMessage"], [id^="message-accessories-"]'));
  }

  function getAvatar(item) {
    const image = findAvatar(item);
    return normalizeAssetUrl(image?.currentSrc || image?.src || '');
  }

  function getContentParts(content) {
    if (!content) return [];
    const parts = [];
    let foundEmoji = false;

    const appendText = (value) => {
      if (!value) return;
      if (typeof parts[parts.length - 1] === 'string') parts[parts.length - 1] += value;
      else parts.push(value);
    };

    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        appendText(node.textContent || '');
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      if (node.tagName === 'BR') {
        appendText('\n');
        return;
      }

      if (node.tagName === 'IMG' && (
        /emoji/i.test(node.className || '') ||
        /\/emojis\//i.test(node.currentSrc || node.src || '')
      )) {
        const name = clean(node.alt || node.getAttribute('aria-label') || '');
        const url = normalizeEmojiAssetUrl(node.currentSrc || node.src || '');
        foundEmoji = true;

        if (url) parts.push({ type: 'emoji', name: name || ':emoji:', url });
        else appendText(name);
        return;
      }

      node.childNodes.forEach(walk);
    };

    content.childNodes.forEach(walk);
    if (!foundEmoji) return [];

    while (typeof parts[0] === 'string' && !parts[0]) parts.shift();
    while (typeof parts[parts.length - 1] === 'string' && !parts[parts.length - 1]) parts.pop();
    return parts;
  }

  function getReply(item, id) {
    if (!item) return '';
    const reply = item.querySelector(`[id="message-reply-context-${id}"]`) ||
      item.querySelector('[class*="repliedMessage"]') ||
      item.querySelector('[class*="replying"]');
    return reply ? clean(reply.innerText || reply.textContent) : '';
  }

  function getMessageText(content, parts = getContentParts(content)) {
    return clean(parts.length
      ? parts.map((part) => typeof part === 'string' ? part : part.name).join('')
      : content?.innerText || content?.textContent);
  }

  function getForwarded(accessories) {
    if (!accessories) return [];
    // Discord can reuse the forwarding row's ID for the nested snapshot.
    // Its position inside a card under the accessories distinguishes it.
    const cards = [...accessories.querySelectorAll('[class*="headerContainer_"]')]
      .map((header) => header.parentElement);
    return uniqueStrings(cards.flatMap((card) => [...card.querySelectorAll('[id^="message-content-"]')])
      .filter((node) => !node.closest('[id^="message-reply-context-"]'))
      .map((node) => getMessageText(node)));
  }

  function getEmbeds(item) {
    if (!item) return [];

    let nodes = [...item.querySelectorAll('[class*="embedWrapper"]')];
    if (!nodes.length) nodes = [...item.querySelectorAll('[class*="embedFull"]')];

    return uniqueStrings(nodes.map((node) => node.innerText || node.textContent));
  }

  function getAttachments(item) {
    if (!item) return [];

    const urls = [];
    const selectors = [
      'a[href*="cdn.discordapp.com/attachments/"]',
      'a[href*="media.discordapp.net/attachments/"]',
      'a[href*="cdn.discordapp.com/ephemeral-attachments/"]',
      'a[href*="media.discordapp.net/ephemeral-attachments/"]',
      'a[download][href]',
      'img[src*="/attachments/"]',
      'video[src*="/attachments/"]',
      'audio[src]'
    ];

    item.querySelectorAll(selectors.join(',')).forEach((node) => {
      if (node.closest('[id^="message-reply-context-"], [class*="repliedMessage"]')) return;
      const url = node.href || node.currentSrc || node.src || '';
      if (/^https?:\/\//i.test(url)) urls.push(url);
    });

    return uniqueStrings(urls);
  }

  function mediaTypeFromUrl(url, fallback = 'file') {
    let pathname = '';
    try {
      pathname = new URL(url, location.href).pathname.toLowerCase();
    } catch (_) {
      pathname = String(url || '').toLowerCase().split(/[?#]/)[0];
    }

    if (/\.(?:avif|bmp|gif|jpe?g|png|svg|webp)$/.test(pathname)) return 'image';
    if (/\.(?:m4v|mov|mp4|ogv|webm)$/.test(pathname)) return 'video';
    if (/\.(?:aac|flac|m4a|mp3|oga|ogg|opus|wav)$/.test(pathname)) return 'audio';
    return fallback;
  }

  function mediaIdentity(url) {
    try {
      const parsed = new URL(url, location.href);
      const emoji = customEmojiIdFromUrl(parsed.href);
      if (emoji) return `discord-emoji:${emoji}`;
      const attachment = parsed.pathname.match(
        /\/(?:ephemeral-)?attachments\/(\d+)\/(\d+)\/([^/?]+)/i
      );

      if (attachment && /(?:^|\.)discordapp\.(?:com|net)$/i.test(parsed.hostname)) {
        return `discord:${attachment.slice(1).map((part) => decodeURIComponent(part).toLowerCase()).join(':')}`;
      }

      ['width', 'height', 'quality', 'format'].forEach((key) => parsed.searchParams.delete(key));
      return `${parsed.hostname.toLowerCase()}${parsed.pathname}?${parsed.searchParams.toString()}`;
    } catch (_) {
      return String(url || '');
    }
  }

  function mediaPreference(entry) {
    let score = entry.type === 'image' ? 10 : entry.type === 'video' ? 8 : entry.type === 'audio' ? 6 : 0;
    try {
      const parsed = new URL(entry.url, location.href);
      if (/^cdn\.discordapp\.com$/i.test(parsed.hostname)) score += 100;
      else if (/^media\.discordapp\.net$/i.test(parsed.hostname)) score += 60;
      else if (/discordapp\.net$/i.test(parsed.hostname)) score += 40;
      if (/\.[a-z0-9]{2,5}$/i.test(parsed.pathname)) score += 5;
    } catch (_) {
      // Keep the type-only score.
    }
    return score;
  }

  function attachmentExpiry(url) {
    try {
      const parsed = new URL(url, location.href);
      if (!/(?:^|\.)discordapp\.(?:com|net)$/i.test(parsed.hostname) ||
          !/\/(?:ephemeral-)?attachments\//i.test(parsed.pathname)) return 0;
      const expiry = parsed.searchParams.get('ex');
      return /^[\da-f]{1,12}$/i.test(expiry || '') ? Number.parseInt(expiry, 16) : 0;
    } catch (_) {
      return 0;
    }
  }

  function preferMedia(candidate, existing) {
    const candidateExpiry = attachmentExpiry(candidate.url);
    const existingExpiry = attachmentExpiry(existing.url);
    if (candidateExpiry && existingExpiry && candidateExpiry !== existingExpiry) return candidateExpiry > existingExpiry;
    return mediaPreference(candidate) > mediaPreference(existing);
  }

  function getMedia(item, attachments = []) {
    if (!item) return [];

    const media = [];
    const add = (url, type, alt = '', poster = '') => {
      if (!/^https?:\/\//i.test(url || '')) return;
      media.push({ url, type: mediaTypeFromUrl(url, type), alt: clean(alt), poster });
    };

    item.querySelectorAll('img[src], video, audio').forEach((node) => {
      if (node.closest('[id^="message-reply-context-"], [class*="repliedMessage"]')) return;
      const tag = node.tagName.toLowerCase();
      const url = node.currentSrc || node.src || node.querySelector?.('source[src]')?.src || '';

      if (tag === 'img') {
        if (node.closest('[class*="avatar"], [class*="emoji"], [class*="reaction"], [class*="imagePlaceholder"]')) return;
        if (node.closest('[class*="embedAuthorIcon"], [class*="embedProvider"], [class*="authorIcon"]')) return;
        if (/\/icon-default\.[^/?]+\.png(?:[?#]|$)/i.test(url)) return;

        const isMessageMedia = node.closest(
          '[class*="attachment"], [class*="embed"], [class*="imageWrapper"], [class*="media"], [class*="sticker"]'
        ) || /\/attachments\/|\/ephemeral-attachments\/|\/external\//i.test(url);

        if (!isMessageMedia) return;
        add(url, 'image', node.alt || node.getAttribute('aria-label') || '');
        return;
      }

      if (tag === 'video') {
        add(url, 'video', node.getAttribute('aria-label') || '', node.poster || '');
      } else if (tag === 'audio') {
        add(url, 'audio', node.getAttribute('aria-label') || '');
      }
    });

    attachments.forEach((url) => add(url, mediaTypeFromUrl(url, 'file')));
    return mergeMedia(media, []);
  }

  function getStickers(item) {
    if (!item) return [];
    const stickers = [...item.querySelectorAll('[class*="sticker"] img[alt], img[data-type="sticker"][alt]')];
    return uniqueStrings(stickers.map((image) => image.alt));
  }

  function getReactions(item, id) {
    const container = item.querySelector(`[id="message-reactions-${id}"]`) ||
      item.querySelector('[class^="reactions_"]');
    if (!container) return [];

    const roots = container.querySelectorAll('[class*="reactionInner"], [class^="reaction_"], [class*="reaction"][aria-pressed], [class*="reaction"][aria-checked]');
    const reactions = [];

    for (const root of roots) {
      if (root.querySelector('[class*="reactionInner"]')) continue;
      const label = clean(root.getAttribute('aria-label') || '').replace(/\s+/g, ' ');
      const image = root.querySelector('img[class*="emoji"], img[alt]');
      const countNode = root.querySelector('[class*="reactionCount"], [class*="count"]');
      const directCount = clean(countNode?.textContent || '').replace(/[,\s]/g, '').match(/\d+/);
      const labelledCount = label.match(/[,，]\s*([\d,.]+)\s*(?:reactions?|个反应|個反應|件のリアクション|개의 반응|reacciones?|réactions?|reaktionen?|reações?|реакц|تفاعل)/i);
      if (!directCount && !labelledCount) continue;
      const count = Number((directCount?.[0] || labelledCount[1]).replace(/[,\s]/g, '')) || 1;
      const emoji = clean(image?.alt || label.split(/[,，]\s*\d/)[0] || root.textContent)
        .replace(/^:+|:+$/g, '')
        .replace(/\s+/g, ' ');
      // Discord renders standard Unicode emoji through hashed web-client SVG
      // assets. Those build URLs are not stable archive resources, so only
      // keep an image URL when it is a real custom emoji CDN endpoint.
      const url = normalizeEmojiAssetUrl(image?.currentSrc || image?.src || '');

      if (!emoji && !url) continue;
      const me = root.closest('[aria-pressed="true"], [aria-checked="true"]');
      reactions.push({ emoji: emoji || 'reaction', count: Number.isFinite(count) ? count : 1, url, me: Boolean(me && container.contains(me)) });
    }

    return mergeReactions(reactions, []);
  }

  function findMessageRoot(route = getRoute()) {
    if (!route) return null;
    const chatLists = [...document.querySelectorAll('[data-list-id^="chat-messages"]')];
    const lists = (chatLists.length ? chatLists : [...document.querySelectorAll('main [role="list"]')]
      .filter((list) => list.querySelector('[id^="chat-messages-"], [id^="message-content-"]')))
      .filter((list) => !list.closest('[hidden], [aria-hidden="true"]'));
    for (const list of lists) {
      if (getMessageRows(list).some((row) => row.channelId === route.channelId)) return list;
    }
    // Unkeyed legacy/empty lists can only be used if the choice is unambiguous.
    return lists.length === 1 && !getMessageRows(lists[0]).length ? lists[0] : null;
  }

  function findScroller(root = findMessageRoot()) {
    if (!root) return null;

    let node = root;
    let overflowCandidate = null;

    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      if (/(auto|scroll|overlay)/.test(style.overflowY)) {
        overflowCandidate = overflowCandidate || node;
        if (node.scrollHeight > node.clientHeight + 4) return node;
      }
      node = node.parentElement;
    }

    return overflowCandidate;
  }

  function mergeArrays(next, old) {
    return next.length ? uniqueStrings([...(old || []), ...next]) : (old || []);
  }

  function mergeAttachments(next, old) {
    const merged = new Map();
    for (const url of [...(old || []), ...(next || [])]) {
      if (!/^https?:\/\//i.test(url || '')) continue;
      const identity = mediaIdentity(url);
      const candidate = { url, type: mediaTypeFromUrl(url, 'file') };
      const existing = merged.get(identity);
      if (!existing || preferMedia(candidate, existing)) merged.set(identity, candidate);
    }
    return [...merged.values()].map((entry) => entry.url);
  }

  function mergeMedia(next, old) {
    const ranks = { file: 0, audio: 1, video: 2, image: 3 };
    const merged = new Map();

    for (const entry of [...(old || []), ...(next || [])]) {
      if (!entry?.url) continue;
      const normalized = {
        url: String(entry.url),
        type: ['image', 'video', 'audio', 'file'].includes(entry.type) ? entry.type : mediaTypeFromUrl(entry.url),
        alt: clean(entry.alt),
        poster: /^https?:\/\//i.test(entry.poster || '') ? String(entry.poster) : ''
      };
      const identity = mediaIdentity(normalized.url);
      const existing = merged.get(identity);

      if (!existing ||
          ranks[normalized.type] > ranks[existing.type] ||
          (ranks[normalized.type] === ranks[existing.type] && preferMedia(normalized, existing))) {
        merged.set(identity, {
          ...existing,
          ...normalized,
          alt: normalized.alt || existing?.alt || '',
          poster: normalized.poster || existing?.poster || ''
        });
      } else if (!existing.alt && normalized.alt) {
        merged.set(identity, { ...existing, alt: normalized.alt });
      }
    }

    return [...merged.values()];
  }

  function mergeReactions(next, old) {
    const merged = new Map();

    for (const entry of [...(old || []), ...(next || [])]) {
      const normalized = typeof entry === 'string'
        ? { emoji: clean(entry), count: 1, url: '', me: false }
        : {
            emoji: clean(entry?.emoji || 'reaction'),
            count: Math.max(1, Number(entry?.count) || 1),
            url: normalizeEmojiAssetUrl(entry?.url || ''),
            me: Boolean(entry?.me)
          };
      const customId = customEmojiIdFromUrl(normalized.url);
      const identity = customId ? `custom:${customId}` : `unicode:${normalized.emoji.toLocaleLowerCase()}`;
      if (!identity) continue;
      const existing = merged.get(identity);
      const preferredUrl = existing && /[?&]animated=true(?:&|$)/.test(existing.url) && !/[?&]animated=true(?:&|$)/.test(normalized.url)
        ? existing.url
        : (normalized.url || existing?.url || '');
      merged.set(identity, existing ? {
        emoji: normalized.emoji || existing.emoji,
        count: Math.max(existing.count, normalized.count),
        url: preferredUrl,
        me: existing.me || normalized.me
      } : normalized);
    }

    return [...merged.values()];
  }

  function scanVisible() {
    const route = getRoute();
    const root = findMessageRoot();

    if (!route || !root) {
      updateCount();
      return { ids: [], minMs: NaN, maxMs: NaN, route, root };
    }

    const rows = getMessageRows(root);
    const candidates = rows.length
      ? rows.filter((row) => row.channelId === route.channelId && !row.isWelcome)
      : getLegacyRows(root);
    const ids = [];
    const seen = new Set();
    let minMs = Infinity;
    let maxMs = -Infinity;

    for (const { id, item } of candidates) {
      if (seen.has(id)) continue;
      const timestampMs = snowflakeToMilliseconds(id);
      if (!Number.isFinite(timestampMs) || timestampMs > 8.64e15) continue;
      const content = [...item.querySelectorAll(`[id="message-content-${id}"]`)]
        .find((node) => !node.closest('[id^="message-accessories-"], [id^="message-reply-context-"], [class*="repliedMessage"]'));
      const accessories = item.querySelector(`[id="message-accessories-${id}"]`);

      const recordKey = `${route.key}:${id}`;
      const old = records.get(recordKey) || {};
      const author = getAuthor(item, id) || old.author || '';
      const avatar = getAvatar(item) || old.avatar || '';
      const authorGroupId = item.getAttribute('aria-labelledby')?.match(/\bmessage-username-(\d{15,25})\b/)?.[1] || old.authorGroupId;

      const contentParts = getContentParts(content);
      const text = getMessageText(content, contentParts);
      const reply = getReply(item, id);
      const forwarded = getForwarded(accessories);
      const embeds = getEmbeds(accessories || item);
      const attachments = getAttachments(accessories || item);
      const media = getMedia(accessories || item, attachments);
      const stickers = getStickers(accessories || item);
      const reactions = getReactions(item, id);

      records.set(recordKey, {
        id,
        guildId: route.guildId,
        channelId: route.channelId,
        channelLabel: route.label || old.channelLabel || route.channelId,
        author,
        avatar,
        authorGroupId,
        timestamp: new Date(timestampMs).toISOString(),
        timestampMs,
        text: content ? text : (old.text || ''),
        contentParts: content ? contentParts : (old.contentParts || []),
        reply: reply || old.reply || '',
        ...(forwarded.length || old.forwarded ? { forwarded: forwarded.length ? forwarded : old.forwarded } : {}),
        embeds: mergeArrays(embeds, old.embeds),
        attachments: mergeAttachments(attachments, old.attachments),
        media: mergeMedia(media, old.media),
        stickers: mergeArrays(stickers, old.stickers),
        reactions,
        edited: Boolean(item?.querySelector('[class*="edited"]')) || Boolean(old.edited),
        url: `${route.url}/${id}`
      });

      ids.push(id);
      seen.add(id);
      minMs = Math.min(minMs, timestampMs);
      maxMs = Math.max(maxMs, timestampMs);
    }

    updateCount();

    return {
      ids,
      minMs: ids.length ? minMs : NaN,
      maxMs: ids.length ? maxMs : NaN,
      route,
      root
    };
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanVisible, 150);
  }

  function parseLocalDate(value, nextDay = false) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return NaN;

    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]) + (nextDay ? 1 : 0);
    const date = new Date(year, month, day, 0, 0, 0, 0);
    return date.getTime();
  }

  function getDateBounds(showError = false) {
    const startMs = parseLocalDate(settings.startDate, false);
    const endExclusiveMs = parseLocalDate(settings.endDate, true);
    const valid = Number.isFinite(startMs) && Number.isFinite(endExclusiveMs) && startMs < endExclusiveMs;

    if (!valid && showError) setStatus('badDates', {}, 'error');
    return valid ? { startMs, endExclusiveMs } : null;
  }

  function compareSnowflakes(a, b) {
    const left = BigInt(a.id);
    const right = BigInt(b.id);
    return left < right ? -1 : left > right ? 1 : 0;
  }

  function currentChannelRecords() {
    const route = getRoute();
    if (!route) return [];

    return [...records.values()]
      .filter((record) => record.guildId === route.guildId && record.channelId === route.channelId)
      .sort(compareSnowflakes)
      .map(({ authorGroupId, ...record }) => {
        const group = authorGroupId && records.get(`${route.key}:${authorGroupId}`);
        return { ...record, author: record.author || group?.author || '', avatar: record.avatar || group?.avatar || '' };
      });
  }

  function selectedRecords() {
    const bounds = getDateBounds(false);
    if (!bounds) return [];
    return currentChannelRecords().filter((record) =>
      record.timestampMs >= bounds.startMs && record.timestampMs < bounds.endExclusiveMs
    );
  }

  function updateCount() {
    if (!elements.count) return;
    const route = getRoute();
    const bounds = getDateBounds();
    let total = 0;
    let selected = 0;
    for (const record of records.values()) {
      if (!route || record.guildId !== route.guildId || record.channelId !== route.channelId) continue;
      total++;
      if (bounds && record.timestampMs >= bounds.startMs && record.timestampMs < bounds.endExclusiveMs) selected++;
    }
    elements.count.textContent = t('collected', { selected, total });
  }

  function reactionText(reaction) {
    if (typeof reaction === 'string') return reaction;
    const symbol = clean(reaction?.emoji || 'reaction');
    return `${symbol} × ${Math.max(1, Number(reaction?.count) || 1)}${reaction?.me ? ' ✓' : ''}`;
  }

  function textExport(messages) {
    const tr = translator(resolveLanguage());
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

  function jsonExport(messages) {
    const route = getRoute();
    return JSON.stringify({
      exporter: `Discord Chat Exporter ${VERSION}`,
      generatedAt: new Date().toISOString(),
      localTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'local',
      dateRange: { start: settings.startDate, end: settings.endDate },
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

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function buildArchiveDatabase(messages) {
    const assets = [];
    const assetLookup = new Map();
    const authors = [];
    const authorLookup = new Map();

    const assetIndex = (entry) => {
      const type = entry.type || mediaTypeFromUrl(entry?.url || '', 'file');
      const url = type === 'emoji'
        ? normalizeEmojiAssetUrl(entry?.url || '')
        : normalizeAssetUrl(entry?.url || '');
      if (!url) return -1;
      const identity = `${mediaIdentity(url)}:${type}`;
      if (assetLookup.has(identity)) {
        const existingIndex = assetLookup.get(identity);
        const existing = assets[existingIndex];
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

  function archiveBootstrapSource() {
    return String.raw`(() => {
      const payloadNode = document.getElementById('archive-data');
      const timeline = document.getElementById('timeline');
      const loading = document.getElementById('archive-loading');
      const input = document.getElementById('archive-search');
      const counter = document.getElementById('result-count');
      const labels = JSON.parse(document.documentElement.dataset.labels);
      const locale = document.documentElement.lang || 'en';

      const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      })[character]);

      const linkify = (value) => {
        const source = String(value || '');
        const pattern = /https?:\/\/[^\s<>"']+/gi;
        let result = '';
        let cursor = 0;
        for (const match of source.matchAll(pattern)) {
          let url = match[0];
          let trailing = '';
          while (/[),.;!?]$/.test(url)) {
            trailing = url.slice(-1) + trailing;
            url = url.slice(0, -1);
          }
          result += esc(source.slice(cursor, match.index));
          result += '<a href="' + esc(url) + '" target="_blank" rel="noreferrer">' + esc(url) + '</a>' + esc(trailing);
          cursor = match.index + match[0].length;
        }
        return result + esc(source.slice(cursor));
      };

      const formatText = (value) => String(value || '').split(/(\x60{3}[\s\S]*?\x60{3})/g).map((part) => {
        if (part.startsWith('\x60\x60\x60') && part.endsWith('\x60\x60\x60')) {
          return '<pre><code>' + esc(part.slice(3, -3).replace(/^\n|\n$/g, '')) + '</code></pre>';
        }
        return linkify(part);
      }).join('');

      const bytesFromBase64 = (value) => {
        const binary = atob(value.replace(/\s+/g, ''));
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        return bytes;
      };

      const loadDatabase = async () => {
        let bytes = bytesFromBase64(payloadNode.textContent);
        if (payloadNode.dataset.encoding === 'gzip-base64') {
          if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot decompress the archive.');
          const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
          bytes = new Uint8Array(await new Response(stream).arrayBuffer());
        }
        return JSON.parse(new TextDecoder().decode(bytes));
      };

      const dayKey = (timestamp) => {
        const date = new Date(timestamp);
        return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
      };
      const dayLabel = (timestamp) => new Intl.DateTimeFormat(locale, {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
      }).format(new Date(timestamp));
      const timeLabel = (timestamp) => new Intl.DateTimeFormat(locale, {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date(timestamp));
      const initial = (author) => Array.from(String(author || '?'))[0]?.toLocaleUpperCase() || '?';
      const hue = (author) => {
        let hash = 0;
        for (const character of String(author || '')) hash = ((hash << 5) - hash + character.codePointAt(0)) | 0;
        return Math.abs(hash) % 360;
      };
      const customEmojiText = (name) => {
        const value = String(name || 'emoji').replace(/^:+|:+$/g, '');
        return ':' + value + ':';
      };

      const section = (title, values, className) => values && values.length
        ? '<section class="detail-section ' + className + '"><h3>' + esc(title) + '</h3>' + values.map((value) => '<div>' + formatText(value) + '</div>').join('') + '</section>'
        : '';

      const renderArchive = (db) => {
        const asset = (index) => index >= 0 ? db.a[index] : null;
        const richText = (parts, fallback) => {
          if (!parts || !parts.length) return formatText(fallback);
          return parts.map((part) => {
            if (typeof part === 'string') return formatText(part);
            const item = asset(part[1]);
            return item
              ? '<span class="inline-emoji-wrap"><img class="inline-emoji fallback-image" src="' + esc(item[0]) + '" alt="' + esc(part[0]) + '" title="' + esc(part[0]) + '" loading="lazy" decoding="async"><span class="inline-emoji-fallback" hidden>' + esc(customEmojiText(part[0])) + '</span></span>'
              : esc(part[0]);
          }).join('');
        };
        const reactions = (items) => !items || !items.length ? '' : '<div class="reaction-row" aria-label="' + esc(labels.reactions) + '">' + items.map((item) => {
          const icon = asset(item[2]);
          const symbol = icon
            ? '<span class="reaction-icon"><img class="reaction-emoji fallback-image" src="' + esc(icon[0]) + '" alt="' + esc(item[0]) + '" loading="lazy" decoding="async"><span class="reaction-symbol" hidden>' + esc(customEmojiText(item[0])) + '</span></span>'
            : '<span class="reaction-symbol">' + esc(item[0]) + '</span>';
          return '<span class="reaction-chip' + (item[3] ? ' mine' : '') + '" title="' + esc(item[0]) + '">' + symbol + '<strong>' + Number(item[1] || 1) + '</strong></span>';
        }).join('') + '</div>';
        const media = (refs) => {
          if (!refs || !refs.length) return '';
          const body = refs.map((reference) => {
            const item = asset(reference);
            if (!item) return '';
            const url = esc(item[0]);
            const rawLabel = item[2] || item[0].split('/').pop().split('?')[0] || item[1];
            const label = esc(rawLabel);
            const link = '<a class="media-link" href="' + url + '" target="_blank" rel="noreferrer">' + label + '</a>';
            if (item[1] === 'image') return '<figure class="media-item"><a href="' + url + '" target="_blank" rel="noreferrer"><img src="' + url + '" alt="' + label + '" loading="lazy" decoding="async"></a><figcaption>' + link + '</figcaption></figure>';
            if (item[1] === 'video') return '<figure class="media-item"><video controls preload="metadata" playsinline' + (item[3] ? ' poster="' + esc(item[3]) + '"' : '') + '><source src="' + url + '"></video><figcaption>' + link + '</figcaption></figure>';
            if (item[1] === 'audio') return '<figure class="media-item audio"><audio controls preload="metadata" src="' + url + '"></audio><figcaption>' + link + '</figcaption></figure>';
            return '<div class="file-item">' + link + '</div>';
          }).join('');
          return '<section class="detail-section media-section"><h3>' + esc(labels.attachments) + '</h3><div class="media-grid">' + body + '</div></section>';
        };

        const groups = [];
        let group = null;
        let previous = null;
        for (const row of db.m) {
          const key = dayKey(row[1]);
          if (!group || group.key !== key) {
            group = { key, label: dayLabel(row[1]), rows: [] };
            groups.push(group);
          }
          const author = db.u[row[2]] || ['—', -1];
          const compact = previous && previous[2] === row[2] && dayKey(previous[1]) === key && new Date(row[1]) - new Date(previous[1]) <= 300000;
          const avatarAsset = asset(author[1]);
          const avatar = avatarAsset
            ? '<img class="avatar-image fallback-image" src="' + esc(avatarAsset[0]) + '" alt="" loading="lazy" decoding="async"><span class="avatar-fallback" hidden>' + esc(initial(author[0])) + '</span>'
            : '<span>' + esc(initial(author[0])) + '</span>';
          const visible = row[3] || row[5] || row[6].length || row[7].length || row[8].length || row[12]?.length;
          const body = row[3] || (!visible ? labels.emptyText : '');
          group.rows.push('<article class="message' + (compact ? ' compact' : '') + '" aria-label="' + esc(author[0] + ', ' + timeLabel(row[1])) + '">' +
            '<div class="avatar" style="--author-hue:' + hue(author[0]) + '" aria-hidden="true">' + avatar + '</div>' +
            '<div class="message-content"><header class="message-header"><strong class="message-author">' + esc(author[0]) + '</strong>' +
            '<time datetime="' + esc(row[1]) + '" title="' + esc(row[1]) + '">' + esc(timeLabel(row[1])) + '</time>' +
            (row[10] ? '<span class="edited-badge">' + esc(labels.edited) + '</span>' : '') + '</header>' +
            (body ? '<div class="message-body' + (row[3] ? '' : ' empty') + '">' + richText(row[4], body) + '</div>' : '') +
            (row[5] ? section(labels.reply, [row[5]], 'reply-card') : '') + section(labels.forwarded, row[12], 'embed-card') +
            section(labels.embeds, row[6], 'embed-card') +
            section(labels.stickers, row[8], 'sticker-card') + media(row[7]) + reactions(row[9]) +
            '<footer class="message-footer"><a href="' + esc(row[11]) + '" target="_blank" rel="noreferrer">↗ ' + esc(labels.source) + '</a><code>' + esc(row[0]) + '</code></footer></div></article>');
          previous = row;
        }

        timeline.innerHTML = groups.map((item) => '<section class="day-group" data-day="' + esc(item.key) + '"><h2 class="day-divider"><span>' + esc(item.label) + '</span><small>' + item.rows.length + '</small></h2><div class="day-messages">' + item.rows.join('') + '</div></section>').join('');
        loading.remove();

        const revealFallback = (image) => {
          if (image.dataset.fallbackApplied === '1') return;
          image.dataset.fallbackApplied = '1';
          image.hidden = true;
          const fallback = image.nextElementSibling;
          if (fallback) fallback.hidden = false;
        };
        for (const image of timeline.querySelectorAll('img.fallback-image')) {
          image.addEventListener('error', () => revealFallback(image), { once: true });
          if (image.complete && image.naturalWidth === 0) revealFallback(image);
        }

        const messages = [...document.querySelectorAll('.message')];
        const dayGroups = [...document.querySelectorAll('.day-group')];
        const update = () => {
          const query = input.value.trim().toLocaleLowerCase(locale);
          let visibleCount = 0;
          for (const message of messages) {
            const match = !query || message.textContent.toLocaleLowerCase(locale).includes(query);
            message.hidden = !match;
            if (match) visibleCount += 1;
          }
          for (const item of dayGroups) {
            const count = item.querySelectorAll('.message:not([hidden])').length;
            item.hidden = count === 0;
            const badge = item.querySelector('.day-divider small');
            if (badge) badge.textContent = String(count);
          }
          counter.textContent = labels.showing.replace('__VISIBLE__', String(visibleCount)).replace('__TOTAL__', String(messages.length));
        };
        input.addEventListener('input', update);
      };

      loadDatabase().then(renderArchive).catch(() => {
        loading.classList.add('error');
        loading.textContent = labels.loadFailed;
      });
    })();`;
  }

  async function compactHtmlExport(messages) {
    const route = getRoute();
    const language = resolveLanguage();
    const tr = translator(language);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
    const generatedAt = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
    const payload = await encodeArchiveDatabase(buildArchiveDatabase(messages));
    const labels = JSON.stringify({
      reply: tr('reply'), forwarded: tr('forwarded'), embeds: tr('embeds'), attachments: tr('attachments'), reactions: tr('reactions'), stickers: tr('stickers'),
      emptyText: tr('emptyText'), edited: tr('edited'), source: tr('source'),
      showing: tr('showing', { visible: '__VISIBLE__', total: '__TOTAL__' }),
      loadFailed: tr('loadFailed')
    }).replace(/</g, '\\u003c');

    return `<!doctype html>
<html lang="${escapeHtml(language)}" dir="${i18n.direction(language)}" data-labels="${escapeHtml(labels)}">
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
  <header class="archive-hero"><p class="eyebrow">${escapeHtml(tr('archiveTitle'))}</p><h1>${escapeHtml(route?.label || tr('title'))}</h1><div class="archive-meta"><span class="meta-pill">${escapeHtml(settings.startDate)} — ${escapeHtml(settings.endDate)}</span><span class="meta-pill">${escapeHtml(tr('messageCount', { count: messages.length }))}</span><span class="meta-pill">${escapeHtml(timeZone)}</span><span class="meta-pill">${escapeHtml(generatedAt)}</span></div></header>
  <div class="toolbar" role="search"><input id="archive-search" class="search" type="search" placeholder="${escapeHtml(tr('searchPlaceholder'))}" aria-label="${escapeHtml(tr('searchPlaceholder'))}"><span id="result-count" class="result-count">${escapeHtml(tr('showing', { visible: messages.length, total: messages.length }))}</span></div>
  <main id="timeline" class="timeline"><div id="archive-loading" class="archive-loading">${escapeHtml(tr('archiveLoading'))}</div></main><a class="back-top" href="#" aria-label="${escapeHtml(tr('backToTop'))}">↑ ${escapeHtml(tr('backToTop'))}</a>
  <script id="archive-data" type="application/octet-stream" data-encoding="${payload.encoding}">${payload.data}</script>
  <script>${archiveBootstrapSource()}</script>
</body>
</html>`;
  }

  async function buildExport(format, messages) {
    if (format === 'json') return { content: jsonExport(messages), mime: 'application/json;charset=utf-8', extension: 'json' };
    if (format === 'csv') return { content: csvExport(messages), mime: 'text/csv;charset=utf-8', extension: 'csv' };
    if (format === 'html') return { content: await compactHtmlExport(messages), mime: 'text/html;charset=utf-8', extension: 'html' };
    return { content: textExport(messages), mime: 'text/plain;charset=utf-8', extension: 'txt' };
  }

  function exportFileStem() {
    const route = getRoute();
    const channel = clean(route?.label || route?.channelId || 'channel')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/[^\p{L}\p{N}._#-]+/gu, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 70) || 'channel';
    return `discord-chat-${channel}-${settings.startDate}_${settings.endDate}`;
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.cssText = 'position:fixed;left:-999999px;top:0;opacity:0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      textarea.remove();
      return success;
    }
  }

  async function copyExport() {
    scanVisible();
    if (!getDateBounds(true)) return false;
    const messages = selectedRecords();
    if (!messages.length) {
      setStatus('noMessages', {}, 'warning');
      return false;
    }

    const output = await buildExport(settings.format, messages);
    const success = await copyToClipboard(output.content);
    setStatus(success ? 'copied' : 'copyFailed', { count: messages.length }, success ? 'success' : 'error');
    return success;
  }

  async function downloadExport() {
    scanVisible();
    if (!getDateBounds(true)) return false;
    const messages = selectedRecords();
    if (!messages.length) {
      setStatus('noMessages', {}, 'warning');
      return false;
    }

    return downloadMessages(messages);
  }

  async function downloadMessages(messages, mayDownload = () => true) {
    const fileStem = exportFileStem();
    const output = await buildExport(settings.format, messages);
    if (!mayDownload()) return false;

    const blob = new Blob([output.content], { type: output.mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${fileStem}.${output.extension}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    setStatus('downloaded', { count: messages.length }, 'success');
    return true;
  }

  const COLLECTION_STALL_MS = 12000;
  const LATEST_SETTLE_MS = 4500;
  const PAGINATION_ATTEMPTS = [
    { depth: 0.65, pivotDwellMs: 800, settleMs: 800 },
    { depth: 0.32, pivotDwellMs: 1200, settleMs: 1600 },
    { depth: 0.80, pivotDwellMs: 2000, settleMs: 3200 },
    { depth: 0.90, pivotDwellMs: 3200, settleMs: 6400 },
    { depth: 0.96, pivotDwellMs: 4800, settleMs: 12000 },
    { depth: 0.50, pivotDwellMs: 12000, settleMs: 12000 },
    { depth: 0.65, pivotDwellMs: 24000, settleMs: 12000 }
  ];
  const SCROLL_STEP_RATIO = 0.72;

  function isAtTop(scroller) {
    return scroller.scrollTop <= 3;
  }

  function isAtBottom(scroller) {
    return scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
  }

  function sleep(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  function scrollSignature(scroller, scan) {
    const first = scan.ids[0] || '';
    const last = scan.ids[scan.ids.length - 1] || '';
    return `${first}:${last}:${Math.round(scroller.scrollTop)}:${scroller.scrollHeight}:${scroller.clientHeight}`;
  }

  function moveScroller(scroller, direction) {
    const distance = Math.max(1, Math.floor(scroller.clientHeight * SCROLL_STEP_RATIO));
    scroller.scrollBy({ top: direction * distance, left: 0, behavior: 'auto' });
  }

  function jumpToLoadedEdge(scroller, direction) {
    scroller.scrollTop = direction < 0 ? 0 : Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  }

  function hasChannelBeginning(root) {
    return Boolean(root.querySelector(
      `:scope > ${CHANNEL_WELCOME_SELECTOR}, :scope > [class*="channelBeginning"], :scope > [class*="channelStart"]`
    ));
  }

  function hasMessagePlaceholders(node) {
    return Boolean(node.querySelector(':scope > [class*="wrapper_"]:is([class*="cozy_"], [class*="compact_"])'));
  }

  function findPaginationBoundary(root, direction, rowId) {
    const older = direction < 0;
    let edgeMessage = older ? root.firstElementChild : root.lastElementChild;
    let hasPlaceholders = false;
    while (edgeMessage && !edgeMessage.id.startsWith('chat-messages-')) {
      hasPlaceholders ||= hasMessagePlaceholders(edgeMessage);
      edgeMessage = older ? edgeMessage.nextElementSibling : edgeMessage.previousElementSibling;
    }
    return hasPlaceholders && edgeMessage?.id === rowId ? edgeMessage : null;
  }

  function messageEdgePosition(scroller, edgeMessage, direction) {
    const messageRect = edgeMessage.getBoundingClientRect();
    return (direction < 0 ? messageRect.top : messageRect.bottom) -
      scroller.getBoundingClientRect().top + scroller.scrollTop;
  }

  function advancePagination(scroller, edgeMessage, direction, state, now) {
    if (state.scroller !== scroller) {
      state.scroller = scroller;
      state.reenter = false;
      state.waitUntil = 0;
    }
    if (now < state.waitUntil) return true;

    const older = direction < 0;
    const viewport = scroller.clientHeight;
    const messageEdge = messageEdgePosition(scroller, edgeMessage, direction);
    const maxScrollTop = Math.max(0, scroller.scrollHeight - viewport);

    if (!state.reenter) {
      if (state.attempts >= PAGINATION_ATTEMPTS.length) return false;
      const firstAttempt = state.attempts++ === 0;
      const outsideTrigger = older ? scroller.scrollTop >= messageEdge
        : scroller.scrollTop + viewport <= messageEdge;
      if (!firstAttempt || !outsideTrigger) {
        const pivot = older ? Math.min(messageEdge + viewport, maxScrollTop)
          : Math.max(0, messageEdge - 2 * viewport);
        const canRearm = older ? pivot > messageEdge : pivot + viewport < messageEdge;
        if (canRearm) {
          // Stay outside the trigger to give Discord time to release a
          // pending request or reset its pagination state before retrying.
          scroller.scrollTop = pivot;
          state.reenter = true;
          state.waitUntil = now + PAGINATION_ATTEMPTS[state.attempts - 1].pivotDwellMs;
          return true;
        }
      }
    }

    // Mounted rows have already been scanned. Stop across the real row and
    // placeholder while Discord loads, then require overlap on the next scan.
    const { depth, settleMs } = PAGINATION_ATTEMPTS[state.attempts - 1];
    const offset = viewport * (older ? depth : 1 - depth);
    const approach = Math.max(0, Math.min(messageEdge - offset, maxScrollTop));
    scroller.scrollTop = approach;
    state.reenter = false;
    state.waitUntil = now + settleMs;
    return true;
  }

  function isWaitingForLatest(root, scroller) {
    if (root.getAttribute('aria-busy') === 'true' ||
        scroller.getAttribute('aria-busy') === 'true' ||
        scroller.parentElement?.querySelector('[class*="jumpToPresentBar"]')) return true;

    // Discord can render a placeholder group after the last message while
    // filling newer history. Placeholders above it do not affect this edge.
    for (let node = root.lastElementChild; node && !node.id.startsWith('chat-messages-'); node = node.previousElementSibling) {
      if (node.matches('[role="progressbar"], [aria-busy="true"], [class*="spinner"]') ||
          hasMessagePlaceholders(node)) return true;
    }
    return false;
  }

  function setRunning(running) {
    if (!elements.fetch || !elements.cancel) return;
    elements.fetch.hidden = running;
    elements.cancel.hidden = !running;
    elements.startDate.disabled = running;
    elements.endDate.disabled = running;
    elements.delay.disabled = running;
    elements.clear.disabled = running;
  }

  function initialTraversalDirection(scan, bounds) {
    if (scan.maxMs < bounds.startMs) return 1;
    if (scan.minMs >= bounds.endExclusiveMs) return -1;

    const missingStart = scan.minMs >= bounds.startMs;
    const missingEnd = scan.maxMs < bounds.endExclusiveMs;
    if (missingStart && missingEnd) {
      const distanceToStart = scan.minMs - bounds.startMs;
      const distanceToEnd = bounds.endExclusiveMs - scan.maxMs;
      return distanceToStart <= distanceToEnd ? -1 : 1;
    }
    if (missingStart) return -1;
    if (missingEnd) return 1;
    return 0;
  }

  async function startAutomaticCollection() {
    if (activeJob) return;

    const bounds = getDateBounds(true);
    const route = getRoute();

    if (!route) {
      setStatus('noChannel', {}, 'error');
      return;
    }
    if (!bounds) return;

    const job = { cancelled: false, routeKey: route.key };
    const interruption = () => {
      if (job.cancelled || activeJob !== job) return 'cancelled';
      return getRoute()?.key === job.routeKey ? '' : 'routeChanged';
    };
    activeJob = job;
    setRunning(true);

    const coverage = { '-1': 'pending', 1: 'pending' };
    const paginationByEdge = new Map();
    const delay = Number(settings.delay) || 700;
    const maximumSteps = 5000;
    let step = 0;
    let direction = 0;
    let observedMin = Infinity;
    let observedMax = -Infinity;
    let previousView = null;
    let missingSince = null;
    let lastProgressAt = performance.now();
    let previousSignature = '';

    try {
      while (step < maximumSteps) {
        const stopped = interruption();
        if (stopped) {
          setStatus(stopped, {}, 'warning');
          return;
        }

        // Re-resolve the list after every wait. Discord can replace it while
        // loading or opening a thread, even without changing the URL.
        const scan = scanVisible();
        const scroller = scan.root && findScroller(scan.root);
        const now = performance.now();
        step += 1;

        const replaced = previousView && (scan.root !== previousView.root || scroller !== previousView.scroller);
        // Jumping to a message can replace the rows without replacing the list.
        const lostContinuity = previousView && !scan.ids.some((id) => previousView.ids.has(id));
        if (!scroller?.clientHeight || !scan.ids.length || lostContinuity) {
          missingSince ??= now;
          if (now - missingSince >= COLLECTION_STALL_MS) {
            if (previousView) setStatus('stalled', {}, 'warning');
            else if (scroller?.clientHeight) setStatus('noMessages', {}, 'warning');
            else setStatus('noScroller', {}, 'error');
            return;
          }
          setStatus('scanning');
          await sleep(delay);
          continue;
        }

        if (missingSince !== null || replaced) previousSignature = '';
        missingSince = null;
        previousView = { root: scan.root, scroller, ids: new Set(scan.ids) };
        observedMin = Math.min(observedMin, scan.minMs);
        observedMax = Math.max(observedMax, scan.maxMs);
        // Multiple snowflakes can have the exact start millisecond.
        if (scan.minMs < bounds.startMs) coverage[-1] = 'covered';
        if (scan.maxMs >= bounds.endExclusiveMs) coverage[1] = 'covered';

        if (coverage[-1] === 'covered' && coverage[1] === 'covered') {
          const messages = selectedRecords();
          setStatus('done', { count: messages.length }, 'success');
          if (settings.autoDownload && messages.length) {
            await downloadMessages(messages, () => !interruption());
            const interrupted = interruption();
            if (interrupted) setStatus(interrupted, {}, 'warning');
          }
          return;
        }

        direction ||= initialTraversalDirection(scan, bounds);
        if (coverage[direction] !== 'pending') direction = -direction;
        if (coverage[direction] !== 'pending') {
          setStatus('stalled', {}, 'warning');
          return;
        }

        const clippedStart = Math.max(bounds.startMs, Math.min(observedMin, bounds.endExclusiveMs));
        const clippedEnd = Math.min(bounds.endExclusiveMs, Math.max(observedMax, bounds.startMs));
        const covered = Math.max(0, clippedEnd - clippedStart);
        const percent = Math.max(0, Math.min(100, Math.round(
          (covered / (bounds.endExclusiveMs - bounds.startMs)) * 100
        )));
        const overlapsRange = scan.maxMs >= bounds.startMs && scan.minMs < bounds.endExclusiveMs;
        setStatus(overlapsRange ? 'collecting' : 'seeking', overlapsRange ? { percent } : {});

        const atEdge = direction < 0 ? isAtTop(scroller) : isAtBottom(scroller);
        const waitingForLatest = atEdge && direction > 0 && isWaitingForLatest(scan.root, scroller);
        const signature = `${direction}:${waitingForLatest}:${scrollSignature(scroller, scan)}`;
        if (signature !== previousSignature) {
          previousSignature = signature;
          lastProgressAt = now;
        }
        const stableFor = now - lastProgressAt;
        if (atEdge && (direction < 0
          ? hasChannelBeginning(scan.root) || scan.ids.includes(route.channelId)
          : !waitingForLatest && stableFor >= LATEST_SETTLE_MS)) {
          coverage[direction] = 'covered';
          continue;
        }

        const edgeId = direction < 0 ? scan.ids[0] : scan.ids.at(-1);
        const edgeKey = `${direction}:${edgeId}`;
        const boundary = findPaginationBoundary(scan.root, direction, `chat-messages-${route.channelId}-${edgeId}`);
        if (boundary) {
          let state = paginationByEdge.get(edgeKey);
          if (!state) {
            state = { attempts: 0, reenter: false, waitUntil: 0, scroller };
            paginationByEdge.set(edgeKey, state);
          }
          if (advancePagination(scroller, boundary, direction, state, now)) await sleep(delay);
          else coverage[direction] = 'incomplete';
          continue;
        }

        if (stableFor >= COLLECTION_STALL_MS) {
          coverage[direction] = 'incomplete';
          continue;
        }

        if (atEdge) jumpToLoadedEdge(scroller, direction);
        else moveScroller(scroller, direction);
        await sleep(delay);
      }

      setStatus(interruption() || 'stalled', {}, 'warning');
    } finally {
      if (activeJob === job) {
        activeJob = null;
        setRunning(false);
        updateCount();
      }
    }
  }

  function cancelAutomaticCollection() {
    if (activeJob) activeJob.cancelled = true;
  }

  function clearCurrentChannel() {
    const route = getRoute();
    if (!route) {
      setStatus('noChannel', {}, 'error');
      return;
    }

    if (!confirm(t('clearConfirm'))) return;

    for (const [key, record] of records.entries()) {
      if (record.guildId === route.guildId && record.channelId === route.channelId) records.delete(key);
    }

    updateCount();
    setStatus('cleared', {}, 'success');
  }

  function setStatus(key, values = {}, tone = 'normal') {
    lastStatus = { key, values, tone };
    if (!elements.status) return;
    elements.status.textContent = t(key, values);
    elements.status.dataset.tone = tone;
  }

  function option(value, text, selectedValue) {
    const selected = value === String(selectedValue) ? ' selected' : '';
    return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(text)}</option>`;
  }

  function panelMarkup() {
    const language = resolveLanguage();
    const languageOptions = [
      option('auto', t('auto'), settings.language),
      ...i18n.locales.map((code) => option(code, i18n.label(code), settings.language))
    ].join('');

    return `
      <style>
        :host{all:initial;color-scheme:dark}
        *,*::before,*::after{box-sizing:border-box}
        .panel{width:min(370px,calc(100vw - 24px));background:#1e1f22;color:#dbdee1;border:1px solid #3f4147;border-radius:12px;box-shadow:0 12px 36px #0009;font:13px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden}
        .header{display:flex;align-items:center;gap:8px;padding:10px 11px;background:#2b2d31;cursor:move;user-select:none}
        .title{font-size:13px;font-weight:750;flex:1;overflow-wrap:anywhere}.count{max-width:45%;font-size:11px;color:#b5bac1;overflow-wrap:anywhere}
        .icon{flex:0 0 25px;border:0;background:transparent;color:#b5bac1;width:25px;height:25px;border-radius:5px;cursor:pointer;font-size:16px;line-height:1}.icon:hover{background:#3f4147;color:#fff}
        .body{padding:11px;display:grid;gap:10px}.panel.minimized .body{display:none}.panel.minimized{width:min(330px,calc(100vw - 24px))}
        .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.field{display:grid;gap:4px;min-width:0}.field.wide{grid-column:1/-1}
        label{font-size:11px;font-weight:700;color:#b5bac1}
        input,select{width:100%;border:1px solid #4e5058;background:#111214;color:#f2f3f5;border-radius:6px;padding:7px 8px;font:12px system-ui,sans-serif;outline:none}
        input:focus,select:focus{border-color:#5865f2}input:disabled,select:disabled{opacity:.55}
        .check{grid-column:1/-1;display:flex;align-items:center;gap:7px;color:#dbdee1;font-size:12px;text-transform:none;letter-spacing:0;cursor:pointer}.check input{width:15px;height:15px;margin:0;accent-color:#5865f2}
        .hint{font-size:11px;color:#949ba4}.status{min-height:32px;border-radius:6px;background:#2b2d31;padding:8px;color:#c4c9ce;overflow-wrap:anywhere}
        .status[data-tone="success"]{background:#173c2d;color:#9fe6c2}.status[data-tone="warning"]{background:#473b1c;color:#f3d98b}.status[data-tone="error"]{background:#4a2024;color:#ffb2b9}
        .actions{display:flex;gap:6px;flex-wrap:wrap}.button{border:0;border-radius:6px;padding:8px 10px;cursor:pointer;font:700 12px system-ui,sans-serif;background:#4e5058;color:#fff;flex:1 1 auto}.button:hover{filter:brightness(1.12)}
        .button.primary{background:#5865f2}.button.danger{background:#da373c}.button.secondary{background:#383a40}.button[hidden]{display:none}.button:disabled{opacity:.5;cursor:not-allowed}
        @media(max-width:430px){.panel{width:calc(100vw - 16px)}.grid{grid-template-columns:1fr}.field.wide{grid-column:auto}}
      </style>
      <section class="panel" lang="${escapeHtml(language)}" dir="${i18n.direction(language)}">
        <div class="header">
          <div class="title">${t('title')}</div>
          <div class="count"></div>
          <button class="icon minimize" type="button" title="${t('minimize')}">−</button>
          <button class="icon close" type="button" title="${t('close')}">×</button>
        </div>
        <div class="body">
          <div class="grid">
            <div class="field wide"><label>${t('language')}</label><select class="language">${languageOptions}</select></div>
            <div class="field"><label>${t('startDate')}</label><input class="start-date" type="date" value="${settings.startDate}"></div>
            <div class="field"><label>${t('endDate')}</label><input class="end-date" type="date" value="${settings.endDate}"></div>
            <div class="field"><label>${t('format')}</label><select class="format">
              ${option('txt', t('txt'), settings.format)}${option('json', t('json'), settings.format)}
              ${option('csv', t('csv'), settings.format)}${option('html', t('html'), settings.format)}
            </select></div>
            <div class="field"><label>${t('delay')}</label><select class="delay">
              ${option('400', t('delayFast'), settings.delay)}${option('700', t('delayNormal'), settings.delay)}${option('1200', t('delaySafe'), settings.delay)}
            </select></div>
            <label class="check"><input class="auto-download" type="checkbox"${settings.autoDownload ? ' checked' : ''}>${t('autoDownload')}</label>
          </div>
          <div class="hint">${t('timezone', { zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'local' })}<br>${t('shortcut')}</div>
          <div class="status" data-tone="${lastStatus.tone || 'normal'}">${t(lastStatus.key, lastStatus.values)}</div>
          <div class="actions">
            <button class="button secondary scan" type="button">${t('scan')}</button>
            <button class="button primary fetch" type="button">${t('fetch')}</button>
            <button class="button danger cancel" type="button" hidden>${t('cancel')}</button>
          </div>
          <div class="actions">
            <button class="button copy" type="button">${t('copy')}</button>
            <button class="button download" type="button">${t('download')}</button>
            <button class="button secondary clear" type="button">${t('clear')}</button>
          </div>
        </div>
      </section>`;
  }

  function bindElements() {
    elements = {
      panel: shadow.querySelector('.panel'), header: shadow.querySelector('.header'), count: shadow.querySelector('.count'),
      language: shadow.querySelector('.language'), startDate: shadow.querySelector('.start-date'), endDate: shadow.querySelector('.end-date'),
      format: shadow.querySelector('.format'), delay: shadow.querySelector('.delay'), autoDownload: shadow.querySelector('.auto-download'), status: shadow.querySelector('.status'),
      scan: shadow.querySelector('.scan'), fetch: shadow.querySelector('.fetch'), cancel: shadow.querySelector('.cancel'),
      copy: shadow.querySelector('.copy'), download: shadow.querySelector('.download'), clear: shadow.querySelector('.clear'),
      minimize: shadow.querySelector('.minimize'), close: shadow.querySelector('.close')
    };

    elements.language.addEventListener('change', () => {
      settings.language = elements.language.value;
      saveSettings();
      renderPanel();
    });

    const updateDateSetting = () => {
      settings.startDate = elements.startDate.value;
      settings.endDate = elements.endDate.value;
      saveSettings();
      updateCount();
    };
    elements.startDate.addEventListener('change', updateDateSetting);
    elements.endDate.addEventListener('change', updateDateSetting);
    elements.format.addEventListener('change', () => {
      settings.format = elements.format.value;
      saveSettings();
    });
    elements.delay.addEventListener('change', () => {
      settings.delay = Number(elements.delay.value);
      saveSettings();
    });
    elements.autoDownload.addEventListener('change', () => {
      settings.autoDownload = elements.autoDownload.checked;
      saveSettings();
    });

    elements.scan.addEventListener('click', () => {
      setStatus('scanning');
      scanVisible();
      setStatus('done', { count: selectedRecords().length }, 'success');
    });
    elements.fetch.addEventListener('click', startAutomaticCollection);
    elements.cancel.addEventListener('click', cancelAutomaticCollection);
    elements.copy.addEventListener('click', copyExport);
    elements.download.addEventListener('click', downloadExport);
    elements.clear.addEventListener('click', clearCurrentChannel);
    elements.minimize.addEventListener('click', () => {
      isMinimized = !isMinimized;
      elements.panel.classList.toggle('minimized', isMinimized);
    });
    elements.close.addEventListener('click', () => {
      host.style.display = 'none';
    });

    makeDraggable();
    setRunning(Boolean(activeJob));
    elements.panel.classList.toggle('minimized', isMinimized);
    updateCount();
  }

  function makeDraggable() {
    let drag = null;

    elements.header.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button')) return;
      const rect = host.getBoundingClientRect();
      drag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
      elements.header.setPointerCapture(event.pointerId);
    });

    elements.header.addEventListener('pointermove', (event) => {
      if (!drag) return;
      const left = Math.max(4, Math.min(window.innerWidth - host.offsetWidth - 4, drag.left + event.clientX - drag.x));
      const top = Math.max(4, Math.min(window.innerHeight - host.offsetHeight - 4, drag.top + event.clientY - drag.y));
      host.style.left = `${left}px`;
      host.style.top = `${top}px`;
      host.style.right = 'auto';
      host.style.bottom = 'auto';
    });

    elements.header.addEventListener('pointerup', () => { drag = null; });
    elements.header.addEventListener('pointercancel', () => { drag = null; });
  }

  function renderPanel() {
    shadow.innerHTML = panelMarkup();
    bindElements();
  }

  function mountPanel() {
    document.getElementById(PANEL_ID)?.remove();
    host = document.createElement('div');
    host.id = PANEL_ID;
    host.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px)';
    shadow = host.attachShadow({ mode: 'open' });
    document.body.appendChild(host);
    renderPanel();
  }

  function togglePanel() {
    if (!host?.isConnected) mountPanel();
    host.style.display = host.style.display === 'none' ? '' : 'none';
  }

  function onKeyDown(event) {
    if (event.altKey && event.shiftKey && event.code === 'KeyD') {
      event.preventDefault();
      togglePanel();
    }
  }

  function destroy() {
    cancelAutomaticCollection();
    observer?.disconnect();
    clearTimeout(scanTimer);
    document.removeEventListener('keydown', onKeyDown, true);
    host?.remove();
    host = null;
    delete window[GLOBAL_KEY];
  }

  mountPanel();
  observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('keydown', onKeyDown, true);
  scanVisible();

  window[GLOBAL_KEY] = {
    version: VERSION,
    scan: scanVisible,
    start: startAutomaticCollection,
    cancel: cancelAutomaticCollection,
    count: () => selectedRecords().length,
    messages: () => selectedRecords().map((record) => ({ ...record })),
    text: () => textExport(selectedRecords()),
    download: downloadExport,
    show: () => { if (host) host.style.display = ''; },
    hide: () => { if (host) host.style.display = 'none'; },
    destroy
  };

  console.info('[Discord Chat Exporter] Ready. Alt + Shift + D toggles the panel.');
})();
