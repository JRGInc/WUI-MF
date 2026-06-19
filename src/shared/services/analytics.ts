import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabaseClient';
import { db, queueSyncOperation } from './offlineStorage';
import type { AnalyticsEvent } from '../types';

/**
 * Record a first-party usage event. Fire-and-forget and offline-safe: the event
 * is buffered in Dexie and flushed to the `analytics_events` table through the
 * same sync queue as the rest of the app. Never throws into the UI.
 *
 * Keep `properties` PII-free — enums, ids, counts only (see AnalyticsEvent).
 *
 * @example track('map_opened')
 * @example track('ar_mitigation_identified', { category, severity })
 */
export async function track(
  event: string,
  properties: Record<string, unknown> = {}
): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const evt: AnalyticsEvent = {
      id: uuidv4(),
      userId: data.session?.user?.id ?? null,
      event,
      properties,
      createdAt: new Date().toISOString(),
    };

    await db.analyticsEvents.add(evt);
    await queueSyncOperation({
      type: 'create',
      table: 'analytics_events',
      recordId: evt.id,
      data: evt,
    });
  } catch (error) {
    // Analytics must never break a user flow.
    console.error('Failed to record analytics event:', event, error);
  }
}
