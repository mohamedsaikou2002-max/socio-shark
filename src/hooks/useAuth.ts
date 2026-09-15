import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user: (session?.user ?? null) as User | null, loading };
}

export interface Membership {
  status: string;
  current_period_end: string | null;
}

export function useMembership(userId: string | undefined) {
  return useQuery({
    queryKey: ["membership", userId],
    enabled: Boolean(userId),
    refetchInterval: 15000,
    queryFn: async (): Promise<Membership> => {
      const { data } = await supabase
        .from("subscriptions")
        .select("status,current_period_end")
        .eq("user_id", userId!)
        .maybeSingle();
      return (data as Membership | null) ?? { status: "inactive", current_period_end: null };
    },
  });
}

export function isActive(m?: Membership | null) {
  if (!m) return false;
  if (!["active", "trialing"].includes(m.status)) return false;
  if (m.current_period_end && new Date(m.current_period_end) < new Date()) return false;
  return true;
}

export async function signOut() {
  await supabase.auth.signOut();
}
