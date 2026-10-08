import type { VideoCaptions } from './video-captions';
const DATABASE_NAME = "gordondm-video-studio";
const STORE_NAME = "projects";
const HANDOFF_KEY = "pending-handoff";

type VideoStudioHandoff = {
  video: File;
  captions?: VideoCaptions;
  voice?: File;
  muteOriginal: boolean;
  originalVolume?: number;
  voiceStart: number;
  createdAt: number;
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveVideoStudioHandoff(userId: number, video: File, voiceUrl: string, muteOriginal: boolean, voiceStart: number, captions?: VideoCaptions, originalVolume=100) {
  const voiceBlob = await fetch(voiceUrl).then((response) => response.blob());
  const extension = voiceBlob.type.includes("wav") ? "wav" : "mp3";
  const voice = new File([voiceBlob], `novi-glas.${extension}`, {
    type: voiceBlob.type || "audio/mpeg",
  });
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(
      { video, voice, captions, muteOriginal, originalVolume, voiceStart, createdAt: Date.now() } satisfies VideoStudioHandoff,
      `${HANDOFF_KEY}:${userId}`,
    );
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function loadVideoStudioHandoff(userId: number, destination: "video" | "subtitles" = "video") {
  const handoffKey = destination === "video" ? HANDOFF_KEY : "pending-subtitles";
  const database = await openDatabase();
  const handoff = await new Promise<VideoStudioHandoff | undefined>(
    (resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(`${handoffKey}:${userId}`);
      let value: VideoStudioHandoff | undefined;
      request.onsuccess = () => { value = request.result as VideoStudioHandoff | undefined;  };
      transaction.oncomplete = () => resolve(value);
      transaction.onerror = () => reject(transaction.error);
      request.onerror = () => reject(request.error);
    },
  );
  database.close();
  return handoff;
}

export async function saveVideoOnlyHandoff(userId: number, video: File, captions?: VideoCaptions, muteOriginal=false, originalVolume=100) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put({ video, captions, muteOriginal, originalVolume, voiceStart: 0, createdAt: Date.now() } satisfies VideoStudioHandoff, `${HANDOFF_KEY}:${userId}`);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { database.close(); }
}

export async function saveSubtitleHandoff(userId: number, video: File, captions?: VideoCaptions) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put({ video, captions, muteOriginal: false, voiceStart: 0, createdAt: Date.now() } satisfies VideoStudioHandoff, `pending-subtitles:${userId}`);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { database.close(); }
}

export async function acknowledgeHandoff(userId:number,destination:'video'|'subtitles') {
 const db=await openDatabase();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE_NAME,'readwrite');tx.objectStore(STORE_NAME).delete(`${destination==='video'?HANDOFF_KEY:'pending-subtitles'}:${userId}`);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
}
