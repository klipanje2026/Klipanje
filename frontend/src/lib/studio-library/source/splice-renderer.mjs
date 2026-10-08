import * as THREE from '../../collection/three.mjs';
import {LustreCaptionRenderer} from './lustre-renderer.mjs';
import {SpliceFont,SpliceSupportFont} from './splice-font.mjs';
import {SplicePalettes,SpliceDuration,SpliceText} from './splice-config.mjs';
import {buildSpliceGlyph} from './splice-geometry.mjs';
import {createSpliceMaterials} from './splice-materials.mjs';
const spClamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n)),spEase=n=>1-(1-spClamp(n))**4,spSmooth=n=>{n=spClamp(n);return n*n*(3-2*n);},spSpring=n=>{n=spClamp(n)-1;return 1+2.2*n**3+1.2*n**2;};
// Conservative display cleanup: only immediate repetitions of filler/auxiliary
// words. Never remove negations, questions or arbitrary short words by position.
const spliceRepeatable=new Set(['ovaj','ono','znači','dakle','je','nije']);
const spliceToken=word=>word.toLocaleLowerCase('bs').replace(/^[^\p{L}]+|[^\p{L}]+$/gu,'');
function spliceDisplayWords(words){
 return words.filter((word,index)=>{
  if(!index)return true;
  const token=spliceToken(word),previous=words[index-1];
  return !spliceRepeatable.has(token)||spliceToken(previous)!==token||/[.!?;:]$/.test(previous);
 });
}
export class SpliceRenderer extends LustreCaptionRenderer{
 constructor(canvas,options={}){
  super(canvas,{...options,style:'lustre-cut'});this.options={scale:1,depth:1,shine:1,texture:.4,motion:1,effects:1,palette:0,motionBlur:true,...options};this.finishes.dispose();this.finishes=createSpliceMaterials(THREE,this.gl);this.scene.remove(this.text);this.rig=new THREE.Group();this.rig.add(this.text);this.scene.add(this.rig);this.decor=[];this.decorGeometry=[];this.decorMaterials=[];this.accum=document.createElement('canvas');this.accumCtx=this.accum.getContext('2d',{alpha:true});this.gl.toneMappingExposure=1.07;
  for(const light of this.scene.children)if(light.isLight)light.intensity=light.isHemisphereLight?.45:.7;
  this.keyLight=new THREE.SpotLight('#fff4e8',850000,2400,.35,.8,2);this.keyLight.position.set(-500,-160,850);this.keyLight.target.position.set(0,-480,0);this.scene.add(this.keyLight,this.keyLight.target);this.setText(options.text||SpliceText);
 }
 setOptions(options){this.options={...this.options,...options};return this;}
 setText(text){const words=String(text||'').trim().split(/\s+/u).filter(Boolean);if(words.length<1||words.length>8)throw new RangeError('Use 1–8 words.');this.titleWords=words;this.titleText=words.join(' ');this.layoutKey='';return this;}
 glyph(char,support=false){const key=(support?'support:':'hero:')+char;if(this.glyphs.has(key))return this.glyphs.get(key);const font=support?SpliceSupportFont:SpliceFont,src=font.glyphs[char]||font.glyphs['?'],result={...buildSpliceGlyph(src,font.capHeight,support),advance:src.advance/font.capHeight};this.glyphs.set(key,result);return result;}
 word(text,support=false,spacing=.02){const key=[text,support,spacing].join('|');if(this.words.has(key))return this.words.get(key);let cursor=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;const letters=[];for(const char of text){const glyph=this.glyph(char,support);if(glyph.geometry){const b=glyph.geometry.boundingBox;minX=Math.min(minX,cursor+b.min.x);maxX=Math.max(maxX,cursor+b.max.x);minY=Math.min(minY,b.min.y);maxY=Math.max(maxY,b.max.y);letters.push({geometry:glyph.geometry,slices:glyph.slices,x:cursor,index:letters.length});}cursor+=glyph.advance+spacing;}const result={letters,minX,minY,maxY,width:maxX-minX,height:maxY-minY};this.words.set(key,result);return result;}
 clear(){super.clear();for(const obj of this.decor)this.rig?.remove(obj);for(const g of this.decorGeometry)g.dispose();for(const m of this.decorMaterials)m.dispose();this.decor=[];this.decorGeometry=[];this.decorMaterials=[];}
 buildTitle(){
  this.clear();const displayWords=spliceDisplayWords(this.titleWords);const p=SplicePalettes[spClamp(Math.round(this.options.palette)||0,0,3)],n=displayWords.length,counts=n===8?[2,1,0,3,2]:n===7?[1,1,0,3,2]:n===6?[1,1,0,2,2]:n===5?[1,1,0,1,2]:n===4?[1,1,0,0,2]:n===3?[0,1,0,0,2]:n===2?[0,1,0,0,1]:[0,1,0,0,0];let at=0;
  for(let row=0;row<5;row++){
   const chosen=displayWords.slice(at,at+counts[row]);at+=counts[row];if(!chosen.length)continue;
   const entries=chosen.map((text,i)=>{const role=row===1?'hero':row===4?(i===chosen.length-1?'count':'moment'):'support',support=role==='support',data=this.word(text.toLocaleUpperCase('en'),support,row===0?.16:row===3?.03:row===2?.1:.02);return{text,label:text.toLocaleUpperCase('en'),index:at-chosen.length+i,row,role,support,data,size:row===0?32:row===1?157:row===2?27:row===3?48:role==='count'?130:64};});
   let gap=row===4?34:24,width=entries.reduce((sum,w)=>sum+w.data.width*w.size,0)+gap*(entries.length-1),limit=row===1?784:row===4?852:row===2?105:760;if(width>limit){const k=limit/width;for(const w of entries)w.size*=k;gap*=k;width=limit;}let x=row===0?124:row===1?112:row===2?902:row===3?180:116;
   for(const word of entries){word.width=word.data.width*word.size;word.height=word.data.height*word.size;word.x=x;word.y=row===0?1198:row===1?1263:row===2?1287:row===3?1460:1680-word.height;word.angle=row===2?-Math.PI/2:row===1?.022:word.role==='count'?-.026:0;word.start=[.28,.72,1.30,1.64,2.12][row]+(word.index-(at-chosen.length))*.12;word.split=word.role==='hero'||word.role==='count';const finish=this.finishes.make(p,word.role),object=new THREE.Group(),letters=[],decorGeometry=[];this.text.add(object);
    for(const letter of word.data.letters){const group=new THREE.Group(),bands=[];if(word.split){for(let i=0;i<3;i++){const mesh=new THREE.Mesh(letter.slices[i],[finish.face,finish.bevel,finish.side,finish.cut]);group.add(mesh);bands.push(mesh);}}else{const mesh=new THREE.Mesh(letter.geometry,[finish.face,finish.bevel,finish.side]);group.add(mesh);}object.add(group);letters.push({...letter,object:group,bands});}
    let tag=null;if(row===2){const g=new THREE.BoxGeometry(word.data.width+.42,word.data.height+.38,.10),m=this.finishes.physical(p.accent,.08,.36);tag=new THREE.Mesh(g,m);tag.position.z=-.10;object.add(tag);decorGeometry.push(g);finish.all.push(m);}
    this.items.push({word,finish,object,letters,tag,decorGeometry});x+=word.width+gap;
   }
  }
  this.rails=[];for(let i=0;i<3;i++){const g=new THREE.BoxGeometry(83+i*31,3.4,9),m=this.finishes.physical(i===1?p.face:p.accent,.10,.28),rail=new THREE.Mesh(g,m);rail.userData.index=i;this.rig.add(rail);this.rails.push(rail);this.decor.push(rail);this.decorGeometry.push(g);this.decorMaterials.push(m);}this.layoutKey=[this.titleText,this.options.palette].join('|');
 }
 step(time){
  const motion=this.options.reducedMotion?0:spClamp(Number(this.options.motion)||0,0,1.5),still=this.options.reducedMotion||motion===0,t=still?4:time,out=still?0:spSmooth((t-6.02)/.95),depth=spClamp(Number(this.options.depth)||1,.3,1.5),effects=spClamp(Number(this.options.effects)||0,0,1.4),scale=spClamp(Number(this.options.scale)||1,.8,1.1);this.rig.scale.setScalar(scale);
  for(const item of this.items){const w=item.word,age=t-w.start,opacity=still?1:spSmooth(age/.19)*(1-spSmooth((t-6.25-w.row*.018)/.70));item.object.visible=age>0&&opacity>0;item.object.position.set(w.x+w.width/2-540,960-w.y-w.height/2,0);item.object.rotation.set(w.split?-.15:0,w.role==='hero'?-.16:w.role==='count'?.14:0,w.angle);item.object.scale.set(w.size,w.size,w.size*depth*(w.role==='moment'?.5:1));item.finish.update(t,this.options,still);for(const m of item.finish.all){m.transparent=opacity<.999;m.opacity=opacity;}
   let anyCut=false;
   for(const letter of item.letters){const cq=still?1:spClamp((age-letter.index*(w.split?.025:.014))/.78),settle=1-spEase(cq);letter.object.visible=cq>0;letter.object.position.set(letter.x-w.data.minX-w.data.width/2,-w.data.height/2-w.data.minY-settle*.08*motion,settle*.11*motion);letter.object.rotation.set(0,w.split?0:settle*.18*motion,0);
    for(let i=0;i<letter.bands.length;i++){const q=still?1:spClamp((age-letter.index*.025-i*.058)/.82),spring=spSpring(q),split=(1-spring)*motion+out*motion,band=letter.bands[i],direction=[-.70,.63,-.38][i];band.visible=q>0;band.position.set(direction*split,0,(i-1)*Math.abs(split)*.10);if(Math.abs(split)>.002)anyCut=true;}
   }
   item.finish.cut.visible=anyCut;
   if(item.tag){const q=still?1:spEase(age/.5);item.tag.scale.set(q,.95+.05*q,1);}
  }
  for(const rail of this.rails){const i=rail.userData.index,open=still?1:spEase((t-.08-i*.07)/.55),leave=still?1:spSmooth((t-1.22)/.60),close=still?0:spSmooth((t-6.13)/.55),fade=still?.28:(1-spSmooth((t-6.60)/.44));rail.visible=effects>0&&open>0&&fade>0;rail.position.set((i%2?-1:1)*(235*(1-open)+70*leave+150*close),-295-i*43,-65);rail.scale.set((1-leave)*1.8+leave*.25+close*.4,Math.min(1,effects),1);rail.material.transparent=true;rail.material.opacity=fade*Math.min(1,effects)*(still?.28:1-leave*.72);}
  const sweep=still?.5:spSmooth((t-2.9)/2.6);this.keyLight.position.x=-540+sweep*1100;this.keyLight.intensity=(650000+Math.sin(sweep*Math.PI)*450000)*(Number(this.options.shine)||1);this.gl.render(this.scene,this.camera);
 }
 render(time,{background=null}={}){
  if(this.disposed)return;time=Number(time)||0;this.time=time;const c=this.ctx,w=this.canvas.width,h=this.canvas.height;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,w,h);if(background&&!this.options.overlayOnly){c.save();c.scale(w/1080,h/1920);background(c,1080,1920,time);c.restore();}this.pose={seconds:time,style:'splice',title:this.titleText,words:this.titleWords.length,visibleWords:0,geometry:true,phase:'Clear',duration:SpliceDuration};if(time<0||time>=SpliceDuration)return;
  if(this.layoutKey!==[this.titleText,this.options.palette].join('|'))this.buildTitle();if(this.glSize!==w+':'+h){this.glSize=w+':'+h;this.gl.setPixelRatio(1);this.gl.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.accum.width=w;this.accum.height=h;}
  const still=this.options.reducedMotion||Number(this.options.motion)===0,blur=this.options.motionBlur!==false&&!still&&((time>.72&&time<3)||(time>6.02&&time<7.05)),samples=blur?[[-.032,.16],[-.016,.24],[0,.60]]:[[0,1]],a=this.accumCtx;a.clearRect(0,0,w,h);a.globalCompositeOperation='lighter';for(const [offset,alpha]of samples){this.step(Math.max(0,time+offset));a.globalAlpha=alpha;a.drawImage(this.glCanvas,0,0,w,h);}a.globalAlpha=1;a.globalCompositeOperation='source-over';c.save();c.beginPath();c.rect(w*62/1080,h*1135/1920,w*956/1080,h*655/1920);c.clip();c.shadowColor='#060a1475';c.shadowBlur=13*w/1080;c.shadowOffsetY=9*w/1080;c.drawImage(this.accum,0,0,w,h);c.restore();const visible=this.items.filter(i=>i.object.visible&&i.letters.some(l=>l.object.visible));this.pose={...this.pose,phase:still?'Hold':time<.28?'Opening':time<3.3?'Reveal':time<6.02?'Hold':'Exit',visibleWords:visible.length,displayText:visible.map(i=>i.word.text).join(' '),contextLost:this.contextLost,depth:this.options.depth,motionSamples:samples.length};
 }
 dispose(){for(const glyph of this.glyphs.values())for(const slice of glyph.slices||[])slice.dispose();super.dispose();this.scene.remove(this.keyLight,this.keyLight.target);this.accum.width=this.accum.height=1;}
}
