import './LanguageDropdown.scss';
import { Children, isValidElement, type ReactNode, Fragment, useEffect, useLayoutEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { StudioIcon } from '../StudioIcon/StudioIcon';
type Props = { value:string; onChange:(value:string)=>void; options:{value:string;label:string;group?:string;fontFamily?:string;description?:string}[]; disabled?:boolean; label?:string; hideLabel?:boolean; triggerTitle?:string; variant?:"voice"; placeholder?:string; icon?:ReactNode };
export function LanguageDropdown({value,onChange,options,disabled,label='Jezik govora',hideLabel=false,triggerTitle,variant,placeholder='Odaberi jezik',icon}:Props) {
  const [open,setOpen]=useState(false);
  const [focused,setFocused]=useState(0);
  const root=useRef<HTMLDivElement>(null), trigger=useRef<HTMLButtonElement>(null);
  const list=useRef<HTMLDivElement>(null);
  const [menuFont,setMenuFont]=useState({fontFamily:'inherit',fontSize:'12px',fontWeight:'400'});
  const [placement,setPlacement]=useState({left:0,top:0,width:220,maxHeight:270});
  const id=useId();
  useLayoutEffect(()=>{
    if(!open)return;
    const position=()=>{
      const rect=trigger.current?.getBoundingClientRect();if(!rect)return;
      const height=Math.min(330,options.reduce((total,option)=>total+(option.description?100:40),16));
      const below=window.innerHeight-rect.bottom-16, above=rect.top-16;
      const down=below>=height||below>=above;
      const maxHeight=Math.max(40,Math.min(height,down?below:above));
      const panel=variant==='voice'?root.current?.closest('.subtitle-voice-picker, .video-voice-panel')?.getBoundingClientRect():null;
      const width=Math.min(Math.max(220,panel?.width??rect.width),window.innerWidth-16);
      setPlacement({left:Math.max(8,Math.min(rect.left,window.innerWidth-width-8)),top:down?rect.bottom+8:Math.max(8,rect.top-maxHeight-8),width,maxHeight});
    };
    position();window.addEventListener('resize',position);window.addEventListener('scroll',position,true);
    return()=>{window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);};
  },[open,options.length,variant]);
  useEffect(()=>{if(open)document.getElementById(`${id}-${focused}`)?.scrollIntoView({block:'nearest'});},[open,focused,id]);
  const selected=options.findIndex(option=>option.value===value);
  useEffect(()=>{ const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node)&&!list.current?.contains(event.target as Node))setOpen(false);};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[]);
  function show(){if(trigger.current){const css=getComputedStyle(trigger.current);setMenuFont({fontFamily:css.fontFamily,fontSize:css.fontSize,fontWeight:css.fontWeight});}setFocused(Math.max(0,selected));setOpen(true);}
  function select(index:number){const option=options[index];if(option){onChange(option.value);setOpen(false);trigger.current?.focus();}}
  return <div className={`language-dropdown${variant ? ` language-dropdown-${variant}` : ""}`} ref={root}>
    <span id={`${id}-label`} hidden={hideLabel}>{label}</span>
    <button type="button" ref={trigger} title={triggerTitle} className="language-dropdown-trigger" role="combobox" aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open} aria-controls={`${id}-list`} aria-haspopup="listbox" aria-activedescendant={open ? `${id}-${focused}` : undefined} disabled={disabled} onClick={()=>open?setOpen(false):show()} onKeyDown={event=>{
      if(event.key==='Escape'){setOpen(false);event.preventDefault();}
      else if(event.key==='Tab')setOpen(false);
      else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();if(!open)show();else setFocused(index=>event.key==='Home'?0:event.key==='End'?options.length-1:(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length);}
      else if(event.key==='Enter'||event.key===' '){event.preventDefault();if(open)select(focused);else show();}
    }}><span id={`${id}-value`} title={icon?options[selected]?.label:undefined} style={options[selected]?.fontFamily?{fontFamily:options[selected].fontFamily}:undefined}>{icon||options[selected]?.label || placeholder}</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
    {open&&!disabled&&createPortal(<div ref={list} style={{...placement,...menuFont}} className={`language-dropdown-list language-dropdown-portal${variant ? ` language-dropdown-${variant}-list` : ""}`} id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`}>{options.map((option,index)=><Fragment key={option.value}>{option.group&&options[index-1]?.group!==option.group&&<strong className="format-group">{option.group}</strong>}<div id={`${id}-${index}`} role="option" aria-selected={option.value===value} title={option.description} className={focused===index?'focused':''} onPointerMove={()=>setFocused(index)} onClick={()=>select(index)}><span style={option.fontFamily?{fontFamily:option.fontFamily}:undefined}>{option.label}{option.description&&<small className="dropdown-option-description">{option.description}</small>}</span>{option.value===value&&<StudioIcon name="check"/>}</div></Fragment>)}</div>,root.current?.closest('dialog')||document.body)}
  </div>;
}

export function StyleDropdown({label,value,onChange,children}:{label:string;value:string;onChange:(event:{target:{value:string}})=>void;children:ReactNode}) {
  const options=Children.toArray(children).flatMap(child=>isValidElement<{value:string;children:ReactNode}>(child)?[{value:String(child.props.value),label:String(child.props.children)}]:[]);
  return <LanguageDropdown label={label} value={value} options={options} onChange={value=>onChange({target:{value}})} />;
}
