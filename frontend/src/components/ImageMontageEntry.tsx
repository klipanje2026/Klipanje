import {useEffect,useState,type ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {apiJson} from '../lib/api';
import {imageMontage} from '../lib/image-montage';
import {jsonBody,type Asset,type Script} from '../lib/production';

export function ImageMontageEntry({script,onReady,children}:{script:Script;onReady:(s:Script)=>void;children:ReactNode}){
  const [error,setError]=useState('');
  const [attempt,setAttempt]=useState(0);
  const [empty,setEmpty]=useState(false);
  const existing=Object.keys(script.storyboard||{}).length>0;
  useEffect(()=>{
    if(existing||empty)return;
    let active=true;
    async function prepare(){
      const url='/api/scripts/'+script.id;
      const fresh=await apiJson<Script>(url,{cache:'no-store'});
      if(!active)return;
      if(Object.keys(fresh.storyboard||{}).length){onReady(fresh);return;}
      const {assets}=await apiJson<{assets:Asset[]}>('/api/projects/'+fresh.project+'/assets',{cache:'no-store'});
      if(!active)return;
      const storyboard=await imageMontage(fresh,assets);
      if(!active)return;
      const result=await apiJson<Script>(url,jsonBody({storyboard,expectedStoryboardRevision:fresh.storyboardRevision,expectedScriptUpdatedAt:fresh.updated_at},'PATCH'));
      if(active)onReady(result);
    }
    void prepare().catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[script.id,existing,empty,attempt]);
  if(existing||empty)return <>{children}</>;
  return <section className="local-video-empty">{error?<><p role="alert">{error}</p>
    <Link to={`/fotografije?project=${script.project}&script=${script.id}`}>Poveži slike s kadrovima</Link>
    <button onClick={()=>{setError('');setAttempt(v=>v+1);}}>Pokušaj ponovo</button>
    <button onClick={()=>setEmpty(true)}>Otvori prazan editor</button></>:<p role="status">Slaganje slika, naracija i titlova…</p>}</section>;
}
