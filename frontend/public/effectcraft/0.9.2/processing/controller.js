import {savePrepared} from './folder.js';
import {announce, getOutput, watch} from './store.js';
import {queueAutomatic} from './pipeline.js';

const link = document.createElement('a');
link.href = new URL('./index.html', import.meta.url).href; link.target = '_blank'; link.rel = 'noopener';
link.textContent = 'Prilagodi i spremi';
link.style.cssText = 'position:fixed;right:14px;top:12px;z-index:10000;padding:9px 13px;background:#fff9f5;color:#202633;border:1px solid #d88875;border-radius:7px;font:13px system-ui;text-decoration:none;box-shadow:0 2px 10px #0002';
document.body.append(link);
async function changed(id) {
  if (!id) return;
  const output = await getOutput(id);
  if (!output) return;
  if (window.parent !== window) window.parent.postMessage({type: 'effectcraft-processing', id}, location.origin);
  if (output.processing?.status === 'ready' && output.processedBlob) {
    let notice = document.getElementById('effectcraft-processed-download');
    if (!notice) {notice = document.createElement('button'); notice.id = 'effectcraft-processed-download'; notice.style.cssText = link.style.cssText + ';top:auto;bottom:20px'; document.body.append(notice);}
    notice.textContent = output.folderSave?.completed === output.processing.completed ? 'Video spremljen u odabrani folder' : 'Spremi obrađeni video u folder';
    notice.onclick = async () => {
      notice.disabled = true;
      try {const result = await savePrepared(id); notice.textContent = 'Spremljeno · ' + result.filename;}
      catch (error) {notice.textContent = error.message + ' Otvori Prilagodi i spremi.';}
      finally {notice.disabled = false;}
    };
  }
  void queueAutomatic(id).catch(() => {});
}
watch(id => {void changed(id);});
window.addEventListener('effectcraft-captured', event => {announce(event.detail); void changed(event.detail);});
