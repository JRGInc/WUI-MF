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

/** The signed-in user's organization memberships, and whether they have loaded. */
export function useMyMembershipsState(): { memberships: OrganizationMembership[]; loaded: boolean } {
  const { user } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState<{ memberships: OrganizationMembership[]; loaded: boolean }>({
    memberships: [],
    loaded: false,
  });

  useEffect(() => {
    if (!userId) {
      setState({ memberships: [], loaded: true });
      return;
    }
    let cancelled = false;
    membershipsFor(userId)
      .then((m) => {
        if (!cancelled) setState({ memberships: m, loaded: true });
      })
      .catch((error) => {
        console.error('Could not load organization memberships:', error);
        if (!cancelled) setState({ memberships: [], loaded: true });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return state;
}

/** The signed-in user's organization memberships ([] when none, offline, or still loading). */
export function useMyMemberships(): OrganizationMembership[] {
  return useMyMembershipsState().memberships;
}
