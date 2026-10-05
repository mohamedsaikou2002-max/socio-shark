import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions").select("status,current_period_end")
      .eq("user_id", data.user.id).maybeSingle();
    if (subscriptionError) throw new Error("Unable to verify your payment access. Please try again.");
    const active = subscription?.status === "active" || subscription?.status === "trialing";
    const unexpired = !subscription?.current_period_end || new Date(subscription.current_period_end) > new Date();
    if (!active || !unexpired) throw redirect({ to: "/billing" });
    return { user: data.user };
  },
  component: Outlet,
});
