/* Kingdom Craft v2: original medieval village terrain, presentation only.
   Logical roads, rivers, obstacles and deposits retain their BAL extents. */
(function () {
  'use strict';
  const invalidate = () => { if (typeof window.invalidateRoyalTerrain === 'function') window.invalidateRoyalTerrain(); };
  const grass = typeof Image === 'function' ? new Image() : null;
  const nature = typeof Image === 'function' ? new Image() : null;
  const gold = typeof Image === 'function' ? new Image() : null;
  let natureBounds = null;
  let goldBounds = null;
  if (grass) { grass.onload = invalidate; grass.src = 'assets/royal/grass-terrain.png'; }
  if (nature) {
    nature.onload = () => { natureBounds = null; prepareNature(); invalidate(); };
    nature.src = 'assets/royal/tribal-nature-v5.png';
  }
  if (gold) {
    gold.onload = () => { goldBounds = null; prepareGold(); invalidate(); };
    gold.src = 'assets/royal/gold-deposit-v7.png';
  }
  const hash = (x, y, n = 0) => { const z = Math.sin(x * 127.1 + y * 311.7 + n * 74.7) * 43758.5453; return z - Math.floor(z); };
  const ready = image => image && image.complete && image.naturalWidth > 0;
  function path(c, pts, fill, stroke, lw = 1) {
    c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath();
    c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  }
  function rr(c, x, y, w, h, r, fill, stroke) {
    r = Math.max(0, Math.min(r, w * .5, h * .5));
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.fillStyle = fill; c.fill();
    if (stroke) { c.lineWidth = 1; c.strokeStyle = stroke; c.stroke(); }
  }
  function oval(c, x, y, rx, ry, fill) { c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
  // Generated props can cross nominal cell borders. Keep the eight largest
  // connected silhouettes, then sort them into their documented 4 x 2 order.
  function isolateNature(pixels, w, h) {
    const rgba = pixels.data, labels = new Int32Array(w * h), queue = new Int32Array(w * h), parts = [];
    let serial = 0;
    for (let start = 0; start < labels.length; start++) {
      if (labels[start] || rgba[start * 4 + 3] < 20) continue;
      const id = ++serial; let head = 0, tail = 1, left = w, right = 0, top = h, bottom = 0;
      queue[0] = start; labels[start] = id;
      while (head < tail) {
        const i = queue[head++], x = i % w, y = Math.floor(i / w);
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        if (x > 0 && !labels[i - 1] && rgba[(i - 1) * 4 + 3] >= 20) { labels[i - 1] = id; queue[tail++] = i - 1; }
        if (x < w - 1 && !labels[i + 1] && rgba[(i + 1) * 4 + 3] >= 20) { labels[i + 1] = id; queue[tail++] = i + 1; }
        if (y > 0 && !labels[i - w] && rgba[(i - w) * 4 + 3] >= 20) { labels[i - w] = id; queue[tail++] = i - w; }
        if (y < h - 1 && !labels[i + w] && rgba[(i + w) * 4 + 3] >= 20) { labels[i + w] = id; queue[tail++] = i + w; }
      }
      if (tail >= 500) parts.push({ id, count: tail, left, right, top, bottom });
    }
    if (parts.length < 8) return null;
    const largest = parts.sort((a, b) => b.count - a.count).slice(0, 8)
      .sort((a, b) => (a.top + a.bottom) - (b.top + b.bottom));
    const ordered = largest.slice(0, 4).sort((a, b) => (a.left + a.right) - (b.left + b.right))
      .concat(largest.slice(4).sort((a, b) => (a.left + a.right) - (b.left + b.right)));
    return ordered.map(part => {
      const sw = part.right - part.left + 3, sh = part.bottom - part.top + 3;
      const image = document.createElement('canvas'); image.width = sw; image.height = sh;
      const painter = image.getContext('2d'), isolated = painter.createImageData(sw, sh);
      for (let y = part.top; y <= part.bottom; y++) for (let x = part.left; x <= part.right; x++) {
        const i = y * w + x; if (labels[i] !== part.id) continue;
        const source = i * 4, dest = ((y - part.top + 1) * sw + x - part.left + 1) * 4;
        isolated.data[dest] = rgba[source]; isolated.data[dest + 1] = rgba[source + 1];
        isolated.data[dest + 2] = rgba[source + 2]; isolated.data[dest + 3] = rgba[source + 3];
      }
      painter.putImageData(isolated, 0, 0);
      return { image, x: 0, y: 0, w: sw, h: sh };
    });
  }
  // Alpha bounds keep their feet aligned; a regular grid remains a fallback
  // for synthetic/minimal canvases without pixel extraction support.
  function prepareNature() {
    if (natureBounds || !ready(nature) || !(nature.naturalHeight > 0)) return;
    const cw = nature.naturalWidth / 4, ch = nature.naturalHeight / 2;
    natureBounds = Array.from({ length: 8 }, (_, i) => ({ x: (i % 4) * cw, y: Math.floor(i / 4) * ch, w: cw, h: ch }));
    if (typeof document === 'undefined' || !document.createElement) return;
    try {
      const canvas = document.createElement('canvas'); canvas.width = nature.naturalWidth; canvas.height = nature.naturalHeight;
      const a = canvas.getContext('2d'); if (!a || typeof a.getImageData !== 'function') return;
      a.drawImage(nature, 0, 0);
      const pixels = a.getImageData(0, 0, canvas.width, canvas.height);
      if (!pixels || !pixels.data || pixels.data.length !== canvas.width * canvas.height * 4) return;
      const isolated = isolateNature(pixels, canvas.width, canvas.height);
      if (isolated) { natureBounds = isolated; return; }
      natureBounds = natureBounds.map(rect => {
        const x0 = Math.ceil(rect.x), y0 = Math.ceil(rect.y), x1 = Math.floor(rect.x + rect.w), y1 = Math.floor(rect.y + rect.h);
        let l = x1, r = x0, top = y1, bottom = y0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          if (pixels.data[(y * canvas.width + x) * 4 + 3] > 18) { l = Math.min(l, x); r = Math.max(r, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
        }
        return r >= l && bottom >= top ? { x: l, y: top, w: r - l + 1, h: bottom - top + 1 } : rect;
      });
    } catch (_) { /* Optional texture: native terrain stays available. */ }
  }
  function prop(c, cell, x, groundY, width, maxHeight, alpha = 1) {
    prepareNature(); if (!natureBounds) return false;
    const r = natureBounds[cell], scale = Math.min(width / r.w, maxHeight / r.h), w = r.w * scale, h = r.h * scale;
    c.save(); c.globalAlpha = alpha; c.drawImage(r.image || nature, r.x, r.y, r.w, r.h, x - w * .5, groundY - h, w, h); c.restore(); return true;
  }
  // This is one transparent ore cluster, separate from the nature atlas. Use
  // every opaque piece, including loose nuggets, rather than dropping small
  // disconnected details while finding its fit inside the construction area.
  function prepareGold() {
    if (goldBounds || !ready(gold) || !(gold.naturalHeight > 0)) return;
    goldBounds = { x: 0, y: 0, w: gold.naturalWidth, h: gold.naturalHeight };
    if (typeof document === 'undefined' || !document.createElement) return;
    try {
      const canvas = document.createElement('canvas'); canvas.width = gold.naturalWidth; canvas.height = gold.naturalHeight;
      const a = canvas.getContext('2d'); if (!a || typeof a.getImageData !== 'function') return;
      a.drawImage(gold, 0, 0);
      const pixels = a.getImageData(0, 0, canvas.width, canvas.height);
      if (!pixels || !pixels.data || pixels.data.length !== canvas.width * canvas.height * 4) return;
      let l = canvas.width, r = -1, top = canvas.height, bottom = -1;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        if (pixels.data[(y * canvas.width + x) * 4 + 3] > 18) {
          l = Math.min(l, x); r = Math.max(r, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
      if (r >= l && bottom >= top) goldBounds = { x: l, y: top, w: r - l + 1, h: bottom - top + 1 };
    } catch (_) { /* Optional art: native gold veins stay readable. */ }
  }
  function goldDeposit(c, cx, cy, t, dry) {
    const groundY = cy + t - 6;
    const glow = c.createRadialGradient(cx, groundY - t * .22, t * .05, cx, groundY - t * .22, t * .94);
    glow.addColorStop(0, 'rgba(232,181,63,.17)'); glow.addColorStop(.62, 'rgba(187,146,53,.075)'); glow.addColorStop(1, 'rgba(187,146,53,0)');
    oval(c, cx, groundY - t * .22, t * .94, t * .59, glow);
    prepareGold();
    if (goldBounds) {
      const r = goldBounds, scale = Math.min(t * 1.8 / r.w, t * 1.5 / r.h), w = r.w * scale, h = r.h * scale;
      c.drawImage(gold, r.x, r.y, r.w, r.h, cx - w * .5, groundY - h, w, h);
    } else {
      rock(c, cx, cy + 4, t * .64, true, true);
      rock(c, cx - t * .47, cy + t * .38, t * .23, true, true);
      // Broad facets read as rich gold seams at the small mobile map scale;
      // ordinary terrain rocks deliberately have none of these colors.
      const facet = (points, fill, stroke) => path(c, points.map(([x, y]) => [cx + x * t, cy + y * t]), fill, stroke, .55);
      facet([[-.42,-.22],[-.23,-.34],[-.1,-.15],[.06,-.1],[-.02,.04],[-.21,-.02],[-.33,.09],[-.46,.04]], '#b47c20', '#8a672c');
      facet([[-.4,-.24],[-.23,-.34],[-.14,-.17],[-.26,-.14],[-.35,-.01],[-.43,.01]], '#f0c75c');
      facet([[-.12,-.13],[.06,-.1],[-.02,.04],[-.2,-.02]], '#d9a936');
      facet([[.1,-.35],[.3,-.23],[.29,-.01],[.42,.12],[.27,.25],[.15,.12],[.18,-.07],[.05,-.13]], '#bc8425', '#8a672c');
      facet([[.1,-.35],[.24,-.27],[.2,-.1],[.09,-.07],[.05,-.13]], '#ffe08a');
      facet([[.24,-.04],[.29,-.01],[.42,.12],[.27,.25],[.24,.13]], '#e4b648');
      facet([[-.05,.19],[.06,.12],[.19,.22],[.1,.35],[-.05,.34],[-.14,.28]], '#a77420', '#84632d');
      facet([[-.05,.19],[.06,.12],[.13,.22],[.04,.27],[-.14,.28]], '#f1c959');
      facet([[-.61,.34],[-.48,.26],[-.34,.35],[-.4,.48],[-.57,.48],[-.68,.42]], '#b98525', '#8c6d37');
      facet([[-.61,.34],[-.48,.26],[-.37,.35],[-.52,.4],[-.68,.42]], '#f6d578');
      facet([[.4,.45],[.5,.35],[.63,.42],[.59,.53],[.45,.55]], '#bd8525', '#8c6d37');
      facet([[.4,.45],[.5,.35],[.63,.42],[.49,.46]], '#f6d578');
    }
    // Static highlights are deterministic presentation; they consume no clock
    // or gameplay random state and stay inside the ore's logical footprint.
    [[-.27,-.19,.052],[.22,-.22,.043],[-.5,.35,.034]].forEach(([dx,dy,r]) => {
      const x = cx + dx * t, y = cy + dy * t;
      path(c, [[x,y-r*t],[x+r*t*.28,y-r*t*.22],[x+r*t,y],[x+r*t*.25,y+r*t*.2],[x,y+r*t],[x-r*t*.24,y+r*t*.23],[x-r*t,y],[x-r*t*.24,y-r*t*.23]], '#ffe8a0');
    });
  }
  function tree(c, x, groundY, s, dry, pine) {
    if (prop(c, pine ? 1 : 0, x, groundY, s * 2.12, s * 3.05)) return;
    oval(c, x + s * .23, groundY - 1, s * .98, s * .26, 'rgba(35,39,22,.23)');
    path(c, [[x - s * .11, groundY], [x - s * .08, groundY - s * 1.55], [x + s * .1, groundY - s * 1.55], [x + s * .16, groundY]], '#68543a', '#4d4630', .7);
    const clusters = pine ? [[0,-2.25,.38,.44],[-.22,-1.85,.53,.4],[.25,-1.7,.53,.5],[-.32,-1.22,.65,.48],[.3,-1.07,.63,.48],[0,-.86,.78,.39]] : [[-.47,-1.37,.6,.59],[.43,-1.36,.65,.58],[0,-1.94,.72,.61],[-.35,-1.96,.55,.55],[.46,-1.84,.52,.53],[-.73,-1.62,.4,.45]];
    clusters.forEach(([dx, dy, rx, ry], i) => {
      oval(c, x + dx * s, groundY + dy * s, rx * s, ry * s, dry ? ['#707047','#828253','#93915c'][i % 3] : ['#4f5e34','#64783e','#7f8d48'][i % 3]);
      oval(c, x + (dx - .14) * s, groundY + (dy - .14) * s, rx * s * .64, ry * s * .53, dry ? 'rgba(183,171,111,.2)' : 'rgba(173,183,99,.2)');
      for (let k = 0; k < 3; k++) oval(c, x + (dx + (hash(i,k)-.5)*rx)*s, groundY + (dy + (hash(k,i,1)-.5)*ry)*s, 1.2, .8, 'rgba(36,51,25,.2)');
    });
  }
  function rock(c, x, y, s, dry, ore) {
    if (!ore && prop(c, 2, x, y + s * .56, s * 2.05, s * 1.6)) return;
    oval(c, x + 2, y + s * .52, s * 1.02, s * .3, 'rgba(37,35,25,.23)');
    path(c, [[x-s,y+s*.3],[x-s*.75,y-s*.5],[x-s*.15,y-s*.8],[x+s*.65,y-s*.5],[x+s,y+s*.25],[x+s*.45,y+s*.6],[x-s*.5,y+s*.65]], dry ? '#9c9278' : '#7d8171', '#626452', .7);
    path(c, [[x-s*.75,y-s*.5],[x-s*.15,y-s*.8],[x+s*.65,y-s*.5],[x+s*.12,y],[x-s*.65,y+s*.12]], dry ? '#bdb295' : '#afb29a');
    path(c, [[x+s*.65,y-s*.5],[x+s,y+s*.25],[x+s*.45,y+s*.6],[x+s*.12,y]], dry ? '#80765f' : '#666f61');
    c.strokeStyle = dry ? 'rgba(95,84,62,.45)' : 'rgba(68,77,60,.45)'; c.lineWidth = .7;
    c.beginPath(); c.moveTo(x-s*.15,y-s*.7); c.lineTo(x-s*.34,y-s*.17); c.lineTo(x-s*.15,y+s*.06); c.stroke();
    if (!dry) oval(c,x-s*.62,y+s*.27,s*.24,s*.12,'#727d42');
  }
  function drawTerrain(c, d) {
    const { W, H, TILE: t, COLS: cols, ROWS: rows, BAL: b } = d, th = d.theme || {};
    const dry = !!th.cliff, features = b.FEATS || [], roads = (b.ROADS || [b.ROAD]).filter(Boolean);
    const base = c.createLinearGradient(0, 0, W * .6, H);
    base.addColorStop(0,dry?'#b7ac82':'#929d64'); base.addColorStop(.48,dry?'#aa9e74':'#89945b'); base.addColorStop(1,dry?'#a39870':'#7e8b53');
    c.fillStyle = base; c.fillRect(0,0,W,H);
    if (!dry && ready(grass)) {
      c.save(); c.globalAlpha = .12;
      for (let y=0;y<H;y+=384) for(let x=0;x<W;x+=384) c.drawImage(grass,x,y,384,384);
      c.restore(); c.fillStyle='rgba(125,133,72,.12)'; c.fillRect(0,0,W,H);
    }
    // Stable coordinate hashes add fine grass and soil grain without game RNG.
    for(let y=0;y<rows;y++) for(let x=0;x<cols;x++) {
      oval(c,(x+.45)*t,(y+.5)*t,t*.48,t*.35,dry?'rgba(139,124,83,.035)':'rgba(171,175,108,.045)');
      for(let k=0;k<7;k++) {
        const px=(x+hash(x,y,k+1))*t,py=(y+hash(x,y,k+11))*t;
        c.fillStyle=k%2?(dry?'rgba(230,214,169,.18)':'rgba(191,196,130,.17)'):(dry?'rgba(102,93,59,.12)':'rgba(54,75,31,.13)');
        c.fillRect(px,py,1+hash(y,x,k)*1.5,.7);
        if(k<2&&!dry){c.strokeStyle='rgba(71,91,40,.22)';c.lineWidth=.6;c.beginPath();c.moveTo(px-1.5,py+1);c.lineTo(px,py-2);c.lineTo(px+1,py+1);c.stroke();}
      }
      if(!dry&&hash(x,y,31)>.965) prop(c,3,(x+.5)*t,(y+.75)*t,t*.38,t*.3,.65);
    }
    // Rivers keep rectangular logical banks; reeds dress only their edges.
    features.filter(f=>f.t==='river').forEach(f=>{
      const x=f.x0*t,y=f.y0*t,w=(f.x1-f.x0+1)*t,h=(f.y1-f.y0+1)*t;
      c.fillStyle=dry?'#8c8c65':'#6e7c46';c.fillRect(x-3,y-3,w+6,h+6);
      c.fillStyle='#b0a77f';c.fillRect(x-1,y-1,w+2,h+2);
      const water=c.createLinearGradient(x,y,x,y+h);water.addColorStop(0,'#5f7b78');water.addColorStop(.35,'#78938a');water.addColorStop(1,'#557775');
      c.fillStyle=water;c.fillRect(x+2,y+2,w-4,h-4);c.fillStyle='rgba(37,58,42,.21)';c.fillRect(x+2,y+2,w-4,5);
      for(let i=0;i<Math.max(8,w*h/350);i++){
        const xx=x+5+hash(i,2)*Math.max(1,w-26),yy=y+5+hash(i,6)*(h-10);
        c.strokeStyle=i%3?'rgba(188,203,176,.23)':'rgba(220,225,198,.38)';c.lineWidth=i%3?.7:1.1;c.beginPath();c.moveTo(xx,yy);c.quadraticCurveTo(xx+7,yy+1.3,xx+17,yy-.7);c.stroke();
      }
      for(let i=0;i<Math.floor(w/(t*.9));i++){
        const xx=x+10+i*t*.9;
        if(hash(i,f.y0,16)>.37)prop(c,7,xx,y+7,t*.42,t*.36);
        if(hash(i,f.y1,17)>.52)prop(c,7,xx+5,y+h+4,t*.38,t*.34);
      }
    });
    features.filter(f=>f.t!=='river').forEach(f=>{
      for(let y=f.y0;y<=f.y1;y++)for(let x=f.x0;x<=f.x1;x++){
        const px=(x+.5)*t,py=(y+.65)*t;
        if(f.t==='forest'){
          c.fillStyle=dry?'rgba(92,91,48,.1)':'rgba(58,76,29,.12)';c.fillRect(x*t,y*t,t,t);
          tree(c,px+(hash(x,y)-.5)*5,(y+.92)*t,t*(.39+hash(x,y,1)*.055),dry,hash(x,y,9)>.61);
        }
        if(f.t==='rock')rock(c,px,py,t*.44,dry);
        if(f.t==='wall'){
          rr(c,x*t+1,y*t+6,t-2,t-5,1.4,'#777565','#5b5b4d');
          rr(c,x*t+1,y*t+1,t-2,t-9,1.2,dry?'#bcb194':'#b3b49d','#888975');
          for(let k=0;k<3;k++){
            const yy=y*t+3+k*7,offset=k%2?8:0;
            c.strokeStyle='rgba(90,91,74,.55)';c.lineWidth=.8;c.beginPath();c.moveTo(x*t+3,yy+6);c.lineTo((x+1)*t-3,yy+6);
            for(let xx=x*t+9+offset;xx<(x+1)*t-2;xx+=15){c.moveTo(xx,yy);c.lineTo(xx,yy+6);}c.stroke();
          }
          c.fillStyle='rgba(222,218,185,.6)';c.fillRect(x*t+3,y*t+2,t-6,1.5);oval(c,px-6,(y+1)*t-4,5,1.7,'rgba(94,106,58,.58)');
        }
      }
    });
    roads.forEach(rd=>{
      const x=rd.x0*t,y=rd.y0*t,w=(rd.x1-rd.x0+1)*t,h=(rd.y1-rd.y0+1)*t,vert=h>=w;
      c.fillStyle=dry?'#928561':'#79834c';c.fillRect(x-1,y,w+2,h);c.fillStyle=dry?'#b5a17a':'#b8ad83';c.fillRect(x,y,w,h);
      c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
      for(let yy=0;yy<h;yy+=7)for(let xx=0;xx<w;xx+=8){
        const px=x+xx+hash(xx,yy,2)*5,py=y+yy+hash(xx,yy,3)*5;
        c.fillStyle=hash(xx,yy,4)>.5?'rgba(223,212,173,.3)':'rgba(112,100,65,.14)';c.fillRect(px,py,1.3+hash(xx,yy)*2.1,.8);
        if(hash(xx,yy,6)>.94)oval(c,px,py,2.4,1.2,'#a39e83');
      }
      c.strokeStyle='rgba(111,98,64,.2)';c.lineWidth=2;
      for(const fraction of [.29,.71]){
        c.beginPath();
        if(vert){c.moveTo(x+w*fraction,y);c.bezierCurveTo(x+w*fraction-2,y+h*.3,x+w*fraction+2,y+h*.7,x+w*fraction,y+h);}
        else{c.moveTo(x,y+h*fraction);c.bezierCurveTo(x+w*.3,y+h*fraction-2,x+w*.7,y+h*fraction+2,x+w,y+h*fraction);}c.stroke();
      }
      c.restore();c.strokeStyle='rgba(221,211,168,.23)';c.lineWidth=1;c.strokeRect(x+.5,y+.5,w-1,h-1);
    });
    features.filter(f=>f.t==='river').forEach(rv=>roads.forEach(rd=>{
      const x0=Math.max(rv.x0,rd.x0),x1=Math.min(rv.x1,rd.x1),y0=Math.max(rv.y0,rd.y0),y1=Math.min(rv.y1,rd.y1);
      if(x0>x1||y0>y1)return;
      const vert=rd.y1-rd.y0>=rd.x1-rd.x0,x=x0*t-(vert?0:5),y=y0*t-(vert?5:0),w=(x1-x0+1)*t+(vert?0:10),h=(y1-y0+1)*t+(vert?10:0);
      rr(c,x-3,y+4,w+6,h+4,1,'rgba(36,45,32,.3)');rr(c,x,y,w,h,1,'#796448','#5c503a');
      if(vert)for(let yy=y+2;yy<y+h-3;yy+=7)rr(c,x+3,yy,w-6,6,.5,yy%3?'#a48e63':'#b4a074','#7e6f50');
      else for(let xx=x+2;xx<x+w-3;xx+=7)rr(c,xx,y+3,6,h-6,.5,xx%3?'#a48e63':'#b4a074','#7e6f50');
      const post=(px,py)=>{rr(c,px-2,py-4,5,10,.5,'#756447','#554a35');rr(c,px-2.5,py-5,6,2,.4,'#c4b38b','#807254');};
      if(vert){rr(c,x-1,y,2,h,.5,'#b9a77e');rr(c,x+w-1,y,2,h,.5,'#b9a77e');for(let yy=y+5;yy<y+h;yy+=22){post(x,yy);post(x+w,yy);}}
      else{rr(c,x,y-1,w,2,.5,'#b9a77e');rr(c,x,y+h-1,w,2,.5,'#b9a77e');for(let xx=x+5;xx<x+w;xx+=22){post(xx,y);post(xx,y+h);}}
    }));
    const deposits=new Set();
    (b.GAS_ZONES||[]).concat(b.BASE_GAS||[]).forEach(([gx,gy])=>{
      if(deposits.has(gx+','+gy))return;deposits.add(gx+','+gy);
      const x=gx*t,y=gy*t,s=2*t,cx=x+t,cy=y+t;
      // A survey outline shows the exact 2 x 2 construction area without
      // turning the natural ore deposit into a raised interface tile.
      c.save();c.strokeStyle=dry?'rgba(156,119,48,.38)':'rgba(149,125,53,.36)';c.lineWidth=.8;c.setLineDash([3,3]);c.strokeRect(x+2,y+2,s-4,s-4);c.restore();
      goldDeposit(c,cx,cy,t,dry);
    });
    c.strokeStyle=dry?'rgba(86,72,43,.065)':'rgba(52,70,30,.06)';c.lineWidth=.6;
    for(let x=0;x<=cols;x++){c.beginPath();c.moveTo(x*t,0);c.lineTo(x*t,H);c.stroke();}
    for(let y=0;y<=rows;y++){c.beginPath();c.moveTo(0,y*t);c.lineTo(W,y*t);c.stroke();}
    c.strokeStyle=dry?'#746c4d':'#586540';c.lineWidth=4;c.strokeRect(2,2,W-4,H-4);c.strokeStyle=dry?'#c5b58b':'#a9ae78';c.lineWidth=1;c.strokeRect(5,5,W-10,H-10);
  }
  window.RoyalWorld = { version: '2026.10.24.gold7', drawTerrain };
})();
