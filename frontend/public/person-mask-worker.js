let model;
// Inference runs off the UI thread; only compact alpha samples return to the editor.
self.onmessage=async(event)=>{
 const {bitmap,base}=event.data;
 try{
  if(!model){const {FilesetResolver,ImageSegmenter}=await import(`${base}/mediapipe/vision-runtime.js`);const files=await FilesetResolver.forVisionTasks(`${base}/mediapipe`);model=await ImageSegmenter.createFromOptions(files,{baseOptions:{modelAssetPath:`${base}/models/selfie_segmenter.tflite`,delegate:'CPU'},runningMode:'IMAGE',outputConfidenceMasks:true});}
  const result=model.segment(bitmap);
  try{
   const mask=result.confidenceMasks?.at(-1);if(!mask)throw new Error('Maska nije dostupna.');
   const values=mask.getAsFloat32Array(),alpha=new Uint8Array(mask.width*mask.height);let people=0;
   for(let i=0;i<values.length;i++){const v=Math.max(0,Math.min(1,(values[i]-.22)/.56));alpha[i]=Math.round(v*v*(3-2*v)*255);if(values[i]>.5)people++;}
   self.postMessage({alpha,width:mask.width,height:mask.height,person:people/values.length>.01},[alpha.buffer]);
  }finally{result.close();}
 }catch(error){self.postMessage({error:error instanceof Error?error.message:'Priprema maske nije uspjela.'});}
 finally{bitmap.close();}
};
