// Offline tests of the exact Canvas renderer used in the editor and video export.
// node scripts/test-caption-renderer.mjs [path-to-@napi-rs/canvas]
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const { createCanvas, Image, DOMMatrix } = require(process.argv[2] || '@napi-rs/canvas');
globalThis.DOMMatrix=DOMMatrix;
globalThis.OffscreenCanvas=class {constructor(width,height){return createCanvas(width,height);}};
globalThis.Image=class extends Image {
  set src(value){super.src=value.startsWith('/caption-textures/')?resolve('frontend/public',value.slice(1)):value;}
  get src(){return super.src;}
};
const work = resolve('work/caption-check');
await mkdir(work, { recursive: true });
await mkdir(resolve('outputs'), { recursive: true });
await writeFile(resolve(work,'neon-riot-core.mjs'),await readFile(resolve('frontend/src/lib/neon-riot-core.mjs')));
for (const [name, input] of Object.entries({ 'video-crop':'lib/video-crop', 'collection':'config/captions/collection', 'collection-captions':'lib/collection-captions', 'signature-caption-styles':'lib/signature-caption-styles', 'ink-impact':'lib/ink-impact', 'caption-accent-motion':'lib/caption-accent-motion', 'prism-fold':'lib/prism-fold', 'neon-riot':'lib/neon-riot', 'neon-riot-variants':'config/captions/neon-riot-variants', 'caption-frames':'lib/caption-frames', 'caption-script-stroke':'lib/caption-script-stroke', 'caption-background':'lib/caption-background', 'caption-transform':'lib/caption-transform', 'caption-texture-fill':'lib/caption-texture-fill', 'caption-light-effects':'lib/caption-light-effects', 'caption-capabilities':'lib/caption-capabilities', 'caption-font-weight':'lib/caption-font-weight', 'caption-word-roles':'lib/caption-word-roles', 'editorial-caption-styles':'lib/editorial-caption-styles', 'metallic-compact':'lib/metallic-compact', 'premium-orange':'lib/premium-orange', 'progressive-caption':'lib/progressive-caption', 'reference-caption-styles':'lib/reference-caption-styles', 'dynamic-glass':'lib/dynamic-glass', 'illustrated-caption-styles':'lib/illustrated-caption-styles', 'text-surface': 'lib/text-surface', 'caption-timing': 'lib/caption-timing', 'caption-presets': 'config/captions/presets', 'caption-renderer': 'lib/caption-renderer', colors: 'config/captions/colors', animations: 'config/captions/animations', effects: 'config/captions/effects' })) {
  const source = await readFile(resolve(`frontend/src/${input}.ts`), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } });
  const runnable = outputText.replace(/(['"])\.\.\/config\/captions\/presets\1/g, '"./caption-presets.mjs"').replace(/(['"])(?:\.\.\/config\/captions\/|\.\/)(video-crop|collection|collection-captions|signature-caption-styles|ink-impact|caption-accent-motion|prism-fold|neon-riot|neon-riot-variants|caption-frames|caption-script-stroke|caption-background|caption-transform|caption-texture-fill|caption-light-effects|caption-capabilities|caption-font-weight|colors|animations|effects|caption-word-roles|text-surface|editorial-caption-styles|metallic-compact|premium-orange|progressive-caption|reference-caption-styles|dynamic-glass|illustrated-caption-styles)\1/g, '"./$2.mjs"');
  await writeFile(resolve(work, `${name}.mjs`), runnable);
}
const {prepareSerifTextures,prepareGoldTextures}=await import(pathToFileURL(resolve(work,'text-surface.mjs')));
await Promise.all([prepareSerifTextures(),prepareGoldTextures()]);
const { templates: allTemplates, duoTemplates, settingsForTemplate } = await import(pathToFileURL(resolve(work, 'caption-presets.mjs')));
// The imported browser/WebGL collection needs its own browser fidelity run.
// This Skia suite continues to cover every pre-existing style. No GL results are implied.
const {isCollectionStyle}=await import(pathToFileURL(resolve(work,'collection.mjs')));
const browserCollection=allTemplates.filter(template=>isCollectionStyle(template.key));
const templates=allTemplates.filter(template=>!isCollectionStyle(template.key));
const {isNeonRiotStyle}=await import(pathToFileURL(resolve(work,'neon-riot-variants.mjs')));
const { drawCaption, activeWordIndex, captionFrameKey } = await import(pathToFileURL(resolve(work, 'caption-renderer.mjs')));
// Exercise the actual component animation loop with a RAF clock behind performance.now().
{
  const source = await readFile(resolve('frontend/src/components/CaptionSample/CaptionSample.tsx'), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } });
  const canvas = createCanvas(360, 640);
  let callback, cleanup;
  const componentExports = {};
  runInNewContext(outputText, {
    exports: componentExports,
    require: name => name === 'react' ? {
      memo: fn => fn, useRef: value => ({ current: value===null?canvas:value }), useMemo: fn => fn(), useEffect: fn => { cleanup = fn(); },
    } : name === 'react/jsx-runtime' ? { jsx: () => null, jsxs: () => null }
      : name.endsWith('/collection') ? {isCollectionStyle} : name.endsWith('/CollectionSample') ? {CollectionSample:()=>null} : name.includes('neon-riot-variants') ? {isNeonRiotStyle} : name.includes('presets') ? { settingsForTemplate, templates } : name.includes('portraits') ? { portraitStyle:()=>({}) } : name.includes('home-person-mask') ? { homePersonFrame:async()=>undefined } : { drawCaption,drawPersonCaption:drawCaption },
    performance: { now: () => 1000 },
    requestAnimationFrame: fn => { callback = fn; return 1; },
    cancelAnimationFrame: () => { callback = null; },
  });
  componentExports.CaptionSample({ template: templates[0], playing: true });
  const frames = [];
  for (const time of [990, 1100, 1500, 2300, 3400, 5300]) {
    const next = callback; callback = null;
    assert.doesNotThrow(() => next(time), 'Preview must survive the first RAF timestamp and phrase boundaries');
    assert.equal(typeof callback, 'function', 'Preview continues scheduling frames');
    const pixels = canvas.getContext('2d').getImageData(0, 0, 360, 640).data;
    assert.ok(pixels.some((value, index) => index % 4 === 3 && value > 0), 'Every sampled frame has visible text');
    frames.push(createHash('sha256').update(pixels).digest('hex'));
  }
  assert.ok(new Set(frames).size > 3, 'Preview actually animates');
  const finish = callback; callback = null; finish(5900);
  assert.equal(typeof callback, 'function', 'Hovered preview keeps animating without a timed static reset');
  cleanup();
  assert.equal(callback, null, 'Stopping cleans up the animation');
}
const segment = { id: 'test', text: 'Svjetlo u pokretu', start: 0, end: 3, words: [
  { text: 'Svjetlo', start: 0, end: .7 }, { text: 'u', start: 1, end: 1.4 }, { text: 'pokretu', start: 1.6, end: 3 },
] };
const preset = (key, extra = {}) => ({ ...settingsForTemplate(templates.find((item) => item.key === key)), x: 50, y: 50, ...extra });
function render(key, settings = preset(key), time = 2, width = 720, height = 240, text = segment) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const bounds = drawCaption(ctx, text, time, key, settings);
  return { canvas, ctx, bounds, pixels: ctx.getImageData(0, 0, width, height).data };
}
const hash = (image) => createHash('sha256').update(image.pixels).digest('hex');
// Detached styles remain pixel-identical after global changes and project serialization.
const detached={...segment,detachedStyle:{style:'neon',settings:preset('neon')}};
assert.equal(hash(render('clean',preset('clean'),2,720,240,detached)),hash(render('box',preset('box',{fontScale:180}),2,720,240,JSON.parse(JSON.stringify(detached)))));
assert.notEqual(hash(render('primeFrame',preset('primeFrame'),.05)),hash(render('primeFrame',preset('primeFrame'),.3)));
assert.notEqual(captionFrameKey(segment,.05,'primeFrame',preset('primeFrame')),captionFrameKey(segment,.3,'primeFrame',preset('primeFrame')));
// New animated styles retain transparent canvas and repaint at different times.
for(const key of ['orbitSignal','velvetScript']){
 const settings=preset(key);
 const early=render(key,settings,.2,720,1280),late=render(key,settings,2.4,720,1280);
 assert.deepEqual(early.bounds.words.map(word=>word.text),['Svjetlo']);
 assert.deepEqual(late.bounds.words.map(word=>word.text),['Svjetlo','u','pokretu']);
 assert.equal(late.pixels[3],0,key+' preserves the video background');
 assert.equal(hash(early),hash(render(key,settings,.2,720,1280)),key+' is deterministic after a backwards seek');
 assert.equal(hash(late),hash(render(key,JSON.parse(JSON.stringify(settings)),2.4,720,1280)),key+' survives project serialization');
 assert.notEqual(hash(late),hash(render(key,{...settings,highlightColor:'#ee2266'},2.4,720,1280)),key+' palette affects export pixels');
 const disabled=key==='orbitSignal'?{orbitRings:false,orbitSatellites:0,orbitLeader:false}:{velvetFlourish:false,shineStrength:0};
 assert.notEqual(hash(late),hash(render(key,{...settings,...disabled},2.4,720,1280)),key+' native controls affect pixels');
 assert.notEqual(captionFrameKey(segment,.01,key,settings),captionFrameKey(segment,.025,key,settings));
 assert.equal(render(key,settings,3).bounds,null);
 assert.equal(render(key,{...settings,wordMode:'single'},.8).bounds,null,'Single-word mode respects transcript pauses');
 const edited={...segment,text:'Čuvaj svoj jedinstven glas',words:undefined};
 assert.deepEqual(render(key,{...settings,wordMode:'all'},1,720,1280,edited).bounds.words.map(word=>word.text),edited.text.split(' '));
}

{
 const settings=preset('inkImpact');
 const early=render('inkImpact',settings,.12,720,1280);
 const late=render('inkImpact',settings,2.4,720,1280);
 assert.deepEqual(early.bounds.words.map(word=>word.text),['Svjetlo']);
 assert.deepEqual(late.bounds.words.map(word=>word.text),['Svjetlo','u','pokretu']);
 assert.equal(late.pixels[3],0,'Ink Impact does not cover the video background');
 assert.equal(hash(early),hash(render('inkImpact',settings,.12,720,1280)),'The grain and droplets are stable after seeking backwards');
 assert.equal(hash(late),hash(render('inkImpact',JSON.parse(JSON.stringify(settings)),2.4,720,1280)));
 assert.notEqual(hash(late),hash(render('inkImpact',{...settings,highlightColor:'#36ddcc'},2.4,720,1280)),'Marker palette reaches the shared renderer');
 assert.notEqual(hash(late),hash(render('inkImpact',{...settings,inkBrush:false},2.4,720,1280)),'The marker can be removed independently');
 assert.notEqual(hash(late),hash(render('inkImpact',{...settings,inkGrain:0},2.4,720,1280)),'Grain control changes the actual letter artwork');
 assert.notEqual(captionFrameKey(segment,.01,'inkImpact',settings),captionFrameKey(segment,.025,'inkImpact',settings));
 assert.equal(render('inkImpact',settings,3).bounds,null);
 assert.equal(render('inkImpact',{...settings,wordMode:'single'},.8).bounds,null,'Single-word mode respects pauses in the transcript');
 const custom={...segment,text:'Čuvaj svoj jedinstven glas',words:undefined};
 assert.deepEqual(render('inkImpact',{...settings,wordMode:'all'},1,720,1280,custom).bounds.words.map(word=>word.text),custom.text.split(' '));
}

{
 const settings=preset('prismFold');
 const opened=render('prismFold',settings,2.4,720,1280);
 assert.deepEqual(opened.bounds.words.map(w=>w.text),['Svjetlo','u','pokretu']);
 assert.equal(opened.pixels[3],0,'Prism Fold keeps the video background transparent');
 assert.equal(hash(opened),hash(render('prismFold',JSON.parse(JSON.stringify(settings)),2.4,720,1280)));
 assert.notEqual(hash(render('prismFold',settings,.12)),hash(render('prismFold',{...settings,foldSlices:8},.12)),'Fold count changes the sliced entrance');
 assert.notEqual(hash(opened),hash(render('prismFold',{...settings,foldColor2:'#ff3344'},2.4,720,1280)));
 assert.equal(render('prismFold',settings,3).bounds,null);
 const clean=preset('clean');
 assert.equal(hash(render('clean',clean)),hash(render('clean',{...clean,accentMotion:'none',accentTrails:false,accentParticles:false})),'Optional effects preserve existing styles when disabled');
 for(const motion of ['spring','slide','wave','flip','zoom','glitch']){
  const s={...clean,accentMotion:motion,accentTrails:true,accentParticles:true};
  const first=render('clean',s,.12),later=render('clean',s,.45);
  assert.ok(first.bounds&&later.bounds);
  assert.notEqual(hash(first),hash(later));
  assert.equal(hash(first),hash(render('clean',s,.12)),'Accent motion is deterministic after seeking');
  assert.notEqual(captionFrameKey(segment,.01,'clean',s),captionFrameKey(segment,.025,'clean',s));
 }
}

for (const key of ['editorialLight','stackedHeadlines']) {
  assert.notEqual(hash(render(key,preset(key),.1)),hash(render(key,preset(key),1.5)));
  assert.notEqual(captionFrameKey(segment,.1,key,preset(key)),captionFrameKey(segment,1.5,key,preset(key)));
  assert.ok(render(key,preset(key),1.5).bounds.words.length>0);
}
assert.equal(settingsForTemplate(templates.find(t=>t.key==='primeFrame')).y,65);
assert.equal(render('paperCut',preset('paperCut'),2).pixels[3],0,'Paper captions do not cover the video background');
const coverage = (image) => { let count = 0; for (let i = 3; i < image.pixels.length; i += 4) if (image.pixels[i] > 5) count++; return count; };

// Neon Riot: actual user words, seek determinism, full save/load and 60fps invalidation.
{
  const collection=templates.filter(t=>isNeonRiotStyle(t.key));
  assert.equal(collection.length,20);
  assert.equal(collection[0].name,'Neon Riot · 01 Original');
  const settings=preset('neonRiot');
  const early=render('neonRiot',settings,.4,720,1280);
  const late=render('neonRiot',settings,2.4,720,1280);
  assert.deepEqual(early.bounds.words.map(w=>w.text),['Svjetlo']);
  assert.deepEqual(late.bounds.words.map(w=>w.text),['Svjetlo','u','pokretu']);
  assert.ok(coverage(late)>20);
  assert.equal(late.pixels[3],0,'Authored caption stays transparent over the user video');
  assert.equal(hash(early),hash(render('neonRiot',settings,.4,720,1280)),'Seeking backwards restores the same pixels');
  assert.equal(hash(late),hash(render('neonRiot',JSON.parse(JSON.stringify(settings)),2.4,720,1280)));
  assert.notEqual(captionFrameKey(segment,.01,'neonRiot',settings),captionFrameKey(segment,.025,'neonRiot',settings),'Animation does not share a 30fps cache bucket');
  assert.notEqual(hash(late),hash(render('neonRiot',{...settings,riotColor3:'#ff0000'},2.4,720,1280)),'Palette edits reach the export renderer');
  assert.equal(render('neonRiot',settings,3).bounds,null,'Caption ends at the segment boundary');
  const all=render('neonRiot',{...settings,wordMode:'all'},1,720,1280,{...segment,text:'Čudne riječi imaju svoj poseban ritam i sasvim drugačiji tekst',words:undefined});
  assert.equal(all.bounds.words.length,10,'All-word mode preserves the complete edited sentence');
}

for (const key of ['revealPop', 'revealRise', 'revealFade', 'revealLetters', 'wordUnderline']) {
  const early = render(key, preset(key), .4);
  const later = render(key, preset(key), 2.2);
  assert.deepEqual(early.bounds.words.map(w => w.text), ['Svjetlo'], `${key}: unspoken words stay hidden`);
  assert.deepEqual(later.bounds.words.map(w => w.text), ['Svjetlo','u','pokretu'], `${key}: spoken words remain visible`);
  assert.equal(early.bounds.words[0].x, later.bounds.words[0].x, `${key}: revealing words preserves layout`);
  assert.notEqual(hash(render(key, preset(key), .04)), hash(render(key, preset(key), .16)), `${key}: motion changes the rendered frame`);
  assert.notEqual(captionFrameKey(segment, .04, key, preset(key)), captionFrameKey(segment, .16, key, preset(key)), `${key}: export cache repaints animation`);
  assert.equal(hash(later), hash(render(key, JSON.parse(JSON.stringify(preset(key))), 2.2)), `${key}: save/load preserves output`);
  assert.equal(hash(render(key, preset(key), .4)), hash(early), `${key}: seek backwards is deterministic`);
}
const underlined = preset('wordUnderline', { emphasisWord: 1, underlineColor: '#ff0000' });
assert.notEqual(hash(render('wordUnderline', underlined, 2.2)), hash(render('wordUnderline', {...underlined, underlineColor:'#00ff00'}, 2.2)), 'Chosen word retains configurable underline after speech');
assert.notEqual(hash(render('mixedFocus', preset('mixedFocus'), 2.2)), hash(render('mixedFocus', preset('mixedFocus', {emphasisWord:0}), 2.2)), 'Choosing the emphasis changes mixed typography');

assert.equal(activeWordIndex(segment, .8, 3), -1, 'Timed pauses hide the word');
assert.equal(activeWordIndex(segment, 1.2, 3), 1);
assert.equal(activeWordIndex(segment, 3, 3), -1);
assert.equal(render('neon', preset('neon', { wordMode: 'single' }), .8).bounds, null);
assert.ok(render('neon', preset('neon', { wordMode: 'single' }), 1.2).bounds);
assert.notEqual(hash(render('neon', preset('neon', { wordMode: 'single' }), 1.2)), hash(render('neon', preset('neon'), 1.2)));

const noGlow = render('neon', preset('neon', { glowIntensity: 0 }));
const glow = render('neon');
assert.ok(coverage(glow) > coverage(noGlow) * 2, 'Neon has a real halo outside the glyphs');
assert.ok(coverage(render('neon', preset('neon', { glowRadius: 100 }))) > coverage(render('neon', preset('neon', { glowRadius: 0 }))), 'Radius changes halo width');
assert.notEqual(hash(render('neon', preset('neon', { glowIntensity: 25 }))), hash(render('neon', preset('neon', { glowIntensity: 180 }))));
for (const [key, change] of [
  ['neon', { highlightColor: '#ff1234' }], ['threeD', { effectDepth: 0 }],
  ['gradient', { gradientAngle: 0 }], ['chrome', { gradientAngle: 0 }],
  ['sticker', { outlineColor: '#ff1234' }],
  ['clean', { letterSpacing: 20 }], ['clean', { rotation: 30 }],
]) assert.notEqual(hash(render(key)), hash(render(key, preset(key, change))), `${key} control changes pixels`);
assert.notEqual(hash(render('clean', preset('clean', {outlineWidth:2}))), hash(render('clean', preset('clean', {outlineWidth:2,outlineColor:'#ff1234'}))), 'Optional clean outline color changes pixels when enabled');
assert.notEqual(hash(render('neon', preset('neon', { animation: 'fade' }), .01)), hash(render('neon', preset('neon', { animation: 'fade' }), .3)));
assert.equal(captionFrameKey(segment, 1.7, 'neon', preset('neon')), captionFrameKey(segment, 2.2, 'neon', preset('neon')), 'Stable glow can be cached');
assert.notEqual(captionFrameKey(segment, .4, 'word', preset('word')), captionFrameKey(segment, 1.2, 'word', preset('word')), 'New word invalidates the cache');
assert.notEqual(captionFrameKey(segment, .04, 'neon', preset('neon', { animation: 'pop' })), captionFrameKey(segment, .12, 'neon', preset('neon', { animation: 'pop' })), 'Animation invalidates the cache');
assert.notEqual(hash(render('sticker')), hash(render('sticker', preset('sticker', { outlineWidth: 1 }))));
assert.notEqual(hash(render('focus')), hash(render('focus', preset('focus', { uppercase: false }))));

// All three layers contain visible interior pixels, not just different settings.
const threeLayers = render('duoElectric', preset('duoElectric', {
  textColor: '#00ff00', outlineColor: '#ff0000', outerOutlineColor: '#0000ff',
  outlineWidth: 3, outerOutlineWidth: 2, outlineGlow: false,
}));
function colorCount(image, r, g, b) {
  let count = 0;
  for (let i = 0; i < image.pixels.length; i += 4) {
    if (Math.abs(image.pixels[i] - r) < 8 && Math.abs(image.pixels[i + 1] - g) < 8
      && Math.abs(image.pixels[i + 2] - b) < 8 && image.pixels[i + 3] > 240) count++;
  }
  return count;
}
for (const [r, g, b] of [[255, 0, 0], [0, 255, 0], [0, 0, 255]]) {
  assert.ok(colorCount(threeLayers, r, g, b) > 150, 'Face, inner and outer band are independently visible');
}
for (const change of [{ textColor: '#ff0066' }, { outlineColor: '#ff0066' }, { outerOutlineColor: '#ff0066' },
  { outlineWidth: 0 }, { outerOutlineWidth: 0 }, { wordColorMode: 'alternate' }]) {
  assert.notEqual(hash(render('duoElectric')), hash(render('duoElectric', preset('duoElectric', change))), `Duo control changes rendered pixels: ${JSON.stringify(change)}`);
}
assert.ok(coverage(render('duoSunshine')) > coverage(render('duoSunshine', preset('duoSunshine', { outlineGlow: false }))), 'Optional glow adds a halo');
assert.notEqual(hash(render('duoSunshine')), hash(render('duoSunshine', preset('duoSunshine', { outlineGlowColor: '#ff0066' }))));
assert.notEqual(hash(render('duoBeat', preset('duoBeat'), .4)), hash(render('duoBeat', preset('duoBeat'), 2)), 'Highlight follows speech');
assert.notEqual(captionFrameKey(segment, .4, 'duoBeat', preset('duoBeat')), captionFrameKey(segment, 2, 'duoBeat', preset('duoBeat')), 'Active highlight invalidates export cache');
assert.equal(render('duoCherry', preset('duoCherry', { wordMode: 'single' }), .8).bounds, null);
assert.equal(settingsForTemplate(duoTemplates[0], preset('duoCherry', { wordMode: 'single' })).wordMode, 'single', 'Changing style keeps single-word preference');
const legacySettings = preset('clean');
for (const key of ['outerOutlineWidth', 'outerOutlineColor', 'outlineGlow', 'outlineGlowColor', 'wordColorMode']) delete legacySettings[key];
assert.equal(hash(render('clean', legacySettings)), hash(render('clean')), 'Older saved settings remain compatible');

for (const template of templates) {
  for (const [width, height] of [[1280, 720], [720, 1280]]) {
    const result = render(template.key, preset(template.key), 2, width, height);
    assert.ok(coverage(result) > 20, `${template.key} paints visible pixels`);
    assert.ok(result.bounds.width > 0 && result.bounds.width < 100, `${template.key} fits frame`);
  }
}
// Same sentence across all presets verifies visual differentiation, not just different sample text.
const unique = new Set(templates.map((template) => hash(render(template.key))));
assert.ok(unique.size >= templates.length - 2, `${unique.size}/${templates.length} visibly distinct preset outputs`);
const long = render('clean', preset('clean'), 2, 720, 1280, { ...segment, text: 'Ovo je duži titl koji mora zadržati sve svoje riječi i ispravno prelomiti tekst kroz više redova bez nestanka sadržaja.' });
assert.ok(long.bounds && long.bounds.height < 100);

const sheet = createCanvas(1440, Math.ceil(templates.length / 4) * 210 + 84);
const ctx = sheet.getContext('2d');
ctx.fillStyle = '#080b12'; ctx.fillRect(0, 0, sheet.width, sheet.height);
ctx.fillStyle = '#ffffff'; ctx.font = 'bold 28px Arial'; ctx.fillText(`Titlovi · ${templates.length} efekta / isti renderer za pregled i izvoz`, 24, 48);
templates.forEach((template, index) => {
  const x = (index % 4) * 360; const y = 84 + Math.floor(index / 4) * 210;
  const sample = createCanvas(720, 300); const sc = sample.getContext('2d');
  const bg = sc.createLinearGradient(0, 0, 720, 300); bg.addColorStop(0, '#222536'); bg.addColorStop(1, '#080a10');
  sc.fillStyle = bg; sc.fillRect(0, 0, 720, 300);
  drawCaption(sc, { ...segment, text: template.sample, words: undefined }, 2, template.key, preset(template.key, { fontScale: 140 }));
  ctx.drawImage(sample, x + 10, y, 340, 142);
  ctx.fillStyle = '#f1f2fa'; ctx.font = '20px Arial'; ctx.fillText(template.name, x + 18, y + 172);
});
await writeFile(resolve('outputs/caption-effects-contact-sheet.png'), sheet.toBuffer('image/png'));
const comparison = createCanvas(1280, 720); const cc = comparison.getContext('2d');
for (const [i, background] of ['#10121e', '#c8bca8'].entries()) {
  cc.fillStyle = background; cc.fillRect(0, i * 360, 1280, 360);
  for (const [j, intensity] of [0, 150].entries()) {
    const result = render('neon', preset('neon', { glowIntensity: intensity, fontScale: 120 }), 2, 640, 300, { ...segment, text: 'NEON GLOW', words: undefined });
    cc.drawImage(result.canvas, j * 640, i * 360 + 25);
    cc.fillStyle = i ? '#10121e' : '#e5e5ed'; cc.font = '20px Arial'; cc.fillText(intensity ? 'Višeslojni sjaj' : 'Bez sjaja', j * 640 + 220, i * 360 + 320);
  }
}
await writeFile(resolve('outputs/caption-neon-comparison.png'), comparison.toBuffer('image/png'));

const duoSheet = createCanvas(1440, 1100); const dc = duoSheet.getContext('2d');
dc.fillStyle = '#0e1019'; dc.fillRect(0, 0, 1440, 1100);
dc.font = 'bold 30px Arial'; dc.fillStyle = '#ffffff'; dc.fillText('Dvobojni obrubi · 12 novih kombinacija', 28, 48);
duoTemplates.forEach((template, index) => {
  const x = index % 3 * 480; const y = Math.floor(index / 3) * 250 + 80;
  const card = createCanvas(720, 300); const c = card.getContext('2d');
  c.fillStyle = index < 6 ? '#252731' : '#d5cdbf'; c.fillRect(0, 0, 720, 300);
  drawCaption(c, { ...segment, text: template.sample, words: undefined }, 1.6, template.key, preset(template.key, { fontScale: 130 }));
  dc.drawImage(card, x + 12, y, 456, 190);
  dc.fillStyle = '#ffffff'; dc.font = '22px Arial'; dc.fillText(template.name, x + 20, y + 222);
});
await writeFile(resolve('outputs/caption-duo-combinations.png'), duoSheet.toBuffer('image/png'));
console.log(JSON.stringify({ passed: true, browserCollectionNotCovered:browserCollection.map(t=>t.key), styles: templates.length, uniqueStyles: unique.size, dualOutlineStyles: duoTemplates.length, neonPixelCoverage: { plain: coverage(noGlow), glow: coverage(glow) }, outputs: ['outputs/caption-effects-contact-sheet.png', 'outputs/caption-neon-comparison.png', 'outputs/caption-duo-combinations.png'] }));

const oneLine = render('clean', preset('clean'), 1, 720, 400, {...segment,text:'Prva druga'});
const twoLines = render('clean', preset('clean'), 1, 720, 400, {...segment,text:'Prva\ndruga'});
assert.ok(twoLines.bounds.height > oneLine.bounds.height, 'Explicit newline must create a second caption line in preview and export');
// Hover samples reveal words cumulatively without changing their final layout.
for (const motion of ['none','pop','fade','pulse']) {
  const canvas=createCanvas(360,640), ctx=canvas.getContext('2d');
  const painted=new Set(), fill=ctx.fillText.bind(ctx);
  ctx.fillText=(text,...args)=>{painted.add(text);return fill(text,...args);};
  drawCaption(ctx,segment,1.2,'word',preset('word',{uppercase:false}),motion);
  for (const word of ['Svjetlo','u']) assert.ok(painted.has(word), `${motion} retains ${word}`);
  assert.equal(painted.has('pokretu'), motion === 'none', `${motion} hides future words`);
  painted.clear();
  drawCaption(ctx,segment,2.2,'word',preset('word',{uppercase:false}),motion);
  for (const word of ['Svjetlo','u','pokretu']) assert.ok(painted.has(word), `${motion} retains revealed ${word}`);
}

// Word positions share the renderer used by both preview and burned video export.
for (const [width,height] of [[360,640],[1920,1080]]) {
  const ctx=createCanvas(width,height).getContext('2d');
  const settings=preset('clean',{rotation:20});
  const original=drawCaption(ctx,segment,2,'clean',settings);
  const saved=JSON.parse(JSON.stringify({...segment,wordOffsets:{1:{x:12,y:-8,text:'u'}}}));
  const moved=drawCaption(ctx,saved,2,'clean',settings);
  assert.ok(Math.abs(moved.words[1].x-original.words[1].x-12)<.001);
  assert.ok(Math.abs(moved.words[1].y-original.words[1].y+8)<.001);
  assert.deepEqual(moved.words[0],original.words[0], 'Other words stay in place');
  const scene=drawCaption(ctx,{...segment,position:{x:60,y:30}},2,'clean',settings);
  assert.equal(scene.x,60); assert.equal(scene.y,30);
}

{
  const ctx=createCanvas(720,1280).getContext('2d');
  const base=drawCaption(ctx,segment,2,'clean',preset('clean'));
  const styled=JSON.parse(JSON.stringify({...segment,wordsSeparated:true,wordStyles:{1:{text:'u',style:'neon',settings:preset('neon',{fontScale:160})}}}));
  const result=drawCaption(ctx,styled,2,'clean',preset('clean'));
  assert.deepEqual(result.words[0],base.words[0], 'Styling one word preserves its neighbour');
  assert.ok(result.words[1].height>base.words[1].height, 'Word has independent font size');
  const shifted=drawCaption(ctx,{...styled,wordOffsets:{1:{text:'u',x:10,y:-10}}},2,'clean',preset('clean'));
  assert.ok(Math.abs(shifted.words[1].x-result.words[1].x-10)<.01, 'Styled word remains draggable');
  assert.ok(Math.abs(shifted.words[1].y-result.words[1].y+10)<.01);
}

{
  const {resizeCaptionRipple}=await import(pathToFileURL(resolve(work,'caption-timing.mjs')));
  const source=[{id:'a',start:0,end:2,text:'A',words:[{text:'A',start:0,end:2}]},{id:'b',start:2.5,end:4,text:'B',words:[{text:'B',start:2.5,end:4}]},{id:'c',start:4,end:6,text:'C'}];
  const grown=resizeCaptionRipple(source,'a',5,10);
  assert.equal(grown[0].end,5);assert.equal(grown[1].start,5.5);assert.equal(grown[2].end,9);
  assert.equal(grown[0].words[0].end,5);assert.equal(grown[1].words[0].start,5.5);
  assert.equal(source[0].end,2,'Original drag snapshot is unchanged');
  assert.equal(resizeCaptionRipple(source,'a',20,10)[2].end,10,'Do not exceed video');
  assert.ok(resizeCaptionRipple(source,'a',-20,10)[0].end>=.099,'Keep a positive duration');
}
{
  const {moveCaption,reorderCaptions}=await import(pathToFileURL(resolve(work,'caption-timing.mjs')));
  const source=[{id:'a',text:'A',start:0,end:1},{id:'b',text:'B',start:2,end:3,words:[{text:'B',start:2,end:3}]},{id:'c',text:'C',start:4,end:5}];
  const moved=moveCaption(source,'b',1,8);
  assert.equal(moved[1].start,1);assert.equal(moved[1].end,2);assert.equal(moved[1].words[0].start,1);
  assert.equal(moveCaption(source,'b',10,8)[1].end,8);
  const reordered=reorderCaptions(source,'c','a');
  assert.deepEqual(reordered.map(item=>item.id),['c','a','b']);
  assert.equal(reordered[2].start,2);assert.equal(reordered[2].words[0].start,2);
  assert.equal(source[1].start,2);
}

{
  const {trimCaption,moveCaption}=await import(pathToFileURL(resolve(work,'caption-timing.mjs')));
  const source=[{id:'a',start:0,end:2,text:'A'},{id:'b',start:2,end:3,text:'B'}];
  const extended=trimCaption(source,'a','end',7,10);
  assert.equal(extended[0].end,2);assert.deepEqual(extended[1],source[1]);
  assert.equal(moveCaption(source,'a',5,10)[0].start,5);
  assert.equal(trimCaption(source,'b','start',.5,10)[1].start,2);
}
{
  const {moveCaption,trimCaption}=await import(pathToFileURL(resolve(work,'caption-timing.mjs')));
  const source=[{id:'a',text:'A',start:0,end:1,wordsSeparated:true,wordOffsets:{0:{x:10,y:0,text:'A'}}},{id:'b',text:'B',start:2,end:4}];
  for(const wanted of [-2,0,.5,1,1.5,2,3,4,5,9,12]) {
    const result=moveCaption(source,'a',wanted,10);
    const a=result.find(item=>item.id==='a'), b=result.find(item=>item.id==='b');
    assert.ok(a.end<=b.start || a.start>=b.end,'Separate scenes never overlap');
    assert.deepEqual(a.wordOffsets,source[0].wordOffsets,'Words keep positions within their own scene');
    assert.ok(a.start>=0 && a.end<=10);
  }
  assert.equal(trimCaption(source,'a','end',8,10)[0].end,2);
  assert.equal(trimCaption(source,'b','start',0,10)[1].start,1);
}

assert.notEqual(hash(render('paperCut',preset('paperCut',{backgroundColor:'#ff0000',backgroundOpacity:100}))),hash(render('paperCut',preset('paperCut',{backgroundColor:'#00ff00',backgroundOpacity:100}))));
assert.notEqual(hash(render('paperCut',preset('paperCut',{outlineColor:'#ff0000',outlineWidth:3}))),hash(render('paperCut',preset('paperCut',{outlineColor:'#00ff00',outlineWidth:3}))));
assert.notEqual(hash(render('stackedHeadlines',preset('stackedHeadlines',{backgroundTitles:1}))),hash(render('stackedHeadlines',preset('stackedHeadlines',{backgroundTitles:4}))));
assert.notEqual(hash(render('readingFade',preset('readingFade'),.1)),hash(render('readingFade',preset('readingFade'),2.5)));
console.log('Paper/background controls, headline count and spoken-word opacity checks passed.');

// Split header rendering must preserve the complete template when no person mask is present.
for (const key of ['editorialHeader','boldHeader']) {
  const canvas=createCanvas(720,240),ctx=canvas.getContext('2d');
  drawCaption(ctx,segment,2,key,preset(key),undefined,'background');
  assert.ok(ctx.getImageData(0,0,720,240).data.some((v,i)=>i%4===3&&v>0));
  drawCaption(ctx,segment,2,key,preset(key),undefined,'foreground');
  assert.equal(createHash('sha256').update(ctx.getImageData(0,0,720,240).data).digest('hex'),hash(render(key)));
}
for (const key of ['blurReading','mistWords','prismPop']) {
  assert.notEqual(hash(render(key,preset(key),.03)),hash(render(key,preset(key),.5)),`${key} animates spoken words`);
  assert.notEqual(captionFrameKey(segment,.03,key,preset(key)),captionFrameKey(segment,.5,key,preset(key)));
}
for (const key of ['newsHighlight','bigKeyword']) {
  assert.notEqual(hash(render(key,preset(key,{highlightColor:'#ff0000'}))),hash(render(key,preset(key,{highlightColor:'#00ff00'}))),`${key} respects keyword colour`);
}
console.log('New style animations, keyword colours and separate foreground/header rendering passed.');

for(const key of ['newsHighlight','bigKeyword'])assert.equal(render(key,preset(key),.05).bounds.words.length,segment.words.length,`${key} shows the full sentence immediately`);
assert.equal(render('clean',preset('clean',{wordMode:'spoken'}),.1).bounds.words.length,1);
assert.equal(render('clean',preset('clean',{wordMode:'all',reveal:'letters'}),.1).bounds.words.length,3);
assert.notEqual(captionFrameKey(segment,.1,'clean',preset('clean',{wordMode:'highlight'})),captionFrameKey(segment,2,'clean',preset('clean',{wordMode:'highlight'})));
// Run person-mask code with a deterministic segmentation model and real Canvas composites.
{
 let inferences=0;
 const fakeModel={segment:()=>{inferences++;return {confidenceMasks:[{width:8,height:8,getAsFloat32Array:()=>new Float32Array(64).fill(.8)}],close(){}};}};
 const source=await readFile(resolve('frontend/src/lib/person-mask.ts'),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText.replace('let model;','let model = fakeModel;');
 const scanSource=await readFile(resolve("frontend/src/lib/person-mask-scan.ts"),"utf8");
 const softenCode=ts.transpileModule(scanSource.slice(scanSource.indexOf("export function softenPersonMask"),scanSource.indexOf("type Sample=")),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const scanExports={};
 runInNewContext(softenCode,{exports:scanExports,document:{createElement:()=>createCanvas(8,8)}});
 const exports={};
 runInNewContext(code,{exports,fakeModel,require:name=>name.includes('caption-renderer')?{drawCaption}:{softenPersonMask:scanExports.softenPersonMask,preparedPersonMask:()=>undefined,cropRect:(w,h)=>({x:0,y:0,width:w,height:h})},document:{createElement:()=>{const canvas=createCanvas(8,8);canvas.dataset={};return canvas;}}});
 const video=createCanvas(8,8);Object.assign(video,{readyState:4,videoWidth:8,videoHeight:8,currentSrc:'fixture',currentTime:0});
 const ctx=createCanvas(8,8).getContext('2d');
 for(let frame=0;frame<30;frame++){video.currentTime=frame/30;ctx.fillStyle='white';ctx.fillRect(0,0,8,8);exports.maskCaptionBehindPerson(ctx,video,50,50,undefined,'#ff00ff');}
 assert.equal(inferences,2,'Prism samples the person twice per second rather than every frame');
 video.currentTime=.1;exports.maskCaptionBehindPerson(ctx,video,50,50,undefined,'#ff00ff');assert.ok(inferences<=3,'Seeking backwards uses a fresh or cached mask');
}
console.log('Sentence visibility, keyword repainting and 2 Hz Prism masking passed.');

// Word motion is independent of the paragraph and retains the requested opacity endpoints.
{
 const one={id:'motion',text:'Motion',start:0,end:3,words:[{text:'Motion',start:0,end:3}]};
 const settings=preset('slideFall',{y:40});
 const sample=t=>render('slideFall',settings,t,720,720,one);
 const center=image=>{let a=0,x=0,y=0;for(let i=3;i<image.pixels.length;i+=4){const alpha=image.pixels[i];a+=alpha;x+=((i-3)/4%720)*alpha;y+=Math.floor((i-3)/4/720)*alpha;}return{x:x/a,y:y/a,a};};
 const start=center(sample(0)),held=center(sample(1)),exit=center(sample(2.999));
 assert.ok(start.x<held.x-20,'Individual word enters from the left');
 assert.ok(exit.y>held.y+20,'Individual word falls on exit');
 assert.ok(start.a<held.a,'Entry is translucent');
 assert.ok(exit.a<start.a,'Exit is more translucent than entry');
 const alphaAt=time=>{const ctx=createCanvas(720,720).getContext('2d');const alphas=[];const fill=ctx.fillText.bind(ctx);ctx.fillText=(...args)=>{alphas.push(ctx.globalAlpha);fill(...args);};drawCaption(ctx,one,time,'slideFall',settings);return alphas.at(-1);};
 assert.ok(Math.abs(alphaAt(0)-.5)<.01,'Word paint starts at opacity 0.5');
 assert.ok(Math.abs(alphaAt(2.999)-.2)<.01,'Word paint ends at opacity 0.2');
 const before=render('slideFall',settings,.8,720,720,segment);
 assert.equal(before.bounds.words.length,segment.text.split(/\s+/).length,'Slide & Fall brings the sentence in together with a tiny stagger');
 assert.notEqual(captionFrameKey(segment,2.8,'slideFall',settings),captionFrameKey(segment,2.9,'slideFall',settings),'Exit frames are not cached as static');
}
console.log('Per-word left entry, downward exit, speech timing and opacity endpoints passed.');

{
 const ctx=createCanvas(720,1280).getContext('2d'),paint=[];const fill=ctx.fillText.bind(ctx);ctx.fillText=(text,...rest)=>{paint.push(text);fill(text,...rest);};
 const manual={id:'manual',text:'MY TITLE',role:'title',manualTitleLayout:true,start:0,end:3};
 const settings=preset('verticalTitle',{rotation:-90,x:20,y:30});
 const bounds=drawCaption(ctx,manual,1,'verticalTitle',settings);
 assert.ok(bounds&&bounds.rotation===-90,'Manual vertical header has editable bounds');
 assert.deepEqual(paint,['MY','MY','TITLE','TITLE'],'Each header word draws its shadow and face once, without an extra automatic header');
 const hidden={...segment,suppressSuggestions:true};
 const suppressed=render('verticalTitle',preset('verticalTitle'),1,720,1280,hidden);
 assert.equal(suppressed.bounds.words.length,3,'Suppressing automatic header restores the first word to ordinary text');
 assert.notEqual(hash(suppressed),hash(render('verticalTitle',preset('verticalTitle'),1,720,1280,segment)));
}

for(const key of ['clean','paperCut','neon','outline','readingFade'])assert.notEqual(hash(render(key,preset(key,{textDepth:0}))),hash(render(key,preset(key,{textDepth:80,textDepthColor:'#ff2300'}))),`${key} supports independent 3D depth`);
{
 const title={id:'independent-title',text:'Heading',start:0,end:3,role:'title',manualTitleLayout:true};
 const small=render('verticalTitle',preset('verticalTitle',{fontScale:80,rotation:-90}),1,720,1280,title);
 const large=render('verticalTitle',preset('verticalTitle',{fontScale:180,rotation:-45}),1,720,1280,title);
 assert.notEqual(hash(small),hash(large));assert.equal(large.bounds.rotation,-45);assert.ok(large.bounds.width>small.bounds.width);
}

{
 const {trimCaption,moveCaption,dragCaption}=await import(pathToFileURL(resolve(work,'caption-timing.mjs')));
 const source=[{id:'speech',text:'First',start:0,end:3},{id:'speech2',text:'Second',start:3,end:6},{id:'header',role:'title',lane:1,sourceCaptionId:'speech',text:'First',start:0,end:2}];
 const extended=trimCaption(source,'header','end',9,10);
 assert.equal(extended[2].end,9,'A title can span other captions');
 assert.deepEqual(extended.slice(0,2),source.slice(0,2),'Title resize leaves speech untouched');
 assert.equal(moveCaption(source,'header',4,10)[2].start,4,'Title keyboard movement crosses speech');
 assert.equal(dragCaption(source,'header',5,10)[2].start,5,'Title drag crosses speech');
 assert.equal(trimCaption(source,'speech','end',2.8,10)[0].end,2.8,'Title never blocks speech trimming');
 assert.equal(trimCaption(source,'header','end',99,10)[2].end,10,'Title ends inside video');
}

{
 const sample={id:'rotated-movement',text:'Long rotating title',start:0,end:3};
 const settings=preset('clean',{x:98,y:50,rotation:90,fontScale:130});
 const limited=render('clean',settings,1,720,1280,sample).bounds;
 const free=render('clean',{...settings,allowOverflow:true,x:115},1,720,1280,sample).bounds;
 assert.equal(limited.x,98,'All captions allow positioning beyond the rotated bounds');
 assert.ok(Math.abs(free.x-115)<.00001,'Overflow allows the anchor beyond the right edge');
}

{
 const ctx=createCanvas(720,1280).getContext('2d'),paint=[];
 const fill=ctx.fillText.bind(ctx);ctx.fillText=(text,x,y,...args)=>{const matrix=ctx.getTransform();paint.push({text,y:matrix.b*x+matrix.d*y+matrix.f});fill(text,x,y,...args);};
 const stroke=ctx.strokeText.bind(ctx);ctx.strokeText=(text,x,y,...args)=>{const matrix=ctx.getTransform();paint.push({text,y:matrix.b*x+matrix.d*y+matrix.f});stroke(text,x,y,...args);};
 const title={id:'layer-title',role:'title',text:'SELECTED',start:0,end:3,position:{x:50,y:45}};
 drawCaption(ctx,title,1,'stackedHeadlines',preset('stackedHeadlines',{backgroundTitles:4,outlineWidth:0}));
 assert.ok(paint.length>=4,'Layer Header paints all four title copies');
 assert.ok(paint.every(p=>p.text==='SELECTED'));
 assert.equal(new Set(paint.map(p=>Math.round(p.y))).size,4,'Moving the title keeps four distinct rows');
 const borders=segment=>{const c=createCanvas(720,1280).getContext('2d'),frames=[];c.strokeRect=()=>{frames.push({alpha:c.globalAlpha,y:c.getTransform().f});};drawCaption(c,segment,2.01,'primeFrame',preset('primeFrame'));return frames;};
 const continued=borders({id:'next',text:'Next',start:2,end:4,frameAnimationStart:0});
 const restarted=borders({id:'next',text:'Next',start:2,end:4});
 assert.equal(continued.length,3);
 assert.ok(continued.at(-1).alpha>.99&&restarted.at(-1).alpha<.1,'Continuation keeps the fully entered frame');
}

{
 const frame=(time)=>{const c=createCanvas(720,1280).getContext('2d'),frames=[];c.strokeRect=()=>frames.push({alpha:c.globalAlpha,matrix:c.getTransform()});drawCaption(c,{id:'idle',text:'Test',start:0,end:5,frameAnimationStart:0,frameAnimationEnd:5},time,'primeFrame',preset('primeFrame'));return frames;};
 const idle=frame(2),later=frame(3),exit=frame(4.9);
 assert.notEqual(idle.at(-1).matrix.a,later.at(-1).matrix.a,'Idle border gently scales and rotates');
 assert.ok(exit.at(-1).alpha<idle.at(-1).alpha,'Border exit fades out');
 assert.ok(exit.at(-1).matrix.f>idle.at(-1).matrix.f,'Border exit descends');
}

{
 const sample={id:'secondary-layer',text:'First second',start:0,end:3,wordStyles:{1:{text:'second',style:'clean',settings:preset('clean')}}};
 const paint=part=>{const ctx=createCanvas(720,1280).getContext('2d'),words=[];ctx.fillText=text=>words.push(text);drawCaption(ctx,sample,1,'clean',preset('clean'),undefined,part);return words;};
 assert.ok(paint('primary').every(word=>word==='First'));
 assert.ok(paint('secondary').length>0&&paint('secondary').every(word=>word==='second'),'Secondary layer can be masked independently');
}

// Material shading must remain inside glyphs and vary with material and tint.
{
 const {drawTextSurface}=await import(pathToFileURL(resolve(work,'text-surface.mjs')));
 const prior=globalThis.OffscreenCanvas;
 globalThis.OffscreenCanvas=class {constructor(w,h){return createCanvas(w,h);}};
 try {
  const hashes=new Set();
  for(const textMaterial of ['matte','metal','brushed','stone','satin']){
   const c=createCanvas(400,120),ctx=c.getContext('2d');ctx.font='bold 55px Arial';ctx.textBaseline='middle';
   drawTextSurface(ctx,'DEPTH',20,60,55,{...settingsForTemplate(templates[0]),textMaterial,surfaceStrength:80,surfaceColor:'#bd7053',surfaceOpacity:30});
   const pixels=ctx.getImageData(0,0,400,120).data;
   assert(pixels.some((v,i)=>i%4===3&&v>0));
   assert.equal(ctx.getImageData(390,0,10,120).data.some(v=>v>0),false);
   hashes.add(createHash('sha256').update(pixels).digest('hex'));
  }
  assert.equal(hashes.size,5);
  const coloured=['#ff3311','#1133ff'].map(textColor=>{const c=createCanvas(400,120),ctx=c.getContext('2d');ctx.font='bold 55px Arial';ctx.textBaseline='middle';drawTextSurface(ctx,'DEPTH',20,60,55,{...settingsForTemplate(templates[0]),textColor,surfaceColor:'#00ff00',surfaceStrength:80,surfaceOpacity:50});return createHash('sha256').update(c.toBuffer('image/png')).digest('hex');});
  assert.notEqual(coloured[0],coloured[1],'Texture tint and cache must follow the font colour');
 }finally{if(prior)globalThis.OffscreenCanvas=prior;else delete globalThis.OffscreenCanvas;}
 console.log('Five distinct glyph-surface materials render with transparent surroundings.');
}

{
 const settings=settingsForTemplate(templates.find(t=>t.key==='boldHeader'));
 const outputs=[0,100].map(backgroundOpacity=>{
  const c=createCanvas(360,640);
  drawCaption(c.getContext('2d'),{id:'title-no-box',role:'title',manualTitleLayout:true,text:'EDITA',start:0,end:3},1,'boldHeader',{...settings,textColor:settings.backgroundColor,backgroundOpacity,x:50,y:25});
  return createHash('sha256').update(c.toBuffer('image/png')).digest('hex');
 });
 assert.equal(outputs[0],outputs[1],'Header glyphs must not inherit the speech background box');
 console.log('Bold title rendering ignores the speech background box.');
}

{
 const borderAt=elapsed=>{const ctx=createCanvas(360,640).getContext('2d'),alpha=[];ctx.strokeRect=()=>alpha.push(ctx.globalAlpha);drawCaption(ctx,{id:'story',text:'Story',start:0,end:2.4,frameAnimationStart:-Math.floor(elapsed/2.4)*2.4,frameAnimationEnd:1e9},elapsed%2.4,'primeFrame',preset('primeFrame'));return alpha.at(-1);};
 for(const t of [2.39,2.4,4.79,4.8,24])assert.equal(borderAt(t),1,'Storytelling border stays visible across phrase boundaries');
}

// Papercut defaults to individual paper words; a full row remains an explicit option.
assert.notEqual(hash(render('paperCut',preset('paperCut'),.1)),hash(render('paperCut',preset('paperCut'),1.5)));
assert.equal(hash(render('paperCut',preset('paperCut'),1.5)),hash(render('paperCut',preset('paperCut'),1.5,720,240,{...segment,wordsSeparated:true})));
assert.equal(hash(render('paperCut',preset('paperCut',{wordMode:'all'}),.1)),hash(render('paperCut',preset('paperCut',{wordMode:'all'}),1.5)));
assert.notEqual(hash(render('paperCut',preset('paperCut'),.1,720,240,{...segment,wordsSeparated:true})),hash(render('paperCut',preset('paperCut'),1.5,720,240,{...segment,wordsSeparated:true})));
{
 const {glassZoom,drawDynamicGlass}=await import(pathToFileURL(resolve(work,'dynamic-glass.mjs')));
 const settings=preset('dynamicGlass'),speech={...segment,text:'Naša priča ima veliki novi početak',words:undefined};
 let prior=1;
 for(let t=0;t<3;t+=1/120){const zoom=glassZoom(speech,t,settings);assert(zoom>=1&&zoom<=1.101);assert(Math.abs(zoom-prior)<.012,'Camera must not jump at word boundaries');prior=zoom;}
 assert.equal(glassZoom(speech,3,settings),1);
 assert.equal(glassZoom(speech,1,{...settings,glassCamera:false}),1);
 assert.equal(glassZoom({...speech,text:''},1,settings),1);
 for(const [width,height] of [[360,640],[640,360],[400,400]]){
  const c=createCanvas(width,height),ctx=c.getContext('2d');
  const bounds=drawDynamicGlass(ctx,speech,2.7,settings,'foreground',.6);
  assert.deepEqual(bounds.words.map(word=>word.index),[4,5],'Foreground exposes individual words for active-word backgrounds');
  assert(bounds.words[0].y-bounds.words[0].height/2>60,'Foreground must sit below the detected face');
  assert(bounds.words[0].y+bounds.words[0].height/2<100,'Foreground must remain inside the frame');
 }
 assert(!templates.some(t=>t.key==='vistaRise'),'Vista is removed from the public catalog');
 console.log('Dynamic Glass camera continuity, face clearance, aspect ratios and Vista removal passed.');
}

{
 const {dynamicGlassZoom}=await import(pathToFileURL(resolve(work,'dynamic-glass.mjs')));
 const settings=preset('dynamicGlass');
 const whole=[{id:'whole',text:'Duga rečenica',start:0,end:12}];
 const split=[{id:'first',text:'Duga',start:0,end:3},{id:'second',text:'rečenica',start:3.15,end:12}];
 for(const t of [2.99,3,3.1,3.15,3.2,7.99,8,8.01])assert.equal(dynamicGlassZoom(split,'dynamicGlass',settings,t),dynamicGlassZoom(whole,'dynamicGlass',settings,t),'Word cuts and short pauses cannot restart the camera');
 console.log('Continuous camera path survives caption boundaries and short pauses.');
}

// Release regressions: instant word switching, editable texture, grouped waves, static terminal panel.
assert(!templates.some(t=>t.key==='orbitGlow'));
assert.equal(hash(render('tripleGothic',preset('tripleGothic'),.05)),hash(render('tripleGothic',preset('tripleGothic'),.4)));
assert.notEqual(hash(render('goldMesh')),hash(render('goldMesh',preset('goldMesh',{textColor:'#22aaff'}))));
assert.notEqual(hash(render('goldMesh')),hash(render('goldMesh',preset('goldMesh',{outlineColor:'#00ffff',outlineWidth:5}))));
assert.notEqual(hash(render('waveWords',preset('waveWords',{revealGroupSize:1}),.4)),hash(render('waveWords',preset('waveWords',{revealGroupSize:2}),.4)));
assert.equal(preset('terminalType').backgroundOpacity,100);
const terminalStart=render('terminalType',preset('terminalType'),0),terminalLater=render('terminalType',preset('terminalType'),1.2);
assert.deepEqual(terminalStart.bounds.width,terminalLater.bounds.width);
assert.equal(terminalStart.pixels[3],0,'Terminal panel does not fill the whole video');
{
 const {drawSerifTextures}=await import(pathToFileURL(resolve(work,'text-surface.mjs')));
 const backgroundAt=time=>{const c=createCanvas(400,160),ctx=c.getContext('2d');ctx.font='40px serif';drawSerifTextures(ctx,'TEST',100,80,40,time,preset('testSerif'));return {pixels:ctx.getImageData(0,0,400,160).data};};
 const initial=backgroundAt(0),final=backgroundAt(2.1);
 assert(initial.pixels.some((value,i)=>i%4===3&&value>0),'PNG background is present before any entrance animation');
 assert.notEqual(hash(initial),hash(final),'Stronger background appears over the fixed base');
}
console.log('Serif background, Golden Texture edits, instant Gothic, wave grouping, Terminal and Orbit removal passed.');
// Regression checks for template isolation and the supplied typography references.
{
 const left=settingsForTemplate(templates.find(t=>t.key==='scriptVerbatim'));
 const centered=settingsForTemplate(templates.find(t=>t.key==='underlinedEditorial'),left);
 assert.equal(centered.x,50,'Choosing a centered style must not inherit Verbatim’s left anchor');
 assert.equal(centered.alignment,'center');
 const frame=createCanvas(1080,1920).getContext('2d');
 const settings=preset('scriptVerbatim',{x:10,y:75});
 const intro=drawCaption(frame,segment,.25,'scriptVerbatim',settings);
 assert.ok(!intro.words.some(word=>word.index===2),'Later words wait for their spoken timestamp');
 assert.equal(intro.words[0].index,0,'Verbatim preserves the transcript order');
 const icy=settingsForTemplate(templates.find(t=>t.key==='smokeSerif'));
 assert.equal(icy.highlightColor,'#d7deef');assert.equal(icy.backgroundOpacity,0);assert.equal(icy.textMaterial,undefined);
 const {GlobalFonts}=require('@napi-rs/canvas');
 GlobalFonts.registerFromPath(resolve('frontend/public/fonts/black-slabbath-latin.otf'),'GoldenSpacing');
 frame.font='80px GoldenSpacing';
 for(const [a,b] of [['c','č'],['c','ć'],['C','Č'],['C','Ć'],['ca','ča'],['ci','ći']])assert.ok(Math.abs(frame.measureText(a).width-frame.measureText(b).width)<.1,`Accented width/kerning must match the base: ${a}/${b}`);
 console.log('Centered presets, speech-ordered Verbatim, Icy restoration and Golden accented spacing passed.');
}

{
 const frame=createCanvas(1080,1920).getContext('2d');
 const stack=drawCaption(frame,segment,2,'scriptVerbatim',preset('scriptVerbatim',{x:10,y:62}));
 assert.deepEqual(stack.words.map(word=>word.index),[0,1,2]);
 assert.ok(stack.words[0].y<stack.words[1].y&&stack.words[1].y<stack.words[2].y,'Verbatim stacks words in spoken order');
 const first=drawCaption(frame,segment,.25,'scriptVerbatim',preset('scriptVerbatim',{x:10,y:62}));
 assert.equal(first.words[0].y,stack.words[0].y,'New words do not shift previous rows');
}

// Role metadata must not restyle self-contained templates or uniformly rendered words.
{
 for(const style of ['metallicCompactV2','premiumOrangeV4','trackingStack','prismWords','goldMesh']){
  const paint=wordStyles=>{const canvas=createCanvas(480,854);drawCaption(canvas.getContext('2d'),{...segment,wordStyles},1.8,style,preset(style));return canvas.toBuffer('image/png');};
  assert.deepEqual(paint(undefined),paint({1:{text:'u',style:'clean',settings:preset('clean',{textColor:'#ff0000',fontScale:250})}}),`${style} must ignore keyword styling`);
 }
}

// User-selected glyph effects must render consistently without moving captions.
{
 const base=settingsForTemplate(templates.find(template=>template.key==='clean'));
 const segment={id:'light-effects',text:'Shadow',start:0,end:5,suppressSuggestions:true};
 const render=(patch,time=.5)=>{const canvas=createCanvas(480,270),ctx=canvas.getContext('2d');const bounds=drawCaption(ctx,segment,time,'clean',{...base,x:50,y:50,animation:'none',...patch});return {bounds,hash:createHash('sha256').update(ctx.getImageData(0,0,480,270).data).digest('hex'),pixels:ctx.getImageData(0,0,480,270).data};};
 const plain=render({}),shadowModes=['drop','long','inner','soft','hard','colored','multiple'],glowModes=['outer','inner','neon','rgb','pulsing'];
 for(const shadowMode of shadowModes){const result=render({shadowMode,shadowColor:'#7744ff',shadowOpacity:90,shadowBlur:shadowMode==='hard'?0:12});assert.notEqual(result.hash,plain.hash,shadowMode+' changes glyph pixels');assert.deepEqual(result.bounds,plain.bounds,'Shadow does not move text');}
 for(const glowMode of glowModes){const result=render({glowMode,glowColor:'#22ff77',glowOpacity:90});assert.notEqual(result.hash,plain.hash,glowMode+' changes glyph pixels');assert.deepEqual(result.bounds,plain.bounds,'Glow does not move text');}
 assert.notEqual(render({glowMode:'pulsing'},0).hash,render({glowMode:'pulsing'},.25).hash,'Pulsing glow follows playback time');
 assert.notEqual(captionFrameKey(segment,0,'clean',{...base,glowMode:'pulsing'}),captionFrameKey(segment,.25,'clean',{...base,glowMode:'pulsing'}),'Pulse invalidates preview frame cache');
 assert.equal(render({shadowMode:'none',glowMode:'none',textBlur:0}).hash,plain.hash,'Disabled effects preserve preset identity');
 assert.notEqual(render({textBlur:12}).hash,plain.hash,'Blur changes the rendered text');
 const invisible=render({shadowMode:'long',glowMode:'outer',textOpacity:0}).pixels;
 assert.ok(!invisible.some((value,index)=>index%4===3&&value>0),'Text opacity hides user shadows and glow too');
 console.log('Seven shadows, five glows, pulse timing, blur, geometry and disabled-effect identity passed.');
}

// Advanced layout and procedural fills use the production glyph renderer.
{
 const base=settingsForTemplate(templates.find(t=>t.key==='clean'));
 const sample={id:'advanced-layout',text:'One two three four five six',start:0,end:8,suppressSuggestions:true};
 const render=(patch)=>{const canvas=createCanvas(480,270),ctx=canvas.getContext('2d');const bounds=drawCaption(ctx,sample,2,'clean',{...base,x:50,y:50,fontScale:60,animation:'none',reveal:'none',wordMode:'all',...patch});return {bounds,hash:createHash('sha256').update(ctx.getImageData(0,0,480,270).data).digest('hex')};};
 const plain=render({});
 for(const key of ['displayScale','displaySkew','displayWarp','displayBend','displayArc','displayDistort','displayPerspective','displayStretch','displayCompress']){
  const value=key==='displayScale'||key==='displayStretch'?140:key==='displayCompress'?65:30;
  const result=render({[key]:value});assert.notEqual(result.hash,plain.hash,key+' changes pixels');assert.ok(Number.isFinite(result.bounds.width)&&result.bounds.width>0,key+' has valid bounds');
 }
 assert.equal(render({displayWordCount:2}).bounds.words.length,2);
 assert.equal(render({displayWordCount:-1}).bounds.words.length,6);
 const rows=render({wordsPerLine:2}).bounds.words;assert.equal(rows[0].y,rows[1].y);assert.ok(rows[2].y>rows[1].y);
 assert.ok(render({verticalAlignment:'top'}).bounds.y<render({verticalAlignment:'bottom'}).bounds.y);
 const previousDocument=globalThis.document;globalThis.document={createElement:()=>createCanvas(128,128)};
 const {captionTextures}=await import(pathToFileURL(resolve(work,'caption-texture-fill.mjs')));
 for(const [fillTexture] of captionTextures.filter(([id])=>!['image','video'].includes(id))){assert.notEqual(render({fillTexture}).hash,plain.hash,fillTexture+' paints a texture');}
 assert.notEqual(render({fillTexture:'marble',fillTextureColor:'#ff0000',fillTextureColor2:'#fff'}).hash,render({fillTexture:'marble',fillTextureColor:'#0000ff',fillTextureColor2:'#fff'}).hash);
 globalThis.document=previousDocument;
 console.log('All transformations, word count/rows, vertical alignment and procedural texture fills passed.');
}

// New shared effects: deterministic seeking, visible controls and disabled identity.
{
 const {renderCaptionDepth,animateCaptionEffect}=await import(pathToFileURL(resolve(work,'caption-transform.mjs')));
 const base=settingsForTemplate(templates.find(template=>template.key==='clean'));
 const draw=ctx=>{ctx.font='bold 48px Arial';ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.fillText('INK 3D',240,150);return {x:50,y:50,width:45,height:24,rotation:0,segmentId:'effects',words:[]};};
 const render=(patch,time=1,ink=false)=>{const canvas=createCanvas(480,270),ctx=canvas.getContext('2d');(ink?animateCaptionEffect:renderCaptionDepth)(ctx,{...base,...patch},time,draw);return createHash('sha256').update(ctx.getImageData(0,0,480,270).data).digest('hex');};
 const depth={depthMode:'extrude',depthMaterial:'gold'};
 const original=render({depthMode:'none'}),gold=render(depth);
 assert.notEqual(gold,original);
 for(const patch of [{depthFaceColor:'#ff2244'},{depthSideColor:'#00ff00'},{depthLightAngle:90},{surfaceBevel:0},{depthTiltX:35},{depthReflection:0},{depthShadow:0},{depthFocus:5}])assert.notEqual(render({...depth,...patch}),gold,JSON.stringify(patch)+' changes the shared rendered image');
 assert.equal(render({...depth,depthMode:'none',depthMotion:80}),original,'Disabled 3D leaves the base drawing intact');
 assert.notEqual(render({...depth,depthMotion:80},.2),render({...depth,depthMotion:80},1.2));
 const ink={specialEffect:'ink',specialEffectStrength:70,specialEffectColor:'#00aa88'};
 assert.notEqual(render(ink,.15,true),render(ink,1.5,true),'Ink expands over media time');
 assert.equal(render(ink,1.5,true),render(ink,1.5,true),'Seeking/export reproduce the same ink frame');
 assert.equal(render({...ink,specialEffectStrength:0},1.5,true),original);
}
console.log('3D lighting/color/bevel/camera controls and deterministic outward Ink passed.');

// Authored backgrounds keep the exact native text drawing, and shared paths remain reusable.
for(const key of ['clean','captionsScript','scriptVerbatim','dynamicGlass','terminalType','prismWords']){
 const plain=render(key,{...preset(key),backgroundScope:'none',backgroundOpacity:0},1.2);
 for(const backgroundScope of ['caption','line','active']){
  const result=render(key,{...preset(key),backgroundScope,backgroundOpacity:80,backgroundColor:'#138f72',backgroundLook:'sketch'},1.2);
  assert.notEqual(hash(result),hash(plain),key+' '+backgroundScope+' background renders');
 }
}
{
 const {drawScriptStroke}=await import(pathToFileURL(resolve(work,'caption-script-stroke.mjs')));
 const stroke=mode=>{const canvas=createCanvas(400,200),ctx=canvas.getContext('2d');ctx.translate(200,25);drawScriptStroke(ctx,200,60,1,{...preset('captionsScript'),scriptLineMode:mode});return createHash('sha256').update(ctx.getImageData(0,0,400,200).data).digest('hex');};
 assert.notEqual(stroke('full'),stroke('right'));
 const native=render('primeFrame',preset('primeFrame'),1.2);
 assert.notEqual(hash(native),hash(render('primeFrame',{...preset('primeFrame'),frameCount:1},1.2)));
}
console.log('Native-layout backgrounds, shared Script paths and Borders frame controls passed.');

for(const key of ['metallicCompactV2','premiumOrangeV4','captionsScript','scriptVerbatim','dynamicGlass']){
 const base={...preset(key),surfaceStrength:0};
 const original=hash(render(key,base,1.2));
 const textured=hash(render(key,{...base,textMaterial:'stone',surfaceStrength:100,surfaceOpacity:70},1.2));
 assert.notEqual(textured,original,key+' material settings affect actual caption pixels');
 assert.notEqual(hash(render(key,{...base,textMaterial:'metal',surfaceStrength:100},1.2)),textured,key+' different material changes appearance');
 assert.equal(hash(render(key,{...base,textMaterial:'stone',surfaceStrength:0},1.2)),original,key+' disabling texture restores original face');
}
console.log('Dynamic material selection, strength and disable regressions passed.');

{
 const text={id:'independent-script-weights',start:0,end:5,text:'hello world',words:[{text:'hello',start:0,end:2},{text:'world',start:0,end:5}]};
 const a=render('captionsScript',preset('captionsScript',{wordMode:'all',fontScale:60,fontWeight:400,secondaryStyle:{fontWeight:700}}),1,1000,500,text);
 const b=render('captionsScript',preset('captionsScript',{wordMode:'all',fontScale:60,fontWeight:900,secondaryStyle:{fontWeight:700}}),1,1000,500,text);
 assert.equal(a.bounds.words[1].width,b.bounds.words[1].width,'Ordinary weight does not alter secondary glyph weight');
 const explicit={...segment,separateStyle:true,detachedStyle:{style:'neon',settings:preset('neon')}};
 assert.equal(hash(render('clean',preset('clean'),2,720,240,explicit)),hash(render('neon',preset('neon'))));
}
console.log('Independent secondary weight and explicit per-caption styles passed.');
