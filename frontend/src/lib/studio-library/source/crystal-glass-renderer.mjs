import {studioFontPixels} from '../text-layout.mjs';
import { loadCrystalFont } from './crystal-glass-font.mjs';

export const CrystalPalettes = Object.freeze({
  reference: { label: 'Reference · neutralno', tint: [0.80, 0.80, 0.76], density: 0.035, reflection: [0.97, 0.98, 0.95] },
  smoke: { label: 'Obsidian · dimljeno', tint: [0.08, 0.10, 0.13], density: 0.12, reflection: [0.90, 0.94, 1.0] },
  champagne: { label: 'Champagne · toplo', tint: [0.68, 0.43, 0.18], density: 0.07, reflection: [1.0, 0.88, 0.63] },
  glacier: { label: 'Glacier · hladno', tint: [0.38, 0.54, 0.63], density: 0.055, reflection: [0.82, 0.95, 1.0] }
});
const cgClamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const cgSmooth=(a,b,n)=>{const t=cgClamp((n-a)/(b-a),0,1);return t*t*(3-2*t);};
const cgVertex=`#version 300 es
in vec2 aPosition;
out vec2 vUV;
void main(){vUV=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
const cgBlur=`#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uImage;
uniform vec2 uStep;
uniform float uSigma;
out vec4 color;
void main(){
 float sigma=max(uSigma,.001);
 float stride=max(1.,sigma*3./24.);
 vec3 sum=vec3(0.);float total=0.;
 for(int i=-24;i<=24;i++){
  float offset=float(i)*stride;
  if(abs(offset)>sigma*3.+.5)continue;
  float weight=exp(-.5*offset*offset/(sigma*sigma));
  sum+=texture(uImage,vUV+uStep*offset).rgb*weight;
  total+=weight;
 }
 color=vec4(sum/max(total,.001),1.);
}`;
const cgGlass=`#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uImage, uBlur, uRimBlur, uText;
uniform vec2 uResolution, uCenter, uHalf;
uniform float uRadius, uAlpha, uRefraction, uReflection, uGrain, uSweep, uOverlay, uHasCaption;
uniform vec3 uTint, uLight;
uniform float uDensity;
out vec4 color;
float sdf(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
vec2 normal(vec2 p,vec2 b,float r){
 vec2 q=abs(p)-b+r;
 if(max(q.x,q.y)>0.)return normalize(max(q,0.)+vec2(1e-5))*sign(p);
 return q.x>q.y?vec2(sign(p.x),0.):vec2(0.,sign(p.y));
}
float noise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec3 original=texture(uImage,vUV).rgb;
 if(uHasCaption<.5){color=uOverlay>.5?vec4(0.):vec4(original,1.);return;}
 vec2 pixel=vec2(vUV.x,1.-vUV.y)*uResolution;
 vec2 p=pixel-uCenter;
 float d=sdf(p,uHalf,uRadius);
 float aa=max(fwidth(d),.7);
 float mask=(1.-smoothstep(-aa,aa,d))*uAlpha;
 float shadowD=sdf(p-vec2(0.,uHalf.y*.10),uHalf,uRadius);
 float shadow=exp(-max(shadowD,0.)/max(uHalf.y*.085,1.))*smoothstep(-2.,2.,d)*.08*uAlpha;
 if(d>uHalf.y*.7){color=uOverlay>.5?vec4(0.):vec4(original,1.);return;}
 float inside=max(-d,0.);
 float bevel=max(uHalf.y*.40,2.);
 float edge=1.-smoothstep(0.,bevel,inside);
 vec2 n=normal(p,uHalf,uRadius);
 vec2 normalUV=vec2(n.x,-n.y);
 float curve=pow(edge,.9);
 float bend=sin(curve*1.48)*uHalf.y*.62*uRefraction;
 vec2 centerDelta=-vec2(p.x,-p.y)*.055*uRefraction;
 vec2 bentUV=clamp(vUV+(centerDelta-normalUV*bend)/uResolution,vec2(.001),vec2(.999));
 vec3 frosted=texture(uBlur,bentUV).rgb;
 vec3 rimRefraction=texture(uRimBlur,bentUV).rgb;
 vec3 refracted=texture(uImage,bentUV).rgb;
 // The rolled lip is a clearer lens; the center remains diffusely frosted.
 float outerLip=exp(-inside/max(uHalf.y*.095,1.));
 vec3 glass=mix(frosted,rimRefraction,pow(edge,.8)*.62);
 glass=mix(glass,refracted,outerLip*.075);
 glass=mix(glass,uTint,uDensity);
 // There is no inset contour or dark rim. Depth comes from refracted video and diffuse light.
 float lightSide=pow(max(dot(n,normalize(vec2(.55,-.84))),0.),2.);
 float lowerSide=pow(max(dot(n,normalize(vec2(.35,.94))),0.),3.);
 vec3 environment=texture(uBlur,clamp(vUV+normalUV*uHalf.y*1.1/uResolution,vec2(.001),vec2(.999))).rgb;
 vec3 rimLight=mix(uLight,environment,.28);
 float frostRim=pow(edge,1.6)*(.045+.10*lightSide+.065*lowerSide);
 float polishedLip=outerLip*(.08+.32*lightSide+.15*lowerSide);
 glass=mix(glass,rimLight,clamp((frostRim+polishedLip)*uReflection,0.,.68));
 // Light rolls across the convex cross-section. Both highlights are positive light,
 // rather than an inset border or an artificially dark groove.
 vec3 surfaceNormal=normalize(vec3(n*curve*.91,sqrt(max(.01,1.-curve*curve*.83))));
 float coatSpec=pow(max(dot(surfaceNormal,normalize(vec3(.30,-.65,1.35))),0.),22.);
 float sideSpec=pow(max(dot(surfaceNormal,normalize(vec3(.80,.30,1.30))),0.),26.);
 glass=mix(glass,rimLight,(coatSpec*.38+sideSpec*.22)*uReflection);
 vec2 pn=p/max(uHalf,vec2(1.));
 // Broad softbox reflections merge into the glass instead of tracing another rounded rectangle.
 float topGlow=exp(-pow((pn.y+.91)/.38,2.))*(.65+.35*smoothstep(-1.,1.,pn.x));
 float bottomGlow=exp(-pow((pn.y-.98)/.28,2.))*(.55+.45*smoothstep(-.7,1.,pn.x));
 glass=mix(glass,rimLight,(topGlow*.10+bottomGlow*.075)*uReflection);
 float sideGlow=pow(abs(pn.x),6.)*.035*uReflection;
 glass=mix(glass,rimLight,sideGlow);
 float sweep=exp(-pow((pn.x+pn.y*.32-uSweep)/.45,2.))*.055*uAlpha;
 if(uSweep<2.)glass=mix(glass,uLight,sweep);
 glass+=(noise(floor(pixel))-.5)*uGrain;
 vec4 text=texture(uText,vUV);
 glass=mix(glass,text.rgb,text.a);
 vec3 behind=original*(1.-shadow);
 if(uOverlay>.5){
  float alpha=mask+shadow*(1.-mask);
  vec3 premult=glass*mask;
  color=alpha>.0001?vec4(premult/alpha,alpha):vec4(0.);
 }else color=vec4(mix(behind,glass,mask),1.);
}`;

/** Video-aware frosted glass, rendered with WebGL 2 and Canvas 2D typography. */
export class CrystalGlassRenderer {
 constructor(canvas,options={}){
  this.canvas=canvas;this.options={palette:'reference',shape:'rounded',display:'pair',blur:30,refraction:1,reflection:1,textSize:1,position:.77,grain:.008,...options};
  this.gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:false,antialias:false,preserveDrawingBuffer:true});
  if(!this.gl)throw new Error('Crystal Glass zahtijeva WebGL 2.');
  this.sourceCanvas=document.createElement('canvas');this.sourceContext=this.sourceCanvas.getContext('2d',{alpha:false});
  this.textCanvas=document.createElement('canvas');this.textContext=this.textCanvas.getContext('2d');
  this.cues=[];this.groups=[];this.source=null;this.disposed=false;this.attachment=null;this.pose=null;
  const gl=this.gl;this.programs={blur:this.createProgram(cgBlur),glass:this.createProgram(cgGlass)};
  this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  this.textures={image:this.createTexture(),text:this.createTexture()};this.targets=[];
  this.fontReady=loadCrystalFont().then(()=>{this.textKey='';return this;});this.resize(options.width,options.height);
 }
 createProgram(fragment){
  const gl=this.gl,program=gl.createProgram();
  for(const [kind,code] of [[gl.VERTEX_SHADER,cgVertex],[gl.FRAGMENT_SHADER,fragment]]){const shader=gl.createShader(kind);gl.shaderSource(shader,code);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const log=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(log);}gl.attachShader(program,shader);gl.deleteShader(shader);}
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  const uniforms={};for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){const info=gl.getActiveUniform(program,i);uniforms[info.name]=gl.getUniformLocation(program,info.name);}return {program,uniforms};
 }
 createTexture(){const gl=this.gl,texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return texture;}
 createTarget(w,h){const gl=this.gl,texture=this.createTexture(),framebuffer=gl.createFramebuffer();gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Nije moguće napraviti blur površinu.');return {texture,framebuffer,w,h};}
 resize(width,height){
  if(this.disposed)return;const bounds=this.canvas.getBoundingClientRect(),ratio=Math.min(globalThis.devicePixelRatio||1,2);
  const w=Math.max(1,Math.round(width||bounds.width*ratio||960)),h=Math.max(1,Math.round(height||bounds.height*ratio||w*9/16));
  if(w===this.canvas.width&&h===this.canvas.height&&this.targets.length)return;
  this.canvas.width=this.sourceCanvas.width=this.textCanvas.width=w;this.canvas.height=this.sourceCanvas.height=this.textCanvas.height=h;
  const gl=this.gl;this.targets.forEach(t=>{gl.deleteTexture(t.texture);gl.deleteFramebuffer(t.framebuffer);});this.targets=Array.from({length:4},()=>this.createTarget(Math.ceil(w/2),Math.ceil(h/2)));gl.bindFramebuffer(gl.FRAMEBUFFER,null);this.textKey='';
 }
 setOptions(options){this.options={...this.options,...options};if(!Object.hasOwn(CrystalPalettes,this.options.palette))this.options.palette='reference';if(!['capsule','rounded'].includes(this.options.shape))this.options.shape='capsule';if(!['pair','triple','sentence'].includes(this.options.display))this.options.display='pair';this.buildGroups();this.textKey='';}
 setSource(source){this.source=source;this.sourceKey=null;}
 setCues(cues){
  const clean=cues.map(c=>({start:Number(c.start),end:Number(c.end),text:String(c.text??'').trim(),words:c.words?.map(w=>({start:Number(w.start),end:Number(w.end),text:String(w.text??'')}))})).sort((a,b)=>a.start-b.start);
  clean.forEach((c,i)=>{if(!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.end<=c.start||c.start<0)throw new Error('Titl mora imati početak i kraj u sekundama.');if(i&&c.start<clean[i-1].end)throw new Error('Titlovi se ne smiju preklapati.');if(c.words){let previous=c.start;for(const w of c.words){if(!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.start<previous||w.end<=w.start||w.end>c.end)throw new Error('Vremena riječi moraju biti unutar titla i poredana.');previous=w.end;}}});
  this.cues=clean;this.buildGroups();this.textKey='';
 }
 buildGroups(){
  const size=this.options.display==='sentence'?Infinity:this.options.display==='triple'?3:2;this.groups=[];
  this.cues.forEach((cue,cueIndex)=>{
   let words=cue.words;
   if(!words){const list=cue.text.split(/\s+/).filter(Boolean),weights=list.map(word=>Math.pow(word.length,.35)),sum=weights.reduce((a,b)=>a+b,0);let clock=cue.start;words=list.map((text,i)=>{const start=clock;clock+=weights[i]/sum*(cue.end-cue.start);return {text,start,end:i===list.length-1?cue.end:clock};});}
   if(!words.length)return;
   if(!Number.isFinite(size)){this.groups.push({start:cue.start,end:cue.end,text:cue.text,cueIndex,first:true,last:true});return;}
   for(let i=0;i<words.length;i+=size){const slice=words.slice(i,i+size);this.groups.push({start:slice[0].start,end:slice.at(-1).end,text:slice.map(w=>w.text).join(' '),cueIndex,first:i===0,last:i+size>=words.length});}
  });
 }
 locate(seconds){const index=this.groups.findIndex(group=>seconds>=group.start&&seconds<group.end);return index<0?null:{...this.groups[index],index};}
 layout(text){
  const w=this.canvas.width,h=this.canvas.height,ctx=this.textContext;let font=studioFontPixels(this.options,w)*cgClamp(this.options.textSize,.7,1.4),maxWidth=w*.88,padX=font*.82;
  ctx.font=`800 ${font}px CrystalCaption, sans-serif`;let lines=[],line='';
  for(const word of text.split(/\s+/)){const candidate=line?line+' '+word:word;if(line&&(line.split(/\s+/).length>=4||ctx.measureText(candidate).width>maxWidth-padX*2)){lines.push(line);line=word;}else line=candidate;}if(line)lines.push(line);
  if(lines.length>3){font*=3/lines.length;ctx.font=`800 ${font}px CrystalCaption, sans-serif`;lines=[];line='';for(const word of text.split(/\s+/)){const candidate=line?line+' '+word:word;if(line&&(line.split(/\s+/).length>=4||ctx.measureText(candidate).width>maxWidth-padX*2)){lines.push(line);line=word;}else line=candidate;}if(line)lines.push(line);}
  const widest=Math.max(0,...lines.map(line=>ctx.measureText(line).width));if(widest>maxWidth-padX*2){font*= (maxWidth-padX*2)/widest;ctx.font=`800 ${font}px CrystalCaption, sans-serif`;}
  padX=font*.82;const lineHeight=font*1.16,width=Math.min(maxWidth,Math.max(h*.70,...lines.map(line=>ctx.measureText(line).width+2*padX))),height=font*1.55+lineHeight*lines.length;
  return {lines,font,lineHeight,width,height:Math.min(height,h*.7)};
 }
 updateSource(source){
  const w=this.canvas.width,h=this.canvas.height,ctx=this.sourceContext;
  const sw=source?.videoWidth||source?.naturalWidth||source?.displayWidth||source?.width,sh=source?.videoHeight||source?.naturalHeight||source?.displayHeight||source?.height;
  if(!sw||!sh)throw new Error('Za blur i lom stakla potreban je dekodiran video kadar ili slika.');
  const scale=Math.max(w/sw,h/sh);ctx.drawImage(source,(w-sw*scale)/2,(h-sh*scale)/2,sw*scale,sh*scale);
  const gl=this.gl;gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.textures.image);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.sourceCanvas);
 }
 drawText(group,layout,center,opacity){
  const key=JSON.stringify([group?.text,layout,center,opacity]);if(key===this.textKey)return;this.textKey=key;
  const ctx=this.textContext,w=this.canvas.width,h=this.canvas.height;ctx.clearRect(0,0,w,h);
  if(group){ctx.font=`800 ${layout.font}px CrystalCaption, sans-serif`;ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillStyle='#f8f7f2';ctx.globalAlpha=opacity;ctx.shadowColor='rgba(0,0,0,.16)';ctx.shadowBlur=layout.font*.018;ctx.shadowOffsetY=layout.font*.015;
   const ascent=ctx.measureText('Hg').actualBoundingBoxAscent||layout.font*.78,descent=ctx.measureText('Hg').actualBoundingBoxDescent||layout.font*.20;
   layout.lines.forEach((line,i)=>ctx.fillText(line,center[0],center[1]+(i-(layout.lines.length-1)/2)*layout.lineHeight+(ascent-descent)/2));ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  }
  const gl=this.gl;gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.textures.text);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.textCanvas);
 }
 use(program,target){const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,target?.framebuffer||null);gl.viewport(0,0,target?.w||this.canvas.width,target?.h||this.canvas.height);gl.useProgram(program.program);gl.bindVertexArray(this.vao);const pos=gl.getAttribLocation(program.program,'aPosition');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);return program.uniforms;}
 render(seconds,{source=this.source,mode='composite',reducedMotion=false}={}){
  if(this.disposed)throw new Error('Renderer je zatvoren.');if(!Number.isFinite(seconds))throw new Error('Vrijeme mora biti konačan broj u sekundama.');
  this.updateSource(source);const w=this.canvas.width,h=this.canvas.height,gl=this.gl,group=this.locate(seconds),palette=CrystalPalettes[this.options.palette]||CrystalPalettes.reference;
  let layout=group?this.layout(group.text):{width:1,height:1},width=layout.width,height=layout.height,alpha=group?1:0,elapsed=group?seconds-group.start:0;
  if(group&&!reducedMotion){const t=cgSmooth(0,.32,elapsed),previous=this.groups[group.index-1];if(group.first){width=height*.55+(width-height*.55)*t;height*=.55+.45*t;alpha=cgSmooth(0,.12,elapsed);}else if(previous?.cueIndex===group.cueIndex){const old=this.layout(previous.text);width=old.width+(width-old.width)*t;height=old.height+(height-old.height)*t;}if(group.last)alpha*=cgSmooth(0,.16,group.end-seconds);}
  const center=[w*.5,cgClamp(h*cgClamp(this.options.position,.15,.90),height/2+10,h-height/2-10)],textOpacity=group?(reducedMotion?1:cgSmooth(.07,.25,elapsed)):0;
  this.drawText(group,layout,center,textOpacity);
  gl.disable(gl.BLEND);const blur=cgClamp(this.options.blur,0,60)*h/1080/2;
  if(blur>0){
   const pass=(input,target,horizontal,sigma)=>{const uniforms=this.use(this.programs.blur,target);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,input);gl.uniform1i(uniforms.uImage,0);gl.uniform1f(uniforms.uSigma,sigma);gl.uniform2f(uniforms.uStep,horizontal?1/target.w:0,horizontal?0:1/target.h);gl.drawArrays(gl.TRIANGLES,0,6);};
   pass(this.textures.image,this.targets[0],true,blur);pass(this.targets[0].texture,this.targets[1],false,blur);
   const rimSigma=Math.min(blur,Math.max(h/1080,blur*.28));pass(this.textures.image,this.targets[2],true,rimSigma);pass(this.targets[2].texture,this.targets[3],false,rimSigma);
  }
  const u=this.use(this.programs.glass,null);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.textures.image);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,blur>0?this.targets[1].texture:this.textures.image);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.textures.text);gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,blur>0?this.targets[3].texture:this.textures.image);
  gl.uniform1i(u.uImage,0);gl.uniform1i(u.uBlur,1);gl.uniform1i(u.uText,2);gl.uniform1i(u.uRimBlur,3);gl.uniform2f(u.uResolution,w,h);gl.uniform2f(u.uCenter,...center);gl.uniform2f(u.uHalf,width/2,height/2);
  gl.uniform1f(u.uRadius,Math.min(width,height)*(this.options.shape==='rounded'?.27:.5));gl.uniform1f(u.uAlpha,alpha);gl.uniform1f(u.uRefraction,cgClamp(this.options.refraction,0,2));gl.uniform1f(u.uReflection,cgClamp(this.options.reflection,0,2));gl.uniform1f(u.uGrain,cgClamp(this.options.grain,0,.025));gl.uniform1f(u.uSweep,group?.first&&!reducedMotion&&elapsed<1.1?-1.8+elapsed*3.8:3.);gl.uniform1f(u.uOverlay,mode==='overlay'?1:0);gl.uniform1f(u.uHasCaption,group?1:0);gl.uniform3fv(u.uTint,palette.tint);gl.uniform3fv(u.uLight,palette.reflection);gl.uniform1f(u.uDensity,palette.density);gl.drawArrays(gl.TRIANGLES,0,6);
  this.pose={seconds,group,center,width,height,alpha,mode};return this.pose;
 }
 ready(){return this.fontReady;}
 attachVideo(video,{mode='composite',reducedMotion=false,onFrame=()=>{}}={}){
  this.detachVideo();this.setSource(video);let stopped=false,handle=0;const hasRVFC=typeof video.requestVideoFrameCallback==='function';
  const draw=seconds=>{if(stopped||video.readyState<2)return;onFrame(this.render(seconds,{source:video,mode,reducedMotion}));};
  const loop=(now,metadata)=>{handle=0;if(stopped)return;draw(metadata?.mediaTime??video.currentTime);if(!video.paused&&!video.ended)schedule();};
  const schedule=()=>{if(stopped||handle)return;handle=hasRVFC?video.requestVideoFrameCallback(loop):requestAnimationFrame(loop);};
  const refresh=()=>draw(video.currentTime),play=()=>schedule(),pause=()=>{if(handle){hasRVFC?video.cancelVideoFrameCallback(handle):cancelAnimationFrame(handle);handle=0;}refresh();};
  for(const event of ['loadeddata','seeked','timeupdate'])video.addEventListener(event,refresh);video.addEventListener('play',play);video.addEventListener('pause',pause);video.addEventListener('ended',pause);
  this.attachment=()=>{stopped=true;if(handle)hasRVFC?video.cancelVideoFrameCallback(handle):cancelAnimationFrame(handle);for(const event of ['loadeddata','seeked','timeupdate'])video.removeEventListener(event,refresh);video.removeEventListener('play',play);video.removeEventListener('pause',pause);video.removeEventListener('ended',pause);};refresh();if(!video.paused)schedule();return ()=>this.detachVideo();
 }
 detachVideo(){this.attachment?.();this.attachment=null;}
 dispose(){if(this.disposed)return;this.detachVideo();this.disposed=true;const gl=this.gl;this.targets.forEach(t=>{gl.deleteTexture(t.texture);gl.deleteFramebuffer(t.framebuffer);});Object.values(this.textures).forEach(t=>gl.deleteTexture(t));Object.values(this.programs).forEach(p=>gl.deleteProgram(p.program));gl.deleteBuffer(this.buffer);gl.deleteVertexArray(this.vao);this.source=null;}
}
