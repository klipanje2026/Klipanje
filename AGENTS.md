# Klipanje project instructions

- This is the Klipanje fork of the user's imported Django + React editor. Read `LOCAL_CHANGES.md` for the current task agreement.
- Use only this project's root `.env` for OpenAI and ElevenLabs credentials. Never import environment files or user databases from source archives. Never commit keys, passwords, databases, media, or ZIP archives.
- Keep storage and the database local. Do not add Cloudflare, R2, Backblaze or remote deployment integrations.
- The active application contains login, first-login password changes, a home page with script/photo/video entries, private local scripts, and the existing subtitle/video editors. Projects own scripts and timed intervals, generated/imported photos and the simplified Edita video workflow. Preserve the shared renderer and existing timeline/export behavior.
- Working agreement: keep LOCAL_CHANGES.md current and complete requested edits before final checks. Default to local changes; commit/push only with explicit user authorization. The 09.10.2026 reference/photo/video round is explicitly authorized for publication after checks (see LOCAL_CHANGES.md). Initial accounts Abdullah and Rijad must receive fresh temporary passwords on each local installation, never hardcoded or tracked credentials.
- Preserve the actual imported Edita VideoStudio layout, player and timeline. Simplify its tool panels and add project navigation; do not replace it with a newly designed editor. User-supplied palette screenshots are theme references only, never seed them into projects or galleries.

- `tools/edita-staging-mcp/` is a private, local STDIO connector for `https://staging.edita.ba` ONLY. Never deploy it to production, expose it as a live endpoint, import it into frontend/backend, add a configurable production origin, or include it in a website release. Keep the release package/apply guards. Colleague credentials stay outside tracked files. This restriction also applies to future agents and release work.

- Read `LOCAL_CHANGES.md` for the current working agreement and cumulative pending changes. Keep that list current for requested edits.
- For an After Effects `.aep` / `.aepx` reference, or a request to turn an AE title into an Edita caption style, read `docs/skills/ae-caption-style/SKILL.md` before extracting or implementing the style. This also applies when the user says "napravi stil od ovog AEP-a" without naming the skill.
- That workflow preserves the reference's appearance and motion while replacing its literal text with the user's captions. It is an agent workflow, not an existing browser AEP importer.
- Use the existing shared caption renderer for style cards, both editors and video export. Do not make a preview-only imitation or silently change an existing style's identity.
