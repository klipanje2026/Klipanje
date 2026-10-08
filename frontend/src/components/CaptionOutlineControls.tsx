import {SettingsPopover} from './SettingsPopover';
import {CaptionRange} from './CaptionRange';
import {useState,useId} from 'react';
import {CaptionEffectChoices} from './CaptionEffectChoices';
import {StudioIcon} from './StudioIcon/StudioIcon';
import type {CaptionSettings} from '../config/captions/types';
import {ColorPicker} from './ColorPicker/ColorPicker';
function OutlineWidth({value,onChange,label,max=48,primary=false}:{value:number;onChange:(value:number)=>void;label:string;max?:number;primary?:boolean}){
 return <SettingsPopover label={label} value={value+' px'}><label className="caption-popover-range"><span>{label} <b>{value} px</b></span><CaptionRange settingKey={primary?'outlineWidth':undefined} resetValue={0} aria-label={label} min={0} max={max} step={.1} value={value} onChange={e=>onChange(Number(e.target.value))}/></label></SettingsPopover>;
}
export function CaptionOutlineControls({settings,patch,onEdit}:{settings:CaptionSettings;patch:(value:Partial<CaptionSettings>)=>void;onEdit?:(effect:string)=>void}){
 const [openOutline,setOpenOutline]=useState<number|null>(null);
 const menuId=useId();
 const layers=(settings.outlineLayers??[]).slice(0,2),primary=settings.outlineWidth>0;
 const update=(index:number,value:Partial<NonNullable<CaptionSettings['outlineLayers']>[number]>)=>{if(value.width===0){patch({customOutline:true,outlineLayers:layers.filter((_,i)=>i!==index)});setOpenOutline(null);}else patch({customOutline:true,outlineLayers:layers.map((layer,i)=>i===index?{...layer,...value,gradient:false}:layer)});};
 const add=()=>{if(layers.length<2)patch({customOutline:true,outlineLayers:[...layers,{color:settings.highlightColor,width:Math.min(48,Math.max(settings.outlineWidth,...layers.map(layer=>layer.width))+2)}]});};
 const typeButton=(index:number)=><button type="button" className="caption-outline-type-trigger" data-active={(index===0?settings.outlineWidth:(layers[index-1]?.width??0))>0} aria-label={'Vrsta okvira'+(index?' '+(index+1):'')} title={'Vrsta okvira'+(index?' '+(index+1):'')} aria-expanded={openOutline===index} aria-controls={menuId+'-'+index} onClick={()=>setOpenOutline(current=>current===index?null:index)}><StudioIcon name="frame"/><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg></button>;
 const typeMenu=(index:number)=>openOutline===index&&<div id={menuId+'-'+index} className="caption-outline-type-menu" onKeyDown={event=>{if(event.key==='Escape'){setOpenOutline(null);event.currentTarget.parentElement?.querySelector<HTMLButtonElement>('.caption-outline-type-trigger')?.focus();}}}><header>Vrsta okvira · Okvir{index?' '+(index+1):''}</header><CaptionEffectChoices mode="outline" value={(index===0?settings.outlineWidth:layers[index-1]?.width)?((index===0?settings.outlineStyle:layers[index-1]?.style)??'solid'):''} onChange={value=>{
  const style=value as NonNullable<CaptionSettings['outlineStyle']>;
  if(index===0){const selected=settings.outlineWidth>0&&(settings.outlineStyle??'solid')===style;patch({customOutline:true,outlineStyle:style,outlineWidth:selected?0:settings.outlineWidth||2});}
  else {const layer=layers[index-1],selected=layer.width>0&&(layer.style??'solid')===style;update(index-1,{style,width:selected?0:layer.width||2});}
 }}/></div>;
 const addButton=<button type="button" className="caption-add-outline" onClick={add}>+ Dodaj okvir</button>;
 return <div className="caption-outline-controls">
  <div className="caption-text-format-row">
   <label className="caption-basic-range"><span>Opacity teksta <b>{settings.textOpacity??100}%</b></span><CaptionRange hideReset settingKey="textOpacity" resetValue={100} aria-label="Opacity teksta" type="range" min="0" max="100" value={settings.textOpacity??100} onChange={e=>patch({textOpacity:Number(e.target.value)})}/></label>
   <div className="caption-format-buttons" role="group" aria-label="Izgled slova"><button type="button" title="Podebljano" aria-label="Podebljano" aria-pressed={(settings.fontWeight??400)>=700} onClick={()=>{patch({fontWeight:(settings.fontWeight??400)>=700?400:700});}}><b>B</b></button><button type="button" title="Kurziv" aria-label="Kurziv" aria-pressed={!!settings.italic} onClick={()=>{patch({italic:!settings.italic});}}><i>I</i></button><button type="button" title="Podvučeno" aria-label="Podvučeno" aria-pressed={!!settings.textUnderline} onClick={()=>{patch({textUnderline:!settings.textUnderline});if(!settings.textUnderline)onEdit?.('underline');}}><u>U</u></button><button type="button" title="Precrtan tekst" aria-label="Precrtan tekst" aria-pressed={!!settings.textStrike} onClick={()=>{patch({textStrike:!settings.textStrike});if(!settings.textStrike)onEdit?.('strike');}}><s>S</s></button><button type="button" title="Velika slova" aria-label="Velika slova" aria-pressed={!!settings.uppercase} onClick={()=>{patch({uppercase:!settings.uppercase});}}>Aa</button><button type="button" title="Tekst iza osobe" aria-label="Tekst iza osobe" aria-pressed={!!settings.behindPerson} onClick={()=>{patch({behindPerson:!settings.behindPerson});}}><StudioIcon name="behindPerson"/></button></div>

  </div>
  <span className="caption-fill-label caption-outline-heading">Okvir</span>
  <div className="caption-outline-edit-row">
   <OutlineWidth primary label="Debljina okvira" value={settings.outlineWidth} max={24} onChange={outlineWidth=>patch({customOutline:true,outlineGradient:false,outlineWidth})}/>
   <div className={`caption-outline-color${primary?'':' is-unconfigured'}`}><span>Boja okvira</span><ColorPicker settingKey="outlineColor" value={settings.outlineColor} onChange={e=>patch({customOutline:true,outlineGradient:false,outlineWidth:settings.outlineWidth||2,outlineColor:e.target.value})}/></div>
   <div className="caption-outline-row-actions">{typeButton(0)}{layers.length===0&&addButton}</div>
   {typeMenu(0)}
  </div>
  {layers.map((layer,index)=><div className="caption-outline-edit-row" key={index}>
   <OutlineWidth label={'Okvir '+(index+2)} value={layer.width} onChange={width=>update(index,{width})}/>
   <div className="caption-outline-color"><span>Boja okvira</span><ColorPicker value={layer.color} onChange={e=>update(index,{color:e.target.value})}/></div>
   <div className="caption-outline-row-actions">{typeButton(index+1)}<button type="button" className="caption-outline-remove" title="Ukloni okvir" aria-label={'Ukloni okvir '+(index+2)} onClick={()=>{patch({outlineLayers:layers.filter((_,i)=>i!==index)});setOpenOutline(null);}}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>{index===layers.length-1&&layers.length<2&&addButton}</div>
   {typeMenu(index+1)}
  </div>)}
 </div>;
}
