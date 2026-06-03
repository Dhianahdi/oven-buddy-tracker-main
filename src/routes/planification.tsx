import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchOvensWithActive, fetchReservations, createReservation, deleteReservation } from "@/lib/oven-queries";
import type { ReservationWithOven } from "@/lib/oven-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/planification")({
  component: PlanificationPage,
  head: () => ({ meta: [{ title: "Planification — ThermoTrack" }] }),
});

function todayISO() { return new Date().toISOString().slice(0, 10); }
function nowHM() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

const WEEK_DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function getWeekDates(referenceDate: Date): Date[] {
  const day = referenceDate.getDay();
  const monday = new Date(referenceDate);
  monday.setDate(referenceDate.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatDateFR(iso: string) {
  const [y, m, day] = iso.split("-");
  return `${day}/${m}/${y}`;
}

function PlanificationPage() {
  const qc = useQueryClient();
  const { data: reservations, isLoading } = useQuery({
    queryKey: ["reservations"],
    queryFn: fetchReservations,
    refetchInterval: 60_000,
  });
  const { data: ovens } = useQuery({
    queryKey: ["ovens"],
    queryFn: fetchOvensWithActive,
  });

  const [weekRef, setWeekRef] = useState(new Date());
  const [openDialog, setOpenDialog] = useState(false);
  const [prefillDate, setPrefillDate] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ReservationWithOven | null>(null);

  const weekDates = useMemo(() => getWeekDates(weekRef), [weekRef]);

  const byDate = useMemo(() => {
    const map = new Map<string, ReservationWithOven[]>();
    (reservations ?? []).forEach(r => {
      const key = r.date_debut;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return map;
  }, [reservations]);

  const upcomingReservations = useMemo(() => {
    const today = todayISO();
    return (reservations ?? []).filter(r => r.date_debut >= today);
  }, [reservations]);

  function prevWeek() {
    const d = new Date(weekRef);
    d.setDate(d.getDate() - 7);
    setWeekRef(d);
  }
  function nextWeek() {
    const d = new Date(weekRef);
    d.setDate(d.getDate() + 7);
    setWeekRef(d);
  }
  function goToday() { setWeekRef(new Date()); }

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteReservation(id),
    onSuccess: () => {
      toast.success("Réservation supprimée");
      qc.invalidateQueries({ queryKey: ["reservations"] });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const today = todayISO();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Agenda</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Planification</h1>
          <p className="mt-1 text-sm text-muted-foreground">Réservez un four à l'avance et visualisez le planning</p>
        </div>
        <Button
          className="gap-2 shrink-0 glow-primary"
          onClick={() => { setPrefillDate(today); setOpenDialog(true); }}
        >
          <Plus className="h-4 w-4" />
          Nouvelle réservation
        </Button>
      </div>

      {/* Week navigator */}
      <div className="mb-4 flex items-center gap-3">
        <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-border" onClick={prevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="border-border text-xs" onClick={goToday}>
          Aujourd'hui
        </Button>
        <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-border" onClick={nextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium text-foreground">
          {formatDateFR(isoDate(weekDates[0]))} – {formatDateFR(isoDate(weekDates[6]))}
        </span>
      </div>

      {/* Weekly grid */}
      <div className="mb-8 overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-7 border-b border-border">
          {weekDates.map((date, i) => {
            const iso = isoDate(date);
            const isToday = iso === today;
            return (
              <div key={i} className={`border-r border-border/50 last:border-r-0 px-2 py-3 text-center ${isToday ? "bg-primary/10" : ""}`}>
                <div className={`text-[10px] font-semibold uppercase tracking-wider ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                  {WEEK_DAYS[(i + 1) % 7]}
                </div>
                <div className={`mt-0.5 text-lg font-bold font-mono ${isToday ? "text-primary" : "text-foreground"}`}>
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-7 min-h-[140px]">
          {weekDates.map((date, i) => {
            const iso = isoDate(date);
            const dayResos = byDate.get(iso) ?? [];
            const isToday = iso === today;
            return (
              <div
                key={i}
                className={`border-r border-border/50 last:border-r-0 p-1.5 cursor-pointer transition-colors hover:bg-secondary/30 ${isToday ? "bg-primary/5" : ""}`}
                onClick={() => { setPrefillDate(iso); setOpenDialog(true); }}
              >
                {isLoading ? (
                  <div className="h-8 animate-shimmer rounded-lg" />
                ) : dayResos.length === 0 ? (
                  <div className="flex h-full min-h-[100px] items-center justify-center">
                    <span className="text-[10px] text-muted-foreground/40">libre</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {dayResos.map(r => (
                      <div
                        key={r.id}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-lg border border-primary/20 bg-primary/10 p-1.5 cursor-default"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <div className="font-mono text-[10px] font-bold text-primary truncate">{r.oven?.internal_number}</div>
                            <div className="text-[9px] text-muted-foreground truncate">{r.demandeur}</div>
                            {r.projet && <div className="text-[9px] text-muted-foreground/70 truncate">{r.projet}</div>}
                            <div className="text-[9px] text-muted-foreground mt-0.5">{r.heure_debut}→{r.heure_fin}</div>
                          </div>
                          <button
                            onClick={() => setDeleteTarget(r)}
                            className="shrink-0 rounded p-0.5 text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming list */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Prochaines réservations ({upcomingReservations.length})
        </p>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-shimmer rounded-xl border border-border" />
            ))}
          </div>
        ) : upcomingReservations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <CalendarClock className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Aucune réservation à venir</p>
            <button
              onClick={() => { setPrefillDate(today); setOpenDialog(true); }}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Créer la première réservation
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingReservations.map(r => (
              <div key={r.id} className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 hover:bg-secondary/20 transition-colors">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <CalendarClock className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-primary">{r.oven?.internal_number}</span>
                    <span className="text-xs text-muted-foreground font-mono">{r.oven?.serial_number}</span>
                    {r.date_debut === today && (
                      <span className="rounded-full bg-busy/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-busy">Aujourd'hui</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{formatDateFR(r.date_debut)} {r.heure_debut} → {formatDateFR(r.date_fin)} {r.heure_fin}</span>
                    <span>Demandeur : <span className="text-foreground font-medium">{r.demandeur}</span></span>
                    {r.projet && <span>Projet : <span className="text-foreground">{r.projet}</span></span>}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => setDeleteTarget(r)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New reservation dialog */}
      <NewReservationDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        ovens={ovens ?? []}
        prefillDate={prefillDate}
      />

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm border-border bg-card">
          <DialogHeader>
            <DialogTitle>Supprimer la réservation ?</DialogTitle>
            <DialogDescription>
              {deleteTarget && (
                <>
                  Four <strong>{deleteTarget.oven?.internal_number}</strong> · {formatDateFR(deleteTarget.date_debut)} {deleteTarget.heure_debut}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="border-border">Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewReservationDialog({
  open, onOpenChange, ovens, prefillDate,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  ovens: { id: string; internal_number: string; serial_number: string }[];
  prefillDate: string;
}) {
  const qc = useQueryClient();
  const [ovenId, setOvenId] = useState("");
  const [demandeur, setDemandeur] = useState("");
  const [projet, setProjet] = useState("");
  const [dateDebut, setDateDebut] = useState(prefillDate || todayISO());
  const [heureDebut, setHeureDebut] = useState("08:00");
  const [dateFin, setDateFin] = useState(prefillDate || todayISO());
  const [heureFin, setHeureFin] = useState("17:00");
  const [notes, setNotes] = useState("");

  // sync prefill date when dialog opens
  const [lastPrefill, setLastPrefill] = useState("");
  if (open && prefillDate !== lastPrefill) {
    setLastPrefill(prefillDate);
    setDateDebut(prefillDate || todayISO());
    setDateFin(prefillDate || todayISO());
  }

  function reset() {
    setOvenId(""); setDemandeur(""); setProjet("");
    setDateDebut(todayISO()); setHeureDebut("08:00");
    setDateFin(todayISO()); setHeureFin("17:00");
    setNotes("");
  }

  const createMut = useMutation({
    mutationFn: async () => {
      if (!ovenId) throw new Error("Sélectionnez un four");
      if (!demandeur.trim()) throw new Error("Le demandeur est requis");
      if (!dateDebut || !heureDebut || !dateFin || !heureFin) throw new Error("Les dates et heures sont requises");
      if (dateFin < dateDebut || (dateFin === dateDebut && heureFin <= heureDebut))
        throw new Error("La date/heure de fin doit être après le début");
      await createReservation({
        oven_id: ovenId,
        demandeur: demandeur.trim(),
        projet: projet.trim() || null,
        date_debut: dateDebut,
        heure_debut: heureDebut,
        date_fin: dateFin,
        heure_fin: heureFin,
        notes: notes.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success("Réservation créée");
      qc.invalidateQueries({ queryKey: ["reservations"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  return (
    <Dialog open={open} onOpenChange={(b) => { if (!b) reset(); onOpenChange(b); }}>
      <DialogContent className="max-w-lg border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Nouvelle réservation
          </DialogTitle>
          <DialogDescription>Planifiez l'utilisation d'un four</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Four */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Four <span className="text-busy">*</span>
            </Label>
            <select
              value={ovenId}
              onChange={(e) => setOvenId(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Sélectionner un four…</option>
              {ovens.map(o => (
                <option key={o.id} value={o.id}>
                  {o.internal_number} — {o.serial_number}
                </option>
              ))}
            </select>
          </div>

          {/* Demandeur */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Demandeur <span className="text-busy">*</span>
            </Label>
            <Input
              placeholder="Nom du demandeur"
              value={demandeur}
              onChange={(e) => setDemandeur(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Projet */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Projet</Label>
            <Input
              placeholder="Référence projet (optionnel)"
              value={projet}
              onChange={(e) => setProjet(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date début <span className="text-busy">*</span></Label>
              <Input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Heure début <span className="text-busy">*</span></Label>
              <Input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date fin <span className="text-busy">*</span></Label>
              <Input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Heure fin <span className="text-busy">*</span></Label>
              <Input type="time" value={heureFin} onChange={(e) => setHeureFin(e.target.value)} />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</Label>
            <Textarea
              rows={2}
              placeholder="Consignes particulières…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">Annuler</Button>
          <Button onClick={() => createMut.mutate()} disabled={createMut.isPending} className="glow-primary">
            {createMut.isPending ? "Enregistrement…" : "Réserver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
