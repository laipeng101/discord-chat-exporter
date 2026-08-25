# Greasy Fork localized additional info

Locales: en, zh-CN, zh-TW, ja, ko, es, fr, de, pt-BR, ru, ar

------------------------------------------------------------------------

## en

Export messages that your account can already view in the current
Discord web channel. The script works entirely in the current browser
tab and does not call Discord private APIs or upload chat content.

## Main features

-   Choose a start and end date and automatically collect the selected
    range.
-   Automatically decides whether to scroll upward or downward from the
    current viewport.
-   Uses overlapping viewports while collecting to reduce missed
    messages.
-   Exports TXT, JSON, CSV, and a readable single-file HTML archive.
-   Preserves available authors, avatars, message text, replies, embeds,
    attachments, stickers, Unicode/custom emoji, and structured
    reactions.
-   HTML archives group messages by local date, compact consecutive
    posts, support text/author search, and display available
    images/video/audio.
-   Reuses author/media/emoji dictionaries and compresses the embedded
    archive database with native gzip when supported.
-   Standard emoji are stored as Unicode; custom emoji use stable
    Discord emoji IDs and fall back to `:name:` if the image cannot
    load.
-   Interface languages: English, Simplified Chinese, Traditional
    Chinese, Japanese, Korean, Spanish, French, German, Brazilian
    Portuguese, Russian, and Arabic.

## Use

Open a Discord text channel in the browser, choose the date range and
export format, then click **Fetch date range**. Do not manually scroll
or switch channels while automatic collection is running. Press
**Alt/Option + Shift + D** to show or hide the panel.

Dates use your browser's local time zone and the end date includes the
whole selected day.

## Privacy and limitations

The script only reads message elements rendered for your logged-in
account. It cannot bypass permissions, recover deleted messages, or read
messages that Discord has not loaded. Media in HTML exports remains
referenced by URL, so remote media may later expire or require access.

Use the exporter only for conversations you are authorized to handle and
respect server rules, applicable law, and participant privacy.

------------------------------------------------------------------------

## zh-CN

从 Discord
网页版当前频道导出你的账号本来就能查看的消息。脚本只在当前浏览器标签页中处理数据，不调用
Discord 私有 API，也不会上传聊天内容。

## 主要功能

-   选择开始/结束日期后自动采集指定范围。
-   根据当前视窗与目标日期的位置自动决定向上或向下滚动。
-   使用重叠视窗边滚动边采集，降低漏消息概率。
-   支持 TXT、JSON、CSV 和可直接阅读的单文件 HTML。
-   尽可能保留作者、头像、正文、回复、嵌入、附件、贴纸、Unicode/自定义表情和结构化反应。
-   HTML
    按本地日期分组，同作者连续消息紧凑显示，支持正文/作者搜索，并直接展示可用图片、视频和音频。
-   作者、媒体和表情采用字典复用；支持时使用浏览器原生 gzip
    压缩内嵌归档数据库。
-   普通表情直接保存为 Unicode；自定义表情按 Discord emoji ID
    去重，加载失败时回退到 `:表情名:`。
-   面板支持
    English、简体中文、繁體中文、日本語、한국어、Español、Français、Deutsch、Português
    (Brasil)、Русский、العربية。

## 使用

打开 Discord 网页版目标文字频道，选择日期范围和导出格式，点击
**自动刷取日期范围**。自动采集期间不要手动滚动，也不要切换频道。按
**Alt/Option + Shift + D** 可显示/隐藏面板。

日期按浏览器本地时区计算，结束日期包含当天全部消息。

## 隐私与限制

脚本只能读取当前登录账号已经由页面渲染出来的消息，不能绕过权限、恢复已删除消息，也不能直接读取
Discord 尚未加载的历史。HTML 中的媒体保留远程
URL，因此链接未来可能过期、被删除或需要权限。

请只导出你有权处理的聊天内容，并遵守服务器规则、适用法律和参与者隐私。

------------------------------------------------------------------------

## zh-TW

從 Discord
網頁版目前頻道匯出你的帳號原本就能查看的訊息。所有資料只在目前瀏覽器分頁處理，不呼叫
Discord 私有 API，也不會上傳聊天內容。

## 主要功能

-   選擇開始與結束日期後自動擷取指定範圍。
-   依目前視窗與目標日期的位置自動決定向上或向下捲動。
-   使用重疊視窗邊捲動邊擷取，降低漏訊息風險。
-   支援 TXT、JSON、CSV 與可直接閱讀的單一 HTML 檔。
-   盡可能保留作者、頭像、正文、回覆、嵌入、附件、貼圖、Unicode/自訂表情與結構化反應。
-   HTML
    依本地日期分組、緊湊顯示同作者連續訊息、支援正文/作者搜尋，並顯示可用圖片、影片與音訊。
-   作者、媒體與表情使用字典重複利用；支援時以瀏覽器原生 gzip
    壓縮內嵌資料庫。
-   一般表情直接保存為 Unicode；自訂表情依 Discord emoji ID
    去重，載入失敗時顯示 `:表情名稱:`。
-   面板支援 11 種語言。

## 使用

開啟 Discord 網頁版目標文字頻道，選擇日期範圍與匯出格式，按下
**自動擷取日期範圍**。自動擷取期間請勿手動捲動或切換頻道。按
**Alt/Option + Shift + D** 可顯示或隱藏面板。

日期依瀏覽器本地時區計算，結束日期包含當天全部訊息。

## 隱私與限制

腳本只能讀取目前登入帳號已由頁面渲染的訊息，不能繞過權限、恢復已刪除訊息，也不能直接讀取尚未載入的歷史。HTML
中的媒體仍使用遠端 URL，因此未來可能失效或需要權限。

請只匯出你有權處理的內容，並遵守伺服器規則、適用法律與參與者隱私。

------------------------------------------------------------------------

## ja

Discord Web
の現在のチャンネルで、あなたのアカウントが通常閲覧できるメッセージをエクスポートします。処理は現在のブラウザータブ内だけで行われ、Discord
の非公開 API を呼び出したり、チャット内容を外部へ送信したりしません。

## 主な機能

-   開始日と終了日を指定して対象期間を自動収集。
-   現在の表示位置と対象期間を比較し、上方向/下方向を自動選択。
-   重なりのある表示範囲を使って収集し、取りこぼしを減らします。
-   TXT / JSON / CSV / 単一 HTML ファイルに出力。
-   投稿者、アバター、本文、返信、埋め込み、添付、スタンプ、Unicode/カスタム絵文字、リアクションを可能な範囲で保持。
-   HTML
    はローカル日付ごとにグループ化し、連続投稿をコンパクト表示。本文/投稿者検索と画像・動画・音声表示に対応。
-   投稿者・メディア・絵文字を辞書化して再利用し、対応ブラウザーでは内蔵データを
    gzip 圧縮。
-   標準絵文字は Unicode として保存。カスタム絵文字は Discord emoji ID
    で重複排除し、読み込み失敗時は `:name:` にフォールバック。
-   UI は 11 言語に対応。

## 使い方

Discord Web
で対象のテキストチャンネルを開き、日付範囲と出力形式を選び、**日付範囲を自動取得**
を実行します。自動収集中は手動スクロールやチャンネル移動をしないでください。**Alt/Option +
Shift + D** でパネルを表示/非表示にできます。

日付はブラウザーのローカルタイムゾーンを使用し、終了日はその日の終わりまで含みます。

## プライバシーと制限

現在のアカウントに表示され、Discord
が実際に読み込んだメッセージだけを取得できます。権限回避、削除済みメッセージの復元、未読み込み履歴の直接取得はできません。HTML
のメディアは URL
参照のため、将来リンク切れや権限制限が発生する場合があります。

------------------------------------------------------------------------

## ko

Discord 웹의 현재 채널에서 계정이 원래 볼 수 있는 메시지를 내보냅니다.
모든 처리는 현재 브라우저 탭에서만 이루어지며 Discord 비공개 API를
호출하거나 채팅 내용을 업로드하지 않습니다.

## 주요 기능

-   시작일/종료일을 선택해 지정 범위를 자동 수집합니다.
-   현재 화면과 목표 날짜 범위를 비교해 위/아래 스크롤 방향을 자동
    선택합니다.
-   겹치는 화면 구간을 사용해 수집하여 누락 가능성을 줄입니다.
-   TXT, JSON, CSV, 단일 HTML 파일로 내보냅니다.
-   작성자, 아바타, 본문, 답글, 임베드, 첨부, 스티커, Unicode/사용자
    지정 이모지, 구조화된 반응을 가능한 범위에서 보존합니다.
-   HTML은 로컬 날짜별 그룹, 연속 메시지 압축 표시, 본문/작성자 검색,
    이미지/비디오/오디오 표시를 지원합니다.
-   작성자/미디어/이모지를 사전 형태로 재사용하고 지원 브라우저에서는
    내장 데이터를 gzip으로 압축합니다.
-   일반 이모지는 Unicode로 저장하고 사용자 지정 이모지는 Discord emoji
    ID로 중복 제거합니다. 이미지가 실패하면 `:name:`으로 대체합니다.
-   UI는 11개 언어를 지원합니다.

## 사용 방법

Discord 웹에서 대상 텍스트 채널을 열고 날짜 범위와 형식을 선택한 뒤
**날짜 범위 자동 가져오기**를 실행합니다. 자동 수집 중에는 수동
스크롤이나 채널 이동을 하지 마세요. **Alt/Option + Shift + D**로 패널을
표시/숨길 수 있습니다.

날짜는 브라우저 로컬 시간대를 사용하며 종료일 전체를 포함합니다.

## 개인정보 및 제한

현재 로그인 계정에 표시되고 Discord가 실제로 로드한 메시지만 읽을 수
있습니다. 권한 우회, 삭제된 메시지 복구, 아직 로드되지 않은 기록의 직접
접근은 불가능합니다. HTML의 미디어는 원격 URL을 사용하므로 나중에
만료되거나 권한이 필요할 수 있습니다.

------------------------------------------------------------------------

## es

Exporta los mensajes que tu cuenta ya puede ver en el canal actual de
Discord Web. Todo el procesamiento ocurre en la pestaña del navegador;
no usa APIs privadas de Discord ni sube el contenido del chat.

## Funciones principales

-   Selección de fecha inicial y final con recopilación automática del
    intervalo.
-   Elección automática de desplazamiento hacia arriba o abajo según la
    posición actual.
-   Recopilación con vistas superpuestas para reducir mensajes omitidos.
-   Exportación a TXT, JSON, CSV y un archivo HTML único y legible.
-   Conserva, cuando están disponibles, autor, avatar, texto,
    respuestas, incrustaciones, adjuntos, stickers, emoji
    Unicode/personalizados y reacciones estructuradas.
-   El HTML agrupa por fecha local, compacta mensajes consecutivos,
    permite buscar texto/autor y muestra imágenes, vídeo y audio
    disponibles.
-   Reutiliza diccionarios de autores, medios y emoji y comprime la base
    de datos integrada con gzip cuando el navegador lo admite.
-   Los emoji estándar se guardan como Unicode; los personalizados se
    deduplican por ID de Discord y usan `:nombre:` como alternativa.
-   Interfaz en 11 idiomas.

## Uso

Abre un canal de texto en Discord Web, elige el intervalo y el formato y
pulsa **Fetch date range / Obtener intervalo**. No desplaces manualmente
ni cambies de canal durante la recopilación automática. **Alt/Option +
Shift + D** muestra u oculta el panel.

Las fechas usan la zona horaria local del navegador y la fecha final
incluye todo ese día.

## Privacidad y límites

Solo puede leer mensajes que la cuenta actual puede ver y que Discord ya
haya renderizado. No evita permisos, no recupera mensajes borrados ni
accede directamente a historial aún no cargado. Los medios del HTML
siguen usando URLs remotas, que pueden caducar o requerir permisos.

------------------------------------------------------------------------

## fr

Exporte les messages que votre compte peut déjà consulter dans le salon
Discord Web actuel. Tout le traitement reste dans l'onglet du navigateur
: aucune API privée de Discord n'est appelée et aucun contenu de
discussion n'est envoyé ailleurs.

## Fonctions principales

-   Sélection d'une date de début et de fin avec collecte automatique de
    la période.
-   Choix automatique du défilement vers le haut ou le bas selon la
    position actuelle.
-   Collecte avec zones de vue chevauchantes pour réduire les messages
    manqués.
-   Export TXT, JSON, CSV et archive HTML autonome lisible.
-   Conservation, lorsque disponible, de l'auteur, avatar, texte,
    réponses, intégrations, pièces jointes, stickers, emoji
    Unicode/personnalisés et réactions structurées.
-   L'HTML regroupe par date locale, compacte les messages consécutifs,
    permet la recherche texte/auteur et affiche les images, vidéos et
    sons disponibles.
-   Réutilisation de dictionnaires auteurs/médias/emoji et compression
    gzip de la base intégrée si le navigateur le permet.
-   Les emoji standards sont stockés en Unicode ; les emoji
    personnalisés sont dédupliqués par ID Discord avec repli `:nom:`.
-   Interface en 11 langues.

## Utilisation

Ouvrez un salon texte dans Discord Web, choisissez la période et le
format, puis lancez **Fetch date range**. Ne faites pas défiler
manuellement et ne changez pas de salon pendant la collecte automatique.
**Alt/Option + Shift + D** affiche ou masque le panneau.

Les dates utilisent le fuseau horaire local du navigateur et la date de
fin inclut toute la journée.

## Confidentialité et limites

Le script ne lit que les messages visibles pour le compte connecté et
réellement chargés par Discord. Il ne contourne pas les permissions, ne
restaure pas les messages supprimés et n'accède pas directement à
l'historique non chargé. Les médias HTML restent référencés par URL
distante et peuvent expirer ou nécessiter des droits.

------------------------------------------------------------------------

## de

Exportiert Nachrichten, die Ihr Konto im aktuellen Discord-Webkanal
bereits sehen darf. Die Verarbeitung erfolgt ausschließlich im aktuellen
Browser-Tab; private Discord-APIs werden nicht aufgerufen und
Chat-Inhalte werden nicht hochgeladen.

## Hauptfunktionen

-   Start- und Enddatum wählen und den Zeitraum automatisch erfassen.
-   Automatische Wahl der Scrollrichtung nach oben oder unten anhand der
    aktuellen Position.
-   Überlappende Ansichten reduzieren ausgelassene Nachrichten.
-   Export als TXT, JSON, CSV und lesbare einzelne HTML-Datei.
-   Erfasst soweit verfügbar Autor, Avatar, Text, Antworten, Embeds,
    Anhänge, Sticker, Unicode-/benutzerdefinierte Emoji und
    strukturierte Reaktionen.
-   HTML gruppiert nach lokalem Datum, zeigt aufeinanderfolgende
    Nachrichten kompakt, bietet Text-/Autorensuche und zeigt verfügbare
    Bilder, Videos und Audio.
-   Autoren, Medien und Emoji werden über Wörterbücher wiederverwendet;
    die eingebettete Datenbank wird bei Unterstützung mit gzip
    komprimiert.
-   Standard-Emoji werden als Unicode gespeichert; benutzerdefinierte
    Emoji werden über die Discord-Emoji-ID dedupliziert und fallen bei
    Fehlern auf `:name:` zurück.
-   Oberfläche in 11 Sprachen.

## Verwendung

Öffnen Sie einen Textkanal in Discord Web, wählen Sie Zeitraum und
Format und starten Sie **Fetch date range**. Während der automatischen
Erfassung nicht manuell scrollen oder den Kanal wechseln. **Alt/Option +
Shift + D** blendet das Panel ein oder aus.

Datumswerte verwenden die lokale Browser-Zeitzone; das Enddatum umfasst
den gesamten Tag.

## Datenschutz und Grenzen

Das Skript liest nur Nachrichten, die für das angemeldete Konto sichtbar
und von Discord tatsächlich geladen wurden. Es umgeht keine
Berechtigungen, stellt keine gelöschten Nachrichten wieder her und liest
keinen noch nicht geladenen Verlauf direkt. Medien im HTML bleiben
externe URLs und können später ablaufen oder Zugriffsrechte benötigen.

------------------------------------------------------------------------

## pt-BR

Exporta as mensagens que sua conta já pode visualizar no canal atual do
Discord Web. Todo o processamento acontece na aba atual do navegador; o
script não chama APIs privadas do Discord nem envia o conteúdo do chat.

## Principais recursos

-   Selecione data inicial e final e colete automaticamente o período.
-   Escolha automática da direção de rolagem para cima ou para baixo
    conforme a posição atual.
-   Coleta com áreas sobrepostas para reduzir mensagens perdidas.
-   Exportação TXT, JSON, CSV e HTML único e legível.
-   Preserva, quando disponível, autor, avatar, texto, respostas,
    embeds, anexos, stickers, emoji Unicode/personalizados e reações
    estruturadas.
-   O HTML agrupa por data local, compacta mensagens consecutivas,
    permite busca por texto/autor e exibe imagens, vídeo e áudio
    disponíveis.
-   Reutiliza dicionários de autores, mídia e emoji e comprime o banco
    incorporado com gzip quando suportado.
-   Emoji padrão são armazenados como Unicode; emoji personalizados são
    deduplicados pelo ID do Discord e usam `:nome:` como fallback.
-   Interface em 11 idiomas.

## Uso

Abra um canal de texto no Discord Web, escolha o período e o formato e
clique em **Fetch date range**. Não role manualmente nem troque de canal
durante a coleta automática. **Alt/Option + Shift + D** mostra ou oculta
o painel.

As datas usam o fuso horário local do navegador e a data final inclui o
dia inteiro.

## Privacidade e limitações

O script lê somente mensagens que a conta conectada pode ver e que o
Discord já carregou. Não contorna permissões, não recupera mensagens
excluídas e não acessa diretamente histórico ainda não carregado. A
mídia no HTML continua referenciada por URL remota e pode expirar ou
exigir permissão.

------------------------------------------------------------------------

## ru

Экспортирует сообщения, которые ваша учётная запись уже может видеть в
текущем канале Discord Web. Вся обработка выполняется в текущей вкладке
браузера: приватные API Discord не вызываются, содержимое чата никуда не
отправляется.

## Основные возможности

-   Выбор начальной и конечной даты с автоматическим сбором диапазона.
-   Автоматический выбор прокрутки вверх или вниз по текущему положению.
-   Перекрывающиеся области просмотра уменьшают риск пропуска сообщений.
-   Экспорт в TXT, JSON, CSV и один читаемый HTML-файл.
-   По возможности сохраняются автор, аватар, текст, ответы,
    встраивания, вложения, стикеры, Unicode/пользовательские эмодзи и
    структурированные реакции.
-   HTML группирует сообщения по локальной дате, компактно показывает
    последовательные сообщения, поддерживает поиск по тексту/автору и
    отображает доступные изображения, видео и аудио.
-   Авторы, медиа и эмодзи переиспользуются через словари; встроенная
    база сжимается gzip при поддержке браузером.
-   Обычные эмодзи хранятся как Unicode; пользовательские
    дедуплицируются по Discord emoji ID и при ошибке заменяются на
    `:name:`.
-   Интерфейс на 11 языках.

## Использование

Откройте текстовый канал в Discord Web, выберите диапазон дат и формат,
затем запустите **Fetch date range**. Во время автоматического сбора не
прокручивайте список вручную и не переключайте канал. **Alt/Option +
Shift + D** показывает или скрывает панель.

Даты используют локальный часовой пояс браузера; конечная дата включает
весь выбранный день.

## Конфиденциальность и ограничения

Скрипт читает только сообщения, доступные текущей учётной записи и
реально загруженные Discord. Он не обходит права доступа, не
восстанавливает удалённые сообщения и не читает напрямую ещё не
загруженную историю. Медиа в HTML остаются удалёнными URL и могут позже
истечь или потребовать доступ.

------------------------------------------------------------------------

## ar

يُصدّر الرسائل التي يستطيع حسابك رؤيتها بالفعل في القناة الحالية على
Discord Web. تتم كل المعالجة داخل علامة تبويب المتصفح الحالية، ولا
يستدعي السكربت واجهات Discord الخاصة ولا يرفع محتوى المحادثة.

## الميزات الرئيسية

-   اختيار تاريخ البداية والنهاية وجمع النطاق تلقائياً.
-   اختيار اتجاه التمرير للأعلى أو للأسفل تلقائياً حسب موضع العرض الحالي.
-   استخدام مناطق عرض متداخلة لتقليل احتمال فقدان الرسائل.
-   التصدير إلى TXT وJSON وCSV وملف HTML واحد قابل للقراءة.
-   الاحتفاظ قدر الإمكان بالمؤلف والصورة الرمزية والنص والردود
    والتضمينات والمرفقات والملصقات والرموز التعبيرية Unicode/المخصصة
    والتفاعلات المنظمة.
-   يجمع HTML الرسائل حسب التاريخ المحلي، ويعرض الرسائل المتتالية بشكل
    مضغوط، ويدعم البحث في النص/المؤلف، ويعرض الصور والفيديو والصوت
    المتاح.
-   يعيد استخدام قواميس المؤلفين والوسائط والرموز التعبيرية، ويضغط قاعدة
    البيانات المضمنة باستخدام gzip عندما يدعم المتصفح ذلك.
-   تُحفظ الرموز القياسية كـ Unicode، وتُزال تكرارات الرموز المخصصة حسب
    Discord emoji ID مع الرجوع إلى `:name:` عند فشل الصورة.
-   الواجهة تدعم 11 لغة.

## الاستخدام

افتح قناة نصية في Discord Web، واختر نطاق التاريخ وصيغة التصدير، ثم شغّل
**Fetch date range**. لا تمرر يدوياً ولا تغيّر القناة أثناء الجمع
التلقائي. استخدم **Alt/Option + Shift + D** لإظهار اللوحة أو إخفائها.

تستخدم التواريخ المنطقة الزمنية المحلية للمتصفح، ويشمل تاريخ النهاية
اليوم كاملاً.

## الخصوصية والقيود

يقرأ السكربت فقط الرسائل التي يسمح للحساب الحالي برؤيتها والتي حمّلها
Discord فعلياً. لا يتجاوز الصلاحيات، ولا يستعيد الرسائل المحذوفة، ولا
يقرأ السجل الذي لم يتم تحميله مباشرة. تبقى الوسائط في HTML مرتبطة
بعناوين URL بعيدة وقد تنتهي صلاحيتها أو تتطلب إذناً لاحقاً.
