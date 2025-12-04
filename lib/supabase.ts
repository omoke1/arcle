import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[Supabase] Missing environment variables. Supabase features will be disabled.");
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
    })
  : null;

export const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
    })
  : null;

export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return supabase;
}

export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured. Set SUPABASE_SERVICE_ROLE_KEY");
  }
  return supabaseAdmin;
}

