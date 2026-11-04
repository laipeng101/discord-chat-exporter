import { escapeHtml } from './text.mjs';

const PANEL_ID = 'discord-chat-exporter-host';

export function createPanel({ settings, i18n, resolveLanguage, t, actions, updateSettings, refreshCount }) {
  let host = null;
  let shadow = null;
  let elements = {};
  let lastStatus = { key: 'idle', values: {} };
  let isMinimized = false;
  let isRunning = false;

  function setRunning(running) {
    isRunning = running;
    if (!elements.fetch || !elements.cancel) return;
    elements.fetch.hidden = running;
    elements.cancel.hidden = !running;
    elements.startDate.disabled = running;
    elements.endDate.disabled = running;
    elements.delay.disabled = running;
    elements.clear.disabled = running;
  }

  function setCount(values) {
    if (!elements.count) return;
    const text = t('collected', values);
    if (elements.count.textContent !== text) elements.count.textContent = text;
  }

  function setStatus(key, values = {}, tone = 'normal') {
    lastStatus = { key, values, tone };
    if (!elements.status) return;
    const text = t(key, values);
    if (elements.status.textContent !== text) elements.status.textContent = text;
    if (elements.status.dataset.tone !== tone) elements.status.dataset.tone = tone;
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
      updateSettings({ language: elements.language.value });
      renderPanel();
    });

    const updateDateSetting = () => {
      updateSettings({ startDate: elements.startDate.value, endDate: elements.endDate.value });
      refreshCount();
    };
    elements.startDate.addEventListener('change', updateDateSetting);
    elements.endDate.addEventListener('change', updateDateSetting);
    elements.format.addEventListener('change', () => {
      updateSettings({ format: elements.format.value });
    });
    elements.delay.addEventListener('change', () => {
      updateSettings({ delay: Number(elements.delay.value) });
    });
    elements.autoDownload.addEventListener('change', () => {
      updateSettings({ autoDownload: elements.autoDownload.checked });
    });

    elements.scan.addEventListener('click', actions.scan);
    elements.fetch.addEventListener('click', actions.start);
    elements.cancel.addEventListener('click', actions.cancel);
    elements.copy.addEventListener('click', actions.copy);
    elements.download.addEventListener('click', actions.download);
    elements.clear.addEventListener('click', actions.clear);
    elements.minimize.addEventListener('click', () => {
      isMinimized = !isMinimized;
      elements.panel.classList.toggle('minimized', isMinimized);
    });
    elements.close.addEventListener('click', () => {
      host.style.display = 'none';
    });

    makeDraggable();
    setRunning(isRunning);
    elements.panel.classList.toggle('minimized', isMinimized);
    refreshCount();
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

  function mount() {
    mountPanel();
    document.addEventListener('keydown', onKeyDown, true);
  }

  function destroy() {
    document.removeEventListener('keydown', onKeyDown, true);
    host?.remove();
    host = null;
  }

  return {
    mount, destroy, setCount, setStatus, setRunning,
    show: () => { if (host) host.style.display = ''; },
    hide: () => { if (host) host.style.display = 'none'; }
  };
}
