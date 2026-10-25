/** Scroll only the tool panel, keeping the player and timeline stationary. */
export function revealPanelItem(element:HTMLElement|null){
 if(!element)return;
 for(let parent=element.parentElement;parent;parent=parent.parentElement){
  if(/auto|scroll/.test(getComputedStyle(parent).overflowY)&&parent.scrollHeight>parent.clientHeight){
   const item=element.getBoundingClientRect(),box=parent.getBoundingClientRect();
   parent.scrollTo({top:Math.max(0,parent.scrollTop+item.top-box.top-12),behavior:'auto'});return;
  }
 }
}
