# Extraction contract, version 1

Use this contract for the reusable design specification, alongside `style-spec.schema.json`. It describes evidence and implementation decisions; it is not an executable animation format. A property value may be structured JSON to preserve AE information that Edita does not yet implement. Never pass this document directly to the renderer or preset API.

Copy `../assets/style-spec.template.json` to `docs/caption-styles/<style-id>.style.json`. In the copied record change `$schema` to `../skills/ae-caption-style/references/style-spec.schema.json`, replace the identity, and populate the actual layers/tracks. The template's single text layer is a structural example, not an observation about the supplied project.

## Record and evidence

- `id`: stable proposed Edita key, e.g. `aeSoftLift`. `name`: user-facing style name. Do not assign an existing unrelated key.
- `status`: `template` (no source analyzed), `partial` (missing source/design evidence), `specified` (design described), `implemented` (code written), `verified` (authorized comparison completed). Status never means all effects are exact; mapping limitations remain explicit.
- `source`: source path/name, SHA-256 when available, format, selected composition ID, AE version and extraction method. Link related exports/renders through `evidence`. Keep external file dependencies separate; AEP references are not embedded media.
- `canvas`: actual source dimensions, rational frame rate, pixel aspect, duration, display start, color space, linear-light setting and bit depth. Unknown values are `null`. Preserve original numeric precision, including fractional frames.
- `evidence`: stable IDs for AE property exports, rendered frames, screenshots, timing measurements or explicit design decisions. `artifact` is a relative/local path when available; mark unavailable evidence rather than fabricating a path.
- `coverage`: record `complete`, `partial`, `unknown` or `not-applicable` for each required design group. `complete` means inspected and described, not necessarily supported by Edita. Omitted, disabled and unknown are different.
- `dependencies`: fonts with their real family/PostScript names, weight/style and version when known; plugins and versions; media/mattes; AE renderer requirements. Mark each dependency available, missing, replaced or unknown. A font substitute is a visual difference.

Properties carry `origin` (`extracted`, `measured`, `inferred`, `designed`, `unknown`, `not-applicable`), `evidenceIds` and a note. `unknown` / `not-applicable` use a null value; an explicitly absent effect is an observed `enabled: false` property. Inferred/designed values must not be reported as extracted measurements. A readable string in an AEP does not establish its font, position or animation.

## Text is a binding, not content

`text.sourceTextIncluded` is always false. Each slot identifies the text layers and a content source: user's caption, separate user title, active word or emphasized word. A slot can feed multiple outline/shadow/copy layers. Preserve multi-font/multi-color roles and selectors, not the source phrase.

Do not write literal Source Text values, copies in layer names, text embedded in expression strings, or source wording in template samples. Record formatting runs as rules (word index, active word, alternating words, line, semantic emphasis). Source character indices may be retained as measurements, but separately define how they adapt to a different string. Shape outlines of the original phrase require a font/text reconstruction; they are not reusable glyphs for arbitrary text.

Use neutral demo captions only for sample cards and comparisons. Existing user segments and word timestamps stay editable and are not replaced by demo text. Preserve the distinction between a standalone heading and speech captions.

## Layers and visual properties

`layers` contains stable IDs, kind, stacking order, parent/matte links, text slot, source in/out points, time stretch and a time-remap track link. Traverse relevant precompositions; the same source comp instantiated twice needs separate instance paths. Record parent/controller transforms instead of silently interpreting a layer's local position as its final screen position.

Each `properties` entry contains a canonical `path`, the original AE property path (`matchName` plus property index where obtainable), value, units, provenance and evidence. Match names are preferred over localized display labels. Preserve effect ordering, repeated effects and disabled states. Suggested canonical paths follow; add explicit paths when the reference requires more detail.

| Group | Capture as applicable |
|---|---|
| `typography.*` | Family/PostScript name, font style/weight/variation axes, font size, tracking, kerning, leading, baseline shift, faux styles, caps, alignment, direction, paragraph box vs point text, per-range styling |
| `layout.*` | Measured glyph/text bounds, baseline, line spacing, alignment anchor, wrap width, safe margins, line-break rules, horizontal/vertical text scaling |
| `transform.*` | Position, anchor point, scale, skew, rotation, opacity; original local coordinates and parent chain; effective comp-space transform if sampled |
| `fill.*` | Solid/linear/radial fill, every RGBA color stop and its offset, angle, coordinate space, opacity, texture references |
| `colorRules.*` | Coloring by line/word/character, active/inactive word, alternating palette, emphasis selectors; include more than two colors when present |
| `strokes[n].*` | Enabled, color, opacity, width, alignment, joins, fill/stroke order, separate inner/outer passes |
| `shadows[n].*` | Color, opacity, angle/distance or x/y offset, blur, spread/choke, inset/outer, blend mode, transform space and pass order |
| `glows[n].*` | Color(s), threshold, radius, intensity, blend mode and stacked passes |
| `boxes[n].*` | Fill/gradient, stroke, opacity, radius per corner, padding on all sides, anchor, fixed vs text-fit dimensions, per-word/per-line/block bounds, position and reveal/mask |
| `shapes[n].*` | Shape type/path, transform, fill/stroke, trim paths, masks and whether geometry follows replacement text |
| `textAnimators[n].*` | Animator property changes, range/expression selectors, character/word/line basis, order, offset, amount, randomized order/seed, per-unit delay |
| `compositing.*` | Layer opacity, masks with feather/expansion, matte type/link, blend mode, clipping, precomp/collapse behavior, ordered effect stack |
| `threeD.*` | Enabled, renderer type, actual geometry vs layered pseudo-depth, extrusion, bevel, material, reflection/roughness, orientation and x/y/z rotations |
| `camera.*`, `lights[n].*` | Transform, focal length/zoom, perspective, depth of field, light type/color/intensity, shadow settings and dependencies |
| `effects[n].*` | Match name/plugin/version, ordered parameters, enabled flag, animated parameters, motion blur/shutter/phase and any unsupported custom data |

Units must be explicit: source pixels, degrees, seconds, scale factors vs percentages, AE tracking units, alpha 0–1 vs opacity 0–100, linear vs sRGB colors, and local vs composition coordinates. Structured values must describe units for each dimension where they differ. Do not convert everything to `CaptionSettings` units during extraction.

## Motion, easing and timing

`motion.phases` describes entrance, hold, exit and optional idle/loop with original source time ranges and trigger. The source timeline is measured in **seconds from the composition start**, independent of its display timecode; record the display start separately. Layer in/out and keyframe times use the same origin. Retiming to Edita segment/word time is a separate adaptation decision.

Each track links a layer, canonical property and optional phase. Capture:

- all relevant keyframe times and values;
- incoming/outgoing interpolation (`hold`, `linear`, `bezier`) and temporal ease speed/influence **per dimension**, with original speed units in the track;
- spatial incoming/outgoing tangents, roving, continuous and auto-Bezier flags where applicable;
- full transform trajectories, overshoot, anticipation, settle, delays/stagger, order and repeat behavior;
- time-remapped/nested composition timing and control-layer links;
- effective samples when an expression or plugin drives the result; state the sampling interval and measured time span in notes.

AE temporal speed/influence is not a CSS cubic-bezier tuple. Preserve the source representation, then implement/sample the actual curve. A few screenshots cannot establish a continuous trajectory. Samples need enough temporal resolution for the fastest visible effect; fixed coarse samples are not proof of fidelity.

`expression.present` records whether the track is expression-driven. Describe inputs and behavior; store a hash/reference to the private source if needed, not executable code or literal source text. `handling` states none, unresolved, sampled or reimplemented. Re-evaluate text-dependent expressions with replacement text in a reference copy when possible; samples for one phrase do not prove arbitrary-text behavior.

## Adaptation decisions

Record these separately from source observations:

- `layoutPolicy`: scaling reference geometry to output pixels; text measurement, anchor and parent resolution. Avoid independent x/y stretching of glyphs unless intentional.
- `timingPolicy`: mapping entry/hold/exit to a segment or actual `Segment.words` timing, idle behavior, stagger and repeat period. Preserve the characteristic entrance/exit rather than stretching every effect over the whole video.
- `shortSegmentPolicy`: a concrete rule when a segment is shorter than its entrance plus exit (compression, clipping or skipping hold), without negative durations/division by zero.
- `longTextPolicy`: wrapping, fitting, maximum lines, spacing and emphasis when word/character counts differ. Boxes follow measured replacement text.
- `colorAssignmentPolicy`: semantic/ordinal rules for every palette role, including what happens with fewer words or more lines.
- `boxSizingPolicy`: padding/radius units, multi-line behavior and whether boxes animate with text or independently.
- `missingWordTimingsPolicy`: explicit fallback only when actual word timings are missing. Do not label estimated timings as measured speech.
- `aspectRatioPolicy`: 9:16, 16:9 and 1:1 placement, safe area and visual scale.

Do not claim the original author defined these policies unless the project demonstrates that behavior. They are usually deliberate Edita decisions.

## Edita mapping and persistence

`edita.settings` contains proposed runtime settings only; validate against the current `CaptionSettings` and backend allowlist when implementing. New proposed fields belong in `requiredExtensions` until implemented. The schema intentionally does not freeze the application's evolving setting names.

Each mapping links a layer/property (or track ID) to targets and a conversion note, classified as `native`, `renderer-extension`, `approximation`, `unsupported` or `unknown`. Write down the visible consequence of an approximation. `changedFiles` lists only files actually changed; empty means no implementation yet.

The built-in style specification is not the backend's saved-preset payload (which has a size limit and strict allowlist). Do not put raw layers/keyframes/evidence into an existing settings field to bypass validation.

## Completion checks when authorized

Beyond JSON shape, check unique IDs and all references: layer parents/mattes/slots, phase and time-remap links, evidence IDs, mappings and dependency IDs. Parent chains must not cycle. Track times must be finite and ordered; gradient offsets/opacity units must be sensible. Preserve valid off-screen coordinates, negative pre-roll times and overshoot rather than clamping source measurements blindly.

A specified record has a selected source/composition, text bindings, design properties and coverage for every group (including explicit unknowns). An implemented record names a registered style and actual changed files. A verified record has real visual comparison evidence, no failed required checks and disclosed approximations. The JSON Schema enforces basic structure; these semantic/fidelity conditions require inspection.

Compare equivalent text, fonts, dimensions, background and color handling at matched timestamps. If verification is deferred by the working agreement, retain `validation.status: not-run` and do not invent checks or screenshots.
