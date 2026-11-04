import { clean, uniqueStrings } from './text.mjs';

export const CHANNEL_WELCOME_SELECTOR = 'div:has(> [class*="emptyChannelIcon_"])';
const DISCORD_EPOCH = 1420070400000n;
const MESSAGE_LIST_SELECTOR = '[data-list-id^="chat-messages"]';
const LEGACY_LIST_SELECTOR = 'main [role="list"]';
const MESSAGE_ROW_SELECTOR = '[id^="chat-messages-"]';
const HIDDEN_SELECTOR = '[hidden], [aria-hidden="true"]';
const ATTACHMENT_SELECTOR = [
  'a[href*="cdn.discordapp.com/attachments/"]',
  'a[href*="media.discordapp.net/attachments/"]',
  'a[href*="cdn.discordapp.com/ephemeral-attachments/"]',
  'a[href*="media.discordapp.net/ephemeral-attachments/"]',
  'a[download][href]',
  'img[src*="/attachments/"]',
  'video[src*="/attachments/"]',
  'audio[src]'
].join(',');

export function affectsMessageList(root, mutations) {
  if (!root?.isConnected || root.closest(HIDDEN_SELECTOR)) return true;
  const listSelector = `${MESSAGE_LIST_SELECTOR}, ${LEGACY_LIST_SELECTOR}`;
  for (const { target, addedNodes, removedNodes } of mutations) {
    if (root.contains(target) || target.closest?.(listSelector)) return true;
    for (const nodes of [addedNodes, removedNodes]) {
      for (const node of nodes) {
        if (node.matches?.(listSelector) || node.querySelector?.(listSelector)) return true;
      }
    }
  }
  return false;
}

export function findScroller(root) {
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

export function createDomReader(discordLabels, mediaTools) {
  const { normalizeAssetUrl, normalizeEmojiAssetUrl, mediaTypeFromUrl, mergeMedia, mergeReactions } = mediaTools;

  function snowflakeToMilliseconds(id) {
    try {
      return Number((BigInt(id) >> 22n) + DISCORD_EPOCH);
    } catch (_) {
      return NaN;
    }
  }

  function getMessageRows(root) {
    const rows = [];
    for (const row of root.querySelectorAll(MESSAGE_ROW_SELECTOR)) {
      const match = row.id.match(/^chat-messages-(\d{15,25})-(\d{15,25})$/);
      if (!match || row.parentElement.closest(MESSAGE_ROW_SELECTOR)) continue;
      const [, channelId, id] = match;
      const article = row.querySelector('[role="article"]');
      // A welcome card can identify its list and mark the start of history,
      // but its synthetic message ID is just the channel ID.
      const isWelcome = id === channelId && row.parentElement === root && !article && row.matches(CHANNEL_WELCOME_SELECTOR);
      rows.push({ channelId, id, item: article || row, isWelcome });
    }
    return rows;
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

  function getAuthor(item, id, avatar) {
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

    return avatar ? discordLabels.avatarAuthor(avatar.alt) : '';
  }

  function findAvatar(item) {
    return [...item.querySelectorAll('img[class*="avatar"], img[src*="cdn.discordapp.com/avatars/"], img[src*="cdn.discordapp.com/embed/avatars/"]')]
      .find((image) => !image.closest('[id^="message-reply-context-"], [class*="repliedMessage"], [id^="message-accessories-"]'));
  }

  function getContentParts(content) {
    if (!content?.querySelector('img')) return [];
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
    item.querySelectorAll(ATTACHMENT_SELECTOR).forEach((node) => {
      if (node.closest('[id^="message-reply-context-"], [class*="repliedMessage"]')) return;
      const url = node.href || node.currentSrc || node.src || '';
      if (/^https?:\/\//i.test(url)) urls.push(url);
    });

    return uniqueStrings(urls);
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

  function findMessageList(route) {
    if (!route) return null;
    const chatLists = [...document.querySelectorAll(MESSAGE_LIST_SELECTOR)];
    const lists = (chatLists.length ? chatLists : [...document.querySelectorAll(LEGACY_LIST_SELECTOR)]
      .filter((list) => list.querySelector('[id^="chat-messages-"], [id^="message-content-"]')))
      .filter((list) => !list.closest(HIDDEN_SELECTOR));
    for (const root of lists) {
      const rows = getMessageRows(root);
      if (rows.some((row) => row.channelId === route.channelId)) return { root, rows };
      // Unkeyed legacy/empty lists can only be used if the choice is unambiguous.
      if (lists.length === 1 && !rows.length) return { root, rows };
    }
    return null;
  }

  function scan(route, saveRecord) {
    const list = findMessageList(route);
    if (!list) return { ids: [], minMs: NaN, maxMs: NaN, route, root: null };
    const { root, rows } = list;
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

      const avatarImage = findAvatar(item);
      const author = getAuthor(item, id, avatarImage);
      const avatar = normalizeAssetUrl(avatarImage?.currentSrc || avatarImage?.src || '');
      const authorGroupId = item.getAttribute('aria-labelledby')?.match(/\bmessage-username-(\d{15,25})\b/)?.[1];

      const contentParts = getContentParts(content);
      const text = getMessageText(content, contentParts);
      const reply = getReply(item, id);
      const forwarded = getForwarded(accessories);
      const embeds = getEmbeds(accessories || item);
      const attachments = getAttachments(accessories || item);
      const media = getMedia(accessories || item, attachments);
      const stickers = getStickers(accessories || item);
      const reactions = getReactions(item, id);

      saveRecord({
        id, author, avatar, authorGroupId, timestampMs, text, contentParts, reply,
        forwarded, embeds, attachments, media, stickers, reactions,
        edited: Boolean(item.querySelector('[class*="edited"]'))
      }, Boolean(content));

      ids.push(id);
      seen.add(id);
      minMs = Math.min(minMs, timestampMs);
      maxMs = Math.max(maxMs, timestampMs);
    }

    return {
      ids,
      minMs: ids.length ? minMs : NaN,
      maxMs: ids.length ? maxMs : NaN,
      route,
      root
    };
  }

  return { scan };
}
