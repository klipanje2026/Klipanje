import {Link,useLocation} from 'react-router-dom';
export function WorkflowSteps({project,script}:{project:string;script?:string}){
 const {pathname}=useLocation();const query=`?project=${project}${script?'&script='+script:''}`;
 return <nav className="workflow-steps" aria-label="Koraci projekta">{[['/projekti','Projekat'],['/skripte','Skripte i naracije'],['/fotografije','Generacije elemenata'],['/definisanje-kadrova','Definisanje kadrova'],['/galerija','Galerija'],['/zvukovi','Zvukovi'],['/obrada-materijala','Obrada materijala'],['/preeditor','Preeditor'],['/videa','Video editor']].map(([path,label],i)=><Link key={path} to={path+query} aria-current={pathname===path?'step':undefined}><span>{i+1}</span>{label}</Link>)}</nav>;
}
