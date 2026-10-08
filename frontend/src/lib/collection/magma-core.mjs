import {captionRows} from './caption-layout.mjs';
/** Original magma-core geometry, materials and animation with a media-time adapter. */
import * as THREE from './three.mjs';
export function createArtwork(canvas,options={}){
 const settings={...{heat:1,depth:1,speed:1,particles:true},...options},reduced={matches:false},font="200px Bungee, Impact, sans-serif";
 let width=736,height=500,viewWidth=14.7,renderer=null,scene=null,camera=null;
 let segments=[],active=0,time=0,local=0,signature='';
 const glyphCache=new Map();
const letters=[];
const chunks=[];
const materials=[];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rng=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const random=rng(71713);
const wordGroup=new THREE.Group();
let sourceTarget;
let glowTarget;
let postScene;
let postCamera;
let postQuad;
let blurMaterial;
let finalMaterial;
let backgroundMaterial;
let smokeMaterial;
let shock;
let sparks;
let sparkData;
const noiseGLSL=`
    float hash(vec3 p){p=fract(p*.3183099+vec3(.13,.37,.79));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
    float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
        mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
    float fbm(vec3 p){return noise(p)*.57+noise(p*2.03)*.28+noise(p*4.11)*.12+noise(p*8.2)*.06;}
    vec2 hash2(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
    float cellEdge(vec2 p){vec2 n=floor(p),f=fract(p);float a=9.,b=9.;
      for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 r=g+.12+.76*hash2(n+g)-f;float d=dot(r,r);if(d<a){b=a;a=d;}else if(d<b)b=d;}
      return sqrt(b)-sqrt(a);}
  `;
const rockVertex=`
    attribute vec3 aPivot;attribute vec3 aScatter;attribute float aSpin;
    uniform float uBreak;varying vec3 vLocal;varying vec3 vNormal;varying vec3 vView;
    void main(){vec3 p=position-aPivot;float a=aSpin*uBreak;mat2 r=mat2(cos(a),-sin(a),sin(a),cos(a));p.xy=r*p.xy;
      p*=1.-.6*uBreak;p+=aPivot+aScatter*uBreak;vLocal=position;vNormal=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(p,1.);vView=-mv.xyz;gl_Position=projectionMatrix*mv;}
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
function fractureGeometry(shapes,depth,bevel){
    const geometry=new THREE.ExtrudeGeometry(shapes,{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:2,steps:1,curveSegments:1});
    const positions=geometry.attributes.position,pivot=new Float32Array(positions.count*3),scatter=new Float32Array(positions.count*3),spin=new Float32Array(positions.count);
    for(let i=0;i<positions.count;i+=3){
      const center=new THREE.Vector3();for(let j=0;j<3;j++)center.add(new THREE.Vector3().fromBufferAttribute(positions,i+j));center.multiplyScalar(1/3);
      const qx=Math.floor(center.x*6),qy=Math.floor(center.y*6),r=rng((qx+17)*173+(qy+61)*317);
      const dx=(r()-.5)*3,dy=(r()-.5)*2.8,dz=(r()-.5)*2.8,s=(r()-.5)*6;
      for(let j=0;j<3;j++){pivot.set([center.x,center.y,center.z],(i+j)*3);scatter.set([dx,dy,dz],(i+j)*3);spin[i+j]=s;}
    }
    geometry.setAttribute('aPivot',new THREE.BufferAttribute(pivot,3));geometry.setAttribute('aScatter',new THREE.BufferAttribute(scatter,3));geometry.setAttribute('aSpin',new THREE.BufferAttribute(spin,1));return geometry;
  }
function rockMaterial(seed,mode){
    const material=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uBreak:{value:0},uSeed:{value:seed},uHeat:{value:1},uMode:{value:mode},uOpacity:{value:1}},vertexShader:rockVertex,fragmentShader:`
      uniform float uTime,uSeed,uHeat,uMode,uOpacity;varying vec3 vLocal,vNormal,vView;
      ${noiseGLSL}
      void main(){vec3 p=vLocal+vec3(uSeed*.71,uSeed*.39,.1);float fine=noise(p*160.),rough=fbm(p*29.);
        vec2 warp=vec2(fbm(p*5.),fbm(p*5.+8.))*1.2;float edge=cellEdge(p.xy*10.5+warp);
        float vein=1.-smoothstep(.009,.042,edge),halo=1.-smoothstep(.02,.15,edge);
        float pulse=.78+.22*sin(uTime*2.6+fbm(p*4.)*9.+uSeed);float molten=vein*pulse*uHeat;
        vec3 n=normalize(vNormal+vec3((noise(p*70.+1.)-.5)*.16,(noise(p*70.+4.)-.5)*.16,0.));
        float light=max(dot(n,normalize(vec3(-.6,.8,1.))),0.);float rim=pow(1.-max(dot(n,normalize(vView)),0.),2.);
        float spec=pow(max(dot(n,normalize(normalize(vView)+normalize(vec3(-.5,.8,1.)))),0.),24.);
        vec3 rock=mix(vec3(.009,.013,.019),vec3(.075,.089,.108),rough)*(.35+light*.95);
        rock+=vec3(.10,.15,.21)*spec+vec3(.12,.055,.022)*rim+vec3((fine-.5)*.021);
        vec3 lava=mix(vec3(2.8,.085,.001),vec3(4.8,.52,.025),pow(vein,2.));
        vec3 color=rock+lava*molten+vec3(.24,.018,.001)*halo*uHeat;
        if(uMode>.5&&uMode<1.5)color=rock*.72+vec3(1.6,.12,.012)*vein*uHeat;
        if(uMode>1.5)color=mix(vec3(2.6,.065,.001),vec3(4.,.48,.018),rough)*uHeat;
        gl_FragColor=vec4(max(color,vec3(0.)),uOpacity);
      }`,transparent:true});materials.push(material);return material;
  }
function clearLetters(){
    letters.forEach(item=>{item.group.traverse(obj=>{if(obj.isMesh){obj.geometry.dispose();obj.material.dispose();}});wordGroup.remove(item.group);});letters.length=0;materials.length=0;
  }
function buildWords(){
    if(!renderer||active<0)return;clearLetters();
    const words=captionRows(segments[active].words,options.fontSize,'Bungee'),two=words.length>1;
    words.forEach((word,line)=>{
      const hero=!two||line===words.length-1,glyphs=[...word].map(char=>outline(char)),spacing=.045,total=glyphs.reduce((s,g)=>s+g.advance+spacing,0)-spacing;
      const scale=Math.min(Math.min(options.fontSize/736*viewWidth,5.8/words.length/1.5),viewWidth*.82/(total+.43));let x=-total*scale/2;
      glyphs.forEach((g,i)=>{
        if(!g.shapes.length){x+=(g.advance+spacing)*scale;return;}
        const group=new THREE.Group(),seed=word.codePointAt(i%word.length)*.071+i*1.73;
        const specs=[[-.30,.20,.02,1],[-.10,.12,.012,2],[.02,.16,.026,0]],mats=[];
        specs.forEach(([z,depth,bevel,mode])=>{const geo=fractureGeometry(g.shapes,depth,bevel),material=rockMaterial(seed,mode);const mesh=new THREE.Mesh(geo,material);mesh.position.z=z;group.add(mesh);mats.push(material);});
        group.scale.setScalar(scale);wordGroup.add(group);
        letters.push({group,mats,scale,x,y:((words.length-1)/2-line)*Math.min(options.fontSize/736*viewWidth*1.7,5.8/words.length)-.4,i,hero,seed});x+=(g.advance+spacing)*scale;
      });
    });
  }
function setup(){
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true,premultipliedAlpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(1);renderer.setClearColor(0,options.backdrop?1:0);
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(32,1,.1,80);camera.position.set(0,0,17);scene.add(wordGroup);
    sourceTarget=new THREE.WebGLRenderTarget(736,500,{type:THREE.HalfFloatType});glowTarget=new THREE.WebGLRenderTarget(368,250,{type:THREE.HalfFloatType});
    backgroundMaterial=new THREE.ShaderMaterial({depthWrite:false,uniforms:{uTime:{value:0},uHeat:{value:1},uImpact:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`
      varying vec2 vUv;uniform float uTime,uHeat,uImpact;${noiseGLSL}
      void main(){vec2 uv=vUv;vec3 p=vec3(uv*4.,uTime*.09);float smoke=fbm(p+vec3(0.,-uTime*.07,0.));
        float plume=exp(-pow((uv.x-.5)*2.2,2.))*exp(-pow((uv.y-.17)*2.2,2.));
        float rays=pow(max(0.,sin(atan(uv.x-.5,uv.y+.18)*22.+uTime*.06)),12.);
        vec3 color=vec3(.0009,.0008,.0016)+vec3(.004,.003,.004)*smoke;
        color+=vec3(.045,.003,.0002)*plume*(.25+smoke*.9)*uHeat;
        color+=vec3(.012,.004,.0004)*rays*(1.-uv.y)*(.2+smoke);
        color+=vec3(.065,.007,.0003)*uImpact*exp(-length((uv-vec2(.5,.4))*vec2(2.,3.)));
        gl_FragColor=vec4(color,1.);}`});
    const bg=new THREE.Mesh(new THREE.PlaneGeometry(80,60),backgroundMaterial);bg.position.z=-16;bg.renderOrder=-20;bg.visible=!!options.backdrop;scene.add(bg);
    smokeMaterial=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uHeat:{value:1}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:`varying vec2 vUv;varying vec3 vWorld;void main(){vUv=uv;vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
      fragmentShader:`varying vec2 vUv;varying vec3 vWorld;uniform float uTime,uHeat;${noiseGLSL}
        void main(){vec2 uv=vUv;float swirl=fbm(vec3(vWorld.xy*1.1+vec2(0.,-uTime*.2),uTime*.14));
          float curl=fbm(vec3(vWorld.xy*2.5+swirl*2.+vec2(0.,-uTime*.35),uTime*.11));
          float envelope=pow(max(0.,1.-abs(uv.x-.5)*2.),1.4)*smoothstep(0.,.18,uv.y)*(1.-smoothstep(.55,1.,uv.y));
          float density=smoothstep(.34,.67,curl)*envelope;
          float flame=pow(max(0.,1.-uv.y*1.65),3.)*smoothstep(.44,.70,swirl+curl*.15)*envelope;
          vec3 smoke=vec3(.17,.10,.08)*density;vec3 fire=mix(vec3(1.6,.025,.001),vec3(3.,.28,.009),curl)*flame;
          gl_FragColor=vec4(smoke+fire*uHeat,density*.28+flame*.55);}`});
    for(const x of[-3.8,0,3.8]){const plume=new THREE.Mesh(new THREE.PlaneGeometry(4.2,4.5),smokeMaterial);plume.position.set(x,-.8,-2.2);scene.add(plume);}
    const chunkGeo=new THREE.IcosahedronGeometry(.10,0),chunkMat=new THREE.MeshStandardMaterial({color:0x42434a,roughness:.9,metalness:.22,emissive:0x671a05,emissiveIntensity:.35,flatShading:true});
    for(let i=0;i<26;i++){const mesh=new THREE.Mesh(chunkGeo,chunkMat);mesh.userData={phase:random()*6.28,r:3.5+random()*2.7,y:(i%2?1:-1)*(1.6+random()*1.0),z:(random()-.5)*5,scale:.35+random()*1.4};scene.add(mesh);chunks.push(mesh);}
    scene.add(new THREE.HemisphereLight(0xb5c9ff,0xff460a,2));const light=new THREE.DirectionalLight(0xffd2a4,3);light.position.set(-4,6,5);scene.add(light);
    const point=new THREE.PointLight(0xff3a0b,28,12,2);point.position.set(0,-2,2);scene.add(point);
    shock=new THREE.Mesh(new THREE.RingGeometry(.97,1,100),new THREE.MeshBasicMaterial({color:new THREE.Color(3.5,.45,.04),transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));shock.position.set(0,-1.25,-1);scene.add(shock);
    const count=100,pos=new Float32Array(count*3),size=new Float32Array(count),alpha=new Float32Array(count);sparkData=[];
    for(let i=0;i<count;i++){sparkData.push({phase:random(),angle:random()*6.283,r:1+random()*5,height:.6+random()*4,z:random()*5-2,speed:.4+random()*.9});size[i]=1+random()*3;}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(pos,3));geometry.setAttribute('aSize',new THREE.BufferAttribute(size,1));geometry.setAttribute('aAlpha',new THREE.BufferAttribute(alpha,1));
    sparks=new THREE.Points(geometry,new THREE.ShaderMaterial({uniforms:{uRatio:{value:1}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexShader:`attribute float aSize,aAlpha;uniform float uRatio;varying float vAlpha;void main(){vAlpha=aAlpha;vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=aSize*uRatio*23./max(5.,-p.z);gl_Position=projectionMatrix*p;}`,fragmentShader:`varying float vAlpha;void main(){float d=length(gl_PointCoord-.5);float a=(1.-smoothstep(.04,.5,d))*vAlpha;gl_FragColor=vec4(mix(vec3(4.,.4,.02),vec3(4.,2.8,.8),1.-smoothstep(0.,.2,d)),a);}`}));scene.add(sparks);
    postScene=new THREE.Scene();postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);const postVertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
    blurMaterial=new THREE.ShaderMaterial({uniforms:{uScene:{value:sourceTarget.texture},uTexel:{value:new THREE.Vector2(1/736,1/500)}},vertexShader:postVertex,fragmentShader:`varying vec2 vUv;uniform sampler2D uScene;uniform vec2 uTexel;
      vec3 bright(vec2 uv){vec3 c=texture2D(uScene,uv).rgb;return c*max(0.,max(max(c.r,c.g),c.b)-.8)/max(max(max(c.r,c.g),c.b),.001);}
      void main(){vec3 c=vec3(0.);for(int i=-5;i<=5;i++){float k=float(i);c+=bright(vUv+vec2(k*3.,0.)*uTexel)*exp(-k*k*.12);}gl_FragColor=vec4(c*.205,1.);}`});
    finalMaterial=new THREE.ShaderMaterial({uniforms:{uScene:{value:sourceTarget.texture},uGlow:{value:glowTarget.texture},uTexel:{value:new THREE.Vector2(1/368,1/250)},uTime:{value:0},uHeat:{value:1},uStill:{value:0},uTransparent:{value:options.backdrop?0:1}},vertexShader:postVertex,fragmentShader:`
      varying vec2 vUv;uniform sampler2D uScene,uGlow;uniform vec2 uTexel;uniform float uTime,uHeat,uStill,uTransparent;
      vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
      void main(){vec2 uv=vUv;float heat=exp(-pow((uv.y-.35)*5.,2.));uv.x+=sin(uv.y*91.-uTime*2.)*.0011*heat*uHeat*(1.-uStill);
        vec3 base=texture2D(uScene,uv).rgb;vec3 glow=vec3(0.);for(int i=-5;i<=5;i++){float k=float(i);glow+=texture2D(uGlow,uv+vec2(0.,k*2.)*uTexel).rgb*exp(-k*k*.12);}
        vec3 c=aces(base*1.23+glow*.092*uHeat);c=pow(c,vec3(.4545));
        float grain=fract(sin(dot(vUv*1221.+floor(uTime*18.),vec2(12.9898,78.233)))*43758.5453)-.5;c+=grain*.017;
        c*=1.-.24*pow(length((vUv-.5)*1.3),2.);float coverage=texture2D(uScene,uv).a;float bloom=max(max(glow.r,glow.g),glow.b);float alpha=uTransparent<.5?1.:(coverage+bloom<.0001?0.:clamp(max(coverage,max(max(c.r,c.g),c.b)),0.,1.));gl_FragColor=vec4(uTransparent<.5?c:c/max(alpha,.001),alpha);}`});
    postQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),finalMaterial);postScene.add(postQuad);resize();
  }
function renderScene(){
    const still=reduced.matches,t=still?1.8:time,exit=still?0:clamp((local-3.23)/.57,0,1);
    const impact=still?0:Math.exp(-Math.max(local-.67,0)*6)*(local>.67?1:0);
    backgroundMaterial.uniforms.uTime.value=t;backgroundMaterial.uniforms.uHeat.value=settings.heat;backgroundMaterial.uniforms.uImpact.value=impact;
    smokeMaterial.uniforms.uTime.value=t;smokeMaterial.uniforms.uHeat.value=settings.heat;
    wordGroup.rotation.set(.10+Math.sin(t*.5)*.025,-.19+Math.sin(t*.6)*.075,-.025);
    wordGroup.position.x=still?0:Math.sin(local*81)*impact*.045;wordGroup.position.y=still?0:Math.cos(local*97)*impact*.035;
    letters.forEach(item=>{
      const age=local-Math.min(item.i*.055,.55)-(item.hero?.08:0),p=still?1:clamp(age/.93,0,1);
      const ease=p===1?1:1-Math.pow(2,-9*p)*Math.cos(p*7.2),fracture=(1-p)**2+exit**2;
      item.group.position.set(item.x+(1-p)*Math.sin(item.seed)*1.4,item.y+(1-ease)*2.4+exit*(Math.sin(item.seed)*2),exit*3);
      item.group.rotation.set((1-p)*.7+exit*.6,(1-p)*Math.sin(item.seed)*1.7+exit*1.1,(1-p)*Math.cos(item.seed)*.75);
      item.group.scale.set(item.scale,item.scale,item.scale*settings.depth);
      item.mats.forEach(material=>{material.uniforms.uTime.value=t;material.uniforms.uBreak.value=fracture;material.uniforms.uHeat.value=settings.heat;material.uniforms.uOpacity.value=still?1:clamp(age*5,0,1)*(1-exit);});
    });
    shock.visible=false;const shockAge=clamp(local-.65,0,1);shock.scale.setScalar(.45+shockAge*6);shock.material.opacity=(1-shockAge)*.22;
    const positions=sparks.geometry.attributes.position.array,alpha=sparks.geometry.attributes.aAlpha.array;
    sparkData.forEach((p,i)=>{const age=(t*p.speed*.2+p.phase)%1,burst=impact*1.3;positions[i*3]=Math.cos(p.angle)*(p.r*.55+age*.6+burst);positions[i*3+1]=-2.2+age*p.height+burst*Math.sin(p.angle);positions[i*3+2]=p.z;alpha[i]=Math.sin(age*Math.PI)*(.3+impact*.7);});
    sparks.geometry.attributes.position.needsUpdate=true;sparks.geometry.attributes.aAlpha.needsUpdate=true;sparks.visible=settings.particles;
    chunks.forEach((mesh,i)=>{const p=mesh.userData;mesh.visible=settings.particles;mesh.position.set(Math.cos(p.phase+t*.10)*p.r*(viewWidth/14.7),p.y+Math.sin(t*.25+p.phase)*.22,p.z);
      mesh.rotation.set(t*.2+p.phase,t*.3+p.phase,t*.13);const s=p.scale*(1+impact*.15);mesh.scale.setScalar(s);});
    finalMaterial.uniforms.uTime.value=t;finalMaterial.uniforms.uHeat.value=settings.heat;finalMaterial.uniforms.uStill.value=still?1:0;
    renderer.setRenderTarget(sourceTarget);renderer.render(scene,camera);postQuad.material=blurMaterial;renderer.setRenderTarget(glowTarget);renderer.render(postScene,postCamera);
    postQuad.material=finalMaterial;renderer.setRenderTarget(null);renderer.render(postScene,postCamera);
  }
 function resize(w=736,h=500){width=w;height=h;if(!renderer)return;
  camera.aspect=width/height;camera.updateProjectionMatrix();viewWidth=2*17*Math.tan(16*Math.PI/180)*camera.aspect;
  renderer.setSize(width,height,false);sourceTarget.setSize(width,height);glowTarget.setSize(Math.max(1,Math.round(width/2)),Math.max(1,Math.round(height/2)));
  blurMaterial.uniforms.uTexel.value.set(1/width,1/height);finalMaterial.uniforms.uTexel.value.set(2/width,2/height);
  sparks.material.uniforms.uRatio.value=1;
 }
 setup();
 return {canvas,renderer,aspect:736/500,span:3.8,resize,
  render(words,seconds,_timings,groupIndex=0){active=groupIndex;const key=JSON.stringify([words,groupIndex]);if(key!==signature){signature=key;segments=[];segments[groupIndex]={words,cue:0};buildWords();}time=seconds+groupIndex*3.8;local=seconds;renderScene();},
  dispose(){clearLetters();glyphCache.clear();scene.traverse(obj=>{obj.geometry?.dispose();if(obj.material)(Array.isArray(obj.material)?obj.material:[obj.material]).forEach(m=>m.dispose());});sourceTarget.dispose();glowTarget.dispose();blurMaterial.dispose();finalMaterial.dispose();postQuad.geometry.dispose();renderer.dispose();renderer.forceContextLoss();}
 };
}
