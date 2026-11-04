// This source runs in the standalone HTML archive, outside the exporter.
export function archiveBootstrapSource() {
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
