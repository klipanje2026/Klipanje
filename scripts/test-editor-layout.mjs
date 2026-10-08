// Non-browser regression checks for sizing, keyboard tabs and the editor's panel structure.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const output = resolve('work/editor-layout-check');
await mkdir(output, { recursive: true });
for (const [input, name] of [['frontend/src/components/StudioIcon/StudioIcon.tsx','studio-icon'], ['frontend/src/components/PanelResize.tsx','panel-resize'], ['frontend/src/lib/video-crop.ts','video-crop'], ['frontend/src/lib/editor-layout.ts', 'editor-layout'], ['frontend/src/components/EditorInspector/EditorInspector.tsx', 'editor-inspector'], ['frontend/src/components/InspectorPanel/InspectorPanel.tsx', 'inspector-panel']]) {
  const source = await readFile(resolve(input), 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX } });
  await writeFile(resolve(output, `${name}.mjs`), result.outputText.replaceAll('"../StudioIcon/StudioIcon"', '"./studio-icon.mjs"').replaceAll('"../PanelResize"', '"./panel-resize.mjs"').replaceAll('"../../lib/editor-layout"', '"./editor-layout.mjs"'));
}
const { fitVideoToArea, inspectorTabs, nextInspectorTab } = await import(pathToFileURL(resolve(output, 'editor-layout.mjs')));
const { EditorInspector } = await import(pathToFileURL(resolve(output, 'editor-inspector.mjs')));
const { InspectorPanel } = await import(pathToFileURL(resolve(output, 'inspector-panel.mjs')));

let fittingCases = 0;
// Available preview areas at desktop, laptop, narrow pane, phone and short viewport sizes.
for (const [width, height] of [[920, 556], [700, 480], [430, 392], [350, 220], [366, 200], [260, 140], [1200, 620]]) {
  for (const aspect of [16 / 9, 9 / 16, 1, 4 / 3, 21 / 9, 2 / 3]) {
    const fit = fitVideoToArea(width, height, aspect);
    assert.ok(fit.width <= width + .001 && fit.height <= height + .001, 'Video stays inside both available dimensions');
    assert.ok(Math.abs(fit.width / fit.height - aspect) < .001, 'Original aspect ratio is preserved');
    assert.ok(Math.abs(fit.width - width) < .001 || Math.abs(fit.height - height) < .001, 'Video uses the maximum available space');
    fittingCases++;
  }
}
assert.deepEqual(fitVideoToArea(0, 500, 1), { width: 0, height: 0 });
assert.deepEqual(fitVideoToArea(400, 0, 1), { width: 0, height: 0 });
assert.equal(fitVideoToArea(160, 90, NaN).width, 160);
assert.equal(nextInspectorTab('captions', 'ArrowLeft'), 'media');
assert.equal(nextInspectorTab('voice', 'ArrowRight'), 'media');
assert.equal(nextInspectorTab('settings', 'Home'), 'media');
assert.equal(nextInspectorTab('styles', 'End'), 'voice');
assert.equal(nextInspectorTab('styles', 'Space'), null);
assert.equal(nextInspectorTab('media', 'ArrowLeft'), 'voice');
assert.equal(nextInspectorTab('media', 'ArrowRight'), 'captions');

for (const selected of inspectorTabs) {
  const html = renderToStaticMarkup(createElement(EditorInspector, { activeTab: selected.id, onTabChange() {} },
    inspectorTabs.map((tab) => createElement(InspectorPanel, { key: tab.id, id: tab.id, activeTab: selected.id }, tab.label))));
  assert.equal((html.match(/role="tabpanel"/g) || []).length, 5, 'All panels remain mounted');
  assert.equal((html.match(/hidden=""/g) || []).length, 4, 'Only one panel is exposed');
  assert.equal((html.match(/aria-selected="true"/g) || []).length, 1, 'Exactly one selected tab');
  assert.equal((html.match(/role="tab"/g) || []).length, 5);
  for (const tab of inspectorTabs) {
    assert.ok(html.includes(`aria-controls="inspector-panel-${tab.id}"`));
    assert.ok(html.includes(`aria-labelledby="inspector-tab-${tab.id}"`));
  }
}

const studioSource = await readFile(resolve('frontend/src/pages/SubtitleStudio/SubtitleStudio.tsx'), 'utf8');
const ast = ts.createSourceFile('subtitle-studio.tsx', studioSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let preview = null; let inspector = null;
function visit(node) {
  if (ts.isJsxElement(node)) {
    const tag = node.openingElement.tagName.getText(ast);
    if (tag === 'EditorInspector') inspector = node;
    if (tag === 'section' && node.openingElement.attributes.properties.some((prop) => prop.name?.getText(ast) === 'className' && prop.initializer?.getText(ast) === '"subtitle-preview-panel"')) preview = node;
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(preview && inspector);
for (const panel of ['CaptionStylePicker', 'CaptionSettingsPanel', 'subtitle-voice-panel', 'subtitle-transcript-panel']) {
  assert.ok(!preview.getText(ast).includes(panel), `${panel} is no longer stacked under video`);
  assert.ok(inspector.getText(ast).includes(panel), `${panel} is in the inspector`);
}
assert.ok(preview.getText(ast).includes('<VideoPreviewStage'));
assert.ok(preview.getText(ast).includes('subtitle-timeline'));
assert.ok(inspector.getText(ast).includes('subtitle-caption-file-actions'));
console.log(JSON.stringify({ passed: true, fittingCases, accessibleTabStates: inspectorTabs.length, reorganizedPanels: 4 }));

const {cropRect,cropSize} = await import(pathToFileURL(resolve(output,'video-crop.mjs')));
for (const [w,h] of [[1920,1080],[1080,1920],[720,720]]) {
  for (const aspect of [9/16,16/9,1,4/5]) {
    for (const position of [0,50,100]) {
      const rect=cropRect(w,h,aspect,position,position);
      assert.ok(rect.x>=0 && rect.y>=0 && rect.x+rect.width<=w+.001 && rect.y+rect.height<=h+.001);
      assert.ok(Math.abs(rect.width/rect.height-aspect)<.0001);
    }
    const size=cropSize(w,h,aspect);
    assert.equal(size.width%2,0);assert.equal(size.height%2,0);
  }
}
assert.equal(cropRect(1920,1080,9/16,0).x,0);
assert.ok(cropRect(1920,1080,9/16,100).x>1000);
