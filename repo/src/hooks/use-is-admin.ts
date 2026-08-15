import { useRole } from "@/hooks/use-role";

/** Returns undefined while loading, then true/false once we know. */
export function useIsAdmin() {
  const role = useRole();
  return role === undefined ? undefined : role === "owner";
}
