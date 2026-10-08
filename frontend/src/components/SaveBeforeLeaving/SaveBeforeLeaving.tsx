import { useEffect, useId, useRef, useState } from 'react';
export function SaveBeforeLeaving({open,onCancel,onContinue,onSave,saveLabel="Spremi i nastavi",continueLabel="Nastavi bez spremanja",title="Nastavljamo s titlovima?",description="Spremi projekat da se kasnije možeš vratiti montaži. Ako sadrži video, prenijet ćemo montirani snimak u titlove."}:{open:boolean;onCancel:()=>void;onContinue:()=>void;onSave:()=>Promise<boolean>;title?:string;description?:string;saveLabel?:string;continueLabel?:string}) {
  const titleId=useId();
  const dialog=useRef<HTMLDialogElement>(null);
  const [saving,setSaving]=useState(false),[error,setError]=useState('');
  const attempt=useRef(0);
  useEffect(()=>{const element=dialog.current;setSaving(false);setError('');if(open)element?.showModal();else element?.close();return()=>{attempt.current++;element?.close();};},[open]);
  async function save(){const id=++attempt.current;setSaving(true);setError('');try{const saved=await onSave();if(id!==attempt.current)return;if(saved)onContinue();else setError('Spremanje nije završeno. Možeš ostati i pokušati ponovo ili odmah izaći bez spremanja.');}catch{if(id===attempt.current)setError('Spremanje nije uspjelo. Pokušaj ponovo.');}finally{if(id===attempt.current)setSaving(false);}}
  function discard(){attempt.current++;setSaving(false);window.dispatchEvent(new Event('edita-cancel-save'));onContinue();}
  return <dialog ref={dialog} className="save-before-leaving" aria-labelledby={titleId} onCancel={event=>{event.preventDefault();attempt.current++;setSaving(false);onCancel();}}><span className="save-before-leaving-icon">↗</span><h2 id={titleId}>{title}</h2><p>{description}</p>{saving&&<p role="status">Čekamo da se video prenese i projekat spremi. Izaći ćemo tek kada spremanje završi. Ako ne želiš čekati, odaberi „{continueLabel}” — prijenos će se prekinuti.</p>}{error&&<p role="alert">{error}</p>}<div><button className="save-leaving-primary" onClick={discard}>{continueLabel}</button><button disabled={saving} onClick={()=>void save()}>{saving?'Spremanje…':saveLabel}</button><button onClick={()=>{attempt.current++;setSaving(false);onCancel();}}>Ostani u editoru</button></div></dialog>;
}
