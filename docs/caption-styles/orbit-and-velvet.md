# Orbit Signal and Velvet Script

Two independent styles, added October 1, 2026. In either editor: **Titlovi → Stilovi → Dynamic** (the underlying category is `Dinamični`). Existing styles keep their identities.

## Orbit Signal

Cool white and mint lettering enters along a curved path. Thin orbital arcs, warm satellite lights and small angular underlines create a spacious technical look. The card says **Tvoj glas putuje**; real captions use the user's own words and timestamps.

Controls include phrase length, three colors, entrance strength/duration, orbital speed/radius, satellite count/glow and independent switches for arcs, dashes and leaders. The default uses the already bundled Inter Variable font.

## Velvet Script

Ivory and gold calligraphy reveals smoothly from left to right, with a moving pen highlight, a drawn flourish and a subtle light sweep. The card says **Sve počinje tobom**. The default uses the already bundled Pinyon Script font. The reveal simulates writing with a clip and highlight; it does not trace each glyph's actual pen strokes.

Controls include phrase length, letters/gold/shadow colors, writing duration/switch, pen highlight, flourish width/duration/switch and shine strength/speed. The font can be changed with the regular typography controls.

## Shared integration

- `frontend/src/lib/signature-caption-styles.ts` draws both looks directly on Canvas and computes selection bounds. It reuses `captionEase`, `drawTextShine` and `drawScriptStroke`.
- `caption-renderer.ts` routes style cards, both editors and export to this same painter, with 60fps animation cache buckets and font-load invalidation.
- `SignatureStyleControls.tsx`, the caption types/catalog and backend preset validation expose and persist all native controls.
- Phrase, single-word and all-word modes, word timestamps, edited text, explicit line breaks, font size/weight, color, caption position/rotation, opacity and individual word offsets are supported. Optional shared **Dodatni pokret** also works.
- Animation depends on the media timestamp, so seeking and export reproduce the same frame. These are transparent graphics, without a baked video background, paid asset or service call. Export frame rate remains the selected/source frame rate.

Regression coverage checks timing, pauses, transparency, backwards seeking, edited text, colors, native effect switches, serialization and backend persistence.

Release verification on October 1: frontend regression suite (116 styles), lint, production build, 106 backend tests and four deployment tests passed. Isolated browser QA confirmed both catalog entries and their caption rendering; Velvet's native settings panel and plus/minus stepping were exercised without modifying real projects. No paid transcription was used for QA.
