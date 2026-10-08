/** Procedural, time-addressable effects for REALITY RIFT. No image assets. */
export function createRiftEffects(THREE) {
  const group = new THREE.Group();
  group.name = 'Reality Rift · dimensional field';
  const resources = [];
  let viewWidth = 13, viewHeight = 8.8;
  const uniforms = {
    uTime: { value: 0 }, uLocal: { value: 0 }, uAlpha: { value: 1 },
    uRx: { value: 4.4 }, uRy: { value: 1.94 }, uY: { value: 0.12 },
    uEnergy: { value: 1 }, uWave: { value: 0 }, uWaveAlpha: { value: 0 }
  };
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const noiseGLSL = `
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
    vec3 spectrum(float t){
      vec3 lime=vec3(.65,.94,.025),cyan=vec3(.035,.83,1.),violet=vec3(.56,.13,1.);
      return mix(mix(lime,cyan,smoothstep(.05,.55,t)),violet,smoothstep(.53,.99,t));
    }
  `;
  function mesh(geometry, material, name) {
    const m = new THREE.Mesh(geometry, material);
    m.name = name; m.frustumCulled = false; m.renderOrder = -5;
    resources.push(geometry, material); group.add(m); return m;
  }
  function parametricGrid(along, across) {
    const positions = new Float32Array((along + 1) * (across + 1) * 3);
    const uvs = new Float32Array((along + 1) * (across + 1) * 2);
    const indices = [];
    for (let i = 0; i <= along; i++) for (let j = 0; j <= across; j++) {
      const k = i * (across + 1) + j;
      uvs[k * 2] = i / along; uvs[k * 2 + 1] = j / across;
    }
    for (let i = 0; i < along; i++) for (let j = 0; j < across; j++) {
      const a = i * (across + 1) + j, b = a + across + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.setIndex(indices); return g;
  }
  const portalVertex = `
    uniform float uTime,uRx,uRy,uY,uOffset,uRadius,uTube;
    varying vec2 vUv; varying vec3 vNormal; varying float vAngle;
    void main(){
      vUv=uv; float a=uv.x*6.28318530718;
      float b=uv.y*6.28318530718 + a*3. + uTime*.32 + uOffset;
      float fold=.045*sin(a*7.+uTime*.85+uOffset)+.025*sin(a*13.-uTime*.58);
      vec2 n=normalize(vec2(cos(a)/uRx,sin(a)/uRy));
      float thick=uTube*(.76+.24*sin(a*3.+uOffset));
      vec3 p=vec3(cos(a)*(uRx*uRadius+fold),sin(a)*(uRy*uRadius+fold)+uY,-1.72);
      p.xy+=n*cos(b)*thick;
      p.z+=sin(b)*thick+.19*sin(a*2.+uOffset);
      vNormal=normalize(normalMatrix*vec3(n*cos(b),sin(b)));
      vAngle=a; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
    }
  `;
  const portalFragment = `
    uniform float uTime,uAlpha,uEnergy,uOffset;
    varying vec2 vUv; varying vec3 vNormal; varying float vAngle;
    ${noiseGLSL}
    void main(){
      float flow=fract(vUv.x-uTime*.039+uOffset*.074);
      float grooves=.5+.5*sin(vUv.y*188.+noise(vec2(vUv.x*42.,vUv.y*8.))*6.);
      float grain=noise(vec2(vUv.x*360.,vUv.y*82.));
      float t=.5+.5*sin(vAngle*1.3-uTime*.33+uOffset);
      vec3 base=spectrum(t);
      vec3 n=normalize(vNormal);
      float light=.25+.48*max(0.,dot(n,normalize(vec3(-.38,.55,.9))));
      float shine=pow(max(0.,dot(n,normalize(vec3(-.3,.72,1.)))),21.);
      float pulse=pow(max(0.,sin((flow-.25)*6.2831853)),11.);
      vec3 color=base*light*(.85+.15*grooves)+vec3(.53,.85,.79)*shine*.68;
      color+=base*pulse*.54*uEnergy;
      color*=.92+.12*grain;
      float gap=smoothstep(.045,.095,.5+.5*sin(vAngle*2.+uOffset));
      gl_FragColor=vec4(color,uAlpha*(.76+.15*pulse)*gap);
    }
  `;
  for (let i = 0; i < 2; i++) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uOffset: { value: i * 2.1 }, uRadius: { value: i ? .925 : 1 }, uTube: { value: i ? .065 : .15 } },
      vertexShader: portalVertex, fragmentShader: portalFragment,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false
    });
    mesh(parametricGrid(224, 12), mat, i ? 'Portal · inner torn coil' : 'Portal · twisted dimensional rim');
  }
  const ribbonVertex = `
    uniform float uTime,uRx,uRy,uY,uOffset,uRadius;
    varying vec2 vUv; varying vec3 vNormal; varying float vAngle;
    void main(){
      vUv=uv; float a=uv.x*6.2831853+uOffset+uTime*.105;
      float w=(uv.y-.5)*(.095+.13*pow(.5+.5*sin(a*2.+uOffset),2.));
      float twist=a*2.2+uTime*.42+uOffset;
      vec2 radial=normalize(vec2(cos(a)/uRx,sin(a)/uRy));
      vec3 p=vec3(cos(a)*uRx*uRadius,sin(a)*uRy*uRadius+uY,-1.49);
      p.xy+=radial*w*cos(twist);
      p.z+=.22*sin(a*3.+uOffset)+w*sin(twist);
      p.y+=.13*sin(a*4.+uOffset+uTime*.31);
      vNormal=normalize(normalMatrix*vec3(radial*sin(twist),cos(twist)));
      vAngle=a; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
    }
  `;
  const ribbonFragment = `
    uniform float uTime,uAlpha,uOffset,uEnergy;
    varying vec2 vUv; varying vec3 vNormal; varying float vAngle;
    ${noiseGLSL}
    void main(){
      float edge=pow(abs(vUv.y-.5)*2.,9.);
      float thread=pow(.5+.5*sin(vUv.y*110.+vUv.x*43.),14.);
      float strand=smoothstep(.13,.23,.5+.5*sin(vUv.x*6.2831853-uTime*.13+uOffset));
      float spec=pow(max(0.,dot(normalize(vNormal),normalize(vec3(-.2,.65,1.)))),22.);
      vec3 tint=spectrum(.5+.5*sin(vAngle+uOffset));
      vec3 color=tint*(.20+.48*edge+.18*thread)+vec3(.61,.83,.8)*spec*.55;
      color+=tint*pow(max(0.,sin(vAngle-uTime*.95)),16.)*.5*uEnergy;
      gl_FragColor=vec4(color,uAlpha*strand*(.56+.32*edge));
    }
  `;
  for (let i = 0; i < 3; i++) {
    mesh(parametricGrid(192, 6), new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uOffset: { value: i * 2.094 }, uRadius: { value: 1.07 + i * .035 } },
      vertexShader: ribbonVertex, fragmentShader: ribbonFragment,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false
    }), `Field · braided plasma ribbon ${i + 1}`);
  }
  // The thin shockwave is tied to the caption assembly, not wall-clock time.
  const wave = mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `uniform float uRx,uRy,uY,uWave;varying vec2 vUv;
      void main(){vUv=uv;vec3 p=position;float s=.82+uWave*.66;p.xy*=vec2(uRx,uRy)*s;p.y+=uY;p.z=-2.15;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `${noiseGLSL} uniform float uTime,uWaveAlpha;varying vec2 vUv;
      void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float ringDistance=(r-.91)*130.;float ring=exp(-ringDistance*ringDistance);
      float wakeDistance=(r-.89)*28.;float wake=exp(-wakeDistance*wakeDistance)*.16;float a=atan(p.y,p.x);
      vec3 c=spectrum(.5+.5*sin(a+uTime*.23));gl_FragColor=vec4(c,(ring+wake)*uWaveAlpha);}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
  }), 'Field · assembly shockwave');
  wave.renderOrder = -6;
  // Fixed seed buffers let seeking produce exactly the same moving streaks.
  const count = 112, tails = 6;
  const positions = new Float32Array(count * (tails + 1) * 2 * 3);
  const seeds = new Float32Array(count * (tails + 1) * 2 * 4);
  const uv = new Float32Array(count * (tails + 1) * 2 * 2);
  const indices = [];
  let seedState = 912731;
  const random = () => { seedState = (1664525 * seedState + 1013904223) >>> 0; return seedState / 4294967296; };
  for (let i = 0; i < count; i++) {
    const seed = [random(), random(), random(), random()];
    for (let j = 0; j <= tails; j++) for (let k = 0; k < 2; k++) {
      const n = i * (tails + 1) * 2 + j * 2 + k;
      seeds.set(seed, n * 4); uv[n * 2] = j / tails; uv[n * 2 + 1] = k;
    }
    for (let j = 0; j < tails; j++) {
      const a = i * (tails + 1) * 2 + j * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const streakGeometry = new THREE.BufferGeometry();
  streakGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  streakGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  streakGeometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  streakGeometry.setIndex(indices);
  mesh(streakGeometry, new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      attribute vec4 aSeed;uniform float uTime,uRx,uRy,uY,uEnergy;varying vec2 vUv;varying vec4 vSeed;varying float vLife;
      void main(){vUv=uv;vSeed=aSeed;
        float speed=.10+aSeed.z*.14;float life=fract(aSeed.y+uTime*speed);vLife=life;
        float head=aSeed.x*6.2831853+life*1.9;float a=head-uv.x*(.018+.074*aSeed.z);
        float radius=1.0+(life*life)*(.25+.4*aSeed.w);
        float thickness=(uv.y-.5)*(.010+.012*aSeed.w)*(1.-uv.x*.82);
        vec2 n=normalize(vec2(cos(a)/uRx,sin(a)/uRy));
        vec3 p=vec3(cos(a)*uRx*radius,sin(a)*uRy*radius+uY,-1.2-aSeed.w*.7);
        p.xy+=n*thickness;p.z+=sin(a*2.+aSeed.x*6.)*.25;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,
    fragmentShader: `${noiseGLSL} uniform float uAlpha,uEnergy;varying vec2 vUv;varying vec4 vSeed;varying float vLife;
      void main(){float edge=max(0.,1.-abs(vUv.y-.5)*2.);float tail=pow(max(0.,1.-clamp(vUv.x,0.,1.)),1.9);
        float fade=smoothstep(0.,.10,vLife)*(1.-smoothstep(.65,1.,vLife));
        float a=edge*tail*fade*uAlpha*(.4+.45*uEnergy);
        vec3 c=spectrum(vSeed.x);gl_FragColor=vec4(c,a);}`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, toneMapped: false
  }), 'Field · spatial streaks');
  function resize(width, height) {
    viewWidth = Number.isFinite(width) && width > 0 ? width : 13;
    viewHeight = Number.isFinite(height) && height > 0 ? height : 8.8;
  }
  function update(time, { local = 1.7, span = 4, still = false, extent = 7.5, heroY = -.9, intensity = 1 } = {}) {
    const elapsed = still ? 1.7 : Math.max(0, Number(local) || 0);
    const flowTime = still ? .7 : (Number(time) || 0);
    const width = typeof extent === 'number' ? extent : (extent && Number(extent.width)) || 7.5;
    const energy = clamp(Number(intensity) || 1, .2, 2);
    const entrance = smooth(.03, .72, elapsed);
    const ending = 1 - smooth(Math.max(.9, span - .5), span, elapsed);
    uniforms.uTime.value = flowTime;
    uniforms.uLocal.value = elapsed;
    uniforms.uRx.value = Math.min(viewWidth * .39, Math.max(2.15, width * .53 + .62));
    uniforms.uRy.value = Math.min(viewHeight * .245, 1.84 + .06 * energy);
    uniforms.uY.value = Math.max(-.2, Math.min(.45, Number(heroY) + 1.02));
    uniforms.uEnergy.value = energy;
    uniforms.uAlpha.value = entrance * ending * Math.min(1.12, .84 + .16 * energy);
    const wavePhase = clamp((elapsed - .76) / 1.14);
    uniforms.uWave.value = wavePhase;
    uniforms.uWaveAlpha.value = still ? 0 : entrance * ending * Math.sin(Math.PI * wavePhase) * .40;
  }
  update(0);
  return { group, resize, update, dispose() { for (const r of resources) r.dispose(); group.clear(); } };
}
