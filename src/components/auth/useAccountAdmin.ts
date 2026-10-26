import { useEffect, useState } from 'react';
import { supabase, SUPABASE_ENABLED } from '../../lib/supabase';

// RLS lets an account read only its own row; any error reads as not admin.
export function useAccountAdmin(userId: string | undefined): boolean {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    setAdmin(false);
    if (!SUPABASE_ENABLED || !supabase || !userId) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase!.from('account').select('is_admin').eq('id', userId).maybeSingle();
      if (!cancelled && !error) setAdmin(data?.is_admin === true);
    })();
    return () => { cancelled = true; };
  }, [userId]);
  return admin;
}
