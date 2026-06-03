import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchOvensWithActive, type OvenWithActive } from "@/lib/oven-queries";
import { OvenCard } from "@/components/OvenCard";
import { StartOperationDialog } from "@/components/StartOperationDialog";
import { OvenDetailsDialog } from "@/components/OvenDetailsDialog";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

type Filter = "all" | "free" | "busy";

function Dashboard() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["ovens"],
    queryFn: fetchOvensWithActive,
    refetchInterval: 60_000,
  });

  const [selected, setSelected] = useState<OvenWithActive | null>(null);
  const [openStart, setOpenStart] = useState(false);
  const [openDetails, setOpenDetails] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const ch = supabase
      .channel("ovens-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "operations" }, () => {
        qc.invalidateQueries({ queryKey: ["ovens"] });
        qc.invalidateQueries({ queryKey: ["history"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ovens" }, () => {
        qc.invalidateQueries({ queryKey: ["ovens"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const counts = useMemo(() => {
    const total = data?.length ?? 0;
    const busy = data?.filter((o) => o.active).length ?? 0;
    const free = total - busy;
    const utilRate = total > 0 ? Math.round((busy / total) * 100) : 0;
    return { total, busy, free, utilRate };
  }, [data]);

  const filtered = useMemo(() => {
    let arr = data ?? [];
    if (filter === "free") arr = arr.filter((o) => !o.active);
    if (filter === "busy") arr = arr.filter((o) => o.active);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(
        (o) =>
          o.internal_number.toLowerCase().includes(q) ||
          o.serial_number.toLowerCase().includes(q) ||
          o.active?.projet?.toLowerCase().includes(q) ||
          o.active?.realisateur?.toLowerCase().includes(q),
      );
    }
    return arr;
  }, [data, filter, search]);

  const handleClick = (o: OvenWithActive) => {
    setSelected(o);
    if (o.active) setOpenDetails(true);
    else setOpenStart(true);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Page header */}
      <div className="mb-8 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Vue d'ensemble</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Tableau des fours</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Disponibilité en temps réel · {counts.total} fours de traitement thermique
          </p>
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 sm:mt-0">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <span className="text-xs font-medium text-muted-foreground">Temps réel actif</span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Total fours"
          value={counts.total}
          icon={<IconFours />}
          accent="primary"
          sub="parc complet"
        />
        <KpiCard
          label="Disponibles"
          value={counts.free}
          icon={<IconFree />}
          accent="success"
          sub="prêts à l'emploi"
        />
        <KpiCard
          label="En opération"
          value={counts.busy}
          icon={<IconBusy />}
          accent="busy"
          sub="actifs maintenant"
        />
        <KpiCard
          label="Taux d'utilisation"
          value={`${counts.utilRate}%`}
          icon={<IconRate />}
          accent="warning"
          sub="occupation globale"
          isLoading={isLoading}
        >
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-warning transition-all duration-700"
              style={{ width: `${counts.utilRate}%` }}
            />
          </div>
        </KpiCard>
      </div>

      {/* Filters + search */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-border bg-card p-1 gap-1">
          {(["all", "free", "busy"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                filter === f
                  ? f === "free"
                    ? "bg-success text-success-foreground shadow-sm"
                    : f === "busy"
                      ? "bg-busy text-busy-foreground shadow-sm"
                      : "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {f === "all" ? `Tous (${counts.total})` : f === "free" ? `Libres (${counts.free})` : `En cours (${counts.busy})`}
            </button>
          ))}
        </div>
        <div className="relative sm:max-w-xs w-full sm:w-auto">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" strokeLinecap="round"/>
          </svg>
          <Input
            placeholder="RD, B621, projet, réalisateur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="h-36 animate-shimmer rounded-xl border border-border" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((o) => (
            <OvenCard key={o.id} oven={o} onClick={() => handleClick(o)} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-border py-16 text-center">
              <svg className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" strokeLinecap="round"/>
              </svg>
              <p className="text-sm text-muted-foreground">Aucun four ne correspond à cette recherche</p>
            </div>
          )}
        </div>
      )}

      <StartOperationDialog oven={selected} open={openStart} onOpenChange={setOpenStart} />
      <OvenDetailsDialog oven={selected} open={openDetails} onOpenChange={setOpenDetails} />
    </div>
  );
}

function KpiCard({
  label, value, icon, accent, sub, isLoading, children
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: "primary" | "success" | "busy" | "warning";
  sub: string;
  isLoading?: boolean;
  children?: React.ReactNode;
}) {
  const accentCls = {
    primary: "text-primary bg-primary/10 stat-accent-primary",
    success: "text-success bg-success/10 stat-accent-success",
    busy:    "text-busy bg-busy/10 stat-accent-busy",
    warning: "text-warning bg-warning/10 stat-accent-warning",
  }[accent];
  const valCls = {
    primary: "text-primary",
    success: "text-success",
    busy:    "text-busy",
    warning: "text-warning",
  }[accent];

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 card-hover">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          {isLoading ? (
            <div className="mt-1 h-8 w-16 animate-shimmer rounded-md" />
          ) : (
            <p className={`mt-1 text-3xl font-bold font-mono tracking-tight ${valCls}`}>{value}</p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accentCls}`}>
          {icon}
        </div>
      </div>
      {children}
    </div>
  );
}

function IconFours() {
  return <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18" strokeLinecap="round"/><circle cx="8" cy="15" r="1" fill="currentColor"/><circle cx="12" cy="15" r="1" fill="currentColor"/><circle cx="16" cy="15" r="1" fill="currentColor"/></svg>;
}
function IconFree() {
  return <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function IconBusy() {
  return <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.387Z"/></svg>;
}
function IconRate() {
  return <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"/></svg>;
}
