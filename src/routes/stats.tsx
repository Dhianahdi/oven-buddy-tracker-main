import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchStats, fetchOvensWithActive, fetchHistory } from "@/lib/oven-queries";
import type { StatsOperation } from "@/lib/oven-queries";
import { exportCSV, exportPDF } from "@/lib/export";
import { Download, FileText, TrendingUp, Clock, Activity, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

// Lazy-load the Recharts component so it is never evaluated on the server
const StatsCharts = lazy(() =>
  import("@/components/StatsCharts").then(m => ({ default: m.StatsCharts }))
);

export const Route = createFileRoute("/stats")({
  component: StatsPage,
  head: () => ({ meta: [{ title: "Statistiques — ThermoTrack" }] }),
});

function useIsClient() {
  const [client, setClient] = useState(false);
  useEffect(() => setClient(true), []);
  return client;
}

type Period = "7j" | "30j" | "90j" | "365j" | "tout";

const PERIOD_DAYS: Record<Period, number | null> = {
  "7j": 7, "30j": 30, "90j": 90, "365j": 365, "tout": null,
};

const CHART_COLORS = [
  "oklch(0.72 0.18 200)",
  "oklch(0.75 0.17 155)",
  "oklch(0.82 0.16 80)",
  "oklch(0.72 0.2 38)",
  "oklch(0.70 0.18 290)",
  "oklch(0.68 0.18 340)",
  "oklch(0.65 0.20 160)",
  "oklch(0.75 0.20 60)",
];

function durationHours(op: StatsOperation): number {
  try {
    const start = new Date(`${op.date_debut}T${op.heure_debut}`);
    let end: Date;
    if (op.date_fin && op.heure_fin) {
      end = new Date(`${op.date_fin}T${op.heure_fin}`);
    } else if (op.ended_at) {
      end = new Date(op.ended_at);
    } else {
      end = new Date();
    }
    const h = (end.getTime() - start.getTime()) / 3_600_000;
    return h > 0 && h < 8760 ? h : 0;
  } catch { return 0; }
}

function isoWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const wn = 1 + Math.round(
    ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
  );
  return `S${wn.toString().padStart(2, "0")} ${d.getFullYear()}`;
}

function isoMonth(date: Date): string {
  return `${date.toLocaleString("fr-FR", { month: "short" })} ${date.getFullYear()}`;
}

function StatsPage() {
  const isClient = useIsClient();

  const { data: ops = [], isLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
    refetchInterval: 120_000,
  });
  const { data: ovens = [] } = useQuery({
    queryKey: ["ovens"],
    queryFn: fetchOvensWithActive,
  });
  const { data: historyData = [] } = useQuery({
    queryKey: ["history"],
    queryFn: fetchHistory,
  });

  const [period, setPeriod]   = useState<Period>("30j");
  const [groupBy, setGroupBy] = useState<"week" | "month">("week");

  const filtered = useMemo(() => {
    const days = PERIOD_DAYS[period];
    if (!days) return ops;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return ops.filter(o => new Date(o.created_at) >= cutoff);
  }, [ops, period]);

  const kpis = useMemo(() => {
    const total      = filtered.length;
    const completed  = filtered.filter(o => o.status === "completed").length;
    const totalHours = filtered.reduce((acc, o) => acc + durationHours(o), 0);
    const avgHours   = total > 0 ? totalHours / total : 0;
    const ovensUsed  = new Set(filtered.map(o => o.oven_id)).size;
    const totalOvens = ovens.length;
    const utilRate   = totalOvens > 0 ? Math.round((ovensUsed / totalOvens) * 100) : 0;
    return { total, completed, totalHours, avgHours, ovensUsed, totalOvens, utilRate };
  }, [filtered, ovens]);

  const perOvenData = useMemo(() => {
    const map = new Map<string, { label: string; ops: number; heures: number }>();
    filtered.forEach(o => {
      const key = o.oven.internal_number;
      if (!map.has(key)) map.set(key, { label: key, ops: 0, heures: 0 });
      const e = map.get(key)!;
      e.ops++;
      e.heures += durationHours(o);
    });
    return Array.from(map.values())
      .sort((a, b) => b.ops - a.ops)
      .slice(0, 15)
      .map(d => ({ ...d, heures: Math.round(d.heures * 10) / 10 }));
  }, [filtered]);

  const timelineData = useMemo(() => {
    const map = new Map<string, { label: string; ops: number; heures: number }>();
    filtered.forEach(o => {
      const date = new Date(o.date_debut);
      const key  = groupBy === "week" ? isoWeek(date) : isoMonth(date);
      if (!map.has(key)) map.set(key, { label: key, ops: 0, heures: 0 });
      const e = map.get(key)!;
      e.ops++;
      e.heures += durationHours(o);
    });
    return Array.from(map.values()).map(d => ({ ...d, heures: Math.round(d.heures * 10) / 10 }));
  }, [filtered, groupBy]);

  const statusData = useMemo(() => [
    { name: "Terminées", value: filtered.filter(o => o.status === "completed").length, color: CHART_COLORS[1] },
    { name: "En cours",  value: filtered.filter(o => o.status === "active").length,    color: CHART_COLORS[3] },
  ].filter(d => d.value > 0), [filtered]);

  const radialData = useMemo(() => {
    const maxOps = Math.max(1, ...perOvenData.map(d => d.ops));
    return perOvenData.slice(0, 8).map((d, i) => ({
      name: d.label,
      value: Math.round((d.ops / maxOps) * 100),
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [perOvenData]);

  const exportFilename = `stats_${new Date().toISOString().slice(0, 10)}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

      {/* Header */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Analytique</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Statistiques & Reporting</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Performance du parc · {ovens.length} fours · {ops.length} opérations totales
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline" size="sm" className="gap-1.5 border-border"
            disabled={isLoading || historyData.length === 0}
            onClick={() => exportCSV(historyData, `${exportFilename}.csv`)}
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button
            variant="outline" size="sm" className="gap-1.5 border-border"
            disabled={isLoading || historyData.length === 0}
            onClick={() => exportPDF(historyData, `${exportFilename}.pdf`)}
          >
            <FileText className="h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </div>

      {/* Period selector */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-border bg-card p-1 gap-1">
          {(["7j", "30j", "90j", "365j", "tout"] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                period === p
                  ? "bg-primary text-primary-foreground shadow-sm glow-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {p === "tout" ? "Tout" : p}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground font-mono">
          {filtered.length} opération{filtered.length !== 1 ? "s" : ""} dans la période
        </p>
      </div>

      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Opérations"    value={kpis.total}                         sub={`${kpis.completed} terminées`}              accent="primary" icon={<Activity className="h-5 w-5" />} />
        <KpiCard label="Heures totales" value={`${Math.round(kpis.totalHours)}h`} sub={`moy. ${kpis.avgHours.toFixed(1)}h / op.`} accent="success" icon={<Clock className="h-5 w-5" />} />
        <KpiCard label="Fours actifs"  value={`${kpis.ovensUsed} / ${kpis.totalOvens}`} sub="ont été utilisés"               accent="warning" icon={<Zap className="h-5 w-5" />} />
        <KpiCard label="Taux couverture" value={`${kpis.utilRate}%`}              sub="du parc utilisé"                          accent="busy"    icon={<TrendingUp className="h-5 w-5" />}>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-busy transition-all duration-700" style={{ width: `${kpis.utilRate}%` }} />
          </div>
        </KpiCard>
      </div>

      {/* Charts — client-only via lazy + Suspense to avoid SSR useRef/useContext crash */}
      {isClient ? (
        <Suspense fallback={<ChartsSkeleton />}>
          <StatsCharts
            isLoading={isLoading}
            timelineData={timelineData}
            statusData={statusData}
            perOvenData={perOvenData}
            radialData={radialData}
            groupBy={groupBy}
            setGroupBy={setGroupBy}
          />
        </Suspense>
      ) : (
        <ChartsSkeleton />
      )}

      {/* Summary table — pure HTML, always SSR-safe */}
      <div className="mt-4 rounded-xl border border-border bg-card p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-foreground">Récapitulatif par four</h3>
          <p className="text-xs text-muted-foreground">Détail opérations et durée cumulée</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["#", "Four", "Opérations", "Heures totales", "Moy. / op.", "Charge relative"].map((h, i) => (
                  <th key={h} className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ${i >= 2 && i <= 4 ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/40">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-3 py-2.5">
                        <div className="h-4 animate-shimmer rounded" style={{ width: `${50 + ((i + j) % 5) * 10}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : perOvenData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">Aucune donnée</td>
                </tr>
              ) : (() => {
                const maxOps = perOvenData[0]?.ops ?? 1;
                return perOvenData.map((row, i) => (
                  <tr key={row.label} className={`border-b border-border/30 hover:bg-secondary/20 transition-colors ${i % 2 !== 0 ? "bg-secondary/10" : ""}`}>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2.5 font-mono text-sm font-bold text-primary">{row.label}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-foreground">{row.ops}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-foreground">{row.heures}h</td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                      {row.ops > 0 ? (row.heures / row.ops).toFixed(1) : "—"}h
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1 h-2 overflow-hidden rounded-full bg-secondary max-w-[120px]">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{
                              width: `${Math.round((row.ops / maxOps) * 100)}%`,
                              background: CHART_COLORS[i % CHART_COLORS.length],
                              opacity: 0.85,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground w-8">
                          {Math.round((row.ops / maxOps) * 100)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──

function KpiCard({ label, value, sub, accent, icon, children }: {
  label: string; value: string | number; sub: string;
  accent: "primary" | "success" | "warning" | "busy"; icon: React.ReactNode; children?: React.ReactNode;
}) {
  const cls = {
    primary: { val: "text-primary", bg: "bg-primary/10 text-primary" },
    success: { val: "text-success", bg: "bg-success/10 text-success" },
    warning: { val: "text-warning", bg: "bg-warning/10 text-warning" },
    busy:    { val: "text-busy",    bg: "bg-busy/10 text-busy" },
  }[accent];
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={`mt-1 text-2xl font-bold font-mono tracking-tight ${cls.val}`}>{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cls.bg}`}>{icon}</div>
      </div>
      {children}
    </div>
  );
}

function ChartsSkeleton() {
  return (
    <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-2 py-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-6 animate-shimmer rounded" style={{ width: `${40 + i * 12}%` }} />
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-2 py-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 animate-shimmer rounded" style={{ width: `${60 + i * 8}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
