import {listOutputs, putOutput, settings, saveSettings, watch, download, isVideo, speedValid} from './store.js';
import {currentUser, processOutput, queueAutomatic} from './pipeline.js';
import {folderState, chooseFolder, savePrepared} from './folder.js';
import {effectName} from './names.js';

const $ = id => document.getElementById(id), rows = new Map(), busy = new Set(), selections = new Map();
let owner = '', pref = settings(), timer, loading = false;
let directory = {directory: '', available: false};
const params = new URLSearchParams(location.search);
const notice = message => {$('notice').textContent = message; $('notice').hidden = !message;};
const bytes = value => `${(value / 1024 / 1024).toFixed(2)} MB`;

function save() {
  const speed = Number($('speed').value);
  if (!speedValid(speed)) {notice('Odaberi brzinu od 0,1 do 3×.'); return null;}
  pref = {speed, owner, autoProcess: $('autoProcess').checked, autoGallery: false, autoDownload: $('autoDownload').checked, enabledAt: pref?.enabledAt || Date.now()};
  saveSettings(pref);
  return pref;
}
function showFolder() {
  $('folderPath').textContent = directory.directory || 'Folder još nije odabran.';
  $('folderHint').textContent = directory.available ? 'Gotovi MP4 videi spremaju se direktno u ovaj folder.' : directory.directory ? 'Folder trenutno nije dostupan. Odaberi dostupan folder.' : 'Odabrani folder pamti se za sljedeće videe.';
  $('chooseFolder').textContent = directory.directory ? 'Promijeni folder' : 'Odaberi folder';
}
async function connect() {
  const user = await currentUser();
  owner = user ? String(user.id) : '';
  $('login').hidden = !!owner;
  if (pref) {
    for (const key of ['autoProcess', 'autoDownload']) $(key).checked = pref[key] !== false;
    $('speed').value = String(pref.speed);
  }
  save();
  directory = owner ? await folderState() : {directory: '', available: false};
  showFolder();
}
function createRow(output) {
  const article = document.createElement('article');
  article.className = 'output';
  article.dataset.id = output.id;
  article.innerHTML = '<div class="preview"><span>Obradi video za pregled</span><video controls playsinline preload="none" hidden></video></div><div class="details"><h3></h3><div class="status"></div><div class="stats"></div><progress max="100" value="0" hidden></progress><div class="row-controls"><label>Brzina ovog videa<input type="number" min="0.1" max="3" step="0.1" list="speeds"></label><button class="primary" data-action="process">Obradi video</button><button data-action="download">Spremi u folder</button></div><div class="row-actions"><button data-action="original">Preuzmi original</button></div><div class="error"></div><div class="saved-path"></div></div>';
  const speed = article.querySelector('input');
  speed.value = String(output.processing?.speed || pref?.speed || 1);
  speed.onchange = () => selections.set(output.id, Number(speed.value));
  article.onclick = async event => {
    const action = event.target.closest('button')?.dataset.action;
    if (!action || busy.has(output.id)) return;
    const current = (await listOutputs()).find(o => o.id === output.id);
    if (!current) return;
    if (action === 'original') return download(current.blob, current.name);
    const prefs = save();
    if (!prefs) return;
    const rate = Number(speed.value);
    if (action === 'process' && !speedValid(rate)) return notice('Odaberi brzinu od 0,1 do 3×.');
    busy.add(output.id);
    await refresh();
    try {
      if (action === 'download') {
        const result = await savePrepared(output.id, {owner});
        notice('Spremljeno u ' + result.path);
      } else {
        const result = await processOutput(output.id, {...prefs, speed: rate});
        if (result?.folderSave?.completed === result?.processing?.completed) notice('Spremljeno u ' + result.folderSave.path);
        else if (result?.folderError) notice(result.folderError);
      }
    } catch (error) {notice(error.message || 'Obrada nije uspjela.');}
    finally {busy.delete(output.id); await refresh();}
  };
  $('outputs').append(article);
  rows.set(output.id, {article});
  return rows.get(output.id);
}
function updateRow(output) {
  const row = rows.get(output.id) || createRow(output), {article} = row, p = output.processing || {};
  const working = ['processing', 'queued'].includes(p.status) || busy.has(output.id);
  const ready = p.status === 'ready' && output.processedBlob;
  const saved = ready && output.folderSave?.completed === p.completed && output.folderSave?.owner === owner;
  article.querySelector('h3').textContent = ready ? effectName(output.name) : output.name;
  article.querySelector('.status').textContent = p.status === 'queued' ? 'Čeka obradu…' : p.status === 'processing' ? `Obrađujem… ${p.progress || 0}%` : ready ? `✓ Do 1200 px · bez zvuka · ${p.speed}×${saved ? ' · spremljeno u folder' : ''}` : p.status === 'failed' ? 'Obrada nije završena. Original je sačuvan.' : 'Original · spremno za obradu';
  article.querySelector('.stats').textContent = ready ? `${p.width} × ${p.height} · ${p.duration.toLocaleString('bs-BA', {maximumFractionDigits: 2})} s · ${bytes(output.blob.size)} → ${bytes(output.processedBlob.size)}` : bytes(output.blob.size);
  article.querySelector('.error').textContent = p.error || output.folderError || '';
  article.querySelector('.saved-path').textContent = saved ? output.folderSave.path : '';
  const progress = article.querySelector('progress');
  progress.hidden = !working;
  progress.value = p.progress || 0;
  const input = article.querySelector('input');
  input.disabled = working;
  if (document.activeElement !== input) input.value = String(selections.get(output.id) || p.speed || pref?.speed || 1);
  const process = article.querySelector('[data-action=process]');
  process.disabled = working;
  process.textContent = working ? 'Obrađujem…' : p.status === 'failed' ? 'Ponovi obradu' : pref?.autoDownload ? 'Obradi i spremi' : 'Obradi video';
  article.querySelector('[data-action=download]').disabled = !ready || working;
  if (ready && row.completed !== p.completed) {
    if (row.url) URL.revokeObjectURL(row.url);
    row.url = URL.createObjectURL(output.processedBlob);
    row.completed = p.completed;
    const video = article.querySelector('video');
    video.src = row.url;
    video.hidden = false;
    article.querySelector('.preview span').hidden = true;
  }
}
async function refresh() {
  if (loading) return;
  loading = true;
  try {
    const outputs = (await listOutputs()).filter(isVideo).sort((a, b) => b.created - a.created);
    $('empty').hidden = !!outputs.length;
    for (const [index, output] of outputs.entries()) {
      updateRow(output);
      const article = rows.get(output.id).article, target = $('outputs').children[index];
      if (article !== target) $('outputs').insertBefore(article, target || null);
    }
    for (const [id, row] of rows) if (!outputs.some(o => o.id === id)) {
      row.article.remove();
      if (row.url) URL.revokeObjectURL(row.url);
      rows.delete(id);
    }
  } catch (error) {notice(error.message);}
  finally {loading = false;}
}
watch(id => {
  clearTimeout(timer);
  timer = setTimeout(() => void refresh(), 100);
  if (id) void queueAutomatic(id).catch(e => notice(e.message));
});
for (const key of ['speed', 'autoProcess', 'autoDownload']) $(key).onchange = () => {save(); void refresh();};
$('chooseFolder').onclick = async () => {
  $('chooseFolder').disabled = true;
  $('folderMessage').textContent = 'Odaberi folder u otvorenom prozoru.';
  try {
    directory = await chooseFolder();
    showFolder();
    $('folderMessage').textContent = directory.cancelled ? 'Odabir je zatvoren.' : 'Folder je spremljen za sljedeće videe.';
  } catch (error) {$('folderMessage').textContent = error.message;}
  finally {$('chooseFolder').disabled = false;}
};
$('refresh').onclick = () => void connect().then(refresh).catch(e => notice(e.message));
$('import').onclick = () => $('files').click();
$('files').onchange = async event => {
  const prefs = save();
  if (!prefs) return;
  for (const file of event.target.files) {
    if ((!file.type.startsWith('video/') && !/\.(mp4|mov|webm|m4v)$/i.test(file.name)) || !file.size || file.size > 500e6) {notice('Odaberi video do 500 MB.'); continue;}
    const output = {id: crypto.randomUUID(), name: file.name, blob: file.slice(0, file.size, file.type || 'video/mp4'), created: Date.now()};
    await putOutput(output);
    void processOutput(output.id, prefs).catch(e => notice(e.message));
  }
  event.target.value = '';
  await refresh();
};
function theme(value) {
  document.documentElement.dataset.theme = value;
  $('theme').textContent = value === 'dark' ? 'Svijetla tema' : 'Tamna tema';
  localStorage.setItem('klipanje-effectcraft-theme', value);
}
$('theme').onclick = () => theme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
theme(localStorage.getItem('klipanje-effectcraft-theme') === 'dark' ? 'dark' : 'light');
try {
  await connect();
  await refresh();
  for (const output of await listOutputs()) {
    if (['queued', 'processing'].includes(output.processing?.status) && output.processingRequest) void processOutput(output.id, output.processingRequest).catch(e => notice(e.message));
    else if (!output.processing?.status) void queueAutomatic(output.id).catch(e => notice(e.message));
  }
  if (params.get('output')) rows.get(params.get('output'))?.article.scrollIntoView();
} catch (error) {notice(error.message); await refresh();}
