import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import {
  db,
  saveAnnotationLocally,
  updateAnnotationLocally,
  deleteAnnotationLocally,
} from '@/shared/services/offlineStorage';
import type {
  AnnotationContent,
  AnnotationType,
  GeoCoordinates,
  MapAnnotation,
} from '@/shared/types';

interface NewAnnotation {
  coordinates: GeoCoordinates;
  annotationType: AnnotationType;
  content: AnnotationContent;
}

/**
 * Read/write the MapAnnotations attached to an assessment. The read is a Dexie
 * liveQuery, so a marker written from any view (map or AR) updates every other
 * mounted view live — a marker dropped in AR appears on the map immediately,
 * and vice versa. Writes go through the offlineStorage helpers (Dexie + sync
 * queue); liveQuery picks up the change, so callers don't manage local state.
 */
export function useAnnotations(assessmentId?: string) {
  const annotations =
    useLiveQuery(
      () =>
        assessmentId
          ? db.annotations.where('assessmentId').equals(assessmentId).toArray()
          : Promise.resolve([] as MapAnnotation[]),
      [assessmentId]
    ) ?? [];

  const addAnnotation = useCallback(
    async (input: NewAnnotation): Promise<MapAnnotation | null> => {
      if (!assessmentId) return null;
      const annotation: MapAnnotation = {
        id: uuidv4(),
        assessmentId,
        coordinates: input.coordinates,
        annotationType: input.annotationType,
        content: input.content,
        createdAt: new Date().toISOString(),
      };
      await saveAnnotationLocally(annotation);
      return annotation;
    },
    [assessmentId]
  );

  const updateAnnotation = useCallback(
    (id: string, updates: Partial<MapAnnotation>) => updateAnnotationLocally(id, updates),
    []
  );

  const removeAnnotation = useCallback((id: string) => deleteAnnotationLocally(id), []);

  return { annotations, addAnnotation, updateAnnotation, removeAnnotation };
}
