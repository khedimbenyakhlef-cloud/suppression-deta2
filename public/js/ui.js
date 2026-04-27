/* ═══════════════════════════════════════════════════════════════
   SUPPRESSION DÉTA — UI Manager v1.0
   HUD, Leaderboard, Minimap, Notifications, Transitions
═══════════════════════════════════════════════════════════════ */
"use strict";

// ── UI MANAGER ────────────────────────────────────────────────────────────────
const UI = {
  notifQueue: [],
  notifActive: false,
  _hbPlaying: false,
  _lbOffset: 0,

  // ── HUD ──────────────────────────────────────────────────────────────────
  updateHUD(game) {
    const player = game.players[game.activeIdx];
    if (!player) return;

    // HP
    const hpPct = clamp(player.hp / player.maxHp * 100, 0, 100);
    document.getElementById('hud-hp').textContent    = Math.ceil(player.hp);
    document.getElementById('hp-fill').style.width   = hpPct + '%';
    document.getElementById('hp-fill').style.background =
      hpPct > 60 ? 'var(--c-green)' : hpPct > 30 ? 'var(--c-gold)' : 'var(--c-accent)';

    // Heartbeat low HP
    if (hpPct < 25 && !this._hbPlaying) {
      this._hbPlaying = true;
      Assets.play('heartbeat', 0.35);
      setTimeout(() => this._hbPlaying = false, 1200);
    }

    // Énergie
    const enPct = clamp(player.energy / player.maxEnergy * 100, 0, 100);
    document.getElementById('hud-en').textContent    = Math.ceil(player.energy);
    document.getElementById('en-fill').style.width   = enPct + '%';

    // Score
    document.getElementById('hud-score-val').textContent = game.score.toLocaleString();
    document.getElementById('hud-act').textContent        = game.act;
    document.getElementById('hud-kills').textContent      = game.kills;

    // Gaz actif
    const inGas = game.gasZones.find(gz =>
      gz.alive && dist({ x: gz.x, y: gz.y }, { x: player.cx, y: player.cy }) < gz.radius
    );
    const gasEl = document.getElementById('hud-gas-type');
    if (inGas) {
      const names = { inferno: '🔥 INFERNO', rire: '😂 GAZ RIRE', inerte: '💤 INERTE', fume: '💨 FUMÉE' };
      gasEl.textContent = names[inGas.type] || inGas.type.toUpperCase();
      gasEl.style.color = inGas.type === 'inferno' ? 'var(--c-accent)' :
                          inGas.type === 'rire'    ? '#b0e040' :
                          inGas.type === 'inerte'  ? 'var(--c-cyan)' : 'var(--c-muted)';
    } else {
      gasEl.textContent = 'Aucun';
      gasEl.style.color = 'var(--c-muted)';
    }

    // Réputation
    const repColors = { 50: 'var(--c-text)', 70: 'var(--c-green)', 30: 'var(--c-accent)' };
    const repEl = {
      citizens: document.getElementById('rep-citizens'),
      law:      document.getElementById('rep-law'),
      merc:     document.getElementById('rep-merc'),
      deta:     document.getElementById('rep-deta'),
    };
    for (const [k, el] of Object.entries(repEl)) {
      if (!el) continue;
      const v = Math.round(game.rep[k] || 50);
      el.textContent = v;
      el.style.color = v >= 70 ? 'var(--c-green)' : v <= 30 ? 'var(--c-accent)' : 'var(--c-text)';
    }
  },

  // ── MINIMAP ──────────────────────────────────────────────────────────────
  updateMinimap(game) {
    const mc  = document.getElementById('minimap-canvas');
    if (!mc) return;
    const mctx = mc.getContext('2d');
    const W = mc.width, H = mc.height;
    const scaleX = W / CFG.WORLD_W;
    const scaleY = H / CFG.WORLD_H;

    mctx.clearRect(0, 0, W, H);

    // Background base
    const bgImg = Assets.img('minimap');
    if (bgImg) {
      mctx.save();
      mctx.beginPath();
      mctx.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2);
      mctx.clip();
      mctx.drawImage(bgImg, 0, 0, W, H);
      mctx.restore();
    } else {
      mctx.fillStyle = '#0c1220';
      mctx.beginPath();
      mctx.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2);
      mctx.fill();
    }

    // Circular clip
    mctx.save();
    mctx.beginPath();
    mctx.arc(W / 2, H / 2, W / 2 - 1, 0, Math.PI * 2);
    mctx.clip();

    // Camera viewport rect
    const cam = game.camera;
    const cvx = cam.x * scaleX, cvy = cam.y * scaleY;
    const cvw = cam.vw * scaleX, cvh = cam.vh * scaleY;
    mctx.strokeStyle = 'rgba(0,212,255,0.4)';
    mctx.lineWidth   = 1;
    mctx.strokeRect(cvx, cvy, cvw, cvh);

    // Enemies (red dots)
    for (const en of game.enemies) {
      if (!en.alive) continue;
      mctx.fillStyle = en.etype === 'boss' ? '#e8304a' : '#ff6040';
      mctx.beginPath();
      mctx.arc(en.cx * scaleX, en.cy * scaleY, en.etype === 'boss' ? 3.5 : 2, 0, Math.PI * 2);
      mctx.fill();
    }

    // Gas zones
    for (const gz of game.gasZones) {
      if (!gz.alive) continue;
      const cols = { inferno: 'rgba(232,80,30,0.4)', rire: 'rgba(175,225,35,0.35)', inerte: 'rgba(145,175,238,0.3)', fume: 'rgba(115,118,138,0.25)' };
      mctx.fillStyle = cols[gz.type] || 'rgba(200,200,200,0.2)';
      mctx.beginPath();
      mctx.arc(gz.x * scaleX, gz.y * scaleY, gz.radius * scaleX, 0, Math.PI * 2);
      mctx.fill();
    }

    // Players
    for (let i = 0; i < game.players.length; i++) {
      const p = game.players[i];
      const isActive = i === game.activeIdx;
      mctx.fillStyle = i === 0 ? '#e8304a' : '#00d4ff';
      mctx.beginPath();
      mctx.arc(p.cx * scaleX, p.cy * scaleY, isActive ? 4 : 2.5, 0, Math.PI * 2);
      mctx.fill();
      if (isActive) {
        mctx.strokeStyle = '#fff';
        mctx.lineWidth   = 1;
        mctx.stroke();
      }
    }

    mctx.restore();

    // Minimap border
    mctx.strokeStyle = 'rgba(0,212,255,0.5)';
    mctx.lineWidth   = 1.5;
    mctx.beginPath();
    mctx.arc(W / 2, H / 2, W / 2 - 1, 0, Math.PI * 2);
    mctx.stroke();
  },

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────
  notify(msg, type = 'info', duration = 3000) {
    this.notifQueue.push({ msg, type, duration });
    if (!this.notifActive) this._processNotif();
  },

  _processNotif() {
    if (this.notifQueue.length === 0) {
      this.notifActive = false;
      document.getElementById('notification').style.display = 'none';
      return;
    }
    this.notifActive = true;
    const { msg, type, duration } = this.notifQueue.shift();
    const container = document.getElementById('notification');
    const item = document.createElement('div');
    item.className = `notif-item ${type}`;
    item.textContent = msg;
    container.style.display = 'flex';
    container.appendChild(item);
    setTimeout(() => {
      item.style.opacity = '0';
      item.style.transition = 'opacity 0.3s';
      setTimeout(() => { item.remove(); this._processNotif(); }, 300);
    }, duration);
  },

  // ── MESSAGE HUD IN-GAME ───────────────────────────────────────────────────
  showMessage(text, duration = 2500) {
    const el = document.getElementById('hud-message');
    if (!el) return;
    el.textContent = text;
    el.style.display = 'block';
    el.style.opacity = '1';
    clearTimeout(this._msgTimer);
    this._msgTimer = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.5s';
      setTimeout(() => { el.style.display = 'none'; el.style.opacity = '1'; el.style.transition = ''; }, 500);
    }, duration);
  },

  // ── LEADERBOARD ───────────────────────────────────────────────────────────
  async loadLeaderboard(offset = 0) {
    const tbody = document.getElementById('lb-body');
    if (!tbody) return;

    if (offset === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--c-muted);padding:24px;">⏳ Chargement...</td></tr>';
      this._lbOffset = 0;
      document.getElementById('podium').innerHTML = '';
    }

    try {
      const resp = await fetch(`/api/leaderboard?limit=20&offset=${offset}`);
      const data = await resp.json();

      if (offset === 0) {
        // Podium top 3
        const podium = document.getElementById('podium');
        const medals = ['🥇', '🥈', '🥉'];
        const endingColors = { A: '#c9943a', B: '#00d4ff', C: '#e8304a', D: '#a060ff' };
        podium.innerHTML = data.scores.slice(0, 3).map((s, i) => `
          <div class="card text-center" style="border-color:${i===0?'var(--c-gold)':i===1?'var(--c-muted)':'#cd7f32'}">
            <div style="font-size:2rem;">${medals[i]}</div>
            <div style="font-size:1.1rem;font-weight:700;color:var(--c-white);margin:8px 0;">${escHTML(s.playerName)}</div>
            <div style="font-size:1.6rem;font-weight:800;color:var(--c-gold);font-family:monospace;">${s.score.toLocaleString()}</div>
            <div style="margin-top:6px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">
              <span class="badge badge-red">${s.kills} kills</span>
              <span class="badge" style="background:rgba(0,0,0,0.3);color:${endingColors[s.endingType]||'#fff'};border:1px solid ${endingColors[s.endingType]||'#555'}">Fin ${s.endingType}</span>
            </div>
          </div>
        `).join('');

        // Table header
        if (data.scores.length > 0) tbody.innerHTML = '';
      }

      // Lignes tableau
      const endingNames = { A: 'Rédemption', B: 'Gardiens', C: 'La Chute', D: '🔓 Secret' };
      data.scores.slice(offset === 0 ? 3 : 0).forEach((s, i) => {
        const rank  = s.rank;
        const row   = document.createElement('tr');
        row.className = rank <= 3 ? `rank-${rank}` : '';
        row.innerHTML = `
          <td><span class="rank-medal">${rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : rank}</span></td>
          <td style="font-weight:600;color:var(--c-white);">${escHTML(s.playerName)}</td>
          <td style="font-family:monospace;color:var(--c-gold);font-weight:700;">${s.score.toLocaleString()}</td>
          <td>${s.kills}</td>
          <td><span class="badge badge-${s.endingType==='A'?'gold':s.endingType==='B'?'cyan':'red'}">${endingNames[s.endingType]||s.endingType}</span></td>
          <td style="color:var(--c-muted);font-size:.8rem;">${new Date(s.date).toLocaleDateString('fr-FR')}</td>
        `;
        tbody.appendChild(row);
      });

      if (data.scores.length === 0 && offset === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--c-muted);padding:32px;">Aucun score enregistré — soyez le premier !</td></tr>';
      }

      this._lbOffset = offset + 20;
      const btnMore = document.getElementById('btn-load-more');
      if (btnMore) btnMore.style.display = data.total > this._lbOffset ? 'inline-flex' : 'none';

    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--c-accent);padding:24px;">❌ Impossible de charger les scores (mode hors-ligne)</td></tr>';
    }
  },

  // ── STATS LIVE (splash) ───────────────────────────────────────────────────
  async loadLiveStats() {
    try {
      const r = await fetch('/api/stats');
      const d = await r.json();
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set('stat-players', d.totalPlayers.toLocaleString());
      set('stat-top',     d.topScore.toLocaleString());
      set('stat-games',   d.totalGames.toLocaleString());
    } catch (e) { /* hors-ligne ok */ }
  },
};

// ── NAVIGATION ────────────────────────────────────────────────────────────────
window.showScreen = function (id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');

  document.getElementById('header').style.display = id !== 'screen-menu' ? 'flex' : 'none';

  if (id === 'screen-leaderboard') UI.loadLeaderboard(0);
  Assets.play('click', 0.2);
};

window.loadMoreScores = function () {
  UI.loadLeaderboard(UI._lbOffset);
};

// ── ENREGISTREMENT JOUEUR ────────────────────────────────────────────────────
window.registerPlayer = async function () {
  const input = document.getElementById('player-name-input');
  const name  = input?.value?.trim();
  if (!name || name.length < 2) { UI.notify('Entrez un nom (2+ caractères)', 'danger'); return; }

  const btn = document.getElementById('btn-register');
  btn.disabled = true; btn.textContent = '...';

  try {
    const resp = await fetch('/api/session/new', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: name }),
    });
    const data = await resp.json();
    window._sessionId = data.sessionId;

    document.getElementById('header-player-name').textContent = `👤 ${data.playerName}`;
    document.getElementById('btn-play').disabled = false;
    document.getElementById('player-form').style.display = 'none';

    UI.notify(`Bienvenue, ${data.playerName} ! Nova Déta vous attend.`, 'success');
    Assets.play('powerup', 0.5);
  } catch (e) {
    // Mode offline — continuer sans session
    window._sessionId = null;
    document.getElementById('btn-play').disabled = false;
    document.getElementById('player-form').style.display = 'none';
    UI.notify('Mode hors-ligne activé. Bonne chance !', 'info');
  }

  btn.disabled = false; btn.textContent = 'OK';
};

// ── SOUND TOGGLE ─────────────────────────────────────────────────────────────
window.toggleSound = function () {
  const enabled = SoundMgr.toggle();
  const btn = document.getElementById('btn-sound');
  if (btn) btn.textContent = enabled ? '🔊' : '🔇';
  UI.notify(enabled ? 'Son activé' : 'Son coupé', 'info', 1500);
};

// ── DESSIN DU MOTEUR (appelé depuis engine loop) ───────────────────────────
const _origDraw = Object.getPrototypeOf(Game)?.constructor?.prototype?._draw;
Game._draw = function () {
  const ctx = this.ctx;
  const cam = this.camera;
  if (!ctx || !cam) return;

  ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

  // Monde
  this.world.draw(ctx, cam);

  // Gas zones (derrière entités)
  for (const gz of this.gasZones) gz.draw(ctx, cam);

  // Bullets
  for (const b of this.bullets) b.draw(ctx, cam);

  // Enemies
  for (const en of this.enemies) en.draw(ctx, cam);

  // Players (inactif en premier, actif par-dessus)
  const inactive = 1 - this.activeIdx;
  this.players[inactive]?.draw(ctx, cam);
  this.players[this.activeIdx]?.draw(ctx, cam);

  // Particles
  this.particles.draw(ctx, cam);

  // Crosshair
  this._drawCrosshair(ctx);

  // Vignette
  this._drawVignette(ctx);

  // Scanlines légères sur le canvas
  ctx.save();
  ctx.globalAlpha = 0.025;
  ctx.fillStyle   = '#000';
  for (let y = 0; y < this.canvas.height; y += 4) ctx.fillRect(0, y, this.canvas.width, 2);
  ctx.restore();
};

Game._drawCrosshair = function (ctx) {
  const img = Assets.img ? null : null; // crosshair img optionnel
  const mx  = Input.mouse.x;
  const my  = Input.mouse.y;
  const S   = 14;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth   = 1.5;
  ctx.shadowColor = '#e8304a';
  ctx.shadowBlur  = 4;
  ctx.beginPath(); ctx.moveTo(mx - S, my); ctx.lineTo(mx - 5, my); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx + 5, my); ctx.lineTo(mx + S, my); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx, my - S); ctx.lineTo(mx, my - 5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx, my + 5); ctx.lineTo(mx, my + S); ctx.stroke();
  ctx.beginPath(); ctx.arc(mx, my, 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(232,48,74,0.8)'; ctx.fill();
  ctx.restore();
};

Game._drawVignette = function (ctx) {
  const W = this.canvas.width, H = this.canvas.height;
  const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
  grad.addColorStop(0,   'rgba(0,0,0,0)');
  grad.addColorStop(1,   'rgba(0,0,0,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
};

// ── LOADING SCREEN ────────────────────────────────────────────────────────────
function initLoading () {
  const msgs = ['Initialisation...', 'Chargement de Nova Déta...', 'Déploiement des mercenaires...', 'Calibration du Gaz Rire...', 'Prêt à jouer !'];
  let i = 0;
  const el = document.getElementById('load-text');
  const iv = setInterval(() => { if (el) el.textContent = msgs[Math.min(i++, msgs.length - 1)]; }, 350);

  setTimeout(() => {
    clearInterval(iv);
    const ls = document.getElementById('loading-screen');
    ls.classList.add('hidden');
    document.getElementById('header').style.display = 'none';
    setTimeout(() => ls.remove(), 600);
    UI.loadLiveStats();
    Assets.play('click', 0.3);
  }, 1900);
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
function escHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ── TOUCHES GLOBALES ──────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.code === 'Enter') {
    const nameInput = document.getElementById('player-name-input');
    if (document.activeElement === nameInput) registerPlayer();
  }
});

// ── DÉMARRAGE ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initLoading();

  // Player name input auto-focus
  setTimeout(() => {
    const inp = document.getElementById('player-name-input');
    if (inp) inp.focus();
  }, 2100);
});

window.UI = UI;

// ── ENREGISTREMENT DU SERVICE WORKER (PWA + logo taskbar) ──────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('[SW] Enregistré:', reg.scope);
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          nw?.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              UI.notify('Mise à jour disponible — rechargez la page', 'info', 5000);
            }
          });
        });
      })
      .catch(err => console.warn('[SW] Échec enregistrement:', err));
  });
}

// ── PROMPT INSTALLATION PWA ───────────────────────────────────────────────────
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  // Afficher bouton d'installation
  const installBtn = document.createElement('button');
  installBtn.className = 'btn btn-outline btn-sm';
  installBtn.textContent = '📲 Installer';
  installBtn.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:500;';
  installBtn.onclick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      UI.notify('🎮 Suppression Déta installé !', 'success');
      installBtn.remove();
    }
    deferredPrompt = null;
  };
  document.body.appendChild(installBtn);
});
