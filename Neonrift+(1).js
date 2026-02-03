(() => {
  // Console command: defines window.create()
  window.create = function create(prefillUrl) {
    const win = window.open();
    if (!win) return console.warn("Popup blocked. Try again after a click.");

    win.document.title = "Launcher";
    win.document.body.style.margin = "0";
    win.document.body.style.height = "100vh";
    win.document.body.style.background = "#000";

    const iframe = win.document.createElement("iframe");
    iframe.style.border = "none";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.margin = "0";
    iframe.allow = "fullscreen; gamepad; autoplay";
    iframe.referrerPolicy = "no-referrer";
    iframe.src = "about:blank";
    win.document.body.appendChild(iframe);

    // --- Game HTML (same file, embedded) ---
    const GAME_HTML = `<!doctype html><html><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Neon Rift</title>
<style>
html,body{margin:0;height:100%;background:#04040a;overflow:hidden;font-family:system-ui,Segoe UI,Roboto,Arial}
canvas{display:block;width:100vw;height:100vh}
.hint{position:fixed;left:12px;top:10px;color:#cfd3ffcc;font-size:12px;line-height:1.25;text-shadow:0 0 10px #6a74ff55;user-select:none;pointer-events:none}
.toast{position:fixed;right:12px;top:10px;color:#e8e9ffcc;font-size:12px;line-height:1.25;text-shadow:0 0 10px #ff6ad855;user-select:none;pointer-events:none;text-align:right}
</style></head>
<body>
<canvas id="c"></canvas>
<div class="hint"><b>Neon Rift</b> — Split-screen shooter<br>
P1: WASD + Mouse (hold LMB) + Shift dash<br>
P2: Arrows + Enter (hold) + Right Shift dash<br>
P pause • R restart</div>
<div class="toast" id="toast"></div>
<script>
(()=>{const clamp=(v,a,b)=>v<a?a:v>b?b:v;const lerp=(a,b,t)=>a+(b-a)*t;const rand=(a=1,b=0)=>Math.random()*(a-b)+b;const randi=(a,b=0)=>Math.floor(rand(a,b));const hypot=Math.hypot;const TAU=Math.PI*2;const now=()=>performance.now();
const canvas=document.getElementById("c");const ctx=canvas.getContext("2d",{alpha:false});let W=0,H=0,DPR=1;
function resize(){DPR=Math.max(1,Math.min(2.5,window.devicePixelRatio||1));W=Math.floor(innerWidth*DPR);H=Math.floor(innerHeight*DPR);canvas.width=W;canvas.height=H}addEventListener("resize",resize,{passive:true});resize();
const keys=new Set();addEventListener("keydown",e=>{keys.add(e.code);if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code))e.preventDefault()});addEventListener("keyup",e=>keys.delete(e.code));
let mouse={x:W/2,y:H/2,down:false};addEventListener("mousemove",e=>{const r=canvas.getBoundingClientRect();mouse.x=(e.clientX-r.left)*DPR;mouse.y=(e.clientY-r.top)*DPR},{passive:true});
addEventListener("mousedown",()=>mouse.down=true);addEventListener("mouseup",()=>mouse.down=false);
let audio=null;function sfx(type,gain=0.06,pitch=440,dur=0.08){try{audio??=new(window.AudioContext||window.webkitAudioContext)();const t0=audio.currentTime;const o=audio.createOscillator();const g=audio.createGain();o.type=type;o.frequency.setValueAtTime(pitch,t0);g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(gain,t0+0.01);g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);o.connect(g).connect(audio.destination);o.start(t0);o.stop(t0+dur+0.02)}catch{}}
const toast=document.getElementById("toast");
const WORLD={w:2600,h:1800};const bullets=[],enemies=[],particles=[];
const COL={bg0:"#060616",bg1:"#0a0a22",p1:"#50f1ff",p2:"#ff5be5"};
function makePlayer(id){const isP1=id===1;return{ id,name:isP1?"P1":"P2",x:WORLD.w*(isP1?0.35:0.65),y:WORLD.h*0.5,vx:0,vy:0,r:16,hp:100,hpMax:100,energy:100,energyMax:100,dashCd:0,fireCd:0,alive:true,spread:0,pierce:0,crit:0,combo:1,comboT:0};}
let P1=makePlayer(1),P2=makePlayer(2);let coop=true;
let state="menu",tPrev=now(),wave=1,waveTimer=0,difficulty=1,globalScore=0,shake=0;
const ENEMY_TYPES={grunt:{r:16,hp:35,spd:1.15,score:25,col:"#79ffdf"},skater:{r:14,hp:22,spd:1.85,score:30,col:"#9ab0ff"},tank:{r:26,hp:120,spd:0.65,score:80,col:"#ffcf7d"}};
function keepInWorld(p){const pad=40;p.x=clamp(p.x,p.r+pad,WORLD.w-p.r-pad);p.y=clamp(p.y,p.r+pad,WORLD.h-p.r-pad)}
function spawnEnemy(type,x,y){const T=ENEMY_TYPES[type];enemies.push({type,x,y,vx:0,vy:0,r:T.r,hp:T.hp,hpMax:T.hp,spd:T.spd*(0.9+0.2*Math.random()),val:T.score,col:T.col,alive:true});}
function spawnWave(n){const count=Math.floor(6+n*1.6);for(let i=0;i<count;i++){const edge=randi(4);const x=edge===0?40:edge===1?WORLD.w-40:rand(WORLD.w-120,120);const y=edge===2?40:edge===3?WORLD.h-40:rand(WORLD.h-120,120);let type="grunt";const roll=Math.random();if(n>2&&roll<0.18)type="skater";if(n>6&&roll<0.08)type="tank";spawnEnemy(type,x,y)}toast.textContent=\`Wave \${n}\`;setTimeout(()=>toast.textContent="",900)}
function puff(x,y,col,n=18,sp=3,life=700){for(let i=0;i<n;i++){const a=rand(TAU),s=rand(sp,0.2);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rand(3,1),col,life,age:0})}}
function fireBullet(owner,x,y,dx,dy,speed,dmg,life=1000,size=3,pierce=0){const v=hypot(dx,dy)||1;bullets.push({owner,x,y,vx:dx/v*speed,vy:dy/v*speed,dmg,r:size,pierce,born:now(),life})}
function hitPlayer(p,dmg){p.hp-=dmg;shake=Math.min(22*DPR,shake+8*DPR);puff(p.x,p.y,p.id===1?COL.p1:COL.p2,18,3.6,600);if(p.hp<=0)p.alive=false}
function hitEnemy(attacker,e,dmg){e.hp-=dmg;attacker.comboT=1400;attacker.combo=Math.min(8,attacker.combo+0.08);attacker.score=(attacker.score||0)+Math.floor(dmg*attacker.combo);globalScore+=Math.floor(dmg*attacker.combo);if(e.hp<=0){e.alive=false;attacker.score+=e.val;globalScore+=e.val;puff(e.x,e.y,e.col,30,4,800)}}
function makeView(y0,h,player){return{x0:0,y0,w:W,h,player,camX:0,camY:0}}
function updateView(v){const p=v.player;v.camX=clamp(p.x-v.w/2,0,WORLD.w-v.w);v.camY=clamp(p.y-v.h/2,0,WORLD.h-v.h)}
function updatePlayer(p,dt,view){if(!p.alive)return;p.comboT-=dt;if(p.comboT<=0){p.comboT=0;p.combo=lerp(p.combo,1,0.02)}
let ax=0,ay=0;if(p.id===1){if(keys.has("KeyW"))ay-=1;if(keys.has("KeyS"))ay+=1;if(keys.has("KeyA"))ax-=1;if(keys.has("KeyD"))ax+=1}else{if(keys.has("ArrowUp"))ay-=1;if(keys.has("ArrowDown"))ay+=1;if(keys.has("ArrowLeft"))ax-=1;if(keys.has("ArrowRight"))ax+=1}
const l=hypot(ax,ay)||1;ax/=l;ay/=l;
p.vx=lerp(p.vx,p.vx+ax*0.017*DPR*dt,0.22);p.vy=lerp(p.vy,p.vy+ay*0.017*DPR*dt,0.22);
p.vx*=Math.pow(0.997,dt);p.vy*=Math.pow(0.997,dt);
p.x+=p.vx;p.y+=p.vy;keepInWorld(p);p.energy=Math.min(p.energyMax,p.energy+dt*0.03);
let aimX,aimY;if(p.id===1){aimX=view.camX+(mouse.x-view.x0);aimY=view.camY+(mouse.y-view.y0)}else{let best=null,bd=1e9;for(const e of enemies){if(!e.alive)continue;const d=(e.x-p.x)**2+(e.y-p.y)**2;if(d<bd){bd=d;best=e}}aimX=best?best.x:WORLD.w/2;aimY=best?best.y:WORLD.h/2}
p.fireCd=Math.max(0,p.fireCd-dt);const shooting=p.id===1?mouse.down:keys.has("Enter");
if(shooting&&p.fireCd<=0&&p.energy>=2){p.energy-=2;p.fireCd=Math.max(70,160-wave*3);const dx=aimX-p.x,dy=aimY-p.y;const baseSp=10.5*DPR,dmg=11;fireBullet(p,p.x,p.y,dx,dy,baseSp,dmg,900,3.2,0);sfx("triangle",0.03,560+(p.id===1?0:80),0.04)}
}
function updateEnemies(dt){for(const e of enemies){if(!e.alive)continue;const t=(P1.alive?P1:P2.alive?P2:null);if(!t)continue;const dx=t.x-e.x,dy=t.y-e.y;const d=hypot(dx,dy)||1;const ux=dx/d,uy=dy/d;
e.vx=lerp(e.vx,ux*e.spd*DPR,0.03*dt);e.vy=lerp(e.vy,uy*e.spd*DPR,0.03*dt);
e.x+=e.vx;e.y+=e.vy;keepInWorld(e);
const bump=(p)=>{if(!p.alive)return;const dd=(e.x-p.x)**2+(e.y-p.y)**2,rr=(e.r+p.r+2)**2;if(dd<rr){hitPlayer(p,12);p.vx+=(p.x-e.x)*0.01*DPR;p.vy+=(p.y-e.y)*0.01*DPR}};bump(P1);bump(P2);
}}
function updateBullets(dt){const t=now();for(let i=bullets.length;i--;){const b=bullets[i];b.x+=b.vx;b.y+=b.vy;if(t-b.born>b.life){bullets.splice(i,1);continue}
if(b.owner===P1||b.owner===P2){for(const e of enemies){if(!e.alive)continue;const rr=e.r+b.r+2,dd=(b.x-e.x)**2+(b.y-e.y)**2;if(dd<rr*rr){hitEnemy(b.owner,e,b.dmg);bullets.splice(i,1);break}}}else{
const hit=(p)=>{if(!p.alive)return false;const rr=p.r+b.r+2,dd=(b.x-p.x)**2+(b.y-p.y)**2;if(dd<rr*rr){hitPlayer(p,b.dmg);bullets.splice(i,1);return true}return false};hit(P1)||hit(P2)}}
}
function updateParticles(dt){for(let i=particles.length;i--;){const p=particles[i];p.age+=dt;if(p.age>p.life){particles.splice(i,1);continue}p.x+=p.vx;p.y+=p.vy;p.vx*=0.985;p.vy*=0.985;p.r*=0.992}}
function drawView(v){ctx.save();ctx.beginPath();ctx.rect(v.x0,v.y0,v.w,v.h);ctx.clip();
ctx.fillStyle="#07071a";ctx.fillRect(v.x0,v.y0,v.w,v.h);
for(const e of enemies){if(!e.alive)continue;const sx=(e.x-v.camX)+v.x0,sy=(e.y-v.camY)+v.y0;ctx.fillStyle=e.col;ctx.beginPath();ctx.arc(sx,sy,e.r,0,TAU);ctx.fill()}
for(const b of bullets){const sx=(b.x-v.camX)+v.x0,sy=(b.y-v.camY)+v.y0;ctx.fillStyle=(b.owner===P1||b.owner===P2)?"#e9f7ff":"#ffd4a3";ctx.beginPath();ctx.arc(sx,sy,b.r,0,TAU);ctx.fill()}
for(const p of particles){const sx=(p.x-v.camX)+v.x0,sy=(p.y-v.camY)+v.y0;ctx.globalAlpha=1-(p.age/p.life);ctx.fillStyle=p.col;ctx.beginPath();ctx.arc(sx,sy,Math.max(0.6*DPR,p.r),0,TAU);ctx.fill();ctx.globalAlpha=1}
const pl=v.player;if(pl.alive){const sx=(pl.x-v.camX)+v.x0,sy=(pl.y-v.camY)+v.y0;ctx.fillStyle="#dfe8ff";ctx.beginPath();ctx.arc(sx,sy,pl.r,0,TAU);ctx.fill()}
ctx.restore()}
function draw(){ctx.fillStyle="#000";ctx.fillRect(0,0,W,H);
const v1=makeView(0,coop?H/2:H,P1),v2=coop?makeView(H/2,H/2,P2):null;updateView(v1);if(v2)updateView(v2);
drawView(v1);if(v2)drawView(v2);
ctx.fillStyle="#ffffff2a";ctx.font=\`\${11*DPR}px system-ui\`;ctx.fillText("freegameslist.blog",10*DPR,H-10*DPR);
if(state==="menu"){ctx.fillStyle="rgba(0,0,0,0.65)";ctx.fillRect(0,0,W,H);ctx.fillStyle="#fff";ctx.font=\`\${42*DPR}px system-ui\`;ctx.fillText("NEON RIFT",W/2-ctx.measureText("NEON RIFT").width/2,H*0.4);
ctx.font=\`\${14*DPR}px system-ui\`;const m="Click to start";ctx.fillText(m,W/2-ctx.measureText(m).width/2,H*0.4+30*DPR)}
}
addEventListener("pointerdown",()=>{if(state==="menu"){bullets.length=enemies.length=particles.length=0;P1=makePlayer(1);P2=makePlayer(2);wave=1;waveTimer=0;spawnWave(1);state="play"}},{passive:true});
function step(){const t=now();const dt=clamp(t-tPrev,0,33);tPrev=t;
if(state==="play"){waveTimer-=dt;if(enemies.filter(e=>e.alive).length===0&&waveTimer<=0){spawnWave(wave);wave++;waveTimer=1400;difficulty=1+wave*0.06}
const v1=makeView(0,coop?H/2:H,P1),v2=coop?makeView(H/2,H/2,P2):null;updateView(v1);if(v2)updateView(v2);
updatePlayer(P1,dt,v1);if(v2)updatePlayer(P2,dt,v2);
updateEnemies(dt);updateBullets(dt);updateParticles(dt);
if(!P1.alive&&!P2.alive)state="menu"}
draw();requestAnimationFrame(step)}
requestAnimationFrame(step);
})();<\/script></body></html>`;

    // --- Menu shell inside iframe ---
    const SHELL = `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Menu</title>
<style>
  html,body{margin:0;height:100%;background:#050008;color:#eaeaff;font-family:system-ui,Segoe UI,Roboto,Arial}
  .wrap{display:flex;align-items:center;justify-content:center;height:100%}
  .card{width:min(760px,92vw);border-radius:18px;padding:18px;background:rgba(255,255,255,.06);
        box-shadow:0 10px 40px rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.08)}
  h1{margin:0 0 10px;font-size:22px}
  .row{display:flex;gap:10px;flex-wrap:wrap}
  button{cursor:pointer;border:0;border-radius:14px;padding:12px 14px;font-weight:650}
  .primary{background:#7c5cff;color:#fff}
  .ghost{background:rgba(255,255,255,.10);color:#fff}
  input{flex:1;min-width:220px;border-radius:14px;border:1px solid rgba(255,255,255,.12);
        background:rgba(0,0,0,.35);color:#fff;padding:12px 12px}
  .small{opacity:.75;font-size:12px;line-height:1.35;margin-top:10px}
  .wm{opacity:.25;font-size:12px;margin-top:14px}
</style></head><body>
<div class="wrap"><div class="card">
  <h1>Launcher</h1>
  <div class="row">
    <button class="primary" id="play">Play Neon Rift</button>
    <button class="ghost" id="fs">Fullscreen</button>
  </div>
  <div style="height:10px"></div>
  <div class="row">
    <input id="url" placeholder="Load any URL in this iframe (optional)"/>
    <button class="ghost" id="go">Load URL</button>
  </div>
  <div class="small">
    • Some sites block embedding in iframes (X-Frame-Options / CSP), so “Load URL” may fail.<br>
    • Game always works (local HTML). P1 uses mouse aim; P2 auto-aims.
  </div>
  <div class="wm">freegameslist.blog</div>
</div></div>
<script>
  const GAME_HTML = ${JSON.stringify(GAME_HTML)};
  document.getElementById("play").onclick = () => {
    document.open(); document.write(GAME_HTML); document.close();
  };
  document.getElementById("fs").onclick = () => document.documentElement.requestFullscreen?.();
  document.getElementById("go").onclick = () => {
    const u = document.getElementById("url").value.trim();
    if(u) location.href = u;
  };
  const pre = ${JSON.stringify(String(prefillUrl||""))};
  if(pre) document.getElementById("url").value = pre;
</script></body></html>`;

    const doc = iframe.contentWindow.document;
    doc.open(); doc.write(SHELL); doc.close();
    try { iframe.contentWindow.focus(); } catch {}
  };

  console.log("✅ create() installed. Run create() to open the menu+game.");
})();
