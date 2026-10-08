import {useRef, useState} from 'react';
import {useAuth} from '../context/auth-context';
import {apiJson} from '../lib/api';

export function ProfileAvatar({src}:{src?:string}) {
  return src ? <img src={src} alt="" /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>;
}

export function ProfileSettings() {
  const {session,refresh}=useAuth();
  const input=useRef<HTMLInputElement>(null);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  async function save(file?:File) {
    setBusy(true);setError('');setMessage('');
    try {
      let pixels='';
      if(file){
        if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('Odaberi JPG, PNG ili WebP sliku do 5 MB.');
        const image=await createImageBitmap(file);
        try {
          const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
          const context=canvas.getContext('2d');if(!context)throw new Error('Slika se ne može pripremiti.');
          const side=Math.min(image.width,image.height);
          context.drawImage(image,(image.width-side)/2,(image.height-side)/2,side,side,0,0,128,128);
          const data=context.getImageData(0,0,128,128).data;
          let bytes='';for(const byte of data)bytes+=String.fromCharCode(byte);
          pixels=btoa(bytes);
        } finally {image.close();}
      }
      await apiJson('/api/account/avatar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pixels})});
      await refresh();setMessage(file?'Profilna slika je spremljena.':'Profilna slika je uklonjena.');
    } catch(e){setError(e instanceof Error?e.message:'Promjena slike nije uspjela.');}
    finally {setBusy(false);if(input.current)input.current.value='';}
  }
  if(!session.user)return null;
  return <section id="profil" className="options-card profile-settings" aria-labelledby="profile-heading">
    <header><h2 id="profile-heading">Tvoj profil</h2><p>Tvoja slika prikazuje se u meniju računa.</p></header>
    <div className="profile-photo-row">
      <span className="profile-photo"><ProfileAvatar src={session.user.avatar}/></span>
      <div className="profile-photo-info"><strong>{session.user.name}</strong><p>JPG, PNG ili WebP · do 5 MB</p><small>Slika se izrezuje po sredini.</small></div>
      <div className="profile-photo-actions"><button className="profile-upload" type="button" disabled={busy} onClick={()=>input.current?.click()}>{busy?'Spremanje…':session.user.avatar?'Promijeni sliku':'Dodaj sliku'}</button>{session.user.avatar&&<button type="button" disabled={busy} onClick={()=>void save()}>Ukloni sliku</button>}</div>
    </div>
    <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file)void save(file);}}/>
    {message&&<p className="profile-feedback" role="status">{message}</p>}{error&&<p className="profile-feedback" role="alert">{error}</p>}
  </section>;
}
