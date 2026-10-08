import {useRef} from 'react';
import {CaptionAccentControls} from './CaptionAccentControls';
import type {ReactNode} from 'react';
import type {CaptionSettings} from '../config/captions/types';
import {fontOptions,captionWeightOptions} from '../config/captions/fonts';
import {captionAnimations} from '../config/captions/animations';
import {LanguageDropdown} from './LanguageDropdown/LanguageDropdown';
import {ColorPicker} from './ColorPicker/ColorPicker';
import {SettingsPopover} from './SettingsPopover';
import {CaptionRange} from './CaptionRange';
import {StudioIcon} from './StudioIcon/StudioIcon';
import './CaptionStyleControls.scss';

type Props={settings:CaptionSettings;patch:(s:Partial<CaptionSettings>)=>void;secondary?:boolean;native:ReactNode;individual?:ReactNode};
export function CaptionStyleControls({settings:s,patch,secondary,native,individual}:Props){
 const lastDepth=useRef(s.textDepth||20);
 const choices=(label:string,key:keyof CaptionSettings,value:string,options:{value:string;label:string}[])=><div className="caption-animation-direct" role="group" aria-label={label}>{options.map(option=><button type="button" key={option.value} aria-pressed={value===option.value} onClick={()=>patch({[key]:option.value})}>{option.label}</button>)}</div>;
 const range=(key:keyof CaptionSettings,label:string,min:number,max:number,fallback:number,step=1,showLabel=true)=><label className="caption-popover-range" key={key}><span>{showLabel&&label} <b>{String(s[key]??fallback)}</b></span><CaptionRange settingKey={key} resetValue={fallback} aria-label={label} min={min} max={max} step={step} value={Number(s[key]??fallback)} onChange={e=>patch({[key]:Number(e.target.value),...(key==='backgroundOpacity'?{backgroundScope:s.backgroundScope&&s.backgroundScope!=='none'?s.backgroundScope:'caption'}:{})})}/></label>;
 const slider=(key:keyof CaptionSettings,label:string,min:number,max:number,fallback:number,step=1)=><SettingsPopover key={key} label={label} value={String(s[key]??fallback)}>{range(key,label,min,max,fallback,step,false)}</SettingsPopover>;
 const color=(key:keyof CaptionSettings,label:string,fallback:string)=><label key={key} className="caption-style-color"><span>{label}</span><ColorPicker value={String(s[key]??fallback)} onChange={e=>patch({[key]:e.target.value})}/></label>;
 const second=!!secondary;
 return <div className="caption-style-controls">
 <div className="caption-style-toolbar"><div className="caption-style-fonts"><LanguageDropdown label="Font" value={s.fontFamily} options={fontOptions.map(font=>({...font,fontFamily:font.value}))} onChange={fontFamily=>patch({fontFamily})}/></div> <SettingsPopover label="Poravnanje" icon={<StudioIcon name="alignCenter"/>}><div className="caption-alignment-boxes">{(['left','center','right'] as const).map((v,i)=><button type="button" key={v} aria-label={['Lijevo','Sredina','Desno'][i]} title={['Lijevo','Sredina','Desno'][i]} aria-pressed={s.alignment===v} onClick={()=>patch({alignment:v})}><StudioIcon name={v==='left'?'alignLeft':v==='right'?'alignRight':'alignCenter'}/></button>)}</div></SettingsPopover>
<SettingsPopover label="Razmaci" icon={<StudioIcon name="alignCenter"/>}>{range('letterSpacing','Razmak slova',-10,25,0)}{range('wordSpacing','Razmak riječi',-20,100,0)}</SettingsPopover><div className="caption-style-toggles">{([['underline','Podvlačenje','underline'],['uppercase','Velika slova','letterCase'],['behindPerson','Iza osobe','behindPerson']] as const).map(([key,label,icon])=><button type="button" key={key} title={label} aria-label={label} aria-pressed={!!s[key]} onClick={()=>patch({[key]:!s[key]})}><StudioIcon name={icon}/><span>{label}</span></button>)}</div></div>
 <div className="caption-style-sizing"> {slider('fontScale','Veličina fonta',40,600,100,5)}
 <LanguageDropdown label="Debljina fonta" value={String(s.fontWeight??0)} options={captionWeightOptions(s.fontFamily,s.fontWeight)} onChange={v=>patch({fontWeight:Number(v)||undefined})}/>

 {slider('outlineWidth','Okvir',0,24,0,.1)}{(s.outerOutlineWidth??0)>0&&slider('outerOutlineWidth','Drugi okvir',0,24,1.19,.1)}
</div>
 <div className="caption-style-fields">
 {color('textColor','Tekst','#ffffff')}{second&&color('backgroundColor','Pozadina','#000000')}{color('outlineColor','Okvir','#000000')}
 {(s.outerOutlineWidth??0)>0&&color('outerOutlineColor','Drugi okvir',s.outlineColor)}
 {second&&s.backgroundColor2&&color('backgroundColor2','Druga pozadina',s.backgroundColor)}
 {(s.outlineLayers??[]).map((layer,index)=><SettingsPopover key={index} label={`Dodatni okvir ${index+1}`} value={`${layer.width} px`}><ColorPicker value={layer.color} onChange={e=>patch({outlineLayers:s.outlineLayers?.map((item,i)=>i===index?{...item,color:e.target.value}:item)})}/><CaptionRange aria-label={`Debljina dodatnog okvira ${index+1}`} resetValue={0} min={0} max={24} step={.1} value={layer.width} onChange={e=>patch({outlineLayers:s.outlineLayers?.map((item,i)=>i===index?{...item,width:Number(e.target.value)}:item)})}/></SettingsPopover>)}
 {s.underline&&color('underlineColor','Linija','#ffdc52')}
 {second&&<SettingsPopover label="Prozirnost pozadine" value={`${100-(s.backgroundOpacity??0)}%`}><label className="caption-popover-range"><CaptionRange aria-label="Prozirnost pozadine" resetValue={100} min={0} max={100} value={100-(s.backgroundOpacity??0)} onChange={e=>patch({backgroundOpacity:100-Number(e.target.value),backgroundScope:s.backgroundScope&&s.backgroundScope!=='none'?s.backgroundScope:'caption'})}/></label></SettingsPopover>}
 </div>
 <div className="caption-style-quick-row two">
 <section className="caption-depth-card"><header><span>3D</span><button type="button" className="caption-depth-switch" role="switch" aria-label="3D" aria-checked={(s.textDepth??0)>0} onClick={()=>{if(s.textDepth)lastDepth.current=s.textDepth;patch({textDepth:(s.textDepth??0)>0?0:lastDepth.current});}}><span/></button></header>{(s.textDepth??0)>0&&<div className="caption-depth-body">{color('textDepthColor','Boja dubine','#172139')}{range('textDepth','Dubina',1,100,20,1)}</div>}</section>

 </div>
 <div className="caption-style-texture"><span>Tekstura</span><div className="caption-material-blocks" role="group" aria-label="Tekstura">{([['none','Bez'],['matte','Mat'],['metal','Metal'],['brushed','Brušeni'],['stone','Kamen'],['satin','Saten']] as const).map(([value,label])=><button type="button" key={value} aria-pressed={value==='none'?!(s.surfaceStrength??0):(s.surfaceStrength??0)>0&&(s.textMaterial??'matte')===value} onClick={()=>patch(value==='none'?{surfaceStrength:0}:{textMaterial:value,surfaceStrength:s.surfaceStrength||60})}>{label}</button>)}</div>{(s.surfaceStrength??0)>0&&<div className="caption-material-options">{(s.textMaterial==='metal'||s.textMaterial==='brushed'||s.textMaterial==='satin')&&color('surfaceColor','Boja presijavanja','#ffffff')}<div className="caption-style-sizing">{slider('surfaceOpacity','Vidljivost teksture',0,80,25)}{slider('surfaceStrength','Osvjetljenje',0,100,60)}{slider('surfaceBevel','Reljef rubova',0,100,35)}{slider('surfaceLightAngle','Smjer svjetla',-180,180,-45)}</div></div>}</div>

 <div className="caption-style-quick-row">
 {(['surfaceHighlight','surfaceShadow'] as const).map((key,i)=><SettingsPopover key={key} label={i?'Tamni rubovi':'Svijetli rubovi'} value={String(s[key]??(i?80:90))}><label className="caption-popover-range"><span>{i?'Tamni rubovi':'Svijetli rubovi'}</span><CaptionRange settingKey={key} resetValue={i?80:90} min={0} max={100} value={s[key]??(i?80:90)} onChange={e=>patch({[key]:Number(e.target.value),surfaceStrength:s.surfaceStrength||60})}/></label></SettingsPopover>)}
 <SettingsPopover label="Odsjaj" icon={<StudioIcon name="spark"/>}>{choices('Odsjaj preko slova','shineMode',s.shineMode??'none',[{value:'none',label:'Bez odsjaja'},{value:'sweep',label:'Jedan prolaz'},{value:'double',label:'Dvostruki'},{value:'diagonal',label:'Kosi'},{value:'ripple',label:'Valoviti'}])}{s.shineMode&&s.shineMode!=='none'&&<>{range('shineStrength','Jačina',0,100,55)}{range('shineWidth','Širina',0,100,40)}{range('shineSpeed','Brzina',.2,3,1,.1)}</>}</SettingsPopover>
 </div>
 <div className="caption-style-motion-row">
 <SettingsPopover label="Animacija" icon={<StudioIcon name="spark"/>}><div className="caption-animation-direct" role="group" aria-label="Animacija">{captionAnimations.map(option=><button type="button" key={option.value} aria-pressed={s.animation===option.value} onClick={()=>patch({animation:option.value})}>{option.label}</button>)}</div></SettingsPopover>
 <SettingsPopover label="Prikaz" icon={<StudioIcon name="captions"/>}>{choices('Prikaz riječi','wordMode',s.wordMode??'template',[{value:'template',label:'Prema stilu'},{value:'single',label:'Samo izgovorena riječ'},{value:'all',label:'Cijela rečenica'},{value:'spoken',label:'Izgovorene riječi ostaju'},{value:'highlight',label:'Naglasi izgovorenu'}])}{range('displayWordCount','Riječi u prikazu',1,12,4)}{range('wordsPerLine','Riječi u redu',1,12,4)}</SettingsPopover>
 <SettingsPopover label="Ulazak" icon={<StudioIcon name="arrow"/>}>{choices('Ulazak riječi','reveal',s.reveal??'none',[{value:'none',label:'Bez ulaska'},{value:'pop',label:'Iskakanje'},{value:'slideLeft',label:'Slijeva'},{value:'zoom',label:'Približavanje'},{value:'softBlur',label:'Iz magle'},{value:'slideFall',label:'Klizanje i pad'},{value:'rise',label:'Odozdo'},{value:'fade',label:'Fade'},{value:'letters',label:'Slovo po slovo'}])}{s.reveal==='fade'&&range('fadeFrom','Početna vidljivost',0,1,.4,.1)}</SettingsPopover>
 <SettingsPopover label="Broj riječi" icon={<StudioIcon name="splitWords"/>}>{range('revealGroupSize','Broj riječi pri ulasku',1,6,1)}</SettingsPopover>
 <SettingsPopover label="Kretanje" icon={<StudioIcon name="transitions"/>}>{choices('Kretanje i zaustavljanje','motionCurve',s.motionCurve??'linear',[{value:'linear',label:'Ravnomjerno'},{value:'smooth',label:'Blagi početak i zaustavljanje'},{value:'softStop',label:'Postepeno usporavanje'},{value:'spring',label:'Odskok i smirivanje'}])}</SettingsPopover>
 <SettingsPopover label="Trajanje" icon={<StudioIcon name="timelineShow"/>}>{range('revealDuration','Trajanje ulaska (s)',.08,1.2,.22,.02)}</SettingsPopover>
 </div>
 <CaptionAccentControls settings={s} patch={patch}/>
 <div className="caption-style-native">{native}</div>
 {individual}
 </div>;
}

