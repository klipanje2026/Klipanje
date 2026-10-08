# Dynamic Glass

Source: EDITA_HANDOFF_DYNAMIC_GLASS/README.md, INTEGRACIJA.md, render_demo.py and reference/ODOBRENA_VERZIJA.mp4. Supplied scripts were read, not executed. Contact sheet: work/style-reference/dynamic-glass.jpg. No AEP conversion is claimed.

Implemented as a separate shared style: white supporting rows, blue/cyan and orange glass faces, moving highlights, edge-only depth, fast tilted overshoot entrances with trailing copies, phrase restacking, and brief zoom punches. Word timestamps drive two-word rows by default; rows paginate after three, fit the available width and preserve editable source text. Font, position, rotation, group size, colors, person masking, motion intensity and camera enable remain editable. Short phrases and long text use measured sizing and adaptive timing. This is designed adaptation, not the demo's fixed cue layout.

The shared renderer is used in cards, both editors and export. The video and person mask use the same camera zoom; text stays independent. Source-specific masks and footage are not runtime assets. New videos use the existing MediaPipe person mask. Non-person footage displays the full caption. Still-image style cards illustrate text motion; they do not simulate person segmentation or camera punches.

Known approximations: Montserrat 900 replaces the demo's Arial Black; camera cuts are speech-driven rather than manually keyed to the sample; Canvas gradients approximate its per-pixel gloss, and trailing copies approximate motion blur. Automatic segmentation can differ at hair/fast movement. Two-word grouping is structural, not semantic keyword detection. No claim of pixel-identical output.

Release follow-up: camera punches are now smooth 4.5–10% pulses. A bundled local face detector (with tighter crop fallback) places the warm foreground row below the detected chin, including crop/zoom transforms. Shared person segmentation remains unchanged. If no face is detected the original layout remains; detection is not guaranteed on every video.

Validation: frontend renderer/regression tests, lint/build, 97 backend tests and 3 deploy tests passed. Browser-rendered reference frames at 2.85, 3.1 and 3.5 seconds confirmed the face model and below-head foreground placement. Full exported MP4 comparison and pixel equivalence to the handoff remain unverified.
