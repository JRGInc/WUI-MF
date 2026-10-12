import { useEffect, useState } from 'react';
import type { Organization } from '@/shared/types';
import { fetchOrganizations } from '../organizationsService';

// Organization names are public and change rarely: fetch once per page load.
let cache: Promise<Organization[]> | null = null;

function loadOrganizations(): Promise<Organization[]> {
  if (!cache) {
    cache = fetchOrganizations().catch((error) => {
      cache = null; // offline / transient: retry next time
      throw error;
    });
  }
  return cache;
}

/** All organizations ([] until loaded, or when offline). */
export function useOrganizations(enabled = true): Organization[] {
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadOrganizations()
      .then((orgs) => {
        if (!cancelled) setOrganizations(orgs);
      })
      .catch((error) => console.error('Could not load organizations:', error));
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return organizations;
}
