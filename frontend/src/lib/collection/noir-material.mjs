/** ATELIER NOIR — procedural satin metal and a photographic studio environment.
 * No image assets. Supply Three.js 0.169.0 and a WebGLRenderer.
 * update(seconds, {sweep: 0..1, still: boolean, extent: wordWidth, center: 0})
 * Moves a subtle world-space highlight across every letter as a single light.
 */
export function createNoirMaterials(THREE, renderer) {
  const ownedTextures = [];
  // Every compiled glyph clone shares these objects. Phrase disposal therefore
  // leaves no retained shader references and cannot accumulate a render-loop leak.
  const uniforms = {
    uNoirTime: { value: 0 }, uNoirSweep: { value: 0.5 },
    uNoirStill: { value: 0 }, uNoirExtent: { value: 4.5 },
    uNoirCenter: { value: 0 }
  };
  const seeded = seed => () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Microscopic directional machining, deliberately softer than visible scratches.
  const brushCanvas = document.createElement('canvas');
  brushCanvas.width = brushCanvas.height = 512;
  const brushCtx = brushCanvas.getContext('2d');
  const grain = brushCtx.createImageData(512, 512);
  const random = seeded(175931);
  const rowTone = new Float32Array(512);
  for (let y = 0; y < 512; y++) rowTone[y] = 188 + random() * 39;
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4;
      const v = Math.max(0, Math.min(255, rowTone[y] + (random() - 0.5) * 15));
      grain.data[i] = grain.data[i + 1] = grain.data[i + 2] = v;
      grain.data[i + 3] = 255;
    }
  }
  brushCtx.putImageData(grain, 0, 0);
  for (let n = 0; n < 210; n++) {
    const x = random() * 512, y = random() * 512;
    brushCtx.strokeStyle = `rgba(255,255,255,${0.025 + random() * 0.035})`;
    brushCtx.lineWidth = 0.45;
    brushCtx.beginPath();
    brushCtx.moveTo(x, y);
    brushCtx.lineTo(x + 12 + random() * 130, y + (random() - 0.5) * 0.5);
    brushCtx.stroke();
  }
  const brushed = new THREE.CanvasTexture(brushCanvas);
  brushed.wrapS = brushed.wrapT = THREE.RepeatWrapping;
  brushed.repeat.set(3.8, 3.8);
  brushed.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  // This texture contains data, so it must remain in the default linear color space.
  ownedTextures.push(brushed);

  // Large luminous cards make broad reflections, just like a product-photo studio.
  const environmentScene = new THREE.Scene();
  environmentScene.background = new THREE.Color('#44505c');
  const studioSphere = new THREE.Mesh(
    new THREE.SphereGeometry(35, 24, 16),
    new THREE.MeshBasicMaterial({ color: '#44505c', side: THREE.BackSide })
  );
  environmentScene.add(studioSphere);

  const cardCanvas = document.createElement('canvas');
  cardCanvas.width = 128;
  cardCanvas.height = 256;
  const cardCtx = cardCanvas.getContext('2d');
  const cardPixels = cardCtx.createImageData(128, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 128; x++) {
    const edge = Math.min(x / 17, (127 - x) / 17, y / 24, (255 - y) / 24, 1);
    const alpha = Math.max(0, edge * edge * (3 - 2 * edge));
    const i = (y * 128 + x) * 4;
    cardPixels.data[i] = cardPixels.data[i + 1] = cardPixels.data[i + 2] = 255;
    cardPixels.data[i + 3] = Math.round(alpha * 255);
  }
  cardCtx.putImageData(cardPixels, 0, 0);
  const cardTexture = new THREE.CanvasTexture(cardCanvas);
  cardTexture.colorSpace = THREE.SRGBColorSpace;
  const cards = [];
  function card(width, height, position, color) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({
        color, map: cardTexture, transparent: true,
        side: THREE.DoubleSide, depthWrite: false
      })
    );
    mesh.position.set(...position);
    mesh.lookAt(0, 0, 0);
    environmentScene.add(mesh);
    cards.push(mesh);
  }
  card(6.5, 13, [-7, 3, 6], '#ffffff');
  card(4.1, 12, [7, 1.5, 5], '#dce5ef');
  card(11, 5, [0, 8, 1], '#f9f8f5');
  card(1.8, 10, [-4.6, -1, 8], '#ffffff');
  card(6, 6, [2, -6, 4], '#8d9aa9');
  card(5, 9, [1, 1, -8], '#6c7b8c');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentTarget = pmrem.fromScene(environmentScene, 0.055, 0.1, 100);
  pmrem.dispose();
  const envMap = environmentTarget.texture;
  for (const mesh of cards) { mesh.geometry.dispose(); mesh.material.dispose(); }
  studioSphere.geometry.dispose();
  studioSphere.material.dispose();
  cardTexture.dispose();

  const face = new THREE.MeshPhysicalMaterial({
    name: 'Noir / platinum satin face',
    color: '#adb7c2', metalness: 0.91, roughness: 0.29,
    roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.0016,
    envMap, envMapIntensity: 1.1,
    clearcoat: 0.13, clearcoatRoughness: 0.32
  });
  const bevel = new THREE.MeshPhysicalMaterial({
    name: 'Noir / champagne bevel',
    color: '#d8bd94', metalness: 0.89, roughness: 0.235,
    roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.0011,
    envMap, envMapIntensity: 1.18,
    clearcoat: 0.2, clearcoatRoughness: 0.26
  });
  const side = new THREE.MeshStandardMaterial({
    name: 'Noir / graphite extrusion',
    color: '#21303f', metalness: 0.78, roughness: 0.34,
    roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.001,
    envMap, envMapIntensity: 0.74
  });
  const trim = new THREE.MeshStandardMaterial({
    name: 'Noir / champagne accent',
    color: '#d9c2a0', metalness: 0.75, roughness: 0.27,
    envMap, envMapIntensity: 1.08
  });

  function installSweep(material, strength, tint) {
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = 'varying vec3 vNoirWorldPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvNoirWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;'
      );
      shader.fragmentShader = `
        varying vec3 vNoirWorldPosition;
        uniform float uNoirSweep;
        uniform float uNoirStill;
        uniform float uNoirExtent;
        uniform float uNoirCenter;
        uniform float uNoirTime;
      ` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `
          float noirWidth = max(0.25, uNoirExtent);
          float noirLightX = uNoirCenter + (uNoirSweep - 0.5) * noirWidth * 1.5;
          float noirDistance = (vNoirWorldPosition.x + vNoirWorldPosition.y * 0.18 - noirLightX);
          float noirBand = exp(-pow(noirDistance / (noirWidth * 0.041 + 0.024), 2.0));
          float noirShoulder = exp(-pow(noirDistance / (noirWidth * 0.115 + 0.03), 2.0));
          float noirStudioAxis = (vNoirWorldPosition.x - uNoirCenter + vNoirWorldPosition.y * 0.23) / noirWidth;
          float noirStudioShadow = exp(-pow((noirStudioAxis + 0.17) / 0.16, 2.0));
          float noirStudioLight = exp(-pow((noirStudioAxis - 0.21) / 0.23, 2.0));
          // Soft wide studio cards remain visible during the readable hold.
          outgoingLight *= 0.97 - 0.31 * noirStudioShadow + 0.12 * noirStudioLight;
          // A light contribution is added before tone mapping; texture and lighting remain physical.
          outgoingLight += vec3(${tint}) * (${strength}) * (noirBand + noirShoulder * 0.15) * (1.0 - uNoirStill);
          #include <opaque_fragment>
        `
      );
    };
    material.customProgramCacheKey = () => `atelier-noir-satin-v1-${strength}`;
  }
  installSweep(face, 0.21, '1.0, 0.975, 0.925');
  installSweep(bevel, 0.3, '1.0, 0.90, 0.73');

  let disposed = false;
  return {
    face, bevel, side, trim,
    update(time = 0, options = {}) {
      uniforms.uNoirTime.value = Number.isFinite(time) ? time : 0;
      if (Number.isFinite(options.sweep)) uniforms.uNoirSweep.value = Math.max(0, Math.min(1, options.sweep));
      uniforms.uNoirStill.value = options.still ? 1 : 0;
      if (Number.isFinite(options.extent)) uniforms.uNoirExtent.value = Math.max(0.25, options.extent);
      if (Number.isFinite(options.center)) uniforms.uNoirCenter.value = options.center;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const material of [face, bevel, side, trim]) material.dispose();
      for (const texture of ownedTextures) texture.dispose();
      environmentTarget.dispose();
    }
  };
}
