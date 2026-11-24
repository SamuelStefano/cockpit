import { supabase } from '../../lib/supabase';

export async function sessionFromTokenHash(tokenHash: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
  return !error && !!data.session;
}

export async function currentAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
