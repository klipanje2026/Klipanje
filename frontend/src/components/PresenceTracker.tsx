import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import {useAuth} from '../context/auth-context';
import {analyticsChoice,analyticsPage,liveAnalyticsSection} from '../lib/product-analytics';
import {csrfToken} from '../lib/api';
const tab=crypto.randomUUID();
let sequence=0,lastActivity=0;
function source(){
 try{const host=new URL(document.referrer).hostname;if(host===location.hostname)return 'direct';
 for(const [key,domains] of Object.entries({google:['google.com','google.ba'],bing:['bing.com'],instagram:['instagram.com'],facebook:['facebook.com','fb.com'],tiktok:['tiktok.com'],youtube:['youtube.com','youtu.be'],linkedin:['linkedin.com']}))if(domains.some(d=>host===d||host.endsWith('.'+d)))return key;
 return 'other';}catch{return 'direct';}
}
const entrySource=source();
export function PresenceTracker(){
 const {session}=useAuth(),location=useLocation();
 useEffect(()=>{
 let stopped=false,inflight=false,lastSent=0;
 const allowed=()=>analyticsChoice()==='yes'&&!session.user?.isStaff&&!window.location.pathname.startsWith('/studio');
 const send=async(hide=false)=>{
  if(inflight&&!hide)return;
  const consent=allowed()&&!hide,seq=++sequence;
  if(!consent&&lastSent===0)return;
  const visible=consent&&document.visibilityState==='visible';
  const body=consent?{consent:true,tab,sequence:seq,page:analyticsPage(),section:liveAnalyticsSection(),source:entrySource,visible,active:visible&&Date.now()-lastActivity<60000}:{consent:false,tab,sequence:seq};
  inflight=true;lastSent=Date.now();
  try{const token=await csrfToken();if(stopped&&!hide)return;if(consent&&!allowed())return;
   await fetch('/api/analytics/presence',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json','X-CSRFToken':token},body:JSON.stringify(body)});
  }catch{/* Presence must not interrupt the editor. */}finally{inflight=false;}
 };
 const activity=()=>{const wasIdle=Date.now()-lastActivity>=60000;lastActivity=Date.now();if(wasIdle&&Date.now()-lastSent>5000&&allowed())void send();};
 const visibility=()=>void send(document.visibilityState!=='visible');
 const choice=()=>void send(!allowed());
 const section=()=>{if(Date.now()-lastSent>5000&&allowed())void send();};
 const unload=()=>void send(true);
 window.addEventListener('pointerdown',activity,{passive:true});window.addEventListener('keydown',activity);window.addEventListener('scroll',activity,{passive:true,capture:true});
 document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',unload);window.addEventListener('edita-analytics-choice',choice);window.addEventListener('storage',choice);window.addEventListener('edita-analytics-section',section);
 void send();const timer=setInterval(()=>{if(allowed()&&document.visibilityState==='visible')void send();},30000);
 return()=>{void send(true);stopped=true;clearInterval(timer);window.removeEventListener('pointerdown',activity);window.removeEventListener('keydown',activity);window.removeEventListener('scroll',activity,true);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',unload);window.removeEventListener('edita-analytics-choice',choice);window.removeEventListener('storage',choice);window.removeEventListener('edita-analytics-section',section);};
 },[session.user?.id,session.user?.isStaff,location.pathname]);
 return null;
}
