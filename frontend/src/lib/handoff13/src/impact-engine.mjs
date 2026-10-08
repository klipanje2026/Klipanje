/** Aggressive kinetic captions. Native Canvas only; time is in seconds.
 * Call draw(ctx, time) after drawing a video frame, or on a clear RGBA canvas.
 * Texture caches are bounded. All animation is deterministic and seekable.
 */
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = v => 1 - (1 - clamp(v)) ** 4;
const rand = n => { const x = Math.sin(n * 127.1 + 17.7) * 43758.5453; return x - Math.floor(x); };
const palettes = {
  lime: { top: '#ffffee', mid: '#eaff64', bottom: '#aaf01e', side: '#246787', rim: '#4cdded', plate: '#ff4baf' },
  pink: { top: '#fff5ff', mid: '#ffbcf0', bottom: '#ff55bd', side: '#5732a2', rim: '#a681ff', plate: '#ddff39' },
  ice: { top: '#ffffff', mid: '#f4feff', bottom: '#89edff', side: '#2849a7', rim: '#668cff', plate: '#965aff' },
};
// Same motion preset with a quieter steel, ivory and champagne colourway.
const refinedPalettes = {
  lime: { top: '#fffffc', mid: '#f5f4ed', bottom: '#d7dfdf', side: '#34485d', rim: '#8ba4b8', plate: '#416b91' },
  pink: { top: '#fffaf0', mid: '#f1e3c5', bottom: '#d8b879', side: '#495871', rim: '#8f9fb3', plate: '#365675' },
  ice: { top: '#ffffff', mid: '#f0f5fb', bottom: '#c3d7e9', side: '#304760', rim: '#789ab9', plate: '#b79565' },
};

export function createImpactRenderer({ createCanvas, cues, theme = {} }) {
  if (typeof createCanvas !== 'function') throw new TypeError('Pass a native createCanvas factory.');
  if (!Array.isArray(cues)) throw new TypeError('cues must be an array.');
  let end = -Infinity;
  for (const c of cues) {
    if (!Number.isFinite(c.start) || !Number.isFinite(c.end) || c.start < end || c.end <= c.start || typeof c.text !== 'string' || !c.text.trim())
      throw new RangeError('Cues require text and finite, ordered, non-overlapping start/end times.');
    end = c.end;
  }
  cues = cues.map(c => ({ ...c }));
  const style = { fontFamily: 'ImpactCaption', anchor: .67, width: .75, intensity: 1, ...theme };
  if (!(style.width > .1 && style.width <= .86) || !(style.anchor >= .35 && style.anchor <= .78) || !(style.intensity >= 0 && style.intensity <= 1.3))
    throw new RangeError('Invalid width, anchor or intensity.');
  const cache = new Map();
  const measure = createCanvas(1, 1).getContext('2d');

  function glyph(char, size, palette, depth) {
    measure.font = `${size}px "${style.fontFamily}"`;
    const metrics = measure.measureText(char), pad = Math.ceil(size * .30);
    const width = Math.ceil(metrics.width + pad * 2 + depth * .65);
    const height = Math.ceil(size * 1.3 + pad * 2 + depth);
    const canvas = createCanvas(width, height), ctx = canvas.getContext('2d');
    ctx.font = `${size}px "${style.fontFamily}"`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    const x = pad, y = pad + size;
    // Many closely spaced slices make a solid extrusion, including counters.
    ctx.strokeStyle = '#090916'; ctx.lineWidth = size * .065;
    ctx.shadowColor = '#00000095'; ctx.shadowBlur = size * .055; ctx.shadowOffsetY = size * .035;
    ctx.strokeText(char, x + depth * .6, y + depth);
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    for (let d = depth; d >= 0; d -= .8) {
      ctx.strokeStyle = '#11101f'; ctx.lineWidth = size * .055;
      ctx.strokeText(char, x + d * .6, y + d);
    }
    for (let d = depth; d >= 0; d -= .8) {
      const side = ctx.createLinearGradient(0, y - size, 0, y + depth);
      side.addColorStop(0, palette.rim); side.addColorStop(.55, palette.side); side.addColorStop(1, palette.rim);
      ctx.fillStyle = d > depth * .84 ? palette.rim : side;
      ctx.fillText(char, x + d * .6, y + d);
    }
    // Lit outer bevel, darker lower lip, then the glossy face.
    ctx.lineWidth = size * .025; ctx.strokeStyle = palette.top; ctx.strokeText(char, x - .4, y - .6);
    const g = ctx.createLinearGradient(0, y - size, 0, y + 4);
    g.addColorStop(0, palette.top); g.addColorStop(.35, palette.mid);
    g.addColorStop(.47, palette.top); g.addColorStop(.51, palette.mid); g.addColorStop(1, palette.bottom);
    ctx.fillStyle = g; ctx.fillText(char, x, y);
    return { canvas, ox: x, oy: y, width: metrics.width };
  }

  function assets(cue, width, height) {
    const key = `${cues.indexOf(cue)}:${width}:${height}`;
    if (cache.has(key)) return cache.get(key);
    const unit = Math.min(width / 1280, height / 720);
    let size = (theme.fontSize??100) * width / 1080;
    measure.font = `${size}px "${style.fontFamily}"`;
    const initial = measure.measureText(cue.text).width;
    size *= Math.min(1, width * style.width / (initial + size * .1));
    measure.font = `${size}px "${style.fontFamily}"`;
    const textWidth = measure.measureText(cue.text).width;
    const colorway = style.colorway === 'refined' ? refinedPalettes : palettes;
    const palette = colorway[cue.color] || colorway.lime;
    const depth = size * .13;
    const chars = Array.from(cue.text).map((char, i, all) => ({
      ...glyph(char, size, palette, depth),
      x: measure.measureText(all.slice(0, i).join('')).width - textWidth / 2,
    }));
    const result = { size, textWidth, palette, depth, unit, chars };
    if (cache.size >= 18) cache.delete(cache.keys().next().value);
    cache.set(key, result); return result;
  }

  function star(ctx, x, y, r, color, rotation = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.fillStyle = color; ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, d = i % 2 ? r * .19 : r;
      if(i) ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d); else ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function stroke(ctx, x1, y1, x2, y2, color, width) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  function draw(ctx, time, viewport = {}) {
    const width = viewport.width ?? ctx.canvas.width, height = viewport.height ?? ctx.canvas.height;
    if (!Number.isFinite(time) || !(width > 0 && height > 0)) throw new RangeError('Finite time and positive viewport required.');
    const index = cues.findIndex(c => time >= c.start && time < c.end);
    if (index < 0) return null;
    const cue = cues[index], a = assets(cue, width, height);
    const { size, textWidth, palette, unit } = a;
    const age = time - cue.start, energy = style.intensity;
    const outro = ease((time - cue.end + .15) / .15);
    const arrival = ease(age / .3);
    const hit = Math.exp(-age * 8) * energy;
    const beat = Math.max(0, age - .58), second = age > .58 ? Math.exp(-beat * 13) * .35 * energy : 0;
    const shakeX = (Math.sin(age * 88) * hit * 13 + Math.sin(beat * 91) * second * 8) * unit;
    const shakeY = (Math.cos(age * 71) * hit * 9 + Math.cos(beat * 73) * second * 6) * unit;
    const angle = (index % 2 ? .035 : -.045) + Math.sin(age * 27) * hit * .08;
    const callerPaint = { fillStyle: ctx.fillStyle, strokeStyle: ctx.strokeStyle };
    ctx.save();
    try {
      ctx.globalAlpha *= (energy ? ease(age / .07) : 1) * (1 - outro);
      // Safety viewport keeps extreme entrance transforms off the image edges.
      ctx.beginPath(); ctx.rect(width * .025, height * .06, width * .95, height * .9); ctx.clip();
      ctx.translate(width / 2 + shakeX + outro * 170 * unit * energy,
        height * style.anchor + shakeY - outro * 35 * unit * energy);
      const slam = cue.effect === 'slam' ? 1 + (1 - arrival) * .62 * energy : 1;
      const bounce = 1 + Math.sin(age * 18) * Math.exp(-age * 5.7) * .1 * energy + second * .09;
      const safeScale = Math.min(slam * bounce, width * .91 / (textWidth + size * .24));
      ctx.scale(safeScale, safeScale); ctx.rotate(angle * energy);

      // Expanding outline echoes recede behind the solid letters.
      if (age < .6 && energy) {
        ctx.save(); ctx.font = `${size}px "${style.fontFamily}"`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.lineWidth = 1.5 * unit;
        for (let k = 3; k >= 1; k--) {
          ctx.save(); ctx.globalAlpha *= (1 - age / .6) * .2;
          ctx.translate(-k * 13 * unit, -k * 17 * unit);
          ctx.scale(1 + k * .045, 1 + k * .045);
          ctx.strokeStyle = k % 2 ? palette.plate : palette.rim;
          ctx.strokeText(cue.text, 0, 0); ctx.restore();
        }
        ctx.restore();
      }

      // Oversized angular marker plate with its own elastic entrance.
      const plateScale = energy ? 1 - Math.exp(-age * 12) * Math.cos(age * 22) : 1;
      ctx.save(); ctx.rotate((cue.color === 'pink' ? .035 : -.025) * energy);
      ctx.translate(0, -size * .36); ctx.scale(Math.max(.01, plateScale), 1);
      const hw = textWidth / 2 + size * .12, hh = size * .37;
      ctx.shadowColor = age < .38 ? palette.plate : '#07071090'; ctx.shadowBlur = size * .11; ctx.shadowOffsetY = 8 * unit;
      ctx.fillStyle = palette.plate; ctx.beginPath();
      ctx.moveTo(-hw - size * .04, -hh * .85); ctx.lineTo(hw + size * .05, -hh * 1.02);
      ctx.lineTo(hw - size * .025, hh); ctx.lineTo(-hw + size * .015, hh * 1.16); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.globalAlpha *= .65; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1 * unit;
      ctx.beginPath(); ctx.moveTo(-hw + size * .025, -hh * .79); ctx.lineTo(hw - size * .04, -hh * .96); ctx.stroke();
      ctx.restore();

      // Impact rings, speed streaks and tiny shards stay behind the letters.
      const burst = clamp(age / .68);
      if (burst < 1 && energy) {
        ctx.save(); ctx.globalAlpha *= (1 - burst) ** 1.4;
        ctx.strokeStyle = palette.rim; ctx.lineWidth = (1 - burst) * 4 * unit + unit;
        ctx.beginPath(); ctx.ellipse(0, -size * .38, textWidth * (.48 + burst * .16), size * (.66 + burst * .3), -.05, 0, Math.PI * 2); ctx.stroke();
        for (let k = 0; k < 20; k++) {
          const theta = rand(k + index * 25) * Math.PI * 2;
          const rx = textWidth * .44 + 35 * unit + burst * 65 * unit;
          const ry = size * .62 + burst * 45 * unit;
          const x = Math.cos(theta) * rx, y = -size * .42 + Math.sin(theta) * ry;
          const length = (8 + rand(k + 70) * 22) * unit;
          stroke(ctx, x, y, x + Math.cos(theta) * length, y + Math.sin(theta) * length,
            k % 3 ? palette.plate : '#fffceb', (k % 3 + 1) * unit);
        }
        ctx.restore();
      }

      // Individual letters jump, squash, tilt and settle on their own springs.
      a.chars.forEach((char, j) => {
        const local = Math.max(0, age - Math.min(j * .023, .16));
        const progress = energy ? ease(local / .34) : 1;
        const spring = Math.sin(local * 19) * Math.exp(-local * 6) * energy;
        const y = -(1 - progress) * size * (cue.effect === 'bounce' ? 1.1 : .42) - spring * size * .16;
        const x = cue.effect === 'whip' ? -(1 - progress) * 120 * unit * energy : 0;
        ctx.save(); ctx.globalAlpha *= progress;
        ctx.translate(char.x + char.width / 2 + x, y);
        ctx.rotate(spring * .095 * (j % 2 ? 1 : -1));
        ctx.transform(1, 0, -.045 * energy, 1, 0, 0);
        ctx.scale(1 + spring * .12, 1 - spring * .2);
        // Cyan/magenta trails disappear as the letter lands.
        if (local < .25 && energy) {
          ctx.save(); ctx.globalAlpha *= (1 - local / .25) * .27;
          ctx.drawImage(char.canvas, -char.ox - char.width / 2 - 13 * unit, -char.oy - 9 * unit);
          ctx.drawImage(char.canvas, -char.ox - char.width / 2 + 13 * unit, -char.oy + 7 * unit);
          ctx.restore();
        }
        ctx.drawImage(char.canvas, -char.ox - char.width / 2, -char.oy);
        ctx.restore();
      });

      // Supporting words keep sentence order clear without diluting the hit.
      if (cue.lead) {
        ctx.save(); const p = energy ? ease(age / .18) : 1;
        ctx.translate(-textWidth * .42, -size * 1.02 - (1 - p) * 25 * unit);
        ctx.rotate(-.025 * energy); ctx.globalAlpha *= p;
        ctx.font = `800 ${size * .29}px "${style.fontFamily}"`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.lineWidth = 5 * unit; ctx.strokeStyle = '#0a0b16'; ctx.strokeText(cue.lead, 0, 0);
        ctx.fillStyle = '#ffffff'; ctx.fillText(cue.lead, 0, 0); ctx.restore();
      }

      // A fast drawn underline and orbiting glints complete the highlight.
      const draw = energy ? ease((age - .12) / .28) : 1;
      ctx.save(); ctx.strokeStyle = palette.rim; ctx.lineWidth = 7 * unit; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-textWidth * .47, size * .2);
      ctx.quadraticCurveTo(0, size * .31, -textWidth * .47 + textWidth * .92 * draw, size * .16); ctx.stroke();
      ctx.restore();
      const twinkle = energy ? .55 + .45 * Math.sin(age * 8) : 1;
      star(ctx, textWidth * .54, -size * .79, (14 + twinkle * 8) * unit, '#fffbe7', age * .7 * energy);
      star(ctx, -textWidth * .55, size * .1, 11 * unit, palette.rim, -.3);
      // Directional hand-drawn arrow is local to the caption, including alpha.
      if (cue.effect === 'whip') {
        const ax = textWidth * .42, ay = -size * 1.12;
        ctx.strokeStyle = palette.plate; ctx.lineWidth = 6 * unit; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ax - 80 * unit, ay + 7 * unit); ctx.quadraticCurveTo(ax - 20 * unit, ay - 24 * unit, ax + 16 * unit, ay);
        ctx.lineTo(ax - 9 * unit, ay - 1 * unit); ctx.moveTo(ax + 16 * unit, ay); ctx.lineTo(ax + 9 * unit, ay - 24 * unit); ctx.stroke();
      }
      return { cueIndex: index, text: [cue.lead, cue.text].filter(Boolean).join(' '), cacheEntries: cache.size };
    } finally { ctx.restore(); ctx.fillStyle = callerPaint.fillStyle; ctx.strokeStyle = callerPaint.strokeStyle; }
  }
  return { draw, clearCache: () => cache.clear() };
}
