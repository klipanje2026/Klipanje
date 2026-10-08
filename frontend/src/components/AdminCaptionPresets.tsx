import {useEffect,useMemo,useState} from 'react';
import {apiJson} from '../lib/api';
import {savedTemplate,type SavedCaptionPreset} from '../lib/caption-presets';
import {CaptionSample} from './CaptionSample/CaptionSample';
import {PresetNameDialog} from './PresetNameDialog';
export function AdminCaptionPresets(){
 const [items,setItems]=useState<SavedCaptionPreset[]>([]),[error,setError]=useState(''),[selected,setSelected]=useState<SavedCaptionPreset|null>(null),[preview,setPreview]=useState(''),[busy,setBusy]=useState(false);
 const rows=useMemo(()=>items.map(p=>({preset:p,template:savedTemplate(p)})),[items]);
 function load(){return apiJson<{presets:SavedCaptionPreset[]}>('/api/admin/caption-presets').then(data=>setItems(data.presets));}
 useEffect(()=>{void load().catch(()=>setError('Prijedlozi nisu učitani.'));},[]);
 async function review(p:SavedCaptionPreset,action:string,name=p.name){await apiJson(`/api/admin/caption-presets/${p.id}/review`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,name})});setItems(current=>current.filter(t=>t.id!==p.id));}
 return <section className="admin-caption-presets"><header><h2>Predloženi predlošci korisnika · {items.length}</h2><button onClick={()=>void load().catch(()=>setError('Prijedlozi nisu učitani.'))}>Osvježi</button></header>{error&&<p role="alert">{error}</p>}<div className="admin-preset-grid">{rows.map(({preset:p,template})=><article key={p.id} onPointerEnter={()=>setPreview(p.id)} onPointerLeave={()=>setPreview('')}><CaptionSample template={template} playing={preview===p.id}/><strong>{p.name}</strong><p>@{p.username}</p><button onClick={()=>setSelected(p)}>Dodaj predložak u stilove</button><button disabled={busy} onClick={async()=>{setBusy(true);try{await review(p,'reject');}catch{setError('Odbijanje nije uspjelo.');}finally{setBusy(false);}}}>Odbij</button></article>)}</div>{!items.length&&<p>Nema prijedloga na čekanju.</p>}{selected&&<PresetNameDialog title="Objavi predložak u stilovima" initialName={selected.name} onClose={()=>setSelected(null)} onSave={name=>review(selected,'publish',name)}/>}</section>;
}
