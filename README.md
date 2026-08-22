# Compagnon D&D 5.5 FR

Extension Chrome/Edge Manifest V3 pour la feuille officielle **D&D 2024 de Roll20**. Elle traduit l’interface en français, enrichit les sorts, dons et aptitudes, et donne accès à un compendium local fondé sur le SRD 5.2.1 français.

## Fonctionnalités

- traduction automatique des principaux libellés de la feuille D&D 2024 ;
- affichage optionnel des noms anglais à côté des traductions françaises ;
- détection des sorts, dons et aptitudes de classe dans les contenus dynamiques de Roll20 ;
- compendium local consultable hors ligne : règles, sorts, dons, classes, sous-classes, origines, équipement, objets magiques et tables de progression ;
- bestiaire DRS hors ligne de **330 profils** (235 monstres et 95 animaux), avec filtres simples par type et FP et filtres avancés repliables ;
- boutons de jet sur les attaques et actions mécaniques des monstres : préparation d’une carte privée dans le chat Roll20, envoi automatique optionnel ou copie de la macro ;
- recherche et filtres de sorts par classe et niveau ;
- catalogue d’armes, d’armures et de boucliers avec filtres par type et maîtrise d’arme, et accès direct à la règle de chaque botte d’arme ;
- catalogue des espèces et historiques du SRD, avec accès direct au don accordé par chaque historique ;
- catalogue complémentaire de **391 sorts** et **75 dons**, avec liens vers AideDD lorsque la fiche n’est pas disponible dans le SRD local ;
- menu contextuel **Traduire cette fiche D&D 2024** ;
- prise en charge des différentes frames et surfaces utilisées par Roll20.

## Installation locale

Prérequis : [Node.js](https://nodejs.org/) et npm.

```bash
npm install
npm run build
```

Dans Chrome ou Edge :

1. ouvrez `chrome://extensions` ou `edge://extensions` ;
2. activez le **Mode développeur** ;
3. choisissez **Charger l’extension non empaquetée** ;
4. sélectionnez le dossier `dist` généré par le build.

Après une modification du code, relancez `npm run build`, puis rechargez l’extension depuis la page des extensions.

## Utilisation

Ouvrez une table Roll20 utilisant la feuille officielle D&D 5 moderne (`dnd2024byroll20`). Le bouton **D&D 5.5 FR** donne accès au compendium dès l'arrivée sur la table :

- **Traduire la feuille** active ou désactive les enrichissements ;
- **Conserver les noms anglais** affiche les noms bilingues lorsqu’ils sont disponibles.

Faites glisser le bouton pour le placer où vous le souhaitez. Un clic sur l'icône de l'extension dans Chrome ou Edge permet de masquer ou réafficher ce bouton ; sa position et sa visibilité sont mémorisées.

Dans une fiche de monstre, le bouton **Roll20** prépare une carte privée pour le MJ avec deux d20 d’attaque, les dégâts, les sauvegardes et les effets disponibles. Par défaut, la commande est placée dans un chat Roll20 visible et vide sans être envoyée. Le réglage **Lancer automatiquement les jets** permet de l’envoyer immédiatement par le bouton officiel du chat. Si le chat est masqué, détaché ou contient déjà un brouillon, la macro est copiée dans le presse-papiers sans écraser le texte existant.

Vous pouvez également faire un clic droit dans la fiche et sélectionner **Traduire cette fiche D&D 2024**. Les références absentes du SRD local ne sont ouvertes sur AideDD qu’après une action explicite de votre part.

## Développement et vérifications

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
```

Pour reconstruire automatiquement pendant le développement :

```bash
npm run dev
```

## Régénérer le compendium

Le fichier `fr_srd_cc_v5.2.1.pdf` sert de source au compendium embarqué. La génération nécessite Python ainsi que `pypdf` et `pdfplumber`.

```bash
python scripts/extract-srd.py
python scripts/extract-class-tables.py
python scripts/build-compendium.py
python scripts/build-monsters.py
```

Les scripts produisent les données structurées utilisées par l’extension dans `src/data/`.

## Paquet installable

```bash
npm run package
```

L'archive prête à distribuer est générée dans `releases/`. Consultez aussi [la checklist de publication](docs/RELEASE-CHECKLIST.md), [la politique de confidentialité](PRIVACY.md) et [les attributions](THIRD_PARTY_NOTICES.md).

## Confidentialité

L’extension ne modifie pas les champs ni les données du personnage. Elle conserve uniquement les préférences `enabled` et `bilingual` dans le stockage local du navigateur. Le compendium SRD est embarqué dans l’extension et fonctionne hors ligne.

## Attribution

Cette œuvre inclut du matériel issu du System Reference Document 5.2.1 (« SRD 5.2.1 ») de Wizards of the Coast LLC, disponible sur [D&D Beyond](https://www.dndbeyond.com/srd), sous licence [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/deed.fr).

AideDD est utilisé comme destination pour certaines références françaises absentes du compendium local. Ce projet n’est affilié ni à Roll20, ni à Wizards of the Coast, ni à AideDD.
