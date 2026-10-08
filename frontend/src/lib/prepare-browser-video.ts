import { apiFetch, csrfToken } from './api';
const preparedFiles=new WeakMap<File,File>();
export const preparedBrowserFile=(file:File)=>preparedFiles.get(file)||file;
export type VideoPreparationProgress = { label: string; percent: number | null };

export function prepareBrowserVideo(file: File, signal: AbortSignal, onProgress: (progress: VideoPreparationProgress) => void): Promise<File> {
 return requestPreparedVideo(file,signal,onProgress,false);
}
// Kept out of preparedFiles: export callers can never retrieve a preview through preparedBrowserFile.
export function prepareEditingPreview(file: File, signal: AbortSignal, onProgress: (progress: VideoPreparationProgress) => void, height:720|1080=720): Promise<File> {
 return requestPreparedVideo(file,signal,onProgress,true,height);
}
async function requestPreparedVideo(file: File, signal: AbortSignal, onProgress: (progress: VideoPreparationProgress) => void, preview: boolean, height:720|1080=720): Promise<File> {
  const key = crypto.randomUUID();
  const endpoint = `/api/media/prepare/${key}`;
  const token = await csrfToken();
  signal.throwIfAborted();
  const xhr = new XMLHttpRequest();
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    xhr.abort();
    void apiFetch(endpoint, {method:'DELETE', keepalive:true}).catch(() => {});
  };
  signal.addEventListener('abort', cancel, {once:true});
  async function poll() {
    try {
      const response = await apiFetch(endpoint, {signal: AbortSignal.any([signal, AbortSignal.timeout(5000)])});
      if (response.ok && !finished && !signal.aborted) {
        const status = await response.json();
        if (status.state === 'converting') onProgress({label:'Priprema videa za prikaz',percent:status.progress});
        if (status.state === 'ready') onProgress({label:'Preuzimanje pripremljenog videa',percent:null});
      }
    } catch { /* The upload request reports failures; missed heartbeats stop abandoned work. */ }
    if (!finished && !signal.aborted) timer = setTimeout(() => void poll(), 1500);
  }
  try {
    return await new Promise<File>((resolve, reject) => {
      xhr.open('POST', `/api/media/prepare?job=${key}${preview?'&purpose=editing-preview&height='+height:''}`);
      xhr.setRequestHeader('X-CSRFToken', token);
      xhr.responseType = 'blob';
      xhr.timeout = 660000;
      xhr.upload.onprogress = event => onProgress({label:'Učitavanje videa',percent:event.lengthComputable ? Math.round(event.loaded/event.total*100) : null});
      xhr.upload.onload = () => onProgress({label:'Priprema videa za prikaz',percent:null});
      xhr.onprogress = event => onProgress({label:'Preuzimanje pripremljenog videa',percent:event.lengthComputable ? Math.round(event.loaded/event.total*100) : null});
      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {const prepared=new File([xhr.response], file.name.replace(/\.[^.]+$/, '') + (preview?'-preview-'+height+'.mp4':'-edita.mp4'), {type:'video/mp4'});if(!preview)preparedFiles.set(file,prepared);resolve(prepared);}
        else {
          let message = 'Priprema videa nije uspjela. Pokušaj ponovo.';
          try { message = JSON.parse(await (xhr.response as Blob).text()).error || message; } catch { /* Keep useful fallback. */ }
          reject(new Error(message));
        }
      };
      xhr.onerror = () => reject(new Error('Veza je prekinuta. Priprema je zaustavljena; pokušaj ponovo.'));
      xhr.ontimeout = () => reject(new Error('Priprema traje predugo i zaustavljena je. Pokušaj kraći video.'));
      xhr.onabort = () => reject(new DOMException('Priprema prekinuta', 'AbortError'));
      const body = new FormData(); body.append('file', file);
      xhr.send(body);
      void poll();
    });
  } finally {
    finished = true;
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
    // Also closes the server job after a network error or a completed download.
    void apiFetch(endpoint, {method:'DELETE',keepalive:true}).catch(() => {});
  }
}
