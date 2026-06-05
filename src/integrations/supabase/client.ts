import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Variables d'environnement Cloudflare Workers injectées via wrangler.toml / .dev.vars
// Stockées ici lors du premier appel fetch côté serveur
let _cfEnv: Record<string, string> = {};

/** Appelé par server.ts pour injecter les variables Cloudflare Workers */
export function setCloudflareEnv(env: unknown) {
  if (env && typeof env === "object") {
    _cfEnv = env as Record<string, string>;
  }
}

function getVar(viteKey: string, rawKey: string): string {
  // 1. Vite client-side (build-time injection)
  try {
    const v = (import.meta.env as Record<string, string>)[viteKey];
    if (v && v !== "undefined") return v;
  } catch {}
  // 2. Cloudflare Workers env object
  const cfVal = _cfEnv[rawKey] || _cfEnv[viteKey];
  if (cfVal) return cfVal;
  // 3. Node process.env (local dev fallback)
  try {
    const v = process.env[rawKey] || process.env[viteKey];
    if (v) return v;
  } catch {}
  return "";
}

function buildClient() {
  const url = getVar("VITE_SUPABASE_URL", "SUPABASE_URL");
  const key = getVar("VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY");

  if (!url || !key) {
    console.warn(
      "[Supabase] Variables manquantes (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).\n" +
      "Vérifiez votre fichier .env et redémarrez le serveur de développement."
    );
    // Client placeholder — évite le crash SSR, les requêtes retourneront une erreur propre
    return createClient<Database>("https://placeholder.supabase.co", "placeholder", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return createClient<Database>(url, key, {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

// Instance lazy — recrée le client si les variables CF arrivent après le premier import
let _client: ReturnType<typeof createClient<Database>> | undefined;
let _builtWithPlaceholder = false;

export const supabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(_, prop, receiver) {
    if (!_client || _builtWithPlaceholder) {
      const url = getVar("VITE_SUPABASE_URL", "SUPABASE_URL");
      const key = getVar("VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY");
      if (!_client || (url && key && _builtWithPlaceholder)) {
        _client = buildClient();
        _builtWithPlaceholder = !url || !key;
      }
    }
    return Reflect.get(_client!, prop, receiver);
  },
});
