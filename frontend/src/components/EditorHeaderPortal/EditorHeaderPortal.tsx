import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
export function EditorHeaderPortal({ children, slot = 'project' }: { children: ReactNode; slot?: 'project' | 'action' | 'tools' | 'commands' }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { setTarget(document.getElementById(`workspace-header-${slot}`)); }, [slot]);
  return target ? createPortal(children, target) : null;
}
