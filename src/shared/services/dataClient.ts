import { createContext, useContext } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { shareClient, supabase } from './supabaseClient';

/**
 * Set by the shared /report/:token view. Components under it read through the
 * token-scoped client (see shareClient) instead of the signed-in session.
 */
export const ShareTokenContext = createContext<string | undefined>(undefined);

/** The Supabase client for reads: token-scoped inside a shared report, else the session client. */
export function useDataClient(): SupabaseClient {
  const token = useContext(ShareTokenContext);
  return token ? shareClient(token) : supabase;
}
