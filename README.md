# Compagnon D&D 5.5 FR

Extension Chrome/Edge Manifest V3 qui enrichit visuellement la feuille officielle D&D 2024 de Roll20 : traduction des libellés, noms français des sorts et dons, liens directs vers AideDD et panneau de règles 2024.

## Installer et tester

```bash
npm install
npm test
npm run typecheck
npm run build
```

Chargez ensuite le dossier `dist` via `chrome://extensions` → **Mode développeur** → **Charger l’extension non empaquetée**.

L’extension ne modifie ni champs ni données du personnage. Elle stocke seulement les préférences `enabled` et `bilingual`; les pages AideDD ne s’ouvrent qu’après un clic.

Le contenu du fichier `fr_srd_cc_v5.2.1.pdf` est indexé dans l’extension pour une consultation locale. Pour régénérer les données après une mise à jour du PDF, exécutez `scripts/extract-srd.py` avec Python et `pypdf`.
