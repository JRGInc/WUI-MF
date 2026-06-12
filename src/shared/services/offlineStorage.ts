import Dexie, { Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabaseClient';
import type {
  Assessment,
  AssessmentPhoto,
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
      await supabase.from(table).insert(data as Record<string, unknown>);
      break;
    case 'update':
      await supabase.from(table).update(data as Record<string, unknown>).eq('id', recordId);
      break;
    case 'delete':
      await supabase.from(table).delete().eq('id', recordId);
      break;
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
