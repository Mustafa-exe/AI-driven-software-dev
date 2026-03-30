'use strict';
// ─── Global state ─────────────────────────────────────────────────────────────
let ws = null;
let myId = null;
let myTeam = null;
let gameMode = 'quick'; // quick | create | join
let mapData = null;
let plantZones = [];
let agentDefs = {};
let weaponDefs = {};
let gameState = null;
let prevState = null;
let lastStateTime = 0;
let renderLoop = null;
let interacting = false;
let buyPanelOpen = false;
let minimapVisible = true;
let escOpen = false;
let abilityPending = null;
let mouseWorld = { x: 0, y: 0 };
let mouseScreen = { x: 0, y: 0 }; // raw screen coords for crosshair drawing
let mouseAngle = 0;
let shooting = false;
let keys = { w: false, a: false, s: false, d: false };
let autoSelectTimer = null;
let serverAddr = 'ws://localhost:3000';
let cameraX = 0, cameraY = 0;
let inGame = false;

const AGENT_DESCS = {
  Inferno: 'A Duelist who wields the power of fire. Commands flames to overwhelm, outlast, and outplay.',
  Specter: 'A Controller who bends shadow and space. Denies vision and warps across the battlefield.',
  Solace: 'A Sentinel who heals and fortifies. Protects allies and holds ground with barrier tech.',
  Gust: 'A Duelist riding the wind. Strikes with blinding speed, impossible to pin down.',
  Ember: 'An Initiator who scouts and disrupts. Reveals enemies and sets up the team to dominate.',
};
const AGENT_AB_DESCS = {
  Inferno: {
    q: 'Ignite a line of flame. Enemies passing through take 30 dmg/s.',
    e: 'Teleport forward toward your cursor position.',
    c: 'Throw a grenade — explodes for 80 AoE damage after 1.5s.',
    x: 'Mark your position. If killed within 15s, auto-revive with 50 HP.',
  },
  Specter: {
    q: 'Deploy 3 smokes in a triangle around you, blocking line of sight.',
    e: 'Teleport up to 350 units toward your cursor.',
    c: 'Emit a flash burst — blinds nearby enemies for 2s.',
    x: 'Instantly teleport to a random ally\'s position.',
  },
  Solace: {
    q: 'Place a healing orb at target. Nearest ally heals 20 HP/s for 5s.',
    e: 'Erect a solid barrier wall at target that lasts 7s.',
    c: 'Toss a slow orb — enemies in area move at 50% speed for 5s.',
    x: 'Revive the nearest dead teammate with 50 HP. (1 charge)',
  },
  Gust: {
    q: 'Dash rapidly in your current movement direction.',
    e: 'Toss a cloudburst smoke grenade to a target location.',
    c: 'Gain 150% movement speed for 2 seconds.',
    x: 'Fire 3 rapid projectiles in a spread cone. (2 charges)',
  },
  Ember: {
    q: 'Fire a tracking dart — reveals all enemies for 6 seconds.',
    e: 'Throw a stun pulse — disables enemy movement for 1.5s.',
    c: 'Launch a vision drone that scouts forward for 5s.',
    x: 'Mark an area — detonates after 1.5s for 120 AoE damage. (2 charges)',
  },
};
const AGENT_ICONS = { q: ['🔥','🌑','💚','💨','🎯'], e: ['⚡','🌀','🛡','☁️','💥'], c: ['💣','😵','🌊','🏃','🚁'], x: ['🌅','🌌','❤️','⚔️','☄️'] };
const AGENT_COLORS = { Inferno: '#ff6b35', Specter: '#9b59b6', Solace: '#27ae60', Gust: '#3498db', Ember: '#e74c3c' };
const AGENT_LIST = ['Inferno', 'Specter', 'Solace', 'Gust', 'Ember'];

const settings = { crosshairColor: '#f5c542', crosshairStyle: 'cross', hudOpacity: 90, showFps: false };

// ─── Screen routing ────────────────────────────────────────────────────────────
window.showScreen = function (id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
};
window.setMode = function (m) { gameMode = m; };

// ─── Agent select ──────────────────────────────────────────────────────────────
let selectedAgent = 'Inferno';

window.selectAgent = function (card) {
  document.querySelectorAll('.as-agent').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  selectedAgent = card.dataset.agent;
  updateAgentInfo(selectedAgent);
};

function updateAgentInfo(agent) {
  const agIdx = AGENT_LIST.indexOf(agent);
  const ab = AGENT_AB_DESCS[agent];
  document.getElementById('as-agent-name').textContent = agent.toUpperCase();
  document.getElementById('as-agent-role-label').textContent = (agentDefs[agent]?.role || AGENT_DESCS[agent] ? getRole(agent) : 'DUELIST').toUpperCase();
  document.getElementById('as-agent-desc').textContent = AGENT_DESCS[agent];
  const slots = ['q', 'e', 'c', 'x'];
  const names = { Inferno: ['FIREWALL', 'BLAZING DASH', 'EMBER GRENADE', 'PHOENIX BLAST'], Specter: ['DARK SHROUD', 'SHADOW STEP', 'PHANTOM SIGHT', 'FROM THE RIFT'], Solace: ['HEALING ORB', 'BARRIER WALL', 'SLOW ORB', 'REVIVE'], Gust: ['TAILWIND', 'CLOUDBURST', 'UPDRAFT', 'STORM KNIVES'], Ember: ['TRACKING DART', 'PULSE GRENADE', 'VISION DRONE', 'SKY STRIKE'] };
  slots.forEach((sl, i) => {
    document.getElementById(`ab-${sl}-name`).textContent = names[agent][i];
    document.getElementById(`ab-${sl}-desc`).textContent = ab[sl];
  });
  const glow = document.getElementById('portrait-glow');
  if (glow) glow.style.background = `radial-gradient(circle, ${AGENT_COLORS[agent]}55, transparent 70%)`;
  const portrait = document.getElementById('as-portrait');
  if (portrait) portrait.style.background = `linear-gradient(135deg, ${AGENT_COLORS[agent]}22, transparent)`;
}

function getRole(a) {
  return { Inferno: 'DUELIST', Specter: 'CONTROLLER', Solace: 'SENTINEL', Gust: 'DUELIST', Ember: 'INITIATOR' }[a] || 'DUELIST';
}

function startAutoSelect() {
  let t = 0;
  const bar = document.getElementById('as-timer-fill');
  clearInterval(autoSelectTimer);
  autoSelectTimer = setInterval(() => {
    t += 100;
    if (bar) bar.style.width = `${Math.min(100, (t / 15000) * 100)}%`;
    if (t >= 15000) { clearInterval(autoSelectTimer); lockIn(); }
  }, 100);
}

window.lockIn = function () {
  clearInterval(autoSelectTimer);
  const nameCreate = document.getElementById('player-name-create')?.value || 'Player1';
  const nameJoin = document.getElementById('player-name-join')?.value || 'Player2';
  const roomCode = document.getElementById('room-code-input')?.value || '';
  const addr = document.getElementById('server-addr')?.value || serverAddr;
  serverAddr = addr;

  showScreen('connecting-overlay');
  document.getElementById('conn-sub').textContent = `Connecting to ${addr}...`;

  connectWS(addr, () => {
    if (gameMode === 'quick') {
      const name = nameCreate;
      ws.send(JSON.stringify({ type: 'quickPlay', name, agent: selectedAgent }));
    } else if (gameMode === 'create') {
      ws.send(JSON.stringify({ type: 'createRoom', name: nameCreate, agent: selectedAgent }));
    } else if (gameMode === 'join') {
      ws.send(JSON.stringify({ type: 'joinRoom', code: roomCode.toUpperCase(), name: nameJoin, agent: selectedAgent }));
    }
  });
};

window.cancelWait = function () {
  if (ws) { ws.close(); ws = null; }
  showScreen('main-menu');
};

// ─── WebSocket client ──────────────────────────────────────────────────────────
function connectWS(addr, onOpen) {
  if (ws) { try { ws.close(); } catch (e) {} }
  try {
    ws = new WebSocket(addr);
  } catch (e) {
    alert('Cannot connect to server. Make sure the server is running.');
    showScreen('main-menu');
    return;
  }
  ws.onopen = onOpen;
  ws.onmessage = e => handleServerMsg(JSON.parse(e.data));
  ws.onerror = () => { alert('Connection error. Is the server running?\n\nStart it with: node game-server.js'); showScreen('main-menu'); };
  ws.onclose = () => { if (gameState) { gameState = null; } };
}

function sendInput() {
  if (!ws || ws.readyState !== 1 || !myId) return;
  ws.send(JSON.stringify({ type: 'input', keys, angle: mouseAngle, shoot: shooting, interact: interacting }));
}

function buyItem(weapon) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ type: 'buy', weapon }));
}
window.buyItem = buyItem;

function useAbility(slot, tx, ty) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ type: 'ability', slot, tx, ty }));
}

// ─── Server message handler ───────────────────────────────────────────────────
function handleServerMsg(msg) {
  if (msg.type === 'joined') {
    myId = msg.playerId;
    myTeam = msg.team;
    if (msg.grid) mapData = msg.grid;
    if (msg.plantZones) plantZones = msg.plantZones;
    if (msg.agents) agentDefs = msg.agents;
    if (msg.weapons) weaponDefs = msg.weapons;
    startGame();
  }
  if (msg.type === 'roomCreated') {
    showScreen('waiting-screen');
    document.getElementById('waiting-code').textContent = msg.roomCode;
    myId = msg.playerId;
  }
  if (msg.type === 'state') {
    prevState = gameState || msg;
    gameState = msg;
    lastStateTime = Date.now();
    
    // Setup references for interpolation
    if (prevState && gameState && prevState.players && gameState.players) {
      gameState.players.forEach(p => {
        const oldP = prevState.players.find(old => old.id === p.id);
        if (oldP) {
          p.prevX = oldP.x;
          p.prevY = oldP.y;
        } else {
          p.prevX = p.x;
          p.prevY = p.y;
        }
      });
    }

    updateHUD();
  }
  if (msg.type === 'roundStart') {
    hideRoundEnd();
    showEvent(`ROUND ${msg.round} — BUY NOW!`);
    updateScores(msg.atkScore, msg.defScore);
  }
  if (msg.type === 'roundEnd') {
    showRoundEnd(msg.winner, msg.reason);
    updateScores(msg.atkScore, msg.defScore);
  }
  if (msg.type === 'matchOver') {
    showMatchOver(msg.winner, msg.atkScore, msg.defScore);
  }
  if (msg.type === 'kill') {
    pushKillfeed(msg.killerName, msg.victimName, msg.weapon);
  }
  if (msg.type === 'event') {
    showEvent(msg.msg);
  }
  if (msg.type === 'ability') {
    // Visual flash on ability use
  }
  if (msg.type === 'blind') {
    // future: apply blind visual
  }
  if (msg.type === 'phaseChange') {
    if (msg.phase === 'combat') showEvent('⚠ COMBAT PHASE — FIGHT!');
  }
  if (msg.type === 'skyStrikeWarning') {
    showEvent(`☄ SKY STRIKE INCOMING!`);
  }
  if (msg.type === 'error') {
    alert(msg.msg);
    showScreen('main-menu');
  }
}

// ─── Start Game ───────────────────────────────────────────────────────────────
function startGame() {
  showScreen('__none__'); // hide all screens
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const hud = document.getElementById('game-hud');
  hud.classList.remove('hidden');
  hud.style.opacity = settings.hudOpacity / 100;

  const canvas = document.getElementById('game-canvas');
  canvas.style.display = 'block';
  fitCanvas();
  buildMinimapCache();
  setupHUDForAgent();

  if (renderLoop) cancelAnimationFrame(renderLoop);
  let last = performance.now();
  function frame(now) {
    const dt = (now - last) / 1000;
    last = now;
    sendInput();
    render(dt);
    countFps(now);
    renderLoop = requestAnimationFrame(frame);
  }
  renderLoop = requestAnimationFrame(frame);
}

function fitCanvas() {
  const c = document.getElementById('game-canvas');
  c.width = window.innerWidth;
  c.height = window.innerHeight;
}

// ─── HUD setup ────────────────────────────────────────────────────────────────
function setupHUDForAgent() {
  const agent = selectedAgent;
  const slots = ['q', 'e', 'c', 'x'];
  const names = { Inferno: ['FIREWALL', 'BLAZING DASH', 'GRENADE', 'PHOENIX BLAST'], Specter: ['DARK SHROUD', 'SHADOW STEP', 'PHANTOM SIGHT', 'FROM THE RIFT'], Solace: ['HEAL ORB', 'BARRIER WALL', 'SLOW ORB', 'REVIVE'], Gust: ['TAILWIND', 'CLOUDBURST', 'UPDRAFT', 'STORM KNIVES'], Ember: ['TRACK DART', 'PULSE NADE', 'VISION DRONE', 'SKY STRIKE'] };
  const icons = { Inferno: ['🔥','⚡','💣','🌅'], Specter: ['🌑','🌀','😵','🌌'], Solace: ['💚','🛡','🌊','❤️'], Gust: ['💨','☁️','🏃','⚔️'], Ember: ['🎯','💥','🚁','☄️'] };
  const agIdx = AGENT_LIST.indexOf(agent);
  slots.forEach((sl, i) => {
    const nm = document.getElementById(`ab-name-${sl}`);
    if (nm) nm.textContent = names[agent][i];
    const ic = document.getElementById(`ab-icon-${sl}`);
    if (ic) ic.textContent = icons[agent][i];
  });
  const agIcon = document.getElementById('hud-agent-icon');
  if (agIcon) { agIcon.textContent = agent[0]; agIcon.style.color = AGENT_COLORS[agent]; agIcon.style.borderColor = AGENT_COLORS[agent]; }
}

// ─── HUD update ───────────────────────────────────────────────────────────────
function updateHUD() {
  if (!gameState) return;
  const me = gameState.players.find(p => p.id === myId);
  if (!me) return;

  document.getElementById('hud-hp-num').textContent = Math.max(0, Math.ceil(me.hp));
  document.getElementById('hud-hp-bar').style.width = `${Math.max(0, me.hp)}%`;
  document.getElementById('hud-hp-bar').style.background = me.hp > 50 ? '#ff4655' : me.hp > 25 ? '#ff9500' : '#ff0000';
  document.getElementById('hud-armor-num').textContent = Math.ceil(me.armor || 0);
  document.getElementById('hud-armor-bar').style.width = `${Math.min(100, (me.armor / 50) * 100)}%`;
  document.getElementById('hud-weapon-name').textContent = weaponDefs[me.weapon]?.name || me.weapon.toUpperCase();
  document.getElementById('hud-ammo-cur').textContent = me.ammo;
  document.getElementById('hud-ammo-max').textContent = weaponDefs[me.weapon]?.ammo || '?';
  document.getElementById('hud-credits').textContent = me.credits;
  document.getElementById('buy-credits-val').textContent = me.credits;

  document.getElementById('hud-atk-score').textContent = gameState.atkScore;
  document.getElementById('hud-def-score').textContent = gameState.defScore;
  document.getElementById('hud-timer').textContent = gameState.phaseTimer;
  document.getElementById('hud-round-label').textContent = `ROUND ${gameState.round}`;
  document.getElementById('hud-phase-label').textContent = gameState.phase === 'buy' ? 'BUY PHASE' : gameState.phase === 'combat' ? 'COMBAT' : 'ROUND END';

  // Spike bar
  const spikeBar = document.getElementById('hud-spike-bar');
  if (gameState.spike?.planted) {
    spikeBar.classList.add('visible');
    document.getElementById('spike-site-label').textContent = `SPIKE PLANTED · SITE ${gameState.spike.site}`;
    const pct = (gameState.spike.timer / 45) * 100;
    document.getElementById('spike-timer-bar').style.width = `${Math.max(0, pct)}%`;
  } else { spikeBar.classList.remove('visible'); }

  // Ability cooldowns
  const slots = ['q', 'e', 'c', 'x'];
  if (me.abilities) {
    slots.forEach(sl => {
      const cd = me.abilities[sl]?.cd || 0;
      const cdEl = document.getElementById(`ab-cd-${sl}`);
      const abEl = document.getElementById(`hud-ab-${sl}`);
      if (cd > 0) { cdEl.classList.remove('hidden'); cdEl.textContent = `${Math.ceil(cd)}s`; abEl?.classList.add('on-cd'); }
      else { cdEl.classList.add('hidden'); abEl?.classList.remove('on-cd'); }
    });
  }

  // Dead overlay
  const deadOverlay = document.getElementById('dead-overlay');
  if (!me.alive) deadOverlay.classList.remove('hidden');
  else deadOverlay.classList.add('hidden');

  // Buy panel visibility
  const buyPanel = document.getElementById('buy-panel');
  if (gameState.phase !== 'buy' && buyPanelOpen) { buyPanelOpen = false; buyPanel.classList.add('hidden'); }

  // Interact bar
  const sp = gameState.spike;
  const interactBar = document.getElementById('hud-interact-bar');
  if (sp?.planting) {
    interactBar.classList.remove('hidden');
    document.getElementById('interact-label').textContent = 'PLANTING SPIKE...';
    document.getElementById('interact-fill').style.width = `${(sp.plantProgress || 0) * 100}%`;
  } else if (sp?.defusing) {
    interactBar.classList.remove('hidden');
    document.getElementById('interact-label').textContent = 'DEFUSING SPIKE...';
    document.getElementById('interact-fill').style.width = `${(sp.defuseProgress || 0) * 100}%`;
  } else {
    interactBar.classList.add('hidden');
  }

  // Team list
  const tl = document.getElementById('hud-team-list');
  if (tl && gameState.players) {
    const allies = gameState.players.filter(p => p.team === myTeam);
    const enems = gameState.players.filter(p => p.team !== myTeam);
    tl.innerHTML = `<div class="tl-header atk-col">${myTeam === 'attackers' ? 'ATTACKERS' : 'DEFENDERS'}</div>` +
      allies.map(p => `<div class="tl-row ${p.alive ? '' : 'dead-row'}"><span class="tl-name${p.id === myId ? ' me' : ''}">${p.name}</span><span class="tl-hp">${p.alive ? Math.ceil(p.hp) : '✕'}</span></div>`).join('') +
      `<div class="tl-header def-col">${myTeam === 'attackers' ? 'DEFENDERS' : 'ATTACKERS'}</div>` +
      enems.map(p => `<div class="tl-row ${p.alive ? '' : 'dead-row'}"><span class="tl-name">${p.name}</span><span class="tl-hp">${p.alive ? Math.ceil(p.hp) : '✕'}</span></div>`).join('');
  }

  // Scoreboard
  updateScoreboard();
}

function updateScores(atk, def) {
  document.getElementById('hud-atk-score').textContent = atk;
  document.getElementById('hud-def-score').textContent = def;
  document.getElementById('sb-atk').textContent = atk;
  document.getElementById('sb-def').textContent = def;
}

function updateScoreboard() {
  if (!gameState) return;
  const atkRows = document.getElementById('sb-atk-rows');
  const defRows = document.getElementById('sb-def-rows');
  const atk = gameState.players.filter(p => p.team === 'attackers');
  const def = gameState.players.filter(p => p.team === 'defenders');
  const row = p => `<div class="sb-row ${p.alive ? '' : 'dead'}${p.id === myId ? ' me' : ''}"><span class="sb-name">${p.name}${p.id === myId ? ' (YOU)' : ''}</span><span>${p.agent}</span><span class="sb-k">${p.kills}</span><span class="sb-d">${p.deaths}</span></div>`;
  if (atkRows) atkRows.innerHTML = atk.map(row).join('');
  if (defRows) defRows.innerHTML = def.map(row).join('');
}

// ─── Kill feed ─────────────────────────────────────────────────────────────────
function pushKillfeed(killer, victim, weapon) {
  const kf = document.getElementById('hud-killfeed');
  if (!kf) return;
  const el = document.createElement('div');
  el.className = 'kf-row';
  el.innerHTML = `<span class="kf-killer">${killer || '???'}</span><span class="kf-sep">✦</span><span class="kf-victim">${victim}</span><span class="kf-weapon">${weapon || ''}</span>`;
  kf.prepend(el);
  setTimeout(() => el.remove(), 5000);
  while (kf.children.length > 5) kf.lastChild.remove();
}

let eventTimer = null;
function showEvent(msg) {
  const el = document.getElementById('hud-event');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(eventTimer);
  eventTimer = setTimeout(() => el.classList.remove('visible'), 2500);
}

function showRoundEnd(winner, reason) {
  const overlay = document.getElementById('round-end-overlay');
  overlay.classList.remove('hidden');
  document.getElementById('re-winner').textContent = `${winner.toUpperCase()} WIN!`;
  document.getElementById('re-reason').textContent = reason;
  document.getElementById('re-winner').className = 're-winner' + (winner === myTeam ? ' win-col' : ' lose-col');
  setTimeout(() => overlay.classList.add('hidden'), 4500);
}
function hideRoundEnd() { document.getElementById('round-end-overlay')?.classList.add('hidden'); }

function showMatchOver(winner, atkScore, defScore) {
  const overlay = document.getElementById('match-over-overlay');
  overlay.classList.remove('hidden');
  const didWin = winner === myTeam;
  document.getElementById('mo-title').textContent = didWin ? 'VICTORY!' : 'DEFEAT';
  document.getElementById('mo-title').style.color = didWin ? '#ff4655' : '#888';
  document.getElementById('mo-score').textContent = `${atkScore} : ${defScore}`;
  cancelAnimationFrame(renderLoop);
}

window.quitToMenu = function () {
  if (ws) { try { ws.close(); } catch (e) {} ws = null; }
  gameState = null; myId = null;
  cancelAnimationFrame(renderLoop);
  document.getElementById('game-hud').classList.add('hidden');
  document.getElementById('game-canvas').style.display = 'none';
  document.getElementById('esc-menu').classList.add('hidden');
  showScreen('main-menu');
};

window.closeEscMenu = function () { document.getElementById('esc-menu').classList.add('hidden'); escOpen = false; };
window.toggleBuyPanel = function () {
  const bp = document.getElementById('buy-panel');
  buyPanelOpen = !buyPanelOpen;
  bp.classList.toggle('hidden', !buyPanelOpen);
};

// ─── Map rendering ─────────────────────────────────────────────────────────────
let minimapCache = null;

function buildMinimapCache() {
  if (!mapData) return;
  const { cols, rows, cell, grid } = mapData;
  const mmW = 180, mmH = Math.round(180 * (rows / cols));
  const offscreen = document.createElement('canvas');
  offscreen.width = mmW; offscreen.height = mmH;
  const ctx = offscreen.getContext('2d');
  const cw = mmW / cols, ch = mmH / rows;
  grid.forEach((row, r) => row.forEach((v, c) => {
    ctx.fillStyle = v ? '#1a1a2e' : '#2a3a4a';
    ctx.fillRect(c * cw, r * ch, cw + 0.5, ch + 0.5);
  }));
  // Draw sites
  plantZones.forEach(z => {
    const mx = (z.x / (cols * cell)) * mmW;
    const my = (z.y / (rows * cell)) * mmH;
    const mw = (z.w / (cols * cell)) * mmW;
    const mh = (z.h / (rows * cell)) * mmH;
    ctx.fillStyle = 'rgba(255, 70, 85, 0.25)';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#ff4655';
    ctx.font = `bold ${Math.max(8, cw * 2)}px Rajdhani`;
    ctx.fillText(z.site, mx + mw / 2 - 4, my + mh / 2 + 4);
  });
  minimapCache = offscreen;
}

function drawMap(ctx, canvas) {
  if (!mapData) {
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#333';
    ctx.font = '24px Rajdhani';
    ctx.fillText('Connecting to server...', canvas.width / 2 - 120, canvas.height / 2);
    return;
  }
  const { cols, rows, cell, grid } = mapData;

  // Floor background
  ctx.fillStyle = '#0a1520';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const ox = cameraX, oy = cameraY;

  // Draw tiles (only visible region)
  const startC = Math.max(0, Math.floor(ox / cell));
  const endC   = Math.min(cols - 1, Math.ceil((ox + canvas.width) / cell));
  const startR = Math.max(0, Math.floor(oy / cell));
  const endR   = Math.min(rows - 1, Math.ceil((oy + canvas.height) / cell));

  for (let r = startR; r <= endR; r++) {
    for (let c = startC; c <= endC; c++) {
      const x = c * cell - ox;
      const y = r * cell - oy;
      if (grid[r][c]) {
        // Wall block
        ctx.fillStyle = '#1a2535';
        ctx.fillRect(x, y, cell + 0.5, cell + 0.5);
        // Top edge highlight
        ctx.fillStyle = '#2a3a50';
        ctx.fillRect(x, y, cell, 4);
        // Bottom shadow
        ctx.fillStyle = '#0f1820';
        ctx.fillRect(x, y + cell - 3, cell, 3);
      } else {
        // Floor tile (subtle checkerboard)
        ctx.fillStyle = (r + c) % 2 === 0 ? '#131e2b' : '#111b28';
        ctx.fillRect(x, y, cell + 0.5, cell + 0.5);
      }
    }
  }

  // Plant zones
  plantZones.forEach(z => {
    ctx.fillStyle = 'rgba(255,70,85,0.07)';
    ctx.fillRect(z.x - ox, z.y - oy, z.w, z.h);
    ctx.strokeStyle = 'rgba(255,70,85,0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(z.x - ox + 1, z.y - oy + 1, z.w - 2, z.h - 2);
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff4655cc';
    ctx.font = 'bold 30px Rajdhani';
    ctx.textAlign = 'center';
    ctx.fillText(z.site, z.x - ox + z.w / 2, z.y - oy + z.h / 2 + 10);
    ctx.textAlign = 'left';
  });
}

// ─── Entity rendering ────────────────────────────────────────────────────────
// ─── Entity rendering ────────────────────────────────────────────────────────
function drawEntities(ctx, canvas) {
  if (!gameState) return;
  const ox = cameraX, oy = cameraY;
  const me = gameState.players?.find(p => p.id === myId);

  // Effects (smokes, fires)
  gameState.effects?.forEach(ef => {
    const ex = ef.x - ox, ey = ef.y - oy;
    if (ef.type === 'smoke') {
      const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, ef.radius);
      g.addColorStop(0, 'rgba(180,180,200,0.65)');
      g.addColorStop(0.5, 'rgba(160,160,190,0.4)');
      g.addColorStop(1, 'rgba(140,140,170,0.05)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(ex, ey, ef.radius, 0, Math.PI * 2); ctx.fill();
    } else if (ef.type === 'fire') {
      const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, ef.radius);
      g.addColorStop(0, 'rgba(255,200,50,0.8)');
      g.addColorStop(1, 'rgba(255,30,0,0.05)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(ex, ey, ef.radius, 0, Math.PI * 2); ctx.fill();
    }
  });

  // Bullets
  gameState.bullets?.forEach(b => {
    const bx = b.x - ox, by = b.y - oy;
    ctx.save();
    ctx.shadowColor = b.team === myTeam ? '#ffdd44' : '#ff6644';
    ctx.shadowBlur = 8;
    ctx.fillStyle = b.team === myTeam ? '#ffee88' : '#ff8866';
    ctx.beginPath(); ctx.arc(bx, by, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  // Players & bots
  if (!gameState.players) return;
  const t = Date.now();
  gameState.players.forEach(p => {
    const isSelf = p.id === myId;
    const isAlly = p.team === myTeam;
    // Interpolate positions for smooth 60fps movement between 30hz server ticks
    const lerp = Math.min(1, (Date.now() - lastStateTime) / (1000/30));
    const px = (p.prevX !== undefined ? p.prevX + (p.x - p.prevX) * lerp : p.x) - ox;
    const py = (p.prevY !== undefined ? p.prevY + (p.y - p.prevY) * lerp : p.y) - oy;
    const angle = isSelf ? mouseAngle : p.angle;

    if (!p.alive) {
      // Dead marker
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = isAlly ? '#44ff88' : '#ff4655';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px - 8, py - 8); ctx.lineTo(px + 8, py + 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px + 8, py - 8); ctx.lineTo(px - 8, py + 8); ctx.stroke();
      ctx.restore();
      return;
    }
    drawPlayer(ctx, px, py, angle, p, isSelf, isAlly, t);
  });
}

function drawPlayer(ctx, px, py, angle, p, isSelf, isAlly, t) {
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angle);

  const isEnemy = !isAlly && !isSelf;
  const teamGlow = isSelf ? '#0cf' : (isAlly ? '#0f8' : '#f45');
  const agent = p.agent;

  // Selection glow / team aura
  ctx.shadowColor = teamGlow;
  ctx.shadowBlur = isSelf ? 16 : 8;
  
  // Outer outline
  ctx.strokeStyle = teamGlow;
  ctx.lineWidth = 1.5;

  // Base drawing variables
  let skinCol = '#f1c27d', hairCol = '#fff', coatCol1 = '#222', coatCol2 = '#444';
  
  // Setup traits
  if (agent === 'Inferno') { skinCol='#8d5524'; hairCol='#ff6b35'; coatCol1='#fff'; coatCol2='#b33939'; }
  if (agent === 'Specter') { skinCol='#2b2b36'; hairCol='#1a1a24'; coatCol1='#2c3e50'; coatCol2='#8e44ad'; }
  if (agent === 'Solace')  { skinCol='#ffdbac'; hairCol='#111'; coatCol1='#27ae60'; coatCol2='#ecf0f1'; }
  if (agent === 'Gust')    { skinCol='#fae7d6'; hairCol='#ecf0f1'; coatCol1='#3498db'; coatCol2='#bdc3c7'; }
  if (agent === 'Ember')   { skinCol='#ffe0bd'; hairCol='#f1c40f'; coatCol1='#34495e'; coatCol2='#c0392b'; }

  // Draw shoulders / base body
  ctx.fillStyle = isEnemy ? '#3a0010' : coatCol1;
  ctx.beginPath();
  ctx.moveTo(-9, -13); 
  ctx.quadraticCurveTo(-15, 0, -9, 13);
  ctx.lineTo(6, 15);
  ctx.lineTo(12, 7);
  ctx.lineTo(12, -7);
  ctx.lineTo(6, -15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Agent unique shoulder / cape details
  if (agent === 'Specter') {
    ctx.fillStyle = coatCol2;
    ctx.beginPath(); ctx.moveTo(-11,-8); ctx.lineTo(-19,-12); ctx.lineTo(-14,0); ctx.lineTo(-19,12); ctx.lineTo(-11,8); ctx.fill();
  } else if (agent === 'Inferno') {
    ctx.fillStyle = coatCol2;
    ctx.fillRect(-5, -11, 8, 22);
  } else if (agent === 'Solace') {
    ctx.fillStyle = hairCol;
    ctx.beginPath(); ctx.arc(-13, 0, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-15, -2); ctx.lineTo(-24, 0); ctx.lineTo(-15, 2); ctx.fill();
  } else if (agent === 'Ember') {
    ctx.fillStyle = coatCol2;
    ctx.fillRect(-11, -12, 9, 24);
  }

  // Disable glow for inner features to keep it crisp
  ctx.shadowBlur = 0;

  // Hands
  ctx.fillStyle = skinCol;
  ctx.beginPath(); ctx.arc(14, 6, 3.5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(16, -4, 3.5, 0, Math.PI*2); ctx.fill();

  // Weapon
  const w = p.weapon || 'classic';
  ctx.fillStyle = '#222';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  if (w === 'classic' || w === 'sheriff') {
    ctx.fillRect(16, -2, 11, 4);
    ctx.strokeRect(16, -2, 11, 4);
  } else if (w === 'operator') {
    ctx.fillRect(10, -3.5, 30, 7);
    ctx.strokeRect(10, -3.5, 30, 7);
    ctx.fillStyle = '#444'; ctx.fillRect(18, -4.5, 14, 2); // Scope
  } else {
    // specter, phantom, vandal
    ctx.fillRect(12, -3, 22, 6);
    ctx.strokeRect(12, -3, 22, 6);
    ctx.fillStyle = '#444'; ctx.fillRect(18, -4, 8, 2); // Sight
  }

  // Head
  ctx.fillStyle = skinCol;
  ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, Math.PI*2); ctx.fill();
  ctx.stroke();

  // Hair / Helmets
  ctx.fillStyle = hairCol;
  if (agent === 'Specter') {
    ctx.beginPath(); ctx.arc(0, 0, 8, Math.PI*0.5, Math.PI*1.5, true); ctx.fill();
    ctx.fillStyle = '#0ff'; ctx.fillRect(2, -3, 3, 6); // glowing visor
  } else if (agent === 'Gust') {
    ctx.beginPath(); ctx.arc(-1, 0, 7.5, Math.PI*0.5, Math.PI*1.5); ctx.moveTo(-1,-7.5); ctx.lineTo(5,0); ctx.lineTo(-1,7.5); ctx.fill();
  } else if (agent === 'Inferno') {
    ctx.beginPath(); ctx.arc(-2, 0, 6.5, Math.PI*0.5, Math.PI*1.5); ctx.fill();
  } else if (agent === 'Solace') {
    ctx.beginPath(); ctx.arc(0, 0, 7.7, Math.PI*0.5, Math.PI*1.5); ctx.fill();
  } else if (agent === 'Ember') {
    ctx.beginPath(); ctx.arc(-1, 0, 7, Math.PI*0.5, Math.PI*1.5); ctx.fill();
    ctx.fillStyle = '#0cf'; ctx.beginPath(); ctx.arc(3, -3.5, 2, 0, Math.PI*2); ctx.fill(); // Bionic eye
  }

  ctx.restore();

  // HP Bar
  const barW = 32, barH = 4;
  const barX = px - barW / 2, barY = py - 22;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
  ctx.fillStyle = p.hp > 60 ? '#44ff88' : '#ff4444';
  ctx.fillRect(barX, barY, (p.hp / 100) * barW, barH);
  
  // Name Tag
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Rajdhani'; ctx.textAlign = 'center';
  ctx.fillText(p.name, px, barY - 4);
}

function drawCrosshair(ctx, canvas) {
  const mx = mouseScreen.x, my = mouseScreen.y;
  const col = settings.crosshairColor;
  ctx.save();
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.5;
  const s = 9, g = 4;
  ctx.beginPath();
  ctx.moveTo(mx - s - g, my); ctx.lineTo(mx - g, my);
  ctx.moveTo(mx + g, my);     ctx.lineTo(mx + s + g, my);
  ctx.moveTo(mx, my - s - g); ctx.lineTo(mx, my - g);
  ctx.moveTo(mx, my + g);     ctx.lineTo(mx, my + s + g);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(mx, my, 1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}


// ─── Minimap ──────────────────────────────────────────────────────────────────
function drawMinimap() {
  if (!minimapVisible || !minimapCache || !mapData) return;
  const mc = document.getElementById('minimap-canvas');
  if (!mc) return;
  const { cols, rows, cell } = mapData;
  const mmW = 180, mmH = Math.round(180 * (rows / cols));
  mc.width = mmW; mc.height = mmH;
  const ctx = mc.getContext('2d');

  ctx.drawImage(minimapCache, 0, 0);

  if (!gameState?.players) return;
  const scaleX = mmW / (cols * cell);
  const scaleY = mmH / (rows * cell);

  gameState.players.forEach(p => {
    if (!p.alive) return;
    const mx = p.x * scaleX, my = p.y * scaleY;
    const isAlly = p.team === myTeam;
    const isSelf = p.id === myId;
    ctx.fillStyle = isSelf ? '#00ccff' : (isAlly ? AGENT_COLORS[p.agent] || '#00cc88' : '#ff4655');
    if (!isAlly && !gameState.trackingActive) {
      // Don't show enemies on minimap unless tracking
      return;
    }
    ctx.beginPath();
    ctx.arc(mx, my, isSelf ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
    // Direction tick
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + Math.cos(p.angle) * 5, my + Math.sin(p.angle) * 5);
    ctx.stroke();
  });

  // Spike on minimap
  if (gameState.spike?.planted) {
    const sx = gameState.spike.x * scaleX, sy = gameState.spike.y * scaleY;
    const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 200);
    ctx.fillStyle = '#ff4655';
    ctx.globalAlpha = pulse;
    ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ─── Camera ───────────────────────────────────────────────────────────────────
function updateCamera(canvas) {
  if (!gameState) return;
  const me = gameState.players?.find(p => p.id === myId);
  if (!me) return;
  const targetX = me.x - canvas.width / 2;
  const targetY = me.y - canvas.height / 2;
  cameraX += (targetX - cameraX) * 0.12;
  cameraY += (targetY - cameraY) * 0.12;
  if (mapData) {
    cameraX = Math.max(0, Math.min(mapData.worldW - canvas.width, cameraX));
    cameraY = Math.max(0, Math.min(mapData.worldH - canvas.height, cameraY));
  }
}

// ─── Main render loop ─────────────────────────────────────────────────────────
function render(dt) {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  updateCamera(canvas);
  drawMap(ctx, canvas);
  drawEntities(ctx, canvas);
  drawCrosshair(ctx, canvas);
  drawMinimap();
}

// ─── FPS counter ──────────────────────────────────────────────────────────────
let fpsFrames = 0, fpsLast = performance.now();
function countFps(now) {
  fpsFrames++;
  if (now - fpsLast >= 1000) {
    const fps = Math.round((fpsFrames * 1000) / (now - fpsLast));
    document.getElementById('hud-fps').textContent = `${fps} FPS`;
    fpsFrames = 0; fpsLast = now;
  }
}

// ─── Settings ─────────────────────────────────────────────────────────────────
window.setSetting = function (key, el) {
  if (key === 'crosshairColor') { settings.crosshairColor = el.dataset.color; document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active')); el.classList.add('active'); }
  if (key === 'crosshairStyle') { settings.crosshairStyle = el.dataset.val; document.querySelectorAll('#ch-style-btns .sett-btn').forEach(b => b.classList.remove('active')); el.classList.add('active'); }
  if (key === 'hudOpacity') { settings.hudOpacity = Number(el.value); document.getElementById('hud-opacity-val').textContent = `${el.value}%`; document.getElementById('game-hud').style.opacity = el.value / 100; }
  if (key === 'showFps') { settings.showFps = el.checked; document.getElementById('hud-fps').classList.toggle('hidden', !el.checked); }
};

// ─── Input events ─────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'w') keys.w = true;
  if (k === 'a') keys.a = true;
  if (k === 's') keys.s = true;
  if (k === 'd') keys.d = true;
  if (k === 'f') { interacting = true; }
  if (k === 'r' && ws) ws.send(JSON.stringify({ type: 'reload' }));
  if (k === 'b') window.toggleBuyPanel();
  if (k === 'm') { minimapVisible = !minimapVisible; document.getElementById('minimap-wrap').classList.toggle('hidden', !minimapVisible); }
  if (k === 'tab') { e.preventDefault(); document.getElementById('scoreboard-overlay').classList.remove('hidden'); }
  if (k === 'escape') {
    if (escOpen) { closeEscMenu(); }
    else { document.getElementById('esc-menu').classList.remove('hidden'); escOpen = true; }
  }

  // Abilities
  if (!gameState || gameState.phase !== 'combat') return;
  const me = gameState.players?.find(p => p.id === myId);
  if (!me || !me.alive) return;
  if (['q', 'e', 'c', 'x'].includes(k)) {
    abilityPending = k;
    document.getElementById('ability-cursor').classList.remove('hidden');
    useAbility(k, mouseWorld.x, mouseWorld.y);
    abilityPending = null;
    document.getElementById('ability-cursor').classList.add('hidden');
  }
});

document.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k === 'w') keys.w = false;
  if (k === 'a') keys.a = false;
  if (k === 's') keys.s = false;
  if (k === 'd') keys.d = false;
  if (k === 'f') interacting = false;
  if (k === 'tab') { document.getElementById('scoreboard-overlay').classList.add('hidden'); }
});

document.addEventListener('mousemove', e => {
  // Always track screen position for crosshair
  mouseScreen.x = e.clientX;
  mouseScreen.y = e.clientY;

  const canvas = document.getElementById('game-canvas');
  if (!canvas || canvas.style.display === 'none') return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  // Angle from screen center (player's rendered position) to mouse
  mouseAngle = Math.atan2(my - canvas.height / 2, mx - canvas.width / 2);
  mouseWorld.x = mx + cameraX;
  mouseWorld.y = my + cameraY;

  const cur = document.getElementById('ability-cursor');
  if (cur && !cur.classList.contains('hidden')) {
    cur.style.left = `${e.clientX - 12}px`;
    cur.style.top = `${e.clientY - 12}px`;
  }
});document.addEventListener('mousedown', e => {
  if (e.button === 0) {
    const canvas = document.getElementById('game-canvas');
    if (document.getElementById('game-hud').classList.contains('hidden')) return;
    if (e.target !== canvas && !e.target.closest('#game-canvas')) {
      // Click on HUD, not game
      if (e.target.closest('#buy-panel') || e.target.closest('.esc-menu') || e.target.closest('#scoreboard-overlay')) return;
    }
    shooting = true;
  }
});

document.addEventListener('mouseup', e => { if (e.button === 0) shooting = false; });
window.addEventListener('resize', () => { fitCanvas(); buildMinimapCache(); });

// ─── Loading & Boot sequence ──────────────────────────────────────────────────
(function boot() {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) loadingScreen.classList.remove('active');
  
  showScreen('main-menu');
  startMenuParticles();
  updateAgentInfo('Inferno');

  // Agent select auto-timer starts when that screen becomes active
  const agentScreen = document.getElementById('agent-select');
  if (agentScreen) {
    const obs = new MutationObserver(() => {
      if (agentScreen.classList.contains('active')) startAutoSelect();
      else clearInterval(autoSelectTimer);
    });
    obs.observe(agentScreen, { attributes: true, attributeFilter: ['class'] });
  }
})();

// ─── Menu particles ───────────────────────────────────────────────────────────
function startMenuParticles() {
  const container = document.getElementById('menu-particles');
  if (!container) return;
  function spawn() {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = `${Math.random() * 100}%`;
    p.style.animationDuration = `${4 + Math.random() * 6}s`;
    p.style.animationDelay = `${Math.random() * 2}s`;
    p.style.opacity = `${0.2 + Math.random() * 0.5}`;
    p.style.width = p.style.height = `${2 + Math.random() * 3}px`;
    container.appendChild(p);
    setTimeout(() => p.remove(), 8000);
  }
  setInterval(spawn, 300);
}
