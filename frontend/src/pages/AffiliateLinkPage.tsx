import {useEffect,useState} from 'react';
import {useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {apiJson,ApiError} from '../lib/api';
import NotFound from './NotFoundPage/NotFoundPage';
export function AffiliateLinkPage(){
 const {slug}=useParams(),[query]=useSearchParams(),navigate=useNavigate();
 const [state,setState]=useState<'loading'|'missing'|'error'>('loading');
 const campaign=query.get('campaign')||'';
 useEffect(()=>{let active=true;setState('loading');void apiJson('/api/affiliate/links/'+encodeURIComponent(slug||'')+'/follow?campaign='+encodeURIComponent(campaign),{method:'POST'}).then(()=>{if(active)navigate('/',{replace:true});}).catch(error=>{if(active)setState(error instanceof ApiError&&error.status===404?'missing':'error');});return()=>{active=false;};},[slug,campaign,navigate]);
 if(state==='missing')return <NotFound/>;
 return <main className="account-page"><p role="status">{state==='loading'?'Otvaranje Edite…':'Link trenutno nije moguće otvoriti.'}</p>{state==='error'&&<button onClick={()=>window.location.reload()}>Pokušaj ponovo</button>}</main>;
}
