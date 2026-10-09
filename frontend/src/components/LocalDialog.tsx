import {useEffect,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {ActionIcon} from './CreativeControls';

export function LocalDialog({title,children,onClose,busy=false,wide=false,className=''}:{title:string;children:ReactNode;onClose:()=>void;busy?:boolean;wide?:boolean;className?:string}){
 const ref=useRef<HTMLDialogElement>(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{const dialog=ref.current!;dialog.showModal();return()=>dialog.close();},[]);
 return createPortal(<dialog ref={ref} className={`local-dialog klipanje-shell ${wide?'wide':''} ${className}`} aria-label={title} onCancel={e=>{e.preventDefault();e.stopPropagation();if(!busy)close.current();}} onClick={e=>{if(e.target!==e.currentTarget||busy)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close.current();}}><header className="local-dialog-header"><h2>{title}</h2><button type="button" className="local-dialog-close" disabled={busy} aria-label="Zatvori" title="Zatvori" onClick={()=>close.current()}><ActionIcon name="close"/></button></header>{children}</dialog>,document.body);
}

export function localQuestion({title,message,options}:{title:string;message:string;options:{value:string;label:string;primary?:boolean;danger?:boolean}[]}):Promise<string|null>{
 return new Promise(resolve=>{
  const previous=document.activeElement as HTMLElement|null,dialog=document.createElement('dialog');dialog.className='local-dialog local-question klipanje-shell';
  const header=document.createElement('header');header.className='local-dialog-header';const heading=document.createElement('h2');heading.textContent=title;
  const close=document.createElement('button');close.type='button';close.className='local-dialog-close';close.textContent='×';close.setAttribute('aria-label','Zatvori');
  const text=document.createElement('p');text.textContent=message;const footer=document.createElement('footer');footer.className='local-dialog-actions';let settled=false;
  const finish=(value:string|null)=>{if(settled)return;settled=true;dialog.close();dialog.remove();previous?.focus();resolve(value);};
  close.onclick=()=>finish(null);dialog.oncancel=e=>{e.preventDefault();finish(null);};dialog.onclick=e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)finish(null);};
  for(const item of options){const button=document.createElement('button');button.type='button';button.textContent=item.label;if(item.primary)button.className='klipanje-primary';if(item.danger)button.className+=' dialog-danger';button.onclick=()=>finish(item.value);footer.append(button);}
  header.append(heading,close);dialog.append(header,text,footer);document.body.append(dialog);dialog.showModal();
 });
}
export async function localConfirm(message:string,title='Potvrdi izmjenu',label='Potvrdi',danger=false){return await localQuestion({title,message,options:[{value:'cancel',label:'Odustani'},{value:'confirm',label,primary:true,danger}]})==='confirm';}
