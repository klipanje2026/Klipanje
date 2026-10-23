/** Keep visible performance directions in the exact text sent to ElevenLabs. */
export function narrationRequestText(text:string,tone:string,model:string){
 return model==='eleven_v4_turbo'&&tone&&!/\[[^\]\r\n]+\]/.test(text)?`${tone} ${text}`:text;
}
export function narrationDraftRows<T extends {text:string}>(rows:T[],text:string):T[]{
 const lines=text.split('\n');let offset=0;
 const expected=rows.reduce((count,row)=>count+row.text.split('\n').length,0);
 if(lines.length!==expected)throw new Error('Za rezanje po kadrovima zadrži postojeće prijelome redova u tekstu ili isključi Rastavi na postojeće kadrove.');
 return rows.map(row=>{const count=row.text.split('\n').length;const draft=lines.slice(offset,offset+count).join('\n');offset+=count;return {...row,text:draft};});
}
