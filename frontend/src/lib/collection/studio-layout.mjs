/** Browser font/line layout, shared by Canvas preview and export. No visible DOM. */
export function createStudioLayout(profile,id){
 const host=document.createElement('div');host.setAttribute('aria-hidden','true');
 host.style.cssText='position:fixed;left:-10000px;top:0;width:736px;height:360px;visibility:hidden;pointer-events:none;contain:layout style;';
 const wrap=document.createElement('div'),caption=document.createElement('p');host.append(wrap);wrap.append(caption);document.body.append(host);
 wrap.style.cssText='position:absolute;inset:76px 22px 44px;display:flex;justify-content:center;align-items:center;flex-direction:column;';
 if(id==='cinema'){
  wrap.style.cssText+='inset:90px 28px 34px;';
  const heading=document.createElement('div'),rule=document.createElement('div');
  heading.textContent='S V A K A   R I J E Č   I M A   T E Ž I N U';heading.style.cssText='font:9px "DM Sans";margin-bottom:24px;text-align:center;';
  rule.style.cssText='width:58px;height:1px;margin-top:25px;flex-shrink:0;';wrap.prepend(heading);wrap.append(rule);
 }
 if(id==='glass')wrap.style.cssText+='inset:auto 22px 48px;align-items:start;';
 let cachedKey='',cached;
 return{
  measure(words,active){
   const key=JSON.stringify([words,id==='cinema'?active:-1]);if(key===cachedKey)return cached;
   caption.style.cssText=`box-sizing:border-box;width:100%;max-width:${id==='glass'?580:610}px;text-align:${id==='glass'?'left':'center'};font-family:"${profile.font}";font-weight:${profile.weight};font-size:${profile.size}px;line-height:${profile.line};letter-spacing:${profile.tracking}px;text-wrap:balance;margin:0;`;
   if(id==='glass')caption.style.cssText+='padding:15px 19px;border:1px solid transparent;';
   const spans=words.map((word,i)=>{
    const span=document.createElement('span');span.style.cssText=`box-sizing:border-box;display:inline-block;position:relative;margin:0 ${profile.margin}em;padding:0 ${profile.padding||0}em;`;
    if(id==='cinema'&&i===active)span.style.fontStyle='italic';
    span.textContent=['depth','neon','pop-punch'].includes(id)?word.toLocaleUpperCase('hr'):word;
    const baseline=document.createElement('i');baseline.style.cssText='display:inline-block;width:0;height:0;padding:0;margin:0;vertical-align:baseline;';span.append(baseline);return span;
   });
   caption.replaceChildren(...spans.flatMap((span,i)=>i?[document.createTextNode(' '),span]:[span]));
   let size=profile.size;while((caption.scrollHeight>(id==='glass'?200:215)||caption.scrollWidth>caption.clientWidth+1)&&size>18)caption.style.fontSize=`${--size}px`;
   const origin=host.getBoundingClientRect(),box=caption.getBoundingClientRect();
   const rect=r=>({x:r.x-origin.x,y:r.y-origin.y,width:r.width,height:r.height});
   cachedKey=key;cached={size,box:rect(box),items:spans.map((span,index)=>({...rect(span.getBoundingClientRect()),baseline:span.lastChild.getBoundingClientRect().y-origin.y,index,text:span.firstChild.textContent})),
    header:id==='cinema'?rect(wrap.firstChild.getBoundingClientRect()):null,rule:id==='cinema'?rect(wrap.lastChild.getBoundingClientRect()):null};return cached;
  },dispose(){host.remove();}
 };
}
