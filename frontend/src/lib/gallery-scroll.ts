// Share one passive listener across gallery cards. Heavy work resumes only
// after scrolling settles; existing card canvases remain visible meanwhile.
let users=0;
let lastScroll=-Infinity;
const onScroll=()=>{lastScroll=performance.now();};
export const galleryIsScrolling=()=>performance.now()-lastScroll<300;
export function observeGalleryScroll(){
 if(users++===0)window.addEventListener('scroll',onScroll,{capture:true,passive:true});
 return()=>{if(--users===0)window.removeEventListener('scroll',onScroll,true);};
}
export async function waitForGalleryRest(cancelled:()=>boolean){
 while(!cancelled()&&galleryIsScrolling())await new Promise<void>(resolve=>setTimeout(resolve,60));
 return !cancelled();
}
