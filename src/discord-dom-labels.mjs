// These are Discord's own accessibility labels, independent of the exporter's language.
export function createDiscordLabelParser(clean) {
  const serverTagPattern = /(?:,\s*)?(?:server\s*tag|服务器标签|伺服器標籤|サーバータグ|서버\s*태그|etiqueta\s+del\s+servidor|balise\s+du\s+serveur|server-tag|tag\s+do\s+servidor|тег\s+сервера|علامة\s+الخادم)\s*[:：].*$/i;
  const avatarSuffix = /,?\s*(?:avatar|头像|頭像|アバター|아바타|avatar\s+del\s+usuario|аватар)\s*$/i;

  function author(value) {
    const label = clean(value).replace(/\u00A0/g, ' ');
    if (!serverTagPattern.test(label)) return label;
    return label.replace(serverTagPattern, '').trim().replace(/\s*\[[^\]\n]{1,24}\]\s*,?\s*$/, '').trim();
  }

  return {
    author,
    isServerTag: (value) => serverTagPattern.test(clean(value)),
    avatarAuthor: (value) => author(value).replace(avatarSuffix, '').trim()
  };
}
