# Local portrait segmentation

`selfie_segmenter.tflite`: Google MediaPipe SelfieSegmenter, float16, version 1.
Source: https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite
Guide/model card: https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter

Runtime files in `/mediapipe` are copied from the pinned npm dependency `@mediapipe/tasks-vision@0.10.22-rc.20250304` (Apache-2.0). Keep those files and the npm package version aligned when upgrading. Inference runs locally; video frames are not sent to Google. This first portrait effect runs on CPU, with bounded in-memory frame masks. Fine hair, fast movement, distant people and slow devices need further evaluation before production use.

`blaze_face_short_range.tflite`: MediaPipe BlazeFace short range, float16, version 1.
Source: https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite
Official integration: https://github.com/google-ai-edge/mediapipe-samples-web/blob/main/src/tasks/face-detector.ts
Used locally to keep Dynamic Glass foreground below detected faces. No frames leave the device. Detection is not guaranteed for profiles, distant faces or occlusion; the original layout remains the fallback.

The background scan uses `/person-mask-worker.js` (classic worker) and the matching pinned npm `vision_bundle.mjs` copied as `/mediapipe/vision-runtime.js`. Classic worker mode is required by MediaPipe WASM loading through importScripts. Samples are session-only alpha masks, bounded globally to 64 MiB; scanning runs once independently of playback and keeps samples across pauses/seeks for this session.
