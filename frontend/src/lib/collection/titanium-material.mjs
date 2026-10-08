/** TITANIUM EDGE — clean physical finishes and an HDR product-lighting studio.
 * Supply Three.js 0.169.0 and an existing WebGLRenderer.
 * Materials have no image, noise, grain, bump, or iridescence layers.
 * Cloned glyph materials must retain onBeforeCompile/customProgramCacheKey.
 */
export function createTitaniumMaterials(THREE, renderer) {
  // Uniform objects are shared by every compiled glyph clone, never shaders.
  const uniforms = {
    uTitaniumTime: { value: 0 },
    uTitaniumPhase: { value: 0.5 },
    uTitaniumStill: { value: 0 },
    uTitaniumExtent: { value: 4.5 },
    uTitaniumCenter: { value: 0 },
    uTitaniumIntensity: { value: 1 }
  };

  const studio = new THREE.Scene();
  studio.background = new THREE.Color().setRGB(0.105, 0.145, 0.205);
  const studioShell = new THREE.Mesh(
    new THREE.SphereGeometry(35, 32, 24),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color().setRGB(0.105, 0.145, 0.205),
      side: THREE.BackSide, toneMapped: false
    })
  );
  studio.add(studioShell);
  const cards = [];
  const cardVertex = `varying vec2 vCardUv;
    void main() {
      vCardUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;
  const cardFragment = `varying vec2 vCardUv;
    uniform vec3 uCardColor;
    uniform float uCardStrength;
    void main() {
      vec2 edge = min(vCardUv, 1.0 - vCardUv);
      float feather = smoothstep(0.0, 0.065, min(edge.x, edge.y));
      gl_FragColor = vec4(uCardColor * uCardStrength, feather);
    }`;
  function card(width, height, position, color, strength, roll = 0) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uCardColor: { value: new THREE.Color(color) },
        uCardStrength: { value: strength }
      },
      vertexShader: cardVertex, fragmentShader: cardFragment,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      toneMapped: false
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.position.set(...position);
    mesh.lookAt(0, 0, 0);
    mesh.rotateZ(roll);
    studio.add(mesh);
    cards.push(mesh);
  }
  // Two white softboxes carve the bevel; narrow cool cards make clean edge lines.
  card(6.2, 14, [-7, 3, 7], '#ffffff', 3.2, -0.13);
  card(3.0, 12, [8, 1, 6], '#d5ebff', 2.6, 0.08);
  card(13, 4.5, [-1, 9, 2], '#f4faff', 3.8, -0.12);
  card(0.85, 11, [-3.5, -1, 8], '#e4fcff', 4.1, -0.19);
  card(1.3, 13, [5.8, 0, 6], '#79d9ff', 1.4, 0.18);
  card(8, 5, [1, -7, 4], '#778cae', 0.9);
  card(6, 10, [1, 2, -8], '#d6e6f7', 1.1, 0.1);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentTarget = pmrem.fromScene(studio, 0.035, 0.1, 100);
  pmrem.dispose();
  for (const mesh of cards) {
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
  studioShell.geometry.dispose();
  studioShell.material.dispose();
  const envMap = environmentTarget.texture;

  const face = new THREE.MeshPhysicalMaterial({
    name: 'Titanium Edge / ceramic platinum face',
    color: '#dce7ef', metalness: 0.48, roughness: 0.22,
    envMap, envMapIntensity: 0.95,
    clearcoat: 0.9, clearcoatRoughness: 0.12,
    reflectivity: 0.62
  });
  const bevel = new THREE.MeshPhysicalMaterial({
    name: 'Titanium Edge / polished titanium bevel',
    color: '#9caec2', metalness: 0.99, roughness: 0.125,
    envMap, envMapIntensity: 1.25,
    clearcoat: 0.75, clearcoatRoughness: 0.085
  });
  const side = new THREE.MeshPhysicalMaterial({
    name: 'Titanium Edge / midnight cobalt depth',
    color: '#102c51', metalness: 0.84, roughness: 0.255,
    envMap, envMapIntensity: 0.82,
    clearcoat: 0.45, clearcoatRoughness: 0.18
  });
  const accent = new THREE.MeshPhysicalMaterial({
    name: 'Titanium Edge / cyan inlay',
    color: '#55dce6', emissive: '#07343c', emissiveIntensity: 0.6,
    metalness: 0.54, roughness: 0.21,
    envMap, envMapIntensity: 0.92,
    clearcoat: 0.6, clearcoatRoughness: 0.15
  });

  function installSheen(material, name, strength, tint, sculpt) {
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = 'varying vec3 vTitaniumWorld;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvTitaniumWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;'
      );
      shader.fragmentShader = `varying vec3 vTitaniumWorld;
        uniform float uTitaniumTime;
        uniform float uTitaniumPhase;
        uniform float uTitaniumStill;
        uniform float uTitaniumExtent;
        uniform float uTitaniumCenter;
        uniform float uTitaniumIntensity;
      ` + shader.fragmentShader;
      if (name === 'face') {
        // A broad polished crown bends studio reflections across the large face.
        // Frequencies stay below a single wave per word: no grain or bump texture.
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          normal = normalize(normal + vec3(
            sin(vTitaniumWorld.x * 0.85) * 0.15,
            cos(vTitaniumWorld.y * 0.65) * 0.08, 0.0));`
        );
      }
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `float titaniumWidth = max(0.25, uTitaniumExtent);
        float titaniumAxis = (vTitaniumWorld.x - uTitaniumCenter + vTitaniumWorld.y * 0.27) / titaniumWidth;
        float titaniumShadowD = (titaniumAxis + 0.13) / 0.21;
        float titaniumLightD = (titaniumAxis - 0.24) / 0.32;
        float titaniumShadow = exp(-titaniumShadowD * titaniumShadowD);
        float titaniumLight = exp(-titaniumLightD * titaniumLightD);
        outgoingLight *= 1.0 - ${sculpt} * titaniumShadow + 0.085 * titaniumLight;
        float titaniumScanX = uTitaniumCenter + (uTitaniumPhase - 0.5) * titaniumWidth * 1.7;
        float titaniumD = (vTitaniumWorld.x + vTitaniumWorld.y * 0.27 - titaniumScanX) / (0.036 * titaniumWidth + 0.02);
        float titaniumBand = exp(-titaniumD * titaniumD);
        outgoingLight += vec3(${tint}) * ${strength} * titaniumBand * uTitaniumIntensity * (1.0 - uTitaniumStill);
        #include <opaque_fragment>`
      );
    };
    material.customProgramCacheKey = () => `titanium-edge-clean-v2-${name}`;
  }
  installSheen(face, 'face', '0.115', '0.70, 0.92, 1.0', '0.24');
  installSheen(bevel, 'bevel', '0.30', '0.78, 0.95, 1.0', '0.10');
  installSheen(side, 'side', '0.10', '0.12, 0.48, 0.83', '0.14');

  let disposed = false;
  return {
    face, bevel, side, accent,
    update(time = 0, options = {}) {
      uniforms.uTitaniumTime.value = Number.isFinite(time) ? time : 0;
      if (Number.isFinite(options.phase)) uniforms.uTitaniumPhase.value = Math.max(0, Math.min(1, options.phase));
      uniforms.uTitaniumStill.value = options.still ? 1 : 0;
      if (Number.isFinite(options.extent)) uniforms.uTitaniumExtent.value = Math.max(0.25, options.extent);
      if (Number.isFinite(options.center)) uniforms.uTitaniumCenter.value = options.center;
      if (Number.isFinite(options.intensity)) uniforms.uTitaniumIntensity.value = Math.max(0, Math.min(2, options.intensity));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const material of [face, bevel, side, accent]) material.dispose();
      environmentTarget.dispose();
    }
  };
}
