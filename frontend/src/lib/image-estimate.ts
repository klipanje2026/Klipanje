// Formula from the official GPT Image 2.5 output-token calculator, read 2026-10-09.
// Output only: text and reference-image inputs are additional.
export function imageOutputEstimate(format:string){
 const [width,height]=format==='9:16'?[1024,1536]:format==='16:9'?[1536,1024]:[1024,1024];
 const grid=24,short=grid/(Math.max(width,height)/Math.min(width,height)),lower=Math.floor(short);
 const rounded=short-lower===.5?lower+lower%2:Math.round(short);
 const tokens=Math.ceil(grid*rounded*(2000000+width*height)/4000000);
 return {tokens,usd:tokens*30/1000000};
}
