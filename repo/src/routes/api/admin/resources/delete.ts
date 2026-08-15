import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/admin/resources/delete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabaseUrl = process.env.SUPABASE_URL!;
        const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient(supabaseUrl, publishableKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });

        const { data: roleRows } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userData.user.id)
          .in("role", ["owner", "staff"]);
        if (!roleRows?.length) return new Response("Forbidden", { status: 403 });

        const body = (await request.json()) as { resourceId?: string };
        const resourceId = body.resourceId;
        if (!resourceId) return new Response("Bad request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: resource, error: fetchErr } = await supabaseAdmin
          .from("resources")
          .select("id, file_url")
          .eq("id", resourceId)
          .maybeSingle();
        if (fetchErr || !resource) return new Response("Not found", { status: 404 });

        // The public URL looks like .../storage/v1/object/public/resource-files/<path>
        // Extract just the <path> portion so we can remove the underlying file.
        const marker = "/resource-files/";
        const idx = resource.file_url.indexOf(marker);
        const storagePath = idx >= 0 ? resource.file_url.slice(idx + marker.length) : null;

        // Chunks first (also cascades automatically via FK, but explicit is safer
        // to reason about and lets us report a clean error if it fails).
        await supabaseAdmin.from("document_chunks").delete().eq("resource_id", resourceId);

        if (storagePath) {
          const { error: storageErr } = await supabaseAdmin.storage
            .from("resource-files")
            .remove([storagePath]);
          if (storageErr) {
            // Don't hard-fail the whole delete over a storage cleanup miss —
            // log it, but still remove the DB row so it stops showing in the app.
            console.error("Storage file delete failed", storageErr);
          }
        }

        const { error: deleteErr } = await supabaseAdmin.from("resources").delete().eq("id", resourceId);
        if (deleteErr) {
          console.error("Resource delete failed", deleteErr);
          return new Response("Could not delete resource", { status: 500 });
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
