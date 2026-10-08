import { createRequire } from 'node:module';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);

export function loadCanvas() {
  if (process.env.NODE_MODULES_PATH) {
    try { return require(join(process.env.NODE_MODULES_PATH, '@napi-rs/canvas')); } catch {}
  }
  try { return require('@napi-rs/canvas'); }
  catch { throw new Error('Install dependencies in this package with npm install.'); }
}

export function findFFmpeg() {
  for (const file of [process.env.FFMPEG_PATH, 'ffmpeg'])
    if (file && spawnSync(file, ['-version'], { stdio: 'ignore' }).status === 0) return file;
  throw new Error('Install FFmpeg or set FFMPEG_PATH to its executable.');
}
