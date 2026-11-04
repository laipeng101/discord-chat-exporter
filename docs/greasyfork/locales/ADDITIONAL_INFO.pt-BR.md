# Exportador de chat do Discord

Exporta as mensagens que sua conta já pode visualizar no canal atual do
Discord Web. Todo o processamento acontece na aba atual do navegador; o
script não chama APIs privadas do Discord nem envia o conteúdo do chat.

## Principais recursos

-   Escolha as datas inicial e final. O script percorre a lista de mensagens automaticamente.
-   Salve o resultado em TXT, JSON, CSV ou em um único arquivo HTML.
-   Quando disponíveis, a exportação inclui texto, autor, respostas, mensagens encaminhadas, prévias de links, anexos, figurinhas e reações.
-   No HTML, você pode buscar mensagens ou autores e abrir imagens, vídeos e áudios que ainda estejam disponíveis.
-   Interface em 19 idiomas.

## Uso

Abra um canal de texto no Discord Web, escolha o período e o formato e
clique em **Coletar mensagens por data**. Não role a lista de mensagens nem troque de canal
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
