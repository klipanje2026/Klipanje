# Local compatibility patches

Upstream: EffectCraft web 0.9.2, see SOURCE.json for release URL and original ZIP checksum.
The checksum describes the upstream archive, not the locally patched tree.

## Why

The original WASM entry point does not implement `cpu` or `webgl` URL flags.
On this Windows installation the WebGPU path reported device loss in both Edge and
Codex IAB: `A valid external Instance reference no longer exists.` This message does
not establish a hardware defect or distinguish browser/driver/application lifetime bugs.

## Changes

- `effectcraft_web.js`: the WASM navigator GPU getter returns undefined in CPU mode,
  selecting the bundled fallback graphics path. No global navigator mutation or
  browser settings changes; only this engine's capability import is affected.
- `index.html`: normalize old and new entry URLs to cpu=1, nogpuworkers=1,
  frameworkers=1 and nosw=1 before WASM starts. Keep rendering in one worker rather
  than blocking the main UI thread; do not initialize WebGPU in job/frame workers.
- No engine project schema, OPFS/IndexedDB data, original WASM or export code changed.
- React launcher uses this same mode for embedded and standalone operation.

## Validation

In native Microsoft Edge: opened home, imported PNG, created 1280x720/24fps comp,
added footage, edited scale, applied Turbulent Displace with two evolution keyframes,
played preview and downloaded an .ecproj. Quarter preview showed 25–39 ms in this
small scene. This is a sample, not a benchmark for every effect or resolution.

Do not overwrite these patches when updating the vendor runtime. Review a new release's
supported launch options and revalidate preview/export before removing the workaround.

## Local workspace and output bridge — 28.10.2026.

- `klipanje-bridge.js` receives only same-origin messages from its parent and uses the
  native `ui.set {theme: light|dark}` API. The WASM UI retains its native neutral/blue
  palette; the surrounding React workspace uses the user's Klipanje light/dark palette.
  No canvas CSS filters are used, so footage and exported pixels remain unchanged.
- The WASM host's anchor-click import also reads the engine's blob download immediately,
  before URL revocation, retaining a copy through `klipanje-library.js` in a separate
  local IndexedDB. The original browser download still runs. Quota errors report back;
  they never suppress the original download. This does not monitor unrelated downloads.
- The React workspace lists/downloads outputs, requires a valid project AND script,
  and imports new video/image exports with the existing authenticated `uploadAsset`.
  .ecproj/ZIP files stay available for download, without becoming timeline media.
  Stored files can be retried manually; existing exports are not automatically imported
  on reload. Imported media never changes an existing montage automatically.
- Standalone launch now opens the same React workspace, preserving the output controls.
  Older raw-engine links retain outputs and offer a link back to the workspace.
- IndexedDB is private to this browser/origin, not an OS folder. After import,
  the existing backend saves media in Klipanje's local project storage. No cloud service,
  backend route, database schema or browser download-folder setting was added.

Validation: actual native light/dark UI and Save As captured in the output library;
library survived reload. Bridge test covers export bytes after immediate URL revocation,
MIME detection and origin/source guards. Existing backend upload/download roundtrip
and workspace privacy tests pass. Full MP4 render-to-auto-import UI flow was not rerun.

Render Queue validation also completed: H.264 MP4, 1280x720, 24fps, 240 frames,
10 seconds, about 1m52s export time. Full FFmpeg decode passed; sampled frames differ.
The generated trial assets are local and excluded from Git.
