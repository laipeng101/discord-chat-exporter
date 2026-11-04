# Exportador de chats de Discord

Exporta los mensajes que tu cuenta ya puede ver en el canal actual de
Discord Web. Todo el procesamiento ocurre en la pestaña del navegador;
no usa APIs privadas de Discord ni sube el contenido del chat.

## Funciones principales

-   Elige las fechas de inicio y fin. El script recorre la lista de mensajes automáticamente.
-   Guarda el resultado en TXT, JSON, CSV o en un solo archivo HTML.
-   Conserva, cuando están disponibles, el remitente, el texto, las respuestas, los mensajes reenviados, las vistas previas de enlaces, los adjuntos, los stickers y las reacciones.
-   En el HTML puedes buscar mensajes o remitentes y ver las imágenes, el vídeo y el audio que sigan disponibles.
-   Interfaz en 19 idiomas.

## Uso

Abre un canal de texto en Discord Web, elige el intervalo y el formato y
pulsa **Recopilar mensajes por fecha**. No desplaces la lista de mensajes
ni cambies de canal durante la recopilación automática. **Alt/Option +
Shift + D** muestra u oculta el panel.

Las fechas usan la zona horaria local del navegador y la fecha final
incluye todo ese día.

## Privacidad y límites

Solo puede leer mensajes que la cuenta actual puede ver y que Discord ya
haya renderizado. No evita permisos, no recupera mensajes borrados ni
accede directamente a historial aún no cargado. Los medios del HTML
siguen usando URLs remotas, que pueden caducar o requerir permisos.

## Código fuente y soporte

- [Repositorio de GitHub](https://github.com/laipeng101/discord-chat-exporter)
- [Reportar un problema](https://github.com/laipeng101/discord-chat-exporter/issues)
