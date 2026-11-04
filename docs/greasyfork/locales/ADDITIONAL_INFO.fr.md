# Exportateur de discussions Discord

Exporte les messages que votre compte peut déjà consulter dans le salon
Discord Web actuel. Tout le traitement reste dans l'onglet du navigateur
: aucune API privée de Discord n'est appelée et aucun contenu de
discussion n'est envoyé ailleurs.

## Fonctions principales

-   Choisissez les dates de début et de fin. Le script fait défiler automatiquement la liste des messages.
-   Enregistrez le résultat en TXT, JSON, CSV ou dans un seul fichier HTML.
-   L’export conserve le texte, les auteurs, les réponses, les messages transférés, les aperçus de liens, les pièces jointes, les stickers et les réactions, selon ce que Discord affiche.
-   Dans le fichier HTML, vous pouvez rechercher des messages ou des auteurs et consulter les images, vidéos et fichiers audio encore accessibles.
-   Interface en 19 langues.

## Utilisation

Ouvrez un salon texte dans Discord Web, choisissez la période et le
format, puis cliquez sur **Collecter les messages par date**. Ne faites pas défiler
manuellement et ne changez pas de salon pendant la collecte automatique.
**Alt/Option + Shift + D** affiche ou masque le panneau.

Les dates utilisent le fuseau horaire local du navigateur et la date de
fin inclut toute la journée.

## Confidentialité et limites

Le script ne lit que les messages visibles pour le compte connecté et
réellement chargés par Discord. Il ne contourne pas les permissions, ne
restaure pas les messages supprimés et n'accède pas directement à
l'historique non chargé. Les médias HTML restent référencés par URL
distante et peuvent expirer ou nécessiter des droits.

## Code source et assistance

- [Dépôt GitHub](https://github.com/laipeng101/discord-chat-exporter)
- [Signaler un problème](https://github.com/laipeng101/discord-chat-exporter/issues)
