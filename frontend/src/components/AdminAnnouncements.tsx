import {useEffect, useState} from 'react';
import {apiJson} from '../lib/api';
import {AnnouncementContent, type Announcement} from './Announcements';

export function AdminAnnouncements() {
  const [items,setItems]=useState<Announcement[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[feedback,setFeedback]=useState('');
  const [title,setTitle]=useState(''),[message,setMessage]=useState(''),[tone,setTone]=useState<Announcement['tone']>('info'),[expires,setExpires]=useState('');
  const [confirm,setConfirm]=useState<string|null>(null);
  async function load(){setLoading(true);try {setItems((await apiJson<{items:Announcement[]}>('/api/admin/announcements')).items);setError('');}catch {setError('Obavijesti nisu učitane. Pokušaj ponovo.');}finally {setLoading(false);}}
  useEffect(()=>{void load();},[]);
  async function create(){
    setBusy(true);setError('');setFeedback('');
    try {const row=await apiJson<Announcement>('/api/admin/announcements',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,message,tone,expires_at:expires?new Date(expires).toISOString():null})});setItems(previous=>[row,...previous]);setTitle('');setMessage('');setExpires('');setFeedback('Nacrt je spremljen. Za prikaz korisnicima odaberi „Objavi svima”.');}
    catch(e){setError(e instanceof Error?e.message:'Nacrt nije spremljen.');}finally {setBusy(false);}
  }
  async function action(item:Announcement,action:'publish'|'hide'){
    setBusy(true);setError('');setFeedback('');
    try {const row=await apiJson<Announcement>(`/api/admin/announcements/${item.id}/action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});setItems(previous=>previous.map(v=>v.id===row.id?row:v));setConfirm(null);setFeedback(action==='publish'?'Obavijest je objavljena. Korisnicima se prikazuje unutar 30 sekundi.':'Obavijest je povučena.');window.dispatchEvent(new Event('edita-announcements-updated'));}
    catch(e){setError(e instanceof Error?e.message:'Promjena nije spremljena.');}finally {setBusy(false);}
  }
  return <section className="admin-announcements">
    <header className="admin-section-header"><div><h2>Obavijesti korisnicima</h2><p>Kratka traka na svim stranicama Edite. Svaki korisnik je može zatvoriti.</p></div><button disabled={busy||loading} onClick={()=>void load()}>Osvježi</button></header>
    {error&&<p className="billing-error" role="alert">{error}</p>}{feedback&&<p className="announcement-feedback" role="status">{feedback}</p>}
    <div className="announcement-compose"><form onSubmit={e=>{e.preventDefault();void create();}}>
      <h3>Nova obavijest</h3>
      <label>Naslov<input required maxLength={100} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Šta je novo u Editi?"/></label>
      <label>Poruka<textarea required maxLength={400} rows={3} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Napiši kratku poruku korisnicima…"/><small>{message.length} / 400</small></label>
      <div className="announcement-form-row"><label>Vrsta<select value={tone} onChange={e=>setTone(e.target.value as Announcement['tone'])}><option value="info">Obavijest</option><option value="update">Novost</option><option value="maintenance">Održavanje</option></select></label><label>Prikazuj do · nije obavezno<input type="datetime-local" value={expires} onChange={e=>setExpires(e.target.value)}/></label></div>
      <button disabled={busy||!title.trim()||!message.trim()} type="submit">{busy?'Spremanje…':'Spremi nacrt'}</button>
    </form><div className="announcement-preview"><span>PREGLED IZGLEDA</span><AnnouncementContent item={{title:title||'Naslov obavijesti',message:message||'Ovdje će se prikazati tvoja poruka korisnicima.',tone}} preview/><p>Nacrt vidi samo administracija. Objavljene obavijesti vide svi posjetioci, uključujući stranicu prijave.</p></div></div>
    <h3>Spremljene obavijesti</h3>
    {loading&&<p role="status">Učitavanje…</p>}{!loading&&!items.length&&<p className="announcement-empty">Još nema obavijesti. Pripremi prvu poruku iznad.</p>}
    <div className="announcement-list">{items.map(item=>{const expired=!!item.expires_at&&Date.parse(item.expires_at)<=Date.now();return <article key={item.id}>
      <div><span className={`announcement-status${item.active&&!expired?' is-active':''}`}>{expired?'Istekla':item.active?'Objavljena':item.version?'Povučena':'Nacrt'}</span><h3>{item.title}</h3><p>{item.message}</p>{item.expires_at&&<small>Do {new Date(item.expires_at).toLocaleString('bs-BA')}</small>}</div>
      <div className="announcement-actions">{item.active?<button disabled={busy} onClick={()=>void action(item,'hide')}>Povuci obavijest</button>:!expired&&<button disabled={busy} onClick={()=>setConfirm(item.id)}>Objavi svima</button>}
      {confirm===item.id&&<div className="announcement-confirm"><p>Prikazati ovu poruku svim korisnicima i posjetiocima?</p><button className="announcement-publish" disabled={busy} onClick={()=>void action(item,'publish')}>Da, objavi</button><button disabled={busy} onClick={()=>setConfirm(null)}>Odustani</button></div>}</div>
    </article>;})}</div>
  </section>;
}
