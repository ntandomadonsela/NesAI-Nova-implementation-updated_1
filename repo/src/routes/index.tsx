import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Calculator, FileText, FlaskConical, Library, MessageCircleMore, Sparkles, type LucideIcon } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NesAI Nova | Study resources and tutoring" },
      { name: "description", content: "Past papers, memos, and study notes with subject tutors that help learners understand the work." },
    ],
  }),
  component: Landing,
});

const subjects = [
  { icon: Calculator, name: "Mathematics", color: "bg-[var(--color-nova-blue)]" },
  { icon: FlaskConical, name: "Sciences", color: "bg-[var(--color-nova-lilac)]" },
  { icon: BookOpen, name: "English", color: "bg-[var(--color-nova-mint)]" },
];

function Landing() {
  return <div className="min-h-screen overflow-x-hidden bg-background"><SiteNav />
    <main>
      <section className="relative isolate overflow-hidden bg-primary text-primary-foreground">
        <div className="nova-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="nova-orb absolute -left-24 top-8 h-72 w-72 bg-[var(--color-nova-blue)] opacity-50" />
        <div className="nova-orb absolute -right-24 top-24 h-80 w-80 bg-[var(--color-nova-lilac)] opacity-35" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-16 sm:px-8 md:pb-28 md:pt-24 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:px-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur-sm"><Sparkles className="h-3.5 w-3.5 text-[var(--color-gold)]" /> A Nesma Holdings learning product</div>
            <h1 className="mt-6 max-w-3xl font-serif text-4xl leading-[1.04] sm:text-5xl md:text-6xl lg:text-7xl">Your study session just got a <span className="text-[var(--color-gold)]">serious upgrade.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">Pull up the right past paper, then ask a tutor to explain the part that has you stuck. NesAI Nova keeps the momentum going.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Button asChild size="lg" className="h-12 bg-[var(--color-gold)] px-6 text-[var(--color-gold-foreground)] hover:brightness-110"><Link to="/auth">Start studying free <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild size="lg" variant="outline" className="h-12 border-white/25 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white"><Link to="/vault">Browse the Vault</Link></Button></div>
            <p className="mt-5 text-xs text-white/55">Built for CAPS, IEB, and university learners in South Africa.</p>
          </div>
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="rotate-[-3deg] rounded-[1.75rem] border border-white/20 bg-white p-4 text-foreground shadow-2xl sm:p-5">
              <div className="flex items-center justify-between border-b border-border pb-4"><div className="flex items-center gap-3"><img src="/logo.png" alt="NesAI Nova" className="h-10 w-10 rounded-xl" /><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">Study desk</p><p className="font-serif text-lg">Maths check-in</p></div></div><span className="rounded-full bg-[var(--color-nova-mint)]/20 px-2.5 py-1 text-xs font-semibold text-foreground">Online</span></div>
              <div className="space-y-3 py-5"><div className="ml-auto max-w-[84%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm text-white">How do I factorise this quadratic?</div><div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-secondary px-4 py-3 text-sm leading-relaxed">Start by finding two numbers that multiply to <strong>−12</strong> and add to <strong>−1</strong>. Let’s try it together.</div></div>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background p-2"><span className="flex-1 px-2 text-sm text-muted-foreground">Ask a follow-up…</span><span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-gold)] text-white"><ArrowRight className="h-4 w-4" /></span></div>
            </div>
            <div className="absolute -bottom-6 -left-2 rounded-2xl border border-white/15 bg-white/10 p-3 text-sm text-white shadow-lg backdrop-blur-md sm:-left-8"><FileText className="mb-1 h-4 w-4 text-[var(--color-gold)]" /><strong>Past papers</strong><br /><span className="text-xs text-white/65">ready when you are</span></div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 md:py-24 lg:px-10"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--color-gold)]">Make the work make sense</p><h2 className="mt-3 font-serif text-3xl sm:text-4xl">Everything you need for a better study rhythm.</h2></div><div className="mt-10 grid gap-4 md:grid-cols-3"><Feature icon={Library} title="A smarter resource vault" body="Filter past papers, memos, summaries, and notes by grade, subject, curriculum, and year." /><Feature icon={MessageCircleMore} title="Tutors that get to the point" body="Get clear explanations, structured working, and a helpful next question instead of a wall of text." /><Feature icon={Sparkles} title="Your material stays in focus" body="Open a resource in the Study Desk and keep its context attached to the conversation." /></div></section>

      <section className="bg-[#EAF1FF]"><div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 md:py-20 lg:px-10"><div className="flex flex-col justify-between gap-8 md:flex-row md:items-end"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--color-nova-blue)]">Choose your lane</p><h2 className="mt-3 max-w-xl font-serif text-3xl sm:text-4xl">Meet the tutors in your corner.</h2></div><Button asChild variant="outline" className="w-fit border-primary/15 bg-white"><Link to="/chat">Open Study Desk <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div><div className="mt-8 grid gap-4 sm:grid-cols-3">{subjects.map(({ icon: Icon, name, color }) => <div key={name} className="rounded-2xl bg-white p-5 shadow-editorial"><div className={`grid h-11 w-11 place-items-center rounded-xl text-white ${color}`}><Icon className="h-5 w-5" /></div><h3 className="mt-5 font-serif text-xl">{name} Tutor</h3><p className="mt-1 text-sm text-muted-foreground">Clear guidance, relevant examples, and useful practice.</p></div>)}</div></div></section>

      <section className="mx-auto max-w-4xl px-5 py-20 text-center sm:px-8 md:py-28"><img src="/logo.png" alt="NesAI Nova" className="mx-auto h-14 w-14 rounded-2xl shadow-editorial" /><h2 className="mt-6 font-serif text-4xl sm:text-5xl">Less circling. More progress.</h2><p className="mx-auto mt-4 max-w-xl text-muted-foreground">Start with the material you need. Bring the question you have. We’ll help with the next step.</p><Button asChild size="lg" className="mt-8 h-12 bg-[var(--color-gold)] px-6 text-[var(--color-gold-foreground)] hover:brightness-110"><Link to="/auth">Create your free account <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></section>
    </main>
    <footer className="border-t border-border bg-card px-5 py-9 text-center text-xs text-muted-foreground"><p>© {new Date().getFullYear()} NesAI Nova</p><p className="mt-2">A product of <span className="font-semibold text-foreground">Nesma Holdings (Pty) Ltd</span>.</p></footer>
  </div>;
}

function Feature({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) { return <article className="paper-card group p-6 transition duration-200 hover:-translate-y-1 hover:shadow-editorial-lg"><div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-white"><Icon className="h-5 w-5" /></div><h3 className="mt-5 font-serif text-xl">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p></article>; }
