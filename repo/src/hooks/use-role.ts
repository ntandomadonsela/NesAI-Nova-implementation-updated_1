import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "staff" | "student";

/** The current user's highest application role. Undefined means that it is still loading. */
export function useRole() {
  const [role, setRole] = useState<AppRole | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    async function loadRole() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        if (!cancelled) setRole("student");
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", sessionData.session.user.id);
      const roles = (data ?? []).map((row) => row.role as AppRole);
      const next = roles.includes("owner") ? "owner" : roles.includes("staff") ? "staff" : "student";
      if (!cancelled) setRole(next);
    }
    loadRole();
    const { data: subscription } = supabase.auth.onAuthStateChange(loadRole);
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return role;
}

export function canManageContent(role: AppRole | undefined) {
  return role === "owner" || role === "staff";
}
