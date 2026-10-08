import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
export function PresetNameDialog({title,initialName='',onSave,onClose}:{title:string;initialName?:string;onSave:(name:string)=>Promise<void>;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),[name,setName]=useState(initialName),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const dialog=ref.current;dialog?.showModal();return()=>dialog?.close();},[]);
 return createPortal(<dialog ref={ref} className="export-options-dialog" aria-label={title} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await onSave(name.trim());onClose();}catch(e){setError(e instanceof Error?e.message:'Spremanje nije uspjelo.');}finally{setBusy(false);}}}><header><h2>{title}</h2></header><label>Naziv predloška<input autoFocus required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<footer><button type="button" disabled={busy} onClick={onClose}>Odustani</button><button type="submit" disabled={busy||!name.trim()}>{busy?'Spremanje…':'Spremi'}</button></footer></form></dialog>,document.body);
}
