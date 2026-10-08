export function joinOrphanRows<T>(rows:T[][],text?:(word:T)=>string):T[][];
export function nativeFontSize(px:number):number;
export function captionRows(words:string[],size?:number,font?:string,width?:number):string[];
export function rowBaseline(line:number,count:number,height:number,size:number):number;
export function rowFontSize(size:number,count:number,height:number):number;
