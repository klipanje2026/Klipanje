import type { Plugin } from 'postcss';

// Generate dark UI colours from the compiled styles, including lazy-loaded pages.
// Images, video and canvas pixels are never filtered or inverted.
export default function themePlugin(): Plugin {
  return { postcssPlugin: 'edita-ui-themes', OnceExit(root) {
    const additions: { source: import('postcss').Rule; dark: import('postcss').Rule }[] = [];
    root.walkRules(rule => {
      if (rule.selector.includes('data-theme') || rule.parent?.type === 'atrule' && /keyframes/.test(rule.parent.name)) return;
      const dark = rule.clone({ nodes: [] });
      rule.walkDecls(decl => {
        const bg = /^(background|background-color|background-image)$/.test(decl.prop);
        const border = /^(border.*|outline.*|stroke)$/.test(decl.prop);
        const text = /^(color|fill|caret-color|text-decoration-color)$/.test(decl.prop);
        if (!bg && !border && !text) return;
        const value = decl.value.replace(/#[\da-f]{3,8}\b|rgba?\([^)]*\)|\b(?:white|black)\b/gi, token => {
          let rgb: number[], alpha = 1;
          if (token[0] === '#') {
            let h = token.slice(1); if (h.length < 5) h = [...h].map(c => c + c).join('');
            rgb = [0,2,4].map(i => parseInt(h.slice(i,i+2),16)); if (h.length === 8) alpha = parseInt(h.slice(6),16)/255;
          } else if (/^rgb/.test(token)) {
            const parts = token.match(/[\d.]+/g)?.map(Number); if (!parts || parts.length < 3) return token;
            rgb = parts.slice(0,3); alpha = parts[3] ?? 1;
          } else rgb = token.toLowerCase() === 'white' ? [255,255,255] : [0,0,0];
          const [r,g,b] = rgb, light = .2126*r+.7152*g+.0722*b;
          let next = rgb;
          if (bg && light > 175) next = light > 245 ? [24,32,45] : [30,42,59];
          if (border && light > 100) next = [61,79,103];
          if (text && light < 210) next = b > 120 && b > r * 1.25 ? [141,185,255] : r > g * 1.4 ? [255,172,188] : light < 90 ? [230,236,246] : [166,183,205];
          return `rgba(${next.join(',')},${alpha})`;
        });
        if (value !== decl.value) dark.append(decl.clone({value}));
      });
      if (dark.nodes.length) {
        dark.selector = rule.selectors.map(s => /^(html|:root)(?=[\s.:#[]|$)/.test(s) ? s.replace(/^(html|:root)/, ':root[data-theme="dark"]') : `:root[data-theme="dark"] ${s}`).join(',');
        additions.push({source:rule,dark});
      }
    });
    for (const {source,dark} of additions) {
      const neutral=dark.clone();neutral.selector=neutral.selector.replaceAll('[data-theme="dark"]','[data-theme="dark"][data-palette="dark"]');
      neutral.walkDecls(decl=>{decl.value=decl.value.replaceAll('24,32,45','32,32,32').replaceAll('30,42,59','48,48,48').replaceAll('61,79,103','72,72,72').replaceAll('230,236,246','238,238,238').replaceAll('166,183,205','181,181,181');});
      source.after(dark);dark.after(neutral);
    }
  }};
}
