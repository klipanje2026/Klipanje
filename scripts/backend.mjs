import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { root, python, requirePython } from './runtime.mjs';
requirePython();
const child = spawn(python, ['manage.py', ...process.argv.slice(2)], { cwd: resolve(root, 'backend'), stdio: 'inherit', windowsHide: true });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
