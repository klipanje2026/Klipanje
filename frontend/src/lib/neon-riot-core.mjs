/** Shared Neon Riot artwork and time-driven motion. No DOM, CSS, Node imports or wall clock. */
const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const easeOut = n => 1 - (1 - clamp(n)) ** 3;
const smooth = n => { n = clamp(n); return n * n * (3 - 2 * n); };
const random = seed => { const n = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return n - Math.floor(n); };
const spring = (n, damping = 7.5, frequency = 11.5) => n <= 0 ? 0 : n >= 1 ? 1 : 1 - Math.exp(-damping * n) * Math.cos(frequency * n);
const rgba = (color, a) => {
  const hex = color.slice(1);
  return `rgba(${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)},${clamp(a)})`;
};
const mix = (a, b, weight) => {
  const values = [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - weight) + parseInt(b.slice(i, i + 2), 16) * weight));
  return `#${values.map(v => v.toString(16).padStart(2, '0')).join('')}`;
};

function roundRect(ctx, x, y, w, h, radius, fill) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fillStyle = fill; ctx.fill();
}

function star(ctx, x, y, radius, color, rotation = 0, alpha = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.globalAlpha *= alpha;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, r = i % 2 ? radius * .19 : radius;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.restore();
}

/** Reusable motion math: native per-letter animation or an optional whole-caption effect. */
export function riotGlyphPose(local, duration, mode = 'spring', strength = 1, index = 0, damping = 7.5, frequency = 11.5) {
  strength = clamp(strength, 0, 2);
  const p = Math.max(0, local) / Math.max(.04, duration);
  const bounce = mode === 'slide' || mode === 'flip' ? easeOut(p) : spring(p, damping, frequency);
  const trail = 1 - easeOut(p * .56 / .42);
  const wave = mode === 'wave' ? Math.sin(local * 5 - index * .6) * 9 * smooth(p) : 0;
  const slide = mode === 'slide' ? (1 - easeOut(p)) * -90 : 0;
  const glitch = mode === 'glitch' ? Math.sin(local * 72 + index * 3) * trail * 13 : 0;
  const sx = mode === 'flip' ? 1 + (Math.max(.05, Math.abs(Math.cos((1 - easeOut(p)) * Math.PI / 2))) - 1) * strength
    : mode === 'zoom' ? 1 + (1 - bounce) * .85 * strength : 1 - .28 * (1 - bounce) * strength;
  return {x:(slide+glitch)*strength,y:((1-bounce)*68+wave)*strength,rotation:(1-bounce)*(index%2?.2:-.2)*strength,
    scaleX:Math.max(.05,sx),scaleY:Math.max(.04,1-.73*(1-bounce)*strength),trail};
}

export function createNeonRiotPainter(createCanvas) {
const wordCache = new Map();
const measurements = new Map();
let cacheBytes = 0;
const fontFor = word => `${word.italic ? 'italic ' : ''}${word.weight ?? 900} ${word.size}px ${word.fontFamily || '"Riot Heavy"'}`;
function measureWord(word) {
  const key = JSON.stringify([word.text, fontFor(word), word.letterSpacing]);
  if (measurements.has(key)) return measurements.get(key);
  const ctx = createCanvas(1, 1).getContext('2d'); ctx.font = fontFor(word);
  const letters = [...word.text], spacing = word.size * (-.027 + (word.letterSpacing ?? 0) / 100);
  const result = {width:ctx.measureText(word.text).width + spacing * Math.max(0, letters.length - 1)};
  measurements.set(key,result);
  if (measurements.size > 512) measurements.delete(measurements.keys().next().value);
  return result;
}
function makeGlyph(letter, size, face, dark, word) {
  const measure = createCanvas(1, 1).getContext('2d');
  measure.font = fontFor(word);
  const advance = measure.measureText(letter).width;
  const detail=word.detailScale??1;
  const padding = 70, depth = Math.max(0, Math.min(45, word.depth ?? (dark ? 7 : 15)));
  const density = Math.max(1, Math.min(2, word.rasterScale ?? 1));
  const canvas = createCanvas(Math.ceil((advance + padding * 2 + depth) * density), Math.ceil((size * 1.4 + padding * 2 + depth) * density));
  const ctx = canvas.getContext('2d'), ox = padding + advance / 2, oy = padding + size;
  ctx.scale(density, density);
  ctx.font = measure.font; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  ctx.shadowColor = '#000000cc'; ctx.shadowBlur = 19*detail; ctx.shadowOffsetX = 5*detail; ctx.shadowOffsetY = 13*detail;
  ctx.lineWidth = 10*detail; ctx.strokeStyle = '#050714'; ctx.strokeText(letter, ox + depth * .55, oy + depth);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  for (let d = depth; d > 0; d -= 1) {
    ctx.fillStyle = mix(word.depthColor || '#241445', face, .12 + .33 * (1 - d / depth));
    ctx.strokeStyle = '#080713'; ctx.lineWidth = 9*detail;
    ctx.strokeText(letter, ox + d * .68, oy + d); ctx.fillText(letter, ox + d * .68, oy + d);
  }
  ctx.shadowColor = rgba(face, .55); ctx.shadowBlur = dark ? 0 : 14 * (word.glow ?? 1);
  ctx.strokeStyle = dark ? '#080714' : mix(face, '#ffffff', .35); ctx.lineWidth = 10*detail;
  if ((word.outlineWidth ?? 6) > 0) ctx.strokeText(letter, ox, oy);
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.strokeStyle = word.outlineColor || '#080714'; ctx.lineWidth = word.outlineWidth ?? 6;
  if ((word.outlineWidth ?? 6) > 0) ctx.strokeText(letter, ox, oy);
  const gradient = ctx.createLinearGradient(0, oy - size, 0, oy + 8);
  if (dark) {
    gradient.addColorStop(0, '#392442'); gradient.addColorStop(1, '#080913');
  } else {
    gradient.addColorStop(0, mix(face, '#ffffff', .8));
    gradient.addColorStop(.32, mix(face, '#ffffff', .2));
    gradient.addColorStop(.63, face); gradient.addColorStop(1, mix(face, '#220c54', .27));
  }
  ctx.fillStyle = word.faceGradient === false ? face : gradient; ctx.fillText(letter, ox, oy);
  return { canvas, ox, oy, advance, density };
}

function prepareWord(word) {
  const key = JSON.stringify([word.text,word.size,word.colors,word.dark,fontFor(word),word.letterSpacing,word.depth,word.depthColor,word.outlineColor,word.outlineWidth,word.rasterScale,word.faceGradient,word.glow,word.detailScale]);
  if (wordCache.has(key)) return wordCache.get(key);
  const measure = createCanvas(1, 1).getContext('2d'); measure.font = fontFor(word);
  const letters = [...word.text], spacing = word.size * (-.027 + (word.letterSpacing ?? 0) / 100);
  const width = measure.measureText(word.text).width + spacing * Math.max(0, letters.length - 1);
  const glyphs = letters.map((letter, i) => {
    const color = word.colors[Math.floor(i * word.colors.length / letters.length) % word.colors.length];
    const glyph = makeGlyph(letter, word.size, color, word.dark, word);
    const prefixWidth = measure.measureText(letters.slice(0, i).join('')).width;
    return { ...glyph, letter, color, x: -width / 2 + prefixWidth + spacing * i + glyph.advance / 2 };
  });
  const bytes = glyphs.reduce((sum, g) => sum + g.canvas.width * g.canvas.height * 4, 0);
  const result = { width, glyphs, bytes }; wordCache.set(key, result); cacheBytes += bytes;
  while ((cacheBytes > 96 * 1024 * 1024 || wordCache.size > 64) && wordCache.size > 1) {
    const first = wordCache.keys().next().value; cacheBytes -= wordCache.get(first).bytes; wordCache.delete(first);
  }
  return result;
}

function drawWord(ctx, word, age, sceneEnd, index) {
  const elapsed = age - word.at;
  if (elapsed < 0) return;
  const { width, glyphs } = prepareWord(word);
  const strength = clamp(word.motionStrength ?? 1, 0, 2);
  const duration = Math.max(.04, word.entranceDuration ?? .56);
  const entrance = spring(elapsed / (duration * .65 / .56), word.damping, word.frequency);
  const exitDuration = Math.max(.001, word.exitDuration ?? .32);
  const leave = smooth((age - (sceneEnd - exitDuration)) / exitDuration);
  const float = Math.sin(age * 1.7 + index) * 3 * smooth(elapsed - .65) * (word.floatStrength ?? 1);
  ctx.save();
  ctx.translate(word.x + Math.sin(elapsed * 26) * Math.exp(-elapsed * 12) * 15 * strength, word.y + (float - leave * 34) * strength);
  ctx.rotate((word.tilt * Math.PI / 180) + (1 - entrance) * -.09 * strength);
  ctx.globalAlpha *= clamp(elapsed / .06) * (1 - leave);
  ctx.scale(1 - leave * .055, 1 - leave * .055);

  if (word.box && word.boxOpacity !== 0) {
    const progress = easeOut(elapsed / .29), boxWidth = width + 46, boxHeight = word.size * .98;
    ctx.save(); ctx.globalAlpha *= word.boxOpacity ?? 1; ctx.rotate(-.018); ctx.scale(progress, .9 + progress * .1);
    ctx.shadowColor = rgba(word.box, .32); ctx.shadowBlur = 23;
    const radius = Math.min(word.boxRadius ?? 13, boxHeight / 2, boxWidth / 2);
    roundRect(ctx, -boxWidth / 2 + 8, -word.size * .88 + 9, boxWidth, boxHeight, radius, '#080810');
    roundRect(ctx, -boxWidth / 2, -word.size * .88, boxWidth, boxHeight, radius, word.box);
    ctx.shadowBlur = 0; ctx.strokeStyle = rgba('#ffffff', .28); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(-boxWidth / 2 + 2, -word.size * .88 + 2, boxWidth - 4, boxHeight - 4, Math.max(0,radius-2)); ctx.stroke();
    ctx.restore();
  }

  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];
    if (g.letter === ' ') continue;
    const delay = i * (word.letterDelay ?? .025), local = elapsed - delay;
    if (local < 0) continue;
    const pose = riotGlyphPose(local,duration,word.motion,strength,i,word.damping,word.frequency);
    const initial = pose.trail;
    ctx.save();
    ctx.translate(g.x + pose.x, pose.y); ctx.rotate(pose.rotation); ctx.scale(pose.scaleX,pose.scaleY);
    ctx.globalAlpha *= clamp(local / .065);
    if (initial > .015 && word.trails !== false) {
      for (const [dx, color] of [[-17, word.trailColor1 || '#40edff'], [17, word.trailColor2 || '#ff4fc8']]) {
        ctx.save(); ctx.globalAlpha *= initial * .85 * clamp(word.trailStrength ?? 1,0,1); ctx.font = fontFor(word);
        ctx.textAlign = 'center'; ctx.fillStyle = color; ctx.fillText(g.letter, dx * initial, -6 * initial); ctx.restore();
      }
    }
    ctx.drawImage(g.canvas, -g.ox, -g.oy, g.canvas.width / g.density, g.canvas.height / g.density);
    ctx.restore();
  }

  if ((word.underline ?? index === 1) && elapsed > .3) {
    // Hand-drawn-looking fluorescent underline with a moving tip.
    const progress = easeOut((elapsed - .3) / (word.underlineDuration ?? .42)), x = -width / 2 - 8, y = 33;
    ctx.save(); ctx.shadowColor = word.underlineColor || word.colors[0]; ctx.shadowBlur = 12;
    ctx.lineCap = 'round'; ctx.strokeStyle = word.underlineColor || word.colors[0]; ctx.lineWidth = word.underlineWidth ?? 5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + width * progress * .5, y + 9, x + width * progress, y - 2); ctx.stroke();
    ctx.shadowBlur = 0;
    if (progress < 1) star(ctx, x + width * progress, y - 2, 9, '#ffffff', elapsed * 4);
    ctx.restore();
  }
  ctx.restore();
}


function drawBurst(ctx, x, y, elapsed, palette, strength = 1, count = 18, duration = 1.15) {
  count=Math.max(0,Math.min(60,Math.round(count)));duration=Math.max(.1,duration);
  if (elapsed < 0 || elapsed > duration || strength <= 0 || !count) return;
  const p = elapsed / duration, radius = 24 + easeOut(p) * 148;
  ctx.save(); ctx.globalAlpha *= (1-p)**2*.7; ctx.strokeStyle=palette[0];ctx.lineWidth=2*(1-p);
  ctx.beginPath();ctx.arc(x,y,radius*strength,0,Math.PI*2);ctx.stroke();ctx.restore();
  for(let i=0;i<count;i++){
    const a=i/count*Math.PI*2+random(i)*.3,travel=easeOut(p)*(55+random(i+900)*210)*strength;
    ctx.save();ctx.translate(x+Math.cos(a)*travel,y+Math.sin(a)*travel+p*p*50);ctx.rotate(a+p*3);ctx.globalAlpha*= (1-p)**1.4;
    ctx.fillStyle=palette[i%palette.length];ctx.fillRect(-2,-2,4+(1-p)*7,2.5);ctx.restore();
  }
}
return {measureWord,prepareWord,drawWord,drawBurst,star,clearCache(){wordCache.clear();measurements.clear();cacheBytes=0;}};
}
