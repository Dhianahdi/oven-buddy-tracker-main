import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchHistory } from "@/lib/oven-queries";
import { exportCSV, exportPDF } from "@/lib/export";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, FileText, X } from "lucide-react";

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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [operatorFilter, setOperatorFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [page, setPage] = useState(1);

  const counts = useMemo(() => ({
    total: data?.length ?? 0,
    active: data?.filter(o => o.status === "active").length ?? 0,
    completed: data?.filter(o => o.status === "completed").length ?? 0,
  }), [data]);

  const operators = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.forEach(o => {
      if (o.demandeur) set.add(o.demandeur);
      if (o.realisateur) set.add(o.realisateur);
    });
    return Array.from(set).sort();
  }, [data]);

  const types = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.forEach(o => { if (o.type) set.add(o.type); });
    return Array.from(set).sort();
  }, [data]);

  const hasActiveFilters = dateFrom || dateTo || operatorFilter || typeFilter;

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
    if (dateFrom) arr = arr.filter(o => o.date_debut >= dateFrom);
    if (dateTo)   arr = arr.filter(o => o.date_debut <= dateTo);
    if (operatorFilter) {
      const q = operatorFilter.toLowerCase();
      arr = arr.filter(o =>
        o.demandeur?.toLowerCase().includes(q) ||
        o.realisateur?.toLowerCase().includes(q)
      );
    }
    if (typeFilter) arr = arr.filter(o => o.type === typeFilter);
    return arr;
  }, [data, search, statusFilter, dateFrom, dateTo, operatorFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function resetFilters() {
    setDateFrom("");
    setDateTo("");
    setOperatorFilter("");
    setTypeFilter("");
    setSearch("");
    setStatusFilter("all");
    setPage(1);
  }

  function handleFilterChange(fn: () => void) {
    fn();
    setPage(1);
  }

  const exportFilename = `historique_${new Date().toISOString().slice(0, 10)}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Journal</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Historique des opérations</h1>
          <p className="mt-1 text-sm text-muted-foreground">500 dernières opérations · actives et terminées</p>
        </div>
        {/* Export buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-border"
            disabled={isLoading || filtered.length === 0}
            onClick={() => exportCSV(filtered, `${exportFilename}.csv`)}
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-border"
            disabled={isLoading || filtered.length === 0}
            onClick={() => exportPDF(filtered, `${exportFilename}.pdf`)}
          >
            <FileText className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Mini KPIs */}
      <div className="mb-6 grid grid-cols-3 gap-3 sm:max-w-lg">
        <MiniStat label="Total" value={counts.total} color="text-foreground" />
        <MiniStat label="En cours" value={counts.active} color="text-busy" />
        <MiniStat label="Terminées" value={counts.completed} color="text-success" />
      </div>

      {/* Status tabs + search row */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-border bg-card p-1 gap-1">
          {(["all", "active", "completed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleFilterChange(() => setStatusFilter(s))}
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
        <div className="flex items-center gap-2 sm:w-auto w-full">
          <div className="relative flex-1 sm:w-72">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" strokeLinecap="round"/>
            </svg>
            <Input
              placeholder="Four, demandeur, projet…"
              value={search}
              onChange={(e) => handleFilterChange(() => setSearch(e.target.value))}
              className="pl-9 bg-card border-border"
            />
          </div>
          <Button
            variant={showAdvanced ? "default" : "outline"}
            size="sm"
            className={`gap-2 shrink-0 ${showAdvanced ? "glow-primary" : "border-border"}`}
            onClick={() => setShowAdvanced(v => !v)}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"/>
            </svg>
            Filtres
            {hasActiveFilters && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {[dateFrom, dateTo, operatorFilter, typeFilter].filter(Boolean).length}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Advanced filters panel */}
      {showAdvanced && (
        <div className="mb-4 rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Filtres avancés</p>
            {hasActiveFilters && (
              <button
                onClick={() => handleFilterChange(() => { setDateFrom(""); setDateTo(""); setOperatorFilter(""); setTypeFilter(""); })}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" /> Réinitialiser
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Date from */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date début (depuis)</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => handleFilterChange(() => setDateFrom(e.target.value))}
                className="bg-secondary/30 border-border"
              />
            </div>
            {/* Date to */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date début (jusqu'au)</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => handleFilterChange(() => setDateTo(e.target.value))}
                className="bg-secondary/30 border-border"
              />
            </div>
            {/* Operator */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Opérateur</label>
              <select
                value={operatorFilter}
                onChange={(e) => handleFilterChange(() => setOperatorFilter(e.target.value))}
                className="w-full rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Tous</option>
                {operators.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>
            {/* Type */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type de câble</label>
              <select
                value={typeFilter}
                onChange={(e) => handleFilterChange(() => setTypeFilter(e.target.value))}
                className="w-full rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Tous</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="mt-3 flex flex-wrap gap-2">
              {dateFrom && <FilterChip label={`Depuis ${dateFrom}`} onRemove={() => handleFilterChange(() => setDateFrom(""))} />}
              {dateTo && <FilterChip label={`Jusqu'au ${dateTo}`} onRemove={() => handleFilterChange(() => setDateTo(""))} />}
              {operatorFilter && <FilterChip label={`Opérateur: ${operatorFilter}`} onRemove={() => handleFilterChange(() => setOperatorFilter(""))} />}
              {typeFilter && <FilterChip label={`Type: ${typeFilter}`} onRemove={() => handleFilterChange(() => setTypeFilter(""))} />}
            </div>
          )}
        </div>
      )}

      {/* Results count */}
      {!isLoading && (
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {filtered.length} opération{filtered.length > 1 ? "s" : ""} trouvée{filtered.length > 1 ? "s" : ""}
            {hasActiveFilters || search ? " (filtrées)" : ""}
          </p>
          {(hasActiveFilters || search || statusFilter !== "all") && (
            <button onClick={resetFilters} className="text-xs text-primary hover:underline">
              Tout réinitialiser
            </button>
          )}
        </div>
      )}

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
                        <div className="h-4 animate-shimmer rounded" style={{ width: `${60 + (i * j % 4) * 10}%` }} />
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
                    {(hasActiveFilters || search) && (
                      <button onClick={resetFilters} className="mt-2 text-xs text-primary hover:underline">
                        Réinitialiser les filtres
                      </button>
                    )}
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
          <div className="flex items-center justify-between border-t border-border/50 px-4 py-3">
            <span className="text-xs text-muted-foreground">
              {filtered.length} opération{filtered.length > 1 ? "s" : ""} · page {safePage}/{totalPages}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  size="sm" variant="outline"
                  className="h-8 w-8 p-0 border-border"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .reduce<(number | "…")[]>((acc, p, i, arr) => {
                    if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…" ? (
                      <span key={`e-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                    ) : (
                      <Button
                        key={p}
                        size="sm"
                        variant={safePage === p ? "default" : "outline"}
                        className={`h-8 w-8 p-0 text-xs ${safePage === p ? "glow-primary" : "border-border"}`}
                        onClick={() => setPage(p as number)}
                      >
                        {p}
                      </Button>
                    )
                  )}
                <Button
                  size="sm" variant="outline"
                  className="h-8 w-8 p-0 border-border"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Dash() { return <span className="text-muted-foreground/40">—</span>; }

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
      {label}
      <button onClick={onRemove} className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5 transition-colors">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}
