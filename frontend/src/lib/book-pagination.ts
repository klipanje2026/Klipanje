/** Fit the actual rendered text, without a character or estimated-line limit. */
export function fitBookPages(content:string,fits:(text:string)=>boolean):string[]{
 if(!content)return [''];
 const tokens=content.match(/\s+|\S+/g)||[],pages:string[]=[];
 let start=0;
 while(start<tokens.length){
  let low=start+1,high=tokens.length,best=start;
  while(low<=high){const end=Math.floor((low+high)/2);if(fits(tokens.slice(start,end).join(''))){best=end;low=end+1;}else high=end-1;}
  // Always make progress, including a single unusually long word.
  if(best===start)best=start+1;
  pages.push(tokens.slice(start,best).join(''));start=best;
 }
 return pages;
}
