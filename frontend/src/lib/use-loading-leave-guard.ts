import {useContext,useEffect} from 'react';
import {UNSAFE_NavigationContext} from 'react-router-dom';
const activeLoads=new Set<symbol>();
const guards=new WeakMap<object,{count:number;dispose:()=>void}>();
let approved=false;
function confirmLeave(){
 if(!activeLoads.size||approved)return true;
 if(!window.confirm('Video se još otvara. Napustiti ovu stranicu i prekinuti učitavanje?'))return false;
 approved=true;window.dispatchEvent(new Event('edita-leave-approved'));setTimeout(()=>{approved=false;},0);return true;
}
/** Covers editor links, router actions, browser traversal and document unload. */
export function useLoadingLeaveGuard(active:boolean){
 const {navigator}=useContext(UNSAFE_NavigationContext);
 useEffect(()=>{if(!active)return;approved=false;const token=Symbol();activeLoads.add(token);return()=>{activeLoads.delete(token);};},[active]);
 useEffect(()=>{
 const registered=guards.get(navigator);if(registered){registered.count++;return()=>{if(--registered.count===0){registered.dispose();guards.delete(navigator);}};}
 const push=navigator.push,replace=navigator.replace,go=navigator.go;
 const nextPush:typeof push=(...args)=>{if(confirmLeave())push.apply(navigator,args);};
 const nextReplace:typeof replace=(...args)=>{if(confirmLeave())replace.apply(navigator,args);};
 const nextGo:typeof go=(...args)=>{if(confirmLeave())go.apply(navigator,args);};
 navigator.push=nextPush;navigator.replace=nextReplace;navigator.go=nextGo;
 const unload=(event:BeforeUnloadEvent)=>{if(activeLoads.size&&!approved){event.preventDefault();event.returnValue='';}};
 const click=(event:MouseEvent)=>{if(event.defaultPrevented)return;const anchor=(event.target as Element)?.closest<HTMLAnchorElement>('a[href]');if(!anchor||anchor.hasAttribute('download')||anchor.target==='_blank'||event.ctrlKey||event.metaKey||event.shiftKey)return;if(anchor.href===location.href||!/^https?:/.test(anchor.href))return;if(!confirmLeave()){event.preventDefault();event.stopImmediatePropagation();}};
 const traverse=(event:Event)=>{if((event as Event&{navigationType?:string}).navigationType==='traverse'&&event.cancelable&&!confirmLeave())event.preventDefault();};
 const navigation=(window as Window&{navigation?:EventTarget}).navigation;
 const approve=()=>{approved=true;};
 document.addEventListener('click',click,true);window.addEventListener('beforeunload',unload);window.addEventListener('edita-leave-approved',approve);navigation?.addEventListener('navigate',traverse);
 const dispose=()=>{if(navigator.push===nextPush)navigator.push=push;if(navigator.replace===nextReplace)navigator.replace=replace;if(navigator.go===nextGo)navigator.go=go;document.removeEventListener('click',click,true);window.removeEventListener('beforeunload',unload);window.removeEventListener('edita-leave-approved',approve);approved=false;navigation?.removeEventListener('navigate',traverse);};
 const entry={count:1,dispose};guards.set(navigator,entry);return()=>{if(--entry.count===0){dispose();guards.delete(navigator);}};
 },[navigator]);
}
