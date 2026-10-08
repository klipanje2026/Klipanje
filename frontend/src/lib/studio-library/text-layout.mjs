// These caption families reflow text within a fixed stage; scale remains independent.
export const usesStudioTextLayout=id=>id.startsWith('studio-quiet-')||id.startsWith('studio-business-')||id==='studio-crystal-glass';
export const studioFontPixels=(options,width)=>Math.max(24,Math.min(200,Number(options.fontSizePx)||100))*width/(1080*.92);
