import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/console/metrics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });
        const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userResult } = await client.auth.getUser();
        const user = userResult.user;
        if (!user) return new Response("Unauthorized", { status: 401 });
        const { data: role } = await client
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "owner")
          .maybeSingle();
        if (!role) return new Response("Forbidden", { status: 403 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const [{ data: subscriptions }, { data: profiles }, { data: chats }, { data: resources }] = await Promise.all([
          supabaseAdmin.from("subscriptions").select("status, created_at"),
          supabaseAdmin.from("profiles").select("id, created_at, is_premium"),
          supabaseAdmin.from("chats").select("id, subject_agent, created_at"),
          supabaseAdmin.from("resources").select("id, subject_or_module, title"),
        ]);
        const paid = (subscriptions ?? []).filter((subscription) => subscription.status === "active");
        const subjectUsage = Object.entries(
          (chats ?? []).reduce<Record<string, number>>((totals, chat) => {
            totals[chat.subject_agent] = (totals[chat.subject_agent] ?? 0) + 1;
            return totals;
          }, {}),
        ).map(([name, value]) => ({ name, value }));
        return Response.json({
          // The current payments schema stores subscription status but no price or
          // transaction amount. Return null rather than inventing a revenue value.
          mrr: null,
          activeSubscriptions: paid.length,
          signups: profiles?.length ?? 0,
          premiumUsers: (profiles ?? []).filter((profile) => profile.is_premium).length,
          chatVolume: chats?.length ?? 0,
          subjectUsage,
          documentCount: resources?.length ?? 0,
        });
      },
    },
  },
});
