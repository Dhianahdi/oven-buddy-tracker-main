import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getPendingMutations, removePendingMutation } from "@/lib/offline-db";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

export function useOfflineSync() {
  const online = useOnlineStatus();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const checkPending = useCallback(async () => {
    const mutations = await getPendingMutations();
    setPendingCount(mutations.length);
  }, []);

  const sync = useCallback(async () => {
    const mutations = await getPendingMutations();
    if (mutations.length === 0) return;
    setSyncing(true);
    let successCount = 0;
    for (const mut of mutations) {
      try {
        if (mut.operation === "insert") {
          const { error } = await supabase.from(mut.table as any).insert(mut.payload as any);
          if (error) throw error;
        } else if (mut.operation === "update") {
          const { id, ...rest } = mut.payload as any;
          const { error } = await supabase.from(mut.table as any).update(rest).eq("id", id);
          if (error) throw error;
        } else if (mut.operation === "delete") {
          const { error } = await supabase.from(mut.table as any).delete().eq("id", (mut.payload as any).id);
          if (error) throw error;
        }
        await removePendingMutation(mut.id);
        successCount++;
      } catch {
        // keep in queue for next attempt
      }
    }
    setSyncing(false);
    setPendingCount(prev => Math.max(0, prev - successCount));
    if (successCount > 0) {
      toast.success(`${successCount} opération${successCount > 1 ? "s" : ""} synchronisée${successCount > 1 ? "s" : ""}`);
      qc.invalidateQueries({ queryKey: ["ovens"] });
      qc.invalidateQueries({ queryKey: ["history"] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
    }
  }, [qc]);

  useEffect(() => {
    checkPending();
  }, [checkPending]);

  useEffect(() => {
    if (online) {
      sync();
    }
  }, [online, sync]);

  return { online, syncing, pendingCount };
}
