export type CollectionArtwork={canvas:HTMLCanvasElement;span:number;aspect:number;resize:(w:number,h:number)=>void;render:(words:string[],seconds:number,timings?:{text:string;start:number;end:number}[],groupIndex?:number)=>void;dispose:()=>void;webgl?:boolean;setSource?:(source:HTMLCanvasElement|undefined)=>void;getBackdrop?:()=>{x:number;y:number;width:number;height:number;radius:number;blur:number;logicalWidth:number;logicalHeight:number}|null};
export function createCollectionArtwork(id:string,options:Record<string,unknown>):CollectionArtwork;

export function prepareCollectionArtwork(id:string):Promise<void>;
