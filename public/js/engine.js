/* ═══════════════════════════════════════════════════════════════
   SUPPRESSION DÉTA — Game Engine v1.0
   Canvas 2D — 60fps — Multi-plateforme
═══════════════════════════════════════════════════════════════ */
"use strict";

// ── CONFIG ────────────────────────────────────────────────────────────────────
const CFG = {
  TILE:      32,
  CAM_LAG:   0.12,
  WORLD_W:   3200,
  WORLD_H:   600,
  ENEMY_MAX: 25,
  GAS_TICK:  60,
  SCORE_KILL: 150,
  SCORE_HACK: 300,
  SCORE_GAS:  200,
  TARGET_FPS: 60,
};

// ── MATH ──────────────────────────────────────────────────────────────────────
const lerp  = (a,b,t)=> a+(b-a)*t;
const clamp = (v,mn,mx)=> Math.max(mn, Math.min(mx,v));
const dist  = (a,b)=> Math.hypot(b.x-a.x, b.y-a.y);
const rand  = (mn,mx)=> mn + Math.random()*(mx-mn);
const randi = (mn,mx)=> Math.floor(rand(mn,mx+1));
const norm  = (v)=> { const m=Math.hypot(v.x,v.y); return m?{x:v.x/m,y:v.y/m}:{x:0,y:0}; };
const v2    = (x=0,y=0)=> ({x,y});

// ── INPUT ─────────────────────────────────────────────────────────────────────
const Input = {
  keys:    {},
  mouse:   { x:0, y:0, down:false, clicked:false },
  touch:   { active:false, dx:0, dy:0 },
  joy:     { x:0, y:0 },
  actions: { attack:false, special:false },

  init(canvas) {
    document.addEventListener('keydown', e=>{ this.keys[e.code]=true; e.preventDefault&&['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&e.preventDefault(); });
    document.addEventListener('keyup',  e=>{ this.keys[e.code]=false; });
    canvas.addEventListener('mousemove', e=>{ const r=canvas.getBoundingClientRect(); this.mouse.x=(e.clientX-r.left)*(canvas.width/r.width); this.mouse.y=(e.clientY-r.top)*(canvas.height/r.height); });
    canvas.addEventListener('mousedown', e=>{ this.mouse.down=true; this.mouse.clicked=true; });
    canvas.addEventListener('mouseup',   e=>{ this.mouse.down=false; });
    this._initJoystick();
    this._initActionBtns();
  },

  _initJoystick() {
    const zone  = document.getElementById('joystick-zone');
    const thumb = document.getElementById('joystick-thumb');
    if (!zone) return;
    let origin = null;
    const R = 52;
    zone.addEventListener('touchstart', e=>{ e.preventDefault(); const t=e.touches[0]; origin={x:t.clientX,y:t.clientY}; this.touch.active=true; },{passive:false});
    zone.addEventListener('touchmove',  e=>{ e.preventDefault(); if(!origin)return; const t=e.touches[0]; let dx=t.clientX-origin.x,dy=t.clientY-origin.y; const m=Math.hypot(dx,dy); if(m>R){dx=dx/m*R;dy=dy/m*R;} this.joy.x=dx/R; this.joy.y=dy/R; thumb.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`; },{passive:false});
    zone.addEventListener('touchend',   e=>{ e.preventDefault(); this.joy.x=0; this.joy.y=0; this.touch.active=false; origin=null; thumb.style.transform='translate(-50%,-50%)'; },{passive:false});
  },

  _initActionBtns() {
    const atk = document.getElementById('btn-attack');
    const spe = document.getElementById('btn-special');
    if (atk) { atk.addEventListener('touchstart',e=>{e.preventDefault();this.actions.attack=true;},{passive:false}); atk.addEventListener('touchend',e=>{e.preventDefault();this.actions.attack=false;},{passive:false}); }
    if (spe) { spe.addEventListener('touchstart',e=>{e.preventDefault();this.actions.special=true;},{passive:false}); spe.addEventListener('touchend',e=>{e.preventDefault();this.actions.special=false;},{passive:false}); }
  },

  isDown(code)  { return !!this.keys[code]; },
  getMoveDir()  {
    let x = (this.isDown('KeyD')||this.isDown('ArrowRight')?1:0) - (this.isDown('KeyA')||this.isDown('ArrowLeft')?1:0);
    let y = (this.isDown('KeyS')||this.isDown('ArrowDown')?1:0) - (this.isDown('KeyW')||this.isDown('ArrowUp')?1:0);
    x += this.joy.x; y += this.joy.y;
    const m = Math.hypot(x,y); if(m>1){x/=m;y/=m;}
    return {x,y};
  },
  isAttack()  { return this.mouse.clicked || this.actions.attack; },
  isSpecial() { return this.isDown('KeyE') || this.actions.special; },
  consume()   { this.mouse.clicked=false; this.actions.attack=false; this.actions.special=false; },
};

// ── ASSET LOADER ──────────────────────────────────────────────────────────────
const Assets = {
  images: {},
  sounds: {},
  loaded: 0,
  total:  0,

  async load(manifest) {
    this.total = manifest.length;
    const proms = manifest.map(({key,src,type})=>{
      if (type==='image') return this._loadImg(key,src);
      if (type==='sound') return this._loadSnd(key,src);
      return Promise.resolve();
    });
    await Promise.allSettled(proms);
  },

  _loadImg(key,src) {
    return new Promise(res=>{ const im=new Image(); im.onload=()=>{this.images[key]=im;this.loaded++;res();}; im.onerror=()=>{this.loaded++;res();}; im.src=src; });
  },

  _loadSnd(key,src) {
    this.sounds[key]=null;
    return new Promise(res=>{ const a=new Audio(); a.oncanplaythrough=()=>{this.sounds[key]=a;this.loaded++;res();}; a.onerror=()=>{this.loaded++;res();}; a.src=src; a.load(); });
  },

  img(key) { return this.images[key]||null; },

  play(key, vol=0.5) {
    if (!SoundMgr.enabled) return;
    const a=this.sounds[key]; if(!a) return;
    try { const c=a.cloneNode(); c.volume=vol; c.play().catch(()=>{}); } catch(e){}
  },
};

// ── SOUND MANAGER ─────────────────────────────────────────────────────────────
const SoundMgr = { enabled: true, toggle() { this.enabled=!this.enabled; return this.enabled; } };

// ── CAMERA ────────────────────────────────────────────────────────────────────
class Camera {
  constructor(vw,vh) { this.x=0; this.y=0; this.vw=vw; this.vh=vh; this.shake=0; }
  follow(target) {
    const tx = target.x - this.vw/2;
    const ty = target.y - this.vh/2;
    this.x = lerp(this.x, clamp(tx,0,CFG.WORLD_W-this.vw), CFG.CAM_LAG);
    this.y = lerp(this.y, clamp(ty,0,CFG.WORLD_H-this.vh), CFG.CAM_LAG);
    if (this.shake>0) { this.x+=rand(-this.shake,this.shake); this.y+=rand(-this.shake,this.shake); this.shake*=0.85; }
  }
  doShake(amt) { this.shake=Math.max(this.shake,amt); }
  worldToScreen(wx,wy) { return {x:wx-this.x, y:wy-this.y}; }
  screenToWorld(sx,sy) { return {x:sx+this.x, y:sy+this.y}; }
  inView(x,y,w,h)      { return x+w>this.x && x<this.x+this.vw && y+h>this.y && y<this.y+this.vh; }
}

// ── PARTICLE SYSTEM ───────────────────────────────────────────────────────────
class ParticleSystem {
  constructor() { this.pool=[]; }

  emit(x,y,opts={}) {
    const n = opts.count||8;
    for (let i=0;i<n;i++) {
      const angle = rand(0, Math.PI*2);
      const spd   = rand(opts.minSpd||1, opts.maxSpd||5);
      this.pool.push({
        x, y,
        vx: Math.cos(angle)*spd,
        vy: Math.sin(angle)*spd,
        life: rand(0.6, opts.maxLife||1.2),
        maxLife: opts.maxLife||1.2,
        r: opts.r||4,
        color: opts.color||'#fff',
        gravity: opts.gravity||0.1,
        alive: true,
      });
    }
  }

  update(dt) {
    this.pool = this.pool.filter(p=>p.alive);
    for (const p of this.pool) {
      p.life -= dt;
      if (p.life<=0) { p.alive=false; continue; }
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.97;
    }
  }

  draw(ctx, cam) {
    for (const p of this.pool) {
      const s = cam.worldToScreen(p.x, p.y);
      const alpha = clamp(p.life/p.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, p.r*alpha, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// ── GAS ZONE ──────────────────────────────────────────────────────────────────
class GasZone {
  constructor(x,y,type,radius=120) {
    this.x=x; this.y=y; this.type=type; this.radius=radius;
    this.alpha=0; this.alive=true; this.timer=0;
    this.maxTime = type==='rire'?20:type==='inferno'?15:25;
    this.COLORS  = { inferno:'rgba(232,80,30,', rire:'rgba(175,225,35,', inerte:'rgba(145,175,238,', fume:'rgba(115,118,138,' };
    this.spreads = (type==='rire');
  }
  update(dt) {
    this.timer += dt;
    this.alpha   = Math.min(1, this.timer*2) * Math.max(0, 1-(this.timer-this.maxTime+2)*0.5);
    if (this.spreads && this.timer < this.maxTime*0.6) this.radius = Math.min(300, this.radius+20*dt);
    if (this.timer >= this.maxTime) this.alive=false;
  }
  draw(ctx,cam) {
    if (!cam.inView(this.x-this.radius,this.y-this.radius,this.radius*2,this.radius*2)) return;
    const s = cam.worldToScreen(this.x,this.y);
    const col = this.COLORS[this.type]||'rgba(200,200,200,';
    const grad = ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,this.radius);
    grad.addColorStop(0,   col+(this.alpha*0.45)+')');
    grad.addColorStop(0.6, col+(this.alpha*0.28)+')');
    grad.addColorStop(1,   col+'0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(s.x,s.y,this.radius,0,Math.PI*2); ctx.fill();
    // Label
    ctx.save(); ctx.globalAlpha=this.alpha*0.9;
    ctx.fillStyle='#fff'; ctx.font='bold 13px monospace'; ctx.textAlign='center';
    ctx.fillText(`⚗ ${this.type.toUpperCase()}`, s.x, s.y-this.radius*0.4);
    ctx.restore();
  }
  affects(entity) { return dist({x:this.x,y:this.y},{x:entity.x,y:entity.y}) < this.radius; }
}

// ── ENTITY BASE ───────────────────────────────────────────────────────────────
class Entity {
  constructor(x,y,w,h) { this.x=x; this.y=y; this.w=w; this.h=h; this.alive=true; }
  get cx() { return this.x+this.w/2; }
  get cy() { return this.y+this.h/2; }
  collides(other) {
    return this.x<other.x+other.w && this.x+this.w>other.x && this.y<other.y+other.h && this.y+this.h>other.y;
  }
}

// ── BULLET ───────────────────────────────────────────────────────────────────
class Bullet extends Entity {
  constructor(x,y,vx,vy,dmg,owner,color='#e8304a') {
    super(x-3,y-3,6,6);
    this.vx=vx; this.vy=vy; this.dmg=dmg; this.owner=owner; this.color=color;
    this.life=2;
  }
  update(dt,world) {
    this.x+=this.vx; this.y+=this.vy;
    this.life-=dt;
    if (this.life<=0 || this.x<0||this.x>CFG.WORLD_W||this.y<0||this.y>CFG.WORLD_H) this.alive=false;
    // Wall collision
    if (world.isSolid(this.cx,this.cy)) this.alive=false;
  }
  draw(ctx,cam) {
    const s=cam.worldToScreen(this.x,this.y);
    ctx.save();
    ctx.fillStyle=this.color;
    ctx.shadowColor=this.color; ctx.shadowBlur=6;
    ctx.fillRect(s.x,s.y,6,6);
    ctx.restore();
  }
}

// ── PLAYER ───────────────────────────────────────────────────────────────────
class Player extends Entity {
  constructor(x,y,type='alex') {
    super(x,y,28,56);
    this.type      = type;
    this.spd       = type==='alex'?3.2:2.6;
    this.maxHp     = type==='alex'?100:85;
    this.hp        = this.maxHp;
    this.maxEnergy = 100;
    this.energy    = this.maxEnergy;
    this.dmg       = type==='alex'?35:20;
    this.hackRange = type==='lana'?220:0;
    this.facing    = 1;
    this.attackCD  = 0;
    this.specialCD = 0;
    this.invuln    = 0;
    this.laughTimer= 0;
    this.comboCount= 0;
    this.lastComboTime=0;
    this.shotCD    = 0;
    this.SHOT_INTERVAL = type==='lana'?20:12;
    this.GAS_IMMUNE= false;
    this.spriteKey = type;
  }

  update(dt, world, bullets, particles, gasZones, enemies) {
    if (this.laughTimer>0) { this.laughTimer-=dt; return; }
    if (this.invuln>0) this.invuln-=dt;
    if (this.attackCD>0) this.attackCD-=dt;
    if (this.specialCD>0) this.specialCD-=dt;
    if (this.shotCD>0) this.shotCD--;

    // Regenerate energy
    this.energy = Math.min(this.maxEnergy, this.energy+8*dt);

    const dir = Input.getMoveDir();
    if (Math.abs(dir.x)>0.05) this.facing = dir.x>0?1:-1;

    // Movement + collision
    const nx = this.x + dir.x*this.spd;
    const ny = this.y + dir.y*this.spd;
    if (!world.isSolid(nx+8, this.cy) && !world.isSolid(nx+this.w-8, this.cy)) this.x=clamp(nx,0,CFG.WORLD_W-this.w);
    if (!world.isSolid(this.cx, ny+8) && !world.isSolid(this.cx, ny+this.h-8)) this.y=clamp(ny,0,CFG.WORLD_H-this.h);

    // Attack
    if (Input.isAttack() && this.shotCD<=0) {
      this.shotCD = this.SHOT_INTERVAL;
      this._shoot(bullets);
      Assets.play('gunshot', 0.3);
    }

    // Special
    if (Input.isSpecial() && this.specialCD<=0 && this.energy>=25) {
      this._special(world, bullets, particles, gasZones, enemies);
    }

    // Gas effects
    if (!this.GAS_IMMUNE) {
      for (const gz of gasZones) {
        if (gz.alive && gz.affects(this)) {
          if (gz.type==='inferno' && this.invuln<=0) { this.hurt(2, particles); }
          if (gz.type==='rire')   { this.laughTimer=4; }
          if (gz.type==='inerte') { this.laughTimer=2; }
        }
      }
    }
  }

  _shoot(bullets) {
    const spd   = 12;
    const mx    = Input.mouse.x;
    const dir   = mx > CFG.WORLD_W/2 ? 1 : (this.facing||1);
    const color = this.type==='lana'?'#00d4ff':'#e8304a';
    bullets.push(new Bullet(this.cx, this.cy+10, dir*spd, rand(-1,1), this.dmg, 'player', color));
  }

  _special(world, bullets, particles, gasZones, enemies) {
    this.specialCD = 5;
    this.energy -= 25;
    if (this.type==='alex') {
      // Tactical slow — visual only in JS
      this.comboCount=3;
      particles.emit(this.cx, this.cy, {count:20, color:'#e8304a', maxSpd:8, maxLife:0.8});
      Assets.play('powerup', 0.6);
      // Burst shot
      for (let a=0;a<8;a++) {
        const angle=a/8*Math.PI*2;
        bullets.push(new Bullet(this.cx,this.cy,Math.cos(angle)*10,Math.sin(angle)*10,this.dmg*1.5,'player','#ff4060'));
      }
    } else {
      // Lana — hack nearby enemies
      let hacked=0;
      for (const en of enemies) {
        if (!en.alive) continue;
        if (dist(this,en)<this.hackRange) { en.hack(); hacked++; }
        if (hacked>=3) break;
      }
      particles.emit(this.cx, this.cy, {count:16, color:'#00d4ff', maxSpd:10, maxLife:1.0});
      Assets.play('hack', 0.5);
    }
  }

  hurt(dmg, particles) {
    if (this.invuln>0) return;
    this.hp     -= dmg;
    this.invuln  = 0.8;
    particles?.emit(this.cx, this.cy, {count:8, color:'#e8304a', maxSpd:4, maxLife:0.5});
    Assets.play('hit', 0.4);
  }

  draw(ctx, cam) {
    if (!cam.inView(this.x,this.y,this.w,this.h)) return;
    const s = cam.worldToScreen(this.x, this.y);

    // Laugh effect
    if (this.laughTimer>0) {
      ctx.save(); ctx.globalAlpha=0.5+Math.sin(Date.now()*0.02)*0.3;
    }

    const img = Assets.img(this.spriteKey);
    if (img) {
      ctx.save();
      if (this.facing<0) { ctx.scale(-1,1); ctx.drawImage(img, -s.x-this.w, s.y, this.w, this.h*2); }
      else                { ctx.drawImage(img, s.x, s.y, this.w, this.h*2); }
      ctx.restore();
    } else {
      // Fallback shape
      ctx.fillStyle = this.type==='alex'?'#e8304a':'#00d4ff';
      ctx.fillRect(s.x, s.y, this.w, this.h);
    }

    // Invuln flash
    if (this.invuln>0 && Math.floor(this.invuln*10)%2===0) {
      ctx.save(); ctx.globalAlpha=0.5;
      ctx.fillStyle='#fff'; ctx.fillRect(s.x,s.y,this.w,this.h);
      ctx.restore();
    }

    if (this.laughTimer>0) ctx.restore();

    // HP bar
    const bw=this.w+8; const bx=s.x-4; const by=s.y-10;
    ctx.fillStyle='#111'; ctx.fillRect(bx,by,bw,5);
    ctx.fillStyle=this.hp/this.maxHp>0.5?'#00e87a':'#e8304a';
    ctx.fillRect(bx,by,bw*(this.hp/this.maxHp),5);
    ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.fillRect(bx,by,bw,5);

    // Name tag
    ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(s.x-8,s.y-24,this.w+16,14);
    ctx.fillStyle=this.type==='alex'?'#e8304a':'#00d4ff';
    ctx.font='bold 10px monospace'; ctx.textAlign='center';
    ctx.fillText(this.type.toUpperCase(), s.x+this.w/2, s.y-13);
  }
}

// ── ENEMY ─────────────────────────────────────────────────────────────────────
class Enemy extends Entity {
  constructor(x,y,type='grunt') {
    super(x,y,26,52);
    const T = { grunt:{hp:60,spd:1.6,dmg:12,range:180,shotInt:45,score:150,col:'#c81e1e'},
                elite:{hp:120,spd:2.0,dmg:22,range:260,shotInt:30,score:300,col:'#c84040'},
                boss: {hp:500,spd:1.2,dmg:35,range:320,shotInt:20,score:1500,col:'#e8304a'} };
    const d = T[type]||T.grunt;
    this.etype=type; this.maxHp=d.hp; this.hp=d.hp; this.spd=d.spd; this.dmg=d.dmg;
    this.range=d.range; this.shotInterval=d.shotInt; this.score=d.score; this.col=d.col;
    this.state='patrol'; this.dir=v2(rand(-1,1),rand(-1,1));
    this.shotCD=randi(0,d.shotInt); this.stateTimer=0; this.facing=1;
    this.hackedTimer=0; this.laughTimer=0; this.sleepTimer=0;
    this.patrolTimer=0; this.alertTimer=0;
    this.spriteKey = type==='elite'?'enemy2':'enemy';
  }

  update(dt, player, bullets, particles, world) {
    if (!this.alive) return;

    // Status effects
    if (this.sleepTimer>0)  { this.sleepTimer-=dt; return; }
    if (this.laughTimer>0)  { this.laughTimer-=dt; return; }
    if (this.hackedTimer>0) { this.hackedTimer-=dt; this._hackBehavior(dt,bullets,particles); return; }

    if (this.shotCD>0) this.shotCD--;
    this.stateTimer+=dt;

    const d = dist(this,player);

    // FSM
    switch(this.state) {
      case 'patrol':
        this._patrol(dt,world);
        if (d<this.range) this._setState('alert');
        break;
      case 'alert':
        this._moveToward(player,dt,world);
        if (d<80) this._setState('attack');
        if (d>this.range*1.5 && this.stateTimer>4) this._setState('patrol');
        break;
      case 'attack':
        if (d>120) { this._setState('alert'); break; }
        this._faceTarget(player);
        if (this.shotCD<=0) { this._shoot(player,bullets); this.shotCD=this.shotInterval; }
        break;
      case 'flee':
        this._fleeFrom(player,dt,world);
        if (d>this.range*2) this._setState('patrol');
        break;
    }
  }

  _patrol(dt,world) {
    this.patrolTimer+=dt;
    if (this.patrolTimer>2) { this.dir=norm({x:rand(-1,1),y:rand(-1,1)}); this.patrolTimer=0; }
    const nx=this.x+this.dir.x*this.spd*0.5;
    const ny=this.y+this.dir.y*this.spd*0.5;
    if (!world.isSolid(nx+8,this.cy)) this.x=clamp(nx,0,CFG.WORLD_W-this.w);
    if (!world.isSolid(this.cx,ny+8)) this.y=clamp(ny,0,CFG.WORLD_H-this.h);
    if (this.dir.x!==0) this.facing=this.dir.x>0?1:-1;
  }

  _moveToward(target,dt,world) {
    const d=dist(this,target); if(d<10)return;
    const dx=(target.x-this.x)/d; const dy=(target.y-this.y)/d;
    const nx=this.x+dx*this.spd; const ny=this.y+dy*this.spd;
    if (!world.isSolid(nx+8,this.cy)) this.x=clamp(nx,0,CFG.WORLD_W-this.w);
    if (!world.isSolid(this.cx,ny+8)) this.y=clamp(ny,0,CFG.WORLD_H-this.h);
    this.facing=dx>0?1:-1;
  }

  _fleeFrom(target,dt,world) {
    const d=dist(this,target); if(d<1)return;
    const dx=-(target.x-this.x)/d; const dy=-(target.y-this.y)/d;
    const nx=this.x+dx*this.spd*1.2; const ny=this.y+dy*this.spd*1.2;
    if (!world.isSolid(nx+8,this.cy)) this.x=clamp(nx,0,CFG.WORLD_W-this.w);
    if (!world.isSolid(this.cx,ny+8)) this.y=clamp(ny,0,CFG.WORLD_H-this.h);
  }

  _faceTarget(target) { this.facing = target.x>this.x?1:-1; }

  _shoot(target,bullets) {
    const dx=target.cx-this.cx; const dy=target.cy-this.cy;
    const m=Math.hypot(dx,dy)||1; const spd=7;
    bullets.push(new Bullet(this.cx,this.cy,dx/m*spd,dy/m*spd,this.dmg,'enemy','#ff6030'));
    Assets.play('gunshot',0.12);
  }

  _hackBehavior(dt,bullets,particles) {
    // Hacké — attaque ses alliés
    this.alertTimer+=dt;
    if (this.alertTimer>3) { this.alertTimer=0; }
  }

  _setState(s) { this.state=s; this.stateTimer=0; }

  hack()  { this.hackedTimer=15; this.state='patrol'; Assets.play('hack',0.3); }
  laugh() { this.laughTimer=6; }
  sleep() { this.sleepTimer=30; }

  takeDamage(dmg, particles, cam) {
    this.hp-=dmg;
    particles?.emit(this.cx,this.cy,{count:6,color:'#ff4030',maxSpd:4,maxLife:0.4});
    cam?.doShake(2);
    if (this.hp<=0) { this.alive=false; return true; }
    if (this.hp<this.maxHp*0.2) this._setState('flee');
    return false;
  }

  draw(ctx,cam) {
    if (!this.alive || !cam.inView(this.x,this.y,this.w,this.h)) return;
    const s=cam.worldToScreen(this.x,this.y);

    ctx.save();
    if (this.hackedTimer>0) { ctx.filter='hue-rotate(180deg)'; }
    if (this.laughTimer>0)  { ctx.globalAlpha=0.6+Math.sin(Date.now()*0.025)*0.3; }

    const img=Assets.img(this.spriteKey);
    if (img) {
      if (this.facing<0) { ctx.scale(-1,1); ctx.drawImage(img,-s.x-this.w,s.y,this.w,this.h*2); }
      else               { ctx.drawImage(img,s.x,s.y,this.w,this.h*2); }
    } else {
      ctx.fillStyle=this.col; ctx.fillRect(s.x,s.y,this.w,this.h);
    }
    ctx.restore();

    // HP bar
    const bw=this.w+4; const bx=s.x-2; const by=s.y-8;
    ctx.fillStyle='#2a0a0a'; ctx.fillRect(bx,by,bw,4);
    ctx.fillStyle=this.col; ctx.fillRect(bx,by,bw*(this.hp/this.maxHp),4);

    // Status icon
    if (this.hackedTimer>0) { ctx.fillStyle='#00d4ff'; ctx.font='11px sans-serif'; ctx.textAlign='center'; ctx.fillText('⚡HACKÉ',s.x+this.w/2,s.y-12); }
    if (this.laughTimer>0)  { ctx.fillStyle='#b0e040'; ctx.font='11px sans-serif'; ctx.textAlign='center'; ctx.fillText('😂',s.x+this.w/2,s.y-12); }
    if (this.sleepTimer>0)  { ctx.fillStyle='#8090c0'; ctx.font='11px sans-serif'; ctx.textAlign='center'; ctx.fillText('💤',s.x+this.w/2,s.y-12); }
  }
}

// ── WORLD ─────────────────────────────────────────────────────────────────────
class World {
  constructor() {
    this.W = Math.ceil(CFG.WORLD_W/CFG.TILE);
    this.H = Math.ceil(CFG.WORLD_H/CFG.TILE);
    this.tiles = new Uint8Array(this.W*this.H);
    this.generate();
    this.bgImg = null;
  }

  generate() {
    const W=this.W, H=this.H;
    // Floor everywhere
    this.tiles.fill(0);
    // Ground
    for (let x=0;x<W;x++) for (let y=H-3;y<H;y++) this.setTile(x,y,2);
    // Buildings
    const buildings = [
      [0,4,8,H-4],[12,4,8,H-4],[24,4,10,H-4],[38,4,6,H-4],
      [50,4,9,H-4],[64,4,7,H-4],[75,4,11,H-4],[90,4,8,H-4],
    ];
    for (const [bx,by,bw,bh] of buildings) {
      for (let x=bx;x<bx+bw&&x<W;x++) {
        for (let y=by;y<by+bh&&y<H;y++) {
          this.setTile(x,y,x===bx||x===bx+bw-1||y===by?3:0);
        }
      }
    }
    // Cover objects
    for (let i=0;i<30;i++) {
      const cx=randi(5,W-5); const cy=H-4;
      for (let dx=0;dx<2;dx++) for (let dy=0;dy<1;dy++) this.setTile(cx+dx,cy+dy,5);
    }
  }

  setTile(x,y,v) { if(x>=0&&x<this.W&&y>=0&&y<this.H) this.tiles[y*this.W+x]=v; }
  getTile(x,y)   { if(x<0||x>=this.W||y<0||y>=this.H) return 1; return this.tiles[y*this.W+x]; }
  isSolid(wx,wy) { const tx=Math.floor(wx/CFG.TILE),ty=Math.floor(wy/CFG.TILE); const t=this.getTile(tx,ty); return t===2||t===3||t===5; }

  draw(ctx,cam) {
    // City scrolling background
    const bg=Assets.img('city-bg');
    if (bg) {
      const parallax=cam.x*0.4;
      ctx.drawImage(bg, -parallax%bg.width,     0, bg.width,   cam.vh);
      ctx.drawImage(bg, bg.width-parallax%bg.width, 0, bg.width, cam.vh);
    } else {
      ctx.fillStyle='#080c14'; ctx.fillRect(0,0,cam.vw,cam.vh);
    }

    // Tiles
    const T=CFG.TILE;
    const COLORS=['#0e1626','#121c2e','#1c263a','#1e2a3e','#14182030','#1e2228','#083468','#0c2610','#3e3016','#340a0a','#242430','#2a1c0e','#0a1428','#161b25','#521018','#060a50'];
    const startX=Math.max(0,Math.floor(cam.x/T));
    const endX  =Math.min(this.W,Math.ceil((cam.x+cam.vw)/T));
    const startY=Math.max(0,Math.floor(cam.y/T));
    const endY  =Math.min(this.H,Math.ceil((cam.y+cam.vh)/T));

    for (let ty=startY;ty<endY;ty++) {
      for (let tx=startX;tx<endX;tx++) {
        const t=this.getTile(tx,ty); if(!t)continue;
        const sx=(tx*T-cam.x); const sy=(ty*T-cam.y);
        const ts=Assets.img('tileset');
        if (ts) {
          const col=t%8; const row=Math.floor(t/8);
          ctx.drawImage(ts,col*32,row*32,32,32,sx,sy,T,T);
        } else {
          ctx.fillStyle=COLORS[t]||'#1a1a2e'; ctx.fillRect(sx,sy,T,T);
          ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.strokeRect(sx,sy,T,T);
        }
      }
    }

    // Neon grid overlay
    ctx.save(); ctx.globalAlpha=0.03;
    ctx.strokeStyle='#00d4ff'; ctx.lineWidth=0.5;
    for (let x=0;x<cam.vw;x+=60) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,cam.vh); ctx.stroke(); }
    for (let y=0;y<cam.vh;y+=60) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(cam.vw,y); ctx.stroke(); }
    ctx.restore();
  }
}

// Export globals
window.CFG=CFG; window.Input=Input; window.Assets=Assets; window.SoundMgr=SoundMgr;
window.Camera=Camera; window.ParticleSystem=ParticleSystem; window.GasZone=GasZone;
window.Entity=Entity; window.Bullet=Bullet; window.Player=Player; window.Enemy=Enemy;
window.World=World; window.lerp=lerp; window.clamp=clamp; window.dist=dist;
window.rand=rand; window.randi=randi; window.v2=v2;
