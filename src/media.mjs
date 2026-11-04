import { clean } from './text.mjs';

export function createMediaTools(getBaseUrl) {
  function normalizeAssetUrl(value) {
    if (!/^https?:\/\//i.test(value || '')) return '';

    try {
      const parsed = new URL(value, getBaseUrl());
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
      const parsed = new URL(value, getBaseUrl());
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
      const source = new URL(value, getBaseUrl());
      const animated = source.searchParams.get('animated') === 'true' || /\.gif$/i.test(source.pathname);
      const parsed = new URL(`https://cdn.discordapp.com/emojis/${id}.webp`);
      if (animated) parsed.searchParams.set('animated', 'true');
      return parsed.href;
    } catch (_) {
      return '';
    }
  }

  function mediaTypeFromUrl(url, fallback = 'file') {
    let pathname = '';
    try {
      pathname = new URL(url, getBaseUrl()).pathname.toLowerCase();
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
      const parsed = new URL(url, getBaseUrl());
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
      const parsed = new URL(entry.url, getBaseUrl());
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
      const parsed = new URL(url, getBaseUrl());
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

  function mergeAttachments(next, old) {
    if (!next?.length && !old?.length) return [];
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
    if (!next?.length && !old?.length) return [];
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
    if (!next?.length && !old?.length) return [];
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

  return {
    normalizeAssetUrl, normalizeEmojiAssetUrl, mediaTypeFromUrl, mediaIdentity, preferMedia,
    mergeAttachments, mergeMedia, mergeReactions
  };
}
