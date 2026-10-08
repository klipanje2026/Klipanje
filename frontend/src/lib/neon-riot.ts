import {createNeonRiotPainter, type RiotWord} from './neon-riot-core.mjs';
import {neonRiotVariant} from '../config/captions/neon-riot-variants';
import type {CaptionSettings, Segment, StyleKey} from '../config/captions/types';
import type {CaptionBounds, CaptionWordBounds} from './caption-renderer';

const finite = (n: number | undefined, fallback: number) => Number.isFinite(n) ? n! : fallback;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const color = (value: string | undefined, fallback: string) => {
  if (/^#[\da-f]{6}$/i.test(value ?? '')) return value!;
  if (/^#[\da-f]{3}$/i.test(value ?? '')) return '#' + [...value!.slice(1)].map(c => c + c).join('');
  return fallback;
};
const painter = createNeonRiotPainter((width, height) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  return Object.assign(document.createElement('canvas'), {width, height});
});
let revision = 0;
if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.addEventListener('loadingdone', () => { painter.clearCache(); revision++; });
}
export const neonRiotRevision = () => revision;

type Token = {text: string; index: number; start: number; breakBefore: boolean};
/** Keep the user's edited text and reuse transcript timings when word counts match. */
function tokensFor(segment: Segment): Token[] {
  const matches = [...segment.text.matchAll(/\S+/gu)];
  const timed = segment.words?.length === matches.length;
  let previous = segment.start;
  return matches.map((match, index) => {
    const fallback = segment.start + (segment.end - segment.start) * index / matches.length;
    const start = clamp(finite(timed ? segment.words?.[index]?.start : undefined, fallback), previous, segment.end);
    previous = start;
    const last = matches[index - 1];
    const between = segment.text.slice(last ? last.index! + last[0].length : 0, match.index);
    return {text:match[0], index, start, breakBefore:between.includes('\n')};
  });
}

/** Shared adapter for cards, both editors and export; all motion uses video time. */
export function drawNeonRiot(ctx: CanvasRenderingContext2D, segment: Segment, time: number, style: StyleKey, settings: CaptionSettings): CaptionBounds | null {
  if (!Number.isFinite(time) || time < segment.start || time >= segment.end || segment.effectOnly) return null;
  const width = ctx.canvas.width, height = ctx.canvas.height;
  if (!width || !height) return null;
  const variant = neonRiotVariant(style), tokens = tokensFor(segment);
  if (!tokens.length) return null;
  const single = false;
  const all = true;
  const count = 4;
  const pages: Token[][] = [];
  for (const token of tokens) {
    const current = pages.at(-1);
    if (!current || current.length >= count || (!all && token.breakBefore)) pages.push([token]);
    else current.push(token);
  }
  const pageIndex = Math.max(0, pages.findLastIndex(page => page[0].start <= time));
  const page = pages[pageIndex], start = pageIndex ? page[0].start : segment.start;
  let end = pages[pageIndex + 1]?.[0].start ?? segment.end;
  if (single && segment.words?.length === tokens.length) {
    end = clamp(finite(segment.words[page[0].index]?.end,end),start,end);
  }
  const age = time - start;
  if (end <= start || time >= end) return null;
  const palette = [settings.highlightColor,settings.riotColor2,settings.riotColor3,settings.riotColor4,settings.riotColor5]
    .map((value, index) => color(value, variant.colors[index]));
  const heroPalette = style === 'neonRiot'
    ? [[palette[0],palette[2],palette[1]],[palette[1],palette[3],palette[0]],[palette[2],palette[4],palette[1],palette[3],palette[0]]][pageIndex%3]
    : palette;
  const strength = clamp(finite(settings.riotMotionStrength, 100), 0, 200) / 100;
  const scale = width / 1080 * clamp(finite(settings.fontScale, 100), 10, 500) / 100
    * (settings.fontSizePx ? clamp(settings.fontSizePx / 174, .05, 10) : 1);
  const x = finite(segment.position?.x, finite(settings.x, 50)) * width / 100;
  const y = finite(segment.position?.y, finite(settings.y, 72)) * height / 100;
  const rotation = finite(settings.rotation, 0), angle = rotation * Math.PI / 180;
  const cosine = Math.cos(angle), sine = Math.sin(angle);

  // Authored two-level layout: a small lead-in and a large multicolored final word.
  // Long phrases wrap instead of shrinking the whole caption to illegible text.
  const rows: {word: RiotWord; token: Token; width: number}[][] = [[]];
  const maxWidth = width * .86 / scale;
  page.forEach((token, index) => {
    const hero = index === page.length - 1;
    let row = rows.at(-1)!;
    if (row.length && (hero || token.breakBefore)) {row = []; rows.push(row);}
    const override = segment.wordStyles?.[token.index];
    const own = override && override.text === token.text && !override.linked ? override.settings : settings;
    const text = (own.uppercase ? token.text.toLocaleUpperCase('bs') : token.text).normalize('NFC');
    const at = all ? 0 : Math.max(0, token.start - start);
    const remaining = Math.max(.03, end - start - at);
    const word: RiotWord = {
      text, x:0, y:0, size:hero ? 174 : page.length > 2 ? 103 : 112, at,
      tilt:(hero ? -4 : index % 2 ? 3 : -6)*clamp(finite(settings.riotTilt,100),0,200)/100,
      colors:hero ? (own === settings ? heroPalette : [color(own.textColor, palette[0])]) : [color(own.textColor, '#ffffff'), '#dbceff'],
      box:settings.riotBoxes !== false && index === 0 && !hero ? color(settings.backgroundColor, variant.box) : null,
      boxOpacity:clamp(finite(settings.backgroundOpacity,100),0,100)/100,
      fontFamily:own.fontFamily || '"Arial Black", "Montserrat Variable", sans-serif',
      weight:finite(own.fontWeight,900), italic:own.italic, letterSpacing:finite(own.letterSpacing,0),
      depth:clamp(finite(own.textDepth,100),0,300)*.15,
      depthColor:color(own.textDepthColor,'#241445'), outlineColor:color(own.outlineColor,'#080714'),
      outlineWidth:clamp(finite(own.outlineWidth,6),0,48),
      motion:settings.riotMotion ?? variant.motion, motionStrength:strength,
      entranceDuration:Math.min(clamp(finite(settings.revealDuration,.56),.04,2),remaining*.45),
      exitDuration:Math.min(clamp(finite(settings.riotExitDuration,.32),.04,1),remaining*.2),
      letterDelay:Math.min(clamp(finite(settings.riotLetterDelay,.025),0,.08),remaining*.25/Math.max(1,[...text].length-1)),
      underline:hero && settings.riotUnderline !== false,
      damping:clamp(finite(settings.riotDamping,7.5),3,15), frequency:clamp(finite(settings.riotFrequency,11.5),4,20),
      floatStrength:clamp(finite(settings.riotFloat,100),0,200)/100,
      trails:settings.riotTrails!==false,trailStrength:clamp(finite(settings.riotTrailStrength,100),0,100)/100,
      trailColor1:color(settings.riotTrailColor1,'#40edff'),trailColor2:color(settings.riotTrailColor2,'#ff4fc8'),
      faceGradient:settings.riotGradient!==false,glow:clamp(finite(settings.riotGlow,100),0,200)/100,
      boxRadius:clamp(finite(settings.riotBoxRadius,13),0,40),
      underlineWidth:clamp(finite(settings.riotUnderlineWidth,5),.5,12),
      underlineDuration:clamp(finite(settings.riotUnderlineDuration,.42),.1,1),
      underlineColor:color(settings.underlineColor,heroPalette[0]),
    };
    if (own !== settings) {
      word.size *= clamp(finite(own.fontScale,settings.fontScale)/Math.max(1,settings.fontScale),.1,5);
      if (own.fontSizePx) word.size *= clamp(own.fontSizePx / Math.max(1,settings.fontSizePx ?? 174),.05,10);
    }
    let measured = painter.measureWord(word).width;
    // Fit an unusually long word on its row without truncating caption text.
    if (measured + 70 > maxWidth) {
      word.size *= maxWidth / (measured + 70);
      measured = painter.measureWord(word).width;
    }
    const gap = 35 + clamp(finite(settings.wordSpacing,0),-20,200);
    if (row.length && row.reduce((sum, item) => sum + item.width + gap, 0) + measured > maxWidth) {
      row = []; rows.push(row);
    }
    row.push({word, token, width:measured});
  });
  const gap = 35 + clamp(finite(settings.wordSpacing,0),-20,200);
  const rowHeights = rows.map(row => Math.max(...row.map(item => item.word.size)) + 65);
  const totalHeight = rowHeights.reduce((sum, size) => sum + size, 0);
  // Very long all-word captions can use additional rows, staying inside the video.
  const fit = Math.min(1, height * .65 / (totalHeight * scale));
  const renderScale = scale * fit;
  // Simplify fine lighting only when the displayed letters are small.
  // Offscreen export canvases use their actual pixel resolution.
  const displayRatio=typeof HTMLCanvasElement!=='undefined'&&ctx.canvas instanceof HTMLCanvasElement&&ctx.canvas.clientWidth>0?Math.min(1,ctx.canvas.clientWidth/width):1;
  const boxes: CaptionWordBounds[] = [];
  let top = -totalHeight / 2;
  ctx.save(); ctx.translate(x,y); ctx.rotate(angle); ctx.scale(renderScale,renderScale);
  ctx.globalAlpha *= clamp(finite(settings.textOpacity,100),0,100)/100;
  rows.forEach((row, rowIndex) => {
    const rowWidth = row.reduce((sum,item) => sum + item.width,0) + gap*(row.length-1);
    let left = -rowWidth/2;
    row.forEach(({word, token, width:wordWidth}) => {
      const offset = segment.wordOffsets?.[token.index];
      const moved = offset?.text === token.text ? offset : undefined;
      word.x = left + wordWidth/2 + (moved ? moved.x*width/100/renderScale : 0);
      word.y = top + word.size + (moved ? moved.y*height/100/renderScale : 0);
      word.rasterScale = Math.max(1,Math.min(2,renderScale));
      const letterPixels=word.size*renderScale*displayRatio;
      const detail=letterPixels<28?.3:letterPixels<42?.65:1;
      word.detailScale=detail;
      if(detail<1){
        word.depth=(word.depth??(word.dark?7:15))*detail;
        word.glow=(word.glow??1)*detail;
        word.outlineWidth=(word.outlineWidth??6)*detail;
        word.trailStrength=(word.trailStrength??1)*detail;
        if(detail===.3)word.faceGradient=false;
      }
      if (age >= word.at) {
        painter.drawWord(ctx,word,age,end-start,page.indexOf(token));
        if (settings.riotParticles !== false && (token === page[0] || token === page.at(-1))) {
          painter.drawBurst(ctx,word.x+(token === page[0] ? -1 : 1)*(wordWidth/2+20),word.y-word.size*.7,age-word.at-.04,palette,strength*.8*clamp(finite(settings.riotSpread,100),0,200)/100,clamp(finite(settings.riotParticleCount,18),0,60),clamp(finite(settings.riotParticleDuration,1.15),.3,2));
        }
        const cx = word.x*renderScale, cy = (word.y-word.size*.4)*renderScale;
        boxes.push({index:token.index,text:token.text,x:(x+cx*cosine-cy*sine)/width*100,
          y:(y+cx*sine+cy*cosine)/height*100,width:(wordWidth+55)*renderScale/width*100,
          height:(word.size+65)*renderScale/height*100,rotation:rotation+word.tilt});
      }
      left += wordWidth + gap;
    });
    top += rowHeights[rowIndex];
  });
  ctx.restore();
  if (!boxes.length) return null;
  return {segmentId:segment.id,x:x/width*100,y:y/height*100,
    width:Math.max(...rows.map(row => row.reduce((sum,item) => sum+item.width,0)+gap*(row.length-1)+70))*renderScale/width*100,
    height:totalHeight*renderScale/height*100,rotation,words:boxes};
}
