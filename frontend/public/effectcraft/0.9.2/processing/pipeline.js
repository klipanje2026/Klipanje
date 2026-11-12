import {effectName} from './names.js';
import {savePrepared} from './folder.js';
import {getOutput, patchOutput, settings, isVideo, recipe, speedValid} from './store.js';

async function json(path, options) {
  let response, value;
  try {response = await fetch(path, {credentials: 'same-origin', cache: 'no-store', ...options});}
  catch {throw Error('Ne mogu se povezati s Klipanjem. Provjeri da je lokalna aplikacija pokrenuta.');}
  try {value = await response.json();} catch {throw Error('Klipanje nije vratilo ispravan odgovor. Pokušaj ponovo.');}
  if (!response.ok) throw Error(typeof (value.error || value.detail) === 'string' ? value.error || value.detail : 'Spremanje u galeriju nije uspjelo.');
  return value;
}
export async function currentUser() {return (await json('/api/auth/me')).user;}
export async function destinations() {
  const [projects, scripts] = await Promise.all([json('/api/projects'), json('/api/scripts')]);
  return {projects: Array.isArray(projects) ? projects : projects.results, scripts: Array.isArray(scripts) ? scripts : scripts.results};
}
async function gallery(output, destination, request = json) {
  if (output.processing?.status !== 'ready' || !output.processedBlob?.size || output.processing.recipe !== recipe) throw Error('Prvo obradi video na 1200 px bez zvuka.');
  const user = (await request('/api/auth/me')).user;
  if (!user || String(user.id) !== String(destination.owner)) throw Error('Prijava se promijenila. Odaberi projekat i skriptu za trenutni račun.');
  if (!destination.project || !destination.script) throw Error('Odaberi projekat i skriptu za galeriju.');
  const scripts = await request('/api/scripts');
  if (!(Array.isArray(scripts) ? scripts : scripts.results).some(s => s.id === destination.script && s.project === destination.project)) throw Error('Odabrana skripta više nije dostupna u projektu.');
  const {assets} = await request(`/api/projects/${destination.project}/assets`);
  const previous = assets.find(a => a.metadata?.effectcraftOutputId === output.id && a.metadata?.effectcraftRecipe === recipe && a.metadata?.effectcraftSpeed === output.processing.speed && a.metadata?.scriptId === destination.script);
  if (previous) return previous;
  const token = await request('/api/auth/csrf');
  // Recheck the owner immediately before upload, after the listing/CSRF requests.
  const check = (await request('/api/auth/me')).user;
  if (!check || String(check.id) !== String(destination.owner)) throw Error('Prijava se promijenila. Ponovo odaberi odredište.');
  const form = new FormData(); form.append('file', output.processedBlob, output.processing.name);
  form.append('metadata', JSON.stringify({gallery: true, purpose: 'video', scriptId: destination.script, effectcraftOutputId: output.id, effectcraftRecipe: recipe, effectcraftSpeed: output.processing.speed}));
  return request(`/api/projects/${destination.project}/assets`, {method: 'POST', headers: {'X-CSRFToken': token.csrfToken}, body: form});
}
export const saveToGallery = gallery;
function encode(blob, speed, progress) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./media-worker.js', import.meta.url), {type: 'module'});
    const timer = setTimeout(() => {worker.terminate(); reject(Error('Obrada je trajala predugo. Original je sačuvan; pokušaj ponovo.'));}, 15 * 60 * 1000);
    const stop = () => {clearTimeout(timer); worker.terminate();};
    worker.onmessage = ({data}) => {
      if (data.type === 'progress') progress(data.value);
      if (data.type === 'ready') {stop(); resolve(data.result);}
      if (data.type === 'error') {stop(); reject(Error(data.error));}
    };
    worker.onerror = () => {stop(); reject(Error('Obrada nije završena. Original je sačuvan. Pokušaj noviji Chrome ili Edge.'));};
    worker.postMessage({blob, speed});
  });
}
export async function processOutput(id, options = {}) {
  if (!navigator.locks) throw Error('Za pouzdan red obrade koristi noviji Chrome ili Edge.');
  return navigator.locks.request('effectcraft-output-' + id, {ifAvailable: true}, async lock => {
    if (!lock) return;
    const pref = {...settings(), ...options, autoGallery: false};
    if (!speedValid(pref.speed)) throw Error('Odaberi brzinu od 0,1 do 3×.');
    let output = await getOutput(id);
    if (!output || !isVideo(output)) return;
    const matches = output.processedBlob?.size && output.processing?.status === 'ready' && output.processing.speed === pref.speed && output.processing.recipe === recipe;
    if (!matches || options.force) {
      await patchOutput(id, {processingRequest: {speed: pref.speed, autoGallery: pref.autoGallery, autoDownload: pref.autoDownload, owner: pref.owner, project: pref.project, script: pref.script}, processing: {status: 'queued', speed: pref.speed, recipe, progress: 0}});
      await navigator.locks.request('effectcraft-video-encode', async () => {
        await patchOutput(id, {processing: {status: 'processing', speed: pref.speed, recipe, progress: 0}});
        let last = 0, updates = Promise.resolve();
        try {
          const result = await encode(output.blob, pref.speed, value => {
            if (Date.now() - last < 300 && value < 100) return; last = Date.now();
            updates = updates.then(() => patchOutput(id, {processing: {status: 'processing', speed: pref.speed, recipe, progress: value}}));
          });
          await updates;
          const name = effectName(output.name);
          output = await patchOutput(id, {processedBlob: result.blob, processedAssetId: null, galleryError: '', folderError: '', folderSave: null, processing: {...result, blob: undefined, status: 'ready', recipe, name, progress: 100, completed: Date.now()}});
        } catch (error) {
          await updates.catch(() => {});
          await patchOutput(id, {processing: {status: 'failed', speed: pref.speed, recipe, error: String(error.message || error)}});
          throw error;
        }
      });
    }
    if (pref.autoDownload) {
      try {await savePrepared(id, {owner: pref.owner, automatic: true});}
      catch (error) {await patchOutput(id, {folderError: error.message || 'Spremanje u folder nije uspjelo.'});}
      output = await getOutput(id);
    }
    return output;
  });
}
export async function queueAutomatic(id) {
  const pref = settings(), output = await getOutput(id);
  if (!pref?.autoProcess || !output || !isVideo(output) || output.created < pref.enabledAt) return;
  // Failed/ready entries are retried explicitly; broadcasts never start a retry loop.
  if (output.processing?.status) return;
  return processOutput(id, pref);
}
