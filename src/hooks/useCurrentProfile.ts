import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface CurrentProfile {
  full_name: string | null;
  phone_number: string | null;
}

export function useCurrentProfile() {
  const [profile, setProfile] = useState<CurrentProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, phone_number')
        .eq('id', session.user.id)
        .single();
      if (!cancelled && data) setProfile(data);
    })();
    return () => { cancelled = true; };
  }, []);

  return profile;
}
