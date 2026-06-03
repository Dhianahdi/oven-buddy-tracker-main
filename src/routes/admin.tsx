import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Oven } from "@/lib/oven-queries";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Fours — Administration" }] }),
});

function AdminPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<Oven[]>({
    queryKey: ["ovens-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ovens").select("*").order("position");
      if (error) throw error;
      return data as Oven[];
    },
  });

  const [edits, setEdits] = useState<Record<string, { serial_number: string; internal_number: string }>>({});
  const [newOven, setNewOven] = useState({ internal_number: "", serial_number: "" });
  const [toDelete, setToDelete] = useState<Oven | null>(null);

  useEffect(() => {
    if (data) {
      const m: typeof edits = {};
      data.forEach((o) => { m[o.id] = { serial_number: o.serial_number, internal_number: o.internal_number }; });
      setEdits(m);
    }
  }, [data]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ovens-admin"] });
    qc.invalidateQueries({ queryKey: ["ovens"] });
  };

  const saveMut = useMutation({
    mutationFn: async (o: Oven) => {
      const v = edits[o.id];
      if (!v.serial_number.trim() || !v.internal_number.trim()) throw new Error("Champs requis");
      const { error } = await supabase
        .from("ovens")
        .update({ serial_number: v.serial_number.trim(), internal_number: v.internal_number.trim(), updated_at: new Date().toISOString() })
        .eq("id", o.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Four mis à jour"); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const addMut = useMutation({
    mutationFn: async () => {
      const internal = newOven.internal_number.trim();
      const serial = newOven.serial_number.trim();
      if (!internal || !serial) throw new Error("Champs requis");
      const maxPos = (data ?? []).reduce((m, o) => Math.max(m, o.position), 0);
      const { error } = await supabase
        .from("ovens")
        .insert({ internal_number: internal, serial_number: serial, position: maxPos + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Four ajouté");
      setNewOven({ internal_number: "", serial_number: "" });
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const deleteMut = useMutation({
    mutationFn: async (o: Oven) => {
      const { count, error: cErr } = await supabase
        .from("operations")
        .select("id", { count: "exact", head: true })
        .eq("oven_id", o.id)
        .eq("status", "active");
      if (cErr) throw cErr;
      if ((count ?? 0) > 0) throw new Error("Impossible : une opération est en cours sur ce four");
      const { error: opErr } = await supabase.from("operations").delete().eq("oven_id", o.id);
      if (opErr) throw opErr;
      const { error } = await supabase.from("ovens").delete().eq("id", o.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Four supprimé"); setToDelete(null); invalidate(); },
    onError: (e: any) => { toast.error(e.message ?? "Erreur"); setToDelete(null); },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Administration des fours</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajoutez, modifiez ou supprimez des fours. Numéro de série (ex: B621.0021), numéro interne (ex: RD 112).
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Ajouter un four</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            className="font-mono"
            placeholder="Numéro interne (RD 112)"
            value={newOven.internal_number}
            onChange={(e) => setNewOven((x) => ({ ...x, internal_number: e.target.value }))}
          />
          <Input
            className="font-mono"
            placeholder="Numéro de série (B621.0021)"
            value={newOven.serial_number}
            onChange={(e) => setNewOven((x) => ({ ...x, serial_number: e.target.value }))}
          />
          <Button onClick={() => addMut.mutate()} disabled={addMut.isPending}>
            <Plus className="mr-1 h-4 w-4" /> Ajouter
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-12 px-3 py-2.5">#</th>
              <th className="px-3 py-2.5">Numéro interne</th>
              <th className="px-3 py-2.5">Numéro de série</th>
              <th className="w-40 px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Chargement…</td></tr>
            ) : (
              data!.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-muted-foreground">{o.position}</td>
                  <td className="px-3 py-2">
                    <Input
                      className="font-mono"
                      value={edits[o.id]?.internal_number ?? ""}
                      onChange={(e) => setEdits((x) => ({ ...x, [o.id]: { ...x[o.id], internal_number: e.target.value } }))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="font-mono"
                      value={edits[o.id]?.serial_number ?? ""}
                      onChange={(e) => setEdits((x) => ({ ...x, [o.id]: { ...x[o.id], serial_number: e.target.value } }))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" onClick={() => saveMut.mutate(o)} disabled={saveMut.isPending}>
                        Enregistrer
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setToDelete(o)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce four ?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && (
                <>Le four <span className="font-mono">{toDelete.internal_number}</span> ({toDelete.serial_number}) sera supprimé définitivement, ainsi que son historique. Cette action est irréversible.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (toDelete) deleteMut.mutate(toDelete); }}
              disabled={deleteMut.isPending}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
