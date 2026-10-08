import type {SetStateAction} from 'react';
import type {CaptionSettings,StyleKey} from '../config/captions/types';
import {CaptionRange} from './CaptionRange';
import {ColorPicker} from './ColorPicker/ColorPicker';
import {LanguageDropdown} from './LanguageDropdown/LanguageDropdown';

export function PrismFoldControls({style,settings:s,onChange}:{style:StyleKey;settings:CaptionSettings;onChange:(action:SetStateAction<CaptionSettings>)=>void}){
  if(style!=='prismFold')return null;
  const range=(key:keyof CaptionSettings,label:string,min:number,max:number,value:number,step=1)=><label className="subtitle-size-control" key={key}><span>{label} <b>{Number(s[key]??value)}</b></span><CaptionRange settingKey={key} resetValue={value} aria-label={label} min={min} max={max} step={step} value={Number(s[key]??value)} onChange={e=>onChange(old=>({...old,[key]:Number(e.target.value)}))}/></label>;
  return <>
    <p className="preset-empty"><strong>Prism Fold · novi zaseban stil</strong><br/>Staklene pločice otvaraju se u trakama. Materijal i odsjaj podešavaš i kroz postojeće kontrole.</p>
    <LanguageDropdown label="Riječi u frazi" value={String(s.foldWords??3)} options={[2,3,4,5,6].map(n=>({value:String(n),label:String(n)}))} onChange={value=>onChange(old=>({...old,foldWords:Number(value),wordMode:'template',displayWordCount:undefined}))}/>
    {range('foldSlices','Broj traka',2,10,4)}
    {range('foldStrength','Otvaranje pločica (%)',0,150,100)}
    {range('foldStagger','Razmak otvaranja traka (s)',0,.15,.045,.005)}
    {range('foldBeamSpeed','Brzina svjetlosnog prelaza',.2,3,1,.1)}
    {([['highlightColor','Ledena boja','#72f5ef'],['foldColor2','Biserna boja','#a98aff'],['backgroundColor','Staklo','#14283b']] as const).map(([key,label,value])=><label key={key}><span>{label}</span><ColorPicker settingKey={key} value={s[key]??value} onChange={e=>onChange(old=>({...old,[key]:e.target.value}))}/></label>)}
    {([['foldBeam','Svjetlosni prelaz'],['foldRim','Osvijetljeni rubovi'],['foldEcho','Prozirni odraz pločice']] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={s[key]!==false} onChange={e=>onChange(old=>({...old,[key]:e.target.checked}))}/>{label}</label>)}
  </>;
}
