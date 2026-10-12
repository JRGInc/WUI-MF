import { useEffect, useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import type { OrganizationMembership } from '@/shared/types';
import { fetchMyMemberships } from '../organizationsService';

// One fetch per signed-in user per page load, shared by the nav and the report
// page. Memberships change rarely and only server-side (service role).
let cache: { userId: string; promise: Promise<OrganizationMembership[]> } | null = null;

function membershipsFor(userId: string): Promise<OrganizationMembership[]> {
  if (cache?.userId !== userId) {
    const promise = fetchMyMemberships(userId).catch((error) => {
      // Offline or transient failure: don't cache the failure.
      if (cache?.promise === promise) cache = null;
      throw error;
    });
    cache = { userId, promise };
  }
  return cache.promise;
}

/** The signed-in user's organization memberships ([] when none or offline). */
export function useMyMemberships(): OrganizationMembership[] {
  const { user } = useAuth();
  const userId = user?.id;
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);

  useEffect(() => {
    if (!userId) {
      setMemberships([]);
      return;
    }
    let cancelled = false;
    membershipsFor(userId)
      .then((m) => {
        if (!cancelled) setMemberships(m);
      })
      .catch((error) => console.error('Could not load organization memberships:', error));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return memberships;
}
