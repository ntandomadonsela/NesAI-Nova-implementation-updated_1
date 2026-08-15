import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { canManageContent, useRole } from "@/hooks/use-role";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UploadCloud, Loader2, Sparkles, FileText } from "lucide-react";

export const Route = createFileRoute("/admin/upload")({
  head: () => ({ meta: [{ title: "Staff Upload Console | NesAI Nova" }] }),
  component: AdminUploadPage,
});

const LEVELS = ["Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12", "University"];
const DOC_TYPES = [
  { value: "past_paper", label: "Past Paper" },
  { value: "memo", label: "Memo" },
  { value: "study_note", label: "Study Notes" },
  { value: "summary", label: "Summary" },
];

type Resource = {
  id: string;
  title: string;
  document_type: string;
  academic_level: string;
  subject_or_module: string;
  year: number;
  created_at: string;
  ingest_status: "pending" | "ok" | "empty" | "error";
  chunk_count: number;
  ingest_error: string | null;
};

function AdminUploadPage() {
  const navigate = useNavigate();
  const role = useRole();
  const canUpload = canManageContent(role);
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [level, setLevel] = useState("Grade 12");
  const [curriculum, setCurriculum] = useState("");
  const [subject, setSubject] = useState("");
  const [docType, setDocType] = useState("past_paper");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [file, setFile] = useState<File | null>(null);
  const [groundAi, setGroundAi] = useState(true);
  const [status, setStatus] = useState<"idle" | "uploading" | "ingesting" | "done" | "error">(
    "idle",
  );

  useEffect(() => {
    if (role !== undefined && !canManageContent(role)) navigate({ to: "/" });
  }, [role, navigate]);

  const { data: recent = [] } = useQuery({
    queryKey: ["admin-resources"],
    enabled: canUpload,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select(
          "id, title, document_type, academic_level, subject_or_module, year, created_at, ingest_status, chunk_count, ingest_error",
        )
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as Resource[];
    },
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title || !curriculum || !subject) {
      toast.error("Please fill in every field and choose a file.");
      return;
    }

    setStatus("uploading");
    try {
      const path = `${crypto.randomUUID()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("resource-files").upload(path, file);
      if (uploadErr) throw uploadErr;

      const { data: publicUrl } = supabase.storage.from("resource-files").getPublicUrl(path);

      const { data: resource, error: insertErr } = await supabase
        .from("resources")
        .insert({
          title,
          file_url: publicUrl.publicUrl,
          academic_level: level,
          faculty_or_curriculum: curriculum,
          subject_or_module: subject,
          document_type: docType,
          year: Number(year),
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      if (groundAi) {
        setStatus("ingesting");
        const { data: sess } = await supabase.auth.getSession();
        const res = await fetch("/api/admin/ingest", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sess.session?.access_token}`,
          },
          body: JSON.stringify({ resourceId: resource.id, fileUrl: publicUrl.publicUrl }),
        });
        if (!res.ok) {
          toast.warning("Uploaded, but the AI couldn't index this file's text yet.");
        } else {
          const result = await res.json().catch(() => null);
          if (result?.warning) {
            toast.warning(result.warning, { duration: 8000 });
          }
        }
      }

      toast.success("Uploaded to the Vault.");
      setStatus("done");
      setTitle("");
      setCurriculum("");
      setSubject("");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["admin-resources"] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Upload failed.");
      setStatus("error");
    }
  }

  if (role === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!canUpload) return null;

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Staff Console
        </div>
        <h1 className="mt-2 font-serif text-4xl">Upload Notes & Past Papers</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Files land in The Vault immediately. Tick "ground the AI tutor" to also let students ask
          the tutor questions about this specific document.
        </p>

        <form onSubmit={onSubmit} className="paper-card mt-8 grid gap-5 p-8 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Grade 12 Mathematics Paper 1, November 2025"
            />
          </div>

          <div>
            <Label>Academic Level</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Document Type</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Curriculum / Faculty</Label>
            <Input
              value={curriculum}
              onChange={(e) => setCurriculum(e.target.value)}
              placeholder="e.g. CAPS, IEB, Law Faculty"
            />
          </div>

          <div>
            <Label>Subject / Module</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Mathematics"
            />
          </div>

          <div>
            <Label>Year</Label>
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>

          <div>
            <Label>File (PDF, DOCX or TXT)</Label>
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <label className="md:col-span-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={groundAi}
              onChange={(e) => setGroundAi(e.target.checked)}
            />
            Also ground the AI tutor in this document's text (recommended)
          </label>

          <div className="md:col-span-2">
            <Button
              type="submit"
              disabled={status === "uploading" || status === "ingesting"}
              className="w-full"
            >
              {status === "uploading" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
                </>
              ) : status === "ingesting" ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4 animate-spin" /> Indexing for the AI tutor…
                </>
              ) : (
                <>
                  <UploadCloud className="mr-2 h-4 w-4" /> Upload to the Vault
                </>
              )}
            </Button>
          </div>
        </form>

        <h2 className="mt-12 font-serif text-2xl">Recently uploaded</h2>
        <div className="mt-4 space-y-2">
          {recent.map((r) => (
            <div
              key={r.id}
              className="paper-card flex items-center justify-between gap-3 px-5 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm">{r.title}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline">{r.subject_or_module}</Badge>
                <Badge variant="outline">{r.year}</Badge>
                {r.ingest_status === "ok" && (
                  <Badge variant="outline" className="text-emerald-700">
                    AI-ready · {r.chunk_count} chunks
                  </Badge>
                )}
                {r.ingest_status === "empty" && (
                  <Badge
                    variant="outline"
                    className="text-amber-700"
                    title={r.ingest_error ?? "No text could be extracted"}
                  >
                    Not AI-ready
                  </Badge>
                )}
                {r.ingest_status === "error" && (
                  <Badge
                    variant="outline"
                    className="text-red-700"
                    title={r.ingest_error ?? "Indexing failed"}
                  >
                    Indexing error
                  </Badge>
                )}
                {r.ingest_status === "pending" && (
                  <Badge variant="outline" className="text-muted-foreground">
                    Not indexed
                  </Badge>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={async () => {
                    if (!window.confirm(`Delete "${r.title}"? This cannot be undone.`)) return;
                    const { data: sess } = await supabase.auth.getSession();
                    const res = await fetch("/api/admin/resources/delete", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${sess.session?.access_token}`,
                      },
                      body: JSON.stringify({ resourceId: r.id }),
                    });
                    if (res.ok) {
                      toast.success("Deleted.");
                      queryClient.invalidateQueries({ queryKey: ["admin-resources"] });
                      queryClient.invalidateQueries({ queryKey: ["resources"] });
                    } else {
                      toast.error("Could not delete this resource.");
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {recent.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing uploaded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
