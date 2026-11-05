# Centrage PSA

Mesure le centrage d'une carte à partir d'une photo et le compare aux seuils de la grille PSA.
Application web statique : pas de serveur, pas de dépendance, pas d'étape de build.

## Contenu du dossier

- `index.html` : structure de la page
- `style.css` : styles et thèmes clair/sombre (les couleurs sont des variables CSS en tête de fichier)
- `app.js` : toute la logique
- `manifest.webmanifest` : nom, icônes et couleurs de l'app installée
- `sw.js` : service worker, pour le fonctionnement hors connexion
- `icons/` : icônes de l'app

## Tester sur ton ordinateur

Dans le dossier, lance `python3 -m http.server 8000` puis ouvre http://localhost:8000.
Ouvrir `index.html` directement fonctionne aussi, mais sans mode hors connexion ni installation.

## Mettre en ligne

**GitHub Pages** (conseillé : une mise à jour = un commit)

1. Crée un dépôt GitHub, par exemple `centrage-psa`, et envoie-y le contenu de ce dossier à la racine.
2. Dans Settings, Pages, Build and deployment : Source « Deploy from a branch », branche `main`, dossier `/ (root)`.
3. Une minute plus tard, le site est sur `https://TON-PSEUDO.github.io/centrage-psa/`.

**Netlify** (le plus rapide)

Va sur app.netlify.com/drop et glisse le dossier. Crée un compte gratuit pour garder le site.
Pour mettre à jour, redépose le dossier modifié.

## Installer sur le téléphone

- iPhone (Safari) : Partager, puis « Sur l'écran d'accueil ».
- Android (Chrome) : menu ⋮, puis « Installer l'application ».

Ouvre-la une première fois avec du réseau : ensuite elle fonctionne hors connexion.
Les polices viennent de Google Fonts ; hors connexion et sans visite préalable, des polices système les remplacent.

## Mettre à jour

Modifie les fichiers, puis commit et push (ou redépose sur Netlify).
L'app installée affiche d'abord sa copie en cache et récupère la nouvelle version en arrière-plan : tu la vois au lancement suivant.

Dans `sw.js` :
- ajoute tout nouveau fichier à la liste `SHELL` ;
- change `CACHE` (`centrage-psa-v2`, `v3`...) pour forcer le nettoyage de l'ancien cache.

## Où modifier quoi dans `app.js`

- `GRADES`, `limTop()`, `marginOf()` : seuils par note, seuil du PSA 10 et marge de sécurité du verdict.
- `LINES`, `DEFAULT_LINES` : les huit lignes de mesure et leur position de départ.
- `measure()` : calcul des ratios et des mesures en mm.
- `renderReadout()` : panneau de droite (verdict, jauges, tableau des seuils).
- `quadFromEdges()`, `snapAll()`, `doFlatten()` : aplatissement de la perspective.
- `makeSample()` : la carte fictive affichée au démarrage.
- `sync()` : met toute l'interface à jour. Appelle-la après avoir changé l'état d'une face.

Chaque face (recto, verso) est un objet dans `faces` : image d'origine, image de travail, rotation, lignes, bords de perspective.
Pour ajouter une fonction, donne ce dossier à Claude ou à Claude Code avec ta demande : le code est volontairement en un seul fichier lisible.
