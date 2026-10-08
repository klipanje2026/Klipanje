import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StudioIcon } from '../StudioIcon/StudioIcon';
type Props = { showControls?: boolean; children: ReactNode; emptyContent?: ReactNode; addLabel?: string; playing: boolean; enabled: boolean; time: number; duration: number; repeat: boolean; onRepeat: () => void; onToggle: () => void; onSeek: (time: number) => void; onAdd: () => void; onDrop: (files: File[]) => void; hasMedia: boolean; busy: boolean; aspect: number };
const formatTime = (value: number) => `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2, '0')}`;
export function StudioPlayer({ showControls = true, children, playing, enabled, time, duration, repeat, onRepeat, onToggle, onSeek, onAdd, onDrop, hasMedia, busy, aspect, emptyContent, addLabel = "+ Dodaj medije" }: Props) {
  const safeTime=Number.isFinite(time)?Math.max(0,Math.min(time,duration||0)):0;
  const [visible, setVisible] = useState(true);
  const [dragging, setDragging] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const reveal = useCallback(() => {
    setVisible(true); window.clearTimeout(timer.current);
    if (playing) timer.current = window.setTimeout(() => setVisible(false), 2200);
  }, [playing]);
  useEffect(() => { const start = window.setTimeout(reveal, 0); return () => { window.clearTimeout(start); window.clearTimeout(timer.current); }; }, [reveal]);
  return <div className={`studio-player${visible || !playing ? ' controls-visible' : ''}${dragging ? ' is-dragging' : ''}${hasMedia ? ' has-media' : ''}`} style={{'--preview-aspect':aspect} as React.CSSProperties}
    tabIndex={0} role="region" aria-label="Pregled videa. Space za reprodukciju ili pauzu." onPointerMove={reveal} onPointerDown={event => { if (!(event.target as HTMLElement).closest('button,input')) event.currentTarget.focus(); reveal(); }}
    onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); if (!busy) onDrop([...event.dataTransfer.files]); }}>
    <div className="studio-player-media">{children}</div>
    {!hasMedia && (emptyContent || <div className="studio-player-empty"><span className="studio-player-upload-icon"><StudioIcon name="video"/></span><h1>Svaka priča počinje kadrom.</h1><p>Prevuci video ovdje i kreni uređivati.<br/>Možeš dodati i glas ili muziku.</p><button onClick={onAdd} disabled={busy}>Dodaj video ili audio <StudioIcon name="arrow"/></button><small>MP4, MOV, WebM · MP3, WAV</small></div>)}
    {hasMedia && <button className="studio-player-add" onClick={onAdd} disabled={busy} title={addLabel}>{addLabel}</button>}
    {dragging && <div className="studio-player-drop-message">Otpusti datoteke da ih dodaš</div>}
    {showControls && <div className="studio-player-controls" onPointerMove={reveal}>
      <input className="studio-player-seek" aria-label="Pozicija u videu" type="range" min="0" max={duration} step="0.01" value={safeTime} style={{"--seek-percent":`${duration>0?safeTime/duration*100:0}%`} as React.CSSProperties} disabled={!enabled || busy} onChange={event => { onSeek(Number(event.target.value)); reveal(); }}/>
      <div className="studio-player-control-row"><button aria-label={playing ? 'Pauziraj video' : 'Pusti video'} title={playing ? 'Pauza (Space)' : 'Reprodukcija (Space)'} disabled={!enabled || busy} onClick={() => { onToggle(); reveal(); }}><StudioIcon name={playing ? 'pause' : 'play'}/></button><span>{formatTime(safeTime)} <i>/ {formatTime(duration)}</i></span><button className={`studio-player-repeat${repeat ? ' active' : ''}`} aria-label="Ponavljaj video" aria-pressed={repeat} title="Ponavljaj video" disabled={!enabled || busy} onClick={onRepeat}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/></svg></button></div>
    </div>}
  </div>;
}
