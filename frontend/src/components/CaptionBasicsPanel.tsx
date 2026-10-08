import {CaptionDepthEffects} from './CaptionDepthEffects';
import {CaptionSpecialEffects,CaptionSurfaceLighting} from './CaptionSpecialEffects';
import {useContext} from 'react';
import {CaptionDefaults} from './caption-defaults';
import {CaptionRange} from './CaptionRange';
import {CaptionLightEffects,CaptionBlurControl} from './CaptionLightEffects';
import {CaptionTextureEffects} from './CaptionTextureEffects';
import {CaptionLineEditor} from './CaptionEffectChoices';
import {CaptionDisplayControls} from './CaptionDisplayControls';
import {CaptionLayoutControls} from './CaptionLayoutControls';
import {CaptionOutlineControls} from './CaptionOutlineControls';
import {CaptionFontSizeInput} from './CaptionFontSizeInput';
import {useState,useEffect,useLayoutEffect,useRef,useId} from 'react';
import {CaptionAnimationPicker} from './CaptionAnimationPicker';
import type {SetStateAction,ReactNode} from 'react';
import type {CaptionSettings} from '../config/captions/types';
import {fontOptions,captionWeightOptions} from '../config/captions/fonts';
import {LanguageDropdown} from './LanguageDropdown/LanguageDropdown';
import {ColorPicker} from './ColorPicker/ColorPicker';
import './CaptionBasicsPanel.scss';
import './CaptionSections.scss';
import {StudioIcon} from './StudioIcon/StudioIcon';
const advancedGroups=[['shadows','Sjene i sjaj','filters'],['textures','Teksture i ispune','elements'],['special','Specijalni efekti','spark'],['depth','3D','copy']] as const;

type SectionKey='style'|'display'|'text'|'layout'|'animation'|'borders';
const sectionLinks=[['style','Efekti stila','spark'],['display','Prikaz i poravnanja','alignCenter'],['text','Tekst i boje','text'],['layout','Pozadine','frame'],['animation','Animacije','transitions'],['borders','Okviri · Borders','frame']] as const;
function CaptionSection({section,title,roleLabel,open,onToggle,onJump,children}:{section:SectionKey;title:string;roleLabel:string;open:boolean;onToggle:()=>void;onJump:(section:SectionKey)=>void;children:ReactNode}){
 const id=useId(),sentinel=useRef<HTMLDivElement>(null),[stuck,setStuck]=useState(false);
 useEffect(()=>{const node=sentinel.current;if(!node||!open){setStuck(false);return;}const root=node.closest('.subtitle-inspector-panel,.video-caption-tab-body'),offset=parseFloat(getComputedStyle(node.closest('.caption-sections-workspace')!).getPropertyValue('--section-sticky-top'))||0;const observer=new IntersectionObserver(([entry])=>setStuck(!entry.isIntersecting),{root,rootMargin:`-${offset}px 0px 0px 0px`,threshold:0});observer.observe(node);return()=>observer.disconnect();},[open]);
 return <details className={`caption-inline-section${stuck?' is-stuck':''}`} data-section={section} open={open}>
  <summary aria-expanded={open} aria-controls={id} onClick={event=>{event.preventDefault();onToggle();}}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg><span className="caption-section-heading-icon" aria-hidden="true"><StudioIcon name={sectionLinks.find(([key])=>key===section)![2]}/></span><span>{title}{section!=='style'&&<small> – {roleLabel}</small>}</span>{open&&section!=='style'&&<span className="caption-section-shortcuts">{sectionLinks.filter(([key])=>key!==section).map(([key,label,icon])=><button type="button" key={key} title={label} aria-label={'Otvori '+label} onClick={event=>{event.preventDefault();event.stopPropagation();onJump(key);}}><StudioIcon name={icon}/></button>)}</span>}</summary>
  {open&&<div id={id} className="caption-inline-content"><div ref={sentinel} className="caption-section-sentinel" aria-hidden="true"/>{children}</div>}
 </details>;
}

/** Shared controls change only the selected property, preserving each preset's identity. */
export function CaptionBasicsPanel({styleEffects,settings,onChange,role,openSection,allowOutlines=true,allowLayout=true}:{styleEffects?:ReactNode;allowLayout?:boolean;allowOutlines?:boolean;allowImportant?:boolean;allowTitles?:boolean;role:'ordinary'|'important'|'titles';onRole:(role:'ordinary'|'important'|'titles')=>void;openSection?:{view:'menu'|'text'|'animation'|'style';id:number};settings:CaptionSettings;onChange:(action:SetStateAction<CaptionSettings>)=>void}){
 const original=useContext(CaptionDefaults);
 const effectPanel=useRef<HTMLDivElement>(null);
 const [special,setSpecial]=useState('underline');
 const openEffect=(effect:string)=>{if(effect==='underline'||effect==='strike'){setSpecial(effect);setAdvanced('special');}else setAdvanced(effect);requestAnimationFrame(()=>{(effectPanel.current?.querySelector(`[data-effect="${effect}"]`)??effectPanel.current)?.scrollIntoView({block:'nearest',behavior:'smooth'});effectPanel.current?.focus({preventScroll:true});});};
 const [advanced,setAdvanced]=useState<string|null>(null);
 const [view,setView]=useState<SectionKey|null>('style');
 const [showAll,setShowAll]=useState(false);
 const workspace=useRef<HTMLElement>(null);
 useLayoutEffect(()=>{const root=workspace.current,head=root?.querySelector<HTMLElement>('.caption-basics-sticky-head');if(!root)return;if(!head){root.style.setProperty('--section-sticky-top',root.closest('.subtitle-inspector')?'42px':'0px');return;}const measure=()=>root.style.setProperty('--section-sticky-top',`${(parseFloat(getComputedStyle(head).top)||0)+head.getBoundingClientRect().height}px`);measure();const observer=new ResizeObserver(measure);observer.observe(head);window.addEventListener('resize',measure);return()=>{observer.disconnect();window.removeEventListener('resize',measure);};},[]);

 useEffect(()=>{if(!openSection)return;const next=openSection.view==='menu'?'style':openSection.view;setView(next);if(next!=='style')setShowAll(true);const frame=requestAnimationFrame(()=>workspace.current?.querySelector(`[data-section="${next}"]>summary`)?.scrollIntoView({block:'nearest'}));return()=>cancelAnimationFrame(frame);},[openSection]);
 const roleLabel=role==='ordinary'?'obične riječi':role==='important'?'bitne riječi':'naslovi';
 const jump=(section:SectionKey)=>{setView(section);if(section!=='style')setShowAll(true);requestAnimationFrame(()=>{const heading=workspace.current?.querySelector<HTMLElement>(`[data-section="${section}"]>summary`);heading?.scrollIntoView({block:'start',behavior:'instant'});heading?.focus({preventScroll:true});});};
 const toggle=(section:SectionKey)=>setView(current=>current===section?null:section);
 const [lastThird,setLastThird]=useState('#b18cff');
 const toggleThird=(enabled:boolean)=>{if(!enabled&&settings.textGradientMiddle)setLastThird(settings.textGradientMiddle);patch({textGradientMiddle:enabled?lastThird:undefined});};
 const patch=(value:Partial<CaptionSettings>)=>onChange(current=>({...current,...value}));

 return <section ref={workspace} className="caption-basics-workspace caption-sections-workspace" data-view="sections" aria-label="Postavke titla">
 <CaptionSection onJump={jump} section="style" title="Efekti stila" roleLabel={roleLabel} open={view==='style'} onToggle={()=>toggle('style')}><div className="caption-primary-style-content">{styleEffects}</div></CaptionSection>
 <button type="button" className="caption-show-all" aria-expanded={showAll} onClick={()=>{setShowAll(value=>!value);if(showAll)setView('style');}}><StudioIcon name="settings"/>{showAll?'Sakrij dodatne opcije':'Prikaži sve opcije'}<StudioIcon name="chevron"/></button>
 {showAll&&<div className="caption-all-options">
 <CaptionSection onJump={jump} section="display" title="Prikaz i poravnanja" roleLabel={roleLabel} open={view==='display'} onToggle={()=>toggle('display')}><CaptionDisplayControls settings={settings} patch={patch}/></CaptionSection>
 <CaptionSection onJump={jump} section="text" title="Tekst i boje" roleLabel={roleLabel} open={view==='text'} onToggle={()=>toggle('text')}>
  <div className="caption-basics-card">
   <div className="caption-font-size-row">
    <LanguageDropdown label="Font" value={settings.fontFamily} options={fontOptions.map(font=>({...font,fontFamily:font.value}))} onChange={fontFamily=>patch({fontFamily})}/>
    <label className="caption-font-size-field"><span>Veličina</span><CaptionFontSizeInput value={settings.fontSizePx} onChange={fontSizePx=>patch({fontSizePx})}/></label>
    <LanguageDropdown label="Debljina slova" value={String(settings.fontWeight??0)} options={captionWeightOptions(settings.fontFamily,settings.fontWeight)} onChange={value=>patch({fontWeight:Number(value)||undefined})}/>
   </div>
   <span className="caption-fill-label">Boja teksta</span>
   <div className="caption-fill-choice" role="group" aria-label="Vrsta boje">
    <button type="button" aria-pressed={!settings.textGradient} onClick={()=>patch({textGradient:false})}>Jedna boja</button>
    <button type="button" aria-pressed={!!settings.textGradient} onClick={()=>patch({textGradient:true})}>Gradijent</button>
   </div>
   {settings.textGradient&&settings.textGradientMode==='rainbow'?<div className="caption-rainbow-preview" role="img" aria-label="Dugine boje preko cijele riječi"/>:<div className="caption-basic-colors">
    <div>{settings.textGradient&&<span>Prva boja</span>}<ColorPicker onReset={()=>patch(settings.textGradient?{textGradientStart:undefined}:{textColor:original.textColor??settings.textColor})} value={settings.textGradient?(settings.textGradientStart??settings.textColor):settings.textColor} onChange={e=>patch(settings.textGradient?{textGradientStart:e.target.value}:{textColor:e.target.value})}/></div>
    {settings.textGradient&&<>
     <div><span>Druga boja</span><ColorPicker onReset={()=>patch({textGradientEnd:undefined})} value={settings.textGradientEnd??settings.highlightColor} onChange={e=>patch({textGradientEnd:e.target.value})}/></div>
     <div><label className="caption-third-toggle" title="Uključi ili isključi treću boju"><span>Treća boja</span><input type="checkbox" aria-label="Uključi treću boju" checked={!!settings.textGradientMiddle} onChange={e=>toggleThird(e.target.checked)}/></label>
      {settings.textGradientMiddle?<ColorPicker settingKey="textGradientMiddle" value={settings.textGradientMiddle} onChange={e=>{setLastThird(e.target.value);patch({textGradientMiddle:e.target.value});}}/>:<button type="button" className="caption-empty-color" aria-label="Uključi treću boju" title="Bez treće boje · klikni za uključivanje" onClick={()=>toggleThird(true)}><span aria-hidden="true"/></button>}

     </div>
    </>}
   </div>
   }
   {settings.textGradient&&<div className="caption-gradient-options"><LanguageDropdown label="Prijelaz boja" value={settings.textGradientMode??'linear'} options={[{value:'linear',label:'Ravni'},{value:'radial',label:'Iz sredine'},{value:'wave',label:'Valoviti'},{value:'rainbow',label:'Rainbow · dugine boje'}]} onChange={value=>patch({textGradientMode:value as CaptionSettings['textGradientMode']})}/><label className="caption-basic-range"><span>Smjer gradijenta <b>{settings.gradientAngle}°</b></span><CaptionRange settingKey="gradientAngle" resetValue={0} type="range" min="0" max="360" step="5" value={settings.gradientAngle} onChange={e=>patch({gradientAngle:Number(e.target.value)})}/></label></div>}
   {allowOutlines?<CaptionOutlineControls settings={settings} patch={patch} onEdit={openEffect}/>:<p className="caption-control-note">Opacity i dodatni okviri za ovaj posebni stil dolaze naknadno.</p>}

   <div className="caption-advanced-modules" role="group" aria-label="Napredno uređivanje">{advancedGroups.map(([id,label,icon])=><button type="button" key={id} aria-label={label} title={label} aria-pressed={advanced===id} onClick={()=>advanced===id?setAdvanced(null):openEffect(id)}><StudioIcon name={icon}/><span>{label}</span></button>)}</div>
   {advanced==='shadows'&&<div ref={effectPanel} tabIndex={-1} className="caption-decoration-editor">{allowOutlines?<CaptionLightEffects settings={settings} patch={patch}/>:<p>Ovaj stil ima vlastiti prikaz efekata. Nove sjene i sjaj dostupni su za osnovne stilove i stilove sa zajedničkim kontrolama teksta.</p>}</div>}
   {advanced==='special'&&<div ref={effectPanel} tabIndex={-1} className="caption-decoration-editor" aria-label={special==='strike'?'Efekti precrtavanja':'Efekti podvlačenja'}><CaptionSpecialEffects settings={settings} patch={patch}/><CaptionSurfaceLighting settings={settings} patch={patch}/><CaptionLineEditor settings={settings} patch={patch}/><CaptionLineEditor settings={settings} patch={patch} strike/>{allowOutlines&&<CaptionBlurControl settings={settings} patch={patch}/>}</div>}
   {advanced==='textures'&&<div ref={effectPanel} tabIndex={-1} className="caption-decoration-editor"><CaptionTextureEffects settings={settings} patch={patch}/></div>}
   {advanced==='depth'&&<div ref={effectPanel} tabIndex={-1} className="caption-decoration-editor"><CaptionDepthEffects settings={settings} patch={patch}/></div>}
   {advanced&&!['depth','special','shadows','textures','transforms'].includes(advanced)&&<div ref={effectPanel} tabIndex={-1} className="caption-advanced-module-note" role="status"><strong>{advancedGroups.find(([id])=>id===advanced)?.[1]}</strong><span>{'Ovdje ćemo dodati napredne postavke ove kategorije u narednom koraku.'}</span></div>}
  </div>
 </CaptionSection>
 <CaptionSection onJump={jump} section="layout" title="Pozadine" roleLabel={roleLabel} open={view==='layout'} onToggle={()=>toggle('layout')}><CaptionLayoutControls settings={settings} patch={patch} enabled={allowLayout}/></CaptionSection>
 <CaptionSection onJump={jump} section="animation" title="Animacije" roleLabel={roleLabel} open={view==='animation'} onToggle={()=>toggle('animation')}><div className="caption-basics-card"><CaptionAnimationPicker settings={settings} onChange={patch}/><label className="caption-basic-range"><span>Trajanje ulaska <b>{settings.revealDuration??.22} s</b></span><CaptionRange settingKey="revealDuration" resetValue={.22} type="range" min=".08" max="1.2" step=".02" value={settings.revealDuration??.22} onChange={e=>patch({revealDuration:Number(e.target.value)})}/></label></div></CaptionSection>
 <CaptionSection onJump={jump} section="borders" title="Okviri · Borders" roleLabel={roleLabel} open={view==='borders'} onToggle={()=>toggle('borders')}>{null}</CaptionSection>
 </div>}
 </section>;
}
