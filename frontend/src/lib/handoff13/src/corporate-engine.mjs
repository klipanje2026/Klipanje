/** Five native Canvas subtitle treatments. Times are absolute seconds. */
const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => 1 - (1 - clamp(n)) ** 4;
const smooth = n => { n = clamp(n); return n * n * (3 - 2 * n); };
export const corporateStyles = Object.freeze(['axis', 'signature', 'momentum', 'ledger', 'signal']);
const palettes = {
  axis: { face: '#f8faf8', accent: '#94e3d0', dark: '#102937', muted: '#c6d5d3', shadow: '#010f18b8' },
  signature: { face: '#fcf3e4', accent: '#d7ad69', dark: '#37231e', muted: '#e9cba7', shadow: '#130c0bba' },
  momentum: { face: '#fffaf3', accent: '#ff7660', dark: '#192339', muted: '#cdd4e1', shadow: '#06111cca' },
  ledger: { face: '#162c32', accent: '#14836e', dark: '#d9ede8', muted: '#5e817d', shadow: '#102d3277' },
  signal: { face: '#f6fcfd', accent: '#89e5ef', dark: '#162d47', muted: '#9ab7c7', shadow: '#071d34cc' },
};
function line(ctx, x1, y1, x2, y2, color, width) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function roundRect(ctx, x, y, w, h, r) {
  const q = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + q, y); ctx.lineTo(x + w - q, y); ctx.quadraticCurveTo(x + w, y, x + w, y + q);
  ctx.lineTo(x + w, y + h - q); ctx.quadraticCurveTo(x + w, y + h, x + w - q, y + h);
  ctx.lineTo(x + q, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - q);
  ctx.lineTo(x, y + q); ctx.quadraticCurveTo(x, y, x + q, y); ctx.closePath();
}
export function createCorporateRenderer({ createCanvas, style, cues, theme = {} }) {
  if (typeof createCanvas !== 'function' || !Array.isArray(cues) || !corporateStyles.includes(style))
    throw new TypeError('Pass createCanvas, one corporate style, and cues.');
  let prev = -Infinity;
  for (const c of cues) {
    if (!Number.isFinite(c.start) || !Number.isFinite(c.end) || c.start < prev || c.end <= c.start ||
      typeof c.lead!=='string' || typeof c.tail!=='string' || !Array.isArray(c.headline) || !c.headline.length)
      throw new RangeError('Cues need ordered times, a lead, headline and tail.');
    for (const part of c.headline) if (!part.text?.trim() || !['bold', 'serif', 'condensed', 'mono'].includes(part.font))
      throw new RangeError('Headline parts need text and a known font role.');
    prev = c.end;
  }
  const opt = { anchor: .56, width: .80, intensity: 1, ...theme,
    fonts: { bold: 'CorpBold', serif: 'CorpSerif', condensed: 'CorpCondensed', mono: 'CorpMono', ...theme.fonts } };
  if (!(opt.anchor >= .34 && opt.anchor <= .72) || !(opt.width >= .3 && opt.width <= .86) || !(opt.intensity >= 0 && opt.intensity <= 1.3))
    throw new RangeError('Invalid anchor, width or intensity.');
  const p = palettes[style], cache = new Map(), measure = createCanvas(1, 1).getContext('2d');
  function makeText(text, role, size, face, unit, weight = '') {
    const font = `${weight}${size}px "${opt.fonts[role]}"`;
    measure.font = font;
    const m = measure.measureText(text), pad = Math.ceil(size * .24 + 8 * unit);
    const w = Math.max(1, Math.ceil(m.width + pad * 2)), h = Math.ceil(size * 1.65 + pad * 2);
    const c = createCanvas(w, h), x = c.getContext('2d'), baseline = pad + size;
    x.font = font; x.textBaseline = 'alphabetic'; x.lineJoin = 'round';
    x.shadowColor = p.shadow; x.shadowBlur = 10 * unit; x.shadowOffsetX = 4 * unit; x.shadowOffsetY = 10 * unit;
    x.fillStyle = p.dark; x.fillText(text, pad + 2 * unit, baseline + 5 * unit);
    x.shadowBlur = 0; x.shadowOffsetX = 0; x.shadowOffsetY = 0;
    x.fillStyle = face; x.fillText(text, pad, baseline);
    if (style === 'signature' && role === 'serif') {
      x.strokeStyle = '#fff9ed80'; x.lineWidth = 1.5 * unit; x.strokeText(text, pad, baseline);
    }
    return { canvas: c, w, h, advance: m.width, pad, baseline, role };
  }
  function assets(index, width, height) {
    const key = `${index}:${width}:${height}`;
    if (cache.has(key)) return cache.get(key);
    const cue = cues[index], u = Math.min(width / 1080, height / 1350);
    const sizes = {
      axis: { main: 145, serif: 157, condensed: 158, mono: 126, lead: 62, tail: 62 },
      signature: { main: 142, serif: 178, condensed: 150, mono: 128, lead: 69, tail: 72 },
      momentum: { main: 160, serif: 167, condensed: 184, mono: 130, lead: 69, tail: 67 },
      ledger: { main: 134, serif: 155, condensed: 150, mono: 127, lead: 54, tail: 62 },
      signal: { main: 146, serif: 165, condensed: 155, mono: 127, lead: 65, tail: 63 },
    }[style];
    const parts = [];
    for (const run of cue.headline) {
      for (const word of run.text.match(/\S+\s*/gu) || []) {
        const role = run.font, size = (sizes[role] || sizes.main)/sizes.main * (theme.fontSize??100) * width/1080;
        const asset = makeText(word.trimEnd(), role, size, role === 'serif' ? p.accent : p.face, u);
        measure.font = `${size}px "${opt.fonts[role]}"`;
        parts.push({ ...asset, advance: measure.measureText(word).width });
      }
    }
    const mainW = parts.reduce((sum, a) => sum + a.advance, 0);
    const lead = makeText(cue.lead, style === 'ledger' ? 'mono' : style === 'signature' ? 'serif' : 'bold',
      sizes.lead * u, style === 'signature' ? p.muted : p.face, u);
    const tail = makeText(cue.tail, style === 'signal' ? 'mono' : style === 'signature' ? 'serif' : 'bold',
      sizes.tail * u, style === 'ledger' ? p.face : p.muted, u);
    const fit = Math.min(1, width * opt.width / Math.max(mainW + 40 * u, lead.advance, tail.advance));
    const result = { parts, lead, tail, mainW, fit, u };
    if (cache.size >= 24) cache.delete(cache.keys().next().value);
    cache.set(key, result); return result;
  }
  function word(ctx, a, x, y, alpha = 1) {
    ctx.save(); ctx.globalAlpha *= alpha;
    ctx.drawImage(a.canvas, x - a.pad, y - a.baseline);
    ctx.restore();
  }
  function decorate(ctx, a, entry, exit, age) {
    const { u, mainW } = a, fade = 1 - exit;
    if (style === 'axis') {
      const w = Math.max(mainW, a.lead.advance) + 50 * u;
      ctx.save(); ctx.globalAlpha *= fade;
      line(ctx, -w / 2, -242 * u, -w / 2 + w * entry, -242 * u, p.accent, 3 * u);
      line(ctx, -w / 2, -242 * u, -w / 2, 92 * u * entry - 242 * u, p.accent, 3 * u);
      ctx.fillStyle = p.accent; ctx.fillRect(-w / 2, 235 * u, w * ease((age - .16) / .30), 7 * u);
      ctx.fillStyle = p.face; ctx.fillRect(-w / 2 + w * .73, 235 * u, 8 * u, 7 * u);
      ctx.restore();
    } else if (style === 'signature') {
      const radius = Math.max(310 * u, mainW * .48);
      ctx.save(); ctx.globalAlpha *= .68 * entry * fade;
      ctx.strokeStyle = p.accent; ctx.lineWidth = 2.4 * u;
      ctx.beginPath(); ctx.ellipse(0, 8 * u, radius, 230 * u, -.16, Math.PI * .98, Math.PI * (1.1 + .89 * entry)); ctx.stroke();
      const swoosh = ease((age - .24) / .42);
      ctx.beginPath(); ctx.moveTo(-mainW / 2, 242 * u);
      ctx.bezierCurveTo(-mainW * .18, 269 * u, mainW * .15, 209 * u, -mainW / 2 + mainW * swoosh, 240 * u);
      ctx.lineWidth = 5 * u; ctx.stroke(); ctx.restore();
    } else if (style === 'momentum') {
      const dir = age < .1 ? -1 : 1;
      ctx.save(); ctx.globalAlpha *= fade;
      ctx.transform(1, 0, -.09, 1, 0, 0);
      ctx.fillStyle = p.dark; ctx.fillRect(-mainW / 2 - 31 * u, -153 * u, mainW + 62 * u, 270 * u);
      ctx.fillStyle = p.accent;
      ctx.beginPath(); ctx.moveTo(-mainW / 2 - 45 * u, 123 * u); ctx.lineTo(mainW / 2 + 22 * u, 123 * u);
      ctx.lineTo(mainW / 2 + 45 * u, 151 * u); ctx.lineTo(-mainW / 2 - 22 * u, 151 * u); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha *= .70; line(ctx, dir * (mainW / 2 + 45 * u + i * 22 * u), -25 * u,
          dir * (mainW / 2 + 65 * u + i * 22 * u), -25 * u, p.accent, 4 * u);
      }
      ctx.restore();
    } else if (style === 'ledger') {
      const w = Math.max(mainW, a.lead.advance, a.tail.advance) + 80 * u;
      ctx.save(); ctx.globalAlpha *= fade;
      roundRect(ctx, -w / 2, -250 * u, w, 480 * u, 26 * u);
      ctx.fillStyle = '#ebf5f2ee'; ctx.fill(); ctx.strokeStyle = p.accent; ctx.lineWidth = 2 * u; ctx.stroke();
      line(ctx, -w / 2 + 32 * u, -139 * u, w / 2 - 32 * u, -139 * u, '#7b9d9b77', 2 * u);
      ctx.fillStyle = p.accent; ctx.fillRect(-w / 2 + 32 * u, 190 * u, (w - 64 * u) * ease((age - .18) / .38), 7 * u);
      ctx.fillStyle = '#0f745b'; ctx.beginPath(); ctx.arc(w / 2 - 49 * u, -202 * u, 8 * u, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (style === 'signal') {
      const w = Math.max(mainW, a.lead.advance) + 60 * u;
      ctx.save(); ctx.globalAlpha *= fade;
      for (let k = 0; k < 3; k++) {
        ctx.globalAlpha *= .85;
        line(ctx, -w / 2, -151 * u - k * 9 * u, -w / 2 + w * ease((age - k * .04) / .36), -151 * u - k * 9 * u,
          k === 0 ? p.accent : '#7ab7c755', (k === 0 ? 4 : 2) * u);
      }
      ctx.fillStyle = '#89e5ef28'; ctx.fillRect(-w / 2, -110 * u, w * entry, 235 * u);
      line(ctx, -w / 2, 230 * u, w / 2, 230 * u, p.accent, 2.4 * u);
      ctx.restore();
    }
  }
  function draw(ctx, time, viewport = {}) {
    const width = viewport.width ?? ctx.canvas.width, height = viewport.height ?? ctx.canvas.height;
    if (!Number.isFinite(time) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
      throw new RangeError('Finite time and positive viewport required.');
    const index = cues.findIndex(c => time >= c.start && time < c.end);
    if (index < 0) return null;
    const cue = cues[index], age = time - cue.start, a = assets(index, width, height), { u, fit } = a;
    const entry = opt.intensity ? ease(age / .36) : 1;
    const exit = smooth((time - cue.end + .24) / .24);
    const before = { fillStyle: ctx.fillStyle, strokeStyle: ctx.strokeStyle };
    ctx.save();
    try {
      ctx.beginPath(); ctx.rect(width * .035, height * .12, width * .93, height * .76); ctx.clip();
      const jolt = style === 'momentum' ? Math.sin((age - .18) * 63) * Math.exp(-Math.max(0, age - .18) * 16) * 7 * u * opt.intensity : 0;
      ctx.translate(width / 2 + jolt, height * opt.anchor);
      ctx.scale(fit, fit);
      if (style === 'ledger') {
        const w = Math.max(a.mainW, a.lead.advance, a.tail.advance) + 120 * u;
        ctx.beginPath(); ctx.rect(-w / 2, -255 * u, w * (1 - exit * .9), 500 * u); ctx.clip();
      }
      decorate(ctx, a, entry, exit, age);
      const leadIn = ease(age / .30), tailIn = ease((age - .31) / .33);
      const leadX = style === 'axis' ? -(1 - leadIn) * 120 * u : style === 'momentum' ? (1 - leadIn) * -140 * u : 0;
      const leadY = style === 'ledger' ? -(1 - leadIn) * 55 * u : (1 - leadIn) * 29 * u;
      const leadLeft = style === 'ledger' ? -a.mainW / 2 : -a.lead.advance / 2;
      word(ctx, a.lead, leadLeft + leadX, -172 * u + leadY, leadIn * (1 - exit));
      let x = -a.mainW / 2;
      for (const [i, part] of a.parts.entries()) {
        const local = age - .08 - i * .065, q = opt.intensity ? ease(local / .34) : 1;
        if (q <= 0) { x += part.advance; continue; }
        const rem = (1 - q) * opt.intensity, exitShift = exit * opt.intensity;
        ctx.save();
        ctx.globalAlpha *= ease(local / .11) * (1 - exit);
        let dx = 0, dy = 0, sx = 1, sy = 1, angle = 0;
        if (style === 'axis') { dx = (i % 2 ? 1 : -1) * rem * 110 * u; dy = rem * 18 * u - exitShift * 45 * u; }
        if (style === 'signature') { dy = rem * 90 * u - exitShift * 55 * u; angle = -.08 * rem + .05 * exitShift; sx = sy = 1 + rem * .13; }
        if (style === 'momentum') { dx = -rem * 270 * u + exitShift * 180 * u; sx = 1 + rem * .52; sy = 1 - rem * .16; }
        if (style === 'ledger') { dy = -rem * 95 * u + exitShift * 15 * u; sx = 1 - rem * .08; }
        if (style === 'signal') { dx = (i % 2 ? 1 : -1) * rem * 100 * u + exitShift * 55 * u; sy = .72 + .28 * q; }
        ctx.translate(x + part.advance / 2 + dx, dy);
        ctx.rotate(angle); ctx.scale(sx, sy);
        if (style === 'momentum' && rem > .02) {
          for (let k = 3; k >= 1; k--) {
            ctx.save(); ctx.globalAlpha *= rem * .095;
            ctx.drawImage(part.canvas, -part.advance / 2 - part.pad - k * 30 * u, -part.baseline); ctx.restore();
          }
        }
        if (style === 'signal') {
          for (let k = 0; k < 4; k++) {
            const sy0 = k * part.h / 4, sh = part.h / 4;
            ctx.drawImage(part.canvas, 0, sy0, part.w, sh, -part.advance / 2 - part.pad + (k % 2 ? 1 : -1) * rem * 24 * u,
              -part.baseline + sy0, part.w, sh + .3);
          }
        } else word(ctx, part, -part.advance / 2, 0);
        ctx.restore(); x += part.advance;
      }
      const tailX = style === 'signature' ? (1 - tailIn) * 48 * u : style === 'momentum' ? (1 - tailIn) * 90 * u : 0;
      const tailY = (style === 'signature' ? -1 : 1) * (1 - tailIn) * 42 * u;
      const tailLeft = style === 'ledger' ? -a.mainW / 2 : -a.tail.advance / 2;
      const tailBaseline = style === 'momentum' ? 246 : style === 'ledger' ? 146 : 190;
      word(ctx, a.tail, tailLeft + tailX, tailBaseline * u + tailY, tailIn * (1 - exit));
      return { cueIndex: index, text: `${cue.lead} ${cue.headline.map(x => x.text).join('')} ${cue.tail}`, cacheEntries: cache.size };
    } finally { ctx.restore(); ctx.fillStyle = before.fillStyle; ctx.strokeStyle = before.strokeStyle; }
  }
  return { draw, clearCache: () => cache.clear() };
}
