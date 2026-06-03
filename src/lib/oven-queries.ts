import { supabase } from "@/integrations/supabase/client";
import { cacheData, getCachedData, isOnline } from "./offline-db";

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

export type Reservation = {
  id: string;
  oven_id: string;
  demandeur: string;
  projet: string | null;
  date_debut: string;
  heure_debut: string;
  date_fin: string;
  heure_fin: string;
  notes: string | null;
  created_at: string;
};

export type ReservationWithOven = Reservation & { oven: Oven };

export async function fetchOvensWithActive(): Promise<OvenWithActive[]> {
  if (!isOnline()) {
    return getCachedData<OvenWithActive>("ovens");
  }
  const [{ data: ovens, error: oErr }, { data: ops, error: opErr }] = await Promise.all([
    supabase.from("ovens").select("*").order("position", { ascending: true }),
    supabase.from("operations").select("*").eq("status", "active"),
  ]);
  if (oErr) throw oErr;
  if (opErr) throw opErr;
  const byOven = new Map<string, Operation>();
  (ops ?? []).forEach((o) => byOven.set(o.oven_id, o as Operation));
  const result = (ovens ?? []).map((o) => ({ ...(o as Oven), active: byOven.get(o.id) ?? null }));
  cacheData("ovens", result).catch(() => {});
  return result;
}

export async function fetchHistory(): Promise<(Operation & { oven: Oven })[]> {
  if (!isOnline()) {
    return getCachedData<Operation & { oven: Oven }>("history");
  }
  const { data, error } = await supabase
    .from("operations")
    .select("*, oven:ovens(*)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  const result = (data ?? []) as any;
  cacheData("history", result).catch(() => {});
  return result;
}

export async function fetchReservations(): Promise<ReservationWithOven[]> {
  if (!isOnline()) {
    return getCachedData<ReservationWithOven>("reservations");
  }
  const { data, error } = await supabase
    .from("reservations")
    .select("*, oven:ovens(*)")
    .order("date_debut", { ascending: true })
    .order("heure_debut", { ascending: true });
  if (error) throw error;
  const result = (data ?? []) as any;
  cacheData("reservations", result).catch(() => {});
  return result;
}

export async function createReservation(payload: Omit<Reservation, "id" | "created_at">): Promise<void> {
  const { error } = await supabase.from("reservations").insert(payload);
  if (error) throw error;
}

export async function deleteReservation(id: string): Promise<void> {
  const { error } = await supabase.from("reservations").delete().eq("id", id);
  if (error) throw error;
}
