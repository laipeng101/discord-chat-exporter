# Exportateur de discussions Discord

Exporte les messages que votre compte peut déjà consulter dans le salon
Discord Web actuel. Tout le traitement reste dans l'onglet du navigateur
: aucune API privée de Discord n'est appelée et aucun contenu de
discussion n'est envoyé ailleurs.

## Fonctions principales

-   Sélection d'une date de début et de fin avec collecte automatique de
    la période.
-   Choix automatique du défilement vers le haut ou le bas selon la
    position actuelle.
-   Collecte avec zones de vue chevauchantes pour réduire les messages
    manqués.
-   Export TXT, JSON, CSV et archive HTML autonome lisible.
-   Conservation, lorsque disponible, de l'auteur, avatar, texte,
    réponses, intégrations, pièces jointes, stickers, emoji
    Unicode/personnalisés et réactions structurées.
-   L'HTML regroupe par date locale, compacte les messages consécutifs,
    permet la recherche texte/auteur et affiche les images, vidéos et
    sons disponibles.
-   Réutilisation de dictionnaires auteurs/médias/emoji et compression
    gzip de la base intégrée si le navigateur le permet.
-   Les emoji standards sont stockés en Unicode ; les emoji
    personnalisés sont dédupliqués par ID Discord avec repli `:nom:`.
-   Interface en 11 langues.

## Utilisation

Ouvrez un salon texte dans Discord Web, choisissez la période et le
format, puis lancez **Fetch date range**. Ne faites pas défiler
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
