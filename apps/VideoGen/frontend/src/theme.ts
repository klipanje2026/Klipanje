export type Theme = 'light' | 'dark-blue' | 'dark' | 'forest' | 'cream' | 'ruby';
export const darkPalettes = [
  { id: 'graphite', name: 'Grafit', colors: ['#111116', '#1b1b23', '#292934', '#b29aff', '#8ac8df', '#9784db'] },
  { id: 'midnight', name: 'Ponoć', colors: ['#0e1726','#172338','#26364f','#83b7ff','#62c9dd','#927ddd'] },
  { id: 'mocha', name: 'Moka', colors: ['#1b1614','#29211e','#3e312a','#e8ae81','#eac47f','#b794bd'] },
  { id: 'plum', name: 'Šljiva', colors: ['#1c1421','#2b2032','#403048','#efa5d2','#9ed5ca','#b698eb'] },
  { id: 'neon', name: 'Neon', colors: ['#122117','#192d20','#25412d','#25e946','#3ce7d0','#f1d7a7'] },
  { id: 'coral', name: 'Koralj', colors: ['#161616','#242222','#383130','#ff6b5b','#f97316','#ffffff'] },
] as const;
export type DarkPalette = typeof darkPalettes[number]['id'];
export function currentTheme(): Theme {
  const value = document.documentElement.dataset.palette;
  return value === 'cream' || value === 'ruby' || value === 'forest' || value === 'dark' || value === 'dark-blue' ? value : 'light';
}
export function currentDarkPalette(): DarkPalette {
  return darkPalettes.find(item => item.id === document.documentElement.dataset.darkPalette)?.id || 'graphite';
}
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = (theme === 'light'||theme==='cream') ? 'light' : 'dark';
  document.documentElement.dataset.palette = theme;
  // Resolve every palette, including its default variant, through the same tokens.
  const palettes=theme==='dark'?darkPalettes:theme==='dark-blue'?bluePalettes:theme==='forest'?forestPalettes:theme==='ruby'?rubyPalettes:theme==='cream'?creamPalettes:lightPalettes;
  const selected=palettes.find(item=>item.id===currentVariant(theme))||palettes[0];
  const [stage,panel,raised,accent,wave,caption]=selected.colors;
  const light=theme==='light'||theme==='cream',ink=light?'#202633':'#f2edf0';
  const brightAccent=['neon','coral'].includes(selected.id);
  const buttonInk=light&&!brightAccent?'#ffffff':'#14151c';
  const tokens:Record<string,string>={
    '--k-ink-accent':light&&selected.id==='neon'?'#14732a':light&&selected.id==='coral'?'#ad3b2f':accent,'--k-stage':stage,'--k-card':panel,'--k-soft':raised,'--k-text':ink,'--k-muted':`color-mix(in srgb, ${ink} 66%, ${panel})`,'--k-border':`color-mix(in srgb, ${ink} 15%, ${panel})`,'--k-accent':accent,'--k-button-ink':buttonInk,'--k-highlight':caption,'--k-secondary':wave,
    '--editor-panel-surface':panel,'--editor-stage-surface':stage,'--editor-chrome-surface':panel,'--caption-dock-surface':panel,'--caption-clip-surface':raised,'--caption-clip-selected':raised,'--caption-clip-edge':accent,'--ui-bg':stage,'--ui-accent-soft':raised,'--ui-stage':stage,'--ui-panel':panel,'--ui-raised':raised,'--ui-accent':accent,'--ui-text':ink,
    '--ui-border':`color-mix(in srgb, ${raised} 74%, ${ink})`,
    '--ui-muted':`color-mix(in srgb, ${ink} 64%, ${panel})`,
    '--ui-accent-button':light?accent:`color-mix(in srgb, ${accent} 48%, #181018)`,
    '--timeline-live':accent,'--timeline-head':accent,'--seek-accent':accent,
    '--waveform-gold':wave,'--waveform-ground':`color-mix(in srgb, ${wave} 16%, ${stage})`,
    '--track-caption':caption,'--track-caption-alternate':`color-mix(in srgb, ${caption} 55%, ${accent})`,
    '--track-audio':`color-mix(in srgb, ${wave} 50%, ${stage})`,'--track-wave':wave,
  };
  for(const [key,value] of Object.entries(tokens))document.documentElement.style?.setProperty(key,value,'important');
  try {
    localStorage.setItem('edita-theme-v2', theme);
    if (theme !== 'light'&&theme!=='cream') localStorage.setItem('edita-last-dark', theme);
  } catch { /* The current page still changes when storage is disabled. */ }
  window.dispatchEvent(new Event('edita-theme-changed'));
}
export function applyDarkPalette(palette: DarkPalette) {
  document.documentElement.dataset.darkPalette = palette;
  try { localStorage.setItem('edita-dark-palette', palette); } catch { /* Use session choice. */ }
  applyTheme('dark');
}
export function initializeTheme() {
  let theme: Theme = 'light';
  let palette: DarkPalette = 'coral';
  try {
    const saved = localStorage.getItem('edita-theme-v2');
    theme = saved === 'cream' || saved === 'ruby' || saved === 'forest' || saved === 'dark' || saved === 'dark-blue' ? saved : saved === 'light' ? 'light' : localStorage.getItem('edita-theme') === 'dark' ? 'dark' : 'light';
    palette = darkPalettes.find(item => item.id === localStorage.getItem('edita-dark-palette'))?.id || 'coral';
  } catch { /* Keep defaults. */ }
  document.documentElement.dataset.darkPalette = palette;
  for(const [key,attribute,fallback] of [['cream','creamPalette','linen'],['ruby','rubyPalette','garnet'],['forest','forestPalette','sage'],['light','lightPalette','coral'],['dark-blue','bluePalette','ocean']]){
    try{document.documentElement.dataset[attribute]=localStorage.getItem(`edita-${key}-variant`)||fallback;}catch{/* Defaults. */}
  }
  try { if(!localStorage.getItem('klipanje-palettes-v3')) { theme=theme==='light'||theme==='cream'?'light':'dark'; document.documentElement.dataset.lightPalette='ice'; document.documentElement.dataset.darkPalette='graphite'; localStorage.setItem('edita-light-variant','ice'); localStorage.setItem('edita-dark-palette','graphite'); localStorage.setItem('edita-last-dark','dark'); localStorage.setItem('klipanje-palettes-v3','1'); } } catch { /* Session defaults. */ }
  // The selected frame logo and entry page now start in the user's warm Coral palette.
  try {
    if (!localStorage.getItem('klipanje-warm-default-v1')) {
      theme = theme === 'light' || theme === 'cream' ? 'light' : 'dark';
      document.documentElement.dataset.lightPalette = 'coral';
      document.documentElement.dataset.darkPalette = 'coral';
      localStorage.setItem('edita-light-variant', 'coral');
      localStorage.setItem('edita-dark-palette', 'coral');
      localStorage.setItem('edita-last-dark', 'dark');
      localStorage.setItem('klipanje-warm-default-v1', '1');
    }
  } catch {
    document.documentElement.dataset.lightPalette = 'coral';
    document.documentElement.dataset.darkPalette = 'coral';
  }
  applyTheme(theme);
}
export function lastDarkTheme(): Theme {
  try { const saved=localStorage.getItem('edita-last-dark');return saved==='ruby'?'ruby':saved==='forest'?'forest':saved==='dark-blue'?'dark-blue':'dark'; }
  catch { return 'dark'; }
}

export const lightPalettes = [
 {id:'ice',name:'Led',colors:['#f2f5fb','#ffffff','#e8eef9','#3563d9','#15888c','#a4a9e8']},
 {id:'porcelain',name:'Porculan',colors:['#f6f5f8','#ffffff','#eeeaf5','#7654bd','#338e94','#ccb9e6']},
 {id:'sand',name:'Pijesak',colors:['#f8f3eb','#fffcf6','#f0e5d4','#a45b22','#4c8d82','#ddbd93']},
 {id:'powder',name:'Puder',colors:['#faf2f4','#fffafb','#f0e2e8','#a23f63','#547f8c','#d9b8cc']},
 {id:'neon',name:'Neon',colors:['#f4faf6','#ffffff','#e0f4e5','#25e946','#3ce7d0','#f1d7a7']},
 {id:'coral',name:'Koralj',colors:['#fff9f5','#ffffff','#fbe9e2','#ff6b5b','#f97316','#ffffff']},
] as const;
export const bluePalettes = [
 {id:'ocean',name:'Okean',colors:['#101720','#18202d','#26364b','#8eb8ff','#62dcdf','#8252d1']},
 {id:'arctic',name:'Arktik',colors:['#0c1b25','#142b38','#214050','#73d7eb','#f4bc59','#8c65d6']},
 {id:'indigo',name:'Indigo',colors:['#121525','#1c2238','#303958','#b2b8ff','#66e0bd','#9766da']},
] as const;
export function currentVariant(theme:Theme=currentTheme()) {
 if(theme==='dark')return currentDarkPalette();
 return document.documentElement.dataset[theme==='cream'?'creamPalette':theme==='ruby'?'rubyPalette':theme==='forest'?'forestPalette':theme==='light'?'lightPalette':'bluePalette']||(theme==='cream'?'linen':theme==='ruby'?'garnet':theme==='forest'?'sage':theme==='light'?'ice':'ocean');
}
export function applyVariant(theme:Theme,value:string) {
 if(theme==='dark'){applyDarkPalette(value as DarkPalette);return;}
 const options=theme==='cream'?creamPalettes:theme==='ruby'?rubyPalettes:theme==='forest'?forestPalettes:theme==='light'?lightPalettes:bluePalettes;
 const selected=options.find(item=>item.id===value)||options[0];
 document.documentElement.dataset[theme==='cream'?'creamPalette':theme==='ruby'?'rubyPalette':theme==='forest'?'forestPalette':theme==='light'?'lightPalette':'bluePalette']=selected.id;
 try{localStorage.setItem(`edita-${theme}-variant`,selected.id);}catch{/* Session choice. */}
 applyTheme(theme);
}

export const forestPalettes = [
 {id:'sage',name:'Kadulja',colors:['#101b18','#192b24','#2b4037','#96ceb0','#e8c579','#96aada']},
 {id:'pine',name:'Bor',colors:['#101b1c','#193033','#294548','#83c8c2','#dfb77c','#b398d6']},
 {id:'olive',name:'Maslina',colors:['#1a1d13','#2b3021','#414735','#c7d295','#dca475','#9dadda']},
] as const;

export const creamPalettes = [
 {id:'linen',name:'Lan',colors:['#f8f5ef','#fffdf9','#ede5d9','#926341','#ba852b','#9d7899']},
 {id:'sand',name:'Pijesak',colors:['#f8f0e7','#fffaf4','#efdeca','#a56a35','#b78b30','#8d80a5']},
 {id:'rose',name:'Puder',colors:['#faf1f3','#fffafb','#efdee3','#a35470','#b78b40','#8b7ab0']},
] as const;
export const rubyPalettes = [
 {id:'garnet',name:'Granat',colors:['#201216','#321d24','#4a2c35','#f39aab','#eac27d','#b38adb']},
 {id:'cherry',name:'Višnja',colors:['#211018','#351b29','#502c3e','#f092b9','#e6b770','#9b9bdb']},
 {id:'terracotta',name:'Terakota',colors:['#221713','#35241d','#51382c','#eca582','#dec37f','#b58fc4']},
] as const;
