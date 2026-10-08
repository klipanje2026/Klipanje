import type {SetStateAction} from 'react';
import type {CaptionSettings,StyleKey} from '../config/captions/types';
import {CaptionRange} from './CaptionRange';
import {ColorPicker} from './ColorPicker/ColorPicker';
import {LanguageDropdown} from './LanguageDropdown/LanguageDropdown';
import {SettingsPopover} from './SettingsPopover';

export function SignatureStyleControls({style,settings:s,onChange}:{style:StyleKey;settings:CaptionSettings;onChange:(action:SetStateAction<CaptionSettings>)=>void}){
  if(style!=='orbitSignal'&&style!=='velvetScript')return null;
  const orbit=style==='orbitSignal',wordKey=orbit?'orbitWords':'velvetWords';
  const range=(key:keyof CaptionSettings,label:string,min:number,max:number,value:number,step=1)=><label className="caption-popover-range" key={key}><span>{label} <b>{Number(s[key]??value)}</b></span><CaptionRange settingKey={key} resetValue={value} aria-label={label} min={min} max={max} step={step} value={Number(s[key]??value)} onChange={e=>onChange(old=>({...old,[key]:Number(e.target.value)}))}/></label>;
  const toggle=(key:keyof CaptionSettings,label:string)=><label key={key}><input type="checkbox" checked={s[key]!==false} onChange={e=>onChange(old=>({...old,[key]:e.target.checked}))}/>{label}</label>;
  const swatch=(key:keyof CaptionSettings,label:string,value:string)=><label className="caption-style-color" key={key}><span>{label}</span><ColorPicker settingKey={key} value={String(s[key]??value)} onChange={e=>onChange(old=>({...old,[key]:e.target.value}))}/></label>;
  return <>
    <p className="preset-empty"><strong>{orbit?'Orbit Signal':'Velvet Script'}</strong><br/>{orbit?'Orbitalni ulazak riječi, lukovi i svjetlosne tačke.':'Rukopisno otkrivanje, zlatni odsjaj i linija potpisa.'}</p>
    <LanguageDropdown label="Riječi u frazi" value={String(s[wordKey]??3)} options={[2,3,4,5,6].map(n=>({value:String(n),label:String(n)}))} onChange={value=>onChange(old=>({...old,[wordKey]:Number(value),wordMode:'template',displayWordCount:undefined}))}/>
    {swatch('textColor','Slova',orbit?'#f2fbff':'#fff5e5')}
    {swatch('highlightColor',orbit?'Boja signala':'Boja zlata',orbit?'#4ee1c6':'#e8be7a')}
    {orbit?swatch('orbitColor2','Druga orbitalna boja','#ffb573'):swatch('velvetShadowColor','Sjena rukopisa','#342034')}
    {orbit?<SettingsPopover label="Orbite i ulazak">
      {range('orbitEntry','Jačina orbitalnog ulaska (%)',0,180,100)}
      {range('revealDuration','Trajanje ulaska (s)',.08,1.5,.5,.02)}
      {range('orbitSpeed','Brzina orbite',0,3,1,.1)}
      {range('orbitRadius','Veličina orbite (%)',60,150,100)}
      {range('orbitSatellites','Broj svjetlosnih tačaka',0,5,2)}
      {range('orbitGlow','Sjaj tačaka (%)',0,100,50)}
      {toggle('orbitRings','Orbitalni lukovi')}{toggle('orbitDashes','Isprekidani lukovi')}{toggle('orbitLeader','Linija ispod riječi')}
    </SettingsPopover>:<SettingsPopover label="Rukopis i potpis">
      {toggle('velvetWrite','Postepeno otkrivanje rukopisa')}
      {range('revealDuration','Trajanje otkrivanja (s)',.12,2,.7,.02)}
      {toggle('velvetPenGlow','Svjetlo na vrhu pera')}
      {toggle('velvetFlourish','Linija potpisa')}
      {range('velvetFlourishWidth','Širina potpisa (%)',50,160,105)}
      {range('scriptDrawDuration','Iscrtavanje potpisa (s)',.15,1.5,.65,.05)}
      {range('shineStrength','Jačina zlatnog odsjaja (%)',0,100,65)}
      {range('shineSpeed','Brzina odsjaja',.1,3,.6,.1)}
    </SettingsPopover>}
  </>;
}
