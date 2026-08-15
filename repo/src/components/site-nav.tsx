import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { canManageContent, useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

export function SiteNav() {
  const [signedIn, setSignedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const role = useRole();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-primary/95 text-primary-foreground backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <img src="/logo.png" alt="NesAI Nova" className="h-9 w-9 rounded-md object-contain" />
          <div className="leading-tight">
            <div className="font-serif text-lg font-semibold tracking-tight">NesAI Nova</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/55">
              Nesma Holdings
            </div>
          </div>
        </Link>

        <nav className="hidden shrink-0 items-center gap-8 md:flex">
          <Link
            to="/vault"
            className="whitespace-nowrap text-sm text-white/65 transition hover:text-white"
            activeProps={{ className: "text-white font-medium" }}
          >
            The Vault
          </Link>
          <Link
            to="/chat"
            className="whitespace-nowrap text-sm text-white/65 transition hover:text-white"
            activeProps={{ className: "text-white font-medium" }}
          >
            AI Study Desk
          </Link>
          <Link
            to="/upgrade"
            className="whitespace-nowrap text-sm text-white/65 transition hover:text-white"
            activeProps={{ className: "text-white font-medium" }}
          >
            Upgrade
          </Link>
          {canManageContent(role) && (
            <Link
              to="/console"
              className="whitespace-nowrap text-sm text-white/65 transition hover:text-white"
              activeProps={{ className: "text-white font-medium" }}
            >
              Console
            </Link>
          )}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 whitespace-nowrap sm:flex">
          {signedIn ? (
            <>
              <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white">
                <Link to="/chat">Study Desk</Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={async () => {
                  await supabase.auth.signOut();
                }}
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white">
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="bg-[var(--color-gold)] text-[var(--color-gold-foreground)] hover:brightness-110"
              >
                <Link to="/auth">Get started</Link>
              </Button>
            </>
          )}
        </div>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild><Button size="icon" variant="ghost" className="text-white hover:bg-white/10 hover:text-white sm:hidden"><Menu className="h-5 w-5" /><span className="sr-only">Open navigation</span></Button></SheetTrigger>
          <SheetContent side="right" className="w-[min(20rem,88vw)] border-l-border bg-card p-6"><div className="flex items-center gap-3"><img src="/logo.png" alt="NesAI Nova" className="h-10 w-10 rounded-xl" /><div><p className="font-serif text-xl">NesAI Nova</p><p className="text-xs text-muted-foreground">by Nesma Holdings</p></div></div><nav className="mt-8 grid gap-2 text-base">{[["/vault","The Vault"],["/chat","Study Desk"],["/upgrade","Premium"]].map(([to,label]) => <Link key={to} to={to as any} onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-3 font-medium hover:bg-accent">{label}</Link>)}{canManageContent(role) && <Link to="/console" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-3 font-medium hover:bg-accent">Console</Link>}</nav><div className="mt-8 border-t border-border pt-5">{signedIn ? <Button className="w-full" onClick={() => supabase.auth.signOut()}>Sign out</Button> : <Button asChild className="w-full bg-[var(--color-gold)] text-[var(--color-gold-foreground)]"><Link to="/auth" onClick={() => setMenuOpen(false)}>Get started</Link></Button>}</div></SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
