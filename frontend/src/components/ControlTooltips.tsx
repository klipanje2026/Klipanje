import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';

/** Shared hints stay outside scrolling panels and also work with keyboard focus. */
export default function ControlTooltips() {
  const [hint, setHint] = useState<{text: string; x: number; y: number; below: boolean} | null>(null);
  useEffect(() => {
    let control: HTMLElement | null = null;
    let originalTitle: string | null = null;
    let originalDescription: string | null = null;
    const hide = () => {
      if (control) {
        if (originalTitle !== null) control.setAttribute('title', originalTitle);
        if (originalDescription === null) control.removeAttribute('aria-describedby');
        else control.setAttribute('aria-describedby', originalDescription);
      }
      control = null;
      setHint(null);
    };
    const show = (event: Event) => {
      if (event instanceof PointerEvent && event.pointerType === 'touch') return;
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>('button, a[aria-label], a[title], [role="button"], [role="separator"], [role="slider"]') : null;
      if (target === control) return;
      hide();
      if (!target || target.closest('[data-no-tooltip]')) return;
      const text = target.getAttribute('title') || target.getAttribute('aria-label');
      if (!text) return;
      control = target;
      originalTitle = target.getAttribute('title');
      originalDescription = target.getAttribute('aria-describedby');
      target.removeAttribute('title');
      target.setAttribute('aria-describedby', [originalDescription, 'control-tooltip'].filter(Boolean).join(' '));
      const rect = target.getBoundingClientRect();
      const below = rect.top < 64;
      const halfWidth = Math.min(150, (window.innerWidth - 16) / 2);
      setHint({text, x: Math.max(halfWidth + 8, Math.min(window.innerWidth - halfWidth - 8, rect.left + rect.width / 2)),
        y: below ? rect.bottom + 8 : rect.top - 8, below});
    };
    const leave = (event: Event) => {
      const next = (event as MouseEvent).relatedTarget;
      if (!(next instanceof Node) || !control?.contains(next)) hide();
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') hide(); };
    document.addEventListener('pointerover', show, true);
    document.addEventListener('pointerout', leave, true);
    document.addEventListener('focusin', show);
    document.addEventListener('focusout', leave);
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      hide();
      document.removeEventListener('pointerover', show, true);
      document.removeEventListener('pointerout', leave, true);
      document.removeEventListener('focusin', show);
      document.removeEventListener('focusout', leave);
      document.removeEventListener('pointerdown', hide, true);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, []);
  return hint ? createPortal(<div id="control-tooltip" role="tooltip" className="control-tooltip"
    style={{left: hint.x, top: hint.y, transform: `translate(-50%, ${hint.below ? '0' : '-100%'})`}}>{hint.text}</div>, document.body) : null;
}
