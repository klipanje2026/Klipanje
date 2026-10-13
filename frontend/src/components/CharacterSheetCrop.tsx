import {useState} from 'react';
import {LocalDialog} from './LocalDialog';
import {StyleDropdown} from './LanguageDropdown/LanguageDropdown';
import {apiJson} from '../lib/api';
import {jsonBody,type Asset} from '../lib/production';
const labels:Record<string,string>={'head-front':'Glava sprijeda','head-side':'Glava sa strane','head-back':'Glava odzada','body-front':'Tijelo sprijeda','body-back':'Tijelo odzada'};
export function CharacterSheetCrop({sheet,onClose,onSaved}:{sheet:Asset;onClose:()=>void;onSaved:(result:{sheet:Asset;assets:Asset[]})=>Promise<void>}){
 const width=sheet.metadata.sheetWidth||1536,height=sheet.metadata.sheetHeight||1024;
 const [boxes,setBoxes]=useState(sheet.metadata.cropBoxes||{}),[view,setView]=useState('head-front'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const box=boxes[view];
 function change(key:'x'|'y'|'size',value:number){
  if(!box)return;const next=[...box];
  if(key==='size'){const body=view.startsWith('body'),unit=Math.max(body?2:16,Math.min(Math.floor(value),Math.floor(Math.min(width/(body?9:1),height/(body?16:1)))));next[2]=unit*(body?9:1);next[3]=unit*(body?16:1);}
  else next[key==='x'?0:1]=Math.round(value);
  next[0]=Math.max(0,Math.min(width-next[2],next[0]));next[1]=Math.max(0,Math.min(height-next[3],next[1]));setBoxes(old=>({...old,[view]:next}));
 }
 async function save(){setBusy(true);setMessage('');try{const result=await apiJson<{sheet:Asset;assets:Asset[]}>('/api/creative/character/crop',jsonBody({sheet:sheet.id,boxes}));await onSaved(result);setMessage('Svih pet izreza spremljeno. Bez nove AI generacije.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <LocalDialog title="Prilagodi izreze lika" wide busy={busy} onClose={onClose} className="character-sheet-dialog"><p>Odaberi pogled i namjesti okvir oko njega. Originalni list i prethodni izrezi ostaju sačuvani.</p><fieldset disabled={busy}><StyleDropdown label="Pogled" value={view} onChange={e=>setView(e.target.value)}>{Object.entries(labels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</StyleDropdown><div className="character-sheet-canvas"><img src={sheet.url} alt="Izvorni list s pet pogleda lika"/>{box&&<div className="character-sheet-box" style={{left:box[0]/width*100+'%',top:box[1]/height*100+'%',width:box[2]/width*100+'%',height:box[3]/height*100+'%'}}><span>{labels[view]}</span></div>}</div>{box&&<div className="character-crop-controls"><label>Lijevo<input type="range" min="0" max={width-box[2]} value={box[0]} onChange={e=>change('x',Number(e.target.value))}/></label><label>Gore<input type="range" min="0" max={height-box[3]} value={box[1]} onChange={e=>change('y',Number(e.target.value))}/></label><label>Veličina · {view.startsWith('body')?'9:16':'1:1'}<input type="range" min={view.startsWith('body')?2:16} max={Math.floor(Math.min(width/(view.startsWith('body')?9:1),height/(view.startsWith('body')?16:1)))} value={box[2]/(view.startsWith('body')?9:1)} onChange={e=>change('size',Number(e.target.value))}/></label></div>}<div className="local-dialog-actions"><button onClick={onClose}>Zatvori</button><button className="klipanje-primary" disabled={Object.keys(boxes).length!==5} onClick={()=>void save()}>Spremi svih 5 izreza</button></div></fieldset>{message&&<p role="status">{message}</p>}</LocalDialog>;
}
