/** FAULT — heavy editorial type, shear, recoil and mechanical assembly.
 * Native Node Canvas only. Transparent compositing and absolute timeline seconds.
 */
const clamp = x => Math.max(0, Math.min(1, x));
const ease = p => 1 - (1 - clamp(p)) ** 5;
const punch = t => t < 0 ? 0 : Math.sin(t * 27) * Math.exp(-t * 10);
const palettes = {
  silver: { face: '#f2f2ed', lower: '#bfc5c8', side: '#485157', accent: '#af8964', panel: '#24292d' },
  copper: { face: '#d3b692', lower: '#a98660', side: '#554333', accent: '#c9d1d4', panel: '#252729' },
  inverse: { face: '#252a2d', lower: '#101619', side: '#899196', accent: '#a78059', panel: '#e0e0d7' },
};
export function createFaultRenderer({ createCanvas, cues, theme = {} }) {
  if (typeof createCanvas !== 'function' || !Array.isArray(cues)) throw new TypeError('Pass createCanvas and cues.');
  let end = -Infinity;
  for (const c of cues) {
    if (!Number.isFinite(c.start) || !Number.isFinite(c.end) || c.start < end || c.end <= c.start || typeof c.text !== 'string' || !c.text.trim())
      throw new RangeError('Cues need text and finite, ordered, non-overlapping times.');
    end = c.end;
  }
  cues = cues.map(c => ({ ...c }));
  const style = { fontFamily: 'FaultCaption', anchor: .60, width: .73, intensity: 1, ...theme };
  if (!(style.anchor >= .34 && style.anchor <= .70) || !(style.width >= .2 && style.width <= .78) || !(style.intensity >= 0 && style.intensity <= 1.3))
    throw new RangeError('Invalid anchor, width or intensity.');
  const cache = new Map(), measure = createCanvas(1, 1).getContext('2d');
  function assets(cue, index, width, height) {
    const key = `${index}:${width}:${height}`;
    if (cache.has(key)) return cache.get(key);
    const unit = Math.min(width / 1080, height / 1350);
    let size = (theme.fontSize??100) * width / 1080;
    measure.font = `${size}px "${style.fontFamily}"`;
    const m = measure.measureText(cue.text);
    size *= Math.min(1, width * style.width / (m.width + size * .08));
    measure.font = `${size}px "${style.fontFamily}"`;
    const metrics = measure.measureText(cue.text), textWidth = metrics.width;
    const pad = Math.ceil(size * .20 + 16), bodyHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    const w = Math.ceil(textWidth + pad * 2), h = Math.ceil(bodyHeight + pad * 2 + 13 * unit);
    const baseline = pad + metrics.actualBoundingBoxAscent, p = palettes[cue.tone] || palettes.silver;
    const canvas = createCanvas(w, h), c = canvas.getContext('2d');
    c.font = measure.font; c.textBaseline = 'alphabetic'; c.lineJoin = 'miter';
    c.shadowColor = '#0000009a'; c.shadowBlur = 10 * unit; c.shadowOffsetY = 15 * unit; c.shadowOffsetX = 9 * unit;
    c.fillStyle = '#070c0e'; c.fillText(cue.text, pad + 4 * unit, baseline + 8 * unit);
    c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0;
    for (let d = 9 * unit; d >= 0; d -= .8) {
      c.fillStyle = d > 7 * unit ? '#090f12' : p.side; c.fillText(cue.text, pad + d * .33, baseline + d);
    }
    const g = c.createLinearGradient(0, pad, 0, pad + bodyHeight);
    g.addColorStop(0, p.face); g.addColorStop(.8, p.face); g.addColorStop(1, p.lower);
    c.fillStyle = g; c.fillText(cue.text, pad, baseline);
    c.strokeStyle = cue.tone === 'inverse' ? '#596165' : '#ffffff60'; c.lineWidth = .85 * unit; c.strokeText(cue.text, pad, baseline);
    const ghost = createCanvas(w, h), gc = ghost.getContext('2d');
    gc.drawImage(canvas, 0, 0); gc.globalCompositeOperation = 'source-in'; gc.fillStyle = p.accent; gc.fillRect(0, 0, w, h);
    const result = { canvas, ghost, size, textWidth, bodyHeight, w, h, unit, p };
    if (cache.size >= 24) cache.delete(cache.keys().next().value);
    cache.set(key, result); return result;
  }
  function plate(ctx, w, h, color, skew) {
    ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(-w / 2 + skew, -h / 2); ctx.lineTo(w / 2 + skew, -h / 2);
    ctx.lineTo(w / 2 - skew, h / 2); ctx.lineTo(-w / 2 - skew, h / 2); ctx.closePath(); ctx.fill();
  }
  function line(ctx, x1, y1, x2, y2, color, width) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function draw(ctx, time, viewport = {}) {
    const width = viewport.width ?? ctx.canvas.width, height = viewport.height ?? ctx.canvas.height;
    if (!Number.isFinite(time) || !(width > 0 && height > 0)) throw new RangeError('Finite time and positive viewport required.');
    const index = cues.findIndex(c => time >= c.start && time < c.end); if (index < 0) return null;
    const cue = cues[index], a = assets(cue, index, width, height), { unit, size, textWidth, bodyHeight, p } = a;
    const age = time - cue.start, energy = style.intensity;
    const progress = energy ? ease(age / .26) : 1, remaining = (1 - progress) * energy;
    const exit = ease((time - cue.end + .15) / .15), direction = index % 2 ? 1 : -1;
    const hitAge = age - .16, hit = hitAge >= 0 ? Math.exp(-hitAge * 13) * energy : 0;
    const recoil = punch(hitAge) * energy;
    const secondHit = age > .64 ? punch(age - .64) * .32 * energy : 0;
    const before = { fillStyle: ctx.fillStyle, strokeStyle: ctx.strokeStyle };
    ctx.save();
    try {
      ctx.globalAlpha *= (energy ? ease(age / .045) : 1) * (1 - exit);
      ctx.beginPath(); ctx.rect(width * .025, height * .08, width * .95, height * .80); ctx.clip();
      const incoming = cue.motion === 'whip' ? direction * remaining * width * .60 : 0;
      ctx.translate(width / 2 + incoming + Math.sin(hitAge * 97) * hit * 15 * unit + exit * direction * 150 * unit * energy,
        height * style.anchor + Math.sin(hitAge * 76) * hit * 8 * unit - exit * 70 * unit * energy);
      ctx.rotate((index % 2 ? -.015 : .012) + recoil * -.04);
      let sx = 1 + recoil * .085 + secondHit * .045, sy = 1 - recoil * .12;
      if (cue.motion === 'slam') { sx *= 1 + remaining * .46; sy *= 1 + remaining * .46; }
      ctx.scale(sx, sy);

      // A second solid slab catches up behind the main panel, suggesting mass.
      const panelW = textWidth + size * .15, panelH = bodyHeight + size * .23;
      ctx.save(); ctx.translate(12 * unit + remaining * -70 * unit, 14 * unit + remaining * 30 * unit);
      plate(ctx, panelW, panelH, '#080c10a8', size * .055); ctx.restore();
      ctx.save(); ctx.translate(0, -3 * unit);
      plate(ctx, panelW, panelH, p.panel, size * .055);
      // A single razor-thin edge picks out the slab without decorative borders.
      line(ctx, -panelW / 2 + size * .055, -panelH / 2, panelW / 2 + size * .055, -panelH / 2,
        cue.tone === 'inverse' ? '#fffef2' : '#70787b80', 1.4 * unit);
      ctx.restore();

      // Speed ghosts follow the actual direction of travel and disappear rapidly.
      if (age < .32 && energy) {
        for (let j = 3; j >= 1; j--) {
          ctx.save(); ctx.globalAlpha *= remaining * (.12 / j);
          ctx.translate(-direction * j * 38 * unit, j * 2 * unit);
          ctx.drawImage(a.ghost, -a.w / 2, -a.h / 2); ctx.restore();
        }
      }
      ctx.save(); ctx.transform(1, 0, -.10, 1, 0, 0);
      if (cue.motion === 'split') {
        // Upper and lower word halves collide from opposite directions.
        for (let k = 0; k < 2; k++) {
          const sign = k ? 1 : -1, sourceY = k * a.h / 2;
          const dx = sign * (remaining * 190 + exit * 160 * energy) * unit;
          const dy = sign * remaining * 16 * unit;
          ctx.drawImage(a.canvas, 0, sourceY, a.w, a.h / 2,
            -a.w / 2 + dx, -a.h / 2 + sourceY + dy, a.w, a.h / 2 + .3);
        }
      } else if (cue.motion === 'crush') {
        // Narrow vertical segments slam closed with small per-segment delays.
        const columns = 8;
        for (let k = 0; k < columns; k++) {
          const local = Math.max(0, age - k * .012), q = energy ? ease(local / .23) : 1;
          const sourceX = k * a.w / columns, colW = a.w / columns;
          const x = -a.w / 2 + sourceX, y = (k % 2 ? 1 : -1) * (1 - q) * size * .75;
          ctx.save(); ctx.translate(x + colW / 2, y);
          const scale = Math.max(.06, q + punch(local - .14) * .09 * energy);
          ctx.scale(scale, 1 + (1 - q) * .28);
          ctx.drawImage(a.canvas, sourceX, 0, colW, a.h, -colW / 2, -a.h / 2, colW + .3, a.h); ctx.restore();
        }
      } else {
        const stretch = cue.motion === 'whip' ? 1 + remaining * .25 : 1;
        ctx.scale(stretch, 1 / stretch); ctx.drawImage(a.canvas, -a.w / 2, -a.h / 2);
      }
      ctx.restore();

      // The accent rail follows the word with a delayed, hard stop.
      const rail = energy ? ease((age - .09) / .20) : 1;
      const railY = panelH / 2 + 15 * unit;
      ctx.fillStyle = p.accent; ctx.fillRect(-panelW / 2, railY, panelW * rail, 8 * unit);
      ctx.fillStyle = '#161c20'; ctx.fillRect(-panelW / 2 + panelW * .68, railY, panelW * .045, 8 * unit);
      ctx.fillRect(-panelW / 2 + panelW * .74, railY, panelW * .012, 8 * unit);
      // One small second impact adds tension during longer holds.
      if (secondHit > .01) {
        ctx.save(); ctx.globalAlpha *= secondHit;
        ctx.fillStyle = '#f4f4ee'; ctx.fillRect(-panelW / 2, railY, panelW, 2 * unit); ctx.restore();
      }
      // Opposing side brackets compress in towards the word on impact.
      const gap = 25 * unit + remaining * 42 * unit;
      const bx = panelW / 2 + gap, bh = panelH * .65;
      ctx.save(); ctx.globalAlpha *= .65;
      for (const side of [-1, 1]) {
        line(ctx, side * bx, -bh / 2, side * bx, bh / 2, p.accent, 3 * unit);
        line(ctx, side * bx, -bh / 2, side * (bx - 10 * unit), -bh / 2, p.accent, 3 * unit);
        line(ctx, side * bx, bh / 2, side * (bx - 10 * unit), bh / 2, p.accent, 3 * unit);
      }
      ctx.restore();
      if (hitAge >= 0 && hitAge < .24 && energy) {
        ctx.save(); ctx.globalAlpha *= (1 - hitAge / .24) * .55;
        // Sparse short lines communicate the impact without a particle shower.
        for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
          const x = side * (panelW / 2 + 12 * unit + hitAge * 130 * unit), y = (k - 1) * 37 * unit;
          line(ctx, x, y, x + side * 30 * unit, y + (k - 1) * 10 * unit, '#ccd0cb', (k === 1 ? 3 : 1.5) * unit);
        }
        ctx.restore();
      }
      if (cue.lead) {
        ctx.save(); ctx.translate(-textWidth / 2 + 4 * unit, -panelH / 2 - 37 * unit - remaining * 24 * unit);
        ctx.font = `${size * .24}px "${style.fontFamily}"`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        ctx.fillStyle = '#e5e5dd'; ctx.fillText(cue.lead, 0, 0);
        const leadW = ctx.measureText(cue.lead).width;
        line(ctx, leadW + 22 * unit, 0, leadW + 70 * unit, 0, p.accent, 4 * unit); ctx.restore();
      }
      return { cueIndex: index, text: [cue.lead, cue.text].filter(Boolean).join(' '), cacheEntries: cache.size };
    } finally { ctx.restore(); ctx.fillStyle = before.fillStyle; ctx.strokeStyle = before.strokeStyle; }
  }
  return { draw, clearCache: () => cache.clear() };
}
