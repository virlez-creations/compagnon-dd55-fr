# Checklist de publication

## Vérifications automatiques

- `npm ci`
- `npm run typecheck`
- `npm test`
- `npm run test:e2e`
- `npm run package`

## Vérifications manuelles

- Charger `dist` comme extension non empaquetée dans Chrome et Edge.
- Vérifier une fiche intégrée, une fiche en fenêtre détachée et une fiche chargée dans une iframe.
- Vérifier les profils Guerrier, Rôdeur, Magicien, Clerc et Roublard.
- Vérifier que les fiches SRD ouvrent le compendium local et que les autres références ouvrent directement le bon onglet AideDD.
- Vérifier le bestiaire, les FP fractionnaires, le panneau de filtres avancés et plusieurs profils multi-pages.
- Vérifier qu’aucune icône de référence n’apparaît dans le résumé, les points de vie, les sens et les maîtrises/langues.
- Vérifier l'absence d'erreur dans la console de la page et du service worker.
- Relire `PRIVACY.md` et `THIRD_PARTY_NOTICES.md` avant toute soumission à une boutique.

## Livraison

La commande `npm run package` crée l'archive correspondant à la version courante dans `releases/`. Elle contient directement `manifest.json`, les scripts, la feuille de style et les icônes attendus par Chrome/Edge.
