import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchHistory } from "@/lib/oven-queries";

export const Route = createFileRoute("/historique")({
  component: HistoryPage,
  head: () => ({ meta: [{ title: "Historique — Suivi Fours" }] }),
});

function HistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["history"],
    queryFn: fetchHistory,
    refetchInterval: 60_000,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Historique des opérations</h1>
        <p className="mt-1 text-sm text-muted-foreground">500 dernières opérations (actives et terminées)</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Four</th>
                <th className="px-3 py-2.5">Statut</th>
                <th className="px-3 py-2.5">Demandeur</th>
                <th className="px-3 py-2.5">Réalisateur</th>
                <th className="px-3 py-2.5">Projet</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5">Section</th>
                <th className="px-3 py-2.5">Couleur</th>
                <th className="px-3 py-2.5">Début</th>
                <th className="px-3 py-2.5">Fin</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Chargement…</td></tr>
              ) : (data?.length ?? 0) === 0 ? (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Aucune opération pour le moment</td></tr>
              ) : (
                data!.map((op) => (
                  <tr key={op.id} className="border-t border-border hover:bg-secondary/40">
                    <td className="px-3 py-2 font-mono">
                      <div className="font-semibold text-primary">{op.oven?.internal_number}</div>
                      <div className="text-xs text-muted-foreground">{op.oven?.serial_number}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${op.status === "active" ? "bg-busy/10 text-busy" : "bg-success/10 text-success"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${op.status === "active" ? "bg-busy" : "bg-success"}`} />
                        {op.status === "active" ? "En cours" : "Terminée"}
                      </span>
                    </td>
                    <td className="px-3 py-2">{op.demandeur}</td>
                    <td className="px-3 py-2">{op.realisateur}</td>
                    <td className="px-3 py-2">{op.projet ?? "—"}</td>
                    <td className="px-3 py-2">{op.type ?? "—"}</td>
                    <td className="px-3 py-2">{op.section ?? "—"}</td>
                    <td className="px-3 py-2">{op.couleur ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{op.date_debut} {op.heure_debut}</td>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                      {op.date_fin ? `${op.date_fin} ${op.heure_fin ?? ""}` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
