import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { canManageContent, useRole } from "@/hooks/use-role";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/console/tutors")({
  head: () => ({ meta: [{ title: "Tutor Settings | NesAI Nova" }] }),
  component: TutorsConsolePage,
});

type Tutor = {
  id: string;
  subject_label: string;
  icon: string;
  system_prompt_overlay: string;
  color_accent: string;
  is_active: boolean;
};

function TutorsConsolePage() {
  const role = useRole();
  const canEdit = canManageContent(role);
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Tutor>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: tutors = [], isLoading } = useQuery({
    queryKey: ["console-tutors"],
    enabled: canEdit,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutors")
        .select("id, subject_label, icon, system_prompt_overlay, color_accent, is_active")
        .order("subject_label");
      if (error) throw error;
      return data as Tutor[];
    },
  });

  useEffect(() => {
    if (tutors.length) {
      setDrafts(Object.fromEntries(tutors.map((t) => [t.id, t])));
    }
  }, [tutors]);

  async function save(id: string) {
    const draft = drafts[id];
    if (!draft) return;
    setSavingId(id);
    const { error } = await supabase
      .from("tutors")
      .update({
        subject_label: draft.subject_label,
        system_prompt_overlay: draft.system_prompt_overlay,
        color_accent: draft.color_accent,
        is_active: draft.is_active,
      })
      .eq("id", id);
    setSavingId(null);
    if (error) {
      toast.error("Could not save changes.");
      return;
    }
    toast.success("Tutor updated.");
    queryClient.invalidateQueries({ queryKey: ["console-tutors"] });
  }

  if (role === undefined || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!canEdit) {
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
        <h1 className="mt-3 font-serif text-4xl">Tutor Settings</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Each subject tutor's guidance is stored here and used directly in the AI's instructions —
          changes apply immediately, no deploy required.
        </p>

        <div className="mt-8 space-y-4">
          {tutors.map((tutor) => {
            const draft = drafts[tutor.id] ?? tutor;
            const dirty =
              draft.subject_label !== tutor.subject_label ||
              draft.system_prompt_overlay !== tutor.system_prompt_overlay ||
              draft.is_active !== tutor.is_active;
            return (
              <div key={tutor.id} className="paper-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={draft.subject_label}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [tutor.id]: { ...draft, subject_label: e.target.value } }))
                      }
                      className="w-56 font-medium"
                    />
                    {!tutor.is_active && <Badge variant="outline">Inactive</Badge>}
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={draft.is_active}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [tutor.id]: { ...draft, is_active: e.target.checked } }))
                      }
                    />
                    Active
                  </label>
                </div>

                <Label className="mt-4 block">Subject guidance (system prompt overlay)</Label>
                <Textarea
                  value={draft.system_prompt_overlay}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [tutor.id]: { ...draft, system_prompt_overlay: e.target.value } }))
                  }
                  className="mt-1 min-h-28"
                />

                <div className="mt-3 flex justify-end">
                  <Button size="sm" disabled={!dirty || savingId === tutor.id} onClick={() => save(tutor.id)}>
                    {savingId === tutor.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                    Save changes
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
