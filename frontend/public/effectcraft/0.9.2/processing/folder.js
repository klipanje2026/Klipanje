import {getOutput, patchOutput, recipe, settings} from './store.js';
import {effectName} from './names.js';

const base = '/api/local-effectcraft';
async function request(path, options = {}) {
  const response = await fetch(path, {credentials: 'same-origin', cache: 'no-store', ...options});
  let result;
  try {result = await response.json();} catch {throw Error('Spremanje u folder nije dostupno. Provjeri lokalnu aplikaciju.');}
  if (!response.ok) throw Error(result.error || 'Spremanje u folder nije uspjelo.');
  return result;
}
export const folderState = () => request(base + '/download-directory');
export async function chooseFolder() {
  const {csrfToken} = await request('/api/auth/csrf');
  return request(base + '/download-directory', {method: 'POST', headers: {'X-CSRFToken': csrfToken}});
}
export async function savePrepared(id, {owner = settings()?.owner, automatic = false} = {}) {
  if (!navigator.locks) throw Error('Za spremanje koristi noviji Chrome ili Edge.');
  return navigator.locks.request('effectcraft-folder-' + id, async () => {
    let output = await getOutput(id);
    if (!output?.processedBlob?.size || output.processing?.status !== 'ready' || output.processing.recipe !== recipe) throw Error('Prvo obradi video na 1200 px bez zvuka.');
    const user = (await request('/api/auth/me')).user;
    if (!user || String(user.id) !== String(owner)) throw Error('Prijava se promijenila. Osvježi prikaz.');
    const directory = await folderState();
    if (!directory.available) throw Error('Odaberi dostupan folder za gotove videe.');
    if (automatic && output.folderSave?.directory === directory.directory && output.folderSave?.completed === output.processing.completed && output.folderSave?.owner === String(owner)) return output.folderSave;
    const {csrfToken} = await request('/api/auth/csrf');
    const form = new FormData();
    form.append('file', output.processedBlob, effectName(output.name));
    form.append('name', effectName(output.name));
    form.append('directory', directory.directory);
    form.append('owner', String(owner));
    try {
      const result = await request(base + '/save', {method: 'POST', headers: {'X-CSRFToken': csrfToken}, body: form});
      const saved = {...result, directory: directory.directory, completed: output.processing.completed, owner: String(owner)};
      output = await getOutput(id);
      if (output?.processing?.completed === saved.completed) await patchOutput(id, {folderSave: saved, folderError: ''});
      return saved;
    } catch (error) {
      await patchOutput(id, {folderError: error.message || 'Spremanje nije uspjelo.'});
      throw error;
    }
  });
}
