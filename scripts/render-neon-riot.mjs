/**
 * NEON RIOT — a standalone, programmatically drawn caption experiment.
 * Run: node scripts/render-neon-riot.mjs
 * No browser, DOM, HTML, stylesheets, stock images or paid services.
 * Skia paints every pixel; FFmpeg only encodes the generated frames.
 */
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'outputs', 'neon-riot');
export const DEMO = {
  width: 1280,
  height: 720,
  fps: 60,
  duration: 10.8,
  sentence: 'MOJE RIJEČI NE PRATE PRAVILA — ONE IH STVARAJU.',
  palette: ['#caff36', '#ff4fc8', '#40edff', '#ffab47', '#a88bff'],
};

// Caption text/timing and art direction live here, independently of rendering.
const SCENES = [
  {
    start: 0, end: 3.45, label: '01', accent: '#ff4fc8',
    words: [
      { text: 'MOJE', x: 612, y: 315, size: 112, at: .28, tilt: -6, colors: ['#ffffff', '#dbceff'], box: '#9458ff' },
      { text: 'RIJEČI', x: 650, y: 487, size: 174, at: 1.0, tilt: -4, colors: ['#caff36', '#40edff', '#ff4fc8'], box: null },
    ],
    bursts: [{ at: .32, x: 414, y: 247 }, { at: 1.05, x: 949, y: 397 }],
  },
  {
    start: 3.45, end: 6.85, label: '02', accent: '#caff36',
    words: [
      { text: 'NE', x: 412, y: 317, size: 103, at: .17, tilt: -7, colors: ['#201128'], box: '#caff36', dark: true },
      { text: 'PRATE', x: 741, y: 317, size: 103, at: .56, tilt: 3, colors: ['#ffffff', '#a8f7ff'], box: null },
      { text: 'PRAVILA', x: 644, y: 480, size: 145, at: 1.04, tilt: -3, colors: ['#ff4fc8', '#ffab47', '#caff36'], box: null },
    ],
    bursts: [{ at: .21, x: 314, y: 235 }, { at: 1.08, x: 984, y: 395 }],
  },
  {
    start: 6.85, end: 10.8, label: '03', accent: '#40edff',
    words: [
      { text: 'ONE IH', x: 626, y: 305, size: 101, at: .2, tilt: -4, colors: ['#ffffff', '#d5d8ff'], box: '#663bff' },
      { text: 'STVARAJU.', x: 641, y: 489, size: 144, at: .88, tilt: -3, colors: ['#40edff', '#a88bff', '#ff4fc8', '#ffab47', '#caff36'], box: null },
    ],
    bursts: [{ at: .24, x: 408, y: 228 }, { at: .95, x: 1010, y: 389 }],
  },
];

const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const easeOut = n => 1 - (1 - clamp(n)) ** 3;
const smooth = n => { n = clamp(n); return n * n * (3 - 2 * n); };
const random = seed => { const n = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return n - Math.floor(n); };
const spring = n => n <= 0 ? 0 : n >= 1 ? 1 : 1 - Math.exp(-7.5 * n) * Math.cos(11.5 * n);
const rgba = (color, a) => {
  const hex = color.slice(1);
  return `rgba(${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)},${clamp(a)})`;
};
const mix = (a, b, weight) => {
  const values = [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - weight) + parseInt(b.slice(i, i + 2), 16) * weight));
  return `#${values.map(v => v.toString(16).padStart(2, '0')).join('')}`;
};

let prepared = false;
let background;
const wordCache = new Map();

function loadFonts() {
  const localBlack = join(process.env.WINDIR || 'C:/Windows', 'Fonts', 'ariblk.ttf');
  const fallback = join(ROOT, 'node_modules/@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2');
  if (!GlobalFonts.registerFromPath(existsSync(localBlack) ? localBlack : fallback, 'Riot Heavy')) {
    throw new Error('Nije moguće učitati font za titlove.');
  }
  if (!existsSync(localBlack)) {
    GlobalFonts.registerFromPath(join(ROOT, 'node_modules/@fontsource-variable/montserrat/files/montserrat-latin-ext-wght-normal.woff2'), 'Riot Heavy');
  }
  const systemBody = join(process.env.WINDIR || 'C:/Windows', 'Fonts', 'arial.ttf');
  const body = join(ROOT, 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2');
  GlobalFonts.registerFromPath(existsSync(systemBody) ? systemBody : body, 'Riot UI');
  if (!existsSync(systemBody)) {
    GlobalFonts.registerFromPath(join(ROOT, 'node_modules/@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2'), 'Riot UI');
  }
}

function roundRect(ctx, x, y, w, h, radius, fill) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fillStyle = fill; ctx.fill();
}

function trackedText(ctx, text, x, y, size, color, spacing = 3) {
  ctx.font = `600 ${size}px "Riot UI"`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = color;
  for (const letter of text) { ctx.fillText(letter, x, y); x += ctx.measureText(letter).width + spacing; }
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

function makeBackground() {
  const canvas = createCanvas(DEMO.width, DEMO.height), ctx = canvas.getContext('2d');
  ctx.fillStyle = '#080911'; ctx.fillRect(0, 0, DEMO.width, DEMO.height);
  for (const [x, y, r, color] of [[290, 240, 510, '#581467'], [1070, 515, 450, '#004658'], [670, 665, 470, '#231440']]) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, rgba(color, .42)); glow.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = glow; ctx.fillRect(0, 0, DEMO.width, DEMO.height);
  }
  // Subtle procedural paper/grain: deterministic, with no image assets.
  for (let i = 0; i < 11000; i++) {
    const x = Math.floor(random(i * 3) * DEMO.width), y = Math.floor(random(i * 3 + 1) * DEMO.height);
    ctx.fillStyle = `rgba(216,209,255,${.012 + random(i + 999) * .035})`; ctx.fillRect(x, y, 1, 1);
  }
  ctx.strokeStyle = '#ffffff13'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(48, 100); ctx.lineTo(1232, 100); ctx.moveTo(48, 612); ctx.lineTo(1232, 612); ctx.stroke();
  return canvas;
}

function makeGlyph(letter, size, face, dark) {
  const measure = createCanvas(1, 1).getContext('2d');
  measure.font = `900 ${size}px "Riot Heavy"`;
  const advance = measure.measureText(letter).width;
  const padding = 70, depth = dark ? 7 : 15;
  const canvas = createCanvas(Math.ceil(advance + padding * 2 + depth), Math.ceil(size * 1.4 + padding * 2 + depth));
  const ctx = canvas.getContext('2d'), ox = padding + advance / 2, oy = padding + size;
  ctx.font = measure.font; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  ctx.shadowColor = '#000000cc'; ctx.shadowBlur = 19; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 13;
  ctx.lineWidth = 10; ctx.strokeStyle = '#050714'; ctx.strokeText(letter, ox + depth * .55, oy + depth);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  for (let d = depth; d > 0; d -= 1) {
    ctx.fillStyle = mix('#241445', face, .12 + .33 * (1 - d / depth));
    ctx.strokeStyle = '#080713'; ctx.lineWidth = 9;
    ctx.strokeText(letter, ox + d * .68, oy + d); ctx.fillText(letter, ox + d * .68, oy + d);
  }
  ctx.shadowColor = rgba(face, .55); ctx.shadowBlur = dark ? 0 : 14;
  ctx.strokeStyle = dark ? '#080714' : mix(face, '#ffffff', .35); ctx.lineWidth = 10;
  ctx.strokeText(letter, ox, oy);
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#080714'; ctx.lineWidth = 6;
  ctx.strokeText(letter, ox, oy);
  const gradient = ctx.createLinearGradient(0, oy - size, 0, oy + 8);
  if (dark) {
    gradient.addColorStop(0, '#392442'); gradient.addColorStop(1, '#080913');
  } else {
    gradient.addColorStop(0, mix(face, '#ffffff', .8));
    gradient.addColorStop(.32, mix(face, '#ffffff', .2));
    gradient.addColorStop(.63, face); gradient.addColorStop(1, mix(face, '#220c54', .27));
  }
  ctx.fillStyle = gradient; ctx.fillText(letter, ox, oy);
  return { canvas, ox, oy, advance };
}

function prepareWord(word) {
  const key = JSON.stringify(word);
  if (wordCache.has(key)) return wordCache.get(key);
  const measure = createCanvas(1, 1).getContext('2d'); measure.font = `900 ${word.size}px "Riot Heavy"`;
  const letters = [...word.text], spacing = word.size * -.027;
  const width = measure.measureText(word.text).width + spacing * Math.max(0, letters.length - 1);
  const glyphs = letters.map((letter, i) => {
    const color = word.colors[Math.floor(i * word.colors.length / letters.length) % word.colors.length];
    const glyph = makeGlyph(letter, word.size, color, word.dark);
    const prefixWidth = measure.measureText(letters.slice(0, i).join('')).width;
    return { ...glyph, letter, color, x: -width / 2 + prefixWidth + spacing * i + glyph.advance / 2 };
  });
  const result = { width, glyphs }; wordCache.set(key, result); return result;
}

function prepare() {
  if (prepared) return;
  loadFonts(); background = makeBackground();
  SCENES.forEach(scene => scene.words.forEach(prepareWord));
  prepared = true;
}

function drawBackgroundMotion(ctx, t, scene, age) {
  // Deliberately sparse orbital lines leave the actual caption readable.
  ctx.save(); ctx.translate(640, 355); ctx.rotate(-.29 + Math.sin(t * .32) * .055);
  ctx.strokeStyle = rgba(scene.accent, .12); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(0, 0, 536, 205, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#a88bff15'; ctx.beginPath(); ctx.ellipse(0, 0, 565, 236, 0, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const a = t * .19 + i * Math.PI * 2 / 3;
    ctx.fillStyle = rgba(scene.accent, .55); ctx.beginPath(); ctx.arc(Math.cos(a) * 536, Math.sin(a) * 205, 3.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  for (let i = 0; i < 34; i++) {
    const x = 60 + random(i + 300) * 1160;
    const y = 130 + ((random(i + 400) * 430 - t * (4 + random(i) * 8)) % 430 + 430) % 430;
    const alpha = .14 + .11 * Math.sin(t * 1.3 + i);
    star(ctx, x, y, 1.5 + random(i + 500) * 2, DEMO.palette[i % 5], t * .1 + i, alpha);
  }
  for (let i = 0; i < 3; i++) {
    const base = [[167, 364, 21], [1110, 249, 13], [1059, 518, 23]][i];
    star(ctx, base[0], base[1] + Math.sin(t * 1.8 + i) * 10, base[2] * (.92 + Math.sin(t * 2 + i) * .12), DEMO.palette[(i + SCENES.indexOf(scene)) % 5], t * .35 + i);
  }
  for (const burst of scene.bursts) {
    const elapsed = age - burst.at;
    if (elapsed < 0 || elapsed > 1.15) continue;
    const p = elapsed / 1.15, radius = 24 + easeOut(p) * 148;
    ctx.save(); ctx.globalAlpha = (1 - p) ** 2 * .7; ctx.strokeStyle = scene.accent; ctx.lineWidth = 2 * (1 - p);
    ctx.beginPath(); ctx.arc(burst.x, burst.y, radius, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2 + random(i) * .3;
      const speed = 55 + random(i + 900) * 210, travel = easeOut(p) * speed;
      const x = burst.x + Math.cos(a) * travel, y = burst.y + Math.sin(a) * travel + p * p * 50;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + p * 3); ctx.globalAlpha = (1 - p) ** 1.4;
      ctx.fillStyle = DEMO.palette[i % 5]; ctx.fillRect(-2, -2, 4 + (1 - p) * 7, 2.5); ctx.restore();
    }
  }
}

function drawWord(ctx, word, age, sceneEnd, index) {
  const elapsed = age - word.at;
  if (elapsed < 0) return;
  const { width, glyphs } = prepareWord(word);
  const entrance = spring(elapsed / .65);
  const leave = smooth((age - (sceneEnd - .32)) / .32);
  const float = Math.sin(age * 1.7 + index) * 3 * smooth(elapsed - .65);
  ctx.save();
  ctx.translate(word.x + Math.sin(elapsed * 26) * Math.exp(-elapsed * 12) * 15, word.y + float - leave * 34);
  ctx.rotate((word.tilt * Math.PI / 180) + (1 - entrance) * -.09);
  ctx.globalAlpha = clamp(elapsed / .06) * (1 - leave);
  ctx.scale(1 - leave * .055, 1 - leave * .055);

  if (word.box) {
    const progress = easeOut(elapsed / .29), boxWidth = width + 46, boxHeight = word.size * .98;
    ctx.save(); ctx.rotate(-.018); ctx.scale(progress, .9 + progress * .1);
    ctx.shadowColor = rgba(word.box, .32); ctx.shadowBlur = 23;
    roundRect(ctx, -boxWidth / 2 + 8, -word.size * .88 + 9, boxWidth, boxHeight, 13, '#080810');
    roundRect(ctx, -boxWidth / 2, -word.size * .88, boxWidth, boxHeight, 13, word.box);
    ctx.shadowBlur = 0; ctx.strokeStyle = rgba('#ffffff', .28); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(-boxWidth / 2 + 2, -word.size * .88 + 2, boxWidth - 4, boxHeight - 4, 11); ctx.stroke();
    ctx.restore();
  }

  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];
    if (g.letter === ' ') continue;
    const delay = i * .025, local = elapsed - delay;
    if (local < 0) continue;
    const bounce = spring(local / .56), initial = 1 - easeOut(local / .42);
    ctx.save(); ctx.translate(g.x, (1 - bounce) * 68);
    ctx.rotate((1 - bounce) * (i % 2 ? .2 : -.2));
    ctx.scale(.72 + .28 * bounce, Math.max(.04, .27 + .73 * bounce));
    ctx.globalAlpha *= clamp(local / .065);
    if (initial > .015) {
      for (const [dx, color] of [[-17, '#40edff'], [17, '#ff4fc8']]) {
        ctx.save(); ctx.globalAlpha *= initial * .85; ctx.font = `900 ${word.size}px "Riot Heavy"`;
        ctx.textAlign = 'center'; ctx.fillStyle = color; ctx.fillText(g.letter, dx * initial, -6 * initial); ctx.restore();
      }
    }
    ctx.drawImage(g.canvas, -g.ox, -g.oy);
    ctx.restore();
  }

  if (index === 1 && elapsed > .3) {
    // Hand-drawn-looking fluorescent underline with a moving tip.
    const progress = easeOut((elapsed - .3) / .42), x = -width / 2 - 8, y = 33;
    ctx.save(); ctx.shadowColor = word.colors[0]; ctx.shadowBlur = 12;
    ctx.lineCap = 'round'; ctx.strokeStyle = word.colors[0]; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + width * progress * .5, y + 9, x + width * progress, y - 2); ctx.stroke();
    ctx.shadowBlur = 0;
    if (progress < 1) star(ctx, x + width * progress, y - 2, 9, '#ffffff', elapsed * 4);
    ctx.restore();
  }
  ctx.restore();
}

export function drawCaptionDemo(ctx, seconds, width = DEMO.width, height = DEMO.height) {
  prepare();
  const t = clamp(seconds, 0, DEMO.duration - 1 / DEMO.fps);
  const scene = SCENES.find(s => t >= s.start && t < s.end) || SCENES.at(-1);
  const age = t - scene.start;
  ctx.save(); ctx.scale(width / DEMO.width, height / DEMO.height);
  ctx.drawImage(background, 0, 0);
  drawBackgroundMotion(ctx, t, scene, age);

  trackedText(ctx, 'EDITA', 49, 68, 23, '#ffffff', 5);
  trackedText(ctx, 'MOTION LAB', 181, 67, 12, '#9c97b3', 2.2);
  roundRect(ctx, 1041, 39, 191, 39, 19.5, '#caff36');
  trackedText(ctx, 'NEON RIOT', 1062, 64, 14, '#121321', 2.3);
  scene.words.forEach((word, i) => drawWord(ctx, word, age, scene.end - scene.start, i));

  // Small, separate identity marks frame the composition; captions remain dominant.
  trackedText(ctx, scene.label, 49, 565, 16, scene.accent, 1);
  ctx.fillStyle = '#6d6681'; ctx.font = '500 13px "Riot UI"'; ctx.fillText('/ 03', 80, 565);
  ctx.textAlign = 'right'; ctx.fillStyle = '#aaa1bc'; ctx.font = '500 12px "Riot UI"'; ctx.fillText('TVOJE RIJEČI. TVOJ RITAM.', 1232, 565);
  ctx.textAlign = 'center'; ctx.font = '500 14px "Riot UI"'; ctx.fillStyle = '#b7b1cc';
  ctx.fillText(DEMO.sentence, 640, 654);
  const total = 46, barWidth = 9, gap = 5, start = 640 - (total * (barWidth + gap) - gap) / 2;
  for (let i = 0; i < total; i++) {
    const played = i / total <= t / DEMO.duration;
    const barHeight = played ? 4 + Math.sin(i * 1.4 + t * 5) ** 2 * 8 : 3;
    roundRect(ctx, start + i * (barWidth + gap), 684 - barHeight / 2, barWidth, barHeight, 1.5, played ? DEMO.palette[Math.floor(i / 10) % 5] : '#363043');
  }
  // Soft scene seams make the animated preview loop without a harsh cut.
  const fade = t < .13 ? 1 - smooth(t / .13) : t > DEMO.duration - .17 ? smooth((t - DEMO.duration + .17) / .17) : 0;
  if (fade > 0) { ctx.fillStyle = rgba('#080911', fade); ctx.fillRect(0, 0, DEMO.width, DEMO.height); }
  ctx.restore();
}

function findFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  const folder = join(ROOT, '.venv/Lib/site-packages/imageio_ffmpeg/binaries');
  if (existsSync(folder)) {
    const name = readdirSync(folder).find(n => /^ffmpeg.*\.exe$/i.test(n));
    if (name) return join(folder, name);
  }
  return 'ffmpeg';
}

function encoder(args) {
  const child = spawn(findFfmpeg(), args, { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
  let errors = '';
  child.stderr.on('data', chunk => { errors = (errors + chunk.toString()).slice(-6000); });
  const done = new Promise((resolveDone, reject) => {
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolveDone() : reject(new Error(`Video nije napravljen (${code}): ${errors}`)));
  });
  // The promise is awaited below; attach a handler immediately during frame production.
  void done.catch(() => {});
  return { child, done };
}

async function render() {
  await mkdir(OUT, { recursive: true });
  prepare();
  const canvas = createCanvas(DEMO.width, DEMO.height), ctx = canvas.getContext('2d');
  drawCaptionDemo(ctx, 8.95);
  await writeFile(join(OUT, 'neon-riot-poster.png'), await canvas.encode('png'));
  const sheet = createCanvas(1280, 3 * 720), sheetCtx = sheet.getContext('2d');
  for (const [i, time] of [2.1, 5.6, 9.2].entries()) {
    drawCaptionDemo(ctx, time); sheetCtx.drawImage(canvas, 0, i * 720);
  }
  await writeFile(join(OUT, 'neon-riot-scenes.png'), await sheet.encode('png'));
  if (process.argv.includes('--stills')) {
    console.log(`Slike: ${OUT}`); return;
  }

  const mp4 = join(OUT, 'neon-riot.mp4');
  const { child, done } = encoder(['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', `${DEMO.width}x${DEMO.height}`,
    '-framerate', String(DEMO.fps), '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'fast',
    '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-threads', '4', mp4]);
  let streamError;
  child.stdin.on('error', error => { streamError = error; });
  const count = Math.round(DEMO.duration * DEMO.fps);
  try {
    for (let frame = 0; frame < count; frame++) {
      if (streamError) throw streamError;
      drawCaptionDemo(ctx, frame / DEMO.fps);
      const pixels = ctx.getImageData(0, 0, DEMO.width, DEMO.height).data;
      const chunk = Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength);
      if (!child.stdin.write(chunk)) await once(child.stdin, 'drain');
      if (frame % 120 === 0) console.log(`Render ${Math.round(frame / count * 100)}%`);
    }
    child.stdin.end(); await done;
  } catch (error) {
    child.stdin.destroy(); child.kill(); await done.catch(() => {}); throw error;
  }
  const gif = join(OUT, 'neon-riot-preview.gif');
  const preview = encoder(['-hide_banner', '-loglevel', 'error', '-y', '-i', mp4,
    '-filter_complex', '[0:v]fps=18,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=sierra2_4a',
    '-loop', '0', '-threads', '4', gif]);
  preview.child.stdin.end(); await preview.done;
  await writeFile(join(OUT, 'scene.json'), JSON.stringify({ ...DEMO, scenes: SCENES }, null, 2) + '\n');
  console.log(`Gotovo: ${mp4}\nAnimirani preview: ${gif}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  render().catch(error => { console.error(error.message); process.exitCode = 1; });
}
