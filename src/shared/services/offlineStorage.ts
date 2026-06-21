import Dexie, { Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabaseClient';
import { upsertByDomainId } from './syncUpsert';
import type {
  AnalyticsEvent,
  Assessment,
  AssessmentPhoto,
  Finding,
  Property,
  SyncOperation,
  TrainingProgress,
  MapAnnotation,
} from '../types';

// Define the database schema
class WildfireRiskDB extends Dexie {
  properties!: Table<Property & { localId?: string }>;
  assessments!: Table<Assessment & { localId?: string }>;
  photos!: Table<AssessmentPhoto & { localId?: string; blob?: Blob }>;
  annotations!: Table<MapAnnotation & { localId?: string }>;
  trainingProgress!: Table<TrainingProgress>;
  syncQueue!: Table<SyncOperation>;
  cachedModels!: Table<{ name: string; data: ArrayBuffer; version: string }>;
  cachedTrainingContent!: Table<{ id: string; content: unknown; cachedAt: string }>;
  analyticsEvents!: Table<AnalyticsEvent & { localId?: number }>;

  constructor() {
    super('WildfireRiskDB');

    this.version(1).stores({
      properties: '++localId, id, userId, address',
      assessments: '++localId, id, propertyId, status, createdAt',
      photos: '++localId, id, assessmentId, category, syncStatus',
      annotations: '++localId, id, assessmentId, annotationType',
      trainingProgress: '++id, lessonId, userId, completed',
      syncQueue: '++id, type, table, timestamp, retryCount',
      cachedModels: 'name, version',
      cachedTrainingContent: 'id, cachedAt',
    });

    // v2: ML training-data collection — photos gain trainingConsent (boolean,
    // not indexable) and hazardTags (multiEntry index for export queries).
    this.version(2).stores({
      photos: '++localId, id, assessmentId, category, syncStatus, *hazardTags',
    });

    // v3: first-party usage analytics — events buffered locally then flushed
    // through the sync queue (same offline-first path as everything else).
    this.version(3).stores({
      analyticsEvents: '++localId, id, event, createdAt',
    });
  }
}

export const db = new WildfireRiskDB();

// Sync operation helpers
export async function queueSyncOperation(
  operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>
): Promise<void> {
  await db.syncQueue.add({
    ...operation,
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    retryCount: 0,
  });
}

export async function syncPendingOperations(): Promise<void> {
  const operations = await db.syncQueue.orderBy('timestamp').toArray();

  for (const operation of operations) {
    try {
      await executeSyncOperation(operation);
      await db.syncQueue.delete(operation.id);
    } catch (error) {
      console.error('Sync operation failed:', error);

      // Update retry count
      const newRetryCount = operation.retryCount + 1;
      if (newRetryCount >= 5) {
        // Move to failed after 5 retries
        await db.syncQueue.update(operation.id, {
          retryCount: newRetryCount,
          lastError: error instanceof Error ? error.message : 'Unknown error',
        });
      } else {
        await db.syncQueue.update(operation.id, {
          retryCount: newRetryCount,
        });
      }
    }
  }
}

// camelCase domain field → snake_case Supabase column, per table. The sync
// queue stores domain objects (camelCase); Supabase columns are snake_case and
// there is no automatic mapper, so we translate at the write boundary here.
// Keys absent from a table's map pass through unchanged — that covers columns
// whose names already match (id, address, status, completed) and JSON payload
// columns (findings, recommendations, content, coordinates) whose nested keys
// are stored as-is and cast back to the domain type on read.
const COLUMN_MAPS: Record<string, Record<string, string>> = {
  properties: {
    userId: 'user_id',
    parcelId: 'parcel_id',
    createdAt: 'created_at',
  },
  assessments: {
    propertyId: 'property_id',
    overallScore: 'overall_score',
    categoryScores: 'category_scores',
    createdAt: 'created_at',
    completedAt: 'completed_at',
  },
  map_annotations: {
    assessmentId: 'assessment_id',
    annotationType: 'annotation_type',
    createdAt: 'created_at',
  },
  training_progress: {
    userId: 'user_id',
    lessonId: 'lesson_id',
    quizScore: 'quiz_score',
    completedAt: 'completed_at',
  },
  shared_reports: {
    assessmentId: 'assessment_id',
    shareType: 'share_type',
    recipientEmail: 'recipient_email',
    accessToken: 'access_token',
    expiresAt: 'expires_at',
    createdAt: 'created_at',
  },
  analytics_events: {
    userId: 'user_id',
    createdAt: 'created_at',
  },
};

// Translate a camelCase domain record into a snake_case row for `table`.
function toRow(table: string, data: Record<string, unknown>): Record<string, unknown> {
  const map = COLUMN_MAPS[table];
  if (!map) return data;
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    row[map[key] ?? key] = value;
  }
  return row;
}

// Inverse of COLUMN_MAPS (snake_case column → camelCase domain field).
const REVERSE_COLUMN_MAPS: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(COLUMN_MAPS).map(([table, map]) => [
    table,
    Object.fromEntries(Object.entries(map).map(([camel, snake]) => [snake, camel])),
  ])
);

// Translate a snake_case Supabase row into a camelCase domain object — the
// inverse of toRow(), for use at read sites (`supabase.from(table).select()`).
// Keys without a mapping pass through unchanged (id/status/etc. and the nested
// objects from embedded joins, which the caller maps separately if needed).
export function fromRow<T = Record<string, unknown>>(
  table: string,
  row: Record<string, unknown>
): T {
  const map = REVERSE_COLUMN_MAPS[table];
  if (!map) return row as T;
  const obj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    obj[map[key] ?? key] = value;
  }
  return obj as T;
}

async function executeSyncOperation(operation: SyncOperation): Promise<void> {
  const { type, table, recordId, data } = operation;

  // Photos need special handling: blob upload to Storage, then a row insert
  // (see syncPhoto). The queue entry's data carries the Dexie localId.
  if (table === 'photos') {
    const { localId } = (data ?? {}) as { localId?: number };
    if (localId !== undefined) await syncPhoto(localId);
    return;
  }

  switch (type) {
    case 'create':
      await supabase.from(table).insert(toRow(table, data as Record<string, unknown>));
      break;
    case 'update':
      await supabase.from(table).update(toRow(table, data as Record<string, unknown>)).eq('id', recordId);
      break;
    case 'delete':
      await supabase.from(table).delete().eq('id', recordId);
      break;
  }
}

// --- Read sync (pull) ---------------------------------------------------------
// The write path pushes the queue to Supabase; this is the inverse, pulling the
// user's records down into Dexie so remote-created data (e.g. an assessment made
// on another device) appears offline. Upsert is keyed by the domain `id`.

// Pull the user's property → assessment → annotation hierarchy from Supabase
// into Dexie. (training_progress/photos pull separately — photos carry blobs in
// Storage and training_progress is keyed differently; tracked as follow-ups.)
export async function pullRemoteData(userId: string): Promise<void> {
  const pending = await db.syncQueue.toArray();
  const dirty = new Set(pending.map((op) => op.recordId));

  const { data: propRows, error: propErr } = await supabase
    .from('properties')
    .select('*')
    .eq('user_id', userId);
  if (propErr) throw propErr;
  const properties = (propRows ?? []).map((r) =>
    fromRow<Property>('properties', r as Record<string, unknown>)
  );
  await upsertByDomainId(db.properties, properties, dirty);

  const propertyIds = properties.map((p) => p.id);
  let assessmentIds: string[] = [];
  if (propertyIds.length > 0) {
    const { data: aRows, error: aErr } = await supabase
      .from('assessments')
      .select('*')
      .in('property_id', propertyIds);
    if (aErr) throw aErr;
    const assessments = (aRows ?? []).map((r) =>
      fromRow<Assessment>('assessments', r as Record<string, unknown>)
    );
    await upsertByDomainId(db.assessments, assessments, dirty);
    assessmentIds = assessments.map((a) => a.id);
  }

  if (assessmentIds.length > 0) {
    const { data: annRows, error: annErr } = await supabase
      .from('map_annotations')
      .select('*')
      .in('assessment_id', assessmentIds);
    if (annErr) throw annErr;
    const annotations = (annRows ?? []).map((r) =>
      fromRow<MapAnnotation>('map_annotations', r as Record<string, unknown>)
    );
    await upsertByDomainId(db.annotations, annotations, dirty);
  }
}

// Property operations
export async function savePropertyLocally(property: Property): Promise<string> {
  const localId = await db.properties.add({ ...property, localId: uuidv4() });

  await queueSyncOperation({
    type: 'create',
    table: 'properties',
    recordId: property.id,
    data: property,
  });

  return String(localId);
}

export async function getLocalProperties(userId: string): Promise<Property[]> {
  return db.properties.where('userId').equals(userId).toArray();
}

// Assessment operations
export async function saveAssessmentLocally(assessment: Assessment): Promise<string> {
  const localId = await db.assessments.add({ ...assessment, localId: uuidv4() });

  await queueSyncOperation({
    type: 'create',
    table: 'assessments',
    recordId: assessment.id,
    data: assessment,
  });

  return String(localId);
}

export async function updateAssessmentLocally(
  id: string,
  updates: Partial<Assessment>
): Promise<void> {
  const assessment = await db.assessments.where('id').equals(id).first();
  if (assessment) {
    await db.assessments.update(assessment.localId!, updates);

    await queueSyncOperation({
      type: 'update',
      table: 'assessments',
      recordId: id,
      data: updates,
    });
  }
}

export async function getLocalAssessment(id: string): Promise<Assessment | undefined> {
  return db.assessments.where('id').equals(id).first();
}

export async function getLocalAssessments(propertyId: string): Promise<Assessment[]> {
  return db.assessments.where('propertyId').equals(propertyId).toArray();
}

// Append a finding to an assessment's findings array. Offline-first: if the
// assessment lives in Dexie, update it locally and queue the sync; otherwise
// (it was created online and only exists in Supabase) read-modify-write the row
// directly. Used by the AR viewer to persist a captured hazard.
export async function addFindingToAssessment(
  assessmentId: string,
  finding: Finding
): Promise<void> {
  const local = await db.assessments.where('id').equals(assessmentId).first();
  if (local) {
    const findings = [...(local.findings ?? []), finding];
    await db.assessments.update(local.localId!, { findings });
    await queueSyncOperation({
      type: 'update',
      table: 'assessments',
      recordId: assessmentId,
      data: { findings },
    });
    return;
  }

  const { data, error } = await supabase
    .from('assessments')
    .select('findings')
    .eq('id', assessmentId)
    .single();
  if (error) throw error;
  const findings = [...(((data?.findings as Finding[] | null) ?? [])), finding];
  const { error: updateError } = await supabase
    .from('assessments')
    .update({ findings })
    .eq('id', assessmentId);
  if (updateError) throw updateError;
}

// Annotation operations. Both the map and the AR viewer write MapAnnotations
// through these helpers, so a marker placed in one view is the same record the
// other view reads (see the Map ⇄ AR design note). Reads come from Dexie; the
// snake_case map_annotations column mapping is already in COLUMN_MAPS.
export async function saveAnnotationLocally(annotation: MapAnnotation): Promise<string> {
  const localId = await db.annotations.add({ ...annotation, localId: uuidv4() });

  await queueSyncOperation({
    type: 'create',
    table: 'map_annotations',
    recordId: annotation.id,
    data: annotation,
  });

  return String(localId);
}

export async function updateAnnotationLocally(
  id: string,
  updates: Partial<MapAnnotation>
): Promise<void> {
  const annotation = await db.annotations.where('id').equals(id).first();
  if (!annotation) return;

  await db.annotations.update(annotation.localId!, updates);
  await queueSyncOperation({
    type: 'update',
    table: 'map_annotations',
    recordId: id,
    data: updates,
  });
}

export async function deleteAnnotationLocally(id: string): Promise<void> {
  const annotation = await db.annotations.where('id').equals(id).first();
  if (!annotation) return;

  await db.annotations.delete(annotation.localId!);
  await queueSyncOperation({
    type: 'delete',
    table: 'map_annotations',
    recordId: id,
    data: {},
  });
}

export async function getLocalAnnotations(assessmentId: string): Promise<MapAnnotation[]> {
  return db.annotations.where('assessmentId').equals(assessmentId).toArray();
}

// Photo operations
export async function savePhotoLocally(
  photo: AssessmentPhoto,
  blob: Blob
): Promise<number> {
  const localId = (await db.photos.add({
    ...photo,
    localBlob: undefined, // the blob is stored once, in the `blob` field
    blob,
    syncStatus: 'pending',
  })) as number;

  await queueSyncOperation({
    type: 'create',
    table: 'photos',
    recordId: photo.id,
    data: { localId },
  });

  return localId;
}

export async function getLocalPhotos(assessmentId: string): Promise<AssessmentPhoto[]> {
  return db.photos.where('assessmentId').equals(assessmentId).toArray();
}

export async function syncPhoto(localId: number): Promise<void> {
  const photo = await db.photos.get(localId);
  if (!photo || !photo.blob) return;

  await db.photos.update(localId, { syncStatus: 'syncing' });

  try {
    // Upload to Supabase Storage
    const path = `${photo.assessmentId}/${photo.id}.jpg`;
    const { error } = await supabase.storage
      .from('assessment-photos')
      .upload(path, photo.blob);

    if (error) throw error;

    // Update database record
    await supabase.from('assessment_photos').insert({
      id: photo.id,
      assessment_id: photo.assessmentId,
      storage_path: path,
      category: photo.category,
      analysis_results: photo.analysisResults,
      captured_at: photo.capturedAt,
      training_consent: photo.trainingConsent ?? false,
      hazard_tags: photo.hazardTags ?? [],
    });

    // Update local record
    await db.photos.update(localId, {
      syncStatus: 'synced',
      storagePath: path,
    });

    // Remove blob from local storage to save space
    await db.photos.update(localId, { blob: undefined });
  } catch (error) {
    await db.photos.update(localId, {
      syncStatus: 'error',
    });
    throw error;
  }
}

// Model caching
export async function cacheModel(
  name: string,
  data: ArrayBuffer,
  version: string
): Promise<void> {
  await db.cachedModels.put({ name, data, version });
}

export async function getCachedModel(
  name: string
): Promise<{ data: ArrayBuffer; version: string } | undefined> {
  return db.cachedModels.get(name);
}

// Training content caching
export async function cacheTrainingContent(id: string, content: unknown): Promise<void> {
  await db.cachedTrainingContent.put({
    id,
    content,
    cachedAt: new Date().toISOString(),
  });
}

export async function getCachedTrainingContent(id: string): Promise<unknown | undefined> {
  const cached = await db.cachedTrainingContent.get(id);
  return cached?.content;
}

// Clear old cached data
export async function clearOldCache(daysOld: number = 30): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  await db.cachedTrainingContent
    .where('cachedAt')
    .below(cutoff.toISOString())
    .delete();
}

// Export database for debugging
export async function exportDatabase(): Promise<unknown> {
  return {
    properties: await db.properties.toArray(),
    assessments: await db.assessments.toArray(),
    photos: await db.photos.toArray(),
    annotations: await db.annotations.toArray(),
    trainingProgress: await db.trainingProgress.toArray(),
    syncQueue: await db.syncQueue.toArray(),
  };
}
