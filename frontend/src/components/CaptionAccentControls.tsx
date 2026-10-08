import type {CaptionSettings} from '../config/captions/types';
import {SettingsPopover} from './SettingsPopover';
import {CaptionRange} from './CaptionRange';
import {ColorPicker} from './ColorPicker/ColorPicker';
import {LanguageDropdown} from './LanguageDropdown/LanguageDropdown';
import {StudioIcon} from './StudioIcon/StudioIcon';

export function CaptionAccentControls({settings:s,patch}:{settings:CaptionSettings;patch:(value:Partial<CaptionSettings>)=>void}){
  const range=(key:keyof CaptionSettings,label:string,min:number,max:number,value:number,step=1)=><label className="caption-popover-range" key={key}><span>{label} <b>{Number(s[key]??value)}</b></span><CaptionRange settingKey={key} resetValue={value} aria-label={label} min={min} max={max} step={step} value={Number(s[key]??value)} onChange={e=>patch({[key]:Number(e.target.value)})}/></label>;
  return <SettingsPopover label="Dodatni pokret" icon={<StudioIcon name="transitions"/>}>
    <p>Neon Riot pokreti za cijeli titl. Možeš ih dodati bilo kojem stilu.</p>
    <LanguageDropdown label="Pokret cijelog titla" value={s.accentMotion??'none'} options={[{value:'none',label:'Bez dodatnog pokreta'},{value:'spring',label:'Elastični odskok'},{value:'slide',label:'Klizanje'},{value:'wave',label:'Val'},{value:'flip',label:'Okret'},{value:'zoom',label:'Zumiranje'},{value:'glitch',label:'Neonski trzaj'}]} onChange={value=>patch({accentMotion:value as CaptionSettings['accentMotion']})}/>
    {range('accentStrength','Jačina (%)',0,200,100)}
    {range('accentDuration','Trajanje ulaska (s)',.08,2,.56,.02)}
    <label><input type="checkbox" checked={!!s.accentTrails} onChange={e=>patch({accentTrails:e.target.checked})}/>Dvobojni trag pri ulasku</label>
    {s.accentTrails&&range('accentTrailDistance','Razmak tragova',0,60,17)}
    <label><input type="checkbox" checked={!!s.accentParticles} onChange={e=>patch({accentParticles:e.target.checked})}/>Čestice pri ulasku</label>
    {s.accentParticles&&range('accentParticleCount','Broj čestica',0,60,18)}
    {([['accentColor','Prva boja','#40edff'],['accentColor2','Druga boja','#ff4fc8']] as const).map(([key,label,value])=><label className="caption-style-color" key={key}><span>{label}</span><ColorPicker settingKey={key} value={s[key]??value} onChange={e=>patch({[key]:e.target.value})}/></label>)}
    <button type="button" onClick={()=>patch({accentMotion:'none',accentTrails:false,accentParticles:false})}>Isključi dodatne efekte</button>
  </SettingsPopover>;
}
