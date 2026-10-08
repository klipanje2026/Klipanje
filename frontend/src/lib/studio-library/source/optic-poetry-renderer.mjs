import * as THREE from '../../collection/three.mjs';
import {LustreCaptionRenderer} from './lustre-renderer.mjs';
import {OpticPoetryFont,OpticPoetrySupportFont} from './optic-poetry-font.mjs';
import {OpticPoetryPalettes,OpticPoetryDuration,OpticPoetryText} from './optic-poetry-config.mjs';
import {buildOpticPoetryGlyph} from './optic-poetry-geometry.mjs';
import {createOpticPoetryMaterials} from './optic-poetry-materials.mjs';
const opClamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n)),opEase=n=>1-(1-opClamp(n))**4,opSmooth=n=>{n=opClamp(n);return n*n*(3-2*n);};
function opticalBand(radius,angle){const shape=new THREE.Shape(),inner=radius-8,outer=radius+5;shape.moveTo(outer,0);shape.absarc(0,0,outer,0,angle,false);shape.lineTo(inner*Math.cos(angle),inner*Math.sin(angle));shape.absarc(0,0,inner,angle,0,true);shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:8,bevelEnabled:true,bevelThickness:.6,bevelSize:.6,bevelSegments:4,curveSegments:48});g.translate(0,0,-4);return g;}
export class OpticPoetryRenderer extends LustreCaptionRenderer{
 constructor(canvas,options={}){
  super(canvas,{...options,style:'lustre-cut'});this.options={scale:1,depth:1,shine:1,texture:.45,motion:1,effects:1,palette:0,motionBlur:true,...options};this.finishes.dispose();this.finishes=createOpticPoetryMaterials(THREE,this.gl);this.scene.remove(this.text);this.rig=new THREE.Group();this.rig.add(this.text);this.scene.add(this.rig);this.decor=[];this.decorGeometry=[];this.decorMaterials=[];this.accum=document.createElement('canvas');this.accumCtx=this.accum.getContext('2d',{alpha:true});this.gl.toneMappingExposure=1.10;
  for(const light of this.scene.children)if(light.isLight)light.intensity=light.isHemisphereLight?.45:.65;
  this.keyLight=new THREE.SpotLight('#dffff8',800000,2400,.36,.8,2);this.keyLight.position.set(-400,-170,850);this.keyLight.target.position.set(0,-480,0);this.scene.add(this.keyLight,this.keyLight.target);this.setText(options.text||OpticPoetryText);
 }
 setOptions(options){this.options={...this.options,...options};return this;}
 setText(text){const words=String(text||'').trim().split(/\s+/u).filter(Boolean);if(words.length<1||words.length>8)throw new RangeError('Use 1–8 words.');this.titleWords=words;this.titleText=words.join(' ');this.layoutKey='';return this;}
 glyph(char,support=false){const key=(support?'support:':'hero:')+char;if(this.glyphs.has(key))return this.glyphs.get(key);const font=support?OpticPoetrySupportFont:OpticPoetryFont,src=font.glyphs[char]||font.glyphs['?'],result={geometry:buildOpticPoetryGlyph(src,font.capHeight,support),advance:src.advance/font.capHeight};this.glyphs.set(key,result);return result;}
 word(text,support=false,spacing=.015){const key=[support,text,spacing].join('|');if(this.words.has(key))return this.words.get(key);let cursor=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;const letters=[];for(const char of text){const glyph=this.glyph(char,support);if(glyph.geometry){const b=glyph.geometry.boundingBox;minX=Math.min(minX,cursor+b.min.x);maxX=Math.max(maxX,cursor+b.max.x);minY=Math.min(minY,b.min.y);maxY=Math.max(maxY,b.max.y);letters.push({geometry:glyph.geometry,x:cursor,index:letters.length});}cursor+=glyph.advance+spacing;}const result={letters,minX,minY,maxY,width:maxX-minX,height:maxY-minY};this.words.set(key,result);return result;}
 clear(){super.clear();for(const obj of this.decor)this.rig?.remove(obj);for(const g of this.decorGeometry)g.dispose();for(const m of this.decorMaterials)m.dispose();this.decor=[];this.decorGeometry=[];this.decorMaterials=[];}
 buildTitle(){
  this.clear();const p=OpticPoetryPalettes[opClamp(Math.round(this.options.palette)||0,0,3)],words=this.titleWords,n=words.length,counts=n>=6?[n-6,1,4,1]:n===5?[1,1,2,1]:n===4?[1,1,1,1]:n===3?[0,1,1,1]:n===2?[0,1,0,1]:[0,1,0,0],sizes=[32,195,32,65],ys=[1208,1287,1524,1611];let at=0;
  for(let row=0;row<4;row++){
   const chosen=words.slice(at,at+counts[row]);at+=counts[row];if(!chosen.length)continue;
   const entries=chosen.map((text,i)=>({text,index:at-chosen.length+i,label:row===1?text.toLocaleLowerCase('en'):text.toLocaleUpperCase('en'),data:this.word(row===1?text.toLocaleLowerCase('en'):text.toLocaleUpperCase('en'),row!==1,row===0?.18:row===2?.12:.015)}));
   let size=sizes[row],gap=row===3?22:24,width=entries.reduce((sum,w)=>sum+w.data.width*size,0)+gap*(entries.length-1),limit=row===1?860:row===3?800:760;if(width>limit){const k=limit/width;size*=k;gap*=k;width=limit;}let x=row===2?970-width:row===0?122:row===1?100:146;
   for(const word of entries){word.row=row;word.size=size;word.width=word.data.width*size;word.height=word.data.height*size;word.x=x;word.y=ys[row];word.start=[.42,.90,1.95,2.42][row]+(word.index-(at-chosen.length))*.09;const finish=this.finishes.make(p,row===1),object=new THREE.Group(),letters=[];this.text.add(object);
    for(const letter of word.data.letters){const group=new THREE.Group(),mesh=new THREE.Mesh(letter.geometry,[finish.face,finish.bevel,finish.side]),rim=new THREE.Mesh(letter.geometry,finish.rim);rim.scale.set(1.007,1.007,.04);rim.position.z=-.205;group.add(rim,mesh);object.add(group);letters.push({...letter,object:group,rim});}
    this.items.push({word,object,letters,finish,decorGeometry:[]});x+=word.width+gap;
   }
  }
  this.lens=new THREE.Group();this.lens.position.set(285,-457,-220);this.rig.add(this.lens);this.decor.push(this.lens);this.rings=[];
  for(let i=0;i<3;i++){const g=i===1?opticalBand(186,Math.PI*1.42):new THREE.TorusGeometry(163+i*23,1.2,8,160,Math.PI*1.65),m=this.finishes.physical(i===1?p.second:p.edge,{metalness:.30,roughness:.14,transparent:true,opacity:i===1?.36:.36}),ring=new THREE.Mesh(g,m);ring.rotation.z=i*.9;this.lens.add(ring);this.rings.push(ring);this.decorGeometry.push(g);this.decorMaterials.push(m);}
  this.points=[];const pointMaterial=new THREE.MeshBasicMaterial({color:p.edge,transparent:true,opacity:.7,toneMapped:false});this.decorMaterials.push(pointMaterial);
  for(let i=0;i<3;i++){const g=new THREE.SphereGeometry(i===0?3:1.5,12,8),dot=new THREE.Mesh(g,pointMaterial);dot.position.set(-426+i*12,-631,-6);this.rig.add(dot);this.points.push(dot);this.decor.push(dot);this.decorGeometry.push(g);}
  this.layoutKey=[this.titleText,this.options.palette].join('|');
 }
 step(time){
  const motion=this.options.reducedMotion?0:opClamp(Number(this.options.motion)||0,0,1.5),still=this.options.reducedMotion||motion===0,t=still?4:time,exit=still||this.options.spokenEntry?0:opSmooth((t-5.95)/1),depth=opClamp(Number(this.options.depth)||1,.3,1.5),effects=opClamp(Number(this.options.effects)||0,0,1.4),scale=opClamp(Number(this.options.scale)||1,.8,1.1);
  this.rig.scale.setScalar(scale);this.rig.position.y=still?0:-exit*20*motion;
  for(const item of this.items){const w=item.word,hero=w.row===1,age=t-(this.options.spokenEntry?(this.wordTimings?.[w.index]?.start??0):w.start),reveal=still?1:opEase(age/(this.options.spokenEntry?.20:hero?1.7:.70)),opacity=still?1:opSmooth(age/.25)*(this.options.spokenEntry?1:1-opSmooth((t-6.12-w.row*.02)/.75));item.object.visible=age>0&&opacity>0;
   item.object.position.set(w.x+w.width/2-540,960-w.y-w.height/2,0);item.object.rotation.set(hero?-.12:0,hero?.20:0,hero?-.035:0);item.object.scale.set(w.size,w.size,w.size*depth);item.finish.update(t,this.options,still);item.finish.uniforms.base.value=w.x-540-36;item.finish.uniforms.width.value=w.width+72;item.finish.uniforms.progress.value=still?1.12:1.12*reveal*(1-exit)-exit*.08;
   for(const m of item.finish.all){m.transparent=true;m.opacity=opacity*(m===item.finish.side&&hero?.80:m===item.finish.rim?.65:1);}
   for(const letter of item.letters){const lag=hero?.065:.018,cq=still?1:opClamp((age-(this.options.spokenEntry?0:letter.index*lag))/(this.options.spokenEntry?.20:hero?.9:.55)),settle=1-opEase(cq);letter.object.visible=cq>0;letter.object.position.set(letter.x-w.data.minX-w.data.width/2+settle*.18*motion,-w.data.height/2-w.data.minY-settle*(hero?.22:.12)*motion+exit*.12*motion,settle*.14*motion-exit*.35*motion);letter.object.rotation.set(0,settle*(hero?.65:.22)*motion-exit*.3*motion,0);letter.rim.visible=hero&&effects>0;letter.rim.material.opacity=opacity*.65*Math.min(1,effects);}
  }
  const open=still?1:opEase((t-.16)/1.5),alpha=still?1:opSmooth((t-.12)/.6)*(1-opSmooth((t-6.18)/.82)),flow=still?0:opSmooth((t-2.8)/2.9);
  this.lens.visible=effects>0&&alpha>0;this.lens.scale.set(.12+.88*open*(1-exit*.88),.63*(.4+.6*open),1);this.lens.rotation.set(-.30,.62+(1-open)*1.2*motion+exit*.95*motion,.17+flow*.12*motion);
  for(let i=0;i<this.rings.length;i++){const ring=this.rings[i];ring.rotation.z=i*.9+(1-open)*(i%2?-1.9:1.5)*motion+flow*(i%2?-.16:.20)*motion+exit*.7;ring.material.opacity=alpha*(i===1?.36:.32)*Math.min(1,effects);ring.material.envMapIntensity=(Number(this.options.shine)||1)*1.2;}
  for(const dot of this.points){dot.visible=effects>0&&alpha>0;dot.material.opacity=alpha*.7*Math.min(1,effects);}
  const sweep=still?.55:opSmooth((t-2.5)/2.8);this.keyLight.position.x=-520+sweep*1050;this.keyLight.intensity=(650000+Math.sin(sweep*Math.PI)*450000)*(Number(this.options.shine)||1);this.gl.render(this.scene,this.camera);
 }
 render(time,{background=null}={}){
  if(this.disposed)return;time=Number(time)||0;this.time=time;const c=this.ctx,w=this.canvas.width,h=this.canvas.height;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,w,h);if(background&&!this.options.overlayOnly){c.save();c.scale(w/1080,h/1920);background(c,1080,1920,time);c.restore();}
  this.pose={seconds:time,style:'optic-poetry',title:this.titleText,words:this.titleWords.length,visibleWords:0,geometry:true,phase:'Clear',duration:OpticPoetryDuration};if(time<0||time>=OpticPoetryDuration)return;
  if(this.layoutKey!==[this.titleText,this.options.palette].join('|'))this.buildTitle();if(this.glSize!==w+':'+h){this.glSize=w+':'+h;this.gl.setPixelRatio(1);this.gl.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.accum.width=w;this.accum.height=h;}
  const still=this.options.reducedMotion||Number(this.options.motion)===0,blur=this.options.motionBlur!==false&&!still&&((time>.85&&time<2.7)||(time>5.95&&time<6.95)),samples=blur?[[-.032,.16],[-.016,.24],[0,.60]]:[[0,1]],a=this.accumCtx;a.clearRect(0,0,w,h);a.globalCompositeOperation='lighter';for(const [offset,alpha]of samples){this.step(Math.max(0,time+offset));a.globalAlpha=alpha;a.drawImage(this.glCanvas,0,0,w,h);}a.globalAlpha=1;a.globalCompositeOperation='source-over';
  c.save();c.beginPath();c.rect(w*62/1080,h*1135/1920,w*956/1080,h*655/1920);c.clip();c.shadowColor='#02091670';c.shadowBlur=17*w/1080;c.shadowOffsetY=9*w/1080;c.drawImage(this.accum,0,0,w,h);c.restore();const visible=this.items.filter(i=>i.object.visible&&i.letters.some(l=>l.object.visible));this.pose={...this.pose,phase:still?'Hold':time<.42?'Opening':time<3.3?'Reveal':time<5.95?'Hold':'Exit',visibleWords:visible.length,displayText:visible.map(i=>i.word.text).join(' '),contextLost:this.contextLost,depth:this.options.depth,motionSamples:samples.length};
 }
 dispose(){super.dispose();this.scene.remove(this.keyLight,this.keyLight.target);this.accum.width=this.accum.height=1;}
}
