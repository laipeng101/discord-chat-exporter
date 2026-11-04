# Discord Chat Exporter — Maintainer Publishing Guide

## Current setup

-   GitHub repo: <https://github.com/laipeng101/discord-chat-exporter>
-   Default branch: `main`
-   Greasy Fork sync URL: `https://raw.githubusercontent.com/laipeng101/discord-chat-exporter/main/discord-chat-exporter.user.js`
-   Greasy Fork script: <https://greasyfork.org/scripts/592901-discord-chat-exporter-date-range-multi-language>
-   GitHub → Greasy Fork webhook: `release` events only
-   The committed `.user.js` is the final published artifact. Rebuild it locally from `src/` with `node scripts/build.mjs`.

## Normal release

For a future `vX.Y.Z`:

1.  Edit the sources in `src/`, bump `@version` in `src/userscript-header.txt`, and run `node scripts/build.mjs`.
2.  Run `node --check discord-chat-exporter.user.js` and `node scripts/check-locales.mjs`.
3.  Regression-test in a real browser: single day, cross-day, empty range, all four formats, cancel, channel switch, hide and shortcut restore.
4.  Commit the change.
5.  Create an annotated tag: `git tag -a vX.Y.Z -m "Discord Chat Exporter vX.Y.Z"`.
6.  Push: `git push origin main && git push origin vX.Y.Z`.
7.  Create the release from the existing tag (never let `gh release create` create the tag implicitly):

    ```bash
    gh release create vX.Y.Z \
      --repo laipeng101/discord-chat-exporter \
      --verify-tag \
      --title "vX.Y.Z — <short summary>" \
      --notes-file docs/release-notes/vX.Y.Z.md \
      [path/to/asset.zip]
    ```

8.  The `release`-only webhook triggers the Greasy Fork sync.
9.  Verify the version and code on both GitHub and Greasy Fork.

For a new locale, add a **Localized synced additional info** row in Greasy
Fork's **Admin → Code syncing** section. Select the locale, choose Markdown,
and use the same GitHub raw URL pattern as the existing rows:

```
https://raw.githubusercontent.com/laipeng101/discord-chat-exporter/refs/heads/main/docs/greasyfork/locales/ADDITIONAL_INFO.<tag>.md
```

Ensure the URL is available on `main` before syncing. Keep the existing
sync URL and Webhook setting. Save the rows, then verify the public listing
after the release webhook or **Update settings and sync now**. The admin
locale list includes languages that do not appear in Greasy Fork's site
language menu (for example, Hindi).

## Important invariants

-   Do not change the default `@name` casually: on Greasy Fork it is part of the published script identity, and changing it can confuse installed users' update checks.
-   Do not change `@namespace`.
-   Every code change must bump `@version`.
-   Never force-push a published tag.
-   Never commit tokens, cookies, or webhook secrets.
-   Consider GitHub Actions only if a real build step (`src → build → dist/*.user.js`) is introduced later.

## Verification

After each release, check:

```bash
node --check discord-chat-exporter.user.js
node scripts/check-locales.mjs
gh release list --repo laipeng101/discord-chat-exporter
gh release view vX.Y.Z --repo laipeng101/discord-chat-exporter --json url,tagName,assets
curl -sSL https://raw.githubusercontent.com/laipeng101/discord-chat-exporter/main/discord-chat-exporter.user.js | grep -m1 '^// @version'
gh api repos/laipeng101/discord-chat-exporter/hooks --jq '.[] | {active, events}'
```

The webhook must stay `active=true` with `events=["release"]` only, and the Greasy Fork script page must show the new version. If a sync fails, inspect GitHub webhook Recent Deliveries before retrying; do not republish the same version number.
