import {useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {useAuth} from '../context/auth-context';
import {apiJson,resetCsrf} from '../lib/api';
import {StudioIcon} from './StudioIcon/StudioIcon';

/** Shared account navigation for the workspace and both editors. */
export function AccountMenu(){
 const {session,refresh}=useAuth();
 const {pathname,search}=useLocation();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function signOut(){setBusy(true);setError('');try{await apiJson('/api/auth/logout',{method:'POST'});resetCsrf();await refresh();}catch{setError('Odjava nije uspjela. Pokušaj ponovo.');}finally{setBusy(false);}}
 return <details className="klipanje-account">
  <summary aria-label={'Korisnički meni: '+session.user?.username}><span className="klipanje-user-avatar">{session.user?.name.slice(0,1)}</span><span className="klipanje-user-name">{session.user?.name}</span><StudioIcon name="chevron"/></summary>
  <div onClick={event=>{if((event.target as HTMLElement).closest('a'))event.currentTarget.closest('details')?.removeAttribute('open');}}>
   <strong>@{session.user?.username}</strong>
   {session.user?.isStaff&&<Link to="/administracija">Administracija</Link>}
   <Link to={pathname==='/videa'?pathname+search:'/videa?saved=1'} onClick={event=>{if(pathname==='/videa'){event.preventDefault();window.dispatchEvent(new Event('klipanje-saved-videos'));}}}>Spremljeni videi</Link>
   <Link to="/promjena-lozinke">Promijeni lozinku</Link>
   <button onClick={()=>void signOut()} disabled={busy}>{busy?'Odjava…':'Odjavi se'}</button>
   {error&&<p role="alert">{error}</p>}
  </div>
 </details>;
}
