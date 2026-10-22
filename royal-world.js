/* Kingdom Craft v2: presentation only. Geometry always comes from BAL. */
(function () {
  'use strict';
  const grass = new Image();
  grass.onload = function () { if (window.invalidateRoyalTerrain) window.invalidateRoyalTerrain(); };
  grass.src = 'assets/royal/grass-terrain.png';
  const hash = (x, y, n = 0) => { const z = Math.sin(x * 127.1 + y * 311.7 + n * 74.7) * 43758.5453; return z - Math.floor(z); };
  function path(c, pts, fill, stroke, lw = 1) {
    c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath();
    c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  }
  function rr(c, x, y, w, h, r, fill, stroke) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.fillStyle = fill; c.fill();
    if (stroke) { c.lineWidth = 1.2; c.strokeStyle = stroke; c.stroke(); }
  }
  function oval(c, x, y, rx, ry, fill) { c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
  function tree(c, x, y, s, dry) {
    oval(c, x + s * .15, y + s * .7, s * .85, s * .28, 'rgba(18,48,22,.24)');
    rr(c, x - s * .13, y + s * .2, s * .26, s * .55, 2, '#705238');
    for (let k = 0; k < 3; k++) {
      const y0 = y - k * s * .42, w = s * (1 - k * .19);
      path(c, [[x, y0 - s], [x + w, y0 + s * .4], [x, y0 + s * .57], [x - w, y0 + s * .4]], dry ? '#607e3e' : '#206b43', '#20513b');
      path(c, [[x, y0 - s], [x - w, y0 + s * .4], [x - w * .23, y0 + s * .26]], dry ? '#99ab58' : '#56a75b');
      path(c, [[x, y0 - s], [x + w, y0 + s * .4], [x + w * .18, y0 + s * .3]], dry ? '#526e36' : '#2a8250');
    }
  }
  function rock(c, x, y, s, dry) {
    oval(c, x + 3, y + s * .5, s, s * .35, 'rgba(24,43,29,.26)');
    path(c, [[x - s, y + s * .3], [x - s * .75, y - s * .5], [x - s * .15, y - s * .8], [x + s * .65, y - s * .5], [x + s, y + s * .25], [x + s * .45, y + s * .6], [x - s * .5, y + s * .65]], dry ? '#a9835b' : '#829495', '#526668', 1.4);
    path(c, [[x - s * .75, y - s * .5], [x - s * .15, y - s * .8], [x + s * .65, y - s * .5], [x + s * .12, y], [x - s * .65, y + s * .12]], dry ? '#dab98a' : '#c1cebc');
    path(c, [[x + s * .65, y - s * .5], [x + s, y + s * .25], [x + s * .45, y + s * .6], [x + s * .12, y]], dry ? '#8c6849' : '#6a7e81');
    if (!dry) { oval(c, x - s * .62, y + s * .27, s * .24, s * .12, '#729e57'); }
  }
  function drawTerrain(c, d) {
    const { W, H, TILE: t, COLS: cols, ROWS: rows, BAL: b, theme: th } = d;
    const dry = !!th.cliff;
    const base = c.createLinearGradient(0, 0, W, H);
    base.addColorStop(0, dry ? '#d4ba86' : '#85bd52'); base.addColorStop(1, dry ? '#b59765' : '#579249');
    c.fillStyle = base; c.fillRect(0, 0, W, H);
    if (!dry && grass.complete && grass.naturalWidth > 0) {
      c.save(); c.globalAlpha = .65;
      for (let y = 0; y < H; y += 384) for (let x = 0; x < W; x += 384) c.drawImage(grass, x, y, 384, 384);
      c.restore();
      c.fillStyle = 'rgba(58,104,65,.13)'; c.fillRect(0, 0, W, H);
    }
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if ((x + y) % 2) { c.fillStyle = dry ? 'rgba(102,76,40,.025)' : 'rgba(27,82,50,.035)'; c.fillRect(x * t, y * t, t, t); }
      if (hash(x, y) > .72) {
        c.strokeStyle = dry ? 'rgba(109,85,47,.15)' : 'rgba(243,251,162,.28)'; c.lineWidth = 1.2;
        const px = x * t + 8 + hash(x, y, 1) * 18, py = y * t + 9 + hash(x, y, 2) * 17;
        c.beginPath(); c.moveTo(px - 3, py + 2); c.lineTo(px - 1, py - 2); c.lineTo(px, py + 2); c.lineTo(px + 3, py - 1); c.stroke();
      }
    }
    // Roads and map features retain the exact logical tile extents.
    const features = b.FEATS || [], roads = b.ROADS || [b.ROAD];
    features.filter(f => f.t === 'river').forEach(f => {
      const x = f.x0 * t, y = f.y0 * t, w = (f.x1 - f.x0 + 1) * t, h = (f.y1 - f.y0 + 1) * t;
      c.fillStyle = '#497c5b'; c.fillRect(x - 3, y - 3, w + 6, h + 6);
      c.fillStyle = '#dacda0'; c.fillRect(x - 1, y - 1, w + 2, h + 2);
      const water = c.createLinearGradient(x, y, x, y + h); water.addColorStop(0, '#337f98'); water.addColorStop(.3, '#3eb6be'); water.addColorStop(1, '#278da5');
      c.fillStyle = water; c.fillRect(x + 2, y + 2, w - 4, h - 4);
      c.fillStyle = 'rgba(9,66,92,.18)'; c.fillRect(x + 2, y + 2, w - 4, 6);
      for (let i = 0; i < Math.max(8, w * h / 360); i++) {
        const xx = x + 5 + hash(i, 2) * Math.max(1, w - 26), yy = y + 5 + hash(i, 6) * (h - 10);
        c.strokeStyle = i % 3 ? 'rgba(185,255,240,.36)' : 'rgba(225,255,250,.7)'; c.lineWidth = i % 3 ? 1 : 1.8;
        c.beginPath(); c.moveTo(xx, yy); c.quadraticCurveTo(xx + 7, yy + 2, xx + 17, yy - 1); c.stroke();
      }
    });
    features.filter(f => f.t !== 'river').forEach(f => {
      for (let y = f.y0; y <= f.y1; y++) for (let x = f.x0; x <= f.x1; x++) {
        const px = (x + .5) * t, py = (y + .57) * t;
        if (f.t === 'forest') tree(c, px + (hash(x, y) - .5) * 7, py, t * (.31 + hash(x, y, 1) * .12), dry);
        if (f.t === 'rock') rock(c, px, py, t * .43, dry);
        if (f.t === 'wall') {
          rr(c, x * t + 1, y * t + 6, t - 2, t - 5, 3, '#7d8f84', '#52635d');
          rr(c, x * t + 1, y * t + 1, t - 2, t - 9, 3, '#d0d5bd', '#8e9a88');
          c.fillStyle = '#eef0d9'; c.fillRect(x * t + 3, y * t + 2, t - 6, 3);
          c.strokeStyle = '#9da88f'; c.lineWidth = 1; c.beginPath(); c.moveTo(px, y * t + 6); c.lineTo(px, y * t + 15); c.moveTo(x * t + 3, y * t + 15); c.lineTo((x + 1) * t - 3, y * t + 15); c.stroke();
        }
      }
    });
    roads.filter(Boolean).forEach(rd => {
      const x = rd.x0 * t, y = rd.y0 * t, w = (rd.x1 - rd.x0 + 1) * t, h = (rd.y1 - rd.y0 + 1) * t;
      c.fillStyle = dry ? '#8b7254' : '#52774b'; c.fillRect(x - 2, y, w + 4, h);
      c.fillStyle = dry ? '#c9a779' : '#c4bc95'; c.fillRect(x, y, w, h);
      c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
      for (let yy = 0; yy < h; yy += 19) for (let xx = -18; xx < w; xx += 27) {
        const dx = x + xx + ((yy / 19) % 2) * 13.5;
        rr(c, dx + 1, y + yy + 1, 25, 17, 3, dry ? (hash(xx, yy) > .5 ? '#d2b387' : '#bfa077') : (hash(xx, yy) > .5 ? '#d6cfaa' : '#c7c49c'));
        c.fillStyle = 'rgba(255,251,206,.27)'; c.fillRect(dx + 4, y + yy + 2, 19, 1.5);
      }
      c.restore();
      c.strokeStyle = 'rgba(255,247,192,.55)'; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, w - 2, h - 2);
    });
    features.filter(f => f.t === 'river').forEach(rv => roads.filter(Boolean).forEach(rd => {
      const x0 = Math.max(rv.x0, rd.x0), x1 = Math.min(rv.x1, rd.x1), y0 = Math.max(rv.y0, rd.y0), y1 = Math.min(rv.y1, rd.y1);
      if (x0 > x1 || y0 > y1) return;
      const vert = rd.y1 - rd.y0 >= rd.x1 - rd.x0;
      const x = x0 * t - (vert ? 0 : 5), y = y0 * t - (vert ? 5 : 0), w = (x1 - x0 + 1) * t + (vert ? 0 : 10), h = (y1 - y0 + 1) * t + (vert ? 10 : 0);
      rr(c, x - 3, y + 4, w + 6, h + 4, 3, 'rgba(14,57,62,.35)');
      rr(c, x, y, w, h, 3, '#916239', '#684a30');
      if (vert) for (let yy = y + 2; yy < y + h - 3; yy += 10) rr(c, x + 3, yy, w - 6, 8, 1.5, '#d1a568', '#a87d4a');
      else for (let xx = x + 2; xx < x + w - 3; xx += 10) rr(c, xx, y + 3, 8, h - 6, 1.5, '#d1a568', '#a87d4a');
      const post = (px, py) => { rr(c, px - 3, py - 4, 7, 11, 2, '#785236', '#5d432c'); rr(c, px - 4, py - 6, 9, 4, 2, '#eee1ac', '#a3936d'); };
      if (vert) { rr(c, x - 2, y, 4, h, 1, '#ebd4a3'); rr(c, x + w - 2, y, 4, h, 1, '#ebd4a3'); for (let yy = y + 5; yy < y + h; yy += 22) { post(x, yy); post(x + w, yy); } }
      else { rr(c, x, y - 2, w, 4, 1, '#ebd4a3'); rr(c, x, y + h - 2, w, 4, 1, '#ebd4a3'); for (let xx = x + 5; xx < x + w; xx += 22) { post(xx, y); post(xx, y + h); } }
    }));
    const deposits = new Set();
    (b.GAS_ZONES || []).concat(b.BASE_GAS || []).forEach(([gx, gy]) => {
      if (deposits.has(gx + ',' + gy)) return; deposits.add(gx + ',' + gy);
      const x = gx * t, y = gy * t, s = 2 * t, cx = x + t, cy = y + t;
      rr(c, x + 3, y + 4, s - 6, s - 7, 11, '#66824a', '#506f43');
      rr(c, x + 5, y + 4, s - 10, s - 11, 9, '#a89466', '#d2c18a');
      rr(c, x + 9, y + 8, s - 18, s - 19, 7, '#8e7d59');
      rock(c, cx, cy + 5, 22, true);
      [[-9, 3, 8], [5, -6, 9], [14, 9, 6]].forEach(([dx, dy, r]) => {
        const xx = cx + dx, yy = cy + dy;
        path(c, [[xx - r, yy], [xx - r * .5, yy - r * .75], [xx + r * .65, yy - r * .75], [xx + r, yy + r * .2], [xx + r * .45, yy + r * .65], [xx - r * .65, yy + r * .5]], '#f3b72e', '#a97720', 1.1);
        path(c, [[xx - r, yy], [xx - r * .5, yy - r * .75], [xx + r * .65, yy - r * .75], [xx + r * .15, yy]], '#fff19a');
        path(c, [[xx + r * .15, yy], [xx + r * .65, yy - r * .75], [xx + r, yy + r * .2], [xx + r * .45, yy + r * .65]], '#e8a126');
      });
      c.strokeStyle = '#fff7ba'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(cx + 5, cy - 19); c.lineTo(cx + 5, cy - 10); c.moveTo(cx + 1, cy - 14); c.lineTo(cx + 9, cy - 14); c.stroke();
    });
    // Thin grid supports accurate placement without overpowering the illustration.
    c.strokeStyle = dry ? 'rgba(91,66,42,.07)' : 'rgba(32,71,44,.055)'; c.lineWidth = .7;
    for (let x = 0; x <= cols; x++) { c.beginPath(); c.moveTo(x * t, 0); c.lineTo(x * t, H); c.stroke(); }
    for (let y = 0; y <= rows; y++) { c.beginPath(); c.moveTo(0, y * t); c.lineTo(W, y * t); c.stroke(); }
    c.strokeStyle = dry ? '#806746' : '#385d42'; c.lineWidth = 6; c.strokeRect(3, 3, W - 6, H - 6);
    c.strokeStyle = dry ? '#d7be88' : '#a0c475'; c.lineWidth = 1.5; c.strokeRect(6, 6, W - 12, H - 12);
  }
  window.RoyalWorld = { drawTerrain };
})();
