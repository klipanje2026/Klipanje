import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { root } from './runtime.mjs';

const path = resolve(root, '.env');
let content = existsSync(path) ? readFileSync(path, 'utf8') : '';
const defaults = {
  OPENAI_API_KEY: '',
  ELEVENLABS_API_KEY: '',
  OPENAI_MODEL: 'gpt-4.1-mini',
  DJANGO_SECRET_KEY: randomBytes(48).toString('hex'),
  DJANGO_DEBUG: 'true',
  DJANGO_ALLOWED_HOSTS: '127.0.0.1,localhost',
  CSRF_TRUSTED_ORIGINS: 'http://127.0.0.1:5175,http://localhost:5175',
};
for (const [key, value] of Object.entries(defaults)) {
  const pattern = new RegExp('^' + key + '=(.*)$', 'm');
  const match = content.match(pattern);
  if (match) {
    if (key === 'DJANGO_SECRET_KEY' && !match[1].trim()) content = content.replace(pattern, key + '=' + value);
    continue;
  }
  if (content && !content.endsWith('\n')) content += '\n';
  content += key + '=' + value + '\n';
}
writeFileSync(path, content, { mode: 0o600 });
console.log('Lokalne postavke su spremne. Postojeći API ključevi su sačuvani.');
