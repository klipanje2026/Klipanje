import {Link,useLocation} from 'react-router-dom';
import {useSelection} from './ProductionWorkspace';
const generationSteps=[['/fotografije','Generisanje fotografija'],['/definisanje-kadrova','Definisanje kadrova'],['/galerija','Galerija']];
export function WorkflowSteps({project,script}:{project:string;script?:string}){
 const {pathname}=useLocation();const query=`?project=${project}${script?'&script='+script:''}`,generation=generationSteps.some(([path])=>path===pathname);
 const images=useSelection().project?.brief.workflow==='images';
 if(images)return <nav className="workflow-steps" aria-label="Koraci projekta">{[['/projekti','Projekat'],['/skripte','Skripta i naracija'],['/fotografije','Generiši ili uvezi slike'],['/videa','Video editor']].map(([path,label],i)=><Link key={path} to={path+query} aria-current={pathname===path?'step':undefined}><span>{i+1}</span>{label}</Link>)}</nav>;
 return <><nav className="workflow-steps" aria-label="Koraci projekta">{[['/projekti','Projekat'],['/skripte','Skripte i naracije'],['/fotografije','Generacije elemenata'],['/zvukovi','Zvukovi'],['/obrada-materijala','Obrada materijala'],['/preeditor','Preeditor'],['/videa','Video editor']].map(([path,label],i)=><Link key={path} to={path+query} aria-current={pathname===path||(path==='/fotografije'&&generation)?'step':undefined}><span>{i+1}</span>{label}</Link>)}</nav>{generation&&<nav className="generation-subtabs" aria-label="Generacije elemenata">{generationSteps.map(([path,label])=><Link key={path} to={path+query} aria-current={pathname===path?'page':undefined}>{label}</Link>)}</nav>}</>;
}
