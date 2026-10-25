import {useState} from 'react';
import {StyleDropdown} from './LanguageDropdown/LanguageDropdown';

const TAG_GROUPS = [
 {name:'Emocije',tags:[
  ['angry','Ljutito'],['aggressive','Agresivno'],['bitter','Ogorčeno'],
  ['excited','Uzbuđeno'],['playful','Razigrano'],['amazed','Zadivljeno'],
  ['proud','Ponosno'],['optimistic','Optimistično'],['startled','Iznenađeno'],
  ['anxious','Tjeskobno'],['stressed','Pod stresom'],['scared','Uplašeno'],
  ['confused','Zbunjeno'],['tired','Umorno'],['bored','Dosadno'],
  ['despair','Očajno'],['let down','Razočarano'],['peaceful','Smireno'],
  ['content','Zadovoljno'],['curious','Znatiželjno'],['thoughtful','Zamišljeno'],
  ['mischievously','Vragolasto'],
  ['hopeful','S nadom'],['nervous','Nervozno'],['disbelief','Nevjerica'],['triumphant','Pobjedonosno'],
 ]},
 {name:'Način govora',tags:[
  ['whispers','Šapat'],['shouts','Uzvik'],['softly','Blago'],['quietly','Tiho'],
  ['slowly','Sporo'],['rushed','Užurbano'],['drawn out','Razvučeno'],
  ['pause','Pauza'],['long pause','Duža pauza'],
  ['whispering, fearful','Šapat sa strahom'],
 ]},
 {name:'Reakcije',tags:[
  ['neutral','Neutralno'],
  ['laughs','Smijeh'],['crying','Plač'],['sighs','Uzdah'],
  ['gasps','Dahtaj'],['clears throat','Pročišćavanje grla'],
 ]},
] as const;
export const NARRATION_TAGS = TAG_GROUPS.flatMap(group=>[...group.tags]);

export function NarrationTags({onInsert,value,separateReactions=false}:{value?:string;onInsert:(tag:string)=>void;separateReactions?:boolean}){
 const [group,setGroup]=useState(0);
 return <div className="local-narration-tags compact-narration-tags"><div className="narration-tag-pickers"><StyleDropdown hideLabel label="Vrsta upute" value={String(group)} onChange={e=>{setGroup(Number(e.target.value));if(value!==undefined)onInsert('');}}>{TAG_GROUPS.filter(item=>!separateReactions||item.name!=='Reakcije').map((item,i)=><option key={item.name} value={i}>{item.name}</option>)}</StyleDropdown><StyleDropdown hideLabel label="Ton naracije" value={value??""} onChange={e=>{onInsert(e.target.value?`[${e.target.value}]`:"");}}><option value="">Normalno</option>{TAG_GROUPS[group].tags.map(([tag,label])=><option key={tag} value={tag}>{label}</option>)}</StyleDropdown></div></div>;
}

export function insertNarrationTag(field:HTMLTextAreaElement|null,tag:string,onChange:(value:string)=>void){
 if(!field||!tag)return;
 const at=field.selectionStart;
 const before=field.value.slice(0,at),after=field.value.slice(at);
 const insertion=(before&&!/\s$/.test(before)?' ':'')+tag+(/^[\s]/.test(after)?'':' ');
 if(field.maxLength>0&&field.value.length+insertion.length>field.maxLength)return;
 onChange(before+insertion+after);
 requestAnimationFrame(()=>{field.focus({preventScroll:true});field.setSelectionRange(at+insertion.length,at+insertion.length);});
}

export function NarrationReactions({onInsert}:{onInsert:(tag:string)=>void}){
 return <div className="script-narration-reactions"><span>Reakcije · ubaci na kursor</span><div>{TAG_GROUPS[2].tags.map(([tag,label])=><button key={tag} type="button" title={'Ubaci ['+tag+'] na mjesto kursora'} onMouseDown={e=>e.preventDefault()} onClick={()=>onInsert('['+tag+']')}>{label}</button>)}</div></div>;
}
