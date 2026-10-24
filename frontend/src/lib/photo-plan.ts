import type {PhotoPrompt} from './production';
export function buildPhotoPlan(frameIds:string[], counts:Record<string,number>, prompts:PhotoPrompt[],groups:string[][]=[],groupPrompts:Record<string,string>={}){
 const output:{segment:string;segments?:string[];prompt:string}[]=[];
 for(const id of frameIds){
  const count=counts[id]||0;if(!count)continue;
  const group=groups.find(g=>g.length>1&&g.includes(id)&&g.every(key=>key!=='overall'&&frameIds.includes(key)&&counts[key]));
  if(group&&group[0]!==id)continue;
  if(!Number.isInteger(count)||count<1||count>10)throw new Error('Odaberi od 1 do 10 fotografija po kadru.');
  const choices=group?[{text:groupPrompts[group.join('|')]??group.flatMap(key=>prompts.filter(p=>p.segment===key).map(p=>p.text)).filter(Boolean).join('\n')}]:prompts.filter(p=>p.segment===id);
  if(!choices.length||choices.some(p=>!p.text.trim()))throw new Error('Svaki odabrani kadar treba popunjen prompt.');
  if(choices.length>count)throw new Error('Broj fotografija kadra treba biti najmanje jednak broju njegovih promptova.');
  for(let i=0;i<count;i++)output.push({segment:id==='overall'?'':id,...(group?{segments:group}:{}),prompt:choices[i%choices.length].text});
 }
 if(!output.length)throw new Error('Odaberi barem jedan kadar za generisanje.');
 if(output.length>80)throw new Error('Generiši najviše 80 fotografija u jednom pokretanju.');
 return output;
}
