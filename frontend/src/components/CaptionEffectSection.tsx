import {useId,useState,type ReactNode} from 'react';

/** Visibility is independent of the saved effect; enabling opens its controls. */
export function CaptionEffectSection({title,enabled,onChange,children,id}:{title:string;enabled:boolean;onChange:(enabled:boolean)=>void;children:ReactNode;id:string}){
 const contentId=useId();
 const [disclosure,setDisclosure]=useState({enabled,open:enabled});
 const changed=disclosure.enabled!==enabled;
 const open=changed?enabled:disclosure.open;
 if(changed)setDisclosure({enabled,open:enabled});
 return <section className="caption-effect-section" data-effect={id} data-enabled={enabled}>
  <div className="caption-effect-section-heading"><button type="button" className="caption-effect-disclosure" aria-expanded={open} aria-controls={contentId} onClick={()=>setDisclosure({enabled,open:!open})}><svg viewBox="0 0 24 24" aria-hidden="true" style={{transform:open?'rotate(90deg)':undefined}}><path d="m9 6 6 6-6 6"/></svg><span>{title}</span></button><input id={contentId+'-toggle'} type="checkbox" aria-label={title} checked={enabled} onChange={event=>onChange(event.target.checked)}/></div>
  {open&&<div id={contentId} className="caption-effect-section-content">{children}</div>}
 </section>;
}
