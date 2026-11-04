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

import { createCollector } from './collection.mjs';
import { createDiscordLabelParser } from './discord-dom-labels.mjs';
import { affectsMessageList, createDomReader, findScroller } from './dom-reader.mjs';
import { createExportFormats } from './export-formats.mjs';
import { createI18n } from './i18n/runtime.mjs';
import { createMediaTools } from './media.mjs';
import { createPanel } from './panel.mjs';
import { createRecordStore } from './records.mjs';
import { clean } from './text.mjs';

const GLOBAL_KEY = '__discordChatExporter';
const STORAGE_KEY = 'discord-chat-exporter:settings:v1';

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

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (_) {
    // Discord may block storage in hardened browser configurations.
  }
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

function parseLocalDate(value, nextDay = false) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return NaN;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]) + (nextDay ? 1 : 0);
  const date = new Date(year, month, day, 0, 0, 0, 0);
  return date.getTime();
}

export function installExporter(catalog, version) {
  if (window[GLOBAL_KEY]?.destroy) window[GLOBAL_KEY].destroy();

  const i18n = createI18n(catalog);
  const discordLabels = createDiscordLabelParser(clean);
  const mediaTools = createMediaTools(() => location.href);
  const reader = createDomReader(discordLabels, mediaTools);
  const records = createRecordStore(mediaTools);
  const formats = createExportFormats(version, discordLabels, mediaTools);
  const settings = loadSettings();
  let scanTimer = null;
  let structuralScanPending = false;
  let lastScan = null;
  let destroyed = false;

  const collector = createCollector({
    getRoute, getDateBounds, readView, setStatus, complete,
    getDelay: () => Number(settings.delay) || 700,
    setRunning(running) {
      panel.setRunning(running);
      if (!running) updateCount();
    }
  });

  const panel = createPanel({
    settings, i18n, resolveLanguage, t,
    actions: {
      scan: scanFromPanel, start: collector.start, cancel: collector.cancel,
      copy: copyExport, download: downloadExport, clear: clearCurrentChannel
    },
    updateSettings(changes) {
      Object.assign(settings, changes);
      saveSettings(settings);
    },
    refreshCount: updateCount
  });

  function resolveLanguage() {
    return i18n.resolveLanguage(settings.language, [...(navigator.languages || []), navigator.language]);
  }

  function t(key, values) {
    return i18n.translate(resolveLanguage(), key, values);
  }

  function translator(language) {
    return (key, values) => i18n.translate(language, key, values);
  }

  function setStatus(key, values, tone) {
    panel.setStatus(key, values, tone);
  }

  function getDateBounds(showError = false) {
    const startMs = parseLocalDate(settings.startDate, false);
    const endExclusiveMs = parseLocalDate(settings.endDate, true);
    const valid = Number.isFinite(startMs) && Number.isFinite(endExclusiveMs) && startMs < endExclusiveMs;

    if (!valid && showError) setStatus('badDates', {}, 'error');
    return valid ? { startMs, endExclusiveMs } : null;
  }

  function selectedRecords() {
    const bounds = getDateBounds();
    return bounds ? records.selectedRecords(getRoute(), bounds) : [];
  }

  function currentCount(route = getRoute()) {
    return records.count(route, getDateBounds());
  }

  function updateCount(route) {
    panel.setCount(currentCount(route));
  }

  function cancelQueuedScan() {
    clearTimeout(scanTimer);
    scanTimer = null;
    structuralScanPending = false;
  }

  function scanVisible() {
    // This scan supersedes earlier notifications, including a pending debounce.
    observer.takeRecords();
    contentObserver.takeRecords();
    cancelQueuedScan();
    const route = getRoute();
    const scan = reader.scan(route, (observed, hasContent) => records.save(route, observed, hasContent));
    if (!destroyed) {
      watchMessageList(scan.root);
      lastScan = { route, root: scan.root, path: location.pathname, title: document.title };
    }
    updateCount(route);
    return scan;
  }

  function readView() {
    const scan = scanVisible();
    return { ...scan, scroller: scan.root && findScroller(scan.root) };
  }

  function scanFromPanel() {
    setStatus('scanning');
    scanVisible();
    setStatus('done', { count: currentCount().selected }, 'success');
  }

  function scheduleStructuralScan(mutations) {
    const routeChanged = !lastScan || lastScan.path !== location.pathname || lastScan.title !== document.title;
    if (!routeChanged && (!lastScan.route || !affectsMessageList(lastScan.root, mutations))) return;
    queueScan(true);
  }

  function queueScan(structural = false) {
    // Attribute changes and media events must not postpone a structural scan:
    // Discord might unmount the newly rendered preview before the next scan.
    if (!structural && structuralScanPending) return;
    clearTimeout(scanTimer);
    structuralScanPending = structural;
    scanTimer = setTimeout(scanVisible, 150);
  }

  function onMediaReady(event) {
    // Responsive images and media can change currentSrc without an attribute mutation.
    if (event.target.matches?.('img[srcset], video, audio')) queueScan();
  }

  function watchMessageList(root) {
    const previous = lastScan?.root;
    if (root === previous) return;
    contentObserver.disconnect();
    previous?.removeEventListener('load', onMediaReady, true);
    previous?.removeEventListener('loadedmetadata', onMediaReady, true);
    if (root) {
      contentObserver.observe(root, { attributes: true, characterData: true, subtree: true });
      root.addEventListener('load', onMediaReady, true);
      root.addEventListener('loadedmetadata', onMediaReady, true);
    }
  }

  function complete(mayDownload) {
    const count = currentCount().selected;
    setStatus('done', { count }, 'success');
    if (settings.autoDownload && count) return downloadMessages(selectedRecords(), mayDownload);
  }

  function buildExport(format, messages) {
    const context = {};
    if (format === 'json' || format === 'html') {
      context.route = getRoute();
      context.dateRange = settings;
      context.generatedAt = new Date();
      context.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
    }
    if (format !== 'json' && format !== 'csv') {
      context.language = resolveLanguage();
      context.tr = translator(context.language);
      if (format === 'html') context.direction = i18n.direction(context.language);
    }
    return formats.buildExport(format, messages, context);
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

  function clearCurrentChannel() {
    const route = getRoute();
    if (!route) {
      setStatus('noChannel', {}, 'error');
      return;
    }

    if (!confirm(t('clearConfirm'))) return;

    records.clear(route);

    updateCount();
    setStatus('cleared', {}, 'success');
  }

  panel.mount();
  const observer = new MutationObserver(scheduleStructuralScan);
  // Watch in-place edits and media/reaction attributes only in the selected list.
  const contentObserver = new MutationObserver(() => queueScan());
  observer.observe(document.body, { childList: true, subtree: true });
  scanVisible();

  window[GLOBAL_KEY] = {
    version,
    scan: scanVisible,
    start: collector.start,
    cancel: collector.cancel,
    count: () => currentCount().selected,
    messages: () => selectedRecords().map((record) => ({ ...record })),
    text: () => formats.textExport(selectedRecords(), translator(resolveLanguage())),
    download: downloadExport,
    show: panel.show,
    hide: panel.hide,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      collector.cancel();
      observer.disconnect();
      watchMessageList(null);
      lastScan = null;
      cancelQueuedScan();
      panel.destroy();
      delete window[GLOBAL_KEY];
    }
  };

  console.info('[Discord Chat Exporter] Ready. Alt + Shift + D toggles the panel.');
}
