# Metallic Compact V2

Built-in ID `metallicCompactV2`, displayed as **Metallic Compact**. Separate from
Dynamic Glass and Premium Orange. Source: the user's
`EDITA_HANDOFF_METALLIC_COMPACT_V2` handoff, approved video, Python renderer and
integration notes. Supplied stills and sequential frames extracted from the
approved video were inspected as reference material.

Shared implementation: `frontend/src/lib/metallic-compact.ts`.

- Measured thin Arial rows and heavy Arial Black / bundled Montserrat fallback.
  Long rows shrink to fit 90.7% of the frame. Visible glyph bounds determine
  the 5px reference gap, scaled to the output dimensions.
- Original seven-stop silver, burgundy and orange palettes. Animated curved
  gradient bands, diagonal Gaussian reflection, edge-only depth and a narrow
  upper highlight. Default face alpha: .96 thin, .97 red, .94 silver/orange.
- Vertical 0.17/0.22s quartic ease-out entrances, 0.065s fade and decaying blur;
  upward 0.12s exits with blur. Short captions shorten these timings. No animated
  text scale, rotation, bounce or horizontal travel. Manual rotation remains editable.
- Transcript-derived 2–6 word blocks replace the literal demo phrases. Existing
  manual word emphasis wins; otherwise the trailing one/two words are emphasized.
  Thin and heavy consecutive word runs preserve text order. Top/chest zones can
  coexist within a segment until replaced in the same zone. Zone and material
  alternation are deterministic layout rules, not semantic analysis.
- Optional final-block hold, material/zone/phrase controls, editable metal colors,
  reflection strength and video zoom intensity. All are saved by the preset schema.
- Camera target sequence comes from the reference and is retimed to caption-block
  onsets. The 0.18s eased transitions, bounded slow push and lateral crop motion
  apply to footage before captions. Camera off is identity. Existing shared camera
  adapters feed both editor previews and exports. No segmentation by default.

Adaptation limits: the original video has hand-authored semantic groupings and
overlapping timings; these are not hardcoded into arbitrary transcripts. The
reference's additional multi-image radial camera smear is not implemented in
this version. Moving material bands use narrow Canvas gradient strips rather
than Python's per-pixel RGB computation. System font rasterization can differ.

Implementation only, following LOCAL_CHANGES.md: no tests, build, browser QA,
export comparison, push or deployment run. Reference parity in the app remains
unverified. Neither source footage nor literal sample transcript is distributed.
