export function fitVideoToArea(width: number, height: number, aspect: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return { width: 0, height: 0 };
  const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9;
  const fittedWidth = Math.min(width, height * ratio);
  return { width: fittedWidth, height: fittedWidth / ratio };
}

export const inspectorTabs = [
  { id: "media", label: "Mediji" },
  { id: "captions", label: "Titlovi" },
  { id: "styles", label: "Stilovi" },
  { id: "settings", label: "Postavke" },
  { id: "voice", label: "Glas" },
] as const;
export type InspectorTab = typeof inspectorTabs[number]["id"];

export function nextInspectorTab(current: InspectorTab, key: string): InspectorTab | null {
  const index = inspectorTabs.findIndex((tab) => tab.id === current);
  if (key === "Home") return inspectorTabs[0].id;
  if (key === "End") return inspectorTabs[inspectorTabs.length - 1].id;
  if (key === "ArrowRight") return inspectorTabs[(index + 1) % inspectorTabs.length].id;
  if (key === "ArrowLeft") return inspectorTabs[(index + inspectorTabs.length - 1) % inspectorTabs.length].id;
  return null;
}
