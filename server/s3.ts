import { managedEnvSync } from './admin-ops';

// Upload pro S3 da DFL via a edge function pré-setada `upload-file` (as credenciais
// AWS ficam no env DELA, não aqui). Só precisamos da anon key do Supabase DFL pro
// gateway — lida do env gerenciado (~/.deck-agent/env.json, NÃO versionado: o repo é
// público). Sem a key → retorna null (S3 desligado, cai no fluxo local de sempre).
const UPLOAD_URL = process.env.DECK_S3_UPLOAD_URL
  ?? 'https://yoojxnggaxcqtsyjdrdx.supabase.co/functions/v1/upload-file';

function anonKey(): string | undefined {
  return process.env.DECK_S3_ANON_KEY || managedEnvSync().DECK_S3_ANON_KEY;
}

export function s3Enabled(): boolean { return !!anonKey(); }

// Config entregue ao browser autenticado (frame s3-config) pra ele subir o arquivo
// DIRETO na edge fn por HTTP — sem passar o arquivo pelo frame WS (que estourava o
// maxPayload do relay) e sem hardcodar a anon key no bundle (repo público). null se
// o S3 não está configurado → o front cai no upload via WS de sempre.
export function s3Config(): { uploadUrl: string; anonKey: string } | null {
  const key = anonKey();
  return key ? { uploadUrl: UPLOAD_URL, anonKey: key } : null;
}

export interface S3Result { url: string; path: string; name: string; type: string }

// Sobe um buffer e devolve a URL pública S3. Best-effort: qualquer falha → null
// (o chamador mantém o anexo local; S3 é um espelho pra exibição remota/mobile).
export async function uploadToS3(buf: Uint8Array, name: string, type: string): Promise<S3Result | null> {
  const key = anonKey();
  if (!key) return null;
  try {
    const form = new FormData();
    form.append('file', new Blob([buf as unknown as ArrayBuffer], { type: type || 'application/octet-stream' }), name);
    const res = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, apikey: key },
      body: form,
    });
    if (!res.ok) return null;
    const j = await res.json() as Partial<S3Result>;
    return j && typeof j.url === 'string' ? { url: j.url, path: j.path ?? '', name: j.name ?? name, type: j.type ?? type } : null;
  } catch { return null; }
}
