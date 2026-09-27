import { createClient } from "@supabase/supabase-js"

// Validate that required environment variables exist
// These are loaded from .env.local via Vite's import.meta.env
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url) {
  throw new Error("VITE_SUPABASE_URL environment variable is not set")
}

if (!key) {
  throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY environment variable is not set")
}

export const supabase = createClient(url, key)
