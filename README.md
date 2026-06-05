# Pilot'Officine — Guide de démarrage Stackblitz

## 🚀 Étapes pour faire tourner l'outil (15 minutes)

### Étape 1 — Ouvrir Stackblitz
1. Va sur **https://stackblitz.com**
2. Clique sur **"React"** dans les templates du haut
3. Un projet React vide s'ouvre dans ton navigateur

### Étape 2 — Installer les dépendances
Dans le terminal en bas de l'écran, tape :
```
npm install recharts papaparse
```
Appuie sur Entrée et attends 30 secondes.

### Étape 3 — Copier les fichiers
Dans le panneau de gauche (l'explorateur de fichiers), remplace le contenu de chaque fichier :

| Fichier dans Stackblitz | Fichier à copier depuis ce dossier |
|---|---|
| `package.json` | `package.json` |
| `index.html` | `index.html` |
| `vite.config.js` | `vite.config.js` |
| `src/main.jsx` | `src/main.jsx` |
| `src/index.css` | `src/index.css` |
| `src/App.jsx` | `src/App.jsx` |
| `src/App.css` | `src/App.css` |

Pour les nouveaux fichiers à créer (clic droit > New File) :
| Nouveau fichier | Contenu |
|---|---|
| `src/tokens.js` | `src/tokens.js` |
| `src/data/demo.js` | `src/data/demo.js` |
| `src/utils/index.js` | `src/utils/index.js` |

### Étape 4 — Voir le résultat
La preview à droite se rafraîchit automatiquement.
Si ça ne se lance pas, tape dans le terminal :
```
npm run dev
```

### Étape 5 — Déployer (pour partager aux 10 pilotes)
Dans Stackblitz, clique sur **"Deploy"** en haut à droite.
Tu obtiens une URL publique en 2 clics. Partage-la.

---

## Structure des fichiers
```
pilot-officine/
├── index.html              # Point d'entrée HTML
├── vite.config.js          # Config Vite
├── package.json            # Dépendances
└── src/
    ├── main.jsx            # Bootstrap React
    ├── index.css           # Reset CSS global
    ├── App.jsx             # Composant principal
    ├── App.css             # Tous les styles
    ├── tokens.js           # Couleurs et palette
    ├── data/
    │   └── demo.js         # Données de démonstration
    └── utils/
        └── index.js        # Formatters, CSV parser, IA
```

## En cas de problème
Envoie un screenshot de l'erreur à Charles ou dans la conversation Claude.
