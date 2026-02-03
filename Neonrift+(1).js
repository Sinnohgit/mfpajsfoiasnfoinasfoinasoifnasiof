/* Neon Rift (Cyberpunk Split-Screen Shooter) - FULL JS
   Requirements:
   - Defines global create() function for external launcher compatibility.
   - Pure JS: builds DOM, menu, canvas, UI, and game loop.
   - Pixel-rendered split-screen top-down shooter with procedural levels + local leaderboard.

   Suggested hosting:
   - Ensure Content-Type is application/javascript
   - Avoid 301 redirects for this file
*/

(function () {
  "use strict";

  // ---------- Utilities ----------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randi(a, b) { return (a + Math.random() * (b - a + 1)) | 0; }
  function chance(p) { return Math.random() < p; }
  function dist2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
  function len(x, y) { return Math.sqrt(x * x + y * y); }
  function norm(x, y) {
    var l = Math.sqrt(x * x + y * y) || 1;
    return { x: x / l, y: y / l, l: l };
  }
  function now() { return (typeof performance !== "undefined" ? performance.now() : Date.now()); }
  function hasFocus() { try { return document.hasFocus && document.hasFocus(); } catch (e) { return true; } }

  // ---------- Persistent Storage ----------
  var SCORE_KEY = "neonrift_scores_v2";
  function loadScores() {
    try {
      var raw = localStorage.getItem(SCORE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      return arr.filter(function (x) { return x && typeof x.n === "string" && typeof x.s === "number"; })
                .sort(function (a, b) { return b.s - a.s; })
                .slice(0, 10);
    } catch (e) { return []; }
  }
  function saveScore(name, score) {
    name = (name || "ANON").toString().trim().slice(0, 12).toUpperCase() || "ANON";
    var arr = loadScores();
    arr.push({ n: name, s: score | 0, t: Date.now() });
    arr.sort(function (a, b) { return b.s - a.s; });
    arr = arr.slice(0, 10);
    try { localStorage.setItem(SCORE_KEY, JSON.stringify(arr)); } catch (e) {}
    return arr;
  }

  // ---------- Global state / singleton cleanup ----------
  var __NR = window.__NEONRIFT__;
  if (__NR && __NR.destroy) {
    try { __NR.destroy(); } catch (e) {}
  }
  __NR = window.__NEONRIFT__ = { destroy: null };

  // ---------- Theme ----------
  var THEME = {
    bg: "#050008",
    panel: "rgba(255,255,255,0.06)",
    panel2: "rgba(255,255,255,0.09)",
    text: "#ffffff",
    dim: "rgba(255,255,255,0.75)",
    neonA: "#7c5cff",
    neonB: "#00fff0",
    neonC: "#ff3bd4",
    warn: "#ffcc00",
    bad: "#ff3355",
    good: "#62ff76",
  };

  // ---------- DOM helpers ----------
  function el(tag, props, parent) {
    var e = document.createElement(tag);
    if (props) {
      for (var k in props) {
        if (k === "style") {
          for (var s in props.style) e.style[s] = props.style[s];
        } else if (k === "text") {
          e.textContent = props.text;
        } else if (k === "html") {
          e.innerHTML = props.html;
        } else if (k in e) {
          e[k] = props[k];
        } else {
          e.setAttribute(k, props[k]);
        }
      }
    }
    if (parent) parent.appendChild(e);
    return e;
  }

  function cssText() {
    return (
      "html,body{height:100%;margin:0;background:" + THEME.bg + ";color:" + THEME.text + ";}" +
      "body{font:14px system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;overflow:hidden;}" +
      ".nr-wrap{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:" + THEME.bg + ";}" +
      ".nr-shell{width:min(1100px,92vw);border-radius:18px;padding:18px;" +
        "background:linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02));" +
        "box-shadow:0 30px 90px rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.09);" +
      "}" +
      ".nr-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;}" +
      ".nr-title{font-size:18px;font-weight:800;letter-spacing:0.6px;}" +
      ".nr-sub{opacity:.75;font-size:12px;}" +
      ".nr-row{display:flex;gap:12px;flex-wrap:wrap;}" +
      ".nr-btn{appearance:none;border:0;border-radius:12px;padding:10px 14px;font-weight:800;cursor:pointer;" +
        "color:#fff;background:" + THEME.neonA + ";box-shadow:0 10px 30px rgba(124,92,255,0.25);" +
      "}" +
      ".nr-btn.secondary{background:rgba(255,255,255,0.12);font-weight:700;}" +
      ".nr-btn.ghost{background:transparent;border:1px solid rgba(255,255,255,0.15);font-weight:700;}" +
      ".nr-btn:active{transform:translateY(1px)}" +
      ".nr-card{flex:1;min-width:260px;border-radius:16px;padding:14px;" +
        "background:rgba(0,0,0,0.22);border:1px solid rgba(255,255,255,0.08);" +
      "}" +
      ".nr-card h3{margin:0 0 10px 0;font-size:13px;letter-spacing:.5px;text-transform:uppercase;opacity:.85;}" +
      ".nr-kv{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);}" +
      ".nr-kv:last-child{border-bottom:0}" +
      ".nr-small{font-size:12px;opacity:.8;line-height:1.35}" +
      ".nr-hr{height:1px;background:rgba(255,255,255,0.08);margin:12px 0}" +
      ".nr-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;opacity:.8;font-size:12px}" +
      ".nr-water{opacity:.4}" +
      ".nr-game{position:fixed;inset:0;display:none;background:" + THEME.bg + ";}" +
      "canvas{display:block;width:100%;height:100%;image-rendering:pixelated;image-rendering:crisp-edges;}" +
      ".nr-overlay{position:fixed;inset:0;pointer-events:none;}" +
      ".nr-hud{position:fixed;left:0;right:0;top:0;display:flex;justify-content:space-between;gap:10px;padding:10px;" +
        "font:12px ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;pointer-events:none;" +
      "}" +
      ".nr-hud .box{pointer-events:none;padding:10px 12px;border-radius:14px;background:rgba(0,0,0,0.25);" +
        "border:1px solid rgba(255,255,255,0.08);backdrop-filter:blur(8px);}" +
      ".nr-center{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);" +
        "background:rgba(0,0,0,0.45);border:1px solid rgba(255,255,255,0.10);" +
        "border-radius:18px;padding:16px 18px;min-width:min(520px,90vw);" +
        "backdrop-filter:blur(10px);display:none;" +
      "}" +
      ".nr-center h2{margin:0 0 8px 0;font-size:16px;letter-spacing:.4px;}" +
      ".nr-center p{margin:6px 0;opacity:.85;font-size:12px;line-height:1.35}" +
      ".nr-center .nr-row{pointer-events:auto;margin-top:10px}" +
      ".nr-input{pointer-events:auto;width:100%;padding:10px 12px;border-radius:12px;" +
        "border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);" +
        "color:#fff;outline:none;" +
      "}" +
      ".nr-pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;" +
        "border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.05);opacity:.85}" +
      ".nr-tip{opacity:.7;font-size:11px}"
    );
  }

  // ---------- Game Constants ----------
  var TILE = 16;                // world tile size (in world units)
  var WORLD_W = 140, WORLD_H = 90; // tiles (procedural)
  var VIEW_H = 180;             // low-res screen height
  var VIEW_W = 320;             // low-res screen width (split into 160 + 160)
  var HALF_W = (VIEW_W / 2) | 0;
  var DT_MAX = 0.033;           // cap dt for stability

  // ---------- Procedural Level Generation ----------
  function makeGrid(w, h, fill) {
    var a = new Array(w * h);
    for (var i = 0; i < a.length; i++) a[i] = fill;
    return a;
  }
  function idx(x, y, w) { return x + y * w; }

  // Tile types:
  // 0 wall
  // 1 floor
  // 2 door
  // 3 neon decal floor (cosmetic)
  // 4 hazard (slow/acid)
  function genLevel(seed) {
    // Seedless generation (Math.random) — seed param left for future extension.
    var w = WORLD_W, h = WORLD_H;
    var g = makeGrid(w, h, 0);

    function carveRoom(rx, ry, rw, rh) {
      for (var y = ry; y < ry + rh; y++) {
        for (var x = rx; x < rx + rw; x++) {
          if (x > 1 && y > 1 && x < w - 2 && y < h - 2) g[idx(x, y, w)] = 1;
        }
      }
    }

    // Rooms list
    var rooms = [];
    var tries = 120;
    for (var t = 0; t < tries; t++) {
      var rw = randi(7, 18), rh = randi(6, 16);
      var rx = randi(2, w - rw - 3), ry = randi(2, h - rh - 3);
      var ok = true;
      for (var i = 0; i < rooms.length; i++) {
        var r = rooms[i];
        if (rx < r.x + r.w + 2 && rx + rw + 2 > r.x && ry < r.y + r.h + 2 && ry + rh + 2 > r.y) {
          ok = false; break;
        }
      }
      if (!ok) continue;
      rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: (rx + (rw / 2)) | 0, cy: (ry + (rh / 2)) | 0 });
      carveRoom(rx, ry, rw, rh);
    }

    // Corridors between rooms (MST-ish by connecting in order of nearest)
    function carveCorridor(x1, y1, x2, y2) {
      var x = x1, y = y1;
      var flip = chance(0.5);
      function stepX() {
        while (x !== x2) {
          g[idx(x, y, w)] = 1;
          x += x < x2 ? 1 : -1;
        }
      }
      function stepY() {
        while (y !== y2) {
          g[idx(x, y, w)] = 1;
          y += y < y2 ? 1 : -1;
        }
      }
      if (flip) { stepX(); stepY(); } else { stepY(); stepX(); }
      g[idx(x2, y2, w)] = 1;
    }

    // Connect rooms
    for (var rI = 1; rI < rooms.length; rI++) {
      var a = rooms[rI];
      var best = 0, bestD = 1e9;
      for (var j = 0; j < rI; j++) {
        var b = rooms[j];
        var d = dist2(a.cx, a.cy, b.cx, b.cy);
        if (d < bestD) { bestD = d; best = j; }
      }
      var b2 = rooms[best];
      carveCorridor(a.cx, a.cy, b2.cx, b2.cy);
    }

    // Add doors where corridor meets room boundaries (simple heuristic)
    for (var y2 = 2; y2 < h - 2; y2++) {
      for (var x2 = 2; x2 < w - 2; x2++) {
        var id = idx(x2, y2, w);
        if (g[id] !== 0) continue;
        // if it's a wall with floors on two opposite sides, sometimes make door
        var fL = g[idx(x2 - 1, y2, w)] === 1;
        var fR = g[idx(x2 + 1, y2, w)] === 1;
        var fU = g[idx(x2, y2 - 1, w)] === 1;
        var fD = g[idx(x2, y2 + 1, w)] === 1;
        if ((fL && fR && !fU && !fD) || (fU && fD && !fL && !fR)) {
          if (chance(0.10)) g[id] = 2;
        }
      }
    }

    // Cosmetic neon decals + hazards
    for (var y3 = 2; y3 < h - 2; y3++) {
      for (var x3 = 2; x3 < w - 2; x3++) {
        var id2 = idx(x3, y3, w);
        if (g[id2] === 1 && chance(0.02)) g[id2] = 3;
        if (g[id2] === 1 && chance(0.007)) g[id2] = 4; // hazard puddle
      }
    }

    // Pick spawn room and exit room far apart
    var start = rooms[0] || { cx: 5, cy: 5 };
    var far = start, farD = -1;
    for (var k = 0; k < rooms.length; k++) {
      var rr = rooms[k];
      var d2 = dist2(start.cx, start.cy, rr.cx, rr.cy);
      if (d2 > farD) { farD = d2; far = rr; }
    }

    return {
      w: w, h: h, g: g,
      rooms: rooms,
      spawn: { x: start.cx * TILE + TILE * 0.5, y: start.cy * TILE + TILE * 0.5 },
      exit:  { x: far.cx * TILE + TILE * 0.5,   y: far.cy * TILE + TILE * 0.5 }
    };
  }

  function isWalkable(level, wx, wy) {
    var tx = (wx / TILE) | 0;
    var ty = (wy / TILE) | 0;
    if (tx < 0 || ty < 0 || tx >= level.w || ty >= level.h) return false;
    var t = level.g[idx(tx, ty, level.w)];
    return t !== 0;
  }

  function tileAt(level, wx, wy) {
    var tx = (wx / TILE) | 0;
    var ty = (wy / TILE) | 0;
    if (tx < 0 || ty < 0 || tx >= level.w || ty >= level.h) return 0;
    return level.g[idx(tx, ty, level.w)];
  }

  function collideCircle(level, x, y, r) {
    // Basic tile collision by sampling points around the circle
    var samples = 8;
    for (var i = 0; i < samples; i++) {
      var a = (i / samples) * Math.PI * 2;
      var px = x + Math.cos(a) * r;
      var py = y + Math.sin(a) * r;
      if (!isWalkable(level, px, py)) return true;
    }
    return false;
  }

  // ---------- Entities ----------
  function makePlayer(id, x, y) {
    return {
      id: id,
      x: x, y: y, vx: 0, vy: 0,
      r: 6.2,
      hp: 100, hpMax: 100,
      shield: 40, shieldMax: 40,
      shieldRegenT: 0,
      dashCD: 0,
      dashT: 0,
      invT: 0,
      weapon: "pistol",
      ammo: 999,
      clip: 12,
      clipMax: 12,
      reloadT: 0,
      fireCD: 0,
      score: 0,
      shards: 0,
      kills: 0,
      crit: 0.08,
      dmgMul: 1.0,
      speedMul: 1.0,
      recoil: 0,
      aimX: x + 10, aimY: y,
      autoAim: id === 2,
      alive: true
    };
  }

  function weaponStats(name) {
    // tuned for feel, not realism
    if (name === "smg")   return { rate: 0.08, spread: 0.14, dmg: 6,  speed: 240, pel: 1, kick: 0.7, clip: 36, reload: 1.1 };
    if (name === "shot")  return { rate: 0.70, spread: 0.55, dmg: 5,  speed: 210, pel: 7, kick: 2.0, clip: 6,  reload: 1.4 };
    if (name === "rail")  return { rate: 0.95, spread: 0.02, dmg: 34, speed: 410, pel: 1, kick: 2.6, clip: 4,  reload: 1.7, pierce: 1 };
    return /* pistol */   { rate: 0.28, spread: 0.07, dmg: 10, speed: 280, pel: 1, kick: 1.2, clip: 12, reload: 1.25 };
  }

  function makeEnemy(kind, x, y, tier) {
    tier = tier || 1;
    var base = { x: x, y: y, vx: 0, vy: 0, t: 0, alive: true, hitT: 0, tier: tier, kind: kind };
    if (kind === "drone") {
      base.r = 6.0;
      base.hp = 16 + tier * 6;
      base.spd = 55 + tier * 7;
      base.dmg = 9 + tier * 2;
      base.fireCD = rand(0.3, 1.2);
      base.rate = 1.3 - tier * 0.05;
      base.shotSpd = 200;
      base.score = 18 + tier * 6;
      return base;
    }
    if (kind === "turret") {
      base.r = 7.5;
      base.hp = 24 + tier * 10;
      base.spd = 0;
      base.dmg = 10 + tier * 2;
      base.fireCD = rand(0.2, 0.8);
      base.rate = 0.85 - tier * 0.03;
      base.shotSpd = 240;
      base.score = 28 + tier * 8;
      base.static = true;
      return base;
    }
    // runner
    base.r = 6.2;
    base.hp = 18 + tier * 7;
    base.spd = 72 + tier * 10;
    base.dmg = 16 + tier * 3;
    base.score = 22 + tier * 7;
    base.melee = true;
    return base;
  }

  function makePickup(type, x, y, amt) {
    return { type: type, x: x, y: y, r: 6, t: 0, amt: amt || 1 };
  }

  function makeBullet(ownerId, x, y, vx, vy, dmg, pierce) {
    return { ownerId: ownerId, x: x, y: y, vx: vx, vy: vy, r: 2.0, life: 1.8, dmg: dmg, pierce: pierce || 0 };
  }

  function makeParticle(x, y, vx, vy, life, size, c) {
    return { x: x, y: y, vx: vx, vy: vy, life: life, t: 0, s: size, c: c };
  }

  // ---------- Input ----------
  var keys = Object.create(null);
  var mouse = { x: 0, y: 0, down: false };
  function onKey(e, v) {
    keys[e.code] = v;
    // prevent page scroll on arrows/space
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].indexOf(e.code) >= 0) e.preventDefault();
  }
  function onMouseMove(e) { mouse.x = e.clientX; mouse.y = e.clientY; }
  function onMouseDown(e) { mouse.down = true; }
  function onMouseUp(e) { mouse.down = false; }

  // ---------- Core Game ----------
  var state = {
    mode: "menu", // menu | play | pause | gameover
    coop: true,
    wave: 1,
    waveT: 0,
    difficulty: 1,
    time: 0,
    level: null,
    players: [],
    enemies: [],
    bullets: [],
    pickups: [],
    particles: [],
    cam1: { x: 0, y: 0 },
    cam2: { x: 0, y: 0 },
    msg: "",
    msgT: 0,
    scoreTotal: 0,
    runSeed: (Math.random() * 1e9) | 0
  };

  // ---------- Rendering (Pixel buffer) ----------
  var root, styleTag, menuWrap, gameWrap, canvas, ctx, overlay, hud, centerModal;
  var low, lctx;

  function resize() {
    if (!canvas) return;
    canvas.width = innerWidth;
    canvas.height = innerHeight;
  }

  function setSmoothing(c, v) {
    c.imageSmoothingEnabled = !!v;
    c.mozImageSmoothingEnabled = !!v;
    c.webkitImageSmoothingEnabled = !!v;
  }

  // ---------- UI: Menu / Modal ----------
  function buildUI() {
    // style
    styleTag = el("style", { text: cssText() }, document.head);

    root = el("div", { className: "nr-wrap" }, document.body);
    menuWrap = el("div", { className: "nr-shell" }, root);

    // Header
    var top = el("div", { className: "nr-top" }, menuWrap);
    var left = el("div", null, top);
    el("div", { className: "nr-title", text: "Neon Rift" }, left);
    el("div", { className: "nr-sub", text: "Split-screen cyberpunk shooter • procedural levels • local leaderboard" }, left);

    var right = el("div", null, top);
    var fsBtn = el("button", { className: "nr-btn secondary", text: "Fullscreen (F)" }, right);
    fsBtn.onclick = function () { toggleFullscreen(); };

    // Cards row
    var row = el("div", { className: "nr-row" }, menuWrap);

    var cardPlay = el("div", { className: "nr-card" }, row);
    el("h3", { text: "Play" }, cardPlay);
    var playRow = el("div", { className: "nr-row" }, cardPlay);

    var bPlay = el("button", { className: "nr-btn", text: "Play (Solo)" }, playRow);
    bPlay.onclick = function () { startGame(false); };

    var bCoop = el("button", { className: "nr-btn", text: "Play (Co-op)" }, playRow);
    bCoop.onclick = function () { startGame(true); };

    var bHow = el("button", { className: "nr-btn secondary", text: "Controls" }, playRow);
    bHow.onclick = function () { showControls(); };

    var bScores = el("button", { className: "nr-btn secondary", text: "Leaderboard" }, playRow);
    bScores.onclick = function () { showLeaderboard(); };

    // Settings
    var cardSet = el("div", { className: "nr-card" }, row);
    el("h3", { text: "Settings" }, cardSet);

    var setSmall = el("div", { className: "nr-small", html:
      "<div class='nr-kv'><span>Graphics</span><span class='nr-pill'>Pixel / Neon</span></div>" +
      "<div class='nr-kv'><span>Split Screen</span><span class='nr-pill'>Auto</span></div>" +
      "<div class='nr-kv'><span>Difficulty</span><span class='nr-pill'>Scales per wave</span></div>" +
      "<div class='nr-kv'><span>Watermark</span><span class='nr-pill'>freegameslist.blog</span></div>"
    }, cardSet);

    el("div", { className: "nr-hr" }, menuWrap);

    var tips = el("div", { className: "nr-small", html:
      "<div><span class='nr-pill'>P1</span> WASD move • Mouse aim • LMB shoot • Space dash • R reload</div>" +
      "<div style='margin-top:6px'><span class='nr-pill'>P2</span> Arrows move • Auto-aim • Enter shoot • Right Shift dash</div>" +
      "<div style='margin-top:6px'><span class='nr-pill'>Esc</span> Pause • <span class='nr-pill'>F</span> Fullscreen</div>" +
      "<div style='margin-top:6px' class='nr-tip'>Tip: P2 can be “support drone style” — auto-aim makes co-op playable on one mouse.</div>"
    }, menuWrap);

    var foot = el("div", { className: "nr-foot" }, menuWrap);
    el("div", { className: "nr-water", text: "freegameslist.blog" }, foot);
    el("div", { text: "Procedural runs. Score shards + kills. Survive waves." }, foot);

    // Game layer
    gameWrap = el("div", { className: "nr-game" }, document.body);
    canvas = el("canvas", null, gameWrap);
    ctx = canvas.getContext("2d", { alpha: false });

    overlay = el("div", { className: "nr-overlay" }, document.body);
    hud = el("div", { className: "nr-hud" }, overlay);

    // center modal (pause, gameover, screens)
    centerModal = el("div", { className: "nr-center" }, overlay);

    // Low-res buffer
    low = document.createElement("canvas");
    low.width = VIEW_W;
    low.height = VIEW_H;
    lctx = low.getContext("2d", { alpha: false });

    setSmoothing(ctx, false);
    setSmoothing(lctx, false);

    resize();
  }

  function showModal(title, lines, buttons) {
    centerModal.style.display = "block";
    centerModal.innerHTML = "";
    el("h2", { text: title }, centerModal);
    for (var i = 0; i < lines.length; i++) el("p", { text: lines[i] }, centerModal);
    var row = el("div", { className: "nr-row" }, centerModal);
    (buttons || []).forEach(function (b) {
      var btn = el("button", { className: "nr-btn " + (b.secondary ? "secondary" : ""), text: b.text }, row);
      btn.onclick = b.onClick;
    });
  }
  function hideModal() { centerModal.style.display = "none"; }

  function showControls() {
    showModal("Controls", [
      "P1 (left screen): WASD move • Mouse aim • Left click shoot • Space dash • R reload",
      "P2 (right screen): Arrow keys move • Auto-aim • Enter shoot • Right Shift dash",
      "Esc pauses. F toggles fullscreen.",
      "Pickups: green=HP, cyan=shield, magenta=weapon/ammo, yellow=data shards."
    ], [
      { text: "Close", secondary: true, onClick: function () { hideModal(); } }
    ]);
  }

  function showLeaderboard() {
    var s = loadScores();
    var lines = [];
    if (!s.length) lines.push("No scores yet. Go make some neon noise.");
    for (var i = 0; i < s.length; i++) lines.push((i + 1) + ". " + s[i].n + " — " + s[i].s);
    showModal("Local Leaderboard", lines, [
      { text: "Close", secondary: true, onClick: function () { hideModal(); } }
    ]);
  }

  function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen || function(){})();
      } else {
        (document.exitFullscreen || document.webkitExitFullscreen || function(){})();
      }
    } catch (e) {}
  }

  // ---------- Wave / Spawning ----------
  function findFloorSpot(level) {
    for (var i = 0; i < 2000; i++) {
      var tx = randi(2, level.w - 3);
      var ty = randi(2, level.h - 3);
      var t = level.g[idx(tx, ty, level.w)];
      if (t !== 0) {
        var x = tx * TILE + TILE * 0.5;
        var y = ty * TILE + TILE * 0.5;
        return { x: x, y: y };
      }
    }
    return { x: level.spawn.x, y: level.spawn.y };
  }

  function spawnWave() {
    var lvl = state.level;
    var w = state.wave;
    var baseCount = 6 + w * 2 + (state.coop ? 4 : 0);
    var eliteChance = clamp(0.05 + w * 0.02, 0.05, 0.35);
    var turretChance = clamp(0.04 + w * 0.015, 0.04, 0.25);

    for (var i = 0; i < baseCount; i++) {
      var spot = findFloorSpot(lvl);
      // Keep enemies away from spawn
      if (dist2(spot.x, spot.y, lvl.spawn.x, lvl.spawn.y) < (TILE * 18) * (TILE * 18)) { i--; continue; }

      var tier = 1 + (chance(eliteChance) ? 1 : 0) + (w > 8 && chance(0.12) ? 1 : 0);
      var kind = "runner";
      if (chance(0.45)) kind = "drone";
      if (chance(turretChance)) kind = "turret";
      state.enemies.push(makeEnemy(kind, spot.x, spot.y, tier));
    }

    state.msg = "WAVE " + w;
    state.msgT = 1.2;
  }

  function dropLoot(x, y) {
    // weighted drops
    if (chance(0.35)) state.pickups.push(makePickup("shard", x, y, 1 + (chance(0.25) ? 1 : 0)));
    if (chance(0.18)) state.pickups.push(makePickup("hp", x + rand(-6,6), y + rand(-6,6), 18));
    if (chance(0.14)) state.pickups.push(makePickup("shield", x + rand(-6,6), y + rand(-6,6), 16));
    if (chance(0.10)) {
      var wpn = chance(0.45) ? "smg" : (chance(0.6) ? "shot" : "rail");
      state.pickups.push(makePickup("weapon_" + wpn, x + rand(-6,6), y + rand(-6,6), 1));
    }
    if (chance(0.12)) state.pickups.push(makePickup("ammo", x + rand(-6,6), y + rand(-6,6), 18));
  }

  // ---------- Combat helpers ----------
  function fireWeapon(p, aimX, aimY) {
    if (p.reloadT > 0 || p.fireCD > 0 || !p.alive) return;
    var ws = weaponStats(p.weapon);
    if (p.clip <= 0) { p.reloadT = ws.reload; return; }

    var ax = aimX - p.x, ay = aimY - p.y;
    var n = norm(ax, ay);
    if (n.l < 0.0001) return;

    // recoil feel
    p.recoil = clamp(p.recoil + ws.kick * 0.9, 0, 10);

    for (var i = 0; i < ws.pel; i++) {
      var sp = ws.spread;
      var ang = Math.atan2(n.y, n.x) + rand(-sp, sp);
      var vx = Math.cos(ang) * ws.speed;
      var vy = Math.sin(ang) * ws.speed;
      var dmg = ws.dmg * p.dmgMul;
      // crit
      if (chance(p.crit)) dmg *= 1.8;

      state.bullets.push(makeBullet(
        p.id,
        p.x + Math.cos(ang) * (p.r + 2),
        p.y + Math.sin(ang) * (p.r + 2),
        vx, vy,
        dmg,
        ws.pierce ? 1 : 0
      ));
    }

    p.clip -= 1;
    p.fireCD = ws.rate;

    // muzzle particles
    for (var k = 0; k < 5; k++) {
      state.particles.push(makeParticle(p.x, p.y, rand(-30,30), rand(-30,30), 0.25, 1, chance(0.5) ? THEME.neonB : THEME.neonC));
    }
  }

  function damagePlayer(p, dmg) {
    if (p.invT > 0 || !p.alive) return;
    // shield first
    if (p.shield > 0) {
      var take = Math.min(p.shield, dmg);
      p.shield -= take;
      dmg -= take;
      p.shieldRegenT = 2.0;
    }
    if (dmg > 0) {
      p.hp -= dmg;
      p.invT = 0.22;
      // hit particles
      for (var i = 0; i < 10; i++) state.particles.push(makeParticle(p.x, p.y, rand(-60,60), rand(-60,60), 0.35, 1, THEME.bad));
      if (p.hp <= 0) {
        p.hp = 0;
        p.alive = false;
      }
    }
  }

  function damageEnemy(e, dmg) {
    if (!e.alive) return;
    e.hp -= dmg;
    e.hitT = 0.15;
    if (e.hp <= 0) {
      e.alive = false;
      dropLoot(e.x, e.y);
      // pop
      for (var i = 0; i < 14; i++) state.particles.push(makeParticle(e.x, e.y, rand(-90,90), rand(-90,90), 0.5, 1, chance(0.5) ? THEME.neonB : THEME.neonC));
    }
  }

  // ---------- Player movement / dash / collision ----------
  function moveEntity(level, ent, dt) {
    var nx = ent.x + ent.vx * dt;
    var ny = ent.y + ent.vy * dt;

    // resolve axis separately
    if (!collideCircle(level, nx, ent.y, ent.r)) ent.x = nx;
    else ent.vx = 0;

    if (!collideCircle(level, ent.x, ny, ent.r)) ent.y = ny;
    else ent.vy = 0;
  }

  function doDash(p, dx, dy) {
    if (p.dashCD > 0 || !p.alive) return;
    var n = norm(dx, dy);
    if (n.l < 0.1) return;
    p.dashT = 0.12;
    p.dashCD = 1.05;
    p.invT = 0.18;
    p.vx += n.x * 520;
    p.vy += n.y * 520;
    // dash particles
    for (var i = 0; i < 18; i++) state.particles.push(makeParticle(p.x, p.y, rand(-140,140), rand(-140,140), 0.35, 1, THEME.neonA));
  }

  // ---------- Auto aim for P2 ----------
  function acquireTarget(p) {
    var best = null, bestD = 1e18;
    for (var i = 0; i < state.enemies.length; i++) {
      var e = state.enemies[i];
      if (!e.alive) continue;
      var d = dist2(p.x, p.y, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  // ---------- Game flow ----------
  function resetRun(coop) {
    state.coop = !!coop;
    state.mode = "play";
    state.wave = 1;
    state.waveT = 0;
    state.time = 0;
    state.difficulty = 1;
    state.enemies.length = 0;
    state.bullets.length = 0;
    state.pickups.length = 0;
    state.particles.length = 0;
    state.scoreTotal = 0;
    state.runSeed = (Math.random() * 1e9) | 0;

    state.level = genLevel(state.runSeed);
    var sp = state.level.spawn;

    state.players = [
      makePlayer(1, sp.x, sp.y),
      makePlayer(2, sp.x + 18, sp.y + 8)
    ];
    if (!state.coop) {
      // disable second player in solo
      state.players[1].alive = false;
    }

    // wave 1 spawns after short delay
    state.msg = "ENTER THE RIFT";
    state.msgT = 1.2;
    state.waveT = 1.0;
  }

  function startGame(coop) {
    hideModal();
    root.style.display = "none";
    gameWrap.style.display = "block";
    resetRun(coop);
  }

  function endGame() {
    state.mode = "gameover";
    // total score from P1 + P2
    var s = 0;
    for (var i = 0; i < state.players.length; i++) s += (state.players[i].score | 0);
    state.scoreTotal = s;

    var lines = [
      "Run complete. Total Score: " + state.scoreTotal,
      "Waves cleared: " + (state.wave - 1),
      "Enter a name to save your score locally."
    ];
    showModal("Game Over", lines, [
      { text: "Save Score", onClick: function () {
          var name = (centerModal.querySelector("input") || { value: "" }).value;
          saveScore(name, state.scoreTotal);
          showLeaderboard();
        }
      },
      { text: "Back to Menu", secondary: true, onClick: function () { backToMenu(); } }
    ]);
    // add input
    var input = el("input", { className: "nr-input", placeholder: "YOUR NAME (max 12 chars)" }, centerModal);
    input.value = "ANON";
    input.select();
  }

  function backToMenu() {
    hideModal();
    state.mode = "menu";
    gameWrap.style.display = "none";
    root.style.display = "flex";
  }

  // ---------- HUD ----------
  function updateHUD() {
    hud.innerHTML = "";
    var p1 = state.players[0];
    var p2 = state.players[1];

    var left = el("div", { className: "box" }, hud);
    left.innerHTML =
      "<b>P1</b> " +
      "HP " + (p1.hp | 0) + "/" + p1.hpMax +
      " • SH " + (p1.shield | 0) + "/" + p1.shieldMax +
      " • " + p1.weapon.toUpperCase() +
      " • CLIP " + p1.clip + "/" + p1.clipMax +
      " • SCORE " + (p1.score | 0);

    var mid = el("div", { className: "box" }, hud);
    mid.innerHTML =
      "<b>WAVE</b> " + state.wave +
      " • ENEMIES " + state.enemies.filter(function(e){return e.alive;}).length +
      " • SHARDS " + ((p1.shards | 0) + ((p2 && p2.alive) ? (p2.shards | 0) : 0)) +
      " <span style='opacity:.65'>• freegameslist.blog</span>";

    var right = el("div", { className: "box" }, hud);
    if (state.coop) {
      right.innerHTML =
        "<b>P2</b> " +
        "HP " + (p2.hp | 0) + "/" + p2.hpMax +
        " • SH " + (p2.shield | 0) + "/" + p2.shieldMax +
        " • " + p2.weapon.toUpperCase() +
        " • CLIP " + p2.clip + "/" + p2.clipMax +
        " • SCORE " + (p2.score | 0);
    } else {
      right.innerHTML = "<b>Solo</b> • Esc pause • F fullscreen";
    }
  }

  // ---------- Rendering helpers ----------
  function worldToScreen(cam, wx, wy, halfIndex) {
    // halfIndex: 0 for left, 1 for right
    var sx = (wx - cam.x) + (halfIndex ? HALF_W : 0);
    var sy = (wy - cam.y);
    return { x: sx, y: sy };
  }

  function drawTextShadow(c, txt, x, y, color) {
    c.fillStyle = "rgba(0,0,0,0.6)";
    c.fillText(txt, x + 1, y + 1);
    c.fillStyle = color;
    c.fillText(txt, x, y);
  }

  function drawLevelHalf(c, level, cam, halfIndex) {
    // Draw tiles visible in half viewport
    var ox = cam.x, oy = cam.y;
    var startX = ((ox / TILE) | 0) - 1;
    var startY = ((oy / TILE) | 0) - 1;
    var endX = (((ox + HALF_W) / TILE) | 0) + 2;
    var endY = (((oy + VIEW_H) / TILE) | 0) + 2;
    startX = clamp(startX, 0, level.w - 1);
    startY = clamp(startY, 0, level.h - 1);
    endX = clamp(endX, 0, level.w);
    endY = clamp(endY, 0, level.h);

    for (var ty = startY; ty < endY; ty++) {
      for (var tx = startX; tx < endX; tx++) {
        var t = level.g[idx(tx, ty, level.w)];
        var wx = tx * TILE;
        var wy = ty * TILE;
        var sx = (wx - ox) + (halfIndex ? HALF_W : 0);
        var sy = (wy - oy);

        // base
        if (t === 0) {
          c.fillStyle = "rgb(10,0,14)";
          c.fillRect(sx, sy, TILE, TILE);
          // wall highlight
          if (chance(0.002)) {
            c.fillStyle = "rgba(124,92,255,0.08)";
            c.fillRect(sx + 1, sy + 1, TILE - 2, TILE - 2);
          }
        } else {
          c.fillStyle = "rgb(6,6,12)";
          c.fillRect(sx, sy, TILE, TILE);

          // subtle floor grid
          c.fillStyle = "rgba(255,255,255,0.03)";
          c.fillRect(sx, sy + TILE - 1, TILE, 1);

          if (t === 2) {
            c.fillStyle = "rgba(0,255,240,0.35)";
            c.fillRect(sx + 2, sy + 6, TILE - 4, TILE - 12);
          } else if (t === 3) {
            c.fillStyle = "rgba(255,59,212,0.10)";
            c.fillRect(sx + 2, sy + 2, TILE - 4, TILE - 4);
            c.fillStyle = "rgba(0,255,240,0.12)";
            c.fillRect(sx + 4, sy + 4, TILE - 8, TILE - 8);
          } else if (t === 4) {
            c.fillStyle = "rgba(124,92,255,0.12)";
            c.fillRect(sx + 3, sy + 3, TILE - 6, TILE - 6);
            c.fillStyle = "rgba(0,255,240,0.08)";
            c.fillRect(sx + 5, sy + 5, TILE - 10, TILE - 10);
          }
        }
      }
    }

    // Exit marker (neon gate)
    var ex = level.exit.x, ey = level.exit.y;
    var es = worldToScreen(cam, ex, ey, halfIndex);
    c.fillStyle = "rgba(0,255,240,0.20)";
    c.fillRect((es.x - 8) | 0, (es.y - 8) | 0, 16, 16);
    c.fillStyle = "rgba(124,92,255,0.20)";
    c.fillRect((es.x - 6) | 0, (es.y - 6) | 0, 12, 12);
  }

  function drawEntityHalf(c, cam, halfIndex, x, y, r, fill, stroke) {
    var s = worldToScreen(cam, x, y, halfIndex);
    var sx = s.x | 0, sy = s.y | 0;
    c.fillStyle = fill;
    c.fillRect(sx - (r | 0), sy - (r | 0), (r * 2) | 0, (r * 2) | 0);
    if (stroke) {
      c.fillStyle = stroke;
      c.fillRect(sx - (r | 0) - 1, sy - (r | 0) - 1, (r * 2) | 0, 1);
      c.fillRect(sx - (r | 0) - 1, sy + (r | 0), (r * 2) | 0, 1);
    }
  }

  function draw() {
    // Clear low-res buffer
    lctx.fillStyle = "rgb(5,0,8)";
    lctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Divider
    lctx.fillStyle = "rgba(255,255,255,0.06)";
    lctx.fillRect(HALF_W - 1, 0, 2, VIEW_H);

    var lvl = state.level;
    var p1 = state.players[0];
    var p2 = state.players[1];

    // Draw left half
    drawLevelHalf(lctx, lvl, state.cam1, 0);
    // Draw right half
    drawLevelHalf(lctx, lvl, state.cam2, 1);

    // Entities, bullets, pickups, particles
    for (var hi = 0; hi < 2; hi++) {
      var cam = hi === 0 ? state.cam1 : state.cam2;

      // pickups
      for (var i = 0; i < state.pickups.length; i++) {
        var pu = state.pickups[i];
        var col = THEME.warn;
        if (pu.type === "hp") col = THEME.good;
        else if (pu.type === "shield") col = THEME.neonB;
        else if (pu.type.indexOf("weapon_") === 0) col = THEME.neonC;
        else if (pu.type === "ammo") col = THEME.neonA;
        drawEntityHalf(lctx, cam, hi, pu.x, pu.y, 4, col, "rgba(0,0,0,0.3)");
      }

      // enemies
      for (var j = 0; j < state.enemies.length; j++) {
        var e = state.enemies[j];
        if (!e.alive) continue;
        var fill = e.kind === "turret" ? "rgba(255,59,212,0.85)" : (e.kind === "drone" ? "rgba(0,255,240,0.85)" : "rgba(124,92,255,0.85)");
        if (e.tier >= 3) fill = "rgba(255,204,0,0.90)";
        if (e.hitT > 0) fill = "rgba(255,255,255,0.95)";
        drawEntityHalf(lctx, cam, hi, e.x, e.y, 6, fill, "rgba(0,0,0,0.4)");
      }

      // bullets
      lctx.fillStyle = "rgba(255,255,255,0.9)";
      for (var b = 0; b < state.bullets.length; b++) {
        var bl = state.bullets[b];
        var s = worldToScreen(cam, bl.x, bl.y, hi);
        var sx = s.x | 0, sy = s.y | 0;
        // color by owner
        lctx.fillStyle = bl.ownerId === 1 ? "rgba(0,255,240,0.95)" : (bl.ownerId === 2 ? "rgba(255,59,212,0.95)" : "rgba(255,255,255,0.8)");
        lctx.fillRect(sx - 1, sy - 1, 2, 2);
      }

      // players
      if (p1.alive) drawEntityHalf(lctx, cam, hi, p1.x, p1.y, 7, "rgba(0,255,240,0.90)", "rgba(0,0,0,0.4)");
      if (state.coop && p2.alive) drawEntityHalf(lctx, cam, hi, p2.x, p2.y, 7, "rgba(255,59,212,0.90)", "rgba(0,0,0,0.4)");

      // aim indicators
      if (hi === 0 && p1.alive) {
        var a1 = worldToScreen(cam, p1.aimX, p1.aimY, hi);
        lctx.fillStyle = "rgba(0,255,240,0.6)";
        lctx.fillRect((a1.x | 0) - 2, (a1.y | 0) - 2, 4, 4);
      }
      if (hi === 1 && state.coop && p2.alive) {
        var a2 = worldToScreen(cam, p2.aimX, p2.aimY, hi);
        lctx.fillStyle = "rgba(255,59,212,0.6)";
        lctx.fillRect((a2.x | 0) - 2, (a2.y | 0) - 2, 4, 4);
      }

      // particles (draw in both halves)
      for (var k = 0; k < state.particles.length; k++) {
        var pt = state.particles[k];
        var sp = worldToScreen(cam, pt.x, pt.y, hi);
        var px = sp.x | 0, py = sp.y | 0;
        lctx.fillStyle = pt.c;
        lctx.fillRect(px, py, pt.s, pt.s);
      }

      // message text (centered in each half)
      if (state.msgT > 0) {
        lctx.font = "12px ui-monospace,monospace";
        lctx.textAlign = "center";
        lctx.textBaseline = "middle";
        drawTextShadow(lctx, state.msg, (hi ? HALF_W + HALF_W / 2 : HALF_W / 2) | 0, 16, "rgba(255,255,255,0.85)");
        lctx.textAlign = "left";
      }
    }

    // scale to main canvas
    ctx.fillStyle = "rgb(5,0,8)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Fit low-res to screen while preserving aspect ratio
    var sx = canvas.width / VIEW_W;
    var sy = canvas.height / VIEW_H;
    var s = Math.min(sx, sy);
    var dw = (VIEW_W * s) | 0;
    var dh = (VIEW_H * s) | 0;
    var dx = ((canvas.width - dw) / 2) | 0;
    var dy = ((canvas.height - dh) / 2) | 0;

    setSmoothing(ctx, false);
    ctx.drawImage(low, dx, dy, dw, dh);

    // subtle vignette + watermark
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // ---------- Update loop ----------
  var lastT = 0;
  var rafId = 0;

  function update(dt) {
    if (state.mode !== "play") return;

    var lvl = state.level;
    state.time += dt;

    if (state.msgT > 0) state.msgT -= dt;

    var p1 = state.players[0];
    var p2 = state.players[1];

    // P1 aim uses mouse position mapped into left half
    // Convert mouse screen to game low-res coords
    // We approximate by mapping to canvas fit rectangle
    var cw = canvas.width, ch = canvas.height;
    var sx = cw / VIEW_W, sy = ch / VIEW_H;
    var sc = Math.min(sx, sy);
    var dw = VIEW_W * sc, dh = VIEW_H * sc;
    var ox = (cw - dw) / 2, oy = (ch - dh) / 2;
    var mx = (mouse.x - ox) / sc;
    var my = (mouse.y - oy) / sc;
    // If mouse is on left half, aim from there; else still aim but clamp
    mx = clamp(mx, 0, HALF_W);
    my = clamp(my, 0, VIEW_H);

    p1.aimX = state.cam1.x + mx;
    p1.aimY = state.cam1.y + my;

    // P2 auto aim
    if (state.coop && p2.alive) {
      var tgt = acquireTarget(p2);
      if (tgt) {
        p2.aimX = tgt.x;
        p2.aimY = tgt.y;
      } else {
        p2.aimX = p2.x + 10;
        p2.aimY = p2.y;
      }
    }

    // Movement inputs
    function movePlayer(p, up, down, left, right) {
      if (!p.alive) return;
      var ax = 0, ay = 0;
      if (keys[left]) ax -= 1;
      if (keys[right]) ax += 1;
      if (keys[up]) ay -= 1;
      if (keys[down]) ay += 1;
      var n = norm(ax, ay);
      var baseSpd = 110 * p.speedMul;
      if (p.dashT > 0) baseSpd *= 1.25;
      p.vx = lerp(p.vx, n.x * baseSpd, 0.25);
      p.vy = lerp(p.vy, n.y * baseSpd, 0.25);

      // hazard slows + chips shield
      var t = tileAt(lvl, p.x, p.y);
      if (t === 4) {
        p.vx *= 0.72; p.vy *= 0.72;
        if (chance(0.08 * dt * 60)) damagePlayer(p, 1.5);
      }

      moveEntity(lvl, p, dt);

      if (p.invT > 0) p.invT -= dt;
      if (p.dashCD > 0) p.dashCD -= dt;
      if (p.dashT > 0) p.dashT -= dt;

      if (p.fireCD > 0) p.fireCD -= dt;
      if (p.reloadT > 0) {
        p.reloadT -= dt;
        if (p.reloadT <= 0) {
          // finish reload
          var ws = weaponStats(p.weapon);
          var need = p.clipMax - p.clip;
          if (p.ammo >= 999) {
            p.clip = p.clipMax;
          } else {
            var take = Math.min(need, p.ammo);
            p.ammo -= take;
            p.clip += take;
          }
        }
      }

      // shield regen
      if (p.shieldRegenT > 0) p.shieldRegenT -= dt;
      else if (p.shield < p.shieldMax) p.shield = Math.min(p.shieldMax, p.shield + 10 * dt);
    }

    movePlayer(p1, "KeyW", "KeyS", "KeyA", "KeyD");
    if (state.coop) movePlayer(p2, "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight");

    // Dash
    if (p1.alive && keys["Space"]) {
      // dash in current move direction or towards aim if idle
      var dx = (keys["KeyD"] ? 1 : 0) - (keys["KeyA"] ? 1 : 0);
      var dy = (keys["KeyS"] ? 1 : 0) - (keys["KeyW"] ? 1 : 0);
      if (!dx && !dy) { dx = p1.aimX - p1.x; dy = p1.aimY - p1.y; }
      doDash(p1, dx, dy);
      keys["Space"] = false; // tap behavior
    }
    if (state.coop && p2.alive && keys["ShiftRight"]) {
      var dx2 = (keys["ArrowRight"] ? 1 : 0) - (keys["ArrowLeft"] ? 1 : 0);
      var dy2 = (keys["ArrowDown"] ? 1 : 0) - (keys["ArrowUp"] ? 1 : 0);
      if (!dx2 && !dy2) { dx2 = p2.aimX - p2.x; dy2 = p2.aimY - p2.y; }
      doDash(p2, dx2, dy2);
      keys["ShiftRight"] = false;
    }

    // Reload
    if (p1.alive && keys["KeyR"]) {
      var ws1 = weaponStats(p1.weapon);
      if (p1.reloadT <= 0 && p1.clip < p1.clipMax) p1.reloadT = ws1.reload;
      keys["KeyR"] = false;
    }
    if (state.coop && p2.alive && keys["Slash"]) {
      var ws2 = weaponStats(p2.weapon);
      if (p2.reloadT <= 0 && p2.clip < p2.clipMax) p2.reloadT = ws2.reload;
      keys["Slash"] = false;
    }

    // Shooting
    if (p1.alive && mouse.down) fireWeapon(p1, p1.aimX, p1.aimY);
    if (state.coop && p2.alive && (keys["Enter"] || keys["NumpadEnter"])) fireWeapon(p2, p2.aimX, p2.aimY);

    // Enemies AI + attacks
    for (var i = 0; i < state.enemies.length; i++) {
      var e = state.enemies[i];
      if (!e.alive) continue;
      e.t += dt;
      if (e.hitT > 0) e.hitT -= dt;

      // Choose closest alive player
      var target = p1.alive ? p1 : null;
      if (state.coop && p2.alive) {
        if (!target) target = p2;
        else {
          var d1 = dist2(e.x, e.y, p1.x, p1.y);
          var d2 = dist2(e.x, e.y, p2.x, p2.y);
          if (d2 < d1) target = p2;
        }
      }
      if (!target) continue;

      var dx = target.x - e.x, dy = target.y - e.y;
      var n = norm(dx, dy);

      if (!e.static) {
        // movement with mild strafing for drones
        var spd = e.spd;
        var sx2 = 0, sy2 = 0;
        if (e.kind === "drone") {
          var side = Math.sin(e.t * (1.5 + e.tier * 0.1));
          sx2 = -n.y * side * 0.55;
          sy2 =  n.x * side * 0.55;
          spd *= 0.92;
        }

        e.vx = lerp(e.vx, (n.x + sx2) * spd, 0.12);
        e.vy = lerp(e.vy, (n.y + sy2) * spd, 0.12);
        moveEntity(lvl, e, dt);
      } else {
        e.vx = 0; e.vy = 0;
      }

      // attacks
      if (e.melee) {
        if (n.l < 14) {
          // melee hit
          if (chance(0.18 * dt * 60)) damagePlayer(target, e.dmg);
        }
      } else {
        // shooting
        e.fireCD -= dt;
        if (e.fireCD <= 0) {
          e.fireCD = e.rate + rand(0, 0.25);
          // shoot at target
          var ang = Math.atan2(n.y, n.x) + rand(-0.08, 0.08);
          var vx = Math.cos(ang) * e.shotSpd;
          var vy = Math.sin(ang) * e.shotSpd;
          state.bullets.push(makeBullet(0, e.x + Math.cos(ang) * (e.r + 2), e.y + Math.sin(ang) * (e.r + 2), vx, vy, e.dmg, 0));
        }
      }
    }

    // Bullets update + collisions
    for (var b = state.bullets.length - 1; b >= 0; b--) {
      var bl = state.bullets[b];
      bl.life -= dt;
      if (bl.life <= 0) { state.bullets.splice(b, 1); continue; }

      var nx2 = bl.x + bl.vx * dt;
      var ny2 = bl.y + bl.vy * dt;

      // wall hit
      if (!isWalkable(lvl, nx2, ny2)) {
        // ricochet for player bullets sometimes
        if (bl.ownerId !== 0 && chance(0.10)) {
          bl.vx *= -0.65;
          bl.vy *= -0.65;
          bl.life *= 0.6;
          // spark
          state.particles.push(makeParticle(bl.x, bl.y, rand(-80,80), rand(-80,80), 0.25, 1, THEME.warn));
        } else {
          state.particles.push(makeParticle(bl.x, bl.y, rand(-60,60), rand(-60,60), 0.25, 1, THEME.warn));
          state.bullets.splice(b, 1);
        }
        continue;
      }

      bl.x = nx2; bl.y = ny2;

      // hit players or enemies
      if (bl.ownerId === 0) {
        // enemy bullet -> players
        if (p1.alive && dist2(bl.x, bl.y, p1.x, p1.y) < (p1.r + 2) * (p1.r + 2)) {
          damagePlayer(p1, bl.dmg);
          state.bullets.splice(b, 1);
          continue;
        }
        if (state.coop && p2.alive && dist2(bl.x, bl.y, p2.x, p2.y) < (p2.r + 2) * (p2.r + 2)) {
          damagePlayer(p2, bl.dmg);
          state.bullets.splice(b, 1);
          continue;
        }
      } else {
        // player bullet -> enemies
        for (var ei = 0; ei < state.enemies.length; ei++) {
          var en = state.enemies[ei];
          if (!en.alive) continue;
          if (dist2(bl.x, bl.y, en.x, en.y) < (en.r + 2) * (en.r + 2)) {
            damageEnemy(en, bl.dmg);
            // scoring for owner
            var owner = bl.ownerId === 1 ? p1 : p2;
            if (owner && owner.alive) owner.score += 2;

            if (en.alive) {
              // survived hit
              state.particles.push(makeParticle(bl.x, bl.y, rand(-60,60), rand(-60,60), 0.22, 1, THEME.neonB));
            } else {
              // killed
              if (owner) {
                owner.score += en.score;
                owner.kills += 1;
              }
            }

            if (bl.pierce > 0) {
              bl.pierce -= 1;
              bl.dmg *= 0.75;
            } else {
              state.bullets.splice(b, 1);
            }
            break;
          }
        }
      }
    }

    // Pickups collect
    function collect(p) {
      if (!p.alive) return;
      for (var i = state.pickups.length - 1; i >= 0; i--) {
        var pu = state.pickups[i];
        if (dist2(p.x, p.y, pu.x, pu.y) < (p.r + pu.r + 2) * (p.r + pu.r + 2)) {
          if (pu.type === "hp") {
            p.hp = Math.min(p.hpMax, p.hp + pu.amt);
            p.score += 6;
          } else if (pu.type === "shield") {
            p.shield = Math.min(p.shieldMax, p.shield + pu.amt);
            p.score += 6;
          } else if (pu.type === "ammo") {
            if (p.ammo < 999) p.ammo += pu.amt * 2;
            p.score += 4;
          } else if (pu.type === "shard") {
            p.shards += pu.amt;
            p.score += 20 * pu.amt;
          } else if (pu.type.indexOf("weapon_") === 0) {
            var wpn = pu.type.slice(7);
            p.weapon = wpn;
            var ws = weaponStats(wpn);
            p.clipMax = ws.clip;
            p.clip = ws.clip;
            p.reloadT = 0;
            p.fireCD = 0;
            p.score += 25;
            // limited ammo for heavier guns (except pistol)
            if (wpn !== "smg") p.ammo = 24; else p.ammo = 72;
          }
          // pickup particles
          for (var k = 0; k < 8; k++) state.particles.push(makeParticle(pu.x, pu.y, rand(-70,70), rand(-70,70), 0.3, 1, THEME.good));
          state.pickups.splice(i, 1);
        }
      }
    }
    collect(p1);
    if (state.coop) collect(p2);

    // Particles update
    for (var pp = state.particles.length - 1; pp >= 0; pp--) {
      var pt = state.particles[pp];
      pt.t += dt;
      if (pt.t >= pt.life) { state.particles.splice(pp, 1); continue; }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.92;
      pt.vy *= 0.92;
    }

    // Cameras (center on players)
    function updateCam(cam, p, halfW) {
      var targetX = p.x - halfW / 2;
      var targetY = p.y - VIEW_H / 2;
      cam.x = lerp(cam.x, targetX, 0.14);
      cam.y = lerp(cam.y, targetY, 0.14);
      // clamp to world bounds
      cam.x = clamp(cam.x, 0, lvl.w * TILE - halfW);
      cam.y = clamp(cam.y, 0, lvl.h * TILE - VIEW_H);
    }
    if (p1.alive) updateCam(state.cam1, p1, HALF_W);
    if (state.coop && p2.alive) updateCam(state.cam2, p2, HALF_W);
    else state.cam2.x = state.cam1.x, state.cam2.y = state.cam1.y;

    // Wave logic
    state.waveT -= dt;
    if (state.waveT <= 0) {
      var aliveEnemies = 0;
      for (var ee = 0; ee < state.enemies.length; ee++) if (state.enemies[ee].alive) aliveEnemies++;
      if (aliveEnemies === 0) {
        state.wave += 1;
        state.waveT = 1.0 + clamp(0.2 * state.wave, 0, 1.4);
        spawnWave();
        // small power creep
        p1.dmgMul = 1 + clamp(p1.shards * 0.006, 0, 0.30);
        if (state.coop) p2.dmgMul = 1 + clamp(p2.shards * 0.006, 0, 0.30);
      }
    }

    // Check game over
    var anyAlive = p1.alive || (state.coop && p2.alive);
    if (!anyAlive) {
      endGame();
    }
  }

  function loop(t) {
    rafId = requestAnimationFrame(loop);
    if (!lastT) lastT = t;
    var dt = (t - lastT) / 1000;
    lastT = t;

    // pause if tab not focused (prevents huge dt spikes)
    if (!hasFocus()) dt = 0;

    dt = Math.min(dt, DT_MAX);

    // Pause toggle
    if (keys["Escape"]) {
      keys["Escape"] = false;
      if (state.mode === "play") {
        state.mode = "pause";
        showModal("Paused", [
          "Esc to resume.",
          "P1: WASD + Mouse + LMB • P2: Arrows + Enter",
          "F toggles fullscreen."
        ], [
          { text: "Resume", onClick: function(){ hideModal(); state.mode="play"; } },
          { text: "Restart", secondary: true, onClick: function(){ hideModal(); resetRun(state.coop); } },
          { text: "Menu", secondary: true, onClick: function(){ backToMenu(); } }
        ]);
      } else if (state.mode === "pause") {
        hideModal();
        state.mode = "play";
      }
    }

    if (keys["KeyF"]) { keys["KeyF"] = false; toggleFullscreen(); }

    if (state.mode === "play") update(dt);

    updateHUD();
    draw();
  }

  // ---------- Public create() ----------
  // Your launcher can load this JS and then call create().
  // create() can optionally accept a config object, but it's not required.
  window.create = function create(config) {
    config = config || {};
    // Build UI once
    if (!root) buildUI();

    // Show menu
    state.mode = "menu";
    root.style.display = "flex";
    gameWrap.style.display = "none";
    hideModal();

    // Attach listeners (idempotent)
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mousedown", onMouseDown, { passive: true });
    window.addEventListener("mouseup", onMouseUp, { passive: true });
    window.addEventListener("keydown", function (e) { onKey(e, true); }, { passive: false });
    window.addEventListener("keyup", function (e) { onKey(e, false); }, { passive: false });

    // Optional: autostart
    if (config.autostart) startGame(!!config.coop);

    // Start loop once
    if (!rafId) {
      lastT = 0;
      rafId = requestAnimationFrame(loop);
    }

    return {
      startSolo: function(){ startGame(false); },
      startCoop: function(){ startGame(true); },
      menu: backToMenu
    };
  };

  // ---------- Destroy cleanup ----------
  __NR.destroy = function () {
    try { cancelAnimationFrame(rafId); } catch (e) {}
    rafId = 0;

    // Remove DOM
    try { if (root && root.parentNode) root.parentNode.removeChild(root); } catch (e) {}
    try { if (gameWrap && gameWrap.parentNode) gameWrap.parentNode.removeChild(gameWrap); } catch (e) {}
    try { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); } catch (e) {}
    try { if (styleTag && styleTag.parentNode) styleTag.parentNode.removeChild(styleTag); } catch (e) {}

    root = styleTag = menuWrap = gameWrap = canvas = ctx = overlay = hud = centerModal = null;
    low = lctx = null;
    state.mode = "menu";
    state.players = [];
    state.enemies = [];
    state.bullets = [];
    state.pickups = [];
    state.particles = [];
  };

})();
