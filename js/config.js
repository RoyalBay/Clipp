// ═══════════════════════════════════════════
//   Clipp — Supabase Configuration
//   Replace the two values below with your project's.
//   Dashboard → Settings → API
// ═══════════════════════════════════════════

// These are safe to leave in client-side code.
// The anon key only allows what your Row Level Security
// (RLS) policies permit.
const SUPABASE_URL = 'https://uyxhlsydoyakjikmalmu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5eGhsc3lkb3lha2ppa21hbG11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzM1NTYsImV4cCI6MjA5MjI0OTU1Nn0.iUN81VtjDw3JedUer2BokylZvZX-F8E6H6-p9YqC394';

// Official moderator account
const MOD_USER_ID = 'u_mz770y';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
