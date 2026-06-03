const DB_NAME = "thermotrack-offline";
const DB_VERSION = 1;

type StoreNames = "ovens" | "history" | "reservations" | "pending_mutations";

export type PendingMutation = {
  id: string;
  table: string;
  operation: "insert" | "update" | "delete";
  payload: Record<string, unknown>;
  created_at: number;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("ovens")) {
        db.createObjectStore("ovens", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("history")) {
        const s = db.createObjectStore("history", { keyPath: "id" });
        s.createIndex("created_at", "created_at");
      }
      if (!db.objectStoreNames.contains("reservations")) {
        const s = db.createObjectStore("reservations", { keyPath: "id" });
        s.createIndex("date_debut", "date_debut");
      }
      if (!db.objectStoreNames.contains("pending_mutations")) {
        db.createObjectStore("pending_mutations", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheData<T extends { id: string }>(store: StoreNames, items: T[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(store, "readwrite");
  const s = tx.objectStore(store);
  await Promise.all([
    ...items.map(item => new Promise<void>((res, rej) => {
      const r = s.put(item);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    })),
    new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    }),
  ]);
}

export async function getCachedData<T>(store: StoreNames): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const s = tx.objectStore(store);
    const req = s.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function addPendingMutation(mutation: Omit<PendingMutation, "id" | "created_at">): Promise<void> {
  const db = await openDB();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_mutations", "readwrite");
    const s = tx.objectStore("pending_mutations");
    const req = s.put({ ...mutation, id, created_at: Date.now() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingMutations(): Promise<PendingMutation[]> {
  return getCachedData<PendingMutation>("pending_mutations");
}

export async function removePendingMutation(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_mutations", "readwrite");
    const s = tx.objectStore("pending_mutations");
    const req = s.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}
