'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

// ─── Config ──────────────────────────────────────────────────────────────────
const PORT = 3000;
const TICK_MS = 33;          // 30 ticks/s
const BUY_TIME = 20;
const COMBAT_TIME = 100;
const SPIKE_DETONATE = 45;
const SPIKE_PLANT_DUR = 4;
const SPIKE_DEFUSE_DUR = 7;
const WIN_ROUNDS = 13;
const PLAYER_SPEED = 190;
const BOT_SPEED = 140;
const PLAYER_R = 16;
const BULLET_SPEED = 900;
const CLIENT_DIR = path.join(__dirname, '../client/src');

// ─── Map grid (80×50, 30px/cell = 2400×1500) ─────────────────────────────────
const COLS = 80, ROWS = 50, CELL = 30;
const WORLD_W = COLS * CELL;
const WORLD_H = ROWS * CELL;

function buildGrid() {
  const g = Array.from({ length: ROWS }, () => new Uint8Array(COLS).fill(1));
  const open = (r1, c1, r2, c2) => {
    for (let r = Math.max(1, r1); r <= Math.min(ROWS - 2, r2); r++)
      for (let c = Math.max(1, c1); c <= Math.min(COLS - 2, c2); c++)
        g[r][c] = 0;
  };
  const block = (r1, c1, r2, c2) => {
    for (let r = Math.max(1, r1); r <= Math.min(ROWS - 2, r2); r++)
      for (let c = Math.max(1, c1); c <= Math.min(COLS - 2, c2); c++)
        g[r][c] = 1;
  };
  
  // ─── Empty out corridors & sites ───
  // ATK spawn (left center)
  open(14, 1, 36, 16);
  // ATK spawn top arm → A Long
  open(1, 1, 14, 16);
  // ATK spawn bottom arm → C Long
  open(36, 1, 49, 16);
  // A Long (top corridor)
  open(1, 16, 14, 56);
  // A Site
  open(1, 56, 22, 73);
  // A Short (connects A Long to Mid)
  open(14, 38, 24, 56);
  // Mid corridor
  open(22, 16, 28, 57);
  // B Site
  open(22, 57, 28, 73);
  // C Short (connects Mid to C Long)
  open(26, 38, 36, 57);
  // C Long (bottom corridor)
  open(36, 16, 49, 56);
  // C Site
  open(26, 57, 49, 73);
  // DEF spawn (right side)
  open(1, 73, 49, 78);

  // ─── Add Tactical Obstacles & Cover ───
  // A Long blocks
  block(4, 25, 9, 28);
  block(1, 40, 6, 42);
  block(9, 45, 14, 48);
  // A Site blocks (Pillars & Crates)
  block(5, 62, 10, 66);
  block(15, 60, 20, 63);
  // A Short choke cover
  block(18, 42, 24, 45);

  // Mid blocks
  block(24, 30, 26, 34);
  block(22, 45, 25, 48);
  // B Site Pillar
  block(24, 62, 26, 68);
  block(22, 60, 24, 62);
  block(26, 60, 28, 62);

  // C Short cover
  block(26, 42, 32, 45);
  // C Long blocks
  block(40, 22, 45, 25);
  block(43, 35, 49, 39);
  block(36, 45, 42, 48);
  // C Site blocks
  block(32, 60, 36, 65);
  block(42, 63, 46, 68);

  return g;
}
const GRID = buildGrid();

function gridAt(x, y) {
  const c = Math.floor(x / CELL), r = Math.floor(y / CELL);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return 1;
  return GRID[r][c];
}
function blocked(x, y) {
  const R = PLAYER_R;
  return gridAt(x - R, y) || gridAt(x + R, y) || gridAt(x, y - R) || gridAt(x, y + R);
}
function moveSlide(x, y, dx, dy) {
  const nx = x + dx, ny = y + dy;
  if (!blocked(nx, ny)) return { x: nx, y: ny };
  if (!blocked(nx, y)) return { x: nx, y };
  if (!blocked(x, ny)) return { x, y: ny };
  return { x, y };
}
function rayBlocked(ax, ay, bx, by) {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (CELL / 2)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (gridAt(ax + (bx - ax) * t, ay + (by - ay) * t)) return true;
  }
  return false;
}

// ─── Spawns & plant zones ─────────────────────────────────────────────────────
const ATK_SP = [{ x: 150, y: 750 }, { x: 210, y: 660 }, { x: 210, y: 840 }, { x: 290, y: 700 }, { x: 290, y: 800 }];
const DEF_SP = [{ x: 2280, y: 750 }, { x: 2200, y: 660 }, { x: 2200, y: 840 }, { x: 2130, y: 700 }, { x: 2130, y: 800 }];
const PLANT_ZONES = [
  { x: 1710, y: 75, w: 270, h: 270, site: 'A' },
  { x: 1710, y: 675, w: 270, h: 270, site: 'B' },
  { x: 1710, y: 1125, w: 270, h: 270, site: 'C' },
];

// ─── Definitions ─────────────────────────────────────────────────────────────
const AGENTS = {
  Inferno: { role: 'Duelist', color: '#ff6b35', hp: 100, abilities: { q: { name: 'Firewall', cd: 12 }, e: { name: 'Blazing Dash', cd: 14 }, c: { name: 'Ember Grenade', cd: 18 }, x: { name: 'Phoenix Blast', cd: 0, charges: 2 } } },
  Specter: { role: 'Controller', color: '#9b59b6', hp: 100, abilities: { q: { name: 'Dark Shroud', cd: 35 }, e: { name: 'Shadow Step', cd: 20 }, c: { name: 'Phantom Sight', cd: 16 }, x: { name: 'From the Rift', cd: 45 } } },
  Solace:  { role: 'Sentinel', color: '#27ae60', hp: 100, abilities: { q: { name: 'Healing Orb', cd: 30 }, e: { name: 'Barrier Wall', cd: 40 }, c: { name: 'Slow Orb', cd: 35 }, x: { name: 'Revive', cd: 0, charges: 1 } } },
  Gust:    { role: 'Duelist', color: '#3498db', hp: 100, abilities: { q: { name: 'Tailwind', cd: 12 }, e: { name: 'Cloudburst', cd: 20 }, c: { name: 'Updraft', cd: 14 }, x: { name: 'Storm Knives', cd: 0, charges: 2 } } },
  Ember:   { role: 'Initiator', color: '#e74c3c', hp: 100, abilities: { q: { name: 'Tracking Dart', cd: 20 }, e: { name: 'Pulse Grenade', cd: 22 }, c: { name: 'Vision Drone', cd: 28 }, x: { name: 'Sky Strike', cd: 0, charges: 2 } } },
};
const W = {
  classic:  { name: 'CLASSIC',  cost: 0,    ammo: 12, dmg: 26,   rate: 250,  spread: 0.05, range: 700, pellets: 1 },
  bucky:    { name: 'BUCKY',    cost: 850,  ammo: 5,  dmg: 27,   rate: 900,  spread: 0.25, range: 300, pellets: 5 },
  sheriff:  { name: 'SHERIFF',  cost: 800,  ammo: 6,  dmg: 55,   rate: 500,  spread: 0.02, range: 800, pellets: 1 },
  spectre:  { name: 'SPECTRE',  cost: 1600, ammo: 30, dmg: 22,   rate: 90,   spread: 0.08, range: 600, pellets: 1 },
  phantom:  { name: 'PHANTOM',  cost: 2900, ammo: 30, dmg: 39,   rate: 110,  spread: 0.05, range: 800, pellets: 1 },
  vandal:   { name: 'VANDAL',   cost: 2900, ammo: 25, dmg: 40,   rate: 120,  spread: 0.03, range: 800, pellets: 1 },
  operator: { name: 'OPERATOR', cost: 4700, ammo: 5,  dmg: 150,  rate: 1300, spread: 0.01, range: 1000, pellets: 1 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _uid = 0;
const uid = () => `e${++_uid}`;
const rand4 = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 4; i++) s += c[Math.floor(Math.random() * c.length)]; return s; };
const d2 = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const atan2 = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);

function initAbilities(agentName) {
  const a = AGENTS[agentName].abilities;
  const out = {};
  for (const slot of ['q', 'e', 'c', 'x']) {
    out[slot] = { cd: 0, charges: a[slot].charges || -1 };
  }
  return out;
}

function makePlayer(id, ws, name, agent, team, spawnIdx) {
  const sp = team === 'attackers' ? ATK_SP[spawnIdx % 5] : DEF_SP[spawnIdx % 5];
  return {
    id, ws, name, agent, team, isBot: false,
    x: sp.x, y: sp.y, angle: team === 'attackers' ? 0 : Math.PI,
    hp: 100, armor: 0, alive: true,
    weapon: 'classic', ammo: W.classic.ammo, lastShot: 0,
    credits: 800, kills: 0, deaths: 0,
    abilities: initAbilities(agent),
    sprintTimer: 0, slowTimer: 0, stunTimer: 0,
    plantProgress: 0, defuseProgress: 0,
    respawnPos: null, ult: false,
  };
}

function makeBot(team, agent, spawnIdx, name) {
  const sp = team === 'attackers' ? ATK_SP[spawnIdx % 5] : DEF_SP[spawnIdx % 5];
  return {
    id: uid(), ws: null, name: name || `BOT_${agent}`, agent, team, isBot: true,
    x: sp.x, y: sp.y, angle: team === 'attackers' ? 0 : Math.PI,
    hp: 100, armor: 0, alive: true,
    weapon: team === 'defenders' ? 'vandal' : 'phantom', ammo: 25, lastShot: 0,
    credits: 800, kills: 0, deaths: 0,
    abilities: initAbilities(agent),
    sprintTimer: 0, slowTimer: 0, stunTimer: 0,
    // Bot AI state
    target: null, waypoint: null, stuckTimer: 0,
    lastX: sp.x, lastY: sp.y, thinkTimer: 0,
    reactTimer: 0, reacting: false,
    plantProgress: 0, defuseProgress: 0,
    respawnPos: null,
  };
}

// ─── Rooms ────────────────────────────────────────────────────────────────────
const rooms = new Map();

function createRoom(code) {
  return {
    code,
    players: new Map(),
    bots: [],
    bullets: [],
    effects: [],
    spike: { planted: false, x: 0, y: 0, site: '', timer: 0, carrier: null, plantProgress: 0, defuseProgress: 0, planting: false, defusing: false, defuserId: null },
    phase: 'waiting',
    phaseTimer: 0,
    round: 1,
    atkScore: 0,
    defScore: 0,
    roundBusy: false,
    gameLoop: null,
    matchOver: false,
    roundWinner: null,
    roundReason: '',
    lastTick: Date.now(),
    trackingActive: false,
    skyStrikeZones: [],
  };
}

// ─── Room helpers ─────────────────────────────────────────────────────────────
function broadcast(room, msg) {
  const data = JSON.stringify(msg);
  room.players.forEach(p => { if (p.ws && p.ws.readyState === 1) p.ws.send(data); });
}

function allEntities(room) {
  return [...room.players.values(), ...room.bots];
}

function getSpawnIdx(room, team) {
  const taken = allEntities(room).filter(e => e.team === team).length;
  return taken;
}

function fillBots(room) {
  const agentPool = Object.keys(AGENTS);
  const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const atkAgents = shuffle([...agentPool]);
  const defAgents = shuffle([...agentPool]);
  // 5v5: fill to 5 per team
  const atkPlayers = [...room.players.values()].filter(p => p.team === 'attackers').length;
  const defPlayers = [...room.players.values()].filter(p => p.team === 'defenders').length;
  room.bots = [];
  let ai = 0, di = 0;
  for (let i = atkPlayers; i < 5; i++) room.bots.push(makeBot('attackers', atkAgents[ai++ % 5], i, `Bot_${atkAgents[ai % 5]}`));
  for (let i = defPlayers; i < 5; i++) room.bots.push(makeBot('defenders', defAgents[di++ % 5], i, `Bot_${defAgents[di % 5]}`));
}

// ─── Round flow ───────────────────────────────────────────────────────────────
function resetPlayerForRound(p, room) {
  const team = p.team;
  const idx = allEntities(room).filter(e => e.team === team && e.id !== p.id).length;
  const sp = team === 'attackers' ? ATK_SP[idx % 5] : DEF_SP[idx % 5];
  p.x = sp.x; p.y = sp.y;
  p.hp = 100; p.armor = 0; p.alive = true;
  p.ammo = W[p.weapon].ammo;
  p.plantProgress = 0; p.defuseProgress = 0;
  p.slowTimer = 0; p.stunTimer = 0;
  p.abilities = initAbilities(p.agent);
}

function startRound(room) {
  room.roundBusy = false;
  room.roundWinner = null;
  room.bullets = [];
  room.effects = [];
  room.spike = { planted: false, x: 0, y: 0, site: '', timer: 0, carrier: null, plantProgress: 0, defuseProgress: 0, planting: false, defusing: false, defuserId: null };
  room.trackingActive = false;
  room.skyStrikeZones = [];
  allEntities(room).forEach(p => resetPlayerForRound(p, room));
  room.phase = 'buy';
  room.phaseTimer = BUY_TIME;
  broadcast(room, { type: 'roundStart', round: room.round, atkScore: room.atkScore, defScore: room.defScore });
}

function endRound(room, winner, reason) {
  if (room.roundBusy) return;
  room.roundBusy = true;
  room.roundWinner = winner;
  room.roundReason = reason;
  room.phase = 'roundEnd';

  if (winner === 'attackers') room.atkScore++;
  else room.defScore++;

  // Credit rewards
  allEntities(room).forEach(p => {
    if (!p.isBot) {
      p.credits += p.team === winner ? 3000 : 1900;
      p.credits = Math.min(9000, p.credits);
    }
  });

  broadcast(room, { type: 'roundEnd', winner, reason, atkScore: room.atkScore, defScore: room.defScore });

  // Check match over
  if (room.atkScore >= WIN_ROUNDS || room.defScore >= WIN_ROUNDS) {
    room.matchOver = true;
    broadcast(room, { type: 'matchOver', winner, atkScore: room.atkScore, defScore: room.defScore });
    return;
  }

  // Switch sides at 12 rounds
  setTimeout(() => {
    room.round++;
    if (room.round === 14) {
      // Swap sides
      allEntities(room).forEach(p => { p.team = p.team === 'attackers' ? 'defenders' : 'attackers'; });
    }
    startRound(room);
  }, 5000);
}

// ─── Combat: shooting ─────────────────────────────────────────────────────────
function shootBullet(room, shooter, angle, spreadExtra) {
  const wpn = W[shooter.weapon];
  const sp = spreadExtra || wpn.spread;
  if (shooter.ammo <= 0) return;
  shooter.ammo--;
  const now = Date.now();
  shooter.lastShot = now;

  for (let p = 0; p < wpn.pellets; p++) {
    const a = angle + (Math.random() - 0.5) * sp * 2;
    room.bullets.push({
      id: uid(), x: shooter.x, y: shooter.y, angle: a,
      vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED,
      team: shooter.team, shooterId: shooter.id,
      damage: wpn.dmg, range: wpn.range, traveled: 0, dead: false,
    });
  }
}

function applyDamage(target, dmg, room, killer) {
  if (!target.alive) return;
  const armorAbsorb = Math.min(target.armor * 0.5, dmg * 0.5);
  target.armor = Math.max(0, target.armor - armorAbsorb);
  target.hp = Math.max(0, target.hp - Math.floor(dmg - armorAbsorb));
  if (target.hp <= 0) {
    target.alive = false;
    target.deaths++;
    if (killer) { killer.kills++; if (!killer.isBot) { killer.credits = Math.min(9000, killer.credits + 300); } }
    broadcast(room, { type: 'kill', killerId: killer?.id, killerName: killer?.name, victimId: target.id, victimName: target.name, weapon: killer?.weapon });
  }
}

// ─── Tick: bullets ────────────────────────────────────────────────────────────
function tickBullets(room, dt) {
  const entities = allEntities(room);
  room.bullets = room.bullets.filter(b => {
    if (b.dead) return false;
    const dist = BULLET_SPEED * dt;
    b.traveled += dist;
    if (b.traveled > b.range) return false;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (gridAt(b.x, b.y)) { b.dead = true; return false; }
    for (const e of entities) {
      if (!e.alive || e.id === b.shooterId || e.team === b.team) continue;
      if (d2(b, e) < PLAYER_R + 6) {
        const shooter = entities.find(x => x.id === b.shooterId);
        applyDamage(e, b.damage, room, shooter);
        return false;
      }
    }
    return true;
  });
}

// ─── Tick: effects (smokes, fires, etc.) ──────────────────────────────────────
function tickEffects(room, dt) {
  room.effects = room.effects.filter(ef => {
    ef.timer -= dt;
    if (ef.timer <= 0) return false;
    if (ef.type === 'fire') {
      const entities = allEntities(room);
      entities.forEach(e => {
        if (!e.alive) return;
        if (d2(e, ef) < ef.radius) {
          e.hp = Math.max(0, e.hp - ef.dmgPerSec * dt);
          if (e.hp <= 0) { e.alive = false; e.deaths++; }
        }
      });
    }
    if (ef.type === 'slow') {
      const entities = allEntities(room);
      entities.forEach(e => {
        if (!e.alive) return;
        if (d2(e, ef) < ef.radius) e.slowTimer = Math.max(e.slowTimer, 0.5);
      });
    }
    if (ef.type === 'stun') {
      const entities = allEntities(room);
      entities.forEach(e => {
        if (!e.alive) return;
        if (d2(e, ef) < ef.radius) e.stunTimer = Math.max(e.stunTimer, 0.1);
      });
    }
    return true;
  });

  // Sky strike zones
  room.skyStrikeZones = room.skyStrikeZones.filter(z => {
    z.delay -= dt;
    if (z.delay <= 0 && !z.detonated) {
      z.detonated = true;
      const entities = allEntities(room);
      entities.forEach(e => {
        if (!e.alive || e.team === z.team) return;
        if (d2(e, z) < z.radius) applyDamage(e, 120, room, z.shooter);
      });
      broadcast(room, { type: 'event', msg: 'SKY STRIKE DETONATED!' });
    }
    return z.delay > -1;
  });
}

// ─── Tick: spike ──────────────────────────────────────────────────────────────
function tickSpike(room, dt) {
  const sp = room.spike;
  if (!sp.planted) return;
  sp.timer -= dt;
  if (sp.timer <= 0) endRound(room, 'attackers', 'SPIKE DETONATED');
}

// ─── Abilities ────────────────────────────────────────────────────────────────
function useAbility(room, entity, slot, tx, ty) {
  const agDef = AGENTS[entity.agent].abilities[slot];
  const ab = entity.abilities[slot];

  if (ab.cd > 0) return;
  if (ab.charges === 0) return;

  const spend = () => {
    if (agDef.charges) ab.charges = Math.max(0, ab.charges - 1);
    ab.cd = agDef.cd;
    broadcast(room, { type: 'ability', id: entity.id, slot, agent: entity.agent });
  };

  const agent = entity.agent;

  if (agent === 'Inferno') {
    if (slot === 'e') { // Blazing Dash
      const ang = Math.atan2(ty - entity.y, tx - entity.x);
      const nx = entity.x + Math.cos(ang) * 220, ny = entity.y + Math.sin(ang) * 220;
      if (!blocked(nx, ny)) { entity.x = nx; entity.y = ny; }
      spend();
    } else if (slot === 'q') { // Firewall
      room.effects.push({ type: 'fire', x: tx, y: ty, radius: 80, timer: 4, dmgPerSec: 30 });
      spend();
    } else if (slot === 'c') { // Ember Grenade
      const ang = Math.atan2(ty - entity.y, tx - entity.x);
      setTimeout(() => {
        room.effects.push({ type: 'explosion', x: tx, y: ty, radius: 150, timer: 0.5 });
        allEntities(room).forEach(e => {
          if (e.team !== entity.team && e.alive && d2(e, { x: tx, y: ty }) < 150)
            applyDamage(e, 80, room, entity);
        });
        broadcast(room, { type: 'effect', kind: 'explosion', x: tx, y: ty });
      }, 1500);
      spend();
    } else if (slot === 'x') { // Phoenix Blast - mark respawn pos
      entity.respawnPos = { x: entity.x, y: entity.y };
      entity.ult = true;
      spend();
    }
  }

  if (agent === 'Specter') {
    if (slot === 'q') { // Dark Shroud - 3 smokes
      [0, 120, 240].forEach(offset => {
        const a = (entity.angle + offset * Math.PI / 180);
        room.effects.push({ type: 'smoke', x: entity.x + Math.cos(a) * 200, y: entity.y + Math.sin(a) * 200, radius: 90, timer: 12 });
      });
      spend();
    } else if (slot === 'e') { // Shadow Step
      const ang = Math.atan2(ty - entity.y, tx - entity.x);
      const dist = Math.min(350, d2(entity, { x: tx, y: ty }));
      const nx = entity.x + Math.cos(ang) * dist, ny = entity.y + Math.sin(ang) * dist;
      if (!blocked(nx, ny)) { entity.x = nx; entity.y = ny; }
      spend();
    } else if (slot === 'c') { // Phantom Sight - blind
      room.effects.push({ type: 'blind', x: entity.x, y: entity.y, radius: 300, timer: 2, team: entity.team });
      broadcast(room, { type: 'blind', team: entity.team === 'attackers' ? 'defenders' : 'attackers', duration: 2 });
      spend();
    } else if (slot === 'x') { // From the Rift - TP to ally
      const allies = allEntities(room).filter(e => e.team === entity.team && e.alive && e.id !== entity.id);
      if (allies.length) { const a = allies[Math.floor(Math.random() * allies.length)]; entity.x = a.x + 40; entity.y = a.y + 40; }
      spend();
    }
  }

  if (agent === 'Solace') {
    if (slot === 'q') { // Healing Orb
      const allies = allEntities(room).filter(e => e.team === entity.team && e.alive);
      const nearest = allies.reduce((best, e) => d2(e, { x: tx, y: ty }) < d2(best, { x: tx, y: ty }) ? e : best, allies[0]);
      if (nearest) room.effects.push({ type: 'heal', target: nearest.id, x: tx, y: ty, radius: 80, timer: 5, hpPerSec: 20 });
      spend();
    } else if (slot === 'e') { // Barrier Wall
      room.effects.push({ type: 'wall', x: tx, y: ty, w: 12, h: 120, timer: 7 });
      spend();
    } else if (slot === 'c') { // Slow Orb
      room.effects.push({ type: 'slow', x: tx, y: ty, radius: 180, timer: 5 });
      spend();
    } else if (slot === 'x') { // Revive
      const dead = allEntities(room).filter(e => e.team === entity.team && !e.alive);
      if (dead.length) { const t = dead[0]; t.alive = true; t.hp = 50; t.x = entity.x + 30; t.y = entity.y + 30; broadcast(room, { type: 'event', msg: `${t.name} REVIVED BY ${entity.name}!` }); }
      spend();
    }
  }

  if (agent === 'Gust') {
    if (slot === 'q') { // Tailwind - dash
      const nx = entity.x + Math.cos(entity.angle) * 240, ny = entity.y + Math.sin(entity.angle) * 240;
      if (!blocked(nx, ny)) { entity.x = nx; entity.y = ny; }
      spend();
    } else if (slot === 'e') { // Cloudburst - smoke
      room.effects.push({ type: 'smoke', x: tx, y: ty, radius: 100, timer: 10 });
      spend();
    } else if (slot === 'c') { // Updraft - speed boost
      entity.sprintTimer = 2;
      spend();
    } else if (slot === 'x') { // Storm Knives - 3 bullets
      for (let i = -1; i <= 1; i++) shootBullet(room, entity, entity.angle + i * 0.2, 0);
      spend();
    }
  }

  if (agent === 'Ember') {
    if (slot === 'q') { // Tracking Dart - reveal enemies
      room.trackingActive = true;
      setTimeout(() => { room.trackingActive = false; }, 6000);
      spend();
    } else if (slot === 'e') { // Pulse Grenade - stun
      room.effects.push({ type: 'stun', x: tx, y: ty, radius: 200, timer: 1.5 });
      spend();
    } else if (slot === 'c') { // Vision Drone
      room.effects.push({ type: 'drone', x: entity.x, y: entity.y, angle: entity.angle, team: entity.team, timer: 5, speed: 200 });
      spend();
    } else if (slot === 'x') { // Sky Strike
      room.skyStrikeZones.push({ x: tx, y: ty, radius: 250, delay: 1.5, detonated: false, team: entity.team, shooter: entity });
      broadcast(room, { type: 'skyStrikeWarning', x: tx, y: ty });
      spend();
    }
  }
}

// ─── Tick: heal effects on targets ─────────────────────────────────────────
function tickHealEffects(room, dt) {
  room.effects.forEach(ef => {
    if (ef.type !== 'heal') return;
    const target = allEntities(room).find(e => e.id === ef.target);
    if (target && target.alive) target.hp = Math.min(100, target.hp + ef.hpPerSec * dt);
  });
}

// ─── Tick: ability cooldowns ──────────────────────────────────────────────────
function tickCooldowns(room, dt) {
  allEntities(room).forEach(p => {
    for (const sl of ['q', 'e', 'c', 'x']) {
      if (p.abilities[sl].cd > 0) p.abilities[sl].cd = Math.max(0, p.abilities[sl].cd - dt);
    }
    if (p.slowTimer > 0) p.slowTimer = Math.max(0, p.slowTimer - dt);
    if (p.stunTimer > 0) p.stunTimer = Math.max(0, p.stunTimer - dt);
    if (p.sprintTimer > 0) p.sprintTimer = Math.max(0, p.sprintTimer - dt);

    // Phoenix Blast: auto-revive
    if (!p.alive && p.ult && p.respawnPos && p.agent === 'Inferno') {
      p.alive = true; p.hp = 50; p.x = p.respawnPos.x; p.y = p.respawnPos.y; p.ult = false; p.respawnPos = null;
      broadcast(room, { type: 'event', msg: `${p.name} RISES AGAIN!` });
    }
  });
}

// ─── Bot AI ───────────────────────────────────────────────────────────────────
const BOT_WAYPOINTS = {
  attackers: {
    A: [{ x: 420, y: 200 }, { x: 900, y: 200 }, { x: 1680, y: 150 }, { x: 1850, y: 200 }],
    B: [{ x: 420, y: 750 }, { x: 900, y: 750 }, { x: 1680, y: 750 }, { x: 1850, y: 750 }],
    C: [{ x: 420, y: 1300 }, { x: 900, y: 1300 }, { x: 1680, y: 1350 }, { x: 1850, y: 1200 }],
  },
  defenders: {
    A: [{ x: 2200, y: 200 }, { x: 1980, y: 200 }, { x: 1900, y: 200 }],
    B: [{ x: 2200, y: 750 }, { x: 1980, y: 750 }, { x: 1900, y: 750 }],
    C: [{ x: 2200, y: 1300 }, { x: 1980, y: 1300 }, { x: 1900, y: 1350 }],
  },
};

function tickBot(bot, room, dt, now) {
  if (!bot.alive || room.phase !== 'combat') return;
  if (bot.stunTimer > 0) return;

  const speed = bot.slowTimer > 0 ? BOT_SPEED * 0.5 : BOT_SPEED;
  const entities = allEntities(room);
  const enemies = entities.filter(e => e.team !== bot.team && e.alive);
  const spike = room.spike;

  // Think every ~0.6s
  bot.thinkTimer -= dt;
  if (bot.thinkTimer <= 0) {
    bot.thinkTimer = 0.5 + Math.random() * 0.4;
    // Pick target: nearest enemy
    bot.target = enemies.reduce((best, e) => (!best || d2(bot, e) < d2(bot, best)) ? e : best, null);

    // Pick waypoint based on role
    const site = ['A', 'B', 'C'][Math.floor(Math.random() * 3)];
    const wps = BOT_WAYPOINTS[bot.team][site];
    if (!bot.wpPath || Math.random() < 0.3) bot.wpPath = [...wps];
  }

  // Move toward current waypoint
  if (!bot.wpPath || bot.wpPath.length === 0) {
    const site = ['A', 'B', 'C'][Math.floor(Math.random() * 3)];
    bot.wpPath = [...BOT_WAYPOINTS[bot.team][site]];
  }

  const wp = bot.wpPath[0];
  const dx = wp.x - bot.x, dy = wp.y - bot.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 30) {
    bot.wpPath.shift();
  } else {
    const step = speed * dt;
    const pos = moveSlide(bot.x, bot.y, (dx / dist) * step, (dy / dist) * step);
    bot.x = pos.x; bot.y = pos.y;
  }

  // Face target or direction of travel
  if (bot.target) {
    bot.angle = atan2(bot, bot.target);
  } else {
    bot.angle = Math.atan2(dy, dx);
  }

  // Shoot if target visible and in range
  if (bot.target && !rayBlocked(bot.x, bot.y, bot.target.x, bot.target.y)) {
    if (!bot.reactTimer) bot.reactTimer = now;
    const dist2 = d2(bot, bot.target);
    const wpn = W[bot.weapon];
    // 400ms reaction delay, fire 2.5x slower than gun max rate, wide inaccuracy spread
    if (dist2 < wpn.range && now - bot.lastShot > wpn.rate * 2.5 && now - bot.reactTimer > 400) {
      const jitter = (Math.random() - 0.5) * 0.25;
      shootBullet(room, bot, bot.angle + jitter, 0);
    }
  } else {
    bot.reactTimer = 0;
  }

  // Spike logic
  if (bot.team === 'attackers' && !spike.planted) {
    const zone = PLANT_ZONES.find(z => bot.x > z.x && bot.x < z.x + z.w && bot.y > z.y && bot.y < z.y + z.h);
    if (zone) {
      spike.planting = true;
      spike.plantProgress = (spike.plantProgress || 0) + dt;
      if (spike.plantProgress >= SPIKE_PLANT_DUR) {
        spike.planted = true; spike.planting = false; spike.x = bot.x; spike.y = bot.y; spike.site = zone.site;
        spike.timer = SPIKE_DETONATE; spike.plantProgress = 0;
        broadcast(room, { type: 'event', msg: `SPIKE PLANTED ON ${zone.site}!` });
      }
    }
  }

  if (bot.team === 'defenders' && spike.planted) {
    const dist2 = d2(bot, spike);
    if (dist2 < 50) {
      spike.defusing = true;
      spike.defuseProgress = (spike.defuseProgress || 0) + dt;
      if (spike.defuseProgress >= SPIKE_DEFUSE_DUR) {
        spike.planted = false; spike.defusing = false; spike.defuseProgress = 0;
        endRound(room, 'defenders', 'SPIKE DEFUSED');
      }
    }
  }
}

// ─── Check eliminations ───────────────────────────────────────────────────────
function checkElim(room) {
  const entities = allEntities(room);
  const atkAlive = entities.filter(e => e.team === 'attackers' && e.alive).length;
  const defAlive = entities.filter(e => e.team === 'defenders' && e.alive).length;
  if (atkAlive === 0) endRound(room, 'defenders', 'TEAM ELIMINATED');
  else if (defAlive === 0) endRound(room, 'attackers', 'TEAM ELIMINATED');
}

// ─── Game loop ────────────────────────────────────────────────────────────────
function gameTick(room) {
  const now = Date.now();
  const dt = Math.min((now - room.lastTick) / 1000, 0.1);
  room.lastTick = now;

  if (room.phase === 'buy') {
    room.phaseTimer -= dt;
    if (room.phaseTimer <= 0) {
      room.phase = 'combat';
      room.phaseTimer = COMBAT_TIME;
      broadcast(room, { type: 'phaseChange', phase: 'combat', timer: COMBAT_TIME });
    }
  } else if (room.phase === 'combat') {
    room.phaseTimer -= dt;
    tickBullets(room, dt);
    tickEffects(room, dt);
    tickHealEffects(room, dt);
    tickCooldowns(room, dt);
    tickSpike(room, dt);
    if (!room.roundBusy) {
      room.bots.forEach(b => tickBot(b, room, dt, now));
      checkElim(room);
      if (!room.roundBusy && room.phaseTimer <= 0) endRound(room, 'defenders', 'TIME EXPIRED');
    }
  }

  // Broadcast state
  const state = buildState(room);
  broadcast(room, { type: 'state', ...state });
}

function buildState(room) {
  const entities = allEntities(room);
  return {
    phase: room.phase,
    phaseTimer: Math.ceil(room.phaseTimer),
    round: room.round,
    atkScore: room.atkScore,
    defScore: room.defScore,
    spike: { ...room.spike },
    trackingActive: room.trackingActive,
    skyStrikeZones: room.skyStrikeZones.map(z => ({ x: z.x, y: z.y, radius: z.radius, delay: z.delay })),
    effects: room.effects.map(e => ({ type: e.type, x: e.x, y: e.y, radius: e.radius, timer: e.timer })),
    players: entities.map(p => ({
      id: p.id, name: p.name, agent: p.agent, team: p.team, isBot: p.isBot,
      x: p.x, y: p.y, angle: p.angle, hp: p.hp, armor: p.armor, alive: p.alive,
      weapon: p.weapon, ammo: p.ammo, credits: p.isBot ? 0 : p.credits,
      kills: p.kills, deaths: p.deaths,
      abilities: p.abilities,
      slowTimer: p.slowTimer, stunTimer: p.stunTimer, sprintTimer: p.sprintTimer,
    })),
    bullets: room.bullets.map(b => ({ id: b.id, x: b.x, y: b.y, angle: b.angle, team: b.team })),
  };
}

// ─── Input handling ───────────────────────────────────────────────────────────
function handleInput(room, player, msg) {
  if (!player.alive || room.phase === 'roundEnd') return;

  const dt = TICK_MS / 1000;
  const spd = player.sprintTimer > 0 ? PLAYER_SPEED * 1.5 : (player.slowTimer > 0 ? PLAYER_SPEED * 0.5 : PLAYER_SPEED);

  if (player.stunTimer <= 0 && room.phase !== 'buy') {
    let dx = 0, dy = 0;
    if (msg.keys?.w) dy -= 1;
    if (msg.keys?.s) dy += 1;
    if (msg.keys?.a) dx -= 1;
    if (msg.keys?.d) dx += 1;
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }
    if (dx !== 0 || dy !== 0) {
      const pos = moveSlide(player.x, player.y, dx * spd * dt, dy * spd * dt);
      player.x = pos.x; player.y = pos.y;
    }
  } else if (room.phase === 'buy') {
    // Allow movement in spawn during buy
    let dx = 0, dy = 0;
    if (msg.keys?.w) dy -= 1;
    if (msg.keys?.s) dy += 1;
    if (msg.keys?.a) dx -= 1;
    if (msg.keys?.d) dx += 1;
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }
    if (dx !== 0 || dy !== 0) {
      const pos = moveSlide(player.x, player.y, dx * spd * dt, dy * spd * dt);
      player.x = pos.x; player.y = pos.y;
    }
  }

  if (msg.angle !== undefined) player.angle = msg.angle;

  // Shoot
  if (msg.shoot && room.phase === 'combat') {
    const now = Date.now();
    if (now - player.lastShot > W[player.weapon].rate && player.ammo > 0) {
      player.lastShot = now;
      shootBullet(room, player, player.angle, 0);
    }
  }

  // Plant/Defuse
  if (msg.interact && room.phase === 'combat') {
    const spike = room.spike;
    if (player.team === 'attackers' && !spike.planted) {
      const zone = PLANT_ZONES.find(z => player.x > z.x && player.x < z.x + z.w && player.y > z.y && player.y < z.y + z.h);
      if (zone) {
        spike.planting = true;
        spike.plantProgress = (spike.plantProgress || 0) + dt * 3;
        if (spike.plantProgress >= 1) {
          spike.planted = true; spike.planting = false; spike.x = player.x; spike.y = player.y; spike.site = zone.site;
          spike.timer = SPIKE_DETONATE; spike.plantProgress = 0;
          broadcast(room, { type: 'event', msg: `SPIKE PLANTED ON ${zone.site} BY ${player.name}!` });
        }
      }
    } else if (player.team === 'defenders' && spike.planted) {
      if (d2(player, spike) < 60) {
        spike.defusing = true;
        spike.defuseProgress = (spike.defuseProgress || 0) + dt * (1 / SPIKE_DEFUSE_DUR);
        if (spike.defuseProgress >= 1) {
          spike.planted = false; spike.defusing = false; spike.defuseProgress = 0;
          endRound(room, 'defenders', 'SPIKE DEFUSED');
        }
      }
    }
  } else {
    if (room.spike.planting && !msg.interact) { room.spike.planting = false; room.spike.plantProgress = 0; }
    if (room.spike.defusing && !msg.interact) { room.spike.defusing = false; room.spike.defuseProgress = 0; }
  }

  // Reload
  if (msg.reload) { player.ammo = W[player.weapon].ammo; }
}

// ─── WebSocket server ─────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  let file = req.url === '/' ? 'index.html' : req.url.replace(/^\//, '');
  // Only allow safe files
  const allowed = ['index.html', 'main.js', 'style.css'];
  if (allowed.includes(file)) {
    const ext = path.extname(file);
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' }[ext] || 'text/plain';
    try {
      const data = fs.readFileSync(path.join(CLIENT_DIR, file));
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    } catch { res.writeHead(404); res.end('Not found'); }
  } else if (req.url === '/mapgrid') {
    // Serve map grid as JSON
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ cols: COLS, rows: ROWS, cell: CELL, worldW: WORLD_W, worldH: WORLD_H, grid: GRID.map(r => Array.from(r)) }));
  } else {
    res.writeHead(404); res.end();
  }
});

const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
  const id = uid();
  let room = null;
  let player = null;

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'quickPlay') {
      // Single player vs bots
      const code = rand4();
      room = createRoom(code);
      rooms.set(code, room);
      player = makePlayer(id, ws, msg.name || 'Player', msg.agent || 'Inferno', 'attackers', 0);
      room.players.set(id, player);
      fillBots(room);
      room.lastTick = Date.now();
      room.gameLoop = setInterval(() => gameTick(room), TICK_MS);
      ws.send(JSON.stringify({ type: 'joined', roomCode: code, playerId: id, team: 'attackers', grid: { cols: COLS, rows: ROWS, cell: CELL, worldW: WORLD_W, worldH: WORLD_H, grid: GRID.map(r => Array.from(r)) }, plantZones: PLANT_ZONES, agents: AGENTS, weapons: W }));
      startRound(room);
    }

    if (msg.type === 'createRoom') {
      const code = rand4();
      room = createRoom(code);
      rooms.set(code, room);
      player = makePlayer(id, ws, msg.name || 'Player1', msg.agent || 'Inferno', 'attackers', 0);
      room.players.set(id, player);
      ws.send(JSON.stringify({ type: 'roomCreated', roomCode: code, playerId: id }));
    }

    if (msg.type === 'joinRoom') {
      const code = msg.code?.toUpperCase();
      room = rooms.get(code);
      if (!room) { ws.send(JSON.stringify({ type: 'error', msg: 'Room not found' })); return; }
      const teamSize = [...room.players.values()].filter(p => p.team === 'defenders').length;
      player = makePlayer(id, ws, msg.name || 'Player2', msg.agent || 'Gust', 'defenders', teamSize);
      room.players.set(id, player);
      fillBots(room);
      room.lastTick = Date.now();
      room.gameLoop = setInterval(() => gameTick(room), TICK_MS);
      const gridData = { cols: COLS, rows: ROWS, cell: CELL, worldW: WORLD_W, worldH: WORLD_H, grid: GRID.map(r => Array.from(r)) };
      broadcast(room, { type: 'joined', roomCode: code, playerId: id, team: player.team, grid: gridData, plantZones: PLANT_ZONES, agents: AGENTS, weapons: W });
      startRound(room);
    }

    if (msg.type === 'input' && player && room) handleInput(room, player, msg);

    if (msg.type === 'buy' && player && room && room.phase === 'buy') {
      const wpn = W[msg.weapon];
      if (!wpn) return;
      if (wpn.armor) {
        if (player.credits >= wpn.cost) { player.credits -= wpn.cost; player.armor = Math.min(50, player.armor + wpn.armor); }
      } else {
        if (player.credits >= wpn.cost) { player.credits -= wpn.cost; player.weapon = msg.weapon; player.ammo = wpn.ammo; }
      }
    }

    if (msg.type === 'ability' && player && room) {
      useAbility(room, player, msg.slot, msg.tx || player.x, msg.ty || player.y);
    }

    if (msg.type === 'reload' && player) {
      player.ammo = W[player.weapon].ammo;
    }
  });

  ws.on('close', () => {
    if (room && player) {
      room.players.delete(id);
      if (room.players.size === 0) {
        clearInterval(room.gameLoop);
        rooms.delete(room.code);
      }
    }
  });
});

server.listen(PORT, () => console.log(`✅ Crossfire Protocol server running → http://localhost:${PORT}`));
