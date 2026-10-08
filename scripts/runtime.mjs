import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const python = resolve(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
export function requirePython() {
  if (!existsSync(python)) throw new Error('Prvo pokreni 1-INSTALIRAJ.cmd ili napravi .venv i instaliraj backend/requirements-lock.txt.');
}
