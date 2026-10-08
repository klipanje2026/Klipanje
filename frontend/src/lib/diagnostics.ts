type Failure = { at: string; route: string; kind: string; status?: number; requestId?: string; durationMs: number };
const failures: Failure[] = [];

export function recordFailure(path: string, kind: string, started: number, response?: Response) {
  // Never record URL queries, dynamic IDs, payloads, cookies or raw error messages.
  const known = ['/api/auth/me', '/api/auth/csrf', '/api/health'];
  const route = known.includes(path) ? path : '/api/[request]';
  const requestId = response?.headers.get('X-Request-ID') ?? undefined;
  const safeId = requestId && /^[a-f0-9]{32}$/.test(requestId) ? requestId : undefined;
  const item: Failure = { at: new Date().toISOString(), route, kind,
    durationMs: Math.round(performance.now() - started), status: response?.status, requestId: safeId };
  if(path!=="/api/editor/diagnostics"&&path!=="/api/auth/csrf")reportEditorFailure("request",response?.status);
  failures.push(item);
  if (failures.length > 30) failures.shift();
  console.error('[Edita diagnostics]', item);
}

const mediaFailures: {at:string;errorCode:number|null;readyState:number;networkState:number;width:number;height:number;time:number;h264:string;hevc:string;webm:string}[] = [];
export function recordMediaFailure(media: HTMLVideoElement) {
  // Media capabilities and numeric state only: no file names, URLs or media content.
  const item = {at:new Date().toISOString(),errorCode:media.error?.code ?? null,
    readyState:media.readyState,networkState:media.networkState,width:media.videoWidth,height:media.videoHeight,
    time:media.currentTime,h264:media.canPlayType('video/mp4; codecs="avc1.42E01E"'),
    hevc:media.canPlayType('video/mp4; codecs="hvc1"'),webm:media.canPlayType('video/webm; codecs="vp9"')};
  reportEditorFailure("video",media.error?.code);
  mediaFailures.push(item);if(mediaFailures.length>10)mediaFailures.shift();
  console.warn('[Edita video diagnostics]', JSON.stringify(item));
}
export function downloadDiagnostics() {
  const blob = new Blob([JSON.stringify({ version: 1, online: navigator.onLine,
    secureContext: window.isSecureContext, failures, mediaFailures }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = 'edita-dijagnostika.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

let lastReport=0;
export function reportEditorFailure(kind:string,code?:number) {
 if(Date.now()-lastReport<30000)return;
 lastReport=Date.now();
 // Raw fetch prevents diagnostics failures from recursively reporting themselves.
 void import('./api').then(async({csrfToken})=>fetch('/api/editor/diagnostics',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRFToken':await csrfToken()},body:JSON.stringify({kind,code})})).catch(()=>{});
}
