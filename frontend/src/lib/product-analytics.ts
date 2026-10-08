import {csrfToken} from './api';
export type ProductEventName='page_view'|'section_view'|'style_impression'|'style_select'|'style_replace'|'palette_select'|'style_export'|'media_selected'|'recognition_start'|'recognition_success'|'recognition_error'|'recognition_cancel'|'save_start'|'save_success'|'save_error'|'export_start'|'export_success'|'export_error';
type Event={id:string;name:ProductEventName;page:string;section?:string;style?:string};
const key='edita-product-analytics';
let excluded=true,queue:Event[]=[],timer:ReturnType<typeof setTimeout>|undefined,inflight=false,generation=0;
const seen=new Set<string>();
let sectionPath='',currentSection='';
export function liveAnalyticsSection(){return sectionPath===location.pathname?currentSection:'';}
export function analyticsChoice():string|null{try{return localStorage.getItem(key);}catch{return null;}}
export function setAnalyticsChoice(value:'yes'|'no'){try{localStorage.setItem(key,value);}catch{/* No persistence means no tracking. */}generation++;queue=[];seen.clear();window.dispatchEvent(new Event('edita-analytics-choice'));}
export function setAnalyticsExcluded(value:boolean){if(excluded!==value){generation++;queue=[];seen.clear();}excluded=value;}
export function analyticsPage(){const p=location.pathname;return p==='/'?'home':p==='/titlovi'?'captions':p==='/video-editor'?'video':p==='/pretplate'?'plans':p==='/pretplate/kupovina'?'checkout':p==='/login'?'account':'other';}
export function trackProduct(name:ProductEventName,fields:{style?:string;section?:string}={},onceKey?:string){
 if(excluded||analyticsChoice()!=='yes'||location.pathname.startsWith('/studio'))return;
 if(['style_impression','style_select','style_replace','palette_select'].includes(name))return;
 if(name==='section_view'){sectionPath=location.pathname;currentSection=fields.section||'';window.dispatchEvent(new Event('edita-analytics-section'));}
 if(onceKey){if(seen.has(onceKey))return;if(seen.size>2000)seen.clear();seen.add(onceKey);}
 if(queue.length>=160)return;
 queue.push({id:crypto.randomUUID(),name,page:analyticsPage(),...fields});
 if(!timer)timer=setTimeout(()=>{timer=undefined;void flushAnalytics();},5000);
}
export async function flushAnalytics(){
 if(inflight||!queue.length||excluded||analyticsChoice()!=='yes')return;
 inflight=true;const batch=queue.splice(0,40),version=generation;
 try{const token=await csrfToken();if(version!==generation||excluded||analyticsChoice()!=='yes')return;
 const response=await fetch('/api/analytics/events',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json','X-CSRFToken':token},body:JSON.stringify({consent:true,events:batch})});
 if(!response.ok&&response.status>=500&&version===generation)queue.unshift(...batch);
 }catch{if(version===generation)queue.unshift(...batch);}finally{inflight=false;queue=queue.slice(0,160);if(queue.length&&!timer)timer=setTimeout(()=>{timer=undefined;void flushAnalytics();},15000);}
}

export function trackExportStyles(segments:import('../config/captions/types').Segment[],base:string,emitted=new Set<string>()){
 const styles=new Set<string>();
 for(const segment of segments){if(!segment.text.trim())continue;styles.add(segment.detachedStyle?.style||segment.laneStyle?.style||base);if(segment.titleStyle)styles.add(segment.titleStyle);Object.values(segment.wordStyles||{}).forEach(word=>styles.add(word.style));}
 for(const style of styles){if(!emitted.has(style)){emitted.add(style);trackProduct('style_export',{style});}}
}
