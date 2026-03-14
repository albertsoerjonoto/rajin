import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  // Fallback values allow the app to build without env vars set.
  // At runtime on Vercel, the real values will be injected.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
  );
}
