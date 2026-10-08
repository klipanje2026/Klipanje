export type Plan = { id:string; name:string; tokens:number; price:number; currency:string; interval:string; annualTotal?:number; minimumPrice?:number };
export type Subscription = { plan:string; paidAccess?:boolean; cancelled?:boolean; loyaltyMonths?:number; nextPrice?:number; paidUntil?:string|null; allowance:number|null; remaining:number|null; unlimited?:boolean; transferLimit?:number|null; uploadUsed?:number; exportUsed?:number; used:number; periodStart:string; periodEnd:string|null; status:string };
export type Entry = { id:string; kind:string; amount:number; balance_after:number; detail:string; created_at:string; actor__username?:string };
export type MyBilling = { subscription:Subscription; usage?:{capability:string;tokens:number}[]; entries:Entry[]; pending:{id:number;plan:string}|null };
export const dateLabel=(value:string|null)=>value?new Date(value).toLocaleDateString('bs-BA'):'Bez isteka';
export const entryLabel:Record<string,string>={settings:'Postavke računa',grant:'Dodijeljeni tokeni',plan:'Aktivacija paketa',reserve:'Rezervacija',spend:'Potrošnja',refund:'Vraćeni tokeni'};
