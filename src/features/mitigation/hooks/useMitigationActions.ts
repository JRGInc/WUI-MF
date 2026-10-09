import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/shared/services/supabaseClient';
import {
  db,
  deleteMitigationActionLocally,
  getLocalMitigationActions,
  saveMitigationActionLocally,
  savePhotoLocally,
} from '@/shared/services/offlineStorage';
import { mitigationFromRow } from '@/shared/services/mitigationRows';
import { track } from '@/shared/services/analytics';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOffline } from '@/app/providers/OfflineProvider';
import type {
  AssessmentPhoto,
  MitigationAction,
  MitigationStatus,
  Recommendation,
} from '@/shared/types';
import {
  addEvidencePhoto,
  applyNotesChange,
  applyStatusChange,
  isLocked,
  mergeActions,
  MitigationChangeError,
} from '../mitigationProgress';

export type StatusChoice = MitigationStatus | 'not_started';

/**
 * Mitigation actions for one assessment. Offline-first: local Dexie records win
 * over remote rows (they may hold unpushed edits); remote rows fill in records
 * created on another device or for an assessment that was saved online.
 *
 * In readOnly mode (the shared /report/:token view) it only reads remote rows,
 * which RLS exposes via mitigation_select_shared.
 */
export function useMitigationActions(assessmentId: string, readOnly = false) {
  const { user } = useAuth();
  const { isOnline, syncNow } = useOffline();
  const [actions, setActions] = useState<MitigationAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const local = readOnly ? [] : await getLocalMitigationActions(assessmentId);

      let remote: MitigationAction[] = [];
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('mitigation_actions')
          .select('*')
          .eq('assessment_id', assessmentId);
        if (!error && data) {
          remote = data.map((r) => mitigationFromRow(r as Record<string, unknown>));
        }
      }

      // A local "not started" reset is a queued delete; don't let the
      // still-present remote row resurrect it before the delete syncs.
      let pendingDeletes = new Set<string>();
      if (!readOnly) {
        const ops = await db.syncQueue
          .filter((op) => op.table === 'mitigation_actions' && op.type === 'delete')
          .toArray();
        pendingDeletes = new Set(ops.map((op) => op.recordId));
      }

      setActions(
        mergeActions(
          remote.filter((a) => !pendingDeletes.has(a.id)),
          local
        )
      );
    } catch (error) {
      console.error('Error loading mitigation actions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [assessmentId, readOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const actionFor = useCallback(
    (recId: string) => actions.find((a) => a.recommendationId === recId),
    [actions]
  );

  const ctx = { assessmentId, userId: user?.id };

  async function persist(next: MitigationAction) {
    await saveMitigationActionLocally(next);
    setActions((prev) => [...prev.filter((a) => a.id !== next.id), next]);
    if (isOnline) syncNow().catch((err) => console.error('Mitigation sync failed:', err));
  }

  /** Set an owner status, or reset to "not started" (deletes the record). */
  async function setStatus(rec: Recommendation, choice: StatusChoice): Promise<void> {
    const existing = actionFor(rec.id);
    const from: StatusChoice = existing?.status ?? 'not_started';
    if (from === choice) return;

    if (choice === 'not_started') {
      if (!existing) return;
      if (isLocked(existing)) {
        throw new MitigationChangeError('This mitigation has been verified and can no longer be changed.');
      }
      await deleteMitigationActionLocally(existing.id);
      setActions((prev) => prev.filter((a) => a.id !== existing.id));
      if (isOnline) syncNow().catch((err) => console.error('Mitigation sync failed:', err));
    } else {
      await persist(applyStatusChange(existing, rec, choice, ctx));
    }

    // PII-free: enums only.
    void track('mitigation_status_changed', {
      category: rec.category,
      priority: rec.priority,
      from,
      to: choice,
    });
    if (choice === 'completed') {
      void track('mitigation_completed', { category: rec.category, priority: rec.priority });
    }
  }

  async function setNotes(rec: Recommendation, notes: string): Promise<void> {
    const existing = actionFor(rec.id);
    if ((existing?.notes ?? '') === notes.trim()) return;
    if (!existing && notes.trim() === '') return;
    await persist(applyNotesChange(existing, rec, notes, ctx));
  }

  /** Save a photo against the assessment and attach it as evidence. */
  async function attachEvidence(rec: Recommendation, file: File): Promise<void> {
    const existing = actionFor(rec.id);
    if (isLocked(existing)) {
      throw new MitigationChangeError('This mitigation has been verified and can no longer be changed.');
    }
    const photo: AssessmentPhoto = {
      id: uuidv4(),
      assessmentId,
      storagePath: '',
      category: rec.category,
      capturedAt: new Date().toISOString(),
      syncStatus: 'pending',
      // Evidence photos are proof of work, not ML training data, unless the
      // user opts in through the assessment wizard.
      trainingConsent: false,
      hazardTags: [],
    };
    await savePhotoLocally(photo, file);
    await persist(addEvidencePhoto(existing, rec, photo.id, ctx));
    void track('mitigation_evidence_added', { category: rec.category });
  }

  return { actions, isLoading, actionFor, setStatus, setNotes, attachEvidence, reload: load };
}
