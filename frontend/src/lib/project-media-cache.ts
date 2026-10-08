// Immutable asset IDs are cached only after the authenticated project lookup.
const CACHE = 'edita-project-media-v1';
const LIMIT = 400 * 1024 * 1024;
const key = (user: string, id: string) => `${location.origin}/__edita-media-cache/${encodeURIComponent(user)}/${id}`;

export async function cachedMedia(user: string, id: string): Promise<Blob | null> {
  try { return await (await (await caches.open(CACHE)).match(key(user, id)))?.blob() ?? null; }
  catch { return null; }
}

export async function cacheMedia(user: string, id: string, file: Blob) {
  if (file.size > 150 * 1024 * 1024) return;
  try {
    const cache = await caches.open(CACHE);
    const entries = await cache.keys();
    let total = file.size;
    for (let index = entries.length - 1; index >= 0; index--) {
      const response = await cache.match(entries[index]);
      total += Number(response?.headers.get('x-edita-size') || 0);
      if (total > LIMIT) await cache.delete(entries[index]);
    }
    await cache.put(key(user, id), new Response(file, {headers:{'Content-Type':file.type,'x-edita-size':String(file.size)}}));
  } catch { /* Storage quota or private browsing: the cloud copy remains available. */ }
}
