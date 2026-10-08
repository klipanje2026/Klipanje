# Ink Impact

Added October 1, 2026. Release verification now includes the frontend regression suite (116 styles), lint, production build, 106 backend tests and four deployment tests. All passed after correcting the optional-motion settings type.

## Find and use it

In either editor: **Titlovi → Stilovi → Dynamic → Ink Impact**.

The reference phrase on the style card is **Ostavi svoj trag**. Actual captions use the user's text and word timestamps. Ink Impact is a separate style with its own `inkImpact` key; Neon Riot and Prism Fold keep their identities and defaults.

The design uses stacked, slightly angled condensed lettering, a brief stamp impact, matte printing grain, a rough marker behind the final word, dry-brush underlining and small ink drops. The two marker colors alternate between phrases within a segment. A wipe removes the stamp near the phrase end. Texture and droplets are seeded by caption text and word index, so scrubbing does not invent new random artwork.

## Controls

- **Riječi u otisku:** two to five words per phrase. Existing single-word and all-word modes also work.
- Four colors: ordinary letters, letters on the marker, first marker and second marker.
- **Otisak i pokret:** impact strength, entrance duration, exit wipe, word tilt and row spacing.
- **Marker i tekstura:** marker/underline switches, ragged edges, printing grain and marker opacity.
- **Kapljice tinte:** droplets switch, count and spread.

Font, weight, capitalization, letter spacing, scale, outline, optional letter depth, opacity, caption position/rotation and word offsets feed the native renderer. The previously added **Dodatni pokret** can also be used on this style.

## Implementation

- `frontend/src/lib/ink-impact.ts`: procedural Canvas artwork, cached letter stamps, word timing, layout and selection bounds. Reuses Edita's `captionEase`; uses no image-generation service or CSS text animation.
- `frontend/src/config/captions/types.ts` and `presets.ts`: stable style key, defaults and visible catalog entry.
- `frontend/src/components/InkImpactControls.tsx`: controls connected to the actual settings, using existing range sliders, popovers and color pickers.
- `frontend/src/components/CaptionSettingsPanel.tsx` and `CaptionSample/CaptionSample.tsx`: shared controls and a card preview at normal playback speed.
- `frontend/src/lib/caption-renderer.ts`: the common entry used by cards, both editors and export; 60fps cache invalidation for this time-dependent artwork.
- `backend/studio/caption_presets.py`: accepts the key and typed settings in saved presets; no database migration.

The bundled Oswald Variable font is the default. No font or paid asset was added. Stamps use up to 2× raster density, fit long words before allocating their textures, and use a bounded cache refreshed after font loading. The overlay remains transparent around the lettering and paint. Output frame rate still follows the export settings/source; a 30fps export is not automatically converted to 60fps.

Regression cases passed for shared-renderer output, timing and pauses, deterministic seeking, palette and grain edits, marker removal, complete user text and backend preset persistence. Performance on individual user devices is not benchmarked.
