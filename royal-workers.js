/* Mine transport, 2026-10-24. Authoritative simulation only; no frame time,
   random routing, DOM dependency or modification of combat balance.
   Loaded before the game's inline script; S/BAL are read only at call time. */

function workerTransportOn(){
  return !!(BAL.ECON&&BAL.ECON.workerTransport);
}
function workerProcessionOn(){
  return workerTransportOn()&&!!BAL.ECON.workerProcession;
}
function workerInMine(u){
  return !!(u&&workerProcessionOn()&&u.workerInside);
}
function mineWorkerCap(b){
  const max=Math.max(1,Math.floor(Number(BAL.ECON.mineMax)||5));
  return Math.max(1,Math.min(max,Math.floor(Number(b.level)||1)));
}
function aliveWorkers(b){
  return S.units.filter(u=>(u.worker||u.key==="worker")&&u.src===b.id&&u.side===b.side&&u.hp>0).length;
}
function mineWorkersAlive(b){return aliveWorkers(b);}
function workerDepotKey(key){
  return key==="hall"||key==="tower"||key==="guardTower"||key==="arcaneTower";
}
function workerMine(u){
  return S.buildings.find(b=>b.id===u.src&&b.side===u.side&&b.key==="elixirBase"&&b.hp>0)||null;
}

/* This cache is entirely derived from current geometry. Terrain is included in
   the key so an editor change or a newly placed/destroyed building is respected
   immediately, without relying on the combat pathfinder's occupancy cache. */
var workerNavCache=null;
function workerNavContext(){
  const mask=new Array(COLS*ROWS);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const tile=S.tiles[y]&&S.tiles[y][x],tr=tile&&tile.terr;
    mask[y*COLS+x]=!tile||(tr&&TERR[tr]&&TERR[tr].pass===false)?1:0;
  }
  for(const b of S.buildings){
    if(b.hp<=0)continue;
    for(let y=b.ty;y<b.ty+b.h;y++)for(let x=b.tx;x<b.tx+b.w;x++)
      if(x>=0&&y>=0&&x<COLS&&y<ROWS)mask[y*COLS+x]=1;
  }
  const signature=mask.join("");
  if(workerNavCache&&workerNavCache.state===S&&workerNavCache.signature===signature)return workerNavCache;
  workerNavCache={state:S,signature,mask,clearByRadius:Object.create(null)};
  return workerNavCache;
}
function workerPointClear(x,y,nav,r){
  if(!Number.isFinite(x)||!Number.isFinite(y)||x-r<0||y-r<0||x+r>COLS*TILE||y+r>ROWS*TILE)return false;
  const x0=Math.floor((x-r)/TILE),x1=Math.min(COLS-1,Math.floor((x+r)/TILE));
  const y0=Math.floor((y-r)/TILE),y1=Math.min(ROWS-1,Math.floor((y+r)/TILE));
  for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){
    if(!nav.mask[ty*COLS+tx])continue;
    const dx=x-Math.max(tx*TILE,Math.min((tx+1)*TILE,x));
    const dy=y-Math.max(ty*TILE,Math.min((ty+1)*TILE,y));
    if(dx*dx+dy*dy<r*r-1e-6)return false;
  }
  return true;
}
function workerClearTiles(nav,r){
  const key=String(r);
  if(nav.clearByRadius[key])return nav.clearByRadius[key];
  const clear=new Array(COLS*ROWS);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)
    clear[y*COLS+x]=!nav.mask[y*COLS+x]&&workerPointClear((x+.5)*TILE,(y+.5)*TILE,nav,r);
  nav.clearByRadius[key]=clear;
  return clear;
}
function workerSegmentClear(x0,y0,x1,y1,nav,r){
  const d=Math.hypot(x1-x0,y1-y0),n=Math.max(1,Math.ceil(d/Math.max(1,Math.min(TILE/8,r/2))));
  for(let i=0;i<=n;i++){
    const k=i/n;
    if(!workerPointClear(x0+(x1-x0)*k,y0+(y1-y0)*k,nav,r))return false;
  }
  return true;
}
function workerPerimeter(b,nav,r){
  const open=workerClearTiles(nav,r),tiles=[];
  for(let y=Math.max(0,b.ty-1);y<=Math.min(ROWS-1,b.ty+b.h);y++)
    for(let x=Math.max(0,b.tx-1);x<=Math.min(COLS-1,b.tx+b.w);x++){
      if(x>=b.tx&&x<b.tx+b.w&&y>=b.ty&&y<b.ty+b.h)continue;
      const tile=y*COLS+x;if(open[tile])tiles.push(tile);
    }
  return tiles;
}

/* Integer 8-way Dijkstra. Equal lengths choose the lower building ID, then the
   lower endpoint tile. Diagonals require both adjacent cardinal tiles open. */
function workerHeapPush(heap,item){
  let at=heap.length;heap.push(item);
  while(at){
    const p=(at-1)>>1,a=heap[p];
    if(a.g<item.g||(a.g===item.g&&a.tile<=item.tile))break;
    heap[at]=a;at=p;
  }
  heap[at]=item;
}
function workerHeapPop(heap){
  const root=heap[0],last=heap.pop();
  if(heap.length){
    let at=0;
    while(at*2+1<heap.length){
      let child=at*2+1;
      if(child+1<heap.length){const a=heap[child],b=heap[child+1];if(b.g<a.g||(b.g===a.g&&b.tile<a.tile))child++;}
      const a=heap[child];
      if(last.g<a.g||(last.g===a.g&&last.tile<=a.tile))break;
      heap[at]=a;at=child;
    }
    heap[at]=last;
  }
  return root;
}
function workerRoute(u,targets,nav){
  const r=Math.max(1,Number(u.r)||7),open=workerClearTiles(nav,r);
  const sx=Math.floor(u.x/TILE),sy=Math.floor(u.y/TILE),start=sy*COLS+sx;
  if(sx<0||sy<0||sx>=COLS||sy>=ROWS||!open[start]||!workerPointClear(u.x,u.y,nav,r))return null;
  const goals=new Map();
  for(const t of targets){
    for(const tile of t.tiles){
      if(!open[tile])continue;
      const prior=goals.get(tile);
      if(!prior||t.building.id<prior.id)goals.set(tile,t.building);
    }
  }
  if(!goals.size)return null;
  const costs=new Array(COLS*ROWS).fill(Infinity),came=new Array(COLS*ROWS).fill(-1),heap=[];
  costs[start]=0;workerHeapPush(heap,{tile:start,g:0});
  let best=null;
  while(heap.length){
    const cur=workerHeapPop(heap),tile=cur.tile;
    if(cur.g!==costs[tile])continue;
    if(best&&cur.g>best.cost)break;
    const building=goals.get(tile);
    if(building){
      if(!best||cur.g<best.cost||(cur.g===best.cost&&(building.id<best.building.id||(building.id===best.building.id&&tile<best.endTile))))
        best={building,cost:cur.g,endTile:tile};
      continue;
    }
    const x=tile%COLS,y=(tile-x)/COLS;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dy)continue;
      const nx=x+dx,ny=y+dy,next=ny*COLS+nx;
      if(nx<0||ny<0||nx>=COLS||ny>=ROWS||!open[next])continue;
      if(dx&&dy&&(!open[y*COLS+nx]||!open[ny*COLS+x]))continue;
      const cost=cur.g+(dx&&dy?1414:1000);
      if(cost>=costs[next])continue;
      costs[next]=cost;came[next]=tile;workerHeapPush(heap,{tile:next,g:cost});
    }
  }
  if(!best)return null;
  const path=[];
  for(let tile=best.endTile;tile!==start;tile=came[tile]){
    if(tile<0)return null;
    const x=tile%COLS,y=(tile-x)/COLS;path.push({x:(x+.5)*TILE,y:(y+.5)*TILE});
  }
  path.reverse();
  const center={x:(sx+.5)*TILE,y:(sy+.5)*TILE};
  if(!path.length)path.push(center);
  else if(!workerSegmentClear(u.x,u.y,path[0].x,path[0].y,nav,r))path.unshift(center);
  best.path=path;
  return best;
}
function workerDepotTargets(u,nav){
  const targets=[],r=Math.max(1,Number(u.r)||7);
  for(const b of S.buildings)
    if(b.hp>0&&b.side===u.side&&workerDepotKey(b.key))targets.push({building:b,tiles:workerPerimeter(b,nav,r)});
  return targets;
}
function nearestWorkerDepot(u){
  if(!u||u.hp<=0)return null;
  const nav=workerNavContext(),route=workerRoute(u,workerDepotTargets(u,nav),nav);
  return route?route.building:null;
}
function workerChoosePad(b,slot,nav){
  const r=Math.max(1,Number(BAL.WORKER&&BAL.WORKER.r)||7),perimeter=workerPerimeter(b,nav,r);
  if(!perimeter.length)return null;
  const candidates=perimeter.map(tile=>{
    const x=tile%COLS,y=(tile-x)/COLS,u={x:(x+.5)*TILE,y:(y+.5)*TILE,side:b.side,r};
    const route=workerRoute(u,workerDepotTargets(u,nav),nav);
    return {tile,x:u.x,y:u.y,cost:route?route.cost:Infinity};
  });
  candidates.sort((a,b)=>a.cost-b.cost||a.tile-b.tile);
  /* Adjacent mines and halls can share the very same perimeter tile. Prefer a
     working pad outside that receiving apron, so a miner has a visible trip.
     Once assigned, this pad stays fixed even if a closer outpost is later built. */
  const positive=candidates.filter(p=>Number.isFinite(p.cost)&&p.cost>0);
  const inaccessible=candidates.filter(p=>!Number.isFinite(p.cost));
  const pool=positive.length?positive:inaccessible;
  if(!pool.length)return null;
  const nearest=pool[0].cost,nearby=pool.filter(p=>p.cost<=nearest+1414);
  return nearby[(slot||0)%nearby.length];
}
function syncMineWorkers(b,dt){
  if(!workerTransportOn()||!b||b.key!=="elixirBase"||b.hp<=0)return;
  const cap=mineWorkerCap(b),settings=BAL.WORKER||{};
  if(!Array.isArray(b.workerSlots))b.workerSlots=[];
  for(let i=0;i<cap;i++){
    const slot=b.workerSlots[i]||(b.workerSlots[i]={uid:0,respawn:0});
    const live=slot.uid&&S.units.find(u=>u.uid===slot.uid&&u.src===b.id&&u.side===b.side&&u.hp>0&&(u.worker||u.key==="worker"));
    if(live)continue;
    if(slot.uid){slot.uid=0;slot.respawn=Math.max(0,Number(settings.respawn)||0);continue;}
    slot.respawn=Math.max(0,(Number(slot.respawn)||0)-Math.max(0,dt||0));
    if(slot.respawn>1e-8)continue;
    slot.respawn=0;
    const pad=workerChoosePad(b,i,workerNavContext());
    if(!pad)continue; // A sealed mine retries; a worker is never spawned in a wall.
    const u=spawnUnit("worker",b.side,pad.x,pad.y,false,1);
    Object.assign(u,{worker:true,src:b.id,slot:i,cargo:0,workerState:"mining",depotId:0,
      minePad:pad.tile,workerPath:[],workerGoal:null,workerNavT:0,workerLoadT:0,
      dmg:0,rng:0,hs:1,deploy:0,air:false,melee:false,eng:null});
    if(workerProcessionOn())Object.assign(u,{workerState:"entryQueued",workerInside:false,
      workerTransit:null,workerTransitT:0,workerTransitDuration:0,
      workerEntryAt:Number(S.elapsed)||0,workerReadyAt:0,
      workerMineBounds:{tx:b.tx,ty:b.ty,w:b.w,h:b.h}});
    slot.uid=u.uid;
  }
}

function workerSetRoute(u,route){
  u.workerPath=route?route.path:[];
  u.workerGoal=route?route.endTile:null;
  u.workerNavT=1;
}
function workerPlanDelivery(u,nav){
  const route=workerRoute(u,workerDepotTargets(u,nav),nav);
  workerSetRoute(u,route);u.depotId=route?route.building.id:0;
  u.workerState=route?"deliver":"waiting";
  return route;
}
function workerPlanReturn(u,mine,nav){
  const r=Math.max(1,Number(u.r)||7),pads=workerPerimeter(mine,nav,r);
  let pad=u.minePad;
  if(!pads.includes(pad)){
    const replacement=workerChoosePad(mine,u.slot,nav);
    pad=replacement?replacement.tile:null;u.minePad=pad;
  }
  const route=pad===null?null:workerRoute(u,[{building:mine,tiles:[pad]}],nav);
  workerSetRoute(u,route);u.depotId=0;
  u.workerState=route?"return":"waiting";
  return route;
}
function workerFollowPath(u,dt,nav){
  const path=u.workerPath||[],r=Math.max(1,Number(u.r)||7);
  while(path.length&&Math.hypot(path[0].x-u.x,path[0].y-u.y)<1e-6)path.shift();
  if(!path.length)return true;
  const target=path[0];
  if(!workerSegmentClear(u.x,u.y,target.x,target.y,nav,r)){
    u.workerPath=[];u.workerGoal=null;u.workerNavT=0;return false;
  }
  setFacing(u,target.x-u.x,target.y-u.y);
  const rem=turnStep(u,dt),m=BAL.MOVE||{},ts=m.turnSlow===undefined?.3:m.turnSlow;
  const want=Math.max(0,Number(u.spd)||0)*terrSpd(u)*(ts+(1-ts)*Math.max(0,Math.cos(rem)));
  u.vel=(u.vel||0)+(want-(u.vel||0))*Math.min(1,dt*(m.accel||9));
  let budget=Math.max(0,u.vel*dt),moved=0;
  while(path.length&&budget>1e-8){
    const p=path[0],d=Math.hypot(p.x-u.x,p.y-u.y),step=Math.min(d,budget);
    if(d<1e-6){path.shift();continue;}
    const x=u.x+(p.x-u.x)/d*step,y=u.y+(p.y-u.y)/d*step;
    if(!workerSegmentClear(u.x,u.y,x,y,nav,r)){
      u.workerPath=[];u.workerGoal=null;u.workerNavT=0;break;
    }
    u.x=x;u.y=y;budget-=step;moved+=step;
    if(step>=d-1e-8)path.shift();
    // Keep a new corner's direction and speed adjustment for the next tick.
    if(path.length)break;
  }
  u.gait=(u.gait||0)+moved/(r*.6);u.moving=moved>1e-8;
  return !(u.workerPath||[]).length;
}
function workerReachedGoal(u){
  const tile=u.workerGoal;
  if(!Number.isInteger(tile))return false;
  const x=tile%COLS,y=(tile-x)/COLS;
  return Math.hypot(u.x-(x+.5)*TILE,u.y-(y+.5)*TILE)<1e-5;
}
function creditWorkerGold(side,amount,depot){
  amount=Math.max(0,Number(amount)||0);if(!amount)return;
  const player=side==="player";
  if(player)S.elixir+=amount;else S.eElixir+=amount;
  if(!S.delivered)S.delivered={player:0,enemy:0};
  S.delivered[side]=(S.delivered[side]||0)+amount;
  if(BAL.ECON.starBy==="regen"){
    const per=Math.max(.25,Number(BAL.ECON.starPer)||1),cap=capFor(side);
    if(cap>0&&Number.isFinite(cap)){
      const field=player?"starG":"eStarG",stars=player?"stars":"eStars";
      const total=(S[field]||0)+amount/(cap*per),gained=Math.floor(total);
      S[field]=total-gained;S[stars]=(S[stars]||0)+gained;
      if(gained&&side===MYSIDE){
        toast("★ 블러드 스타 +"+gained+" (보유 "+starsOf(side)+")");SND.play("star");renderPanel();
      }
    }
  }
  const visible=side===MYSIDE||!BAL.FOG_ON||(typeof bldVisible==="function"&&bldVisible(depot));
  if(visible){
    S.effects.push({tp:"ftext",x:depot.cx,y:depot.ty*TILE-4,text:"+"+amount,t:.9,t0:.9,
      col:side===MYSIDE?"255,215,80":"255,170,120"});
    playWorldSound("coin",depot.cx,depot.cy,side,{gain:.65,building:depot});
  }
}
function workerUpdateLegacy(u,dt){
  if(!u||u.hp<=0||!workerTransportOn())return;
  dt=Math.max(0,Number(dt)||0);u.moving=false;u.eng=null;
  const mine=workerMine(u);
  if(!(u.cargo>0)&&!mine){
    u.workerState="idle";u.depotId=0;u.workerPath=[];u.workerGoal=null;return;
  }
  if(u.workerState==="mining"&&!(u.cargo>0)){
    const nav=workerNavContext(),pad=u.minePad,open=workerClearTiles(nav,Math.max(1,Number(u.r)||7));
    if(!Number.isInteger(pad)||!open[pad]||Math.hypot(u.x-((pad%COLS)+.5)*TILE,u.y-(Math.floor(pad/COLS)+.5)*TILE)>1e-5){
      u.workerNavT=0;workerPlanReturn(u,mine,nav);return;
    }
    u.workerLoadT=(u.workerLoadT||0)+dt;
    const cycle=Math.max(.01,Number(BAL.ECON.mineCycle)||Number(BAL.ECON.regen)||2.8);
    if(u.workerLoadT+1e-8>=cycle){
      u.workerLoadT=0;u.cargo=Math.max(1,Number(BAL.WORKER&&BAL.WORKER.carry)||1);
      u.workerNavT=0;u.workerState="deliver";
    }
    return;
  }
  const nav=workerNavContext();u.workerNavT=(u.workerNavT||0)-dt;
  if(u.cargo>0){
    const depot=S.buildings.find(b=>b.id===u.depotId&&b.hp>0&&b.side===u.side&&workerDepotKey(b.key));
    if(u.workerNavT<=1e-8||(u.depotId&&!depot)||
        (u.workerState==="deliver"&&!Number.isInteger(u.workerGoal))||
        (u.workerState!=="deliver"&&u.workerState!=="waiting"))workerPlanDelivery(u,nav);
    if(u.workerState!=="deliver")return;
    workerFollowPath(u,dt,nav);
    if(!workerReachedGoal(u))return;
    const receiving=S.buildings.find(b=>b.id===u.depotId&&b.hp>0&&b.side===u.side&&workerDepotKey(b.key));
    if(!receiving||!workerPerimeter(receiving,nav,Math.max(1,Number(u.r)||7)).includes(u.workerGoal)){
      u.workerNavT=0;return;
    }
    const load=u.cargo;u.cargo=0;creditWorkerGold(u.side,load,receiving);
    u.workerLoadT=0;u.workerNavT=0;u.workerPath=[];u.workerGoal=null;u.depotId=0;
    u.workerState=mine?"return":"idle";
    return;
  }
  if(u.workerNavT<=1e-8||(u.workerState!=="return"&&u.workerState!=="waiting")||
      (u.workerState==="return"&&!Number.isInteger(u.workerGoal)))workerPlanReturn(u,mine,nav);
  if(u.workerState!=="return")return;
  workerFollowPath(u,dt,nav);
  if(workerReachedGoal(u)){u.workerState="mining";u.workerLoadT=0;u.workerPath=[];u.workerNavT=0;}
}

/* The procession uses simulation time and UID tie breaks, never display frame
   time. Waiting workers stay on passable perimeter pads; the renderer alone
   draws their short walk into/out of the entrance. A hidden miner does not
   occupy the building footprint or acquire an impossible navigation position. */
function workerProcessionGap(){
  const value=Number(BAL.WORKER&&BAL.WORKER.departGap);
  return Number.isFinite(value)?Math.max(.01,value):.7;
}
function workerPortalTime(){
  const value=Number(BAL.WORKER&&BAL.WORKER.transitTime);
  return Number.isFinite(value)?Math.max(.01,value):.65;
}
function workerQueueFirst(mine,state,field){
  let first=null;
  for(const other of S.units){
    if(other.hp<=0||other.src!==mine.id||other.side!==mine.side||!other.worker||other.workerState!==state)continue;
    const order=Number(other[field])||0,prior=first?(Number(first[field])||0):Infinity;
    if(!first||order<prior||(order===prior&&other.uid<first.uid))first=other;
  }
  return first;
}
function workerClearTransit(u){
  u.workerInside=false;u.workerTransit=null;u.workerTransitT=0;u.workerTransitDuration=0;
}
function workerStartTransit(u,kind){
  u.workerInside=false;u.workerTransit=kind;u.workerTransitDuration=workerPortalTime();
  u.workerTransitT=u.workerTransitDuration;u.workerState=kind==="enter"?"entering":"exiting";
  u.workerPath=[];u.workerGoal=null;u.workerNavT=0;u.vel=0;
}
function workerQueueEntry(u){
  workerClearTransit(u);u.workerState="entryQueued";u.workerEntryAt=Number(S.elapsed)||0;
  u.workerLoadT=0;u.workerReadyAt=0;u.workerPath=[];u.workerGoal=null;u.workerNavT=0;u.vel=0;
}
function workerAtMinePad(u,nav){
  const pad=u.minePad,open=workerClearTiles(nav,Math.max(1,Number(u.r)||7));
  return Number.isInteger(pad)&&open[pad]&&
    Math.hypot(u.x-((pad%COLS)+.5)*TILE,u.y-(Math.floor(pad/COLS)+.5)*TILE)<1e-5;
}
function workerRelocateInteriorPad(u,mine,nav,allowFootprint){
  if(!mine)return false;
  const r=Math.max(1,Number(u.r)||7),preferred=workerChoosePad(mine,u.slot,nav);
  let tile=preferred?preferred.tile:null;
  if(tile===null){
    const candidates=workerPerimeter(mine,nav,r);
    // Once the source is destroyed its former footprint is also passable.
    // This can release a survivor from a completely surrounded mine without
    // moving that worker through an occupied neighbouring building.
    if(allowFootprint){
      const open=workerClearTiles(nav,r);
      for(let y=mine.ty;y<mine.ty+mine.h;y++)for(let x=mine.tx;x<mine.tx+mine.w;x++){
        const at=y*COLS+x;if(x>=0&&y>=0&&x<COLS&&y<ROWS&&open[at])candidates.push(at);
      }
    }
    candidates.sort((a,b)=>{
      const ax=((a%COLS)+.5)*TILE-u.x,ay=(Math.floor(a/COLS)+.5)*TILE-u.y;
      const bx=((b%COLS)+.5)*TILE-u.x,by=(Math.floor(b/COLS)+.5)*TILE-u.y;
      return ax*ax+ay*ay-bx*bx-by*by||a-b;
    });
    tile=candidates.length?candidates[0]:null;
  }
  if(tile===null)return false;
  u.minePad=tile;u.x=((tile%COLS)+.5)*TILE;u.y=(Math.floor(tile/COLS)+.5)*TILE;
  u.workerPath=[];u.workerGoal=null;u.workerNavT=0;u.vel=0;return true;
}
function workerUpdateProcession(u,dt){
  if(!u||u.hp<=0||!workerTransportOn())return;
  dt=Math.max(0,Number(dt)||0);u.moving=false;u.eng=null;
  const mine=workerMine(u),now=Number(S.elapsed)||0;
  if(!mine){
    // Interior workers do not reserve an invisible exterior pad. Construction
    // may have occupied that pad while they were inside, so release them only
    // at a currently valid point. If every exit is sealed, retry while hidden.
    if(u.workerInside){
      const nav=workerNavContext();
      if(!workerAtMinePad(u,nav)){
        const former=S.buildings.find(b=>b.id===u.src&&b.side===u.side)||u.workerMineBounds;
        if(!workerRelocateInteriorPad(u,former,nav,true))return;
      }
    }
    // An already issued load still makes its final delivery.
    workerClearTransit(u);
    if(!(u.cargo>0)){
      u.workerState="idle";u.depotId=0;u.workerPath=[];u.workerGoal=null;u.workerLoadT=0;return;
    }
  }
  if(mine&&!(u.cargo>0)&&["entryQueued","entering","mining","queued"].includes(u.workerState)){
    const nav=workerNavContext();
    if(!workerAtMinePad(u,nav)){
      if(u.workerInside){
        // This is an interior exit reassignment, never a teleport of a visible
        // carrier. Preserve both its load progress and FIFO queue timestamps.
        if(!workerRelocateInteriorPad(u,mine,nav,false))return;
      }else{
        workerClearTransit(u);u.workerLoadT=0;u.workerReadyAt=0;
        u.workerNavT=0;workerPlanReturn(u,mine,nav);return;
      }
    }
    if(u.workerState==="entryQueued"){
      if(workerQueueFirst(mine,"entryQueued","workerEntryAt")!==u||now+1e-8<(mine.workerEntryNext||0))return;
      mine.workerEntryNext=now+workerProcessionGap();workerStartTransit(u,"enter");return;
    }
    if(u.workerState==="entering"){
      u.workerTransitT=Math.max(0,(Number(u.workerTransitT)||0)-dt);
      if(u.workerTransitT>1e-8)return;
      workerClearTransit(u);u.workerInside=true;u.workerState="mining";u.workerLoadT=0;return;
    }
    if(u.workerState==="mining"){
      u.workerInside=true;u.workerLoadT=(u.workerLoadT||0)+dt;
      const cycle=Math.max(.01,Number(BAL.ECON.mineCycle)||Number(BAL.ECON.regen)||2.8);
      if(u.workerLoadT+1e-8<cycle)return;
      u.workerLoadT=0;u.workerState="queued";u.workerReadyAt=now;
    }
    if(u.workerState==="queued"){
      u.workerInside=true;
      if(workerQueueFirst(mine,"queued","workerReadyAt")!==u||now+1e-8<(mine.workerDepartNext||0))return;
      mine.workerDepartNext=now+workerProcessionGap();
      u.cargo=Math.max(1,Number(BAL.WORKER&&BAL.WORKER.carry)||1);
      workerStartTransit(u,"exit");return;
    }
  }
  if(u.workerState==="exiting"){
    u.workerInside=false;u.workerTransitT=Math.max(0,(Number(u.workerTransitT)||0)-dt);
    if(u.workerTransitT>1e-8)return;
    workerClearTransit(u);u.workerState="deliver";u.workerNavT=0;return;
  }
  const nav=workerNavContext();u.workerNavT=(u.workerNavT||0)-dt;
  if(u.cargo>0){
    workerClearTransit(u);
    const depot=S.buildings.find(b=>b.id===u.depotId&&b.hp>0&&b.side===u.side&&workerDepotKey(b.key));
    if(u.workerNavT<=1e-8||(u.depotId&&!depot)||
        (u.workerState==="deliver"&&!Number.isInteger(u.workerGoal))||
        (u.workerState!=="deliver"&&u.workerState!=="waiting"))workerPlanDelivery(u,nav);
    if(u.workerState!=="deliver")return;
    workerFollowPath(u,dt,nav);
    if(!workerReachedGoal(u))return;
    const receiving=S.buildings.find(b=>b.id===u.depotId&&b.hp>0&&b.side===u.side&&workerDepotKey(b.key));
    if(!receiving||!workerPerimeter(receiving,nav,Math.max(1,Number(u.r)||7)).includes(u.workerGoal)){
      u.workerNavT=0;return;
    }
    const load=u.cargo;u.cargo=0;creditWorkerGold(u.side,load,receiving);
    u.workerLoadT=0;u.workerNavT=0;u.workerPath=[];u.workerGoal=null;u.depotId=0;
    u.workerState=mine?"return":"idle";return;
  }
  workerClearTransit(u);
  if(u.workerNavT<=1e-8||(u.workerState!=="return"&&u.workerState!=="waiting")||
      (u.workerState==="return"&&!Number.isInteger(u.workerGoal)))workerPlanReturn(u,mine,nav);
  if(u.workerState!=="return")return;
  workerFollowPath(u,dt,nav);
  if(workerReachedGoal(u))workerQueueEntry(u);
}
function workerUpdate(u,dt){
  return workerProcessionOn()?workerUpdateProcession(u,dt):workerUpdateLegacy(u,dt);
}

/* Include pending replacements and every field that can change a later route
   or deposit. Render-only animation/flash/audio state intentionally stays out. */
function workerEconomyHash(f){
  const text=value=>{value=String(value===undefined?"":value);f(value.length);for(let i=0;i<value.length;i++)f(value.charCodeAt(i));};
  const workers=S.units.filter(u=>u.worker||u.key==="worker");
  f(S.unitSeq||0);f(workers.length);
  for(const u of workers){
    f(u.uid||0);f(u.src||0);f(u.slot||0);text(u.side);text(u.workerState);
    f(u.cargo||0);f(u.depotId||0);f(Number.isInteger(u.minePad)?u.minePad:-1);
    f(Number.isInteger(u.workerGoal)?u.workerGoal:-1);
    f(u.workerLoadT||0);f(u.workerNavT||0);f(u.spd||0);f(u.r||0);
    f(u.vel||0);f(u.face||0);f(u.head||0);f(u.deploy||0);
    const path=u.workerPath||[];f(path.length);for(const p of path){f(p.x);f(p.y);}
    if(workerProcessionOn()){
      f(u.workerInside?1:0);text(u.workerTransit);f(u.workerTransitT||0);f(u.workerTransitDuration||0);
      f(u.workerEntryAt||0);f(u.workerReadyAt||0);
      const bounds=u.workerMineBounds||{};f(bounds.tx||0);f(bounds.ty||0);f(bounds.w||0);f(bounds.h||0);
    }
  }
  const mines=S.buildings.filter(b=>b.key==="elixirBase");f(mines.length);
  for(const mine of mines){
    f(mine.id);const slots=mine.workerSlots||[];f(slots.length);
    for(const slot of slots){f(slot?slot.uid||0:0);f(slot?slot.respawn||0:0);}
    if(workerProcessionOn()){f(mine.workerEntryNext||0);f(mine.workerDepartNext||0);}
  }
  f(S.delivered&&S.delivered.player||0);f(S.delivered&&S.delivered.enemy||0);
}
