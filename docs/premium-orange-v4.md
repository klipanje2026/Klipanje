# Premium Orange V4

New built-in style ID: `premiumOrangeV4`, displayed as **Premium Orange**.

Source: user-supplied `EDITA_HANDOFF_PREMIUM_ORANGE_V4`, README,
INTEGRACIJA, render_demo.py, web/motion.mjs and approved MP4. Reference frames
were extracted to `work/premium-orange` to study the layout and the continuous
orange reveal. No reference footage or literal reference transcript is bundled.

`frontend/src/lib/premium-orange.ts` renders measured word textures with face
gradients, four offset depth layers, a soft shadow and an edge-mask highlight.
White, orange and italic entrances use the supplied easing, motion, fades and
blur. Orange visibility is a continuous alpha gradient across the whole word,
not separately moving letter rectangles. Short word durations compress the
entrance to leave readable time before the phrase exit.

Adaptation to arbitrary captions:
- Speech timestamps come from existing caption words; edited text without
  timestamps uses evenly spaced onsets within its segment.
- Configurable 2–6 word phrases, measured compact rows, shrink-to-fit for long
  text, editable position/rotation/font/weight/colors and word offsets.
- Existing manually emphasized words take priority. Otherwise the final two
  words provide the orange accent; this is a layout rule, not semantic AI.
- Mixed mode deterministically alternates some phrases into italic; users can
  select upright or italic throughout. This generalizes the hand-authored demo.
- Hidden title words are not painted a second time.

Camera uses the first accent onset, a 0.30s push / 0.85s release, 0.48s shake,
3.5Hz frequency and the 46% vertical anchor. Overlapping zooms take the maximum
and translations are bounded. Camera off is identity. Existing glass-camera
settings store its toggle and intensity. `captionCamera` supplies the subtitle
preview/export; `glassVideoTransform` supplies video studio preview/export.
Camera moves footage before the shared caption layer is drawn.

The system Arial family follows the source renderer; it is not redistributed.
Exact rasterization and fallback fonts vary by device. Default main-text
position remains the app's 75% guide. The reference was manually grouped and
cannot dictate identical grouping or editorial emphasis for another transcript.

Implementation only: no tests, build, browser QA, push or deployment in this
request, following LOCAL_CHANGES.md. Visual parity with the approved MP4 has
not yet been validated in the app.
