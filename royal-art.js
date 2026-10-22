/* Kingdom Craft · original, code-native art pass · 2026-10-23.
   This renderer only reads presentation state. It never writes to a unit,
   building, command, balance value or the simulation random generator.
   World positions / selection / HP / fog stay owned by the game renderer. */
(function (global) {
  'use strict';
  const PI = Math.PI, TAU = PI * 2;
  const INK = '#233346';
  const TEAM = {
    blue: { main: '#2875d7', dark: '#173f87', light: '#66c4ff', pale: '#bfdfff', trim: '#f5cf78' },
    red:  { main: '#d64c46', dark: '#7a293d', light: '#ff9280', pale: '#ffd4ac', trim: '#f5cf78' }
  };
  const STONE = ['#fff1ce', '#ded7b7', '#8d9b9c'];
  const WOOD = ['#cb9150', '#925b32', '#503b32'];
  const STEEL = ['#f4fcff', '#b4c9d5', '#607f98'];
  const caches = new Map();

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
    const g = c.createRadialGradient(x-r*.35, y-r*.45, r*.04, x+r*.12, y+r*.15, r*1.15);
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
     The feet counteract the caller's body bob and therefore stay on ground. */
  function feet(c, u, bob, T, boot) {
    const speed = u.spd > 0 ? Math.min(1,(u.vel||0)/u.spd) : 0;
    const gait = Math.sin(u.gait||0) * speed;
    const fy = .87 - bob / (u.r||10);
    const stride = .24 * gait;
    const legs = [[-.29+stride,fy-Math.max(0,gait)*.13],[.29-stride,fy-Math.max(0,-gait)*.13]];
    legs.forEach(([x,y]) => {
      rect(c,x-.12,.42,.24,Math.max(.13,y-.42),.08,linear(c,x-.12,0,x+.12,0,[T.dark,T.main]),INK,.07);
      ellipse(c,x+.025,y,.25,.14,boot||'#3c3840',INK,.07);
      line(c,[[x-.11,y-.055],[x+.12,y-.055]],'#8197a4',.045);
    });
    return gait;
  }
  function eyes(c, x, y, gap, sideView) {
    ellipse(c,x-gap,y,.055,.075,'#243142');
    if (!sideView) ellipse(c,x+gap,y,.055,.075,'#243142');
    line(c,[[x-gap-.065,y-.115],[x-gap+.07,y-.1]],'#715a43',.055);
    if (!sideView) line(c,[[x+gap-.07,y-.1],[x+gap+.065,y-.115]],'#715a43',.055);
  }
  function helmet(c, T, rear, x, y, scale) {
    c.save(); c.translate(x||0,y||0); c.scale(scale||1,scale||1);
    sphere(c,0,-.69,.61,STEEL,INK,.075);
    /* The cool shadow and warm reflected light give a chunky metal volume. */
    poly(c,[[-.6,-.75],[-.57,-.27],[-.37,-.12],[-.33,-.66]],'#7c9caf',INK,.055);
    poly(c,[[.38,-.77],[.6,-.75],[.55,-.22],[.38,-.11],[.28,-.56]],'#6c889c',INK,.055);
    if (!rear) {
      rect(c,-.36,-.66,.73,.46,.14,linear(c,-.3,-.65,.3,-.2,['#ffe6be','#d4a16b']),INK,.055);
      line(c,[[-.36,-.6],[.37,-.6]],'#3c536b',.1);
      eyes(c,.02,-.44,.15,false);
      poly(c,[[-.065,-.68],[.06,-.68],[.08,-.19],[-.06,-.15]],'#d5e8ee',INK,.035);
    } else {
      line(c,[[0,-1.23],[.03,-.28]],'#f2fbff',.075);
      rect(c,-.39,-.36,.78,.18,.06,'#7b95a5',INK,.045);
    }
    poly(c,[[-.11,-1.23],[.16,-1.28],[.26,-1.58],[-.04,-1.47],[-.29,-1.32]],
      linear(c,-.15,-1.5,.15,-1.15,[T.light,T.main,T.dark]),INK,.055);
    line(c,[[-.46,-.92],[-.32,-1.08],[-.07,-1.15]],'#fff',.06);
    c.restore();
  }
  function footman(c, u, T, bob, rear) {
    const g=feet(c,u,bob,T);
    poly(c,[[-.55,-.15],[.45,-.15],[.62,.65],[-.57,.65]],linear(c,-.5,-.1,.5,.7,[T.light,T.main,T.dark]),INK,.08);
    poly(c,[[-.34,-.06],[.36,-.06],[.38,.38],[0,.56],[-.38,.38]],
      linear(c,-.3,-.1,.3,.5,STEEL),INK,.07);
    rect(c,-.47,.48,.95,.12,.05,'#8b603d',INK,.05);
    rect(c,-.09,.46,.19,.17,.035,'#ffdc8b',INK,.035);
    ellipse(c,-.53,.015,.25,.23,linear(c,-.6,-.1,-.4,.25,STEEL),INK,.06);
    ellipse(c,.5,.015,.25,.23,linear(c,.4,-.1,.65,.3,STEEL),INK,.06);
    if(rear){
      poly(c,[[-.4,-.13],[.37,-.13],[.47,.66],[.16,.78],[-.18,.66],[-.48,.75]],
        linear(c,-.4,-.1,.4,.75,[T.light,T.main,T.dark]),INK,.055);
      line(c,[[-.13,.03],[-.18,.61]],'rgba(255,255,255,.25)',.045);
      line(c,[[.19,.03],[.29,.61]],T.dark,.05);
    }
    /* Sword arm, guard and blade are separate pieces for the attack arc. */
    const sw=u.swing>0?Math.sin(Math.min(1,u.swing/.28)*PI):0;
    c.save(); c.translate(.51,.18); c.rotate(-.1-sw*1.5+g*.07);
    rect(c,-.09,-.08,.19,.49,.08,'#c7d7df',INK,.06);
    ellipse(c,.035,.3,.14,.15,'#f5c58b',INK,.055);
    rect(c,-.035,-.56,.13,.65,.035,'#876142',INK,.05);
    rect(c,-.22,-.48,.53,.11,.045,'#edca7b',INK,.055);
    poly(c,[[-.045,-.49],[-.08,-1.44],[.035,-1.73],[.15,-1.44],[.11,-.49]],
      linear(c,-.08,-1,.15,-1,['#fff','#d7edf4','#7d9aad']),INK,.055);
    line(c,[[.03,-1.59],[.025,-.52]],'#fff',.035);
    c.restore();
    helmet(c,T,rear,0,0,1);
    c.save();c.translate(-.65+g*.05,.2);c.rotate(-.12-g*.055);
    shield(c,0,0,.77,1.12,T,INK); c.restore();
  }
  function archer(c,u,T,bob,rear,direction) {
    const g=feet(c,u,bob,T,'#5b4439');
    poly(c,[[-.55,-.5],[.48,-.5],[.7,.66],[.28,.82],[-.64,.65]],
      linear(c,-.5,-.5,.5,.75,[T.light,T.main,T.dark]),INK,.075);
    rect(c,-.33,-.1,.66,.69,.15,linear(c,-.3,-.1,.4,.6,['#b38b53','#73543e']),INK,.07);
    line(c,[[-.29,-.05],[.29,.44]],'#e2bd7d',.12);
    rect(c,-.4,.39,.8,.12,.04,'#57453a',INK,.04);
    sphere(c,.01,-.66,.54,['#ffe9c0','#f0c18c','#b17e58'],INK,.065);
    /* An angular hood and a long feather distinguish the ranger silhouette. */
    c.beginPath();c.moveTo(-.58,-.29);c.quadraticCurveTo(-.73,-1.08,-.03,-1.4);
    c.quadraticCurveTo(.64,-1.12,.6,-.31);c.lineTo(.33,-.27);
    c.quadraticCurveTo(.42,-.89,-.01,-1.0);c.quadraticCurveTo(-.43,-.83,-.31,-.29);c.closePath();
    finish(c,linear(c,-.55,-1.2,.5,-.3,['#98c66c','#477c50','#234d46']),INK,.08);
    poly(c,[[.05,-1.23],[.2,-1.6],[.68,-1.83],[.5,-1.4],[.2,-1.2]],'#e7d39a',INK,.05);
    line(c,[[.14,-1.23],[.57,-1.7]],'#947f55',.04);
    if(!rear){eyes(c,.04,-.59,.16,false);line(c,[[-.2,-.3],[.28,-.3]],'#d08d61',.04);}
    else poly(c,[[-.3,-.31],[.35,-.31],[.35,-.81],[.04,-1.05],[-.36,-.82]],'#3c6e50');
    /* Quiver and ivory fletching remain visible over the left shoulder. */
    c.save();c.translate(-.5,.05);c.rotate(-.3);
    rect(c,-.14,-.38,.26,.85,.07,'#8c5e38',INK,.06);
    for(let i=0;i<3;i++){
      line(c,[[i*.105-.14,-.3],[i*.105-.14,-.87-i*.06]],'#a88251',.05);
      poly(c,[[i*.105-.2,-.69-i*.06],[i*.105-.14,-.92-i*.06],[i*.105-.08,-.69-i*.06]],'#f9eed0');
    }
    c.restore();
    const sw=u.swing>0?Math.sin(Math.min(1,u.swing/.28)*PI):0;
    ellipse(c,.52,.15,.16,.16,'#f2c18d',INK,.06);
    c.save();
    if(direction===6){c.translate(.53,-.25);c.rotate(-PI/2);}
    else if(direction===2){c.translate(.5,.22);c.rotate(PI/2);}
    else{c.translate(.72,.01);if(direction===5||direction===7)c.rotate(-.38);else if(direction===1||direction===3)c.rotate(.2);}
    c.beginPath();c.moveTo(.11,-.8);c.bezierCurveTo(.83,-.5,.83,.47,.11,.8);
    c.strokeStyle='#3c3b33';c.lineWidth=.19;c.stroke();
    c.strokeStyle='#e6b662';c.lineWidth=.12;c.stroke();
    line(c,[[.1,-.8],[-.2-sw*.34,0],[.1,.8]],'#fff0cb',.038);
    line(c,[[-.25-sw*.32,0],[.8,0]],'#d0a264',.055);
    poly(c,[[.7,-.11],[.99,0],[.7,.11]],'#dfedf0',INK,.035);
    rect(c,.12,-.16,.15,.32,.04,'#69442e');
    c.restore();
  }
  function mage(c,u,T,bob,rear) {
    feet(c,u,bob,T,'#42355a');
    poly(c,[[-.48,-.28],[.45,-.28],[.73,.82],[.29,.97],[-.14,.86],[-.71,.95]],
      linear(c,-.5,-.2,.55,.9,['#aa8deb','#6a4faa','#393969']),INK,.085);
    poly(c,[[-.26,-.27],[.21,-.27],[.39,.83],[.12,.92],[-.31,.84]],
      linear(c,-.1,-.1,.2,.9,[T.light,T.main,T.dark]),'#d5b96c',.045);
    line(c,[[-.49,.78],[-.13,.86],[.29,.94],[.65,.82]],'#f1cb78',.065);
    rect(c,-.4,.33,.82,.12,.04,'#e1b960',INK,.05);
    sphere(c,.01,-.68,.51,['#ffe6b8','#efbf87','#b8815b'],INK,.06);
    if(!rear){
      eyes(c,.03,-.6,.155,false);
      poly(c,[[-.31,-.36],[-.1,-.39],[.02,-.31],[.15,-.39],[.36,-.33],[.24,.11],[0,.3],[-.23,.06]],
        linear(c,-.3,-.4,.3,.24,['#fffbea','#d6d9d7','#9dacb9']),INK,.045);
      line(c,[[-.03,-.16],[.015,.12]],'#fff',.05);
    }else{
      /* Hair and the raised collar cover the face in the northward pose. */
      poly(c,[[-.42,-.83],[.41,-.83],[.44,-.3],[.24,-.15],[-.17,-.2],[-.4,-.35]],
        linear(c,-.3,-.8,.3,-.2,['#e6ded0','#aaaebe','#7b88a3']),INK,.045);
      line(c,[[-.16,-.71],[-.17,-.26]],'#f8f0de',.04);
      line(c,[[.17,-.7],[.23,-.3]],'#d4d5da',.04);
    }
    ellipse(c,0,-1.0,.82,.2,linear(c,-.7,-1,.6,-.8,['#a290de','#5c498c','#363558']),INK,.07);
    c.beginPath();c.moveTo(-.56,-1.03);c.quadraticCurveTo(-.29,-1.45,-.06,-1.88);
    c.quadraticCurveTo(.15,-2.02,.35,-1.8);c.lineTo(.2,-1.62);c.lineTo(.54,-1.02);c.closePath();
    finish(c,linear(c,-.4,-1.7,.45,-1,['#a492e2','#6750a5','#393467']),INK,.07);
    line(c,[[-.43,-1.12],[.42,-1.12]],'#efd184',.12);
    star(c,-.04,-1.48,.12,'#ffe4a0');
    const sw=u.swing>0?Math.sin(Math.min(1,u.swing/.28)*PI):0;
    c.save();c.translate(.63,.2);c.rotate(-.15-sw*.35);
    rect(c,-.055,-1.34,.12,1.87,.04,linear(c,-.06,0,.08,0,['#e4ba6e','#795333']),INK,.055);
    ellipse(c,-.01,.11,.15,.15,'#f0bf8b',INK,.055);
    /* Gold claws surround the light source rather than a flat colored dot. */
    c.beginPath();c.moveTo(-.2,-1.23);c.quadraticCurveTo(-.43,-1.58,-.14,-1.78);
    c.moveTo(.16,-1.23);c.quadraticCurveTo(.4,-1.58,.12,-1.78);
    c.strokeStyle='#e9bf72';c.lineWidth=.1;c.stroke();
    const glow=c.createRadialGradient(0,-1.53,.02,0,-1.53,.52+sw*.15);
    glow.addColorStop(0,'rgba(195,245,255,.8)');glow.addColorStop(.45,'rgba(87,195,255,.3)');glow.addColorStop(1,'rgba(68,162,255,0)');
    ellipse(c,0,-1.53,.58,.58,glow);
    sphere(c,0,-1.53,.23,['#fff','#a7f5ff','#3e9ff4','#405aab'],INK,.045);
    star(c,-.06,-1.6,.12,'#fff');
    c.restore();
  }
  function cavalry(c,u,T,bob,rear,direction) {
    if(direction===2||direction===6){cavalryVertical(c,u,T,bob,rear);return;}
    const speed=u.spd>0?Math.min(1,(u.vel||0)/u.spd):0;
    const gait=Math.sin(u.gait||0)*speed, ground=.94-bob/(u.r||14);
    /* Far hooves, tail and saddle render first, creating four-legged volume. */
    c.lineCap='round';
    [[-.65,-gait],[.39,gait]].forEach(([x,g])=>{
      line(c,[[x,.21],[x+g*.14,.57],[x+g*.28,ground]],'#714e39',.16);
      ellipse(c,x+g*.28,ground,.17,.09,'#363443',INK,.035);
    });
    c.beginPath();c.moveTo(-.77,-.03);c.quadraticCurveTo(-1.23,-.2,-1.07,.51);c.quadraticCurveTo(-1.17,.72,-1.3,.68);
    c.quadraticCurveTo(-.91,.98,-.83,.31);c.closePath();finish(c,'#443a3a',INK,.06);
    ellipse(c,-.03,.14,.9,.44,linear(c,-.5,-.2,.4,.6,['#d3a46e','#946846','#5f493d']),INK,.075);
    poly(c,[[-.73,-.06],[.58,-.09],[.58,.45],[.24,.63],[-.16,.51],[-.6,.59]],
      linear(c,-.6,-.05,.5,.55,[T.light,T.main,T.dark]),INK,.06);
    line(c,[[-.62,.49],[-.16,.43],[.24,.55],[.5,.39]],'#f8d489',.065);
    [[-.65,gait],[.44,-gait]].forEach(([x,g])=>{
      line(c,[[x,.32],[x-g*.16,.64],[x-g*.28,ground]],'#b98959',.2);
      ellipse(c,x-g*.28+.03,ground,.19,.1,'#3e3841',INK,.045);
    });
    c.beginPath();c.moveTo(.45,.17);c.quadraticCurveTo(.59,-.63,.92,-.94);
    c.lineTo(1.19,-.74);c.lineTo(1.01,-.15);c.lineTo(.83,.32);c.closePath();
    finish(c,linear(c,.6,-.5,1.1,.2,['#d6ad7b','#a6764f','#76523c']),INK,.075);
    poly(c,[[.53,-.24],[.64,-.74],[.92,-1.02],[.85,-.53],[.68,.04]],'#493d3d',INK,.05);
    ellipse(c,1.03,-.69,.41,.24,linear(c,.78,-.9,1.3,-.4,['#ceaa7d','#ac7d55','#725540']),INK,.075,-.34);
    poly(c,[[.89,-.86],[.87,-1.17],[1.04,-1.02],[1.08,-.83]],'#a97a53',INK,.055);
    poly(c,[[1.14,-.76],[1.31,-.68],[1.24,-.53],[1.09,-.56]],'#ebd8ae');
    ellipse(c,1.16,-.77,.045,.055,'#273240');
    ellipse(c,1.36,-.61,.035,.025,'#584238');
    line(c,[[.75,-.58],[1.12,-.41],[1.37,-.58]],'#dab36c',.065);
    line(c,[[1.11,-.4],[.48,-.08],[.12,-.46]],'#554436',.05);
    rect(c,-.36,-.74,.66,.76,.17,linear(c,-.3,-.7,.25,0,[T.light,T.main,T.dark]),INK,.07);
    ellipse(c,-.07,-.3,.23,.18,'#cbd7d7',INK,.055);
    helmet(c,T,rear,-.05,-.69,.62);
    shield(c,-.35,-.37,.43,.62,T,INK);
    const sw=u.swing>0?Math.sin(Math.min(1,u.swing/.28)*PI):0;
    c.save();c.translate(.13,-.57);c.rotate(-.035+sw*.14);
    rect(c,-.17,-.055,1.66+sw*.4,.11,.04,linear(c,0,-.05,0,.06,['#f2d092','#956737']),INK,.045);
    const tip=1.5+sw*.4;
    poly(c,[[tip,-.13],[tip+.38,0],[tip,.13]],linear(c,tip,-.1,tip+.3,.1,STEEL),INK,.045);
    poly(c,[[.58,-.05],[.88,.02],[.81,.35],[.57,.21]],T.main,'#edd4a1',.035);
    c.restore();
  }
  function cavalryVertical(c,u,T,bob,rear) {
    const speed=u.spd>0?Math.min(1,(u.vel||0)/u.spd):0;
    const gait=Math.sin(u.gait||0)*speed, ground=.94-bob/(u.r||14);
    c.lineCap='round';
    for(const s of [-1,1]){
      line(c,[[s*.35,-.04],[s*.42,.47],[s*.44,ground-Math.max(0,s*gait)*.17]],'#76533e',.18);
      ellipse(c,s*.44,ground-Math.max(0,s*gait)*.17,.15,.09,'#373642',INK,.04);
    }
    ellipse(c,0,.09,.59,.65,linear(c,-.55,-.4,.55,.6,['#d9af7b','#a77c53','#6c513d']),INK,.075);
    if(rear){
      /* The long neck is beyond the saddle in the rear view. */
      poly(c,[[-.28,-.35],[-.22,-.87],[.02,-1.09],[.24,-.82],[.3,-.3]],'#a57b54',INK,.06);
      poly(c,[[-.2,-.87],[-.25,-1.19],[-.07,-1.02]],'#6c523f',INK,.04);
      poly(c,[[.13,-1.03],[.28,-1.18],[.23,-.85]],'#6c523f',INK,.04);
    }
    poly(c,[[-.57,-.21],[.55,-.21],[.6,.42],[.3,.64],[0,.56],[-.32,.66],[-.61,.43]],
      linear(c,-.55,-.2,.5,.65,[T.light,T.main,T.dark]),INK,.06);
    line(c,[[-.55,.44],[-.32,.58],[0,.49],[.3,.56],[.54,.4]],'#f3d18c',.07);
    for(const s of [-1,1]){
      line(c,[[s*.43,.32],[s*.5,.61],[s*.47,ground-Math.max(0,-s*gait)*.17]],'#c99a66',.2);
      ellipse(c,s*.47,ground-Math.max(0,-s*gait)*.17,.17,.1,'#3b3944',INK,.045);
    }
    rect(c,-.3,-.79,.6,.77,.15,linear(c,-.28,-.7,.3,0,[T.light,T.main,T.dark]),INK,.065);
    if(rear)poly(c,[[-.3,-.75],[.3,-.75],[.36,-.1],[0,.03],[-.36,-.1]],T.main,INK,.05);
    else poly(c,[[-.22,-.73],[.23,-.73],[.21,-.29],[0,-.17],[-.22,-.29]],linear(c,-.2,-.7,.25,-.2,STEEL),INK,.05);
    helmet(c,T,rear,0,-.67,.64);
    shield(c,-.45,-.39,.39,.58,T,INK);
    if(!rear){
      /* Long front-facing muzzle, blaze and bridle stay distinct from rider. */
      poly(c,[[-.28,-.57],[-.32,-.17],[-.23,.27],[0,.42],[.23,.27],[.32,-.17],[.26,-.56]],
        linear(c,-.28,-.5,.3,.4,['#d7ad78','#b18357','#7c593f']),INK,.065);
      poly(c,[[-.24,-.56],[-.31,-.84],[-.09,-.62]],'#9b734e',INK,.05);
      poly(c,[[.1,-.62],[.3,-.84],[.25,-.56]],'#9b734e',INK,.05);
      poly(c,[[-.06,-.51],[.05,-.51],[.11,.23],[-.1,.23]],'#eee1bd');
      ellipse(c,-.2,-.27,.04,.05,'#263645');ellipse(c,.2,-.27,.04,.05,'#263645');
      ellipse(c,0,.25,.24,.14,'#ba9877',INK,.045);
      ellipse(c,-.13,.25,.035,.025,'#5a493e');ellipse(c,.13,.25,.035,.025,'#5a493e');
      line(c,[[-.28,.03],[0,.13],[.28,.03]],'#d3b16f',.055);
    }else{
      c.beginPath();c.moveTo(-.1,.38);c.quadraticCurveTo(-.22,.81,-.06,1.12);
      c.quadraticCurveTo(.18,1.08,.14,.75);c.lineTo(.11,.4);c.closePath();
      finish(c,'#483e3d',INK,.045);line(c,[[0,.45],[.02,.99]],'#7d6448',.035);
    }
    /* Lance points along the actual vertical heading, including the thrust. */
    const attack=u.swing>0?Math.sin(Math.min(1,u.swing/.28)*PI)*.27:0;
    const end=rear?-1.86-attack:1.27+attack;
    line(c,[[.57,-.55],[.57,end]],'#594a37',.12);
    line(c,[[.55,-.55],[.55,end]],'#e0bd79',.065);
    const sign=rear?-1:1;
    poly(c,[[.45,end-sign*.04],[.57,end+sign*.28],[.69,end-sign*.04]],linear(c,.45,end,.69,end,STEEL),INK,.04);
    poly(c,[[.58,-.41],[.88,-.25],[.59,-.1]],T.main,'#efce89',.035);
    ellipse(c,.43,-.37,.115,.12,'#edc08f',INK,.045);
  }
  function wheel(c,x,y,r,a) {
    c.save();c.translate(x,y);c.scale(1,.92);c.rotate(a);
    sphere(c,0,0,r,['#d9b16d','#9e703d','#4b3a34'],INK,.055);
    ellipse(c,0,0,r*.76,r*.76,'#564639','#d5bd8a',.045);
    for(let i=0;i<6;i++){
      const q=i*PI/3;line(c,[[0,0],[Math.cos(q)*r*.72,Math.sin(q)*r*.72]],'#c59c64',.06);
    }
    sphere(c,0,0,r*.23,STEEL,INK,.03);c.restore();
  }
  function ram(c,u,T,bob,rear,direction) {
    if(direction===2||direction===6){ramVertical(c,u,T,rear);return;}
    const a=(u.gait||0)*2;
    const sw=u.swing>0?Math.sin(Math.min(1,u.swing/.28)*PI):0, push=sw*.42;
    wheel(c,-.45,.45,.27,a);wheel(c,.48,.45,.27,a);
    poly(c,[[-.92,.42],[.69,.42],[.95,.15],[-.67,.12]],'#b7834b',INK,.06);
    poly(c,[[-.92,.42],[.69,.42],[.69,.61],[-.92,.61]],'#715137',INK,.055);
    /* Log and iron nose are visible beyond the shelter. */
    rect(c,-.56,-.05,1.75+push,.28,.1,linear(c,0,-.05,0,.23,['#d3a56b','#a47745','#654b35']),INK,.06);
    for(let x=-.3;x<1+push;x+=.35)rect(c,x,-.05,.09,.28,.02,'#738995',INK,.025);
    rect(c,1.0+push,-.12,.35,.4,.09,linear(c,1+push,0,1.34+push,0,STEEL),INK,.06);
    poly(c,[[1.18+push,-.1],[1.47+push,.03],[1.28+push,.23],[1.1+push,.2]],'#afc5d0',INK,.04);
    ellipse(c,1.38+push,.04,.055,.055,'#3d566a');
    for(const x of [-.72,.54]){
      rect(c,x,-.64,.13,1.08,.04,linear(c,x,0,x+.13,0,WOOD),INK,.045);
      rect(c,x-.015,.23,.16,.15,.025,'#a4b7bc',INK,.025);
    }
    poly(c,[[-.93,-.43],[-.56,-.96],[.59,-.96],[.88,-.43]],linear(c,0,-.95,0,-.4,[T.light,T.main,T.dark]),INK,.075);
    poly(c,[[.59,-.96],[.91,-.81],[1.08,-.31],[.88,-.43]],T.dark,INK,.055);
    line(c,[[-.89,-.45],[.87,-.45]],'#e6c984',.095);
    for(const x of [-.46,.39])poly(c,[[x-.055,-.96],[x+.055,-.96],[x+.15,-.43],[x+.03,-.43]],'#bdcbd0',INK,.025);
    line(c,[[-.5,-.86],[.54,-.86]],'rgba(255,255,255,.3)',.04);
    wheel(c,-.64,.69,.31,a);wheel(c,.57,.69,.31,a);
  }
  function ramVertical(c,u,T,rear) {
    const a=(u.gait||0)*2, sign=rear?-1:1;
    const attack=u.swing>0?Math.sin(Math.min(1,u.swing/.28)*PI)*.27:0;
    const end=sign*(1.05+attack);
    /* Wheels are edge-on when driving up or down the battlefield. */
    const profileWheel=(x,y)=>{
      ellipse(c,x,y,.12,.29,linear(c,x-.12,y,x+.12,y,STEEL),INK,.055);
      line(c,[[x-.03,y-.23],[x-.03,y+.23]],'#4d5e6a',.05);
      ellipse(c,x,y+Math.sin(a)*.12,.055,.06,'#b99b65',INK,.025);
    };
    profileWheel(-.72,-.4);profileWheel(.72,-.4);
    poly(c,[[-.69,-.61],[.68,-.61],[.79,.57],[-.77,.57]],linear(c,0,-.5,0,.55,WOOD),INK,.065);
    rect(c,-.15,Math.min(-.6,end),.3,Math.max(.6,end)-Math.min(-.6,end),.07,linear(c,-.15,0,.15,0,WOOD),INK,.055);
    rect(c,-.22,end-sign*.12,.44,.3,.08,linear(c,-.22,end,.22,end,STEEL),INK,.055);
    for(const s of [-1,1]){
      rect(c,s*.59-.055,-.58,.11,1.22,.035,linear(c,s*.6-.05,0,s*.6+.05,0,WOOD),INK,.045);
      rect(c,s*.59-.08,.32,.16,.14,.025,'#a9bec5',INK,.025);
    }
    poly(c,[[0,-1.0],[-.71,-.69],[-.77,.45],[0,.2]],linear(c,-.6,-.6,0,.2,[T.light,T.main]),INK,.065);
    poly(c,[[0,-1.0],[.71,-.69],[.77,.45],[0,.2]],linear(c,0,-.9,.7,.3,[T.main,T.dark]),INK,.065);
    line(c,[[0,-.98],[0,.2]],'#e8cf88',.09);
    line(c,[[-.76,.45],[0,.2],[.76,.45]],'#e8cf88',.075);
    for(const y of [-.51,-.06]){
      line(c,[[-.72,y+.22],[0,y],[.72,y+.22]],'#c6d3d5',.09);
      ellipse(c,-.52,y+.16,.028,.028,'#496171');ellipse(c,.52,y+.16,.028,.028,'#496171');
    }
    profileWheel(-.77,.49);profileWheel(.77,.49);
    line(c,[[-.63,.55],[.63,.55]],'#bb975c',.13);
  }
  const unitDrawers={footman,archer,mage,cavalry,ram};

  function drawUnit(c,u,team,bob,displayFlip) {
    if(!u || u.hero || !unitDrawers[u.key] || !Number.isFinite(u.r)) return false;
    let d=u.dir8===undefined?(u.side==='player'?6:2):u.dir8;
    if(displayFlip)d=(8-d)%8;
    const rear=d===5||d===6||d===7;
    c.save();c.scale(u.r,u.r);c.lineCap='round';c.lineJoin='round';
    if(d>=3&&d<=5)c.scale(-1,1);
    unitDrawers[u.key](c,u,team?TEAM.blue:TEAM.red,bob||0,rear,d);
    c.restore();return true;
  }

  /* Buildings use an illuminated front face, a darker side and a beveled
     foundation. Static geometry is cached at 2x; only light accents animate. */
  function base(c,T) {
    ellipse(c,52,87,48,12,'rgba(24,48,37,.3)');
    poly(c,[[7,74],[81,69],[96,80],[21,88]],'#e8dfb8',INK,1.15);
    poly(c,[[21,88],[96,80],[96,91],[21,99]],linear(c,0,80,0,99,['#b2b8a2','#7a8e88']),INK,1.1);
    poly(c,[[7,74],[21,88],[21,99],[7,85]],'#6c827e',INK,1.1);
    poly(c,[[22,91],[95,83],[95,88],[22,96]],T.dark);
    line(c,[[22,88],[94,80]],'#fff5cf',1.4);
    for(let i=0;i<5;i++)line(c,[[29+i*13,91-i*1.2],[29+i*13,96-i*1.2]],'#536e70',.8);
    /* Small tufts soften the join without hiding the exact footprint. */
    poly(c,[[5,86],[5,80],[8,83],[10,78],[11,85],[15,83],[14,89]],'#4d8b57');
    poly(c,[[85,95],[87,89],[89,92],[93,87],[92,94],[95,92],[95,96]],'#65975d');
  }
  function wall(c,x,y,w,h,depth) {
    poly(c,[[x+w,y],[x+w+depth,y-depth*.55],[x+w+depth,y+h-depth*.55],[x+w,y+h]],
      linear(c,x+w,y,x+w+depth,y+h,['#b6bda8','#819a99']),INK,1.05);
    rect(c,x,y,w,h,2.4,linear(c,x,y,x+w*.7,y+h,STONE),INK,1.2);
    poly(c,[[x,y],[x+depth,y-depth*.55],[x+w+depth,y-depth*.55],[x+w,y]],'#fff6d6',INK,1);
    for(let yy=y+10;yy<y+h-3;yy+=11){
      line(c,[[x+2,yy],[x+w-2,yy]],'rgba(82,108,110,.23)',.8);
      for(let xx=x+6+((Math.round((yy-y)/11)%2)*8);xx<x+w-3;xx+=16)
        line(c,[[xx,yy],[xx,Math.min(y+h-2,yy+10)]],'rgba(82,108,110,.17)',.8);
    }
    line(c,[[x+1,y+2],[x+1,y+h-3]],'#fff9df',1.2);
  }
  function gable(c,x,y,w,h,depth,T) {
    poly(c,[[x+w*.5,y-h],[x+w,y],[x+w+depth,y-depth*.55],[x+w*.5+depth,y-h-depth*.55]],
      linear(c,x+w*.6,y-h,x+w,y,[T.main,T.dark]),INK,1.4);
    poly(c,[[x-4,y+2],[x+w*.5,y-h],[x+w+4,y+2]],linear(c,x,y-h,x+w*.8,y,[T.light,T.main,T.dark]),INK,1.4);
    line(c,[[x-4,y+2],[x+w*.5,y-h]],T.pale,1.45);
    for(let i=1;i<4;i++){
      const fy=i/4;line(c,[[x+w*.5-(w*.5+3)*fy,y-h+h*fy],[x+w*.5+(w*.5+3)*fy,y-h+h*fy]],'rgba(12,44,89,.25)',.8);
    }
    line(c,[[x-4,y+2],[x+w+4,y+2]],'#e7c16c',2.5);
    line(c,[[x+w*.5,y-h],[x+w*.5+depth,y-h-depth*.55]],'#f2d28e',1.8);
  }
  function pyramid(c,x,y,w,h,T) {
    poly(c,[[x-w*.5,y],[x-2,y-h],[x+w*.1,y+5]],linear(c,x-w*.4,y-h,x,y+5,[T.light,T.main]),INK,1.3);
    poly(c,[[x-2,y-h],[x+w*.55,y-4],[x+w*.1,y+5]],linear(c,x,y-h,x+w*.5,y,[T.main,T.dark]),INK,1.3);
    line(c,[[x-w*.5,y],[x+w*.1,y+5],[x+w*.55,y-4]],'#edc77d',1.8);
    line(c,[[x-2,y-h],[x-w*.5,y]],T.pale,1.4);
    sphere(c,x-2,y-h-2,2.4,['#fff4c7','#f0c467','#b3833f'],INK,.7);
  }
  function door(c,x,y,w,h,wood) {
    c.beginPath();c.moveTo(x-w*.5,y+h);c.lineTo(x-w*.5,y+w*.42);
    c.arc(x,y+w*.42,w*.5,PI,0);c.lineTo(x+w*.5,y+h);c.closePath();
    finish(c,wood?linear(c,x-w*.5,y,x+w*.5,y+h,['#b48850','#7b5334','#473c32']):'#26394c',INK,1);
    line(c,[[x,y+3],[x,y+h]],wood?'#493b30':'#162a3b',.9);
    if(wood){
      line(c,[[x-w*.4,y+h*.65],[x+w*.4,y+h*.65]],'#d1b66f',1.8);
      ellipse(c,x+w*.2,y+h*.62,1,1,'#fee4a1');
    }else{
      c.beginPath();c.arc(x-1,y+h*.43,w*.31,PI,0);c.strokeStyle='#577185';c.lineWidth=.9;c.stroke();
    }
  }
  function windowSlit(c,x,y,w,h,glow) {
    rect(c,x-w*.5,y,w,h,Math.min(w*.4,2),'#46586b','#f5e6bd',.8);
    rect(c,x-w*.3,y+1,w*.6,h-2,1,glow||'#f2cb76');
    line(c,[[x,y+1],[x,y+h-1]],'#6c6f6a',.7);
  }
  function banner(c,x,y,w,h,T) {
    poly(c,[[x-w*.5,y],[x+w*.5,y],[x+w*.5,y+h*.77],[x,y+h],[x-w*.5,y+h*.77]],
      linear(c,x-w*.5,y,x+w*.5,y+h,[T.light,T.main,T.dark]),'#d7b979',.9);
    line(c,[[x-w*.46,y+1],[x-w*.46,y+h*.75]],T.pale,.8);
    star(c,x,y+h*.38,w*.24,'#ffe3a2');
  }
  function poleFlag(c,x,y,w,h,T) {
    line(c,[[x,y+h],[x,y-4]],'#6c6048',1.4);
    poly(c,[[x+1,y],[x+w*.57,y+1],[x+w,y+5],[x+w*.78,y+h*.55],[x+w*.35,y+h*.5],[x+1,y+h*.57]],
      linear(c,x,y,x+w,y+h,[T.light,T.main,T.dark]),INK,.7);
    line(c,[[x+2,y+1],[x+w*.5,y+2]],T.pale,.7);
    sphere(c,x,y-4,1.8,['#fff4cb','#d7ae58','#8c6b37'],INK,.5);
  }
  function cylinder(c,x,y,w,h,T) {
    rect(c,x-w*.5,y,w,h,w*.15,linear(c,x-w*.5,y,x+w*.5,y+h,['#fff0cb','#d9d6b6','#8daba8']),INK,1.25);
    ellipse(c,x,y,w*.5,w*.16,'#efe6c2',INK,1);
    ellipse(c,x,y+h-2,w*.5,w*.14,'#a9b6a1');
    for(let yy=y+10;yy<y+h-6;yy+=11){
      c.beginPath();c.ellipse(x,yy,w*.49,w*.12,0,0,PI);c.strokeStyle='rgba(83,109,107,.24)';c.lineWidth=.8;c.stroke();
      line(c,[[x-w*.22,yy+1],[x-w*.22,yy+10]],'rgba(83,109,107,.18)',.8);
      line(c,[[x+w*.24,yy+2],[x+w*.24,yy+11]],'rgba(83,109,107,.18)',.8);
    }
    rect(c,x-w*.55,y+h-9,w*1.1,7,2,T.dark,INK,.9);
    line(c,[[x-w*.5,y+h-9],[x+w*.48,y+h-9]],T.light,1.4);
  }
  function gear(c,x,y,r) {
    c.save();c.translate(x,y);
    for(let i=0;i<10;i++){
      c.save();c.rotate(i*TAU/10);rect(c,-r*.16,-r*1.15,r*.32,r*.42,1.1,'#c7a15c',INK,.6);c.restore();
    }
    sphere(c,0,0,r,['#ffecb8','#d1a455','#987140'],INK,.9);
    ellipse(c,0,0,r*.66,r*.66,'#795f3f','#f4d492',.8);
    for(let i=0;i<6;i++){
      const a=i*TAU/6;line(c,[[Math.cos(a)*r*.2,Math.sin(a)*r*.2],[Math.cos(a)*r*.62,Math.sin(a)*r*.62]],'#d9b36e',r*.13);
    }
    sphere(c,0,0,r*.2,STEEL,INK,.5);c.restore();
  }
  function crystal(c,x,y,r,glow) {
    if(glow){
      const g=c.createRadialGradient(x,y,0,x,y,r*2.4);g.addColorStop(0,'rgba(122,214,255,.5)');g.addColorStop(1,'rgba(100,145,255,0)');
      ellipse(c,x,y,r*2.4,r*2.4,g);
    }
    poly(c,[[x,y-r*1.36],[x+r*.62,y-r*.38],[x+r*.48,y+r*.5],[x,y+r],[x-r*.53,y+r*.4],[x-r*.56,y-r*.43]],'#97ddff',INK,.9);
    poly(c,[[x,y-r*1.36],[x-r*.13,y-r*.04],[x-r*.53,y+r*.4],[x-r*.56,y-r*.43]],'#d8ffff');
    poly(c,[[x,y-r*1.36],[x+r*.62,y-r*.38],[x+r*.48,y+r*.5],[x-r*.13,y-r*.04]],'#54a9e9');
    poly(c,[[x-r*.13,y-r*.04],[x+r*.48,y+r*.5],[x,y+r],[x-r*.53,y+r*.4]],'#6c8cdb');
    line(c,[[x,y-r*1.3],[x-r*.13,y-r*.04],[x,y+r*.94]],'#e4ffff',.8);
  }

  function hall(c,T,tier) {
    /* A compact keep grows an upper donjon and gold crown at higher tiers. */
    wall(c,23,40,48,45,12);
    wall(c,15,43,16,42,5);pyramid(c,23,43,27,21,T);
    wall(c,70,37,16,42,6);pyramid(c,78,37,27,23,T);
    gable(c,30,40,36,21,11,T);
    if(tier>=2){
      wall(c,35,19,28,33,8);
      pyramid(c,49,20,41,tier>=3?24:21,T);
      windowSlit(c,48,28,5,10);
      banner(c,60,31,7,17,T);
    }
    door(c,47,57,19,28,true);
    poly(c,[[34,86],[60,86],[66,91],[29,93]],'#e6d6aa',INK,.7);
    line(c,[[33,89],[62,88]],'#fff1c6',1);
    windowSlit(c,22,56,4,9);windowSlit(c,78,49,4,9);
    banner(c,30,50,8,20,T);banner(c,65,49,8,20,T);
    if(tier>=3){
      poly(c,[[37,2],[35,-7],[43,-2],[48,-12],[53,-2],[61,-7],[59,2]],
        linear(c,40,-10,56,4,['#fff2b7','#e7b950','#ad772a']),INK,1);
      ellipse(c,48,-2,2,2,'#5ab9ff','#fff1b6',.7);
    } else poleFlag(c,tier===2?67:47,tier===2?1:16,15,16,T);
    shield(c,47,50,10,12,T,INK);
  }
  function mine(c,T) {
    /* Faceted gold-bearing rocks, reinforced portal and a loaded ore cart. */
    poly(c,[[9,72],[13,42],[28,20],[49,14],[70,26],[84,52],[85,75]],'#667e82',INK,1.4);
    poly(c,[[13,42],[28,20],[49,14],[46,49],[25,67],[9,72]],'#b1bbb0');
    poly(c,[[49,14],[70,26],[84,52],[60,56],[46,49]],'#8c9f9b');
    poly(c,[[28,20],[29,42],[46,49],[49,14]],'#c5caba');
    line(c,[[18,47],[27,36],[32,42],[38,33]],'#f0c85f',3.2);
    line(c,[[56,26],[62,39],[72,38],[77,49]],'#edbf49',3.2);
    star(c,26,36,3,'#fff0ac');star(c,67,39,2.3,'#fff0ac');
    door(c,46,48,28,36,false);
    rect(c,26,48,8,37,2,linear(c,26,0,34,0,WOOD),INK,1.1);
    rect(c,58,48,8,37,2,linear(c,58,0,66,0,WOOD),INK,1.1);
    rect(c,24,44,44,9,2,linear(c,24,44,24,53,WOOD),INK,1.1);
    gable(c,24,44,44,9,6,T);
    for(const x of [30,62])for(const y of [56,75])ellipse(c,x,y,1.2,1.2,'#ffe2a3','#4e5149',.4);
    line(c,[[38,78],[29,91]],'#53636c',2);line(c,[[52,78],[52,89]],'#53636c',2);
    for(let i=0;i<3;i++)line(c,[[34-i*2,83+i*3],[52,81+i*3]],'#98754a',1.5);
    /* Lit lantern, with a gentle warm halo baked into the static cache. */
    const glow=c.createRadialGradient(22,58,0,22,58,10);glow.addColorStop(0,'rgba(255,209,89,.4)');glow.addColorStop(1,'rgba(255,209,89,0)');
    ellipse(c,22,58,10,10,glow);line(c,[[24,49],[20,51],[20,55]],'#3d4f58',1.1);
    rect(c,18,55,6,8,1,'#ffe4a1','#695c3c',.9);
    poly(c,[[65,73],[88,70],[91,84],[69,88]],linear(c,70,73,80,88,['#8ba1ac','#576d7d']),INK,1.1);
    line(c,[[69,79],[87,76]],'#b9cbd0',1);
    [[70,72,4],[78,69,4.5],[85,71,3.6],[75,74,3.4]].forEach(([x,y,r])=>{
      poly(c,[[x-r,y],[x-r*.4,y-r],[x+r*.5,y-r*.7],[x+r,y+r*.5],[x-r*.3,y+r*.8]],'#efc04f','#9f7733',.6);
      line(c,[[x-r*.4,y-r*.7],[x+r*.3,y-r*.5]],'#fff0a8',.8);
    });
    sphere(c,72,88,3.5,STEEL,INK,.8);sphere(c,87,85,3.5,STEEL,INK,.8);
  }
  function barracks(c,T) {
    wall(c,16,44,59,38,11);gable(c,12,45,66,28,10,T);
    rect(c,14,77,62,7,2,'#b49868',INK,.9);
    door(c,46,57,19,28,true);
    windowSlit(c,25,58,7,9);windowSlit(c,67,55,6,9);
    shield(c,45,42,18,22,T,INK);
    /* Crossed swords are a readable production icon at battlefield size. */
    c.save();c.translate(45,39);
    for(const s of [-1,1]){
      c.save();c.rotate(s*.62);
      rect(c,-1,-21,2,36,.7,'#d5e6e9',INK,.65);
      poly(c,[[-1,-21],[0,-27],[1,-21]],'#fff4cf',INK,.5);
      rect(c,-4,8,8,2,.7,'#efce83',INK,.5);c.restore();
    }
    c.restore();shield(c,45,42,15,19,T,INK);
    banner(c,78,51,8,24,T);
    poleFlag(c,24,19,14,14,T);
    /* Outdoor sword rack and a supply barrel. */
    rect(c,9,64,4,18,1,'#8f653f',INK,.7);rect(c,6,66,14,3,1,'#c49455',INK,.7);
    line(c,[[9,65],[16,52]],'#d5e6e9',2);line(c,[[12,67],[19,55]],'#d5e6e9',2);
    ellipse(c,83,79,6,3,'#b48c54',INK,.7);rect(c,77,79,12,8,2,'#9f7242',INK,.8);
    line(c,[[77,81],[89,81]],'#bec7bc',1.2);
  }
  function archery(c,T) {
    const R={main:'#498b62',dark:'#285d52',light:'#94c879',pale:'#cfdfa1'};
    wall(c,23,48,50,35,9);gable(c,18,48,60,24,9,R);
    rect(c,22,71,53,13,2,'#a27c4c',INK,.9);
    door(c,44,62,16,22,true);banner(c,67,51,9,21,T);
    /* A circular target mounted above the entrance is the primary read. */
    ellipse(c,43,41,13,13,linear(c,30,30,54,54,['#fff2cf','#d3c6a3']),INK,1.2);
    ellipse(c,43,41,9,9,'#ac4c45','#d9ab7d',.8);ellipse(c,43,41,5.1,5.1,'#eee5c2');ellipse(c,43,41,2.3,2.3,'#a54a42');
    line(c,[[47,39],[59,28]],'#d4af73',1.3);poly(c,[[57,29],[57,24],[63,24],[61,29]],'#f3e9c6',INK,.5);
    /* An oversized bow on the left and grouped arrows show the function. */
    c.beginPath();c.moveTo(13,44);c.bezierCurveTo(0,51,0,69,13,78);c.strokeStyle='#514637';c.lineWidth=4.7;c.stroke();
    c.strokeStyle='#d7b76f';c.lineWidth=2.7;c.stroke();line(c,[[13,44],[19,61],[13,78]],'#fff1c8',.9);
    rect(c,79,65,9,21,2,'#795938',INK,.8);
    for(let i=0;i<3;i++){
      line(c,[[81+i*2.5,67],[82+i*2.5,52-i]],'#b39561',1);
      poly(c,[[79+i*2.5,57-i],[82+i*2.5,50-i],[85+i*2.5,57-i]],'#f8edd0',INK,.4);
    }
    poleFlag(c,71,19,14,14,T);
  }
  function stable(c,T) {
    wall(c,17,44,59,40,10);gable(c,13,44,65,24,10,T);
    /* Broad stable doors, exposed beams, straw and a gilded horse crest. */
    door(c,47,53,31,31,false);
    rect(c,29,65,36,18,1,linear(c,29,65,29,83,WOOD),INK,.9);
    line(c,[[31,67],[62,81]],'#d2ae6d',2);line(c,[[63,67],[32,81]],'#d2ae6d',2);
    rect(c,14,43,5,41,1,'#9c7448',INK,.7);rect(c,74,42,5,39,1,'#795839',INK,.7);
    ellipse(c,46,37,10,11,linear(c,40,27,53,47,['#ffe9af','#d4a957','#997134']),INK,1);
    poly(c,[[40,43],[42,32],[48,28],[53,33],[50,36],[47,35],[49,44]],'#4b5e68','#fff0bb',.7);
    /* Pale nose of the stable horse peeks above the half-door. */
    poly(c,[[43,62],[43,57],[46,53],[51,55],[54,60],[50,65]],'#bc9468',INK,.7);
    poly(c,[[45,54],[45,50],[48,54]],'#84634b',INK,.6);ellipse(c,50,57,1,1,'#263847');
    banner(c,25,48,8,18,T);banner(c,68,47,8,18,T);
    for(const x of [10,86]){
      line(c,[[x,78],[x,28]],'#72563b',1.8);
      poly(c,[[x-3,30],[x,20],[x+3,30]],'#e0e9df',INK,.8);
      poly(c,[[x+1,33],[x+11,38],[x+1,43]],T.main,'#efd399',.7);
    }
    for(let i=0;i<7;i++)line(c,[[22+i*6,85],[20+i*6,80]],'#d7bb69',1.3);
  }
  function workshop(c,T) {
    wall(c,9,45,73,39,8);
    /* Repeated roof bays and a warm furnace provide a broader silhouette. */
    for(let i=0;i<3;i++)gable(c,8+i*24,46,26,17,7,T);
    rect(c,72,14,9,30,1.5,linear(c,72,14,81,40,['#a7b8b1','#5d7780']),INK,1.1);
    rect(c,69,12,15,6,1.5,'#cfb77d',INK,.9);
    rect(c,73,17,3,15,.5,'#d4ddd0');
    door(c,47,55,24,29,false);
    for(let i=0;i<4;i++)line(c,[[37,63+i*5],[57,63+i*5]],'#5f6c70',.9);
    rect(c,12,58,15,20,3,'#4b4240',INK,.9);
    const fg=c.createRadialGradient(20,73,1,20,70,13);fg.addColorStop(0,'#ffeac0');fg.addColorStop(.35,'#f9b353');fg.addColorStop(1,'#bc4d36');
    rect(c,14,62,11,13,2,fg,INK,.7);
    line(c,[[17,63],[17,75]],'#66534b',1);line(c,[[22,63],[22,75]],'#66534b',1);
    gear(c,72,62,10);gear(c,82,77,6);
    rect(c,9,79,22,5,1,'#a3b5b5',INK,.8);
    poly(c,[[17,68],[13,70],[14,75],[23,75],[25,72],[30,71],[26,68]],'#7c929f',INK,.8);
    banner(c,61,48,7,20,T);
    /* Two soft puffs are static on icons; live smoke is added after caching. */
    ellipse(c,77,6,5,3,'rgba(211,222,208,.65)');ellipse(c,81,-1,4,3,'rgba(211,222,208,.35)');
  }
  function sanctum(c,T) {
    cylinder(c,49,47,43,37,T);
    ellipse(c,49,47,26,8,'#d9bd7d',INK,1.1);ellipse(c,49,43,23,6,T.dark,INK,.9);
    for(const x of [26,69]){
      rect(c,x,48,5,32,1.7,'#e5d4a3',INK,.7);
      poly(c,[[x-2,52],[x+2,42],[x+7,52]],'#f6e5b7',INK,.7);
    }
    door(c,49,62,13,22,false);
    line(c,[[49,64],[49,77]],'#b2a0e2',1.1);star(c,49,69,3.5,'#b4c6ff');
    banner(c,30,55,7,19,T);banner(c,67,55,7,19,T);
    const glow=c.createRadialGradient(49,24,2,49,24,28);glow.addColorStop(0,'rgba(170,179,255,.55)');glow.addColorStop(1,'rgba(107,130,245,0)');
    ellipse(c,49,24,28,28,glow);
    for(const s of [-1,1]){
      c.beginPath();c.moveTo(49+s*13,43);c.quadraticCurveTo(49+s*26,28,49+s*17,15);
      c.strokeStyle='#564b6b';c.lineWidth=5;c.stroke();c.strokeStyle='#e2bd74';c.lineWidth=3;c.stroke();
    }
    sphere(c,49,23,17,['#f6ffff','#d5b5ff','#8b72cd','#4b5c9d'],INK,1.1);
    c.save();c.translate(49,23);c.rotate(-.4);ellipse(c,0,0,23,7,null,'#f0d191',1.6);c.restore();
    star(c,43,17,4,'#fff7e6');star(c,22,21,3,'#e2ddff');star(c,77,29,2.3,'#e2ddff');
  }
  function outpost(c,T) {
    /* An unarmed lookout: timber legs, an open deck and a rally pennant. */
    for(const x of [28,64])rect(c,x,40,7,43,1.3,linear(c,x,0,x+7,0,WOOD),INK,1);
    line(c,[[32,77],[68,46]],'#b38750',4);line(c,[[32,46],[68,77]],'#8e633e',4);
    line(c,[[32,77],[68,46]],'#e0bd7d',.9);
    rect(c,24,36,49,10,2,linear(c,24,36,24,46,['#ffe5ab','#a47c4d']),INK,1.1);
    rect(c,23,34,52,5,1.5,T.dark,INK,.9);
    rect(c,29,19,4,18,1,'#b18a56',INK,.8);rect(c,65,19,4,18,1,'#927043',INK,.8);
    gable(c,21,21,53,16,7,T);
    banner(c,49,37,15,27,T);
    poleFlag(c,48,0,18,17,T);
    /* Rope ladder makes the open silhouette legible as an occupied lookout. */
    line(c,[[54,52],[54,84]],'#dcc093',1.2);line(c,[[61,52],[61,84]],'#dcc093',1.2);
    for(let y=55;y<84;y+=5)line(c,[[54,y],[61,y]],'#aa8656',1.6);
    rect(c,22,79,17,6,2,'#b3ad8a',INK,.8);rect(c,62,79,17,6,2,'#b3ad8a',INK,.8);
  }
  function guardTower(c,T) {
    cylinder(c,49,29,40,54,T);
    windowSlit(c,49,53,6,13);banner(c,32,46,7,21,T);
    ellipse(c,49,28,30,9,'#d1ccb0',INK,1.1);
    rect(c,20,24,58,10,2,linear(c,20,24,74,34,['#fff1c8','#c5c7ab','#8ca29a']),INK,1.1);
    for(let i=0;i<4;i++)rect(c,21+i*15,14,11,15,1.5,linear(c,0,14,0,29,[T.light,T.main,T.dark]),INK,1.05);
    line(c,[[22,15],[31,15]],T.pale,1.2);
    /* A mounted crossbow, rather than a cannon, matches the arrow attack. */
    c.save();c.translate(49,17);
    rect(c,-3,-14,6,23,1.5,'#9b7646',INK,.9);
    c.beginPath();c.moveTo(-22,-5);c.quadraticCurveTo(0,-22,22,-5);
    c.strokeStyle='#3c4c59';c.lineWidth=4;c.stroke();c.strokeStyle='#d2b47b';c.lineWidth=2.3;c.stroke();
    line(c,[[-22,-5],[0,4],[22,-5]],'#f8e8b5',.8);
    line(c,[[0,3],[0,-20]],'#a9c4ce',1.7);poly(c,[[-3,-17],[0,-25],[3,-17]],'#edf7eb',INK,.6);
    c.restore();
    rect(c,36,79,27,7,2,T.main,INK,.9);
  }
  function arcaneTower(c,T) {
    cylinder(c,49,38,32,45,T);
    ellipse(c,49,38,23,7,T.dark,INK,1);
    ellipse(c,49,34,23,6,'#e4c480',INK,.9);
    windowSlit(c,49,58,5,11,'#accbff');banner(c,32,49,7,21,T);
    for(const s of [-1,1]){
      c.beginPath();c.moveTo(49+s*17,35);c.quadraticCurveTo(49+s*27,17,49+s*12,2);
      c.strokeStyle='#6b5c76';c.lineWidth=6;c.stroke();c.strokeStyle='#e5c180';c.lineWidth=3.3;c.stroke();
    }
    crystal(c,49,14,17,true);
    c.save();c.translate(49,17);c.rotate(-.4);ellipse(c,0,0,26,7,null,'rgba(189,217,255,.85)',1.1);c.restore();
    star(c,24,12,2.5,'#e0f3ff');star(c,76,22,3,'#ddedff');
    rect(c,35,78,29,8,2,T.main,INK,.9);line(c,[[38,80],[61,80]],'#d7c58b',1.3);
  }
  const buildingDrawers={hall,mine,elixirBase:mine,barracks,archery,assaultBarracks:stable,workshop,sanctum,tower:outpost,guardTower,arcaneTower};

  function drawBuilding(c,key,level,px,py,pw,ph,side,tierNow,isFriendly) {
    const fn=buildingDrawers[key];if(!fn)return false;
    const team=isFriendly===undefined?(side==='player'||side===true):isFriendly;
    const T=team?TEAM.blue:TEAM.red;
    const tier=Math.max(1,Math.min(3,tierNow||1));
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

  global.RoyalArt={drawUnit,drawBuilding,version:'2026.10.23',clearCache:function(){caches.clear();}};
})(typeof window!=='undefined'?window:globalThis);
