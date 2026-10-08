/** Kinetic paper / print collage captions. Native canvas; no DOM or CSS.
 * Draw after your video frame. Absolute time in seconds, bounded texture cache.
 */
const clamp = v => Math.max(0, Math.min(1, v));
const ease = p => 1 - (1 - clamp(p)) ** 4;
const random = n => { const v = Math.sin(n * 127.1 + 94.6) * 43758.5453; return v - Math.floor(v); };
const C = { paper: '#f4efdF', ink: '#172025', orange: '#ff663b', lime: '#ddf35c', blue: '#3469d0' };

function validate(cues) {
  let end = -Infinity;
  if (!Array.isArray(cues)) throw new TypeError('cues must be an array.');
  for (const cue of cues) {
    if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.end <= cue.start || cue.start < end || !cue.text?.trim())
      throw new RangeError('Cues need text and finite, ordered, non-overlapping times.');
    end = cue.end;
  }
}

export function createCutoutRenderer({ createCanvas, cues, theme = {} }) {
  if (typeof createCanvas !== 'function') throw new TypeError('Pass native createCanvas.');
  validate(cues); cues = cues.map(c => ({ ...c }));
  const settings = { fontFamily: 'ImpactCaption', anchor: .62, width: .76, intensity: 1, ...theme };
  if (!(settings.anchor >= .3 && settings.anchor <= .75) || !(settings.width >= .2 && settings.width <= .82) || !(settings.intensity >= 0 && settings.intensity <= 1.3))
    throw new RangeError('Invalid anchor, width or intensity.');
  const cache = new Map(), measure = createCanvas(1, 1).getContext('2d');

  function torn(ctx, x, y, w, h, seed) {
    ctx.beginPath();
    const n = Math.max(5, Math.ceil(w / 13));
    for (let k = 0; k <= n; k++) {
      const px = x + k / n * w, py = y + (random(seed + k) - .5) * 4;
      if(k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.lineTo(x + w + 2, y + h * .53);
    for (let k = n; k >= 0; k--) ctx.lineTo(x + k / n * w, y + h + (random(seed + k + 97) - .5) * 5);
    ctx.lineTo(x - 2, y + h * .4); ctx.closePath();
  }
  function texture(ctx, x, y, w, h, seed, dark = false) {
    ctx.fillStyle = dark ? '#fff9e615' : '#35241112';
    for (let k = 0; k < Math.floor(w * h / 95); k++) {
      const px = x + random(seed + k * 3) * w, py = y + random(seed + k * 3 + 1) * h;
      ctx.fillRect(px, py, .7 + random(k) * 1.7, .7 + random(k + 4));
    }
  }
  function tile(char, size, fill, ink, seed) {
    measure.font = `${size}px "${settings.fontFamily}"`;
    const m = measure.measureText(char), pad = size * .10;
    const w = Math.ceil(m.width + pad * 2), h = Math.ceil(size * 1.28), margin = 20;
    const canvas = createCanvas(w + margin * 2, h + margin * 2), ctx = canvas.getContext('2d');
    ctx.fillStyle = '#060a1090'; torn(ctx, margin + 7, margin + 10, w, h, seed); ctx.fill();
    ctx.fillStyle = fill; torn(ctx, margin, margin, w, h, seed); ctx.fill();
    ctx.save(); ctx.clip(); texture(ctx, margin, margin, w, h, seed, fill === C.ink);
    ctx.font = `${size}px "${settings.fontFamily}"`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = ink;
    // Baseline uses actual glyph bounds to preserve accented letters.
    const baseline = margin + (h - m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2 + m.actualBoundingBoxAscent;
    ctx.fillText(char, margin + w / 2, baseline);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = fill === C.ink ? '#f4efdf35' : '#f4efdf60';
    for (let k = 0; k < 6; k++) ctx.fillRect(margin, margin + random(seed + 700 + k) * h, w, .45);
    ctx.restore();
    return { canvas, w, h, ox: margin + w / 2, oy: margin + h / 2 };
  }
  function assets(cue, index, width, height) {
    const key = `${index}:${width}:${height}`;
    if (cache.has(key)) return cache.get(key);
    const unit = Math.min(width / 1280, height / 720);
    let size = (theme.fontSize??100) * width / 1080;
    measure.font = `${size}px "${settings.fontFamily}"`;
    const letters = Array.from(cue.text);
    const space = size * .10;
    let total = measure.measureText(cue.text).width + letters.length * size * .20 + (letters.length - 1) * space;
    if (cue.layout !== 'tiles') total = measure.measureText(cue.text).width + size * .45;
    size *= Math.min(1, width * settings.width / total);
    measure.font = `${size}px "${settings.fontFamily}"`;
    let result;
    if (cue.layout === 'tiles') {
      let x = 0;
      const tiles = letters.map((char, j) => {
        const fill = j === 1 ? C.orange : j === letters.length - 2 ? C.ink : C.paper;
        const ink = fill === C.ink ? C.paper : C.ink;
        const sprite = tile(char, size, fill, ink, index * 100 + j * 19);
        const entry = { ...sprite, x: x + sprite.w / 2, tilt: (random(j + index * 21) - .5) * .14 };
        x += sprite.w + size * .09; return entry;
      });
      total = x - size * .09;
      tiles.forEach(t => { t.x -= total / 2; });
      result = { tiles, size, total, h: size * 1.28, unit };
    } else {
      const sprite = tile(cue.text, size, cue.layout === 'banner' ? C.ink : C.paper,
        cue.layout === 'banner' ? C.paper : C.orange, index * 93);
      result = { sprite, size, total: sprite.w, h: sprite.h, unit };
    }
    if (cache.size >= 18) cache.delete(cache.keys().next().value);
    cache.set(key, result); return result;
  }
  function tape(ctx, x, y, w, h, angle, color, seed) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = color; torn(ctx, -w / 2, -h / 2, w, h, seed); ctx.fill();
    ctx.strokeStyle = '#17202522'; ctx.lineWidth = 1;
    for (let i = -w / 2; i < w / 2; i += 7) {
      ctx.beginPath(); ctx.moveTo(i, -h / 2); ctx.lineTo(i + h, h / 2); ctx.stroke();
    }
    ctx.restore();
  }
  function pen(ctx, points, color, lineWidth) {
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke();
  }

  function draw(ctx, time, viewport = {}) {
    const width = viewport.width ?? ctx.canvas.width, height = viewport.height ?? ctx.canvas.height;
    if (!Number.isFinite(time) || !(width > 0 && height > 0)) throw new RangeError('Finite time and positive viewport required.');
    const index = cues.findIndex(c => time >= c.start && time < c.end); if (index < 0) return null;
    const cue = cues[index], a = assets(cue, index, width, height), { size, unit, total, h } = a;
    const age = time - cue.start, energy = settings.intensity;
    const exit = ease((time - cue.end + .15) / .15);
    const impact = Math.exp(-age * 8) * energy;
    const holdTick = Math.floor(age * 12);
    const shake = Math.sin(age * 79) * impact * 12 * unit;
    const callerPaint = { fillStyle: ctx.fillStyle, strokeStyle: ctx.strokeStyle };
    ctx.save();
    try {
      ctx.globalAlpha *= (energy ? ease(age / .06) : 1) * (1 - exit);
      ctx.beginPath(); ctx.rect(width * .02, height * .06, width * .96, height * .91); ctx.clip();
      ctx.translate(width / 2 + shake + exit * width * .15 * energy,
        height * settings.anchor + Math.cos(age * 61) * impact * 8 * unit);
      ctx.rotate((index % 2 ? .025 : -.025) * energy + exit * .09 * energy);
      const p = energy ? ease(age / .32) : 1;

      // Halftone print shadow, offset from the paper and visible through gaps.
      ctx.save(); ctx.globalAlpha *= .38; ctx.fillStyle = C.paper;
      for (let x = -total / 2 + 15 * unit; x < total / 2 + 25 * unit; x += 10 * unit)
        for (let y = -h * .35; y < h * .62; y += 10 * unit) {
          ctx.beginPath(); ctx.arc(x, y, 1.35 * unit, 0, Math.PI * 2); ctx.fill();
        }
      ctx.restore();

      // A fluorescent strip and black offset sheet create physical layering.
      tape(ctx, 0, h * .12, total * (.4 + .66 * p), h * .80, -.065, C.lime, index * 50);
      if (age < .56 && energy) {
        ctx.save(); ctx.globalAlpha *= (1 - age / .56) * .6;
        for (let j = 0; j < 16; j++) {
          const theta = j / 16 * Math.PI * 2;
          const x = Math.cos(theta) * (total * .44 + age * 95 * unit);
          const y = Math.sin(theta) * (h * .60 + age * 50 * unit);
          ctx.save(); ctx.translate(x, y); ctx.rotate(theta + age * 3);
          ctx.fillStyle = j % 3 === 0 ? C.orange : j % 3 === 1 ? C.paper : C.blue;
          ctx.fillRect(0, 0, (8 + random(j) * 19) * unit, (3 + random(j + 5) * 6) * unit); ctx.restore();
        }
        ctx.restore();
      }

      if (a.tiles) {
        a.tiles.forEach((tile, j) => {
          const local = Math.max(0, age - j * .018), q = energy ? ease(local / .37) : 1;
          const spring = Math.sin(local * 20) * Math.exp(-local * 6) * energy;
          ctx.save(); ctx.globalAlpha *= energy ? ease(local / .07) : 1;
          const displacement = (j % 2 ? -1 : 1) * (1 - q) * h * .9 * energy;
          ctx.translate(tile.x + (1 - q) * (j - a.tiles.length / 2) * 18 * unit * energy,
            displacement - spring * h * .18 + (random(holdTick + j * 90) - .5) * .9 * unit * energy);
          ctx.rotate(tile.tilt + (1 - q) * (j % 2 ? .8 : -.65) * energy + spring * .1);
          ctx.scale(Math.max(.2, 1 - (1 - q) * .8 * energy), 1 + spring * .13);
          ctx.drawImage(tile.canvas, -tile.ox, -tile.oy); ctx.restore();
        });
      } else {
        const spring = Math.sin(age * 20) * Math.exp(-age * 6) * energy;
        ctx.save();
        if (cue.layout === 'banner') {
          ctx.translate(-(1 - p) * total * .5 * energy, 0); ctx.rotate(.045 - spring * .09);
          ctx.scale(1 + spring * .11, 1 - spring * .15);
        } else {
          const zoom = 1 + (1 - p) * .55 * energy;
          ctx.rotate(-.05 + (1 - p) * .22 * energy); ctx.scale(zoom, zoom);
        }
        ctx.drawImage(a.sprite.canvas, -a.sprite.ox, -a.sprite.oy);
        if (cue.layout === 'stamp') {
          // Double printed frame has small broken sections like an ink stamp.
          ctx.strokeStyle = C.orange; ctx.lineWidth = 2.5 * unit;
          ctx.strokeRect(-total / 2 + 9 * unit, -h / 2 + 9 * unit, total - 18 * unit, h - 18 * unit);
          ctx.globalAlpha *= .4; ctx.lineWidth = unit;
          ctx.strokeRect(-total / 2 + 5 * unit, -h / 2 + 5 * unit, total - 10 * unit, h - 10 * unit);
        }
        ctx.restore();
      }

      // Tape arrives independently a beat later and lands on the paper corners.
      const tp = energy ? ease((age - .1) / .22) : 1;
      ctx.save(); ctx.globalAlpha *= tp;
      tape(ctx, -total * .43, -h * .5 - (1 - tp) * 40 * unit, 92 * unit, 27 * unit, -.23, '#8dacffde', index + 3);
      tape(ctx, total * .44, h * .45 + (1 - tp) * 40 * unit, 80 * unit, 24 * unit, -.28, '#ff9b7be8', index + 8);
      ctx.restore();

      if (cue.lead) {
        ctx.save(); ctx.translate(-total * .34, -h * .81 - (1 - p) * 35 * unit); ctx.rotate(-.06);
        ctx.font = `${size * .30}px "${settings.fontFamily}"`;
        const w = ctx.measureText(cue.lead).width + 26 * unit;
        ctx.fillStyle = C.orange; torn(ctx, -w / 2, -size * .25, w, size * .4, index); ctx.fill();
        ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(cue.lead, 0, -size * .05); ctx.restore();
      }

      // Hand-marked circle and cross are drawn in rather than appearing at once.
      const mark = energy ? ease((age - .16) / .34) : 1;
      if (cue.layout === 'stamp') {
        ctx.save(); ctx.rotate(.02); ctx.strokeStyle = C.paper; ctx.lineWidth = 3 * unit;
        ctx.beginPath(); ctx.ellipse(0, 0, total * .55, h * .76, -.025, -.4, -.4 + Math.PI * 2 * mark); ctx.stroke(); ctx.restore();
      } else {
        const x = total * .49, y = -h * .85;
        pen(ctx, [[x - 36 * unit, y - 2 * unit], [x - 4 * unit, y - 17 * unit], [x + 19 * unit * mark, y + 10 * unit]], C.paper, 4 * unit);
        pen(ctx, [[x + 15 * unit, y - 12 * unit], [x + 19 * unit, y + 10 * unit], [x - 4 * unit, y + 7 * unit]], C.paper, 4 * unit);
      }
      const crossX = -total * .54, crossY = h * .60;
      pen(ctx, [[crossX - 9 * unit, crossY - 9 * unit], [crossX + 9 * unit, crossY + 9 * unit]], C.orange, 4 * unit);
      pen(ctx, [[crossX + 9 * unit, crossY - 9 * unit], [crossX - 9 * unit, crossY + 9 * unit]], C.orange, 4 * unit);
      return { cueIndex: index, text: [cue.lead, cue.text].filter(Boolean).join(' '), cacheEntries: cache.size };
    } finally { ctx.restore(); ctx.fillStyle = callerPaint.fillStyle; ctx.strokeStyle = callerPaint.strokeStyle; }
  }
  return { draw, clearCache: () => cache.clear() };
}
