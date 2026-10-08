# Caption controls: incremental rollout

Source: Semir's `Edita stilovi.txt`, 2026-09-29. This is a feature inventory, not a statement that every feature is implemented.

## Working approach

- Use **Clean** as the reference preset for developing the full set of compatible controls.
- Share settings and renderer behavior across subtitle editor, video editor, cards and export.
- Exposing a control does not enable it by default. Keep every preset's authored appearance and motion.
- Keep ordinary words, important words and titles independently configurable. Script Verbatim uses ArtBrush for ordinary words and Pinyon Script for important words.
- Special layouts/materials may need dedicated adapters. Do not display a nonfunctional option as available; document any exception when introducing a module.
- Develop one group at a time. Preserve the old controls during migration.
- Basic controls show the most common choices. Advanced controls appear within their own group, with dependent fields shown only when relevant.

## Proposed groups and order

| Group | Basic | Advanced / later work |
| --- | --- | --- |
| 1. Text and colors | Font, size, solid color, two-color gradient | Font weight, letter spacing, gradient direction; later 3+ stops, rainbow, animation, gradient position/speed, mesh, aurora, holographic and iridescent gradients |
| 2. Outlines and shadows | Outline color/width, shadow on/off | Multiple/dashed outlines, glow outline; shadow direction/distance/blur/color, inner/long/multiple shadows; outer/inner/RGB/pulsing glow |
| 3. Appearance and motion | Word/letter/sentence display, entrance, duration | Exit, easing, delay; slide/zoom/fade/bounce/elastic/pop/stomp, typewriter, wave, flicker, shake, rotate/flip, blur, stretch, morph; random/mask/swipe/split reveal |
| 4. Layout and transforms | Position, alignment, rotation, line height | Word spacing, kerning/tracking, justify, skew, bend/arc/warp, distortion, perspective, stretch/compress |
| 5. Materials and depth | Material, texture strength, depth | Bevel/emboss, extrusion, lighting/reflection/shine; metallic gold/silver/chrome, brushed metal, stone/marble/concrete, wood/paper/fabric/carbon, glass/crystal/acrylic, plastic/rubber/ceramic and other textures |
| 6. Special effects and media | Effect choice, strength | Ice/smoke/fire/water/liquid, neon/glitch/RGB split/hologram/Matrix, particles/lightning/energy, image/video/GIF/pattern fills, media crop and timing |

Opacity, brightness, contrast, saturation, blur, texture amount, metallic amount, reflection, noise and grain belong with the material/effect they modify; avoid duplicating them in many unrelated menus.

Font families (serif, sans serif, monospace, script, handwriting, brush, gothic, retro, futuristic, variable) should become font-picker filters. “3D font” is a depth/material treatment, not a font-family filter.

Many supplied names describe combinations: luxury gold, black gold, diamond, pearl, jewel colors, cyberpunk, glass neon, liquid metal, galaxy and landscape fills. Offer these as material/effect recipes built on reusable controls rather than separate duplicate controls.

## Implemented in this step

- First shared **Text and colors** panel: font for ordinary words, size, solid/two-color gradient, linear/radial/wavy gradient shape.
- Its Advanced section: weight, letter spacing, direction and uppercase.
- Controls reuse the existing data model and shared renderer; this step does not add the remaining effects from the inventory.
- Existing controls starting at Font Weight are retained in a collapsed section below a workspace of `100dvh`, as requested. No new top tab.
- Preset correction for Verbatim's important-word font.

## Next suggested step

Finish the color module on Clean first: multiple gradient stops, stop positions, rainbow preset, animation/speed and opacity. Review its behavior and UI before moving to outlines/shadows. Introduce renderer support and compatibility declarations together with each new control.

No tests, builds, release or user-project changes were requested for this step.

## September 30 additions
- Rainbow word gradient, text-face opacity and primary/layered solid or gradient outlines added to the shared basic/editorial paths. Special reference styles retain their own treatment; unsupported new controls are explicitly unavailable.
- Deferred by Semir: animated gradient, speed/direction of animation; shadow distance, direction, blur and other shadows. Gradient-stop positions are still pending.

## Updated panel organization
1. Text and colors: font/size/gradients, opacity, B/I/U, up to three total outlines. Shadows/textures remain planned categories.
2. Backgrounds and alignment: background color/opacity, left/center/right, line height and word/letter spacing for the basic renderer. Special authored layouts require separate adaptation.
3. Animations: existing entrance gallery.
Shared color picker includes HEX, alpha, hue/SV, palette and locally saved brand colors.

## Advanced category navigation
Five compact entries below weight/gradient direction: Outlines, Shadows and Glow, Textures, Special Effects, and 3D. These are navigation scaffolding for incremental implementation; selecting a category explains that its additional controls are still planned. Existing basic outlines remain above. No new effects are enabled by selecting a category.
