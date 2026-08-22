# Mise à disposition Store — version 1.2.0

## État de préparation

| Élément | État | Action |
| --- | --- | --- |
| Archive `compagnon-dd55-fr-1.2.0.zip` | Prête | Refaire le paquet après les derniers changements de description. |
| Version du manifeste | Prête | Vérifier `1.2.0` dans l’archive finale. |
| Description courte et détaillée | Prête | Copier les textes de `store-assets/STORE-LISTING-FR.md`. |
| Notes de version | Prêtes | Copier le bloc V1.2.0 dans la fiche ou les notes de soumission. |
| Politique de confidentialité | Mise à jour | Vérifier que son URL GitHub est publique avant la soumission. |
| Icône 128×128 | Prête | `store-assets/store-icon-128.png`. |
| Tuile 440×280 | Prête | `store-assets/small-promo-440x280.png`. |
| Captures 1280×800 | Prêtes | Cinq vues sont disponibles : feuille traduite, compendium, fiche de monstre en grand, résultats Roll20 et choix du mode de jet. |
| Vérification réelle Chrome/Edge | À faire | Installer l’archive finale dans des profils propres et tester sur une table Roll20. |
| Accès aux tableaux de bord Store | Action propriétaire | Téléversement et validation finale par le compte éditeur.

## Stratégie recommandée

### 1. Préparation finale

1. Relire les cinq captures préparées dans `store-assets/screenshots/`, sans information de campagne ni brouillon de chat visible.
2. Exécuter la checklist automatique et les contrôles manuels Chrome/Edge.
3. Régénérer l’archive et conserver son empreinte SHA-256.
4. Vérifier que les URL de site, d’assistance et de confidentialité sont publiques.

### 2. Soumission Chrome Web Store

1. Ouvrir l’élément existant dans le Chrome Developer Dashboard.
2. Dans **Package**, téléverser `compagnon-dd55-fr-1.2.0.zip`.
3. Dans **Store listing**, remplacer la description et les captures.
4. Dans **Privacy practices**, mettre à jour l’objectif unique, les justifications de permissions et le traitement local du contenu de sites web.
5. Dans **Test instructions**, fournir le scénario Aboleth et la fenêtre Normal / Avantage / Désavantage.
6. Demander l’examen avec la **publication différée** activée. L’ancienne version reste disponible pendant l’examen.
7. Après approbation, vérifier une dernière fois la fiche puis déclencher manuellement la publication dans le délai indiqué par le tableau de bord.

Les mises à jour sont examinées avant publication. Les délais varient et peuvent être plus longs pour une mise à jour importante ou utilisant plusieurs permissions de sites. Si l’examen dépasse trois semaines, utiliser le support développeur du Chrome Web Store.

### 3. Soumission Microsoft Edge Add-ons

1. Ouvrir l’extension existante dans Microsoft Partner Center.
2. Téléverser la même archive finale.
3. Vérifier les propriétés, la disponibilité, la confidentialité et la fiche française.
4. Ajouter les mêmes captures et instructions de certification.
5. Soumettre la mise à jour après le contrôle du récapitulatif.

### 4. Mise en ligne et surveillance

1. Installer la version publiée depuis chaque Store dans un profil navigateur propre.
2. Vérifier traduction, ouverture du compendium, recherche de monstres, préparation d’un jet, protection d’un brouillon et réglages persistants.
3. Surveiller les erreurs, avis et demandes d’assistance pendant 48 heures.
4. Conserver `compagnon-dd55-fr-1.1.0.zip` et les informations de sa fiche pour faciliter un retour arrière si nécessaire.

## Critères autorisant la publication

- Aucun échec de typage, test unitaire, build ou Playwright.
- Aucun envoi automatique de chat avec le réglage désactivé.
- Aucune donnée réelle de joueur ou de campagne dans les captures.
- Description, politique de confidentialité et déclarations du tableau de bord cohérentes.
- Archive finale portant la version `1.2.0` et testée dans Chrome et Edge.

## Liens officiels

- Chrome — mettre à jour un élément : https://developer.chrome.com/docs/webstore/update
- Chrome — processus d’examen : https://developer.chrome.com/docs/webstore/review-process
- Chrome — fiche et images : https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- Edge — publier une extension : https://learn.microsoft.com/microsoft-edge/extensions/publish/publish-extension
