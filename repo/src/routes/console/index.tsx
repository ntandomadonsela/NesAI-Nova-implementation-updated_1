import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LayoutDashboard, FileText, ShieldAlert, Upload, Settings2, type LucideIcon } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { supabase } from "@/integrations/supabase/client";
import { canManageContent, useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider } from "@/components/ui/sidebar";

export const Route = createFileRoute("/console/")({ component: ConsolePage });

type Metrics = { mrr: number | null; activeSubscriptions: number; signups: number; premiumUsers: number; chatVolume: number; documentCount: number; subjectUsage: Array<{ name: string; value: number }> };

function ConsolePage() {
  const role = useRole();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  useEffect(() => {
    if (role !== "owner") return;
    supabase.auth.getSession().then(async ({ data }) => {
      const response = await fetch("/api/console/metrics", { headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } });
      if (response.ok) setMetrics(await response.json());
    });
  }, [role]);

  if (role === undefined) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading console…</div>;
  if (!canManageContent(role)) return <div className="grid min-h-screen place-items-center px-4 text-center"><div><h1 className="font-serif text-3xl">Console access is for staff.</h1><p className="mt-2 text-muted-foreground">Return to your study desk to continue learning.</p><Button asChild className="mt-6"><Link to="/chat">Open Study Desk</Link></Button></div></div>;

  const items: Array<{ label: string; icon: LucideIcon; href: "/console" | "/admin/upload" | "/console/tutors" | "/console/flags" }> = [
    { label: "Content", icon: FileText, href: "/admin/upload" },
    { label: "Tutor settings", icon: Settings2, href: "/console/tutors" },
    { label: "Quality flags", icon: ShieldAlert, href: "/console/flags" },
  ];
  if (role === "owner") items.unshift({ label: "Overview", icon: LayoutDashboard, href: "/console" });
  return <div className="min-h-screen bg-background"><SiteNav /><SidebarProvider><Sidebar collapsible="offcanvas"><SidebarContent><SidebarGroup><SidebarGroupLabel>{role === "owner" ? "Owner console" : "Staff console"}</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{items.map(({ label, icon: Icon, href }) => <SidebarMenuItem key={label}><SidebarMenuButton asChild><Link to={href}><Icon /><span>{label}</span></Link></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent></Sidebar><SidebarInset><main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6"><header><p className="text-xs font-medium uppercase tracking-[.18em] text-muted-foreground">{role === "owner" ? "Business and content" : "Content operations"}</p><h1 className="mt-1 font-serif text-3xl">{role === "owner" ? "NesAI Nova console" : "Content workspace"}</h1></header>{role === "owner" && metrics && <OwnerMetrics metrics={metrics} />}<section className="mt-8 grid gap-4 md:grid-cols-3"><ConsoleCard icon={Upload} title="Documents" body="Upload, tag, ingest, and review study resources." href="/admin/upload" /><ConsoleCard icon={Settings2} title="Tutors" body="Subject tutor records are stored in Supabase and can be updated without a deploy." href="/console/tutors" /><ConsoleCard icon={ShieldAlert} title="Quality feedback" body="Review flagged answers and close the loop with learners." href="/console/flags" /></section></main></SidebarInset></SidebarProvider></div>;
}

function ConsoleCard({ icon: Icon, title, body, href }: { icon: LucideIcon; title: string; body: string; href?: "/admin/upload" | "/console/tutors" | "/console/flags" }) { const content=<div className="paper-card h-full p-5"><Icon className="h-5 w-5 text-[var(--color-gold)]"/><h2 className="mt-4 font-serif text-xl">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{body}</p></div>; return href ? <Link to={href}>{content}</Link> : content; }
function OwnerMetrics({ metrics }: { metrics: Metrics }) { const cards=[['MRR',metrics.mrr === null ? 'Unavailable' : metrics.mrr],['Active subscriptions',metrics.activeSubscriptions],['Total users',metrics.signups],['Premium users',metrics.premiumUsers],['Tutor conversations',metrics.chatVolume],['Documents',metrics.documentCount]]; return <><section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">{cards.map(([label,value])=><div key={String(label)} className="paper-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 font-serif text-3xl">{value}</p></div>)}</section><p className="mt-2 text-xs text-muted-foreground">MRR becomes available once plan prices or payment amounts are recorded.</p><section className="paper-card mt-6 p-5"><h2 className="font-serif text-xl">Tutor usage</h2><div className="mt-4 h-64 min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={metrics.subjectUsage}><XAxis dataKey="name" hide /><YAxis allowDecimals={false}/><Tooltip /><Bar dataKey="value" fill="var(--color-gold)" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></section></>; }
