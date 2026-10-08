export const TITLE_PALETTES = {
  silk: {font:'#e7e8e6',side:'#65717a',border:'#f3f5ef',shadow:'#000000',background:'#111820'},
  crystal: {font:'#d4e0e8',side:'#94a8b8',border:'#f3f5ef',shadow:'#000000',background:'#111820'}
};

export function titlePalette(style, overrides={}) {
  const colors={...TITLE_PALETTES[style],...overrides};
  for(const [key,value] of Object.entries(colors)) {
    if(!['font','side','border','shadow','background'].includes(key)||!/^#[\da-f]{6}$/i.test(value)) throw new Error('Invalid palette color: '+key);
  }
  return colors;
}
