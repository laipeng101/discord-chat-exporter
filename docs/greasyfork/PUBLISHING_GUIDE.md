# GitHub + Greasy Fork 发布方案

## 推荐方案

这个项目当前是单文件用户脚本，不需要 GitHub Actions 才能发布。推荐使用：

`Git commit/tag → GitHub Release → Greasy Fork release webhook → Greasy Fork 从 GitHub Raw 分支读取 .user.js`

这样可以把"普通 push"和"正式发布"分开：开发提交不会立即推到 Greasy
Fork，只有创建 GitHub Release 时才触发正式同步。

## 首次建立仓库

1.  从本工作区的 `v1.1.0 → v1.2.0 → v1.3.0 → v1.4.0` 重建顺序提交。
2.  每个版本提交后创建同名 annotated tag。
3.  推送 `main` 和全部 tags。
4.  按版本顺序创建 GitHub Releases，并把原始 ZIP 作为 release asset。
5.  `v1.4.0` 标记为 Latest。

注意：本工作区没有 v1.0.0 的实际
ZIP，只在历史对话中看到它曾经存在。因此不要伪造 v1.0.0
commit/tag/release。

## Greasy Fork 首次发布

首次发布建议从 GitHub Raw 的 `main` 分支导入：

`https://raw.githubusercontent.com/<OWNER>/<REPO>/main/discord-chat-exporter.user.js`

必须使用分支 URL，不要固定到某个 commit SHA，否则后续无法跟随更新。

导入后，把 `greasyfork/locales/` 中的 11 份文案分别填入 Greasy Fork
的本地化 Additional info。脚本本身已经包含对应的本地化 `@name:*` 与
`@description:*`。

## Webhook

在 Greasy Fork 登录后打开账户的 webhook 配置页，取得 GitHub 所需的：

-   Payload URL
-   Content type
-   Secret

GitHub 端推荐只订阅 **Releases**，不要订阅 Pushes。这样只有正式 GitHub
Release 才会触发 Greasy Fork 更新。

如果 `gh api` 对创建 repository webhook 权限不足，就使用 GitHub 网页：

`Repository → Settings → Webhooks → Add webhook`

填写 Greasy Fork 提供的 Payload URL / Secret，Content type 使用 Greasy
Fork 页面要求的值，事件选择：

`Let me select individual events → 取消 Pushes → 勾选 Releases`

## 后续每次正式发布

1.  修改代码并递增 `@version`。
2.  执行语法检查和必要回归。
3.  `git commit`。
4.  创建 `vX.Y.Z` annotated tag。
5.  推送 `main` 和 tag。
6.  用 `gh release create vX.Y.Z --verify-tag ...` 创建 GitHub Release。
7.  等待 Greasy Fork release webhook 同步。
8.  打开 Greasy Fork 脚本页核对版本号和代码。
9.  若同步失败，先看 GitHub webhook Recent Deliveries，再看 Greasy Fork
    同步状态；不要直接重复发布同一版本号。

## 为什么不默认使用 Actions

当前发布物就是仓库中的 `.user.js`，没有 TypeScript/Vite/Webpack
构建步骤。Actions 会增加 token、workflow
和构建产物管理复杂度，但没有带来必要价值。未来如果改成
`src/ → build → dist/*.user.js`，再加入 Actions 更合适。
