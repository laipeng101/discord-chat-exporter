// ==UserScript==
// @name         Discord Chat Exporter - Date Range & Multi-language
// @name:zh-CN   Discord 聊天导出器 - 日期范围与多语言
// @name:zh-TW   Discord 聊天匯出器 - 日期範圍與多語言
// @name:ja      Discord チャットエクスポーター - 日付範囲・多言語
// @name:ko      Discord 채팅 내보내기 - 날짜 범위 및 다국어
// @name:es      Exportador de chats de Discord - Fechas e idiomas
// @name:fr      Exportateur de discussions Discord - Dates et langues
// @name:de      Discord-Chat-Exporter - Zeitraum und mehrsprachig
// @name:pt-BR   Exportador de chat do Discord - Período e idiomas
// @name:ru      Экспорт чата Discord — даты и языки
// @name:ar      مُصدِّر محادثات Discord - نطاق التاريخ واللغات
// @namespace    https://greasyfork.org/scripts/discord-chat-exporter
// @version      1.4.0
// @description  Export messages visible to your Discord account from the current channel. Supports automatic date-range scrolling, TXT/JSON/CSV/HTML, attachments, embeds, replies, reactions, and a multilingual panel. Data stays in your browser.
// @description:zh-CN 从当前 Discord 频道导出账号可见的消息。支持按日期自动滚动抓取、TXT/JSON/CSV/HTML、附件、嵌入、回复、反应和多语言面板；数据仅在浏览器本地处理。
// @description:zh-TW 從目前 Discord 頻道匯出帳號可見的訊息。支援依日期自動捲動擷取、TXT/JSON/CSV/HTML、附件、嵌入、回覆、反應及多語言面板；資料僅在瀏覽器本機處理。
// @description:ja 現在のDiscordチャンネルから閲覧可能なメッセージをエクスポート。日付範囲の自動スクロール、TXT/JSON/CSV/HTML、添付、埋め込み、返信、リアクション、多言語UIに対応。データはブラウザ内だけで処理します。
// @description:ko 현재 Discord 채널에서 계정이 볼 수 있는 메시지를 내보냅니다. 날짜 범위 자동 스크롤, TXT/JSON/CSV/HTML, 첨부 파일, 임베드, 답글, 반응, 다국어 패널을 지원하며 데이터는 브라우저에서만 처리됩니다.
// @description:es Exporta los mensajes visibles para tu cuenta del canal actual. Incluye desplazamiento automático por fechas, TXT/JSON/CSV/HTML, adjuntos, incrustaciones, respuestas, reacciones y panel multilingüe. Los datos permanecen en el navegador.
// @description:fr Exporte les messages visibles par votre compte dans le salon actuel. Défilement automatique par dates, TXT/JSON/CSV/HTML, pièces jointes, intégrations, réponses, réactions et interface multilingue. Les données restent dans le navigateur.
// @description:de Exportiert für Ihr Konto sichtbare Nachrichten aus dem aktuellen Kanal. Mit automatischem Datums-Scrollen, TXT/JSON/CSV/HTML, Anhängen, Einbettungen, Antworten, Reaktionen und mehrsprachiger Oberfläche. Daten bleiben im Browser.
// @description:pt-BR Exporta as mensagens visíveis para sua conta no canal atual. Inclui rolagem automática por período, TXT/JSON/CSV/HTML, anexos, incorporações, respostas, reações e painel multilíngue. Os dados ficam no navegador.
// @description:ru Экспортирует доступные вашей учётной записи сообщения текущего канала. Есть автопрокрутка по датам, TXT/JSON/CSV/HTML, вложения, вставки, ответы, реакции и многоязычная панель. Данные остаются в браузере.
// @description:ar يُصدّر الرسائل التي يستطيع حسابك رؤيتها من القناة الحالية، مع تمرير تلقائي حسب التاريخ وصيغ TXT/JSON/CSV/HTML والمرفقات والتضمينات والردود والتفاعلات ولوحة متعددة اللغات. تبقى البيانات داخل المتصفح.
// @match        https://discord.com/channels/*
// @match        https://ptb.discord.com/channels/*
// @match        https://canary.discord.com/channels/*
// @run-at       document-idle
// @grant        none
// @license      MIT
// @compatible   chrome
// @compatible   firefox
// @compatible   edge
// ==/UserScript==

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
  const VERSION = '1.4.0';

  if (window[GLOBAL_KEY]?.destroy) {
    window[GLOBAL_KEY].destroy();
  }

  const translations = {
    en: {
      title: 'Discord Chat Exporter', collected: '{selected} in range · {total} seen', messages: 'messages',
      searchPlaceholder: 'Search messages or authors…', showing: 'Showing {visible} of {total}', backToTop: 'Back to top',
      language: 'Language', startDate: 'Start date', endDate: 'End date', format: 'Format',
      delay: 'Scroll delay', autoDownload: 'Download automatically when finished', delayFast: 'Fast (400 ms)', delayNormal: 'Normal (700 ms)',
      delaySafe: 'Safe (1200 ms)', scan: 'Scan visible', fetch: 'Fetch date range',
      cancel: 'Cancel', copy: 'Copy', download: 'Download', clear: 'Clear channel',
      minimize: 'Minimize', close: 'Hide', timezone: 'Dates use your local time zone: {zone}',
      shortcut: 'Show/hide: Alt + Shift + D', idle: 'Watching the current channel.',
      scanning: 'Scanning visible messages…', seeking: 'Locating the date boundary… step {step}',
      collecting: 'Collecting the selected range… {percent}% · step {step}',
      done: 'Finished. {count} messages are ready.', cancelled: 'Collection cancelled.',
      noChannel: 'Open a Discord text channel first.', noScroller: 'Could not find the message list. Reload Discord and try again.',
      badDates: 'Choose a valid start and end date (start must not be after end).',
      noMessages: 'No collected messages match this date range.', copied: 'Copied {count} messages.',
      copyFailed: 'Clipboard access failed. Use Download instead.', downloaded: 'Downloaded {count} messages.',
      clearConfirm: 'Clear all collected messages for the current channel?', cleared: 'Current channel data cleared.',
      routeChanged: 'The channel changed, so automatic collection stopped.', stalled: 'Discord stopped loading more messages. Exported everything reached so far.',
      txt: 'Plain text (TXT)', json: 'Structured data (JSON)', csv: 'Spreadsheet (CSV)', html: 'Web page (HTML)',
      reply: 'Reply', embeds: 'Embeds', attachments: 'Attachments', reactions: 'Reactions',
      emptyText: '[No text content]', edited: 'edited', source: 'Source', messageId: 'Message ID'
    },
    'zh-CN': {
      title: 'Discord 聊天导出器', collected: '范围内 {selected} 条 · 已见 {total} 条', messages: '条消息',
      searchPlaceholder: '搜索消息或作者…', showing: '显示 {visible} / {total}', backToTop: '返回顶部',
      language: '语言', startDate: '开始日期', endDate: '结束日期', format: '导出格式',
      delay: '滚动等待', autoDownload: '完成后自动下载', delayFast: '快速（400 毫秒）', delayNormal: '标准（700 毫秒）',
      delaySafe: '稳妥（1200 毫秒）', scan: '扫描当前画面', fetch: '自动刷取日期范围',
      cancel: '取消', copy: '复制', download: '下载', clear: '清空本频道',
      minimize: '最小化', close: '隐藏', timezone: '日期按浏览器本地时区计算：{zone}',
      shortcut: '显示/隐藏：Alt + Shift + D', idle: '正在监听当前频道。',
      scanning: '正在扫描当前画面…', seeking: '正在双向定位日期边界… 第 {step} 步',
      collecting: '正在采集所选范围… {percent}% · 第 {step} 步',
      done: '完成，可导出 {count} 条消息。', cancelled: '已取消自动采集。',
      noChannel: '请先打开一个 Discord 文字频道。', noScroller: '找不到消息列表，请刷新 Discord 后重试。',
      badDates: '请选择有效的开始和结束日期，且开始日期不能晚于结束日期。',
      noMessages: '已采集内容中没有符合该日期范围的消息。', copied: '已复制 {count} 条消息。',
      copyFailed: '无法写入剪贴板，请改用“下载”。', downloaded: '已下载 {count} 条消息。',
      clearConfirm: '清空当前频道已经采集的全部消息？', cleared: '已清空当前频道数据。',
      routeChanged: '检测到频道已切换，自动采集已停止。', stalled: 'Discord 未继续加载消息，已保留目前采集到的内容。',
      txt: '纯文本（TXT）', json: '结构化数据（JSON）', csv: '表格（CSV）', html: '网页（HTML）',
      reply: '回复', embeds: '嵌入内容', attachments: '附件', reactions: '反应',
      emptyText: '[无文字内容]', edited: '已编辑', source: '来源', messageId: '消息 ID'
    },
    'zh-TW': {
      title: 'Discord 聊天匯出器', collected: '範圍內 {selected} 則 · 已見 {total} 則', messages: '則訊息',
      searchPlaceholder: '搜尋訊息或作者…', showing: '顯示 {visible} / {total}', backToTop: '返回頂端',
      language: '語言', startDate: '開始日期', endDate: '結束日期', format: '匯出格式',
      delay: '捲動等待', autoDownload: '完成後自動下載', delayFast: '快速（400 毫秒）', delayNormal: '標準（700 毫秒）',
      delaySafe: '穩妥（1200 毫秒）', scan: '掃描目前畫面', fetch: '自動擷取日期範圍',
      cancel: '取消', copy: '複製', download: '下載', clear: '清除本頻道',
      minimize: '最小化', close: '隱藏', timezone: '日期依瀏覽器本地時區計算：{zone}',
      shortcut: '顯示/隱藏：Alt + Shift + D', idle: '正在監看目前頻道。',
      scanning: '正在掃描目前畫面…', seeking: '正在雙向定位日期邊界… 第 {step} 步',
      collecting: '正在擷取所選範圍… {percent}% · 第 {step} 步',
      done: '完成，可匯出 {count} 則訊息。', cancelled: '已取消自動擷取。',
      noChannel: '請先開啟 Discord 文字頻道。', noScroller: '找不到訊息清單，請重新整理 Discord 後再試。',
      badDates: '請選擇有效的開始與結束日期，且開始日期不得晚於結束日期。',
      noMessages: '已擷取內容中沒有符合此日期範圍的訊息。', copied: '已複製 {count} 則訊息。',
      copyFailed: '無法寫入剪貼簿，請改用「下載」。', downloaded: '已下載 {count} 則訊息。',
      clearConfirm: '清除目前頻道已擷取的全部訊息？', cleared: '已清除目前頻道資料。',
      routeChanged: '偵測到頻道已切換，自動擷取已停止。', stalled: 'Discord 未繼續載入訊息，已保留目前擷取內容。',
      txt: '純文字（TXT）', json: '結構化資料（JSON）', csv: '試算表（CSV）', html: '網頁（HTML）',
      reply: '回覆', embeds: '嵌入內容', attachments: '附件', reactions: '反應',
      emptyText: '[無文字內容]', edited: '已編輯', source: '來源', messageId: '訊息 ID'
    },
    ja: {
      title: 'Discord チャットエクスポーター', collected: '範囲内 {selected} 件 · 検出 {total} 件', messages: '件のメッセージ',
      searchPlaceholder: 'メッセージまたは投稿者を検索…', showing: '{total} 件中 {visible} 件を表示', backToTop: '先頭へ戻る',
      language: '言語', startDate: '開始日', endDate: '終了日', format: '形式', delay: '待機時間', autoDownload: '完了時に自動ダウンロード',
      delayFast: '高速（400 ms）', delayNormal: '標準（700 ms）', delaySafe: '安全（1200 ms）',
      scan: '表示分をスキャン', fetch: '日付範囲を自動取得', cancel: 'キャンセル', copy: 'コピー',
      download: 'ダウンロード', clear: 'チャンネルを消去', minimize: '最小化', close: '非表示',
      timezone: '日付はローカルタイムゾーンを使用：{zone}', shortcut: '表示/非表示：Alt + Shift + D',
      idle: '現在のチャンネルを監視中。', scanning: '表示メッセージをスキャン中…',
      seeking: '日付境界を双方向に検索中… {step} ステップ',
      collecting: '選択範囲を収集中… {percent}% · {step} ステップ', done: '完了。{count} 件を出力できます。',
      cancelled: '収集をキャンセルしました。', noChannel: 'Discordのテキストチャンネルを開いてください。',
      noScroller: 'メッセージ一覧が見つかりません。再読み込みして再試行してください。',
      badDates: '有効な開始日と終了日を選択してください。', noMessages: 'この日付範囲に一致するメッセージはありません。',
      copied: '{count} 件をコピーしました。', copyFailed: 'コピーできません。ダウンロードを使用してください。',
      downloaded: '{count} 件をダウンロードしました。', clearConfirm: '現在のチャンネルの収集データを消去しますか？',
      cleared: 'チャンネルのデータを消去しました。', routeChanged: 'チャンネルが変わったため収集を停止しました。',
      stalled: 'Discordの読み込みが停止しました。到達済みの内容を保持します。',
      txt: 'テキスト（TXT）', json: '構造化データ（JSON）', csv: '表計算（CSV）', html: 'Webページ（HTML）',
      reply: '返信', embeds: '埋め込み', attachments: '添付', reactions: 'リアクション',
      emptyText: '[本文なし]', edited: '編集済み', source: 'ソース', messageId: 'メッセージID'
    },
    ko: {
      title: 'Discord 채팅 내보내기', collected: '범위 {selected}개 · 확인 {total}개', messages: '개 메시지',
      searchPlaceholder: '메시지 또는 작성자 검색…', showing: '{total}개 중 {visible}개 표시', backToTop: '맨 위로',
      language: '언어', startDate: '시작 날짜', endDate: '종료 날짜', format: '형식', delay: '스크롤 대기', autoDownload: '완료 후 자동 다운로드',
      delayFast: '빠름(400ms)', delayNormal: '보통(700ms)', delaySafe: '안전(1200ms)',
      scan: '보이는 내용 스캔', fetch: '날짜 범위 자동 수집', cancel: '취소', copy: '복사', download: '다운로드',
      clear: '현재 채널 지우기', minimize: '최소화', close: '숨기기',
      timezone: '날짜는 현지 시간대 기준: {zone}', shortcut: '표시/숨기기: Alt + Shift + D', idle: '현재 채널을 감시 중입니다.',
      scanning: '보이는 메시지 스캔 중…', seeking: '날짜 경계를 양방향으로 찾는 중… {step}단계',
      collecting: '선택 범위 수집 중… {percent}% · {step}단계', done: '완료. {count}개 메시지를 내보낼 수 있습니다.',
      cancelled: '수집이 취소되었습니다.', noChannel: 'Discord 텍스트 채널을 먼저 여세요.',
      noScroller: '메시지 목록을 찾지 못했습니다. Discord를 새로고침하세요.', badDates: '올바른 시작일과 종료일을 선택하세요.',
      noMessages: '이 날짜 범위에 맞는 수집 메시지가 없습니다.', copied: '{count}개 메시지를 복사했습니다.',
      copyFailed: '클립보드에 쓸 수 없습니다. 다운로드를 이용하세요.', downloaded: '{count}개 메시지를 다운로드했습니다.',
      clearConfirm: '현재 채널에서 수집한 메시지를 모두 지울까요?', cleared: '현재 채널 데이터를 지웠습니다.',
      routeChanged: '채널이 바뀌어 자동 수집을 중지했습니다.', stalled: 'Discord가 더 이상 불러오지 않아 현재까지의 내용을 보존했습니다.',
      txt: '일반 텍스트(TXT)', json: '구조화 데이터(JSON)', csv: '스프레드시트(CSV)', html: '웹 페이지(HTML)',
      reply: '답글', embeds: '임베드', attachments: '첨부 파일', reactions: '반응',
      emptyText: '[텍스트 없음]', edited: '수정됨', source: '출처', messageId: '메시지 ID'
    },
    es: {
      title: 'Exportador de chats de Discord', collected: '{selected} en el rango · {total} vistos', messages: 'mensajes',
      searchPlaceholder: 'Buscar mensajes o autores…', showing: 'Mostrando {visible} de {total}', backToTop: 'Volver arriba',
      language: 'Idioma', startDate: 'Fecha inicial', endDate: 'Fecha final', format: 'Formato', delay: 'Espera al desplazar', autoDownload: 'Descargar automáticamente al terminar',
      delayFast: 'Rápida (400 ms)', delayNormal: 'Normal (700 ms)', delaySafe: 'Segura (1200 ms)',
      scan: 'Escanear visibles', fetch: 'Obtener rango de fechas', cancel: 'Cancelar', copy: 'Copiar', download: 'Descargar',
      clear: 'Vaciar canal', minimize: 'Minimizar', close: 'Ocultar', timezone: 'Las fechas usan tu zona local: {zone}',
      shortcut: 'Mostrar/ocultar: Alt + Mayús + D', idle: 'Vigilando el canal actual.', scanning: 'Escaneando mensajes visibles…',
      seeking: 'Localizando el límite de fecha en ambas direcciones… paso {step}', collecting: 'Recopilando el rango… {percent}% · paso {step}',
      done: 'Terminado. Hay {count} mensajes listos.', cancelled: 'Recopilación cancelada.',
      noChannel: 'Abre primero un canal de texto de Discord.', noScroller: 'No se encontró la lista de mensajes. Recarga Discord.',
      badDates: 'Elige fechas válidas; la inicial no puede ser posterior a la final.', noMessages: 'No hay mensajes recopilados en este rango.',
      copied: 'Se copiaron {count} mensajes.', copyFailed: 'No se pudo usar el portapapeles. Usa Descargar.',
      downloaded: 'Se descargaron {count} mensajes.', clearConfirm: '¿Borrar los mensajes recopilados del canal actual?',
      cleared: 'Se borraron los datos del canal actual.', routeChanged: 'El canal cambió y se detuvo la recopilación.',
      stalled: 'Discord dejó de cargar. Se conservó todo lo alcanzado.',
      txt: 'Texto (TXT)', json: 'Datos estructurados (JSON)', csv: 'Hoja de cálculo (CSV)', html: 'Página web (HTML)',
      reply: 'Respuesta', embeds: 'Incrustaciones', attachments: 'Adjuntos', reactions: 'Reacciones',
      emptyText: '[Sin texto]', edited: 'editado', source: 'Origen', messageId: 'ID del mensaje'
    },
    fr: {
      title: 'Exportateur de discussions Discord', collected: '{selected} dans la période · {total} vus', messages: 'messages',
      searchPlaceholder: 'Rechercher des messages ou auteurs…', showing: '{visible} sur {total} affichés', backToTop: 'Retour en haut',
      language: 'Langue', startDate: 'Date de début', endDate: 'Date de fin', format: 'Format', delay: 'Délai de défilement', autoDownload: 'Télécharger automatiquement à la fin',
      delayFast: 'Rapide (400 ms)', delayNormal: 'Normal (700 ms)', delaySafe: 'Prudent (1200 ms)',
      scan: 'Analyser l’écran', fetch: 'Récupérer la période', cancel: 'Annuler', copy: 'Copier', download: 'Télécharger',
      clear: 'Effacer le salon', minimize: 'Réduire', close: 'Masquer', timezone: 'Dates selon votre fuseau local : {zone}',
      shortcut: 'Afficher/masquer : Alt + Maj + D', idle: 'Surveillance du salon actuel.', scanning: 'Analyse des messages visibles…',
      seeking: 'Recherche bidirectionnelle de la limite de date… étape {step}', collecting: 'Collecte de la période… {percent}% · étape {step}',
      done: 'Terminé. {count} messages sont prêts.', cancelled: 'Collecte annulée.',
      noChannel: 'Ouvrez d’abord un salon textuel Discord.', noScroller: 'Liste des messages introuvable. Rechargez Discord.',
      badDates: 'Choisissez des dates valides, dans le bon ordre.', noMessages: 'Aucun message collecté ne correspond à cette période.',
      copied: '{count} messages copiés.', copyFailed: 'Échec du presse-papiers. Utilisez Télécharger.',
      downloaded: '{count} messages téléchargés.', clearConfirm: 'Effacer les messages collectés pour ce salon ?',
      cleared: 'Données du salon effacées.', routeChanged: 'Le salon a changé, la collecte est arrêtée.',
      stalled: 'Discord ne charge plus. Les messages atteints ont été conservés.',
      txt: 'Texte brut (TXT)', json: 'Données structurées (JSON)', csv: 'Tableur (CSV)', html: 'Page web (HTML)',
      reply: 'Réponse', embeds: 'Intégrations', attachments: 'Pièces jointes', reactions: 'Réactions',
      emptyText: '[Aucun texte]', edited: 'modifié', source: 'Source', messageId: 'ID du message'
    },
    de: {
      title: 'Discord-Chat-Exporter', collected: '{selected} im Zeitraum · {total} gesehen', messages: 'Nachrichten',
      searchPlaceholder: 'Nachrichten oder Autoren suchen…', showing: '{visible} von {total} angezeigt', backToTop: 'Nach oben',
      language: 'Sprache', startDate: 'Startdatum', endDate: 'Enddatum', format: 'Format', delay: 'Scroll-Wartezeit', autoDownload: 'Nach Abschluss automatisch herunterladen',
      delayFast: 'Schnell (400 ms)', delayNormal: 'Normal (700 ms)', delaySafe: 'Sicher (1200 ms)',
      scan: 'Sichtbares scannen', fetch: 'Zeitraum abrufen', cancel: 'Abbrechen', copy: 'Kopieren', download: 'Herunterladen',
      clear: 'Kanal leeren', minimize: 'Minimieren', close: 'Ausblenden', timezone: 'Daten verwenden Ihre lokale Zeitzone: {zone}',
      shortcut: 'Ein-/ausblenden: Alt + Umschalt + D', idle: 'Aktueller Kanal wird beobachtet.', scanning: 'Sichtbare Nachrichten werden erfasst…',
      seeking: 'Datumsgrenze wird in beide Richtungen gesucht… Schritt {step}', collecting: 'Zeitraum wird erfasst… {percent}% · Schritt {step}',
      done: 'Fertig. {count} Nachrichten sind bereit.', cancelled: 'Erfassung abgebrochen.',
      noChannel: 'Öffnen Sie zuerst einen Discord-Textkanal.', noScroller: 'Nachrichtenliste nicht gefunden. Laden Sie Discord neu.',
      badDates: 'Wählen Sie gültige Daten in der richtigen Reihenfolge.', noMessages: 'Keine erfasste Nachricht passt zum Zeitraum.',
      copied: '{count} Nachrichten kopiert.', copyFailed: 'Zwischenablage fehlgeschlagen. Nutzen Sie Herunterladen.',
      downloaded: '{count} Nachrichten heruntergeladen.', clearConfirm: 'Erfasste Nachrichten dieses Kanals löschen?',
      cleared: 'Kanaldaten gelöscht.', routeChanged: 'Der Kanal wurde gewechselt; die Erfassung wurde beendet.',
      stalled: 'Discord lädt nicht weiter. Alle erreichten Inhalte bleiben erhalten.',
      txt: 'Text (TXT)', json: 'Strukturierte Daten (JSON)', csv: 'Tabelle (CSV)', html: 'Webseite (HTML)',
      reply: 'Antwort', embeds: 'Einbettungen', attachments: 'Anhänge', reactions: 'Reaktionen',
      emptyText: '[Kein Text]', edited: 'bearbeitet', source: 'Quelle', messageId: 'Nachrichten-ID'
    },
    'pt-BR': {
      title: 'Exportador de chat do Discord', collected: '{selected} no período · {total} vistos', messages: 'mensagens',
      searchPlaceholder: 'Buscar mensagens ou autores…', showing: 'Mostrando {visible} de {total}', backToTop: 'Voltar ao topo',
      language: 'Idioma', startDate: 'Data inicial', endDate: 'Data final', format: 'Formato', delay: 'Espera da rolagem', autoDownload: 'Baixar automaticamente ao concluir',
      delayFast: 'Rápida (400 ms)', delayNormal: 'Normal (700 ms)', delaySafe: 'Segura (1200 ms)',
      scan: 'Ler mensagens visíveis', fetch: 'Buscar período', cancel: 'Cancelar', copy: 'Copiar', download: 'Baixar',
      clear: 'Limpar canal', minimize: 'Minimizar', close: 'Ocultar', timezone: 'As datas usam seu fuso local: {zone}',
      shortcut: 'Mostrar/ocultar: Alt + Shift + D', idle: 'Observando o canal atual.', scanning: 'Lendo mensagens visíveis…',
      seeking: 'Localizando o limite de data nas duas direções… etapa {step}', collecting: 'Coletando o período… {percent}% · etapa {step}',
      done: 'Concluído. {count} mensagens prontas.', cancelled: 'Coleta cancelada.',
      noChannel: 'Abra primeiro um canal de texto do Discord.', noScroller: 'Lista de mensagens não encontrada. Recarregue o Discord.',
      badDates: 'Escolha datas válidas na ordem correta.', noMessages: 'Nenhuma mensagem coletada corresponde ao período.',
      copied: '{count} mensagens copiadas.', copyFailed: 'Falha na área de transferência. Use Baixar.',
      downloaded: '{count} mensagens baixadas.', clearConfirm: 'Limpar as mensagens coletadas deste canal?',
      cleared: 'Dados do canal limpos.', routeChanged: 'O canal mudou e a coleta foi interrompida.',
      stalled: 'O Discord parou de carregar. Tudo que foi alcançado foi preservado.',
      txt: 'Texto simples (TXT)', json: 'Dados estruturados (JSON)', csv: 'Planilha (CSV)', html: 'Página web (HTML)',
      reply: 'Resposta', embeds: 'Incorporações', attachments: 'Anexos', reactions: 'Reações',
      emptyText: '[Sem texto]', edited: 'editado', source: 'Origem', messageId: 'ID da mensagem'
    },
    ru: {
      title: 'Экспорт чата Discord', collected: 'В диапазоне: {selected} · просмотрено: {total}', messages: 'сообщений',
      searchPlaceholder: 'Поиск сообщений или авторов…', showing: 'Показано {visible} из {total}', backToTop: 'Наверх',
      language: 'Язык', startDate: 'Начальная дата', endDate: 'Конечная дата', format: 'Формат', delay: 'Задержка прокрутки', autoDownload: 'Скачать автоматически после завершения',
      delayFast: 'Быстро (400 мс)', delayNormal: 'Обычно (700 мс)', delaySafe: 'Надёжно (1200 мс)',
      scan: 'Сканировать видимое', fetch: 'Собрать диапазон', cancel: 'Отмена', copy: 'Копировать', download: 'Скачать',
      clear: 'Очистить канал', minimize: 'Свернуть', close: 'Скрыть', timezone: 'Даты используют ваш часовой пояс: {zone}',
      shortcut: 'Показать/скрыть: Alt + Shift + D', idle: 'Наблюдение за текущим каналом.', scanning: 'Сканирование видимых сообщений…',
      seeking: 'Двунаправленный поиск границы даты… шаг {step}', collecting: 'Сбор диапазона… {percent}% · шаг {step}',
      done: 'Готово. К экспорту доступно сообщений: {count}.', cancelled: 'Сбор отменён.',
      noChannel: 'Сначала откройте текстовый канал Discord.', noScroller: 'Список сообщений не найден. Перезагрузите Discord.',
      badDates: 'Выберите допустимые даты в правильном порядке.', noMessages: 'Нет собранных сообщений за этот период.',
      copied: 'Скопировано сообщений: {count}.', copyFailed: 'Буфер обмена недоступен. Используйте скачивание.',
      downloaded: 'Скачано сообщений: {count}.', clearConfirm: 'Удалить собранные сообщения текущего канала?',
      cleared: 'Данные текущего канала удалены.', routeChanged: 'Канал изменился, сбор остановлен.',
      stalled: 'Discord перестал загружать. Всё достигнутое сохранено.',
      txt: 'Текст (TXT)', json: 'Структурированные данные (JSON)', csv: 'Таблица (CSV)', html: 'Веб-страница (HTML)',
      reply: 'Ответ', embeds: 'Вставки', attachments: 'Вложения', reactions: 'Реакции',
      emptyText: '[Нет текста]', edited: 'изменено', source: 'Источник', messageId: 'ID сообщения'
    },
    ar: {
      title: 'مُصدِّر محادثات Discord', collected: '{selected} ضمن النطاق · شوهد {total}', messages: 'رسالة',
      searchPlaceholder: 'البحث في الرسائل أو الكتّاب…', showing: 'عرض {visible} من {total}', backToTop: 'العودة للأعلى',
      language: 'اللغة', startDate: 'تاريخ البدء', endDate: 'تاريخ الانتهاء', format: 'الصيغة', delay: 'مهلة التمرير', autoDownload: 'تنزيل تلقائي عند الاكتمال',
      delayFast: 'سريع (400 مللي ثانية)', delayNormal: 'عادي (700 مللي ثانية)', delaySafe: 'آمن (1200 مللي ثانية)',
      scan: 'مسح الظاهر', fetch: 'جمع نطاق التاريخ', cancel: 'إلغاء', copy: 'نسخ', download: 'تنزيل',
      clear: 'مسح القناة', minimize: 'تصغير', close: 'إخفاء', timezone: 'تستخدم التواريخ منطقتك الزمنية: {zone}',
      shortcut: 'إظهار/إخفاء: Alt + Shift + D', idle: 'تتم مراقبة القناة الحالية.', scanning: 'جارٍ مسح الرسائل الظاهرة…',
      seeking: 'جارٍ تحديد حد التاريخ في الاتجاهين… الخطوة {step}', collecting: 'جارٍ جمع النطاق… {percent}% · الخطوة {step}',
      done: 'اكتمل. {count} رسالة جاهزة.', cancelled: 'أُلغي الجمع.', noChannel: 'افتح قناة نصية في Discord أولاً.',
      noScroller: 'تعذر العثور على قائمة الرسائل. أعد تحميل Discord.', badDates: 'اختر تاريخي بدء وانتهاء صالحين بالترتيب الصحيح.',
      noMessages: 'لا توجد رسائل مجمعة تطابق هذا النطاق.', copied: 'تم نسخ {count} رسالة.',
      copyFailed: 'تعذر استخدام الحافظة. استخدم التنزيل.', downloaded: 'تم تنزيل {count} رسالة.',
      clearConfirm: 'هل تريد مسح الرسائل المجمعة للقناة الحالية؟', cleared: 'تم مسح بيانات القناة الحالية.',
      routeChanged: 'تغيرت القناة، لذلك توقف الجمع.', stalled: 'توقف Discord عن التحميل. تم حفظ كل ما تم الوصول إليه.',
      txt: 'نص عادي (TXT)', json: 'بيانات منظمة (JSON)', csv: 'جدول (CSV)', html: 'صفحة ويب (HTML)',
      reply: 'رد', embeds: 'تضمينات', attachments: 'مرفقات', reactions: 'تفاعلات',
      emptyText: '[لا يوجد نص]', edited: 'معدّل', source: 'المصدر', messageId: 'معرّف الرسالة'
    }
  };

  const supportedLanguages = Object.keys(translations);
  const records = new Map();
  const authorAssets = new Map();
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

  function resolveLanguage(value = settings.language) {
    if (value && value !== 'auto' && supportedLanguages.includes(value)) return value;

    const browser = String(navigator.language || 'en').replace('_', '-');
    if (/^zh-(TW|HK|MO|Hant)/i.test(browser)) return 'zh-TW';
    if (/^zh/i.test(browser)) return 'zh-CN';
    if (/^pt/i.test(browser)) return 'pt-BR';

    const base = browser.split('-')[0].toLowerCase();
    return supportedLanguages.includes(base) ? base : 'en';
  }

  function t(key, values = {}) {
    const language = resolveLanguage();
    const template = translations[language]?.[key] ?? translations.en[key] ?? key;
    return String(template).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
  }

  function clean(value) {
    return String(value || '')
      .replace(/\u200B/g, '')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function cleanAuthorLabel(value) {
    let author = clean(value).replace(/\u00A0/g, ' ');
    const serverTagPattern = /(?:,\s*)?(?:server\s*tag|服务器标签|伺服器標籤|サーバータグ|서버\s*태그|etiqueta\s+del\s+servidor|balise\s+du\s+serveur|server-tag|tag\s+do\s+servidor|тег\s+сервера|علامة\s+الخادم)\s*[:：].*$/i;
    const containedServerTag = serverTagPattern.test(author);
    author = author.replace(serverTagPattern, '').trim();

    if (containedServerTag) {
      author = author.replace(/\s*\[[^\]\n]{1,24}\]\s*,?\s*$/, '').trim();
    }

    return author;
  }

  function uniqueStrings(values) {
    return [...new Set(values.map(clean).filter(Boolean))];
  }

  function getRoute() {
    const match = location.pathname.match(/^\/channels\/([^/]+)\/([^/?#]+)/);
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

  function getMessageId(content, item) {
    return (
      content?.id?.match(/(\d{15,25})$/) ||
      item?.id?.match(/(\d{15,25})$/) ||
      []
    )[1] || '';
  }

  function getMessageItem(content) {
    return content.closest('[id^="chat-messages-"]') ||
      content.closest('[role="article"]') ||
      content.parentElement;
  }

  function getAuthor(item) {
    if (!item) return '';

    const username = item.querySelector('h3 [class*="username"]') ||
      item.querySelector('[id^="message-username-"]') ||
      item.querySelector('[class*="headerText"] [class*="username"]');

    if (username) {
      const clone = username.cloneNode(true);
      clone.querySelectorAll(
        '[class*="clanTag"], [class*="guildTag"], [class*="chiplet"], [class*="roleIcon"], [class*="botTag"]'
      ).forEach((node) => node.remove());
      clone.querySelectorAll('[aria-label]').forEach((node) => {
        if (cleanAuthorLabel(node.getAttribute('aria-label')) !== clean(node.getAttribute('aria-label'))) node.remove();
      });

      const directText = [...clone.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join(' ');
      const author = cleanAuthorLabel(directText || clone.textContent);
      if (author) return author;
    }

    const avatar = item.querySelector('img[class*="avatar"][alt]');
    return avatar ? cleanAuthorLabel(avatar.alt).replace(
      /,?\s*(?:avatar|头像|頭像|アバター|아바타|avatar\s+del\s+usuario|аватар)\s*$/i,
      ''
    ).trim() : '';
  }

  function normalizeAssetUrl(value) {
    if (!/^https?:\/\//i.test(value || '')) return '';

    try {
      const parsed = new URL(value, location.href);
      if (/discordapp\.(?:com|net)$/i.test(parsed.hostname)) {
        ['size', 'width', 'height', 'quality'].forEach((key) => parsed.searchParams.delete(key));
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

  function getAvatar(item) {
    if (!item) return '';
    const image = item.querySelector(
      'img[class*="avatar"][src], img[src*="cdn.discordapp.com/avatars/"], img[src*="cdn.discordapp.com/embed/avatars/"]'
    );
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

  function getReply(item) {
    if (!item) return '';
    const reply = item.querySelector('[class*="repliedMessage"]') ||
      item.querySelector('[class*="replying"]');
    return reply ? clean(reply.innerText || reply.textContent) : '';
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
      'a[download][href]',
      'img[src*="/attachments/"]',
      'video[src*="/attachments/"]',
      'audio[src]'
    ];

    item.querySelectorAll(selectors.join(',')).forEach((node) => {
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

      if (attachment) {
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

  function getMedia(item, attachments = []) {
    if (!item) return [];

    const media = [];
    const add = (url, type, alt = '', poster = '') => {
      if (!/^https?:\/\//i.test(url || '')) return;
      media.push({ url, type: mediaTypeFromUrl(url, type), alt: clean(alt), poster });
    };

    item.querySelectorAll('img[src], video, audio').forEach((node) => {
      const tag = node.tagName.toLowerCase();
      const url = node.currentSrc || node.src || node.querySelector?.('source[src]')?.src || '';

      if (tag === 'img') {
        if (node.closest('[class*="avatar"], [class*="emoji"], [class*="reaction"]')) return;
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

  function getReactions(item) {
    if (!item) return [];

    let roots = [...item.querySelectorAll('button[class*="reaction"], [class*="reaction"][role="button"]')];
    if (!roots.length) roots = [...item.querySelectorAll('[class*="reactionInner"]')];
    roots = roots.filter((node, index) => roots.indexOf(node) === index);

    const addReactionPattern = /(?:add|添加|新增|追加|추가|agregar|ajouter|hinzufügen|adicionar|добавить|إضافة).*?(?:reaction|反应|反應|リアクション|반응|reacción|réaction|reaktion|reação|реакц|تفاعل)/i;
    const reactions = [];

    for (const root of roots) {
      const label = clean(root.getAttribute('aria-label') || '').replace(/\s+/g, ' ');
      if (addReactionPattern.test(label)) continue;

      const image = root.querySelector('img[class*="emoji"], img[alt]');
      const countNode = root.querySelector('[class*="reactionCount"], [class*="count"]');
      const directCount = clean(countNode?.textContent || '').replace(/[,\s]/g, '').match(/\d+/);
      const labelledCount = label.match(/[,，]\s*([\d,.]+)\s*(?:reactions?|个反应|個反應|件のリアクション|개의 반응|reacciones?|réactions?|reaktionen?|reações?|реакц|تفاعل)/i);
      const count = Number((directCount?.[0] || labelledCount?.[1] || '1').replace(/[,\s]/g, '')) || 1;
      const emoji = clean(image?.alt || label.split(/[,，]\s*\d/)[0] || root.textContent)
        .replace(/^:+|:+$/g, '')
        .replace(/\s+/g, ' ');
      // Discord renders standard Unicode emoji through hashed web-client SVG
      // assets. Those build URLs are not stable archive resources, so only
      // keep an image URL when it is a real custom emoji CDN endpoint.
      const url = normalizeEmojiAssetUrl(image?.currentSrc || image?.src || '');

      if (!emoji && !url) continue;
      reactions.push({ emoji: emoji || 'reaction', count: Number.isFinite(count) ? count : 1, url, me: root.getAttribute('aria-pressed') === 'true' });
    }

    return mergeReactions(reactions, []);
  }

  function findMessageRoot() {
    const direct = document.querySelector('[data-list-id="chat-messages"]') ||
      document.querySelector('[data-list-id^="chat-messages"]');
    if (direct) return direct;

    const lists = [...document.querySelectorAll('main ol[role="list"], main [role="list"]')];
    return lists.find((list) => list.querySelector('[id^="message-content-"]')) || null;
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
      if (!existing || mediaPreference(candidate) > mediaPreference(existing)) merged.set(identity, candidate);
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
          (ranks[normalized.type] === ranks[existing.type] && mediaPreference(normalized) > mediaPreference(existing))) {
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

    const contents = [...root.querySelectorAll('[id^="message-content-"]')];
    const ids = [];
    let activeAuthor = '';
    let activeAvatar = '';

    for (const content of contents) {
      const item = getMessageItem(content);
      const id = getMessageId(content, item);
      const timestampMs = snowflakeToMilliseconds(id);
      if (!id || !Number.isFinite(timestampMs)) continue;

      const recordKey = `${route.key}:${id}`;
      const old = records.get(recordKey) || {};
      const foundAuthor = getAuthor(item);
      const author = foundAuthor || old.author || activeAuthor || '';
      const foundAvatar = getAvatar(item);
      const assetKey = `${route.key}:${author}`;
      if (author && foundAvatar) authorAssets.set(assetKey, foundAvatar);
      const avatar = foundAvatar || old.avatar || authorAssets.get(assetKey) || (author === activeAuthor ? activeAvatar : '') || '';
      if (author) {
        activeAuthor = author;
        if (avatar) activeAvatar = avatar;
      }

      const contentParts = getContentParts(content);
      const richText = clean(contentParts.map((part) => typeof part === 'string' ? part : part.name).join(''));
      const text = richText || clean(content.innerText || content.textContent);
      const reply = getReply(item);
      const embeds = getEmbeds(item);
      const attachments = getAttachments(item);
      const media = getMedia(item, attachments);
      const stickers = getStickers(item);
      const reactions = getReactions(item);

      records.set(recordKey, {
        id,
        guildId: route.guildId,
        channelId: route.channelId,
        channelLabel: route.label || old.channelLabel || route.channelId,
        author,
        avatar,
        timestamp: new Date(timestampMs).toISOString(),
        timestampMs,
        text: text || old.text || '',
        contentParts: contentParts.length ? contentParts : (old.contentParts || []),
        reply: reply || old.reply || '',
        embeds: mergeArrays(embeds, old.embeds),
        attachments: mergeAttachments(attachments, old.attachments),
        media: mergeMedia(media, old.media),
        stickers: mergeArrays(stickers, old.stickers),
        reactions: mergeReactions(reactions, old.reactions),
        edited: Boolean(item?.querySelector('[class*="edited"]')) || Boolean(old.edited),
        url: `${route.url}/${id}`
      });

      ids.push(id);
    }

    updateCount();

    const times = ids.map(snowflakeToMilliseconds).filter(Number.isFinite);
    return {
      ids,
      minMs: times.length ? Math.min(...times) : NaN,
      maxMs: times.length ? Math.max(...times) : NaN,
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

    const result = [...records.values()]
      .filter((record) => record.guildId === route.guildId && record.channelId === route.channelId)
      .sort(compareSnowflakes);

    let activeAuthor = '';
    let activeAvatar = '';
    return result.map((record) => {
      const groupedContinuation = !record.author && Boolean(activeAuthor);
      if (record.author) activeAuthor = record.author;
      const author = record.author || activeAuthor;
      const avatar = record.avatar || authorAssets.get(`${route.key}:${author}`) || (groupedContinuation ? activeAvatar : '') || '';
      if (avatar) activeAvatar = avatar;
      else if (record.author) activeAvatar = '';
      return { ...record, author, avatar };
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
    const total = currentChannelRecords().length;
    const selected = selectedRecords().length;
    elements.count.textContent = t('collected', { selected, total });
  }

  function reactionText(reaction) {
    if (typeof reaction === 'string') return reaction;
    const symbol = clean(reaction?.emoji || 'reaction');
    return `${symbol} × ${Math.max(1, Number(reaction?.count) || 1)}${reaction?.me ? ' ✓' : ''}`;
  }

  function textExport(messages) {
    return messages.map((message) => {
      const flags = message.edited ? ` · ${t('edited')}` : '';
      const lines = [
        `${message.timestamp} | ${message.author || '—'} | ${t('messageId')}: ${message.id}${flags}`,
        message.text || t('emptyText')
      ];

      if (message.reply) lines.push(`\n${t('reply')}:\n${message.reply}`);
      if (message.embeds.length) lines.push(`\n${t('embeds')}:\n${message.embeds.join('\n\n')}`);
      if (message.stickers.length) lines.push(`\nStickers:\n${message.stickers.join('\n')}`);
      if (message.attachments.length) lines.push(`\n${t('attachments')}:\n${message.attachments.join('\n')}`);
      if (message.reactions.length) lines.push(`\n${t('reactions')}:\n${message.reactions.map(reactionText).join('\n')}`);
      lines.push(`\n${t('source')}: ${message.url}`);

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
    const header = ['id', 'timestamp', 'author', 'avatar', 'edited', 'text', 'reply', 'embeds', 'stickers', 'attachments', 'media', 'reactions', 'url'];
    const rows = messages.map((message) => [
      message.id, message.timestamp, message.author, message.avatar, message.edited, message.text,
      message.reply, message.embeds, message.stickers, message.attachments,
      (message.media || []).map((entry) => `[${entry.type}] ${entry.url}`), message.reactions.map(reactionText), message.url
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
        }
        return existingIndex;
      }
      const index = assets.length;
      assets.push([url, type, clean(entry.alt), normalizeAssetUrl(entry.poster || '')]);
      assetLookup.set(identity, index);
      return index;
    };

    const authorIndex = (message) => {
      const name = cleanAuthorLabel(message.author || '—');
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
        message.url || ''
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

    return { data: bytesToBase64(bytes), encoding, rawBytes: raw.byteLength, storedBytes: bytes.byteLength };
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
          const visible = row[3] || row[5] || row[6].length || row[7].length || row[8].length;
          const body = row[3] || (!visible ? labels.emptyText : '');
          group.rows.push('<article class="message' + (compact ? ' compact' : '') + '" aria-label="' + esc(author[0] + ', ' + timeLabel(row[1])) + '">' +
            '<div class="avatar" style="--author-hue:' + hue(author[0]) + '" aria-hidden="true">' + avatar + '</div>' +
            '<div class="message-content"><header class="message-header"><strong class="message-author">' + esc(author[0]) + '</strong>' +
            '<time datetime="' + esc(row[1]) + '" title="' + esc(row[1]) + '">' + esc(timeLabel(row[1])) + '</time>' +
            (row[10] ? '<span class="edited-badge">' + esc(labels.edited) + '</span>' : '') + '</header>' +
            (body ? '<div class="message-body' + (row[3] ? '' : ' empty') + '">' + richText(row[4], body) + '</div>' : '') +
            (row[5] ? section(labels.reply, [row[5]], 'reply-card') : '') + section(labels.embeds, row[6], 'embed-card') +
            section('Stickers', row[8], 'sticker-card') + media(row[7]) + reactions(row[9]) +
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
          const query = input.value.trim().toLocaleLowerCase();
          let visibleCount = 0;
          for (const message of messages) {
            const match = !query || message.textContent.toLocaleLowerCase().includes(query);
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

      loadDatabase().then(renderArchive).catch((error) => {
        loading.classList.add('error');
        loading.textContent = labels.loadFailed + ' ' + error.message;
      });
    })();`;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function compactHtmlExport(messages) {
    const route = getRoute();
    const language = resolveLanguage();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
    const generatedAt = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
    const payload = await encodeArchiveDatabase(buildArchiveDatabase(messages));
    const labels = JSON.stringify({
      reply: t('reply'), embeds: t('embeds'), attachments: t('attachments'), reactions: t('reactions'),
      emptyText: t('emptyText'), edited: t('edited'), source: t('source'),
      showing: t('showing', { visible: '__VISIBLE__', total: '__TOTAL__' }),
      loadFailed: t('stalled')
    }).replace(/</g, '\\u003c');

    return `<!doctype html>
<html lang="${escapeHtml(language)}" dir="${language === 'ar' ? 'rtl' : 'ltr'}" data-labels="${escapeHtml(labels)}">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer">
  <title>${escapeHtml(route?.label || t('title'))}</title>
  <style>
    :root{color-scheme:light dark;--bg:#f4f5f7;--surface:#fff;--surface-2:#f0f1f4;--text:#24252a;--muted:#656872;--border:#dfe1e6;--accent:#5865f2;--accent-soft:#eef0ff;--reply:#d6d9e0;--shadow:0 8px 28px #1f23290d;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--text)}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{max-width:1040px;margin:0 auto;padding:36px 20px 80px;background:var(--bg);line-height:1.5}a{color:#4752c4;text-underline-offset:2px;overflow-wrap:anywhere}button,input{font:inherit}.archive-hero{padding:28px;border:1px solid var(--border);border-radius:18px;background:linear-gradient(135deg,var(--surface),var(--accent-soft));box-shadow:var(--shadow)}.eyebrow{margin:0 0 6px;color:var(--accent);font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.archive-hero h1{margin:0;font-size:clamp(25px,4vw,38px);line-height:1.18;overflow-wrap:anywhere}.archive-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.meta-pill{padding:6px 10px;border:1px solid var(--border);border-radius:999px;background:color-mix(in srgb,var(--surface) 78%,transparent);color:var(--muted);font-size:12px}.toolbar{position:sticky;top:10px;z-index:20;display:flex;align-items:center;gap:12px;margin:18px 0;padding:10px;border:1px solid var(--border);border-radius:12px;background:color-mix(in srgb,var(--surface) 90%,transparent);box-shadow:var(--shadow);backdrop-filter:blur(12px)}.search{min-width:0;flex:1;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text);padding:9px 11px;outline:none}.search:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 20%,transparent)}.result-count{color:var(--muted);font-size:12px;white-space:nowrap}.archive-loading{padding:28px;text-align:center;color:var(--muted)}.archive-loading.error{color:#c8323d}
    .day-group{margin:24px 0}.day-divider{position:sticky;top:78px;z-index:10;display:flex;align-items:center;gap:8px;width:max-content;max-width:100%;margin:0 auto 10px;padding:5px 10px;border:1px solid var(--border);border-radius:999px;background:color-mix(in srgb,var(--surface) 92%,transparent);box-shadow:0 2px 10px #0000000a;color:var(--muted);font-size:12px;font-weight:750;backdrop-filter:blur(10px)}.day-divider small{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:var(--surface-2);font-size:10px}.day-messages{overflow:hidden;border:1px solid var(--border);border-radius:14px;background:var(--surface);box-shadow:var(--shadow)}.message{content-visibility:auto;contain-intrinsic-size:auto 140px;display:grid;grid-template-columns:40px minmax(0,1fr);gap:12px;padding:14px 16px;border-bottom:1px solid var(--border)}.message:last-child{border-bottom:0}.message:hover{background:color-mix(in srgb,var(--accent) 3%,var(--surface))}.message.compact{padding-top:8px;padding-bottom:8px}.avatar{display:grid;place-items:center;width:40px;height:40px;overflow:hidden;border-radius:50%;background:hsl(var(--author-hue) 55% 36%);color:#fff;font-size:15px;font-weight:800;box-shadow:inset 0 0 0 1px #ffffff26}.avatar-image{width:100%;height:100%;object-fit:cover}.avatar-fallback{display:grid;place-items:center;width:100%;height:100%}.message.compact .avatar{visibility:hidden}.message-content{min-width:0}.message-header{display:flex;align-items:baseline;gap:8px;min-height:22px}.message-author{font-size:14px;font-weight:760;overflow-wrap:anywhere}.message.compact .message-author{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.message-header time,.edited-badge{color:var(--muted);font-size:11px}.edited-badge{font-style:italic}.message-body{margin-top:3px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.62}.message-body.empty{color:var(--muted);font-style:italic}.inline-emoji-wrap{display:inline-flex;align-items:baseline;vertical-align:baseline}.inline-emoji{display:inline-block;width:1.35em;height:1.35em;margin:0 .06em;vertical-align:-.28em;object-fit:contain}.inline-emoji-fallback{margin:0 .08em;color:var(--muted);font:600 .88em/1.2 ui-monospace,SFMono-Regular,Consolas,monospace}.message-body pre{max-width:100%;margin:10px 0;padding:12px;overflow:auto;border:1px solid var(--border);border-radius:8px;background:#17181c;color:#e7e9ee;font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre}.detail-section{margin-top:10px;padding:9px 11px;border-left:3px solid var(--accent);border-radius:0 8px 8px 0;background:var(--surface-2);overflow-wrap:anywhere}.detail-section h3{margin:0 0 4px;color:var(--muted);font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.detail-section>div{white-space:pre-wrap;font-size:13px;line-height:1.52}.reply-card{border-left-color:var(--reply)}.embed-card{background:var(--accent-soft)}
    .reaction-row{display:flex;gap:5px;flex-wrap:wrap;margin-top:9px}.reaction-chip{display:inline-flex;align-items:center;gap:5px;min-height:28px;padding:3px 8px;border:1px solid var(--border);border-radius:999px;background:var(--surface-2);font-size:12px}.reaction-chip.mine{border-color:var(--accent);background:var(--accent-soft)}.reaction-icon{display:inline-flex;align-items:center}.reaction-emoji{width:18px;height:18px;object-fit:contain}.reaction-symbol{font-size:15px;line-height:1}.reaction-icon .reaction-symbol{max-width:12em;overflow:hidden;color:var(--muted);font:600 11px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;text-overflow:ellipsis;white-space:nowrap}.reaction-chip strong{font-size:11px}.media-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(250px,100%),1fr));gap:10px;margin-top:8px}.media-item{min-width:0;margin:0;padding:7px;border:1px solid var(--border);border-radius:9px;background:var(--surface)}.media-item img,.media-item video{display:block;width:100%;max-height:560px;object-fit:contain;border-radius:6px;background:#111}.media-item audio{display:block;width:100%}.media-item figcaption{margin-top:6px;color:var(--muted);font-size:10px;overflow-wrap:anywhere}.media-link{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.file-item{padding:9px;border:1px solid var(--border);border-radius:7px;background:var(--surface)}.message-footer{display:flex;align-items:center;gap:8px;margin-top:9px;opacity:.58;color:var(--muted);font-size:10px;transition:opacity .15s}.message:hover .message-footer,.message:focus-within .message-footer{opacity:1}.message-footer code{overflow:hidden;text-overflow:ellipsis}.back-top{position:fixed;right:18px;bottom:18px;padding:9px 12px;border:1px solid var(--border);border-radius:999px;background:var(--surface);box-shadow:var(--shadow);font-size:12px;text-decoration:none}[hidden]{display:none!important}
    @media(max-width:620px){body{padding:18px 8px 70px}.archive-hero{padding:20px 16px;border-radius:14px}.toolbar{top:6px}.result-count{display:none}.day-divider{top:70px}.message{grid-template-columns:34px minmax(0,1fr);gap:9px;padding:12px 10px}.avatar{width:34px;height:34px;font-size:13px}.media-grid{grid-template-columns:1fr}.message-footer{opacity:.65}}@media(prefers-color-scheme:dark){:root{--bg:#191a1e;--surface:#24262b;--surface-2:#2d3036;--text:#e4e6eb;--muted:#a7abb4;--border:#3a3d45;--accent:#8ea1e1;--accent-soft:#2b3044;--reply:#5d626d;--shadow:0 10px 34px #0004}a{color:#aab7f0}.meta-pill{background:#24262bd9}}@media print{.toolbar,.back-top{display:none}.day-divider{position:static}.message{content-visibility:visible;break-inside:avoid}.message-footer{opacity:1}body{max-width:none;padding:0}}
  </style>
</head>
<body>
  <header class="archive-hero"><p class="eyebrow">Discord Chat Export</p><h1>${escapeHtml(route?.label || t('title'))}</h1><div class="archive-meta"><span class="meta-pill">${escapeHtml(settings.startDate)} — ${escapeHtml(settings.endDate)}</span><span class="meta-pill">${messages.length} ${escapeHtml(t('messages'))}</span><span class="meta-pill">${escapeHtml(timeZone)}</span><span class="meta-pill">${escapeHtml(generatedAt)}</span><span class="meta-pill">${escapeHtml(payload.encoding === 'gzip-base64' ? `GZIP ${formatBytes(payload.storedBytes)} · raw ${formatBytes(payload.rawBytes)}` : `Data ${formatBytes(payload.storedBytes)}`)}</span></div></header>
  <div class="toolbar" role="search"><input id="archive-search" class="search" type="search" placeholder="${escapeHtml(t('searchPlaceholder'))}" aria-label="${escapeHtml(t('searchPlaceholder'))}"><span id="result-count" class="result-count">${escapeHtml(t('showing', { visible: messages.length, total: messages.length }))}</span></div>
  <main id="timeline" class="timeline"><div id="archive-loading" class="archive-loading">${escapeHtml(t('scanning'))}</div></main><a class="back-top" href="#" aria-label="${escapeHtml(t('backToTop'))}">↑ ${escapeHtml(t('backToTop'))}</a>
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

  function exportFileName(extension) {
    const route = getRoute();
    const channel = clean(route?.label || route?.channelId || 'channel')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/[^\p{L}\p{N}._#-]+/gu, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 70) || 'channel';
    return `discord-chat-${channel}-${settings.startDate}_${settings.endDate}.${extension}`;
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

    const output = await buildExport(settings.format, messages);
    const blob = new Blob([output.content], { type: output.mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = exportFileName(output.extension);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    setStatus('downloaded', { count: messages.length }, 'success');
    return true;
  }

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
    return `${first}:${last}:${Math.round(scroller.scrollTop)}:${scroller.scrollHeight}`;
  }

  async function moveScroller(scroller, direction) {
    const distance = Math.max(280, Math.floor(scroller.clientHeight * 0.72));
    scroller.scrollBy({ top: direction * distance, left: 0, behavior: 'auto' });
    await sleep(Number(settings.delay) || 700);
  }

  async function jumpToLoadedEdge(scroller, direction) {
    scroller.scrollTop = direction < 0 ? 0 : Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    await sleep(Number(settings.delay) || 700);
  }

  function directionToStart(scan, startMs) {
    if (startMs < scan.minMs) return -1;
    if (startMs > scan.maxMs) return 1;
    return 0;
  }

  function setRunning(running) {
    if (!elements.fetch || !elements.cancel) return;
    elements.fetch.hidden = running;
    elements.cancel.hidden = !running;
    elements.startDate.disabled = running;
    elements.endDate.disabled = running;
    elements.delay.disabled = running;
  }

  function initialTraversalDirection(scan, bounds) {
    if (scan.maxMs < bounds.startMs) return 1;
    if (scan.minMs >= bounds.endExclusiveMs) return -1;

    const missingStart = scan.minMs > bounds.startMs;
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
    const root = findMessageRoot();
    const scroller = findScroller(root);

    if (!route) {
      setStatus('noChannel', {}, 'error');
      return;
    }
    if (!root || !scroller) {
      setStatus('noScroller', {}, 'error');
      return;
    }
    if (!bounds) return;

    const job = { cancelled: false, routeKey: route.key };
    activeJob = job;
    setRunning(true);

    let step = 0;
    let direction = 0;
    let reachedStart = false;
    let reachedEnd = false;
    let observedMin = Infinity;
    let observedMax = -Infinity;
    let edgeWaits = 0;
    let stallCount = 0;
    let previousSignature = '';
    const maximumSteps = 5000;

    const finish = async () => {
      scanVisible();
      const count = selectedRecords().length;
      setStatus('done', { count }, 'success');
      if (settings.autoDownload && count) await downloadExport();
    };

    try {
      while (!job.cancelled && step < maximumSteps) {
        if (getRoute()?.key !== job.routeKey) {
          setStatus('routeChanged', {}, 'warning');
          return;
        }

        const scan = scanVisible();
        step += 1;

        if (!scan.ids.length || !Number.isFinite(scan.minMs) || !Number.isFinite(scan.maxMs)) {
          setStatus('scanning');
          await sleep(Number(settings.delay) || 700);
          continue;
        }

        observedMin = Math.min(observedMin, scan.minMs);
        observedMax = Math.max(observedMax, scan.maxMs);
        if (scan.minMs <= bounds.startMs) reachedStart = true;
        if (scan.maxMs >= bounds.endExclusiveMs) reachedEnd = true;

        if (reachedStart && reachedEnd) {
          await finish();
          return;
        }

        if (!direction) direction = initialTraversalDirection(scan, bounds);
        if (direction < 0 && reachedStart) {
          direction = 1;
          edgeWaits = 0;
          stallCount = 0;
          previousSignature = '';
        } else if (direction > 0 && reachedEnd) {
          direction = -1;
          edgeWaits = 0;
          stallCount = 0;
          previousSignature = '';
        }

        if (!direction) {
          await finish();
          return;
        }

        const clippedStart = Math.max(bounds.startMs, Math.min(observedMin, bounds.endExclusiveMs));
        const clippedEnd = Math.min(bounds.endExclusiveMs, Math.max(observedMax, bounds.startMs));
        const covered = Math.max(0, clippedEnd - clippedStart);
        const percent = Math.max(0, Math.min(100, Math.round(
          (covered / (bounds.endExclusiveMs - bounds.startMs)) * 100
        )));
        const overlapsRange = scan.maxMs >= bounds.startMs && scan.minMs < bounds.endExclusiveMs;
        setStatus(overlapsRange ? 'collecting' : 'seeking', overlapsRange ? { percent, step } : { step });

        const atEdge = direction < 0 ? isAtTop(scroller) : isAtBottom(scroller);
        if (atEdge) {
          const previousBoundary = direction < 0 ? scan.minMs : scan.maxMs;
          await jumpToLoadedEdge(scroller, direction);
          const retry = scanVisible();
          const changed = direction < 0
            ? Number.isFinite(retry.minMs) && retry.minMs < previousBoundary
            : Number.isFinite(retry.maxMs) && retry.maxMs > previousBoundary;

          if (changed) {
            edgeWaits = 0;
            continue;
          }

          edgeWaits += 1;
          if (edgeWaits < 3) continue;

          if (direction < 0) reachedStart = true;
          else reachedEnd = true;
          direction = direction < 0 ? 1 : -1;
          edgeWaits = 0;
          stallCount = 0;
          previousSignature = '';

          if (reachedStart && reachedEnd) {
            await finish();
            return;
          }
          continue;
        }

        edgeWaits = 0;
        await moveScroller(scroller, direction);

        const nextScan = scanVisible();
        const signature = scrollSignature(scroller, nextScan);
        stallCount = signature === previousSignature ? stallCount + 1 : 0;
        previousSignature = signature;

        if (stallCount >= 8) {
          setStatus('stalled', {}, 'warning');
          return;
        }
      }

      if (job.cancelled) setStatus('cancelled', {}, 'warning');
      else setStatus('stalled', {}, 'warning');
    } finally {
      if (activeJob === job) activeJob = null;
      setRunning(false);
      updateCount();
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
    return `<option value="${value}"${selected}>${text}</option>`;
  }

  function panelMarkup() {
    const languageOptions = [
      option('auto', 'Auto / 自动', settings.language),
      option('en', 'English', settings.language), option('zh-CN', '简体中文', settings.language),
      option('zh-TW', '繁體中文', settings.language), option('ja', '日本語', settings.language),
      option('ko', '한국어', settings.language), option('es', 'Español', settings.language),
      option('fr', 'Français', settings.language), option('de', 'Deutsch', settings.language),
      option('pt-BR', 'Português (Brasil)', settings.language), option('ru', 'Русский', settings.language),
      option('ar', 'العربية', settings.language)
    ].join('');

    return `
      <style>
        :host{all:initial;color-scheme:dark}
        *,*::before,*::after{box-sizing:border-box}
        .panel{width:min(370px,calc(100vw - 24px));background:#1e1f22;color:#dbdee1;border:1px solid #3f4147;border-radius:12px;box-shadow:0 12px 36px #0009;font:13px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden}
        .header{display:flex;align-items:center;gap:8px;padding:10px 11px;background:#2b2d31;cursor:move;user-select:none}
        .title{font-size:13px;font-weight:750;flex:1}.count{font-size:11px;color:#b5bac1;white-space:nowrap}
        .icon{border:0;background:transparent;color:#b5bac1;width:25px;height:25px;border-radius:5px;cursor:pointer;font-size:16px;line-height:1}.icon:hover{background:#3f4147;color:#fff}
        .body{padding:11px;display:grid;gap:10px}.panel.minimized .body{display:none}.panel.minimized{width:min(330px,calc(100vw - 24px))}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.field{display:grid;gap:4px}.field.wide{grid-column:1/-1}
        label{font-size:11px;font-weight:700;color:#b5bac1;text-transform:uppercase;letter-spacing:.02em}
        input,select{width:100%;border:1px solid #4e5058;background:#111214;color:#f2f3f5;border-radius:6px;padding:7px 8px;font:12px system-ui,sans-serif;outline:none}
        input:focus,select:focus{border-color:#5865f2}input:disabled,select:disabled{opacity:.55}
        .check{grid-column:1/-1;display:flex;align-items:center;gap:7px;color:#dbdee1;font-size:12px;text-transform:none;letter-spacing:0;cursor:pointer}.check input{width:15px;height:15px;margin:0;accent-color:#5865f2}
        .hint{font-size:11px;color:#949ba4}.status{min-height:32px;border-radius:6px;background:#2b2d31;padding:8px;color:#c4c9ce;overflow-wrap:anywhere}
        .status[data-tone="success"]{background:#173c2d;color:#9fe6c2}.status[data-tone="warning"]{background:#473b1c;color:#f3d98b}.status[data-tone="error"]{background:#4a2024;color:#ffb2b9}
        .actions{display:flex;gap:6px;flex-wrap:wrap}.button{border:0;border-radius:6px;padding:8px 10px;cursor:pointer;font:700 12px system-ui,sans-serif;background:#4e5058;color:#fff;flex:1 1 auto}.button:hover{filter:brightness(1.12)}
        .button.primary{background:#5865f2}.button.danger{background:#da373c}.button.secondary{background:#383a40}.button[hidden]{display:none}.button:disabled{opacity:.5;cursor:not-allowed}
        @media(max-width:430px){.panel{width:calc(100vw - 16px)}.grid{grid-template-columns:1fr}.field.wide{grid-column:auto}}
      </style>
      <section class="panel" dir="${resolveLanguage() === 'ar' ? 'rtl' : 'ltr'}">
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
