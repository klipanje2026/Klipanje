let measure;
/** Font size is in 1080px video coordinates; authored canvases are 736px wide. */
export const nativeFontSize=px=>Math.max(16,Math.min(240,Number.isFinite(px)?px:100))*736/(1080*.92);
export function captionRows(words,size=74,font='Arial',width=630){
 measure??=document.createElement('canvas').getContext('2d');measure.font=`${size}px ${font.replace(/^.*?\d+(?:\.\d+)?px\s*/, '')}`;
 const rows=[];let row='';
 for(const word of words){const next=row?row+' '+word:word;if(row&&measure.measureText(next).width>width){rows.push(row);row=word;}else row=next;}
 if(row)rows.push(row);return joinOrphanRows(rows.map(line=>line.split(' '))).map(line=>line.join(' '));
}
export const rowBaseline=(line,count,height,size)=>height*.5+(line-(count-1)/2)*Math.min(size*1.65,height*.68/Math.max(1,count)) + Math.min(size,height*.68/Math.max(1,count))*.34;
export const rowFontSize=(size,count,height)=>Math.min(size,height*.65/Math.max(1,count)/1.5);

export function joinOrphanRows(rows,text=word=>word){
 const single=row=>row.length===1&&/^\p{L}$/u.test(String(text(row[0])).replace(/[^\p{L}]/gu,''));
 for(let i=0;i<rows.length;i++){
  if(!single(rows[i]))continue;
  if(i+1<rows.length){rows[i+1].unshift(...rows[i]);rows.splice(i--,1);}
  else if(i>0){if(rows[i-1].length>1)rows[i].unshift(rows[i-1].pop());else{rows[i-1].push(...rows[i]);rows.splice(i,1);}}
 }
 return rows;
}

/** Share a spoken word's entrance across every glyph, without changing layout. */
export function captionGlyphStarts(rows,timings=[]){let cursor=0;return rows.map(row=>{const starts=[];row.split(' ').forEach((word,index)=>{const at=timings[cursor++]?.start??0;if(index)starts.push(at);starts.push(...Array.from(word,()=>at));});return starts;});}
