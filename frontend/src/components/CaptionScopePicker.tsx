import {LanguageDropdown} from './LanguageDropdown/LanguageDropdown';
type ScopeSegment={id:string;role?:string;lane?:number;group?:{id:string;name:string}};
export function CaptionScopePicker({segments,value,word,title,onChange}:{segments:ScopeSegment[];value:string;word?:boolean;title?:boolean;onChange:(value:string)=>void}){
 const groups=[...new Map(segments.filter(s=>s.group&&s.role!=='title').map(s=>[s.group!.id,s.group!])).values()];
 return <div className="caption-scope-picker"><LanguageDropdown label="Primijeni na" value={value} onChange={onChange} options={[{value:'all',label:'Svi titlovi'},{value:'titles',label:'Svi naslovi'},{value:'scene',label:title?'Ovaj naslov':'Ovaj titl'},...(value.startsWith('group:')&&!groups.some(g=>'group:'+g.id===value)?[{value,label:'Odabrana grupa'}]:[]),...groups.map(g=>({value:`group:${g.id}`,label:g.name})),...(word?[{value:'word',label:'Ova riječ'}]:[])]}/></div>;
}
