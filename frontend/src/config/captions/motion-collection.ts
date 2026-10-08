// The supplied second archive; separate identities from Collection 01.
export const motionDefinitions=[
 [
  "collectionSatinImpact",
  "motion-impact",
  "Satin Impact",
  "700 79px Bahnschrift, Arial",
  2,
  1.7786561264822134
 ],
 [
  "collectionSlateFold",
  "motion-fold",
  "Slate Fold",
  "700 61px Bahnschrift, Arial",
  2,
  1.7786561264822134
 ],
 [
  "collectionStrata",
  "motion-strata",
  "Layer Forge",
  "169px Impact, \"Barlow Condensed\"",
  3,
  1.7777777777777777
 ],
 [
  "collectionContourRecoil",
  "motion-contour",
  "Contour Recoil",
  "700 153px Arial",
  2,
  1.7777777777777777
 ],
 [
  "collectionMosaicCurrent",
  "motion-mosaic",
  "Mosaic Current",
  "700 114px Arial",
  2,
  1.7786561264822134
 ],
 [
  "collectionWaterform",
  "motion-water",
  "Waterform",
  "158px Impact, \"Barlow Condensed\"",
  1,
  1.7777777777777777
 ],
 [
  "collectionLavaflow",
  "motion-lava",
  "Lavaflow",
  "158px Impact, \"Barlow Condensed\"",
  1,
  1.7777777777777777
 ],
 [
  "collectionSilkTorsion",
  "motion-silk",
  "Silk Torsion",
  "700 80px Arial",
  2,
  1.7777777777777777
 ],
 [
  "collectionCrystalFlux",
  "motion-crystal",
  "Crystal Flux",
  "700 80px Arial",
  2,
  1.7777777777777777
 ]
] as const;
export const isMotionStyle=(style:string)=>motionDefinitions.some(d=>d[0]===style);
export const motionPalettes:Record<string,Record<string,string>>={
 "motion-impact": {
  "font": "#e9d5aa",
  "secondaryFont": "#d3dae0",
  "depth": "#121c24",
  "accent": "#9e8c68",
  "highlight": "#fff5db",
  "panel": "#2d3b45",
  "background1": "#18222b",
  "background2": "#10181f",
  "background3": "#0a1016"
 },
 "motion-fold": {
  "font": "#101e2d",
  "secondaryFont": "#e5e9ee",
  "panel1": "#a9c6da",
  "panel2": "#8dafc6",
  "panel3": "#7397b2",
  "fold": "#4d6d85",
  "accent": "#89a7be",
  "background1": "#18222b",
  "background2": "#10181f",
  "background3": "#0a1016"
 },
 "motion-strata": {
  "font1": "#c2d1dc",
  "font2": "#fbfbf1",
  "font3": "#b6c6d0",
  "font4": "#6a8497",
  "font5": "#e7edf0",
  "font6": "#fbf8e9",
  "font7": "#819bac",
  "border": "#f1f6f2",
  "depth1": "#b57e55",
  "depth2": "#536877",
  "accent": "#b7844d",
  "shadow": "#000000",
  "background1": "#1e2a34",
  "background2": "#101820",
  "background3": "#080e14"
 },
 "motion-contour": {
  "font1": "#f5f4ef",
  "font2": "#c5c7c5",
  "border": "#e5e8e6",
  "highlight": "#f7f8f3",
  "shadow": "#000000",
  "background1": "#26292b",
  "background2": "#16191b",
  "background3": "#0d1012"
 },
 "motion-mosaic": {
  "font1": "#b3b4b0",
  "font2": "#e8e9e5",
  "font3": "#fafbf7",
  "shadow": "#000000",
  "background1": "#24282c",
  "background2": "#0a1015"
 },
 "motion-water": {
  "surface": "#0d3b53",
  "rim": "#65abc9",
  "specular": "#ffffff",
  "ripple": "#84cbd9",
  "background1": "#080d12",
  "background2": "#111820"
 },
 "motion-lava": {
  "crust": "#130f0e",
  "hot": "#ff2603",
  "hottest": "#ffbc2a",
  "glow": "#be2500",
  "background1": "#080d12",
  "background2": "#111820"
 },
 "motion-silk": {
  "font": "#e7e8e6",
  "side": "#65717a",
  "border": "#f3f5ef",
  "shadow": "#000000",
  "background": "#111820"
 },
 "motion-crystal": {
  "font": "#d4e0e8",
  "side": "#94a8b8",
  "border": "#f3f5ef",
  "shadow": "#000000",
  "background": "#111820"
 }
};
