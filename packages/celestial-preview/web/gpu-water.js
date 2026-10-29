/** GLASS Water Optics 0.5 — shared clock, Android-first hybrid render.
 * The source photo is cinematic plate data, not a physics solver. On mobile,
 * dynamic source-image slice refraction displaces the real waterfront pixels;
 * on desktop WebGL2 adds clocked specular light. No cloud GPU at playback.
 */
const VS=`#version 300 es
in vec2 a_pos;
void main(){gl_Position=vec4(a_pos,0.,1.);}`;
const FS=`#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_mobile;
uniform float u_pulse;
out vec4 frag;
void main(){
 vec2 uv=gl_FragCoord.xy/u_resolution;
 float horizon=mix(.49,.45,u_mobile);
 float mask=1.-smoothstep(horizon-.07,horizon+.025,uv.y);
 if(mask<.001){frag=vec4(0.);return;}
 float wave=sin(uv.x*76.+u_time*.8+sin(uv.y*46.)*1.4)
           +.45*sin(uv.x*135.-u_time*.71+uv.y*59.);
 float env=pow(clamp(1.-abs(uv.x-.51)*2.0,0.,1.),3.);
 float bands=pow(max(0.,sin(uv.y*270.+wave*1.4)),13.);
 float sparkle=pow(max(0.,sin(uv.x*162.+wave*1.3)),12.)*bands;
 float glint=(.08+.77*env)*sparkle;
 float wash=.045*env*(.5+.5*sin(uv.y*190.+u_time*1.5+wave));
 vec2 p=(uv-vec2(.5,.15))*vec2(1.,2.7);
 float ripple=exp(-pow((length(p)-(.18+u_pulse*.38))/.014,2.))*u_pulse*.22;
 float alpha=mask*(glint+wash+ripple);
 vec3 color=mix(vec3(.33,.53,1.),vec3(1.,.74,.48),env);
 frag=vec4(color,clamp(alpha,0.,.72));
}`;
export class WaterOptics {
 constructor(canvas){
  this.canvas=canvas;this.mobile=matchMedia('(max-width:700px)').matches;
  this.pulse=0;this.frames=0;this.lastPaint=-100;
  this.source=new Image();this.source.decoding='async';this.sourceReady=false;
  this.source.onload=()=>{this.sourceReady=true};
  this.source.onerror=()=>{this.sourceReady=false};
  this.source.src=new URL('./assets/mobile-world.webp',import.meta.url).href;
  // Canvas refraction is used on Android deliberately: much more visible than
  // a faint WebGL2 radiance overlay on top of the already baked plate.
  if(this.mobile){this.ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});this.mode='CANVAS_REFRACTED_WATER';return;}
  this.gl=canvas.getContext('webgl2',{alpha:true,antialias:false,premultipliedAlpha:false,depth:false});
  if(!this.gl){this.ctx=canvas.getContext('2d',{alpha:true});this.mode='CANVAS_REFRACTED_WATER';return;}
  try {
   const g=this.gl;
   const compile=(type,source)=>{const s=g.createShader(type);g.shaderSource(s,source);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));return s};
   const program=g.createProgram();g.attachShader(program,compile(g.VERTEX_SHADER,VS));g.attachShader(program,compile(g.FRAGMENT_SHADER,FS));g.linkProgram(program);if(!g.getProgramParameter(program,g.LINK_STATUS))throw Error(g.getProgramInfoLog(program));
   g.useProgram(program);const b=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),g.STATIC_DRAW);
   const loc=g.getAttribLocation(program,'a_pos');g.enableVertexAttribArray(loc);g.vertexAttribPointer(loc,2,g.FLOAT,false,0,0);
   this.u={res:g.getUniformLocation(program,'u_resolution'),time:g.getUniformLocation(program,'u_time'),mobile:g.getUniformLocation(program,'u_mobile'),pulse:g.getUniformLocation(program,'u_pulse')};
   g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);
   this.mode='WEBGL2_ANIMATED_OPTICS';
  }catch(ex){this.error=String(ex).slice(0,160);this.gl=null;this.ctx=canvas.getContext('2d',{alpha:true});this.mode='CANVAS_REFRACTED_WATER'}
 }
 resize(width,height,mobile=false,dpr=1){
  this.mobile=mobile;this.width=width;this.height=height;
  const rasterDpr=Math.min(mobile?1.15:1.4,dpr);
  this.canvas.width=Math.max(1,Math.round(width*rasterDpr));this.canvas.height=Math.max(1,Math.round(height*rasterDpr));
  this.scale=rasterDpr;
  if(this.ctx)this.ctx.setTransform(rasterDpr,0,0,rasterDpr,0,0);
  if(this.gl)this.gl.viewport(0,0,this.canvas.width,this.canvas.height);
 }
 signal(){this.pulse=1;}
 draw(seconds){
  if(!Number.isFinite(seconds))return;
  this.frames++;
  if(this.gl){
   const g=this.gl;
   this.pulse=Math.max(0,this.pulse-.028);
   g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);
   g.uniform2f(this.u.res,this.canvas.width,this.canvas.height);
   g.uniform1f(this.u.time,seconds);g.uniform1f(this.u.mobile,this.mobile?1:0);g.uniform1f(this.u.pulse,this.pulse);
   g.drawArrays(g.TRIANGLES,0,3);return;
  }
  if(!this.ctx||seconds-this.lastPaint<1/24)return;
  this.lastPaint=seconds;
  const c=this.ctx,w=this.width,h=this.height;
  c.clearRect(0,0,w,h);
  if(!this.mobile){this.drawGlints(c,w,h,seconds,.57,.88);return;}
  // The mobile plate occupies 34%–103% of the screen (CSS). Refraction is
  // bounded to the water: horizon about 62%, stopping before foreground vessel.
  // Draw sampled strips over the original plate with real phase displacement.
  const y0=h*.618,y1=h*.777,im=this.source;
  if(this.sourceReady && im.naturalWidth && im.naturalHeight){
   const strip=3.5;
   c.save();c.beginPath();c.rect(0,y0,w,y1-y0);c.clip();
   for(let y=y0;y<y1;y+=strip){
    const local=(y/h-.34)/.69;
    if(local<=0||local>=1)continue;
    const sy=Math.max(0,Math.min(im.naturalHeight-3,local*im.naturalHeight));
    const phase=seconds*.95+y*.068;
    const dx=(Math.sin(phase)+.55*Math.sin(seconds*.58+y*.145))*3.3;
    c.globalAlpha=.52+.13*Math.sin(seconds*.43+y*.043);
    c.drawImage(im,0,sy,im.naturalWidth,Math.max(2,strip/.69/h*im.naturalHeight),dx, y, w,strip+1);
   }
   c.restore();
  }
  this.drawGlints(c,w,h,seconds,.618,.79);
 }
 drawGlints(c,w,h,seconds,yStart,yEnd){
  // Banded, physically motivated radiance on the horizon reflection, not
  // arbitrary random CSS jitter. The phase always derives from Space OS time.
  c.save();c.globalCompositeOperation='screen';
  const rays=54;
  for(let i=0;i<rays;i++){
   const v=(i+.5)/rays,y=h*(yStart+v*(yEnd-yStart));
   const a=seconds*(.42+.9*v)+i*2.399963;
   const spread=w*(.018+.18*v);
   const centerX=w*.505+Math.sin(a*1.21)*spread;
   const lineWidth=(3+24*v)*(0.6+.4*Math.sin(a*.71)**2);
   const alpha=.05+.2*Math.pow(.5+.5*Math.sin(a*2.1),3);
   const grad=c.createLinearGradient(centerX-lineWidth,y,centerX+lineWidth,y);
   grad.addColorStop(0,'rgba(255,199,140,0)');
   grad.addColorStop(.5,`rgba(255,223,178,${alpha})`);
   grad.addColorStop(1,'rgba(255,199,140,0)');
   c.strokeStyle=grad;c.lineWidth=.6+v*.8;c.beginPath();c.moveTo(centerX-lineWidth,y);c.lineTo(centerX+lineWidth,y);c.stroke();
  }
  if(this.pulse>.005){
   const age=1-this.pulse;
   c.strokeStyle=`rgba(255,211,163,${this.pulse*.64})`;
   c.lineWidth=1.35;c.beginPath();
   c.ellipse(w*.5,h*.79,15+age*145,3+age*29,0,0,Math.PI*2);c.stroke();
   this.pulse=Math.max(0,this.pulse-.035);
  }
  c.restore();
 }
 stop(){if(this.gl)this.gl.getExtension('WEBGL_lose_context')?.loseContext()}
}
