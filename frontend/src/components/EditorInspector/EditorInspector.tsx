"use client";

import { StudioIcon } from "../StudioIcon/StudioIcon";
import {PanelResize} from "../PanelResize";
import type { ReactNode } from "react";
import { inspectorTabs, nextInspectorTab } from "../../lib/editor-layout";
import type { InspectorTab } from "../../lib/editor-layout";

export function EditorInspector({ activeTab, onTabChange, children, status }: {
  activeTab: InspectorTab; onTabChange: (tab: InspectorTab) => void; children: ReactNode; status?: ReactNode;
}) {
  return <aside className="subtitle-inspector" aria-label="Alati za uređivanje titlova">
    <PanelResize selector=".subtitle-editor-page"/>
    <div className="subtitle-inspector-tabs" role="tablist" aria-label="Alati uređivača" aria-orientation="vertical">
      {inspectorTabs.map((tab) => <button
        key={tab.id} id={`inspector-tab-${tab.id}`} type="button" role="tab"
        aria-selected={activeTab === tab.id} aria-controls={`inspector-panel-${tab.id}`}
        tabIndex={activeTab === tab.id ? 0 : -1}
        onClick={() => onTabChange(tab.id)}
        onKeyDown={(event) => {
          const next = nextInspectorTab(tab.id, event.key === "ArrowDown" ? "ArrowRight" : event.key === "ArrowUp" ? "ArrowLeft" : event.key);
          if (!next) return;
          event.preventDefault();
          onTabChange(next);
          event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#inspector-tab-${next}`)?.focus();
        }}
      ><StudioIcon name={tab.id === "media" ? "video" : tab.id === "captions" ? "captions" : tab.id === "styles" ? "spark" : tab.id === "settings" ? "settings" : "voice"}/><span>{tab.label}</span></button>)}
    </div>
    <div className="subtitle-inspector-body">{status}{children}</div>
  </aside>;
}
