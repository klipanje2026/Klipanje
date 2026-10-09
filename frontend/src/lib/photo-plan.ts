import type {PhotoPrompt} from './production';
export function buildPhotoPlan(frameIds:string[], counts:Record<string,number>, prompts:PhotoPrompt[]){
 const output:{segment:string;prompt:string}[]=[];
 for(const id of frameIds){
  const count=counts[id]||0;if(!count)continue;
  if(!Number.isInteger(count)||count<1||count>10)throw new Error('Odaberi od 1 do 10 fotografija po kadru.');
  const choices=prompts.filter(p=>p.segment===id);
  if(!choices.length||choices.some(p=>!p.text.trim()))throw new Error('Svaki odabrani kadar treba popunjen prompt.');
  if(choices.length>count)throw new Error('Broj fotografija kadra treba biti najmanje jednak broju njegovih promptova.');
  for(let i=0;i<count;i++)output.push({segment:id==='overall'?'':id,prompt:choices[i%choices.length].text});
 }
 if(!output.length)throw new Error('Odaberi barem jedan kadar za generisanje.');
 if(output.length>80)throw new Error('Generiši najviše 80 fotografija u jednom pokretanju.');
 return output;
}
