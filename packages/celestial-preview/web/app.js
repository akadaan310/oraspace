import {IAU_88,renderableOrbs,createSkyClock,makeEvent,eventVisual,unit,clamp,SKY_SCHEMA} from './space-sky.js';
import {WaterOptics} from './gpu-water.js';
const $=id=>document.getElementById(id),root=$('universe'),canvas=$('sky'),ctx=canvas.getContext('2d',{alpha:true}),water=new WaterOptics($('optics'));
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clock=createSkyClock({hz:24});const started=performance.now();
let mouseDown=null,orbitOffset=0,selected=0,last=0,active=false,typed='',events=[],scale=1,W=0,H=0,glassOpen=false,serverHealth='UNKNOWN',evidence=null;
const mobile=()=>window.innerWidth<=700;
function readIntent(){return $('glass-field').value.trim()}
function announce(message){$('witness').textContent=message;window.clearTimeout(announce.timer);announce.timer=setTimeout(()=>$('witness').textContent='',6100)}
function resize(){W=window.innerWidth;H=window.innerHeight;scale=Math.min(window.devicePixelRatio||1,mobile()?1.35:1.65);canvas.width=Math.round(W*scale);canvas.height=Math.round(H*scale);ctx.setTransform(scale,0,0,scale,0,0);water.resize(W,H,mobile(),scale)}
addEventListener('resize',resize);resize();
function awaken(reason='USER_INITIATED'){$('lensing').hidden=false;glassOpen=true;water.signal();$('glass-field').focus();stamp('ORB_AWAKENED',reason);announce('GLASS is listening. Speak through the glass.');}
function home(){glassOpen=false;$('lensing').hidden=true;$('glass-field').value='';$('readback').hidden=true;stamp('ORB_SETTLED','RETURN');}
$('home').addEventListener('click',home);
$('orb-heart').addEventListener('click',()=>awaken('CENTRAL_ORA'));
$('landing').addEventListener('click',()=>awaken('LANDING_VESSEL'));
function stamp(kind,source){const tick=clock.at(performance.now()-started);const event=makeEvent({id:'view:'+source+':'+tick,oraId:'ora-sovereign',kind,tick,source,truth:'LOCAL_UI_EVENT'});events.push(event);events=events.slice(-30);water.signal();return event}
function interact(event){const zone=$('orb-zone');let x=(event.clientX-zone.getBoundingClientRect().left)/zone.clientWidth;let y=(event.clientY-zone.getBoundingClientRect().top)/zone.clientHeight;let opts=renderableOrbs((performance.now()-started)/1000,orbitOffset,18);let nearest=opts.reduce((best,o)=>{const dist=Math.hypot(o.x-x,o.y-y);return !best||dist<best.dist?{orb:o,dist}:best},null);return nearest}
$('orb-zone').addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;mouseDown={x:e.clientX,y:e.clientY,offset:orbitOffset};try{e.currentTarget.setPointerCapture(e.pointerId)}catch{}});
$('orb-zone').addEventListener('pointermove',e=>{if(!mouseDown)return;const dx=e.clientX-mouseDown.x;orbitOffset=(mouseDown.offset+dx/Math.max(200,W)*.38+1)%1;});
$('orb-zone').addEventListener('pointerup',e=>{if(!mouseDown)return;let dx=e.clientX-mouseDown.x;mouseDown=null;if(Math.abs(dx)>7)return;const hit=interact(e);if(!hit||hit.dist>.11)return;selected=IAU_88.indexOf(hit.orb.name);$('constellation-label').textContent=hit.orb.name.toUpperCase();stamp('CONSTELLATION_SELECTED',hit.orb.name);if(glassOpen)announce('Constellation · '+hit.orb.name)});
root.addEventListener('wheel',e=>{if(glassOpen)return;e.preventDefault();orbitOffset=(orbitOffset+Math.sign(e.deltaY)*.025+1)%1},{passive:false});
addEventListener('keydown',e=>{if(e.key==='Escape'){home();return}if(e.target===$('glass-field')||document.activeElement===$('glass-field'))return;
 if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();orbitOffset=(orbitOffset+(e.key==='ArrowRight'?.011:-.011)+1)%1}if(e.key==='Enter'&&!glassOpen)awaken('KEYBOARD')});
$('glass-field').addEventListener('keydown',async e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();await realize()}});
function textValue(intent){const words=intent.split(/\s+/).filter(Boolean);return {title:words.slice(0,6).join(' '),intent,representation:'ORA_360_LOCAL_PROPOSAL',state:'PREPARED_NOT_AUTHORIZED',traces:[{op:'IDENTIFY',input:intent},{op:'GENERATE',kind:'ORA_360_BLUEPRINT'},{op:'REVIEW',permission:'REQUIRED'}]}}
async function realize(){const intent=readIntent();if(intent.length<5){announce('Give your idea at least five characters.');return}stamp('INTENT_OBSERVED','GLASS_LENS');$('glass-field').blur();typed=intent;const preview=textValue(intent);evidence=preview;
 try{
  const health=await fetch('/api/v1/360/health',{cache:'no-store'});if(!health.ok)throw Error('No ORA Engine');
  const connected=await health.json();serverHealth=connected.service||'ORA 360';
  const response=await fetch('/api/v1/360/realize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({intent})});
  if(!response.ok)throw Error(response.status===401?'AUTH_REQUIRED':'ORA service rejected proposal');
  const created=await response.json();const id=created.object?.id||'UNKNOWN';
  evidence={...preview,id,status:'PERSISTED_PREPARED',oraId:created.ora?.id||'UNKNOWN'};
  stamp('ORA_PERSISTED',id);announce('ORA realized for review · '+id);showTrace('ORA 360 · STORED · '+id+' · REVIEW REQUIRED');
 }catch(ex){serverHealth='UNAVAILABLE_OR_AUTH_REQUIRED';showTrace('LOCAL PREVIEW ONLY · NO REMOTE ORA CREATED');announce('Your idea formed locally. Connect the ORA service to preserve it.');}
 $('glass-field').value='';$('lensing').hidden=true;glassOpen=false;
}
function showTrace(text){$('readback').hidden=false;$('readback-text').textContent=text;setTimeout(()=>{$('readback').hidden=true},8000)}
const particles=Array.from({length:220},(_,i)=>({u:unit('u'+i),v:unit('v'+i),r:.5+unit('size'+i)*1.1,p:unit('phase'+i)*6.283,f:.16+unit('freq'+i)*.39}));
function drawFrame(now){if(document.visibilityState==='hidden'){requestAnimationFrame(drawFrame);return}const dt=reduced?0:(now-started)/1000;const tick=clock.at(Math.max(0,now-started));const frame=(x,y)=>({x:x*W,y:y*H});ctx.clearRect(0,0,W,H);
 // 88 named constellations are virtual ORA topology; real-sky coordinates are separate.
 const items=renderableOrbs(dt,orbitOffset,14);const center=mobile()?frame(.5,.428):frame(.58,.32);
 ctx.save();ctx.globalCompositeOperation='screen';
 for(const p of particles){const x=p.u*W,y=p.v*(mobile()?H*.59:H*.79);const b=(.2+.8*Math.pow(.5+.5*Math.sin(p.p+dt*p.f),4))*(mobile()?0.22:0.37);ctx.fillStyle=`rgba(255,231,211,${b})`;ctx.beginPath();ctx.arc(x,y,p.r,0,6.283);ctx.fill()}
 const zone=$('orb-zone').getBoundingClientRect();let positions=[];
 for(let i=0;i<items.length;i++){const o=items[i];const x=zone.left+o.x*zone.width,y=zone.top+o.y*zone.height;positions.push({x,y,o});const major=i%3===0;const rad=major?5+o.size*5:2.5+o.size*2;let gradient=ctx.createRadialGradient(x,y,0,x,y,rad*3.3);const color=(i%3===0?'247,187,115':i%3===1?'155,168,255':'214,144,234');gradient.addColorStop(0,`rgba(255,241,212,${.8*o.brightness})`);gradient.addColorStop(.17,`rgba(${color},${.50*o.brightness})`);gradient.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(x,y,rad*3.3,0,6.283);ctx.fill();
  if(major){ctx.strokeStyle=`rgba(255,207,155,${.15*o.brightness})`;ctx.lineWidth=.7;ctx.beginPath();ctx.ellipse(x,y,rad*1.7,rad*.65,-.25,0,6.283);ctx.stroke()}
 }
 ctx.lineWidth=.65;for(let i=0;i<positions.length;i++){let a=positions[i],b=positions[(i+5)%positions.length];ctx.strokeStyle=`rgba(245,178,143,${.11+.05*Math.sin(dt*.3+i)})`;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(center.x,center.y,a.x*.65+b.x*.35,a.y*.65+b.y*.35);ctx.stroke()}
 // A single golden centerlight reaches the mobile landing sphere and its water reflection.
 const beamY=mobile()?H*.87:H*.73;let beam=ctx.createLinearGradient(center.x,center.y,center.x,beamY);beam.addColorStop(0,'rgba(255,204,146,.0)');beam.addColorStop(.48,'rgba(255,197,142,.26)');beam.addColorStop(1,'rgba(255,211,153,.05)');ctx.strokeStyle=beam;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(center.x,center.y);ctx.lineTo(W*.5,beamY);ctx.stroke();
 for(const e of events){const p=eventVisual(e,tick);if(p.pulse<.006)continue;ctx.strokeStyle=`rgba(255,228,186,${p.pulse*.50})`;ctx.lineWidth=1.3;const r=(1-p.pulse)*100+10;ctx.beginPath();ctx.ellipse(W*.5,H*.84,r,r*.17,0,0,6.283);ctx.stroke()}
 if(water.mode==='CANVAS_FALLBACK'){
  const horizon=mobile()?H*.57:H*.52;
  for(let j=0;j<145;j++){
   const u=unit('glass-water-u'+j),v=unit('glass-water-v'+j);
   const y=horizon+(H-horizon)*Math.pow(v,1.24);
   const center=W*(.49+.07*Math.sin(j));
   const x=center+(u-.5)*W*(.13+v*.31)+Math.sin(dt*.36+j*5)*2;
   const width=(2+v*28)*(1+.2*Math.sin(j*.7+dt*.2));
   const shimmer=.05+.16*Math.pow(.5+.5*Math.sin(j*1.73+dt*.4),5);
   ctx.strokeStyle=`rgba(255,204,142,${shimmer})`;ctx.lineWidth=.5+v*.6;
   ctx.beginPath();ctx.moveTo(x-width*.5,y);ctx.lineTo(x+width*.5,y);ctx.stroke();
  }
 }
 ctx.restore();water.draw(dt);requestAnimationFrame(drawFrame)}
requestAnimationFrame(drawFrame);
const initial=renderableOrbs(0,0,14)[0];$('constellation-label').textContent=initial.name.toUpperCase();
// A single window announces capability without displaying an intrusive search icon or box.
window.GLASS_SPACE={schema:SKY_SCHEMA,select:(i)=>{selected=Math.max(0,Math.min(87,i));$('constellation-label').textContent=IAU_88[selected].toUpperCase()},
 status:()=>({renderer:water.mode,backend:serverHealth,events:events.length,skySchema:SKY_SCHEMA,prepared:evidence?.status||'NONE'}),
 worldEvent:(e)=>{const event=makeEvent(e);events.push(event);water.signal();return event},
 awaken};
