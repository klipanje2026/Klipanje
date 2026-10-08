import {useEffect,useState} from 'react';
import {apiJson} from '../lib/api';
type Item={id:number;kind:string;code:number|null;at:string;user:string};
export function AdminEditorFailures(){
 const [items,setItems]=useState<Item[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=()=>{setBusy(true);setError('');void apiJson<{items:Item[]}>('/api/editor/diagnostics').then(data=>setItems(data.items)).catch(()=>setError('Greške nisu učitane.')).finally(()=>setBusy(false));};
 useEffect(load,[]);
 const names:Record<string,string>={video:'Video',export:'Izvoz',repair_video:'Popravka videa',repair_audio:'Popravka zvuka',repair_export:'Priprema izvoza',request:'Veza sa servisom'};
 return <section><div className="billing-toolbar admin-section-header"><h2>Greške editora</h2><button disabled={busy} onClick={load}>Osvježi</button></div>{error?<p role="alert">{error}</p>:<div className="billing-table-wrap"><table className="billing-table"><thead><tr><th>Vrijeme</th><th>Korisnik</th><th>Problem</th><th>Kod</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td>{new Date(item.at).toLocaleString()}</td><td>{item.user}</td><td>{names[item.kind]||item.kind}</td><td>{item.code??'—'}</td></tr>)}</tbody></table>{!busy&&!items.length&&<p className="admin-empty">Nema prijavljenih grešaka.</p>}</div>}</section>;
}
