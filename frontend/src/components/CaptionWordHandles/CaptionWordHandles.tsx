import { useRef } from 'react';
import type { CaptionBounds } from '../../lib/caption-renderer';
import './CaptionWordHandles.scss';

export function CaptionWordHandles({ bounds, onMove, onSelect, selected }: {
  bounds: CaptionBounds | null;
  selected?: number;
  onSelect: (segmentId: string, index: number) => void;
  onMove: (segmentId: string, index: number, dx: number, dy: number) => void;
}) {
  const drag = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  return <>{bounds?.words.map(word => <button key={`${bounds.segmentId}-${word.index}`}
    type="button" className={`caption-word-handle${selected === word.index ? ' is-selected' : ''}`} aria-label={`Pomjeri riječ: ${word.text}`}
    style={{ left: `${word.x}%`, top: `${word.y}%`, width: `${word.width}%`, height: `${word.height}%`, transform: `translate(-50%, -50%) rotate(${word.rotation}deg)` }}
    onPointerDown={event => {
      event.preventDefault();
      event.stopPropagation();
      onSelect(bounds.segmentId, word.index);
      const frame = event.currentTarget.parentElement!.getBoundingClientRect();
      drag.current = { x: event.clientX, y: event.clientY, width: frame.width, height: frame.height };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      const last = drag.current;
      if (!last || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
      const dx = (event.clientX - last.x) / last.width * 100;
      const dy = (event.clientY - last.y) / last.height * 100;
      onMove(bounds.segmentId, word.index, Math.max(word.width / 2 - word.x, Math.min(100 - word.width / 2 - word.x, dx)), Math.max(word.height / 2 - word.y, Math.min(100 - word.height / 2 - word.y, dy)));
      last.x = event.clientX; last.y = event.clientY;
    }}
    onPointerUp={event => { drag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
    onPointerCancel={() => { drag.current = null; }}
    onFocus={() => onSelect(bounds.segmentId, word.index)}
    onKeyDown={event => {
      const delta = { ArrowLeft: [-.5, 0], ArrowRight: [.5, 0], ArrowUp: [0, -.5], ArrowDown: [0, .5] }[event.key];
      if (delta) { event.preventDefault(); onMove(bounds.segmentId, word.index, delta[0], delta[1]); }
    }}
  />)}</>;
}
