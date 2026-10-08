export type RiotMotion = 'spring' | 'slide' | 'wave' | 'flip' | 'zoom' | 'glitch';
export type RiotWord = {
  text: string; x: number; y: number; size: number; at: number; tilt: number;
  colors: string[]; box?: string | null; dark?: boolean; boxOpacity?: number;
  fontFamily?: string; weight?: number; italic?: boolean; letterSpacing?: number;
  depth?: number; depthColor?: string; outlineWidth?: number; outlineColor?: string;
  motion?: RiotMotion; motionStrength?: number; entranceDuration?: number;
  exitDuration?: number; letterDelay?: number; underline?: boolean; rasterScale?: number;
  damping?: number; frequency?: number; floatStrength?: number;
  trails?: boolean; trailStrength?: number; trailColor1?: string; trailColor2?: string;
  faceGradient?: boolean; glow?: number; boxRadius?: number;
  detailScale?: number;
  underlineWidth?: number; underlineDuration?: number; underlineColor?: string;
};
type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Surface = HTMLCanvasElement | OffscreenCanvas;
export function riotGlyphPose(local:number,duration:number,mode?:RiotMotion,strength?:number,index?:number,damping?:number,frequency?:number): {
  x:number; y:number; rotation:number; scaleX:number; scaleY:number; trail:number;
};
export function createNeonRiotPainter(createCanvas: (width: number, height: number) => Surface): {
  measureWord(word: RiotWord): {width: number};
  prepareWord(word: RiotWord): {width: number};
  drawWord(ctx: Context, word: RiotWord, age: number, sceneEnd: number, index: number): void;
  drawBurst(ctx: Context, x: number, y: number, elapsed: number, palette: string[], strength?: number, count?:number, duration?:number): void;
  star(ctx: Context, x: number, y: number, radius: number, color: string, rotation?: number, alpha?: number): void;
  clearCache(): void;
};
