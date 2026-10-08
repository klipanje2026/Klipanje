type ElevenLabsDetail = {
  code?: string;
  status?: string;
  message?: string;
};

export async function readElevenLabsError(
  response: Response,
  capability: "narator" | "promjenu glasa" | "provjeru računa",
) {
  const payload = (await response.json().catch(() => ({}))) as {
    detail?: ElevenLabsDetail | string;
  };
  const detail = typeof payload.detail === "string" ? { message: payload.detail } : payload.detail ?? {};
  const code = detail.code || detail.status || "unknown_error";
  const suffix = detail.message ? ` ElevenLabs: ${detail.message}` : "";

  if (detail.message?.toLowerCase().includes("free users cannot use library voices")) {
    return "Odabrani glas je iz Voice Library i nije dozvoljen kroz API na besplatnom paketu. Odaberi jedan od besplatnih podrazumijevanih glasova.";
  }

  if (code === "insufficient_credits" || code === "quota_exceeded") {
    return `Nema dovoljno preostalih ElevenLabs kredita za ${capability}.${suffix}`;
  }
  if (code === "invalid_api_key" || code === "missing_api_key") {
    return `ElevenLabs API ključ nije ispravan ili više nije aktivan.${suffix}`;
  }
  if (code === "voice_access_denied" || code === "voice_not_found") {
    return `Odabrani glas nije dostupan ovom ElevenLabs računu. Izaberi drugi glas.${suffix}`;
  }
  if (code === "subscription_required" || code === "feature_not_available") {
    return `Ova ElevenLabs funkcija nije uključena u trenutni paket.${suffix}`;
  }
  if (code === "insufficient_permissions" || response.status === 401 || response.status === 403) {
    return `API ključ nema potrebnu dozvolu za ${capability}. U ElevenLabs API Keys uključi odgovarajuću dozvolu.${suffix}`;
  }
  if (code === "rate_limit_exceeded" || code === "concurrent_limit_exceeded") {
    return `ElevenLabs trenutno ograničava broj zahtjeva. Sačekaj nekoliko sekundi i pokušaj ponovo.${suffix}`;
  }
  return `ElevenLabs nije završio ${capability}.${suffix}`;
}
