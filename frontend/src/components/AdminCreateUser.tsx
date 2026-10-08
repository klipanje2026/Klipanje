import {useEffect,useRef,useState} from 'react';
import {apiJson} from '../lib/api';

export function AdminCreateUser({affiliate,onClose,onCreated}:{affiliate:boolean;onClose:()=>void;onCreated:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{previous?.focus();};},[]);
  return <dialog ref={dialog} className="billing-modal admin-create-user" aria-labelledby="admin-create-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}><form onSubmit={async e=>{
    e.preventDefault();if(busy)return;setBusy(true);setError('');
    try {await apiJson(affiliate?'/api/admin/affiliates/create':'/api/admin/users/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});onCreated();onClose();}
    catch(e){setError(e instanceof Error?e.message:'Kreiranje nije uspjelo.');setBusy(false);}
  }}><h2 id="admin-create-title">{affiliate?'Dodaj affiliatora':'Kreiraj korisnika'}</h2><p>{affiliate?'Novi račun dobija affiliate ulogu i vlastiti link.':'Novi račun dobija Free paket i odobren pristup.'}</p><label>Ime i prezime<input name="name" autoComplete="off" required maxLength={150}/></label><label>Korisničko ime<input name="username" autoComplete="off" required maxLength={150}/></label><label>Email<input name="email" type="email" autoComplete="off" required/></label><label>Lozinka<input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={256}/></label>{error&&<p role="alert">{error}</p>}<footer><button type="button" disabled={busy} onClick={onClose}>Odustani</button><button disabled={busy}>{busy?'Kreiranje…':affiliate?'Kreiraj affiliatora':'Kreiraj korisnika'}</button></footer></form></dialog>;
}
