import {CharacterProfileAssistant} from './CharacterProfileAssistant';
import {CharacterSheetCrop} from './CharacterSheetCrop';
import {useState} from 'react';
import {LocalDialog,localConfirm} from './LocalDialog';
import {apiJson} from '../lib/api';
import {jsonBody,type Character,type Asset,type Script} from '../lib/production';
import {StyleDropdown} from './LanguageDropdown/LanguageDropdown';
const views=[['head-front','Glava sprijeda'],['head-side','Glava sa strane'],['head-back','Glava odzada'],['body-front','Tijelo sprijeda'],['body-back','Tijelo odzada']] as const;
export function CharacterProfiles({project,characters,assets,scripts,onSave,onRemove,onAsset}:{project:string;characters:Character[];assets:Asset[];scripts:Script[];onSave:(c:Character)=>Promise<void>;onRemove:(id:string)=>Promise<void>;onAsset:(a:Asset)=>void}){
 const [assistant,setAssistant]=useState(false),[diagnostic,setDiagnostic]=useState<{prompt:string;references:{id:string;name:string;role:string}[];view:string;note:string}|null>(null);
 const [sheet,setSheet]=useState<Asset|null>(null);
 const [preview,setPreview]=useState<Asset|null>(null);
 const [draft,setDraft]=useState<Character|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[model,setModel]=useState('gpt-image-2.5-sunburst');
 const patch=(value:Partial<Character>)=>setDraft(c=>c?{...c,...value}:c);
 async function save(close=false){if(!draft)return;setBusy(true);try{await onSave(draft);setMessage('Lik je spremljen.');if(close)setDraft(null);}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 async function generate(outfitId='',onlyView=''){
  if(!draft)return;setBusy(true);let current={...draft};try{
   await onSave(current);
   const plan=outfitId?views.filter(([id])=>id.startsWith('body')):views;
   for(const [view,label] of plan){
    const existing=outfitId?current.outfits?.find(o=>o.id===outfitId)?.views?.[view]:current.views?.[view];
    if(onlyView&&view!==onlyView)continue;if(existing&&!onlyView)continue;
    setMessage(`Generišem: ${label}…`);
    const asset=await apiJson<Asset>('/api/creative/character',jsonBody({project,character:current.id,view,outfit:outfitId,model}));onAsset(asset);
    current=outfitId?{...current,outfits:current.outfits?.map(o=>o.id===outfitId?{...o,views:{...o.views,[view]:asset.id}}:o)}:{...current,views:{...current.views,[view]:asset.id},referenceId:view==='head-front'?asset.id:current.referenceId};
    setDraft(current);await onSave(current);
   }
   setMessage('Pogledi su spremljeni.');
  }catch(e){setMessage((e as Error).message+' Već spremljeni pogledi ostaju; ponovni klik nastavlja nedostajuće.');}finally{setBusy(false);}
 }
 async function acceptSheet(result:{sheet:Asset;assets:Asset[];cropError?:string}){
  if(!draft)return;onAsset(result.sheet);result.assets.forEach(onAsset);
  const added=Object.fromEntries(result.assets.filter(a=>a.metadata.view).map(a=>[a.metadata.view!,a.id]));
  const current={...draft,views:{...draft.views,...added},referenceId:added['head-front']||draft.referenceId};
  setDraft(current);await onSave(current);setMessage(result.cropError||'Pet pogleda spremljeno iz jednog lista.');
 }
 async function generateSheet(){
  if(!draft)return;
  if(Object.keys(draft.views||{}).length&&!await localConfirm('Novi list zamijenit će aktivnih pet pogleda. Prethodne slike ostaju sačuvane.','Jedan list · pet pogleda','Generiši list'))return;
  setBusy(true);setMessage('Generišem jedan list s pet pogleda…');
  try{await onSave(draft);const result=await apiJson<{sheet:Asset;assets:Asset[];cropError?:string}>('/api/creative/character',jsonBody({project,character:draft.id,view:'sheet',model}));await acceptSheet(result);setSheet(result.sheet);}
  catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
 }
 async function inspectRequest(view='sheet'){
  if(!draft)return;setBusy(true);setMessage('');try{setDiagnostic(await apiJson('/api/creative/character',jsonBody({project,character:draft.id,view,model,preview:true})));}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
 }
 const photo=(id?:string)=>assets.find(a=>a.id===id);
 return <><button type="button" disabled={busy} onClick={()=>{setDraft({id:crypto.randomUUID(),name:'',description:'',appearance:'',personality:'',clothing:'',prompt:'',views:{},outfits:[]});setMessage('');}}>+ Dodaj lika</button>
 <div className="character-profile-grid">{characters.map(c=><button type="button" disabled={busy} key={c.id} onClick={()=>{setDraft({...c});setMessage('');}}><strong>{c.name}</strong><span className="character-reference-strip">{photo(c.views?.['head-front']||c.referenceId)&&<img src={photo(c.views?.['head-front']||c.referenceId)!.url} alt={`${c.name} · sprijeda`} loading="lazy"/>}{assets.filter(a=>a.metadata.purpose==='character-sheet'&&a.metadata.characterId===c.id).slice(-1).map(a=><img className="character-sheet-thumb" key={a.id} src={a.url} alt={`${c.name} · svih pet pogleda`} loading="lazy"/>)}</span></button>)}</div>
 {draft&&<LocalDialog title={draft.name||'Novi lik'} wide busy={busy} onClose={()=>setDraft(null)}><fieldset disabled={busy} className="character-profile-form">
 <label>Ime<input value={draft.name} maxLength={100} onChange={e=>patch({name:e.target.value})}/></label>
 <div className="character-type-help"><a href="/vodic-likovi.html" target="_blank" rel="noopener noreferrer">Vodič za likove · primjeri i TXT ↗</a><div className="character-type-options">{[
 ['Osoba','Posveti pažnju obliku lica, očima, kosi, proporcijama i stalnim oznakama. Odvoji ličnost od trenutnog raspoloženja.','Dob, visina, građa, ten, oblik lica, oči, kosa i prepoznatljive oznake.'],
 ['Životinja','Navedi vrstu, anatomiju, raspored šara, uši i rep. Odredi prirodno ili ljudsko ponašanje; oznake ostaju na istoj strani tijela.','Vrsta, veličina, građa, krzno/perje, oči, uši, rep i raspored oznaka.'],
 ['Fantastični lik','Definiši broj udova i krila, siluetu, materijale, moći i ograničenja. Odjeću odvoji od tijela, a magiju od osnovnog izgleda.','Vrsta bića, veličina, proporcije, broj udova/krila, površina tijela, lice i stalne oznake.']
 ].map(([label,help,template])=><span className="character-type-option" key={label}><button type="button" aria-label={label+': '+help} onClick={()=>{if(!(draft.appearance||draft.description).trim())patch({appearance:template,description:template});}}>{label} ⓘ</button><span role="tooltip">{help}</span></span>)}</div><small>Pređi mišem ili fokusiraj vrstu za savjet. Klik popunjava samo prazan opis.</small></div>
 <div className="character-assistant-row"><button type="button" className="klipanje-primary" disabled={!draft.name.trim()} onClick={()=>setAssistant(true)}>Oblikuj lika iz priče</button><small>Unesi ime i po želji svoj opis; AI predlaže cjelovit profil prema priči i pravilima.</small></div>
 <label>Druga imena i padeži<input value={draft.aliases||''} placeholder="Kerim, Kerima, Flegma" onChange={e=>patch({aliases:e.target.value})}/></label><label>Izgled<textarea rows={3} maxLength={3000} value={draft.appearance??draft.description} onChange={e=>patch({appearance:e.target.value,description:e.target.value})}/></label>
 <label>Osobine i ponašanje<textarea rows={2} maxLength={2000} value={draft.personality||''} onChange={e=>patch({personality:e.target.value})}/></label>
 <label>Osnovna odjeća<textarea rows={2} maxLength={2000} value={draft.clothing||''} onChange={e=>patch({clothing:e.target.value})}/></label>
 <label>Stalni prompt lika<textarea rows={2} maxLength={3000} value={draft.prompt||''} placeholder="Detalji koji se primjenjuju svaki put kada je ovaj lik u kadru." onChange={e=>patch({prompt:e.target.value})}/></label>
 <StyleDropdown label="Model za lik" value={model} onChange={e=>setModel(e.target.value)}><option value="gpt-image-2.5-flare">GPT Image 2.5 Flare</option><option value="gpt-image-2.5-sunburst">GPT Image 2.5 Sunburst</option></StyleDropdown>
 <button type="button" disabled={!characters.some(c=>c.id===draft.id)} onClick={()=>void inspectRequest()}>Pregled spremljenog zahtjeva · bez generisanja</button><small>Pregled koristi spremljen profil. Ako si mijenjao opis, prvo spremi lika.</small>
 <section className="character-sheet-generation"><h3>Jedan list · pet pogleda</h3><p>Jedna generacija, pa lokalno izrezivanje: tri glave 1:1 i dva cijela tijela 9:16. Izreze možeš doraditi bez nove generacije.</p><button type="button" className="klipanje-primary" disabled={!draft.name.trim()||!(draft.appearance||draft.description).trim()} onClick={()=>void generateSheet()}>Generiši svih 5 u jednoj slici</button><small>Pogledi imaju manje detalja nego pojedinačne generacije. Pregledaj izreze prije korištenja.</small>{assets.filter(a=>a.metadata.purpose==='character-sheet'&&a.metadata.characterId===draft.id).slice().reverse().map(a=><button type="button" key={a.id} onClick={()=>setSheet(a)}>Prilagodi izreze · {a.created_at?new Date(a.created_at).toLocaleString('bs-BA'):a.name}</button>)}</section>
 <div className="character-view-grid">{views.map(([id,label])=><div key={id}><small>{label}</small>{photo(draft.views?.[id])?<button type="button" title={label} onClick={()=>setPreview(photo(draft.views?.[id])!)}><img src={photo(draft.views?.[id])!.url} alt={label}/></button>:<span>Još nije generisano</span>}<button type="button" disabled={!draft.name.trim()||!(draft.appearance||draft.description).trim()} onClick={async()=>{if(draft.views?.[id]&&!await localConfirm('Generisati novu verziju ovog pogleda? Prethodna slika ostaje sačuvana.','Novi pogled','Generiši'))return;void generate('',id);}}>{draft.views?.[id]?'Nova verzija':'Generiši ovaj pogled'}</button></div>)}</div>
 <button type="button" disabled={!draft.name.trim()||!(draft.appearance||draft.description).trim()} onClick={()=>void generate()}>Generiši nedostajuće poglede lika</button>
 <h3>Odjevne kombinacije</h3><p>Imenuj kombinaciju, npr. Pidžama. U promptu je odaberi kroz Lik i odjeća; njen puni opis dodaje se pri generisanju.</p>{(draft.outfits||[]).map(o=><div className="character-outfit" key={o.id}><label>Naziv odjeće<input value={o.name} maxLength={100} onChange={e=>patch({outfits:draft.outfits?.map(v=>v.id===o.id?{...v,name:e.target.value}:v)})}/></label><label>Opis odjeće<textarea rows={2} maxLength={2000} value={o.description} onChange={e=>patch({outfits:draft.outfits?.map(v=>v.id===o.id?{...v,description:e.target.value}:v)})}/></label><div className="character-view-grid">{['body-front','body-back'].map(view=>photo(o.views?.[view])&&<img key={view} src={photo(o.views?.[view])!.url} alt={view==='body-front'?'Odjeća sprijeda':'Odjeća odzada'}/>)}</div><div className="character-outfit-actions"><button type="button" disabled={!o.description.trim()||!draft.referenceId} onClick={()=>void generate(o.id)}>Generiši odjeću sprijeda i odzada</button><button type="button" onClick={()=>patch({outfits:draft.outfits?.filter(v=>v.id!==o.id)})}>Ukloni kombinaciju</button></div></div>)}
 <button type="button" onClick={()=>patch({outfits:[...(draft.outfits||[]),{id:crypto.randomUUID(),name:'Nova odjeća',description:'',views:{}}]})}>+ Dodaj odjeću</button>
 <div className="local-dialog-actions"><button type="button" disabled={!draft.name.trim()} className="klipanje-primary" onClick={()=>void save(true)}>Spremi lika</button>{characters.some(c=>c.id===draft.id)&&<button type="button" onClick={async()=>{if(await localConfirm('Obrisati profil lika?','Obriši lika','Obriši',true)){setBusy(true);try{await onRemove(draft.id);setDraft(null);}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}}}>Obriši lika</button>}</div></fieldset>{message&&<p role="status">{message}</p>}</LocalDialog>}{assistant&&draft&&<CharacterProfileAssistant project={project} current={draft} scripts={scripts} onApply={setDraft} onClose={()=>setAssistant(false)}/>} {diagnostic&&<LocalDialog title="Pregled zahtjeva za lika" wide busy={busy} onClose={()=>setDiagnostic(null)}><p>{diagnostic.note}</p><StyleDropdown label="Vrsta generacije" value={diagnostic.view} onChange={e=>void inspectRequest(e.target.value)}><option value="sheet">Svih pet pogleda u jednom listu</option>{views.map(([id,label])=><option key={id} value={id}>{label}</option>)}</StyleDropdown><textarea readOnly rows={12} value={diagnostic.prompt}/><h3>Poslane reference</h3>{diagnostic.references.map(r=><p key={r.id}>{r.name} · {r.role}</p>)}{!diagnostic.references.length&&<p>Nema slikovnih referenci.</p>}<button onClick={()=>void navigator.clipboard.writeText(diagnostic.prompt)}>Kopiraj zahtjev</button></LocalDialog>} {sheet&&draft&&<CharacterSheetCrop sheet={sheet} onClose={()=>setSheet(null)} onSaved={acceptSheet}/>} {preview&&<LocalDialog title={preview.name} wide onClose={()=>setPreview(null)}><img className="photo-full-preview" src={preview.url} alt={preview.name}/></LocalDialog>}</>;
}
