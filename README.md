# 🎮 SUPPRESSION DÉTA — Jeu Professionnel

> Scénario original : **Khedim Benyakhlef** · Maison d'Édition Ahlem · ISBN 978-9969-521-15-3

---

## 📁 STRUCTURE DU PROJET

```
suppression-deta/
├── server/
│   └── index.js              ← Backend Express (API scores, saves, sessions)
├── public/
│   ├── index.html            ← Page principale (tous les écrans)
│   ├── manifest.json         ← PWA (logo barre des tâches)
│   ├── sw.js                 ← Service Worker (cache offline)
│   ├── css/
│   │   └── style.css         ← Design cyberpunk complet
│   ├── js/
│   │   ├── engine.js         ← Moteur Canvas 2D (entités, physique, IA)
│   │   ├── game.js           ← Logique jeu (4 actes, gaz, réputations, fins)
│   │   └── ui.js             ← Interface (HUD, minimap, leaderboard, notifs)
│   └── assets/
│       ├── images/           ← Sprites, tileset, logos, minimap, gas VFX
│       └── sounds/           ← 13 effets sonores WAV générés
├── package.json
└── render.yaml               ← Config déploiement Render
```

---

## 🚀 DÉPLOIEMENT SUR RENDER (étape par étape)

### Étape 1 — Préparer le code sur GitHub

1. Créez un compte sur [github.com](https://github.com) (gratuit)
2. Créez un nouveau dépôt (repository) nommé `suppression-deta`
3. Mettez **tous les fichiers** dans le dépôt en respectant la structure ci-dessus

### Étape 2 — Déployer sur Render

1. Allez sur **[render.com](https://render.com)** → Connectez-vous
2. Cliquez **"New +"** → **"Web Service"**
3. Connectez votre compte GitHub → Sélectionnez le dépôt `suppression-deta`
4. Remplissez les champs :

| Champ | Valeur |
|---|---|
| Name | `suppression-deta` |
| Environment | `Node` |
| Region | `Frankfurt (EU Central)` |
| Branch | `main` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Plan | `Free` |

5. Cliquez **"Create Web Service"**
6. Attendez 2-3 minutes → votre URL sera : `https://suppression-deta.onrender.com`

### Étape 3 — Variables d'environnement (optionnel)

Dans Render → votre service → **Environment** :

```
NODE_ENV=production
PORT=10000
```

---

## 🎮 FONCTIONNALITÉS DU JEU

### Gameplay
- ✅ **4 Actes complets** avec narration (Le Contrat, Chaos Gaz Rire, Adversaire Masqué, Rédemption)
- ✅ **2 Personnages jouables** — Alex (combat) et Lana (piratage Neural Hack)
- ✅ **Système de Gaz signature** — Inferno / Rire / Inerte / Fumée avec zones visuelles
- ✅ **IA ennemie FSM** — Patrol → Alert → Combat → Fuite
- ✅ **4 Fins alternatives** selon vos choix de réputation
- ✅ **Dialogues avec choix moraux** impactant la réputation
- ✅ **Système de vagues** progressif (difficulté +)
- ✅ **Boss final** (Liam) en Acte 3

### Interface
- ✅ **HUD professionnel** — HP, énergie hack, score, kills, gaz actif
- ✅ **Minimap circulaire** — joueurs, ennemis, zones de gaz, viewport
- ✅ **Réputation temps réel** — 4 factions (Citoyens, Police, Mercenaires, Déta)
- ✅ **Dialogues cinématiques** avec portraits personnages
- ✅ **Notifications** non-intrusives
- ✅ **Écran résultat** avec stats complètes et rang mondial

### Technique
- ✅ **Logo dans la barre des tâches** (favicon SVG + PWA manifest)
- ✅ **PWA installable** — icône bureau, mode plein écran
- ✅ **Service Worker** — cache offline, 3 stratégies de cache
- ✅ **Contrôles tactiles** — joystick virtuel iOS/Android
- ✅ **Contrôles clavier/souris** — WASD + clic
- ✅ **Responsive** — PC, tablette, mobile
- ✅ **13 effets sonores** WAV générés algorithmiquement

### Backend (Render)
- ✅ **Leaderboard mondial** — top scores, classement, podium
- ✅ **Sessions joueur** — nom personnalisé, UUID unique
- ✅ **Sauvegarde cloud** — 10 slots par joueur
- ✅ **Stats live** — nombre de joueurs, top score, parties jouées
- ✅ **API REST** sécurisée (rate limiting, helmet, CORS)

---

## 🕹️ CONTRÔLES

| Action | Clavier/Souris | Mobile |
|---|---|---|
| Déplacer | `WASD` ou `Flèches` | Joystick gauche |
| Attaquer | `Clic gauche` | Bouton ATK |
| Capacité spéciale | `E` | Bouton SPE |
| Switch personnage | `Tab` | Bouton toolbar |
| Déployer gaz | Bouton toolbar | Bouton toolbar |
| Pause | `Échap` | Bouton toolbar |

---

## 🏗️ DÉVELOPPEMENT LOCAL

```bash
# Cloner le projet
git clone https://github.com/votre-compte/suppression-deta
cd suppression-deta

# Installer les dépendances
npm install

# Démarrer en développement
npm run dev   # ou: node server/index.js

# Ouvrir dans le navigateur
# http://localhost:3000
```

---

## 📊 API ENDPOINTS

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/health` | Statut du serveur |
| `POST` | `/api/session/new` | Créer une session joueur |
| `POST` | `/api/scores` | Enregistrer un score |
| `GET` | `/api/leaderboard` | Classement mondial |
| `GET` | `/api/stats` | Statistiques globales |
| `POST` | `/api/save` | Sauvegarder une partie |
| `GET` | `/api/save/:sessionId/:slot` | Charger une sauvegarde |

---

## 🎨 ASSETS GÉNÉRÉS

| Fichier | Description |
|---|---|
| `city-bg.jpg` | Décor ville futuriste 3200×600px |
| `alex.png` | Sprite Alex (mercenaire) |
| `lana.png` | Sprite Lana (hackeuse) |
| `liam.png` | Sprite Liam (adversaire masqué) |
| `enemy.png` | Sprite ennemi standard |
| `enemy2.png` | Sprite ennemi élite |
| `boss.png` | Sprite boss |
| `tileset.png` | Tileset monde (16 tuiles) |
| `gas_*.png` | Animations gaz (8 frames chacun) |
| `minimap_base.png` | Fond minimap avec 7 districts |
| `logo_large.svg` | Logo titre principal |
| `favicon.svg` | Logo barre des tâches / onglet |
| `gunshot.wav` | Son tir |
| `explosion.wav` | Explosion |
| `gas_hiss.wav` | Sifflement gaz |
| `laugh.wav` | Rires Gaz Rire |
| `hit.wav` | Impact |
| `click.wav` | UI clic |
| `powerup.wav` | Capacité spéciale |
| `heartbeat.wav` | HP critique |
| `hack.wav` | Piratage Neural Hack |
| `ambient.wav` | Ambiance ville |
| `jump.wav` | Saut |
| `gameover.wav` | Game over |
| `levelup.wav` | Nouveau niveau/acte |

---

## 🔧 PERSONNALISATION

### Modifier la difficulté
Dans `game.js` → objet `ACT_CONFIG` :
```javascript
ACT_CONFIG: {
  1: { enemies: 8,  waveCount: 3 },  // Augmenter pour plus de challenge
  2: { enemies: 14, waveCount: 4 },
  // ...
}
```

### Ajouter un dialogue
Dans `game.js` → objet `DIALOGUES` :
```javascript
DIALOGUES: {
  monDialogue: [
    { speaker: 'Alex', portrait: 'alex', text: "Mon texte...", choices: [
      { text: "Choix 1", repEffect: { citizens: +10 } },
      { text: "Choix 2", repEffect: { deta: +5 } },
    ]},
  ],
}
```

### Modifier les couleurs
Dans `css/style.css` → variables CSS `:root` :
```css
:root {
  --c-accent:  #e8304a;   /* Rouge principal */
  --c-primary: #0e4fd6;   /* Bleu primaire */
  --c-gold:    #c9943a;   /* Or */
  --c-cyan:    #00d4ff;   /* Cyan tech */
}
```

---

## 📱 PWA — LOGO DANS LA BARRE DES TÂCHES

Le jeu s'installe comme une application native :

1. **Chrome/Edge** → icône d'installation dans la barre d'adresse
2. **Safari iOS** → "Ajouter à l'écran d'accueil"
3. **Android** → "Installer l'application"

Le logo `SD` (rouge sur fond sombre) apparaît dans :
- L'onglet du navigateur
- La barre des tâches Windows/macOS/Linux
- L'écran d'accueil iOS/Android
- Le dock macOS

---

*© 2026 Suppression Déta Studios · Scénario Khedim Benyakhlef · Tous droits réservés*
