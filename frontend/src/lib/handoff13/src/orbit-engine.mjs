/** ORBIT CARNIVAL — procedural kinetic typography for native Node Canvas.
 * Absolute seconds, bounded sprite cache, no DOM, CSS or image files.
 */
const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => 1 - (1 - clamp(x)) ** 4;
const random = n => { const x = Math.sin(n * 91.7 + 34.2) * 42713.13; return x - Math.floor(x); };
const palettes = {
  acid: { face: '#e3ff65', light: '#ffffdc', side: '#4942af', plate: '#7442ef', ring: '#ff7d86', other: '#b8fff0' },
  coral: { face: '#fff0d6', light: '#fffff4', side: '#8b337a', plate: '#fa715b', ring: '#ccff6a', other: '#ab96ff' },
  violet: { face: '#f0dfff', light: '#ffffff', side: '#3c529c', plate: '#7755d9', ring: '#a9f794', other: '#ff939a' },
};
export function createOrbitRenderer({ createCanvas, cues, theme = {} }) {
  if (typeof createCanvas !== 'function' || !Array.isArray(cues)) throw new TypeError('Pass createCanvas and cues.');
  let end = -Infinity;
  for (const c of cues) {
    if (!Number.isFinite(c.start) || !Number.isFinite(c.end) || c.start < end || c.end <= c.start || typeof c.text !== 'string' || !c.text.trim())
      throw new RangeError('Cues require text and finite, ordered, non-overlapping times.');
    end = c.end;
  }
  cues = cues.map(c => ({ ...c }));
  const style = { fontFamily: 'OrbitCaption', anchor: .59, width: .71, intensity: 1, ...theme };
  if (!(style.anchor >= .35 && style.anchor <= .70) || !(style.width >= .2 && style.width <= .78) || !(style.intensity >= 0 && style.intensity <= 1.3))
    throw new RangeError('Invalid anchor, width or intensity.');
  const cache = new Map(), measure = createCanvas(1, 1).getContext('2d');
  function assets(cue, index, width, height) {
    const key = `${index}:${width}:${height}`;
    if (cache.has(key)) return cache.get(key);
    const unit = Math.min(width / 1080, height / 1350);
    let size = (theme.fontSize??100) * width / 1080;
    measure.font = `900 ${size}px "${style.fontFamily}"`;
    const letters = Array.from(cue.text);
    let total = measure.measureText(cue.text).width + size * .03 * (letters.length - 1);
    size *= Math.min(1, width * style.width / total);
    measure.font = `900 ${size}px "${style.fontFamily}"`;
    total = measure.measureText(cue.text).width + size * .03 * (letters.length - 1);
    const p = palettes[cue.tone] || palettes.acid;
    const sprites = letters.map((char, j) => {
      const metrics = measure.measureText(char), pad = Math.ceil(size * .23 + 5);
      const canvas = createCanvas(Math.ceil(metrics.width + pad * 2), Math.ceil(size * 1.45 + pad * 2));
      const c = canvas.getContext('2d'), y = pad + size * 1.02;
      c.font = measure.font; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
      c.strokeStyle = '#201337'; c.lineWidth = size * .064;
      c.shadowColor = '#100919aa'; c.shadowBlur = size * .07; c.shadowOffsetY = size * .05;
      c.strokeText(char, pad + size * .028, y + size * .072); c.shadowBlur = 0; c.shadowOffsetY = 0;
      for (let d = size * .075; d >= 0; d -= 1) { c.fillStyle = p.side; c.fillText(char, pad + d * .35, y + d); }
      c.strokeStyle = '#241b3d'; c.lineWidth = size * .043; c.strokeText(char, pad, y);
      const g = c.createLinearGradient(0, y - size, 0, y);
      g.addColorStop(0, p.light); g.addColorStop(.35, p.face); g.addColorStop(1, p.face);
      c.fillStyle = g; c.fillText(char, pad, y);
      return { canvas, width: metrics.width, ox: pad, oy: y,
        x: measure.measureText(letters.slice(0, j).join('')).width + j * size * .03 - total / 2 };
    });
    const result = { sprites, total, size, unit, p };
    if (cache.size >= 24) cache.delete(cache.keys().next().value);
    cache.set(key, result); return result;
  }
  function rosette(ctx, rx, ry, phase, color) {
    ctx.fillStyle = color; ctx.beginPath();
    for (let j = 0; j <= 160; j++) {
      const a = j / 160 * Math.PI * 2, wave = 1 + Math.sin(a * 9 + phase) * .065;
      const x = Math.cos(a) * rx * wave, y = Math.sin(a) * ry * wave;
      if(j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.fill();
  }
  function ring(ctx, total, size, age, p, unit, front, energy) {
    const tilt = -.23 + Math.sin(age * .9) * .09 * energy;
    const rx = total * .53 + 22 * unit, ry = size * 1.08;
    const points = 96;
    ctx.save(); ctx.translate(0, -size * .38); ctx.rotate(tilt);
    const opacity = ctx.globalAlpha;
    for (let j = 0; j < points; j++) {
      const angle = j / points * Math.PI * 2, depth = Math.sin(angle);
      if ((depth >= 0) !== front) continue;
      const next = angle + Math.PI * 2 / points;
      const highlight = (Math.cos(angle - .7 + age * .3 * energy) + 1) / 2;
      ctx.strokeStyle = highlight > .87 ? '#fffbec' : p.ring;
      ctx.globalAlpha = opacity * (front ? .95 : .30);
      ctx.lineWidth = (front ? 8 : 5) * unit; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(Math.cos(angle) * rx, Math.sin(angle) * ry); ctx.lineTo(Math.cos(next) * rx, Math.sin(next) * ry); ctx.stroke();
      if ((j + Math.floor(age * 13 * energy)) % 6 === 0) {
        ctx.strokeStyle = '#211532'; ctx.lineWidth = 2 * unit;
        ctx.beginPath(); ctx.moveTo(Math.cos(angle) * (rx - 4 * unit), Math.sin(angle) * (ry - 4 * unit));
        ctx.lineTo(Math.cos(angle) * (rx + 4 * unit), Math.sin(angle) * (ry + 4 * unit)); ctx.stroke();
      }
    }
    // Glossy satellites move around the same ellipse with correct front/back order.
    for (let k = 0; k < 3; k++) {
      const a = age * .85 * energy + k * Math.PI * 2 / 3, depth = Math.sin(a);
      if ((depth >= 0) !== front) continue;
      const x = Math.cos(a) * rx, y = Math.sin(a) * ry, r = (10 + (depth + 1) * 3) * unit;
      const g = ctx.createRadialGradient(x - r * .35, y - r * .45, 0, x, y, r);
      g.addColorStop(0, '#fffff1'); g.addColorStop(.35, p.other); g.addColorStop(1, p.side);
      ctx.globalAlpha = opacity * (front ? 1 : .4); ctx.fillStyle = g; ctx.shadowColor = '#10041f80'; ctx.shadowBlur = 7 * unit;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
    ctx.restore();
  }
  function flower(ctx, x, y, r, age, color, unit) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(age * .9);
    for (let j = 0; j < 6; j++) {
      ctx.save(); ctx.rotate(j * Math.PI / 3); ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(r * .46, 0, r * .58, r * .23, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.fillStyle = '#211735'; ctx.beginPath(); ctx.arc(0, 0, 5 * unit, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function draw(ctx, time, viewport = {}) {
    const width = viewport.width ?? ctx.canvas.width, height = viewport.height ?? ctx.canvas.height;
    if (!Number.isFinite(time) || !(width > 0 && height > 0)) throw new RangeError('Finite time and positive viewport required.');
    const index = cues.findIndex(c => time >= c.start && time < c.end); if (index < 0) return null;
    const cue = cues[index], a = assets(cue, index, width, height), { sprites, size, total, unit, p } = a;
    const age = time - cue.start, energy = style.intensity;
    const enter = energy ? ease(age / .44) : 1, exit = ease((time - cue.end + .18) / .18);
    const impulse = Math.exp(-age * 8) * energy;
    const before = { fillStyle: ctx.fillStyle, strokeStyle: ctx.strokeStyle };
    ctx.save();
    try {
      ctx.globalAlpha *= (energy ? ease(age / .07) : 1) * (1 - exit);
      ctx.beginPath(); ctx.rect(width * .025, height * .08, width * .95, height * .80); ctx.clip();
      ctx.translate(width / 2 + Math.sin(age * 80) * impulse * 8 * unit,
        height * style.anchor + Math.sin(age * 1.7) * 8 * unit * energy);
      ctx.rotate((index % 2 ? .025 : -.035) + Math.sin(age * 17) * impulse * .055);
      ring(ctx, total, size, age, p, unit, false, energy);

      // The backplate is a breathing scalloped badge, not a rectangular highlight.
      ctx.save(); ctx.translate(0, -size * .37);
      const pop = 1 + Math.sin(age * 18) * Math.exp(-age * 6) * .15 * energy;
      ctx.rotate(Math.sin(age * 1.1) * .045 * energy); ctx.scale(pop, pop);
      ctx.shadowColor = '#11082090'; ctx.shadowBlur = 22 * unit; ctx.shadowOffsetY = 12 * unit;
      rosette(ctx, total * .55, size * .80, age * 2 * energy, p.plate);
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.globalAlpha *= .13; ctx.strokeStyle = '#fff7ec'; ctx.lineWidth = 1.5 * unit;
      for (let k = -5; k <= 5; k++) {
        ctx.beginPath(); ctx.ellipse(k * total * .043, 0, total * .12, size * .74, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();

      // Tunnel copies retreat before the solid face arrives.
      if (cue.motion === 'tunnel' && age < .62 && energy) {
        ctx.save(); ctx.font = `900 ${size}px "${style.fontFamily}"`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.strokeStyle = p.other; ctx.lineWidth = 1.5 * unit;
        for (let k = 4; k > 0; k--) {
          ctx.save(); ctx.globalAlpha *= (1 - age / .62) * .26;
          ctx.scale(1 + k * .10 * (1 - enter), 1 + k * .17 * (1 - enter));
          ctx.translate(0, -k * 17 * unit * (1 - enter)); ctx.strokeText(cue.text, 0, 0); ctx.restore();
        }
        ctx.restore();
      }
      sprites.forEach((s, j) => {
        const local = Math.max(0, age - Math.min(j * .018, .13)), q = energy ? ease(local / .42) : 1;
        const theta = j / sprites.length * Math.PI * 2 + local * 5;
        const remaining = (1 - q) * energy, outward = exit * energy;
        let x = s.x + s.width / 2, y = 0, angle = 0, sx = 1, sy = 1;
        if (cue.motion === 'orbit') {
          x += Math.cos(theta) * total * .30 * remaining;
          y += Math.sin(theta) * size * 1.25 * remaining;
          angle = remaining * (j % 2 ? .85 : -.85);
        } else if (cue.motion === 'pinwheel') {
          x += Math.cos(theta) * size * .7 * remaining;
          y -= size * 1.7 * remaining;
          angle = remaining * (j % 2 ? 2.7 : -2.7);
        } else if (cue.motion === 'wave') {
          y = Math.sin(local * 16 + j * .7) * size * .35 * Math.exp(-local * 3.7) * energy;
          sx = 1 + Math.sin(local * 17) * Math.exp(-local * 5) * .10 * energy; sy = 1 / sx;
        } else {
          sx = sy = 1 + remaining * .75; y -= remaining * size * .6;
        }
        x += (j - (sprites.length - 1) / 2) * outward * size * .17;
        y += Math.sin(j * 2) * outward * size * .5;
        const settle = Math.sin(local * 19) * Math.exp(-local * 5.5) * energy;
        y -= settle * size * .08;
        // Slightly arched baseline gives a carnival sign silhouette.
        y += Math.sin(j / Math.max(1, sprites.length - 1) * Math.PI) * -size * .055;
        ctx.save(); ctx.globalAlpha *= energy ? ease(local / .065) : 1;
        ctx.translate(x, y); ctx.rotate(angle); ctx.scale(sx, sy);
        ctx.drawImage(s.canvas, -s.ox - s.width / 2, -s.oy); ctx.restore();
      });

      ring(ctx, total, size, age, p, unit, true, energy);
      flower(ctx, -total * .48, -size * 1.18, 28 * unit, age * energy, p.ring, unit);
      flower(ctx, total * .48, size * .50, 24 * unit, -age * energy, p.other, unit);
      // Elliptical eye-shaped accent blinks on landing, then follows the motion.
      ctx.save(); ctx.translate(total * .43, -size * 1.25); ctx.rotate(.17);
      const blink = age < .22 ? .1 + enter * .9 : 1;
      ctx.scale(1, blink); ctx.fillStyle = '#fffce8'; ctx.beginPath(); ctx.ellipse(0, 0, 30 * unit, 17 * unit, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#201735'; ctx.beginPath(); ctx.arc(Math.sin(age * 2) * 6 * unit * energy, 0, 8 * unit, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      if (cue.lead) {
        ctx.save(); ctx.translate(0, -size * 1.28 - (1 - enter) * 35 * unit);
        ctx.rotate(-.025); ctx.font = `900 ${size * .26}px "${style.fontFamily}"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const w = ctx.measureText(cue.lead).width + 34 * unit;
        ctx.fillStyle = '#fff7df'; ctx.shadowColor = '#120c2466'; ctx.shadowBlur = 8 * unit; ctx.shadowOffsetY = 4 * unit;
        ctx.beginPath(); ctx.roundRect(-w / 2, -size * .22, w, size * .44, size * .22); ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.fillStyle = '#271a3b'; ctx.fillText(cue.lead, 0, 0); ctx.restore();
      }
      if (age < .50 && energy) {
        ctx.save(); ctx.globalAlpha *= (1 - age / .5) ** 1.4;
        for (let k = 0; k < 12; k++) {
          const theta = k / 12 * Math.PI * 2, distance = .5 + ease(age / .5) * .10;
          const x = Math.cos(theta) * total * distance, y = -size * .4 + Math.sin(theta) * size * (1.05 + age * .5);
          ctx.save(); ctx.translate(x, y); ctx.rotate(theta + age * 4);
          ctx.fillStyle = k % 2 ? p.other : p.ring;
          ctx.fillRect(0, 0, (9 + random(k + index) * 13) * unit, 4 * unit); ctx.restore();
        }
        ctx.restore();
      }
      return { cueIndex: index, text: [cue.lead, cue.text].filter(Boolean).join(' '), cacheEntries: cache.size };
    } finally { ctx.restore(); ctx.fillStyle = before.fillStyle; ctx.strokeStyle = before.strokeStyle; }
  }
  return { draw, clearCache: () => cache.clear() };
}
