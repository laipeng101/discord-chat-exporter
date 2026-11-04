# Discord-Chat-Exporter

Exportiert Nachrichten, die Ihr Konto im aktuellen Discord-Webkanal
bereits sehen darf. Die Verarbeitung erfolgt ausschließlich im aktuellen
Browser-Tab; private Discord-APIs werden nicht aufgerufen und
Chat-Inhalte werden nicht hochgeladen.

## Hauptfunktionen

-   Wähle Start- und Enddatum. Das Skript scrollt automatisch durch die Nachrichtenliste.
-   Speichere Nachrichten als TXT, JSON, CSV oder als einzelne HTML-Datei.
-   Soweit verfügbar bleiben Absender, Text, Antworten, weitergeleitete Nachrichten, Linkvorschauen, Anhänge, Sticker und Reaktionen erhalten.
-   In der HTML-Datei kannst du nach Nachrichten oder Absendern suchen und verfügbare Bilder, Videos und Audiodateien öffnen.
-   Oberfläche in 19 Sprachen.

## Verwendung

Öffnen Sie einen Textkanal in Discord Web, wählen Sie Zeitraum und
Format und klicke auf **Nachrichten nach Datum erfassen**. Während der automatischen
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

## Quellcode und Support

- [GitHub-Repository](https://github.com/laipeng101/discord-chat-exporter)
- [Problem melden](https://github.com/laipeng101/discord-chat-exporter/issues)
