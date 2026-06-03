import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp } from "lucide-react";

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

type TimelineRow = { label: string; ops: number; heures: number };
type StatusRow   = { name: string; value: number; color: string };
type OvenRow     = { label: string; ops: number; heures: number };
type RadialRow   = { name: string; value: number; fill: string };

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5 text-xs shadow-xl">
      <p className="mb-1.5 font-semibold text-foreground">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-muted-foreground">{p.name} :</span>
          <span className="font-mono font-semibold text-foreground">
            {p.value}{p.name === "Heures" ? "h" : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, subtitle, children, className, action }: {
  title: string; subtitle: string; children: React.ReactNode; className?: string; action?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-border bg-card p-5 ${className ?? ""}`}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/50">
        <TrendingUp className="h-5 w-5 text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground">Pas de données pour cette période</p>
    </div>
  );
}

function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <div className="h-2 w-2 rounded-full" style={{ background: color }} />
      {dashed && <div className="h-px w-4 border-t-2 border-dashed -ml-1" style={{ borderColor: color }} />}
      {label}
    </div>
  );
}

export function StatsCharts({ isLoading, timelineData, statusData, perOvenData, radialData, groupBy, setGroupBy }: {
  isLoading: boolean;
  timelineData: TimelineRow[];
  statusData: StatusRow[];
  perOvenData: OvenRow[];
  radialData: RadialRow[];
  groupBy: "week" | "month";
  setGroupBy: (g: "week" | "month") => void;
}) {
  if (isLoading) return (
    <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
        <Skeleton />
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <Skeleton />
      </div>
    </div>
  );

  return (
    <>
      {/* Row 1 : Timeline + Pie */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title="Activité dans le temps"
          subtitle="Opérations et heures par période"
          className="lg:col-span-2"
          action={
            <div className="inline-flex rounded-lg border border-border bg-secondary/50 p-0.5 gap-0.5">
              {(["week", "month"] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setGroupBy(g)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    groupBy === g ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {g === "week" ? "Semaine" : "Mois"}
                </button>
              ))}
            </div>
          }
        >
          {timelineData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={timelineData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.025 250)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "oklch(0.55 0.02 250)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.55 0.02 250)" }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="ops" name="Opérations" stroke={CHART_COLORS[0]} strokeWidth={2.5} dot={{ r: 3, fill: CHART_COLORS[0], strokeWidth: 0 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="heures" name="Heures" stroke={CHART_COLORS[1]} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3, fill: CHART_COLORS[1], strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
          <div className="mt-3 flex items-center gap-5 px-1">
            <LegendDot color={CHART_COLORS[0]} label="Opérations" />
            <LegendDot color={CHART_COLORS[1]} label="Heures" dashed />
          </div>
        </ChartCard>

        <ChartCard title="Répartition statut" subtitle="Terminées vs en cours">
          {statusData.length === 0 ? <EmptyChart /> : (
            <div className="flex flex-col items-center gap-4">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                {statusData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                    <span>{d.name}</span>
                    <span className="font-mono font-bold text-foreground">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Row 2 : Bar charge + Radial */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Charge par four" subtitle="Nombre d'opérations — top 15" className="lg:col-span-2">
          {perOvenData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={Math.max(200, perOvenData.length * 28)}>
              <BarChart data={perOvenData} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.025 250)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "oklch(0.55 0.02 250)" }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: "oklch(0.85 0.01 240)", fontFamily: "var(--font-mono)" }} tickLine={false} axisLine={false} width={52} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="ops" name="Opérations" radius={[0, 6, 6, 0]}>
                  {perOvenData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Utilisation relative" subtitle="Classement des 8 premiers fours">
          {radialData.length === 0 ? <EmptyChart /> : (
            <div className="space-y-2 pt-1">
              {radialData.map(d => (
                <div key={d.name} className="flex items-center gap-2.5">
                  <span className="w-12 shrink-0 font-mono text-[11px] font-bold text-foreground">{d.name}</span>
                  <div className="relative flex-1 h-4 overflow-hidden rounded-full bg-secondary">
                    <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: `${d.value}%`, background: d.fill, opacity: 0.85 }} />
                  </div>
                  <span className="w-8 shrink-0 text-right font-mono text-[10px] text-muted-foreground">{d.value}%</span>
                </div>
              ))}
              <p className="pt-1 text-[10px] text-muted-foreground">% relatif au four le plus utilisé</p>
            </div>
          )}
        </ChartCard>
      </div>
    </>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-2 py-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-6 animate-shimmer rounded" style={{ width: `${40 + i * 12}%` }} />
      ))}
    </div>
  );
}
