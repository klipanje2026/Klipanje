"use client";

import { StyleDropdown } from "../LanguageDropdown/LanguageDropdown";
import type { Dispatch, SetStateAction } from "react";
import type { CaptionSettings } from "../../config/captions/presets";

export function CaptionDuoControls({ settings, onChange }: {
  settings: CaptionSettings; onChange: Dispatch<SetStateAction<CaptionSettings>>;
}) {
  return (
    <fieldset className="subtitle-duo-controls">
      <legend>Dvobojni obrub</legend>
      <StyleDropdown label="Dvije boje teksta" value={settings.wordColorMode}
          onChange={(event) => onChange((current) => ({ ...current, wordColorMode: event.target.value as CaptionSettings["wordColorMode"] }))}>
          <option value="solid">Jedna boja</option>
          <option value="alternate">Naizmjenične riječi</option>
          <option value="active">Izgovorena riječ</option>
          <option value="lines">Naizmjenični redovi</option>
        </StyleDropdown>
      <label className="subtitle-size-control">
        <span>Širina unutrašnjeg <b>{settings.outlineWidth}px</b></span>
        <input type="range" min="0" max="24" step="0.1" value={settings.outlineWidth}
          onChange={(event) => onChange((current) => ({ ...current, outlineWidth: Number(event.target.value) }))} />
      </label>
      <label className="subtitle-size-control">
        <span>Širina vanjskog <b>{settings.outerOutlineWidth}px</b></span>
        <input type="range" min="0" max="24" step="0.1" value={settings.outerOutlineWidth}
          onChange={(event) => onChange((current) => ({ ...current, outerOutlineWidth: Number(event.target.value) }))} />
      </label>
      <label className="subtitle-duo-glow-toggle">
        <input type="checkbox" checked={settings.outlineGlow}
          onChange={(event) => onChange((current) => ({ ...current, outlineGlow: event.target.checked }))} />
        <span>Sjaj oko obruba</span>
      </label>
      {settings.outlineGlow && <>
        <label className="subtitle-size-control">
          <span>Jačina sjaja <b>{settings.glowIntensity}%</b></span>
          <input type="range" min="0" max="200" step="5" value={settings.glowIntensity}
            onChange={(event) => onChange((current) => ({ ...current, glowIntensity: Number(event.target.value) }))} />
        </label>
        <label className="subtitle-size-control">
          <span>Širina sjaja <b>{settings.glowRadius}%</b></span>
          <input type="range" min="0" max="100" step="5" value={settings.glowRadius}
            onChange={(event) => onChange((current) => ({ ...current, glowRadius: Number(event.target.value) }))} />
        </label>
      </>}
    </fieldset>
  );
}
