import {disposeShowcaseArtworks} from '../../lib/collection-captions';
import { useCallback, useEffect, useRef, useState } from 'react';
import { homeExamples } from '../../config/home';
import { CaptionShowcaseCard } from '../CaptionShowcaseCard/CaptionShowcaseCard';
import { StudioIcon } from '../StudioIcon/StudioIcon';

export function CaptionShowcase() {
  const rail = useRef<HTMLDivElement>(null);
  const scrollFrame=useRef(0);
  const [gliding,setGliding]=useState(false);
  const [prepared,setPrepared]=useState<Set<string>>(()=>new Set());
  const onReady=useCallback((id:string)=>setPrepared(previous=>{if(previous.has(id))return previous;return new Set([...previous,id]);}),[]);
  const ready=prepared.size===homeExamples.length;
  const animateScroll=useCallback((left:number)=>{
    const el=rail.current;if(!el)return;
    cancelAnimationFrame(scrollFrame.current);
    const from=el.scrollLeft,to=Math.max(0,Math.min(el.scrollWidth-el.clientWidth,left));
    el.classList.add('is-gliding');setGliding(true);
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){el.scrollLeft=to;el.classList.remove('is-gliding');setGliding(false);return;}
    const began=performance.now();let lastFrame=began,maxFrameGap=0;
    const tick=(now:number)=>{maxFrameGap=Math.max(maxFrameGap,now-lastFrame);lastFrame=now;const p=Math.min(1,(now-began)/520),ease=p*p*p*(p*(p*6-15)+10);el.scrollLeft=from+(to-from)*ease;if(p<1)scrollFrame.current=requestAnimationFrame(tick);else {el.classList.remove('is-gliding');setGliding(false);if(import.meta.env.DEV)el.dataset.glideMaxFrameMs=maxFrameGap.toFixed(1);}};
    scrollFrame.current=requestAnimationFrame(tick);
  },[]);
  useEffect(()=>()=>{cancelAnimationFrame(scrollFrame.current);disposeShowcaseArtworks();},[]);
  const section = useRef<HTMLElement>(null);
  const [activeCard,setActiveCard]=useState(0);
  const activeIndex=useRef(0);
  const [hoverCard,setHoverCard]=useState<number|null>(null);
  const goTo=useCallback((index:number)=>{
    const el=rail.current;if(!el)return;
    const next=(index+homeExamples.length)%homeExamples.length;activeIndex.current=next;setActiveCard(next);
    const card=el.children[next] as HTMLElement;
    animateScroll(card.offsetLeft-el.offsetLeft-(el.clientWidth-card.offsetWidth)/2);
  },[animateScroll]);
  const [autoPlay, setAutoPlay] = useState(true);
  const idleUntil=useRef(0);
  useEffect(() => {
    const el = rail.current;
    const container = section.current;
    if (!el || !container) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;

    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: .15 });
    observer.observe(el);
    const hold = () => { idleUntil.current = Date.now() + 10000;cancelAnimationFrame(scrollFrame.current);el.classList.remove('is-gliding');setGliding(false); };
    container.addEventListener('pointerdown', hold);
    container.addEventListener('pointerleave', hold);
    container.addEventListener('keydown', hold);
    container.addEventListener('wheel', hold, { passive: true });
    const timer = window.setInterval(() => {
      if (!visible || document.hidden || reducedMotion.matches || Date.now() < idleUntil.current
        || container.matches(':hover')) return;
      if(!autoPlay||!ready)return;
      goTo(activeIndex.current+1);
    }, 3200);
    return () => { clearInterval(timer); cancelAnimationFrame(scrollFrame.current); observer.disconnect(); container.removeEventListener('pointerdown', hold); container.removeEventListener('pointerleave', hold); container.removeEventListener('keydown', hold); container.removeEventListener('wheel', hold); };
  }, [autoPlay,goTo,ready]);
  function move(direction: number) {
    goTo(activeIndex.current+direction);
  }
  return <section ref={section} className="caption-showcase" id="stilovi" aria-labelledby="showcase-title">
    <div className="caption-showcase-heading"><h2 id="showcase-title">Pronađi svoj stil</h2>
      <div className="caption-showcase-controls"><button onClick={() => setAutoPlay(!autoPlay)} aria-label={autoPlay ? 'Pauziraj automatski slider' : 'Pokreni automatski slider'} aria-pressed={!autoPlay} aria-controls="caption-examples"><StudioIcon name={autoPlay ? 'pause' : 'play'} /></button><button disabled={activeCard===0} onClick={() => move(-1)} aria-label="Prethodni primjeri" aria-controls="caption-examples"><StudioIcon name="back" /></button><button disabled={activeCard===homeExamples.length-1} onClick={() => move(1)} aria-label="Sljedeći primjeri" aria-controls="caption-examples"><StudioIcon name="arrow" /></button></div>
    </div>
    <div className="caption-showcase-rail" ref={rail} id="caption-examples" tabIndex={0} aria-label="Primjeri stilova titlova; pomjeri lijevo ili desno" onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1); } }}>
      {homeExamples.map((example,index) => <CaptionShowcaseCard onReady={onReady} suspended={!ready||gliding} autoActive={autoPlay&&index===(hoverCard??activeCard)} onHover={hover=>setHoverCard(hover?index:null)} example={example} key={example.id} />)}
    </div>
  </section>;
}
