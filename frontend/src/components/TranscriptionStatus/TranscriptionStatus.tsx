import {useEffect,useState} from "react";
import type { AnalysisStatus } from "../../lib/transcription-client";
const headings = { preparing: "Priprema zvuka", connecting: "Povezivanje", uploading: "Slanje zvuka", recognizing: "Prepoznavanje govora", done: "Titlovi su spremni", error: "Obrada nije završena", cancelled: "Obrada je prekinuta" };
export function TranscriptionStatus({ status, onCancel, onRetry }: { status: AnalysisStatus; onCancel: () => void; onRetry: () => void }) {
  const [expired,setExpired]=useState(false);
  useEffect(()=>{if(status.stage!=='done')return;const timer=window.setTimeout(()=>setExpired(true),3500);return()=>window.clearTimeout(timer);},[status.stage]);
  if(expired && status.stage==='done')return null;
  const running = !["done", "error", "cancelled"].includes(status.stage);
  const percent = status.stage === 'preparing' || status.stage === 'uploading' ? status.percent : undefined;
  return <div className={`subtitle-status-inline is-${status.stage}`} role={status.stage === "error" ? "alert" : "status"}>
    <span aria-hidden="true">{status.stage === "done" ? "✓" : status.stage === "error" ? "!" : "◌"}</span>
    <span>{headings[status.stage]}{percent !== undefined ? ` · ${percent}%` : ""}</span>
    {status.stage === "error" && status.message && <span className="subtitle-status-error">{status.message}</span>}
    {running && <button onClick={onCancel}>Prekini</button>}
    {(status.stage === "error" || status.stage === "cancelled") && <button onClick={onRetry}>Pokušaj ponovo</button>}
  </div>;
}
