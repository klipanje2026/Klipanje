/** DUET: independently timed rows and mixed typefaces, drawn in native Canvas. */
const clamp = x => Math.max(0, Math.min(1, x));
const out = x => 1 - (1 - clamp(x)) ** 4;
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export function createDuetRenderer({ createCanvas, cues, theme = {} }) {
  if (typeof createCanvas !== 'function' || !Array.isArray(cues)) throw new TypeError('Pass createCanvas and cues.');
  let end = -Infinity;
  for (const c of cues) {
    if (!Number.isFinite(c.start) || !Number.isFinite(c.end) || c.start < end || c.end <= c.start || !c.rows?.length)
      throw new RangeError('Cues need finite, ordered times and rows.');
    for (const r of c.rows) {
      if (!Number.isFinite(r.y) || !Number.isFinite(r.at) || !Number.isFinite(r.until) || r.at < 0 || r.until <= r.at || r.until > c.end - c.start + 1e-6 || !r.runs?.length)
        throw new RangeError('Rows need valid timing and runs.');
      for (const run of r.runs) if (typeof run.text !== 'string' || !run.text.trim() || !['sans', 'serif', 'hand'].includes(run.font))
        throw new RangeError('Runs need text and a known font role.');
    }
    end = c.end;
  }
  cues = structuredClone(cues);
  const style = { anchor: .55, width: .72, intensity: 1, ...theme,
    fonts: { sans: 'DuetSans', serif: 'DuetSerif', hand: 'DuetHand', ...theme.fonts } };
  if (!(style.anchor >= .3 && style.anchor <= .75) || !(style.width >= .2 && style.width <= .8) || !(style.intensity >= 0 && style.intensity <= 1.3))
    throw new RangeError('Invalid theme dimensions or intensity.');
  const cache = new Map(), measure = createCanvas(1, 1).getContext('2d');
  function layout(index, width, height) {
    const key = `${index}:${width}:${height}`;
    if (cache.has(key)) return cache.get(key);
    const unit = Math.min(width / 1080, height / 1350);
    const rows = cues[index].rows.map(r => {
      let x = 0;
      const words = [];
      for (const run of r.runs) {
        const size = { sans: .85, serif: 1, hand: .95 }[run.font] * (theme.fontSize??100) * width/1080;
        const font = `${size}px "${style.fonts[run.font]}"`;
        measure.font = font;
        for (const token of run.text.match(/\S+\s*/gu) || []) {
          const m = measure.measureText(token.trimEnd());
          const pad = Math.ceil(size * .30), w = Math.ceil(m.width + pad * 2 + size * .15);
          const h = Math.ceil(size * 1.85), canvas = createCanvas(w, h), ctx = canvas.getContext('2d');
          const baseline = pad + size;
          ctx.font = font; ctx.fillStyle = run.font === 'serif' ? '#f3e6d3' : '#faf8f1';
          ctx.shadowColor = '#000000a0'; ctx.shadowBlur = 8 * unit; ctx.shadowOffsetY = 5 * unit;
          ctx.fillText(token.trimEnd(), pad, baseline);
          const advance = measure.measureText(token).width;
          words.push({ canvas, x, pad, baseline, w, h, advance, role: run.font });
          x += advance;
        }
      }
      return { ...r, words, width: x };
    });
    const maxWidth = Math.max(...rows.map(r => r.width));
    const fit = Math.min(1, width * style.width / maxWidth);
    const value = { rows, fit, maxWidth, unit };
    if (cache.size >= 24) cache.delete(cache.keys().next().value);
    cache.set(key, value); return value;
  }
  function draw(ctx, time, viewport = {}) {
    const width = viewport.width ?? ctx.canvas.width, height = viewport.height ?? ctx.canvas.height;
    if (!Number.isFinite(time) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
      throw new RangeError('Finite time and positive viewport required.');
    const index = cues.findIndex(c => time >= c.start && time < c.end);
    if (index < 0) return null;
    const { rows, fit, maxWidth, unit } = layout(index, width, height), age = time - cues[index].start;
    const paint = { fillStyle: ctx.fillStyle, strokeStyle: ctx.strokeStyle }, active = [];
    ctx.save();
    try {
      ctx.beginPath(); ctx.rect(width * .04, height * .12, width * .92, height * .76); ctx.clip();
      ctx.translate(width / 2, height * style.anchor); ctx.scale(fit, fit);
      for (const row of rows) {
        if (age < row.at || age >= row.until) continue;
        active.push(row.runs.map(r => r.text).join(''));
        const left = row.align === 'right' ? maxWidth / 2 - row.width : row.align === 'center' ? -row.width / 2 : -maxWidth / 2;
        for (const [i, word] of row.words.entries()) {
          const elapsed = age - row.at - i * .042;
          if (elapsed < 0) continue;
          const entry = out(elapsed / .32), energy = style.intensity;
          // Exit order follows reading order; each row retains its own lifetime.
          const exit = smooth((age - row.until + .17 - i * .018) / Math.max(.065, .17 - i * .018));
          const rem = (1 - entry) * energy;
          let dx = 0, dy = rem * 42 * unit, angle = 0, scale = 1;
          if (row.motion === 'sweep') { dx = rem * 85 * unit; dy = rem * 8 * unit; }
          if (row.motion === 'pop') {
            const spring = elapsed > .07 ? Math.sin((elapsed - .07) * 23) * Math.exp(-(elapsed - .07) * 10) : 0;
            scale = 1 - rem * .19 + spring * .055 * energy;
            angle = -.045 * rem; dy = rem * 32 * unit;
          }
          if (row.exit === 'slide') dx -= exit * 66 * unit * energy;
          else dy += (row.exit === 'drop' ? 35 : -29) * exit * unit * energy;
          ctx.save();
          ctx.globalAlpha *= out(elapsed / .14) * (1 - exit);
          ctx.translate(left + word.x + dx + word.advance / 2, row.y * unit + dy);
          ctx.rotate(angle); ctx.scale(scale, scale);
          // Short spatial echoes soften fast motion and converge to a crisp face.
          if (rem > .015) {
            for (const j of [-2, -1, 1, 2]) {
              ctx.save(); ctx.globalAlpha *= .085;
              ctx.drawImage(word.canvas, -word.advance / 2 - word.pad + j * rem * 6 * unit,
                -word.baseline + j * rem * 2 * unit); ctx.restore();
            }
          }
          ctx.drawImage(word.canvas, -word.advance / 2 - word.pad, -word.baseline);
          ctx.restore();
        }
      }
      return { cueIndex: index, text: active.join(' '), cacheEntries: cache.size };
    } finally { ctx.restore(); ctx.fillStyle = paint.fillStyle; ctx.strokeStyle = paint.strokeStyle; }
  }
  return { draw, clearCache: () => cache.clear() };
}
