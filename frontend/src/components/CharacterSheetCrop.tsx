import {useState,useRef,type PointerEvent} from 'react';
import {moveCharacterCrop,resizeCharacterCrop} from '../lib/character-crop';
import {LocalDialog} from './LocalDialog';
import {StyleDropdown} from './LanguageDropdown/LanguageDropdown';
import {apiJson} from '../lib/api';
import {jsonBody,type Asset} from '../lib/production';
const labels:Record<string,string>={'head-front':'Glava sprijeda','head-side':'Glava sa strane','head-back':'Glava odzada','body-front':'Tijelo sprijeda','body-back':'Tijelo odzada'};
export function CharacterSheetCrop({sheet,onClose,onSaved}:{sheet:Asset;onClose:()=>void;onSaved:(result:{sheet:Asset;assets:Asset[]})=>Promise<void>}){
 const width=sheet.metadata.sheetWidth||1536,height=sheet.metadata.sheetHeight||1024;
 const [boxes,setBoxes]=useState(sheet.metadata.cropBoxes||{}),[view,setView]=useState('head-front'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const box=boxes[view];
 const drag=useRef<{view:string;box:number[];x:number;y:number;sx:number;sy:number;edge:'move'|'e'|'s'|'se'}|null>(null);
 function begin(event:PointerEvent<HTMLDivElement>,edge:'move'|'e'|'s'|'se'){
  if(busy||!box||event.button!==0)return;event.preventDefault();event.stopPropagation();
  const rect=event.currentTarget.closest('.character-sheet-canvas')!.getBoundingClientRect();
  drag.current={view,box:[...box],x:event.clientX,y:event.clientY,sx:width/rect.width,sy:height/rect.height,edge};event.currentTarget.setPointerCapture(event.pointerId);
 }
 function move(event:PointerEvent<HTMLDivElement>){const d=drag.current;if(!d)return;event.preventDefault();const dx=(event.clientX-d.x)*d.sx,dy=(event.clientY-d.y)*d.sy;const next=d.edge==='move'?moveCharacterCrop(d.box,dx,dy,width,height):resizeCharacterCrop(d.box,dx,dy,d.edge,d.view.startsWith('body'),width,height);setBoxes(old=>({...old,[d.view]:next}));}
 function end(){drag.current=null;}

 function change(key:'x'|'y'|'size',value:number){
  if(!box)return;const next=[...box];
  if(key==='size'){const body=view.startsWith('body'),unit=Math.max(body?2:16,Math.min(Math.floor(value),Math.floor(Math.min(width/(body?9:1),height/(body?16:1)))));next[2]=unit*(body?9:1);next[3]=unit*(body?16:1);}
  else next[key==='x'?0:1]=Math.round(value);
  next[0]=Math.max(0,Math.min(width-next[2],next[0]));next[1]=Math.max(0,Math.min(height-next[3],next[1]));setBoxes(old=>({...old,[view]:next}));
 }
 async function save(){setBusy(true);setMessage('');try{const result=await apiJson<{sheet:Asset;assets:Asset[]}>('/api/creative/character/crop',jsonBody({sheet:sheet.id,boxes}));await onSaved(result);setMessage('Svih pet izreza spremljeno. Bez nove AI generacije.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <LocalDialog title="Prilagodi izreze lika" wide busy={busy} onClose={onClose} className="character-sheet-dialog"><p>Odaberi pogled. Povuci okvir za pomjeranje, a ručke na desnoj i donjoj strani za veličinu. Originalni list i prethodni izrezi ostaju sačuvani.</p><fieldset disabled={busy}><StyleDropdown label="Pogled" value={view} onChange={e=>setView(e.target.value)}>{Object.entries(labels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</StyleDropdown><div className="character-sheet-canvas"><img src={sheet.url} alt="Izvorni list s pet pogleda lika"/>{box&&<div className="character-sheet-box" role="group" tabIndex={0} aria-label="Pomjeri okvir izreza" onPointerDown={e=>begin(e,'move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={e=>{if(busy||!e.key.startsWith('Arrow'))return;e.preventDefault();const step=e.shiftKey?10:1;setBoxes(old=>({...old,[view]:moveCharacterCrop(box,e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0,width,height)}));}} style={{left:box[0]/width*100+'%',top:box[1]/height*100+'%',width:box[2]/width*100+'%',height:box[3]/height*100+'%'}}><span>{labels[view]}</span>{(['e','s','se'] as const).map(edge=><div key={edge} role="slider" tabIndex={0} aria-label={`Povećaj izrez ${edge}`} aria-valuemin={view.startsWith('body')?18:16} aria-valuemax={width-box[0]} aria-valuenow={box[2]} className={`character-crop-handle edge-${edge}`} onPointerDown={e=>begin(e,edge)} onPointerMove={e=>{e.stopPropagation();move(e);}} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={e=>{e.stopPropagation();if(busy||!e.key.startsWith('Arrow'))return;e.preventDefault();const amount=(e.key==='ArrowLeft'||e.key==='ArrowDown'?-1:1)*(view.startsWith('body')?9:1);setBoxes(old=>({...old,[view]:resizeCharacterCrop(box,amount,0,'e',view.startsWith('body'),width,height)}));}}/>)}</div>}</div>{box&&<div className="character-crop-controls"><label>Lijevo<input type="range" min="0" max={width-box[2]} value={box[0]} onChange={e=>change('x',Number(e.target.value))}/></label><label>Gore<input type="range" min="0" max={height-box[3]} value={box[1]} onChange={e=>change('y',Number(e.target.value))}/></label><label>Veličina · {view.startsWith('body')?'9:16':'1:1'}<input type="range" min={view.startsWith('body')?2:16} max={Math.floor(Math.min(width/(view.startsWith('body')?9:1),height/(view.startsWith('body')?16:1)))} value={box[2]/(view.startsWith('body')?9:1)} onChange={e=>change('size',Number(e.target.value))}/></label></div>}<div className="local-dialog-actions"><button onClick={onClose}>Zatvori</button><button className="klipanje-primary" disabled={Object.keys(boxes).length!==5} onClick={()=>void save()}>Spremi svih 5 izreza</button></div></fieldset>{message&&<p role="status">{message}</p>}</LocalDialog>;
}
