import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
export function ProjectErrorDialog({message,onClose,title='Video nije moguće otvoriti'}:{message:string;title?:string;onClose:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const element=dialog.current;element?.showModal();return()=>{element?.close();previous?.focus();};},[]);
 return createPortal(<dialog ref={dialog} className="edita-confirm-delete edita-project-error" aria-labelledby="project-error-title" aria-describedby="project-error-description" onCancel={event=>{event.preventDefault();onClose();}}>
 <h2 id="project-error-title">{title}</h2><p id="project-error-description">{message}</p><div><button autoFocus onClick={onClose}>U redu</button></div>
 </dialog>,document.body);
}
