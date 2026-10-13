/** Toggle one boundary in an ordered sequence, preserving every other boundary. */
export function toggleFrameLink(order:string[],groups:string[][],index:number):string[][] {
 if(index<0||index>=order.length-1)return groups;
 const links=order.slice(0,-1).map((id,i)=>groups.some(g=>g.includes(id)&&g.includes(order[i+1])));
 links[index]=!links[index];
 const result:string[][]=[];let run=[order[0]];
 for(let i=0;i<links.length;i++){if(links[i])run.push(order[i+1]);else{if(run.length>1)result.push(run);run=[order[i+1]];}}
 if(run.length>1)result.push(run);return result;
}
