import { supabase } from "@/integrations/supabase/client";

export type Oven = {
  id: string;
  position: number;
  serial_number: string;
  internal_number: string;
};

export type Operation = {
  id: string;
  oven_id: string;
  demandeur: string;
  realisateur: string;
  projet: string | null;
  cdc: string | null;
  essai: string | null;
  specification: string | null;
  date_debut: string;
  heure_debut: string;
  date_fin: string | null;
  heure_fin: string | null;
  type: string | null;
  section: string | null;
  couleur: string | null;
  status: "active" | "completed";
  notes: string | null;
  created_at: string;
  ended_at: string | null;
};

export type OvenWithActive = Oven & { active: Operation | null };

export async function fetchOvensWithActive(): Promise<OvenWithActive[]> {
  const [{ data: ovens, error: oErr }, { data: ops, error: opErr }] = await Promise.all([
    supabase.from("ovens").select("*").order("position", { ascending: true }),
    supabase.from("operations").select("*").eq("status", "active"),
  ]);
  if (oErr) throw oErr;
  if (opErr) throw opErr;
  const byOven = new Map<string, Operation>();
  (ops ?? []).forEach((o) => byOven.set(o.oven_id, o as Operation));
  return (ovens ?? []).map((o) => ({ ...(o as Oven), active: byOven.get(o.id) ?? null }));
}

export async function fetchHistory(): Promise<(Operation & { oven: Oven })[]> {
  const { data, error } = await supabase
    .from("operations")
    .select("*, oven:ovens(*)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as any;
}
