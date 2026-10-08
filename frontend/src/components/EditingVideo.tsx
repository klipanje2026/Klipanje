import {useCallback,useRef,type Ref,type VideoHTMLAttributes} from 'react';
import {useEditingPreview} from '../lib/use-editing-preview';
export function EditingVideo({file,ref,src,...props}:VideoHTMLAttributes<HTMLVideoElement>&{file:File;ref?:Ref<HTMLVideoElement>}){
 const media=useRef<HTMLVideoElement|null>(null);
 const attach=useCallback((node:HTMLVideoElement|null)=>{media.current=node;if(typeof ref==='function')ref(node);else if(ref)ref.current=node;},[ref]);
 const preview=useEditingPreview(file,src,media);
 return <video {...props} ref={attach} src={preview.src} title={props.title}/>;
}
