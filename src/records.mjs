import { uniqueStrings } from './text.mjs';

function mergeArrays(next, old) {
  return next.length ? uniqueStrings([...(old || []), ...next]) : (old || []);
}

function inRange(timestampMs, bounds) {
  return timestampMs >= bounds.startMs && timestampMs < bounds.endExclusiveMs;
}

function compareSnowflakes(a, b) {
  if (a.id.length === b.id.length) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  const left = BigInt(a.id);
  const right = BigInt(b.id);
  return left < right ? -1 : left > right ? 1 : 0;
}

export function createRecordStore({ mergeAttachments, mergeMedia }) {
  const channels = new Map();
  let countCache = null;

  function save(route, observed, hasContent) {
    const { id, author, avatar, authorGroupId, timestampMs, text, contentParts, reply,
      forwarded, embeds, attachments, media, stickers, reactions, edited } = observed;
    let records = channels.get(route.key);
    if (!records) {
      records = new Map();
      channels.set(route.key, records);
    }
    const previous = records.get(id);
    const old = previous || {};
    records.set(id, {
      id,
      guildId: route.guildId,
      channelId: route.channelId,
      channelLabel: route.label || old.channelLabel || route.channelId,
      author: author || old.author || '',
      avatar: avatar || old.avatar || '',
      authorGroupId: authorGroupId || old.authorGroupId,
      timestamp: old.timestamp || new Date(timestampMs).toISOString(),
      timestampMs,
      text: hasContent ? text : (old.text || ''),
      contentParts: hasContent ? contentParts : (old.contentParts || []),
      reply: reply || old.reply || '',
      ...(forwarded.length || old.forwarded ? { forwarded: forwarded.length ? forwarded : old.forwarded } : {}),
      embeds: mergeArrays(embeds, old.embeds),
      attachments: mergeAttachments(attachments, old.attachments),
      media: mergeMedia(media, old.media),
      stickers: mergeArrays(stickers, old.stickers),
      reactions,
      edited: edited || Boolean(old.edited),
      url: `${route.url}/${id}`
    });
    // Rescans can change message data. The timestamp is fixed by its ID.
    if (!previous && countCache?.records === records && inRange(timestampMs, countCache.bounds)) {
      countCache.selected++;
    }
  }

  function selectedRecords(route, bounds) {
    const records = channels.get(route?.key);
    if (!records || !bounds) return [];
    const selected = [];
    for (const record of records.values()) {
      if (inRange(record.timestampMs, bounds)) selected.push(record);
    }
    return selected.sort(compareSnowflakes).map(({ authorGroupId, ...record }) => {
      const group = authorGroupId && records.get(authorGroupId);
      return { ...record, author: record.author || group?.author || '', avatar: record.avatar || group?.avatar || '' };
    });
  }

  function count(route, bounds) {
    const records = channels.get(route?.key);
    if (!records || !bounds) return { selected: 0, total: records?.size || 0 };

    if (countCache?.records !== records || countCache.bounds.startMs !== bounds.startMs ||
        countCache.bounds.endExclusiveMs !== bounds.endExclusiveMs) {
      let selected = 0;
      for (const record of records.values()) {
        if (inRange(record.timestampMs, bounds)) selected++;
      }
      countCache = { records, bounds, selected };
    }
    return { selected: countCache.selected, total: records.size };
  }

  function clear(route) {
    if (countCache?.records === channels.get(route.key)) countCache = null;
    channels.delete(route.key);
  }

  return { save, selectedRecords, count, clear };
}
