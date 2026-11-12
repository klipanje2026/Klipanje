import './processing/controller.js';
import {putOutput, mediaType} from './klipanje-library.js';

// Only the WASM host's download hook calls this; regular browser downloads are unchanged.
window.klipanjeCaptureDownload = (url, name) => {
  if (!url.startsWith('blob:')) return;
  // Begin reading before the engine revokes its object URL.
  const bytes = fetch(url).then(response => response.blob());
  void bytes.then(async blob => {
    const output = {id:crypto.randomUUID(), name:name.replace(/[\\/:*?"<>|]/g, '-'),
      blob:new Blob([blob], {type:mediaType(name)}), created:Date.now()};
    await putOutput(output);
    window.dispatchEvent(new CustomEvent('effectcraft-captured', {detail:output.id}));
    if (window.parent !== window) window.parent.postMessage({type:'effectcraft-output', id:output.id}, location.origin);
    else showNotice('Izvoz je sačuvan. Otvori Slike s pokretima u Klipanju za preuzimanje i uvoz.');
  }).catch(error => {
    if (window.parent !== window) window.parent.postMessage({type:'effectcraft-output-error', message:String(error)}, location.origin);
    else showNotice('Lokalna biblioteka nije spremljena. Sačuvaj preuzetu datoteku iz preglednika.');
  });
};
function showNotice(text) {
  let notice = document.getElementById('klipanje-output-notice');
  if (!notice) {
    notice = document.createElement('a'); notice.id = 'klipanje-output-notice';
    notice.href = '/slike-s-pokretima'; notice.target = '_blank';
    notice.style.cssText = 'position:fixed;bottom:24px;left:24px;max-width:440px;padding:16px;background:#fff9f5;color:#202633;border:1px solid #ff6b5b;border-radius:8px;font:14px system-ui;z-index:10000';
    document.body.append(notice);
  }
  notice.textContent = text;
}
let ready = false;
let theme = 'light';
async function applyTheme() {
  if (!ready) return;
  try {
    await window.effectcraft.request('ui.set', {theme});
    if (window.parent !== window) window.parent.postMessage({type:'effectcraft-themed', theme}, location.origin);
  } catch (error) { console.warn('EffectCraft theme:', error); }
}
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'klipanje-effectcraft-theme') return;
  theme = event.data.theme === 'dark' ? 'dark' : 'light';
  void applyTheme();
});
window.addEventListener('effectcraft-ready', () => {
  ready = true;
  try { theme = localStorage.getItem('klipanje-effectcraft-theme') === 'dark' ? 'dark' : 'light'; } catch { /* Session default. */ }
  void applyTheme();
  if (window.parent !== window) window.parent.postMessage({type:'effectcraft-ready'}, location.origin);
});
