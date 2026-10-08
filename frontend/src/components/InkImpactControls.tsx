import type {SetStateAction} from 'react';
import type {CaptionSettings,StyleKey} from '../config/captions/types';
import {CaptionRange} from './CaptionRange';
import {ColorPicker} from './ColorPicker/ColorPicker';
import {LanguageDropdown} from './LanguageDropdown/LanguageDropdown';
import {SettingsPopover} from './SettingsPopover';

export function InkImpactControls({style,settings:s,onChange}:{style:StyleKey;settings:CaptionSettings;onChange:(action:SetStateAction<CaptionSettings>)=>void}){
  if(style!=='inkImpact')return null;
  const range=(key:keyof CaptionSettings,label:string,min:number,max:number,value:number,step=1)=><label className="caption-popover-range" key={key}><span>{label} <b>{Number(s[key]??value)}</b></span><CaptionRange settingKey={key} resetValue={value} aria-label={label} min={min} max={max} step={step} value={Number(s[key]??value)} onChange={e=>onChange(old=>({...old,[key]:Number(e.target.value)}))}/></label>;
  const toggle=(key:'inkBrush'|'inkSplatter'|'inkUnderline',label:string)=><label><input type="checkbox" checked={s[key]!==false} onChange={e=>onChange(old=>({...old,[key]:e.target.checked}))}/>{label}</label>;
  return <>
    <p className="preset-empty"><strong>Ink Impact</strong><br/>Riječi kao otisak tinte. Završna riječ dobija marker, a ulazak kratki udarac i kapljice.</p>
    <LanguageDropdown label="Riječi u otisku" value={String(s.inkWords??3)} options={[2,3,4,5].map(n=>({value:String(n),label:String(n)}))} onChange={value=>onChange(old=>({...old,inkWords:Number(value),wordMode:'template',displayWordCount:undefined}))}/>
    {([['textColor','Slova','#fff1dc'],['inkBrushTextColor','Slova na markeru','#19151a'],['highlightColor','Prvi marker','#ffd34e'],['inkColor2','Drugi marker','#ff6e49']] as const).map(([key,label,value])=><label className="caption-style-color" key={key}><span>{label}</span><ColorPicker settingKey={key} value={s[key]??value} onChange={e=>onChange(old=>({...old,[key]:e.target.value}))}/></label>)}
    <SettingsPopover label="Otisak i pokret">
      {range('inkImpact','Jačina udarca (%)',0,180,100)}
      {range('revealDuration','Trajanje ulaska (s)',.06,1,.24,.02)}
      {range('inkExitDuration','Brisanje otiska (s)',.04,.8,.2,.02)}
      {range('inkTilt','Nagib riječi (%)',0,200,100)}
      {range('inkRowGap','Razmak redova',-10,30,5)}
    </SettingsPopover>
    <SettingsPopover label="Marker i tekstura">
      {toggle('inkBrush','Marker iza završne riječi')}
      {toggle('inkUnderline','Potez ispod markera')}
      {range('inkRoughness','Neravni rubovi (%)',0,100,65)}
      {range('inkGrain','Tekstura otiska (%)',0,100,60)}
      {range('backgroundOpacity','Vidljivost markera (%)',0,100,100)}
    </SettingsPopover>
    <SettingsPopover label="Kapljice tinte">
      {toggle('inkSplatter','Kapljice pri udarcu')}
      {range('inkDrops','Broj kapljica',0,40,16)}
      {range('inkSpread','Rasipanje (%)',0,180,100)}
    </SettingsPopover>
  </>;
}
