import {styleLibraryCategory} from '../../config/captions/style-library';
import {isNeonRiotStyle} from '../../config/captions/neon-riot-variants';
import {isCollectionStyle} from '../../config/captions/collection';
import {CollectionSample} from '../CollectionSample';
import {homePersonFrame} from '../../lib/home-person-mask';
import {drawPersonCaption} from '../../lib/person-mask';
import type {DecodedFrame} from '../../lib/frame-source';
import {portraitStyle} from '../../config/portraits';
import { memo, useEffect, useMemo, useRef } from 'react';
import { settingsForTemplate, templates, type CaptionTemplate } from '../../config/captions/presets';
export const CaptionSample = memo(function CaptionSample({ template, playing = false }: { template: CaptionTemplate; playing?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const clock = useRef(isNeonRiotStyle(template.key)||['prismFold','inkImpact','orbitSignal','velvetScript'].includes(template.key) ? 1.95 : 1.2);
  const hasPlayed = useRef(false);
  const settings = useMemo(() => ({ ...settingsForTemplate(template), x:['scriptVerbatim','trackingStack'].includes(template.key)?10:50, y:template.key==='curvyBackdrop'?28:template.key==='prismWords'?45:template.key==='trackingStack'?62:76, rotation: 0, fontScale: isNeonRiotStyle(template.key)||['prismFold','inkImpact','orbitSignal','velvetScript'].includes(template.key)?100:['scriptVerbatim','underlinedEditorial','curvyBackdrop','prismWords','trackingStack','dynamicGlass','premiumOrangeV4','metallicCompactV2'].includes(template.key)?100:180 }), [template]);
  useEffect(() => {
    if(isCollectionStyle(template.key))return;
    const canvas = ref.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduced=typeof window!=='undefined'?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
    let frame=0,previous:number|null=null,disposed=false,ready=false,portraitFrame:DecodedFrame|undefined;
    const portraitIndex=template.portrait??(templates.findIndex(item=>item.key===template.key)+2);
    const draw=()=>{
      const time=clock.current%7.2;
      const phrases=[template.sample,'Tvoj glas. Tvoja priča.','Svaka riječ ima svoj trenutak.'];
      const start=Math.floor(time/2.4)*2.4, text=phrases[Math.floor(time/2.4)];
      const words=text.split(/\s+/).map((text,index,array)=>({text,start:start+index*2.4/array.length,end:start+(index+1)*2.4/array.length}));
      ctx.clearRect(0,0,canvas.width,canvas.height);
      if(template.key==='underlinedEditorial')drawPersonCaption(ctx,{id:'sample-header',text:template.sample.split(/\s+/).reduce((longest,word)=>word.length>longest.length?word:longest,''),start:0,end:7.2,role:'title',position:{x:50,y:28}},time,template.key,settings,portraitFrame);
      drawPersonCaption(ctx,{id:`sample-${start}`,text,start,end:start+2.4,words,...(['lensFrame','vistaRise','popCollage'].includes(template.key)?{frameAnimationStart:0,frameAnimationEnd:7.2}:{})},time,template.key,settings,portraitFrame);
    };
    const tick=(now:number)=>{
      if(disposed)return;
      if(previous!==null)clock.current+=Math.max(0,Math.min(now-previous,100))/1000*(isNeonRiotStyle(template.key)||['prismFold','inkImpact','orbitSignal','velvetScript'].includes(template.key)?1:1.5);
      previous=now;draw();frame=requestAnimationFrame(tick);
    };
    const update=()=>{
      cancelAnimationFrame(frame);previous=null;
      if(!ready||disposed)return;
      if(playing&&!reduced?.matches&&(typeof document==='undefined'||!document.hidden)){
        if(!hasPlayed.current){clock.current=.06;hasPlayed.current=true;}
        frame=requestAnimationFrame(tick);
      }else draw();
    };
    draw();
    if(settings.behindPerson)void homePersonFrame(portraitIndex).then(source=>{if(!disposed){portraitFrame=source;draw();}}).catch(()=>{});
    if(typeof document!=='undefined'&&document.fonts){
      const fonts=[settings.fontFamily,settings.secondaryFontFamily].filter((font):font is string=>!!font);
      void Promise.all(fonts.map(font=>document.fonts.load(`900 32px ${font}`,template.sample))).catch(()=>{}).then(()=>{ready=true;update();});
      document.addEventListener('visibilitychange',update);
    }else{ready=true;update();}
    reduced?.addEventListener('change',update);
    return()=>{disposed=true;cancelAnimationFrame(frame);if(typeof document!=='undefined')document.removeEventListener('visibilitychange',update);reduced?.removeEventListener('change',update);};
  }, [settings, template, playing]);
  if(isCollectionStyle(template.key))return <CollectionSample template={template} playing={playing}/>;
  return <div className="subtitle-style-demo" style={portraitStyle(template.portrait??(templates.findIndex(item=>item.key===template.key)+2))} aria-hidden="true"><span className="subtitle-style-demo-label">{styleLibraryCategory(template)}</span><canvas className="subtitle-template-sample" width={360} height={640} ref={ref} /><span className="subtitle-style-demo-format">9:16 · PRIMJER STILA</span></div>;
});
