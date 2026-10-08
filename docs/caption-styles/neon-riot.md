# Neon Riot

Local implementation added October 1, 2026. Validation and publication are deferred under `LOCAL_CHANGES.md`.

## Where to find it

In either editor: **Titlovi → Stilovi → Neon Riot · 20**.

**Neon Riot · 01 Original** is the style based on the Node-generated reference. Cards 02–20 are variations of that collection, not replacements for existing styles. Each card and its editing controls show its name.

| Number | Name | Motion |
| --- | --- | --- |
| 01 | Original | Spring |
| 02 | Electric | Slide |
| 03 | Acid | Zoom |
| 04 | Candy | Wave |
| 05 | Fire | Spring |
| 06 | Ice | Flip |
| 07 | Laser | Glitch |
| 08 | Violet | Slide |
| 09 | Sunset | Wave |
| 10 | Chrome | Flip |
| 11 | Retro | Zoom |
| 12 | Toxic | Glitch |
| 13 | Ocean | Wave |
| 14 | Bubble | Spring |
| 15 | Solar | Zoom |
| 16 | Cyber | Glitch |
| 17 | Mint | Slide |
| 18 | Inferno | Flip |
| 19 | Aurora | Wave |
| 20 | Prism | Spring |

Each variant also has its own five-color palette and box color. Names such as Chrome describe that variant's palette; this is stylized layered Canvas text, not a physically based 3D scene.

## Reference fidelity

The Node demo and Edita import the same `createNeonRiotPainter` from `frontend/src/lib/neon-riot-core.mjs`. It paints the layered extrusion, outlines, face gradient, staggered glyph entrances, RGB trails, colored boxes and drawn underline. Graphics are generated with Canvas drawing calls, without CSS text animation. The style UI uses Edita's existing React controls.

The reference used Windows Arial Black registered as `Riot Heavy`. Edita requests `"Arial Black", "Montserrat Variable", sans-serif`. It uses the installed Arial Black where available and bundled Montserrat otherwise. Windows font files have not been copied into the repository. Different fonts, browser rasterization and Node/Skia rasterization can change individual pixels. Exact pixel parity has not been established.

The standalone demo was a manually composed 1280×720 stage at 60fps. Its decorative full-screen backdrop, headers and footer are not caption content and are not painted over a user's video. The app adapts the two-level caption layout to arbitrary text, speech timings and aspect ratio. Its final word is larger and multicolored; earlier words form the lead-in. Newlines and long phrases wrap. All-word and single-word modes remain available. Short phrases compress entrance timing so the letters can appear before the caption ends.

## Renderer and controls

- `frontend/src/config/captions/neon-riot-variants.ts`: all twenty stable style keys, names and defaults.
- `frontend/src/lib/neon-riot-core.mjs`: shared Canvas painter; no DOM or Node imports; canvas creation is injected.
- `frontend/src/lib/neon-riot.ts`: caption text, timing, layout, hit bounds and font-cache adapter.
- `frontend/src/lib/caption-renderer.ts`: the common entry point already used by both editors, style cards and export.
- `frontend/src/components/NeonRiotControls.tsx`: five colors, box color, word count, motion mode/strength, glyph delay and boxes/particles/underline switches.
- `backend/studio/caption_presets.py`: persistent preset validation; settings stay in the existing JSON contract.
- `scripts/render-neon-riot.mjs`: standalone reference generator using the shared painter.

Font, weight, size, case, spacing, caption position, rotation, opacity, outline, depth and word offsets feed the native layout. The five-color face treatment is authored by this painter; it does not reproduce every generic material/texture control of other styles. No automatic keyword or extra suggested title is introduced. Existing manual title behavior is retained.

Frames depend on video time rather than a separate animation clock. The caption cache invalidates at 60fps for this collection, including during seeking, while export uses its selected/source frame rate. A 30fps export still contains 30 frames per second. Prepainted glyphs avoid repainting outlines and depth on every frame; the shared sprite cache is bounded to 96MiB/64 words, with up to 2× raster density and eviction on font loading. A single unusually large word can exceed the cache target.

Changing caption appearance makes no AI API request. Existing transcription, storage and export behavior remain in place.

## Validation

The subsequent Prism Fold addition also exposes Neon Riot's custom motion as an optional whole-caption effect for any style. Native Neon Riot controls now include spring damping/frequency, tilt/float, exit duration, trail colors/opacity, particle count/spread/lifetime, box rounding, underline width/duration/color, face gradient and edge glow. Original defaults remain unchanged. See [Prism Fold and function inventory](prism-fold.md) for the precise function count, existing-function reuse and UI paths.

Release verification was authorized on October 1, 2026. The frontend regression suite (116 styles), lint, production build, 106 backend tests and four deployment tests passed. Coverage includes word timing, deterministic seeking, 60fps cache invalidation, transparent overlays, palette changes and save/load. The earlier demo artifacts predate the shared-painter extraction; pixel equivalence across different Canvas implementations and fonts is not claimed.
