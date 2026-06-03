import { useEffect, useState } from "react";
import type { OvenWithActive } from "@/lib/oven-queries";
import { cn } from "@/lib/utils";

function formatElapsed(startISO: string): string {
  const start = new Date(startISO).getTime();
  const diff = Math.max(0, Date.now() - start);
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function OvenCard({ oven, onClick }: { oven: OvenWithActive; onClick: () => void }) {
  const isBusy = oven.active !== null;
  const [, force] = useState(0);
  useEffect(() => {
    if (!isBusy) return;
    const t = setInterval(() => force((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, [isBusy]);

  const startedAtISO = oven.active
    ? `${oven.active.date_debut}T${oven.active.heure_debut}`
    : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card text-left card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isBusy
          ? "border-busy/30 hover:border-busy/60 hover:glow-busy"
          : "border-border hover:border-success/50 hover:glow-success",
      )}
    >
      {/* Top accent bar */}
      <div className={cn("h-1 w-full rounded-t-xl", isBusy ? "bg-busy" : "bg-success")} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono text-base font-bold text-foreground leading-tight">
              {oven.internal_number}
            </div>
            <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
              {oven.serial_number}
            </div>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider",
              isBusy ? "bg-busy/15 text-busy" : "bg-success/15 text-success",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", isBusy ? "bg-busy animate-pulse-dot" : "bg-success")} />
            {isBusy ? "Actif" : "Libre"}
          </span>
        </div>

        {/* Body */}
        {isBusy && oven.active ? (
          <div className="mt-3 space-y-1.5 border-t border-border/50 pt-3 text-[11px]">
            <InfoRow label="Réalisateur" value={oven.active.realisateur} />
            {oven.active.projet && <InfoRow label="Projet" value={oven.active.projet} />}
            {startedAtISO && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Durée</span>
                <span className="font-mono font-semibold text-busy tabular-nums">
                  {formatElapsed(startedAtISO)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 border-t border-border/50 pt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground group-hover:text-success transition-colors">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9"/><path d="M12 8v8m-4-4h8" strokeLinecap="round"/>
            </svg>
            Démarrer une opération
          </div>
        )}
      </div>
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="truncate font-medium text-foreground text-right">{value}</span>
    </div>
  );
}
