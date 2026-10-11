import {useState} from 'react';
import {LocalDialog,localConfirm} from './LocalDialog';
import {apiJson} from '../lib/api';
import {jsonBody,type Character,type Asset} from '../lib/production';
import {StyleDropdown} from './LanguageDropdown/LanguageDropdown';
const views=[['head-front','Glava sprijeda'],['head-side','Glava sa strane'],['head-back','Glava odzada'],['body-front','Tijelo sprijeda'],['body-back','Tijelo odzada']] as const;
export function CharacterProfiles({project,characters,assets,onSave,onRemove,onAsset}:{project:string;characters:Character[];assets:Asset[];onSave:(c:Character)=>Promise<void>;onRemove:(id:string)=>Promise<void>;onAsset:(a:Asset)=>void}){
 const [preview,setPreview]=useState<Asset|null>(null);
 const [draft,setDraft]=useState<Character|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[model,setModel]=useState('gpt-image-2.5-sunburst');
 const patch=(value:Partial<Character>)=>setDraft(c=>c?{...c,...value}:c);
 async function save(close=false){if(!draft)return;setBusy(true);try{await onSave(draft);setMessage('Lik je spremljen.');if(close)setDraft(null);}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 async function generate(outfitId=''){
  if(!draft)return;setBusy(true);let current={...draft};try{
   await onSave(current);
   const plan=outfitId?views.filter(([id])=>id.startsWith('body')):views;
   for(const [view,label] of plan){
    const existing=outfitId?current.outfits?.find(o=>o.id===outfitId)?.views?.[view]:current.views?.[view];
    if(existing)continue;
    setMessage(`Generišem: ${label}…`);
    const asset=await apiJson<Asset>('/api/creative/character',jsonBody({project,character:current.id,view,outfit:outfitId,model}));onAsset(asset);
    current=outfitId?{...current,outfits:current.outfits?.map(o=>o.id===outfitId?{...o,views:{...o.views,[view]:asset.id}}:o)}:{...current,views:{...current.views,[view]:asset.id},referenceId:view==='head-front'?asset.id:current.referenceId};
    setDraft(current);await onSave(current);
   }
   setMessage('Pogledi su spremljeni.');
  }catch(e){setMessage((e as Error).message+' Već spremljeni pogledi ostaju; ponovni klik nastavlja nedostajuće.');}finally{setBusy(false);}
 }
 const photo=(id?:string)=>assets.find(a=>a.id===id);
 return <><button type="button" onClick={()=>{setDraft({id:crypto.randomUUID(),name:'',description:'',appearance:'',personality:'',clothing:'',prompt:'',views:{},outfits:[]});setMessage('');}}>+ Dodaj lika</button>
 <div className="character-profile-grid">{characters.map(c=><button type="button" key={c.id} onClick={()=>{setDraft({...c});setMessage('');}}><strong>{c.name}</strong>{photo(c.views?.['head-front']||c.referenceId)?<img src={photo(c.views?.['head-front']||c.referenceId)!.url} alt={c.name}/>:<svg viewBox="0 0 100 100" aria-label="Portret još nije generisan"><circle cx="50" cy="35" r="19"/><path d="M16 95v-9a34 34 0 0 1 68 0v9"/></svg>}</button>)}</div>
 {draft&&<LocalDialog title={draft.name||'Novi lik'} wide busy={busy} onClose={()=>setDraft(null)}><fieldset disabled={busy} className="character-profile-form">
 <label>Ime<input value={draft.name} maxLength={100} onChange={e=>patch({name:e.target.value})}/></label>
 <div className="character-type-help"><a href="/vodic-likovi.html" target="_blank" rel="noopener noreferrer">Vodič za likove · primjeri i TXT ↗</a><div className="character-type-options">{[
 ['Osoba','Posveti pažnju obliku lica, očima, kosi, proporcijama i stalnim oznakama. Odvoji ličnost od trenutnog raspoloženja.','Dob, visina, građa, ten, oblik lica, oči, kosa i prepoznatljive oznake.'],
 ['Životinja','Navedi vrstu, anatomiju, raspored šara, uši i rep. Odredi prirodno ili ljudsko ponašanje; oznake ostaju na istoj strani tijela.','Vrsta, veličina, građa, krzno/perje, oči, uši, rep i raspored oznaka.'],
 ['Fantastični lik','Definiši broj udova i krila, siluetu, materijale, moći i ograničenja. Odjeću odvoji od tijela, a magiju od osnovnog izgleda.','Vrsta bića, veličina, proporcije, broj udova/krila, površina tijela, lice i stalne oznake.']
 ].map(([label,help,template])=><span className="character-type-option" key={label}><button type="button" aria-label={label+': '+help} onClick={()=>{if(!(draft.appearance||draft.description).trim())patch({appearance:template,description:template});}}>{label} ⓘ</button><span role="tooltip">{help}</span></span>)}</div><small>Pređi mišem ili fokusiraj vrstu za savjet. Klik popunjava samo prazan opis.</small></div>
 <label>Izgled<textarea rows={3} maxLength={3000} value={draft.appearance??draft.description} onChange={e=>patch({appearance:e.target.value,description:e.target.value})}/></label>
 <label>Osobine i ponašanje<textarea rows={2} maxLength={2000} value={draft.personality||''} onChange={e=>patch({personality:e.target.value})}/></label>
 <label>Osnovna odjeća<textarea rows={2} maxLength={2000} value={draft.clothing||''} onChange={e=>patch({clothing:e.target.value})}/></label>
 <label>Dodatni prompt · opcionalno<textarea rows={2} maxLength={3000} value={draft.prompt||''} placeholder="Dodatne upute; opis iznad je dovoljan." onChange={e=>patch({prompt:e.target.value})}/></label>
 <StyleDropdown label="Model za lik" value={model} onChange={e=>setModel(e.target.value)}><option value="gpt-image-2.5-flare">GPT Image 2.5 Flare</option><option value="gpt-image-2.5-sunburst">GPT Image 2.5 Sunburst</option></StyleDropdown>
 <div className="character-view-grid">{views.map(([id,label])=><div key={id}><small>{label}</small>{photo(draft.views?.[id])?<button type="button" title={label} onClick={()=>setPreview(photo(draft.views?.[id])!)}><img src={photo(draft.views?.[id])!.url} alt={label}/></button>:<span>Još nije generisano</span>}</div>)}</div>
 <button type="button" disabled={!draft.name.trim()||!(draft.appearance||draft.description).trim()} onClick={()=>void generate()}>Generiši nedostajuće poglede lika</button>
 <h3>Odjevne kombinacije</h3>{(draft.outfits||[]).map(o=><div className="character-outfit" key={o.id}><label>Naziv odjeće<input value={o.name} maxLength={100} onChange={e=>patch({outfits:draft.outfits?.map(v=>v.id===o.id?{...v,name:e.target.value}:v)})}/></label><label>Opis odjeće<textarea rows={2} maxLength={2000} value={o.description} onChange={e=>patch({outfits:draft.outfits?.map(v=>v.id===o.id?{...v,description:e.target.value}:v)})}/></label><div className="character-view-grid">{['body-front','body-back'].map(view=>photo(o.views?.[view])&&<img key={view} src={photo(o.views?.[view])!.url} alt={view==='body-front'?'Odjeća sprijeda':'Odjeća odzada'}/>)}</div><button type="button" disabled={!o.description.trim()||!draft.referenceId} onClick={()=>void generate(o.id)}>Generiši odjeću sprijeda i odzada</button><button type="button" onClick={()=>patch({outfits:draft.outfits?.filter(v=>v.id!==o.id)})}>Ukloni kombinaciju</button></div>)}
 <button type="button" onClick={()=>patch({outfits:[...(draft.outfits||[]),{id:crypto.randomUUID(),name:'Nova odjeća',description:'',views:{}}]})}>+ Dodaj odjeću</button>
 <div className="local-dialog-actions"><button type="button" disabled={!draft.name.trim()} className="klipanje-primary" onClick={()=>void save(true)}>Spremi lika</button>{characters.some(c=>c.id===draft.id)&&<button type="button" onClick={async()=>{if(await localConfirm('Obrisati profil lika?','Obriši lika','Obriši',true)){setBusy(true);try{await onRemove(draft.id);setDraft(null);}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}}}>Obriši lika</button>}</div></fieldset>{message&&<p role="status">{message}</p>}</LocalDialog>}{preview&&<LocalDialog title={preview.name} wide onClose={()=>setPreview(null)}><img className="photo-full-preview" src={preview.url} alt={preview.name}/></LocalDialog>}</>;
}
