# Caption editing controls — 2026-09-24

Source review of the shared renderer and style catalogue, not a visual QA report.

All catalogue entries use the common font, size, position, colors, weight, surfaces, glyph-edge lighting, reflections, entrance and sound controls. The shared renderer applies glyph effects after the native face; Comic Letter Bounce applies them inside each moving glyph transform. Special-renderer styles (Script, Smoky Serif, Dynamic Glass and illustrated titles) have explicit surface/reflection integrations.

| Styles | Additional controls |
|---|---|
| Captions Script | Secondary font, highlighted color, group size / all text, path width and drawing time |
| Smoky Serif | Whole-text border mist on/off, expansion and dissipation time, outline and face settings |
| Dynamic Glass | Camera zoom on/off, motion intensity, warm glass color, font weight, surface/reflection controls |
| Sketch | Marker font, ellipse width, variable-pressure pen thickness, band opacity |
| Lens | Camera movement and flash interval, frame/accent colors |
| Pop Collage | Decoration size and movement inward, frame/accent and text-card colors |
| Artbrush Sticker | Font, inner/outer outline colors and widths, paired reveal |
| Comic Letter Bounce | Font/weight, glyph glow, per-letter surface/reflection |
| Gold Bold, Depth Text | Emphasis colors, surfaces, bevel, extrusion |
| Hightech, Cyber Track, Brush Titles | Font, emphasis/accent, reveal and text layout |
| Slide & Fall, Reveal Pop/Rise/Fade/Letters | Entrance duration, settling curve, word grouping |
| Papercut | Row/word separation, paper color/opacity, outline, spacing |
| Borders | Frame color, idle behavior, secondary title font/size |
| Prism, Prism Pop | Prism strength, primary/secondary fonts, highlight color |
| Layer Header | Background-title count, title colors/fonts, idle behavior |
| Vertical Header, Header BG Fill, Editorial Header, Bold Header | Title font/size/colors, background fill and layout |
| Opacity Reading, Blur Reading, Mist | Fade/entry duration, spacing, font and emphasis |
| News Highlight, Big Keyword, Mixed Focus | Emphasis-word selection, secondary style, highlight/background |
| Clean, Minimal, Box, Caption Card, Cinema, Elegant, Typewriter, Elevate | Common typography, background, entry and surface controls |
| Focus, Word, Karaoke, Social, Bounce, News, Marker, Gaming, Urgent, Pastel | Word mode, highlight and common layout/animation |
| Neon, Neon Pink, Glow, Ice | Glow strength/radius, text/accent colors |
| ThreeD, Shadow, Retro | Extrusion depth and common surface lighting |
| Gradient, Chrome, Fire | Gradient direction, surface and shine |
| Outline, Sticker, Comic, Bubble, Cyber | Outline and common surface/layout |
| Duo variants | Inner/outer outline, outline glow, alternating/active/line color modes |

Old projects preserve their saved font choices. Selecting Sketch afresh uses ArtBrush. Fixed-weight fonts may use browser-synthesized weight. Caption sounds trigger once per caption, not every word. Clean Audio threshold gates the returned isolated speech locally; it does not claim to configure the isolation provider's model.
