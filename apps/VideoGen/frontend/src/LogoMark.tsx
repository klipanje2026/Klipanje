/** Selected frame concept; the corner follows the active application palette. */
export function LogoMark({size=30}:{size?:number}) {
 return <svg width={size} height={size} viewBox="0 0 48 36" fill="none" aria-hidden="true" focusable="false" style={{flexShrink:0,color:'var(--k-text, #242424)'}}>
  <path d="M30 30H6V6H42V15" stroke="currentColor" strokeWidth="6"/>
  <path d="M42 21V30H36" stroke="var(--k-accent, #ff6b5b)" strokeWidth="6"/>
 </svg>;
}
