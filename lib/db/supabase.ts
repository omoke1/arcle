/**
 * Supabase Client
 * 
 * Singleton instances for client-side and server-side Supabase access
 * 
 * Usage:
 * - Client-side: Use `supabase` (uses anon key, respects RLS)
 * - Server-side: Use `supabaseAdmin` (uses service role key, bypasses RLS)
 */

export * from "@/lib/supabase";

