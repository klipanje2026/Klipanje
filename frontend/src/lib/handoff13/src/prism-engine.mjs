/** PRISM: metallic glass, light refraction and sliced assembly.
 * Native Canvas only. Deterministic absolute time; no DOM or external images.
 */
const clamp = n => Math.max(0, Math.min(1, n));
const ease = p => 1 - (1 - clamp(p)) ** 4;
const tones = {
  cyan: { light: '#bbfdff', edge: '#51e5ef', dark: '#24496d', middle: '#a6e9fb', opposite: '#a18bff' },
  violet: { light: '#f6edff', edge: '#b8a1ff', dark: '#443879', middle: '#d6c4ff', opposite: '#7ef2ff' },
  silver: { light: '#ffffff', edge: '#a4d6fa', dark: '#344b65', middle: '#dce8f5', opposite: '#d7aaff' },
};
export function createPrismRenderer({ createCanvas, cues, theme = {} }) {
  if (typeof createCanvas !== 'function' || !Array.isArray(cues)) throw new TypeError('Pass createCanvas and cues.');
  let last = -Infinity;
  for (const cue of cues) {
    if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < last || cue.end <= cue.start || typeof cue.text !== 'string' || !cue.text.trim())
      throw new RangeError('Cues need text and finite, ordered, non-overlapping times.');
    last = cue.end;
  }
  cues = cues.map(c => ({ ...c }));
  const style = { fontFamily: 'PrismCaption', width: .72, anchor: .60, intensity: 1, ...theme };
  if (!(style.width >= .2 && style.width <= .82) || !(style.anchor >= .3 && style.anchor <= .72) || !(style.intensity >= 0 && style.intensity <= 1.3))
    throw new RangeError('Invalid width, anchor or intensity.');
  const cache = new Map(), measure = createCanvas(1, 1).getContext('2d');

  function assets(cue, index, width, height) {
    const key = `${index}:${width}:${height}`;
    if (cache.has(key)) return cache.get(key);
    const unit = Math.min(width / 1280, height / 720);
    let size = (theme.fontSize??100) * width / 1080;
    measure.font = `900 ${size}px "${style.fontFamily}"`;
    const count = Array.from(cue.text).length;
    const initial = measure.measureText(cue.text).width + size * .042 * Math.max(0, count - 1);
    size *= Math.min(1, width * style.width / initial);
    measure.font = `900 ${size}px "${style.fontFamily}"`;
    const spacing = size * .042;
    const textWidth = measure.measureText(cue.text).width + spacing * Math.max(0, count - 1);
    const metrics = measure.measureText(cue.text);
    const pad = Math.ceil(45 * unit + 5), th = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    const w = Math.ceil(textWidth + pad * 2), h = Math.ceil(th + pad * 2 + 9 * unit);
    const baseline = pad + metrics.actualBoundingBoxAscent;
    const palette = tones[cue.tone] || tones.cyan;
    const sprite = createCanvas(w, h), s = sprite.getContext('2d');
    s.font = `900 ${size}px "${style.fontFamily}"`; s.textBaseline = 'alphabetic'; s.lineJoin = 'round';
    function letters(context, dx = 0, dy = 0, stroke = false) {
      let x = pad;
      for (const char of Array.from(cue.text)) {
        if(stroke) context.strokeText(char, x + dx, baseline + dy); else context.fillText(char, x + dx, baseline + dy);
        x += measure.measureText(char).width + spacing;
      }
    }
    // Thin, optically coloured back edge instead of a heavy drop shadow.
    for (let d = 6 * unit; d > 0; d -= .7) {
      s.fillStyle = d > 4 * unit ? palette.edge : palette.dark; letters(s, d * .28, d);
    }
    const face = s.createLinearGradient(0, pad - 3, 0, pad + th);
    face.addColorStop(0, '#ffffff'); face.addColorStop(.16, palette.light);
    face.addColorStop(.40, palette.middle); face.addColorStop(.465, '#ffffff');
    face.addColorStop(.485, palette.dark); face.addColorStop(.55, '#7089b2');
    face.addColorStop(.72, palette.middle); face.addColorStop(1, palette.light);
    s.fillStyle = face; letters(s);
    s.strokeStyle = '#f1feffb0'; s.lineWidth = Math.max(.7, 1.2 * unit); letters(s, 0, 0, true);
    // Subtle internal scanline texture on the glass.
    const scanMask = createCanvas(w, h), sm = scanMask.getContext('2d');
    sm.drawImage(sprite, 0, 0); sm.globalCompositeOperation = 'source-in';
    sm.fillStyle = '#a8eaff'; sm.fillRect(0, 0, w, h);
    const glow = createCanvas(w, h), g = glow.getContext('2d');
    g.filter = `blur(${11 * unit}px)`; g.globalAlpha = .65; g.drawImage(scanMask, 0, 0);
    const reflection = createCanvas(w, Math.ceil(h * .44)), r = reflection.getContext('2d');
    r.translate(0, reflection.height); r.scale(1, -reflection.height / h); r.drawImage(sprite, 0, 0); r.resetTransform();
    r.globalCompositeOperation = 'destination-in';
    const fade = r.createLinearGradient(0, 0, 0, reflection.height);
    fade.addColorStop(0, '#ffffff60'); fade.addColorStop(.55, '#ffffff10'); fade.addColorStop(1, '#ffffff00');
    r.fillStyle = fade; r.fillRect(0, 0, w, reflection.height);
    const sheen = createCanvas(w, h);
    const value = { sprite, glow, reflection, sheen, w, h, pad, th, textWidth, size, unit, palette };
    if (cache.size >= 18) cache.delete(cache.keys().next().value);
    cache.set(key, value); return value;
  }
  function lightLine(ctx, x1, y1, x2, y2, color, width) {
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, `${color}00`); g.addColorStop(.45, `${color}90`); g.addColorStop(.5, '#ffffff');
    g.addColorStop(.55, `${color}90`); g.addColorStop(1, `${color}00`);
    ctx.strokeStyle = g; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function tracked(ctx, text, size, spacing) {
    ctx.font = `700 ${size}px "${style.fontFamily}"`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const letters = Array.from(text), widths = letters.map(c => ctx.measureText(c).width);
    let x = -(widths.reduce((a, b) => a + b, 0) + spacing * (letters.length - 1)) / 2;
    letters.forEach((c, i) => { ctx.fillText(c, x, 0); x += widths[i] + spacing; });
  }
  function draw(ctx, time, viewport = {}) {
    const width = viewport.width ?? ctx.canvas.width, height = viewport.height ?? ctx.canvas.height;
    if (!Number.isFinite(time) || !(width > 0 && height > 0)) throw new RangeError('Finite time and positive viewport required.');
    const index = cues.findIndex(c => time >= c.start && time < c.end); if (index < 0) return null;
    const cue = cues[index], a = assets(cue, index, width, height);
    const { unit, palette: p, textWidth, th } = a, age = time - cue.start, energy = style.intensity;
    const enter = energy ? ease(age / .44) : 1;
    const exit = ease((time - cue.end + .16) / .16);
    const hit = Math.exp(-age * 10) * energy;
    const before = { fillStyle: ctx.fillStyle, strokeStyle: ctx.strokeStyle };
    ctx.save();
    try {
      ctx.globalAlpha *= (energy ? ease(age / .065) : 1) * (1 - exit);
      ctx.beginPath(); ctx.rect(width * .02, height * .05, width * .96, height * .92); ctx.clip();
      ctx.translate(width / 2 + Math.sin(age * 67) * hit * 6 * unit, height * style.anchor + Math.cos(age * 57) * hit * 5 * unit);
      // Glass rotates towards the viewer; a restrained camera push keeps depth.
      const tilt = (cue.motion === 'fold' ? (1 - enter) * -.25 : (1 - enter) * .055) * energy;
      ctx.rotate(tilt);
      const push = 1 + Math.sin(age * 16) * Math.exp(-age * 7) * .05 * energy;
      ctx.scale(push, push);

      // Light caustic under the floating text. Included in the transparent layer.
      ctx.save(); ctx.translate(0, th * .72); ctx.scale(1, .10);
      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, textWidth * .62);
      halo.addColorStop(0, `${p.edge}60`); halo.addColorStop(.45, `${p.edge}18`); halo.addColorStop(1, `${p.edge}00`);
      ctx.fillStyle = halo; ctx.fillRect(-textWidth, -textWidth, textWidth * 2, textWidth * 2); ctx.restore();

      // Rear prism planes rotate independently from the caption.
      const plane = 1 - (1 - enter) * .7;
      for (let k = 0; k < 2; k++) {
        ctx.save(); ctx.globalAlpha *= .23; ctx.rotate((k ? -.14 : .10) + Math.sin(age * .8) * .025);
        const x = textWidth * .52, y = th * .7;
        const glass = ctx.createLinearGradient(-x, -y, x, y);
        glass.addColorStop(0, `${p.edge}00`); glass.addColorStop(.5, `${k ? p.opposite : p.edge}38`); glass.addColorStop(1, '#ffffff00');
        ctx.fillStyle = glass; ctx.beginPath(); ctx.moveTo(-x * plane, -y); ctx.lineTo(x * plane, -y * .65);
        ctx.lineTo(x * plane - 20 * unit, y); ctx.lineTo(-x * plane - 20 * unit, y * .65); ctx.closePath(); ctx.fill();
        lightLine(ctx, -x, k ? y : -y, x, k ? y * .65 : -y * .65, p.edge, 1.2 * unit); ctx.restore();
      }
      ctx.save(); ctx.globalAlpha *= enter * .75;
      ctx.drawImage(a.reflection, -a.w / 2, th * .64); ctx.restore();
      ctx.save(); ctx.globalAlpha *= .32 + hit * .4;
      ctx.drawImage(a.glow, -a.w / 2, -a.h / 2); ctx.restore();

      // Word assembles from optical slices, with alternating horizontal offsets.
      const slices = cue.motion === 'fold' ? 7 : 9;
      if (cue.motion === 'aperture') {
        ctx.save(); const aperture = Math.max(.015, enter);
        ctx.beginPath(); ctx.rect(-a.w / 2, -a.h * aperture / 2, a.w, a.h * aperture); ctx.clip();
      }
      for (let k = 0; k < slices; k++) {
        const local = Math.max(0, age - k * .009), progress = energy ? ease(local / .36) : 1;
        const sourceY = k * a.h / slices, sourceH = a.h / slices;
        const direction = k % 2 ? 1 : -1;
        const dx = direction * ((1 - progress) * 155 + exit * 170) * unit * energy;
        const dy = (k - slices / 2) * (1 - progress) * 7 * unit * energy;
        ctx.save();
        ctx.translate(dx, dy);
        if (cue.motion === 'fold') {
          ctx.transform(Math.max(.04, Math.cos((1 - progress) * 1.45 * energy)), 0, (1 - progress) * .32 * energy, 1, 0, 0);
        }
        ctx.globalAlpha *= energy ? ease(local / .06) : 1;
        // Refracted double image exists only while slices are moving.
        if (progress < .99 && energy) {
          ctx.save(); ctx.globalAlpha *= (1 - progress) * .35;
          ctx.drawImage(a.sprite, 0, sourceY, a.w, sourceH, -a.w / 2 + direction * 16 * unit, -a.h / 2 + sourceY - 4 * unit, a.w, sourceH + .35);
          ctx.restore();
        }
        ctx.drawImage(a.sprite, 0, sourceY, a.w, sourceH, -a.w / 2, -a.h / 2 + sourceY, a.w, sourceH + .35);
        ctx.restore();
      }
      if (cue.motion === 'aperture') ctx.restore();

      // Travelling reflection is clipped to the actual glyph alpha mask.
      const s = a.sheen.getContext('2d'); s.clearRect(0, 0, a.w, a.h);
      s.globalCompositeOperation = 'source-over'; s.drawImage(a.sprite, 0, 0); s.globalCompositeOperation = 'source-in';
      const scan = ((age * .78) % 1.5 - .15) * a.w;
      const shine = s.createLinearGradient(scan - 90 * unit, 0, scan + 45 * unit, a.h);
      shine.addColorStop(0, '#ffffff00'); shine.addColorStop(.40, '#ffffff00'); shine.addColorStop(.5, '#ffffffd0');
      shine.addColorStop(.61, '#ffffff00'); shine.addColorStop(1, '#ffffff00');
      s.fillStyle = shine; s.fillRect(0, 0, a.w, a.h);
      ctx.save(); ctx.globalAlpha *= enter; ctx.globalCompositeOperation = 'screen'; ctx.drawImage(a.sheen, -a.w / 2, -a.h / 2); ctx.restore();

      // Blade of light finishes each assembly and a few shards travel outward.
      if (age < .62 && energy) {
        ctx.save(); ctx.globalAlpha *= (1 - age / .62) * .85;
        const bladeY = (age / .62 - .5) * th * 2.1;
        lightLine(ctx, -textWidth * .69, bladeY + 15 * unit, textWidth * .69, bladeY - 15 * unit, p.edge, 2 * unit);
        for (let j = 0; j < 8; j++) {
          const side = j % 2 ? 1 : -1, x = side * (textWidth * .43 + age * 125 * unit);
          const y = (j / 7 - .5) * th * 2.1;
          lightLine(ctx, x, y, x + side * 28 * unit, y - 12 * unit, j % 3 ? p.edge : p.opposite, 1.4 * unit);
        }
        ctx.restore();
      }
      // Thin rotating diamond is the signature accent; no paper, marker or star.
      ctx.save(); ctx.translate(textWidth * .55, -th * .8); ctx.rotate(Math.PI / 4 + age * .5 * energy);
      ctx.strokeStyle = p.light; ctx.lineWidth = 1.4 * unit; ctx.strokeRect(-8 * unit, -8 * unit, 16 * unit, 16 * unit);
      ctx.globalAlpha *= .35; ctx.strokeRect(-13 * unit, -13 * unit, 26 * unit, 26 * unit); ctx.restore();
      if (cue.lead) {
        ctx.save(); ctx.translate(0, -th * .90 - 30 * unit); ctx.fillStyle = p.light;
        ctx.globalAlpha *= enter; tracked(ctx, cue.lead, 22 * unit, (5 + (1 - enter) * 17 * energy) * unit); ctx.restore();
      }
      return { cueIndex: index, text: [cue.lead, cue.text].filter(Boolean).join(' '), cacheEntries: cache.size };
    } finally { ctx.restore(); ctx.fillStyle = before.fillStyle; ctx.strokeStyle = before.strokeStyle; }
  }
  return { draw, clearCache: () => cache.clear() };
}
