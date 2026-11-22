# La Cave de Camille

Petite appli (PWA) pour visualiser la cave à vin depuis un téléphone : cave interactive, bouteilles en 3D, liste, fenêtres de dégustation, ajout / modification et historique des bouteilles ouvertes.

## Tester sur l'ordinateur

```powershell
python -m http.server 5173
```

Puis ouvrir http://localhost:5173

## En ligne

Site : https://coucou123212321232123.github.io/cave-a-vin/
Dépôt : https://github.com/coucou123212321232123/cave-a-vin

Le site est publié par GitHub Pages depuis la branche `main`.

## Faire des modifications et les publier

```powershell
git add -A
git commit -m "Ce que j'ai changé"
git push
```

Le site se met à jour 1 à 2 minutes après le push. Sur le téléphone, fermer puis rouvrir l'appli pour voir la nouvelle version.

Si la liste de bouteilles de `js/data.js` a changé, l'appli propose « La liste de la cave a été mise à jour → Charger ».
**Charger remplace les bouteilles du téléphone** par celles du fichier. L'historique des bouteilles ouvertes est gardé.

## Installer sur le téléphone

1. Ouvrir le lien du site sur le téléphone :
   - **iPhone (Safari)** : bouton Partager → « Sur l'écran d'accueil »
   - **Android (Chrome)** : menu ⋮ → « Installer l'application »

Après la première ouverture, l'appli fonctionne hors-ligne.

## Données

- Les bouteilles sont enregistrées **sur l'appareil** (stockage local du navigateur).
- Réglages (⚙) → **Exporter** pour sauvegarder / transférer vers un autre téléphone, **Importer** pour restaurer.
- L'inventaire de départ est dans `js/data.js`.
- Les fenêtres de dégustation sont indicatives et modifiables dans chaque fiche.
