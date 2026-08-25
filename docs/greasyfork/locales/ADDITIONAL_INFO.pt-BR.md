# Exportador de chat do Discord

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
clique em **Coletar período**. Não role manualmente nem troque de canal
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

## Código-fonte e suporte

- [Repositório no GitHub](https://github.com/laipeng101/discord-chat-exporter)
- [Relatar um problema](https://github.com/laipeng101/discord-chat-exporter/issues)
