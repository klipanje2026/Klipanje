import { useEffect, useRef, useState } from 'react';
import { apiJson } from '../lib/api';
import { StudioIcon } from './StudioIcon/StudioIcon';

export type ProjectKind = 'video' | 'subtitles';
type SavedProject = { id: string; name: string; kind: ProjectKind; updated_at: string; state?: { version?: number; data?: { videoName?: string; assets?: { name: string }[] } } };
export function ProjectPicker({ kind, onClose }: { kind: ProjectKind; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { previous?.focus(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void apiJson<SavedProject[]>(`/api/projects?kind=${kind}`, { signal: controller.signal })
      .then(items => { setProjects(items.filter(item => item.kind === kind && item.state?.version === 1).sort((a, b) => b.updated_at.localeCompare(a.updated_at))); setError(''); })
      .catch(() => { if (!controller.signal.aborted) setError('Projekte nije moguće učitati.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [kind, retry]);
  const filtered = projects.filter(item => `${item.name} ${item.state?.data?.videoName || ''} ${item.state?.data?.assets?.map(asset => asset.name).join(' ') || ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <dialog className="editor-project-picker" ref={dialog} aria-labelledby="project-picker-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header><div><h2 id="project-picker-title">{kind === 'video' ? 'Video projekti' : 'Projekti titlova'}</h2><p>Odaberi spremljeni projekat i nastavi od posljednjih izmjena.</p></div><button type="button" aria-label="Zatvori spremljene projekte" onClick={onClose}><StudioIcon name="close" /></button></header>
    <input autoFocus aria-label="Pretraži spremljene projekte" placeholder="Traži projekat ili video…" value={search} onChange={event => setSearch(event.target.value)} />
    <div className="editor-project-picker-list">
      {loading ? <p role="status">Učitavanje projekata…</p> : error ? <p role="alert">{error} <button onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Pokušaj ponovo</button></p> : filtered.length ? filtered.map(project => <a key={project.id} href={`${kind === 'video' ? '/video-editor' : '/titlovi'}?project=${encodeURIComponent(project.id)}`}>
        <span className="editor-project-picker-icon"><StudioIcon name={kind === 'video' ? 'video' : 'captions'} /></span>
        <span><strong>{project.name}</strong><small>{project.state?.data?.videoName || project.state?.data?.assets?.[0]?.name || 'Spremljena montaža'} · {new Date(project.updated_at).toLocaleDateString('bs-BA')}</small></span><StudioIcon name="arrow" />
      </a>) : <p>{search ? 'Nema projekata za ovu pretragu.' : 'Još nema spremljenih projekata ove vrste.'}</p>}
    </div>
  </dialog>;
}
