import './custom-caption-fonts.css';
import '@fontsource-variable/roboto';
import '@fontsource-variable/oswald';
import '@fontsource-variable/montserrat';
import '@fontsource-variable/playfair-display';
import '@fontsource-variable/roboto-slab';
import '@fontsource-variable/raleway';
import '@fontsource-variable/nunito';
import '@fontsource-variable/caveat';
import '@fontsource-variable/inter';
import type {Overlay} from './video-overlays';
export async function loadOverlayFonts(items:Overlay[]) {
 await Promise.all(items.filter(o=>o.kind==='text').map(o=>document.fonts.load(`${o.italic?'italic ':''}${o.bold?700:450} 48px ${o.fontFamily||'"Manrope Variable",sans-serif'}`,o.text||'ČćŽžŠšĐđ')));
}
