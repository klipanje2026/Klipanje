import {captionRenderSegment,ignoresCaptionTitles,ownCaptionLayout} from './caption-word-roles';
import {withCollectionBackdrop} from './collection-captions';
import {drawPremiumOrange} from './premium-orange';
import {drawMetallicCompact} from './metallic-compact';
import {softenPersonMask,preparedPersonMask} from './person-mask-scan';
import {drawDynamicGlass} from './dynamic-glass';
import {drawCaption} from './caption-renderer';
import type {Segment,StyleKey,CaptionSettings} from '../config/captions/presets';
import type {FrameSource} from './frame-source';
import { cropRect } from './video-crop';
import type { ImageSegmenter, FaceDetector } from '@mediapipe/tasks-vision';

let model: ImageSegmenter | undefined;
let faceDetector: FaceDetector | undefined;
const captionAnchors=new WeakMap<FrameSource,Map<string,number|undefined>>();
const faceCaches=new WeakMap<FrameSource,Map<string,number | undefined>>();
let loading: Promise<void> | undefined;
const prismLayers=new WeakMap<CanvasRenderingContext2D,[HTMLCanvasElement,HTMLCanvasElement]>();
const stablePrism=new WeakMap<FrameSource,{time:number;src:string;mask:HTMLCanvasElement}>();
const caches = new WeakMap<FrameSource, Map<string, HTMLCanvasElement>>();

export function preparePersonMask() {
  if (!loading) loading = (async () => {
    const { FilesetResolver, ImageSegmenter, FaceDetector } = await import('@mediapipe/tasks-vision');
    const files = await FilesetResolver.forVisionTasks('/mediapipe');
    model = await ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetPath: '/models/selfie_segmenter.tflite', delegate: 'CPU' },
      runningMode: 'IMAGE', outputCategoryMask: false, outputConfidenceMasks: true,
    });
    // Face detection supplements the shared silhouette; a missing face model must not break masking.
    try {faceDetector=await FaceDetector.createFromOptions(files,{
      baseOptions:{modelAssetPath:'/models/blaze_face_short_range.tflite',delegate:'CPU'},
      runningMode:'IMAGE',minDetectionConfidence:.55,
    });} catch {faceDetector=undefined;}
  })().catch(error => { loading = undefined; throw error; });
  return loading;
}

export function personMask(video:FrameSource) {
  const prepared=preparedPersonMask(video);if(prepared)return prepared;
  if (!model) throw new Error('Izdvajanje osobe još nije spremno.');
  if (video.readyState < 2 || !video.videoWidth) return false;
  let cache = caches.get(video);
  if (!cache) { cache = new Map(); caches.set(video, cache); }
  const key = `${video.currentSrc}:${Math.round(video.currentTime * 30)}`;
  let mask = cache.get(key);
  if (!mask) {
    const input = document.createElement('canvas');
    const scale=Math.min(1,1024/Math.max(video.videoWidth,video.videoHeight));
    input.width = Math.max(1,Math.round(video.videoWidth*scale)); input.height = Math.max(1,Math.round(video.videoHeight*scale));
    input.getContext('2d')!.drawImage(video, 0, 0, input.width, input.height);
    const result = model.segment(input);
    try {
      const confidence = result.confidenceMasks?.[result.confidenceMasks.length > 1 ? 1 : 0];
      if (!confidence) throw new Error('Maska osobe nije dostupna.');
      const values = confidence.getAsFloat32Array();
      mask = document.createElement('canvas'); mask.width = confidence.width; mask.height = confidence.height;
      const ctx = mask.getContext('2d')!;
      const pixels = ctx.createImageData(mask.width, mask.height);
      let personPixels = 0;
      for (let i = 0; i < values.length; i++) {
        if (values[i] > .5) personPixels++;
        const alpha = Math.max(0, Math.min(1, (values[i] - .22) / .56));
        pixels.data[i * 4 + 3] = Math.round(alpha * alpha * (3 - 2 * alpha) * 255);
      }
      ctx.putImageData(pixels, 0, 0);
      softenPersonMask(mask);
      mask.dataset.person = String(personPixels / values.length > .01);
      cache.set(key, mask);
      // About 16 MB per live video at most; old videos are released with their element.
      if (cache.size > 60) cache.delete(cache.keys().next().value!);
    } finally { result.close(); }
  }
  return mask;
}
/** Detect on source pixels, then project the chin into the exact cropped/zoomed frame. */
export function headBottomInFrame(video:FrameSource,aspect:number,cropX:number,cropY:number,destination?:{x:number;y:number;width:number;height:number},zoom=1){
 if(!faceDetector||video.readyState<2||!video.videoWidth)return undefined;
 let cache=faceCaches.get(video);if(!cache){cache=new Map();faceCaches.set(video,cache);}
 const key=JSON.stringify([video.currentSrc,Math.round(video.currentTime*30),aspect,cropX,cropY,destination,zoom]);
 if(cache.has(key))return cache.get(key);
 const input=document.createElement('canvas'),scale=Math.min(1,512/Math.max(video.videoWidth,video.videoHeight));
 input.width=Math.max(1,Math.round(video.videoWidth*scale));input.height=Math.max(1,Math.round(video.videoHeight*scale));
 input.getContext('2d')!.drawImage(video,0,0,input.width,input.height);
 const crop=cropRect(video.videoWidth,video.videoHeight,aspect,cropX,cropY);
 const detect=(ox:number,oy:number,size:number)=>{
  const tile=document.createElement('canvas');tile.width=input.width;tile.height=input.height;
  tile.getContext('2d')!.drawImage(input,ox*input.width,oy*input.height,size*input.width,size*input.height,0,0,tile.width,tile.height);
  return faceDetector!.detect(tile).detections.flatMap(face=>{
   const box=face.boundingBox;if(!box)return [];
   return [{x:ox+(box.originX+box.width/2)/tile.width*size,y:oy+(box.originY+box.height*1.15)/tile.height*size}];
  });
 };
 let faces=detect(0,0,1);
 // Short-range detection needs a tighter view when a speaker occupies little of the full frame.
 if(!faces.length){
  for(const [x,y] of [[.25,.25],[.25,0],[.25,.5],[0,.25],[.5,.25],[0,0],[.5,0],[0,.5],[.5,.5]]){
   faces=detect(x,y,.5);if(faces.length)break;
  }
 }
 let bottom:number|undefined;
 for(const {x,y} of faces){
  const projectedX=destination?(destination.x+x*destination.width)/100:.5+((x*video.videoWidth-crop.x)/crop.width-.5)*zoom;
  const projectedY=destination?(destination.y+y*destination.height)/100:.5+((y*video.videoHeight-crop.y)/crop.height-.5)*zoom;
  if(projectedX<0||projectedX>1||projectedY<0||projectedY>1)continue;
  bottom=Math.max(bottom??0,projectedY);
 }
 cache.set(key,bottom);if(cache.size>60)cache.delete(cache.keys().next().value!);
 return bottom;
}

/** Only caption pixels are erased. Video stays intact and mask uses the same crop. */
export function maskCaptionBehindPerson(context: CanvasRenderingContext2D, video: FrameSource, cropX = 50, cropY = 50, destination?: {x:number;y:number;width:number;height:number}, prismColor?:string,prismStrength=100, cameraZoom=1, scanner=false) {
  let mask:HTMLCanvasElement|false;
  const previous=prismColor?stablePrism.get(video):undefined;
  if(previous&&previous.src===video.currentSrc&&video.currentTime>=previous.time&&video.currentTime-previous.time<.5)mask=previous.mask;
  else {mask=personMask(video);if(mask&&prismColor){
    if(previous&&previous.src===video.currentSrc&&video.currentTime>previous.time&&video.currentTime-previous.time<.8){const blend=document.createElement('canvas');blend.width=mask.width;blend.height=mask.height;const ctx=blend.getContext('2d')!;ctx.globalAlpha=.35;ctx.drawImage(previous.mask,0,0,blend.width,blend.height);ctx.globalAlpha=.65;ctx.globalCompositeOperation='lighter';ctx.drawImage(mask,0,0);blend.dataset.person=mask.dataset.person;mask=blend;}
    stablePrism.set(video,{time:video.currentTime,src:video.currentSrc,mask});
  }}
  if(!mask)return false;
  const crop = cropRect(video.videoWidth, video.videoHeight, context.canvas.width / context.canvas.height, cropX, cropY);
  if(prismColor){
    let layers=prismLayers.get(context);if(!layers){layers=[document.createElement('canvas'),document.createElement('canvas')];prismLayers.set(context,layers);}const [original,intersection]=layers;for(const layer of layers){if(layer.width!==context.canvas.width||layer.height!==context.canvas.height){layer.width=context.canvas.width;layer.height=context.canvas.height;}const ctx=layer.getContext('2d')!;ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,layer.width,layer.height);}const ink=original.getContext('2d')!;ink.drawImage(context.canvas,0,0);
    // Reuse the exact person/crop intersection, then tint only the caption pixels on the person.
    ink.save();ink.globalCompositeOperation='destination-out';if(!destination&&cameraZoom!==1){ink.translate(ink.canvas.width/2,ink.canvas.height/2);ink.scale(cameraZoom,cameraZoom);ink.translate(-ink.canvas.width/2,-ink.canvas.height/2);}if(destination)ink.drawImage(mask,destination.x/100*ink.canvas.width,destination.y/100*ink.canvas.height,destination.width/100*ink.canvas.width,destination.height/100*ink.canvas.height);else ink.drawImage(mask,crop.x/video.videoWidth*mask.width,crop.y/video.videoHeight*mask.height,crop.width/video.videoWidth*mask.width,crop.height/video.videoHeight*mask.height,0,0,ink.canvas.width,ink.canvas.height);ink.restore();
    const tint=intersection.getContext('2d')!;tint.drawImage(context.canvas,0,0);tint.globalCompositeOperation='destination-out';tint.drawImage(original,0,0);tint.globalCompositeOperation='source-in';if(scanner){
      // Preserve facial/clothing detail: a photographic negative clipped to glyph/person overlap.
      tint.save();tint.filter='invert(1) saturate(.8) contrast(1.12)';
      if(destination)tint.drawImage(video,destination.x/100*tint.canvas.width,destination.y/100*tint.canvas.height,destination.width/100*tint.canvas.width,destination.height/100*tint.canvas.height);
      else {tint.translate(tint.canvas.width/2,tint.canvas.height/2);tint.scale(cameraZoom,cameraZoom);tint.translate(-tint.canvas.width/2,-tint.canvas.height/2);tint.drawImage(video,crop.x,crop.y,crop.width,crop.height,0,0,tint.canvas.width,tint.canvas.height);}
      tint.restore();
    }else {tint.fillStyle=prismColor;tint.fillRect(0,0,original.width,original.height);}context.save();context.globalAlpha=Math.max(0,Math.min(1,prismStrength/100));context.drawImage(intersection,0,0);context.restore();return mask.dataset.person==='true';
  }
  context.save();
  context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
  context.globalCompositeOperation = 'destination-out';
  if(!destination&&cameraZoom!==1){context.translate(context.canvas.width/2,context.canvas.height/2);context.scale(cameraZoom,cameraZoom);context.translate(-context.canvas.width/2,-context.canvas.height/2);}
  if (destination) context.drawImage(mask,destination.x/100*context.canvas.width,destination.y/100*context.canvas.height,destination.width/100*context.canvas.width,destination.height/100*context.canvas.height);
  else
  context.drawImage(mask, crop.x / video.videoWidth * mask.width, crop.y / video.videoHeight * mask.height,
    crop.width / video.videoWidth * mask.width, crop.height / video.videoHeight * mask.height,
    0, 0, context.canvas.width, context.canvas.height);
  context.restore();
  return mask.dataset.person === 'true';
}

export function drawPersonCaption(context:CanvasRenderingContext2D,segment:Segment,time:number,style:StyleKey,settings:CaptionSettings,video?:FrameSource|null,cropX=50,cropY=50,destination?:{x:number;y:number;width:number;height:number},cameraZoom=1){
 const own=(segment.separateStyle===false?undefined:segment.detachedStyle)||segment.laneStyle,key=own?.style||style,config=own?.settings||settings;
 if(segment.role==='title'&&segment.suggestedTitle&&ignoresCaptionTitles(key))return null;
 segment=captionRenderSegment(segment,key);
 if(key==='collectionGlass'||key.startsWith('collectionStudio'))return withCollectionBackdrop(context,video?{video,cropX,cropY,destination,cameraZoom}:undefined,()=>drawCaption(context,segment,time,style,settings));
 if(ownCaptionLayout(key)){
  let headBottom:number|undefined;
  if(video&&video.readyState>=2){
   let anchors=captionAnchors.get(video);if(!anchors){anchors=new Map();captionAnchors.set(video,anchors);}
   // Freeze the screen-space anchor, including camera zoom, for this entire caption.
   const anchorKey=JSON.stringify([video.currentSrc,segment.id,segment.start,segment.end,segment.text,context.canvas.width/context.canvas.height,cropX,cropY]);
   if(!anchors.has(anchorKey)||anchors.get(anchorKey)===undefined){
    anchors.set(anchorKey,headBottomInFrame(video,context.canvas.width/context.canvas.height,cropX,cropY,destination,cameraZoom));
    if(anchors.size>500)anchors.delete(anchors.keys().next().value!);
   }
   headBottom=anchors.get(anchorKey);
  }
  const fixed={...config,emphasisWord:undefined,secondaryStyle:undefined};
  if(key==='premiumOrangeV4')return drawPremiumOrange(context,segment,time,fixed,headBottom);
  if(key==='metallicCompactV2')return drawMetallicCompact(context,segment,time,fixed,headBottom);
  if(!config.behindPerson)return drawDynamicGlass(context,segment,time,config,'all',headBottom);
  const back=drawDynamicGlass(context,segment,time,config,'background');
  if(video&&video.readyState>=2)maskCaptionBehindPerson(context,video,cropX,cropY,destination,undefined,100,cameraZoom);
  const front=drawDynamicGlass(context,segment,time,config,'foreground',headBottom);
  const bounds=front||back;
  return bounds?{...bounds,words:[...(back?.words||[]),...(front?.words||[])]}:null;
 }
 if(!segment.effectOnly&&segment.role!=='title'&&config.secondaryStyle?.behindPerson!==undefined&&!!config.secondaryStyle.behindPerson!==!!config.behindPerson){
  const back=config.secondaryStyle.behindPerson?'secondary':'primary',front=back==='secondary'?'primary':'secondary';
  const secondaryBounds=drawCaption(context,segment,time,style,settings,undefined,back);
  if(video&&video.readyState>=2)maskCaptionBehindPerson(context,video,cropX,cropY,destination,undefined,100,cameraZoom);
  const primaryBounds=drawCaption(context,segment,time,style,settings,undefined,front);
  return primaryBounds?{...primaryBounds,words:[...(primaryBounds.words||[]),...(secondaryBounds?.words||[])]}:secondaryBounds;
 }
 const headerOnly=segment.role!=='title'&&['editorialHeader','boldHeader','vistaRise','underlinedEditorial'].includes(key);
 let bounds=drawCaption(context,segment,time,style,settings,undefined,headerOnly||segment.effectOnly?'background':'all');
 if(config.behindPerson&&video&&video.readyState>=2)maskCaptionBehindPerson(context,video,cropX,cropY,destination,(config.fillTexture==='prism'||['prism','prismPop','prismWords'].includes(key))?(config.fillTexture==='prism'?config.fillTextureColor??config.highlightColor:config.highlightColor):undefined,config.prismStrength??100,cameraZoom,key==='prismWords');
 if(headerOnly&&!segment.effectOnly)bounds=drawCaption(context,segment,time,style,settings,undefined,'foreground');
 return bounds;
}
