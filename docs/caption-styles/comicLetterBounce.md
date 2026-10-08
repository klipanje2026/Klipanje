# Comic Letter Bounce

Reference: user supplied screen_1790242512738.mp4, duration 2.23 seconds. Source frames extracted locally at 12 fps into work/style-reference/motion.jpg. Observed: warm orange letters with pale yellow outline and glow; individual characters enter with a short lower-to-upper bounce and alternating tilt, settle and remain until the phrase changes. Neutral user text replaces all source wording.

Implementation: shared Canvas glyph animation based on speech word timestamps, with stagger inside each word. Nunito Variable 900 approximates the rounded heavy reference font; the original font is unknown. Fill, outline and glow use editable style settings. Timing values are visual approximations from the supplied recording, not AE property extraction. No claim of pixel-identical copying.

Status: implemented, no runtime tests/export/browser verification requested or run. Reference inspection is complete for this short clip; generated output has not been compared.
