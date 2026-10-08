import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:net';
import { root, python, requirePython } from './runtime.mjs';
requirePython();
for (const port of [5175, 8002]) {
  await new Promise((resolveCheck, reject) => {
    const probe = createServer();
    probe.once('error', () => reject(new Error(`Port ${port} je zauzet. Zaustavi prethodno pokretanje ove aplikacije.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolveCheck));
  });
}
const require = createRequire(import.meta.url);
const vite = resolve(dirname(require.resolve('vite/package.json', { paths: [resolve(root, 'frontend')] })), 'bin/vite.js');
const migration = spawnSync(python, ['backend/manage.py', 'migrate', '--noinput'], { cwd: root, stdio: 'inherit', windowsHide: true });
if (migration.status !== 0) process.exit(migration.status ?? 1);
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
function launch(command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code ?? 1); });
}
launch(python, ['backend/manage.py', 'runserver', '127.0.0.1:8002'], root);
launch(process.execPath, [vite], resolve(root, 'frontend'));
console.log('\nKlipanje: http://127.0.0.1:5175/titlovi\nDjango admin: http://127.0.0.1:8002/admin/\nCtrl+C gasi oba servera.\n');
