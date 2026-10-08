/** PRESSURE: rounded rubber type, volume-preserving squash and collision.
 * Native canvas drawing on the caller's frame. Time in seconds, no timers.
 * Glyph lighting is computed from a distance field and cached, not an image asset.
 */
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = p => 1 - (1 - clamp(p)) ** 4;
const normal = v => { const length = Math.hypot(...v); return v.map(x => x / length); };
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const light = normal([-.5, -.7, .85]), half = normal([light[0], light[1], light[2] + 1]);
// Arial Rounded lacks several Balkan precomposed letters. Use its base glyph
// and draw the accent as rounded geometry before shading the combined mask.
const baseText = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function createPressureRenderer({ createCanvas, cues, theme = {} }) {
  if (typeof createCanvas !== 'function' || !Array.isArray(cues)) throw new TypeError('Pass native createCanvas and cues.');
  let previousEnd = -Infinity;
  for (const c of cues) {
    if (!Number.isFinite(c.start) || !Number.isFinite(c.end) || c.start < previousEnd || c.end <= c.start || typeof c.text !== 'string' || !c.text.trim())
      throw new RangeError('Cues need text and finite, ordered, non-overlapping times.');
    previousEnd = c.end;
  }
  cues = cues.map(c => ({ ...c }));
  const style = { fontFamily: 'PressureCaption', anchor: .62, width: .73, intensity: 1, ...theme };
  if (!(style.anchor >= .32 && style.anchor <= .72) || !(style.width >= .2 && style.width <= .78) || !(style.intensity >= 0 && style.intensity <= 1.3))
    throw new RangeError('Invalid anchor, width or intensity.');
  const measure = createCanvas(1, 1).getContext('2d'), cache = new Map();

  function distanceField(alpha, width, height) {
    const d = Float32Array.from(alpha, v => v > 127 ? 1e5 : 0);
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      d[i] = Math.min(d[i], d[i - 1] + 1, d[i - width] + 1, d[i - width - 1] + 1.4142, d[i - width + 1] + 1.4142);
    }
    for (let y = height - 2; y > 0; y--) for (let x = width - 2; x > 0; x--) {
      const i = y * width + x;
      d[i] = Math.min(d[i], d[i + 1] + 1, d[i + width] + 1, d[i + width + 1] + 1.4142, d[i + width - 1] + 1.4142);
    }
    return d;
  }
  function glyph(char, size, material) {
    measure.font = `bold ${size}px "${style.fontFamily}"`;
    const baseChar = baseText(char), accents = char.normalize('NFD').slice(baseChar.length);
    const metrics = measure.measureText(baseChar), pad = Math.ceil(size * .2 + 14);
    const w = Math.ceil(metrics.width + 2 * pad), h = Math.ceil(size * 1.55 + pad * 2);
    const canvas = createCanvas(w, h), c = canvas.getContext('2d');
    const baseline = pad + size * 1.05;
    c.font = measure.font; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
    c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.lineWidth = size * .025;
    c.strokeText(baseChar, pad, baseline); c.fillText(baseChar, pad, baseline);
    if (accents) {
      const ax = pad + metrics.width / 2, ay = baseline - metrics.actualBoundingBoxAscent - size * .19;
      c.lineWidth = size * .05; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath();
      if (accents.includes('\u030c')) {
        c.moveTo(ax - size * .09, ay); c.lineTo(ax, ay + size * .085); c.lineTo(ax + size * .09, ay);
      } else if (accents.includes('\u0301')) {
        c.moveTo(ax - size * .045, ay + size * .085); c.lineTo(ax + size * .06, ay);
      } else if (accents.includes('\u0300')) {
        c.moveTo(ax + size * .045, ay + size * .085); c.lineTo(ax - size * .06, ay);
      } else {
        c.arc(ax, ay + size * .035, size * .025, 0, Math.PI * 2);
      }
      c.stroke();
    }
    const image = c.getImageData(0, 0, w, h), alpha = new Uint8Array(w * h);
    for (let i = 0; i < alpha.length; i++) alpha[i] = image.data[i * 4 + 3];
    const distance = distanceField(alpha, w, h), radius = size * .135, heights = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      // Smooth the field to avoid stair-step highlights on diagonal strokes.
      const d = (distance[i] * 4 + distance[i - 1] + distance[i + 1] + distance[i - w] + distance[i + w]) / 8;
      const p = clamp(d / radius);
      heights[i] = Math.sqrt(1 - (1 - p) ** 2) * radius;
    }
    // Blur the height map before differentiating to smooth the rubber surface.
    const temp = new Float32Array(w * h), smooth = new Float32Array(w * h);
    for (let pass = 0; pass < 2; pass++) {
      const source = pass ? smooth : heights;
      for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
        const i = y * w + x;
        temp[i] = (source[i - 2] + source[i - 1] * 4 + source[i] * 6 + source[i + 1] * 4 + source[i + 2]) / 16;
      }
      for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
        const i = y * w + x;
        smooth[i] = (temp[i - w * 2] + temp[i - w] * 4 + temp[i] * 6 + temp[i + w] * 4 + temp[i + w * 2]) / 16;
      }
    }
    const base = material === 'orange' ? [255, 91, 31] : [247, 239, 222];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x; if (!alpha[i]) continue;
      const n = normal([-(smooth[i + 1] - smooth[i - 1]) * .62, -(smooth[i + w] - smooth[i - w]) * .62, 1]);
      const diffuse = Math.max(0, dot(n, light)), specular = Math.max(0, dot(n, half)) ** 13;
      const occlusion = .86 + .14 * clamp(distance[i] / (radius * .6));
      const vertical = clamp((y - pad) / size);
      for (let k = 0; k < 3; k++) {
        const value = base[k] * (.36 + .68 * diffuse) * occlusion * (1 - vertical * .055)
          + specular * (material === 'orange' ? 43 : 30);
        image.data[i * 4 + k] = clamp(value, 0, 255);
      }
    }
    c.putImageData(image, 0, 0);
    const shaded = createCanvas(w, h), s = shaded.getContext('2d');
    s.shadowColor = '#030201b0'; s.shadowBlur = size * .065; s.shadowOffsetY = size * .045;
    s.drawImage(canvas, 0, 0);
    return { canvas: shaded, width: metrics.width, ox: pad, oy: baseline };
  }
  function assets(cue, index, width, height) {
    const key = `${index}:${width}:${height}`;
    if (cache.has(key)) return cache.get(key);
    const unit = Math.min(width / 1080, height / 1350);
    let size = (theme.fontSize??100) * width / 1080;
    measure.font = `bold ${size}px "${style.fontFamily}"`;
    const letterCount = Array.from(cue.text).length;
    let textWidth = measure.measureText(baseText(cue.text)).width + Math.max(0, letterCount - 1) * size * .024;
    size *= Math.min(1, width * style.width / (textWidth + size * .08));
    measure.font = `bold ${size}px "${style.fontFamily}"`;
    textWidth = measure.measureText(baseText(cue.text)).width + Math.max(0, letterCount - 1) * size * .024;
    const letters = Array.from(cue.text), pieces = letters.map((char, j) => {
      const x = measure.measureText(baseText(letters.slice(0, j).join(''))).width + j * size * .024 - textWidth / 2;
      return { ...glyph(char, size, cue.material), x };
    });
    const result = { size, textWidth, pieces, unit };
    if (cache.size >= 18) cache.delete(cache.keys().next().value);
    cache.set(key, result); return result;
  }
  function shadow(ctx, x, y, width, height, opacity) {
    ctx.save(); ctx.translate(x, y); ctx.scale(width, height); ctx.globalAlpha *= opacity;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, '#030201b0'); g.addColorStop(.45, '#03020158'); g.addColorStop(1, '#03020100');
    ctx.fillStyle = g; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
  }
  function renderCue(ctx, cue, index, time, width, height, outgoing = false) {
    const a = assets(cue, index, width, height), { size, textWidth, pieces, unit } = a;
    const age = time - cue.start, energy = style.intensity, strength = clamp(cue.pressure ?? 1, .5, 1.3);
    const arrival = energy ? ease(age / .27) : 1;
    const outgoingProgress = outgoing ? ease((time - cue.end + .07) / .30) : 0;
    const lastFade = index === cues.length - 1 ? ease((time - cue.end + .20) / .20) : 0;
    const impulseAge = age - .22;
    const impact = impulseAge >= 0 ? Math.exp(-impulseAge * 7) * Math.cos(impulseAge * 21) * energy * strength : 0;
    const squeeze = Math.max(0, impact);
    const breath = Math.sin(Math.max(0, age - .65) * 4.5) * .018 * energy;
    const xScale = 1 + squeeze * .18 + breath;
    const yScale = 1 / (xScale ** 1.15);
    const baseline = height * style.anchor;
    const dy = index === 0 ? -(1 - arrival) * size * 1.55 * energy : (1 - arrival) * size * 1.35 * energy;
    const rebound = impulseAge > 0 ? -Math.abs(Math.sin(impulseAge * 13)) * Math.exp(-impulseAge * 4.5) * size * .35 * energy * strength : 0;
    const shake = Math.sin(Math.max(0, impulseAge) * 63) * Math.exp(-Math.max(0, impulseAge) * 13) * (impulseAge >= 0 ? 4 : 0) * unit * energy;
    ctx.save();
    ctx.globalAlpha *= (energy ? ease(age / .075) : 1) * (1 - outgoingProgress) * (1 - lastFade);
    ctx.translate(width / 2 + shake, baseline + dy + rebound - outgoingProgress * size * 1.45 * energy);
    ctx.rotate(outgoingProgress * -.09 * energy);
    // The soft contact shadow gets wider and darker as the word hits.
    shadow(ctx, 0, size * .13 - rebound, textWidth * (.57 + squeeze * .12), size * (.11 - squeeze * .025), .65 + squeeze * .25);
    ctx.scale(xScale * (1 + outgoingProgress * .12), yScale * (1 - outgoingProgress * .18));

    // Low-amplitude elastic wake travels along the letters after landing.
    pieces.forEach((piece, j) => {
      const local = Math.max(0, age - .17 - j * .016);
      const wave = local > 0 ? Math.sin(local * 19) * Math.exp(-local * 5.5) * energy * strength : 0;
      const inflate = 1 + wave * .085;
      ctx.save(); ctx.translate(piece.x + piece.width / 2, -Math.abs(wave) * size * .11);
      ctx.rotate(wave * .025 * (j % 2 ? 1 : -1)); ctx.scale(inflate, 1 / inflate);
      ctx.drawImage(piece.canvas, -piece.ox - piece.width / 2, -piece.oy); ctx.restore();
    });
    if (cue.lead) {
      ctx.save(); ctx.translate(0, -size * 1.05);
      ctx.scale(1 / xScale, 1 / yScale);
      ctx.font = `bold ${size * .38}px "${style.fontFamily}"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const leadWidth = ctx.measureText(cue.lead).width + size * .40;
      ctx.fillStyle = '#11100fe8'; ctx.shadowColor = '#00000066'; ctx.shadowBlur = 12 * unit; ctx.shadowOffsetY = 5 * unit;
      ctx.beginPath(); ctx.roundRect(-leadWidth / 2, -size * .29, leadWidth, size * .58, size * .29); ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.fillStyle = '#f4ebd8'; ctx.fillText(cue.lead, 0, 0); ctx.restore();
    }

    // Squashed rubber droplets and pressure arcs, local to the subtitle layer.
    if (impulseAge >= 0 && impulseAge < .56 && energy) {
      const p = impulseAge / .56;
      ctx.save(); ctx.globalAlpha *= (1 - p) ** 1.5;
      for (const side of [-1, 1]) {
        const x = side * (textWidth * .48 + ease(p) * 55 * unit);
        ctx.fillStyle = '#ff6428'; ctx.beginPath(); ctx.ellipse(x, size * .045, (7 + 14 * (1 - p)) * unit, 5 * unit, side * -.3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#f8edd6'; ctx.lineWidth = 3 * unit; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.ellipse(x, -size * .25, 18 * unit + p * 8 * unit, size * .18, 0, side < 0 ? Math.PI * .6 : -Math.PI * .4, side < 0 ? Math.PI * 1.4 : Math.PI * .4); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }
  function draw(ctx, time, viewport = {}) {
    const width = viewport.width ?? ctx.canvas.width, height = viewport.height ?? ctx.canvas.height;
    if (!Number.isFinite(time) || !(width > 0 && height > 0)) throw new RangeError('Finite time and positive viewport required.');
    const index = cues.findIndex(c => time >= c.start && time < c.end); if (index < 0) return null;
    const before = { fillStyle: ctx.fillStyle, strokeStyle: ctx.strokeStyle };
    ctx.save();
    try {
      ctx.beginPath(); ctx.rect(width * .025, height * .08, width * .95, height * .79); ctx.clip();
      if (index > 0 && time < cues[index].start + .23 && cues[index - 1].end === cues[index].start)
        renderCue(ctx, cues[index - 1], index - 1, time, width, height, true);
      renderCue(ctx, cues[index], index, time, width, height);
      return { cueIndex: index, text: [cues[index].lead, cues[index].text].filter(Boolean).join(' '), cacheEntries: cache.size };
    } finally { ctx.restore(); ctx.fillStyle = before.fillStyle; ctx.strokeStyle = before.strokeStyle; }
  }
  return { draw, clearCache: () => cache.clear() };
}
