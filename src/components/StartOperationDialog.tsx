import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OvenWithActive } from "@/lib/oven-queries";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

function todayISO() { return new Date().toISOString().slice(0, 10); }
function nowHM() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

const FIELDS = [
  { name: "demandeur",   label: "Demandeur",    required: true,  placeholder: "Nom du demandeur" },
  { name: "realisateur", label: "Réalisateur",  required: true,  placeholder: "Nom du réalisateur" },
  { name: "projet",      label: "Projet",       placeholder: "Référence projet" },
  { name: "cdc",         label: "CDC",          placeholder: "Cahier des charges" },
  { name: "essai",       label: "Essai",        placeholder: "N° essai" },
  { name: "specification", label: "Spécification", placeholder: "Norme / spec" },
  { name: "type",        label: "Type de câble", placeholder: "ex: NYY, H07V-R" },
  { name: "section",     label: "Section",      placeholder: "ex: 2.5 mm²" },
  { name: "couleur",     label: "Couleur",      placeholder: "ex: Rouge" },
] as const;

function FieldGroup({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}{required && <span className="ml-0.5 text-busy">*</span>}
      </Label>
      {children}
    </div>
  );
}

export function StartOperationDialog({
  oven,
  open,
  onOpenChange,
}: {
  oven: OvenWithActive | null;
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [dateDebut, setDateDebut] = useState(todayISO());
  const [heureDebut, setHeureDebut] = useState(nowHM());
  const [dateFin, setDateFin] = useState("");
  const [heureFin, setHeureFin] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setForm({});
    setDateDebut(todayISO());
    setHeureDebut(nowHM());
    setDateFin("");
    setHeureFin("");
    setNotes("");
  };

  const startMut = useMutation({
    mutationFn: async () => {
      if (!oven) throw new Error("no oven");
      if (!form.demandeur?.trim() || !form.realisateur?.trim())
        throw new Error("Demandeur et Réalisateur sont requis");
      const { error } = await supabase.from("operations").insert({
        oven_id: oven.id,
        demandeur:     form.demandeur,
        realisateur:   form.realisateur,
        projet:        form.projet || null,
        cdc:           form.cdc || null,
        essai:         form.essai || null,
        specification: form.specification || null,
        date_debut:    dateDebut,
        heure_debut:   heureDebut,
        date_fin:      dateFin || null,
        heure_fin:     heureFin || null,
        type:          form.type || null,
        section:       form.section || null,
        couleur:       form.couleur || null,
        notes:         notes || null,
        status:        "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Opération démarrée avec succès");
      qc.invalidateQueries({ queryKey: ["ovens"] });
      qc.invalidateQueries({ queryKey: ["history"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  if (!oven) return null;

  return (
    <Dialog open={open} onOpenChange={(b) => { if (!b) reset(); onOpenChange(b); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin border-border bg-card">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 shrink-0">
              <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"/>
              </svg>
            </div>
            <div>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <span className="font-mono font-bold">{oven.internal_number}</span>
                <span className="font-mono text-sm font-normal text-muted-foreground">{oven.serial_number}</span>
              </DialogTitle>
              <DialogDescription>Démarrer une nouvelle opération thermique</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-1 space-y-5">
          {/* Section: Intervenants */}
          <Section title="Intervenants" icon="👤">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FIELDS.filter(f => f.name === "demandeur" || f.name === "realisateur").map((f) => (
                <FieldGroup key={f.name} label={f.label} required={f.required}>
                  <Input
                    placeholder={f.placeholder}
                    value={form[f.name] ?? ""}
                    onChange={(e) => setForm((x) => ({ ...x, [f.name]: e.target.value }))}
                    maxLength={200}
                  />
                </FieldGroup>
              ))}
            </div>
          </Section>

          {/* Section: Identifiants */}
          <Section title="Identifiants projet" icon="📋">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FIELDS.filter(f => ["projet","cdc","essai","specification"].includes(f.name)).map((f) => (
                <FieldGroup key={f.name} label={f.label}>
                  <Input
                    placeholder={f.placeholder}
                    value={form[f.name] ?? ""}
                    onChange={(e) => setForm((x) => ({ ...x, [f.name]: e.target.value }))}
                    maxLength={200}
                  />
                </FieldGroup>
              ))}
            </div>
          </Section>

          {/* Section: Câble */}
          <Section title="Caractéristiques câble" icon="⚡">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {FIELDS.filter(f => ["type","section","couleur"].includes(f.name)).map((f) => (
                <FieldGroup key={f.name} label={f.label}>
                  <Input
                    placeholder={f.placeholder}
                    value={form[f.name] ?? ""}
                    onChange={(e) => setForm((x) => ({ ...x, [f.name]: e.target.value }))}
                    maxLength={200}
                  />
                </FieldGroup>
              ))}
            </div>
          </Section>

          {/* Section: Planning */}
          <Section title="Planning" icon="🗓️">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <FieldGroup label="Date début" required>
                <Input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
              </FieldGroup>
              <FieldGroup label="Heure début" required>
                <Input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} />
              </FieldGroup>
              <FieldGroup label="Date fin prévue">
                <Input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
              </FieldGroup>
              <FieldGroup label="Heure fin prévue">
                <Input type="time" value={heureFin} onChange={(e) => setHeureFin(e.target.value)} />
              </FieldGroup>
            </div>
          </Section>

          {/* Notes */}
          <FieldGroup label="Notes">
            <Textarea
              rows={3}
              placeholder="Observations, consignes particulières…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              className="resize-none"
            />
          </FieldGroup>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">
            Annuler
          </Button>
          <Button onClick={() => startMut.mutate()} disabled={startMut.isPending} className="glow-primary">
            {startMut.isPending ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                Démarrage…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"/></svg>
                Démarrer l'opération
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <span>{icon}</span> {title}
      </h3>
      {children}
    </div>
  );
}
