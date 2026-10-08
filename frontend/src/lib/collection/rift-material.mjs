/** REALITY RIFT — procedural alien chrome, etched titanium and an energy core.
 * All textures and the reflection studio are made in code. Three.js 0.169.0.
 * Glyph clones must retain onBeforeCompile/customProgramCacheKey from the source
 * material. Shader uniforms are shared, so phrase cleanup cannot retain shaders.
 */
export function createRiftMaterials(THREE, renderer) {
  const textures = [];
  const uniforms = {
    uRiftTime: { value: 0 }, uRiftPhase: { value: 0.5 },
    uRiftStill: { value: 0 }, uRiftExtent: { value: 5 },
    uRiftCenter: { value: 0 }, uRiftIntensity: { value: 1 }
  };
  const random = (() => {
    let state = 19610417;
    return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  })();

  // Fine directional machining; a visible material under a broad reflection,
  // without covering the letters in coarse noise or printed checkerboards.
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = textureCanvas.height = 512;
  const ctx = textureCanvas.getContext('2d');
  const pixels = ctx.createImageData(512, 512);
  const rowTone = new Float32Array(512);
  for (let y = 0; y < 512; y++) rowTone[y] = 181 + random() * 44;
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const offset = (y * 512 + x) * 4;
    const grain = Math.max(0, Math.min(255, rowTone[y] + (random() - 0.5) * 17));
    pixels.data[offset] = pixels.data[offset + 1] = pixels.data[offset + 2] = grain;
    pixels.data[offset + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  for (let i = 0; i < 120; i++) {
    const x = random() * 512, y = random() * 512;
    ctx.strokeStyle = `rgba(255,255,255,${0.07 + random() * 0.045})`;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 14 + random() * 110, y + (random() - 0.5) * 0.7);
    ctx.stroke();
  }
  const machined = new THREE.CanvasTexture(textureCanvas);
  machined.wrapS = machined.wrapT = THREE.RepeatWrapping;
  machined.repeat.set(2.2, 2.2);
  machined.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  textures.push(machined);

  // A synthetic reflection room, not an image: long bright softboxes and neon
  // panels put sweeping white, cyan and violet bands into the curved metal.
  const studio = new THREE.Scene();
  studio.background = new THREE.Color('#141933');
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(35, 32, 20),
    new THREE.MeshBasicMaterial({ color: '#202447', side: THREE.BackSide })
  );
  studio.add(shell);
  const cardCanvas = document.createElement('canvas');
  cardCanvas.width = 128; cardCanvas.height = 256;
  const cardCtx = cardCanvas.getContext('2d');
  const cardPixels = cardCtx.createImageData(128, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 128; x++) {
    const edge = Math.max(0, Math.min(x / 15, (127 - x) / 15, y / 20, (255 - y) / 20, 1));
    const i = (y * 128 + x) * 4;
    cardPixels.data[i] = cardPixels.data[i + 1] = cardPixels.data[i + 2] = 255;
    cardPixels.data[i + 3] = Math.round(edge * edge * (3 - 2 * edge) * 255);
  }
  cardCtx.putImageData(cardPixels, 0, 0);
  const cardTexture = new THREE.CanvasTexture(cardCanvas);
  cardTexture.colorSpace = THREE.SRGBColorSpace;
  const cards = [];
  const card = (width, height, position, color, power = 1) => {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(power), map: cardTexture,
      transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false
    }));
    panel.position.set(...position);
    panel.lookAt(0, 0, 0);
    studio.add(panel); cards.push(panel);
  };
  card(4.6, 14, [-6, 3, 8], '#effbff', 3.6);
  card(2.4, 12, [6.5, 2, 6], '#60f0ff', 3.5);
  card(12, 3.5, [0, 8, 3], '#ffffff', 3.0);
  card(1.25, 13, [-2.5, -1, 10], '#ddfcff', 2.6);
  card(8, 7, [-8, 0, -4], '#774bff', 2.9);
  card(8, 7, [3, -6, 5], '#2c6bff', 2.2);
  card(2.7, 8, [8, -4, -4], '#c5ff27', 1.6);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentTarget = pmrem.fromScene(studio, 0.07, 0.1, 100);
  pmrem.dispose();
  for (const panel of cards) { panel.geometry.dispose(); panel.material.dispose(); }
  shell.geometry.dispose(); shell.material.dispose(); cardTexture.dispose();
  const envMap = environmentTarget.texture;

  const face = new THREE.MeshPhysicalMaterial({
    name: 'Rift / chromatic titanium face', color: '#c3cdfb',
    metalness: 0.77, roughness: 0.32, roughnessMap: machined,
    bumpMap: machined, bumpScale: 0.0018,
    envMap, envMapIntensity: 1.05, clearcoat: 0.82, clearcoatRoughness: 0.16,
    iridescence: 0.48, iridescenceIOR: 1.4, iridescenceThicknessRange: [170, 490],
    emissive: '#111837', emissiveIntensity: 0.1
  });
  const bevel = new THREE.MeshPhysicalMaterial({
    name: 'Rift / icy machined bevel', color: '#b4e9f9',
    metalness: 0.92, roughness: 0.21, roughnessMap: machined,
    bumpMap: machined, bumpScale: 0.0010,
    envMap, envMapIntensity: 1.3, clearcoat: 0.86, clearcoatRoughness: 0.12,
    iridescence: 0.32, iridescenceIOR: 1.36, iridescenceThicknessRange: [110, 340]
  });
  const side = new THREE.MeshPhysicalMaterial({
    name: 'Rift / violet-blue extrusion', color: '#2636b2',
    metalness: 0.78, roughness: 0.37, roughnessMap: machined,
    bumpMap: machined, bumpScale: 0.002,
    envMap, envMapIntensity: 0.96, clearcoat: 0.48, clearcoatRoughness: 0.25
  });
  const core = new THREE.MeshPhysicalMaterial({
    name: 'Rift / acid energy cut', color: '#bbf84b', metalness: 0.2,
    roughness: 0.26, emissive: '#a5ff16', emissiveIntensity: 1.42,
    envMap, envMapIntensity: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.12
  });

  function install(material, surface) {
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = 'varying vec3 vRiftWorldPosition;\nvarying vec3 vRiftLocalPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `
        #include <worldpos_vertex>
        vRiftWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vRiftLocalPosition = position;
      `);
      shader.fragmentShader = `
        varying vec3 vRiftWorldPosition;
        varying vec3 vRiftLocalPosition;
        uniform float uRiftTime;
        uniform float uRiftPhase;
        uniform float uRiftStill;
        uniform float uRiftExtent;
        uniform float uRiftCenter;
        uniform float uRiftIntensity;
        float riftStroke(float distanceToLine, float width) {
          return 1.0 - smoothstep(width, width + max(0.0005, fwidth(distanceToLine)), distanceToLine);
        }
      ` + shader.fragmentShader;
      if (surface === 'face' || surface === 'side') shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        float riftAxis = (vRiftWorldPosition.x - uRiftCenter + vRiftWorldPosition.y * 0.38) / max(0.25, uRiftExtent);
        float riftHue = 0.5 + 0.5 * sin(riftAxis * 7.5 + vRiftWorldPosition.y * 1.25);
        float riftPearlDistance = (riftAxis - 0.16) / 0.13;
        float riftPearl = exp(-riftPearlDistance * riftPearlDistance);
        vec3 riftFoil = mix(vec3(0.32, 0.16, 0.82), vec3(0.10, 0.56, 0.92), riftHue);
        riftFoil = mix(riftFoil, vec3(0.74, 0.94, 1.0), riftPearl * 0.74);
        diffuseColor.rgb *= ${surface === 'face' ? 'riftFoil * 1.48' : 'mix(vec3(0.50, 0.48, 0.95), riftFoil, 0.50) * 1.25'};
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        float riftWidth = max(0.25, uRiftExtent);
        float riftMotionTime = uRiftTime * (1.0 - uRiftStill);
        float riftPulseCenter = uRiftCenter + (uRiftPhase - 0.5) * riftWidth * 1.45;
        float riftPulseDistance = vRiftWorldPosition.x + vRiftWorldPosition.y * 0.29 - riftPulseCenter;
        // GLSL pow() is undefined for a negative base, including exponent 2.
        // Squaring signed distances explicitly keeps both sides of the pulse finite.
        float riftPulseNorm = riftPulseDistance / (riftWidth * 0.042 + 0.018);
        float riftShoulderNorm = riftPulseDistance / (riftWidth * 0.15 + 0.025);
        float riftPulse = exp(-riftPulseNorm * riftPulseNorm);
        float riftShoulder = exp(-riftShoulderNorm * riftShoulderNorm);
        vec2 riftEtch = vRiftLocalPosition.xy * vec2(28.0, 18.0);
        vec2 riftCell = floor(riftEtch);
        vec2 riftFraction = fract(riftEtch);
        float riftSelector = fract(sin(dot(riftCell, vec2(12.9898, 78.233))) * 43758.5453);
        float riftTrackA = riftStroke(abs(riftFraction.y - 0.5), 0.012) * step(0.79, riftSelector);
        float riftTrackB = riftStroke(abs(riftFraction.x - 0.5), 0.01) * step(0.91, riftSelector);
        float riftEtched = max(riftTrackA, riftTrackB);
        float riftScanY = fract(vRiftLocalPosition.y * 16.0 + riftMotionTime * 0.045);
        float riftScan = riftStroke(abs(riftScanY - 0.5), 0.014);
        ${surface === 'face' ? `
          float riftColorAxis = (vRiftWorldPosition.x - uRiftCenter + vRiftWorldPosition.y * 0.38) / riftWidth;
          float riftColorBlend = 0.5 + 0.5 * sin(riftColorAxis * 7.5 + vRiftWorldPosition.y * 1.25);
          vec3 riftCoating = mix(vec3(0.61, 0.36, 0.94), vec3(0.38, 0.84, 1.0), riftColorBlend);
          float riftHotHighlight = smoothstep(1.2, 3.9, max(outgoingLight.r, max(outgoingLight.g, outgoingLight.b)));
          outgoingLight *= mix(riftCoating, vec3(1.0), riftHotHighlight * 0.72);
          outgoingLight *= 1.0 - riftEtched * 0.15;
          outgoingLight += vec3(0.045, 0.20, 0.32) * riftEtched * (0.25 + riftPulse * 0.8);
          outgoingLight += (vec3(0.48, 1.3, 0.55) * riftPulse * 0.53 + vec3(0.15, 0.50, 0.78) * riftShoulder * 0.13) * uRiftIntensity;
          outgoingLight += vec3(0.15, 0.45, 0.60) * riftScan * riftPulse * 0.18 * (1.0 - uRiftStill);
        ` : surface === 'bevel' ? `
          outgoingLight += vec3(0.44, 1.05, 0.98) * riftPulse * 0.48 * uRiftIntensity;
        ` : surface === 'core' ? `
          float riftCoreFlow = 0.86 + 0.14 * sin(vRiftWorldPosition.x * 12.0 - riftMotionTime * 4.0);
          outgoingLight *= riftCoreFlow;
          outgoingLight += vec3(0.4, 1.2, 0.08) * riftPulse * 1.15 * uRiftIntensity;
          outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.4, 1.07, 1.25), riftScan * 0.2);
        ` : `
          outgoingLight *= 1.0 - riftEtched * 0.17;
          outgoingLight += vec3(0.07, 0.25, 0.8) * (riftEtched * 0.25 + riftPulse * 0.12) * uRiftIntensity;
        `}
        #include <opaque_fragment>
      `);
    };
    material.customProgramCacheKey = () => `reality-rift-metal-v3-${surface}`;
  }
  install(face, 'face'); install(bevel, 'bevel'); install(side, 'side'); install(core, 'core');
  let disposed = false;
  return {
    face, bevel, side, core,
    update(time = 0, options = {}) {
      uniforms.uRiftTime.value = Number.isFinite(time) ? time : 0;
      uniforms.uRiftStill.value = options.still ? 1 : 0;
      if (Number.isFinite(options.phase)) uniforms.uRiftPhase.value = Math.max(0, Math.min(1, options.phase));
      if (Number.isFinite(options.extent)) uniforms.uRiftExtent.value = Math.max(0.25, options.extent);
      if (Number.isFinite(options.center)) uniforms.uRiftCenter.value = options.center;
      if (Number.isFinite(options.intensity)) uniforms.uRiftIntensity.value = Math.max(0, options.intensity);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const material of [face, bevel, side, core]) material.dispose();
      for (const texture of textures) texture.dispose();
      environmentTarget.dispose();
    }
  };
}
