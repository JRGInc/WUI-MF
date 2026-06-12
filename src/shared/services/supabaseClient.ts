import { createClient } from '@supabase/supabase-js';

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
