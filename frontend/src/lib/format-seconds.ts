/** UI seconds always have at most one decimal; media timing keeps full precision. */
export function formatSeconds(value:number):number {
 return Number.isFinite(value)?Number(value.toFixed(1)):0;
}
