import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

// Using generic client for flexibility - in production, use generated types
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

/**
 * Client for the public /report/:token view. It sends the share token in the
 * `x-share-token` header, which RLS checks (assessment_is_shared): a token
 * holder can read exactly the one report it was issued for. No session — the
 * view is anonymous even when someone is signed in, so it never mixes the
 * reader's own access into the shared report.
 */
const shareClients = new Map<string, SupabaseClient>();
export function shareClient(token: string): SupabaseClient {
  let client = shareClients.get(token);
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { 'x-share-token': token } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: `wui-share-${token}`,
      },
    });
    shareClients.set(token, client);
  }
  return client;
}

// Helper functions for common operations
export async function uploadPhoto(
  file: Blob,
  path: string
): Promise<{ path: string; url: string } | null> {
  const { data, error } = await supabase.storage
    .from('assessment-photos')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Error uploading photo:', error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('assessment-photos')
    .getPublicUrl(data.path);

  return {
    path: data.path,
    url: urlData.publicUrl,
  };
}

export async function deletePhoto(path: string): Promise<boolean> {
  const { error } = await supabase.storage
    .from('assessment-photos')
    .remove([path]);

  if (error) {
    console.error('Error deleting photo:', error);
    return false;
  }

  return true;
}

export function getPhotoUrl(path: string): string {
  const { data } = supabase.storage
    .from('assessment-photos')
    .getPublicUrl(path);

  return data.publicUrl;
}
