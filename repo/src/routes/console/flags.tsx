import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { canManageContent, useRole } from "@/hooks/use-role";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/console/flags")({
  head: () => ({ meta: [{ title: "Quality Flags | NesAI Nova" }] }),
  component: FlagsConsolePage,
});

type Flag = {
  id: string;
  tutor_id: string | null;
  question: string;
  answer: string;
  reason: string | null;
  status: "open" | "resolved";
  created_at: string;
};

function FlagsConsolePage() {
  const role = useRole();
  const canReview = canManageContent(role);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"open" | "resolved">("open");
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ["console-flags", filter],
    enabled: canReview,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("answer_flags")
        .select("id, tutor_id, question, answer, reason, status, created_at")
        .eq("status", filter)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Flag[];
    },
  });

  async function resolve(id: string) {
    setResolvingId(id);
    const { error } = await supabase
      .from("answer_flags")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", id);
    setResolvingId(null);
    if (error) {
      toast.error("Could not update this flag.");
      return;
    }
    toast.success("Marked resolved.");
    queryClient.invalidateQueries({ queryKey: ["console-flags"] });
  }

  if (role === undefined || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!canReview) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div>
          <h1 className="font-serif text-3xl">Console access is for staff.</h1>
          <Button asChild className="mt-6">
            <Link to="/chat">Open Study Desk</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="mx-auto max-w-4xl px-6 py-12">
        <Link to="/console" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to console
        </Link>
        <h1 className="mt-3 font-serif text-4xl">Quality Flags</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Answers students have flagged as wrong, confusing, or unhelpful.
        </p>

        <div className="mt-6 flex gap-2">
          <Button variant={filter === "open" ? "default" : "outline"} size="sm" onClick={() => setFilter("open")}>
            Open
          </Button>
          <Button
            variant={filter === "resolved" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("resolved")}
          >
            Resolved
          </Button>
        </div>

        <div className="mt-6 space-y-4">
          {flags.length === 0 && (
            <p className="text-sm text-muted-foreground">No {filter} flags.</p>
          )}
          {flags.map((flag) => (
            <div key={flag.id} className="paper-card p-5">
              <div className="flex items-center justify-between gap-3">
                <Badge variant="outline">{flag.tutor_id ?? "unknown tutor"}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(flag.created_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-3 text-sm font-medium">Question</p>
              <p className="text-sm text-muted-foreground">{flag.question}</p>
              <p className="mt-3 text-sm font-medium">Answer</p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{flag.answer}</p>
              {flag.reason && (
                <>
                  <p className="mt-3 text-sm font-medium">Reported reason</p>
                  <p className="text-sm text-muted-foreground">{flag.reason}</p>
                </>
              )}
              {filter === "open" && (
                <div className="mt-4 flex justify-end">
                  <Button size="sm" disabled={resolvingId === flag.id} onClick={() => resolve(flag.id)}>
                    {resolvingId === flag.id ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                    )}
                    Mark resolved
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
