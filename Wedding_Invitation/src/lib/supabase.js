import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const enableSupabase = import.meta.env.VITE_ENABLE_SUPABASE !== "false";

const isValidSupabaseUrl = (value) => {
  if (!value) return false;
  try {
    const { protocol, hostname } = new URL(value);
    return (protocol === "http:" || protocol === "https:") && Boolean(hostname);
  } catch {
    return false;
  }
};

export const supabase = enableSupabase && isValidSupabaseUrl(supabaseUrl) && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;