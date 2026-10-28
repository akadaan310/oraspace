/** Spectral water lighting pass. WebGL2 overlay; original waterfront art is a scene plate.
 * Uniform time is from the GLASS clock, not Date.now randomness.
 * It models optically motivated glints/ripples, not Navier-Stokes fluid dynamics.
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
float noise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
void main(){
 vec2 uv=gl_FragCoord.xy/u_resolution;
 float y=uv.y, mobile=u_mobile;
 float h=mix(.50,.56,mobile);
 float mask=1.-smoothstep(h-.045,h+.045,y);
 if(mask<.0001){frag=vec4(0.);return;}
 vec2 w=uv;
 float depth=max(.015,h-y);
 float wave=sin(w.x*67.0+u_time*.63+sin(w.y*28.0)*.8);
 wave+=.45*sin(w.x*122.0-u_time*.91+w.y*51.0);
 wave+=.32*sin(w.x*17.0+u_time*.24-w.y*67.0);
 float envelope=pow(clamp(1.0-abs(w.x-.51)*2.0,0.,1.),3.7);
 float rays=pow(max(0.,sin(w.y*240.+wave*1.9)),13.0);
 float sparkle=pow(max(0.,sin(w.x*238.+wave*1.2)),19.0)*rays;
 float glint=(.14+.58*envelope)*sparkle*(.15+.85*clamp(1.-depth,0.,1.));
 float rim=pow(max(0.,.5+.5*sin(w.x*18.+u_time*.3+w.y*27.)),8.0)*.013;
 float ripples=0.;
 if(u_pulse>.002){
  vec2 p=(uv-vec2(.5,.19))*vec2(1.0,3.7);
  float radius=length(p);
  ripples=exp(-pow((radius-u_pulse*.48)/.033,2.))*pow(1.-min(u_pulse,1.),.7)*.26;
 }
 float intensity=mask*(glint+rim+ripples);
 vec3 light=mix(vec3(.28,.46,.88),vec3(1.,.69,.43),envelope);
 // A small transparent radiance overlay preserves the source plate's specular complexity.
 frag=vec4(light,intensity);
}`;
export class WaterOptics {
 constructor(canvas){this.canvas=canvas;this.gl=canvas.getContext('webgl2',{alpha:true,antialias:false,premultipliedAlpha:false,depth:false});
  if(!this.gl){this.mode='CANVAS_FALLBACK';return}
  try {const g=this.gl;
  const compile=(type,source)=>{const s=g.createShader(type);g.shaderSource(s,source);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));return s};
  const program=g.createProgram();g.attachShader(program,compile(g.VERTEX_SHADER,VS));g.attachShader(program,compile(g.FRAGMENT_SHADER,FS));g.linkProgram(program);if(!g.getProgramParameter(program,g.LINK_STATUS))throw Error(g.getProgramInfoLog(program));
  g.useProgram(program);const b=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),g.STATIC_DRAW);const loc=g.getAttribLocation(program,'a_pos');g.enableVertexAttribArray(loc);g.vertexAttribPointer(loc,2,g.FLOAT,false,0,0);
  this.u={res:g.getUniformLocation(program,'u_resolution'),time:g.getUniformLocation(program,'u_time'),mobile:g.getUniformLocation(program,'u_mobile'),pulse:g.getUniformLocation(program,'u_pulse')};
  g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);
  this.mode='WEBGL2_FRAGMENT_OPTICS';this.mobile=false;this.pulse=0;
  } catch(ex) { this.error=String(ex).slice(0,120); this.gl=null; this.mode='CANVAS_FALLBACK'; this.mobile=false; this.pulse=0; }
 }
 resize(width,height,mobile=false,dpr=1){const d=Math.min(dpr,1.5);const w=Math.max(1,Math.round(width*d)),h=Math.max(1,Math.round(height*d));this.canvas.width=w;this.canvas.height=h;this.mobile=mobile;if(this.gl)this.gl.viewport(0,0,w,h)}
 signal(){this.pulse=1}
 draw(seconds){if(!this.gl)return;const g=this.gl;this.pulse=Math.max(0,this.pulse-.017);g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);
  g.uniform2f(this.u.res,this.canvas.width,this.canvas.height);g.uniform1f(this.u.time,seconds);g.uniform1f(this.u.mobile,this.mobile?1:0);g.uniform1f(this.u.pulse,this.pulse);
  g.drawArrays(g.TRIANGLES,0,3);
 }
 stop(){if(this.gl)this.gl.getExtension('WEBGL_lose_context')?.loseContext()}
}
