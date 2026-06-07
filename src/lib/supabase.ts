import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Cliente Supabase do produto multi-conta (DR-023). Singleton — nunca instanciar
// em dois lugares. Só liga quando VITE_SUPABASE_URL/ANON_KEY existem no build; no
// loopback/dev (sem env) fica null e o app cai no gate de token de sempre, sem
// tocar o fluxo atual. A anon key é pública por design (vai no bundle).
const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

export const supabase: SupabaseClient | null =
  url && anon
    ? createClient(url, anon, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'cockpit:supabase.session' },
      })
    : null;

export const SUPABASE_ENABLED = supabase !== null;
