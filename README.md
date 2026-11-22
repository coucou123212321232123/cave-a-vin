# La Cave de Camille

Petite appli (PWA) pour visualiser la cave à vin depuis un téléphone : cave interactive, bouteilles en 3D, liste, fenêtres de dégustation, ajout / modification et historique des bouteilles ouvertes.

## Tester sur l'ordinateur

```powershell
python -m http.server 5173
```

Puis ouvrir http://localhost:5173

## Installer sur le téléphone

L'appli doit être servie en **https** pour pouvoir s'installer. Le plus simple :

1. **Netlify Drop** : aller sur https://app.netlify.com/drop et glisser ce dossier entier → une URL https est fournie.
   (ou GitHub Pages / Cloudflare Pages, au choix)
2. Ouvrir l'URL sur le téléphone :
   - **iPhone (Safari)** : bouton Partager → « Sur l'écran d'accueil »
   - **Android (Chrome)** : menu ⋮ → « Installer l'application »

Après la première ouverture, l'appli fonctionne hors-ligne.

## Données

- Les bouteilles sont enregistrées **sur l'appareil** (stockage local du navigateur).
- Réglages (⚙) → **Exporter** pour sauvegarder / transférer vers un autre téléphone, **Importer** pour restaurer.
- L'inventaire de départ est dans `js/data.js`.
- Les fenêtres de dégustation sont indicatives et modifiables dans chaque fiche.
