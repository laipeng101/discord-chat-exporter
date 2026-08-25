# Discord Chat Exporter

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
export format, then click **Collect date range**. Do not manually scroll
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

## Source and support

- [GitHub repository](https://github.com/laipeng101/discord-chat-exporter)
- [Report an issue](https://github.com/laipeng101/discord-chat-exporter/issues)
