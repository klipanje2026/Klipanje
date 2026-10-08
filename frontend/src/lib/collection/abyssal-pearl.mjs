import {captionRows} from './caption-layout.mjs';
/** Original abyssal-pearl geometry, materials and animation with a media-time adapter. */
import * as THREE from './three.mjs';
export function createArtwork(canvas,options={}){
 const settings={...{shine:1,depth:1.35,speed:1,bubbles:true},...options},reduced={matches:false},font="200px \"Dela Gothic One\", sans-serif";
 let width=736,height=500,viewWidth=14.7,renderer=null,scene=null,camera=null;
 let segments=[],active=0,time=0,local=0,signature='';
 const glyphCache=new Map();
const letters=[];
const bubbles=[];

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rng=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const random=rng(97834);
const wordGroup=new THREE.Group();
const pointer={x:0,y:0};
let sourceTarget;
let glowTarget;
let postScene;
let postCamera;
let postQuad;
let blurMaterial;
let finalMaterial;
let bgMaterial;
let waterMaterial;
let bubbleMaterial;
let dust;
let dustData;
const noiseGLSL=`
    float hash(vec3 p){p=fract(p*.3183099+vec3(.13,.37,.79));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
    float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
        mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
    float fbm(vec3 p){return noise(p)*.57+noise(p*2.03)*.28+noise(p*4.11)*.12+noise(p*8.2)*.06;}
  `;
const surfaceVertex=`
    uniform float uTime,uStill;varying vec3 vLocal,vNormal,vView;
    void main(){vLocal=position;vec3 p=position;
      p.z+=sin(p.x*6.+p.y*3.+uTime*.8)*.008*(1.-uStill);
      vec4 mv=modelViewMatrix*vec4(p,1.);vNormal=normalize(normalMatrix*normal);vView=-mv.xyz;gl_Position=projectionMatrix*mv;}
  `;
 function simplify(points,tolerance=.7){
    if(points.length<4)return points;
    const a=points[0],b=points.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],denom=dx*dx+dy*dy;
    let max=0,index=0;
    for(let i=1;i<points.length-1;i++){
      const p=points[i],t=denom?clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/denom,0,1):0;
      const distance=(p[0]-a[0]-dx*t)**2+(p[1]-a[1]-dy*t)**2;
      if(distance>max){max=distance;index=i;}
    }
    if(max>tolerance*tolerance){return simplify(points.slice(0,index+1),tolerance).slice(0,-1).concat(simplify(points.slice(index),tolerance));}
    return[a,b];
  }
function signedArea(points){let a=0;for(let i=0,j=points.length-1;i<points.length;j=i++)a+=points[j][0]*points[i][1]-points[i][0]*points[j][1];return a*.5;}
function contains(points,p){let hit=false;for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i],b=points[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }return hit;}
function outline(char){
    if(glyphCache.has(char))return glyphCache.get(char);
    const mask=document.createElement('canvas'),m=mask.getContext('2d',{willReadFrequently:true});m.font=font;
    const advance=m.measureText(char).width;mask.width=Math.ceil(advance+44);mask.height=300;
    m.font=font;m.fillStyle='#fff';m.fillText(char,20,238);
    const w=mask.width,h=mask.height,data=m.getImageData(0,0,w,h).data,edges=new Map();
    const on=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&data[(y*w+x)*4+3]>127;
    const add=(x,y,xx,yy)=>{const key=x+','+y;if(!edges.has(key))edges.set(key,[]);edges.get(key).push([xx,yy]);};
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)if(on(x,y)){
      if(!on(x,y-1))add(x,y,x+1,y);if(!on(x+1,y))add(x+1,y,x+1,y+1);
      if(!on(x,y+1))add(x+1,y+1,x,y+1);if(!on(x-1,y))add(x,y+1,x,y);
    }
    const contours=[];
    while(edges.size){
      const first=edges.keys().next().value,start=first.split(',').map(Number),points=[start];let at=first;
      for(let n=0;n<10000;n++){
        const next=edges.get(at);if(!next?.length)break;const p=next.pop();if(!next.length)edges.delete(at);points.push(p);at=p.join(',');if(at===first)break;
      }
      if(points.length>5){const poly=simplify(points).slice(0,-1).map(([x,y])=>[(x-20)/200,(238-y)/200]);if(poly.length>=3&&Math.abs(signedArea(poly))>.0001)contours.push(poly);}
    }
    const outer=contours.filter(p=>signedArea(p)<0),holes=contours.filter(p=>signedArea(p)>0);
    const shapes=outer.map(p=>{const s=new THREE.Shape(p.map(([x,y])=>new THREE.Vector2(x,y)));s.closePath();return s;});
    holes.forEach(p=>{const parent=outer.findIndex(o=>contains(o,p[0]));if(parent>=0){const hole=new THREE.Path(p.map(([x,y])=>new THREE.Vector2(x,y)));hole.closePath();shapes[parent].holes.push(hole);}});
    const glyph={shapes,advance:advance/200};glyphCache.set(char,glyph);return glyph;
  }
function nacreMaterial(seed,layer){return new THREE.ShaderMaterial({transparent:true,uniforms:{uTime:{value:0},uStill:{value:0},uSeed:{value:seed},uLayer:{value:layer},uShine:{value:1},uOpacity:{value:1}},vertexShader:surfaceVertex,fragmentShader:`
    uniform float uTime,uSeed,uLayer,uShine,uOpacity;varying vec3 vLocal,vNormal,vView;
    ${noiseGLSL}
    vec3 spectrum(float t){return .5+.5*cos(6.28318*(vec3(.08,.36,.64)+t));}
    void main(){vec3 p=vLocal+vec3(uSeed*.23,uSeed*.41,.0);float curl=fbm(p*5.3);
      float phase=p.y*62.+curl*17.+sin(p.x*10.+curl)*2.;float ridge=.5+.5*sin(phase);
      float fine=noise(p*190.);vec3 n=normalize(vNormal+vec3(cos(phase)*.012+(noise(p*6.+2.)-.5)*.055,sin(phase)*.028+(noise(p*6.+5.)-.5)*.07,0.));vec3 view=normalize(vView);
      float diffuse=max(dot(n,normalize(vec3(-.65,.78,1.))),0.);float fresnel=pow(1.-max(dot(n,view),0.),2.7);
      float spec=pow(max(dot(n,normalize(view+normalize(vec3(-.7,.9,1.3)))),0.),34.);
      float angle=dot(n,view);vec3 irid=spectrum(angle*.38+curl*.32+p.x*.14+p.y*.25+uTime*.025);
      vec3 base=mix(vec3(.08,.12,.17),vec3(.62,.66,.70),.32+diffuse*.48);
      base*=mix(vec3(.72,.90,1.),vec3(1.,.73,.93),curl);base*=.94+ridge*.06;
      vec3 color=base*(.85+irid*.38)+vec3(.003,.009,.014)*ridge;
      color+=mix(vec3(.11,.63,.83),vec3(.47,.06,.72),curl)*fresnel*.9;
      color+=vec3(.65,.84,.99)*spec*uShine*.75;
      float sweep=exp(-pow((vLocal.x+vLocal.y*.22-fract(uTime*.17+uSeed*.1)*1.5+.30)*13.,2.));
      color+=vec3(.38,.65,.78)*sweep*uShine*(.3+diffuse*.5);
      float thread=pow(max(0.,sin(p.y*29.+curl*12.+uTime*.5)),24.);
      if(uLayer>.5&&uLayer<1.5)color=mix(vec3(.015,.17,.3),vec3(.06,.85,1.6),thread)*(.55+diffuse*.5);
      if(uLayer>1.5&&uLayer<2.5)color=mix(vec3(.1,.025,.19),vec3(.63,.065,1.2),thread)*(.6+diffuse*.5);
      if(uLayer>2.5&&uLayer<3.5)color=color*.45+vec3(.02,.12,.19)*thread;
      if(uLayer>3.5)color+=vec3(.01,.12,.19)*thread*.40;
      color+=vec3((fine-.5)*.009);gl_FragColor=vec4(max(color,vec3(0.)),uOpacity);
    }`});}
function clearLetters(){
    letters.forEach(item=>{item.group.traverse(obj=>{if(obj.isMesh){obj.geometry.dispose();obj.material.dispose();}});wordGroup.remove(item.group);});letters.length=0;
  }
function buildWords(){
    if(!renderer||active<0)return;clearLetters();const words=captionRows(segments[active].words,options.fontSize,'Arial'),two=words.length>1;
    words.forEach((word,line)=>{
      const hero=!two||line===words.length-1,glyphs=[...word].map(char=>outline(char)),spacing=.018,total=glyphs.reduce((s,g)=>s+g.advance+spacing,0)-spacing;
      const scale=Math.min(Math.min(options.fontSize/736*viewWidth,5.8/words.length/1.5),viewWidth*.82/(total+.47));let x=-total*scale/2;
      glyphs.forEach((g,i)=>{
        if(!g.shapes.length){x+=(g.advance+spacing)*scale;return;}
        const group=new THREE.Group(),seed=word.codePointAt(i%word.length)*.031+i*.73,layers=[];
        const specs=[[-.29,.12,.023],[-.17,.10,.022],[-.07,.10,.022],[.03,.13,.031],[.16,.12,.036]];
        specs.forEach(([z,depth,bevel],layer)=>{
          const geometry=new THREE.ExtrudeGeometry(g.shapes,{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:3,steps:1,curveSegments:1});
          const material=nacreMaterial(seed,layer),mesh=new THREE.Mesh(geometry,material);mesh.position.z=z;group.add(mesh);layers.push({mesh,z,material,layer});
        });
        wordGroup.add(group);letters.push({group,layers,scale,x,y:((words.length-1)/2-line)*Math.min(options.fontSize/736*viewWidth*1.7,5.8/words.length)-.4,i,hero,seed});x+=(g.advance+spacing)*scale;
      });
    });
  }
function setup(){
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true,premultipliedAlpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(1);renderer.setClearColor(0,options.backdrop?1:0);
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(32,1,.1,80);camera.position.set(0,0,17);scene.add(wordGroup);
    sourceTarget=new THREE.WebGLRenderTarget(736,500,{type:THREE.HalfFloatType});glowTarget=new THREE.WebGLRenderTarget(368,250,{type:THREE.HalfFloatType});
    const screenVertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,.99999,1.);}`;
    bgMaterial=new THREE.ShaderMaterial({depthWrite:false,uniforms:{uTime:{value:0}},vertexShader:screenVertex,fragmentShader:`varying vec2 vUv;uniform float uTime;${noiseGLSL}
      void main(){vec2 uv=vUv;float haze=fbm(vec3(uv*4.,uTime*.04));
        float ray1=exp(-pow((uv.x-.27-(1.-uv.y)*.21)*23.,2.));float ray2=exp(-pow((uv.x-.50+(1.-uv.y)*.07)*38.,2.));float ray3=exp(-pow((uv.x-.68-(1.-uv.y)*.12)*28.,2.));
        float rays=(ray1*.7+ray2*.35+ray3*.45)*(.7+haze*.6)*pow(uv.y,.8);
        vec3 color=vec3(.0015,.004,.013)+vec3(.001,.007,.012)*haze+vec3(.006,.045,.06)*rays;
        float aurora=exp(-length((uv-vec2(.76,.4))*vec2(2.7,1.8)));color+=vec3(.013,.002,.022)*aurora;
        color+=vec3(.001,.021,.02)*exp(-pow((uv.y-.10)*7.,2.));gl_FragColor=vec4(color,1.);}`});
    const bg=new THREE.Mesh(new THREE.PlaneGeometry(2,2),bgMaterial);bg.frustumCulled=false;bg.renderOrder=-20;bg.visible=!!options.backdrop;scene.add(bg);
    waterMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:{value:0},uPulse:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`
      varying vec2 vUv;uniform float uTime,uPulse;${noiseGLSL}
      void main(){vec2 p=(vUv-.5)*vec2(2.,1.5);float r=length(p),n=fbm(vec3(p*6.,uTime*.12));
        float bands=pow(max(0.,sin(r*78.-uTime*1.9+n*2.)),18.);float contour=pow(max(0.,sin(n*26.+r*12.)),22.);
        float alpha=exp(-r*3.)*(1.-smoothstep(.6,1.5,r));vec3 color=vec3(.008,.055,.067)*(bands*.6+contour*.5);
        color+=vec3(.04,.25,.3)*exp(-pow((r-uPulse)*35.,2.))*(1.-min(uPulse,1.));gl_FragColor=vec4(color,alpha*.75);}`});
    const water=new THREE.Mesh(new THREE.PlaneGeometry(18,9),waterMaterial);water.rotation.x=-1.18;water.position.set(0,-2.75,-1.7);scene.add(water);
    bubbleMaterial=new THREE.ShaderMaterial({uniforms:{uTime:{value:0}},transparent:true,depthWrite:false,vertexShader:`varying vec3 vNormal,vView;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=-mv.xyz;gl_Position=projectionMatrix*mv;}`,fragmentShader:`
      uniform float uTime;varying vec3 vNormal,vView;void main(){vec3 n=normalize(vNormal),v=normalize(vView);float fresnel=pow(1.-max(dot(n,v),0.),2.5);
        float spec=pow(max(dot(n,normalize(vec3(-.65,.75,1.))),0.),60.);vec3 tint=.5+.5*cos(6.28318*(vec3(.1,.42,.68)+n.y*.18+uTime*.016));
        vec3 c=mix(vec3(.015,.06,.13),tint*.8,fresnel)+vec3(1.,1.2,1.4)*spec;gl_FragColor=vec4(c,.06+fresnel*.66+spec*.4);}`});
    const bubbleGeometry=new THREE.SphereGeometry(1,20,12);
    for(let i=0;i<24;i++){const mesh=new THREE.Mesh(bubbleGeometry,bubbleMaterial);mesh.userData={x:random()*2-1,y:random(),z:random()*5-2.5,r:.045+random()*.13,phase:random()*6.283,speed:.025+random()*.045};scene.add(mesh);bubbles.push(mesh);}
    const count=125,positions=new Float32Array(count*3),sizes=new Float32Array(count),alphas=new Float32Array(count);dustData=[];
    for(let i=0;i<count;i++){dustData.push({x:random()*2-1,y:random(),z:random()*7-4,phase:random()*6.283,speed:.02+random()*.025});sizes[i]=.8+random()*2;}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));geometry.setAttribute('aAlpha',new THREE.BufferAttribute(alphas,1));
    dust=new THREE.Points(geometry,new THREE.ShaderMaterial({uniforms:{uRatio:{value:1}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:`attribute float aSize,aAlpha;uniform float uRatio;varying float vAlpha;void main(){vAlpha=aAlpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=aSize*uRatio*20./max(5.,-mv.z);gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`varying float vAlpha;void main(){float d=length(gl_PointCoord-.5);float a=(1.-smoothstep(.03,.5,d))*vAlpha;gl_FragColor=vec4(.23,1.1,1.3,a);}`}));scene.add(dust);
    postScene=new THREE.Scene();postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);const postVertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
    blurMaterial=new THREE.ShaderMaterial({uniforms:{uScene:{value:sourceTarget.texture},uTexel:{value:new THREE.Vector2(1/736,1/500)}},vertexShader:postVertex,fragmentShader:`varying vec2 vUv;uniform sampler2D uScene;uniform vec2 uTexel;
      vec3 bright(vec2 uv){vec3 c=texture2D(uScene,uv).rgb;float b=max(max(c.r,c.g),c.b);return c*max(0.,b-.72)/max(b,.001);}
      void main(){vec3 c=vec3(0.);for(int i=-5;i<=5;i++){float k=float(i);c+=bright(vUv+vec2(k*2.6,0.)*uTexel)*exp(-k*k*.13);}gl_FragColor=vec4(c*.215,1.);}`});
    finalMaterial=new THREE.ShaderMaterial({uniforms:{uScene:{value:sourceTarget.texture},uGlow:{value:glowTarget.texture},uTexel:{value:new THREE.Vector2(1/368,1/250)},uTime:{value:0},uShine:{value:1},uStill:{value:0},uTransparent:{value:options.backdrop?0:1}},vertexShader:postVertex,fragmentShader:`
      varying vec2 vUv;uniform sampler2D uScene,uGlow;uniform vec2 uTexel;uniform float uTime,uShine,uStill,uTransparent;
      vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
      void main(){vec2 uv=vUv;uv.x+=sin(uv.y*33.+uTime*.85)*.00025*(1.-uStill);vec3 base=texture2D(uScene,uv).rgb;
        if(uv.y<.285){vec2 reflectUv=vec2(uv.x+sin(uv.y*80.+uTime)*.003,.57-uv.y);
          vec3 reflected=texture2D(uScene,reflectUv).rgb*.5+texture2D(uScene,reflectUv+vec2(.004,0.)).rgb*.25+texture2D(uScene,reflectUv-vec2(.004,0.)).rgb*.25;
          base+=reflected*.19*pow(uv.y/.285,2.)*(1.-smoothstep(.26,.285,uv.y));}
        vec3 glow=vec3(0.);for(int i=-5;i<=5;i++){float k=float(i);glow+=texture2D(uGlow,uv+vec2(0.,k*2.3)*uTexel).rgb*exp(-k*k*.13);}
        vec3 c=pow(aces(base*1.14+glow*.068*uShine),vec3(.4545));float grain=fract(sin(dot(vUv*1221.+floor(uTime*12.),vec2(12.9898,78.233)))*43758.5453)-.5;c+=grain*.009;
        c*=1.-.2*pow(length((vUv-.5)*1.4),2.);float coverage=texture2D(uScene,uv).a;float bloom=max(max(glow.r,glow.g),glow.b);float alpha=uTransparent<.5?1.:(coverage+bloom<.0001?0.:clamp(max(coverage,max(max(c.r,c.g),c.b)),0.,1.));gl_FragColor=vec4(uTransparent<.5?c:c/max(alpha,.001),alpha);}`});
    postQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),finalMaterial);postScene.add(postQuad);resize();
  }
function renderScene(){
    const still=reduced.matches,t=still?1.8:time,exit=still?0:clamp((local-3.58)/.62,0,1);
    bgMaterial.uniforms.uTime.value=t;waterMaterial.uniforms.uTime.value=t;waterMaterial.uniforms.uPulse.value=still?.5:clamp((local-.75)*.45,0,1.3);bubbleMaterial.uniforms.uTime.value=t;
    wordGroup.rotation.set(.06+Math.sin(t*.43)*.018*(settings.power??1)+pointer.y*.055,-.18+Math.sin(t*.51)*.055*(settings.power??1)+pointer.x*.09,.018);
    wordGroup.position.y=still?0:Math.sin(t*.7)*.035;
    letters.forEach(item=>{
      const age=local-item.i*.048-(item.hero?.10:0),p=still?1:clamp(age/1.05,0,1),ease=1-(1-p)**3;
      item.group.position.set(item.x+(1-ease)*Math.cos(item.seed)*.65,item.y+(1-ease)*Math.sin(item.seed)*.7+exit*.4,(1-ease)*-2.5+exit*4);
      item.group.rotation.set((1-ease)*-.3,(1-ease)*.55+exit*.7,(1-ease)*Math.sin(item.seed)*.25);
      item.group.scale.set(item.scale,item.scale,item.scale*settings.depth);
      item.layers.forEach(({mesh,z,material,layer})=>{
        const delay=layer*.025,q=still?1:clamp((age-delay)/.90,0,1),open=(1-q)**2+exit**2;
        mesh.position.set(Math.sin(item.seed+layer*.8)*open*.30,Math.cos(item.seed+layer*.7)*open*.17,z+(layer-2)*open*.47);
        mesh.rotation.z=Math.sin(item.seed+layer)*open*.18;material.uniforms.uTime.value=t;material.uniforms.uStill.value=still?1:0;
        material.uniforms.uShine.value=settings.shine;material.uniforms.uOpacity.value=still?1:clamp((age-delay)*5,0,1)*(1-exit);
      });
    });
    bubbles.forEach(mesh=>{const p=mesh.userData,age=(p.y+t*p.speed)%1;mesh.visible=settings.bubbles;
      mesh.position.set(p.x*viewWidth*.46+Math.sin(t*.4+p.phase)*.15,-3.8+age*7.6,p.z);mesh.scale.setScalar(p.r*(.9+Math.sin(t+p.phase)*.08));});
    const positions=dust.geometry.attributes.position.array,alphas=dust.geometry.attributes.aAlpha.array;
    dustData.forEach((p,i)=>{const age=(p.y+t*p.speed)%1;positions[i*3]=p.x*viewWidth*.50+Math.sin(t*.2+p.phase)*.08;positions[i*3+1]=-4+age*8;positions[i*3+2]=p.z;alphas[i]=Math.sin(age*Math.PI)*(.10+.22*(.5+.5*Math.sin(t*.7+p.phase)));});
    dust.geometry.attributes.position.needsUpdate=true;dust.geometry.attributes.aAlpha.needsUpdate=true;
    finalMaterial.uniforms.uTime.value=t;finalMaterial.uniforms.uShine.value=settings.shine;finalMaterial.uniforms.uStill.value=still?1:0;
    renderer.setRenderTarget(sourceTarget);renderer.render(scene,camera);postQuad.material=blurMaterial;renderer.setRenderTarget(glowTarget);renderer.render(postScene,postCamera);
    postQuad.material=finalMaterial;renderer.setRenderTarget(null);renderer.render(postScene,postCamera);
  }
 function resize(w=736,h=500){width=w;height=h;if(!renderer)return;
  camera.aspect=width/height;camera.updateProjectionMatrix();viewWidth=2*17*Math.tan(16*Math.PI/180)*camera.aspect;
  renderer.setSize(width,height,false);sourceTarget.setSize(width,height);glowTarget.setSize(Math.max(1,Math.round(width/2)),Math.max(1,Math.round(height/2)));
  blurMaterial.uniforms.uTexel.value.set(1/width,1/height);finalMaterial.uniforms.uTexel.value.set(2/width,2/height);
  dust.material.uniforms.uRatio.value=1;
 }
 setup();
 return {canvas,renderer,aspect:736/500,span:4.2,resize,
  render(words,seconds,_timings,groupIndex=0){active=groupIndex;const key=JSON.stringify([words,groupIndex]);if(key!==signature){signature=key;segments=[];segments[groupIndex]={words,cue:0};buildWords();}time=seconds+groupIndex*4.2;local=seconds;renderScene();},
  dispose(){clearLetters();glyphCache.clear();scene.traverse(obj=>{obj.geometry?.dispose();if(obj.material)(Array.isArray(obj.material)?obj.material:[obj.material]).forEach(m=>m.dispose());});sourceTarget.dispose();glowTarget.dispose();blurMaterial.dispose();finalMaterial.dispose();postQuad.geometry.dispose();renderer.dispose();renderer.forceContextLoss();}
 };
}
