# Discord-Chat-Exporter

Exportiert Nachrichten, die Ihr Konto im aktuellen Discord-Webkanal
bereits sehen darf. Die Verarbeitung erfolgt ausschließlich im aktuellen
Browser-Tab; private Discord-APIs werden nicht aufgerufen und
Chat-Inhalte werden nicht hochgeladen.

## Hauptfunktionen

-   Start- und Enddatum wählen und den Zeitraum automatisch erfassen.
-   Automatische Wahl der Scrollrichtung nach oben oder unten anhand der
    aktuellen Position.
-   Überlappende Ansichten reduzieren ausgelassene Nachrichten.
-   Export als TXT, JSON, CSV und lesbare einzelne HTML-Datei.
-   Erfasst soweit verfügbar Autor, Avatar, Text, Antworten, Embeds,
    Anhänge, Sticker, Unicode-/benutzerdefinierte Emoji und
    strukturierte Reaktionen.
-   HTML gruppiert nach lokalem Datum, zeigt aufeinanderfolgende
    Nachrichten kompakt, bietet Text-/Autorensuche und zeigt verfügbare
    Bilder, Videos und Audio.
-   Autoren, Medien und Emoji werden über Wörterbücher wiederverwendet;
    die eingebettete Datenbank wird bei Unterstützung mit gzip
    komprimiert.
-   Standard-Emoji werden als Unicode gespeichert; benutzerdefinierte
    Emoji werden über die Discord-Emoji-ID dedupliziert und fallen bei
    Fehlern auf `:name:` zurück.
-   Oberfläche in 11 Sprachen.

## Verwendung

Öffnen Sie einen Textkanal in Discord Web, wählen Sie Zeitraum und
Format und starten Sie **Zeitraum erfassen**. Während der automatischen
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
