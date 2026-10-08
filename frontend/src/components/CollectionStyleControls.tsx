import {useEffect,useState,type SetStateAction} from 'react';
import type {CaptionSettings,StyleKey} from '../config/captions/types';
import {collectionDefinition,collectionControls,collectionLabel} from '../config/captions/collection';
import {motionPalettes} from '../config/captions/motion-collection';
import {HyperPalettes} from '../lib/collection/hyper-palettes.mjs';
import {collectionCaptionError,prepareCollectionStyle} from '../lib/collection-captions';
import {CaptionRange} from './CaptionRange';
import {LanguageDropdown} from './LanguageDropdown/LanguageDropdown';
import {ColorPicker} from './ColorPicker/ColorPicker';
import {SettingsPopover} from './SettingsPopover';

export function CollectionStyleControls({style,settings:s,onChange}:{style:StyleKey;settings:CaptionSettings;onChange:(action:SetStateAction<CaptionSettings>)=>void}){
 const definition=collectionDefinition(style),[error,setError]=useState('');
 useEffect(()=>{let live=true;void prepareCollectionStyle(style).catch(e=>{if(live)setError(e.message);});const timer=setInterval(()=>{if(live)setError(collectionCaptionError(style)||'');},1500);return()=>{live=false;clearInterval(timer);};},[style]);
 if(!definition)return null;
 const patch=(key:keyof CaptionSettings,value:string|number|boolean)=>onChange(old=>({...old,[key]:value}));
 const candy=['collectionHyperMarks','collectionHyperPop','collectionJuiceJam'].includes(style);
 const palette=HyperPalettes[s.collectionPalette||'candy']||HyperPalettes.candy;
 const motionPalette=motionPalettes[definition[1]];
 let customColors:Record<string,string>={};
 try{const parsed:unknown=JSON.parse(s.collectionColors||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))customColors=Object.fromEntries(Object.entries(parsed).filter(([,v])=>typeof v==='string'&&/^#[\da-f]{6}$/i.test(v)));}catch{/* Default palette remains available for older projects. */}
 const labels:Record<string,string>={font:'Tekst',secondaryFont:'Sporedni tekst',depth:'Dubina',accent:'Naglasak',highlight:'Odsjaj',panel:'Podloga teksta',fold:'Preklop',background:'Pozadina',border:'Kontura',shadow:'Sjena',surface:'Površina vode',rim:'Rub vode',specular:'Odraz svjetla',ripple:'Valovi',crust:'Kora lave',hot:'Žar',hottest:'Vreli dijelovi',glow:'Sjaj',side:'Bočne strane'};
 const range=(key:keyof CaptionSettings,label:string,min:number,max:number,step:number,initial:number)=><label className="caption-popover-range" key={key}><span>{label} <b>{Number(s[key]??initial)}</b></span><CaptionRange settingKey={key} resetValue={initial} aria-label={label} min={min} max={max} step={step} value={Number(s[key]??initial)} onChange={e=>patch(key,Number(e.target.value))}/></label>;
 return <div className="caption-effect-controls collection-style-controls">
  <p className="preset-empty"><strong>{definition[2]}</strong><br/>{collectionLabel(style)} · {motionPalette?'Paleta i animacija iz tvog paketa':'Originalni font i materijal'}</p>
  {error&&<p role="alert" className="preset-empty">{error}</p>}
  {motionPalette&&<><div className="collection-palette-control"><span>Paleta stila</span><div className="collection-palette-swatches">{Object.entries(motionPalette).filter(([key])=>!key.startsWith('background')).slice(0,8).map(([key,color])=><span key={key} title={key} style={{backgroundColor:customColors[key]||color}}/>)}</div><button type="button" className="caption-reset-format" onClick={()=>patch('collectionColors','{}')}>Vrati originalnu paletu</button></div>{Object.entries(motionPalette).filter(([key])=>!key.startsWith('background')||s.collectionBackdrop).map(([key,color])=><label className="caption-style-color" key={key}><span>{labels[key.replace(/\d+$/,'')]||key}{key.match(/\d+$/)?` ${key.match(/\d+$/)![0]}`:''}</span><ColorPicker value={customColors[key]||color} onChange={event=>patch('collectionColors',JSON.stringify({...customColors,[key]:event.target.value}))}/></label>)}</>}
  {candy&&<><div className="collection-palette-control"><LanguageDropdown label="Paleta boja" value={s.collectionPalette||'candy'} options={Object.entries(HyperPalettes).map(([value,p])=>({value,label:p.label}))} onChange={value=>patch('collectionPalette',value)}/><div className="collection-palette-swatches" aria-label={palette.label}>{palette.colors.map(color=><span key={color} title={color} style={{backgroundColor:color}}/>)}</div></div><LanguageDropdown label="Font glavne riječi" value={s.collectionFont||'comic'} options={[{value:'comic',label:'Comic Bomb'},{value:'bubble',label:'Bubble Boss'},{value:'block',label:'Arcade Block'}]} onChange={value=>patch('collectionFont',value)}/></>}
  {style==='collectionHyperMarks'&&<LanguageDropdown label="Naglasci" value={s.collectionMark||'auto'} options={Object.entries({auto:'Miks po riječima',underline:'Podvlaka',frame:'Iscrtani okvir',marker:'3D marker',orbit:'Kružni potez',brackets:'Uglovi i skener',burst:'Linije i bljesak'}).map(([value,label])=>({value,label}))} onChange={value=>patch('collectionMark',value)}/>}
  {style==='collectionForged'&&<LanguageDropdown label="Paleta metala" value={s.collectionMaterial||'ice'} options={Object.entries({gold:'Zlatna',silver:'Srebrna',ice:'Ledena',violet:'Ljubičasta',ruby:'Crvena',emerald:'Zelena',copper:'Bakrena',pink:'Ružičasta'}).map(([value,label])=>({value,label}))} onChange={value=>patch('collectionMaterial',value)}/>}
  {definition[4]===0&&<label className="caption-style-color"><span>Boja naglaska</span><ColorPicker settingKey="highlightColor" value={s.highlightColor} onChange={e=>patch('highlightColor',e.target.value)}/></label>}
  {collectionControls(style).map(control=>range(control.key,control.label,control.min,control.max,control.step,control.initial))}
  {['collectionPrismBloom','collectionInkRiot','collectionForged','collectionMagmaCore','collectionAbyssalPearl','collectionVelvetPulse','collectionPorcelainFlow','collectionLaserTrace'].includes(style)&&<label><input type="checkbox" checked={s.collectionDecorations!==false} onChange={e=>patch('collectionDecorations',e.target.checked)}/>{({collectionPrismBloom:'Lebdeći kristali',collectionInkRiot:'Kapljice tinte',collectionForged:'Iskre',collectionMagmaCore:'Iskre i komadići',collectionAbyssalPearl:'Stakleni mjehurići',collectionVelvetPulse:'Vlakna baršuna',collectionPorcelainFlow:'Zlatne pukotine',collectionLaserTrace:'Električni lukovi'} as Record<string,string>)[style]}</label>}
  {definition[4]!==0&&style!=='collectionFusionCaps'&&<label><input type="checkbox" checked={s.collectionBackdrop===true} onChange={e=>patch('collectionBackdrop',e.target.checked)}/>Prikaži pozadinu reference</label>}
  <SettingsPopover label="Veličina i položaj">{range('fontScale','Veličina (%)',25,200,1,100)}{range('textOpacity','Vidljivost (%)',0,100,1,100)}{range('x','Vodoravno (%)',0,100,1,50)}{range('y','Uspravno (%)',0,100,1,65)}{range('rotation','Rotacija (°)',-45,45,1,0)}</SettingsPopover>
 </div>;
}
