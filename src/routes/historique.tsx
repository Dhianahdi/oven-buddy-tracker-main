import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchHistory } from "@/lib/oven-queries";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

export const Route = createFileRoute("/historique")({
  component: HistoryPage,
  head: () => ({ meta: [{ title: "Historique — ThermoTrack" }] }),
});

function HistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["history"],
    queryFn: fetchHistory,
    refetchInterval: 60_000,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed">("all");
  const [page, setPage] = useState(1);

  const counts = useMemo(() => ({
    total: data?.length ?? 0,
    active: data?.filter(o => o.status === "active").length ?? 0,
    completed: data?.filter(o => o.status === "completed").length ?? 0,
  }), [data]);

  const filtered = useMemo(() => {
    let arr = data ?? [];
    if (statusFilter !== "all") arr = arr.filter(o => o.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(o =>
        o.oven?.internal_number?.toLowerCase().includes(q) ||
        o.oven?.serial_number?.toLowerCase().includes(q) ||
        o.demandeur?.toLowerCase().includes(q) ||
        o.realisateur?.toLowerCase().includes(q) ||
        o.projet?.toLowerCase().includes(q)
      );
    }
    return arr;
  }, [data, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Journal</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Historique des opérations</h1>
        <p className="mt-1 text-sm text-muted-foreground">500 dernières opérations · actives et terminées</p>
      </div>

      {/* Mini KPIs */}
      <div className="mb-6 grid grid-cols-3 gap-3 sm:max-w-lg">
        <MiniStat label="Total" value={counts.total} color="text-foreground" />
        <MiniStat label="En cours" value={counts.active} color="text-busy" />
        <MiniStat label="Terminées" value={counts.completed} color="text-success" />
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-border bg-card p-1 gap-1">
          {(["all", "active", "completed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
                statusFilter === s
                  ? s === "active"
                    ? "bg-busy text-busy-foreground shadow-sm"
                    : s === "completed"
                      ? "bg-success text-success-foreground shadow-sm"
                      : "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {s === "all" ? "Toutes" : s === "active" ? "En cours" : "Terminées"}
            </button>
          ))}
        </div>
        <div className="relative sm:w-72 w-full">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" strokeLinecap="round"/>
          </svg>
          <Input
            placeholder="Four, demandeur, projet…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 bg-card border-border"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Four", "Statut", "Demandeur", "Réalisateur", "Projet", "Type", "Section", "Couleur", "Début", "Fin"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-shimmer rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <svg className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"/>
                    </svg>
                    <p className="text-sm text-muted-foreground">Aucune opération trouvée</p>
                  </td>
                </tr>
              ) : (
                paginated.map((op, idx) => (
                  <tr
                    key={op.id}
                    className={`border-b border-border/40 transition-colors hover:bg-secondary/30 ${idx % 2 === 0 ? "" : "bg-secondary/10"}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-mono text-sm font-bold text-primary">{op.oven?.internal_number}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{op.oven?.serial_number}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                        op.status === "active"
                          ? "bg-busy/15 text-busy"
                          : "bg-success/15 text-success"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${op.status === "active" ? "bg-busy animate-pulse-dot" : "bg-success"}`} />
                        {op.status === "active" ? "En cours" : "Terminée"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{op.demandeur}</td>
                    <td className="px-4 py-3 font-medium">{op.realisateur}</td>
                    <td className="px-4 py-3 text-muted-foreground">{op.projet ?? <Dash />}</td>
                    <td className="px-4 py-3 text-muted-foreground">{op.type ?? <Dash />}</td>
                    <td className="px-4 py-3 text-muted-foreground">{op.section ?? <Dash />}</td>
                    <td className="px-4 py-3 text-muted-foreground">{op.couleur ?? <Dash />}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{op.date_debut} {op.heure_debut}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {op.date_fin ? `${op.date_fin} ${op.heure_fin ?? ""}` : <Dash />}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && filtered.length > 0 && (
          <div className="border-t border-border/50 px-4 py-2.5 text-xs text-muted-foreground">
            {filtered.length} opération{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

function Dash() { return <span className="text-muted-foreground/40">—</span>; }

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}
