/* Kingdom Craft · original late-medieval atlas art · 2026-10-24.
   This renderer only reads presentation state. It never writes to a unit,
   building, command, balance value or the simulation random generator.
   World positions / selection / HP / fog stay owned by the game renderer. */
(function (global) {
  'use strict';
  const PI = Math.PI, TAU = PI * 2;
  const INK = '#35494b';
  const TEAM = {
    blue: { main: '#4f8194', dark: '#304b5b', light: '#8ab0bc', pale: '#ccd9d9', trim: '#b4b69c' },
    red:  { main: '#b96e60', dark: '#734d49', light: '#dba798', pale: '#e6d0c5', trim: '#b4b69c' }
  };
  const STONE = ['#e0e2d4', '#bcc6bd', '#7b9190'];
  const WOOD = ['#c4b18a', '#96866b', '#5c6258'];
  const STEEL = ['#e3e9e2', '#a9bdbd', '#667f86'];
  const caches = new Map();
  const atlases = {
    buildings: { src:'assets/royal/tribal-buildings-v5.png', cols:4, rows:3,
      rowEdges:[0,445/1254,795/1254,1], image:null, cells:[], ready:false },
    units: { src:'assets/royal/tribal-units-v5.png', cols:5, rows:2, image:null, cells:[], ready:false },
    workers: { src:'assets/royal/tribal-workers-v6.png', cols:2, rows:2, image:null, cells:[], ready:false }
  };
  const buildingCells={hall:0,mine:3,elixirBase:3,barracks:4,archery:5,assaultBarracks:6,
    workshop:7,sanctum:8,tower:9,guardTower:10,arcaneTower:11};
  const unitCells={footman:0,archer:1,cavalry:2,ram:3,mage:4};
  const unitHeights={footman:2.6,archer:2.65,cavalry:2.65,ram:1.9,mage:2.75,worker:2.6};

  /* Generated sheets leave transparent space between objects but are not a
     mathematically exact grid: a lance can cross the next object's bounding
     rectangle. Isolate connected alpha silhouettes so neighboring artwork
     never leaks into that rectangle. The largest objects are sorted by rows,
     then left to right, to retain the documented building/unit sequence. */
  function isolateSprites(atlas,scan,ctx) {
    const w=atlas.image.naturalWidth,h=atlas.image.naturalHeight;
    scan.width=w;scan.height=h;ctx.drawImage(atlas.image,0,0);
    const rgba=ctx.getImageData(0,0,w,h).data;
    const labels=new Int32Array(w*h),queue=new Int32Array(w*h),parts=[];
    let serial=0;
    for(let start=0;start<labels.length;start++){
      if(labels[start]||rgba[start*4+3]<30)continue;
      const id=++serial;let head=0,tail=1,left=w,right=0,top=h,bottom=0;
      queue[0]=start;labels[start]=id;
      while(head<tail){
        const i=queue[head++],x=i%w,y=Math.floor(i/w);
        left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
        if(x>0&&labels[i-1]===0&&rgba[(i-1)*4+3]>=30){labels[i-1]=id;queue[tail++]=i-1;}
        if(x<w-1&&labels[i+1]===0&&rgba[(i+1)*4+3]>=30){labels[i+1]=id;queue[tail++]=i+1;}
        if(y>0&&labels[i-w]===0&&rgba[(i-w)*4+3]>=30){labels[i-w]=id;queue[tail++]=i-w;}
        if(y<h-1&&labels[i+w]===0&&rgba[(i+w)*4+3]>=30){labels[i+w]=id;queue[tail++]=i+w;}
      }
      if(tail>=500)parts.push({id,count:tail,left,right,top,bottom});
    }
    const expected=atlas.cols*atlas.rows;if(parts.length<expected)return null;
    const largest=parts.sort((a,b)=>b.count-a.count).slice(0,expected)
      .sort((a,b)=>(a.top+a.bottom)-(b.top+b.bottom));
    const ordered=[];
    for(let row=0;row<atlas.rows;row++)ordered.push(...largest.slice(row*atlas.cols,(row+1)*atlas.cols)
      .sort((a,b)=>(a.left+a.right)-(b.left+b.right)));
    return ordered.map(part=>{
      const pad=Math.ceil(Math.max(part.right-part.left+1,part.bottom-part.top+1)*.025);
      const left=Math.max(0,part.left-pad),top=Math.max(0,part.top-pad);
      const sw=Math.min(w-1,part.right+pad)-left+1,sh=Math.min(h-1,part.bottom+pad)-top+1;
      const image=document.createElement('canvas');image.width=sw;image.height=sh;
      const painter=image.getContext('2d'),pixels=painter.createImageData(sw,sh);
      for(let y=part.top;y<=part.bottom;y++)for(let x=part.left;x<=part.right;x++){
        const i=y*w+x;if(labels[i]!==part.id)continue;
        const source=i*4,dest=((y-top)*sw+x-left)*4;
        pixels.data[dest]=rgba[source];pixels.data[dest+1]=rgba[source+1];
        pixels.data[dest+2]=rgba[source+2];pixels.data[dest+3]=rgba[source+3];
      }
      painter.putImageData(pixels,0,0);
      return {image,x:0,y:0,w:sw,h:sh};
    });
  }

  /* Read alpha once when an atlas arrives. Each sprite keeps its own aspect
     ratio, without carrying the empty grid-cell padding into the battlefield.
     The original canvas art remains available during loading or on failure. */
  function loadAtlas(name) {
    if(typeof global.Image!=='function'||typeof document==='undefined')return;
    const atlas=atlases[name],img=new global.Image();atlas.image=img;
    img.onload=function(){
      if(!img.naturalWidth||!img.naturalHeight)return;
      try{
        const scan=document.createElement('canvas');
        const ctx=scan.getContext('2d',{willReadFrequently:true});
        let cells=isolateSprites(atlas,scan,ctx);
        if(!cells){
        cells=[];
        for(let n=0;n<atlas.cols*atlas.rows;n++){
          const column=n%atlas.cols,row=Math.floor(n/atlas.cols);
          const sx=Math.floor(column*img.naturalWidth/atlas.cols);
          // The generated building sheet has three measured row bands. Its
          // tallest lower-row towers begin above the nominal one-third line.
          const sy=atlas.rowEdges?Math.round(atlas.rowEdges[row]*img.naturalHeight):Math.floor(row*img.naturalHeight/atlas.rows);
          const endY=atlas.rowEdges?Math.round(atlas.rowEdges[row+1]*img.naturalHeight):Math.floor((row+1)*img.naturalHeight/atlas.rows);
          const cellW=Math.floor((column+1)*img.naturalWidth/atlas.cols)-sx,cellH=endY-sy;
          scan.width=cellW;scan.height=cellH;
          ctx.clearRect(0,0,cellW,cellH);ctx.drawImage(img,sx,sy,cellW,cellH,0,0,cellW,cellH);
          const rgba=ctx.getImageData(0,0,cellW,cellH).data;
          let left=cellW,top=cellH,right=-1,bottom=-1;
          for(let y=0;y<cellH;y++)for(let x=0;x<cellW;x++){
            if(rgba[(y*cellW+x)*4+3]<=20)continue;
            left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
          }
          if(right<left||bottom<top){cells.push(null);continue;}
          const pad=Math.ceil(Math.max(right-left+1,bottom-top+1)*.025);
          left=Math.max(0,left-pad);top=Math.max(0,top-pad);
          right=Math.min(cellW-1,right+pad);bottom=Math.min(cellH-1,bottom+pad);
          cells.push({x:sx+left,y:sy+top,w:right-left+1,h:bottom-top+1});
        }
        }
        atlas.cells=cells;atlas.ready=cells.some(Boolean);caches.clear();
      }catch(_){atlas.ready=false;atlas.cells=[];}
      if(atlas.ready&&typeof global.onRoyalArtReady==='function')global.onRoyalArtReady(name);
    };
    img.src=atlas.src;
  }
  function atlasCell(atlas,n){return atlas.ready&&atlas.cells[n]||null;}

  function drawAtlasUnit(c,u,team,bob,d) {
    const isWorker=u.key==='worker',atlas=isWorker?atlases.workers:atlases.units;
    const rear=d===5||d===6||d===7;
    // Workers have two transport states, each with a front and rear view.
    const index=isWorker?(u.cargo>0?1:0)+(rear?2:0):unitCells[u.key]+(rear?5:0);
    const cell=atlasCell(atlas,index);if(!cell)return false;
    const h=u.r*unitHeights[u.key],w=h*cell.w/cell.h;
    const foot=u.r*.75-(bob||0);
    const speed=u.spd>0?Math.min(1,(u.vel||0)/u.spd):0;
    const lean=u.key==='ram'?0:Math.sin(u.gait||0)*speed*.014;
    c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    if(d>=3&&d<=5)c.scale(-1,1);
    // Only two illustrated views exist; gait is a restrained presentation sway.
    c.translate(0,foot);c.transform(1,0,lean,1,0,0);
    c.drawImage(cell.image||atlas.image,cell.x,cell.y,cell.w,cell.h,-w*.5,-h,w,h);
    const T=team?TEAM.blue:TEAM.red;
    // A small cloth tab and the game's ground ring identify friend/foe without
    // recoloring the historically neutral stone, steel and leather artwork.
    c.fillStyle=T.dark;c.fillRect(-u.r*.55,-h*.42,u.r*.32,u.r*.3);
    c.fillStyle=T.main;c.fillRect(-u.r*.53,-h*.42,u.r*.25,u.r*.24);
    c.restore();return true;
  }

  function makeAtlasBuilding(key,level,tier,team) {
    const atlas=atlases.buildings;
    const n=key==='hall'?tier-1:buildingCells[key],cell=atlasCell(atlas,n);
    if(!cell)return null;
    const cacheKey=['atlas',key,team?1:0,tier,level].join(':');
    let cache=caches.get(cacheKey);if(cache)return cache;
    cache=document.createElement('canvas');cache.width=320;cache.height=352;
    const a=cache.getContext('2d');a.imageSmoothingEnabled=true;a.imageSmoothingQuality='high';
    const scale=Math.min(288/cell.w,318/cell.h),w=cell.w*scale,h=cell.h*scale;
    const x=(cache.width-w)*.5,y=cache.height-17-h;
    a.drawImage(cell.image||atlas.image,cell.x,cell.y,cell.w,cell.h,x,y,w,h);
    const T=team?TEAM.blue:TEAM.red;
    // Team colors follow current friendliness, including the network guest.
    // The flag stands next to the entrance; roof and masonry stay neutral.
    const flagX=Math.min(292,x+w*.83),flagY=Math.max(36,y+h*.36);
    line(a,[[flagX,flagY+60],[flagX,flagY-6]],'#4e3825',3.2);
    poly(a,[[flagX+2,flagY],[flagX+30,flagY+3],[flagX+25,flagY+23],[flagX+2,flagY+20]],T.dark,'#3b2d22',1.2);
    poly(a,[[flagX+3,flagY+1],[flagX+27,flagY+4],[flagX+23,flagY+18],[flagX+3,flagY+17]],T.main);
    line(a,[[flagX+5,flagY+3],[flagX+5,flagY+16]],T.light,1.5);
    // The level marker is also cached; simulation level and tier are read only.
    const count=Math.max(1,Math.min(5,Math.floor(level)||1));
    for(let k=0;k<count;k++)rect(a,141+(k-(count-1)*.5)*8,335,5,4,.6,'#c8a15c','#5a432b',.6);
    caches.set(cacheKey,cache);return cache;
  }

  function linear(c, x, y, x2, y2, stops) {
    const g = c.createLinearGradient(x, y, x2, y2);
    stops.forEach((v, i) => g.addColorStop(i / (stops.length - 1), v));
    return g;
  }
  function rr(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }
  function finish(c, fill, stroke, width) {
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width || 1; c.stroke(); }
  }
  function rect(c, x, y, w, h, r, fill, stroke, width) {
    rr(c, x, y, w, h, r); finish(c, fill, stroke, width);
  }
  function poly(c, points, fill, stroke, width) {
    c.beginPath(); c.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) c.lineTo(points[i][0], points[i][1]);
    c.closePath(); finish(c, fill, stroke, width);
  }
  function ellipse(c, x, y, rx, ry, fill, stroke, width, rotation) {
    c.beginPath(); c.ellipse(x, y, rx, ry, rotation || 0, 0, TAU);
    finish(c, fill, stroke, width);
  }
  function line(c, points, color, width) {
    c.beginPath(); c.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) c.lineTo(points[i][0], points[i][1]);
    c.strokeStyle = color; c.lineWidth = width; c.stroke();
  }
  function sphere(c, x, y, r, colors, outline, width) {
    const g = c.createRadialGradient(x-r*.2, y-r*.3, r*.25, x+r*.12, y+r*.15, r*1.3);
    colors.forEach((v, i) => g.addColorStop(i / (colors.length - 1), v));
    ellipse(c, x, y, r, r, g, outline, width);
  }
  function star(c, x, y, r, color) {
    poly(c, [[x,y-r],[x+r*.24,y-r*.2],[x+r,y],[x+r*.24,y+r*.22],
      [x,y+r],[x-r*.22,y+r*.22],[x-r,y],[x-r*.24,y-r*.2]], color);
  }
  function shield(c, x, y, w, h, T, outline) {
    const points = [[x-w*.5,y-h*.5],[x+w*.5,y-h*.5],[x+w*.45,y+h*.13],
      [x+w*.23,y+h*.4],[x,y+h*.56],[x-w*.3,y+h*.36],[x-w*.48,y+h*.08]];
    poly(c, points, linear(c,x-w*.5,y-h*.5,x+w*.5,y+h*.5,STEEL), outline, w*.09);
    c.save(); c.translate(x,y); c.scale(.73,.73);
    poly(c, points.map(p => [p[0]-x,p[1]-y]), linear(c,-w*.4,-h*.4,w*.4,h*.5,[T.light,T.main,T.dark]));
    poly(c, [[-.05*w,-.32*h],[.05*w,-.32*h],[.05*w,.04*h],[.22*w,.04*h],
      [.22*w,.15*h],[.05*w,.15*h],[.05*w,.38*h],[-.05*w,.38*h],[-.05*w,.15*h],[-.22*w,.15*h],[-.22*w,.04*h],[-.05*w,.04*h]], '#ffe7a1');
    c.restore();
  }

  /* Units use normalized body coordinates; one unit = collision radius.
     Tactical miniatures use small heads, broad equipment silhouettes and
     restrained planar materials. Gait and heading are presentation inputs. */
  function feet(c,u,bob,T,boot) {
    const speed=u.spd>0?Math.min(1,(u.vel||0)/u.spd):0;
    const gait=Math.sin(u.gait||0)*speed,fy=.9-bob/(u.r||10);
    for(const s of [-1,1]){
      const x=s*.24-s*gait*.21,y=fy-Math.max(0,s*gait)*.13;
      line(c,[[s*.23,.31],[x,y-.08]],T.dark,.21);
      poly(c,[[x-.12,y-.16],[x+.11,y-.16],[x+.19,y+.02],[x-.13,y+.04]],boot||'#4f5750',INK,.045);
      line(c,[[x-.1,y-.12],[x+.09,y-.12]],'#8e998c',.035);
    }
    return gait;
  }
  function eyes(c,x,y,gap,sideView) {
    line(c,[[x-gap-.025,y],[x-gap+.045,y]],'#344340',.04);
    if(!sideView)line(c,[[x+gap-.04,y],[x+gap+.03,y]],'#344340',.04);
  }
  function fieldFace(c,x,y,r,rear) {
    poly(c,[[x-r*.8,y-r*.7],[x+r*.65,y-r*.7],[x+r*.8,y+r*.35],[x+r*.3,y+r*.8],[x-r*.4,y+r*.75],[x-r*.85,y+r*.15]],'#cdb49a',INK,.045);
    poly(c,[[x+r*.38,y-r*.63],[x+r*.65,y-r*.7],[x+r*.8,y+r*.35],[x+r*.3,y+r*.8],[x+r*.15,y+r*.2]],'#a48f7d');
    if(!rear)eyes(c,x,y+r*.02,r*.33,false);
  }
  /* Low steel skullcap, clear visor band and nape; no plume or ornament. */
  function helmet(c,T,rear,x,y,scale) {
    c.save();c.translate(x||0,y||0);c.scale(scale||1,scale||1);
    fieldFace(c,0,-.68,.36,rear);
    poly(c,[[-.4,-.7],[-.38,-1.03],[-.21,-1.18],[.18,-1.18],[.37,-1.03],[.4,-.7]],STEEL[1],INK,.065);
    poly(c,[[-.38,-1.03],[-.21,-1.18],[.025,-1.18],[.025,-.79],[-.39,-.79]],STEEL[0]);
    poly(c,[[.2,-1.16],[.37,-1.03],[.4,-.7],[.16,-.71]],STEEL[2]);
    line(c,[[-.41,-.74],[.41,-.74]],INK,.085);
    if(rear){
      poly(c,[[-.36,-.77],[.36,-.77],[.31,-.39],[-.29,-.39]],STEEL[2],INK,.05);
      line(c,[[-.29,-.44],[.27,-.44]],STEEL[1],.045);
    }else{
      poly(c,[[-.36,-.72],[-.26,-.72],[-.24,-.41],[-.36,-.48]],STEEL[2],INK,.035);
      poly(c,[[.27,-.71],[.37,-.71],[.35,-.48],[.24,-.4]],STEEL[2],INK,.035);
      rect(c,-.24,-.73,.48,.08,.01,'#344b50');
    }
    c.restore();
  }
  function fieldShield(c,x,y,T) {
    poly(c,[[x-.38,y-.48],[x+.35,y-.48],[x+.38,y+.19],[x,y+.59],[x-.38,y+.23]],STEEL[2],INK,.065);
    poly(c,[[x-.29,y-.39],[x+.27,y-.39],[x+.29,y+.15],[x,y+.47],[x-.28,y+.18]],T.main,INK,.03);
    poly(c,[[x+.05,y-.38],[x+.27,y-.39],[x+.29,y+.15],[x,y+.47],[x+.02,y+.19]],T.dark);
    line(c,[[x-.26,y-.34],[x-.25,y+.14]],T.light,.05);
    ellipse(c,x,y,.075,.075,STEEL[1],INK,.03);
  }
  function footman(c,u,T,bob,rear) {
    const gait=feet(c,u,bob,T);
    poly(c,[[-.43,-.27],[.43,-.27],[.45,.35],[.31,.57],[-.34,.57],[-.46,.35]],T.main,INK,.06);
    poly(c,[[-.34,-.25],[.34,-.25],[.29,.19],[0,.33],[-.31,.2]],STEEL[1],INK,.05);
    poly(c,[[.09,-.23],[.34,-.25],[.29,.19],[0,.33],[.02,.11]],STEEL[2]);
    poly(c,[[-.53,-.25],[-.32,-.34],[-.22,-.1],[-.48,.03]],STEEL[1],INK,.05);
    poly(c,[[.31,-.34],[.55,-.23],[.48,.03],[.23,-.1]],STEEL[2],INK,.05);
    rect(c,-.43,.32,.86,.1,.015,'#655f4e',INK,.035);
    rect(c,-.065,.31,.13,.13,.015,STEEL[1],INK,.03);
    if(rear){
      poly(c,[[-.33,-.27],[.34,-.27],[.39,.4],[.2,.52],[-.2,.51],[-.39,.4]],T.dark,INK,.045);
      line(c,[[-.24,-.17],[-.22,.36]],T.main,.075);
      line(c,[[0,-.15],[0,.32]],'#657a78',.035);
    }
    const sw=u.swing>0?Math.sin(Math.min(1,u.swing/.28)*PI):0;
    c.save();c.translate(.49,-.03);c.rotate(-.12-sw*1.45+gait*.045);
    line(c,[[0,0],[.07,.27]],STEEL[2],.2);
    ellipse(c,.07,.26,.105,.115,'#c3aa8d',INK,.04);
    rect(c,.02,-.25,.1,.48,.015,'#766b55',INK,.035);
    rect(c,-.13,-.27,.39,.075,.01,STEEL[2],INK,.04);
    poly(c,[[.02,-.27],[.005,-1.0],[.075,-1.2],[.155,-1.0],[.12,-.27]],STEEL[0],INK,.045);
    poly(c,[[.075,-1.15],[.155,-1.0],[.12,-.28],[.075,-.28]],STEEL[2]);
    c.restore();helmet(c,T,rear,0,0,1);
    line(c,[[-.43,-.03],[-.57,.2]],T.dark,.21);
    fieldShield(c,-.58+gait*.03,.16,T);
  }
  function archer(c,u,T,bob,rear,direction) {
    const gait=feet(c,u,bob,T,'#5c5c4d');
    poly(c,[[-.4,-.3],[.4,-.3],[.49,.46],[.29,.64],[-.37,.59],[-.49,.39]],T.main,INK,.055);
    poly(c,[[.17,-.27],[.4,-.3],[.49,.46],[.29,.64],[.21,.38]],T.dark);
    poly(c,[[-.27,-.14],[.24,-.14],[.27,.38],[-.29,.38]],'#9a9b7c',INK,.04);
    line(c,[[-.29,-.16],[.24,.31]],'#615f4c',.085);
    rect(c,-.34,.34,.68,.085,.01,'#5e5e4d',INK,.035);
    c.save();c.translate(-.44,.015);c.rotate(-.2);
    rect(c,-.1,-.34,.22,.79,.035,'#8d7e5e',INK,.05);
    for(let i=0;i<3;i++){
      line(c,[[i*.085-.08,-.23],[i*.085-.08,-.78-i*.04]],'#a18f68',.04);
      poly(c,[[i*.085-.13,-.63-i*.04],[i*.085-.08,-.84-i*.04],[i*.085-.025,-.63-i*.04]],'#c8d0bc',INK,.02);
    }c.restore();
    fieldFace(c,0,-.7,.35,rear);
    /* Close-fitting field hood: a dark face opening and no feather. */
    poly(c,[[-.41,-.42],[-.43,-.94],[-.25,-1.19],[.12,-1.24],[.4,-1.0],[.44,-.4],[.25,-.36],[.21,-.9],[-.02,-1.03],[-.26,-.84],[-.25,-.36]],'#626f5c',INK,.06);
    poly(c,[[-.41,-.42],[-.43,-.94],[-.25,-1.19],[.12,-1.24],[-.09,-1.07],[-.33,-.84],[-.27,-.4]],'#91a28a');
    if(rear){
      poly(c,[[-.34,-.96],[-.11,-1.16],[.24,-1.08],[.34,-.87],[.3,-.39],[-.3,-.4]],'#65765f',INK,.04);
      line(c,[[0,-1.08],[.025,-.47]],'#81927a',.045);
      poly(c,[[-.37,-.3],[.34,-.3],[.44,.43],[.13,.55],[-.4,.43]],T.dark,INK,.04);
    }
    const sw=u.swing>0?Math.sin(Math.min(1,u.swing/.28)*PI):0;
    c.save();
    if(direction===6){c.translate(.51,-.29);c.rotate(-PI/2);}
    else if(direction===2){c.translate(.49,.21);c.rotate(PI/2);}
    else{c.translate(.68,-.04);if(direction===5||direction===7)c.rotate(-.3);else if(direction===1||direction===3)c.rotate(.16);}
    c.beginPath();c.moveTo(.03,-.86);c.bezierCurveTo(.65,-.56,.65,.53,.03,.86);
    c.strokeStyle=INK;c.lineWidth=.125;c.stroke();c.strokeStyle='#af9c72';c.lineWidth=.075;c.stroke();
    line(c,[[.03,-.86],[-.22-sw*.3,0],[.03,.86]],'#d9dfcd',.028);
    line(c,[[-.27-sw*.28,0],[.82,0]],'#958c68',.04);
    poly(c,[[.76,-.07],[1.0,0],[.76,.07]],STEEL[1],INK,.025);
    ellipse(c,-.13-sw*.17,0,.1,.11,'#c3aa8d',INK,.035);c.restore();
  }
  function mage(c,u,T,bob,rear) {
    feet(c,u,bob,T,'#4d5b5a');
    /* Long, straight robe and a shadowed hood keep the caster compact. */
    poly(c,[[-.37,-.34],[.38,-.34],[.48,.84],[.15,.95],[-.12,.87],[-.46,.94]],T.main,INK,.06);
    poly(c,[[.1,-.31],[.38,-.34],[.48,.84],[.15,.95],[.1,.34]],T.dark);
    poly(c,[[-.095,-.25],[.08,-.25],[.12,.83],[-.14,.83]],'#a0b7b3',INK,.025);
    line(c,[[-.38,.79],[-.11,.83],[.15,.89],[.39,.82]],T.dark,.07);
    rect(c,-.34,.28,.69,.075,.01,'#58605a',INK,.035);
    poly(c,[[-.45,-.28],[-.47,-.98],[-.24,-1.35],[.12,-1.41],[.43,-1.08],[.45,-.29],[.27,-.2],[-.25,-.2]],'#526c73',INK,.065);
    poly(c,[[-.45,-.28],[-.47,-.98],[-.24,-1.35],[.12,-1.41],[-.14,-1.12],[-.28,-.82],[-.28,-.3]],'#879d9d');
    if(!rear){
      poly(c,[[-.25,-.79],[-.05,-1.1],[.23,-.82],[.2,-.43],[-.2,-.43]],'#2f4248',INK,.035);
      poly(c,[[-.135,-.7],[.14,-.7],[.1,-.46],[-.09,-.44]],'#b4a58c');
      line(c,[[-.18,-.73],[.18,-.73]],'#31454a',.07);
    }else{
      poly(c,[[-.3,-.93],[-.12,-1.23],[.2,-1.13],[.3,-.85],[.25,-.3],[-.26,-.3]],'#5e7b82',INK,.035);
      line(c,[[0,-1.2],[.025,-.35]],'#879f9f',.045);
      poly(c,[[-.31,-.24],[.3,-.24],[.39,.6],[0,.75],[-.37,.58]],T.dark,INK,.035);
    }
    const sw=u.swing>0?Math.sin(Math.min(1,u.swing/.28)*PI):0;
    c.save();c.translate(.58,.08);c.rotate(-.08-sw*.24);
    line(c,[[0,.68],[0,-1.48]],INK,.12);line(c,[[-.014,.65],[-.014,-1.48]],'#a7a68d',.06);
    ellipse(c,.005,.07,.1,.12,'#c3aa8d',INK,.04);
    if(sw>.1)ellipse(c,0,-1.58,.3,.37,'rgba(155,194,195,.18)');
    poly(c,[[0,-1.93],[.16,-1.59],[.1,-1.31],[-.1,-1.31],[-.16,-1.59]],'#76a8af',INK,.045);
    poly(c,[[0,-1.93],[0,-1.33],[-.1,-1.31],[-.16,-1.59]],'#bdceca');
    line(c,[[-.12,-1.3],[.12,-1.3]],STEEL[2],.07);c.restore();
  }
  function horseLeg(c,x,y,gait,ground,far) {
    line(c,[[x,y],[x+gait*.12,.5],[x+gait*.27,ground]],far?'#706951':'#9c8b68',far?.105:.155);
    poly(c,[[x+gait*.27-.09,ground-.08],[x+gait*.27+.08,ground-.08],[x+gait*.27+.13,ground+.025],[x+gait*.27-.1,ground+.025]],'#46544d',INK,.035);
  }
  function cavalry(c,u,T,bob,rear,direction) {
    if(direction===2||direction===6){cavalryVertical(c,u,T,bob,rear);return;}
    const speed=u.spd>0?Math.min(1,(u.vel||0)/u.spd):0,gait=Math.sin(u.gait||0)*speed,ground=1.03-bob/(u.r||14);
    horseLeg(c,-.64,.2,-gait,ground,true);horseLeg(c,.44,.16,gait,ground,true);
    c.beginPath();c.moveTo(-.81,-.01);c.quadraticCurveTo(-1.04,.04,-1.03,.45);
    c.lineTo(-1.17,.65);c.quadraticCurveTo(-.89,.71,-.86,.26);c.closePath();finish(c,'#5c5e4c',INK,.045);
    ellipse(c,-.03,.09,.88,.335,'#b19a75',INK,.06);
    c.beginPath();c.ellipse(-.01,.12,.8,.26,0,0,PI);c.closePath();finish(c,'#8e8061');
    poly(c,[[-.53,-.11],[.42,-.11],[.45,.37],[.03,.48],[-.51,.36]],T.main,INK,.05);
    line(c,[[-.43,.32],[.03,.41],[.36,.32]],T.dark,.06);
    horseLeg(c,-.62,.24,gait,ground,false);horseLeg(c,.43,.2,-gait,ground,false);
    poly(c,[[.43,.19],[.49,-.43],[.77,-.86],[.95,-.75],[.9,-.21],[.79,.28]],'#bba582',INK,.06);
    poly(c,[[.48,-.04],[.52,-.5],[.78,-.9],[.94,-.82],[.75,-.54],[.6,.04]],'#5d654f',INK,.035);
    ellipse(c,1.01,-.7,.35,.18,'#b7a17b',INK,.055,-.26);
    poly(c,[[.85,-.83],[.86,-1.08],[.99,-.94],[1,-.8]],'#aa9978',INK,.04);
    ellipse(c,1.24,-.62,.145,.115,'#c6b599',INK,.035);ellipse(c,1.1,-.75,.035,.04,'#344b45');
    line(c,[[.91,-.72],[1.04,-.51],[1.35,-.62]],'#686c53',.04);
    line(c,[[1.06,-.5],[.48,-.2],[.15,-.49]],'#4b5c4f',.035);
    poly(c,[[-.29,-.69],[.24,-.69],[.26,-.11],[-.28,-.11]],T.main,INK,.055);
    poly(c,[[-.22,-.66],[.2,-.66],[.15,-.3],[-.18,-.26]],STEEL[1],INK,.035);
    line(c,[[-.2,-.08],[-.21,.28]],T.dark,.18);helmet(c,T,rear,-.03,-.68,.63);
    const sw=u.swing>0?Math.sin(Math.min(1,u.swing/.28)*PI):0;
    c.save();c.translate(.13,-.5);c.rotate(-.04+sw*.12);
    line(c,[[-.14,0],[1.57+sw*.34,0]],'#62694f',.09);line(c,[[-.1,-.02],[1.54+sw*.34,-.02]],'#b6af85',.035);
    const tip=1.5+sw*.34;poly(c,[[tip,-.085],[tip+.32,0],[tip,.085]],STEEL[1],INK,.035);
    poly(c,[[.61,.02],[.9,.08],[.62,.2]],T.main,INK,.02);
    ellipse(c,.015,.02,.095,.1,'#bfa88b',INK,.035);c.restore();
  }
  function cavalryVertical(c,u,T,bob,rear) {
    const speed=u.spd>0?Math.min(1,(u.vel||0)/u.spd):0,gait=Math.sin(u.gait||0)*speed,ground=1.03-bob/(u.r||14);
    for(const s of [-1,1])horseLeg(c,s*.27,-.01,-s*gait,ground-Math.max(0,s*gait)*.14,true);
    ellipse(c,0,.03,.46,.6,'#ab9671',INK,.06);
    if(rear){
      poly(c,[[-.2,-.3],[-.18,-.83],[0,-1.06],[.18,-.83],[.2,-.3]],'#af9b77',INK,.045);
      poly(c,[[-.12,-.85],[-.17,-1.12],[-.025,-.95]],'#737557',INK,.03);
      poly(c,[[.04,-.95],[.19,-1.12],[.15,-.84]],'#737557',INK,.03);
    }
    poly(c,[[-.44,-.2],[.43,-.2],[.47,.35],[.19,.51],[-.21,.51],[-.47,.34]],T.main,INK,.05);
    line(c,[[-.4,.3],[-.19,.45],[.18,.45],[.4,.3]],T.dark,.055);
    for(const s of [-1,1])horseLeg(c,s*.35,.27,s*gait,ground-Math.max(0,-s*gait)*.14,false);
    poly(c,[[-.25,-.76],[.25,-.76],[.25,-.16],[-.25,-.16]],T.main,INK,.05);
    if(!rear)poly(c,[[-.19,-.7],[.19,-.7],[.15,-.34],[0,-.27],[-.16,-.34]],STEEL[1],INK,.035);
    helmet(c,T,rear,0,-.68,.63);
    if(!rear){
      poly(c,[[-.2,-.55],[-.23,-.19],[-.17,.17],[0,.3],[.17,.17],[.23,-.19],[.2,-.55]],'#b9a37d',INK,.05);
      poly(c,[[-.16,-.53],[-.22,-.81],[-.065,-.6]],'#8b8b66',INK,.03);
      poly(c,[[.065,-.6],[.22,-.81],[.16,-.53]],'#8b8b66',INK,.03);
      poly(c,[[-.04,-.48],[.04,-.48],[.06,.15],[-.055,.15]],'#d4cfb4');
      ellipse(c,-.145,-.26,.028,.035,'#344b45');ellipse(c,.145,-.26,.028,.035,'#344b45');
      ellipse(c,0,.17,.17,.1,'#c0b094',INK,.03);line(c,[[-.2,-.03],[0,.04],[.2,-.03]],'#727559',.04);
    }else{
      poly(c,[[-.075,.29],[-.12,.74],[-.045,1.0],[.1,.9],[.08,.34]],'#5d654f',INK,.035);
      line(c,[[0,.36],[.01,.91]],'#8c8c66',.03);
    }
    const attack=u.swing>0?Math.sin(Math.min(1,u.swing/.28)*PI)*.24:0,end=rear?-1.83-attack:1.2+attack,sign=rear?-1:1;
    line(c,[[.49,-.53],[.49,end]],'#62694f',.09);line(c,[[.47,-.53],[.47,end]],'#b6af85',.035);
    poly(c,[[.405,end-sign*.03],[.49,end+sign*.25],[.575,end-sign*.03]],STEEL[1],INK,.03);
    poly(c,[[.5,-.41],[.75,-.27],[.5,-.16]],T.main,INK,.02);
    ellipse(c,.38,-.36,.085,.105,'#bfa88b',INK,.03);
  }
  function wheel(c,x,y,r,a) {
    c.save();c.translate(x,y);c.scale(1,.94);c.rotate(a);
    ellipse(c,0,0,r,r,'#8e8868',INK,.055);ellipse(c,0,0,r*.72,r*.72,'#565f4e',INK,.025);
    for(let i=0;i<6;i++){const q=i*TAU/6;line(c,[[0,0],[Math.cos(q)*r*.7,Math.sin(q)*r*.7]],'#b5aa83',.04);}
    ellipse(c,0,0,r*.19,r*.19,STEEL[2],INK,.025);c.restore();
  }
  function ram(c,u,T,bob,rear,direction) {
    if(direction===2||direction===6){ramVertical(c,u,T,rear);return;}
    const a=(u.gait||0)*2,sw=u.swing>0?Math.sin(Math.min(1,u.swing/.28)*PI):0,push=sw*.34;
    wheel(c,-.53,.43,.25,a);wheel(c,.52,.43,.25,a);
    poly(c,[[-.9,.26],[.74,.26],[.9,.08],[-.74,.08]],WOOD[1],INK,.05);
    rect(c,-.88,.25,1.63,.16,.015,WOOD[2],INK,.04);
    /* Open timber trestles expose the suspended striking beam. */
    for(const x of [-.58,.51]){
      line(c,[[x-.15,.21],[x,-.86],[x+.17,.21]],WOOD[2],.145);
      line(c,[[x-.14,.2],[x,-.84]],WOOD[0],.07);
    }
    line(c,[[-.62,-.84],[.58,-.84]],WOOD[1],.16);
    line(c,[[-.61,-.89],[.57,-.89]],WOOD[0],.035);
    line(c,[[-.52,-.8],[.5,.17]],WOOD[2],.065);
    line(c,[[-.46+push,-.73],[-.46+push,-.12]],'#687069',.035);
    line(c,[[.44+push,-.73],[.44+push,-.12]],'#687069',.035);
    rect(c,-.77+push,-.19,1.9,.28,.035,WOOD[1],INK,.055);
    line(c,[[-.71+push,-.12],[1.0+push,-.12]],WOOD[0],.04);
    for(const x of [-.41+push,.58+push])rect(c,x,-.2,.095,.3,.01,STEEL[2],INK,.025);
    poly(c,[[1.04+push,-.25],[1.25+push,-.18],[1.25+push,.12],[1.04+push,.15]],STEEL[2],INK,.05);
    line(c,[[1.12+push,-.2],[1.12+push,.1]],STEEL[1],.065);
    rect(c,-.3,-.84,.35,.18,.01,T.main,INK,.03);
    wheel(c,-.54,.51,.265,a);wheel(c,.53,.51,.265,a);
  }
  function ramVertical(c,u,T,rear) {
    const sw=u.swing>0?Math.sin(Math.min(1,u.swing/.28)*PI):0,sign=rear?-1:1,nose=(rear?-1.19:.92)+sign*sw*.31;
    const profileWheel=(x,y)=>{rect(c,x-.08,y-.25,.16,.5,.025,WOOD[2],INK,.04);rect(c,x-.06,y-.22,.12,.44,.015,WOOD[0],INK,.02);for(let i=0;i<3;i++)line(c,[[x-.055,y-.17+i*.16],[x+.055,y-.17+i*.16]],'#68705b',.03);};
    profileWheel(-.65,-.12);profileWheel(.65,-.12);
    rect(c,-.55,-.65,1.1,1.19,.02,WOOD[2],INK,.045);
    rect(c,-.47,-.57,.94,1.04,.015,WOOD[1],INK,.035);
    for(let i=0;i<4;i++)line(c,[[-.44,-.44+i*.25],[.44,-.44+i*.25]],WOOD[0],.035);
    /* Two thin A-frames and side rails leave a visible gap around the log. */
    for(const y of [-.63,.36]){
      line(c,[[-.53,y+.12],[-.29,y-.57],[.31,y-.57],[.54,y+.12]],WOOD[2],.13);
      line(c,[[-.5,y+.1],[-.27,y-.54],[.29,y-.54]],WOOD[0],.055);
    }
    line(c,[[-.3,-1.19],[-.3,-.22]],WOOD[1],.12);line(c,[[.3,-1.19],[.3,-.22]],WOOD[1],.12);
    line(c,[[-.3,-.96],[.3,-.22]],WOOD[2],.055);
    const tail=rear?.34:-.88,beamStart=Math.min(tail,nose),beamEnd=Math.max(tail,nose);
    rect(c,-.13,beamStart,.26,beamEnd-beamStart,.025,WOOD[1],INK,.045);
    line(c,[[-.06,beamStart+.04],[-.06,beamEnd-.04]],WOOD[0],.035);
    for(const y of [-.61,.15])rect(c,-.145,y,.29,.08,.01,STEEL[2],INK,.025);
    rect(c,-.19,nose-.115,.38,.23,.01,STEEL[2],INK,.045);line(c,[[-.15,nose-.06],[.15,nose-.06]],STEEL[1],.045);
    rect(c,-.28,-1.19,.56,.105,.01,T.main,INK,.03);
    profileWheel(-.65,.55);profileWheel(.65,.55);
    line(c,[[-.53,.57],[.53,.57]],WOOD[0],.09);
  }
  /* An unarmed laborer stays readable while the transport atlas loads. Cargo
     changes only its illustrated sack; rendering never changes the gold. */
  function worker(c,u,T,bob,rear) {
    const speed=u.spd>0?Math.min(1,(u.vel||0)/u.spd):0;
    const stride=Math.sin(u.gait||0)*speed,ground=.75-(bob||0)/u.r;
    for(const sign of [-1,1]){
      const x=sign*.19-sign*stride*.15,y=ground-Math.max(0,sign*stride)*.12;
      line(c,[[sign*.19,.11],[x,y-.09]],'#66513b',.2);
      poly(c,[[x-.105,y-.14],[x+.09,y-.14],[x+.14,y],[x-.115,y]],'#413a2e','#312d24',.04);
    }
    poly(c,[[-.34,-.95],[.29,-.95],[.39,.18],[.18,.3],[-.31,.24],[-.39,.06]],'#a88e64','#493d2d',.055);
    poly(c,[[.05,-.92],[.29,-.95],[.39,.18],[.18,.3],[.1,.07]],'#7f6949');
    line(c,[[-.25,-.85],[-.12,.15]],'#c8b28a',.04);
    rect(c,-.34,.08,.69,.08,.01,'#5b4431','#392d23',.03);
    rect(c,-.29,-.72,.17,.16,.015,T.main,T.dark,.025);
    line(c,[[.2,-.92],[-.23,.17]],'#6c4f32',.085);
    const swing=stride*.15;
    for(const sign of [-1,1]){
      line(c,[[sign*.31,-.82],[sign*(.42+swing),-.15-sign*swing]],'#a58a62',.19);
      ellipse(c,sign*(.42+swing),-.12-sign*swing,.085,.105,'#bca084','#493d2d',.03);
    }
    fieldFace(c,-.015,-1.35,.29,rear);
    poly(c,[[-.36,-1.38],[-.34,-1.65],[-.16,-1.84],[.15,-1.81],[.34,-1.61],[.33,-1.37]],'#6a573b','#3f3528',.05);
    poly(c,[[-.34,-1.65],[-.16,-1.84],[.01,-1.82],[-.05,-1.47],[-.35,-1.43]],'#9d8457');
    line(c,[[-.4,-1.38],[.38,-1.39]],'#4d3e2b',.1);
    if(rear){
      poly(c,[[-.22,-1.39],[.22,-1.39],[.19,-1.14],[-.2,-1.16]],'#6c543b','#493d2d',.035);
      line(c,[[-.16,-.88],[.15,.02]],'#cfb28b',.045);
    }else{
      line(c,[[-.16,-1.17],[.12,-1.17]],'#69503c',.035);
    }
    if(u.cargo>0){
      // The gold at the tied neck distinguishes a full transport bag.
      const x=rear?.03:.3,y=rear?-.3:-.17;
      poly(c,[[x-.1,y-.48],[x+.14,y-.49],[x+.3,y-.12],[x+.27,y+.2],[x-.23,y+.24],[x-.31,y-.04]],'#a17b42','#4b3925',.055);
      poly(c,[[x+.1,y-.46],[x+.3,y-.12],[x+.27,y+.2],[x+.05,y+.22],[x+.12,y-.1]],'#76542f');
      line(c,[[x-.12,y-.4],[x+.15,y-.41]],'#e2c490',.07);
      ellipse(c,x-.045,y-.49,.085,.065,'#d9b84e','#806132',.025);
      ellipse(c,x+.075,y-.51,.075,.06,'#f0d476','#806132',.025);
      line(c,[[x-.18,y-.06],[x-.16,y+.12]],'#c3a266',.045);
    }else{
      rect(c,rear?-.16:.2,-.1,.27,.29,.055,'#786042','#463827',.045);
      line(c,[[rear?-.13:.23,-.02],[rear?.07:.4,-.02]],'#b0956c',.03);
    }
  }
  const unitDrawers={footman,archer,mage,cavalry,ram,worker};

  function drawUnit(c,u,team,bob,displayFlip) {
    if(!u||u.hero||!unitDrawers[u.key]||!Number.isFinite(u.r))return false;
    let d=u.dir8===undefined?(u.side==='player'?6:2):u.dir8;
    if(displayFlip)d=(8-d)%8;
    if(drawAtlasUnit(c,u,team,bob,d))return true;
    const rear=d===5||d===6||d===7;
    c.save();c.scale(u.r,u.r);c.lineCap='round';c.lineJoin='round';
    if(d>=3&&d<=5)c.scale(-1,1);
    unitDrawers[u.key](c,u,team?TEAM.blue:TEAM.red,bob||0,rear,d);
    c.restore();return true;
  }

  /* Tactical buildings use sharp roof planes and shallow stone foundations.
     Static geometry stays cached at 2x, including the two team palettes. */
  /* Stone, timber and steel; functional silhouettes without decorative trim. */
  function base(c,T) {
    ellipse(c,51,90,45,8,'rgba(29,49,44,.23)');
    poly(c,[[8,78],[80,72],[94,82],[22,92]],'#bcc2ad',INK,.85);
    poly(c,[[22,92],[94,82],[94,88],[22,98]],'#7f9390',INK,.8);
    poly(c,[[8,78],[22,92],[22,98],[8,85]],'#687e7b',INK,.7);
    line(c,[[24,93],[91,84]],'#b5c1b4',.8);
  }
  function wall(c,x,y,w,h,depth) {
    poly(c,[[x+w,y],[x+w+depth,y-depth*.45],[x+w+depth,y+h-depth*.45],[x+w,y+h]],'#829794',INK,1);
    rect(c,x,y,w,h,.8,linear(c,x,y,x+w*.7,y+h,STONE),INK,1.05);
    line(c,[[x+2,y+h-4],[x+w-2,y+h-4]],'#758b85',2);
    for(let yy=y+11;yy<y+h-5;yy+=11)line(c,[[x+2,yy],[x+w-2,yy]],'rgba(66,91,88,.18)',.65);
    line(c,[[x+3,y+3],[x+3,y+h-5]],'#e8e9dc',.75);
  }
  function gable(c,x,y,w,h,depth,T) {
    const peak=y-h*.72;
    poly(c,[[x+w*.45,peak],[x+w*.45+depth,peak-depth*.45],[x+w+depth+3,y-depth*.45],[x+w+3,y+3]],T.dark,INK,1.05);
    poly(c,[[x-4,y+3],[x+w*.45,peak],[x+w+3,y+3]],linear(c,x,peak,x+w,y,[T.light,T.main]),INK,1.05);
    line(c,[[x-4,y+3],[x+w+3,y+3]],T.dark,2.5);
    line(c,[[x+w*.45,peak],[x+w*.45+depth,peak-depth*.45]],'#c1cebf',.8);
    for(let i=1;i<4;i++){const k=i/4;line(c,[[x+w*.45-(w*.45+3)*k,peak+(y-peak)*k],[x+w*.45+(w*.55+2)*k,peak+(y-peak)*k]],'rgba(31,61,67,.2)',.7);}
  }
  function door(c,x,y,w,h,wood) {
    rect(c,x-w*.5,y,w,h,1,wood?linear(c,x-w*.5,y,x+w*.5,y+h,WOOD):'#354b4c',INK,.95);
    if(wood){
      for(let k=1;k<4;k++)line(c,[[x-w*.5+w*k/4,y+3],[x-w*.5+w*k/4,y+h-2]],'#947e61',.65);
      line(c,[[x-w*.4,y+h*.64],[x+w*.4,y+h*.64]],'#746e58',1.4);
      rect(c,x+w*.17,y+h*.5,2,3,.3,'#bfc7b7');
    }
  }
  function windowSlit(c,x,y,w,h,glow) {
    rect(c,x-w*.5-1,y-1,w+2,h+2,.5,'#8e9c8d',INK,.65);
    rect(c,x-w*.5,y,w,h,.3,glow||'#c2d0bd');
    line(c,[[x,y],[x,y+h]],'#71857d',.75);
    rect(c,x-w*.5-2,y+h,w+4,2,.3,'#a6b5a5');
  }
  function banner(c,x,y,w,h,T) {
    rect(c,x-w*.5,y,w,h,.5,T.main,T.dark,.65);
    line(c,[[x-w*.3,y+2],[x-w*.3,y+h-2]],T.light,.7);
    line(c,[[x-w*.2,y+h*.35],[x+w*.2,y+h*.35]],'#d1d7c5',.8);
  }
  function poleFlag(c,x,y,w,h,T) {
    line(c,[[x,y+h],[x,y-3]],'#8c8268',1.1);
    poly(c,[[x+1,y],[x+w,y+2],[x+w-3,y+h*.6],[x+1,y+h*.6]],T.main,INK,.7);
    rect(c,x-1,y-4,2,3,.3,'#9eac98');
  }
  function cylinder(c,x,y,w,h,T) {
    rect(c,x-w*.5,y,w,h,5,linear(c,x-w*.5,y,x+w*.5,y+h,STONE),INK,.95);
    ellipse(c,x,y,w*.5,w*.17,'#eee6cf',INK,.85);
    c.beginPath();c.ellipse(x,y+h-4,w*.49,w*.13,0,0,PI);c.strokeStyle='#b5bea6';c.lineWidth=2;c.stroke();
    for(let yy=y+12;yy<y+h-6;yy+=13)line(c,[[x-w*.43,yy],[x+w*.43,yy]],'rgba(103,127,111,.14)',.7);
    rect(c,x-w*.52,y+h-7,w*1.04,5,2,T.main,T.dark,.6);
  }
  function gear(c,x,y,r) {
    c.save();c.translate(x,y);
    for(let i=0;i<8;i++){c.save();c.rotate(i*TAU/8);rect(c,-r*.16,-r*1.13,r*.32,r*.4,.8,'#9caeab',INK,.5);c.restore();}
    ellipse(c,0,0,r,r,'#bac8bc',INK,.8);ellipse(c,0,0,r*.58,r*.58,'#7d9490',INK,.5);
    for(let i=0;i<4;i++){const a=i*PI*.5;line(c,[[0,0],[Math.cos(a)*r*.7,Math.sin(a)*r*.7]],'#d8dfcb',1.2);}
    ellipse(c,0,0,r*.17,r*.17,'#e6e6cf',INK,.4);c.restore();
  }
  function crystal(c,x,y,r,glow) {
    if(glow){const g=c.createRadialGradient(x,y,r*.3,x,y,r*2);g.addColorStop(0,'rgba(189,224,207,.3)');g.addColorStop(1,'rgba(189,224,207,0)');ellipse(c,x,y,r*2,r*2,g);}
    poly(c,[[x,y-r*1.3],[x+r*.6,y-r*.35],[x+r*.4,y+r*.5],[x,y+r],[x-r*.5,y+r*.4],[x-r*.55,y-r*.4]],'#b7d9d3',INK,.7);
    poly(c,[[x,y-r*1.3],[x-r*.1,y],[x-r*.5,y+r*.4],[x-r*.55,y-r*.4]],'#e7eee0');
    poly(c,[[x,y-r*1.3],[x+r*.6,y-r*.35],[x+r*.4,y+r*.5],[x-r*.1,y]],'#8eb9c3');
    poly(c,[[x-r*.1,y],[x+r*.4,y+r*.5],[x,y+r],[x-r*.5,y+r*.4]],'#91a8bf');
    line(c,[[x,y-r*1.2],[x-r*.1,y],[x,y+r*.9]],'#e5f0e4',.65);
  }
  function leafMark(c,x,y,s,T) {
    poly(c,[[x-s*.7,y-s*.7],[x+s*.7,y-s*.7],[x+s*.6,y+s*.25],[x,y+s],[x-s*.6,y+s*.25]],T.main,INK,.75);
    line(c,[[x-s*.3,y+s*.1],[x,y-s*.25],[x+s*.3,y+s*.1]],T.pale,.75);
  }
  function hall(c,T,tier) {
    if(tier>=2){wall(c,10,53,20,32,5);gable(c,7,53,25,12,5,T);windowSlit(c,19,62,4,8);}
    if(tier>=3){wall(c,70,47,17,34,6);gable(c,67,47,24,12,5,T);windowSlit(c,79,58,4,8);}
    wall(c,25,42,45,43,11);gable(c,20,42,55,24,10,T);
    if(tier>=2){
      const top=tier>=3?5:17;
      wall(c,38,top,23,37,7);rect(c,34,top-4,34,6,1,'#adb9aa',INK,.9);
      for(let i=0;i<3;i++)rect(c,35+i*12,top-9,8,7,.5,T.main,INK,.75);
      windowSlit(c,49,top+8,5,11);
      if(tier>=3)banner(c,58,25,7,18,T);
    }
    door(c,48,59,17,26,true);windowSlit(c,32,54,5,9);windowSlit(c,65,52,5,9);
    rect(c,36,83,25,5,.4,'#bdc7b7',INK,.65);rect(c,32,88,33,3,.3,'#9eafa1',INK,.6);
    leafMark(c,48,47,5,T);
    for(const x of [20,74]){rect(c,x,74,7,10,.4,'#93a493',INK,.65);line(c,[[x+1,78],[x+6,78]],'#cbd2be',.7);}
    if(tier===1)poleFlag(c,66,17,12,15,T);
  }
  function mine(c,T) {
    poly(c,[[11,75],[10,49],[25,27],[46,20],[69,29],[84,53],[85,77]],'#a7b5a5',INK,1);
    poly(c,[[10,49],[25,27],[46,20],[41,53],[21,70],[11,75]],'#ced0b7');
    poly(c,[[46,20],[69,29],[84,53],[59,57],[41,53]],'#92a89a');
    line(c,[[22,45],[28,37],[33,43],[40,38]],'#dbbf79',2.4);
    door(c,47,47,29,34,false);
    for(const x of [30,60])rect(c,x,43,5,39,1.5,linear(c,x,43,x+5,80,WOOD),INK,.7);
    rect(c,28,40,40,7,2,'#c4aa80',INK,.8);rect(c,35,41,27,2,1,T.main);
    for(const x of [37,58])line(c,[[x,77],[x-5,93]],'#84938a',1.8);
    for(let y=81;y<=91;y+=5)line(c,[[32,y],[60,y]],'#b59a72',1.5);
    ellipse(c,72,83,5,5,'#7c8c87',INK,.6);ellipse(c,88,80,5,5,'#7c8c87',INK,.6);
    poly(c,[[61,68],[86,64],[94,75],[69,81]],'#c7b38a',INK,.9);
    poly(c,[[69,81],[94,75],[92,84],[70,91]],'#a1b0a7',INK,.85);
    for(const [x,y] of [[71,69],[79,67],[85,71]])poly(c,[[x-4,y],[x,y-5],[x+5,y-1],[x+2,y+4]],'#e6c87d','#a68e61',.6);
    ellipse(c,17,73,8,3,'#87a88a');
  }
  function barracks(c,T) {
    wall(c,19,45,57,39,9);gable(c,13,45,65,22,8,T);door(c,47,58,20,26,true);
    for(const x of [24,69])rect(c,x,48,3,34,1,'#bba480',INK,.5);
    windowSlit(c,28,57,6,10);windowSlit(c,69,56,6,10);
    poly(c,[[36,32],[56,32],[55,44],[46,51],[37,44]],'#9eafa3',INK,.85);leafMark(c,46,41,7,T);
    for(const x of [12,85]){line(c,[[x,81],[x,50]],'#af926d',1.8);poly(c,[[x-2,52],[x,45],[x+2,52]],'#cedbd2',INK,.5);}
    rect(c,9,78,15,8,2,'#c8b798',INK,.6);line(c,[[10,80],[23,80]],'#a28c6d',.7);
  }
  function archery(c,T) {
    wall(c,17,48,53,35,9);gable(c,12,48,64,24,8,T);door(c,46,58,18,25,true);
    rect(c,17,49,3,33,1,'#b39775',INK,.5);windowSlit(c,27,56,6,10);
    line(c,[[74,84],[74,50]],'#9e8665',2);line(c,[[65,83],[84,83]],'#9e8665',2);
    ellipse(c,74,55,13,15,'#d6d9c5',INK,.9);ellipse(c,74,55,9.5,11,'#869e95',INK,.6);ellipse(c,74,55,5.5,6.5,'#a76d61');ellipse(c,74,55,2,2.5,'#e0dfce');
    line(c,[[61,62],[83,49]],'#8c8061',1);poly(c,[[81,48],[87,46],[83,52]],'#aebfbb',INK,.45);
    c.beginPath();c.moveTo(10,54);c.quadraticCurveTo(24,68,10,82);c.strokeStyle='#a58c69';c.lineWidth=2.2;c.stroke();line(c,[[10,54],[10,82]],'#e6d3ac',.7);
  }
  function stable(c,T) {
    wall(c,16,44,61,41,10);gable(c,10,45,72,23,8,T);door(c,47,54,34,30,false);
    poly(c,[[39,70],[38,60],[42,54],[49,53],[54,60],[57,66],[51,72]],'#c7ad88',INK,.75);
    poly(c,[[41,56],[41,48],[46,54]],'#b08b69',INK,.6);poly(c,[[49,55],[51,49],[54,58]],'#b08b69',INK,.55);
    ellipse(c,52,62,1,1.2,'#526168');ellipse(c,53,69,3,2,'#dcc6a4');
    rect(c,29,73,37,11,1.5,linear(c,29,73,29,84,WOOD),INK,.75);line(c,[[32,75],[62,81]],'#d9c49c',1.5);
    for(let i=0;i<5;i++)line(c,[[15+i*3,82],[13+i*3,73]],'#d5c28d',1.4);
    ellipse(c,47,40,9,8,'#e2d9be',INK,.7);c.beginPath();c.arc(47,38,4.5,0,PI);c.strokeStyle=T.main;c.lineWidth=2;c.stroke();
  }
  function workshop(c,T) {
    wall(c,9,48,72,36,9);gable(c,4,49,80,21,8,T);
    rect(c,69,17,10,26,2,'#a4b1a1',INK,.85);rect(c,66,15,16,5,2,'#c3cbb6',INK,.7);
    ellipse(c,74,9,5,3,'rgba(223,226,201,.65)');ellipse(c,79,2,6,4,'rgba(223,226,201,.4)');
    door(c,44,59,23,25,true);windowSlit(c,22,59,9,12,'#ecc194');
    for(let i=0;i<3;i++)line(c,[[18,61+i*3],[27,61+i*3]],'#927f67',.8);
    gear(c,73,59,11);gear(c,84,75,6.5);
    rect(c,10,79,23,5,1,'#b6c2b2',INK,.6);poly(c,[[14,72],[18,68],[26,68],[29,72],[24,74],[23,79],[17,79],[17,74]],'#8ea5a4',INK,.7);
    rect(c,56,52,8,4,1,T.main);
  }
  function sanctum(c,T) {
    cylinder(c,49,51,46,33,T);door(c,49,63,15,20,true);
    ellipse(c,49,50,28,8,T.dark,INK,.8);ellipse(c,49,46,25,7,T.main,INK,.7);
    windowSlit(c,32,60,5,8,'#d8d6e8');windowSlit(c,66,60,5,8,'#d8d6e8');
    for(const x of [29,67]){rect(c,x,32,3,17,1,'#b9c6b7',INK,.6);ellipse(c,x+1.5,32,4,2,'#dce1ca');}
    poly(c,[[49,9],[65,20],[65,37],[49,46],[33,36],[33,20]],'#7b97a7',INK,1);
    poly(c,[[49,9],[49,29],[33,36],[33,20]],'#c9d5cf');
    poly(c,[[49,29],[65,20],[65,37],[49,46]],'#6b8295');
    c.save();c.translate(49,28);c.rotate(-.23);ellipse(c,0,0,23,7,null,'#a8bcb1',1.1);c.restore();
    banner(c,29,55,6,19,T);
  }
  function outpost(c,T) {
    for(const x of [28,64])rect(c,x,42,6,41,1.5,linear(c,x,42,x+6,80,WOOD),INK,.85);
    line(c,[[31,77],[67,49]],'#ad9470',3);line(c,[[31,49],[67,77]],'#bda47b',3);
    rect(c,22,37,52,9,2,'#c3af89',INK,.85);rect(c,23,35,51,4,1.5,T.main,T.dark,.65);
    for(const x of [28,66])rect(c,x,21,3,16,1,'#bda37e',INK,.5);
    gable(c,19,22,58,17,6,T);poleFlag(c,48,2,14,14,T);
    for(const x of [51,59])line(c,[[x,49],[x,85]],'#d1c0a0',1.2);
    for(let y=53;y<84;y+=5)line(c,[[51,y],[59,y]],'#ad9471',1.3);
    banner(c,38,40,10,18,T);
  }
  function guardTower(c,T) {
    wall(c,29,29,35,54,10);windowSlit(c,46,53,6,11);banner(c,61,45,7,17,T);
    rect(c,22,26,50,9,3,'#d8dcc6',INK,.9);rect(c,23,24,49,4,2,T.main,T.dark,.65);
    for(const x of [25,67])rect(c,x,14,4,15,1.3,'#b0bea9',INK,.6);
    rect(c,33,78,30,6,2,'#c8cfb8',INK,.6);
    c.save();c.translate(47,18);rect(c,-3,-10,6,22,1.5,'#baa17a',INK,.7);
    c.beginPath();c.moveTo(-23,-3);c.quadraticCurveTo(0,-15,23,-3);c.strokeStyle='#788b81';c.lineWidth=3.5;c.stroke();c.strokeStyle='#c1b18a';c.lineWidth=1.8;c.stroke();
    line(c,[[-23,-3],[0,6],[23,-3]],'#e3d6b6',.7);line(c,[[0,5],[0,-20]],'#9babaa',1.3);poly(c,[[-2.5,-17],[0,-23],[2.5,-17]],'#dbe6da',INK,.5);c.restore();
  }
  function arcaneTower(c,T) {
    cylinder(c,49,43,30,40,T);windowSlit(c,49,59,6,10,'#c8dae0');
    ellipse(c,49,42,23,7,'#d8deca',INK,.8);ellipse(c,49,38,21,6,T.main,INK,.65);
    for(const x of [30,66]){rect(c,x,24,3,17,1,'#c3cbb8',INK,.55);ellipse(c,x+1.5,24,3,1.6,'#dde4d2');}
    crystal(c,49,15,17,true);c.save();c.translate(49,17);c.rotate(-.3);ellipse(c,0,0,26,7,null,'#c2d5ca',1);c.restore();
    star(c,25,13,2,'#e0e7d5');star(c,75,23,2,'#dfe8d8');banner(c,34,52,7,17,T);
  }
  const buildingDrawers={hall,mine,elixirBase:mine,barracks,archery,assaultBarracks:stable,workshop,sanctum,tower:outpost,guardTower,arcaneTower};

  function drawBuilding(c,key,level,px,py,pw,ph,side,tierNow,isFriendly) {
    const fn=buildingDrawers[key];if(!fn)return false;
    const team=isFriendly===undefined?(side==='player'||side===true):isFriendly;
    const T=team?TEAM.blue:TEAM.red;
    const tier=Math.max(1,Math.min(3,tierNow||1));
    const raster=makeAtlasBuilding(key,level,tier,team);
    if(raster){
      const scale=Math.min(pw*1.16/raster.width,ph*1.28/raster.height);
      const w=raster.width*scale,h=raster.height*scale;
      c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
      c.drawImage(raster,px+(pw-w)*.5,py+ph*.94-h,w,h);
      c.restore();return true;
    }
    /* Cached normalized canvas includes protruding flags / smoke / crown. */
    const cacheKey=[key,team?1:0,key==='hall'?tier:1].join(':');
    let cache=caches.get(cacheKey);
    if(!cache){
      cache=document.createElement('canvas');cache.width=240;cache.height=264;
      const a=cache.getContext('2d');a.scale(2,2);a.translate(10,25);
      a.lineJoin='round';a.lineCap='round';base(a,T);fn(a,T,tier);
      caches.set(cacheKey,cache);
    }
    c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    c.drawImage(cache,px-pw*.1,py-ph*.25,pw*1.2,ph*1.32);
    c.restore();return true;
  }

  global.RoyalArt={drawUnit,drawBuilding,version:'2026.10.24.tribal6.workers',
    clearCache:function(){caches.clear();},
    get ready(){return {buildings:atlases.buildings.ready,units:atlases.units.ready,workers:atlases.workers.ready};}};
  loadAtlas('buildings');loadAtlas('units');loadAtlas('workers');
})(typeof window!=='undefined'?window:globalThis);
