/** JUICE JAM — procedural glossy candy finishes and graphic surface patterns. */
import { HyperPalettes } from './hyper-palettes.mjs';
export function createJuiceMaterials(THREE,renderer){
  const room=new THREE.Scene();room.background=new THREE.Color('#263051');const cards=[];
  for(const [w,h,x,y,z,color,strength]of [[7,12,-7,4,7,'#fff6dc',3.1],[3,12,7,1,6,'#d4fbff',2.8],[13,4,0,9,3,'#ffffff',3.5],[1.3,10,-1,0,8,'#ffffff',4.5],[8,5,0,-7,4,'#a97fff',1.6]]){
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(strength),side:THREE.DoubleSide,toneMapped:false}));m.position.set(x,y,z);m.lookAt(0,0,0);room.add(m);cards.push(m);}
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.03,.1,100);pmrem.dispose();cards.forEach(m=>{m.geometry.dispose();m.material.dispose();});
  const uniforms={uHyperTime:{value:0},uHyperStill:{value:0},uHyperPhase:{value:.5},uHyperWidth:{value:6},uHyperPower:{value:1},uHyperA:{value:new THREE.Color('#ff3eaa')},uHyperB:{value:new THREE.Color('#ffbb29')},uHyperC:{value:new THREE.Color('#45ffe6')},uHyperD:{value:new THREE.Color('#7651ff')}};
  const make=(color,metalness,roughness)=>new THREE.MeshPhysicalMaterial({color,metalness,roughness,clearcoat:1,clearcoatRoughness:.11,envMap:environment.texture,envMapIntensity:.85});
  const face=make('#ffffff',.11,.22),bevel=make('#c9fcff',.44,.17),side=make('#541780',.28,.25),ink=make('#19112f',.12,.30),pink=make('#ff3a96',.05,.23),cyan=make('#4cfbea',.07,.22),orange=make('#ffb13d',.07,.22);
  function install(material,type){material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);shader.vertexShader='varying vec3 vHyperLocal;varying vec3 vHyperWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvHyperLocal=position;vHyperWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=`varying vec3 vHyperLocal;varying vec3 vHyperWorld;uniform float uHyperTime,uHyperStill,uHyperPhase,uHyperWidth,uHyperPower;uniform vec3 uHyperA,uHyperB,uHyperC,uHyperD;\n`+shader.fragmentShader;
    if(type==='face'){
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(normal+vec3(sin(vHyperLocal.x*3.0)*.16,sin(vHyperLocal.y*2.6)*.13,0.));');
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float t=uHyperTime*(1.-uHyperStill);float gradient=.5+.5*sin(vHyperWorld.x*.35+vHyperLocal.y*2.1+t*.18);
        vec3 candy=mix(uHyperA,uHyperB,smoothstep(.03,.56,gradient));candy=mix(candy,uHyperC,smoothstep(.55,.90,gradient));
        float ribbon=.5+.5*sin(vHyperLocal.y*8.+vHyperLocal.x*5.+sin(vHyperLocal.x*6.+t*.55)*1.2+t*.32);
        float stripe=smoothstep(.78,.85,ribbon);candy=mix(candy,uHyperD,stripe*.37);
        vec2 dotCell=fract(vHyperLocal.xy*10.0)-.5;float dotRadius=length(dotCell);float dots=1.-smoothstep(.105,.145,dotRadius);
        float dotPatch=smoothstep(.55,.90,.5+.5*sin(vHyperLocal.x*4.5+vHyperLocal.y*2.4));candy=mix(candy,vec3(1.,.96,.84),dots*dotPatch*.28);
        diffuseColor.rgb*=candy*1.16;`);
    }
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`${type==='face'?`float hyperHighlight=smoothstep(1.4,3.7,max(outgoingLight.r,max(outgoingLight.g,outgoingLight.b)));outgoingLight*=mix(candy,vec3(1.),hyperHighlight*.42);`:''}
      float scanX=(uHyperPhase-.5)*uHyperWidth*1.8;float dist=(vHyperWorld.x+vHyperWorld.y*.27-scanX)/(uHyperWidth*.046+.045);float scan=exp(-dist*dist);
      outgoingLight+=${type==='face'?'vec3(.34,.52,.46)*scan*.30':'vec3(.10,.56,.60)*scan*.42'}*uHyperPower*(1.-uHyperStill);
      #include <opaque_fragment>`);
  };material.customProgramCacheKey=()=>`juice-jam-v1-${type}`;}
  install(face,'face');install(bevel,'bevel');install(side,'side');
  return{face,bevel,side,ink,pink,cyan,orange,environment:environment.texture,update(time,{still=false,phase=.5,extent=6,power=1,palette='mango'}={}){
    uniforms.uHyperTime.value=time;uniforms.uHyperStill.value=+still;uniforms.uHyperPhase.value=phase;uniforms.uHyperWidth.value=Math.max(.25,extent);uniforms.uHyperPower.value=power;const colors=(HyperPalettes[palette]||HyperPalettes.candy).colors;['A','B','C','D'].forEach((key,i)=>uniforms['uHyper'+key].value.set(colors[i]));pink.color.set(colors[0]);cyan.color.set(colors[2]);orange.color.set(colors[1]);
  },dispose(){[face,bevel,side,ink,pink,cyan,orange].forEach(m=>m.dispose());environment.dispose();}};
}
