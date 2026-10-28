/* ORA Space procedural celestial-waterfront world, v0.3.
 * Canvas 2D depth layers, deterministic particle positions and event-driven orbs.
 * This is a visual reference engine, NOT a physical star/water simulator.
 */
(()=>{'use strict';
const canvas=document.getElementById('universe');if(!canvas)return;
// Render within the same isolated scene as all ORA DOM layers; never behind the root canvas.
document.querySelector('.shell')?.prepend(canvas);
const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const seed=(i)=>{let v=Math.imul(i+741,0x9e3779b1);v^=v>>>16;v=Math.imul(v,0x85ebca6b);v^=v>>>13;return (v>>>0)/4294967296};
let w=0,h=0,dpr=1,skyLayer=null,lights=[],stars=[],ripples=[],glowTick=0,observer=true,last=0,frame=0;
let activeEvent={kind:'IDLE',tick:0};
const PI=Math.PI;
function shade(g,x,y,r,c0,c1){const a=g.createRadialGradient(x,y,0,x,y,r);a.addColorStop(0,c0);a.addColorStop(1,c1);return a}
function skyline(g,width,height){
 let y=height*.69;
 const base=g.createLinearGradient(0,y-120,0,y+50);base.addColorStop(0,'#0a122d');base.addColorStop(1,'#060b1b');
 // Two authored skylines straddling the central sunset passage.
 for(let side=0;side<2;side++){
  const count=side===0?42:39,zone=width*.41,offset=side===0?0:width*.59;
  for(let i=0;i<count;i++){
   const v=seed(i*6+side*717),t=(i+.2)/count;
   const bx=offset+t*zone,bw=width*(.006+seed(i*17+side*317)*.009),bh=height*(.035+.10*v);
   g.fillStyle=base;g.fillRect(bx,y-bh,bw,bh+6);
   if(seed(i*8+side*49)>.82){g.beginPath();g.moveTo(bx+bw*.5,y-bh-10);g.lineTo(bx+bw*.5,y-bh);g.strokeStyle='#1b263d';g.lineWidth=1;g.stroke()}
   for(let floor=6;floor<bh;floor+=8){for(let px=3;px<bw-2;px+=5){if(seed(i*99+floor*3+px+side*117)>.62){g.fillStyle='rgba(246,176,121,.63)';g.fillRect(bx+px,y-floor,1,2)}}}
   lights.push({x:bx+bw*.5,y:y-bh/2,amp:bh/height*.10});
  }
 }
}
function drawStatic(){const layer=document.createElement('canvas');layer.width=Math.round(w);layer.height=Math.round(h);const g=layer.getContext('2d');
 let bg=g.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#050c21');bg.addColorStop(.26,'#0f1431');bg.addColorStop(.47,'#1b2040');bg.addColorStop(.59,'#8d4863');bg.addColorStop(.70,'#e18a68');bg.addColorStop(.745,'#343150');bg.addColorStop(1,'#050d21');g.fillStyle=bg;g.fillRect(0,0,w,h);
 const mobile=w<650,curve=mobile?-.64:-.28;
 // Procedural diagonal nebula and dusty lanes, soft gradients, not fake catalog stars.
 g.save();g.translate(w*.71,h*.16);g.rotate(curve);
 for(let i=0;i<160;i++){const x=(seed(i*11+7)-.5)*w*.42;const y=(seed(i*7+31)-.5)*h*.74;
  const rad=13+seed(i*77+6)*Math.min(w,h)*.14;
  g.fillStyle=shade(g,x,y,rad,i%3===0?'rgba(188,111,244,.055)':i%3===1?'rgba(103,162,255,.055)':'rgba(241,155,202,.052)','rgba(8,7,32,0)');g.beginPath();g.arc(x,y,rad,0,PI*2);g.fill();}
 g.restore();
 // Center sunset radial.
 g.fillStyle=shade(g,w*.5,h*.68,Math.max(w,h)*.3,'rgba(255,193,128,.14)','rgba(200,91,100,0)');g.fillRect(0,0,w,h);
 stars=Array.from({length:mobile?240:340},(_,i)=>({x:seed(i*19+5)*w,y:seed(i*23+13)*h*.68,r:.4+seed(i*61+3)*1.6,p:seed(i*49+4)*6.28,f:.2+seed(i*13+16)*1.5}));
 for(const s of stars){g.fillStyle=`rgba(215,221,255,${.15+seed(s.x+s.y)*.5})`;g.beginPath();g.arc(s.x,s.y,s.r,0,2*PI);g.fill()}
 // mountain silhouettes; central horizon is clear.
 g.beginPath();g.moveTo(0,h*.69);
 for(let i=0;i<=50;i++){const x=w*i/50,y=h*(.69-.04*seed(i*65+5)*(.7+Math.abs(x/w-.5)));g.lineTo(x,y)}
 g.lineTo(w,h*.72);g.lineTo(0,h*.72);g.closePath();g.fillStyle='#13132a';g.fill();
 skyline(g,w,h);
 // Atmospheric horizon and reflected warm sky.
 g.fillStyle=shade(g,w*.5,h*.704,w*.30,'rgba(255,200,139,.35)','rgba(255,168,110,0)');g.fillRect(0,h*.56,w,h*.24);
 g.fillStyle='#060d23';g.fillRect(0,h*.708,w,h*.292);
 let water=g.createLinearGradient(0,h*.708,0,h);water.addColorStop(0,'#59465b');water.addColorStop(.25,'#292843');water.addColorStop(.65,'#122139');water.addColorStop(1,'#071020');g.fillStyle=water;g.fillRect(0,h*.708,w,h*.292);
 // Terraced stone landings and lights, device-right.
 g.fillStyle='#090d1a';g.beginPath();g.moveTo(w,h*.83);g.lineTo(w*.83,h*.87);g.lineTo(w*.83,h);g.lineTo(w,h);g.closePath();g.fill();
 const steps=mobile?5:3;for(let i=0;i<steps;i++){let yy=h*(.84+i*.034),xx=w*(.86-i*.025);g.fillStyle='#202034';g.fillRect(xx,yy,w-xx,h*.02);g.fillStyle='#82523b';g.fillRect(xx,yy,w-xx,1.5);
 g.fillStyle='rgba(255,180,97,.36)';g.fillRect(xx+5,yy-7,8,7);g.fillStyle='#fff0b7';g.fillRect(xx+8,yy-7,3,5)}
 // Rocks in foreground left.
 g.fillStyle='#050913';for(let i=0;i<18;i++){let bx=seed(i*4+1)*w*.25,by=h*(.86+seed(i*5+4)*.18);let rr=(10+seed(i*11+3)*65)*(w<650?.65:1);g.beginPath();g.ellipse(bx,by,rr,rr*.35,seed(i+5)-.5,0,2*PI);g.fill();}
 skyLayer=layer;
 // A precomputed static celestial plate ensures the sky/harbor survives low-end
 // browser compositors that fail to combine fixed Canvas with transparent UI.
 const shell=document.querySelector('.shell');
 if(shell){shell.style.backgroundImage='url('+layer.toDataURL('image/jpeg',.84)+')';
  shell.style.backgroundAttachment='fixed';shell.style.backgroundPosition='center top';
  shell.style.backgroundSize=w+'px '+h+'px';shell.style.backgroundRepeat='no-repeat';}
}
function resize(){dpr=Math.min(devicePixelRatio||1,1.6);w=Math.max(innerWidth,320);h=Math.max(innerHeight,500);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);drawStatic();}
function paint(timestamp){if(document.hidden){requestAnimationFrame(paint);return}
 if(timestamp-last<32&&!reduced){requestAnimationFrame(paint);return}last=timestamp;frame++;
 ctx.clearRect(0,0,w,h);ctx.drawImage(skyLayer,0,0,w,h);
 const t=reduced?0:timestamp/1000;
 // Water normal-like reflection: short warm streaks from horizon and sky on one coherent clock.
 const horizon=h*.712;for(let i=0;i<130;i++){
   const n=seed(i*13+2),y=horizon+(h-horizon)*n**.84;
   const centered=(seed(i*11+3)-.5)*w*(.15+n*.92),x=w*.5+centered;
   const wave=5+seed(i*7+5)*25*(1+n);
   const shift=reduced?0:Math.sin(i*3.4+t*(.3+n*.9))*5;
   const alpha=(.045+.15*seed(i*17+4))*(1-n*.5);
   ctx.strokeStyle=`rgba(${i%5===0?'175,174,242':'255,181,125'},${alpha})`;ctx.lineWidth=.6+1.2*n;ctx.beginPath();ctx.moveTo(x+shift,y);ctx.lineTo(x+wave+shift,y+.2);ctx.stroke();
 }
 const cy=h*.71;
 for(let i=0;i<24;i++){const n=seed(i*13+11),yy=cy+n*(h-cy),len=(3+32*n)*seed(i*23+7);ctx.strokeStyle=`rgba(247,189,128,${.02+.11*(1-n)})`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(w*.5-len/2,yy);ctx.lineTo(w*.5+len/2,yy);ctx.stroke()}
 // Genuine moving star brightness, synchronized to the same declared visual time variable.
 for(let i=0;i<stars.length;i++){const s=stars[i],pulse=.24+.45*Math.pow(.5+.5*Math.sin(t*s.f+s.p),4);ctx.fillStyle=`rgba(224,232,255,${pulse})`;ctx.beginPath();ctx.arc(s.x,s.y,s.r*.65,0,2*PI);ctx.fill()}
 // Event ledger visualization, not a fake CPU frequency. Only user/system actual events add ripples.
 ripples=ripples.filter(r=>timestamp-r.at<1900);for(const r of ripples){const age=(timestamp-r.at)/1900;ctx.beginPath();ctx.ellipse(r.x,r.y,12+age*150,4+age*25,0,0,2*PI);ctx.strokeStyle=`rgba(255,201,157,${.54*(1-age)})`;ctx.lineWidth=1.5;ctx.stroke()}
 if(!reduced)requestAnimationFrame(paint);
}
addEventListener('resize',resize,{passive:true});resize();requestAnimationFrame(paint);
window.ORAScene={emit:(kind)=>{activeEvent={kind,tick:performance.now()};ripples.push({x:w*.5,y:h*.79,at:performance.now()});if(reduced)paint(performance.now())},state:()=>activeEvent};
})();
