const key = (userId: number) => `edita:recent-projects:${userId}`;
export function recentProjectIds(userId: number): string[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(key(userId)) || '[]'); return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(0, 10) : []; }
  catch { return []; }
}
export function rememberProject(userId: number, id: string) {
  try { localStorage.setItem(key(userId), JSON.stringify([id, ...recentProjectIds(userId).filter(item => item !== id)].slice(0, 10))); } catch { /* History is optional when browser storage is unavailable. */ }
  window.dispatchEvent(new Event('projects-changed'));
}
export function forgetProject(userId: number, id: string) {
  try { localStorage.setItem(key(userId), JSON.stringify(recentProjectIds(userId).filter(item => item !== id))); } catch { /* Saving projects does not depend on local history. */ }
}
