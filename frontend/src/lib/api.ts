export class ApiError extends Error { constructor(message:string,public status:number){super(message);this.name='ApiError';} }
import { recordFailure } from './diagnostics';
async function diagnosticFetch(path: string, init: RequestInit = {}) {
  const started = performance.now();
  let response: Response;
  try { response = await fetch(path, { ...init, credentials: 'same-origin' }); }
  catch (error) {
    recordFailure(path, 'network_or_tls_or_cors', started);
    throw error;
  }
  if (!response.ok) recordFailure(path, 'http_error', started, response);
  return response;
}
let csrf: string | undefined;
let pending: Promise<string> | undefined;
export async function csrfToken() {
  if (csrf) return csrf;
  pending ??= diagnosticFetch('/api/auth/csrf')
    .then(async (response) => {
      if (!response.ok) throw new Error('Trenutno se ne možemo povezati s Editom. Pokušaj ponovo za nekoliko trenutaka.');
      return (await response.json()).csrfToken as string;
    }).finally(() => { pending = undefined; });
  csrf = await pending;
  return csrf;
}
export function resetCsrf() { csrf = undefined; }
export async function apiFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  try{if(localStorage.getItem('edita-product-analytics')==='yes')headers.set('X-Product-Analytics','1');}catch{/* optional */}
  if ((input==='/api/narration'||input.startsWith('/api/voice-change'))&&!headers.has('X-Operation-Id')) headers.set('X-Operation-Id',crypto.randomUUID());
  if (!['GET', 'HEAD', 'OPTIONS'].includes((init.method ?? 'GET').toUpperCase())) headers.set('X-CSRFToken', await csrfToken());
  return diagnosticFetch(input, { ...init, headers });
}
export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init);
  let data;
  try { data = await response.json(); }
  catch {
    recordFailure(path, 'invalid_json_response', performance.now(), response);
    throw new Error('Trenutno ne možemo učitati podatke. Pokušaj ponovo za nekoliko trenutaka.');
  }
  if (!response.ok) {
    const detail=data.error||data.detail||Object.values(data).flat().join(' ');
    throw new ApiError(typeof detail==='string'?detail:'Zahtjev nije uspio. Pokušaj ponovo.',response.status);
  }
  return data as T;
}
