# Exportador de chats de Discord

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
