import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const CHUNK_SIZE = 1200; // characters, roughly a few paragraphs
const CHUNK_OVERLAP = 150;

function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    chunks.push(clean.slice(i, i + CHUNK_SIZE));
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

// Below this, a PDF is almost certainly a scanned/image-only document with
// no real text layer (pdf-parse "succeeds" but returns near-nothing), rather
// than a short-but-genuine text document.
const MIN_CHARS_PER_PAGE_BEFORE_SUSPECTED_SCAN = 20;

async function extractText(
  buffer: ArrayBuffer,
  fileUrl: string,
): Promise<{ text: string; suspectedScan: boolean }> {
  const lower = fileUrl.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(Buffer.from(buffer));
    const perPage = result.numpages > 0 ? result.text.length / result.numpages : result.text.length;
    return { text: result.text, suspectedScan: perPage < MIN_CHARS_PER_PAGE_BEFORE_SUSPECTED_SCAN };
  }
  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    return { text: result.value, suspectedScan: false };
  }
  // .txt, .md, or anything else — treat as plain text
  return { text: Buffer.from(buffer).toString("utf-8"), suspectedScan: false };
}

export const Route = createFileRoute("/api/admin/ingest")({
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

        // Confirm staff or owner role. The database policies enforce the same boundary.
        const { data: roleRows } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userData.user.id)
          .in("role", ["owner", "staff"]);
        if (!roleRows?.length) return new Response("Forbidden", { status: 403 });

        const body = (await request.json()) as { resourceId?: string; fileUrl?: string };
        const resourceId = body.resourceId;
        const fileUrl = body.fileUrl;
        if (!resourceId || !fileUrl) return new Response("Bad request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let text: string;
        let suspectedScan = false;
        try {
          const fileRes = await fetch(fileUrl);
          if (!fileRes.ok) throw new Error(`Could not fetch file: ${fileRes.status}`);
          const buffer = await fileRes.arrayBuffer();
          const extracted = await extractText(buffer, fileUrl);
          text = extracted.text;
          suspectedScan = extracted.suspectedScan;
        } catch (err) {
          console.error("Text extraction failed", err);
          await supabaseAdmin
            .from("resources")
            .update({ ingest_status: "error", chunk_count: 0, ingest_error: String(err) })
            .eq("id", resourceId);
          return new Response("Could not extract text from file", { status: 422 });
        }

        const chunks = chunkText(text);
        // Replace any previous chunks for this resource (e.g. re-upload/reprocess).
        await supabaseAdmin.from("document_chunks").delete().eq("resource_id", resourceId);

        if (chunks.length === 0 || suspectedScan) {
          const reason = suspectedScan
            ? "This looks like a scanned/image PDF with no selectable text, so the AI tutor cannot read it. Re-upload a text-based PDF, or run OCR on it first."
            : "No text could be extracted from this file.";
          await supabaseAdmin
            .from("resources")
            .update({ ingest_status: "empty", chunk_count: 0, ingest_error: reason })
            .eq("id", resourceId);
          return new Response(JSON.stringify({ ok: true, chunks: 0, warning: reason }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        const rows = chunks.map((content, chunk_index) => ({
          resource_id: resourceId,
          chunk_index,
          content,
        }));
        const { error: insertErr } = await supabaseAdmin.from("document_chunks").insert(rows);
        if (insertErr) {
          console.error("document_chunks insert failed", insertErr);
          await supabaseAdmin
            .from("resources")
            .update({ ingest_status: "error", chunk_count: 0, ingest_error: insertErr.message })
            .eq("id", resourceId);
          return new Response("Could not store extracted text", { status: 500 });
        }

        await supabaseAdmin
          .from("resources")
          .update({ ingest_status: "ok", chunk_count: chunks.length, ingest_error: null })
          .eq("id", resourceId);

        return new Response(JSON.stringify({ ok: true, chunks: chunks.length }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
