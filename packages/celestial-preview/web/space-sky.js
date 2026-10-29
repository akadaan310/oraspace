/** Space OS / Celestial Layer 0.1 — deterministic shared visual/simulation contract.
 * Public IAU constellation identities are separate from ORA's fictional orbit view.
 * An astronomical coordinate requires source+epoch and is NEVER manufactured by this file.
 * No network, credentials, browser globals, audio, or graphics-library dependencies.
 */
export const IAU_88 = Object.freeze([
'Andromeda','Antlia','Apus','Aquarius','Aquila','Ara','Aries','Auriga',
'Boötes','Caelum','Camelopardalis','Cancer','Canes Venatici','Canis Major',
'Canis Minor','Capricornus','Carina','Cassiopeia','Centaurus','Cepheus','Cetus',
'Chamaeleon','Circinus','Columba','Coma Berenices','Corona Australis',
'Corona Borealis','Corvus','Crater','Crux','Cygnus','Delphinus','Dorado',
'Draco','Equuleus','Eridanus','Fornax','Gemini','Grus','Hercules','Horologium',
'Hydra','Hydrus','Indus','Lacerta','Leo','Leo Minor','Lepus','Libra','Lupus',
'Lynx','Lyra','Mensa','Microscopium','Monoceros','Musca','Norma','Octans',
'Ophiuchus','Orion','Pavo','Pegasus','Perseus','Phoenix','Pictor','Pisces',
'Piscis Austrinus','Puppis','Pyxis','Reticulum','Sagitta','Sagittarius',
'Scorpius','Sculptor','Scutum','Serpens','Sextans','Taurus','Telescopium',
'Triangulum','Triangulum Australe','Tucana','Ursa Major','Ursa Minor',
'Vela','Virgo','Volans','Vulpecula']);
export const SKY_SCHEMA='spaceos.sky/0.1';
export const FRAME_REAL='ICRS_APPROX_OBSERVER';
export const FRAME_ORA='ORA_VIRTUAL_CONSTELLATION';
const TAU=Math.PI*2;
export function hash32(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
export function unit(str){return hash32(str)/4294967296}
export function wrap01(n){return ((n%1)+1)%1}
export function clamp(v,a=0,b=1){return Math.max(a,Math.min(b,v))}
export function sphericalSky(raDegrees,decDegrees,latitudeDegrees,longitudeDegrees,utcIso){
  // Approximate equatorial-to-horizon transform, NOT precision navigation or Gaia astrometry.
  for(const n of [raDegrees,decDegrees,latitudeDegrees,longitudeDegrees])if(!Number.isFinite(n))throw Error('nonfinite coordinate');
  if(Math.abs(decDegrees)>90||Math.abs(latitudeDegrees)>90||Math.abs(longitudeDegrees)>180)throw Error('invalid sky location');
  const unix=Date.parse(utcIso);if(!Number.isFinite(unix))throw Error('invalid UTC epoch');
  const jd=unix/86400000+2440587.5,d=jd-2451545.0;
  const gmst=(280.46061837+360.98564736629*d+0.000387933*(d/36525)**2)%360;
  const hour=(gmst+longitudeDegrees-raDegrees)*Math.PI/180,phi=latitudeDegrees*Math.PI/180,dec=decDegrees*Math.PI/180;
  const sinAlt=Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(hour);
  const alt=Math.asin(clamp(sinAlt,-1,1));
  const az=Math.atan2(-Math.sin(hour),Math.tan(dec)*Math.cos(phi)-Math.sin(phi)*Math.cos(hour));
  return {altitudeDegrees:alt*180/Math.PI,azimuthDegrees:wrap01(az/TAU)*360,
    frame:FRAME_REAL,truth:'APPROX_CALCULATED_FROM_USER_COORDINATES',
    limitation:'No precession, nutation, atmospheric refraction or precise Earth orientation. Not for navigation.'};
}
export function celestialCatalog(){return IAU_88.map((name,i)=>({id:`iau:${String(i+1).padStart(2,'0')}`,name,kind:'IAU_SKY_REGION',index:i,
  physicalCoordinates:null,truth:'REAL_NAME_WITHOUT_POINT_LOCATION'}))}
export function orbitPoint(name,tSeconds=0,angleOffset=0){
  if(!IAU_88.includes(name))throw Error('unregistered constellation');
  if(!Number.isFinite(tSeconds)||!Number.isFinite(angleOffset))throw Error('invalid clock');
  const u=unit(name),v=unit('depth:'+name);
  const a=TAU*(u+angleOffset+0.008*Math.sin(tSeconds*0.09+v*TAU));
  const r=0.19+0.23*v;
  return {x:.52+Math.cos(a)*r,y:.39+Math.sin(a)*r*.73,
    depth:.3+.7*v,size:.7+.8*unit('size:'+name),
    brightness:.62+.36*Math.pow(.5+.5*Math.sin(tSeconds*(0.44+u*.18)+v*TAU),2),
    source:`iau:${IAU_88.indexOf(name)+1}`,frame:FRAME_ORA,
    truth:'SYNTHETIC_ORA_INTERFACE_NOT_PHYSICAL_STAR_POSITION'};
}
export function renderableOrbs(tSeconds=0,angleOffset=0,limit=14){
  if(!Number.isInteger(limit)||limit<1||limit>88)throw Error('invalid display budget');
  // Visually select a sparse rotating window over all 88 names, not an 88-star scientific sky.
  const start=Math.floor(wrap01(angleOffset)*88);
  const list=[];for(let i=0;i<limit;i++){
    const name=IAU_88[(start+(i*7))%88];list.push({name,...orbitPoint(name,tSeconds,angleOffset)})
  }
  return list;
}
export function makeEvent(event){
  const {id,oraId,kind,tick,source,truth}=event??{};
  if(typeof id!=='string'||!id||typeof kind!=='string'||!kind||!Number.isSafeInteger(tick)||tick<0||
     typeof source!=='string'||!source||typeof oraId!=='string'||!oraId||typeof truth!=='string'||!truth)throw Error('incomplete source event');
  return Object.freeze({schema:SKY_SCHEMA,id,oraId,kind,tick,source,truth,frame:FRAME_ORA,effect:'VISUAL_ONLY'});
}
export function eventVisual(event,frameTick){
  if(event?.schema!==SKY_SCHEMA||!Number.isSafeInteger(frameTick)||frameTick<0)throw Error('invalid event');
  const age=Math.max(0,(frameTick-event.tick)/24),decay=Math.exp(-age/3.6);
  return {id:event.id,source:event.source,pulse:clamp(decay),waterImpulse:clamp(decay*.32),
    visuallyWitnessed:frameTick>=event.tick,effect:'VISUAL_ONLY',truth:event.truth};
}
export function createSkyClock({initialTick=0,hz=24}={}){
  if(!Number.isSafeInteger(initialTick)||initialTick<0||!Number.isInteger(hz)||hz<1||hz>240)throw Error('invalid sky clock');
  return Object.freeze({schema:'glass.clock-straight/0.1',hz,initialTick,
    at:(elapsedMs)=>{if(!Number.isFinite(elapsedMs)||elapsedMs<0)throw Error('clock cannot run backwards');return initialTick+Math.floor(elapsedMs*hz/1000)},
    elapsed:(tick)=>{if(!Number.isSafeInteger(tick)||tick<initialTick)throw Error('bad tick');return (tick-initialTick)/hz}});
}
export const SKY_DATA_CONTRACT=Object.freeze({
  physicalSky:'ICRS star coordinates + epoch + named source + uncertainty; require external authoritative dataset',
  oraProjection:'Deterministic virtual orbital lens seeded from IAU region identifiers; NOT physical astronomy',
  version:SKY_SCHEMA,
  consumers:['ORA Space website','HOMELESS renderer','GLASS instruments']
});
