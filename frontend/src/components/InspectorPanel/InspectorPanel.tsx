import type { ReactNode } from 'react';
import type { InspectorTab } from '../../lib/editor-layout';
export function InspectorPanel({ id, activeTab, children }: {
  id: InspectorTab; activeTab: InspectorTab; children: ReactNode;
}) {
  // Keep panels mounted: tab changes preserve fields, audio and each panel's scroll position.
  return <section id={`inspector-panel-${id}`} role="tabpanel" aria-labelledby={`inspector-tab-${id}`}
    tabIndex={0} hidden={activeTab !== id} className={`subtitle-inspector-panel panel-${id}`}>
    {children}
  </section>;
}
