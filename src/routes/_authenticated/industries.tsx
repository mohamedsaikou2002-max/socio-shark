import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { INDUSTRY_PROFILES_KEY, readLocalList, writeLocalList, type LocalIndustryProfile } from "@/lib/frontend-state";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/industries")({
  head: () => ({ meta: [
    { title: "Industry profiles — Socio-Shark" },
    { name: "description", content: "Shape the voice and caption examples used by Socio-Shark." },
    { property: "og:title", content: "Industry profiles — Socio-Shark" },
    { property: "og:description", content: "Shape the voice and caption examples used by Socio-Shark." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: IndustriesPage,
});

function IndustriesPage() {
  const [profiles, setProfiles] = useState<LocalIndustryProfile[]>([]);
  const [name, setName] = useState("");
  const [toneNotes, setToneNotes] = useState("");
  const [examples, setExamples] = useState("");
  useEffect(() => setProfiles(readLocalList<LocalIndustryProfile>(INDUSTRY_PROFILES_KEY)), []);

  function save() {
    if (!name.trim()) return;
    const next = [...profiles, { id: crypto.randomUUID(), name: name.trim(), toneNotes: toneNotes.trim(), examples: examples.split("\n").map((value) => value.trim()).filter(Boolean) }];
    setProfiles(next); writeLocalList(INDUSTRY_PROFILES_KEY, next); setName(""); setToneNotes(""); setExamples(""); toast.success("Industry profile saved");
  }
  function remove(id: string) { const next = profiles.filter((profile) => profile.id !== id); setProfiles(next); writeLocalList(INDUSTRY_PROFILES_KEY, next); }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5"><header className="border-b border-border pb-5"><p className="font-mono text-xs uppercase text-muted-foreground">Caption context</p><h1 className="mt-2 text-3xl font-bold">Industry profiles</h1><p className="mt-2 text-sm text-muted-foreground">Reusable voice notes and examples for consistent captions.</p></header>
        {profiles.length === 0 ? <div className="border border-dashed border-border p-10 text-center"><p className="font-medium">No profiles yet</p><p className="mt-1 text-sm text-muted-foreground">Create one for each brand or industry you publish for.</p></div> : profiles.map((profile) => <article key={profile.id} className="border border-border p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="font-bold">{profile.name}</h2><p className="mt-2 text-sm text-muted-foreground">{profile.toneNotes || "No tone notes"}</p><p className="mt-3 font-mono text-[10px] uppercase text-muted-foreground">{profile.examples.length} caption examples</p></div><Button variant="ghost" size="icon" onClick={() => remove(profile.id)} aria-label={`Delete ${profile.name}`}><Trash2 /></Button></div></article>)}
      </div>
      <aside className="h-fit border border-border p-5 lg:sticky lg:top-24"><h2 className="font-bold">New profile</h2><div className="mt-5 space-y-4"><label className="block text-xs font-medium">Name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-10 w-full border border-input bg-background px-3 text-sm" placeholder="Streetwear" /></label><label className="block text-xs font-medium">Tone notes<textarea value={toneNotes} onChange={(event) => setToneNotes(event.target.value)} className="mt-1 min-h-24 w-full border border-input bg-background p-3 text-sm" placeholder="Direct, energetic, never corporate…" /></label><label className="block text-xs font-medium">Example captions<textarea value={examples} onChange={(event) => setExamples(event.target.value)} className="mt-1 min-h-28 w-full border border-input bg-background p-3 text-sm" placeholder="One example per line" /></label><Button onClick={save} disabled={!name.trim()} className="w-full"><Plus />Save profile</Button></div></aside>
    </div>
  );
}
