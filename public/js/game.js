/* ═══════════════════════════════════════════════════════════════
   SUPPRESSION DÉTA — Game Logic v1.0
   4 actes, fins multiples, système de réputation
═══════════════════════════════════════════════════════════════ */
"use strict";

// ── GAME STATE ────────────────────────────────────────────────────────────────
const Game = {
  canvas:    null,
  ctx:       null,
  running:   false,
  paused:    false,
  frameId:   null,
  lastTime:  0,
  dt:        0,

  // Monde
  world:     null,
  camera:    null,
  particles: null,

  // Entités
  players:   [],      // [alex, lana]
  activeIdx: 0,       // Personnage actif
  enemies:   [],
  bullets:   [],
  gasZones:  [],

  // Progression
  score:     0,
  kills:     0,
  act:       1,
  wave:      1,
  waveTimer: 0,
  waveDelay: 12,
  enemyBudget: 8,
  gasDeployed:[],

  // Réputation
  rep: { citizens:50, law:50, merc:50, deta:50 },

  // Session
  sessionId: null,
  playTime:  0,

  // Dialogues
  dialogueQueue: [],
  dialoguePlaying: false,

  // Acte config
  ACT_CONFIG: {
    1: { name:'Le Contrat',          enemies:8,  waveCount:3, gasEvent:false },
    2: { name:'Le Chaos du Gaz Rire',enemies:14, waveCount:4, gasEvent:true  },
    3: { name:"L'Adversaire Masqué", enemies:18, waveCount:4, gasEvent:false },
    4: { name:'Rédemption',          enemies:20, waveCount:5, gasEvent:false },
  },

  // ── Init ──────────────────────────────────────────────────────────────────
  async init() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');

    this._resize();
    window.addEventListener('resize', ()=>this._resize());

    // Charger assets
    await Assets.load([
      {key:'city-bg',  src:'/assets/images/city-bg.jpg',     type:'image'},
      {key:'alex',     src:'/assets/images/alex.png',        type:'image'},
      {key:'lana',     src:'/assets/images/lana.png',        type:'image'},
      {key:'liam',     src:'/assets/images/liam.png',        type:'image'},
      {key:'enemy',    src:'/assets/images/enemy.png',       type:'image'},
      {key:'enemy2',   src:'/assets/images/enemy2.png',      type:'image'},
      {key:'boss',     src:'/assets/images/boss.png',        type:'image'},
      {key:'tileset',  src:'/assets/images/tileset.png',     type:'image'},
      {key:'minimap',  src:'/assets/images/minimap_base.png',type:'image'},
      {key:'gunshot',  src:'/assets/sounds/gunshot.wav',     type:'sound'},
      {key:'explosion',src:'/assets/sounds/explosion.wav',   type:'sound'},
      {key:'gas_hiss', src:'/assets/sounds/gas_hiss.wav',    type:'sound'},
      {key:'laugh',    src:'/assets/sounds/laugh.wav',       type:'sound'},
      {key:'hit',      src:'/assets/sounds/hit.wav',         type:'sound'},
      {key:'click',    src:'/assets/sounds/click.wav',       type:'sound'},
      {key:'powerup',  src:'/assets/sounds/powerup.wav',     type:'sound'},
      {key:'heartbeat',src:'/assets/sounds/heartbeat.wav',   type:'sound'},
      {key:'hack',     src:'/assets/sounds/hack.wav',        type:'sound'},
      {key:'ambient',  src:'/assets/sounds/ambient.wav',     type:'sound'},
      {key:'gameover', src:'/assets/sounds/gameover.wav',    type:'sound'},
      {key:'levelup',  src:'/assets/sounds/levelup.wav',     type:'sound'},
    ]);

    Input.init(this.canvas);
    this._initGame();
  },

  _resize() {
    const c=this.canvas; const parent=c.parentElement;
    const w=parent.clientWidth; const h=parent.clientHeight;
    c.width=w; c.height=h;
    if (this.camera) { this.camera.vw=w; this.camera.vh=h; }
  },

  _initGame() {
    this.world     = new World();
    this.camera    = new Camera(this.canvas.width, this.canvas.height);
    this.particles = new ParticleSystem();

    // Spawn joueurs
    const groundY = (Math.ceil(CFG.WORLD_H/CFG.TILE)-4)*CFG.TILE - 60;
    this.players  = [new Player(320, groundY, 'alex'), new Player(380, groundY, 'lana')];
    this.activeIdx = 0;
    this.enemies   = [];
    this.bullets   = [];
    this.gasZones  = [];
    this.score     = 0;
    this.kills     = 0;
    this.act       = 1;
    this.wave      = 1;
    this.waveTimer = 0;
    this.playTime  = 0;
    this.rep       = {citizens:50,law:50,merc:50,deta:50};
    this.dialogueQueue = [];
    this.dialoguePlaying=false;

    this._spawnWave();
    this._playDialogue('intro');

    // Ambient sound loop
    Assets.play('ambient',0.15);
  },

  // ── BOUCLE PRINCIPALE ─────────────────────────────────────────────────────
  start() {
    this.running=true; this.paused=false;
    this._loop(performance.now());
  },

  stop() {
    this.running=false;
    if (this.frameId) cancelAnimationFrame(this.frameId);
  },

  _loop(ts) {
    if (!this.running) return;
    this.frameId=requestAnimationFrame(t=>this._loop(t));
    this.dt = Math.min((ts-this.lastTime)/1000, 0.05);
    this.lastTime=ts;
    if (!this.paused) this._update(this.dt);
    this._draw();
  },

  // ── UPDATE ────────────────────────────────────────────────────────────────
  _update(dt) {
    this.playTime += dt;
    const player = this.players[this.activeIdx];

    // Switch personnage
    if (Input.isDown('Tab') && !this._tabCooldown) {
      this._tabCooldown=true; setTimeout(()=>this._tabCooldown=false,400);
      switchCharacter();
    }

    // Pause
    if (Input.isDown('Escape') && !this._escCooldown) {
      this._escCooldown=true; setTimeout(()=>this._escCooldown=false,400);
      togglePause();
    }

    // Players
    for (const p of this.players) {
      p.update(dt, this.world, this.bullets, this.particles, this.gasZones, this.enemies);
    }

    // Camera follow active player
    this.camera.follow(player);

    // Bullets
    for (const b of this.bullets) b.update(dt, this.world);
    this.bullets = this.bullets.filter(b=>b.alive);

    // Bullet ↔ Enemy collisions
    for (const b of this.bullets) {
      if (b.owner!=='player') continue;
      for (const en of this.enemies) {
        if (!en.alive) continue;
        if (b.x>en.x&&b.x<en.x+en.w&&b.y>en.y&&b.y<en.y+en.h) {
          b.alive=false;
          const killed=en.takeDamage(b.dmg+rand(-5,5), this.particles, this.camera);
          if (killed) { this.kills++; this.score+=en.score; this._addRep('law',3); Assets.play('explosion',0.3); }
          break;
        }
      }
    }

    // Enemy bullets ↔ player
    for (const b of this.bullets) {
      if (b.owner!=='enemy') continue;
      if (b.x>player.x&&b.x<player.x+player.w&&b.y>player.y&&b.y<player.y+player.h) {
        b.alive=false;
        player.hurt(b.dmg, this.particles);
      }
    }

    // Enemies update
    for (const en of this.enemies) {
      en.update(dt, player, this.bullets, this.particles, this.world);
    }
    this.enemies=this.enemies.filter(e=>e.alive);

    // Gas zones
    for (const gz of this.gasZones) gz.update(dt);
    this.gasZones=this.gasZones.filter(gz=>gz.alive);

    // Particles
    this.particles.update(dt);

    // Wave progression
    this.waveTimer+=dt;
    if (this.enemies.length===0 && this.waveTimer>3) {
      this._nextWave();
    }

    // Gas event Acte 2
    if (this.act===2 && this.ACT_CONFIG[2].gasEvent && this.gasZones.length===0 && this.waveTimer>8) {
      this._triggerGasEvent();
    }

    // Player mort
    if (player.hp<=0) {
      this._gameOver();
      return;
    }

    // HUD Update
    Input.consume();
    UI.updateHUD(this);
    UI.updateMinimap(this);
  },

  // ── WAVES ─────────────────────────────────────────────────────────────────
  _spawnWave() {
    const cfg = this.ACT_CONFIG[this.act];
    const count = cfg.enemies + (this.wave-1)*2;
    const groundY = (Math.ceil(CFG.WORLD_H/CFG.TILE)-4)*CFG.TILE - 56;

    for (let i=0;i<count;i++) {
      const side = randi(0,1);
      const ex   = side===0 ? randi(800,1600) : randi(1600,2800);
      const type = this.act>=3 && i===count-1 ? 'elite' : (randi(0,4)===0&&this.act>=2?'elite':'grunt');
      this.enemies.push(new Enemy(ex, groundY, type));
    }

    // Boss en Acte 3 dernière vague
    if (this.act===3 && this.wave===4) {
      this.enemies.push(new Enemy(1600, groundY-50, 'boss'));
      UI.showMessage('⚠ LIAM RÉVÉLÉ — BOSS FINAL ⚠', 3000);
    }

    UI.showMessage(`Vague ${this.wave} — ${count} ennemis`, 2000);
  },

  _nextWave() {
    const cfg=this.ACT_CONFIG[this.act];
    if (this.wave>=cfg.waveCount) {
      this._nextAct();
    } else {
      this.wave++;
      this.waveTimer=0;
      this.score+=this.wave*100;
      Assets.play('levelup',0.5);
      UI.showMessage(`⭐ VAGUE ${this.wave} !`, 2000);
      setTimeout(()=>this._spawnWave(), 2000);
    }
  },

  _nextAct() {
    if (this.act>=4) { this._victory(); return; }
    this.act++;
    this.wave=1;
    this.waveTimer=0;
    this.score+=this.act*500;
    Assets.play('levelup',0.7);
    UI.showMessage(`🎬 ACTE ${this.act} : ${this.ACT_CONFIG[this.act].name}`, 4000);
    this._playDialogue(`act${this.act}`);
    setTimeout(()=>this._spawnWave(), 4000);
  },

  // ── GAS EVENTS ───────────────────────────────────────────────────────────
  _triggerGasEvent() {
    Assets.play('gas_hiss',0.6);
    Assets.play('laugh',0.4);
    // Gaz Rire sur 5 zones
    for (let i=0;i<5;i++) {
      setTimeout(()=>{
        const gx=rand(400, CFG.WORLD_W-400);
        const gy=rand(200, CFG.WORLD_H-200);
        this.gasZones.push(new GasZone(gx,gy,'rire',150));
        // Ennemis touchés rient
        for (const en of this.enemies) {
          if (dist({x:gx,y:gy},en)<150) en.laugh();
        }
        this.score+=CFG.SCORE_GAS;
        this._addRep('citizens',5);
      }, i*1500);
    }
    UI.showMessage('💨 GAZ RIRE — Nova Déta dans le chaos !', 5000);
    this.ACT_CONFIG[2].gasEvent=false;
  },

  deployGas(type) {
    const player=this.players[this.activeIdx];
    this.gasZones.push(new GasZone(player.cx+100, player.cy, type));
    Assets.play('gas_hiss',0.5);
    // Effets
    for (const en of this.enemies) {
      if (dist(player,en)<200) {
        if(type==='rire')  en.laugh();
        if(type==='inerte')en.sleep();
      }
    }
    this.score+=CFG.SCORE_GAS;
    this._addRep('citizens', type==='rire'?8:3);
  },

  // ── RÉPUTATION ───────────────────────────────────────────────────────────
  _addRep(faction, delta) {
    this.rep[faction] = clamp((this.rep[faction]||50)+delta,0,100);
  },

  // ── FIN DE JEU ───────────────────────────────────────────────────────────
  _gameOver() {
    this.stop();
    Assets.play('gameover',0.6);
    showResult(false);
  },

  _victory() {
    this.stop();
    Assets.play('levelup',0.8);
    showResult(true);
  },

  // ── DIALOGUE ──────────────────────────────────────────────────────────────
  DIALOGUES: {
    intro:[
      {speaker:'Alex',   portrait:'alex',  text:"La mission commence. Nova Déta compte sur nous — ou du moins, c'est ce qu'ils croient.", choices:[]},
      {speaker:'Lana',   portrait:'lana',  text:"J'ai hacké les serveurs de Déta. Ces gens sont dangereux. Restons prudents.",          choices:[]},
    ],
    act2:[
      {speaker:'Dr. Frost',portrait:'liam',text:"J'ai remplacé le Gaz Inferno par le Gaz Rire. Pardonnez-moi... ou pas.",              choices:[
        {text:"Bien joué, Frost.",   repEffect:{citizens:+10}},
        {text:"Vous êtes fou !",     repEffect:{merc:+5}},
      ]},
    ],
    act3:[
      {speaker:'LIAM',   portrait:'liam',  text:"Alex... Tu me reconnais ? Tu m'as trahi. Maintenant c'est à mon tour.",               choices:[
        {text:"Je peux expliquer.", repEffect:{citizens:+8}},
        {text:"Alors bats-toi.",    repEffect:{deta:-10}},
      ]},
    ],
    act4:[
      {speaker:'Lana',   portrait:'lana',  text:"C'est le moment de choisir : on détruit tout, ou on rebâtit Nova Déta.",             choices:[
        {text:"On rebâtit.",        repEffect:{citizens:+20, law:+10}},
        {text:"Chacun pour soi.",   repEffect:{merc:+15}},
      ]},
    ],
  },

  _playDialogue(key) {
    const dlg=this.DIALOGUES[key]; if(!dlg||dlg.length===0) return;
    this.dialogueQueue=[...dlg];
    this._showNextDialogue();
  },

  _showNextDialogue() {
    if (this.dialogueQueue.length===0) { document.getElementById('modal-dialogue').classList.remove('open'); this.dialoguePlaying=false; return; }
    this.dialoguePlaying=true;
    const d=this.dialogueQueue.shift();
    document.getElementById('dialogue-speaker').textContent=d.speaker;
    document.getElementById('dialogue-text').textContent=d.text;
    document.getElementById('dialogue-portrait').src=`/assets/images/${d.portrait||'alex'}.png`;
    const choicesEl=document.getElementById('dialogue-choices');
    choicesEl.innerHTML='';
    if (d.choices&&d.choices.length>0) {
      d.choices.forEach(ch=>{
        const btn=document.createElement('button');
        btn.className='btn btn-outline'; btn.style.textAlign='left';
        btn.textContent=ch.text;
        btn.onclick=()=>{
          if(ch.repEffect) Object.entries(ch.repEffect).forEach(([k,v])=>this._addRep(k,v));
          Assets.play('click',0.3);
          document.getElementById('modal-dialogue').classList.remove('open');
          setTimeout(()=>this._showNextDialogue(),300);
        };
        choicesEl.appendChild(btn);
      });
    } else {
      const btn=document.createElement('button');
      btn.className='btn btn-outline'; btn.textContent='Continuer';
      btn.onclick=()=>{ Assets.play('click',0.3); document.getElementById('modal-dialogue').classList.remove('open'); setTimeout(()=>this._showNextDialogue(),300); };
      choicesEl.appendChild(btn);
    }
    document.getElementById('modal-dialogue').classList.add('open');
  },

  // ── ENDING ──────────────────────────────────────────────────────────────
  getEnding() {
    const r=this.rep;
    if (r.citizens>=70&&r.law>=60&&r.deta<=30) return {id:'A',title:'Rédemption Totale',    color:'badge-gold', desc:'Alex et Lana reconstruisent Nova Déta. Liam est pardonné. La ville renaît de ses cendres.'};
    if (r.citizens>=60&&r.law>=50)              return {id:'B',title:'Gardiens de l\'Ombre', color:'badge-cyan', desc:'Vous devenez les justiciers secrets de Nova Déta, protégeant la ville dans l\'ombre.'};
    if (r.deta>=70)                             return {id:'C',title:'La Chute',             color:'badge-red',  desc:'Déta prend le contrôle. Nova Déta sombre dans l\'obscurité. La lutte continue...'};
    return                                           {id:'B',title:'Gardiens de l\'Ombre',   color:'badge-cyan', desc:'Votre chemin reste incertain, mais Nova Déta survit grâce à vous.'};
  },
};

// ── FONCTIONS GLOBALES ────────────────────────────────────────────────────────
window.Game=Game;

window.startGame = async function() {
  showScreen('screen-game');
  await Game.init();
  Game.start();
};

window.togglePause = function() {
  Game.paused=!Game.paused;
  document.getElementById('modal-pause').classList.toggle('open', Game.paused);
  Assets.play('click',0.3);
};

window.switchCharacter = function() {
  Game.activeIdx = 1-Game.activeIdx;
  const name = ['Alex','Lana'][Game.activeIdx];
  UI.showMessage(`🔄 ${name} actif`, 1500);
  Assets.play('click',0.4);
  document.getElementById('char-name').textContent=name;
};

window.deployGas = function(type) {
  if (!Game.running) return;
  Game.deployGas(type);
};

window.endGame = function() {
  Game.stop();
  Assets.play('click',0.3);
  document.getElementById('modal-pause').classList.remove('open');
  showScreen('screen-menu');
};

async function showResult(victory) {
  const ending=Game.getEnding();

  document.getElementById('result-ending-badge').className   = `badge ${ending.color}`;
  document.getElementById('result-ending-badge').textContent  = `FIN ${ending.id}`;
  document.getElementById('result-ending-title').textContent  = ending.title;
  document.getElementById('result-ending-desc').textContent   = ending.desc;
  document.getElementById('result-score-val').textContent     = Game.score.toLocaleString();

  document.getElementById('result-stats').innerHTML=`
    <div class="stat-card"><div class="stat-value">${Game.kills}</div><div class="stat-label">Ennemis neutralisés</div></div>
    <div class="stat-card"><div class="stat-value">${Game.act}</div><div class="stat-label">Actes complétés</div></div>
    <div class="stat-card"><div class="stat-value">${Game.gasZones.length+Game.gasDeployed.length}</div><div class="stat-label">Gaz déployés</div></div>
    <div class="stat-card"><div class="stat-value">${Math.floor(Game.playTime/60)}m${Math.floor(Game.playTime%60)}s</div><div class="stat-label">Temps de jeu</div></div>
    <div class="stat-card"><div class="stat-value">${Game.rep.citizens}</div><div class="stat-label">Rép. Citoyens</div></div>
    <div class="stat-card"><div class="stat-value">${Game.rep.law}</div><div class="stat-label">Rép. Police</div></div>
  `;

  // Envoyer score au serveur
  if (window._sessionId) {
    try {
      const resp = await fetch('/api/scores', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          sessionId:  window._sessionId,
          score:      Game.score,
          level:      Game.act,
          kills:      Game.kills,
          gasUsed:    'rire',
          endingType: ending.id,
          playTime:   Game.playTime,
        })
      });
      const data=await resp.json();
      if (data.rank) document.getElementById('result-rank-val').textContent=`🏆 Rang #${data.rank} mondial`;
    } catch(e) { console.log('Score offline'); }
  }

  showScreen('screen-result');
}
