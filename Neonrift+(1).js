(() => {
  // Expose create() globally
  window.create = function create(prefillUrl = "") {
    const win = window.open();
    if (!win) return alert("Popup blocked. Allow popups, then try again.");

    win.document.body.style.margin = "0";
    win.document.body.style.height = "100vh";
    win.document.body.style.background = "#000";

    const iframe = win.document.createElement("iframe");
    iframe.style.cssText = "border:none;width:100%;height:100%;margin:0";
    iframe.allow = "fullscreen; gamepad; autoplay";
    iframe.referrerPolicy = "no-referrer";
    iframe.src = "about:blank";
    win.document.body.appendChild(iframe);

    // -------- GAME HTML (built without template literals to avoid backtick issues) --------
    const GAME_LINES = [
      "<!doctype html><html><head>",
      '<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>',
      "<title>Neon Rift</title>",
      "<style>",
      "html,body{margin:0;height:100%;background:#04040a;overflow:hidden;font-family:system-ui,Segoe UI,Roboto,Arial}",
      "canvas{display:block;width:100vw;height:100vh}",
      ".hud{position:fixed;left:12px;top:10px;color:#cfd3ffcc;font-size:12px;line-height:1.25;text-shadow:0 0 10px #6a74ff55;user-select:none;pointer-events:none}",
      ".hudR{position:fixed;right:12px;top:10px;color:#e8e9ffcc;font-size:12px;line-height:1.25;text-shadow:0 0 10px #ff6ad855;user-select:none;pointer-events:none;text-align:right}",
      "</style></head><body>",
      '<canvas id="c"></canvas>',
      '<div class="hud"><b>Neon Rift</b> — Split-screen shooter<br>P1: WASD + Mouse (hold LMB) + Shift dash<br>P2: Arrows + Enter (hold) + Right Shift dash<br>P pause • R restart</div>',
      '<div class="hudR" id="toast"></div>',
      "<script>",
      "(function(){",
      "  const c=document.getElementById('c'),x=c.getContext('2d',{alpha:false});",
      "  let W=0,H=0,D=1;const TAU=Math.PI*2;const clamp=(v,a,b)=>v<a?a:v>b?b:v;",
      "  function rs(){D=Math.max(1,Math.min(2.5,devicePixelRatio||1));W=(innerWidth*D)|0;H=(innerHeight*D)|0;c.width=W;c.height=H}addEventListener('resize',rs,{passive:true});rs();",
      "  const keys=new Set();addEventListener('keydown',e=>{keys.add(e.code);if(e.code==='KeyP')paused=!paused;if(e.code==='KeyR')reset();if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();});addEventListener('keyup',e=>keys.delete(e.code));",
      "  let mouse={x:W/2,y:H/2,down:false};addEventListener('mousemove',e=>{const r=c.getBoundingClientRect();mouse.x=(e.clientX-r.left)*D;mouse.y=(e.clientY-r.top)*D;},{passive:true});addEventListener('mousedown',()=>mouse.down=true);addEventListener('mouseup',()=>mouse.down=false);",
      "  const toast=document.getElementById('toast');",
      "  const WORLD={w:2600,h:1800};",
      "  function mkP(id){return{id:id,x:WORLD.w*(id===1?0.35:0.65),y:WORLD.h*0.5,vx:0,vy:0,r:16,hp:100,e:100,cd:0,alive:true,score:0,dash:0}}",
      "  let P1=mkP(1),P2=mkP(2),paused=false,wave=1,delay=0;",
      "  const bullets=[],enemies=[],parts=[];",
      "  function reset(){P1=mkP(1);P2=mkP(2);bullets.length=enemies.length=parts.length=0;wave=1;delay=0;spawnWave();toastMsg('Wave 1');}",
      "  function toastMsg(s){toast.textContent=s;setTimeout(()=>{if(toast.textContent===s)toast.textContent='';},900)}",
      "  function keep(p){p.x=clamp(p.x,60,WORLD.w-60);p.y=clamp(p.y,60,WORLD.h-60)}",
      "  function puff(px,py,col,n){for(let i=0;i<n;i++){const a=Math.random()*TAU,s=0.5+Math.random()*4;parts.push({x:px,y:py,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:1+Math.random()*3,life:400+Math.random()*500,age:0,col:col});}}",
      "  function spawnEnemy(t,x0,y0){let r=16,hp=35,sp=1.15,val=25,col='#79ffdf';if(t===2){r=14;hp=22;sp=1.85;val=30;col='#9ab0ff'}if(t===3){r=26;hp=120;sp=0.65;val=80;col='#ffcf7d'}enemies.push({t:t,x:x0,y:y0,vx:0,vy:0,r:r,hp:hp,sp:sp,val:val,col:col,alive:true});}",
      "  function spawnWave(){const cnt=(6+wave*1.6)|0;for(let i=0;i<cnt;i++){const edge=(Math.random()*4)|0;const x0=edge===0?40:edge===1?WORLD.w-40:120+Math.random()*(WORLD.w-240);const y0=edge===2?40:edge===3?WORLD.h-40:120+Math.random()*(WORLD.h-240);let t=1;const r=Math.random();if(wave>2&&r<0.18)t=2;if(wave>6&&r<0.08)t=3;spawnEnemy(t,x0,y0);} }",
      "  function fire(o,dx,dy,spd,dmg){const m=Math.hypot(dx,dy)||1;bullets.push({o:o,x:o.x,y:o.y,vx:dx/m*spd,vy:dy/m*spd,r:3,d:dmg,life:900,age:0});}",
      "  function hitP(p,d){p.hp-=d;puff(p.x,p.y,p.id===1?'#50f1ff':'#ff5be5',18);if(p.hp<=0)p.alive=false;}",
      "  function hitE(p,e,d){e.hp-=d;p.score+=d|0;if(e.hp<=0){e.alive=false;p.score+=e.val;puff(e.x,e.y,e.col,30);} }",
      "  function viewFor(p,top,h){return{top:top,h:h,w:W,camX:0,camY:0,p:p}}",
      "  function updView(v){v.camX=clamp(v.p.x-v.w/2,0,WORLD.w-v.w);v.camY=clamp(v.p.y-v.h/2,0,WORLD.h-v.h)}",
      "  function updP(p,dt,v){if(!p.alive)return;let ax=0,ay=0;if(p.id===1){if(keys.has('KeyW'))ay-=1;if(keys.has('KeyS'))ay+=1;if(keys.has('KeyA'))ax-=1;if(keys.has('KeyD'))ax+=1;}else{if(keys.has('ArrowUp'))ay-=1;if(keys.has('ArrowDown'))ay+=1;if(keys.has('ArrowLeft'))ax-=1;if(keys.has('ArrowRight'))ax+=1;}let l=Math.hypot(ax,ay)||1;ax/=l;ay/=l;",
      "    const sp=0.017*D*dt;p.vx=p.vx*0.90+ax*sp;p.vy=p.vy*0.90+ay*sp;p.x+=p.vx;p.y+=p.vy;keep(p);",
      "    p.e=Math.min(100,p.e+dt*0.03);p.cd=Math.max(0,p.cd-dt);p.dash=Math.max(0,p.dash-dt);",
      "    let aimX=0,aimY=0;",
      "    if(p.id===1){aimX=v.camX+mouse.x;aimY=v.camY+(mouse.y-v.top);}else{let best=null,bd=1e18;for(const e of enemies){if(!e.alive)continue;const d=(e.x-p.x)*(e.x-p.x)+(e.y-p.y)*(e.y-p.y);if(d<bd){bd=d;best=e}}aimX=best?best.x:WORLD.w/2;aimY=best?best.y:WORLD.h/2;}",
      "    const shoot=(p.id===1?mouse.down:keys.has('Enter'));if(shoot&&p.cd<=0&&p.e>=2){p.e-=2;p.cd=Math.max(70,160-wave*3);fire(p,aimX-p.x,aimY-p.y,10.5*D,11);} ",
      "    const dashKey=(p.id===1?keys.has('ShiftLeft'):keys.has('ShiftRight'));if(dashKey&&p.dash<=0&&p.e>=20){p.e-=20;p.dash=600;p.vx+=(aimX-p.x)*0.002*D*120;p.vy+=(aimY-p.y)*0.002*D*120;puff(p.x,p.y,p.id===1?'#50f1ff':'#ff5be5',26);} ",
      "  }",
      "  function updE(dt){for(const e of enemies){if(!e.alive)continue;const t=(P1.alive?P1:(P2.alive?P2:null));if(!t)break;const dx=t.x-e.x,dy=t.y-e.y;const m=Math.hypot(dx,dy)||1;const ux=dx/m,uy=dy/m;e.vx=e.vx*0.92+ux*e.sp*D*0.08*dt;e.vy=e.vy*0.92+uy*e.sp*D*0.08*dt;e.x+=e.vx;e.y+=e.vy;keep(e);",
      "    const bump=function(p){if(!p.alive)return;const rr=(e.r+p.r+2);const dd=(e.x-p.x)*(e.x-p.x)+(e.y-p.y)*(e.y-p.y);if(dd<rr*rr){hitP(p,12);p.vx+=(p.x-e.x)*0.01*D;p.vy+=(p.y-e.y)*0.01*D;}};bump(P1);bump(P2);}",
      "  }",
      "  function updB(dt){for(let i=bullets.length;i--;){const b=bullets[i];b.age+=dt;b.x+=b.vx;b.y+=b.vy;if(b.age>b.life){bullets.splice(i,1);continue;}",
      "    for(const e of enemies){if(!e.alive)continue;const rr=e.r+b.r+2;const dd=(b.x-e.x)*(b.x-e.x)+(b.y-e.y)*(b.y-e.y);if(dd<rr*rr){hitE(b.o,e,b.d);bullets.splice(i,1);break;}}}",
      "  }",
      "  function updParts(dt){for(let i=parts.length;i--;){const p=parts[i];p.age+=dt;if(p.age>p.life){parts.splice(i,1);continue;}p.x+=p.vx;p.y+=p.vy;p.vx*=0.985;p.vy*=0.985;p.r*=0.992;}}",
      "  function drawView(v){x.save();x.beginPath();x.rect(0,v.top,v.w,v.h);x.clip();x.fillStyle='#07071a';x.fillRect(0,v.top,v.w,v.h);",
      "    for(const e of enemies){if(!e.alive)continue;const sx=(e.x-v.camX),sy=(e.y-v.camY)+v.top;x.fillStyle=e.col;x.beginPath();x.arc(sx,sy,e.r,0,TAU);x.fill();}",
      "    for(const b of bullets){const sx=(b.x-v.camX),sy=(b.y-v.camY)+v.top;x.fillStyle='#e9f7ff';x.beginPath();x.arc(sx,sy,b.r,0,TAU);x.fill();}",
      "    for(const p of parts){const sx=(p.x-v.camX),sy=(p.y-v.camY)+v.top;x.globalAlpha=1-(p.age/p.life);x.fillStyle=p.col;x.beginPath();x.arc(sx,sy,Math.max(0.6*D,p.r),0,TAU);x.fill();x.globalAlpha=1;}",
      "    const pl=v.p;if(pl.alive){const sx=(pl.x-v.camX),sy=(pl.y-v.camY)+v.top;x.fillStyle='#dfe8ff';x.beginPath();x.arc(sx,sy,pl.r,0,TAU);x.fill();}",
      "    x.restore();",
      "  }",
      "  function bar(px,py,w,h,fill,col){x.fillStyle='rgba(255,255,255,.12)';x.fillRect(px,py,w,h);x.fillStyle=col;x.fillRect(px,py,w*fill,h);}",
      "  let last=performance.now();function step(t){const dt=Math.min(33,t-last);last=t;if(!paused){if(delay>0)delay-=dt;else if(enemies.filter(e=>e.alive).length===0){wave++;toastMsg('Wave '+wave);spawnWave();delay=800;}",
      "    const v1=viewFor(P1,0,H/2),v2=viewFor(P2,H/2,H/2);updView(v1);updView(v2);updP(P1,dt,v1);updP(P2,dt,v2);updE(dt);updB(dt);updParts(dt);",
      "    if(!P1.alive&&!P2.alive){toastMsg('DEAD — Press R');paused=true;}}",
      "    x.fillStyle='#000';x.fillRect(0,0,W,H);drawView(viewFor(P1,0,H/2));drawView(viewFor(P2,H/2,H/2));",
      "    x.fillStyle='rgba(255,255,255,.20)';x.font=(11*D)+'px system-ui';x.fillText('freegameslist.blog',10*D,H-10*D);",
      "    x.fillStyle='rgba(255,255,255,.10)';x.fillRect(0,H/2-1,W,2);",
      "    x.fillStyle='#fff';x.font=(12*D)+'px system-ui';x.fillText('P1 '+(P1.score|0),10*D,18*D);x.fillText('P2 '+(P2.score|0),10*D,H/2+18*D);",
      "    bar(10*D,24*D,120*D,8*D,Math.max(0,P1.hp)/100,'#50f1ff');bar(10*D,36*D,120*D,8*D,Math.max(0,P1.e)/100,'#9ab0ff');",
      "    bar(10*D,H/2+24*D,120*D,8*D,Math.max(0,P2.hp)/100,'#ff5be5');bar(10*D,H/2+36*D,120*D,8*D,Math.max(0,P2.e)/100,'#ff9adf');",
      "    requestAnimationFrame(step);}",
      "  spawnWave();toastMsg('Wave 1');requestAnimationFrame(step);",
      "})();",
      "</" + "script></body></html>"
    ];
    const GAME_HTML = GAME_LINES.join("\n");

    // Base64 encode to keep the shell safe (no </script> issues)
    const GAME_B64 = btoa(unescape(encodeURIComponent(GAME_HTML)));

    // -------- MENU HTML (safe) --------
    const SHELL_LINES = [
      "<!doctype html><html><head><meta charset='utf-8'/>",
      "<meta name='viewport' content='width=device-width,initial-scale=1'/>",
      "<title>Launcher</title>",
      "<style>",
      "html,body{margin:0;height:100%;background:#050008;color:#eaeaff;font-family:system-ui,Segoe UI,Roboto,Arial}",
      ".wrap{display:flex;align-items:center;justify-content:center;height:100%}",
      ".card{width:min(760px,92vw);border-radius:18px;padding:18px;background:rgba(255,255,255,.06);box-shadow:0 10px 40px rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.08)}",
      "h1{margin:0 0 10px;font-size:22px}",
      ".row{display:flex;gap:10px;flex-wrap:wrap}",
      "button{cursor:pointer;border:0;border-radius:14px;padding:12px 14px;font-weight:650}",
      ".primary{background:#7c5cff;color:#fff}",
      ".ghost{background:rgba(255,255,255,.10);color:#fff}",
      "input{flex:1;min-width:220px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.35);color:#fff;padding:12px 12px}",
      ".small{opacity:.75;font-size:12px;line-height:1.35;margin-top:10px}",
      ".wm{opacity:.25;font-size:12px;margin-top:14px}",
      "</style></head><body>",
      "<div class='wrap'><div class='card'>",
      "<h1>Launcher</h1>",
      "<div class='row'>",
      "<button class='primary' id='play'>Play Neon Rift</button>",
      "<button class='ghost' id='fs'>Fullscreen</button>",
      "</div>",
      "<div style='height:10px'></div>",
      "<div class='row'>",
      "<input id='url' placeholder='Load any URL in this iframe (optional)'/>",
      "<button class='ghost' id='go'>Load URL</button>",
      "</div>",
      "<div class='small'>",
      "• Some sites block embedding in iframes (X-Frame-Options / CSP), so “Load URL” may fail.<br>",
      "• Game always works (local HTML). P1 uses mouse aim; P2 auto-aims.",
      "</div>",
      "<div class='wm'>freegameslist.blog</div>",
      "</div></div>",
      "<script>",
      "var GAME_B64=" + JSON.stringify(GAME_B64) + ";",
      "var pre=" + JSON.stringify(String(prefillUrl || "")) + ";",
      "function d64(b){return decodeURIComponent(escape(atob(b)));}",
      "document.getElementById('play').onclick=function(){",
      "  var html=d64(GAME_B64);",
      "  var blob=new Blob([html],{type:'text/html'});",
      "  location.href=URL.createObjectURL(blob);",
      "};",
      "document.getElementById('fs').onclick=function(){document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen();};",
      "document.getElementById('go').onclick=function(){var u=document.getElementById('url').value.trim();if(u)location.href=u;};",
      "if(pre)document.getElementById('url').value=pre;",
      "</" + "script></body></html>"
    ];
    const SHELL = SHELL_LINES.join("\n");

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(SHELL);
    doc.close();
  };

  console.log("✅ Neon Rift installed. Run create() to open the launcher.");
})();
