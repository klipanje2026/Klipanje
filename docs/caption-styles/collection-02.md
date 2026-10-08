# Kolekcija 02 · 9

Source: `Edita-9-stilova-palete.zip`, supplied by Semir. Implemented locally on 2026-10-02 at his request. No tests, builds, browser checks, comparison renders or deployment were performed for this import.

Find these in either editor under **Stilovi → Kolekcija 02 · 9**:

| Style | Saved identity | Rendering |
| --- | --- | --- |
| Satin Impact | collectionSatinImpact | Original Canvas plaques, staggered letters, depth and glint |
| Slate Fold | collectionSlateFold | Original sliced, folding caption panel |
| STRATA | collectionStrata | Original projected layered glyph sculptures |
| Contour Recoil | collectionContourRecoil | Original solids and independent animated contour shells |
| Mosaic Current | collectionMosaicCurrent | Original text-mask tiles, wave and dispersion |
| Waterform | collectionWaterform | Original procedural distance-field liquid shading |
| Lavaflow | collectionLavaflow | Original molten distance-field shading and droplets |
| Silk Torsion | collectionSilkTorsion | Supplied Three.js geometry, bands and physical materials |
| Crystal Flux | collectionCrystalFlux | Supplied Three.js fragmented geometry and crystal material |

## Adaptation

`scripts/import-motion-pack.mjs` copies/adapts the supplied source without running its demo loops. Extracted originals remain in `work/imports/motion-pack-02`. Hand-written `frontend/src/lib/motion-pack/helpers.mjs` and `runtime.mjs` provide the browser adapter; re-importing preserves these two files. Re-importing does not register styles a second time.

Literal demo phrases are replaced by caption text. Two-line styles balance words; STRATA uses the last word as the sculpture and preceding words as its small heading; the liquid styles display one timed word. Source animation clocks map to caption intervals through Edita's existing collection renderer. Longer words fit the stage. Backgrounds are transparent by default, with the optional original backdrop available in controls.

All nine use `drawCollectionCaption`, the same path used by style-card hover, subtitle editor, video editor and offline export. Export's existing resource preparation and strict error handling also cover these identities. New backend preset identities and the `collectionColors` setting preserve palette changes. Existing styles retain their identities and rendering branches.

The supplied palettes are exposed as named color controls, with a reset to the original palette. Gradient stops remain separate. Procedural liquid and tile colors retain their original lighting and accept color deltas; they are not replaced with flat fills. Three.js keeps the provided physical materials and environment lighting.

## Fonts and fidelity limits

The seven Canvas sources depend on Windows Impact, Arial Bold and Bahnschrift, which the ZIP does not include. Installed fonts are used; fallback fonts may differ on another OS. No Windows font files were redistributed. A licensed embeddable copy is required to guarantee identical typography across devices.

STRATA and Contour originally call Node-only `convertSVGTextToPath`. The browser adapter traces the actual font mask into closed contours, including holes, then uses the source projection and animation. This changes outline sampling, so a pixel-identical claim is not made. Their motion, layering and materials come from the original functions.

Silk and Crystal use the bundled font JSON and its supplied license, and their own supplied Three.js version. Text geometry is replaced inside a reusable renderer rather than allocating a context for each phrase. Unsupported characters surface a renderer error rather than silently substituting another caption style.

Water and lava retain the source's 800×450 procedural working surface and CPU shading. Performance and visual output have not been tested for this import. Card reference GIFs are the files supplied in the archive, labelled **Referenca**; hover uses the shared renderer. No additional screenshots or preview videos were generated.
