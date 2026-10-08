# Studio collection — 2026-10-05

The supplied `studio-titlova` folder (archived locally under `work/imports/studio-titlova`) contains 133 catalog entries. Twenty-two IDs belong to the earlier import. The 111 additional entries are registered under **Stilovi → Studio · 111** with distinct `collectionStudio…` identities. Existing styles, removals and the Prepravke category are retained.

## Source integration

`scripts/import-studio-library.mjs` imports the dependency graph for 33 renderer families, their embedded fonts, palette definitions and licenses. Only palette/configuration data modules are evaluated during import; it does not instantiate renderers, run demo loops or generate preview media. Modules use the existing local Three.js 0.169 runtime. Each family is lazy-loaded with its required fonts. The public catalog lists all names and identities at `frontend/public/studio-library/catalog.json`.

`frontend/src/lib/studio-library/runtime.mjs` adapts those original renderers to the shared collection contract. The same caption path serves gallery cards, subtitle editing, video editing and offline export. Palettes select the actual native palette instead of applying a generic hue filter. Native motion, depth, texture, lighting and detail controls are exposed for relevant families. New settings and style identities are permitted in backend preset persistence.

The fourteen choreographed titles use the original timed sequence, scaled to the caption group's duration. They accept up to eight user words and preserve their original entrance/hold/exit arrangement. Cue-driven families receive the transcript's word times; longer passages split into their native group sizes. Meadow/Luxury retain their original pair-based animation. No original demonstration sentence replaces user text.

Portrait renderers draw to a transparent 9:16 working canvas. The adapter crops the original caption region into Edita's movable caption surface; it does not include the demonstration video or studio background. Flexible renderers use their native overlay mode. Meadow/Luxury preserve stage geometry while suppressing the backdrop. The original HALO renderer's empty second row is skipped for a one-word caption.

Crystal Glass, Liquid Impact and Mega can sample the actual video region beneath the caption, including Edita crop, placement and rotation. Gallery cards use the existing portrait image as that input. A neutral light field is used only while a Crystal source frame is unavailable. Embedded font outlines and font-face payloads are kept as supplied; licenses accompany the import.

## Scope and validation

TypeScript and the production build passed before the October 5 GitHub update. No test suite, screenshot comparison, reference video export or browser QA was run. Visual fidelity and runtime behavior have not been independently verified. This update targets GitHub; no live deployment was requested.
