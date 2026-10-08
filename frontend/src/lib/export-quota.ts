import { apiJson } from './api';
import type { MyBilling } from './billing';

export async function checkExportQuota(output:Blob) {
  const {subscription}=await apiJson<MyBilling>('/api/subscription');
  if(subscription.unlimited || subscription.transferLimit==null) return;
  if((subscription.exportUsed||0)+output.size>(subscription.transferLimit||0)) throw new Error('Dostignut je limit preuzimanja za tvoj račun.');
  const body=new FormData();
  body.append('file',output,'export.webm');
  body.append('operationId',crypto.randomUUID());
  await apiJson('/api/subscription/export',{method:'POST',body});
}
