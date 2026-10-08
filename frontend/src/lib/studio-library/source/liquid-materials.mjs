export function createLiquidMaterials(THREE,renderer,sourceTexture){
 const studio=new THREE.Scene();studio.background=new THREE.Color('#070a16');const panels=[];
 for(const [w,h,x,y,z,c,intensity]of [[2.4,9,-5,4,7,'#ffffff',3.8],[9,1.2,0,7,5,'#ffffff',4.2],[1.5,7,6,1,6,'#91e6ff',3.0],[7,2,0,-5,5,'#b08aff',2.0],[.55,8,-1.5,1,8,'#ffffff',4.5]]){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(c).multiplyScalar(intensity),side:THREE.DoubleSide,toneMapped:false}));mesh.position.set(x,y,z);mesh.lookAt(0,0,0);studio.add(mesh);panels.push(mesh);}
 const generator=new THREE.PMREMGenerator(renderer),environment=generator.fromScene(studio,.025,.1,80);generator.dispose();panels.forEach(m=>{m.geometry.dispose();m.material.dispose();});
 const shared={uLiquidTime:{value:0},uLiquidDetail:{value:1},uLiquidPower:{value:1},uLiquidStill:{value:0},uLiquidViewport:{value:new THREE.Vector2(760,500)}};
 function make(cfg,p,index,hero=false){
  const uniforms={...shared,uLiquidA:{value:new THREE.Color(hero?p.hero:p.a)},uLiquidB:{value:new THREE.Color(hero?p.heroB:p.b)},uLiquidPulse:{value:0},uLiquidHero:{value:+hero}};
  const face=new THREE.MeshPhysicalMaterial({color:'#ffffff',metalness:hero?.24:.40,roughness:.27,clearcoat:1,clearcoatRoughness:.20,envMap:environment.texture,envMapIntensity:.85,iridescence:.08,iridescenceIOR:1.34,iridescenceThicknessRange:[180,380]});
  const bevel=new THREE.MeshPhysicalMaterial({color:hero?p.heroB:p.edge,metalness:.90,roughness:.20,clearcoat:1,envMap:environment.texture,envMapIntensity:1.1});
  const side=new THREE.MeshPhysicalMaterial({color:p.side,metalness:.60,roughness:.22,clearcoat:1,clearcoatRoughness:.11,envMap:environment.texture,envMapIntensity:.75,iridescence:.35,iridescenceThicknessRange:[150,480]});
  const outline=new THREE.MeshBasicMaterial({color:p.ink}),echo=side.clone();
  for(const [mat,type]of [[face,'face'],[side,'side']]){
   mat.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);shader.vertexShader='varying vec3 vLiquidLocal;varying vec3 vLiquidWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvLiquidLocal=position;vLiquidWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=`varying vec3 vLiquidLocal;varying vec3 vLiquidWorld;uniform float uLiquidTime,uLiquidDetail,uLiquidPower,uLiquidStill,uLiquidPulse,uLiquidHero;uniform vec3 uLiquidA,uLiquidB;
float liquidHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
`+shader.fragmentShader;
    if(type==='face'){
     shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float liquidT=uLiquidTime*(1.-uLiquidStill);float flow=.5+.5*sin(vLiquidWorld.x*.6+vLiquidLocal.y*2.7+sin(vLiquidLocal.x*.9-liquidT*.22)*.7);vec3 pigment=mix(uLiquidA,uLiquidB,smoothstep(.1,.9,flow)*.60);float fine=liquidHash(floor(vLiquidLocal.xy*160.));pigment*=1.-fine*.022*uLiquidDetail;diffuseColor.rgb*=pigment;`);
     shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+sin(vLiquidLocal.x*3.+vLiquidLocal.y*1.7)*.012*uLiquidDetail,.07,.35);');
     shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`float sweep=exp(-pow((vLiquidWorld.x+vLiquidWorld.y*.35-7.*sin(liquidT*.40))/.36,2.));float hi=smoothstep(.8,3.2,max(outgoingLight.r,max(outgoingLight.g,outgoingLight.b)));outgoingLight*=mix(pigment,vec3(1.),.20+hi*.57);outgoingLight+=pigment*.055+vec3(.12,.13,.15)*sweep*uLiquidPower*(1.-uLiquidStill)+pigment*uLiquidPulse*.10;
#include <opaque_fragment>`);
    }else shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat grooves=.5+.5*sin(vLiquidLocal.z*36.);diffuseColor.rgb*=1.-grooves*.075*uLiquidDetail;');
   };mat.customProgramCacheKey=()=>`liquid-impact-v1-${type}`;
  }
  return {face,bevel,side,outline,echo,uniforms,all:[face,bevel,side,outline,echo],dispose(){this.all.forEach(m=>m.dispose());}};
 }
 return{make,shared,env:environment.texture,update(time,{still=false,detail=1,power=1,width=760,height=500}={}){shared.uLiquidTime.value=time;shared.uLiquidDetail.value=detail;shared.uLiquidPower.value=power;shared.uLiquidStill.value=+still;shared.uLiquidViewport.value.set(width,height);},dispose(){environment.dispose();}};
}
