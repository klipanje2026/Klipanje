// Capture both phases so native video controls cannot toggle again on key release.
export function installPlaybackShortcut(target: Window, toggle: () => void, enabled: () => boolean, step?: (direction: number) => void) {
  let pressed = false;
  const keydown = (event: KeyboardEvent) => {
    if ((event.code==='ArrowLeft'||event.code==='ArrowRight')&&step&&enabled()&&!event.ctrlKey&&!event.altKey&&!event.metaKey){const element=event.target instanceof HTMLElement?event.target:null;if(element?.closest('input,textarea,select,[contenteditable=true],[role=textbox],[role=listbox],[role=combobox]'))return;event.preventDefault();event.stopImmediatePropagation?.();event.stopPropagation();step((event.code==='ArrowRight'?1:-1)*(event.shiftKey?15:5));return;}
    if ((event.code !== 'Space' && event.key !== ' ') || event.ctrlKey || event.altKey || event.metaKey || !enabled()) return;
    const element = event.target instanceof HTMLElement ? event.target : null;
    // Space is reserved for playback except while entering text/numbers.
    if (element?.closest('textarea,input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]),[contenteditable=true],[role=textbox]')) return;
    event.preventDefault(); event.stopImmediatePropagation?.(); event.stopPropagation();
    if (!event.repeat) { pressed = true; toggle(); }
  };
  const keyup = (event: KeyboardEvent) => {
    if ((event.code !== 'Space' && event.key !== ' ') || !pressed) return;
    event.preventDefault(); event.stopImmediatePropagation?.(); event.stopPropagation(); pressed = false;
  };
  const reset = () => { pressed = false; };
  target.addEventListener('keydown', keydown, true);
  target.addEventListener('keyup', keyup, true);
  target.addEventListener('blur', reset);
  return () => { target.removeEventListener('keydown', keydown, true); target.removeEventListener('keyup', keyup, true); target.removeEventListener('blur', reset); };
}
