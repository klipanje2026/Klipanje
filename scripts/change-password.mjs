import { createInterface } from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { root, python, requirePython } from './runtime.mjs';

requirePython();
const prompt = createInterface({ input: process.stdin, output: process.stdout });
const username = (await prompt.question('Korisnicko ime (ne prikazno ime): ')).trim();
prompt.close();
if (!username) {
  console.error('Korisnicko ime je obavezno.');
  process.exit(1);
}
console.log('Novu lozinku unesi dva puta. Znakovi se ne prikazuju dok tipkas.');
// Pass the account name as an argument, never as shell command text.
const result = spawnSync(python, ['backend/manage.py', 'changepassword', username], {
  cwd: root, stdio: 'inherit', windowsHide: true,
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
