const databaseName = 'klipanje-effectcraft-outputs';
export const recipe = '1200-silent-v1';
export const channelName = 'klipanje-effectcraft-processing';
export const settingsKey = 'klipanje-effectcraft-processing-v1';
export const isVideo = output => output?.blob?.type?.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(output?.name || '');
export const speedValid = value => typeof value === 'number' && Number.isFinite(value) && value >= .1 && value <= 3;
function database() {return new Promise((resolve, reject) => {
  const request = indexedDB.open(databaseName, 1);
  request.onupgradeneeded = () => request.result.createObjectStore('outputs', {keyPath: 'id'});
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});}
async function transact(mode, action) {
  const db = await database();
  try {return await new Promise((resolve, reject) => {
    const tx = db.transaction('outputs', mode), result = action(tx.objectStore('outputs'));
    tx.oncomplete = () => resolve(typeof result === 'function' ? result() : result.result);
    tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || Error('Spremanje nije završeno.'));
  });} finally {db.close();}
}
export const listOutputs = () => transact('readonly', store => store.getAll());
export const getOutput = id => transact('readonly', store => store.get(id));
export function announce(id) {
  window.dispatchEvent(new CustomEvent(channelName, {detail: {id}}));
  if (typeof BroadcastChannel !== 'undefined') {const c = new BroadcastChannel(channelName); c.postMessage({id}); c.close();}
}
export async function putOutput(output) {await transact('readwrite', store => store.put(output)); announce(output.id);}
export async function patchOutput(id, patch) {
  let next;
  await transact('readwrite', store => {
    const r = store.get(id); r.onsuccess = () => {if (!r.result) return; next = {...r.result, ...patch}; store.put(next);};
    return () => next;
  });
  announce(id); return next;
}
export function settings() {
  try {const v = JSON.parse(localStorage.getItem(settingsKey)); return v && speedValid(v.speed) ? {...v, autoGallery: false} : null;} catch {return null;}
}
export function saveSettings(value) {localStorage.setItem(settingsKey, JSON.stringify(value));}
export function watch(callback) {
  const listener = event => callback(event.detail?.id || event.data?.id);
  window.addEventListener(channelName, listener);
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(channelName) : null;
  if (channel) channel.onmessage = listener;
  return () => {window.removeEventListener(channelName, listener); channel?.close();};
}
export function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}
