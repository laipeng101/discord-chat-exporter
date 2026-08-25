# Discord 聊天导出器

在 Discord 网页版的当前文字频道中，采集你的账号有权查看、且已经由页面加载出来的消息，并按日期范围导出。

脚本会判断所选日期范围位于当前消息视窗之前、之后还是与当前视窗相交，然后选择成本较低的方向连续采集。若当前界面晚于整个日期范围，会从当前位置直接向上逐屏采集，到达开始边界后完成，不再回到顶部重复向下扫描；位于范围内时会先到较近边界，再反向覆盖另一边。也可以只扫描手动滚动到的消息。所有处理都在当前浏览器标签页内完成，不调用 Discord 私有 API，不使用外部依赖，不上传聊天内容。

## 功能

- 按开始日期和结束日期自动滚动采集当前频道，并根据当前视窗与完整日期范围的位置自动选择上翻或下翻。
- 上翻和下翻都使用重叠视窗边滚动边采集；只有到达当前已加载列表边缘时才触发继续加载，避免快速跳转漏掉中间消息。
- 当前视窗晚于整个范围时直接反向采集到开始日期并结束，取消“先上翻、再回头向下重扫”的冗余路径。
- 日期按浏览器本地时区解释，结束日期包含当天全部消息。
- 使用 Discord Snowflake 消息 ID 还原时间，避免受到 Discord 界面语言和时间显示格式影响。
- 自动按消息 ID 去重并恢复聊天顺序；同一 Discord 附件的 CDN 原图、媒体代理和缩略图会合并为一项，优先保留原图地址。
- 尽可能采集作者、真实头像、正文、Unicode/自定义表情、回复摘要、嵌入内容、贴纸、图片、视频、音频、附件地址、结构化反应及编辑状态。
- 导出 TXT、JSON、CSV、HTML。
- CSV 含 UTF-8 BOM，可直接用 Excel 等表格软件打开。
- HTML 为单文件可阅读归档页面：按日期分组，连续作者消息紧凑显示，正文 URL 可点击，代码块单独排版，并提供全文/作者搜索。
- HTML 将作者、头像、表情和媒体存入去重后的字典表，消息只保存引用；归档数据库使用浏览器原生 gzip 压缩后嵌入文件，打开时在本地解压和渲染。
- HTML 直接展示可识别的图片，提供视频和音频播放器，并保留文件链接；页面支持明暗主题、移动端和打印布局。
- 可选“完成后自动下载”，一次操作完成刷取和导出。
- 面板语言：English、简体中文、繁體中文、日本語、한국어、Español、Français、Deutsch、Português (Brasil)、Русский、العربية。
- 支持 `Alt/Option + Shift + D` 显示或隐藏面板。
- 支持 Discord 正式版、PTB 和 Canary 网页版。

## 安装

1. 安装 Tampermonkey、Violentmonkey 或兼容的用户脚本管理器。
2. 在 Greasy Fork 打开本脚本页面，点击“安装此脚本”。
3. 打开或刷新 `https://discord.com/channels/...`。
4. 右下角出现“Discord 聊天导出器”面板。

如果面板被隐藏，按 `Alt/Option + Shift + D` 重新显示。

## 按日期自动采集

1. 在 Discord 网页版中进入目标文字频道、帖子或私信会话。
2. 在面板中选择开始日期和结束日期。
3. 网络较慢、频道很活跃或日期跨度很大时，把“滚动等待”改为“稳妥（1200 毫秒）”。
4. 点击“自动刷取日期范围”。
5. 脚本比较当前已挂载消息与完整日期范围：范围较早就直接上翻采集，范围较新就向下采集；当前视窗位于范围内时先覆盖较近边界，再反向覆盖另一边。采集期间不要手动滚动消息列表，也不要切换频道。
6. 如需一次操作直接完成导出，先勾选“完成后自动下载”；否则状态显示完成后，再点击“下载”或“复制”。

结束日期按包含当天处理。例如，开始和结束都选择 `2026-08-24`，会筛选浏览器本地时间 8 月 24 日 00:00:00 至 8 月 25 日 00:00:00 之前的消息。

## 手动采集

脚本会监听当前页面新挂载的消息。你可以自己在频道内上下滚动，让目标消息出现在页面中，然后点击“扫描当前画面”。这适用于：

- 只想导出少量附近消息；
- Discord 自动加载较慢；
- 页面结构变化导致自动滚动暂时不可用。

面板中的“已见”是当前频道曾经采集到的消息总数；“范围内”是按照当前日期选择可导出的数量。

## 导出格式

### TXT

适合阅读、粘贴和交给文本分析工具。每条消息包含 ISO 时间、作者、消息 ID、正文和可用的附加信息。

### JSON

适合程序处理和二次开发。包含导出元数据、频道信息、日期范围及结构化消息数组。

### CSV

适合 Excel、LibreOffice Calc 或数据分析工具。多值字段以换行分隔，并按 CSV 规则进行引号转义。

### HTML

适合阅读和浏览媒体。生成单个 HTML 文件，其中会显示可用的作者头像、消息内自定义表情、反应图标和图片，视频和音频使用浏览器播放器，其他附件显示为链接。

页面顶部包含日期范围、消息数量、时区、导出时间、压缩体积和搜索栏；消息按浏览器本地日期分组。五分钟内同一作者的连续消息会使用紧凑布局，但每条消息仍保留独立时间、来源链接和消息 ID。长归档使用延迟图片加载及浏览器内容可见性优化，减少初次打开时的渲染负担。

HTML 不再为每条消息重复写入完整模板。导出时先建立轻量的内嵌归档数据库：作者表复用作者和头像，资源表复用头像、表情和媒体 URL，消息表只保存表索引；随后优先使用浏览器的 `CompressionStream('gzip')` 压缩。打开归档时由 `DecompressionStream` 在本机恢复并生成页面。若导出浏览器不支持压缩流，会自动回退到未压缩的 Base64 数据，功能仍可使用但文件会更大。

HTML 文件只保存消息文本、结构和媒体 URL，不会把媒体二进制数据打包进 HTML。打开 HTML 时需要联网读取 Discord CDN 或原始站点；临时、已删除、需要登录或已经过期的媒体 URL 可能无法显示。每项媒体下方都会保留原始链接，加载失败时仍可检查链接。

## 面板操作

- **扫描当前画面**：立即读取当前已经挂载的消息节点。
- **自动刷取日期范围**：按所选日期自动滚动当前消息列表。
- **取消**：在下一次滚动等待结束后停止自动采集，并保留已经采集的内容。
- **复制**：把当前格式的导出结果复制到剪贴板；内容很大时浏览器可能拒绝，此时使用“下载”。
- **下载**：以所选格式保存当前日期范围。
- **清空本频道**：只删除脚本内存中当前频道的采集记录，不会删除 Discord 消息。
- **最小化**：折叠面板。
- **隐藏**：隐藏面板；使用快捷键恢复。

## 限制与隐私

- 只能采集当前账号本来就能查看的内容，不能绕过频道权限。
- Discord 使用虚拟列表；没有被页面加载的消息无法直接读取。自动功能本质上是在控制当前列表滚动并等待 Discord 加载。
- 精确跳转到某条消息需要真实、已存在的消息链接。脚本只有日期而没有边界消息 ID 时，无法安全构造精确跳转链接，因此采用重叠视窗滚动，并只在列表边缘触发继续加载，不调用 Discord 私有搜索接口。
- 已删除的消息、未加载成功的消息和没有查看权限的内容不会出现。
- 作者名依赖页面中相邻消息的分组信息。若从一个消息组的中间开始、且组标题始终没有加载，个别连续消息的作者可能为空。
- Discord 前端会更新。如果出现“找不到消息列表”，先刷新页面；若仍无效，请提交浏览器版本、脚本版本、Discord 版本以及控制台报错，但不要公开敏感聊天内容。
- 脚本不发起数据上传、不加载远程 JavaScript、不使用统计、广告或自动更新检查。用户脚本管理器负责从 Greasy Fork 检查更新。
- 请只导出你有权处理的聊天内容，并遵守服务器规则、当地法律和相关参与者的隐私预期。

## 故障排查

### 数量停止增长

把滚动等待改为 1200 毫秒后重试。大型频道或首次加载很早的历史时，Discord 可能需要更长时间。

### 自动采集提前停止

脚本连续多次检测不到列表变化时会停止，以免无限循环。已经采集的内容会保留，可以手动滚动一段距离后再次运行。

### 导出数量为 0

确认日期使用的是浏览器本地时区，并检查“范围内”的数量。先手动滚到目标日期附近并点击“扫描当前画面”，可以判断该频道的消息节点是否正常识别。

### 复制失败

浏览器可能限制非安全上下文、后台标签页或超大剪贴板写入。直接点击“下载”。

### 切换频道后看到的数量变化

记录按服务器/私信范围和频道 ID 隔离。面板只统计、复制、下载和清空当前频道的数据。

## 控制台接口

高级用户可在浏览器开发者工具中使用：

```js
window.__discordChatExporter.scan();       // 扫描当前画面
window.__discordChatExporter.start();      // 按面板日期自动采集
window.__discordChatExporter.cancel();     // 取消自动采集
window.__discordChatExporter.count();      // 当前日期范围的数量
window.__discordChatExporter.messages();   // 当前日期范围的结构化记录副本
window.__discordChatExporter.text();       // 当前日期范围的 TXT 内容
window.__discordChatExporter.download();   // 按面板格式下载
window.__discordChatExporter.show();       // 显示面板
window.__discordChatExporter.hide();       // 隐藏面板
```

## Greasy Fork 发布清单

1. 打开 `discord-chat-exporter.user.js`，确认 `@namespace` 是你准备长期保留的稳定值。发布后不要随意修改 `@namespace` 或 `@name` 的默认值，否则脚本管理器可能把更新当成另一个脚本。
2. 如需署名，可在元数据块加入 `// @author 你的名字`。
3. 登录 Greasy Fork，在用户页面点击“发布新脚本”，粘贴完整 `.user.js` 内容。
4. 不要压缩或混淆代码；不要把主要功能改成从别处动态加载。
5. 许可证已经设置为 MIT。若要改许可证，请在首次发布前修改 `@license`。
6. 每次代码更新都递增 `@version`，建议使用 `1.0.1`、`1.1.0` 这类格式。
7. 把本文件“功能”到“限制与隐私”部分整理到 Greasy Fork 的脚本介绍；上传一张不含私人聊天内容的面板截图会更直观。
8. 发布前在一个测试频道分别验证：单日、跨日、空日期范围、四种格式、取消、切换频道、隐藏和快捷键恢复。

## 更新记录

### 1.3.0

- 根据 1,796 条消息、约 1.98 MB 的实际导出样本优化长归档；原样本约 97% 的内容来自重复消息模板。
- 新增真实作者头像采集，并以作者/头像字典复用；头像不可用时继续使用确定性的首字母头像。
- 保留正文中的 Unicode 表情和 Discord 自定义表情，自定义表情按原位置显示并提供文字替代。
- 反应改为“图标或符号 + 数量 + 是否由当前账号点选”的结构化记录，修复数量、“添加反应”和 aria-label 被拆成多个反应的问题。
- HTML 改为作者表、资源表和消息表组成的规范化内嵌数据库，并使用原生 gzip 压缩；不依赖外部 IndexedDB，复制单个 HTML 文件仍可打开。
- 自动采集改为真正的双向连续覆盖：从较新的界面向上采集时，到达开始边界即可结束，不再返回顶部向下重复扫描。
- 当前视窗位于日期范围内部时优先前往较近边界，再反向覆盖另一边；所有移动都使用重叠视窗降低漏采风险。

### 1.2.0

- 根据 514 条消息的实际月度导出样本重做 HTML 信息层级和排版。
- 修复作者名混入“服务器标签”、公会标签和部分角色徽章文字的问题。
- 合并同一 Discord 附件的 CDN 原图、媒体代理、缩略图和 GIF/WebP 派生版本；样本中的 118 个媒体项可合并为约 60 个独立媒体。
- 过滤嵌入卡片的作者/提供方小图标，避免把站点头像作为正文大图展示。
- 新增日期分组、连续消息紧凑布局、作者首字母头像、本地化时间、搜索过滤、结果计数和返回顶部。
- 回复、嵌入、反应、代码块、长链接和媒体说明改为独立且更紧凑的视觉样式。
- 对长归档使用 `content-visibility`，并完善移动端、暗色模式和打印样式。

### 1.1.0

- HTML 导出新增图片预览、视频播放器、音频播放器和普通文件链接。
- 新增结构化 `media` 字段，并在 CSV 中增加媒体列。
- 自动定位升级为双向判断：目标范围在当前视窗之前时上翻，在之后时下翻。
- 定位阶段快速跳到当前已加载列表边缘，跨过开始日期后再按重叠视窗顺序采集。

Greasy Fork 要求脚本具有准确说明、代码可检查、至少一个 `@match`/`@include`，并要求名称和说明使用正确的语言标记。本脚本已经提供多语言 `@name`/`@description`、三个 Discord 域名的精确 `@match`、完整源码和许可证。相关规则：

- [Greasy Fork 发布脚本规则](https://greasyfork.org/help/code-rules)
- [Greasy Fork 用户脚本元数据说明](https://greasyfork.org/help/meta-keys)
- [Discord 官方搜索与日期筛选说明](https://support.discord.com/hc/en-us/articles/115000468588-How-to-Use-Search-on-Discord)

## English quick guide

Open a Discord text channel in the browser, choose a local start and end date, and click **Fetch date range**. The script continuously collects in the most efficient direction: when the current viewport is newer than the whole range, it scans upward to the start boundary and finishes without rescanning downward. HTML exports retain available avatars, custom emoji and structured reaction icons/counts, normalize reusable assets into dictionary tables, and embed the archive database with native gzip compression. They remain portable single files with local-date groups, compact consecutive posts, media playback and instant text/author search. Do not scroll or change channels while collection runs. Press **Alt/Option + Shift + D** to show or hide the panel.

The script reads only messages rendered in the current tab, never calls Discord's private API, loads no external code, and sends no chat data anywhere.

## License

MIT
