# La Cave de Camille

Petite appli (PWA) pour visualiser la cave à vin depuis un téléphone : cave en 3D, bouteilles et étiquettes de chaque domaine, inventaire, fenêtres de dégustation, ajout / modification et historique des bouteilles ouvertes.

- Touchez la cave (ou « Entrer dans la cave ») : elle pivote face à vous et la porte vitrée s'efface.
- Glissez dans tous les sens pour parcourir les clayettes des deux portes (la vue est assez proche pour lire les étiquettes), touchez une bouteille : elle sort et vient devant vous.
- Glissez à gauche / droite pour la faire tourner ; « Déboucher » la retire de la cave et l'envoie dans les Souvenirs.
- « Retirer sans souvenir » (erreur de saisie, bouteille offerte…) la sort de la cave sans l'ajouter aux Souvenirs ; « Annuler » la remet juste après.

## Plusieurs caves et rangement

- Quand les bouteilles ne tiennent plus dans une cave, une nouvelle cave apparaît à côté (60 bouteilles par cave).
- Vue d'ensemble : touchez le nom d'une cave pour y entrer. Dans une cave, les pastilles en bas permettent de voyager de l'une à l'autre.
- Bouton ⇅ : ranger par domaine, millésime, région, date d'obtention, couleur ou urgence. Les bouteilles glissent jusqu'à leurs nouvelles clayettes, chaque groupe a son étiquette sur l'étagère.
- La **date d'obtention** se règle dans la fiche de chaque bouteille.

## Souvenirs

- Onglet **Souvenirs** : un mur avec une étagère par année, où se rangent les bouteilles bues (la plus récente en haut, la date gravée sous chaque bouteille).
- En débouchant une bouteille : la date, avec qui, le contexte, le lieu, une note sur 5 et un petit texte.
- Touchez une bouteille du mur pour revoir le souvenir, le modifier ou le supprimer. **Liste** montre tous les souvenirs par année.

## Fichiers

| Fichier | Rôle |
|---|---|
| `js/data.js` | Inventaire de départ |
| `js/labels.js` | Étiquettes, verre et capsule de chaque domaine |
| `js/scene.js` | Scène 3D (cave, bouteilles, caméra) |
| `js/app.js` | Interface, fiches, inventaire, sauvegardes |
| `css/styles.css` | Thème et animations |
| `assets/` | Vraies étiquettes Chanzy (photos de chanzy.com mises à plat), blason et logo |

## Ajouter une bouteille avec sa vraie étiquette

1. Bouton **+** → **Photographier l'étiquette** (appareil photo ou galerie).
2. Placer les 4 coins sur les bords de l'étiquette ; les 2 points du milieu suivent la courbure du haut et du bas (la loupe aide à viser).
   - **Sur la bouteille** : photo d'une étiquette collée sur la bouteille (elle est « déroulée »).
   - **Étiquette à plat** : étiquette décollée, ou image prise sur un site.
3. **Valider**, puis remplir la fiche. En tapant l'appellation, la région, la couleur et la forme de bouteille se remplissent toutes seules.

Conseils photo : bien de face, à hauteur de l'étiquette, sans flash, à la lumière du jour.

Sans photo, la bouteille reçoit une étiquette sobre générée. La forme (bourguignonne, bordelaise, jurassienne, clavelin, flûte, champenoise) vient de l'appellation, ou du choix « Forme de la bouteille » du formulaire.

| Fichier | Rôle |
|---|---|
| `js/appellations.js` | ~230 appellations : région, couleur, forme de bouteille, garde |
| `js/photos.js` | Photos d'étiquettes : rangement sur l'appareil, mise à plat |

Les photos sont rangées sur le téléphone (IndexedDB) et incluses dans l'export de sauvegarde.

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
**Charger remplace les bouteilles du téléphone** par celles du fichier. Les souvenirs (bouteilles ouvertes) sont gardés.

## Installer sur le téléphone

1. Ouvrir le lien du site sur le téléphone :
   - **iPhone (Safari)** : bouton Partager → « Sur l'écran d'accueil »
   - **Android (Chrome)** : menu ⋮ → « Installer l'application »

Après la première ouverture, l'appli fonctionne hors-ligne.

## Données

- Les bouteilles sont enregistrées **sur l'appareil** (stockage local du navigateur).
- Réglages → **Exporter** pour sauvegarder / transférer vers un autre téléphone, **Importer** pour restaurer.
- L'inventaire de départ est dans `js/data.js`.
- Les fenêtres de dégustation sont indicatives et modifiables dans chaque fiche.
- La garde maximale (en années après le millésime) est une estimation selon l'appellation, réglable dans `js/appellations.js` (et `gardeMax()` de `js/app.js`).
