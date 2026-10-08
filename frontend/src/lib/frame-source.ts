/** A decoded canvas exposes the same timing/size fields used by preview rendering. */
export type DecodedFrame = HTMLCanvasElement & {videoWidth:number;videoHeight:number;currentTime:number;currentSrc:string;readyState:number};
export type FrameSource = HTMLVideoElement | DecodedFrame;
