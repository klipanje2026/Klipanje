import './ExportDialogs.scss';
import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
export function ExportProgressDialog({message,progress}:{message:string;progress?:number}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;dialog?.showModal();const block=(e:KeyboardEvent)=>{e.preventDefault();e.stopImmediatePropagation();};const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('keydown',block,true);window.addEventListener('beforeunload',warn);return()=>{dialog?.close();window.removeEventListener('keydown',block,true);window.removeEventListener('beforeunload',warn);};},[]);
 return createPortal(<dialog ref={ref} className="export-progress-dialog" onCancel={e=>e.preventDefault()} aria-label="Priprema videa" aria-busy="true"><div className="export-spinner"/><h2>Pripremamo tvoj video</h2><p role="status">{message}</p>{progress!==undefined&&<><progress max={100} value={progress}/><strong>{progress}%</strong></>}<small>Ostavi ovaj tab otvoren. Preuzimanje kreće nakon završetka.</small></dialog>,document.body);
}
