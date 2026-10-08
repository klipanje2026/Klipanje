# Caption code map

- frontend/src/config/captions: style identities, defaults and library categories.
- frontend/src/lib/collection-captions.ts: shared drawing entry for cards, editors and export.
- frontend/src/lib/collection: original collection renderers.
- frontend/src/lib/studio-library: 111 Studio styles, lazy family loaders and runtime adapter.
- frontend/src/lib/motion-pack: motion collection runtime.
- frontend/src/components/StudioStyleControls.tsx: Studio palettes and settings.
- frontend/public: runtime fonts, textures and licenses only; reference GIFs and unused thumbnail copies have been removed.
- scripts/import-*.mjs: source adaptation tools, not application entry points.

Raw handoffs live locally under ignored work/imports. The Studio importer accepts an optional handoff directory: node scripts/import-studio-library.mjs <directory>. Its default is work/imports/studio-titlova. The application runs from the committed adapted sources and does not need original demo projects.

Keep required font and renderer licenses. Style gallery cards draw through the shared renderer rather than reference videos. Long caption text is paged automatically; users do not need to supply demo sentence lengths.
