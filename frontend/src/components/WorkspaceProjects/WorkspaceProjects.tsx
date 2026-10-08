import { confirmDelete } from '../../lib/confirm-delete';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { apiFetch, apiJson } from '../../lib/api';
import { forgetProject, recentProjectIds } from '../../lib/recent-projects';
import { StudioIcon } from '../StudioIcon/StudioIcon';
type Project = { id: string; name: string; kind: string; updated_at: string };
const projectUrl = (project: Project) => `${project.kind === 'video' ? '/video-editor' : '/titlovi'}?project=${encodeURIComponent(project.id)}`;
export function WorkspaceProjects() {
  const { session } = useAuth();
  const location = useLocation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<'saved' | 'recent' | null>(null);
  const [deleting, setDeleting] = useState('');
  const [selected,setSelected]=useState<string[]>([]);
  const [selecting,setSelecting]=useState(false);
  const userId = session.user?.id;
  useEffect(() => {
    let active = true;
    const load = () => { void apiJson<Project[]>('/api/projects').then(items => {
      if (!active) return;
      setProjects(items.sort((a,b) => b.updated_at.localeCompare(a.updated_at)));
      setHistory(userId ? recentProjectIds(userId) : []);setSelected(ids=>ids.filter(id=>items.some(p=>p.id===id)));
    }).catch(() => { if (active) setError('Projekte nije moguće učitati.'); }).finally(() => { if (active) setLoading(false); }); };
    load(); window.addEventListener('projects-changed', load);
    return () => { active = false; window.removeEventListener('projects-changed', load); };
  }, [userId]);
  async function remove(project?: Project) {
    const targets=selected.length?projects.filter(p=>selected.includes(p.id)):project?[project]:[];
    if(deleting||!targets.length||!await confirmDelete(`Obrisati ${targets.length} odabranih projekata i njihove datoteke?`))return;
    setDeleting('batch');setError('');const failed:string[]=[];
    for(const target of targets){try{const response=await apiFetch(`/api/projects/${target.id}`,{method:'DELETE'});if(!response.ok)throw new Error();
      if(userId)forgetProject(userId,target.id);setProjects(current=>current.filter(p=>p.id!==target.id));
      window.dispatchEvent(new CustomEvent('project-deleted',{detail:target.id}));
    }catch{failed.push(target.id);}}
    setSelected(failed);setDeleting('');window.dispatchEvent(new Event('projects-changed'));
    if(failed.length)setError(`${failed.length} projekata nije obrisano. Pokušaj ponovo.`);
  }
  const recents = history.flatMap(id => { const project = projects.find(item => item.id === id); return project ? [project] : []; });
  const activeId = new URLSearchParams(location.search).get('project');
  const row = (project: Project, actions: boolean) => <div className={`workspace-project-row${activeId === project.id ? ' active' : ''}`} key={project.id}>
    {actions&&selecting&&<input type="checkbox" aria-label={`Odaberi ${project.name}`} disabled={!!deleting} checked={selected.includes(project.id)} onChange={()=>setSelected(ids=>ids.includes(project.id)?ids.filter(id=>id!==project.id):[...ids,project.id])}/>}
    <a className="workspace-project-main" href={projectUrl(project)} title={project.name}><span className="workspace-project-icon"><StudioIcon name={project.kind === 'video' ? 'video' : 'captions'} /></span><span><strong>{project.name}</strong><small>{project.kind === 'video' ? 'Video studio' : 'Titlovi'}</small></span></a>
    {actions && <div className="workspace-project-actions"><a href={projectUrl(project)} aria-label={`Otvori ${project.name}`} title="Otvori"><StudioIcon name="arrow"/></a><button disabled={Boolean(deleting)} aria-label={`Obriši ${project.name}`} title="Obriši" onClick={() => void remove(project)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/></svg></button></div>}
  </div>;
  return <div className={`workspace-projects${expanded ? ` expanded-${expanded}` : ''}`}>
    <section className="workspace-saved-section"><div className="workspace-project-section-head"><button aria-expanded={expanded === 'saved'} aria-controls="workspace-saved-list" onClick={() => setExpanded(expanded === 'saved' ? null : 'saved')}>Saved <small>{projects.length}</small></button>{<button className="workspace-expand" aria-expanded={expanded === 'saved'} aria-label={expanded === 'saved' ? 'Sakrij spremljene' : 'Prikaži sve spremljene'} onClick={() => setExpanded(expanded === 'saved' ? null : 'saved')}><StudioIcon name="chevron"/></button>}</div>
      {expanded==='saved'&&<div className="workspace-bulk-actions"><button disabled={!!deleting} onClick={()=>{setSelecting(v=>!v);setSelected([]);}}>{selecting?'Završi odabir':'Odaberi više'}</button>{selecting&&<><button disabled={!!deleting} onClick={()=>setSelected(selected.length===projects.length?[]:projects.map(p=>p.id))}>Odaberi sve</button><button disabled={!!deleting||!selected.length} onClick={()=>void remove()}><StudioIcon name="trash"/> {selected.length}</button></>}</div>}
      <div className="workspace-project-list" id="workspace-saved-list" hidden={expanded!=='saved'}>{loading ? <p>Učitavanje…</p> : projects.length ? projects.slice(0, expanded === 'saved' ? undefined : 3).map(project => row(project, true)) : <p>Spremi prvi projekat.<br/>Ovdje čuvamo tvoje ideje.</p>}</div>
    </section>
    <section className="workspace-recent-section"><div className="workspace-project-section-head"><button aria-expanded={expanded === 'recent'} aria-controls="workspace-recent-list" onClick={() => setExpanded(expanded === 'recent' ? null : 'recent')}>Recents</button><button className="workspace-expand" aria-label="Prikaži nedavne projekte" aria-expanded={expanded === 'recent'} aria-controls="workspace-recent-list" onClick={() => setExpanded(expanded === 'recent' ? null : 'recent')}><StudioIcon name="chevron"/></button></div><div className="workspace-project-list" id="workspace-recent-list" hidden={expanded!=='recent'}>{recents.length ? recents.slice(0, expanded === 'recent' ? 10 : 5).map(project => row(project, false)) : <p>Nedavno otvoreni projekti<br/>pojavit će se ovdje.</p>}</div></section>
    {error && <div className="workspace-project-error" role="alert">{error}<button onClick={() => window.dispatchEvent(new Event('projects-changed'))}>Pokušaj ponovo</button></div>}
  </div>;
}
