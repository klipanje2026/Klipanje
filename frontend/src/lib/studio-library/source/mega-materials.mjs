export function createMegaMaterials(THREE,renderer,sourceTexture){
 const room=new THREE.Scene();room.background=new THREE.Color('#24305a');const cards=[];
 for(const [w,h,x,y,z,color,power]of [[8,12,-6,4,7,'#fff3fc',2.1],[3,10,7,0,5,'#bbf9ff',2.0],[13,3,0,8,3,'#ffffff',2.8],[1,9,-1,0,8,'#ffffff',3.1],[9,3,0,-7,4,'#e2a2ff',1.2]]){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(power),side:THREE.DoubleSide,toneMapped:false}));mesh.position.set(x,y,z);mesh.lookAt(0,0,0);room.add(mesh);cards.push(mesh);}
 const pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(room,.04,.1,70);pmrem.dispose();cards.forEach(m=>{m.geometry.dispose();m.material.dispose();});
 const shared={uMegaTime:{value:0},uMegaDetail:{value:1},uMegaPower:{value:1},uMegaStill:{value:0},uMegaSource:{value:sourceTexture},uMegaViewport:{value:new THREE.Vector2(760,475)}};
 function make(cfg,p,index){
  const uniforms={...shared,uMegaA:{value:new THREE.Color(p.colors[index%3])},uMegaB:{value:new THREE.Color(p.colors[(index+1)%3])},uMegaC:{value:new THREE.Color(p.accent)},uMegaPulse:{value:0}};
  const face=new THREE.MeshPhysicalMaterial({color:'#ffffff',metalness:cfg.metal,roughness:cfg.rough,clearcoat:1,clearcoatRoughness:cfg.font==='acid'?.30:.12,envMap:env.texture,envMapIntensity:cfg.font==='holo'?.90:.72});
  const bevel=new THREE.MeshPhysicalMaterial({color:p.edge,metalness:.56,roughness:.19,clearcoat:1,envMap:env.texture,envMapIntensity:.8});
  const side=new THREE.MeshPhysicalMaterial({color:p.side,metalness:cfg.font==='holo'?.65:.20,roughness:.30,clearcoat:.85,envMap:env.texture,envMapIntensity:.55});
  const outline=new THREE.MeshBasicMaterial({color:p.ink,toneMapped:false}),echo=new THREE.MeshPhysicalMaterial({color:p.accent,metalness:.15,roughness:.23,clearcoat:1,envMap:env.texture,envMapIntensity:.5});
  for(const [material,type]of [[face,'face'],[side,'side']]){
   material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);shader.vertexShader='varying vec3 vMegaLocal;varying vec3 vMegaWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvMegaLocal=position;vMegaWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=`varying vec3 vMegaLocal;varying vec3 vMegaWorld;uniform float uMegaTime,uMegaDetail,uMegaPower,uMegaStill,uMegaPulse;uniform vec3 uMegaA,uMegaB,uMegaC;uniform sampler2D uMegaSource;uniform vec2 uMegaViewport;
float megaHash(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}
float megaDot(vec2 q,float r){float d=length(fract(q)-.5);return 1.-smoothstep(r-fwidth(d),r+fwidth(d),d);}
`+shader.fragmentShader;
    if(type==='face'){
     const patterns={
      gloss:`float ribbon=.5+.5*sin(vMegaLocal.y*5.+vMegaLocal.x*.40+time*.65);paint=mix(uMegaA,uMegaB,smoothstep(.2,.85,ribbon)*.62);float sugar=megaHash(floor(vMegaLocal.xy*120.));paint+=vec3(smoothstep(.992,1.,sugar))*.12*uMegaDetail;paint=mix(paint,uMegaC,pow(max(0.,sin(vMegaLocal.x*1.3+vMegaLocal.y*1.1-time*.20)),18.)*.24*uMegaDetail);`,
      pixel:`float grid=megaDot(vMegaLocal.xy*13.,.10);float scan=1.-smoothstep(.03,.11,abs(fract(vMegaLocal.y*12.)-.5));paint=mix(uMegaA,uMegaB,smoothstep(.15,.8,vMegaLocal.y+.5)*.38);paint*=1.-scan*.16*uMegaDetail;paint=mix(paint,uMegaC,grid*.26*uMegaDetail);float circuit=step(.83,fract(vMegaLocal.x*3.+floor(vMegaLocal.y*6.)*.37));paint+=uMegaA*circuit*.08*uMegaDetail;`,
      acid:`float dots=megaDot(vMegaLocal.xy*10.,.13);float print=step(.55,megaHash(floor(vMegaLocal.xy*90.)));paint=mix(uMegaA,uMegaB,smoothstep(.12,.90,.5+.5*sin(vMegaLocal.x*.7+vMegaLocal.y*1.8))*.18);paint=mix(paint,uMegaC,dots*.35*uMegaDetail);paint*=1.-print*.04*uMegaDetail;`,
      jelly:`float swirl=.5+.5*sin(vMegaLocal.x*1.6+vMegaLocal.y*4.5-time*.42);paint=mix(uMegaA,uMegaB,swirl*.35);vec2 uv=gl_FragCoord.xy/uMegaViewport+vec2(sin(vMegaLocal.x*2.1),cos(vMegaLocal.y*2.3))*.004+vec2(sin(vMegaLocal.y*5.+time*.5),cos(vMegaLocal.x*3.-time*.3))*.002;vec3 frosted=vec3(0.);for(int j=0;j<9;j++){float a=float(j)*2.39996;vec2 offset=vec2(cos(a),sin(a))*sqrt(float(j))*2.8/uMegaViewport;frosted+=pow(texture2D(uMegaSource,uv+offset).rgb,vec3(2.2))/9.;}paint=mix(paint,frosted*.45+paint*.72,.26*uMegaDetail);float bubble=megaDot(vMegaLocal.xy*6.,.10);paint+=vec3(bubble)*.15*uMegaDetail;`,
      holo:`float foil=.5+.5*sin(vMegaLocal.x*1.1+vMegaLocal.y*6.5+time*.45);paint=mix(uMegaA,uMegaB,smoothstep(.08,.72,foil)*.73);paint=mix(paint,uMegaC,smoothstep(.81,.98,foil)*.24);float fine=pow(.5+.5*sin((vMegaLocal.x+vMegaLocal.y)*74.),14.);paint+=vec3(fine)*.09*uMegaDetail;paint=mix(paint,uMegaB,megaDot(vMegaLocal.xy*19.,.07)*.16*uMegaDetail);`
     };
     shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
normal=normalize(normal+vec3(sin(vMegaLocal.x*2.1)*${cfg.font==='jelly'?'.16':'.07'},sin(vMegaLocal.y*3.4)*.075,0.));`);
     shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float time=uMegaTime*(1.-uMegaStill);vec3 paint=uMegaA;${patterns[cfg.font]}paint=mix(paint,uMegaC,uMegaPulse*.18);diffuseColor.rgb*=paint*1.10;`);
     shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`float sweep=exp(-pow((vMegaWorld.x-vMegaWorld.y*.44-5.4*sin(time*.34))/.23,2.));outgoingLight=outgoingLight*mix(paint,vec3(1.),.18)*.32+paint*.58;outgoingLight+=vec3(1.,.94,1.)*sweep*.23*uMegaPower*(1.-uMegaStill);#include <opaque_fragment>` .replace(';#include',';\n#include'));
    }else shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat grooves=.5+.5*sin(vMegaLocal.z*70.);diffuseColor.rgb*=1.-grooves*.14*uMegaDetail;');
   };material.customProgramCacheKey=()=>`mega-5-v1-${cfg.font}-${type}`;
  }
  return {face,bevel,side,outline,echo,uniforms,all:[face,bevel,side,outline,echo],dispose(){this.all.forEach(m=>m.dispose());}};
 }
 return {make,shared,env:env.texture,update(time,{detail=1,power=1,still=false,width=760,height=475}={}){shared.uMegaTime.value=time;shared.uMegaDetail.value=detail;shared.uMegaPower.value=power;shared.uMegaStill.value=+still;shared.uMegaViewport.value.set(width,height);},dispose(){env.dispose();}};
}

