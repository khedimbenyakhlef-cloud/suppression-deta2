require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const compression= require('compression');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const { v4: uuidv4 } = require('uuid');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Sécurité ──────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({ windowMs: 60000, max: 120, message: { error: 'Trop de requêtes' } });
app.use('/api/', limiter);

// ── Base de données en mémoire (JSON persisté) ────────────────────────────────
const DB = {
  scores:    [],
  saves:     {},
  sessions:  {},
  players:   {}
};

// Charger données depuis fichier si disponible
const fs   = require('fs');
const DB_FILE = path.join(__dirname, 'data.json');

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      Object.assign(DB, JSON.parse(raw));
      console.log('[DB] Données chargées');
    }
  } catch(e) { console.log('[DB] Nouvelle base de données'); }
}

function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(DB, null, 2));
  } catch(e) { /* Render ephemeral FS — OK */ }
}

loadDB();
setInterval(saveDB, 30000);

// ── Fichiers statiques ────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
    if (filePath.endsWith('.gz'))   res.setHeader('Content-Encoding', 'gzip');
    if (filePath.endsWith('.br'))   res.setHeader('Content-Encoding', 'br');
  }
}));

// ── API Health ────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    game:   'Suppression Déta',
    version:'1.0.0',
    players: Object.keys(DB.players).length,
    scores:  DB.scores.length,
    uptime:  Math.floor(process.uptime())
  });
});

// ── API Sessions joueur ───────────────────────────────────────────────────────
app.post('/api/session/new', (req, res) => {
  const { playerName } = req.body;
  if (!playerName || playerName.length > 32) return res.status(400).json({ error: 'Nom invalide' });

  const sessionId = uuidv4();
  const playerId  = uuidv4();
  const sanitized = playerName.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 20) || 'Joueur';

  DB.sessions[sessionId] = { playerId, playerName: sanitized, createdAt: Date.now() };
  if (!DB.players[playerId]) {
    DB.players[playerId] = {
      id: playerId, name: sanitized,
      gamesPlayed: 0, bestScore: 0, totalKills: 0,
      createdAt: Date.now()
    };
  }

  res.json({ sessionId, playerId, playerName: sanitized });
});

// ── API Scores / Leaderboard ──────────────────────────────────────────────────
app.post('/api/scores', (req, res) => {
  const { sessionId, score, level, kills, gasUsed, endingType, playTime } = req.body;
  if (!sessionId || !DB.sessions[sessionId]) return res.status(401).json({ error: 'Session invalide' });
  if (typeof score !== 'number' || score < 0 || score > 9999999) return res.status(400).json({ error: 'Score invalide' });

  const session = DB.sessions[sessionId];
  const entry = {
    id:         uuidv4(),
    playerId:   session.playerId,
    playerName: session.playerName,
    score:      Math.floor(score),
    level:      level || 1,
    kills:      kills || 0,
    gasUsed:    gasUsed || 'none',
    endingType: endingType || 'unknown',
    playTime:   Math.floor(playTime || 0),
    date:       new Date().toISOString()
  };

  DB.scores.push(entry);
  DB.scores.sort((a, b) => b.score - a.score);
  if (DB.scores.length > 1000) DB.scores.splice(1000);

  const player = DB.players[session.playerId];
  if (player) {
    player.gamesPlayed++;
    player.bestScore   = Math.max(player.bestScore, entry.score);
    player.totalKills += entry.kills;
  }

  const rank = DB.scores.findIndex(s => s.id === entry.id) + 1;
  res.json({ success: true, rank, entry });
});

app.get('/api/leaderboard', (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;
  const top    = DB.scores.slice(offset, offset + limit).map((s, i) => ({
    rank:       offset + i + 1,
    playerName: s.playerName,
    score:      s.score,
    level:      s.level,
    kills:      s.kills,
    endingType: s.endingType,
    date:       s.date
  }));
  res.json({ total: DB.scores.length, scores: top });
});

// ── API Sauvegarde Cloud ──────────────────────────────────────────────────────
app.post('/api/save', (req, res) => {
  const { sessionId, slot, saveData } = req.body;
  if (!sessionId || !DB.sessions[sessionId]) return res.status(401).json({ error: 'Session invalide' });
  if (!saveData || JSON.stringify(saveData).length > 50000) return res.status(400).json({ error: 'Données invalides' });

  const { playerId } = DB.sessions[sessionId];
  const key = `${playerId}_slot${slot || 0}`;
  DB.saves[key] = { ...saveData, savedAt: Date.now() };
  res.json({ success: true, key });
});

app.get('/api/save/:sessionId/:slot', (req, res) => {
  const { sessionId, slot } = req.params;
  if (!DB.sessions[sessionId]) return res.status(401).json({ error: 'Session invalide' });
  const { playerId } = DB.sessions[sessionId];
  const key  = `${playerId}_slot${slot}`;
  const data = DB.saves[key];
  if (!data) return res.status(404).json({ error: 'Sauvegarde introuvable' });
  res.json(data);
});

// ── API Stats ─────────────────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const totalScores = DB.scores.length;
  const avgScore    = totalScores ? Math.floor(DB.scores.reduce((a,b) => a+b.score,0)/totalScores) : 0;
  const endings     = {};
  DB.scores.forEach(s => { endings[s.endingType] = (endings[s.endingType]||0)+1; });
  res.json({
    totalPlayers: Object.keys(DB.players).length,
    totalGames:   totalScores,
    avgScore,
    topScore:     DB.scores[0]?.score || 0,
    endingStats:  endings
  });
});

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Démarrage ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎮 SUPPRESSION DÉTA — Serveur démarré`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Environnement : ${process.env.NODE_ENV || 'development'}\n`);
});

process.on('SIGTERM', () => { saveDB(); process.exit(0); });
