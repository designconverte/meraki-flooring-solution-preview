/* Meraki Flooring Solution: the floor engine.
   Draws a floor seen from above on a <canvas>, piece by piece, the way each material is really installed:
   hardwood drops into a herringbone from the center line, LVP slides in and clicks, laminate goes row by row,
   tile and VCT are set square by square, carpet rolls out, a worn floor gets sanded and refinished, stairs go tread by
   tread. The page tilts the canvas in 3D with CSS; this file only paints the plan view.
   The oak texture comes from a real Meraki job photo (perspective-corrected); every other material is drawn.
   No library. Exposes window.MerakiFloor. */
(function () {
  'use strict';

  var TEX_URL = '/assets/img/oak-texture.webp';
  var OAK_COLS = [[14, 230], [258, 410], [438, 586], [614, 786]]; // board columns inside the texture (900 × 1495)
  var TEX_H = 1495;

  /* deterministic random, so the same material always looks the same */
  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

  /* ── drawn textures (vertical grain, 256 × 1024) ── */
  function grain(base, ink, seed, opts) {
    var o = opts || {};
    var c = mk(256, 1024), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, 256, 1024);
    var grd = g.createLinearGradient(0, 0, 256, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0.05)'); grd.addColorStop(0.5, 'rgba(0,0,0,0.04)'); grd.addColorStop(1, 'rgba(255,255,255,0.03)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 1024);
    var n = o.lines || 90;
    for (var i = 0; i < n; i++) {
      var x = r() * 256, amp = 1 + r() * (o.wave || 5), fq = 0.004 + r() * 0.01, ph = r() * 6.28;
      g.beginPath();
      for (var y = 0; y <= 1024; y += 16) {
        var xx = x + Math.sin(y * fq + ph) * amp + Math.sin(y * fq * 3.1 + ph) * amp * 0.25;
        if (y === 0) g.moveTo(xx, y); else g.lineTo(xx, y);
      }
      g.strokeStyle = ink.replace('A', (0.05 + r() * (o.alpha || 0.16)).toFixed(3));
      g.lineWidth = 0.6 + r() * (o.weight || 1.6);
      g.stroke();
    }
    if (o.cathedral) {
      for (var k = 0; k < 5; k++) {
        var cx = 40 + r() * 176, cy = 120 + r() * 780, h = 120 + r() * 160;
        for (var m = 0; m < 6; m++) {
          g.beginPath();
          g.ellipse(cx, cy, 6 + m * 7, h * (0.3 + m * 0.14), 0, Math.PI * 1.05, Math.PI * 1.95);
          g.strokeStyle = ink.replace('A', '0.10'); g.lineWidth = 1; g.stroke();
        }
      }
    }
    return c;
  }
  function speckle(base, dots, seed, size) {
    var c = mk(256, 256), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    for (var i = 0; i < (size || 2600); i++) {
      g.fillStyle = dots[Math.floor(r() * dots.length)];
      var s = 0.6 + r() * 1.6;
      g.fillRect(r() * 256, r() * 256, s, s);
    }
    return c;
  }
  function stone(seed) {
    var c = mk(512, 512), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = '#CFC8BB'; g.fillRect(0, 0, 512, 512);
    for (var i = 0; i < 40; i++) {
      var px = r() * 512, py = r() * 512;
      var rg = g.createRadialGradient(px, py, 0, px, py, 60 + r() * 120);
      rg.addColorStop(0, 'rgba(' + (r() < 0.5 ? '255,252,245' : '170,160,145') + ',0.10)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(0, 0, 512, 512);
    }
    for (var k = 0; k < 7; k++) {
      g.beginPath(); var x = r() * 512, y = 0; g.moveTo(x, y);
      while (y < 512) { x += (r() - 0.5) * 40; y += 20 + r() * 30; g.lineTo(x, y); }
      g.strokeStyle = 'rgba(140,130,115,' + (0.08 + r() * 0.14).toFixed(2) + ')'; g.lineWidth = 0.6 + r() * 1.4; g.stroke();
    }
    return c;
  }
  function carpetTex(seed) {
    var c = speckle('#8C857A', ['rgba(255,250,240,0.10)', 'rgba(40,35,30,0.12)', 'rgba(120,112,100,0.5)', 'rgba(160,150,135,0.35)'], seed, 9000);
    var g = c.getContext('2d');
    for (var y = 0; y < 256; y += 4) { g.fillStyle = 'rgba(0,0,0,0.035)'; g.fillRect(0, y, 256, 1); }
    return c;
  }

  var TEX = null; // built lazily
  function textures() {
    if (TEX) return TEX;
    TEX = {
      lvp: grain('#A49886', 'rgba(70,60,48,A)', 11, { lines: 70, wave: 3, alpha: 0.14, weight: 1.2 }),
      laminate: grain('#B8916A', 'rgba(92,58,28,A)', 23, { lines: 80, wave: 6, alpha: 0.18, cathedral: true }),
      stone: stone(5),
      carpet: carpetTex(7),
      vctA: speckle('#E4DDCB', ['rgba(163,164,159,0.55)', 'rgba(98,100,94,0.35)', 'rgba(255,255,255,0.5)'], 3, 1400),
      vctB: speckle('#A3A49F', ['rgba(228,221,203,0.5)', 'rgba(67,81,62,0.35)', 'rgba(52,52,50,0.3)'], 4, 1400),
    };
    return TEX;
  }

  /* ── the oak texture (real job photo) ── */
  var oak = null, oakReady = null;
  function loadOak() {
    if (oakReady) return oakReady;
    oakReady = new Promise(function (resolve) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () { oak = img; resolve(img); };
      img.onerror = function () { oak = null; resolve(null); };
      img.src = TEX_URL;
    });
    return oakReady;
  }

  /* paints a board of size bw × bh (grain along the long side) centered at 0,0 */
  function paintBoard(g, b, kind) {
    var bw = b.w, bh = b.h, long = bh >= bw;
    g.save();
    if (!long) g.rotate(Math.PI / 2);
    var W = long ? bw : bh, H = long ? bh : bw;
    if (kind === 'oak' && oak) {
      var col = OAK_COLS[b.col % OAK_COLS.length];
      var sw = col[1] - col[0], sh = Math.min(TEX_H - 2, sw * (H / W));
      var sy = b.sy * (TEX_H - sh);
      g.drawImage(oak, col[0], sy, sw, sh, -W / 2, -H / 2, W, H);
    } else {
      var t = kind === 'oak' ? null : textures()[kind];
      if (t) {
        var tw = t.width, th = Math.min(t.height, tw * (H / W));
        g.drawImage(t, 0, b.sy * (t.height - th), tw, th, -W / 2, -H / 2, W, H);
      } else { g.fillStyle = '#B8935F'; g.fillRect(-W / 2, -H / 2, W, H); }
    }
    if (b.tone) { g.fillStyle = b.tone > 0 ? 'rgba(255,244,222,' + b.tone + ')' : 'rgba(46,28,12,' + (-b.tone) + ')'; g.fillRect(-W / 2, -H / 2, W, H); }
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(40,26,12,0.42)'; g.strokeRect(-W / 2 + 0.5, -H / 2 + 0.5, W - 1, H - 1);
    g.strokeStyle = 'rgba(255,246,228,0.12)'; g.beginPath(); g.moveTo(-W / 2 + 1.5, -H / 2 + 1.5); g.lineTo(-W / 2 + 1.5, H / 2 - 1.5); g.stroke();
    g.restore();
  }
  function paintSquare(g, b) {
    var t = textures(), gap = b.g || 0;
    if (gap) { g.fillStyle = '#9C968B'; g.fillRect(-b.w / 2, -b.w / 2, b.w, b.w); }
    var s = b.w - gap;
    if (b.kind === 'stone') {
      g.drawImage(t.stone, b.sx * 256, b.sy * 256, 256, 256, -s / 2, -s / 2, s, s);
    } else {
      g.drawImage(b.alt ? t.vctB : t.vctA, b.sx * 128, b.sy * 128, 128, 128, -s / 2, -s / 2, s, s);
    }
    if (b.tone) { g.fillStyle = 'rgba(0,0,0,' + Math.abs(b.tone) + ')'; g.fillRect(-s / 2, -s / 2, s, s); }
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1; g.strokeRect(-s / 2 + 1, -s / 2 + 1, s - 2, s - 2);
  }

  /* ── layouts: each returns { base, pieces[], special } in plan coordinates ── */
  function herringbone(W, H, u, r) {
    var w = u * 0.92, L = w * 5, out = [];
    var ca = Math.cos(-Math.PI / 4), sa = Math.sin(-Math.PI / 4), cx = W / 2, cy = H / 2;
    var R = Math.sqrt(W * W + H * H) / 2 + L;
    var kMax = Math.ceil(R * 2 / L) + 2, jMax = Math.ceil(R * 2 / w) + 2;
    for (var k = -kMax; k <= kMax; k++) {
      for (var j = -jMax; j <= jMax; j++) {
        var bx = k * L + j * w, by = -k * L + j * w;
        // H board [bx, bx+L] × [by, by+w] ; V board [bx, bx+w] × [by+w, by+w+L]
        add(bx + L / 2, by + w / 2, L, w);
        add(bx + w / 2, by + w + L / 2, w, L);
      }
    }
    function add(px, py, bw, bh) {
      var x = cx + px * ca - py * sa, y = cy + px * sa + py * ca;
      if (x < -L || x > W + L || y < -L || y > H + L) return;
      out.push({ x: x, y: y, w: bw, h: bh, rot: -Math.PI / 4, col: Math.floor(r() * 4), sy: r(), tone: (r() - 0.5) * 0.14 });
    }
    return out;
  }
  function planks(W, H, pw, pl, r, kind) {
    var out = [], cols = Math.ceil(W / pw) + 1;
    for (var c = 0; c < cols; c++) {
      var y = -r() * pl * 0.85 - pl * 0.1;
      while (y < H) {
        var len = pl * (0.55 + r() * 0.45);
        out.push({ x: c * pw + pw / 2, y: y + len / 2, w: pw, h: len, rot: 0, col: Math.floor(r() * 4), sy: r(), tone: (r() - 0.5) * (kind === 'oak' ? 0.12 : 0.08), c: c });
        y += len;
      }
    }
    return out;
  }
  function squares(W, H, s, gap, r, kind) {
    var out = [], cols = Math.ceil(W / (s + gap)) + 1, rows = Math.ceil(H / (s + gap)) + 1;
    var ox = (W - cols * (s + gap)) / 2;
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
      out.push({ x: ox + x * (s + gap) + (s + gap) / 2, y: y * (s + gap) + (s + gap) / 2, w: s + gap, h: s + gap, g: gap, rot: 0, kind: kind, sx: r(), sy: r(), alt: (x + y) % 2 === 1, tone: (r() - 0.5) * 0.05, c: x, rr: y });
    }
    return out;
  }

  /* ── materials ── */
  var MATS = {
    'hardwood-installation': { label: 'White oak herringbone', real: true, base: '#2A2B2B' },
    'lvp-installation': { label: 'Luxury vinyl plank', base: '#2A2B2B' },
    'laminate-installation': { label: 'Laminate plank', base: '#2A2B2B' },
    'sand-refinish': { label: 'Oak floor, sanded & refinished', real: true, base: '#2A2B2B' },
    'stairs': { label: 'Oak stair treads', real: true, base: '#1C1D1D' },
    'tile-installation': { label: 'Large-format tile', base: '#A9A59C' },
    'carpet-installation': { label: 'Carpet', base: '#8C857A' },
    'vct-installation': { label: 'VCT, two-tone', base: '#8C8D88' },
  };
  MATS.other = MATS['tile-installation'];

  var SPREAD = { 'hardwood-installation': 1.9, 'lvp-installation': 1.7, 'laminate-installation': 1.6, 'stairs': 1.1, 'tile-installation': 1.5, other: 1.5, 'vct-installation': 1.2 };

  function build(mat, W, H, u, view) {
    var v0 = view ? view[0] * W : 0, v1 = view ? view[1] * W : W, vw = v1 - v0;
    var r = rng(mat.length * 97 + 13);
    var P = [], enter = 'drop', order;
    switch (mat) {
      case 'lvp-installation':
        P = planks(W, H, u * 1.45, u * 9.5, r, 'lvp'); enter = 'slide';
        P.forEach(function (p) { p.kind = 'lvp'; });
        order = function (p) { return Math.max(0, (p.x - v0) / vw) * 2.2 + (H - p.y) / H * 0.25; };
        break;
      case 'laminate-installation':
        P = planks(W, H, u * 1.55, u * 8, r, 'laminate'); enter = 'slide';
        P.forEach(function (p) { p.kind = 'laminate'; });
        order = function (p) { return Math.max(0, (p.x - v0) / vw) * 2 + (H - p.y) / H * 0.35; };
        break;
      case 'sand-refinish':
        P = planks(W, H, u * 1.9, u * 11, r, 'oak'); enter = 'fade';
        P.forEach(function (p) { p.kind = 'oak'; });
        order = function (p) { return 0; };
        break;
      case 'stairs':
        var T = u * 2.6;
        for (var y = 0, i = 0; y < H + T; y += T, i++) P.push({ x: W / 2, y: y + T / 2, w: W + 4, h: T, rot: 0, tread: true, i: i, sy: r(), col: i });
        enter = 'drop'; order = function (p) { return p.i * 0.09; };
        break;
      case 'tile-installation': case 'other':
        P = squares(W, H, u * 4.2, Math.max(2, u * 0.12), r, 'stone'); enter = 'tile';
        order = function (p) { return p.y / H * 1.4 + Math.abs(p.x - W / 2) / vw; };
        break;
      case 'vct-installation':
        P = squares(W, H, u * 2.3, 0, r, 'vct'); enter = 'tile';
        order = function (p) { return p.y / H + Math.max(0, (p.x - v0) / vw); };
        break;
      case 'carpet-installation':
        return { special: 'carpet', pieces: [], base: MATS[mat].base };
      default:
        P = herringbone(W, H, u, r); enter = 'drop';
        var cx = W / 2;
        order = function (p) { var dx = (p.x - cx) / vw, dy = p.y / H; return Math.sqrt(dx * dx * 2.4 + dy * dy); };
    }
    var mx = 0; P.forEach(function (p) { p.o = order(p); if (p.x > v0 - u * 4 && p.x < v1 + u * 4 && p.o > mx) mx = p.o; });
    var spread = SPREAD[mat] || 1.7;
    P.forEach(function (p) { p.delay = Math.min(1, mx ? p.o / mx : 0) * spread + r() * 0.05; p.enter = enter; });
    return { pieces: P, base: (MATS[mat] || MATS['hardwood-installation']).base, special: mat === 'sand-refinish' ? 'sand' : null };
  }

  function drawPiece(g, p) {
    g.save(); g.translate(p.x, p.y); if (p.rot) g.rotate(p.rot);
    if (p.tread) paintTread(g, p);
    else if (p.kind === 'stone' || p.kind === 'vct') paintSquare(g, p);
    else paintBoard(g, p, p.kind || 'oak');
    g.restore();
  }
  function paintTread(g, p) {
    var W = p.w, H = p.h;
    // full-width tread: one long board repeated across the width, nosing light on top, riser shadow below
    g.save();
    var bw = H * 6;
    for (var xx = -W / 2, k = 0; xx < W / 2; xx += bw, k++) {
      g.save(); g.translate(xx + bw / 2, -H * 0.05);
      paintBoard(g, { w: bw, h: H * 0.9, col: (p.col + k) % 4, sy: (p.sy * 7 + k * 0.31) % 1, tone: 0 }, 'oak');
      g.restore();
    }
    g.restore();
    var gr = g.createLinearGradient(0, H * 0.4, 0, H / 2);
    gr.addColorStop(0, 'rgba(20,14,8,0)'); gr.addColorStop(0.35, 'rgba(20,14,8,0.55)'); gr.addColorStop(1, 'rgba(12,9,6,0.85)');
    g.fillStyle = gr; g.fillRect(-W / 2, H * 0.4, W, H * 0.1);
    g.fillStyle = 'rgba(255,240,215,0.22)'; g.fillRect(-W / 2, -H / 2, W, Math.max(1.5, H * 0.04));
  }

  /* ── engine ── */
  function create(canvas, opts) {
    var o = opts || {};
    var g = canvas.getContext('2d', { alpha: false });
    var settled = mk(2, 2), sg = settled.getContext('2d');
    var W = 0, H = 0, unit = 30, dpr = 1;
    var job = null, raf = 0, current = null, onDone = null;

    function size() {
      var cw = canvas.clientWidth || canvas.width, ch = canvas.clientHeight || canvas.height;
      var maxPx = o.maxPixels || 4200000;
      dpr = Math.min(o.dpr || window.devicePixelRatio || 1, 1.5);
      if (cw * ch * dpr * dpr > maxPx) dpr = Math.sqrt(maxPx / (cw * ch));
      W = Math.round(cw * dpr); H = Math.round(ch * dpr);
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      if (settled.width !== W || settled.height !== H) { settled.width = W; settled.height = H; }
      unit = (o.unit ? o.unit() : 30) * dpr;
    }

    function frame(now) {
      if (!job) return;
      var t = (now - job.t0) / 1000, alive = false;
      g.drawImage(settled, 0, 0);
      if (job.special === 'carpet') {
        var p = clamp(t / 1.5, 0, 1), e = 1 - Math.pow(1 - p, 3), edge = e * (H + 40);
        paintCarpet(g, 0, edge);
        if (p < 1) {
          var rh = Math.max(14, unit * 0.9);
          var gr = g.createLinearGradient(0, edge - rh * 0.2, 0, edge + rh);
          gr.addColorStop(0, '#6F695F'); gr.addColorStop(0.45, '#B1A998'); gr.addColorStop(1, '#5A554D');
          g.fillStyle = gr; g.fillRect(0, edge - rh * 0.2, W, rh * 1.2);
          alive = true;
        } else { paintCarpet(sg, 0, H + 40); }
      } else {
        var pcs = job.pieces;
        for (var i = job.from; i < pcs.length; i++) {
          var pc = pcs[i];
          var local = (t - pc.delay) / job.dur;
          if (local >= 1) { if (!pc.done) { drawPiece(sg, pc); pc.done = true; } continue; }
          alive = true;
          if (local <= 0) continue;
          drawEntering(g, pc, local);
        }
        while (job.from < pcs.length && pcs[job.from].done) job.from++;
        if (job.special === 'sand') alive = sandPass(t) || alive;
        // redraw settled on top only where needed: settled already holds finished pieces
      }
      if (!alive) {
        g.drawImage(settled, 0, 0);
        if (job.special === 'sand') { /* finished: fresh oak is in settled */ }
        var cb = job.cb; job = null; raf = 0;
        if (cb) cb();
        if (onDone) onDone(current);
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    function drawEntering(c, p, k) {
      var e, s = 1, dx = 0, dy = 0, a = 1, sh = 0;
      if (p.enter === 'slide') {
        e = 1 - Math.pow(1 - k, 3);
        dx = (1 - e) * -unit * 0.9; a = clamp(k * 3, 0, 1); sh = (1 - e) * 0.35;
        if (k > 0.82) dx += Math.sin((k - 0.82) / 0.18 * Math.PI) * unit * 0.06; // the click
      } else if (p.enter === 'tile') {
        e = k < 0.7 ? Math.pow(k / 0.7, 2) : 1;
        s = k < 0.7 ? 1.16 - 0.17 * e : 0.99 + (k - 0.7) / 0.3 * 0.01;
        a = clamp(k * 2.5, 0, 1); sh = (1 - e) * 0.3;
      } else if (p.enter === 'fade') {
        a = clamp(k, 0, 1);
      } else { // drop: falls, passes 3 px, locks
        e = k < 0.62 ? Math.pow(k / 0.62, 2) : 1;
        s = k < 0.62 ? 1.14 - 0.155 * e : 0.985 + (k - 0.62) / 0.38 * 0.015;
        dy = k < 0.62 ? -(1 - e) * unit * 0.8 : 0;
        a = clamp(k * 2.4, 0, 1); sh = (1 - e) * 0.28;
      }
      c.save();
      if (sh > 0.01) {
        c.globalAlpha = sh * a;
        c.translate(p.x + unit * 0.35 * sh, p.y + unit * 0.6 * sh); if (p.rot) c.rotate(p.rot);
        c.fillStyle = '#000'; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        c.setTransform(1, 0, 0, 1, 0, 0);
      }
      c.globalAlpha = a;
      c.translate(p.x + dx, p.y + dy); if (p.rot) c.rotate(p.rot); if (s !== 1) c.scale(s, s);
      c.translate(-p.x, -p.y);
      drawPiece(c, { x: p.x, y: p.y, w: p.w, h: p.h, g: p.g, rot: 0, col: p.col, sy: p.sy, sx: p.sx, tone: p.tone, kind: p.kind, alt: p.alt, tread: p.tread, i: p.i });
      c.restore();
    }

    function paintCarpet(c, y0, y1) {
      var t = textures().carpet, pat = c.createPattern(t, 'repeat');
      c.save(); c.beginPath(); c.rect(0, y0, W, Math.max(0, y1 - y0)); c.clip();
      c.fillStyle = pat; c.fillRect(0, 0, W, H);
      var v = c.createLinearGradient(0, 0, W, 0);
      v.addColorStop(0, 'rgba(0,0,0,0.10)'); v.addColorStop(0.5, 'rgba(255,255,255,0.03)'); v.addColorStop(1, 'rgba(0,0,0,0.10)');
      c.fillStyle = v; c.fillRect(0, 0, W, H);
      c.restore();
    }

    /* refinish: the worn floor appears, then the drum sander passes from the far wall to the viewer */
    var worn = null;
    function sandPass(t) {
      var start = job.sandStart, dur = 1.6;
      if (t < start) { if (worn) g.drawImage(worn, 0, 0); return true; }
      var p = clamp((t - start) / dur, 0, 1), edge = (1 - Math.pow(1 - p, 2)) * (H + 60);
      g.drawImage(worn, 0, edge, W, Math.max(0, H - edge), 0, edge, W, Math.max(0, H - edge));
      if (p < 1) {
        var band = Math.max(18, unit * 1.4);
        var gr = g.createLinearGradient(0, edge - band, 0, edge + 4);
        gr.addColorStop(0, 'rgba(255,248,232,0)'); gr.addColorStop(0.8, 'rgba(255,248,232,0.35)'); gr.addColorStop(1, 'rgba(240,226,200,0.6)');
        g.fillStyle = gr; g.fillRect(0, edge - band, W, band + 4);
        return true;
      }
      return false;
    }
    function makeWorn() {
      worn = mk(W, H); var wg = worn.getContext('2d');
      wg.drawImage(settled, 0, 0);
      wg.globalCompositeOperation = 'saturation'; wg.fillStyle = 'hsl(30, 20%, 50%)'; wg.fillRect(0, 0, W, H);
      wg.globalCompositeOperation = 'multiply'; wg.fillStyle = 'rgb(150,138,120)'; wg.fillRect(0, 0, W, H);
      wg.globalCompositeOperation = 'source-over';
      var r = rng(99);
      for (var i = 0; i < 260; i++) {
        wg.strokeStyle = 'rgba(' + (r() < 0.5 ? '230,220,200' : '40,30,20') + ',' + (0.08 + r() * 0.18).toFixed(2) + ')';
        wg.lineWidth = 0.6 + r(); wg.beginPath();
        var x = r() * W, y = r() * H, l = 10 + r() * 60, a = (r() - 0.5) * 1.2;
        wg.moveTo(x, y); wg.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); wg.stroke();
      }
      for (var k = 0; k < 18; k++) {
        var qx = r() * W, qy = r() * H;
        var rg = wg.createRadialGradient(qx, qy, 0, qx, qy, 40 + r() * 140);
        rg.addColorStop(0, 'rgba(70,55,40,0.18)'); rg.addColorStop(1, 'rgba(70,55,40,0)');
        wg.fillStyle = rg; wg.fillRect(0, 0, W, H);
      }
    }

    function lay(mat, layOpts) {
      var lo = layOpts || {};
      size();
      cancelAnimationFrame(raf); raf = 0;
      if (job) { job.pieces.forEach(function (p) { if (!p.done) drawPiece(sg, p); }); }
      current = mat;
      var spec = build(mat, W, H, unit, o.view);
      var instant = lo.instant;
      if (lo.fresh || instant) { sg.fillStyle = spec.base; sg.fillRect(0, 0, W, H); }
      if (instant) {
        if (spec.special === 'carpet') paintCarpet(sg, 0, H + 40);
        else spec.pieces.forEach(function (p) { drawPiece(sg, p); });
        g.drawImage(settled, 0, 0);
        job = null;
        if (onDone) onDone(current);
        return;
      }
      job = { t0: performance.now(), pieces: spec.pieces, from: 0, special: spec.special, dur: lo.dur || 0.5, cb: lo.done };
      if (spec.special === 'sand') {
        // paint fresh oak into settled now; animate worn → fresh
        var tmp = mk(W, H), tg = tmp.getContext('2d');
        tg.fillStyle = spec.base; tg.fillRect(0, 0, W, H);
        spec.pieces.forEach(function (p) { drawPiece(tg, p); });
        sg.drawImage(tmp, 0, 0);
        makeWorn();
        spec.pieces.forEach(function (p) { p.done = true; });
        job.from = spec.pieces.length; job.sandStart = 0.55;
        job.special = 'sand';
        // first frame: worn floor covers everything
      }
      raf = requestAnimationFrame(frame);
    }

    function redraw() { // after a resize: lay the current floor again, instantly
      if (!current) return;
      lay(current, { instant: true, fresh: true });
    }

    return {
      lay: lay,
      redraw: redraw,
      get material() { return current; },
      set onDone(fn) { onDone = fn; },
      busy: function () { return !!job; },
    };
  }

  /* a small static swatch of a material, as a data URL (form tiles, rooms, sample boards) */
  function swatch(mat, w, h, u) {
    var c = mk(w, h), g = c.getContext('2d');
    var spec = build(mat, w, h, u || Math.max(10, w / 9));
    g.fillStyle = spec.base; g.fillRect(0, 0, w, h);
    if (spec.special === 'carpet') {
      g.fillStyle = g.createPattern(textures().carpet, 'repeat'); g.fillRect(0, 0, w, h);
    } else {
      spec.pieces.forEach(function (p) { drawPiece(g, p); });
    }
    if (mat === 'sand-refinish') { // half worn, half fresh: what the service does
      g.save(); g.beginPath(); g.rect(0, 0, w * 0.5, h); g.clip();
      g.globalCompositeOperation = 'saturation'; g.fillStyle = 'hsl(30, 20%, 50%)'; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgb(150,138,120)'; g.fillRect(0, 0, w, h);
      g.restore();
      g.fillStyle = 'rgba(255,248,232,0.5)'; g.fillRect(w * 0.5 - 1, 0, 2, h);
    }
    try { return c.toDataURL('image/webp', 0.86); } catch (_e) { return ''; }
  }

  window.MerakiFloor = { create: create, swatch: swatch, load: loadOak, materials: MATS };
})();
