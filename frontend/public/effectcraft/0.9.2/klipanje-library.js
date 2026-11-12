// Private local output library. Separate from EffectCraft's session/project storage.
export function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('klipanje-effectcraft-outputs', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('outputs', {keyPath: 'id'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transaction(mode, operation) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('outputs', mode);
      const request = operation(tx.objectStore('outputs'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Spremanje je prekinuto.'));
    });
  } finally { db.close(); }
}
export const listOutputs = () => transaction('readonly', store => store.getAll());
export const putOutput = value => transaction('readwrite', store => store.put(value));
export const removeOutput = id => transaction('readwrite', store => store.delete(id));
export function mediaType(name) {
  const extension = name.split('.').pop().toLowerCase();
  return ({mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',ecproj:'application/json',zip:'application/zip'})[extension] || 'application/octet-stream';
}
