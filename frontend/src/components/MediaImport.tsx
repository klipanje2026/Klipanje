import {useRef,useState} from 'react';
export function MediaImport({accept,label,disabled=false,onFiles}:{accept:string;label:string;disabled?:boolean;onFiles:(files:File[])=>Promise<void>}){
 const input=useRef<HTMLInputElement>(null),[drag,setDrag]=useState(false);
 return <div className="material-drop" data-drag={drag} onDragOver={e=>{e.preventDefault();if(!disabled)setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);if(!disabled)void onFiles(Array.from(e.dataTransfer.files));}}><button type="button" disabled={disabled} onClick={()=>input.current?.click()}>{label}</button><small>Prevuci datoteku ovdje ili klikni za odabir.</small><input ref={input} hidden type="file" multiple accept={accept} disabled={disabled} onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value='';void onFiles(files);}}/></div>;
}
