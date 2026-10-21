// Gera os vídeos ilustrativos da landing em public/landing: cenas abstratas em
// shader WebGL, renderizadas quadro a quadro (tempo fixo por quadro, sem engasgo)
// e montadas em WebM pelo ffmpeg que vem com o Playwright. Também salva um pôster jpg.
// Nada aqui imita pessoa ou marca real.
// Quando houver vídeos reais gerados no Vynkio, salvar em public/landing e apontar
// em src/landing/content.ts (ver docs/landing.md).
// Roda com: npm run landing:assets
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'landing')
const FPS = 24
const SECONDS = 6

const COMMON = `
precision highp float;
uniform vec2 R;
uniform float T;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
vec3 grade(vec3 c,vec2 uv){c*=1.-.35*dot(uv-.5,uv-.5)*2.2;c+=(hash(uv*R+T)-.5)*.035;return pow(max(c,0.),vec3(.95));}
`

// Cada cena recebe uv (0..1) e p (centrado, proporção corrigida); T vai de 0 a 2π (loop perfeito).
const SCENES = {
  chrome: {
    size: [432, 768],
    glsl: `
float map(vec3 p){
  float d=1e3;
  for(int i=0;i<4;i++){float fi=float(i);
    vec3 c=vec3(sin(T+fi*1.7)*.42,cos(T*1.+fi*2.3)*.6,sin(T*1.+fi)*.3);
    float r=.3+.06*sin(T*2.+fi);
    float k=.35;float h=clamp(.5+.5*(length(p-c)-r-d)/k,0.,1.);
    d=mix(length(p-c)-r,d,h)-k*h*(1.-h);}
  return d;}
vec3 nrm(vec3 p){vec2 e=vec2(.002,0);return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}
vec3 env(vec3 d){
  float y=d.y*.5+.5;
  vec3 c=mix(vec3(.05,.05,.08),vec3(.55,.55,.62),smoothstep(-.1,.9,d.y));
  c+=vec3(.23,.51,.96)*pow(max(dot(d,normalize(vec3(.8,.3,.5))),0.),6.)*1.4;
  c+=vec3(.55,.35,1.)*pow(max(dot(d,normalize(vec3(-.9,.0,.4))),0.),4.)*1.3;
  c+=vec3(1.)*smoothstep(.985,1.,dot(d,normalize(vec3(.1,.9,.4))))*2.;
  return c;}
vec3 scene(vec2 uv,vec2 p){
  vec3 ro=vec3(0,0,4.),rd=normalize(vec3(p,-1.6));
  float t=0.;for(int i=0;i<64;i++){float d=map(ro+rd*t);if(d<.001||t>8.)break;t+=d;}
  vec3 col=mix(vec3(.03,.03,.05),vec3(.07,.05,.12),uv.y);
  col+=vec3(.23,.51,.96)*.06*exp(-6.*length(p-vec2(.3,.4)));
  if(t<8.){vec3 pos=ro+rd*t,n=nrm(pos),r=reflect(rd,n);
    float fr=pow(1.-max(dot(n,-rd),0.),3.);
    col=env(r)*(.6+.4*fr)+vec3(.02);}
  return col;}`,
  },
  aurora: {
    size: [432, 768],
    glsl: `
vec3 scene(vec2 uv,vec2 p){
  vec3 col=mix(vec3(.01,.02,.05),vec3(.02,.06,.12),uv.y);
  vec2 s=floor(uv*R/2.);float st=hash(s);col+=vec3(step(.997,st))*(.5+.5*sin(T*3.+st*40.));
  for(int i=0;i<5;i++){float fi=float(i);
    float y=.55+fi*.06+.08*sin(uv.x*3.+T+fi)+.05*fbm(vec2(uv.x*2.5+T*.4+fi,fi));
    float band=exp(-pow((uv.y-y)*14.,2.))*(.55+.45*fbm(vec2(uv.x*5.-T*.6,fi*3.)));
    vec3 tint=mix(vec3(.23,.51,.96),vec3(.55,.3,1.),fi/4.);
    col+=tint*band*.55;
    col+=tint*.25*smoothstep(y,y+.25,uv.y)*exp(-(uv.y-y)*5.)*band*3.;}
  float ridge=.18+.06*fbm(vec2(uv.x*3.,1.))+.03*sin(uv.x*9.);
  col=mix(col,vec3(.005,.01,.02),smoothstep(ridge+.005,ridge-.005,uv.y));
  float lake=step(uv.y,ridge-.04);
  if(lake>.5){vec2 m=vec2(uv.x,2.*(ridge-.04)-uv.y+.02*sin(uv.y*80.+T*2.));
    col+=vec3(.6,.3,.15)*.25*exp(-pow((m.y-.62)*8.,2.));}
  return col;}`,
  },
  dunes: {
    size: [432, 768],
    glsl: `
vec3 scene(vec2 uv,vec2 p){
  vec3 sky=mix(vec3(1.,.62,.36),vec3(.36,.22,.42),pow(uv.y,.8));
  vec2 sun=vec2(.5,.56);float sd=length((uv-sun)*vec2(R.x/R.y,1.));
  vec3 col=sky+vec3(1.,.85,.6)*exp(-sd*18.)*1.2+vec3(1.,.6,.3)*exp(-sd*4.)*.35;
  for(int i=0;i<6;i++){float fi=float(i);float sp=.04+fi*.035;
    float x=uv.x*(1.2+fi*.4)+T/6.2831*sp*12.+fi*3.1;
    float h=.5-fi*.075+.06*sin(x*2.1)+.035*sin(x*4.7+fi)+.02*fbm(vec2(x*3.,fi));
    if(uv.y<h){float slope=cos(x*2.1)*.6+cos(x*4.7+fi)*.4;
      vec3 sand=mix(vec3(.85,.48,.28),vec3(.35,.16,.14),fi/5.);
      sand*=.75+.35*smoothstep(-.2,.6,slope);
      sand+=vec3(1.,.7,.4)*.15*smoothstep(.02,0.,h-uv.y);
      float haze=exp(-fi*.5)*.55;
      col=mix(sand,sky,haze*.6);}}
  return col;}`,
  },
  tunnel: {
    size: [432, 768],
    glsl: `
vec3 scene(vec2 uv,vec2 p){
  float a=atan(p.y,p.x),r=length(p);
  float z=.35/r+T/6.2831*4.;
  float ring=pow(abs(sin(z*3.14159*2.)),24.);
  float ribs=pow(abs(sin(a*6.+z*.5)),40.);
  vec3 c1=vec3(.23,.51,.96),c2=vec3(.6,.35,1.);
  vec3 col=mix(c2,c1,.5+.5*sin(z*.8))*(ring*1.2+ribs*.6);
  col*=smoothstep(0.,.6,r);
  col+=mix(c2,c1,.5)*.12*exp(-r*3.);
  col+=vec3(1.)*exp(-r*18.)*.7;
  col+=c1*.08*fbm(vec2(a*3.,z*2.));
  return col;}`,
  },
  silk: {
    size: [432, 768],
    glsl: `
vec3 scene(vec2 uv,vec2 p){
  vec2 q=p*1.4;
  vec2 w=vec2(fbm(q+vec2(cos(T),sin(T))*.6),fbm(q+vec2(5.2,1.3)+vec2(sin(T),cos(T))*.6));
  float f=fbm(q+w*2.2);
  float fold=sin((q.x+w.x*2.)*5.+f*6.);
  vec3 a=vec3(.06,.03,.14),b=vec3(.58,.36,1.),c=vec3(1.,.42,.17),d=vec3(1.,.55,.75);
  vec3 col=mix(a,b,smoothstep(.2,.8,f));
  col=mix(col,d,smoothstep(.55,.95,w.y)*.6);
  col+=mix(c,vec3(1.),.4)*pow(.5+.5*fold,8.)*.35*smoothstep(.3,.7,f);
  return col;}`,
  },
  planet: {
    size: [432, 768],
    glsl: `
vec3 scene(vec2 uv,vec2 p){
  vec3 col=vec3(.01,.01,.025);
  vec2 s=floor(uv*R/1.5);col+=vec3(step(.996,hash(s)))*.7;
  vec2 c=p-vec2(0.,.02);float r=.23;float d=length(c);
  if(d<r){vec3 n=vec3(c,sqrt(r*r-d*d))/r;
    float lon=atan(n.x,n.z)+T/6.2831*1.2;
    float bands=fbm(vec2(lon*2.,n.y*7.));
    vec3 surf=mix(vec3(.22,.14,.5),vec3(.95,.7,.9),smoothstep(.25,.75,bands));
    float lit=max(dot(n,normalize(vec3(-.6,.4,.7))),0.);
    col=surf*(.08+lit*1.1);}
  col+=mix(vec3(.55,.4,1.),vec3(1.,.42,.17),.35)*exp(-abs(d-r)*40.)*.8;
  col+=vec3(.4,.3,.9)*.18*exp(-max(d-r,0.)*8.);
  vec2 rp=c*mat2(.96,-.28,.28,.96);float e=length(rp*vec2(1.,3.6));
  float ring=smoothstep(.33,.35,e)*smoothstep(.47,.44,e)*(.6+.4*sin(e*90.));
  bool front=rp.y<0.||d>r;
  if(front)col=mix(col,vec3(.9,.95,.75),ring*.55);
  return col;}`,
  },
}

function page(glsl, [w, h]) {
  return `<!doctype html><html><body style="margin:0;background:#000">
<canvas id="c" width="${w}" height="${h}"></canvas>
<script>
const gl=document.getElementById('c').getContext('webgl',{preserveDrawingBuffer:true});
const vs='attribute vec2 a;void main(){gl_Position=vec4(a,0,1);}';
const fs=${JSON.stringify(COMMON + glsl + `
void main(){vec2 uv=gl_FragCoord.xy/R;vec2 p=(gl_FragCoord.xy-.5*R)/R.y;
  gl_FragColor=vec4(grade(scene(uv,p),uv),1.);}`)};
function sh(t,s){const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o;}
const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,vs));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(pr);gl.useProgram(pr);
gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
const loc=gl.getAttribLocation(pr,'a');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
gl.uniform2f(gl.getUniformLocation(pr,'R'),${w},${h});
const tl=gl.getUniformLocation(pr,'T');
window.draw=(t)=>{gl.uniform1f(tl,t);gl.drawArrays(gl.TRIANGLES,0,3);gl.finish();};
</script></body></html>`
}

function encoder(target, [w, h]) {
  const ffmpeg = findFfmpeg()
  const proc = spawn(ffmpeg, [
    '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', 'pipe:0',
    '-vf', `scale=${w}:${h}`, '-c:v', 'libvpx', '-b:v', '1600k', '-crf', '8', '-qmin', '0', '-qmax', '40',
    '-deadline', 'good', '-cpu-used', '1', '-auto-alt-ref', '0', '-pix_fmt', 'yuv420p', '-an', target,
  ])
  const done = new Promise((resolve, reject) => {
    proc.on('error', reject)
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg saiu com código ${code}`))))
  })
  proc.stderr.pipe(process.stderr)
  return { stdin: proc.stdin, done }
}

function findFfmpeg() {
  const root = path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), '.cache'), 'ms-playwright')
  const dir = fs.readdirSync(root).filter((name) => name.startsWith('ffmpeg')).sort().pop()
  if (!dir) throw new Error('ffmpeg do Playwright não encontrado. Rode: npx playwright install ffmpeg')
  const bin = fs.readdirSync(path.join(root, dir)).find((name) => name.startsWith('ffmpeg'))
  if (!bin) throw new Error(`Binário do ffmpeg não encontrado em ${dir}`)
  return path.join(root, dir, bin)
}

async function render(browser, name, { glsl, size }) {
  const [w, h] = size
  const tab = await browser.newPage({ viewport: { width: w, height: h } })
  const errors = []
  tab.on('pageerror', (error) => errors.push(error.message))
  await tab.setContent(page(glsl, size))
  if (errors.length) throw new Error(`${name}: ${errors.join('\n')}`)
  const canvas = tab.locator('#c')
  const { stdin, done } = encoder(path.join(OUT, `${name}.webm`), size)
  const frames = FPS * SECONDS
  for (let i = 0; i < frames; i += 1) {
    await tab.evaluate((t) => window.draw(t), (i / frames) * Math.PI * 2)
    const jpg = await canvas.screenshot({ type: 'jpeg', quality: 92 })
    if (i === Math.floor(frames / 3)) fs.writeFileSync(path.join(OUT, `${name}.jpg`), jpg)
    if (!stdin.write(jpg)) await new Promise((resolve) => stdin.once('drain', resolve))
  }
  stdin.end()
  await done
  await tab.close()
  console.log(`  ${name}: ${frames} quadros`)
}

// Sem argumento, recria tudo; com nomes (ex.: `npm run landing:assets -- dunes`), só essas cenas.
const only = process.argv.slice(2)
if (only.length === 0) fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
for (const [name, scene] of Object.entries(SCENES)) {
  if (only.length === 0 || only.includes(name)) await render(browser, name, scene)
}
await browser.close()
console.log('landing: vídeos e pôsteres em public/landing')
