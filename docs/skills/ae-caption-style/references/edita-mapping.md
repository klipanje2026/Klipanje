# Mapping AE styles into Edita

Repository paths below are relative to the Edita root. These notes reflect the source inspected on 2026-09-23; read the current files before implementation. This file is a code map, not a promise that every AE parameter already exists.

## Implementation locations

| Responsibility | File |
|---|---|
| Stable `StyleKey`, `CaptionSettings`, `Segment`, `CaptionTemplate` | `frontend/src/config/captions/types.ts` |
| Catalog, presets, defaults, `settingsForTemplate`, visible keys | `frontend/src/config/captions/presets.ts` |
| Effect groups | `frontend/src/config/captions/effects.ts` |
| Existing motion constants/options | `frontend/src/config/captions/animations.ts` |
| Font choices/loading | `frontend/src/config/captions/fonts.ts`, `frontend/src/lib/text-fonts.ts`, `frontend/src/lib/custom-caption-fonts.css` |
| Shared drawing, word selection, bounds and animation cache key | `frontend/src/lib/caption-renderer.ts` |
| Text surface shading | `frontend/src/lib/text-surface.ts` |
| Person masking (not arbitrary AE track mattes) | `frontend/src/lib/person-mask.ts` |
| Controls and style picker | `frontend/src/components/CaptionSettingsPanel.tsx`, `frontend/src/components/CaptionStylePicker.tsx` |
| Card/sample canvas | `frontend/src/components/CaptionSample/CaptionSample.tsx`, `frontend/src/components/CaptionCanvas/CaptionCanvas.tsx` |
| Video editor caption layer/editor | `frontend/src/components/VideoCaptionLayer.tsx`, `frontend/src/components/VideoCaptionEditor.tsx` |
| Subtitle preview/export | `frontend/src/pages/SubtitleStudio/SubtitleStudio.tsx` |
| Video composition/export | `frontend/src/pages/VideoStudio/VideoStudio.tsx`, `frontend/src/lib/video-captions.ts` |
| Shared MP4 frame export | `frontend/src/lib/offline-export.ts` |
| Client saved presets | `frontend/src/lib/caption-presets.ts` |
| Server saved-style and settings allowlists | `backend/studio/caption_presets.py` |
| Relevant existing checks, when authorized | `scripts/test-caption-renderer.mjs`, `scripts/test-video-studio.mjs`, `backend/studio/test_caption_presets.py` |

## What can be reused, and what cannot be assumed

| Reference requirement | Current Edita starting point | Mapping caution |
|---|---|---|
| Main font, size, caps, tracking, alignment | `fontFamily`, `fontScale`, `uppercase`, `letterSpacing`, `alignment` | AE tracking/font-size units are different. Font weight/leading and rich runs may require new settings. |
| Second font/role | `secondaryFontFamily`, `secondaryFontScale`, `secondaryStyle`, title/word overrides | Preserve roles and inheritance; do not force every layer into the first word. |
| Position and 2D angle | `x`, `y`, `position`, `rotation` | `x/y` are percent-based; AE local positions need parent/anchor resolution first. |
| Text/active-word color | `textColor`, `highlightColor`, `wordColorMode`, `wordMode` | Arbitrary multi-stop palettes and selectors need explicit representation if existing fields cannot express them. |
| Gradient | `gradientAngle`, existing gradient style drawing | Current style-specific stops are not a general AE gradient importer. |
| Inner/outer stroke | `outlineColor`, `outlineWidth`, `outerOutlineColor`, `outerOutlineWidth` | Match pass order and actual unit conversion; more stroke passes may require renderer changes. |
| Shadow/glow | Existing style branches; `glowIntensity`, `glowRadius`, outline glow fields | Arbitrary independent shadow offsets/blur/spread stacks are not currently general settings. Don't call `effectDepth` a complete shadow model. |
| Box | `backgroundColor`, `backgroundOpacity`, style-specific box drawing | Padding, shape, corners and box-only keyframes may require new controls and renderer behavior. |
| Entrance/word reveal | `reveal`, `revealDuration`, `fadeFrom`, `animation`, current motion constants | Named pop/fade/rise effects are not arbitrary AE keyframe tracks. |
| Word highlighting/reveal | `Segment.words`, `activeWordIndex`, `wordMode`, `emphasisWord` | Drive by actual speech timestamps; adapt selectors to new text. |
| Layered heading | `role: title`, `standaloneTitle`, `titleStyle`, `titleOverrides`, source links | Preserve heading/caption independence and manual user changes. |
| Idle/repeat | `effectPlayback`, `effectIdle`, `effectIdleColor` | Check the relevant renderer branch; the field alone doesn't guarantee behavior for every style. |
| Pseudo-depth/material | `textDepth`, `textDepthColor`, `textMaterial`, surface fields, `effectDepth` | Canvas layering and shading do not reproduce arbitrary AE camera geometry, lights, reflections or plugins. |
| Masks/blending/motion blur | Existing compositing where applicable | General AE matte chains, 3D scenes and shutter-based blur are not native. Document extensions or visible approximations. |

## Scale and timing

The shared renderer currently starts font sizing approximately as:

```text
fontPx = max(12, canvasWidth * 0.054 * fontScale / 100 * styleFactor)
```

This is a starting calculation, not a universal visual conversion. Some branches apply additional sizing, fit rules or separate title layout. AE font size, parent scaling, text bounds and actual glyph metrics must be considered. A value of `fontScale: 100` does not mean 100 pixels. AE's anchor/baseline cannot be converted merely by dividing position by composition width/height.

Edita segments and word timestamps are seconds. Motion must be deterministic from timeline time, relative segment/word age and saved settings. Keep render caches aware of animated state through `captionFrameKey`; a correct draw function can still freeze if its cache key stays static. Test seeking and repeated rendering at the same time when checks are authorized.

## Integration procedure

1. Decide whether the reference can be expressed through an existing renderer with a new preset, or needs a new style branch/settings. Preserve the measured source values in the style record either way.
2. For a new built-in identity, add its key to `StyleKey`, a `CaptionTemplate`, and the applicable visible catalog (`visibleStyleKeys` / `visibleTemplates`). A catalog entry alone may remain hidden. Classify in existing effect groups only where their behavior genuinely applies.
3. For settings additions, update defaults and controls alongside the renderer. Check inheritance for title/word/segment settings and save/restore/undo behavior. Never overwrite old saved settings just to achieve the demo appearance.
4. Update backend `STYLES` and `SETTING_TYPES` if a new key/setting is saved through caption presets. The current validator has a 16,000-character settings limit and accepts only known scalar types/enums, with one supported `secondaryStyle` nesting level. A new arbitrary timeline object requires a deliberate data-model change, not an unvalidated escape hatch.
5. Register and load the actual required web fonts for both preview and export. Do not infer availability from a successful system-font fallback. Keep missing/replaced dependencies visible in the style report.
6. Route card, subtitle editor, video editor and MP4 export through shared drawing. Keep hit bounds/selection consistent with the new appearance. UI-only CSS animations do not appear in the exported MP4.
7. Record changed files, exposed controls, fidelity limitations and deferred checks in the per-style report and `LOCAL_CHANGES.md`.

For a saved user preset with unchanged renderer behavior, use the existing preset model when that is the requested outcome; do not unnecessarily create a new built-in key. Do not create live saved presets or modify real user projects merely to test a style.
