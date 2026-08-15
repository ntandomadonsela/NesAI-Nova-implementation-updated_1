import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { streamText, type ModelMessage } from "ai";
import { createAiGateway } from "@/lib/ai-gateway.server";
import { getAgent } from "@/lib/subject-agents";
import { buildTutorSystemPrompt } from "@/lib/tutor-prompt";

const FREE_DAILY_LIMIT = 5;
// Model id format depends on your provider, e.g. "gpt-4o-mini" for OpenAI,
// "google/gemini-2.5-flash" for OpenRouter. Override via AI_GATEWAY_MODEL.
const MODEL_ID = process.env.AI_GATEWAY_MODEL ?? "gpt-4o-mini";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Auth
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabaseUrl = process.env.SUPABASE_URL!;
        const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY!;

        // Client acting as the user (RLS applies)
        const supabase = createClient(supabaseUrl, publishableKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData.user) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = userData.user.id;

        // 2. Load profile & enforce daily limit
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, academic_level, is_premium, daily_tokens, last_reset")
          .eq("id", userId)
          .maybeSingle();

        if (!profile) {
          return new Response("Profile not found", { status: 404 });
        }

        // Reset counter if >24h since last_reset
        const now = new Date();
        const lastReset = new Date(profile.last_reset);
        const hoursSince = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);
        let dailyTokens = profile.daily_tokens;
        if (hoursSince >= 24) {
          dailyTokens = 0;
          await supabase
            .from("profiles")
            .update({ daily_tokens: 0, last_reset: now.toISOString() })
            .eq("id", userId);
        }

        if (!profile.is_premium && dailyTokens >= FREE_DAILY_LIMIT) {
          return new Response(
            JSON.stringify({ error: "Daily limit reached", reason: "daily_limit" }),
            { status: 429, headers: { "Content-Type": "application/json" } },
          );
        }

        // 3. Parse body
        type Body = {
          messages: Array<{ role: "user" | "assistant"; content: string }>;
          agentId?: string;
          resourceContext?: { id?: string; title?: string; subject?: string; year?: string } | null;
        };
        const body = (await request.json()) as Body;
        if (!Array.isArray(body.messages) || body.messages.length === 0) {
          return new Response("Bad request", { status: 400 });
        }

        const fallbackAgent = getAgent(body.agentId);
        const { data: tutor } = await supabase
          .from("tutors")
          .select("id, subject_label, system_prompt_overlay")
          .eq("id", body.agentId ?? fallbackAgent.id)
          .eq("is_active", true)
          .maybeSingle();
        const subjectLabel = tutor?.subject_label ?? fallbackAgent.name.replace(" Tutor", "");
        let system = buildTutorSystemPrompt({
          overlay: tutor?.system_prompt_overlay ?? fallbackAgent.systemPrompt,
          academicLevel: profile.academic_level,
        });
        if (body.resourceContext?.title) {
          system += `\n\nThe student is currently studying this document: "${body.resourceContext.title}"${
            body.resourceContext.subject ? ` (${body.resourceContext.subject})` : ""
          }${body.resourceContext.year ? `, year ${body.resourceContext.year}` : ""}. Frame examples and explanations around this material when relevant.`;
        }

        // RAG: use the selected document when supplied, otherwise retrieve from
        // an uploaded resource that matches the active subject tutor.
        const lastUserMessage = [...body.messages].reverse().find((m) => m.role === "user")?.content ?? "";
        let resourceId = body.resourceContext?.id;
        if (!resourceId) {
          // Only ever auto-pick a resource that actually has usable extracted
          // text (ingest_status = 'ok') — otherwise we'd silently attach a
          // resource with zero chunks and gain nothing. Prefer the student's
          // academic level and the most recent year when several match.
          const { data: matchingResource } = await supabase
            .from("resources")
            .select("id")
            .eq("ingest_status", "ok")
            .ilike("subject_or_module", `%${subjectLabel}%`)
            .eq("academic_level", profile.academic_level ?? "")
            .order("year", { ascending: false })
            .limit(1)
            .maybeSingle();
          resourceId = matchingResource?.id;
        }
        if (resourceId) {
          const { data: chunks, error: chunkErr } = await supabase.rpc("match_document_chunks", {
            _resource_id: resourceId,
            _query: lastUserMessage,
            _limit: 4,
          });
          if (chunkErr) {
            console.error("match_document_chunks error", chunkErr);
          } else if (chunks && chunks.length > 0) {
            const context = chunks
              .map((c: { chunk_index: number; content: string }) => `[Excerpt ${c.chunk_index + 1}] ${c.content}`)
              .join("\n\n");
            system += `\n\nHere are the most relevant excerpts from the actual document, uploaded by NesAI Nova staff. Ground your answer in these where they're relevant, and say so explicitly when you're quoting or paraphrasing them:\n\n${context}`;
          }
        }

        // 4. Increment counter for non-premium (best-effort)
        if (!profile.is_premium) {
          await supabase
            .from("profiles")
            .update({ daily_tokens: dailyTokens + 1 })
            .eq("id", userId);
        }

        // 5. Call the configured AI gateway
        const gatewayKey = process.env.AI_GATEWAY_API_KEY;
        if (!gatewayKey) {
          return new Response("Missing AI_GATEWAY_API_KEY", { status: 500 });
        }
        const gateway = createAiGateway(gatewayKey, process.env.AI_GATEWAY_BASE_URL);

        try {
          const result = streamText({
            model: gateway(MODEL_ID),
            system,
            messages: body.messages as ModelMessage[],
          });
          return result.toTextStreamResponse();
        } catch (err: any) {
          console.error("AI gateway error", err);
          const status = err?.statusCode ?? 500;
          if (status === 429) {
            return new Response(
              JSON.stringify({ error: "Rate limited by AI provider", reason: "provider_rate" }),
              { status: 429, headers: { "Content-Type": "application/json" } },
            );
          }
          if (status === 402) {
            return new Response("AI credits exhausted", { status: 402 });
          }
          return new Response("AI error", { status: 500 });
        }
      },
    },
  },
});
