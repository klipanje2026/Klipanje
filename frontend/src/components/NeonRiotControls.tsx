import type {SetStateAction} from 'react';
import type {CaptionSettings, StyleKey} from '../config/captions/types';
import {isNeonRiotStyle, neonRiotVariant, neonRiotVariants} from '../config/captions/neon-riot-variants';
import {ColorPicker} from './ColorPicker/ColorPicker';
import {CaptionRange} from './CaptionRange';
import {LanguageDropdown} from './LanguageDropdown/LanguageDropdown';
import {SettingsPopover} from './SettingsPopover';

export function NeonRiotControls({style,settings,onChange}:{style:StyleKey;settings:CaptionSettings;onChange:(update:SetStateAction<CaptionSettings>)=>void}) {
  if (!isNeonRiotStyle(style)) return null;
  const variant = neonRiotVariant(style);
  const number = String(neonRiotVariants.findIndex(item => item.key === style) + 1).padStart(2,'0');
  const paletteKeys = ['highlightColor','riotColor2','riotColor3','riotColor4','riotColor5'] as const;
  const range=(key:keyof CaptionSettings,label:string,min:number,max:number,fallback:number,step=1)=><label className="caption-popover-range" key={key}><span>{label} <b>{Number(settings[key]??fallback)}</b></span><CaptionRange settingKey={key} resetValue={fallback} aria-label={label} min={min} max={max} step={step} value={Number(settings[key]??fallback)} onChange={e=>onChange(s=>({...s,[key]:Number(e.target.value)}))}/></label>;
  return <>
    <p className="preset-empty"><strong>Neon Riot · {number} {variant.name}</strong><br/>
      {style === 'neonRiot' ? 'Original iz demo videa.' : 'Varijanta originalnog Neon Riot stila.'} Sve varijante su u Stilovi → Neon Riot.
    </p>
    <LanguageDropdown label="Pokret slova" value={settings.riotMotion ?? variant.motion}
      options={[{value:'spring',label:'Elastični odskok · Original'},{value:'slide',label:'Klizanje'},{value:'wave',label:'Val'},{value:'flip',label:'Okret slova'},{value:'zoom',label:'Zumiranje'},{value:'glitch',label:'Neonski trzaj'}]}
      onChange={value => onChange(s => ({...s,riotMotion:value as CaptionSettings['riotMotion']}))}/>
    <LanguageDropdown label="Riječi u frazi" value={String(settings.riotWords ?? 3)}
      options={[2,3,4,5,6].map(n => ({value:String(n),label:String(n)}))}
      onChange={value => onChange(s => ({...s,riotWords:Number(value),wordMode:'template',displayWordCount:undefined}))}/>
    <label className="subtitle-size-control"><span>Jačina pokreta <b>{settings.riotMotionStrength ?? 100}%</b></span>
      <CaptionRange settingKey="riotMotionStrength" resetValue={100} aria-label="Jačina Neon Riot pokreta" min={0} max={200}
        value={settings.riotMotionStrength ?? 100} onChange={e => onChange(s => ({...s,riotMotionStrength:Number(e.target.value)}))}/>
    </label>
    <label className="subtitle-size-control"><span>Razmak ulaska slova <b>{Math.round((settings.riotLetterDelay ?? .025)*1000)} ms</b></span>
      <CaptionRange settingKey="riotLetterDelay" resetValue={.025} aria-label="Razmak ulaska slova" min={0} max={.08} step={.005}
        value={settings.riotLetterDelay ?? .025} onChange={e => onChange(s => ({...s,riotLetterDelay:Number(e.target.value)}))}/>
    </label>
    {paletteKeys.map((key,index) => <label key={key}><span>Paleta · boja {index+1}</span>
      <ColorPicker settingKey={key} value={settings[key] ?? variant.colors[index]}
        onChange={e => onChange(s => ({...s,[key]:e.target.value}))}/>
    </label>)}
    <label><span>Boja kutije</span><ColorPicker settingKey="backgroundColor" value={settings.backgroundColor || variant.box}
      onChange={e => onChange(s => ({...s,backgroundColor:e.target.value}))}/></label>
    {([['riotBoxes','Kutije iza početnih riječi'],['riotParticles','Neonske čestice'],['riotUnderline','Animirana linija ispod riječi']] as const).map(([key,label]) =>
      <label key={key}><input type="checkbox" checked={settings[key] !== false} onChange={e => onChange(s => ({...s,[key]:e.target.checked}))}/>{label}</label>)}
    <SettingsPopover label="Odskok i tragovi">
      {range('riotDamping','Brzina smirivanja',3,15,7.5,.5)}
      {range('riotFrequency','Broj oscilacija',4,20,11.5,.5)}
      {range('riotTilt','Nagib riječi (%)',0,200,100)}
      {range('riotFloat','Lagano plutanje (%)',0,200,100)}
      {range('riotExitDuration','Trajanje izlaska (s)',.04,1,.32,.02)}
      <label><input type="checkbox" checked={settings.riotTrails!==false} onChange={e=>onChange(s=>({...s,riotTrails:e.target.checked}))}/>Obojeni tragovi slova</label>
      {range('riotTrailStrength','Vidljivost tragova (%)',0,100,100)}
      {([['riotTrailColor1','Lijevi trag','#40edff'],['riotTrailColor2','Desni trag','#ff4fc8']] as const).map(([key,label,value])=><label key={key}><span>{label}</span><ColorPicker settingKey={key} value={settings[key]??value} onChange={e=>onChange(s=>({...s,[key]:e.target.value}))}/></label>)}
    </SettingsPopover>
    <SettingsPopover label="Čestice i izgled">
      {range('riotParticleCount','Broj čestica',0,60,18)}
      {range('riotSpread','Rasipanje čestica (%)',0,200,100)}
      {range('riotParticleDuration','Trajanje čestica (s)',.3,2,1.15,.05)}
      {range('riotBoxRadius','Zaobljenje kutije',0,40,13)}
      {range('riotUnderlineWidth','Debljina linije',.5,12,5,.5)}
      {range('riotUnderlineDuration','Iscrtavanje linije (s)',.1,1,.42,.02)}
      <label><span>Boja linije</span><ColorPicker settingKey="underlineColor" value={settings.underlineColor??settings.highlightColor} onChange={e=>onChange(s=>({...s,underlineColor:e.target.value}))}/></label>
      <label><input type="checkbox" checked={settings.riotGradient!==false} onChange={e=>onChange(s=>({...s,riotGradient:e.target.checked}))}/>Preljev na slovima</label>
      {range('riotGlow','Sjaj ruba (%)',0,200,100)}
    </SettingsPopover>
  </>;
}
